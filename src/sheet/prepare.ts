import type { SheetData } from '../core/types';
import { mulberry32, shuffle, type Rng } from '../core/random';
import { sortUnits } from '../core/letters';
import { makeSilben } from '../core/silbenuebung';
import { Vocab } from '../core/vocab';
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

const klein = (list: string[]) => new Set(list.map((x) => x.toLowerCase()));

/** Wörter, die noch nicht auf dem Blatt stehen und die Spaltenbreite nicht sprengen (Vocab prüft Buchstaben und Inhalt). */
function neueWoerter(data: SheetData, rng: Rng): string[] {
  const schon = klein([...data.woerter, ...data.kleine]);
  const maxLaenge = Math.max(6, ...data.woerter.map((w) => [...w].length));
  const frei = new Vocab(new Set(data.letters)).words.filter((e) => e.len >= 2 && e.len <= maxLaenge && !schon.has(e.w.toLowerCase()));
  const nachLaenge = (a: string, b: string) => [...a].length - [...b].length;
  // keine zusätzlichen Namen: eine Liste voller Namen übt wenig, dann lieber Silben oder Wiederholungen
  return shuffle(frei.filter((e) => e.typ !== 'Name').map((e) => e.w), rng).sort(nachLaenge);
}

function neueSilben(data: SheetData, rng: Rng): string[] {
  const schon = klein(data.silben);
  return makeSilben(sortUnits(data.letters), null, 1000, rng).filter((s) => !schon.has(s.toLowerCase()));
}

/** Wiederholung aus dem Vorrat, nie zweimal dasselbe direkt hintereinander. */
function wiederholer(pool: string[], rng: Rng, zuletzt: () => string | undefined): () => string {
  let runde: string[] = [];
  return () => {
    if (!runde.length) runde = shuffle(pool, rng);
    if (pool.length > 1 && runde[runde.length - 1] === zuletzt()) {
      const letzter = runde.pop()!;
      if (!runde.length) runde = shuffle(pool.filter((x) => x !== letzter), rng);
      const naechster = runde.pop()!;
      runde.push(letzter);
      return naechster;
    }
    return runde.pop()!;
  };
}

/**
 * Bereitet die tatsächlichen Druckdaten vor. Gemessen wird auf der A4-Fläche,
 * unabhängig vom verkleinerten Bildschirm. Bestehende Drucke werden nie ergänzt.
 *
 * Freier Platz wird so gefüllt: zuerst neue Wörter, dann neue Silben, erst danach Wiederholungen
 * (abwechselnd Wörter und Silben). Sätze werden nur wiederholt, wenn nichts anderes gewählt ist.
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

  const aktiv = (id: RepeatBlock) => data.blocks[id] && data[id].length > 0;
  const grids = (['woerter', 'silben', 'kleine'] as RepeatBlock[]).filter(aktiv);
  const offen: RepeatBlock[] = grids.length ? grids : aktiv('saetze') ? ['saetze'] : [];
  if (!offen.length) return { data, scale: rendered.scale, html: rendered.html };

  const scale = rendered.scale;
  const rng = mulberry32([...new Set([...data.silben, ...data.woerter, ...data.saetze])].join('|').split('').reduce((sum, c) => ((sum * 31) + c.charCodeAt(0)) >>> 0, 1));
  const frisch: Partial<Record<RepeatBlock, string[]>> = {
    woerter: aktiv('woerter') ? neueWoerter(data, rng) : [],
    silben: aktiv('silben') ? neueSilben(data, rng) : [],
  };
  const naechste = new Map(offen.map((id) => {
    const pool = [...new Set(data[id])];
    return [id, wiederholer(pool, rng, () => { const l = data[id]; return l[l.length - 1]; })] as const;
  }));
  let dran = 0;
  const waehle = (): RepeatBlock | undefined => {
    const mitNeuem = offen.find((id) => frisch[id]?.length);
    if (mitNeuem) return mitNeuem;
    return offen.length ? offen[dran++ % offen.length] : undefined;
  };

  // Eine unvollständige Zeile auffüllen, dann nur ganze Zeilen ergänzen.
  // Die Schrift bleibt dabei unverändert; passt ein Block nicht mehr, ist er fertig.
  let verworfen = false;
  for (let row = 0; row < 200 && offen.length; row++) {
    const block = waehle()!;
    const grid = rendered.sheet.querySelector<HTMLElement>(`.g-${block}`);
    const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1;
    const count = columns - (data[block].length % columns);
    const zeile: string[] = [];
    const vorrat = frisch[block] ?? [];
    const merken = data;
    while (zeile.length < count) {
      const neu = vorrat.shift();
      if (neu !== undefined) { zeile.push(neu); data = { ...data, [block]: [...data[block], neu] }; continue; }
      const wdh = naechste.get(block)!();
      zeile.push(wdh);
      data = { ...data, [block]: [...data[block], wdh] };
    }
    const trial = await mount(data, scale);
    if (!trial.fits) {
      data = merken;
      offen.splice(offen.indexOf(block), 1);
      verworfen = true;
      continue;
    }
    rendered = trial;
    verworfen = false;
  }
  if (verworfen) rendered = await mount(data, scale);
  return { data, scale, html: rendered.html };
}
