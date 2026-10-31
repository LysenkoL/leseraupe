import type { BlockId, Minutes, Quest, QuestKind, SheetData, Geschichte } from './types';
import type { ThemeId } from '../sheet/themes';
import { Vocab } from './vocab';
import { DICT } from './dict';
import { SINGLE_CONSONANTS, VOWEL_UNITS, sortUnits, unitById, wordsOf, countUnit, tokenizeWord } from './letters';
import { pools, templateSentences, templateStory } from './saetze';
import { mulberry32, pick, shuffle, type Rng } from './random';
import { pickStolper, STOLPER_PRO_BLATT, type Stolper } from './stolper';

export const COUNTS: Record<Minutes, { silben: number; woerter: number; kleine: number; saetze: number; geschichte: number; fragen: [number, number]; aehnlich: number }> = {
  5: { silben: 18, woerter: 20, kleine: 8, saetze: 7, geschichte: 7, fragen: [3, 4], aehnlich: 4 },
  10: { silben: 24, woerter: 30, kleine: 8, saetze: 10, geschichte: 12, fragen: [4, 5], aehnlich: 5 },
};

/** Was die letzten Blätter enthalten haben – gegen Wiederholungen. */
export interface History {
  /** Wort → laufende Nummer des Blatts, auf dem es zuletzt stand */
  wordSeq: Map<string, number>;
  /** Laufende Nummer des neuen Blatts */
  seq: number;
  /** Sätze und Geschichtentitel der letzten zwei Blätter */
  recentSentences: Set<string>;
  recentStories: Set<string>;
  /** C3: Geschichtentitel → laufende Nummer des Blatts, auf dem sie zuletzt stand (am längsten unbenutzte zuerst) */
  storySeq?: Map<string, number>;
  lastQuest: QuestKind | null;
}

export const emptyHistory = (): History => ({ wordSeq: new Map(), seq: 1, recentSentences: new Set(), recentStories: new Set(), storySeq: new Map(), lastQuest: null });

export interface GenParams {
  letters: string[];
  newLetter: string | null;
  minutes: Minutes;
  theme: ThemeId;
  childName: string;
  blocks: Record<BlockId, boolean>;
  history: History;
  seed: number;
  /** Schwierigkeit 1–5 (B1), bei fast vollem Alphabet bis 10 (C3); fehlt = ohne Stufen */
  stufe?: number;
  /** Stolperwörter des Kindes (B2): kommen öfter vor */
  stolper?: Stolper[];
  /** Silben farbig (B3) */
  silbenFarbig?: boolean;
}

/**
 * Einige Stolperwörter (B2) ins Blatt holen: kleine Wörter zu den kleinen, sonst zu den Wörtern.
 * Sie ersetzen hinten Wörter, damit der Umfang gleich bleibt; die Wiederholungssperre gilt für sie nicht.
 */
function addStolper(woerter: string[], kleine: string[], v: Vocab, p: GenParams, rng: Rng): { woerter: string[]; kleine: string[] } {
  if (!p.stolper?.length) return { woerter, kleine };
  const w = [...woerter];
  const k = [...kleine];
  const lower = new Set(v.kleine.map((x) => x.toLowerCase()));
  const has = (list: string[], x: string) => list.some((y) => y.toLowerCase() === x.toLowerCase());
  // schon zufällig auf dem Blatt stehende Stolperwörter zählen mit
  let frei = STOLPER_PRO_BLATT - p.stolper.filter((x) => has(w, x.w) || has(k, x.w)).length;
  for (const s of pickStolper(p.stolper, (x) => v.has(x), rng)) {
    if (frei <= 0) break;
    if (has(w, s) || has(k, s)) continue;
    frei--;
    const list = lower.has(s.toLowerCase()) ? k : w;
    if (list.length) list[list.length - 1 - Math.floor(rng() * Math.min(3, list.length))] = s;
    else list.push(s);
  }
  const byLen = (a: string, b: string) => [...a].length - [...b].length;
  return { woerter: w.sort(byLen), kleine: k.sort(byLen) };
}

/** Höchste Stufe, solange noch Buchstaben fehlen (B1) */
export const MAX_STUFE = 5;
/** C3: Höchste Stufe, wenn (fast) alle Buchstaben gelernt sind – das Lesen wird danach weiter schwerer */
export const MAX_STUFE_ALPHABET = 10;
/** C3: ab so vielen gelernten Einheiten (von 43) gilt das Alphabet als fast komplett; seltene wie Y, C, Qu dürfen fehlen */
export const ALPHABET_FAST = 38;
/** C3: ab so vielen gelernten Einheiten gibt es lange Geschichten und die Regel für die neue Buchstabe wird lockerer */
export const VIELE_BUCHSTABEN = 25;
/** C3: ab so vielen gelernten Einheiten gibt es kurze Geschichten mit Handlung (8–11 Sätze) statt Vorlagen */
export const MITTEL_BUCHSTABEN = 12;
/** C3: über Stufe 5 braucht jede weitere Stufe so viele Blätter */
export const BLAETTER_PRO_STUFE = 5;

