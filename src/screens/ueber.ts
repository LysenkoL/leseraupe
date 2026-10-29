import { backButton } from '../app/ui';
import { t } from '../app/i18n';

export const KONTAKT = 'apps.by.lena@gmail.com';
/** Öffentliche Datenschutz-Seite (Google Sites); leer, solange es sie noch nicht gibt */
export const DATENSCHUTZ_URL = '';

export const VERSION_TEXT = `${__VERSION__} (${__BUILD__} UTC)`;

export function feedbackMailto(): string {
  const subject = 'Leseraupe Feedback';
  const body = `\n\n\n---\nVersion: ${VERSION_TEXT}`;
  return `mailto:${KONTAKT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** „Über die App“ (A3) – alles ohne Internet lesbar, nur das Senden der Mail braucht es. */
export function renderUeber(root: HTMLElement): void {
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/einstellungen')}<div class="grow"><h1>${t('ueber.titel')}</h1></div></div>
  <div class="content">
    <section class="card">
      <h2>Leseraupe</h2>
      <div>${t('ueber.text')}</div>
      <div class="hint">${t('ueber.version', { v: VERSION_TEXT })}</div>
      <a class="btn ghost" href="#/willkommen?zurueck=%23%2Fueber">${t('ueber.einfuehrung')}</a>
    </section>
    <section class="card" id="datenschutz">
      <h2>${t('ueber.datenschutz')}</h2>
      <div>${t('ueber.ds1')}</div>
      <div>${t('ueber.ds2')}</div>
      <div>${t('ueber.ds3')}</div>
      <div>${t('ueber.ds4')}</div>
      <div>${t('ueber.ds5')}</div>
      ${DATENSCHUTZ_URL ? `<a class="hint" href="${DATENSCHUTZ_URL}" target="_blank" rel="noopener">${t('ueber.dsLink')}</a>` : ''}
    </section>
    <section class="card">
      <h2>${t('ueber.kontakt')}</h2>
      <div>${t('ueber.kontaktText')} <a href="mailto:${KONTAKT}">${KONTAKT}</a></div>
      <a class="btn green" id="feedback" href="${feedbackMailto()}">${t('ueber.feedback')}</a>
    </section>
    <section class="card">
      <h2>${t('ueber.schrift')}</h2>
      <div class="hint">${t('ueber.schriftText')}</div>
    </section>
  </div>
</div>`;
}
