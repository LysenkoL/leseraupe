import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';
import { resolve } from 'node:path';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let base: string;
const errors: string[] = [];

beforeAll(async () => {
  server = await createServer({ root: resolve(__dirname, '..'), server: { port: 0 }, logLevel: 'silent' });
  await server.listen();
  const addr = server.httpServer!.address();
  base = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 5173}/leseraupe/`;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed++;
    };
  });
  await page.clock.install();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('App-Ablauf', () => {
  it('Start zeigt T O M L A I S, neu: S', async () => {
    await page.goto(base);
    await page.waitForSelector('[data-l]');
    const on = await page.$$eval('.lt.on, .lt.neu', (els) => els.map((e) => e.textContent));
    expect(on.sort()).toEqual(['A', 'I', 'L', 'M', 'O', 'S', 'T']);
    expect(await page.textContent('.lt.neu')).toBe('S');
  });

  it('neuer Buchstabe mit einem Tippen, bleibt nach Neustart', async () => {
    await page.click('[data-l="e"]');
    await page.waitForFunction(() => document.querySelector('.lt.neu')?.textContent === 'E');
    await page.reload();
    await page.waitForSelector('.lt.neu');
    expect(await page.textContent('.lt.neu')).toBe('E');
    // zurück zum Ausgangszustand: E entfernen (neu → gelernt → weg), S wieder neu
    const tap = async (id: string, cls: string) => {
      await page.click(`[data-l="${id}"]`);
      await page.waitForFunction(([i, c]) => document.querySelector(`[data-l="${i}"]`)?.className.includes(c), [id, cls]);
    };
    await tap('e', 'lt on');
    await tap('e', 'lt ');
    await tap('s', 'lt ');
    await tap('s', 'lt neu');
    expect(await page.textContent('.lt.neu')).toBe('S');
    expect(await page.$$eval('.lt.on', (e) => e.length)).toBe(6);
  });

  it('Leseblatt erstellen → Vorschau → Drucken vergibt Blatt 1', async () => {
    await page.click('#create');
    await page.waitForSelector('#pv .sheet');
    await page.click('#print');
    await page.waitForFunction(() => (window as unknown as { __printed: number }).__printed === 1);
    expect(await page.$eval('#print-root .sh-perle', (e) => e.textContent)).toBe('1');
    expect(await page.$eval('#print-root .sheet', (e) => e.querySelectorAll('.blk-re').length)).toBe(0);
    expect(await page.textContent('#pv-title')).toContain('Blatt 1');
  });

  it('Neu mischen vergibt keine neue Nummer, erst das nächste Drucken', async () => {
    await page.click('#mix');
    await page.waitForTimeout(300);
    expect(await page.textContent('#pv-title')).toContain('Blatt 2');
    await page.click('#mix');
    await page.waitForTimeout(300);
    expect(await page.textContent('#pv-title')).toContain('Blatt 2');
  });

  it('Timer läuft ab: Toll gelesen!, Blatt wird gelesen', async () => {
    await page.click('#timer');
    await page.waitForSelector('#t-start');
    await page.click('#t-start');
    await page.clock.runFor(5 * 60 * 1000 + 2000);
    await page.waitForSelector('.t-toll');
    expect(await page.textContent('.t-toll')).toBe('Toll gelesen!');
    expect(await page.$$eval('#t-raupe circle[fill="#7FC06D"]', (e) => e.length)).toBe(5);
  });

  it('Verlauf: Zahlen stimmen mit dem Protokoll überein', async () => {
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('.tile');
    const tiles = await page.$$eval('.tile b', (e) => e.map((x) => Number(x.textContent)));
    // Blatt 1 gedruckt, Blatt 2 nur gelesen (Timer)
    expect(tiles).toEqual([2, 1, 1, 5]);
    expect(await page.$$eval('.cal-d.read', (e) => e.length)).toBe(1);
    await page.goto(base + '#/protokoll');
    await page.waitForSelector('.log-row');
    const log = await page.$$eval('.log-row b', (e) => e.map((x) => x.textContent));
    expect(log).toEqual(expect.arrayContaining(['Blatt 1 erstellt', 'Blatt 1 gedruckt', 'Blatt 2 erstellt', 'Blatt 2 gelesen, 5 Min', 'Buchstabe E hinzugefügt']));
  });

  it('gespeichertes Blatt wird genau gleich wieder gedruckt', async () => {
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('.sheet-item');
    const firstPrint = await page.$eval('#print-root', (e) => e.innerHTML);
    await page.click('.sheet-item:last-child');
    await page.waitForSelector('#b-pv .sheet');
    await page.click('#b-print');
    await page.waitForFunction(() => (window as unknown as { __printed: number }).__printed === 2);
    const again = await page.$eval('#print-root', (e) => e.innerHTML);
    expect(again).toBe(firstPrint);
  });

  it('Chat: Antwort einfügen baut ein Blatt und zeigt Entferntes', async () => {
    await page.goto(base + '#/chat');
    await page.waitForSelector('#answer');
    await page.fill(
      '#answer',
      'Gern!\n```json\n{"woerter":["Mama","Tisch"],"kleineWoerter":["im"],"saetze":["Mama malt.","Oma isst Eis."],"geschichte":{"titel":"Im Tal","saetze":["Tim ist im Tal.","Toll, Tim!"]},"fragen":["Wo ist Tim?"]}\n```',
    );
    await page.click('#make');
    await page.waitForSelector('#pv .sheet');
    expect(await page.textContent('#pv-removed')).toContain('Tisch (Sch)');
    await page.goto(base + '#/chat');
    await page.fill('#answer', 'Leider weiß ich das nicht.');
    await page.click('#make');
    expect(await page.textContent('#err')).toBe('Antwort konnte nicht gelesen werden. Bitte die ganze Antwort kopieren.');
  });

  it('keine Fehler in der Konsole', () => {
    expect(errors).toEqual([]);
  });
});
