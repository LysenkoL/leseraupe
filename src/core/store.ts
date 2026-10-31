import { DEFAULT_BLOCKS, type BlockId } from './types';
import { sortUnits, UNIT_IDS } from './letters';
import { sanitizeStolper, type Stolper } from './stolper';
import { THEME_WAHL, type ThemeWahl } from '../sheet/themes';

/** Einstellungen – nur lokal im localStorage. */
export interface Settings {
  letters: string[];
  newLetter: string | null;
  /** Lesezeit des Timers in Minuten (A6: frei wählbar, unabhängig vom Blatt) */
  minutes: number;
  /** wie viele Blätter auf einmal erstellt werden (A6) */
  blaetter: number;
  /** Stolperwörter des Kindes (B2) */
  stolper: Stolper[];
  /** so viele Stolperwörter sind schon besiegt */
  stolperBesiegt: number;
  /** Silben abwechselnd farbig (B3), Standard aus */
  silbenFarbig: boolean;
  theme: ThemeWahl;
  randomTheme: boolean;
  blocks: Record<BlockId, boolean>;
  childName: string;
  /** C2: Frage „nur noch Wörter, Sätze und Geschichten?“ schon gestellt (nur einmal) */
  alleGefragt: boolean;
}

const KEY = 'leseraupe.settings.v1';

export const MAX_BLAETTER = 5;

export const DEFAULT_SETTINGS: Settings = {
  letters: sortUnits(['t', 'o', 'm', 'l', 'a', 'i', 's']),
  newLetter: 's',
  minutes: 5,
  blaetter: 1,
  stolper: [],
  stolperBesiegt: 0,
  silbenFarbig: false,
  theme: 'wiese',
  randomTheme: false,
  blocks: { ...DEFAULT_BLOCKS },
  childName: '',
  alleGefragt: false,
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
  if (!Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 60) s.minutes = 5;
  if (!Number.isInteger(s.blaetter) || s.blaetter < 1 || s.blaetter > MAX_BLAETTER) s.blaetter = 1;
  s.stolper = sanitizeStolper(s.stolper);
  if (!Number.isInteger(s.stolperBesiegt) || s.stolperBesiegt < 0) s.stolperBesiegt = 0;
  s.silbenFarbig = s.silbenFarbig === true;
  // „Winter“ ist jetzt Teil von „Jahreszeit“ (wechselt von selbst)
  if ((s.theme as string) === 'winter') s.theme = 'jahreszeit';
  if (!THEME_WAHL.includes(s.theme)) s.theme = 'wiese';
  s.blocks = { ...DEFAULT_BLOCKS, ...(raw?.blocks ?? {}) };
  if (typeof s.childName !== 'string') s.childName = '';
  s.alleGefragt = s.alleGefragt === true;
  delete (s as Partial<{ aehnlichPair: unknown }>).aehnlichPair;
  s.blocks.aehnlich = false;
  return s;
}

/* ---------- Kinder (Profile) ---------- */

/** Profil eines Kindes: Name, gelernte Buchstaben und alle Einstellungen stecken in `settings`. */
export interface Kind {
  id: string;
  settings: Settings;
}

export type Sprache = 'de' | 'uk';

export interface Profile {
  activeKindId: string;
  kinder: Kind[];
  /** Einführung (A2) gesehen oder übersprungen */
  onboarded: boolean;
  /** Sprache der Oberfläche (B6); null = wie das Telefon */
  sprache: Sprache | null;
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
  const sprache = raw?.sprache === 'de' || raw?.sprache === 'uk' ? raw.sprache : null;
  return { activeKindId, kinder, onboarded: raw?.onboarded !== false, sprache };
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
/** C2: alle Buchstaben auswählen; neu ist der letzte hinzugekommene in Fibel-Reihenfolge. */
export function alleWaehlen(s: Settings): Settings {
  const dazu = UNIT_IDS.filter((id) => !s.letters.includes(id));
  if (!dazu.length) return s;
  return { ...s, letters: [...UNIT_IDS], newLetter: dazu[dazu.length - 1] };
}

/** Alle Buchstaben gelernt und die Frage noch nicht gestellt? */
export function alleFrageFaellig(s: Settings): boolean {
  return !s.alleGefragt && s.letters.length >= UNIT_IDS.length;
}

/** C2 „Ja“: nur noch Wörter, Sätze und Geschichte – Silben, kleine und ähnliche Wörter aus. */
export function nurLesetexte(s: Settings): Settings {
  return { ...s, blocks: { ...s.blocks, silben: false, kleine: false, aehnlich: false } };
}

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
