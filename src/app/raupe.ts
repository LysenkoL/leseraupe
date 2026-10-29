import { PERLEN_JE_RAUPE, perlenRaupeSvg, type Raupenstand } from '../sheet/urkunde';

/** Karte „Meine Leseraupe“ (B4): Perlen der aktuellen Raupe, neueste Urkunde */
export function raupenKarte(stand: Raupenstand): string {
  const neu = stand.fertig[stand.fertig.length - 1];
  return `<section class="card raupe-card" id="raupe">
      <div class="row"><h2>Meine Leseraupe</h2><span class="hint">${stand.perlen} von ${PERLEN_JE_RAUPE} Perlen</span></div>
      ${perlenRaupeSvg(stand.perlen, 'raupe-svg')}
      <div class="hint">Jedes gelesene Blatt ist eine Perle. Bei ${PERLEN_JE_RAUPE} Perlen gibt es eine Urkunde.</div>
      ${neu && stand.perlen === 0 ? `<a class="btn green" href="#/urkunde?nr=${neu.nr}">Urkunde ${neu.nr} ansehen</a>` : ''}
    </section>`;
}
