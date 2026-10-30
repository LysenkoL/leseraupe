/**
 * „Als PDF teilen“ (A4): das Blatt wird mit denselben Stilen wie beim Drucken
 * als Bild gerendert (SVG foreignObject → Canvas) und in ein A4-PDF gelegt –
 * gleiche Ränder (10 mm) und gleiche Maße wie @page in print.css.
 */
import { NATIV, teileNativ } from '../app/native';

const MM = 72 / 25.4; // PDF-Punkte je mm
const A4 = { w: 210 * MM, h: 297 * MM };
const MARGIN = 10 * MM;
/** Pixel je CSS-px im Bild: 3 → ca. 290 dpi */
const PIXEL_RATIO = 3;

let cssCache: Promise<string> | null = null;

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Alle Stile der Seite als Text, Schriften als data:-URLs (ein SVG-Bild darf nichts nachladen). */
function collectCss(): Promise<string> {
  cssCache ??= (async () => {
    const parts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      const base = sheet.href ?? location.href;
      for (const rule of Array.from(rules)) {
        let text = rule.cssText;
        if (rule instanceof CSSFontFaceRule) {
          const m = text.match(/url\(["']?([^"')]+)["']?\)/);
          if (m && !m[1].startsWith('data:')) {
            const buf = await (await fetch(new URL(m[1], base))).arrayBuffer();
            text = text.replace(m[0], `url("data:font/woff2;base64,${toBase64(buf)}")`);
          }
        }
        parts.push(text);
      }
    }
    return parts.join('\n');
  })();
  return cssCache;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Blatt konnte nicht als Bild erstellt werden.'));
    img.src = src;
  });
}

/** Rendert das Blatt (HTML wie für den Druck) zu einem Canvas in Druckauflösung. */
export async function sheetToCanvas(sheetHtml: string): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0';
  host.innerHTML = sheetHtml;
  document.body.appendChild(host);
  const sheet = host.querySelector<HTMLElement>('.sheet')!;
  const w = sheet.offsetWidth;
  const h = sheet.offsetHeight;
  const xhtml = new XMLSerializer().serializeToString(sheet);
  host.remove();

  const css = await collectCss();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;background:#fff">` +
    `<style>${css.replace(/</g, '\\3c ')}</style>${xhtml}</div></foreignObject></svg>`;
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  // Schriften im SVG-Bild sind data:-URLs; decode() wartet, bis alles fertig gezeichnet werden kann
  await img.decode().catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PIXEL_RATIO);
  canvas.height = Math.round(h * PIXEL_RATIO);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a)), rej) : rej(new Error('JPEG fehlgeschlagen'))),
      'image/jpeg',
      0.92,
    ),
  );
}

export interface PdfPage {
  jpeg: Uint8Array;
  px: { w: number; h: number };
  /** Größe des Bildes auf dem Papier, oben links bei 10 mm Rand */
  wMm: number;
  hMm: number;
}

/** Minimales PDF: je Seite A4 mit einem JPEG-Bild (A6: mehrere Blätter in einer Datei). */
export function jpegsToPdf(pages: PdfPage[], title = 'Leseblatt'): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (c: Uint8Array | string) => {
    const b = typeof c === 'string' ? enc.encode(c) : c;
    chunks.push(b);
    pos += b.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  const f = (x: number) => x.toFixed(2);
  // Titel nur aus ASCII-Zeichen, damit kein Encoding nötig ist
  const safeTitle = title.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '');
  // Objekte: 1 Katalog, 2 Seitenbaum, je Seite 3 (Seite, Bild, Inhalt), zuletzt Info
  const pageObj = (k: number) => 3 + k * 3;
  const info = 3 + pages.length * 3;

  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, k) => `${pageObj(k)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((pg, k) => {
    const n = pageObj(k);
    const iw = pg.wMm * MM;
    const ih = pg.hMm * MM;
    const content = `q ${f(iw)} 0 0 ${f(ih)} ${f(MARGIN)} ${f(A4.h - MARGIN - ih)} cm /Im1 Do Q`;
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(A4.w)} ${f(A4.h)}] /Resources << /XObject << /Im1 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`);
    offsets[n + 1] = pos;
    push(`${n + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.px.w} /Height ${pg.px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
    push(pg.jpeg);
    push('\nendstream\nendobj\n');
    obj(n + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  obj(info, `<< /Title (${safeTitle}) /Producer (Leseraupe) >>`);
  const xref = pos;
  push(`xref\n0 ${info + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Blätter (HTML wie für den Druck) → ein PDF, jedes Blatt auf eigener A4-Seite */
/** Dateiname fürs PDF: „5-7“ nur, wenn die Nummern lückenlos sind, sonst „5-6-8“ */
export function pdfName(nums: number[]): string {
  const n = [...nums].sort((a, b) => a - b);
  if (n.length === 1) return `Leseblatt-${n[0]}`;
  const lueckenlos = n.every((x, i) => i === 0 || x === n[i - 1] + 1);
  return `Leseblaetter-${lueckenlos ? `${n[0]}-${n[n.length - 1]}` : n.join('-')}`;
}

export async function sheetsToPdf(sheetsHtml: string[], title?: string): Promise<Uint8Array> {
  const pages: PdfPage[] = [];
  for (const html of sheetsHtml) {
    const canvas = await sheetToCanvas(html);
    const jpeg = await canvasToJpeg(canvas);
    // Blatt: 190 mm breit (sheet.css), Höhe im selben Maßstab
    const mmPerPx = 190 / (canvas.width / PIXEL_RATIO);
    pages.push({ jpeg, px: { w: canvas.width, h: canvas.height }, wMm: 190, hMm: (canvas.height / PIXEL_RATIO) * mmPerPx });
  }
  return jpegsToPdf(pages, title);
}

export function sheetToPdf(sheetHtml: string, title?: string): Promise<Uint8Array> {
  return sheetsToPdf([sheetHtml], title);
}

/**
 * PDF über das Teilen-Menü des Handys (WhatsApp, Mail, Drive …) weitergeben;
 * geht das nicht, wird die Datei heruntergeladen.
 */
export async function sharePdf(bytes: Uint8Array, filename: string): Promise<'geteilt' | 'gespeichert' | 'abgebrochen'> {
  return teileDatei(new File([bytes as BlobPart], filename, { type: 'application/pdf' }));
}

/** Datei teilen (Teilen-Menü des Handys) oder herunterladen. */
export async function teileDatei(file: File): Promise<'geteilt' | 'gespeichert' | 'abgebrochen'> {
  const filename = file.name;
  if (NATIV) return teileNativ(file, toBase64(await file.arrayBuffer()));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename.replace(/\.\w+$/, '') });
      return 'geteilt';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'abgebrochen';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'gespeichert';
}
