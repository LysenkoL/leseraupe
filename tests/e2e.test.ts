import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';
import { resolve } from 'node:path';
import { SAMPLE_SHEET } from '../src/core/sample';

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
  it('Neuinstallation: zuerst die Einführung, 4 Schritte bis „Los geht’s“', async () => {
    await page.goto(base);
    await page.waitForSelector('.onb');
    expect(await page.textContent('.onb h1')).toContain('Willkommen');
    expect(await page.$('#onb-skip')).not.toBeNull();
    await page.click('#onb-next');
    await page.waitForFunction(() => document.querySelector('.onb h1')?.textContent?.includes('wächst'));
    await page.click('#onb-next');
    await page.waitForSelector('.onb .letters [data-l="s"]');
    expect(await page.textContent('.onb .lt.neu')).toBe('S');
    await page.click('#onb-next');
    await page.waitForSelector('#onb-name');
    expect(await page.$('#onb-skip')).toBeNull();
    await page.click('#onb-next');
    await page.waitForSelector('#create');
    expect(await page.$('.onb')).toBeNull();
  });

  it('nächster Start: sofort die Startseite; Einführung wieder aus „Über die App“', async () => {
    await page.reload();
    await page.waitForSelector('#create');
    expect(await page.$('.onb')).toBeNull();
    await page.goto(base + '#/einstellungen');
    await page.click('a[href="#/ueber"]');
    await page.click('a[href^="#/willkommen"]');
    await page.waitForSelector('.onb');
    await page.click('#onb-skip');
    await page.waitForFunction(() => location.hash === '#/ueber');
  });

  it('Über die App: Datenschutz, Kontakt, Feedback mit Version', async () => {
    await page.waitForSelector('#datenschutz');
    expect(await page.textContent('#datenschutz')).toContain('nur auf diesem Gerät');
    const href = (await page.getAttribute('#feedback', 'href'))!;
    const u = new URL(href);
    expect(u.protocol).toBe('mailto:');
    expect(u.pathname).toBe('apps.by.lena@gmail.com');
    expect(u.searchParams.get('subject')).toBe('Leseraupe Feedback');
    expect(u.searchParams.get('body')).toMatch(/Version: \d+\.\d+\.\d+ \(/);
  });

  it('Start zeigt T O M L A I S, neu: S', async () => {
    await page.goto(base);
    await page.waitForSelector('[data-l]');
    const on = await page.$$eval('.lt.on, .lt.neu', (els) => els.map((e) => e.textContent));
    expect(on.sort()).toEqual(['A', 'I', 'L', 'M', 'O', 'S', 'T']);
    expect(await page.textContent('.lt.neu')).toBe('S');
  });

  it('Name des Kindes ist zuerst leer und wird einmal eingegeben', async () => {
    await page.waitForSelector('#child-name');
    expect(await page.inputValue('#child-name')).toBe('');
    await page.fill('#child-name', 'Mia');
    await page.click('#name-form button');
    await page.waitForFunction(() => !document.querySelector('#child-name'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('leseraupe.kinder.v2')!).kinder[0].settings.childName);
    expect(saved).toBe('Mia');
  });

  it('Installieren-Knopf erscheint mit beforeinstallprompt und ruft prompt() auf', async () => {
    expect(await page.$('#install')).toBeNull();
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      e.prompt = async () => {
        (window as unknown as { __prompted: boolean }).__prompted = true;
      };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    await page.waitForSelector('#install');
    await page.click('#install');
    await page.waitForFunction(() => (window as unknown as { __prompted: boolean }).__prompted === true);
    await page.waitForFunction(() => !document.querySelector('#install'));
  });

  it('Installieren-Hinweis ist schmal und lässt sich mit ✕ dauerhaft ausblenden', async () => {
    const fire = () =>
      page.evaluate(() => {
        const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
        e.prompt = async () => undefined;
        e.userChoice = Promise.resolve({ outcome: 'dismissed' });
        window.dispatchEvent(e);
      });
    await fire();
    await page.waitForSelector('.install-strip #install-x');
    await page.click('#install-x');
    await page.waitForFunction(() => !document.querySelector('.install-strip'));
    await page.reload();
    await page.waitForSelector('[data-l]');
    await fire();
    await page.waitForTimeout(200);
    expect(await page.$('.install-strip')).toBeNull();
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
    expect(await page.$eval('#print-root .sh-name', (e) => e.textContent)).toBe('Mia');
    expect(await page.$eval('#print-root .sheet', (e) => e.querySelectorAll('.blk-re').length)).toBe(0);
    expect(await page.textContent('#pv-title')).toContain('Blatt 1');
  });

  it('Als PDF teilen: eine A4-Seite, sieht aus wie das Blatt', async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __pdf?: number[]; __pdfName?: string };
      (navigator as Navigator & { canShare: () => boolean }).canShare = () => true;
      navigator.share = async (d?: ShareData) => {
        w.__pdf = Array.from(new Uint8Array(await d!.files![0].arrayBuffer()));
        w.__pdfName = d!.files![0].name;
      };
    });
    await page.click('#pdf');
    await page.waitForFunction(() => (window as unknown as { __pdf?: number[] }).__pdf);
    const { bytes, name } = await page.evaluate(() => {
      const w = window as unknown as { __pdf: number[]; __pdfName: string };
      return { bytes: w.__pdf, name: w.__pdfName };
    });
    expect(name).toBe('Leseblatt-1.pdf');
    const pdf = Buffer.from(bytes);
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
    // Bild im PDF mit der Vorschau vergleichen (beide klein gerechnet, Grauwerte)
    const jpeg = pdf.subarray(pdf.indexOf(Buffer.from([0xff, 0xd8])), pdf.lastIndexOf(Buffer.from([0xff, 0xd9])) + 2);
    // dasselbe Blatt in echter Größe ohne Bedien-Knöpfe – so, wie es gedruckt wird
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'cmp-host';
      // 3-fach wie im PDF: sonst wirkt der Text durch Kantenglättung fetter
      host.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;background:#fff;zoom:3';
      const sheet = document.querySelector('#pv .sheet')!.cloneNode(true) as HTMLElement;
      sheet.querySelectorAll('.blk-re').forEach((e) => e.remove());
      host.appendChild(sheet);
      document.body.appendChild(host);
    });
    const shot = await (await page.$('#cmp-host .sheet'))!.screenshot();
    await page.evaluate(() => document.getElementById('cmp-host')!.remove());
    const diff = await page.evaluate(
      async ([a, b]) => {
        const W = 76, H = 110;
        const gray = async (src: string) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, W, H);
          const d = ctx.getImageData(0, 0, W, H).data;
          return Array.from({ length: W * H }, (_, i) => (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3);
        };
        const [x, y] = await Promise.all([gray(a), gray(b)]);
        const mean = (f: (v: number, i: number) => number) => x.reduce((s, v, i) => s + f(v, i), 0) / x.length;
        // zum Vergleich: Abstand zu einer leeren weißen Seite
        return { diff: mean((v, i) => Math.abs(v - y[i])), blank: mean((v) => 255 - v) };
      },
      [`data:image/jpeg;base64,${jpeg.toString('base64')}`, `data:image/png;base64,${shot.toString('base64')}`] as const,
    );
    expect(diff.diff).toBeLessThan(diff.blank / 4);
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
    expect(await page.$$eval('#t-raupe circle.voll', (e) => e.length)).toBe(5);
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
    expect(log).toEqual(expect.arrayContaining(['Blatt 1 erstellt', 'Blatt 1 zum Drucken geschickt', 'Blatt 2 erstellt', 'Blatt 2 gelesen, 5 Min', 'Buchstabe E hinzugefügt']));
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

  it('Am Bildschirm lesen: Block für Block, Zeit läuft, Blatt wird gelesen', async () => {
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('.sheet-item');
    const href = (await page.$$eval('.sheet-item', (e) => e.map((a) => a.getAttribute('href'))))
      .find((h) => h!.endsWith('/1'))!;
    const id = href.split('/').pop();
    await page.goto(base + href);
    await page.click(`a[href="#/lesen?id=${id}"]`);
    await page.waitForSelector('#rd-body h1');
    expect(await page.textContent('#rd-body h1')).toBe('Silben');
    const total = Number((await page.textContent('#rd-pos'))!.split('/')[1]);
    expect(total).toBeGreaterThanOrEqual(5);
    // die Zeit läuft ab dem Öffnen
    expect(await page.getAttribute('#rd-clock', 'aria-label')).toBe('Lesezeit anhalten');
    await page.click('#rd-next');
    expect(await page.textContent('#rd-pos')).toBe(`2 / ${total}`);
    await page.click('#rd-prev');
    expect(await page.textContent('#rd-pos')).toBe(`1 / ${total}`);
    // Wörter auf Karten, nicht als Fließtext
    await page.click('#rd-next');
    expect(await page.$$eval('#rd-body .rd-card', (e) => e.length)).toBeGreaterThan(3);
    await page.click('#rd-prev');
    // ✕ während die Zeit läuft: erst nachfragen
    await page.click('#rd-close');
    await page.waitForSelector('.modal-bg');
    await page.click('.modal-bg [data-x="no"]');
    expect(await page.$('#rd-body')).not.toBeNull();
    await page.clock.runFor(2 * 60 * 1000);
    for (let i = 1; i < total; i++) {
      await page.click('#rd-next');
      // Sätze: jeder Satz in einer Zeile (wenn es mit Mindestschrift geht)
      const umbruch = await page.$$eval('#rd-body .rd-lines p', (ps) => ps.filter((p) => p.style.whiteSpace === 'nowrap' && p.scrollWidth > p.clientWidth + 1).length);
      expect(umbruch).toBe(0);
    }
    expect(await page.textContent('#rd-next')).toBe('Fertig ✓');
    expect(await page.textContent('#rd-body h1')).toContain('Für Eltern');
    // letzte Seite: Zeit hält an
    expect(await page.getAttribute('#rd-clock', 'aria-label')).toBe('Lesezeit starten');
    const t1 = await page.textContent('#rd-time');
    await page.clock.runFor(30 * 1000);
    expect(await page.textContent('#rd-time')).toBe(t1);
    // „Fertig ✓“ speichert die Lesung mit der echten Zeit (≈ 2 Min)
    await page.click('#rd-next');
    // danach freiwillig: „Wie ging das Lesen heute?“ und Stolperwörter
    await page.waitForSelector('[data-g="schwer"]');
    await page.click('[data-g="schwer"]');
    await page.waitForFunction(() => document.querySelector('[data-g="schwer"]')?.getAttribute('aria-pressed') === 'true');
    await page.waitForSelector('#st-skip');
    await page.click('#st-skip');
    await page.waitForSelector('#b-s');
    await page.waitForFunction(() => document.querySelector('#b-s')?.textContent?.includes('gelesen'));
  });

  it('Quest am Bildschirm: „Finde!“ – Wörter mit der Buchstabe antippen', async () => {
    // als Text, damit der Test-Runner das import() nicht umschreibt
    const html: string = await page.evaluate(`(async () => {
      const m = await import('/leseraupe/src/screens/questspiel.ts');
      const sample = (await import('/leseraupe/src/core/sample.ts')).SAMPLE_SHEET;
      const d = { ...sample, quest: { kind: 'finde', text: 'Kreise …', target: 's' } };
      const host = document.createElement('div');
      host.id = 'qs-test';
      host.innerHTML = m.questSpielHtml(d.quest, d);
      document.body.appendChild(host);
      m.questSpielAktiv(host);
      return host.innerHTML;
    })()`);
    expect(html).toContain('S / s');
    const ja = await page.$$('#qs-test .qs-w[data-ja="1"]');
    const nein = await page.$$('#qs-test .qs-w[data-ja="0"]');
    expect(ja.length).toBeGreaterThan(0);
    expect(nein.length).toBeGreaterThan(0);
    await nein[0].click();
    expect(await nein[0].getAttribute('class')).not.toContain('ok');
    for (const b of ja) await b.click();
    expect(await page.isVisible('#qs-test .qs-done')).toBe(true);
    await page.evaluate(() => document.getElementById('qs-test')!.remove());
  });

  it('Quest am Bildschirm: Geheimwort mit Buchstaben-Tasten', async () => {
    await page.evaluate(`(async () => {
      const m = await import('/leseraupe/src/screens/questspiel.ts');
      const sample = (await import('/leseraupe/src/core/sample.ts')).SAMPLE_SHEET;
      const d = { ...sample, quest: { kind: 'geheimwort', text: 'Schreibe …', target: 'OMA', words: ['Oma', 'Mais', 'Ast'] } };
      const host = document.createElement('div');
      host.id = 'qs-test';
      host.innerHTML = m.questSpielHtml(d.quest, d);
      document.body.appendChild(host);
      m.questSpielAktiv(host);
    })()`);
    expect(await page.$$eval('#qs-test .qs-box', (e) => e.length)).toBe(3);
    for (const k of ['O', 'M', 'A']) await page.click(`#qs-test .qs-key[data-k="${k}"]`);
    expect(await page.$$eval('#qs-test .qs-box.ok', (e) => e.map((x) => x.textContent).join(''))).toBe('OMA');
    expect(await page.isVisible('#qs-test .qs-done')).toBe(true);
    await page.evaluate(() => document.getElementById('qs-test')!.remove());
  });

  it('Quest am Bildschirm: Wort in der Geschichte antippen, Stand bleibt beim Zurückblättern', async () => {
    const run = (stand: string) => `(async () => {
      const m = await import('/leseraupe/src/screens/questspiel.ts');
      const sample = (await import('/leseraupe/src/core/sample.ts')).SAMPLE_SHEET;
      const d = { ...sample, geschichte: { titel: 'T', saetze: ['Ali ist da.', 'Alis Lolli ist toll.', 'Mimi isst Alis Lolli.'] }, quest: { kind: 'zaehle', text: 'Wie oft …', target: 'Alis' } };
      document.getElementById('qs-test')?.remove();
      const host = document.createElement('div');
      host.id = 'qs-test';
      host.innerHTML = m.questSpielHtml(d.quest, d);
      document.body.appendChild(host);
      window.__qs = ${stand};
      m.questSpielAktiv(host, window.__qs);
    })()`;
    await page.evaluate(run('{ ok: [] }'));
    expect(await page.textContent('#qs-test .qs-zahl')).toBe('0 / 2');
    // „Ali“ ist nicht „Alis“
    await page.click('#qs-test .qs-t >> text="Ali"');
    expect(await page.$$eval('#qs-test .qs-t.ok', (e) => e.length)).toBe(0);
    const ja = await page.$$('#qs-test .qs-t[data-ja="1"]');
    expect(ja.length).toBe(2);
    await ja[0].click();
    expect(await page.textContent('#qs-test .qs-zahl')).toBe('1 / 2');
    expect(await page.isVisible('#qs-test .qs-done')).toBe(false);
    // neu aufgebaut (Seite zurück und wieder vor): gefundenes Wort bleibt markiert
    await page.evaluate(run('window.__qs'));
    expect(await page.textContent('#qs-test .qs-zahl')).toBe('1 / 2');
    await page.click('#qs-test .qs-t[data-ja="1"]:not(.ok)');
    expect(await page.textContent('#qs-test .qs-zahl')).toBe('2 / 2');
    expect(await page.isVisible('#qs-test .qs-done')).toBe(true);
    await page.evaluate(() => document.getElementById('qs-test')!.remove());
  });

  it('A6: 3 Blätter auf einmal – blättern, alle zusammen drucken, Nummern der Reihe nach', async () => {
    await page.goto(base);
    await page.waitForSelector('#create');
    await page.click('[data-bl="1"]');
    await page.click('[data-bl="1"]');
    expect(await page.textContent('#create')).toBe('3 Leseblätter erstellen');
    await page.click('#create');
    await page.waitForSelector('#pv-nav b');
    expect(await page.textContent('#pv-nav b')).toBe('1 / 3');
    const first = Number((await page.textContent('#pv-title'))!.match(/Blatt (\d+)/)![1]);
    await page.click('#pv-next');
    await page.waitForFunction(() => document.querySelector('#pv-nav b')?.textContent === '2 / 3');
    await page.waitForFunction((n) => document.querySelector('#pv-title')?.textContent?.startsWith(`Blatt ${n} `), first + 1);
    const printed = await page.evaluate(() => (window as unknown as { __printed: number }).__printed);
    await page.click('#print');
    await page.waitForFunction((n) => (window as unknown as { __printed: number }).__printed === n + 1, printed);
    expect(await page.$$eval('#print-root .sheet .sh-perle', (e) => e.map((x) => Number(x.textContent)))).toEqual([first, first + 1, first + 2]);
    // zurück auf ein Blatt
    await page.goto(base);
    await page.click('[data-bl="-1"]');
    await page.click('[data-bl="-1"]');
    expect(await page.textContent('#create')).toBe('Leseblatt erstellen');
  });

  it('A6: Timer-Zeit frei wählen, wird gemerkt', async () => {
    await page.goto(base + '#/timer');
    await page.waitForSelector('#t-wahl');
    expect(await page.textContent('#t-digits')).toBe('05:00');
    await page.click('[data-tmin="15"]');
    await page.waitForFunction(() => document.querySelector('#t-digits')?.textContent === '15:00');
    await page.click('[data-tstep="5"]');
    await page.waitForFunction(() => document.querySelector('#t-digits')?.textContent === '20:00');
    await page.reload();
    await page.waitForSelector('#t-digits');
    expect(await page.textContent('#t-digits')).toBe('20:00');
    expect(await page.isDisabled('#t-reset')).toBe(true);
    await page.click('#t-start');
    expect(await page.isDisabled('#t-reset')).toBe(false);
    expect(await page.isHidden('#t-wahl')).toBe(true);
    await page.click('#t-reset');
    await page.click('[data-tmin="5"]');
    await page.waitForFunction(() => document.querySelector('#t-digits')?.textContent === '05:00');
  });

  it('B2: nach „Gelesen ✓“ Stolperwörter antippen, in den Einstellungen sehen und entfernen', async () => {
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('.sheet-item');
    await page.click('.sheet-item');
    await page.waitForSelector('#b-read');
    await page.click('#b-read');
    await page.waitForSelector('.st-w');
    const [w1, w2] = await page.$$eval('.st-w', (e) => e.slice(0, 2).map((x) => (x as HTMLElement).dataset.w!));
    await page.click(`.st-w[data-w="${w1}"]`);
    await page.click(`.st-w[data-w="${w2}"]`);
    expect(await page.textContent('#st-ok')).toBe('Fertig · 2 Wörter');
    await page.click('#st-ok');
    await page.waitForSelector('#b-s');
    await page.goto(base + '#/einstellungen');
    await page.waitForSelector('#stolper');
    expect(await page.$$eval('.st-row b', (e) => e.map((x) => x.textContent))).toEqual([w1, w2]);
    await page.click('[data-st-del="0"]');
    await page.waitForFunction(() => document.querySelectorAll('.st-row').length === 1);
    expect(await page.textContent('.st-row b')).toBe(w2);
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('#st-info');
    expect(await page.textContent('#st-info')).toContain('1 noch in Arbeit');
  });

  it('B6: Sprache Ukrainisch – Oberfläche übersetzt, Leseblatt bleibt deutsch', async () => {
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('.sheet-item');
    await page.click('.sheet-item');
    await page.waitForSelector('#b-pv .sheet');
    const blattDe = await page.$eval('#b-pv .sheet', (e) => e.outerHTML);
    await page.goto(base + '#/einstellungen');
    await page.selectOption('#sprache', 'uk');
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Налаштування');
    expect(await page.getAttribute('html', 'lang')).toBe('uk');
    await page.goto(base);
    await page.waitForSelector('#create');
    expect(await page.textContent('#create')).toBe('Створити аркуш');
    await page.goto(base + '#/verlauf');
    await page.waitForSelector('.sheet-item');
    await page.click('.sheet-item');
    await page.waitForSelector('#b-pv .sheet');
    expect(await page.textContent('#b-read')).toBe('Прочитано ✓');
    expect(await page.$eval('#b-pv .sheet', (e) => e.outerHTML)).toBe(blattDe);
    // zurück: wie das Telefon (hier Englisch → Deutsch)
    await page.goto(base + '#/einstellungen');
    await page.selectOption('#sprache', '');
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Einstellungen');
  });

  it('Einstellungen: Name wird ohne Knopf gespeichert', async () => {
    await page.goto(base + '#/einstellungen');
    await page.waitForSelector('#name');
    const vorher = await page.inputValue('#name');
    await page.fill('#name', 'Mila');
    await page.waitForFunction(() => (document.querySelector('#name-saved')?.textContent ?? '').includes('✓'));
    const gespeichert = () => page.evaluate(() => JSON.parse(localStorage.getItem('leseraupe.kinder.v2')!).kinder[0].settings.childName);
    expect(await gespeichert()).toBe('Mila');
    await page.fill('#name', vorher);
    await page.locator('#name').blur();
    await page.waitForFunction((v) => JSON.parse(localStorage.getItem('leseraupe.kinder.v2')!).kinder[0].settings.childName === v, vorher);
  });

  it('Vorschau: Silben farbig direkt umschalten', async () => {
    await page.goto(base + '#/');
    await page.waitForSelector('#create');
    await page.click('#create');
    await page.waitForSelector('#pv .sheet');
    const an = await page.getAttribute('#pv-silben', 'aria-pressed');
    await page.click('#pv-silben');
    await page.waitForFunction((a) => document.querySelector('#pv-silben')?.getAttribute('aria-pressed') !== a, an);
    const farbig = (await page.getAttribute('#pv-silben', 'aria-pressed')) === 'true';
    await page.waitForFunction((f) => !!document.querySelector('#pv .sheet .sy1') === f, farbig);
    await page.click('#pv-silben');
    await page.waitForFunction((a) => document.querySelector('#pv-silben')?.getAttribute('aria-pressed') === a, an);
  });

  it('schnelles Umschalten: späte Ladeergebnisse überschreiben den neuen Bildschirm nicht', async () => {
    await page.goto(base + '#/');
    await page.waitForSelector('#create');
    for (const r of ['#/protokoll', '#/verlauf', '#/', '#/protokoll', '#/einstellungen']) {
      await page.evaluate((h) => (location.hash = h), r);
    }
    await page.waitForSelector('#name');
    await page.waitForTimeout(300);
    expect(await page.$('#name')).not.toBeNull();
    expect(await page.$('#pl')).toBeNull();
  });

  it('Play-App: Frage für Erwachsene vor Links nach außen (falsch → nochmal, richtig → weiter)', async () => {
    await page.evaluate(`(async () => {
      const m = await import('/leseraupe/src/app/elterncheck.ts');
      window.__gate = m.elternCheck(true);
    })()`);
    await page.waitForSelector('.modal-bg input');
    const frage = (await page.textContent('.modal-bg p'))!;
    const [a, b] = frage.match(/(\d+) \+ (\d+)/)!.slice(1).map(Number);
    await page.fill('.modal-bg input', String(a + b + 1));
    await page.click('.modal-bg button[type="submit"]');
    await page.waitForFunction(() => (document.querySelector('.modal-err')?.textContent ?? '') !== '');
    await page.fill('.modal-bg input', String(a + b));
    await page.click('.modal-bg button[type="submit"]');
    expect(await page.evaluate('window.__gate')).toBe(true);
    expect(await page.$('.modal-bg')).toBeNull();
  });

  it('keine Fehler in der Konsole', () => {
    expect(errors).toEqual([]);
  });
});

