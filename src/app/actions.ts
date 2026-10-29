import { getSettings, setDraft, themeForToday } from './state';
import { generateSheet, historyFrom, stufeFor, type GenParams } from '../core/generator';
import { allSheets, nextNumber } from '../core/db';
import { randomSeed } from '../core/random';

/** Parameter für den Generator aus Einstellungen + Verlauf. */
export async function genParams(seed = randomSeed()): Promise<GenParams> {
  const s = getSettings();
  const sheets = await allSheets();
  const next = await nextNumber();
  return {
    letters: s.letters,
    newLetter: s.newLetter,
    minutes: s.minutes,
    theme: themeForToday(),
    childName: s.childName,
    blocks: s.blocks,
    aehnlichPair: s.aehnlichPair,
    history: historyFrom(sheets.map((r) => ({ seq: r.number, data: r.data })), next),
    seed,
    stufe: stufeFor(sheets.map((r) => r.data), s.letters),
  };
}

/** Neues Blatt aus dem Wörterbuch erzeugen und als Entwurf ablegen. */
export async function createDraft(): Promise<void> {
  const p = await genParams();
  const g = generateSheet(p);
  setDraft({ data: g.sheet, seed: p.seed, removed: g.removed, savedId: null, scale: 1 });
}
