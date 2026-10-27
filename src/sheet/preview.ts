import { fitScale, loadFonts, MIN_SCALE, MAX_SCALE } from './fit';

/**
 * Zeigt ein Blatt verkleinert an (echte A4-Maße, per transform skaliert)
 * und passt die Schriftgröße an. Liefert das fertige Blatt-HTML (mit Skala) zum Drucken.
 */
export async function mountPreview(
  host: HTMLElement,
  html: string,
  opts: { fixedScale?: number } = {},
): Promise<{ html: string; scale: number; fits: boolean; sheet: HTMLElement }> {
  host.innerHTML = `<div class="paper-scaler"><div class="paper">${html}</div></div>`;
  const scaler = host.querySelector<HTMLElement>('.paper-scaler')!;
  const paper = host.querySelector<HTMLElement>('.paper')!;
  const sheet = paper.querySelector<HTMLElement>('.sheet')!;
  await loadFonts();
  let result: { scale: number; fits: boolean };
  if (opts.fixedScale) {
    sheet.style.setProperty('--fs', opts.fixedScale.toFixed(3));
    result = { scale: opts.fixedScale, fits: true };
  } else {
    result = fitScale(sheet, MIN_SCALE, MAX_SCALE);
  }
  const resize = () => {
    const avail = host.clientWidth - 24;
    const w = paper.offsetWidth;
    const k = Math.min(1, avail / w);
    paper.style.transform = `scale(${k})`;
    scaler.style.width = `${w * k}px`;
    scaler.style.height = `${paper.offsetHeight * k}px`;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  return { html: sheet.outerHTML, ...result, sheet };
}
