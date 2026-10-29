import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DICT } from '../src/core/dict';
import { checkText, tokenizeWord } from '../src/core/letters';

describe('Wörterbuch', () => {
  it('woerterbuch.json passt zu den Quellen', () => {
    expect(() => execFileSync('node', [resolve(__dirname, '../scripts/build-dict.mjs'), '--check'])).not.toThrow();
  });
  it('Umfang', () => {
    expect(DICT.woerter.length).toBeGreaterThanOrEqual(1400);
    expect(DICT.saetze.length).toBeGreaterThanOrEqual(200);
    expect(DICT.geschichten.length).toBeGreaterThanOrEqual(20);
  });
  it('jede Geschichte hat Titel, Sätze und mindestens 3 Elternfragen', () => {
    for (const g of DICT.geschichten) {
      expect(g.titel).not.toBe('');
      expect(g.saetze.length).toBeGreaterThanOrEqual(6);
      expect(g.fragen.length, g.titel).toBeGreaterThanOrEqual(3);
    }
  });
  it('keine Silbentrennstriche, nur deutsche Buchstaben', () => {
    const texts = [...DICT.woerter.map((e) => e.w), ...DICT.saetze, ...DICT.geschichten.flatMap((g) => [g.titel, ...g.saetze])];
    for (const t of texts) {
      expect(t).not.toMatch(/\p{L}-\p{L}/u);
      for (const w of t.match(/\p{L}+/gu) ?? []) expect(tokenizeWord(w).unknown, `${w} in „${t}“`).toEqual([]);
    }
  });
  it('genug fertige Geschichten schon für die ersten Buchstaben (A5)', () => {
    const passt = (letters: string[]) => {
      const known = new Set(letters);
      return DICT.geschichten.filter(
        (g) => g.saetze.length >= 6 && g.saetze.length <= 8 && [g.titel, ...g.saetze].every((t) => checkText(t, known).ok),
      ).length;
    };
    expect(passt(['t', 'o', 'm', 'l', 'a', 'i', 's'])).toBeGreaterThanOrEqual(8);
    // jede weitere typische Buchstabe bringt mehr Auswahl
    const reihe = ['e', 'n', 'r', 'u'];
    let vorher = passt(['t', 'o', 'm', 'l', 'a', 'i', 's']);
    for (let i = 1; i <= reihe.length; i++) {
      const n = passt(['t', 'o', 'm', 'l', 'a', 'i', 's', ...reihe.slice(0, i)]);
      expect(n).toBeGreaterThan(vorher);
      vorher = n;
    }
  });

  it('Nomen haben Artikel', () => {
    for (const e of DICT.woerter.filter((x) => x.typ === 'Nomen')) expect(['r', 'e', 's', 'pl']).toContain(e.art);
  });
});

describe('Wörterbuch: kindgerecht und lauttreu (Review 29.10.)', () => {
  // keine Schimpfwörter, kein Alkohol, kein Glücksspiel, keine Wörter, die nicht wie im Deutschen gelesen werden
  const VERBOTEN = ['Mist', 'Most', 'Lotto', 'Toast', 'Pizza', 'Pommes', 'Joghurt', 'Popcorn', 'Pony', 'Baby', 'Clown', 'Clowns', 'Teddy', 'Handy', 'Computer', 'Party', 'Puzzle', 'Bonbon', 'Bonbons', 'Garage', 'Orange', 'Jongleur', 'Dompteur', 'Alien', 'jonglieren', 'jongliert', 'Wein', 'Bier', 'Sekt'];
  it('verbotene Wörter fehlen in Wörtern, Sätzen und Geschichten', () => {
    const texte = [...DICT.woerter.map((e) => e.w), ...DICT.saetze, ...DICT.geschichten.flatMap((g) => [g.titel, ...g.saetze, ...g.fragen])];
    for (const t of texte) for (const w of t.match(/\p{L}+/gu) ?? []) expect(VERBOTEN, `„${w}“ in „${t}“`).not.toContain(w);
  });
});
