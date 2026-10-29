import type { Minutes, SheetData } from './types';
import { UNITS, checkText, sortUnits, unitById } from './letters';
import { COUNTS, makeQuest, makeSilben, type GenParams, type Removed } from './generator';
import { Vocab } from './vocab';
import { mulberry32 } from './random';

export const PARSE_ERROR = 'Antwort konnte nicht gelesen werden. Bitte die ganze Antwort kopieren.';

const label = (id: string) => (unitById(id)?.label ?? id).replace('-', '');

/** Prompt für Claude / ChatGPT (TZ Abschnitt 4). */
export function buildPrompt(letters: string[], newLetter: string | null, minutes: Minutes): string {
  const ids = sortUnits(letters);
  const single = ids.filter((id) => [...id].length === 1).map(label);
  const multi = ids.filter((id) => [...id].length > 1).map(label);
  const c = COUNTS[minutes];
  return `Du schreibst Lesetexte für ein Kind in der 1. Klasse (Deutschland).
Das Kind kennt NUR diese Buchstaben: ${single.join(', ') || 'keine'}.
Neuester Buchstabe (bitte oft verwenden): ${newLetter ? label(newLetter) : 'keiner'}.
Bekannte Buchstabenverbindungen: ${multi.join(', ') || 'keine'}.
Verwende KEINE anderen Buchstaben, auch nicht in Namen.
Groß- und Kleinschreibung ist erlaubt. Keine Silbentrennstriche.
Lesezeit: ${minutes} Minuten.

Antworte NUR mit JSON in genau diesem Format:
{ "woerter": [${c.woerter} Wörter],
  "kleineWoerter": [${c.kleine} kurze Wörter],
  "saetze": [${c.saetze} kurze Sätze],
  "geschichte": { "titel": "...", "saetze": [${c.geschichte} Sätze] },
  "fragen": [${c.fragen[0]} Fragen an das Kind, normale Sprache] }`;
}

export interface ChatJson {
  woerter: string[];
  kleineWoerter: string[];
  saetze: string[];
  geschichte: { titel: string; saetze: string[] };
  fragen: string[];
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    try {
      // typische Chat-Fehler: typografische Anführungszeichen, Komma am Ende
      return JSON.parse(s.replace(/[“”„]/g, '"').replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return undefined;
    }
  }
}

/** Findet das JSON-Objekt in einer Chat-Antwort (auch mit Text drumherum oder ```json). */
export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fence ? [fence[1], text] : [text];
  for (const c of candidates) {
    const starts: number[] = [];
    for (let i = 0; i < c.length; i++) if (c[i] === '{') starts.push(i);
    for (const st of starts) {
      for (let end = c.lastIndexOf('}'); end > st; end = c.lastIndexOf('}', end - 1)) {
        const v = tryParse(c.slice(st, end + 1));
        if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      }
    }
  }
  return undefined;
}

const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean) : []);

export function parseChat(text: string): ChatJson {
  const o = extractJson(text) as Record<string, unknown> | undefined;
  if (!o) throw new Error(PARSE_ERROR);
  const g = (o.geschichte ?? {}) as Record<string, unknown>;
  const r: ChatJson = {
    woerter: strArr(o.woerter ?? o['wörter']),
    kleineWoerter: strArr(o.kleineWoerter ?? o['kleineWörter'] ?? o.kleine_woerter),
    saetze: strArr(o.saetze ?? o['sätze']),
    geschichte: { titel: typeof g.titel === 'string' ? g.titel.trim() : '', saetze: strArr(g.saetze ?? g['sätze']) },
    fragen: strArr(o.fragen),
  };
  if (!r.woerter.length && !r.saetze.length && !r.geschichte.saetze.length) throw new Error(PARSE_ERROR);
  return r;
}

/** Silbentrennstriche entfernen („Ma-ma“ → „Mama“). Andere Bindestriche bleiben (Text wird dann aussortiert). */
export function joinSyllables(s: string): string {
  return s.replace(/(\p{L})-(\p{Ll})/gu, '$1$2');
}

/** Prüft die Chat-Antwort und baut daraus ein Blatt. */
export function sheetFromChat(answer: ChatJson, p: GenParams): { sheet: SheetData; removed: Removed[] } {
  const known = new Set(p.letters);
  const removed: Removed[] = [];
  const keep = (list: string[]) =>
    list
      .map(joinSyllables)
      .filter((s) => {
        const r = checkText(s, known);
        const hyphen = /\p{L}-\p{L}/u.test(s);
        if (!r.ok || hyphen) removed.push({ text: s, missing: hyphen ? [...r.missing, '-'] : r.missing });
        return r.ok && !hyphen;
      });
  const c = COUNTS[p.minutes];
  const uniq = (l: string[]) => [...new Set(l)];
  const woerter = uniq(keep(answer.woerter)).slice(0, c.woerter).sort((a, b) => [...a].length - [...b].length);
  const kleine = uniq(keep(answer.kleineWoerter)).slice(0, c.kleine);
  const saetze = uniq(keep(answer.saetze)).slice(0, c.saetze);
  const gSaetze = keep(answer.geschichte.saetze).slice(0, c.geschichte);
  let titel = joinSyllables(answer.geschichte.titel);
  if (titel && !checkText(titel, known).ok) {
    removed.push({ text: titel, missing: checkText(titel, known).missing });
    titel = '';
  }
  const rng = mulberry32(p.seed);
  const v = new Vocab(known);
  const geschichte = gSaetze.length ? { titel, saetze: gSaetze } : null;
  const base = { geschichte, woerter, saetze };
  const sheet: SheetData = {
    number: null,
    minutes: p.minutes,
    theme: p.theme,
    letters: sortUnits(p.letters),
    newLetter: p.newLetter,
    childName: p.childName,
    blocks: { ...p.blocks },
    silben: makeSilben(sortUnits(p.letters), p.newLetter, c.silben, rng),
    woerter,
    kleine,
    aehnlich: null,
    saetze,
    geschichte,
    quest: makeQuest(p, base, v, rng),
    fragen: answer.fragen.slice(0, c.fragen[1]),
    source: 'chat',
  };
  return { sheet, removed };
}

export const ALL_UNIT_LABELS = UNITS.map((u) => u.label);
