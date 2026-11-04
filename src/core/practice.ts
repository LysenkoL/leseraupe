import type { SheetData } from './types';

/**
 * Gemeinsame Vorbereitung für Chat und Wörterbuch: ein Übungsblatt ohne Sätze und Geschichte markieren.
 * Die Lesereihen ergänzt prepareWorksheet beim Messen, damit sie genau auf A4 passen.
 */
export function preparePractice(sheet: SheetData): void {
  const story = sheet.blocks.geschichte && sheet.geschichte?.saetze.length;
  if ((sheet.blocks.saetze && sheet.saetze.length) || story) {
    delete sheet.practice;
    return;
  }
  sheet.practice = true;
  sheet.fragen = [];
}
