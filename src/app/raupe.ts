import { geradeVoll, PERLEN_JE_RAUPE, perlenRaupeSvg, raupenstand, type Raupenstand } from '../sheet/urkunde';
import { eigeneIds } from '../sheet/print';
import { allSheets } from '../core/db';
import { getSettings } from './state';
import { esc, go } from './ui';
import { t } from './i18n';

/** Karte „Meine Leseraupe“ (B4): Perlen der aktuellen Raupe, neueste Urkunde */
export function raupenKarte(stand: Raupenstand, kompakt = false): string {
  const neu = stand.fertig[stand.fertig.length - 1];
  // kompakt (Startseite): immer sichtbar, auch mit 0 Perlen – die Raupe ist die Heldin der App
  return `<section class="card raupe-card${kompakt ? ' kompakt' : ''}" id="raupe">
      <div class="row"><h2>${t('raupe.titel')}</h2><span class="hint">${t('raupe.perlen', { n: stand.perlen, max: PERLEN_JE_RAUPE })}</span></div>
      ${perlenRaupeSvg(stand.perlen, 'raupe-svg')}
      ${kompakt ? '' : `<div class="hint">${t('raupe.hinweis', { max: PERLEN_JE_RAUPE })}</div>`}
      ${neu && stand.perlen === 0 ? `<a class="btn green" href="#/urkunde?nr=${neu.nr}">${t('raupe.urkundeAnsehen', { nr: neu.nr })}</a>` : ''}
    </section>`;
}

/**
 * Volle Raupe (10. Perle) einmal groß feiern – über dem nächsten Bildschirm.
 * Überschrift und Satz immer auf Deutsch: das Kind liest sie; der Hinweis für Eltern in der Sprache der App.
 */
export async function raupeFeiern(at: string): Promise<void> {
  const nr = geradeVoll(raupenstand(await allSheets()), at);
  if (!nr) return;
  const name = getSettings().childName;
  const wrap = document.createElement('div');
  wrap.className = 'modal-bg feier-bg';
  wrap.innerHTML = `<div class="modal feier" role="dialog" aria-modal="true" aria-labelledby="feier-titel">
      ${eigeneIds(perlenRaupeSvg(PERLEN_JE_RAUPE, 'raupe-svg'))}
      <h2 id="feier-titel">${name ? `Super, ${esc(name)}!` : 'Super!'}</h2>
      <p class="feier-satz">Deine Leseraupe ist fertig!</p>
      <p class="hint">${t('feier.eltern', { n: PERLEN_JE_RAUPE, nr })}</p>
      <div class="btnrow two"><button class="btn ghost" data-x="spaeter">${t('feier.spaeter')}</button><button class="btn green" data-x="urkunde">${t('raupe.urkundeAnsehen', { nr })}</button></div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-x="spaeter"]')!.addEventListener('click', () => wrap.remove());
  wrap.querySelector('[data-x="urkunde"]')!.addEventListener('click', () => {
    wrap.remove();
    go(`#/urkunde?nr=${nr}`);
  });
}
