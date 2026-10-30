import { backButton, toast } from '../app/ui';
import { pruefeUpdate } from '../app/update';
import { t } from '../app/i18n';
import { PLAY } from '../app/platform';

export const KONTAKT = 'apps.by.lena@gmail.com';
/** Öffentliche Datenschutz-Seite (statisch, public/privacy.html) – auch für den Eintrag in Google Play */
export const DATENSCHUTZ_URL = 'https://lysenkol.github.io/leseraupe/privacy.html';

export const VERSION_TEXT = `${__VERSION__} (${__BUILD__} UTC)`;

export function feedbackMailto(): string {
  const subject = 'Leseraupe Feedback';
  const body = `\n\n\n---\nVersion: ${VERSION_TEXT}`;
  return `mailto:${KONTAKT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** „Über die App“ (A3) – alles ohne Internet lesbar, nur das Senden der Mail braucht es. */
export function renderUeber(root: HTMLElement): void {
  root.innerHTML = `
<div class="screen ueber">
  <div class="topbar">${backButton('#/einstellungen')}<div class="grow"><h1>${t('ueber.titel')}</h1></div></div>
  <div class="content">
    <section class="card">
      <h2>Leseraupe</h2>
      <div>${t('ueber.text')}</div>
      <div class="hint">${t('ueber.version', { v: VERSION_TEXT })}</div>
      ${PLAY ? '' : `<button class="btn ghost" id="upd">${t('update.suchen')}</button>`}
      <a class="btn ghost" href="#/willkommen?zurueck=%23%2Fueber">${t('ueber.einfuehrung')}</a>
    </section>
    ${
      PLAY
        ? `<section class="card" id="umzug">
      <h2>${t('ueber.umzug')}</h2>
      <div>${t('ueber.umzug1')}</div>
      <div>${t('ueber.umzug2')}</div>
      <div class="hint">${t('ueber.umzug3')}</div>
    </section>`
        : ''
    }
    <section class="card" id="datenschutz">
      <h2>${t('ueber.datenschutz')}</h2>
      <div>${t('ueber.ds1')}</div>
      <div>${t('ueber.ds2')}</div>
      <div>${t('ueber.ds3')}</div>
      <div>${t('ueber.ds4')}</div>
      <div>${t(PLAY ? 'ueber.ds5play' : 'ueber.ds5')}</div>
      ${DATENSCHUTZ_URL ? `<a class="hint" href="${DATENSCHUTZ_URL}" target="_blank" data-eltern rel="noopener">${t('ueber.dsLink')}</a>` : ''}
    </section>
    <section class="card">
      <h2>${t('ueber.kontakt')}</h2>
      <div>${t('ueber.kontaktText')}<br /><a href="mailto:${KONTAKT}" data-eltern>${KONTAKT}</a></div>
      <a class="btn green" id="feedback" data-eltern href="${feedbackMailto()}">${t('ueber.feedback')}</a>
    </section>
    <section class="card">
      <h2>${t('ueber.schrift')}</h2>
      <div class="hint">${t('ueber.schriftText')}</div>
    </section>
  </div>
</div>`;
  root.querySelector<HTMLButtonElement>('#upd')?.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    const r = await pruefeUpdate();
    toast(t(r === 'neu' ? 'update.neu' : r === 'aktuell' ? 'update.aktuell' : r === 'offline' ? 'update.offline' : 'update.fehler'));
    if (r !== 'neu') b.disabled = false;
  });
}
