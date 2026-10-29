import { UNITS, unitById } from '../core/letters';
import { toggleLetter, type Settings } from '../core/store';
import { log } from '../core/db';
import { getSettings, setSettings } from './state';
import { esc } from './ui';
import { t } from './i18n';

/** Raster der 43 Buchstaben mit Legende – auf Start und in der Einführung. */
export function lettersHtml(s: Settings): string {
  const letters = UNITS.map((u) => {
    const on = s.letters.includes(u.id);
    const cls = u.id === s.newLetter ? 'neu' : on ? 'on' : '';
    const small = u.label.length > 2 ? ' small' : '';
    const state = u.id === s.newLetter ? t('buchst.neu') : on ? t('buchst.gelernt') : t('buchst.nochnicht');
    return `<button class="lt ${cls}${small}" data-l="${u.id}" aria-label="${esc(u.label)}: ${state}">${esc(u.label)}</button>`;
  }).join('');
  return `<div class="letters">${letters}</div>
      <div class="legend"><span><i style="background:#9FD18F"></i>${t('buchst.gelernt')}</span><span><i style="background:#F2A65A"></i>${t('buchst.neu')}</span><span><i style="background:#fff;border:1px solid #CCD3CE"></i>${t('buchst.nochnicht')}</span></div>
      <div class="hint">${t('buchst.hinweis')}</div>`;
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
