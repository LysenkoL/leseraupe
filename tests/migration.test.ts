import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import * as db from '../src/core/db';
import { SAMPLE_SHEET } from '../src/core/sample';
import { FIRST_KIND_ID, loadProfile, loadSettings, sanitizeProfile, saveSettings } from '../src/core/store';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Datenbank genau so anlegen, wie die alte Version (v1) sie hinterlassen hat */
async function createV1Db(): Promise<void> {
  const d = await new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open('leseraupe', 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true });
      s.createIndex('number', 'number', { unique: true });
      r.result.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = d.transaction(['sheets', 'log'], 'readwrite');
  for (const number of [1, 2]) {
    tx.objectStore('sheets').add({
      number, createdAt: `2026-10-0${number}T08:00:00.000Z`, printedAt: `2026-10-0${number}T08:01:00.000Z`,
      reads: [{ at: `2026-10-0${number}T17:00:00.000Z`, minutes: 5 }], data: { ...SAMPLE_SHEET, number }, scale: 1.1,
    });
  }
  for (const text of ['Blatt 1 erstellt', 'Blatt 2 erstellt', 'Buchstabe E hinzugefügt']) tx.objectStore('log').add({ at: '2026-10-02T09:00:00.000Z', text });
  await new Promise<void>((res) => { tx.oncomplete = () => res(); });
  d.close();
}

beforeEach(async () => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  db.useKind(FIRST_KIND_ID);
  await db._resetDbHandle();
  await req(indexedDB.deleteDatabase('leseraupe'));
});

describe('A1: Umzug alter Daten zum ersten Kind', () => {
  it('IndexedDB v1 → v2: Blätter und Protokoll bleiben vollständig', async () => {
    await createV1Db();
    const list = await db.allSheets();
    expect(list.map((r) => r.number)).toEqual([2, 1]);
    expect(list.every((r) => r.kindId === FIRST_KIND_ID)).toBe(true);
    expect(list[1].reads).toEqual([{ at: '2026-10-01T17:00:00.000Z', minutes: 5 }]);
    expect(list[1].data).toEqual({ ...SAMPLE_SHEET, number: 1 });
    expect(list[1].scale).toBe(1.1);
    const log = await db.allLog();
    expect(log).toHaveLength(3);
    expect(log.every((e) => e.kindId === FIRST_KIND_ID)).toBe(true);
    expect(db.stats(list)).toEqual({ erstellt: 2, gedruckt: 2, gelesen: 2, minuten: 10 });
  });

  it('nach dem Umzug geht die Nummerierung weiter; jedes Kind zählt für sich', async () => {
    await createV1Db();
    const r = await db.saveOnPrint(SAMPLE_SHEET, 1, null, true);
    expect(r.number).toBe(3);
    expect(r.kindId).toBe(FIRST_KIND_ID);
    db.useKind('k2');
    expect(await db.allSheets()).toEqual([]);
    expect((await db.saveOnPrint(SAMPLE_SHEET, 1, null, true)).number).toBe(1);
    expect(await db.allLog()).toHaveLength(2);
    db.useKind(FIRST_KIND_ID);
    expect((await db.allSheets()).map((x) => x.number)).toEqual([3, 2, 1]);
  });

  it('Einstellungen v1 werden zum Profil des ersten Kindes, alter Schlüssel bleibt', () => {
    const v1 = JSON.stringify({ letters: ['t', 'o', 'm', 'e'], newLetter: 'e', minutes: 10, childName: 'Mia', theme: 'meer' });
    localStorage.setItem('leseraupe.settings.v1', v1);
    const p = loadProfile();
    expect(p.activeKindId).toBe(FIRST_KIND_ID);
    expect(p.kinder).toHaveLength(1);
    expect(p.kinder[0].settings).toMatchObject({ newLetter: 'e', minutes: 10, childName: 'Mia', theme: 'meer' });
    expect(p.kinder[0].settings.letters).toContain('e');
    expect(localStorage.getItem('leseraupe.kinder.v2')).not.toBeNull();
    expect(localStorage.getItem('leseraupe.settings.v1')).toBe(v1);
    // spätere Änderungen landen im Profil, nicht mehr in v1
    saveSettings({ ...loadSettings(), childName: 'Ben' });
    expect(loadSettings().childName).toBe('Ben');
    expect(loadProfile().kinder[0].settings.childName).toBe('Ben');
  });

  it('kaputtes Profil wird repariert', () => {
    expect(sanitizeProfile({ activeKindId: 'x', kinder: [] }).kinder[0].id).toBe(FIRST_KIND_ID);
    const p = sanitizeProfile({ activeKindId: 'zz', kinder: [{ id: 'k7', settings: { minutes: 3 } as never }] });
    expect(p.activeKindId).toBe('k7');
    expect(p.kinder[0].settings.minutes).toBe(5);
  });
});

describe('A1: Sicherung', () => {
  it('alte Sicherung v1 lässt sich laden', async () => {
    const v1 = {
      app: 'leseraupe', version: 1, exportedAt: '2026-10-20T10:00:00.000Z', settings: { childName: 'Mia', letters: ['t', 'a'] },
      sheets: [{ id: 5, number: 1, createdAt: '2026-10-01T08:00:00.000Z', printedAt: null, reads: [], data: { ...SAMPLE_SHEET, number: 1 }, scale: 1 }],
      log: [{ id: 9, at: '2026-10-01T08:00:00.000Z', text: 'Blatt 1 erstellt' }],
    };
    const b = db.parseBackup(JSON.stringify(v1));
    expect(b.version).toBe(2);
    expect(b.profile.kinder[0].settings.childName).toBe('Mia');
    await db.importBackup(b);
    const list = await db.allSheets();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 5, number: 1, kindId: FIRST_KIND_ID });
    expect(await db.allLog()).toHaveLength(1);
    expect((await db.saveOnPrint(SAMPLE_SHEET, 1, null, true)).number).toBe(2);
  });

  it('Sicherung v2 enthält alle Kinder und kommt unverändert zurück', async () => {
    await db.saveOnPrint(SAMPLE_SHEET, 1, null, true);
    db.useKind('k2');
    await db.saveOnPrint(SAMPLE_SHEET, 1, null, false);
    const profile = sanitizeProfile({
      activeKindId: 'k1',
      kinder: [{ id: 'k1', settings: { childName: 'Mia' } as never }, { id: 'k2', settings: { childName: 'Ben' } as never }],
    });
    const backup = await db.exportBackup(profile);
    expect(backup.sheets).toHaveLength(2);
    const json = JSON.stringify(backup);
    await db.importBackup(db.parseBackup('{"app":"leseraupe","version":2,"sheets":[],"log":[]}'));
    expect(await db.allSheets()).toEqual([]);
    const back = db.parseBackup(json);
    expect(back.profile).toEqual(profile);
    await db.importBackup(back);
    expect(await db.allSheets()).toHaveLength(1);
    db.useKind('k1');
    expect(await db.allSheets()).toHaveLength(1);
    expect(await db.allLog()).toHaveLength(2);
  });
});
