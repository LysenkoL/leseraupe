import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DICT, silbenVon } from '../src/core/dict';
import { silbenRegel } from '../src/core/silben';
import { lesetext, renderSheet } from '../src/sheet/render';
import { SAMPLE_SHEET } from '../src/core/sample';

const sb = (w: string) => silbenVon(w).join('|');

describe('B3: Silben', () => {
  it('Grundregeln wie in der Grundschule', () => {
    expect(silbenRegel('Mama').join('|')).toBe('Ma|ma');
    expect(silbenRegel('Oma').join('|')).toBe('O|ma');
    expect(silbenRegel('Katze').join('|')).toBe('Kat|ze');
    expect(silbenRegel('Zucker').join('|')).toBe('Zu|cker');
    expect(silbenRegel('Flasche').join('|')).toBe('Fla|sche');
    expect(silbenRegel('Fenster').join('|')).toBe('Fens|ter');
    expect(silbenRegel('Apfel').join('|')).toBe('Ap|fel');
    expect(silbenRegel('Feuer').join('|')).toBe('Feu|er');
    expect(silbenRegel('Zebra').join('|')).toBe('Ze|bra');
    expect(silbenRegel('Pony').join('|')).toBe('Po|ny');
  });

  it('zusammengesetzte Wörter und Ausnahmen aus dem Wörterbuch', () => {
    expect(sb('Schneemann')).toBe('Schnee|mann');
    expect(sb('Kindergarten')).toBe('Kin|der|gar|ten');
    expect(sb('Sternschnuppe')).toBe('Stern|schnup|pe');
    expect(sb('Zitrone')).toBe('Zi|tro|ne');
    expect(sb('Familie')).toBe('Fa|mi|li|e');
    expect(sb('Marienkäfer')).toBe('Ma|ri|en|kä|fer');
    // Schreibung des Blatts bleibt (Satzanfang groß)
    expect(sb('Oma')).toBe('O|ma');
    expect(sb('Ameise')).toBe('A|mei|se');
  });

  it('jedes mehrsilbige Wort im Wörterbuch hat seine Silben, ohne Strich', () => {
    let mehr = 0;
    for (const e of DICT.woerter) {
      const s = silbenVon(e.w);
      expect(s.join(''), e.w).toBe(e.w);
      if (s.length > 1) {
        mehr++;
        expect(e.silben, e.w).toBe(s.join('|'));
      }
      for (const x of s) expect(x).not.toMatch(/-/);
    }
    expect(mehr).toBeGreaterThan(800);
  });

  it('farbig: gleicher Text, keine Striche, jedes Wort beginnt mit der ersten Farbe', () => {
    const html = lesetext('Oma malt Mama.', true);
    expect(html.replace(/<[^>]+>/g, '')).toBe('Oma malt Mama.');
    expect(html).toBe(
      '<span class="sy1">O</span><span class="sy2">ma</span> <span class="sy1">malt</span> <span class="sy1">Ma</span><span class="sy2">ma</span>.',
    );
    expect(lesetext('Oma', false)).toBe('Oma');
  });

  it('Blatt mit Silben farbig: alle Lesetexte gefärbt, Text unverändert', () => {
    const an = renderSheet({ ...SAMPLE_SHEET, silbenFarbig: true }, { displayNumber: 1 });
    const aus = renderSheet(SAMPLE_SHEET, { displayNumber: 1 });
    expect(an).toContain('class="sy2"');
    expect(aus).not.toContain('class="sy');
    const text = (h: string) => h.replace(/<[^>]+>/g, '');
    expect(text(an)).toBe(text(aus));
  });

  it('Farben: kräftig genug auf Weiß und schwarz-weiß gedruckt verschieden grau', () => {
    const css = readFileSync(resolve(__dirname, '../src/styles/sheet.css'), 'utf8');
    const col = (cls: string) => css.match(new RegExp(`\\.sheet \\.${cls}[^{]*\\{ color: (#[0-9A-Fa-f]{6})`))![1];
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = (h: string) => {
      const [r, g, b] = rgb(h).map(lin);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const gray = (h: string) => {
      const [r, g, b] = rgb(h);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const [a, b] = [col('sy1'), col('sy2')];
    for (const c of [a, b]) expect((1.05 / (lum(c) + 0.05))).toBeGreaterThanOrEqual(3);
    expect(Math.abs(gray(a) - gray(b))).toBeGreaterThanOrEqual(40);
  });
});
