import { getSettings, setSettings } from '../app/state';
import { backButton, go } from '../app/ui';
import { THEMES, THEME_IDS, type ThemeId } from '../sheet/themes';
import { renderSheet } from '../sheet/render';
import { SAMPLE_SHEET } from '../core/sample';
import { loadFonts } from '../sheet/fit';
import { t, themaName } from '../app/i18n';

/** Kopfzeile eines Themas als verkleinerte Vorschau (echtes Blatt, oben abgeschnitten). */
function headPreview(theme: ThemeId): string {
  const s = getSettings();
  const data = {
    ...SAMPLE_SHEET,
    theme,
    letters: s.letters,
    newLetter: s.newLetter,
    childName: s.childName,
    blocks: { silben: false, woerter: false, kleine: false, aehnlich: false, saetze: false, geschichte: false, quest: false, fragen: false },
  };
  return `<div class="hp"><div class="hp-in">${renderSheet(data, { displayNumber: 15 })}</div></div>`;
}

export function renderThema(root: HTMLElement): void {
  let sel: ThemeId = getSettings().theme;
  let random = getSettings().randomTheme;
  const draw = () => {
    root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1>${t('thema.titel')}</h1></div></div>
  <div class="content">
    <div class="hint">${t('thema.vorschau', { name: themaName(sel) })}</div>
    <div class="card hp-big">${headPreview(sel)}</div>
    <div class="theme-grid">
      ${THEME_IDS.map(
        (id) => `<button class="theme-card${id === sel ? ' on' : ''}" data-t="${id}" style="--main:${THEMES[id].main}">
          ${headPreview(id)}<span class="tc-name">${themaName(id)}</span>${id === sel ? `<span class="tc-sel">${t('thema.gewaehlt')}</span>` : ''}</button>`,
      ).join('')}
    </div>
    <label class="toggle"><input type="checkbox" id="rnd" ${random ? 'checked' : ''}/> ${t('thema.zufall')}</label>
  </div>
  <div class="bottom"><button class="btn primary big" id="ok">${t('ui.uebernehmen')}</button></div>
</div>`;
    const fit = () =>
      root.querySelectorAll<HTMLElement>('.hp').forEach((hp) => {
        const inner = hp.querySelector<HTMLElement>('.hp-in')!;
        const k = hp.clientWidth / inner.offsetWidth;
        inner.style.transform = `scale(${k})`;
        hp.style.height = `${48 * 3.78 * k}px`;
      });
    loadFonts().then(fit);
    fit();
    root.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        sel = b.dataset.t as ThemeId;
        draw();
      }),
    );
    root.querySelector<HTMLInputElement>('#rnd')!.addEventListener('change', (e) => (random = (e.target as HTMLInputElement).checked));
    root.querySelector('#ok')!.addEventListener('click', () => {
      setSettings({ ...getSettings(), theme: sel, randomTheme: random });
      go('#/');
    });
  };
  draw();
}