/** Höchste erreichbare Stufe für diese Buchstaben */
export function maxStufe(letters: string[]): number {
  return letters.length >= ALPHABET_FAST ? MAX_STUFE_ALPHABET : MAX_STUFE;
}

/** Anteil der Wörter/Sätze, die die neue Buchstabe enthalten sollen (wenn das Wörterbuch so viele hat) */
export const NEU_ANTEIL = 0.6;

/** Anteil der Sätze, die die Einheit enthalten */
export function neuAnteil(saetze: string[], unit: string): number {
  return saetze.length ? saetze.filter((x) => countUnit(x, unit) > 0).length / saetze.length : 0;
}

/**
 * Was eine Stufe bedeutet (B1). Stufe 1 = erstes Blatt nach einer neuen Buchstabe:
 * kurze Wörter, wenig Zweisilber, kurze Sätze und eine kurze Geschichte.
 * Stufen 6–10 (C3) gibt es nur bei fast vollem Alphabet: längere Wörter (wortMin), mehr Mehrsilber,
 * längere Sätze und Geschichten bis 14 Sätze.
 * geschichteMax = Länge bei wenigen Buchstaben; geschichteMittel = [min, max] ab MITTEL_BUCHSTABEN;
 * geschichteViele = [min, max] ab VIELE_BUCHSTABEN.
 */
export const STUFEN: Record<number, { wortMax: number; wortMin?: number; mehrsilbig: number; satzMin: number; satzWoerter: number; geschichteMax: number; geschichteMittel: [number, number]; geschichteViele: [number, number] }> = {
  1: { wortMax: 4, mehrsilbig: 0.2, satzMin: 0, satzWoerter: 4, geschichteMax: 6, geschichteMittel: [7, 12], geschichteViele: [8, 12] },
  2: { wortMax: 5, mehrsilbig: 0.35, satzMin: 3, satzWoerter: 5, geschichteMax: 7, geschichteMittel: [7, 12], geschichteViele: [9, 12] },
  3: { wortMax: 6, mehrsilbig: 0.5, satzMin: 4, satzWoerter: 6, geschichteMax: 7, geschichteMittel: [8, 13], geschichteViele: [10, 13] },
  4: { wortMax: 7, mehrsilbig: 0.6, satzMin: 4, satzWoerter: 7, geschichteMax: 8, geschichteMittel: [8, 13], geschichteViele: [10, 14] },
  5: { wortMax: 99, mehrsilbig: 0.7, satzMin: 5, satzWoerter: 99, geschichteMax: 8, geschichteMittel: [8, 13], geschichteViele: [11, 14] },
  6: { wortMax: 99, wortMin: 4, mehrsilbig: 0.75, satzMin: 6, satzWoerter: 99, geschichteMax: 8, geschichteMittel: [9, 13], geschichteViele: [12, 14] },
  7: { wortMax: 99, wortMin: 5, mehrsilbig: 0.8, satzMin: 6, satzWoerter: 99, geschichteMax: 8, geschichteMittel: [9, 13], geschichteViele: [12, 14] },
  8: { wortMax: 99, wortMin: 5, mehrsilbig: 0.85, satzMin: 7, satzWoerter: 99, geschichteMax: 8, geschichteMittel: [9, 13], geschichteViele: [13, 14] },
  9: { wortMax: 99, wortMin: 6, mehrsilbig: 0.9, satzMin: 7, satzWoerter: 99, geschichteMax: 8, geschichteMittel: [9, 13], geschichteViele: [13, 14] },
  10: { wortMax: 99, wortMin: 6, mehrsilbig: 0.9, satzMin: 8, satzWoerter: 99, geschichteMax: 8, geschichteMittel: [9, 13], geschichteViele: [13, 14] },
};

/** C3: erlaubte Länge der Geschichte (Sätze) für Stufe und Zahl der gelernten Einheiten */
export function geschichteLaenge(stufe: number | undefined, anzahlBuchstaben: number, minutes: Minutes = 5): [number, number] {
  const st = stufe ? STUFEN[stufe] : null;
  if (anzahlBuchstaben >= VIELE_BUCHSTABEN) {
    const [lo, hi] = st ? st.geschichteViele : [10, 13];
    // fast volles Alphabet: auch gleich nach einer neuen Buchstabe eine richtige Geschichte (10+ Sätze)
    return [anzahlBuchstaben >= ALPHABET_FAST ? Math.max(lo, 10) : lo, hi];
  }
  if (minutes === 10) return [10, 13];
  if (anzahlBuchstaben >= MITTEL_BUCHSTABEN) return st ? st.geschichteMittel : [8, 10];
  return [6, st ? st.geschichteMax : 8];
}

