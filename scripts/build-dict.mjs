// Baut src/data/woerterbuch.json aus den Quellen in src/data/quelle/.
// Aufruf: npm run dict   (mit --check: nur prüfen, ob die JSON aktuell ist)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const Q = (f) => readFileSync(resolve(ROOT, 'src/data/quelle', f), 'utf8');
const lines = (txt) => txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const THEMES = new Set(['wiese', 'weltraum', 'meer', 'zirkus', 'zauberwald', 'winter']);

export function buildDict() {
  const woerter = [];
  const seen = new Set();
  const add = (w, typ, extra = {}) => {
    if (seen.has(w)) return;
    seen.add(w);
    const tags = extra.tags ?? [];
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
  for (const block of Q('geschichten.txt').split(/\n\s*\n/)) {
    const ls = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const t = ls.find((l) => l.startsWith('# ') && !/^# (Mini|Kurze)/.test(l));
    if (!t) continue;
    const titel = t.slice(2).trim();
    const body = ls.filter((l) => !l.startsWith('#'));
    geschichten.push({
      titel,
      saetze: body.filter((l) => !l.startsWith('?')),
      fragen: body.filter((l) => l.startsWith('?')).map((l) => l.slice(1).trim()),
    });
  }

  for (const s of [...saetze, ...geschichten.flatMap((g) => g.saetze)]) {
    if (/\p{L}-\p{L}/u.test(s)) throw new Error(`Silbentrennstrich: ${s}`);
  }

  return { woerter, verben, adjektive, saetze, geschichten };
}

const out = resolve(ROOT, 'src/data/woerterbuch.json');
const json = JSON.stringify(buildDict(), null, 0).replace(/\},\{/g, '},\n{') + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== json) {
    console.error('woerterbuch.json ist veraltet – bitte npm run dict ausführen');
    process.exit(1);
  }
} else {
  writeFileSync(out, json);
  const d = buildDict();
  console.log(`Wörter: ${d.woerter.length}, Verben: ${d.verben.length}, Sätze: ${d.saetze.length}, Geschichten: ${d.geschichten.length}`);
}
