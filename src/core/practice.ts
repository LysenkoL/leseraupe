import type { SheetData } from './types';
import { shuffle, type Rng } from './random';

/** Gemeinsame Vorbereitung für Chat und Wörterbuch. Die genaue A4-Füllung folgt beim Messen des Blatts. */
export function preparePractice(sheet: SheetData, rng: Rng): void {
  const story = sheet.blocks.geschichte && sheet.geschichte?.saetze.length;
  if (!story && sheet.blocks.woerter && sheet.blocks.kleine && sheet.kleine.length <= 2) {
    const words = new Map(sheet.woerter.map(w=>[w.toLowerCase(),w]));
    for (const w of sheet.kleine) words.set(w.toLowerCase(),w);
    sheet.woerter = [...words.values()];
    if (sheet.localBlocks?.includes('kleine')) {
      sheet.localBlocks = [...new Set([...sheet.localBlocks.filter(id=>id!=='kleine'),'woerter' as const])];
    }
    sheet.kleine = [];
  }
  if ((sheet.blocks.saetze && sheet.saetze.length) || story) {
    delete sheet.practice;
    return;
  }
  sheet.practice = true;
  sheet.fragen = [];
  const active = [sheet.blocks.silben ? sheet.silben : [], sheet.blocks.woerter ? sheet.woerter : [], sheet.blocks.kleine ? sheet.kleine : []].filter(list=>list.length);
  for (const list of active) {
    const originals = [...new Set(list)];
    const target = Math.ceil(48 / active.length);
    while (list.length < target) list.push(...shuffle(originals,rng).slice(0,target-list.length));
  }
}
