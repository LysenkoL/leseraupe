// Baut src/data/woerterbuch.json aus den Quellen in src/data/quelle/.
// Aufruf: npm run dict   (mit --check: nur prüfen, ob die JSON aktuell ist)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Silbentrennung (B3) – dieselbe Funktion wie in der App
import { silbiere, parseAusnahmen } from '../src/core/silben.ts';
// Buchstaben-Einheiten (Fibel-Reihenfolge) – dieselbe Zerlegung wie in der App
import { UNIT_IDS, tokenizeWord, wordsOf } from '../src/core/letters.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Windows/git autocrlf: Zeilenenden vereinheitlichen
const crlf = (txt) => txt.replace(/\r\n?/g, '\n');
const Q = (f) => crlf(readFileSync(resolve(ROOT, 'src/data/quelle', f), 'utf8'));
const lines = (txt) => txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const THEMES = new Set(['wiese', 'weltraum', 'meer', 'zirkus', 'zauberwald', 'fruehling', 'sommer', 'herbst', 'winter', 'piraten', 'burg', 'bauernhof', 'dinos']);

export function buildDict() {
  const woerter = [];
  const seen = new Set();
  const add = (w, typ, extra = {}) => {
    const tags = extra.tags ?? [];
    if (seen.has(w)) {
      // doppelt (z. B. im Themen-Block): nur weitere Themen ergänzen
      const e = woerter.find((x) => x.w === w);
      for (const t of tags) if (THEMES.has(t) && !e.themen.includes(t)) e.themen.push(t);
      return;
    }
    seen.add(w);
    woerter.push({ w, typ, len: [...w].length, themen: tags.filter((t) => THEMES.has(t)), ...extra, tags: tags.filter((t) => !THEMES.has(t)) });
  };

  for (const n of lines(Q('namen.txt'))) add(n, 'Name');

  for (const l of lines(Q('nomen.txt'))) {
    const [left, right = ''] = l.split('|').map((s) => s.trim());
    const [art, ...rest] = left.split(/\s+/);
    if (!['r', 'e', 's', 'pl'].includes(art)) throw new Error(`Nomen ohne Artikel: ${l}`);
    add(rest.join(' '), 'Nomen', { art, tags: right.split(/\s+/).filter(Boolean) });
  }

  const verben = [];
  for (const l of lines(Q('verben.txt'))) {
    const [left, right = ''] = l.split('|').map((s) => s.trim());
    const [inf, form3] = left.split(/\s+/);
    const tags = right.split(/\s+/).filter(Boolean);
    verben.push({ inf, form3, tags });
    add(form3, 'Verb', { inf, tags });
    add(inf, 'Verb', { inf, tags: [] });
  }

  const adjektive = [];
  for (const l of lines(Q('adjektive.txt'))) {
    const [w, right = ''] = l.split('|').map((s) => s.trim());
    const tags = right.split(/\s+/).filter(Boolean);
    adjektive.push({ w, tags });
    add(w, 'Adjektiv', { tags });
  }

  for (const w of lines(Q('kleine.txt')).join(' ').split(/\s+/)) add(w, 'kleines Wort');

  const saetze = [...new Set(lines(Q('saetze.txt')))];

  const geschichten = [];
  // C3: Geschichten in Abschnitten mit „(C3)“ im Kopf haben eine richtige Handlung (Problem und Lösung)
  let handlung = false;
  for (const block of Q('geschichten.txt').split(/\n\s*\n/)) {
    const ls = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const kopf = ls.find((l) => /^# (Mini|Kurze|Lange)/.test(l));
    if (kopf) handlung = kopf.includes('(C3)');
    const t = ls.find((l) => l.startsWith('# ') && !/^# (Mini|Kurze|Lange)/.test(l));
    if (!t) continue;
    const titel = t.slice(2).trim();
    if (geschichten.some((g) => g.titel === titel)) throw new Error(`Titel doppelt: ${titel}`);
    const body = ls.filter((l) => !l.startsWith('#'));
    geschichten.push({
      titel,
      saetze: body.filter((l) => !l.startsWith('?')),
      fragen: body.filter((l) => l.startsWith('?')).map((l) => l.slice(1).trim()),
      ...(handlung ? { handlung: true } : {}),
    });
  }

  for (const s of [...saetze, ...geschichten.flatMap((g) => g.saetze)]) {
    if (/\p{L}-\p{L}/u.test(s)) throw new Error(`Silbentrennstrich: ${s}`);
    const fremd = wordsOf(s).flatMap((w) => tokenizeWord(w).unknown);
    if (fremd.length) throw new Error(`Zeichen ohne Buchstaben-Einheit (${fremd.join(', ')}): ${s}`);
  }
  // C3: jede Geschichte bekommt „ab“ = wie viele Einheiten der Fibel-Reihenfolge sie braucht
  // (Position der spätesten Einheit). Wird in der App nur zum Sortieren/Testen benutzt –
  // ob eine Geschichte aufs Blatt darf, prüft die App immer selbst gegen die gelernten Einheiten.
  for (const g of geschichten) {
    const units = new Set([g.titel, ...g.saetze].flatMap((x) => wordsOf(x).flatMap((w) => tokenizeWord(w).units)));
    g.ab = Math.max(...[...units].map((u) => UNIT_IDS.indexOf(u) + 1));
    if (g.saetze.length >= 10 && g.fragen.length < 4) throw new Error(`Lange Geschichte braucht 4+ Fragen: ${g.titel}`);
    if (g.fragen.length < 2) throw new Error(`Geschichte braucht 2+ Fragen: ${g.titel}`);
  }

  // Silben für „Silben farbig“ (B3): zusammengesetzte Wörter über die Nomen/Adjektive des Wörterbuchs
  const ausnahmenText = Q('silben-ausnahmen.txt');
  const ausnahmen = parseAusnahmen(ausnahmenText);
  const lexikon = new Set(woerter.filter((e) => ['Nomen', 'Adjektiv'].includes(e.typ) && e.w.length >= 3).map((e) => e.w.toLowerCase()));
  for (const e of woerter) {
    const s = silbiere(e.w, lexikon, ausnahmen);
    if (s.join('') !== e.w) throw new Error(`Silben passen nicht: ${e.w}`);
    if (s.length > 1) e.silben = s.join('|');
  }
  const silbenAusnahmen = lines(ausnahmenText);

  return { woerter, verben, adjektive, saetze, geschichten, silbenAusnahmen };
}

const out = resolve(ROOT, 'src/data/woerterbuch.json');
const json = JSON.stringify(buildDict(), null, 0).replace(/\},\{/g, '},\n{') + '\n';
if (process.argv.includes('--check')) {
  if (crlf(readFileSync(out, 'utf8')) !== json) {
    console.error('woerterbuch.json ist veraltet – bitte npm run dict ausführen');
    process.exit(1);
  }
} else {
  writeFileSync(out, json);
  const d = buildDict();
  console.log(`Wörter: ${d.woerter.length}, Verben: ${d.verben.length}, Sätze: ${d.saetze.length}, Geschichten: ${d.geschichten.length}`);
  if (process.argv.includes('--bericht')) {
    // Welche Geschichten passen ab wie vielen Einheiten (Fibel-Reihenfolge)?
    for (const g of [...d.geschichten].sort((a, b) => a.ab - b.ab)) {
      console.log(`${String(g.ab).padStart(2)} ${UNIT_IDS[g.ab - 1].padEnd(3)} ${String(g.saetze.length).padStart(2)} Sätze  ${g.titel}`);
    }
  }
}
