import { analyzeMaterial, MAX_STORY_SENTENCES } from './material';
import { preparePractice } from './practice';
import { contentIssue } from './content';
import { DEFAULT_BLOCKS, type BlockId, type Minutes, type SheetData } from './types';
import { checkText, countUnit, sortUnits, unitById, wordsOf } from './letters';
import { hasReadingMaterial, COUNTS, makeSilben, mischeKurzeWoerter, type GenParams, type Removed } from './generator';
import { DICT } from './dict';
import { Vocab } from './vocab';
import { mulberry32, shuffle } from './random';

export const PARSE_ERROR = 'Antwort konnte nicht gelesen werden. Bitte die ganze Antwort kopieren.';

const label = (id: string) => (unitById(id)?.label ?? id).replace("-", "");

export function buildPrompt(letters: string[], newLetter: string | null, minutes: Minutes, _blocks: Record<BlockId, boolean> = DEFAULT_BLOCKS): string {
  const ids = sortUnits(letters);
  const labels = (items: string[]) => items.map(label).join(', ') || 'keine';
  const c = COUNTS[minutes];

  const focus = newLetter && ids.includes(newLetter) ? label(newLetter) : null;

  return `Schreibe einfache deutsche Lesetexte für ein Kind, das gerade lesen lernt.

Bekannte Buchstaben: ${labels(ids.filter(id => id.length === 1))}.
Bekannte Buchstabenverbindungen: ${labels(ids.filter(id => id.length > 1))}.
${focus ? 'Neuer Buchstabe: ' + focus + '. Verwende ihn möglichst oft, wo er natürlich passt.' : 'Neuer Buchstabe: keiner.'}
Lesezeit: ${minutes} Minuten.

Verwende in allen Lesetexten, auch in Namen und Titeln, ausschließlich die bekannten Buchstaben und Verbindungen. Nicht gelernte Verbindungen (ch, sch, au, ei, ai, eu, äu, ie, ck, tz, pf, qu, ng sowie sp und st am Wortanfang) bleiben gesperrt, auch wenn die einzelnen Buchstaben bekannt sind. Die Freigabe von ei gilt auch für ai. Beachte die Groß- und Kleinschreibung. Schreibe ohne Silbentrennstriche.

Nutze jede Stufe, für die du sinnvolles Material findest:
- Bis zu ${c.woerter} verschiedene geläufige Wörter, auch kurze wie im, am, und (maximal 2 Kindernamen).
- Bis zu ${c.saetze} kurze, natürliche, vollständige Sätze.
- Eine kurze Geschichte mit bis zu ${c.geschichte} Sätzen, wenn eine zusammenhängende Handlung mit erkennbarem Schluss möglich ist.

Die Zahlen sind Obergrenzen. Lass nur die Felder leer, für die kein sinnvoller Inhalt gelingt. Verwende echte, kindgerechte Wörter, die sich mit den gelernten Lauten lesen lassen. Meide Schimpfwörter, Beleidigungen, Gewalt, sexuelle Inhalte, Alkohol, Drogen und Wörter mit ungewohnter Aussprache wie Toast, Budget oder Chance.

Gib nur zu einer vorhandenen Geschichte bis zu ${c.fragen[0]} Verständnisfragen, die ein Erwachsener dem Kind vorliest. Für diese Fragen ist normales Deutsch erlaubt.

Antworte ausschließlich mit einem gültigen JSON-Objekt in dieser Struktur. Fülle die passenden Felder und behalte alle Schlüssel bei:
{"woerter":[],"saetze":[],"geschichte":{"titel":"","saetze":[]},"fragen":[]}`;
}

export interface ChatJson {
  woerter: string[];
  kleineWoerter: string[];
  saetze: string[];
  geschichte: { titel: string; saetze: string[] };
  fragen: string[];
}

/** Entfernt nur Markdown-Escapes außerhalb von JSON-Strings; Text und gültige Escapes bleiben erhalten. */
function cleanMarkdownJson(s: string): string {
  let out = '', quoteEnd = '', escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoteEnd) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      if (ch === quoteEnd) { out += '"'; quoteEnd = ''; continue; }
      out += ch;
      continue;
    }
    if (ch === '\\' && /[\[\]{}]/.test(s[i + 1] ?? '')) continue;
    if (ch === ',' && /^\s*[}\]]/.test(s.slice(i+1))) continue;
    if (ch === '"' || ch === '“' || ch === '„') {
      quoteEnd = ch === '„' ? '“' : ch === '“' ? '”' : '"';
      out += '"';
      continue;
    }
    out += ch;
  }
  return out;
}

