import { chromium, type Browser, type Page } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fitScale } from '../../src/sheet/fit';

const ROOT = resolve(__dirname, '../..');
const ORIGIN = 'http://leseraupe.test';

function css(): string {
  return ['fonts.css', 'app.css', 'sheet.css', 'print.css']
    .map((f) => readFileSync(resolve(ROOT, 'src/styles', f), 'utf8'))
    .join('\n');
}

export async function launch(): Promise<Browser> {
  return chromium.launch();
}

/** Seite mit allen Stilen und lokalen Schriften, auf der Blätter gerendert werden können. */
export async function sheetPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/fonts/')) {
      return route.fulfill({ body: readFileSync(resolve(ROOT, 'public', url.pathname.slice(1))), contentType: 'font/woff2' });
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css()}</style></head><body><div id="host" style="padding:10mm;width:210mm;background:#fff"></div><div id="print-root"></div></body></html>`,
    });
  });
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(() =>
    Promise.all(['500', '600', '800'].map((w) => document.fonts.load(`${w} 20px "Inter Schule"`))),
  );
  return page;
}

export interface Placed {
  scale: number;
  fits: boolean;
  html: string;
}

/** Rendert ein Blatt, passt die Skala an und liefert das druckfertige HTML. */
export async function place(page: Page, html: string, min = 0.62, max = 1.6): Promise<Placed> {
  return page.evaluate(
    ([h, fn, mn, mx]) => {
      const host = document.getElementById('host')!;
      host.innerHTML = h as string;
      const sheet = host.querySelector<HTMLElement>('.sheet')!;
      // eslint-disable-next-line no-new-func
      const fit = new Function(`return (${fn as string})`)();
      const r = fit(sheet, mn, mx);
      return { ...r, html: sheet.outerHTML };
    },
    [html, fitScale.toString(), min, max] as const,
  );
}

/** Druckt das Blatt als PDF (Druck-CSS, A4) und zählt die Seiten. */
export async function pdfPages(page: Page, sheetHtml: string): Promise<number> {
  await page.evaluate((h) => {
    document.getElementById('print-root')!.innerHTML = h;
  }, sheetHtml);
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}
