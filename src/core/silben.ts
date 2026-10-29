/**
 * Silbentrennung für „Silben farbig“ (B3) – nur zum Einfärben, nie mit Strich.
 * Regeln wie in der Grundschule: Ma-ma, O-ma, Kat-ze, Zu-cker, Fla-sche;
 * zusammengesetzte Wörter erst in ihre Teile (Blei-stift, Haus-tür).
 * Bewusst ohne Imports: wird auch von scripts/build-dict.mjs geladen.
 */

const NUCLEI = ['äu', 'eu', 'ei', 'ai', 'au', 'ie', 'aa', 'ee', 'oo'];
const VOWELS = new Set([...'aeiouäöüy']);
const CONS_GROUPS = ['sch', 'ch', 'ck', 'ph', 'qu', 'th'];

interface Unit {
  start: number;
  len: number;
  vowel: boolean;
}

function units(lower: string): Unit[] {
  const out: Unit[] = [];
  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    const n = NUCLEI.find((g) => rest.startsWith(g));
    if (n) {
      out.push({ start: i, len: n.length, vowel: true });
      i += n.length;
      continue;
    }
    const c = CONS_GROUPS.find((g) => rest.startsWith(g));
    if (c) {
      out.push({ start: i, len: c.length, vowel: false });
      i += c.length;
      continue;
    }
    // y am Wortanfang vor Vokal ist Konsonant (Yoga), sonst Vokal (Pony)
    const ch = lower[i];
    const vowel = VOWELS.has(ch) && !(ch === 'y' && i === 0 && VOWELS.has(lower[i + 1] ?? ''));
    out.push({ start: i, len: 1, vowel });
    i += 1;
  }
  return out;
}

/** Zwei Konsonanten, die zusammen eine Silbe beginnen (Ze-bra, Zi-tro-ne, Pus-te-blu-me) */
const ANFANG_2 = new Set(['br', 'dr', 'fr', 'gr', 'kr', 'pr', 'tr', 'bl', 'fl', 'gl', 'kl', 'pl']);
/** In längeren Konsonantengruppen (meist zwischen Wortteilen): Stern-schnup-pe, Nil-pferd, Spiel-platz */
const ANFANG_3 = new Set([...ANFANG_2, 'schl', 'schm', 'schn', 'schr', 'schw', 'pf', 'pfl', 'pfr', 'str', 'spr', 'kn', 'zw']);

/** Silben eines einfachen (nicht zusammengesetzten) Wortes nach den Grundregeln */
export function silbenRegel(word: string): string[] {
  const lower = word.toLowerCase();
  const u = units(lower);
  const nuclei = u.map((x, i) => (x.vowel ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length < 2) return [word];
  const text = (from: number, to: number) => u.slice(from, to).map((x) => lower.slice(x.start, x.start + x.len)).join('');
  const cuts: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const a = nuclei[n];
    const b = nuclei[n + 1];
    const k = b - a - 1;
    // kein Konsonant: zwischen den Vokalen; einer: vor ihm; mehrere: der letzte geht mit –
    // außer die letzten bilden zusammen einen Silbenanfang (dann gehen sie zusammen)
    let take = 1;
    if (k === 2 && ANFANG_2.has(text(a + 1, b))) take = 2;
    else if (k >= 3) {
      for (let t = Math.min(k - 1, 3); t >= 2; t--) {
        if (ANFANG_3.has(text(b - t, b))) {
          take = t;
          break;
        }
      }
    }
    const unit = k === 0 ? b : b - Math.min(k, take);
    cuts.push(u[unit].start);
  }
  const out: string[] = [];
  let from = 0;
  for (const c of cuts) {
    out.push(word.slice(from, c));
    from = c;
  }
  out.push(word.slice(from));
  return out.filter(Boolean);
}

/** Fugenlaute zwischen Wortteilen (Geburt-s-tag, Blume-n-wiese) */
const FUGEN = ['', 's', 'n', 'en', 'es'];
const MIN_TEIL = 3;

/**
 * Zusammengesetztes Wort in bekannte Teile zerlegen (Haus|tür, Regen|bogen).
 * `lexikon`: bekannte Wörter klein geschrieben. Liefert die Teile oder null.
 */
export function zerlege(word: string, lexikon: ReadonlySet<string>): string[] | null {
  const lw = word.toLowerCase();
  let best: string[] | null = null;
  for (let p = MIN_TEIL; p <= lw.length - MIN_TEIL; p++) {
    const right = lw.slice(p);
    if (!lexikon.has(right) && !zerlege(right, lexikon)) continue;
    const left = lw.slice(0, p);
    const ok = FUGEN.some((f) => left.endsWith(f) && left.length - f.length >= MIN_TEIL && lexikon.has(left.slice(0, left.length - f.length)));
    if (!ok) continue;
    const rightParts = lexikon.has(right) ? [word.slice(p)] : zerlege(word.slice(p), lexikon)!;
    const parts = [word.slice(0, p), ...rightParts];
    // längster erster Teil gewinnt (Schnee|mann statt Schnee|m|ann)
    if (!best || parts[0].length > best[0].length) best = parts;
  }
  return best;
}

/** Silben eines Wortes: Ausnahme > Teile eines zusammengesetzten Wortes > Grundregeln */
export function silbiere(word: string, lexikon: ReadonlySet<string> = new Set(), ausnahmen: ReadonlyMap<string, string[]> = new Map()): string[] {
  const aus = ausnahmen.get(word.toLowerCase());
  if (aus) {
    // Groß-/Kleinschreibung des Originals behalten
    let i = 0;
    return aus.map((s) => word.slice(i, (i += s.length)));
  }
  const teile = zerlege(word, lexikon);
  return teile ? teile.flatMap((t) => silbenRegel(t)) : silbenRegel(word);
}

/** Ausnahmen-Datei: je Zeile „Mu|se|um“ (# = Kommentar) */
export function parseAusnahmen(text: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split('|');
    m.set(parts.join('').toLowerCase(), parts);
  }
  return m;
}
