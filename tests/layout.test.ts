import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';
import { launch, sheetPage, place, pdfPages } from './helpers/browser';
import { renderSheet } from '../src/sheet/render';
import { THEME_IDS } from '../src/sheet/themes';
import { generateSheet, emptyHistory } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { UNIT_IDS } from '../src/core/letters';
import { trimOnce } from '../src/app/fitflow';
import type { SheetData } from '../src/core/types';

let browser: Browser;
let page: Page;
beforeAll(async () => {
  browser = await launch();
  page = await sheetPage(browser);
});
afterAll(async () => browser?.close());

const START = ['t', 'o', 'm', 'l', 'a', 'i', 's'];
const LETTER_SETS: [string, string[]][] = [
  ['T O M L A I S', START],
  ['20 Einheiten', [...START, ...UNIT_IDS.filter((u) => !START.includes(u)).slice(0, 13)]],
  ['alle 43', UNIT_IDS],
];

function sheetFor(letters: string[], minutes: 5 | 10, theme: (typeof THEME_IDS)[number], seed = 5, stufe?: number): SheetData {
  return generateSheet({
    stufe,
    letters,
    newLetter: letters[letters.length - 1],
    minutes,
    theme,
    childName: 'Mia',
    blocks: { ...DEFAULT_BLOCKS, aehnlich: true },
    history: emptyHistory(),
    seed,
  }).sheet;
}

/** Rendert, kürzt notfalls (wie die App) und liefert das passende HTML. */
async function fitted(d: SheetData): Promise<{ html: string; data: SheetData }> {
  let data = d;
  let r = await place(page, renderSheet(data, { displayNumber: 128 }));
  for (let i = 0; i < 40 && !r.fits; i++) {
    const t = trimOnce(data);
    if (!t) break;
    data = t;
    r = await place(page, renderSheet(data, { displayNumber: 128 }));
  }
  expect(r.fits).toBe(true);
  return { html: r.html, data };
}

interface Box { x: number; y: number; w: number; h: number; name: string }

async function boxes(): Promise<{ deco: Box[]; zones: Box[]; slots: Box[]; sheet: Box }> {
  return page.evaluate(() => {
    const sheet = document.querySelector('#host .sheet')!;
    const r = (el: Element, name: string) => {
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, name };
    };
    // Deko: jedes gezeichnete Element im SVG einzeln (so eng wie möglich)
    const deco: { x: number; y: number; w: number; h: number; name: string }[] = [];
    sheet.querySelectorAll('[data-deco]').forEach((d, i) => {
      d.querySelectorAll('circle, path, polygon, rect, ellipse').forEach((s) => deco.push(r(s, `deco${i}`)));
    });
    const zones: { x: number; y: number; w: number; h: number; name: string }[] = [];
    sheet.querySelectorAll('[data-zone]').forEach((z) => zones.push(r(z, (z as HTMLElement).dataset.zone!)));
    // Textzeilen einzeln (z. B. der Name, das leere Datumsfeld)
    sheet.querySelectorAll('.sh-name, .sh-date, .sh-l, .sh-title h1, .sh-pill').forEach((z) => zones.push(r(z, z.className)));
    const slots: { x: number; y: number; w: number; h: number; name: string }[] = [];
    sheet.querySelectorAll('[data-slotzone]').forEach((z) => slots.push(r(z, (z as HTMLElement).dataset.slotzone!)));
    return { deco, zones, slots, sheet: r(sheet, 'sheet') };
  });
}

const inter = (a: Box, b: Box) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const inside = (a: Box, b: Box) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

describe('Deko nie über Text, Name oder Datum', () => {
  for (const theme of THEME_IDS) {
    for (const minutes of [5, 10] as const) {
      for (const [label, letters] of LETTER_SETS) {
        it(`${theme}, ${minutes} Min, ${label}`, async () => {
          const { html } = await fitted(sheetFor(letters, minutes, theme));
          await page.evaluate((h) => (document.getElementById('host')!.innerHTML = h), html);
          const b = await boxes();
          expect(b.deco.length).toBeGreaterThan(0);
          for (const d of b.deco) {
            for (const z of b.zones) expect(inter(d, z), `${d.name} überlappt ${z.name}`).toBe(false);
            expect(b.slots.some((s) => inside(d, s)), `${d.name} außerhalb der Deko-Slots ${JSON.stringify(d)} ${JSON.stringify(b.slots)}`).toBe(true);
            expect(inside(d, b.sheet), `${d.name} außerhalb des Blatts`).toBe(true);
          }
        });
      }
    }
  }
});

