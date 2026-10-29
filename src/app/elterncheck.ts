import { PLAY } from './platform';
import { t } from './i18n';
import { esc } from './ui';

/**
 * Kleine Frage für Erwachsene („parental gate“) vor allem, was die App verlässt:
 * Links ins Internet, E-Mail, PDF teilen. Nur in der Google-Play-App (Familien-Richtlinien);
 * auf der Website nicht nötig.
 */
export function aufgabe(rng: () => number = Math.random): { a: number; b: number; summe: number } {
  const a = 6 + Math.floor(rng() * 4); // 6–9
  const b = 5 + Math.floor(rng() * 5); // 5–9
  return { a, b, summe: a + b };
}

export function elternCheck(aktiv = PLAY): Promise<boolean> {
  if (!aktiv) return Promise.resolve(true);
  const { a, b, summe } = aufgabe();
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(t('eltern.titel'))}">
      <h2>${esc(t('eltern.titel'))}</h2>
      <p>${esc(t('eltern.frage', { a, b }))}</p>
      <input class="modal-input" inputmode="numeric" autocomplete="off" aria-label="${esc(t('eltern.titel'))}" />
      <div class="modal-err" aria-live="polite"></div>
      <div class="btnrow two">
        <button type="button" class="btn ghost" data-x="no">${esc(t('ui.abbrechen'))}</button>
        <button type="submit" class="btn green">${esc(t('ui.ja'))}</button>
      </div>
    </form>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector<HTMLInputElement>('input')!;
    input.focus();
    const close = (ok: boolean) => {
      wrap.remove();
      resolve(ok);
    };
    wrap.querySelector('[data-x="no"]')!.addEventListener('click', () => close(false));
    wrap.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      if (Number(input.value.trim()) === summe) close(true);
      else {
        wrap.querySelector('.modal-err')!.textContent = t('eltern.falsch');
        input.value = '';
      }
    });
  });
}

/** Links mit data-eltern: erst die Frage, dann öffnen (nur in der Play-App aktiv). */
export function initElternLinks(aktiv = PLAY): void {
  if (!aktiv) return;
  document.addEventListener(
    'click',
    async (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-eltern]');
      if (!a) return;
      e.preventDefault();
      if (await elternCheck(aktiv)) window.open(a.href, a.target || '_self');
    },
    true,
  );
}
