import type { Vocab, NounRef } from './vocab';
import { pick, shuffle, type Rng } from './random';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Satzbausteine für Vorlagen. Alles wird am Ende noch einmal per checkText geprüft. */
export interface Pools {
  persons: string[];
  animals: NounRef[];
  foods: NounRef[];
  drinks: NounRef[];
  places: NounRef[];
  things: NounRef[];
  intr: string[];
  adjP: string[];
}

export function pools(v: Vocab, exclude: Set<string> = new Set()): Pools {
  const nouns = (tag: string) => v.tagged(tag).filter((n) => !exclude.has(n.e.w));
  return {
    persons: v.names.filter((n) => !exclude.has(n)),
    animals: v.tagged('tier', true).filter((n) => v.nom(n) !== null),
    foods: nouns('essen').filter((n) => v.food(n) !== null),
    drinks: nouns('trinken'),
    places: nouns('im').concat(nouns('am')).filter((n) => v.ort(n) !== null),
    things: v.tagged('ding', true).filter((n) => v.akk(n) !== null),
    intr: v.verbs('intr'),
    adjP: v.adjs('p'),
  };
}

type Gen = (v: Vocab, p: Pools, rng: Rng) => string | null;

const P = (p: Pools, rng: Rng, not?: string) => pick(p.persons.filter((x) => x !== not), rng);

/** Einzelne Satzvorlagen */
const TEMPLATES: Gen[] = [
  (_v, p, r) => {
    const a = P(p, r), vb = pick(p.intr, r);
    return a && vb ? `${a} ${vb}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), f = pick(p.foods, r);
    return a && f && v.has('isst') ? `${a} isst ${v.food(f)}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), d = pick(p.drinks, r);
    return a && d && v.has('trinkt') ? `${a} trinkt ${d.e.w}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), f = pick(p.foods.concat(p.drinks), r);
    return a && f && v.has('mag') ? `${a} mag ${v.food(f)}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), adj = pick(p.adjP, r);
    if (!a || !adj || !v.has('ist')) return null;
    return v.has('so') && r() < 0.3 ? `${a} ist so ${adj}.` : `${a} ist ${adj}.`;
  },
  (v, p, r) => {
    const a = P(p, r), o = pick(p.places, r);
    return a && o && v.has('ist') ? `${a} ist ${v.ort(o)}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), o = pick(p.places, r);
    if (!a || !o || !v.has('ist')) return null;
    return `${cap(v.ort(o)!)} ist ${a}.`;
  },
  (v, p, r) => {
    const a = P(p, r), b = a && P(p, r, a), vb = pick(v.personVerbs(), r);
    return a && b && vb ? `${a} ${vb} ${b}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), vb = pick(v.dingVerbs(), r), o = pick(p.animals.concat(p.things), r);
    const akk = o && v.akk(o);
    return a && vb && akk ? `${a} ${vb} ${akk}.` : null;
  },
  (v, p, r) => {
    const t = pick(p.animals, r);
    if (!t) return null;
    const vb = pick(v.tierVerbs(t.e.w), r);
    return vb ? `${v.nom(t, true)} ${vb}.` : null;
  },
  (v, p, r) => {
    const t = pick(p.animals, r), adj = pick(p.adjP, r);
    return t && adj && v.has('ist') ? `${v.nom(t, true)} ist ${adj}.` : null;
  },
  (v, p, r) => {
    const f = pick(p.foods.filter((n) => n.art !== 'pl'), r), adj = pick(v.foodAdjs(), r);
    const nom = f && v.nom(f, true);
    return nom && adj && v.has('ist') ? `${nom} ist ${adj}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), c = pick(v.farben(), r);
    return a && c && v.has('malt') ? `${a} malt ${c}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r), o = pick(p.places, r);
    return a && o && v.has('ist') ? `Ist ${a} ${v.ort(o)}?` : null;
  },
  (v, p, r) => {
    const a = P(p, r), f = pick(p.foods, r);
    return a && f && v.has('isst') ? `Isst ${a} ${v.food(f)}?` : null;
  },
  (v, p, r) => {
    const a = P(p, r);
    return a && v.has('wo') && v.has('ist') ? `Wo ist ${a}?` : null;
  },
  (v, p, r) => {
    const a = P(p, r), b = a && P(p, r, a);
    return a && b && v.has('malt') ? `Malt ${a} ${b}?` : null;
  },
  (v, p, r) => {
    const a = P(p, r);
    if (!a) return null;
    const opts = ['Da ist', 'Das ist'].filter((s) => v.has(s));
    const o = pick(opts, r);
    return o ? `${o} ${a}.` : null;
  },
  (v, p, r) => {
    const a = P(p, r);
    return a && v.has('ist') && v.has('da') ? `${a} ist da.` : null;
  },
];