describe('Generierte Blätter: genau eine A4-Seite', () => {
  for (const theme of THEME_IDS) {
    for (const minutes of [5, 10] as const) {
      it(`${theme}, ${minutes} Min, alle 43 Einheiten`, async () => {
        const { html } = await fitted(sheetFor(UNIT_IDS, minutes, theme, 9));
        expect(await pdfPages(page, html)).toBe(1);
      });
    }
  }
  for (const [label, letters] of LETTER_SETS) {
    for (const quest of ['male', 'geheimwort'] as const) {
      it(`${label}, 10 Min, Quest ${quest}`, async () => {
        const d = sheetFor(letters, 10, 'zirkus', 3);
        d.quest = quest === 'male' ? { kind: 'male', text: 'Male die Raupe an.' } : { kind: 'geheimwort', text: 'Schreibe die ersten Buchstaben in die Kästchen:', target: 'OMA', words: ['Oma', 'Mais', 'Ast'] };
        const { html } = await fitted(d);
        expect(await pdfPages(page, html)).toBe(1);
      });
    }
  }
});

describe('C3: lange Geschichten bei allen Buchstaben passen ganz aufs Blatt', () => {
  for (const stufe of [5, 8, 10]) {
    for (const seed of [1, 2, 3]) {
      it(`alle 43, Stufe ${stufe}, Seed ${seed}: eine Seite, Geschichte nicht gekürzt`, async () => {
        const d = sheetFor(UNIT_IDS, 5, THEME_IDS[seed % THEME_IDS.length], seed, stufe);
        expect(d.geschichte!.saetze.length).toBeGreaterThanOrEqual(10);
        const { html, data } = await fitted(d);
        expect(data.geschichte!.saetze).toEqual(d.geschichte!.saetze);
        expect(await pdfPages(page, html)).toBe(1);
      });
    }
  }
});

describe('C1: Buchstaben im Kopf immer in einer Zeile', () => {
  /** Zeilen der Buchstabenkreise und ihre Texte */
  async function kopf(letters: string[]): Promise<{ zeilen: number; texte: string[]; neu: string[] }> {
    await page.evaluate((h) => (document.getElementById('host')!.innerHTML = h), renderSheet(sheetFor(letters, 5, 'wiese'), { displayNumber: 3 }));
    return page.evaluate(() => {
      const chips = [...document.querySelectorAll<HTMLElement>('#host .sh-letters .sh-l')];
      return {
        zeilen: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size,
        texte: chips.map((c) => c.textContent!),
        neu: chips.filter((c) => c.classList.contains('neu')).map((c) => c.textContent!),
      };
    });
  }

  it('T O M L A I S: alle Kreise wie bisher', async () => {
    const k = await kopf(START);
    expect(k.zeilen).toBe(1);
    expect(k.texte).toHaveLength(7);
    expect(k.neu).toEqual(['Ss']);
  });

  it('20 Einheiten: „20 Buchstaben“ und der neue Buchstabe', async () => {
    const k = await kopf(LETTER_SETS[1][1]);
    expect(k.zeilen).toBe(1);
    expect(k.texte).toHaveLength(2);
    expect(k.texte[0]).toBe('20 Buchstaben');
    expect(k.neu).toHaveLength(1);
  });

  it('alle 43: „Alle Buchstaben“ und tz', async () => {
    const k = await kopf(UNIT_IDS);
    expect(k.zeilen).toBe(1);
    expect(k.texte).toEqual(['Alle Buchstaben', 'tz']);
    expect(k.neu).toEqual(['tz']);
  });

  it('jede Anzahl in Fibel-Reihenfolge und vom Start aus: nie zwei Zeilen', async () => {
    const vomStart = [...START, ...UNIT_IDS.filter((u) => !START.includes(u))];
    for (const reihe of [UNIT_IDS, vomStart]) {
      for (let n = 1; n <= reihe.length; n++) {
        const k = await kopf(reihe.slice(0, n));
        expect(k.zeilen, `${n} Buchstaben`).toBe(1);
      }
    }
  });
});
