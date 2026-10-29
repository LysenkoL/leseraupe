import { PERLEN_JE_RAUPE, perlenRaupeSvg, type Raupenstand } from '../sheet/urkunde';
import { t } from './i18n';

/** Karte „Meine Leseraupe“ (B4): Perlen der aktuellen Raupe, neueste Urkunde */
export function raupenKarte(stand: Raupenstand): string {
  const neu = stand.fertig[stand.fertig.length - 1];
  return `<section class="card raupe-card" id="raupe">
      <div class="row"><h2>${t('raupe.titel')}</h2><span class="hint">${t('raupe.perlen', { n: stand.perlen, max: PERLEN_JE_RAUPE })}</span></div>
      ${perlenRaupeSvg(stand.perlen, 'raupe-svg')}
      <div class="hint">${t('raupe.hinweis', { max: PERLEN_JE_RAUPE })}</div>
      ${neu && stand.perlen === 0 ? `<a class="btn green" href="#/urkunde?nr=${neu.nr}">${t('raupe.urkundeAnsehen', { nr: neu.nr })}</a>` : ''}
    </section>`;
}
