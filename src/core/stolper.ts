import { wordsOf } from './letters';
import { shuffle, type Rng } from './random';
import type { SheetData } from './types';

/**
 * Stolperwörter (B2): Wörter, bei denen das Kind gestockt hat.
 * Sie kommen auf den nächsten Blättern öfter vor – bis sie dreimal
 * hintereinander ohne Stocken gelesen wurden.
 */
export interface Stolper {
  /** Wort, wie es auf dem Blatt stand */
  w: string;
  /** so oft hintereinander ohne Stocken gelesen */
  ok: number;
}

/** So oft ohne Stocken, dann ist das Wort „besiegt“ */
export const STOLPER_FREI = 3;
/** höchstens so viele Stolperwörter auf einem Blatt */
export const STOLPER_PRO_BLATT = 3;
/** Chance, dass ein Stolperwort auf das nächste Blatt kommt (nicht auf jedes) */
export const STOLPER_CHANCE = 0.6;

const key = (w: string) => w.toLowerCase();

/** Lesewörter eines Blatts zum Antippen (ohne Silben), jedes nur einmal, in Lesereihenfolge */
export function sheetReadingWords(d: SheetData): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (w: string) => {
    if (!seen.has(key(w))) {
      seen.add(key(w));
      out.push(w);
    }
  };
  if (d.blocks.woerter) d.woerter.forEach(add);
  if (d.blocks.kleine) d.kleine.forEach(add);
  if (d.blocks.saetze) d.saetze.flatMap(wordsOf).forEach(add);
  if (d.blocks.geschichte && d.geschichte) [d.geschichte.titel, ...d.geschichte.saetze].flatMap(wordsOf).forEach(add);
  return out;
}

/**
 * Nach dem Lesen: angetippte Wörter kommen auf die Liste (oder fangen wieder bei 0 an);
 * Stolperwörter, die auf dem Blatt standen und nicht angetippt wurden, zählen +1.
 * Nach STOLPER_FREI-mal hintereinander sind sie besiegt und verschwinden.
 */
export function updateStolper(list: Stolper[], onSheet: string[], tapped: string[]): { list: Stolper[]; besiegt: string[] } {
  const tap = new Set(tapped.map(key));
  const shown = new Set(onSheet.map(key));
  const besiegt: string[] = [];
  const next: Stolper[] = [];
  for (const s of list) {
    if (tap.has(key(s.w))) next.push({ ...s, ok: 0 });
    else if (shown.has(key(s.w))) {
      if (s.ok + 1 >= STOLPER_FREI) besiegt.push(s.w);
      else next.push({ ...s, ok: s.ok + 1 });
    } else next.push(s);
  }
  for (const w of tapped) if (!next.some((s) => key(s.w) === key(w))) next.push({ w, ok: 0 });
  return { list: next, besiegt };
}

/** Welche Stolperwörter kommen auf das nächste Blatt? Zufällig, nicht alle, höchstens STOLPER_PRO_BLATT. */
export function pickStolper(list: Stolper[], allowed: (w: string) => boolean, rng: Rng): string[] {
  return shuffle(
    list.filter((s) => allowed(s.w)),
    rng,
  )
    .filter(() => rng() < STOLPER_CHANCE)
    .slice(0, STOLPER_PRO_BLATT)
    .map((s) => s.w);
}

export function sanitizeStolper(raw: unknown): Stolper[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .filter((s): s is Stolper => !!s && typeof s.w === 'string' && s.w.trim() !== '')
    .map((s) => ({ w: s.w.trim(), ok: Number.isInteger(s.ok) && s.ok >= 0 ? s.ok : 0 }))
    .filter((s) => !seen.has(key(s.w)) && !!seen.add(key(s.w)));
}
