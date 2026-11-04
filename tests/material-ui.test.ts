import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { DEFAULT_SETTINGS } from '../src/core/store';
import { SAMPLE_SHEET } from '../src/core/sample';
import { UNIT_IDS } from '../src/core/letters';

let server: ViteDevServer, browser: Browser, base: string;
beforeAll(async () => {
  server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
  await server.listen();
  const address = server.httpServer!.address() as { port: number };
  base = `http://127.0.0.1:${address.port}/leseraupe/`;
  browser = await chromium.launch();
});
afterAll(async () => { await browser?.close(); await server?.close(); });
async function open(letters: string[]) {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.addInitScript((settings) => {
    localStorage.setItem('leseraupe.kinder.v2', JSON.stringify({ activeKindId: 'k1', kinder: [{ id: 'k1', settings }], onboarded: true, sprache: 'de' }));
  }, { ...DEFAULT_SETTINGS, letters, newLetter: null });
  await page.goto(base);
  await page.waitForSelector('#create');
  return page;
}
it('A und zwei Konsonanten erlauben kein leeres Blatt', async () => {
  for (const letters of [['a'], ['m', 't']]) {
    const page = await open(letters);
    expect(await page.locator('#create').isDisabled()).toBe(true);
    expect(await page.locator('#material-hint').textContent()).toContain('noch keine Leseübung');
    await page.close();
  }
});
it('M und A reichen nicht: kein Blatt, die Plakette nennt den nächsten Buchstaben', async () => {
  const page = await open(['m', 'a']);
  expect(await page.locator('#create').isDisabled()).toBe(true);
  expect(await page.locator('#material-hint').textContent()).toContain('keine Leseübung');
  await page.waitForSelector('#letter-tipp:not([hidden])');
  expect(await page.locator('#letter-tipp').textContent()).toContain('Noch 1 Buchstabe');
  await page.close();
});

it('M, A und L erzeugen ein ganzes A4-Blatt ohne Geschichte und ohne Überlauf', async () => {
  const page = await open(['m', 'a', 'l']);
  expect(await page.locator('#material-hint').textContent()).toContain('Silben');
  expect(await page.locator('input[data-block="kleine"]').count()).toBe(0);
  // gewählte Blöcke, die fehlen, stehen in der Plakette
  await page.waitForSelector('#letter-tipp:not([hidden])');
  expect(await page.locator('#letter-tipp').textContent()).toMatch(/Sätze/);
  const letters = await page.locator('[data-l]').evaluateAll(els => els.slice(0, 5).map(el => (el as HTMLElement).dataset.l));
  expect(letters).toEqual(['a','b','c','d','e']);
  await page.click('#create');
  await page.waitForSelector('.sheet.beginner .sh-grid');
  await page.waitForTimeout(500);
  expect(await page.locator('.sheet [data-block="geschichte"]').count()).toBe(0);
  expect(await page.locator('.sheet [data-block="quest"]').count()).toBe(1);
  const fits = await page.locator('.sheet').evaluate(el => el.scrollHeight <= el.clientHeight + 1 && [...el.querySelectorAll('.sh-grid')].every(grid => grid.scrollHeight <= grid.clientHeight + 1 && grid.getBoundingClientRect().bottom <= grid.parentElement!.getBoundingClientRect().bottom - 2));
  expect(fits).toBe(true);
  expect(await page.locator('.sheet .sh-grid span').count()).toBeGreaterThanOrEqual(48);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  await page.close();
});
it('старый пустой лист с одним Quest не открывает поздравление', async () => {
  const page = await open(['a']);
  await page.evaluate((sample) => {
    const data = { ...sample, letters: ['a'], silben: [], woerter: [], kleine: [], saetze: [], geschichte: null, fragen: [], aehnlich: null, quest: {kind:'male', text:'Male die Raupe an.'} };
    localStorage.setItem('leseraupe.draft.k1', JSON.stringify({ items: [{ data, seed: 1, removed: [], savedId: null, scale: 1 }], idx: 0 }));
  }, SAMPLE_SHEET);
  await page.goto(base + '#/lesen');
  await page.waitForTimeout(500);
  expect(await page.locator('.rd-end').count()).toBe(0);
  expect(await page.locator('.lesen').count()).toBe(0);
  await page.close();
});
it('Antwort mit Markdown-Escapes wird über die Oberfläche zum Blatt', async () => {
  const page = await open(['m','a','l']);
  await page.goto(base + '#/chat');
  await page.locator('#answer').fill(String.raw`{"woerter": \["Mama"\], "kleinewoerter": \["am"\]}`);
  await page.click('#make');
  await page.waitForSelector('.sheet');
  expect(await page.locator('.sheet').textContent()).toContain('Mama');
  await page.close();
});

