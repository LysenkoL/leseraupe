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
  childName: '',
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

/* ---------- Kinder (Profile) ---------- */

/** Profil eines Kindes: Name, gelernte Buchstaben und alle Einstellungen stecken in `settings`. */
export interface Kind {
  id: string;
  settings: Settings;
}

export interface Profile {
  activeKindId: string;
  kinder: Kind[];
  /** Einführung (A2) gesehen oder übersprungen */
  onboarded: boolean;
}

/** Das erste (und vorerst einzige) Kind; auch alte Daten ohne Profil gehören zu ihm. */
export const FIRST_KIND_ID = 'k1';
const PROFILE_KEY = 'leseraupe.kinder.v2';

export function sanitizeProfile(raw: Partial<Profile> | null | undefined): Profile {
  const kinder = (Array.isArray(raw?.kinder) ? raw.kinder : [])
    .filter((k): k is Kind => !!k && typeof k.id === 'string' && k.id !== '')
    .map((k) => ({ id: k.id, settings: sanitize(k.settings) }));
  if (!kinder.length) kinder.push({ id: FIRST_KIND_ID, settings: { ...DEFAULT_SETTINGS } });
  const activeKindId = kinder.some((k) => k.id === raw?.activeKindId) ? raw!.activeKindId! : kinder[0].id;
  // fehlt das Feld (z. B. alte Sicherung), war die App schon in Gebrauch
  return { activeKindId, kinder, onboarded: raw?.onboarded !== false };
}

/**
 * Profile laden. Gibt es noch keine (alte Version), werden die Einstellungen v1
 * zum ersten Kind. Der alte Schlüssel bleibt zur Sicherheit stehen.
 */
export function loadProfile(): Profile {
  const st = storage();
  if (!st) return sanitizeProfile(null);
  try {
    const raw = st.getItem(PROFILE_KEY);
    if (raw) return sanitizeProfile(JSON.parse(raw));
  } catch {
    /* kaputt – unten aus v1 neu aufbauen */
  }
  let old: Partial<Settings> | null = null;
  try {
    const raw = st.getItem(KEY);
    old = raw ? JSON.parse(raw) : null;
  } catch {
    old = null;
  }
  // Einführung nur bei echter Neuinstallation, nicht nach dem Update von v1
  const p = sanitizeProfile({ activeKindId: FIRST_KIND_ID, kinder: [{ id: FIRST_KIND_ID, settings: sanitize(old) }], onboarded: old !== null });
  saveProfile(p);
  return p;
}

export function saveProfile(p: Profile): void {
  try {
    storage()?.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* Speicher voll oder gesperrt */
  }
}

export function setOnboarded(done = true): void {
  saveProfile({ ...loadProfile(), onboarded: done });
}

export function activeKind(p: Profile): Kind {
  return p.kinder.find((k) => k.id === p.activeKindId) ?? p.kinder[0];
}

/** Einstellungen des aktiven Kindes */
export function loadSettings(): Settings {
  return activeKind(loadProfile()).settings;
}

/** Einstellungen des aktiven Kindes speichern */
export function saveSettings(s: Settings): void {
  const p = loadProfile();
  const k = activeKind(p);
  saveProfile({ ...p, kinder: p.kinder.map((x) => (x.id === k.id ? { ...x, settings: s } : x)) });
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
