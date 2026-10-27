import type { BlockId, Minutes, Quest, QuestKind, SheetData, Geschichte, Aehnlich } from './types';
import type { ThemeId } from '../sheet/themes';
import { Vocab } from './vocab';
import { DICT } from './dict';
import { SINGLE_CONSONANTS, VOWEL_UNITS, sortUnits, unitById, wordsOf, checkText, countUnit } from './letters';
import { pools, templateSentences, templateStory } from './saetze';
import { mulberry32, pick, shuffle, type Rng } from './random';

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
  lastQuest: QuestKind | null;
}

export const emptyHistory = (): History => ({ wordSeq: new Map(), seq: 1, recentSentences: new Set(), recentStories: new Set(), lastQuest: null });

export interface GenParams {
  letters: string[];
  newLetter: string | null;
  minutes: Minutes;
  theme: ThemeId;
  childName: string;
  blocks: Record<BlockId, boolean>;
  aehnlichPair: [string, string];
  history: History;
  seed: number;
}

/** Wörter, die der Wortliste fehlen (für „Entfernt: …“) */
export interface Removed {
  text: string;
  missing: string[];
}

const SILBEN_CV_EXCLUDE = new Set(['c', 'x', 'y', 'q']);
const SILBEN_VC = new Set(['m', 'l', 's', 't', 'n', 'r', 'f', 'k', 'p', 'b', 'd', 'g']);

/** Silben aus 2 Buchstaben(-einheiten): Konsonant + Vokal und Vokal + Konsonant. */
export function makeSilben(letters: string[], newLetter: string | null, n: number, rng: Rng): string[] {
  const vowels = letters.filter((l) => VOWEL_UNITS.has(l));
  const cons = letters.filter((l) => SINGLE_CONSONANTS.has(l));
  const all: string[] = [];
  for (const c of cons) for (const v of vowels) if (!SILBEN_CV_EXCLUDE.has(c)) all.push(c + v);
  for (const v of vowels) for (const c of cons) if (SILBEN_VC.has(c) && 'aeiou'.includes(v)) all.push(v + c);
  const uniq = [...new Set(all)];
  const withNew = newLetter ? uniq.filter((s) => s.includes(newLetter)) : [];
  const rest = uniq.filter((s) => !withNew.includes(s));
  const takeNew = Math.min(withNew.length, Math.ceil(n / 2));
  const chosen = [...shuffle(withNew, rng).slice(0, takeNew), ...shuffle(rest, rng)].slice(0, n);
  return shuffle(chosen, rng);
}

/** Wortauswahl: nie Wörter der letzten zwei Blätter; wenn zu wenig, die am längsten unbenutzten. */
function pickFresh(cands: string[], n: number, h: History, rng: Rng, prefer: (w: string) => boolean, preferShare = 0.5): string[] {
  const blocked = (w: string) => (h.wordSeq.get(w) ?? -Infinity) >= h.seq - 2;
  const fresh = shuffle(cands.filter((w) => !blocked(w)), rng);
  const stale = cands.filter(blocked).sort((a, b) => (h.wordSeq.get(a) ?? 0) - (h.wordSeq.get(b) ?? 0));
  const pref = fresh.filter(prefer);
  const other = fresh.filter((w) => !prefer(w));
  const k = Math.min(pref.length, Math.round(n * preferShare));
  const out = [...pref.slice(0, k), ...other, ...pref.slice(k)].slice(0, n);
  for (const w of stale) {
    if (out.length >= n) break;
    out.push(w);
  }
  return out;
}

function makeWoerter(v: Vocab, p: GenParams, rng: Rng, exclude: Set<string>): string[] {
  const n = COUNTS[p.minutes].woerter;
  const small = new Set(v.kleine);
  const cands = v.words
    .filter((e) => e.typ !== 'kleines Wort' && !small.has(e.w) && !exclude.has(e.w) && e.len >= 2)
    .filter((e) => e.typ !== 'Name' || rng() < 0.45);
  const theme = new Set(v.words.filter((e) => e.themen.includes(p.theme)).map((e) => e.w));
  const newU = p.newLetter;
  const prefer = (w: string) => (newU ? countUnit(w, newU) > 0 : false) || (theme.has(w) && rng() < 0.5);
  const words = pickFresh(cands.map((e) => e.w), n, p.history, rng, prefer, 0.55);
  // erst kurze Wörter
  return words.sort((a, b) => [...a].length - [...b].length);
}