it('неполный ответ ИИ не обвиняет набор букв и не раздувает шрифт', async () => {
  const page = await open(['l','s','d','a','i','o','ü','h','r','t','k','c']);
  await page.goto(base + '#/chat');
  await page.locator('#answer').fill(JSON.stringify({woerter:['Hals','Halt','Haar','Haus'],saetze:['Das Haus ist hoch.'],geschichte:{titel:'Das Haus',saetze:['Das Haus ist hoch.']}}));
  await page.click('#make');
  await page.waitForSelector('.sheet');
  await page.waitForFunction(() => !!document.querySelector('#pv-fehlt')?.textContent);
  expect(await page.locator('#pv-fehlt').textContent()).toContain('Geschichte');
  await page.screenshot({ path: 'test-results/chat-filtered.png', fullPage: true });
  expect(await page.locator('#pv-fehlt').textContent()).not.toContain('reichen die Buchstaben');
  expect(await page.locator('.sheet [data-block="saetze"]').count()).toBe(1);
  await page.close();
});

it('буквы разделены на алфавит, умлауты и сочетания с единым регистром', async () => {
  const page = await open(['m','a']);
  const expected = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','r','s','t','u','v','w','x','y','z', 'ä','ö','ü','ß', 'au','äu','ch','ck','ei','eu','ie','ng','pf','qu','sch','sp','st','tz'];
  expect(await page.locator('[data-l]').evaluateAll(els => els.map(el => (el as HTMLElement).dataset.l))).toEqual(expected);
  expect(await page.locator('.letter-group-title').allTextContents()).toEqual(['Umlaute und ß', 'Buchstabenverbindungen']);
  for (const id of expected) {
    expect(await page.locator(`[data-l="${id}"]`).textContent()).toBe(id === 'ß' || id.length > 1 ? id : id.toUpperCase());
  }
  const rowStart = await page.locator('.letters').evaluate(grid => {
    const first = grid.querySelector('[data-l="a"]')!.getBoundingClientRect();
    return ['ä', 'au'].every(id => Math.abs(grid.querySelector(`[data-l="${id}"]`)!.getBoundingClientRect().left - first.left) < 1);
  });
  expect(rowStart).toBe(true);
  await page.click('[data-l="ie"]');
  expect(await page.locator('[data-l="ie"]').getAttribute('class')).toContain('neu');
  expect(await page.locator('[data-l="a"]').getAttribute('class')).toContain('on');
  await page.screenshot({ path: 'test-results/letters-groups.png', fullPage: true });
  await page.close();
});

it('лист L S A I из ответа ИИ — упражнения, без Aas/Ass и пустого блока als', async () => {
  const page = await open(['l','s','a','i']);
  expect(await page.locator('#material-hint').textContent()).not.toContain('nur Silben');
  await page.goto(base + '#/chat');
  const prompt = await page.locator('.prompt').textContent();
  expect(prompt).toContain('Die Zahlen sind Obergrenzen');
  expect(prompt).not.toContain('kleineWoerter');
  await page.locator('#answer').fill(JSON.stringify({woerter:['lila','Lisa','Ali','Aas','Ass','Lissi','Lilli'],kleineWoerter:['als'],saetze:[],geschichte:{titel:'',saetze:[]},fragen:[]}));
  await page.click('#make');
  await page.waitForSelector('.sheet');
  await page.waitForTimeout(500);
  expect(await page.locator('.sheet [data-block="kleine"]').count()).toBe(0);
  expect(await page.locator('.sheet .q-secret').count()).toBe(0);
  const words = await page.locator('.sheet .g-woerter > span').allTextContents();
  expect(words.map(w=>w.toLowerCase())).not.toContain('aas');
  expect(words.map(w=>w.toLowerCase())).not.toContain('ass');
  expect(new Set(words.filter(w=>['Lisa','Ali','Lissi','Lilli'].includes(w))).size).toBeLessThanOrEqual(2);
  expect(await page.locator('.sheet [data-block="saetze"]').textContent()).toContain('Lisa las.');
  const bounds = await page.locator('.sheet').evaluate(el => [...el.querySelectorAll('.sh-grid')].every(grid => grid.scrollHeight <= grid.clientHeight + 1 && grid.getBoundingClientRect().bottom <= grid.parentElement!.getBoundingClientRect().bottom - 2));
  expect(bounds).toBe(true);
  await page.screenshot({path:'test-results/chat-practice.png',fullPage:true});
  await page.setViewportSize({width:1000,height:1300});
  await page.locator('.sheet').screenshot({path:'test-results/chat-practice-sheet.png'});
  const pdf = await page.pdf({format:'A4',printBackground:true});
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  await page.close();
});

