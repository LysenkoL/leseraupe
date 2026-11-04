import { SINGLE_CONSONANTS, VOWEL_UNITS } from './letters';
import { shuffle, type Rng } from './random';

const SILBEN_CV_EXCLUDE = new Set(['c', 'x', 'y', 'q']);
const SILBEN_VC = new Set(['m', 'l', 's', 't', 'n', 'r', 'f']);
const PLAIN_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const CONSONANT_ONSETS = new Set(['ch','sch','sp','st','pf','qu']);

/**
 * Silben aus 2 Buchstaben(-einheiten): Konsonant + Vokal und Vokal + Konsonant.
 * Mit neuer Buchstabe wird die Silbenübung um sie herum gebaut:
 * Reihen „ma me mi mo“ (neuer Vokal) bzw. „na ne ni no“ (neuer Konsonant)
 * und Spiegelpaare „el le“, „em me“ – in fester Reihenfolge, nicht gemischt.
 */
export function makeSilben(letters: string[], newLetter: string | null, n: number, rng: Rng): string[] {
  // Alle gelernten Silbenbausteine bleiben verfügbar; neu steuert nur die Auswahlreihenfolge.
  const vowels = letters.filter((l) => VOWEL_UNITS.has(l));
  const cons = letters.filter((l) => (SINGLE_CONSONANTS.has(l) && !SILBEN_CV_EXCLUDE.has(l)) || CONSONANT_ONSETS.has(l));
  const cv = (c: string, v: string) => c + v;
  const vc = (v: string, c: string) => (SILBEN_VC.has(c) && PLAIN_VOWELS.has(v) ? v + c : null);
  const all = new Set<string>();
  for (const c of cons) for (const v of vowels) all.add(cv(c, v));
  for (const v of vowels) for (const c of cons) {
    const x = vc(v, c);
    if (x) all.add(x);
  }
  if (!newLetter || (!vowels.includes(newLetter) && !cons.includes(newLetter))) {
    return shuffle([...all], rng).slice(0, n);
  }
  const out: string[] = [];
  const push = (x: string | null) => {
    if (x && all.has(x) && !out.includes(x) && out.length < n) out.push(x);
  };
  const isVowel = vowels.includes(newLetter);
  const others = shuffle(isVowel ? cons : vowels.filter((v) => v !== newLetter), rng);
  // 1) Reihen: jede Reihe enthält die neue Buchstabe
  const rowVowels = vowels.filter((v) => PLAIN_VOWELS.has(v) || v === newLetter);
  if (isVowel) {
    for (const c of others.slice(0, Math.max(2, Math.floor(n / (rowVowels.length * 2))))) for (const v of rowVowels) push(cv(c, v));
  } else {
    for (const v of rowVowels) push(cv(newLetter, v));
  }
  // 2) Spiegelpaare mit der neuen Buchstabe: „el le“, „em me“ bzw. „an na“
  for (const o of others) {
    if (isVowel) {
      push(vc(newLetter, o));
      push(cv(o, newLetter));
    } else {
      push(vc(o, newLetter));
      push(cv(newLetter, o));
    }
  }
  // 3) Rest mit alten Buchstaben
  for (const x of shuffle([...all], rng)) push(x);
  return out;
}

