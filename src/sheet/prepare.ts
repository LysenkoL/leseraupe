import type { SheetData } from '../core/types';
import { mulberry32, shuffle } from '../core/random';
import { trimOnce } from '../app/fitflow';
import { mountPreview } from './preview';
import { renderSheet, type RenderOptions } from './render';

/** Fester oberer Leseschrift-Rahmen: 28,6 px für Silben, 26,4 px für Wörter. */
const READING_SCALE = 1.1;
type RepeatBlock = 'silben' | 'woerter' | 'kleine' | 'saetze';

export class WorksheetOverflowError extends Error {
  constructor() {
    super('Der vollständige Text passt nicht auf ein A4-Blatt. Bitte kürze den Text in der Chat-Antwort.');
    this.name = 'WorksheetOverflowError';
  }
}

/**
 * Bereitet die tatsächlichen Druckdaten vor. Gemessen wird auf der A4-Fläche,
 * unabhängig vom verkleinerten Bildschirm. Bestehende Drucke werden nie ergänzt.
 */
export async function prepareWorksheet(
  host: HTMLElement,
  source: SheetData,
  options: RenderOptions & { savedScale?: number },
): Promise<{ data: SheetData; scale: number; html: string }> {
  if (options.savedScale !== undefined) {
    const rendered = await mountPreview(host, renderSheet(source, options), { fixedScale: options.savedScale });
    return { data: source, scale: rendered.scale, html: rendered.html };
  }

  let data: SheetData = { ...source, balanced: true };
  const mount = (next: SheetData, fixedScale?: number) =>
    mountPreview(host, renderSheet(next, options), { maxScale: READING_SCALE, fixedScale });
  let rendered = await mount(data);
  // Zusammenhängende Geschichten und vollständige Sätze nie für zusätzliche Übungen kürzen.
  for (let i = 0; !rendered.fits && i < 200; i++) {
    const trimmed = trimOnce(data, true);
    if (!trimmed) break;
    data = trimmed;
    rendered = await mount(data);
  }
  if (!rendered.fits) throw new WorksheetOverflowError();

  const block = (['silben', 'woerter', 'kleine', 'saetze'] as RepeatBlock[]).find(id => data.blocks[id] && data[id].length);
  if (!block) return { data, scale: rendered.scale, html: rendered.html };
  const pool = [...new Set(data[block])];
  const scale = rendered.scale;
  const rng = mulberry32(pool.join('|').split('').reduce((sum, c) => ((sum * 31) + c.charCodeAt(0)) >>> 0, 1));
  let cycle: string[] = [];
  const nextItem = () => {
    if (!cycle.length) cycle = shuffle(pool, rng);
    return cycle.pop()!;
  };

  // Eine unvollständige Zeile auffüllen, dann nur ganze Zeilen ergänzen.
  // Die Schrift bleibt dabei unverändert; der nächste nicht passende Versuch wird verworfen.
  for (let row = 0; row < 100; row++) {
    const grid = rendered.sheet.querySelector<HTMLElement>(`.g-${block}`);
    const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1;
    const count = columns - (data[block].length % columns);
    const candidate = { ...data, [block]: [...data[block], ...Array.from({ length: count }, nextItem)] };
    const trial = await mount(candidate, scale);
    if (!trial.fits) {
      rendered = await mount(data, scale);
      break;
    }
    data = candidate;
    rendered = trial;
  }
  return { data, scale, html: rendered.html };
}
