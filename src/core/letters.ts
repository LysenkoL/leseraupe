/**
 * Buchstaben-Einheiten nach der erweiterten Schreibtabelle der Fibel.
 * Buchstabenverbindungen (Ch, Sch, Au, …) sind eigene Einheiten: ein Wort mit „Eis“
 * braucht die Einheit „ei“, auch wenn e und i schon gelernt sind.
 */

export interface LetterUnit {
  /** interne ID, klein geschrieben (z. B. "sch", "ie", "ß") */
  id: string;
  /** Beschriftung der Taste (wie in der Schreibtabelle) */
  label: string;
  /** Text im Buchstabenkreis auf dem Blatt */
  circle: string;
  /** Spalte der Schreibtabelle (für die Gruppierung im Raster) */
  group: number;
}

const RAW: [string, string, number][] = [
  ['M', 'Mm', 0], ['L', 'Ll', 0], ['Ch', 'Ch ch', 0], ['B', 'Bb', 0], ['S', 'Ss', 0], ['D', 'Dd', 0], ['W', 'Ww', 0], ['Sch', 'Sch sch', 0], ['G', 'Gg', 0],
  ['A', 'Aa', 1], ['E', 'Ee', 1], ['I', 'Ii', 1], ['O', 'Oo', 1], ['U', 'Uu', 1],
  ['Au', 'Au au', 2], ['Ei', 'Ei ei', 2], ['Eu', 'Eu eu', 2], ['Ö', 'Öö', 2], ['Ü', 'Üü', 2],
  ['-ie', 'ie', 3], ['Ä', 'Ää', 3], ['-äu', 'äu', 3],
  ['N', 'Nn', 4], ['H', 'Hh', 4], ['R', 'Rr', 4], ['P', 'Pp', 4], ['Z', 'Zz', 4], ['T', 'Tt', 4], ['F', 'Ff', 4], ['J', 'Jj', 4], ['K', 'Kk', 4],
  ['Sp', 'Sp sp', 5], ['St', 'St st', 5], ['Pf', 'Pf pf', 5], ['Qu', 'Qu qu', 5], ['X', 'Xx', 5], ['V', 'Vv', 5], ['Y', 'Yy', 5], ['C', 'Cc', 5],
  ['-ß', 'ß', 6], ['-ng', 'ng', 6], ['-ck', 'ck', 6], ['-tz', 'tz', 6],
];

export const UNITS: LetterUnit[] = RAW.map(([label, circle, group]) => ({
  id: label.replace('-', '').toLowerCase(),
  label,
  circle,
  group,
}));

export const UNIT_IDS = UNITS.map((u) => u.id);
const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

export function unitById(id: string): LetterUnit | undefined {
  return UNIT_BY_ID.get(id);
}

/** Sortiert IDs in Fibel-Reihenfolge. */
export function sortUnits(ids: Iterable<string>): string[] {
  const set = new Set(ids);
  return UNIT_IDS.filter((id) => set.has(id));
}

export const VOWEL_UNITS = new Set(['a', 'e', 'i', 'o', 'u', 'au', 'ei', 'eu', 'ö', 'ü', 'ie', 'ä', 'äu']);
export const SINGLE_CONSONANTS = new Set(['m', 'l', 'b', 's', 'd', 'w', 'g', 'n', 'h', 'r', 'p', 'z', 't', 'f', 'j', 'k', 'x', 'v', 'y', 'c']);

const TRIGRAPHS = ['sch'];
const DIGRAPHS = ['ch', 'au', 'ei', 'eu', 'ie', 'äu', 'pf', 'qu', 'ng', 'ck', 'tz'];
/** Sp/St gelten nur am Wortanfang als eigene Einheit („Sport“, „Stern“); „ist“, „Mast“ = s + t. */
const INITIAL_DIGRAPHS = ['sp', 'st'];
const SINGLES = new Set([...SINGLE_CONSONANTS, 'a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü', 'ß']);

export interface Tokenized {
  units: string[];
  /** Zeichen, die keiner Einheit entsprechen (z. B. „q“ ohne u, „é“) */
  unknown: string[];
}

/** Zerlegt ein einzelnes Wort (nur Buchstaben) in Einheiten. */
export function tokenizeWord(word: string): Tokenized {
  const w = word.toLowerCase();
  const units: string[] = [];
  const unknown: string[] = [];
  let i = 0;
  while (i < w.length) {
    const tri = TRIGRAPHS.find((t) => w.startsWith(t, i));
    if (tri) {
      units.push(tri);
      i += 3;
      continue;
    }
    if (i === 0) {
      const ini = INITIAL_DIGRAPHS.find((t) => w.startsWith(t, i));
      if (ini) {
        units.push(ini);
        i += 2;
        continue;
      }
    }
    const di = DIGRAPHS.find((t) => w.startsWith(t, i));
    if (di) {
      units.push(di);
      i += 2;
      continue;
    }
    const ch = w[i];
    if (SINGLES.has(ch)) units.push(ch);
    else unknown.push(ch);
    i += 1;
  }
  return { units, unknown };
}

const WORD_RE = /[\p{L}]+/gu;

/** Alle Wörter eines Textes (Satzzeichen, Ziffern und Leerzeichen werden ignoriert). */
export function wordsOf(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export interface CheckResult {
  ok: boolean;
  /** fehlende Einheiten bzw. unbekannte Zeichen, in Anzeigeform */
  missing: string[];
}

/** Prüft einen Text (Wort oder Satz) gegen die gelernten Einheiten. */
export function checkText(text: string, known: ReadonlySet<string>): CheckResult {
  const missing = new Set<string>();
  for (const word of wordsOf(text)) {
    const { units, unknown } = tokenizeWord(word);
    for (const u of units) if (!known.has(u)) missing.add(u);
    for (const c of unknown) missing.add(c);
  }
  const list = [...missing].map((id) => unitById(id)?.label.replace('-', '') ?? id);
  return { ok: missing.size === 0, missing: list };
}

export function isAllowed(text: string, known: ReadonlySet<string>): boolean {
  return checkText(text, known).ok;
}

/** Wie oft kommt eine Einheit in einem Text vor? */
export function countUnit(text: string, unit: string): number {
  let n = 0;
  for (const word of wordsOf(text)) for (const u of tokenizeWord(word).units) if (u === unit) n++;
  return n;
}
