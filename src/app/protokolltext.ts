import { sprache, t, type Key } from './i18n';

/**
 * Protokolleinträge werden deutsch gespeichert (wie in Sicherungen); für die Anzeige
 * in einer anderen Sprache werden die bekannten Muster übersetzt (B6).
 */
const MUSTER: [RegExp, Key][] = [
  [/^Blatt (?<nr>\d+) erstellt$/, 'log.erstellt'],
  [/^Blatt (?<nr>\d+) gedruckt$/, 'log.gedruckt'],
  [/^Blatt (?<nr>\d+) als PDF gespeichert$/, 'log.pdf'],
  [/^Blatt (?<nr>\d+) gelesen, (?<min>\d+) Min \(von Hand\)$/, 'log.gelesenHand'],
  [/^Blatt (?<nr>\d+) gelesen, (?<min>\d+) Min$/, 'log.gelesen'],
  [/^Buchstabe (?<b>.+) hinzugefügt$/, 'log.buchstabeDazu'],
  [/^Buchstabe (?<b>.+) entfernt$/, 'log.buchstabeWeg'],
  [/^Sicherung geladen$/, 'log.sicherung'],
  [/^Stolperwörter: (?<w>.+)$/, 'log.stolper'],
  [/^Besiegt: (?<w>.+)$/, 'log.besiegt'],
];

export function protokollText(text: string): string {
  if (sprache() === 'de') return text;
  for (const [re, key] of MUSTER) {
    const m = text.match(re);
    if (m) return t(key, m.groups ?? {});
  }
  return text;
}