it('L S A E I: подсказка, запрос и лист одинаково разрешают предложения', async () => {
  const page = await open(['l','s','a','e','i']);
  expect(await page.locator('#material-hint').textContent()).toContain('Sätze');
  expect(await page.locator('input[data-block="saetze"]').isEnabled()).toBe(true);
  expect(await page.locator('input[data-block="saetze"]').isChecked()).toBe(true);
  await page.goto(base + '#/chat');
  expect((await page.locator('.prompt').textContent())!).toContain('Bekannte Buchstaben: L, S, A, E, I'.split(':')[0]);
  await page.locator('#answer').fill(JSON.stringify({woerter:['Esel','Lisa','Eis'],saetze:[],geschichte:{titel:'',saetze:[]},fragen:[]}));
  await page.click('#make');
  await page.waitForSelector('.sheet [data-block="saetze"]');
  await page.waitForTimeout(500);
  // Fehlende Sätze kommen still dazu, ohne Hinweis auf die Herkunft
  expect(await page.locator('.sheet [data-block="saetze"] p').count()).toBeGreaterThanOrEqual(2);
  expect(await page.locator('.sheet').textContent()).not.toContain('Eis');
  expect(await page.locator('.screen').textContent()).not.toMatch(/lokal|Entfernt/i);
  const fill = await page.locator('.sheet').evaluate(el => {
    const scale = el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth;
    return {
      gap: (el.querySelector('.sh-foot')!.getBoundingClientRect().top - el.querySelector('.sh-blocks')!.getBoundingClientRect().bottom) / scale,
      font: parseFloat(getComputedStyle(el.querySelector('.g-silben')!).fontSize),
      syllables: el.querySelectorAll('.g-silben > span').length,
      fits: el.scrollHeight <= el.clientHeight + 1,
    };
  });
  expect(fill.gap).toBeLessThan(65);
  expect(fill.font).toBeLessThanOrEqual(30);
  expect(fill.fits).toBe(true);
  await page.screenshot({path:'test-results/material-five-letters.png',fullPage:true});
  await page.setViewportSize({width:1000,height:1300});
  await page.locator('.sheet').screenshot({path:'test-results/material-five-sheet.png'});
  const pdf = await page.pdf({format:'A4',printBackground:true});
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  await page.close();
});

it('цензура не печатает ругательство в предупреждении и действует при ручной правке', async () => {
  const page = await open(UNIT_IDS);
  await page.goto(base + '#/chat');
  await page.locator('#answer').fill(JSON.stringify({woerter:['Mama','Scheiße','Toast','Budget','Chance','Mist'],saetze:['Mama malt.']}));
  await page.click('#make');
  await page.waitForSelector('.sheet [data-edit="woerter:0"]');
  const text = await page.locator('.screen').textContent();
  expect(text).not.toMatch(/Scheiße|\bToast\b|\bBudget\b|\bChance\b|\bMist\b/i);
  await page.click('.sheet [data-edit="woerter:0"]');
  await page.locator('.modal-input').fill('Toast');
  await page.click('.modal button[type="submit"]');
  expect(await page.locator('.modal-err').textContent()).toContain('Aussprache');
  await page.locator('.modal-input').fill('Idiot');
  await page.click('.modal button[type="submit"]');
  expect(await page.locator('.modal-err').textContent()).toContain('Inhaltsfilter');
  await page.click('[data-x="cancel"]');
  expect(await page.locator('.sheet').textContent()).not.toContain('Idiot');
  await page.close();
});

it('Tastatur: nach Enter bleibt der Fokus auf derselben Buchstabe', async () => {
  const page = await open(['m','a']);
  await page.focus('[data-l="n"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-l="n"]')?.className.includes('neu'));
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.l)).toBe('n');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.l)).toBe('n');
  await page.close();
});

it('Das Blatt ist als Deutsch markiert, auch bei ukrainischer Oberfläche', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.addInitScript((settings) => {
    localStorage.setItem('leseraupe.kinder.v2', JSON.stringify({ activeKindId: 'k1', kinder: [{ id: 'k1', settings }], onboarded: true, sprache: 'uk' }));
  }, { ...DEFAULT_SETTINGS, letters: ['m','a','l','o','t','i','s'], newLetter: null });
  await page.goto(base);
  await page.waitForSelector('#create');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('uk');
  await page.click('#create');
  await page.waitForSelector('.sheet');
  expect(await page.locator('.sheet').getAttribute('lang')).toBe('de');
  await page.close();
});

it('KI-Seite: Prompt lässt sich immer kopieren, das Antwortfeld gibt es nur, wenn es benutzt wird', async () => {
  const leer = await open(['a']);
  await leer.goto(base + '#/chat');
  await leer.waitForSelector('#copy');
  expect(await leer.locator('#answer').count()).toBe(0);
  expect(await leer.locator('#make').isDisabled()).toBe(true);
  await leer.close();

  const nurSilben = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await nurSilben.addInitScript((settings) => {
    localStorage.setItem('leseraupe.kinder.v2', JSON.stringify({ activeKindId: 'k1', kinder: [{ id: 'k1', settings }], onboarded: true, sprache: 'de' }));
  }, { ...DEFAULT_SETTINGS, letters: ['m','a','l'], newLetter: null, blocks: { ...DEFAULT_SETTINGS.blocks, woerter: false, saetze: false, geschichte: false, fragen: false } });
  await nurSilben.goto(base + '#/chat');
  await nurSilben.waitForSelector('#copy');
  expect(await nurSilben.locator('#answer').count()).toBe(0);
  await nurSilben.click('#make');
  await nurSilben.waitForSelector('.sheet .g-silben');
  await nurSilben.close();

  const normal = await open(['m','a','l']);
  await normal.goto(base + '#/chat');
  await normal.waitForSelector('#answer');
  await normal.close();
});
