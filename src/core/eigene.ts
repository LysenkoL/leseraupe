import { checkText, isAllowed } from './letters';
import { contentIssue } from './content';
import type { History } from './generator';
import { shuffle, type Rng } from './random';

/**
 * Eigene Wörter: Namen aus der Familie, das Haustier, die Straße … – von den Eltern eingetragen.
 * Harte Regel bleibt: ein Wort kommt erst aufs Blatt, wenn alle seine Buchstaben gelernt sind.
 * Wörter kommen in den Wortblock (höchstens EIGENE_PRO_BLATT), Namen außerdem in einen Satz.
 * Gespeichert beim Kind (Einstellungen) – damit auch in der Sicherung.
 */
export interface EigenesWort {
  w: string;
  typ: 'name' | 'wort';
}

export const MAX_EIGENE = 30;
export const EIGENE_PRO_BLATT = 2;
export const EIGENES_MAX_LAENGE = 20;

export type EigenFehler = 'leer' | 'zeichen' | 'lang' | 'inhalt' | 'doppelt' | 'voll';

/** Eingabe prüfen und in Form bringen (Name mit großem Anfangsbuchstaben). */
export function eigenesWortPruefen(roh: string, typ: EigenesWort['typ'], liste: EigenesWort[] = []): EigenesWort | { fehler: EigenFehler } {
  const w0 = roh.normalize('NFC').trim();
  if (!w0) return { fehler: 'leer' };
  // ein Wort, nur Buchstaben – keine Leerzeichen, Ziffern oder Trennstriche
  if (!/^\p{L}+$/u.test(w0)) return { fehler: 'zeichen' };
  if ([...w0].length < 2 || [...w0].length > EIGENES_MAX_LAENGE) return { fehler: 'lang' };
  // nur der Inhaltsfilter; die Aussprache-Ausnahmen gelten nicht (die Eltern wissen, wie der Name klingt)
  if (contentIssue(w0, false)) return { fehler: 'inhalt' };
  const w = typ === 'name' ? w0.charAt(0).toUpperCase() + w0.slice(1) : w0;
  if (liste.some((x) => x.w.toLowerCase() === w.toLowerCase())) return { fehler: 'doppelt' };
  if (liste.length >= MAX_EIGENE) return { fehler: 'voll' };
  return { w, typ };
}

/** Gespeicherte Liste reparieren (Sicherung, alte Versionen): nur gültige, ohne Doppelte, höchstens MAX_EIGENE */
export function sanitizeEigene(raw: unknown): EigenesWort[] {
  if (!Array.isArray(raw)) return [];
  const out: EigenesWort[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const { w, typ } = x as Partial<EigenesWort>;
    if (typeof w !== 'string' || (typ !== 'name' && typ !== 'wort')) continue;
    const r = eigenesWortPruefen(w, typ, out);
    if ('w' in r) out.push(r);
  }
  return out;
}

/** Was mit diesen Buchstaben schon gelesen werden kann */
export function eigeneLesbar(liste: EigenesWort[] | undefined, known: ReadonlySet<string>): EigenesWort[] {
  return (liste ?? []).filter((x) => isAllowed(x.w, known));
}

/** Fehlende Buchstaben in Anzeigeform („B, Ei“); leer = lesbar */
export function eigeneFehlen(w: string, known: ReadonlySet<string>): string[] {
  return checkText(w, known).missing;
}

/**
 * Bis zu EIGENE_PRO_BLATT eigene Wörter für ein Blatt: am längsten nicht dagewesene zuerst,
 * nicht dasselbe wie auf dem letzten Blatt, wenn es andere gibt.
 */
export function eigeneFuersBlatt(lesbar: EigenesWort[], h: History, rng: Rng, n = EIGENE_PRO_BLATT): string[] {
  const zuletzt = (w: string) => h.wordSeq.get(w) ?? -Infinity;
  const sortiert = shuffle(lesbar.map((x) => x.w), rng).sort((a, b) => zuletzt(a) - zuletzt(b));
  // nicht auf zwei Blättern hintereinander: bei nur einem Wort kommt es jedes zweite Mal
  return sortiert.filter((w) => zuletzt(w) < h.seq - 1).slice(0, n);
}
