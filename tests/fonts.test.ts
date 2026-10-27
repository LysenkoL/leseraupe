import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
// fontkit hat keine Typen (siehe tests/fontkit.d.ts)
import * as fontkit from 'fontkit';

const ROOT = resolve(__dirname, '..');

describe('Schrift Inter (Schulvariante)', () => {
  for (const w of ['Medium', 'SemiBold', 'ExtraBold']) {
    it(`Inter-${w} hat cv05 (l mit Bogen) und cv11 (einstöckiges a)`, () => {
      const font = fontkit.openSync(resolve(ROOT, 'public/fonts', `Inter-${w}.woff2`));
      expect(font.availableFeatures).toContain('cv05');
      expect(font.availableFeatures).toContain('cv11');
      const names = font.layout('l a I', ['cv05', 'cv11']).glyphs.map((g: { name: string }) => g.name);
      expect(names[0]).not.toBe('l');
      expect(names[2]).not.toBe('a');
      expect(names[4]).toBe('I');
    });
  }

  it('CSS setzt cv05 und cv11 und lädt nur lokale Schriften', () => {
    const fonts = readFileSync(resolve(ROOT, 'src/styles/fonts.css'), 'utf8');
    expect(fonts).toMatch(/'cv05' 1, 'cv11' 1/);
    const sheet = readFileSync(resolve(ROOT, 'src/styles/sheet.css'), 'utf8');
    expect(sheet).toMatch(/font-feature-settings: var\(--font-features\)/);
  });

  it('nirgends Google Fonts', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|css|html)$/.test(f)) files.push(p);
      }
    };
    walk(resolve(ROOT, 'src'));
    files.push(resolve(ROOT, 'index.html'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });
});
