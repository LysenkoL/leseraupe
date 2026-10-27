import { DICT, ARTIKEL_AKK, ARTIKEL_NOM, ARTIKEL_UNBEST_AKK, type Eintrag, type Art } from './dict';
import { isAllowed, countUnit } from './letters';

/** Lebensmittel, die im Singular einen Artikel brauchen („isst einen Apfel“, nicht „isst Apfel“). */
const ZAEHLBAR = new Set([
  'Apfel', 'Birne', 'Banane', 'Tomate', 'Gurke', 'Möhre', 'Kartoffel', 'Erdbeere', 'Kirsche', 'Pflaume', 'Zitrone',
  'Orange', 'Nuss', 'Erbse', 'Bohne', 'Keks', 'Ei', 'Lolli', 'Brezel', 'Waffel', 'Bonbon', 'Brötchen', 'Omelett',
  'Melone', 'Torte', 'Pizza', 'Wurst', 'Rosine', 'Olive', 'Nudel', 'Beere', 'Tomatenbrot', 'Fisch', 'Plätzchen',
]);

/** Verben, die eine Person als Objekt haben können („Oma malt Tim.“) */
const PERSON_VERBEN = ['malt', 'sieht', 'sucht', 'ruft', 'mag', 'holt', 'fragt', 'grüßt', 'besucht', 'liebt', 'lobt', 'tröstet', 'findet', 'hört', 'kitzelt'];
/** Verben mit Ding/Tier als Objekt („Tom malt das Lama.“) */
const DING_VERBEN = ['malt', 'sieht', 'sucht', 'findet', 'mag', 'hat', 'holt'];

/** Tierverben: nur zu passenden Tieren */
const TIER_VERBEN: Record<string, string[]> = {
  bellt: ['Hund'],
  miaut: ['Katze', 'Kater'],
  quakt: ['Ente', 'Frosch'],
  muht: ['Kuh', 'Kalb'],
  wiehert: ['Pferd', 'Pony', 'Fohlen', 'Zebra'],
  summt: ['Biene', 'Hummel', 'Fliege', 'Mücke'],
  brummt: ['Bär', 'Hummel', 'Eisbär'],
  hüpft: ['Hase', 'Frosch', 'Kaninchen', 'Grashüpfer', 'Spatz'],
  schwimmt: ['Fisch', 'Ente', 'Wal', 'Hai', 'Delfin', 'Robbe', 'Qualle', 'Otter', 'Biber', 'Pinguin', 'Schwan', 'Krokodil', 'Walross'],
  fliegt: ['Vogel', 'Biene', 'Eule', 'Taube', 'Rabe', 'Meise', 'Spatz', 'Möwe', 'Falter', 'Schmetterling', 'Fliege', 'Hummel', 'Adler', 'Falke', 'Libelle', 'Storch', 'Drache', 'Papagei', 'Uhu'],
  kriecht: ['Schnecke', 'Raupe', 'Wurm', 'Regenwurm'],
  krabbelt: ['Käfer', 'Ameise', 'Spinne', 'Marienkäfer', 'Krebs', 'Krabbe'],
  klettert: ['Affe', 'Eichhörnchen', 'Spinne', 'Faultier', 'Waschbär'],
  nagt: ['Maus', 'Biber', 'Hamster', 'Kaninchen', 'Eichhörnchen'],
  rennt: ['Hund', 'Pferd', 'Pony', 'Zebra', 'Fuchs', 'Wolf', 'Hase', 'Tiger', 'Löwe', 'Reh', 'Strauß', 'Huhn', 'Katze', 'Elch', 'Hirsch'],
  frisst: ['Hund', 'Katze', 'Maus', 'Lama', 'Kuh', 'Pferd', 'Schaf', 'Ziege', 'Raupe', 'Hase', 'Bär', 'Löwe', 'Tiger', 'Affe', 'Elefant', 'Igel', 'Esel'],
  schläft: ['*'],
};

