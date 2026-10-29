import { allLog } from '../core/db';
import { backButton, esc, formatDate } from '../app/ui';
import { protokollText } from '../app/protokolltext';
import { t } from '../app/i18n';

export function renderProtokoll(root: HTMLElement): void {
  root.innerHTML = `<div class="screen"><div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1>${t('protokoll.titel')}</h1></div></div><div class="content" id="pl"></div></div>`;
  allLog().then((l) => {
    root.querySelector('#pl')!.innerHTML = l.length
      ? `<div class="card log">${l.map((e) => `<div class="log-row"><span>${formatDate(e.at, true)}</span><b>${esc(protokollText(e.text))}</b></div>`).join('')}</div>`
      : `<div class="empty">${t('protokoll.leer')}</div>`;
  });
}
