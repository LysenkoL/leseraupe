import type { SheetData, Minutes } from './types';

/** Gespeicherte Blätter und Protokoll – nur lokal in IndexedDB. */

export type Status = 'erstellt' | 'gedruckt' | 'gelesen';

export interface Lesung {
  at: string;
  minutes: number;
}

export interface SheetRecord {
  id?: number;
  number: number;
  createdAt: string;
  printedAt: string | null;
  reads: Lesung[];
  data: SheetData;
  scale: number;
}

export interface LogEntry {
  id?: number;
  at: string;
  text: string;
}

export function statusOf(r: SheetRecord): Status {
  if (r.reads.length) return 'gelesen';
  if (r.printedAt) return 'gedruckt';
  return 'erstellt';
}

const DB_NAME = 'leseraupe';
const VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;

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
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('sheets')) {
          const s = db.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true });
          s.createIndex('number', 'number', { unique: true });
        }
        if (!db.objectStoreNames.contains('log')) db.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
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

export async function allSheets(): Promise<SheetRecord[]> {
  const list = await req((await store('sheets')).getAll());
  return (list as SheetRecord[]).sort((a, b) => b.number - a.number);
}

export async function getSheet(id: number): Promise<SheetRecord | undefined> {
  return (await req((await store('sheets')).get(id))) as SheetRecord | undefined;
}

export async function putSheet(r: SheetRecord): Promise<number> {
  return (await req((await store('sheets', 'readwrite')).put(r))) as number;
}

export async function log(text: string, at = now()): Promise<void> {
  await req((await store('log', 'readwrite')).add({ at, text }));
}

export async function allLog(): Promise<LogEntry[]> {
  const list = (await req((await store('log')).getAll())) as LogEntry[];
  return list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : (b.id ?? 0) - (a.id ?? 0)));
}

export async function nextNumber(): Promise<number> {
  const list = await allSheets();
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
    rec = { number, createdAt: now(), printedAt: null, reads: [], data: { ...data, number }, scale };
    rec.id = await putSheet(rec);
    await log(`Blatt ${number} erstellt`);
  }
  if (printed === true) {
    rec.printedAt = now();
    await putSheet(rec);
    await log(`Blatt ${rec.number} gedruckt`);
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

export interface Backup {
  app: 'leseraupe';
  version: 1;
  exportedAt: string;
  settings: unknown;
  sheets: SheetRecord[];
  log: LogEntry[];
}

export async function exportBackup(settings: unknown): Promise<Backup> {
  return { app: 'leseraupe', version: 1, exportedAt: now(), settings, sheets: await allSheets(), log: await allLog() };
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text);
  if (!b || b.app !== 'leseraupe' || !Array.isArray(b.sheets) || !Array.isArray(b.log)) {
    throw new Error('Das ist keine Leseraupe-Sicherung.');
  }
  return b as Backup;
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