const FOOD_ADJ = ['lecker', 'süß', 'sauer', 'frisch', 'kalt', 'warm', 'heiß', 'toll', 'super', 'prima', 'salzig'];
const DING_ADJ = ['alt', 'neu', 'groß', 'klein', 'toll', 'schön', 'nass', 'super', 'prima'];
const FARBEN = ['rot', 'blau', 'gelb', 'grün', 'lila', 'bunt', 'rosa', 'braun', 'schwarz'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface NounRef {
  e: Eintrag;
  art: Art;
}

/** Wortschatz, gefiltert auf die gelernten Einheiten. */
export class Vocab {
  readonly known: ReadonlySet<string>;
  readonly ok: (s: string) => boolean;
  readonly names: string[];
  readonly nouns: NounRef[];
  readonly words: Eintrag[];
  readonly kleine: string[];

  constructor(known: ReadonlySet<string>, opts: { exclude?: string[] } = {}) {
    this.known = known;
    const cache = new Map<string, boolean>();
    this.ok = (s: string) => {
      let r = cache.get(s);
      if (r === undefined) {
        r = isAllowed(s, known);
        cache.set(s, r);
      }
      return r;
    };
    const excl = new Set(opts.exclude ?? []);
    this.words = DICT.woerter.filter((e) => !excl.has(e.w) && this.ok(e.w));
    this.names = this.words.filter((e) => e.typ === 'Name').map((e) => e.w);
    this.nouns = this.words.filter((e) => e.typ === 'Nomen' && e.art).map((e) => ({ e, art: e.art! }));
    this.kleine = this.words.filter((e) => e.typ === 'kleines Wort').map((e) => e.w);
  }

  has(word: string): boolean {
    return this.ok(word);
  }

  /** Artikel + Nomen im Nominativ (z. B. „das Lama“) – null, wenn der Artikel nicht lesbar ist */
  nom(n: NounRef, capital = false): string | null {
    const a = ARTIKEL_NOM[n.art];
    if (!this.ok(a)) return null;
    return `${capital ? cap(a) : a} ${n.e.w}`;
  }

  /** Akkusativ mit bestimmtem Artikel */
  akk(n: NounRef): string | null {
    const a = ARTIKEL_AKK[n.art];
    return this.ok(a) ? `${a} ${n.e.w}` : null;
  }

  /** Essen als Objekt von „isst“: unzählbar/Plural ohne Artikel, sonst mit Artikel */
  food(n: NounRef): string | null {
    if (n.art === 'pl' || !ZAEHLBAR.has(n.e.w)) return n.e.w;
    const u = ARTIKEL_UNBEST_AKK[n.art];
    if (u && this.ok(u)) return `${u} ${n.e.w}`;
    return this.akk(n);
  }

  /** „im Tal“, „am See“ */
  ort(n: NounRef): string | null {
    if (n.art !== 'r' && n.art !== 's') return null;
    const p = n.e.tags.includes('im') ? 'im' : n.e.tags.includes('am') ? 'am' : null;
    if (!p || !this.ok(p)) return null;
    return `${p} ${n.e.w}`;
  }

  tagged(tag: string, singular = false): NounRef[] {
    return this.nouns.filter((n) => n.e.tags.includes(tag) && (!singular || n.art !== 'pl'));
  }

  verbs(tag: string): string[] {
    return DICT.verben.filter((v) => v.tags.includes(tag) && this.ok(v.form3)).map((v) => v.form3);
  }

  adjs(tag: string): string[] {
    return DICT.adjektive.filter((a) => a.tags.includes(tag) && this.ok(a.w)).map((a) => a.w);
  }

  personVerbs(): string[] {
    return PERSON_VERBEN.filter((v) => this.ok(v));
  }

  dingVerbs(): string[] {
    return DING_VERBEN.filter((v) => this.ok(v));
  }

  tierVerbs(animal: string): string[] {
    return Object.entries(TIER_VERBEN)
      .filter(([v, list]) => (list.includes(animal) || list.includes('*')) && this.ok(v))
      .map(([v]) => v);
  }

  foodAdjs(): string[] {
    return FOOD_ADJ.filter((a) => this.ok(a));
  }

  dingAdjs(): string[] {
    return DING_ADJ.filter((a) => this.ok(a));
  }

  farben(): string[] {
    return FARBEN.filter((a) => this.ok(a));
  }

  countNew(text: string, unit: string | null): number {
    return unit ? countUnit(text, unit) : 0;
  }
}
