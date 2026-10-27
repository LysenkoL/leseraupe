import { loadSettings, saveSettings, type Settings } from '../core/store';
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

const DRAFT_KEY = 'leseraupe.draft.v1';
const RANDOM_KEY = 'leseraupe.randomTheme.v1';

let settings: Settings = loadSettings();
let draft: Draft | null = null;

try {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (raw) draft = JSON.parse(raw);
} catch {
  draft = null;
}

export function getSettings(): Settings {
  return settings;
}

export function setSettings(s: Settings): void {
  settings = s;
  saveSettings(s);
}

export function getDraft(): Draft | null {
  return draft;
}

export function setDraft(d: Draft | null): void {
  draft = d;
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Speicher voll oder gesperrt – Entwurf bleibt nur im Speicher */
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** Thema für ein neues Blatt: fest gewählt oder „jeden Tag ein anderes“. */
export function themeForToday(): ThemeId {
  if (!settings.randomTheme) return settings.theme;
  try {
    const raw = localStorage.getItem(RANDOM_KEY);
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
