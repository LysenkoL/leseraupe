import { DEFAULT_BLOCKS, type BlockId, type Minutes } from './types';
import { sortUnits, UNIT_IDS } from './letters';
import type { ThemeId } from '../sheet/themes';
import { THEME_IDS } from '../sheet/themes';

/** Einstellungen – nur lokal im localStorage. */
export interface Settings {
  letters: string[];
  newLetter: string | null;
  minutes: Minutes;
  theme: ThemeId;
  randomTheme: boolean;
  blocks: Record<BlockId, boolean>;
  childName: string;
  aehnlichPair: [string, string];
}

const KEY = 'leseraupe.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  letters: sortUnits(['t', 'o', 'm', 'l', 'a', 'i', 's']),
  newLetter: 's',
  minutes: 5,
  theme: 'wiese',
  randomTheme: false,
  blocks: { ...DEFAULT_BLOCKS },
  childName: 'Mia',
  aehnlichPair: ['l', 'I'],
};

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function sanitize(raw: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) } as Settings;
  s.letters = sortUnits((Array.isArray(s.letters) ? s.letters : []).filter((id) => UNIT_IDS.includes(id)));
  if (s.newLetter && !s.letters.includes(s.newLetter)) s.newLetter = null;
  if (s.minutes !== 5 && s.minutes !== 10) s.minutes = 5;
  if (!THEME_IDS.includes(s.theme)) s.theme = 'wiese';
  s.blocks = { ...DEFAULT_BLOCKS, ...(raw?.blocks ?? {}) };
  if (typeof s.childName !== 'string') s.childName = '';
  if (!Array.isArray(s.aehnlichPair) || s.aehnlichPair.length !== 2) s.aehnlichPair = ['l', 'I'];
  return s;
}

export function loadSettings(): Settings {
  const st = storage();
  if (!st) return { ...DEFAULT_SETTINGS };
  try {
    const raw = st.getItem(KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  storage()?.setItem(KEY, JSON.stringify(s));
}

/**
 * Tippen auf eine Buchstabentaste:
 * noch nicht → gelernt + neu; neu → gelernt (nicht mehr neu); gelernt → nicht gelernt.
 * Liefert die neuen Einstellungen und ob ein Buchstabe hinzugefügt wurde.
 */
export function toggleLetter(s: Settings, id: string): { settings: Settings; added: boolean; removed: boolean } {
  const has = s.letters.includes(id);
  if (!has) {
    return { settings: { ...s, letters: sortUnits([...s.letters, id]), newLetter: id }, added: true, removed: false };
  }
  if (s.newLetter === id) {
    return { settings: { ...s, newLetter: null }, added: false, removed: false };
  }
  return { settings: { ...s, letters: s.letters.filter((l) => l !== id) }, added: false, removed: true };
}
