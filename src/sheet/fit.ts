/** Schriftgrößen der Blöcke so wählen, dass das Blatt genau eine A4-Seite füllt. */

export const MIN_SCALE = 0.62;
export const MAX_SCALE = 1.6;

let fontsLoaded: Promise<unknown> | null = null;

export function loadFonts(): Promise<unknown> {
  if (!fontsLoaded) {
    fontsLoaded = Promise.all(
      ['500', '600', '800'].map((w) => document.fonts.load(`${w} 20px "Inter Schule"`)),
    ).then(() => document.fonts.ready);
  }
  return fontsLoaded;
}

/**
 * Sucht die größte Skala, bei der nichts überläuft. Liefert die Skala und ob sie passt.
 * In sich geschlossen (keine Verweise nach außen), damit Tests sie im Browser ausführen können.
 */
export function fitScale(sheet: HTMLElement, min = 0.62, max = 1.6): { scale: number; fits: boolean } {
  const over = () => sheet.scrollHeight > sheet.clientHeight + 0.5 || sheet.scrollWidth > sheet.clientWidth + 0.5;
  const set = (s: number) => sheet.style.setProperty('--fs', s.toFixed(3));
  set(max);
  if (!over()) return { scale: max, fits: true };
  set(min);
  if (over()) return { scale: min, fits: false };
  let lo = min;
  let hi = max;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    set(mid);
    if (over()) hi = mid;
    else lo = mid;
  }
  set(lo);
  return { scale: lo, fits: true };
}