describe('A1: Update von der alten Version', () => {
  it('alte Daten (v1) sind nach dem Update im Verlauf und auf Start', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    // gleiche Herkunft, aber ohne App: dort die Daten der alten Version anlegen
    await p.goto(base + 'icons/icon-192.png');
    await p.evaluate(async (SAMPLE_SHEET) => {
      localStorage.setItem('leseraupe.settings.v1', JSON.stringify({ letters: ['t', 'o', 'm', 'l', 'a', 'i', 's', 'e'], newLetter: 'e', childName: 'Mia' }));
      const d = await new Promise<IDBDatabase>((res) => {
        const r = indexedDB.open('leseraupe', 1);
        r.onupgradeneeded = () => {
          r.result.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true }).createIndex('number', 'number', { unique: true });
          r.result.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
        };
        r.onsuccess = () => res(r.result);
      });
      const tx = d.transaction(['sheets', 'log'], 'readwrite');
      for (const number of [1, 2, 3]) {
        const at = new Date().toISOString();
        tx.objectStore('sheets').add({ number, createdAt: at, printedAt: at, reads: [{ at, minutes: 5 }], data: { ...SAMPLE_SHEET, number }, scale: 1 });
        tx.objectStore('log').add({ at, text: `Blatt ${number} erstellt` });
      }
      await new Promise((res) => (tx.oncomplete = res));
      d.close();
    }, SAMPLE_SHEET);
    await p.goto(base);
    await p.waitForSelector('.lt.neu');
    expect(await p.textContent('.lt.neu')).toBe('E');
    await p.goto(base + '#/verlauf');
    await p.waitForSelector('.sheet-item');
    expect(await p.$$eval('.sheet-item .si-n', (els) => els.map((e) => e.textContent))).toEqual(['3', '2', '1']);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('B4: volle Leseraupe → Urkunde', () => {
  it('10 gelesene Blätter: Start zeigt Urkunde, Urkunde mit Namen', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + 'icons/icon-192.png');
    await p.evaluate(async (SAMPLE_SHEET) => {
      localStorage.setItem('leseraupe.settings.v1', JSON.stringify({ letters: ['t', 'o', 'm', 'l', 'a', 'i', 's'], childName: 'Mia' }));
      const d = await new Promise<IDBDatabase>((res) => {
        const r = indexedDB.open('leseraupe', 1);
        r.onupgradeneeded = () => {
          r.result.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true }).createIndex('number', 'number', { unique: true });
          r.result.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
        };
        r.onsuccess = () => res(r.result);
      });
      const tx = d.transaction(['sheets'], 'readwrite');
      for (let number = 1; number <= 10; number++) {
        const at = new Date(2026, 9, number, 17).toISOString();
        tx.objectStore('sheets').add({ number, createdAt: at, printedAt: at, reads: [{ at, minutes: 5 }], data: { ...SAMPLE_SHEET, number }, scale: 1 });
      }
      await new Promise((res) => (tx.oncomplete = res));
      d.close();
    }, SAMPLE_SHEET);
    await p.goto(base);
    await p.waitForSelector('#raupe');
    expect(await p.textContent('#raupe .hint')).toContain('0 von 10');
    await p.click('#raupe a[href="#/urkunde?nr=1"]');
    await p.waitForSelector('#uk-pv .urkunde');
    const text = await p.textContent('#uk-pv .urkunde');
    expect(text).toContain('Mia');
    expect(text).toContain('an 10 Tagen gelesen');
    expect(text).toContain('10.10.2026');
    await p.goto(base + '#/verlauf');
    await p.waitForSelector('.uk-liste a');
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