function makeKleine(v: Vocab, p: GenParams, rng: Rng): string[] {
  const n = COUNTS[p.minutes].kleine;
  const prefer = (w: string) => (p.newLetter ? countUnit(w, p.newLetter) > 0 : false);
  return pickFresh(v.kleine, n, p.history, rng, prefer, 0.4).sort((a, b) => [...a].length - [...b].length);
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
  const kNew = Math.ceil(n * 0.6);
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
  const n = COUNTS[p.minutes].geschichte;
  const [lo, hi] = p.minutes === 5 ? [6, 8] : [10, 13];
  const curated = DICT.geschichten.filter(
    (g) => g.saetze.length >= lo && g.saetze.length <= hi && v.has(g.titel) && g.saetze.every((s) => v.has(s)),
  );
  const fresh = curated.filter((g) => !p.history.recentStories.has(g.titel));
  const cur = pick(fresh, rng);
  const [fmin, fmax] = COUNTS[p.minutes].fragen;
  if (cur && rng() < 0.75) {
    return { g: { titel: cur.titel, saetze: [...cur.saetze] }, fragen: cur.fragen.slice(0, fmax) };
  }
  const pl = pools(v, new Set());
  let best: ReturnType<typeof templateStory> = null;
  for (let i = 0; i < 6; i++) {
    const st = templateStory(v, pl, rng, n);
    if (st && !p.history.recentStories.has(st.titel) && (!best || st.saetze.length > best.saetze.length)) best = st;
    if (best && best.saetze.length >= n) break;
  }
  if (!best && cur) return { g: { titel: cur.titel, saetze: [...cur.saetze] }, fragen: cur.fragen.slice(0, fmax) };
  if (!best) {
    const any = pick(curated, rng);
    return any ? { g: { titel: any.titel, saetze: [...any.saetze] }, fragen: any.fragen.slice(0, fmax) } : null;
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
    options.push({ kind: 'finde', text: `Kreise alle Wörter mit ${letterLabel(p.newLetter)} ein.`, target: p.newLetter });
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

/** Block „Ähnliche Buchstaben“: Wörter mit dem einen und mit dem anderen Buchstaben. */
export function makeAehnlich(v: Vocab, p: GenParams, rng: Rng, prefer: string[]): Aehnlich | null {
  const [a, b] = p.aehnlichPair;
  const n = COUNTS[p.minutes].aehnlich;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const all = [...new Set([...prefer, ...v.words.map((e) => e.w), ...v.kleine.map(cap)])].filter((w) => v.has(w));
  const contains = (w: string, x: string) => (x.length > 1 ? w.toLowerCase().includes(x) : w.includes(x));
  const forX = (x: string) => {
    const c = all.filter((w) => contains(w, x));
    const pref = c.filter((w) => prefer.includes(w));
    return [...shuffle(pref, rng), ...shuffle(c.filter((w) => !pref.includes(w)), rng)]
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, n)
      .sort((x1, x2) => x1.length - x2.length);
  };
  const wa = forX(a);
  const wb = forX(b);
  if (!wa.length || !wb.length) return null;
  return { pair: [a, b], words: [wa, wb] };
}

/** Prüft, ob beide Buchstaben eines Paars gelernt sind. */
export function pairKnown(pair: [string, string], known: ReadonlySet<string>): boolean {
  return pair.every((x) => checkText(x, known).ok);
}

export interface Generated {
  sheet: SheetData;
  removed: Removed[];
}

export function generateSheet(p: GenParams): Generated {
  const rng = mulberry32(p.seed);
  const known = new Set(p.letters);
  const v = new Vocab(known);
  const c = COUNTS[p.minutes];

  const silben = makeSilben(sortUnits(p.letters), p.newLetter, c.silben, rng);
  const kleine = makeKleine(v, p, rng);
  const story = p.blocks.geschichte || p.blocks.fragen ? makeGeschichte(v, p, rng) : null;
  const woerter = makeWoerter(v, p, rng, new Set(kleine));

  const avoid = new Set(story?.g.saetze ?? []);
  const cands = [
    ...DICT.saetze.filter((s) => v.has(s)),
    ...templateSentences(v, pools(v), rng),
  ];
  const saetze = chooseSentences(cands, c.saetze, p, rng, avoid);

  const base = { geschichte: story?.g ?? null, woerter, saetze };
  const quest = makeQuest(p, base, v, rng);
  const aehnlich = pairKnown(p.aehnlichPair, known) ? makeAehnlich(v, p, rng, [...woerter, ...saetze.flatMap(wordsOf)]) : null;

  const sheet: SheetData = {
    number: null,
    minutes: p.minutes,
    theme: p.theme,
    letters: sortUnits(p.letters),
    newLetter: p.newLetter,
    childName: p.childName,
    blocks: { ...p.blocks },
    silben,
    woerter,
    kleine,
    aehnlich,
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
    case 'aehnlich':
      s.aehnlich = g.sheet.aehnlich;
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

/** Baut die Wiederholungs-Historie aus gespeicherten Blättern (seq = laufende Nummer). */
export function historyFrom(sheets: { seq: number; data: SheetData }[], nextSeq: number): History {
  const h = emptyHistory();
  h.seq = nextSeq;
  const sorted = [...sheets].sort((a, b) => a.seq - b.seq);
  for (const s of sorted) for (const w of sheetWords(s.data)) h.wordSeq.set(w, s.seq);
  for (const s of sorted.slice(-2)) {
    for (const x of s.data.saetze) h.recentSentences.add(x);
    if (s.data.geschichte) h.recentStories.add(s.data.geschichte.titel);
  }
  const last = sorted[sorted.length - 1];
  h.lastQuest = last?.data.quest?.kind ?? null;
  return h;
}