function tryParse(s: string): unknown {
  for (const candidate of [s, cleanMarkdownJson(s)]) {
    try {
      let value = JSON.parse(candidate);
      // Manche Kopierfunktionen liefern die gesamte Antwort als JSON-String.
      for (let i = 0; i < 2 && typeof value === 'string'; i++) value = JSON.parse(value);
      return value;
    } catch { /* nächsten Kandidaten versuchen */ }
  }
  return undefined;
}

/** Findet das JSON-Objekt in einer Chat-Antwort (auch mit Text drumherum oder ```json). */
export function extractJson(text: string): unknown {
  const direct = tryParse(text.trim());
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fence ? [fence[1], text] : [text];
  for (const c of candidates) {
    const source = cleanMarkdownJson(c);
    let start = -1, depth = 0, quoted = false, escaped = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') quoted = false;
        continue;
      }
      if (depth && ch === '"') { quoted = true; continue; }
      if (ch === '{') { if (depth++ === 0) start = i; }
      if (ch === '}' && depth > 0 && --depth === 0) {
        const value = tryParse(source.slice(start,i+1));
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
      }
    }
  }
  return undefined;
}

const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean) : []);

export function parseChat(text: string): ChatJson {
  let o = extractJson(text) as Record<string, unknown> | undefined;
  if (!o) throw new Error(PARSE_ERROR);
  const normalized = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/_/g, '').replace(/ä/g, 'ae').replace(/ö/g, 'oe'), v]));
  const g = (normalized.geschichte && typeof normalized.geschichte === 'object' ? normalized.geschichte : {}) as Record<string, unknown>;
  o = normalized;
  const r: ChatJson = {
    woerter: strArr(o.woerter ?? o['wörter']),
    kleineWoerter: strArr(o.kleinewoerter ?? o.kleineWoerter ?? o['kleineWörter'] ?? o.kleine_woerter),
    saetze: strArr(o.saetze ?? o['sätze']),
    geschichte: { titel: typeof g.titel === 'string' ? g.titel.trim() : '', saetze: strArr(g.saetze ?? g['sätze']) },
    fragen: strArr(o.fragen),
  };
  const completeSchema = ['woerter','saetze','fragen'].every(key=>Array.isArray(o[key])) && (o.geschichte === null || (typeof g.titel === 'string' && Array.isArray(g.saetze ?? g['sätze'])));
  if (!r.woerter.length && !r.kleineWoerter.length && !r.saetze.length && !r.geschichte.saetze.length && !completeSchema) throw new Error(PARSE_ERROR);
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
  const material = analyzeMaterial(p.letters);
  const rejectContent = (text: string) => {
    removed.push({ text, missing: [], reason: 'content' });
    return false;
  };
  const keep = (list: string[], normalize = true) => list.map(text => normalize ? joinSyllables(text) : text).filter(text => {
    const issue = contentIssue(text);
    if (issue) { removed.push({text,missing:[],reason:issue}); return false; }
    if (!wordsOf(text).length || /[\p{N}\p{So}]/u.test(text)) return rejectContent(text);
    const r = checkText(text, known);
    const hyphen = /\p{L}-\p{L}/u.test(text);
    if (!r.ok || hyphen) {
      removed.push({ text, missing: hyphen ? [...r.missing, '-'] : r.missing });
      return false;
    }
    return true;
  });
  const c = COUNTS[p.minutes];
  const uniq = (list: string[]) => [...new Map(list.map(w => [w.toLowerCase(), w])).values()];
  const v = new Vocab(known);
  const family = new Set(['mama', 'papa', 'oma', 'opa']);
  const names = new Set(v.names.map(w => w.toLowerCase()).filter(w => !family.has(w)));
  const selectedNames = new Set<string>();
  const standalone = (text: string) => {
    if (!/^\p{L}+$/u.test(text)) return rejectContent(text);
    const lower = text.toLowerCase();
    if (!names.has(lower)) return true;
    if (!selectedNames.has(lower) && selectedNames.size >= 2) return rejectContent(text);
    selectedNames.add(lower);
    return true;
  };
  // Ältere Antworten trennen noch kleineWoerter: sie gehören mit in den Wortblock.
  const woerter = p.blocks.woerter ? uniq(keep([...answer.woerter, ...answer.kleineWoerter])).filter(standalone).slice(0, c.woerter) : [];
  const saetze = p.blocks.saetze ? uniq(keep(answer.saetze)).slice(0, c.saetze) : [];
  // Ein entfernter Mittelsatz kann Handlung und Elternfragen unbrauchbar machen: Geschichte nur ganz übernehmen.
  const gSaetze = p.blocks.geschichte ? keep(answer.geschichte.saetze, false) : [];
  const titel = gSaetze.length && answer.geschichte.titel ? keep([answer.geschichte.titel], false)[0] ?? '' : '';
  let geschichte = (!answer.geschichte.titel || titel) && gSaetze.length && gSaetze.length === answer.geschichte.saetze.length && gSaetze.length <= MAX_STORY_SENTENCES ? { titel, saetze: gSaetze } : null;
  if (p.blocks.geschichte && answer.geschichte.saetze.length && !geschichte) removed.push({text:answer.geschichte.titel || 'Geschichte',missing:[],reason:answer.geschichte.saetze.length>MAX_STORY_SENTENCES ? 'storyLength' : 'storyIncomplete'});
  let questions = geschichte && p.blocks.fragen ? answer.fragen.filter(text=>{
    const issue = contentIssue(text,false);
    if (issue) removed.push({text,missing:[],reason:issue});
    return !issue && wordsOf(text).length > 0;
  }).slice(0,c.fragen[1]) : [];
  if (p.blocks.geschichte && material.available.geschichte && !geschichte) {
    const fallback = material.stories[0];
    geschichte = {titel:fallback.titel,saetze:[...fallback.saetze]};
    questions = p.blocks.fragen ? fallback.fragen.slice(0,c.fragen[1]) : [];
  }
  const rng = mulberry32(p.seed);

  // Was die KI nicht liefern konnte, kommt still aus dem Wörterbuch dazu: das Blatt soll einfach voll und nützlich sein.
  const auffuellen = (list: string[], pool: string[], limit: number, sperre: string[] = []) => {
    const used = new Set([...list, ...sperre].map(text => text.toLowerCase()));
    for (const text of pool) {
      if (list.length >= limit) break;
      const key = text.toLowerCase();
      if (used.has(key)) continue;
      if (names.has(key)) {
        if (!selectedNames.has(key) && selectedNames.size >= 2) continue;
        selectedNames.add(key);
      }
      list.push(text);
      used.add(key);
    }
  };
  if (p.blocks.woerter) {
    const ohneNamen = v.words.filter(e => e.typ !== 'Name' && e.len >= 2).map(e => e.w);
    auffuellen(woerter, [...material.words, ...shuffle(ohneNamen, rng)], c.woerter);
  }
  if (p.blocks.saetze) {
    auffuellen(saetze, [...shuffle(DICT.saetze.filter(text => v.has(text)), rng), ...material.sentences], c.saetze, geschichte?.saetze);
  }
  const kurz = new Set(v.kleine.map(w => w.toLowerCase()));
  const nachLaenge = (a: string, b: string) => [...a].length - [...b].length;
  const wortblock = mischeKurzeWoerter(woerter.filter(w => !kurz.has(w.toLowerCase())).sort(nachLaenge), woerter.filter(w => kurz.has(w.toLowerCase())).sort(nachLaenge));
  const sheet: SheetData = {
    number: null,
    minutes: p.minutes,
    theme: p.theme,
    letters: sortUnits(p.letters),
    newLetter: p.newLetter,
    childName: p.childName,
    blocks: { ...p.blocks },
    silben: p.blocks.silben ? makeSilben(sortUnits(p.letters), p.newLetter, c.silben, rng) : [],
    woerter: wortblock,
    kleine: [],
    aehnlich: null,
    saetze,
    geschichte,
    quest: null,
    fragen: questions,
    source: 'chat',
    ...(p.silbenFarbig ? {silbenFarbig:true} : {}),
  };
  if (!hasReadingMaterial(sheet)) throw new Error('CHAT_EMPTY');
  preparePractice(sheet);
  // Zusatzaufgabe ausschließlich mit dem tatsächlich sichtbaren Lesematerial, nie aus einem zweiten Wörterbuch-Pool.
  const items = [...(sheet.blocks.silben ? sheet.silben : []), ...(sheet.blocks.woerter ? sheet.woerter : []), ...(sheet.blocks.saetze ? sheet.saetze : []), ...(sheet.blocks.geschichte ? sheet.geschichte?.saetze ?? [] : [])];
  const target = [p.newLetter, ...sortUnits(p.letters)].find(id => id && items.some(text => countUnit(text, id) > 0));
  if (p.blocks.quest && target) {
    const upper = label(target), lower = upper.toLowerCase();
    sheet.quest = { kind: 'finde', target, text: `Kreise alle Silben und Wörter mit ${upper === lower ? upper : upper + ' oder ' + lower} ein.` };
  }
  return { sheet, removed };
}

