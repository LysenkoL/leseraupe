import type { SheetData } from '../core/types';

/**
 * Wenn ein Blatt selbst mit kleinster Schrift nicht auf eine Seite passt,
 * wird der längste Textblock um eine Zeile gekürzt (nie unter ein Minimum).
 * C3: Eine lange Geschichte (10+ Sätze) ist zusammenhängend – sie wird erst gekürzt, wenn alles andere am Minimum ist.
 */
export function trimOnce(d: SheetData): SheetData | null {
  const s = structuredClone(d);
  const lang = (s.geschichte?.saetze.length ?? 0) >= 10;
  const opts: [number, () => void][] = [
    [s.geschichte ? (lang ? 0.5 : s.geschichte.saetze.length - 6) : -1, () => s.geschichte!.saetze.splice(-2, 1)],
    [s.saetze.length - 4, () => s.saetze.pop()],
    [s.woerter.length - 10, () => s.woerter.pop()],
    [s.silben.length - 12, () => s.silben.splice(-6)],
    [s.fragen.length - 2, () => s.fragen.pop()],
  ];
  const best = opts.filter(([n]) => n > 0).sort((a, b) => b[0] - a[0])[0];
  if (!best) return null;
  best[1]();
  return s;
}