/** Wie ging das Lesen? (Eltern tippen es nach dem Lesen an, freiwillig) */
export type Gefuehl = 'leicht' | 'geht' | 'schwer';

/**
 * Stufe für das nächste Blatt. Neue Buchstabe → wieder 1. Jedes Blatt mit denselben Buchstaben
 * (in Reihenfolge) verschiebt die Stufe: leicht +1, geht so ±0, schwer −1, ohne Angabe +1
 * (wie früher – wer nichts antippt, bekommt langsam schwerere Blätter). Immer 1 … MAX_STUFE.
 * C3: Bei fast vollem Alphabet geht es über Stufe 5 hinaus bis MAX_STUFE_ALPHABET, aber langsamer:
 * jede weitere Stufe braucht BLAETTER_PRO_STUFE Blätter („leicht“ oder ohne Angabe); „schwer“ = eine Stufe zurück.
 */
export function stufeFor(saved: { letters: string[]; gefuehl?: Gefuehl }[], letters: string[]): number {
  const key = sortUnits(letters).join(',');
  const max = maxStufe(letters);
  let stufe = 1;
  let blaetter = 0;
  for (const d of saved) {
    if (sortUnits(d.letters).join(',') !== key) continue;
    if (d.gefuehl === 'geht') continue;
    if (d.gefuehl === 'schwer') {
      stufe = Math.max(1, stufe - 1);
      blaetter = 0;
    } else if (stufe < MAX_STUFE) {
      stufe++;
    } else if (stufe < max && ++blaetter >= BLAETTER_PRO_STUFE) {
      stufe++;
      blaetter = 0;
    }
  }
  return stufe;
}

/** Silben eines Wortes ≈ Anzahl der Vokal-Einheiten */
export function silbenZahl(w: string): number {
  return tokenizeWord(w.toLowerCase()).units.filter((u) => VOWEL_UNITS.has(u)).length;
}

/** Wörter, die der Wortliste fehlen (für „Entfernt: …“) */
export interface Removed {
  text: string;
  missing: string[];
}

const SILBEN_CV_EXCLUDE = new Set(['c', 'x', 'y', 'q']);
const SILBEN_VC = new Set(['m', 'l', 's', 't', 'n', 'r', 'f']);
const PLAIN_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Silben aus 2 Buchstaben(-einheiten): Konsonant + Vokal und Vokal + Konsonant.
 * Mit neuer Buchstabe wird die Silbenübung um sie herum gebaut:
 * Reihen „ma me mi mo“ (neuer Vokal) bzw. „na ne ni no“ (neuer Konsonant)
 * und Spiegelpaare „el le“, „em me“ – in fester Reihenfolge, nicht gemischt.
 */
