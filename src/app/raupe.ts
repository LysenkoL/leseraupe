import { PERLEN_JE_RAUPE, perlenRaupeSvg, type Raupenstand } from '../sheet/urkunde';
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
