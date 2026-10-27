import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DICT } from '../src/core/dict';
import { tokenizeWord } from '../src/core/letters';

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
  it('Nomen haben Artikel', () => {
    for (const e of DICT.woerter.filter((x) => x.typ === 'Nomen')) expect(['r', 'e', 's', 'pl']).toContain(e.art);
  });
});
