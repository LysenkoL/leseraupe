import { UNITS, unitById } from '../core/letters';
import { toggleLetter, type Settings } from '../core/store';
import { log } from '../core/db';
import { getSettings, setSettings } from './state';
import { esc } from './ui';

/** Raster der 43 Buchstaben mit Legende – auf Start und in der Einführung. */
export function lettersHtml(s: Settings): string {
  const letters = UNITS.map((u) => {
    const on = s.letters.includes(u.id);
    const cls = u.id === s.newLetter ? 'neu' : on ? 'on' : '';
    const small = u.label.length > 2 ? ' small' : '';
    const state = u.id === s.newLetter ? 'neu' : on ? 'gelernt' : 'noch nicht';
    return `<button class="lt ${cls}${small}" data-l="${u.id}" aria-label="${esc(u.label)}: ${state}">${esc(u.label)}</button>`;
  }).join('');
  return `<div class="letters">${letters}</div>
      <div class="legend"><span><i style="background:#9FD18F"></i>gelernt</span><span><i style="background:#F2A65A"></i>neu</span><span><i style="background:#fff;border:1px solid #CCD3CE"></i>noch nicht</span></div>
      <div class="hint">Reihenfolge wie in vielen Fibeln · Tippen: noch nicht → neu → gelernt → noch nicht</div>`;
}

/** Tippen auf einen Buchstaben: speichern, protokollieren, neu zeichnen. */
export function bindLetters(root: HTMLElement, redraw: () => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-l]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.dataset.l!;
      const r = toggleLetter(getSettings(), id);
      setSettings(r.settings);
      const lbl = unitById(id)!.label.replace('-', '');
      if (r.added) await log(`Buchstabe ${lbl} hinzugefügt`);
      if (r.removed) await log(`Buchstabe ${lbl} entfernt`);
      redraw();
    }),
  );
}
