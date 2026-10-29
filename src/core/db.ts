import { THEME_IDS } from '../sheet/themes';
import type { SheetData, Minutes } from './types';
import { FIRST_KIND_ID, sanitizeProfile, type Profile } from './store';

/** Gespeicherte Blätter und Protokoll – nur lokal in IndexedDB. */

export type Status = 'erstellt' | 'gedruckt' | 'gelesen';

export interface Lesung {
  at: string;
  minutes: number;
  /** wie es ging (freiwillig, nach dem Lesen) – steuert die Stufe des nächsten Blatts */
  gefuehl?: 'leicht' | 'geht' | 'schwer';
}

export interface SheetRecord {
  id?: number;
  /** Profil des Kindes (A1); Nummern zählen je Kind */
  kindId: string;
  number: number;
  createdAt: string;
  printedAt: string | null;
  reads: Lesung[];
  data: SheetData;
  scale: number;
}

export interface LogEntry {
  id?: number;
  kindId: string;
  at: string;
  text: string;
}

export function statusOf(r: SheetRecord): Status {
  if (r.reads.length) return 'gelesen';
  if (r.printedAt) return 'gedruckt';
  return 'erstellt';
}

const DB_NAME = 'leseraupe';
const VERSION = 2;

let dbp: Promise<IDBDatabase> | null = null;
let currentKind = FIRST_KIND_ID;

/** Kind, für das Blätter und Protokoll gelesen und geschrieben werden */
export function useKind(id: string): void {
  currentKind = id;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = (e) => {
        const db = r.result;
        const tx = r.transaction!;
        const sheets = db.objectStoreNames.contains('sheets')
          ? tx.objectStore('sheets')
          : db.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true });
        const logs = db.objectStoreNames.contains('log') ? tx.objectStore('log') : db.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
        if (e.oldVersion < 2) {
          // v1 → v2: alles gehört dem ersten Kind, Nummern eindeutig je Kind
          if (sheets.indexNames.contains('number')) sheets.deleteIndex('number');
          sheets.createIndex('kind_number', ['kindId', 'number'], { unique: true });
          sheets.createIndex('kindId', 'kindId');
          logs.createIndex('kindId', 'kindId');
          for (const st of [sheets, logs]) {
            st.openCursor().onsuccess = (ev) => {
              const c = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (!c) return;
              if (!c.value.kindId) c.update({ ...c.value, kindId: FIRST_KIND_ID });
              c.continue();
            };
          }
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

/** nur für Tests */
export async function _resetDbHandle(): Promise<void> {
  if (dbp) (await dbp).close();
  dbp = null;
}

async function store(name: 'sheets' | 'log', mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

const now = () => new Date().toISOString();

export async function allSheets(kindId = currentKind): Promise<SheetRecord[]> {
  const list = await req((await store('sheets')).index('kindId').getAll(kindId));
  return (list as SheetRecord[]).sort((a, b) => b.number - a.number);
}

export async function getSheet(id: number): Promise<SheetRecord | undefined> {
  return (await req((await store('sheets')).get(id))) as SheetRecord | undefined;
}

export async function putSheet(r: SheetRecord): Promise<number> {
  return (await req((await store('sheets', 'readwrite')).put(r))) as number;
}

export async function log(text: string, at = now(), kindId = currentKind): Promise<void> {
  await req((await store('log', 'readwrite')).add({ kindId, at, text }));
}

export async function allLog(kindId = currentKind): Promise<LogEntry[]> {
  const list = (await req((await store('log')).index('kindId').getAll(kindId))) as LogEntry[];
  return list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : (b.id ?? 0) - (a.id ?? 0)));
}

export async function nextNumber(kindId = currentKind): Promise<number> {
  const list = await allSheets(kindId);
  return list.reduce((m, r) => Math.max(m, r.number), 0) + 1;
}

/**
 * Blatt beim ersten Drucken/Speichern ablegen: bekommt die nächste Nummer.
 * Ist es schon gespeichert (id vorhanden), wird nur der Status aktualisiert.
 */
export async function saveOnPrint(
  data: SheetData,
  scale: number,
  existingId: number | null,
  printed: boolean | 'none',
): Promise<SheetRecord> {
  let rec = existingId ? await getSheet(existingId) : undefined;
  if (rec) {
    // nach Änderungen in der Vorschau: gespeicherte Fassung aktualisieren (Nummer bleibt)
    rec.data = { ...data, number: rec.number };
    rec.scale = scale;
    await putSheet(rec);
  } else {
    const number = await nextNumber();
    rec = { kindId: currentKind, number, createdAt: now(), printedAt: null, reads: [], data: { ...data, number }, scale };
    rec.id = await putSheet(rec);
    await log(`Blatt ${number} erstellt`);
  }
  if (printed === true) {
    rec.printedAt = now();
    await putSheet(rec);
    // ob der Drucker wirklich gedruckt hat, kann die App nicht wissen – nur, dass gedruckt werden sollte
    await log(`Blatt ${rec.number} zum Drucken geschickt`);
  } else if (printed === false) {
    await log(`Blatt ${rec.number} als PDF gespeichert`);
  }
  return rec;
}

export async function addRead(id: number, minutes: number, manual = false): Promise<SheetRecord | undefined> {
  const rec = await getSheet(id);
  if (!rec) return undefined;
  rec.reads.push({ at: now(), minutes });
  await putSheet(rec);
  await log(`Blatt ${rec.number} gelesen, ${minutes} Min${manual ? ' (von Hand)' : ''}`);
  return rec;
}

/** „Wie ging das Lesen heute?“ an die letzte Lesung des Blatts hängen */
export async function setGefuehl(id: number, gefuehl: NonNullable<Lesung['gefuehl']>): Promise<void> {
  const rec = await getSheet(id);
  if (!rec || !rec.reads.length) return;
  rec.reads[rec.reads.length - 1].gefuehl = gefuehl;
  await putSheet(rec);
}

