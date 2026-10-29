import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';
import { launch, sheetPage, place, pdfPages } from './helpers/browser';
import { renderSheet } from '../src/sheet/render';
import { SAMPLE_SHEET } from '../src/core/sample';
import { THEME_IDS } from '../src/sheet/themes';
import { renderUrkunde } from '../src/sheet/urkunde';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launch();
  page = await sheetPage(browser);
});
afterAll(async () => browser?.close());

describe('Druck: genau eine A4-Seite', () => {
  for (const theme of THEME_IDS) {
    for (const minutes of [5, 10] as const) {
      it(`Probeblatt ${theme}, ${minutes} Min`, async () => {
        const html = renderSheet({ ...SAMPLE_SHEET, theme, minutes }, { displayNumber: 12 });
        const r = await place(page, html);
        expect(r.fits).toBe(true);
        expect(await pdfPages(page, r.html)).toBe(1);
      });
    }
  }
});

describe('Druck einer Serie (A6): jedes Blatt auf eigener A4-Seite', () => {
  it('3 Blätter → 3 Seiten', async () => {
    const html: string[] = [];
    for (const [i, theme] of (['wiese', 'meer', 'winter'] as const).entries()) {
      const r = await place(page, renderSheet({ ...SAMPLE_SHEET, theme, number: 7 + i }, { displayNumber: 7 + i }));
      expect(r.fits).toBe(true);
      html.push(r.html);
    }
    expect(await pdfPages(page, html.join(''))).toBe(3);
  });
});

describe('Druck mit „Silben farbig“ (B3)', () => {
  for (const theme of THEME_IDS) {
    it(`Probeblatt ${theme}, Silben farbig: eine Seite`, async () => {
      const r = await place(page, renderSheet({ ...SAMPLE_SHEET, theme, silbenFarbig: true }, { displayNumber: 3 }));
      expect(r.fits).toBe(true);
      expect(await pdfPages(page, r.html)).toBe(1);
    });
  }
});

describe('Urkunde (B4): genau eine A4-Seite', () => {
  for (const name of ['Mia', 'Maximilian-Alexander', '']) {
    it(`Urkunde ${name || 'ohne Namen'}`, async () => {
      expect(await pdfPages(page, renderUrkunde({ name, nr: 3, datum: '2026-10-29T10:00:00.000Z', gesamt: 30 }))).toBe(1);
    });
  }
});
