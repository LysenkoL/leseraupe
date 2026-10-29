import { activeKind, FIRST_KIND_ID, loadProfile, saveSettings, type Settings } from '../core/store';
import { useKind } from '../core/db';
import type { SheetData } from '../core/types';
import type { Removed } from '../core/generator';
import { THEME_IDS, type ThemeId } from '../sheet/themes';

/** Aktuelles (noch nicht unbedingt gespeichertes) Blatt in der Vorschau */
export interface Draft {
  data: SheetData;
  seed: number;
  removed: Removed[];
  /** id in IndexedDB, sobald gedruckt/gespeichert */
  savedId: number | null;
  scale: number;
}

const kind = activeKind(loadProfile());
useKind(kind.id);

/** Entwurf und Thema des Tages gehören zum Kind; v1-Schlüssel ohne Kind = erstes Kind */
const DRAFT_KEY = `leseraupe.draft.${kind.id}`;
const RANDOM_KEY = `leseraupe.randomTheme.${kind.id}`;
const OLD = { [DRAFT_KEY]: 'leseraupe.draft.v1', [RANDOM_KEY]: 'leseraupe.randomTheme.v1' };

/** liest den Schlüssel des Kindes; ein alter v1-Wert wird einmalig übernommen */
function readKey(key: string): string | null {
  const v = localStorage.getItem(key);
  if (v !== null || kind.id !== FIRST_KIND_ID) return v;
  const old = localStorage.getItem(OLD[key]);
  if (old !== null) {
    localStorage.setItem(key, old);
    localStorage.removeItem(OLD[key]);
  }
  return old;
}

/** Mehrere Blätter auf einmal (A6): die Vorschau zeigt jeweils eines (idx). */
export interface Serie {
  items: Draft[];
  idx: number;
}

let settings: Settings = kind.settings;
let serie: Serie | null = null;

try {
  const raw = readKey(DRAFT_KEY);
  const parsed = raw ? JSON.parse(raw) : null;
  // ältere Version: ein einzelner Entwurf
  serie = parsed ? (Array.isArray(parsed.items) ? parsed : { items: [parsed], idx: 0 }) : null;
  if (serie && !serie.items[serie.idx]) serie = null;
} catch {
  serie = null;
}

function persist(): void {
  try {
    if (serie) localStorage.setItem(DRAFT_KEY, JSON.stringify(serie));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Speicher voll oder gesperrt – Entwurf bleibt nur im Speicher */
  }
}

export function getSettings(): Settings {
  return settings;
}

export function setSettings(s: Settings): void {
  settings = s;
  saveSettings(s);
}

/** Das gerade gezeigte Blatt der Serie */
export function getDraft(): Draft | null {
  return serie ? serie.items[serie.idx] : null;
}

/** Ersetzt das gerade gezeigte Blatt (null: ganze Serie verwerfen) */
export function setDraft(d: Draft | null): void {
  if (!d) serie = null;
  else if (serie) serie.items[serie.idx] = d;
  else serie = { items: [d], idx: 0 };
  persist();
}

export function getSerie(): Serie | null {
  return serie;
}

export function setSerie(items: Draft[], idx = 0): void {
  serie = items.length ? { items, idx: Math.min(idx, items.length - 1) } : null;
  persist();
}

export function setSerieIndex(idx: number): void {
  if (!serie || !serie.items[idx]) return;
  serie.idx = idx;
  persist();
}

/** Blatt i der Serie ersetzen (z. B. nach dem Speichern) */
export function setSerieItem(i: number, d: Draft): void {
  if (!serie || !serie.items[i]) return;
  serie.items[i] = d;
  persist();
}

const today = () => new Date().toISOString().slice(0, 10);

/** Thema für ein neues Blatt: fest gewählt oder „jeden Tag ein anderes“. */
export function themeForToday(): ThemeId {
  if (!settings.randomTheme) return settings.theme;
  try {
    const raw = readKey(RANDOM_KEY);
    const last = raw ? (JSON.parse(raw) as { date: string; theme: ThemeId }) : null;
    if (last && last.date === today() && THEME_IDS.includes(last.theme)) return last.theme;
    const choices = THEME_IDS.filter((t) => t !== last?.theme);
    const theme = choices[Math.floor(Math.random() * choices.length)];
    localStorage.setItem(RANDOM_KEY, JSON.stringify({ date: today(), theme }));
    return theme;
  } catch {
    return settings.theme;
  }
}
