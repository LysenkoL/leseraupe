import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { DEFAULT_SETTINGS } from '../src/core/store';
import { SAMPLE_SHEET } from '../src/core/sample';
import type { SheetData } from '../src/core/types';
import { checkText } from '../src/core/letters';

let server: ViteDevServer, browser: Browser, base: string;
beforeAll(async () => {
  server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
  await server.listen();
  base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/leseraupe/`;
  browser = await chromium.launch();
});
afterAll(async () => { await browser?.close(); await server?.close(); });

const sparse = (): SheetData => ({
  ...structuredClone(SAMPLE_SHEET), number: null, letters: ['l', 's', 'a', 'e', 'i'], newLetter: null,
  childName: '', source: 'chat', silben: ['La', 'Le', 'Li', 'Sa', 'Se', 'Si', 'Al', 'El', 'Il', 'As', 'Es', 'Is'],
  woerter: ['Esel', 'Lisa', 'Ali', 'lila', 'alles'], kleine: ['als', 'es'],
  saetze: ['Lisa las.', 'Ali las.', 'Lisa las alles.', 'Ali las alles.'], geschichte: null, fragen: [], aehnlich: null,
  quest: { kind: 'finde', text: 'Kreise alle Wörter mit L ein.', target: 'l' },
});

async function open(data: SheetData, width = 360, savedId: number | null = null) {
  const page = await browser.newPage({ viewport: { width, height: 1300 } });
  await page.addInitScript(({ data, settings, savedId }) => {
    localStorage.setItem('leseraupe.kinder.v2', JSON.stringify({ activeKindId: 'k1', kinder: [{ id: 'k1', settings }], onboarded: true, sprache: 'de' }));
    localStorage.setItem('leseraupe.draft.k1', JSON.stringify({ items: [{ data, seed: 1, removed: [], savedId, scale: 1 }], idx: 0 }));
  }, { data, savedId, settings: { ...DEFAULT_SETTINGS, letters: data.letters, newLetter: null } });
  await page.goto(base + '#/vorschau');
  await page.waitForSelector('.sheet, #pv [role="alert"]');
  await page.waitForTimeout(300);
  return page;
}

async function state(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>('.sheet')!;
    const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth;
    const foot = sheet.querySelector('.sh-foot')!.getBoundingClientRect();
    const blocks = sheet.querySelector('.sh-blocks')!.getBoundingClientRect();
    return {
      draft: JSON.parse(localStorage.getItem('leseraupe.draft.k1')!).items[0],
      gap: (foot.top - blocks.bottom) / scale,
      font: parseFloat(getComputedStyle(sheet.querySelector('.sh-grid') ?? sheet.querySelector('.sh-lines p')!).fontSize),
      fits: sheet.scrollHeight <= sheet.clientHeight + 1 && sheet.scrollWidth <= sheet.clientWidth + 1 &&
        [...sheet.querySelectorAll('.sh-grid')].every(g => g.scrollHeight <= g.clientHeight + 1 && g.getBoundingClientRect().bottom <= g.parentElement!.getBoundingClientRect().bottom - 2 * scale),
      syllables: [...sheet.querySelectorAll('.g-silben > span')].map(el => el.textContent),
      words: [...sheet.querySelectorAll('.g-woerter > span')].map(el => el.textContent),
      sentences: [...sheet.querySelectorAll('.blk-saetze .sh-lines > p')].map(el => el.textContent),
    };
  });
}

it('L S A E I: echte zusätzliche Silbenzeilen füllen A4 und bleiben bei Neuzeichnen identisch', async () => {
  for (const width of [360, 1100]) {
    const input = sparse();
    const page = await open(input, width);
    const first = await state(page);
    expect(first.gap).toBeLessThan(65);
    expect(first.font).toBeLessThanOrEqual(30);
    // zuerst neue Wörter, dann Silben
    expect(first.words.length).toBeGreaterThan(input.woerter.length);
    expect(first.fits).toBe(true);
    expect(first.draft.data.saetze).toEqual(input.saetze);
    expect(first.draft.data.blocks).toEqual(input.blocks);
    expect(first.syllables).toEqual(first.draft.data.silben);
    await page.click('#pv-silben');
    await page.waitForTimeout(200);
    const next = await state(page);
    expect(next.draft.data.silben).toEqual(first.draft.data.silben);
    expect(next.draft.scale).toBe(first.draft.scale);
    await page.evaluate(() => { window.print = () => {}; });
    await page.click('#print');
    await page.waitForSelector('#print-root .sheet', { state: 'attached' });
    expect(await page.locator('#print-root .g-silben > span').allTextContents()).toEqual(first.syllables);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
    await page.close();
  }
});

it('M A: Wiederholungen füllen echte Zeilen statt leer gestreckter Blöcke', async () => {
  const data = sparse();
  Object.assign(data, { letters: ['m', 'a'], silben: ['Ma', 'Am'], woerter: ['Mama'], kleine: ['am'], saetze: [], practice: true });
  const page = await open(data);
  const result = await state(page);
  expect(result.syllables.length + result.words.length).toBeGreaterThanOrEqual(48);
  // Wiederholungen nie direkt nebeneinander (bei zwei Silben: im Wechsel)
  for (let i = 1; i < result.syllables.length; i++) expect(result.syllables[i]).not.toBe(result.syllables[i - 1]);
  expect(result.gap).toBeLessThan(65);
  expect(result.font).toBeLessThanOrEqual(30);
  expect(result.fits).toBe(true);
  await page.close();
});

it('ohne Silben wiederholen sich nur gewählte Wörter; Sätze und Geschichte bleiben vollständig', async () => {
  const data = sparse();
  data.blocks.silben = false;
  data.geschichte = { titel: 'Lisa las', saetze: ['Lisa las.', 'Ali las.', 'Lisa las alles.'] };
  const page = await open(data);
  const result = await state(page);
  expect(result.syllables).toEqual([]);
  expect(result.words.length).toBeGreaterThan(data.woerter.length);
  expect(result.gap).toBeLessThan(80);
  expect(result.draft.data.saetze).toEqual(data.saetze);
  expect(result.draft.data.geschichte).toEqual(data.geschichte);
  expect(result.fits).toBe(true);
  await page.close();
});

it('gespeicherte Blätter behalten Inhalt und Schriftgröße beim Öffnen', async () => {
  const data = sparse();
  data.number = 7;
  const page = await open(data, 360, 7);
  const result = await state(page);
  expect(result.draft.data).toEqual(data);
  expect(result.draft.scale).toBe(1);
  await page.close();
});

it('eine ausdrückliche Änderung am gespeicherten Blatt wird erneut auf A4 geprüft', async () => {
  const data = sparse();
  data.number = 7;
  const page = await open(data, 360, 7);
  await page.click('.sheet [data-edit="saetze:0"]');
  await page.fill('.modal-input','Lisa las alles. '.repeat(1000));
  await page.click('.modal button[type="submit"]');
  await page.waitForSelector('#pv [role="alert"]');
  expect(await page.locator('#print').isDisabled()).toBe(true);
  await page.close();
});

it('ohne wiederholbare Listen bleibt die Geschichte vollständig und wird nicht vervielfacht', async () => {
  const data = sparse();
  data.blocks = { ...data.blocks, silben: false, woerter: false, kleine: false, saetze: false };
  data.geschichte = { titel: 'Lisa las', saetze: ['Lisa las.', 'Ali las.', 'Lisa las alles.'] };
  const page = await open(data);
  const result = await state(page);
  expect(result.draft.data.geschichte).toEqual(data.geschichte);
  expect(result.syllables).toEqual([]);
  expect(result.words).toEqual([]);
  expect(result.font).toBeLessThanOrEqual(30);
  expect(result.fits).toBe(true);
  await page.close();
});

it('nur gewählte Sätze: zusätzliche Lesezeilen füllen A4, ohne die Geschichte zu wiederholen', async () => {
  const data = sparse();
  data.blocks = { ...data.blocks, silben: false, woerter: false, kleine: false };
  data.geschichte = { titel: 'Lisa las', saetze: ['Lisa las.', 'Ali las.', 'Lisa las alles.'] };
  const page = await open(data);
  const result = await state(page);
  expect(result.sentences.length).toBeGreaterThan(data.saetze.length);
  expect(result.sentences.slice(0, data.saetze.length)).toEqual(data.saetze);
  expect(result.gap).toBeLessThan(65);
  expect(result.draft.data.geschichte).toEqual(data.geschichte);
  expect(result.fits).toBe(true);
  await page.close();
});

it('eine zu lange Geschichte wird weder abgeschnitten noch als druckbares A4 angeboten', async () => {
  const data = sparse();
  data.geschichte = { titel: 'Lisa las', saetze: Array.from({ length: 100 }, () => 'Lisa las alles.') };
  const page = await open(data);
  expect(await page.locator('#pv [role="alert"]').count()).toBe(1);
  expect(await page.locator('#pv [role="alert"]').textContent()).toContain('A4');
  expect(await page.locator('#print').isDisabled()).toBe(true);
  expect(await page.locator('#pdf').isDisabled()).toBe(true);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('leseraupe.draft.k1')!).items[0].data.geschichte);
  expect(retained).toEqual(data.geschichte);
  await page.close();
});

it('freier Platz: alles Ergänzte besteht nur aus gelernten Buchstaben, kurze Sätze stehen in Spalten', async () => {
  const data = sparse();
  Object.assign(data, { letters: ['m', 'l', 's', 'a', 'o', 'i'], woerter: ['Mama', 'Oma', 'Lama'], silben: ['ma', 'la'], kleine: [], saetze: ['Lisa las.', 'Oma las.', 'Ali las.', 'Mia las.'], quest: null });
  const page = await open(data);
  const result = await state(page);
  expect(result.words.length).toBeGreaterThan(3);
  for (const text of [...result.words, ...result.syllables]) expect(checkText(text, new Set(data.letters)).ok, text).toBe(true);
  expect(new Set(result.words.slice(0, 12)).size).toBe(Math.min(12, result.words.length));
  expect(await page.locator('.sheet .blk-saetze .sh-lines.cols-3').count()).toBe(1);
  expect(result.gap).toBeLessThan(65);
  expect(result.fits).toBe(true);
  await page.close();
});

it('lange Sätze bleiben einspaltig, neben einer Geschichte gibt es keine Spalten', async () => {
  const data = sparse();
  data.saetze = ['Lisa las alles und Ali las alles und alle lesen.', 'Lisa las.'];
  const page = await open(data);
  expect(await page.locator('.sheet .blk-saetze .sh-lines').getAttribute('class')).toBe('sh-lines');
  await page.close();
  const mit = sparse();
  mit.geschichte = { titel: 'Lisa las', saetze: ['Lisa las.', 'Ali las.', 'Lisa las alles.'] };
  const seite = await open(mit);
  expect(await seite.locator('.sheet .blk-saetze .sh-lines').getAttribute('class')).toBe('sh-lines');
  await seite.close();
});
