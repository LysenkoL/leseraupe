import data from '../data/woerterbuch.json';
import { parseAusnahmen, silbiere } from './silben';

export type Typ = 'Name' | 'Nomen' | 'Verb' | 'Adjektiv' | 'kleines Wort';
export type Art = 'r' | 'e' | 's' | 'pl';

export interface Eintrag {
  w: string;
  typ: Typ;
  len: number;
  themen: string[];
  tags: string[];
  art?: Art;
  inf?: string;
  /** Silben mit | getrennt (B3), nur bei mehrsilbigen Wörtern */
  silben?: string;
}

export interface Verb {
  inf: string;
  form3: string;
  tags: string[];
}

export interface Adjektiv {
  w: string;
  tags: string[];
}

export interface FertigeGeschichte {
  titel: string;
  saetze: string[];
  fragen: string[];
}

export interface Woerterbuch {
  woerter: Eintrag[];
  verben: Verb[];
  adjektive: Adjektiv[];
  saetze: string[];
  geschichten: FertigeGeschichte[];
  /** Ausnahmen der Silbentrennung (B3), z. B. „Fa|mi|li|e“ */
  silbenAusnahmen: string[];
}

export const DICT = data as Woerterbuch;

let silbenCache: { map: Map<string, string[]>; lexikon: Set<string>; ausnahmen: Map<string, string[]> } | null = null;

/** Silben eines Wortes (B3): aus dem Wörterbuch, sonst nach den Regeln */
export function silbenVon(w: string): string[] {
  if (!silbenCache) {
    const map = new Map<string, string[]>();
    for (const e of DICT.woerter) if (e.silben) map.set(e.w.toLowerCase(), e.silben.split('|'));
    const lexikon = new Set(DICT.woerter.filter((e) => ['Nomen', 'Adjektiv'].includes(e.typ) && e.w.length >= 3).map((e) => e.w.toLowerCase()));
    silbenCache = { map, lexikon, ausnahmen: parseAusnahmen(DICT.silbenAusnahmen.join('\n')) };
  }
  const known = silbenCache.map.get(w.toLowerCase());
  if (known) {
    // Schreibung des Blatts behalten (z. B. großer Satzanfang)
    let i = 0;
    return known.map((s) => w.slice(i, (i += s.length)));
  }
  return silbiere(w, silbenCache.lexikon, silbenCache.ausnahmen);
}

export const ARTIKEL_NOM: Record<Art, string> = { r: 'der', e: 'die', s: 'das', pl: 'die' };
export const ARTIKEL_AKK: Record<Art, string> = { r: 'den', e: 'die', s: 'das', pl: 'die' };
export const ARTIKEL_UNBEST_AKK: Record<Art, string | null> = { r: 'einen', e: 'eine', s: 'ein', pl: null };