export function makeSilben(letters: string[], newLetter: string | null, n: number, rng: Rng): string[] {
  // Silben aus zwei Buchstaben; Umlaute/Zwielaute nur, wenn sie der neue Buchstabe sind
  const vowels = letters.filter((l) => VOWEL_UNITS.has(l) && (PLAIN_VOWELS.has(l) || ['ä', 'ö', 'ü'].includes(l) || l === newLetter));
  const cons = letters.filter((l) => (SINGLE_CONSONANTS.has(l) && !SILBEN_CV_EXCLUDE.has(l)) || (l === newLetter && !VOWEL_UNITS.has(l)));
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

/** Wortauswahl: nie Wörter der letzten zwei Blätter; wenn zu wenig, die am längsten unbenutzten. */
function pickFresh(cands: string[], n: number, h: History, rng: Rng, prefer: (w: string) => boolean, preferShare = 0.5, allowStale = true): string[] {
  const blocked = (w: string) => (h.wordSeq.get(w) ?? -Infinity) >= h.seq - 2;
  const fresh = shuffle(cands.filter((w) => !blocked(w)), rng);
  const stale = cands.filter(blocked).sort((a, b) => (h.wordSeq.get(a) ?? 0) - (h.wordSeq.get(b) ?? 0));
  const isPref = new Map(fresh.map((w) => [w, prefer(w)]));
  const pref = fresh.filter((w) => isPref.get(w));
  const other = fresh.filter((w) => !isPref.get(w));
  const k = Math.min(pref.length, Math.round(n * preferShare));
  const out = [...pref.slice(0, k), ...other, ...pref.slice(k)].slice(0, n);
  if (!allowStale) return out;
  for (const w of stale) {
    if (out.length >= n) break;
    out.push(w);
  }
  return out;
}

function makeWoerter(v: Vocab, p: GenParams, rng: Rng, exclude: Set<string>, n = COUNTS[p.minutes].woerter): string[] {
  const small = new Set(v.kleine);
  const cands = v.words
    .filter((e) => e.typ !== 'kleines Wort' && !small.has(e.w) && !exclude.has(e.w) && e.len >= 2)
    .filter((e) => e.typ !== 'Name' || rng() < 0.45);
  const theme = new Set(v.words.filter((e) => e.themen.includes(p.theme)).map((e) => e.w));
  const newU = p.newLetter;
  const hasNew = (w: string) => (newU ? countUnit(w, newU) > 0 : false);
  const prefer = (w: string) => theme.has(w) && rng() < 0.5;
  const st = p.stufe ? STUFEN[p.stufe] : null;

  /** k Wörter aus einer Gruppe; mit Stufe: kurze Wörter und passender Anteil an Mehrsilbern.
   *  Wörter der letzten Blätter nur, wenn allowStale (erst ganz am Ende zum Auffüllen). */
  const fromGroup = (group: string[], k: number, allowStale = false): string[] => {
    if (k <= 0 || !group.length) return [];
    const pf = (list: string[], m: number) => pickFresh(list, m, p.history, rng, prefer, 0.5, allowStale);
    if (!st) return pf(group, k);
    // Stufe: Länge begrenzen und Anteil der Mehrsilber steuern; reicht es nicht, wird gelockert
    const short = group.filter((w) => [...w].length <= st.wortMax);
    // C3: hohe Stufen wollen längere Wörter (wortMin), aber nur wenn es genug davon gibt
    const lang = st.wortMin ? short.filter((w) => [...w].length >= st.wortMin!) : short;
    // zu wenige kurze Wörter? dann die kürzesten, die es gibt (nicht alle)
    const kuerzeste = [...group].sort((a, b) => [...a].length - [...b].length).slice(0, Math.ceil(k * 1.5));
    const base = lang.length >= k * 1.5 ? lang : short.length >= k * 1.5 ? short : kuerzeste;
    const multi = base.filter((w) => silbenZahl(w) >= 2);
    const one = base.filter((w) => silbenZahl(w) < 2);
    const km = Math.round(k * st.mehrsilbig);
    const out = [...pf(multi, km), ...pf(one, k - km)];
    if (out.length < k) out.push(...pf(base.filter((w) => !out.includes(w)), k - out.length));
    if (out.length < k) out.push(...pf(group.filter((w) => !out.includes(w)), k - out.length));
    return out;
  };

  // Neue Buchstabe zuerst: mindestens NEU_ANTEIL der Wörter enthalten sie (wenn es so viele gibt)
  const all = cands.map((e) => e.w);
  const neu = all.filter(hasNew);
  const alt = all.filter((w) => !hasNew(w));
  const words = fromGroup(neu, newU ? Math.ceil(n * NEU_ANTEIL) : 0);
  words.push(...fromGroup(alt.filter((w) => !words.includes(w)), n - words.length));
  if (words.length < n) words.push(...fromGroup(neu.filter((w) => !words.includes(w)), n - words.length));
  // erst jetzt, wenn nichts Frisches mehr da ist: die am längsten unbenutzten Wörter
  if (words.length < n) words.push(...fromGroup(all.filter((w) => !words.includes(w)), n - words.length, true));
  // erst kurze Wörter
  return words.sort((a, b) => [...a].length - [...b].length);
}

function makeKleine(v: Vocab, p: GenParams, rng: Rng): string[] {
  const n = COUNTS[p.minutes].kleine;
  const prefer = (w: string) => (p.newLetter ? countUnit(w, p.newLetter) > 0 : false);
  return pickFresh(v.kleine, n, p.history, rng, prefer, NEU_ANTEIL).sort((a, b) => [...a].length - [...b].length);
}

/** Satzauswahl: zuerst Sätze mit dem neuen Buchstaben, verschiedene Satzanfänge. */
function chooseSentences(cands: string[], n: number, p: GenParams, rng: Rng, avoid: Set<string>): string[] {
  const pool = shuffle(
    [...new Set(cands)].filter((s) => !avoid.has(s) && !p.history.recentSentences.has(s)),
    rng,
  );
  const old = shuffle(cands.filter((s) => p.history.recentSentences.has(s) && !avoid.has(s)), rng);
  const scored = pool.map((s) => ({ s, nu: p.newLetter ? countUnit(s, p.newLetter) : 0 }));
  const withNew = scored.filter((x) => x.nu > 0).map((x) => x.s);
  const without = scored.filter((x) => x.nu === 0).map((x) => x.s);
  const out: string[] = [];
  const starts = new Map<string, number>();
  const tryAdd = (s: string) => {
    const st = wordsOf(s)[0] ?? '';
    if ((starts.get(st) ?? 0) >= 2 || out.includes(s)) return;
    starts.set(st, (starts.get(st) ?? 0) + 1);
    out.push(s);
  };
  // so viele Sätze mit der neuen Buchstabe wie möglich, die übrigen nur zum Auffüllen
  const kNew = n;
  for (const s of withNew) {
    if (out.length >= kNew) break;
    tryAdd(s);
  }
  for (const s of [...without, ...withNew]) {
    if (out.length >= n) break;
    tryAdd(s);
  }
  for (const s of [...pool, ...old]) {
    if (out.length >= n) break;
    if (!out.includes(s)) out.push(s);
  }
  return shuffle(out, rng);
}

function makeGeschichte(v: Vocab, p: GenParams, rng: Rng): { g: Geschichte; fragen: string[] } | null {
  const st = p.stufe ? STUFEN[p.stufe] : null;
  const n = st ? Math.min(COUNTS[p.minutes].geschichte, st.geschichteMax) : COUNTS[p.minutes].geschichte;
  // C3: bei vielen Buchstaben lange Geschichten (bis 14 Sätze, je nach Stufe)
  const viele = p.letters.length >= VIELE_BUCHSTABEN;
  const mittel = p.letters.length >= MITTEL_BUCHSTABEN;
  const [lo, hi] = geschichteLaenge(p.stufe, p.letters.length, p.minutes);
  const lesbar = DICT.geschichten.filter((g) => v.has(g.titel) && g.saetze.every((s) => v.has(s)));
  // wie weit die Länge vom erlaubten Bereich weg ist (0 = passt)
  const abstand = (g: { saetze: string[] }) => Math.max(0, lo - g.saetze.length, g.saetze.length - hi);
  const curated = lesbar.filter((g) => abstand(g) === 0);
  // reichhaltige Geschichten bevorzugen (viele verschiedene gelernte Einheiten)
  const richness = (g: { saetze: string[] }) => new Set(g.saetze.flatMap((x) => wordsOf(x).flatMap((w) => tokenizeWord(w).units))).size;
  const fresh = curated.filter((g) => !p.history.recentStories.has(g.titel));
  const maxRich = Math.max(0, ...fresh.map(richness));
  // zu einfache Geschichte für viele gelernte Buchstaben? Dann lieber eine aus Vorlagen (C3: ohne Obergrenze).
  const minRich = p.letters.length * 0.5;
  // neue Buchstabe: nur Geschichten, in denen mindestens die Hälfte der Sätze sie enthält;
  // C3: bei vielen Buchstaben (die neuen sind dann oft selten, z. B. tz) reicht es, wenn sie vorkommt
  const neuOk = (g: { saetze: string[] }) =>
    !p.newLetter || (viele ? g.saetze.some((x) => countUnit(x, p.newLetter!) > 0) : neuAnteil(g.saetze, p.newLetter) >= NEU_ANTEIL - 0.1);
  // C3: unter gleich guten die am längsten nicht gelesene
  const seit = (g: { titel: string }) => p.history.storySeq?.get(g.titel) ?? -Infinity;
  const aeltesteVon = <T extends { titel: string }>(list: T[]): T | undefined => {
    const m = Math.min(...list.map(seit));
    return pick(list.filter((g) => seit(g) === m), rng);
  };
  const [fmin, fmax] = COUNTS[p.minutes].fragen;
  const fertig = (g: { titel: string; saetze: string[]; fragen: string[] }) => ({ g: { titel: g.titel, saetze: [...g.saetze] }, fragen: g.fragen.slice(0, fmax) });
  // Ersatz: die reichste lesbare Geschichte, deren Länge am besten passt (nie eine zufällige);
  // nicht gerade gelesen, mit Handlung und reich genug geht vor der Länge
  const nein = (b: boolean) => Number(b);
  const reichste = () =>
    [...lesbar].sort(
      (a, b) =>
        nein(p.history.recentStories.has(a.titel)) - nein(p.history.recentStories.has(b.titel)) ||
        nein(!a.handlung) - nein(!b.handlung) ||
        nein(richness(a) < minRich) - nein(richness(b) < minRich) ||
        abstand(a) - abstand(b) ||
        richness(b) - richness(a),
    )[0];
  if (mittel) {
    // C3: ab MITTEL_BUCHSTABEN eine fertige Geschichte; solche mit Handlung gehen vor den alten einfachen
    // („Mama ist im Saal.“). Reich genug, aber nicht nur die reichste – so wechseln sie über Wochen.
    let pool = fresh.some((g) => g.handlung) ? fresh.filter((g) => g.handlung) : fresh;
    // wenige Geschichten mit Handlung in genau dieser Länge? Dann auch etwas kürzere/längere (±2 Sätze),
    // damit bei täglichem Lesen nicht alle paar Tage dieselbe kommt
    if (pool.filter((g) => g.handlung).length < 8) {
      const naeher = lesbar.filter((g) => g.handlung && abstand(g) <= 2 && !p.history.recentStories.has(g.titel));
      if (naeher.length > pool.length) pool = naeher;
    }
    const maxPool = Math.max(0, ...pool.map(richness));
    const reich = pool.filter((g) => richness(g) >= Math.max(minRich, maxPool * (viele ? 0.75 : 0.6)));
    // die neue Buchstabe soll vorkommen; „in der Hälfte der Sätze“ ließe nur zwei, drei Geschichten übrig
    const neuDa = (g: { saetze: string[] }) => !p.newLetter || g.saetze.some((x) => countUnit(x, p.newLetter!) > 0);
    // gibt es mit ihr nur wenige, wechseln alle passenden (sonst kommt jeden dritten Tag dieselbe)
    // und auch mit ihr: war sie in der letzten Woche schon dran, kommt lieber eine länger ungelesene ohne sie
    const mitNeu = reich.filter(neuDa);
    const neu = aeltesteVon(mitNeu.length >= 4 ? mitNeu : reich);
    const alt = aeltesteVon(reich);
    const cur = neu && alt && seit(neu) >= p.history.seq - 7 && seit(alt) < seit(neu) ? alt : neu;
    if (cur) return fertig(cur);
    // nichts in der passenden Länge: lieber eine Geschichte mit Handlung in anderer Länge als eine Vorlage;
    // bei vielen Buchstaben immer eine fertige (die Vorlagen sind dafür zu einfach)
    const ersatz = reichste();
    if (ersatz && (viele || ersatz.handlung)) return fertig(ersatz);
  }
  const cur = aeltesteVon(fresh.filter((g) => richness(g) >= maxRich * 0.6 && richness(g) >= minRich && neuOk(g)));
  if (cur && rng() < 0.75) return fertig(cur);
  const pl = pools(v, new Set());
  const neuPrefer = p.newLetter ? (w: string) => countUnit(w, p.newLetter!) > 0 : undefined;
  const score = (x: { saetze: string[] }) => (p.newLetter ? neuAnteil(x.saetze, p.newLetter) : 0) * 100 + x.saetze.length;
  let best: ReturnType<typeof templateStory> = null;
  for (let i = 0; i < 10; i++) {
    const st = templateStory(v, pl, rng, n, neuPrefer);
    if (st && !p.history.recentStories.has(st.titel) && (!best || score(st) > score(best))) best = st;
  }
  if (!best && cur) return fertig(cur);
  if (!best) {
    const any = reichste();
    return any ? fertig(any) : null;
  }
  const fr = best.fragen.slice(0, fmax);
  return { g: { titel: best.titel, saetze: best.saetze }, fragen: fr.length >= fmin ? fr : best.fragen };
}

function letterLabel(id: string): string {
  const u = unitById(id);
  return u ? u.label.replace('-', '') : id.toUpperCase();
}

export function makeQuest(p: GenParams, sheet: Pick<SheetData, 'geschichte' | 'woerter' | 'saetze'>, v: Vocab, rng: Rng): Quest {
  const options: Quest[] = [];
  if (p.newLetter) {
    const gross = letterLabel(p.newLetter);
    const klein = gross.toLowerCase();
    // für Leseanfänger sind E und e zwei Zeichen – beide nennen
    const zeichen = klein !== gross ? `${gross} oder ${klein}` : gross;
    options.push({ kind: 'finde', text: `Kreise alle Wörter mit ${zeichen} ein.`, target: p.newLetter });
  }
  if (sheet.geschichte) {
    const text = sheet.geschichte.saetze.join(' ');
    const counts = new Map<string, number>();
    for (const w of wordsOf(text)) if (/^\p{Lu}/u.test(w) && w.length > 1) counts.set(w, (counts.get(w) ?? 0) + 1);
    const cands = [...counts].filter(([, c]) => c >= 2).map(([w]) => w);
    const w = pick(cands, rng);
    if (w) options.push({ kind: 'zaehle', text: `Wie oft steht ${w} in der Geschichte?`, target: w });
  }
  options.push({ kind: 'male', text: 'Male die Raupe an.' });
  const secret = makeGeheimwort(v, rng);
  if (secret) options.push(secret);
  // C3: neben einer langen Geschichte nur Quests aus einer Zeile (Malen und Geheimwort brauchen viel Platz)
  if ((sheet.geschichte?.saetze.length ?? 0) >= LANG_GESCHICHTE && options.some((o) => o.kind === 'finde' || o.kind === 'zaehle')) {
    options.splice(0, options.length, ...options.filter((o) => o.kind === 'finde' || o.kind === 'zaehle'));
  }
  const notLast = options.filter((o) => o.kind !== p.history.lastQuest);
  return pick(notLast.length ? notLast : options, rng)!;
}

/** Geheimwort: Wörter, deren erste Buchstaben ein Wort ergeben. */
function makeGeheimwort(v: Vocab, rng: Rng): Quest | null {
  const ok = (e: { typ: string; len: number; w: string }) => e.len >= 3 && e.len <= 4 && /^[A-ZÄÖÜa-zäöü]+$/.test(e.w);
  const targets = [
    ...shuffle(v.words.filter((e) => e.typ === 'Nomen' && ok(e)), rng),
    ...shuffle(v.words.filter((e) => e.typ === 'Name' && ok(e)), rng),
  ];
  const byFirst = new Map<string, string[]>();
  for (const e of v.words) {
    if (e.typ === 'kleines Wort' || e.len < 2) continue;
    const f = e.w[0].toUpperCase();
    if (!byFirst.has(f)) byFirst.set(f, []);
    byFirst.get(f)!.push(e.w);
  }
  for (const t of targets.slice(0, 40)) {
    const letters = [...t.w.toUpperCase()];
    const used = new Set<string>([t.w]);
    const words: string[] = [];
    for (const l of letters) {
      const c = shuffle((byFirst.get(l) ?? []).filter((w) => !used.has(w)), rng)[0];
      if (!c) break;
      used.add(c);
      words.push(c);
    }
    if (words.length === letters.length) {
      return { kind: 'geheimwort', text: 'Schreibe die ersten Buchstaben in die Kästchen:', target: t.w.toUpperCase(), words };
    }
  }
  return null;
}

/** C3: ab so vielen Sätzen gilt eine Geschichte als lang; dann gibt es weniger Wörter und Sätze */
export const LANG_GESCHICHTE = 12;
export const LANG_WOERTER = 16;
export const LANG_SAETZE = 7;
export const LANG_SILBEN = 12;

export interface Generated {
  sheet: SheetData;
  removed: Removed[];
}

export function generateSheet(p: GenParams): Generated {
  const rng = mulberry32(p.seed);
  const known = new Set(p.letters);
  const v = new Vocab(known);
  const c = COUNTS[p.minutes];

  const alleSilben = makeSilben(sortUnits(p.letters), p.newLetter, c.silben, rng);
  const story = p.blocks.geschichte || p.blocks.fragen ? makeGeschichte(v, p, rng) : null;
  // C3: lange Geschichte → etwas weniger Silben, Wörter und Sätze, damit sie ganz auf die Seite passt
  // (nur beim heutigen Blattumfang; der alte 10-Minuten-Umfang war für lange Geschichten gebaut)
  const lang = !!story && p.blocks.geschichte && p.minutes === 5 && story.g.saetze.length >= LANG_GESCHICHTE;
  const silben = lang ? alleSilben.slice(0, LANG_SILBEN) : alleSilben;
  const { woerter, kleine } = (() => {
    const k = makeKleine(v, p, rng);
    return addStolper(makeWoerter(v, p, rng, new Set(k), lang ? LANG_WOERTER : c.woerter), k, v, p, rng);
  })();

  const avoid = new Set(story?.g.saetze ?? []);
  const fertige = DICT.saetze.filter((s) => v.has(s));
  const viele = p.letters.length >= VIELE_BUCHSTABEN;
  // C3: bei vielen Buchstaben nur fertige Sätze – die Vorlagen ergeben zu einfache Sätze („Das ist Moritz.“)
  const vorlagen = templateSentences(v, pools(v), rng);
  const cands = viele && fertige.length >= c.saetze * 4 ? fertige : [...fertige, ...vorlagen];
  const len = (x: string) => wordsOf(x).length;
  // Stufe: Satzlänge (in Wörtern) im Bereich der Stufe; zu wenige? dann gelockert
  let satzCands = cands;
  // C3: viele Buchstaben → längere Sätze (ab 5–8 Wörtern, je nach Stufe), keine Obergrenze;
  // gibt es davon zu wenige (z. B. ohne T), gelten die Grenzen der Stufe wie bisher
  const minViele = Math.max(p.stufe ? STUFEN[p.stufe].satzMin : 6, (p.stufe ?? 3) <= 2 ? 5 : 6);
  const lange = viele ? cands.filter((x) => len(x) >= minViele) : [];
  if (lange.length >= c.saetze * 2) {
    satzCands = lange;
  } else if (p.stufe) {
    const st = STUFEN[p.stufe];
    const passend = cands.filter((x) => len(x) >= st.satzMin && len(x) <= st.satzWoerter);
    const kurz = cands.filter((x) => len(x) <= st.satzWoerter);
    if (passend.length >= c.saetze * 2) satzCands = passend;
    else if (kurz.length >= c.saetze * 2) satzCands = kurz;
  }
  const saetze = chooseSentences(satzCands, lang ? LANG_SAETZE : c.saetze, p, rng, avoid);

  const base = { geschichte: story?.g ?? null, woerter, saetze };
  const quest = makeQuest(p, base, v, rng);

  const sheet: SheetData = {
    number: null,
    minutes: p.minutes,
    theme: p.theme,
    letters: sortUnits(p.letters),
    newLetter: p.newLetter,
    childName: p.childName,
    blocks: { ...p.blocks },
    ...(p.stufe ? { stufe: p.stufe } : {}),
    ...(p.silbenFarbig ? { silbenFarbig: true } : {}),
    silben,
    woerter,
    kleine,
    // Block „Ähnliche Buchstaben“ entfällt (A6); nur alte Blätter haben ihn noch
    aehnlich: null,
    saetze,
    geschichte: story?.g ?? null,
    quest,
    fragen: story?.fragen ?? [],
    source: 'dict',
  };
  return { sheet, removed: [] };
}

/** Einen einzelnen Block neu würfeln (↻). Geschichte zieht Fragen und Quest mit. */
export function rerollBlock(sheet: SheetData, block: BlockId, p: GenParams): SheetData {
  const g = generateSheet({ ...p, seed: p.seed });
  const s = { ...sheet };
  const rng = mulberry32(p.seed ^ 0x9e3779b9);
  const v = new Vocab(new Set(p.letters));
  switch (block) {
    case 'silben':
      s.silben = g.sheet.silben;
      break;
    case 'woerter':
      s.woerter = makeWoerter(v, p, rng, new Set([...sheet.kleine, ...sheet.woerter]));
      if (s.woerter.length < COUNTS[p.minutes].woerter / 2) s.woerter = g.sheet.woerter;
      break;
    case 'kleine':
      s.kleine = g.sheet.kleine;
      break;
    case 'saetze':
      s.saetze = g.sheet.saetze;
      break;
    case 'geschichte':
    case 'fragen':
      s.geschichte = g.sheet.geschichte;
      s.fragen = g.sheet.fragen;
      if (s.quest?.kind === 'zaehle') s.quest = makeQuest(p, s, v, rng);
      break;
    case 'quest':
      s.quest = makeQuest({ ...p, history: { ...p.history, lastQuest: sheet.quest?.kind ?? null } }, s, v, rng);
      break;
  }
  return s;
}

/** Alle Wörter eines Blatts (für die Wiederholungssperre). */
export function sheetWords(s: SheetData): string[] {
  return [...new Set([...s.woerter, ...s.kleine])];
}

/** Prüft ein ganzes Blatt (Lesetext) – Name des Kindes, Elternfragen und Quest-Anleitung sind ausgenommen. */
export function readingTexts(s: SheetData): string[] {
  const t: string[] = [];
  if (s.blocks.silben) t.push(...s.silben);
  if (s.blocks.woerter) t.push(...s.woerter);
  if (s.blocks.kleine) t.push(...s.kleine);
  if (s.blocks.aehnlich && s.aehnlich) t.push(...s.aehnlich.words.flat());
  if (s.blocks.saetze) t.push(...s.saetze);
  if (s.blocks.geschichte && s.geschichte) t.push(s.geschichte.titel, ...s.geschichte.saetze);
  if (s.blocks.quest && s.quest) {
    if (s.quest.kind === 'zaehle' && s.quest.target) t.push(s.quest.target);
    if (s.quest.kind === 'geheimwort') t.push(...(s.quest.words ?? []), s.quest.target ?? '');
  }
  return t;
}

/**
 * Andere Blätter derselben Serie (A6) sperren: ihre Wörter, Sätze und Geschichten
 * gelten als „gerade benutzt“, damit sich innerhalb der Serie nichts wiederholt.
 */
export function withSerie(h: History, andere: SheetData[]): History {
  const out: History = { ...h, wordSeq: new Map(h.wordSeq), recentSentences: new Set(h.recentSentences), recentStories: new Set(h.recentStories), storySeq: new Map(h.storySeq) };
  for (const d of andere) {
    for (const w of sheetWords(d)) out.wordSeq.set(w, h.seq - 1);
    for (const x of d.saetze) out.recentSentences.add(x);
    if (d.geschichte) {
      out.recentStories.add(d.geschichte.titel);
      out.storySeq!.set(d.geschichte.titel, h.seq - 1);
    }
    if (d.quest) out.lastQuest = d.quest.kind;
  }
  return out;
}

/** Baut die Wiederholungs-Historie aus gespeicherten Blättern (seq = laufende Nummer). */
export function historyFrom(sheets: { seq: number; data: SheetData }[], nextSeq: number): History {
  const h = emptyHistory();
  h.seq = nextSeq;
  const sorted = [...sheets].sort((a, b) => a.seq - b.seq);
  for (const s of sorted) {
    for (const w of sheetWords(s.data)) h.wordSeq.set(w, s.seq);
    if (s.data.geschichte) h.storySeq!.set(s.data.geschichte.titel, s.seq);
  }
  for (const s of sorted.slice(-2)) {
    for (const x of s.data.saetze) h.recentSentences.add(x);
    if (s.data.geschichte) h.recentStories.add(s.data.geschichte.titel);
  }
  const last = sorted[sorted.length - 1];
  h.lastQuest = last?.data.quest?.kind ?? null;
  return h;
}
