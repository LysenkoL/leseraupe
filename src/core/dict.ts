import data from '../data/woerterbuch.json';

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
}

export const DICT = data as Woerterbuch;

export const ARTIKEL_NOM: Record<Art, string> = { r: 'der', e: 'die', s: 'das', pl: 'die' };
export const ARTIKEL_AKK: Record<Art, string> = { r: 'den', e: 'die', s: 'das', pl: 'die' };
export const ARTIKEL_UNBEST_AKK: Record<Art, string | null> = { r: 'einen', e: 'eine', s: 'ein', pl: null };