/** Viele Kandidatensätze aus Vorlagen (zufällig, ohne Duplikate). */
export function templateSentences(v: Vocab, p: Pools, rng: Rng, n = 160): string[] {
  const out = new Set<string>();
  if (!p.persons.length && !p.animals.length) return [];
  for (let i = 0; i < n * 4 && out.size < n; i++) {
    const t = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
    const s = t(v, p, rng);
    if (s && v.has(s)) out.add(s);
  }
  return [...out];
}

export interface StoryResult {
  titel: string;
  saetze: string[];
  fragen: string[];
}

/**
 * Geschichte aus Vorlagen: 2–3 Figuren, ein Ort, Essen, Malen.
 * Liefert so viele Sätze wie möglich (bis `count`), alle geprüft.
 */
export function templateStory(v: Vocab, p: Pools, rng: Rng, count: number): StoryResult | null {
  const people = shuffle(p.persons, rng);
  if (people.length < 2) return null;
  const [A, B, C0] = people;
  const C = C0 ?? B;
  const place = pick(p.places, rng);
  const foods = shuffle(p.foods, rng);
  const drink = pick(p.drinks, rng);
  const adj = shuffle(p.adjP, rng);
  const animal = pick(p.animals, rng);
  const intr = shuffle(p.intr, rng);
  const ort = place ? v.ort(place) : null;

  type Line = { s: string | null; q?: string; prio: number };
  const L: Line[] = [];
  const add = (s: string | null, prio: number, q?: string) => L.push({ s, prio, q });

  add(ort && v.has('ist') ? `${A} ist ${ort}.` : null, 10, ort ? `Wo ist ${A}?` : undefined);
  add(ort && v.has('ist') ? (rng() < 0.5 ? `${B} ist ${ort}.` : `${cap(ort)} ist ${B}.`) : null, 9);
  add(foods[0] && v.has('isst') ? `${A} isst ${v.food(foods[0])}.` : null, 8, `Was isst ${A}?`);
  add(foods[1] && v.has('isst') ? `${B} isst ${v.food(foods[1])}.` : null, 8, `Was isst ${B}?`);
  add(drink && v.has('trinkt') ? `${B} trinkt ${drink.e.w}.` : null, 5, `Was trinkt ${B}?`);
  add(intr[0] ? `${A} ${intr[0]}.` : null, 6, `Was macht ${A}?`);
  add(adj[0] && v.has('ist') ? `${B} ist ${adj[0]}.` : null, 5, `Wie ist ${B}?`);
  add(animal && ort && v.has('ist') ? `${v.nom(animal, true)} ist ${ort}.` : null, 4, `Welches Tier ist ${ort}?`);
  add(animal && v.has('malt') ? `${A} malt ${v.akk(animal)}.` : null, 4, `Was malt ${A}?`);
  add(v.has('malt') ? `${C} malt ${A}.` : null, 7, `Wen malt ${C}?`);
  add(C0 && v.has('malt') ? `${C} malt ${B}.` : null, 7);
  add(v.has('mag') ? `${A} mag ${B}.` : null, 3, `Wen mag ${A}?`);
  add(intr[1] ? `${B} ${intr[1]}.` : null, 3, `Was macht ${B}?`);
  add(C0 && adj[1] && v.has('ist') ? `${C} ist ${adj[1]}.` : null, 2);
  add(C0 && foods[2] && v.has('isst') ? `${C} isst ${v.food(foods[2])}.` : null, 2, `Was isst ${C}?`);

  add(adj[2] && v.has('ist') ? `${A} ist ${v.has('so') ? 'so ' : ''}${adj[2]}.` : null, 1, `Wie ist ${A}?`);
  add(C0 && v.has('malt') ? `${A} malt ${C}.` : null, 1, `Wen malt ${A}?`);
  add(foods[3] && v.has('isst') ? `${A} isst ${v.food(foods[3])}.` : null, 1);
  add(C0 && ort && v.has('ist') ? `${C} ist ${ort}.` : null, 1);

  const valid = L.map((l, i) => ({ ...l, i })).filter((l) => l.s && v.has(l.s));
  const ende = [`Toll, ${C}!`, 'Toll, toll!', `Hallo, ${A}!`].filter((s) => v.has(s));
  const room = count - (ende.length ? 1 : 0);
  const chosen = valid
    .slice()
    .sort((a, b) => b.prio - a.prio)
    .slice(0, Math.max(0, room))
    .sort((a, b) => a.i - b.i);
  const saetze = chosen.map((l) => l.s!);
  if (ende.length && saetze.length) saetze.push(ende[0]);
  if (saetze.length < 3) return null;

  let titel: string | null = null;
  if (place && ort && ort.startsWith('im') && v.has(`Im ${place.e.w}`)) titel = `Im ${place.e.w}`;
  else if (v.has(`${A} und ${B}`)) titel = `${A} und ${B}`;
  else titel = A;

  const fragen = chosen.filter((l) => l.q).map((l) => l.q!);
  return { titel, saetze, fragen };
}
