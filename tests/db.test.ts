import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import * as db from '../src/core/db';
import { SAMPLE_SHEET } from '../src/core/sample';

beforeEach(async () => {
  await db._resetDbHandle();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('leseraupe');
    r.onsuccess = () => res();
    r.onerror = () => res();
  });
});

describe('Verlauf und Protokoll', () => {
  it('Nummer erst beim ersten Drucken, fortlaufend', async () => {
    const a = await db.saveOnPrint(SAMPLE_SHEET, 1.2, null, true);
    const b = await db.saveOnPrint(SAMPLE_SHEET, 1.1, null, true);
    expect(a.number).toBe(1);
    expect(b.number).toBe(2);
    expect(b.data.number).toBe(2);
    // erneutes Drucken desselben Blatts: keine neue Nummer
    const a2 = await db.saveOnPrint(SAMPLE_SHEET, 1.2, a.id!, true);
    expect(a2.number).toBe(1);
    expect((await db.allSheets()).length).toBe(2);
  });

  it('Status erstellt → gedruckt → gelesen, mehrere Lesungen', async () => {
    const pdf = await db.saveOnPrint(SAMPLE_SHEET, 1, null, false);
    expect(db.statusOf(pdf)).toBe('erstellt');
    const pr = await db.saveOnPrint(SAMPLE_SHEET, 1, pdf.id!, true);
    expect(db.statusOf(pr)).toBe('gedruckt');
    await db.addRead(pr.id!, 5);
    const r = await db.addRead(pr.id!, 10, true);
    expect(db.statusOf(r!)).toBe('gelesen');
    expect(r!.reads).toHaveLength(2);
    const st = db.stats(await db.allSheets());
    expect(st).toEqual({ erstellt: 1, gedruckt: 1, gelesen: 1, minuten: 15 });
  });

  it('Protokoll enthält alle Ereignisse', async () => {
    const a = await db.saveOnPrint(SAMPLE_SHEET, 1, null, true);
    await db.addRead(a.id!, 5);
    await db.log('Buchstabe E hinzugefügt');
    const texts = (await db.allLog()).map((e) => e.text);
    expect(texts).toEqual(expect.arrayContaining(['Blatt 1 erstellt', 'Blatt 1 gedruckt', 'Blatt 1 gelesen, 5 Min', 'Buchstabe E hinzugefügt']));
  });

  it('Serie: Tage in Folge', () => {
    const days = new Set(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-20']);
    expect(db.streak(days, new Date(2026, 9, 27, 12))).toBe(3);
    expect(db.streak(days, new Date(2026, 9, 28, 12))).toBe(3);
    expect(db.streak(days, new Date(2026, 9, 30, 12))).toBe(0);
  });

  it('Sicherung: Export und Import', async () => {
    const a = await db.saveOnPrint(SAMPLE_SHEET, 1.3, null, true);
    await db.addRead(a.id!, 5);
    const backup = await db.exportBackup({ childName: 'Mia' });
    const json = JSON.stringify(backup);
    await db.importBackup(db.parseBackup('{"app":"leseraupe","version":1,"sheets":[],"log":[]}'));
    expect(await db.allSheets()).toEqual([]);
    await db.importBackup(db.parseBackup(json));
    const list = await db.allSheets();
    expect(list).toHaveLength(1);
    expect(list[0].data).toEqual(a.data);
    expect(list[0].scale).toBe(1.3);
    expect((await db.allLog()).length).toBe(backup.log.length);
    expect(() => db.parseBackup('{"foo":1}')).toThrow();
  });
});