export interface Stats {
  erstellt: number;
  gedruckt: number;
  gelesen: number;
  minuten: number;
}

export function stats(list: SheetRecord[]): Stats {
  return {
    erstellt: list.length,
    gedruckt: list.filter((r) => r.printedAt).length,
    gelesen: list.filter((r) => r.reads.length).length,
    minuten: list.reduce((s, r) => s + r.reads.reduce((a, x) => a + x.minutes, 0), 0),
  };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Tage (lokales Datum YYYY-MM-DD) mit mindestens einer Lesung */
export function readingDays(list: SheetRecord[]): Set<string> {
  const s = new Set<string>();
  for (const r of list) for (const x of r.reads) s.add(dayKey(new Date(x.at)));
  return s;
}

/** Tage in Folge bis heute (oder bis gestern, wenn heute noch nicht gelesen wurde) */
export function streak(days: Set<string>, today = new Date()): number {
  const d = new Date(today);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export { dayKey };

/* ---------- Sicherung ---------- */

/** Version 2: alle Kinder mit Einstellungen, Blätter und Protokoll aller Kinder */
export interface Backup {
  app: 'leseraupe';
  version: 2;
  exportedAt: string;
  profile: Profile;
  sheets: SheetRecord[];
  log: LogEntry[];
}

async function getAllOf<T>(name: 'sheets' | 'log'): Promise<T[]> {
  return (await req((await store(name)).getAll())) as T[];
}

export async function exportBackup(profile: Profile): Promise<Backup> {
  const sheets = (await getAllOf<SheetRecord>('sheets')).sort((a, b) => a.kindId.localeCompare(b.kindId) || b.number - a.number);
  const log = await getAllOf<LogEntry>('log');
  return { app: 'leseraupe', version: 2, exportedAt: now(), profile, sheets, log };
}

/** Liest Sicherungen v1 (ein Kind, `settings`) und v2; liefert immer v2. */
const istText = (x: unknown): x is string => typeof x === 'string';
const istTextListe = (x: unknown) => Array.isArray(x) && x.every(istText);
const istDatum = (x: unknown) => istText(x) && !Number.isNaN(Date.parse(x));

/** Ist ein Blatt aus einer Sicherung vollständig genug, um es anzuzeigen und zu drucken? */
export function gueltigesBlatt(r: unknown): r is SheetRecord {
  const x = r as Partial<SheetRecord> | null;
  const d = x?.data as Partial<SheetData> | undefined;
  return (
    !!x &&
    Number.isInteger(x.number) &&
    (x.number as number) > 0 &&
    istDatum(x.createdAt) &&
    (x.printedAt == null || istDatum(x.printedAt)) &&
    Array.isArray(x.reads) &&
    x.reads.every((l) => !!l && istDatum(l.at) && typeof l.minutes === 'number' && l.minutes >= 0) &&
    typeof x.scale === 'number' &&
    !!d &&
    typeof d === 'object' &&
    THEME_IDS.includes(d.theme as never) &&
    !!d.blocks &&
    typeof d.blocks === 'object' &&
    ['letters', 'silben', 'woerter', 'kleine', 'saetze', 'fragen'].every((k) => istTextListe((d as Record<string, unknown>)[k])) &&
    (d.geschichte == null || (istText(d.geschichte.titel) && istTextListe(d.geschichte.saetze)))
  );
}

/**
 * Sicherung lesen und prüfen. Unvollständige Blätter oder Einträge werden übersprungen
 * (Anzahl in `uebersprungen`); ist gar nichts Brauchbares drin, gibt es einen Fehler.
 */
export function parseBackup(text: string): Backup & { uebersprungen: number } {
  const b = JSON.parse(text);
  if (!b || b.app !== 'leseraupe' || !Array.isArray(b.sheets) || !Array.isArray(b.log)) {
    throw new Error('Das ist keine Leseraupe-Sicherung.');
  }
  const v2 = b.version === 2;
  const k = FIRST_KIND_ID;
  const profile = v2 ? sanitizeProfile(b.profile) : sanitizeProfile({ activeKindId: k, kinder: [{ id: k, settings: b.settings }] });
  const kinder = new Set(profile.kinder.map((x) => x.id));
  const roh = (b.sheets as unknown[]).map((r) => (v2 ? r : { ...(r as object), kindId: k }));
  const gesehen = new Set<string>();
  const sheets = roh.filter((r): r is SheetRecord => {
    if (!gueltigesBlatt(r) || !kinder.has(r.kindId)) return false;
    const key = `${r.kindId}:${r.number}`;
    if (gesehen.has(key)) return false;
    gesehen.add(key);
    return true;
  });
  if (roh.length && !sheets.length) throw new Error('Die Sicherung ist beschädigt.');
  const log = (b.log as unknown[])
    .map((e) => (v2 ? e : { ...(e as object), kindId: k }) as LogEntry)
    .filter((e) => !!e && istDatum(e.at) && istText(e.text) && kinder.has(e.kindId));
  return {
    app: 'leseraupe',
    version: 2,
    exportedAt: istDatum(b.exportedAt) ? b.exportedAt : now(),
    profile,
    sheets,
    log,
    uebersprungen: roh.length - sheets.length,
  };
}

/** Ersetzt alle gespeicherten Blätter und das Protokoll durch die Sicherung. */
export async function importBackup(b: Backup): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(['sheets', 'log'], 'readwrite');
    const s = tx.objectStore('sheets');
    const l = tx.objectStore('log');
    s.clear();
    l.clear();
    for (const r of b.sheets) s.put(r);
    for (const e of b.log) l.put(e);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export type { Minutes };
