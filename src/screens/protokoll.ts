import { allLog } from '../core/db';
import { backButton, esc, formatDate } from '../app/ui';

export function renderProtokoll(root: HTMLElement): void {
  root.innerHTML = `<div class="screen"><div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1>Protokoll</h1></div></div><div class="content" id="pl"></div></div>`;
  allLog().then((l) => {
    root.querySelector('#pl')!.innerHTML = l.length
      ? `<div class="card log">${l.map((e) => `<div class="log-row"><span>${formatDate(e.at, true)}</span><b>${esc(e.text)}</b></div>`).join('')}</div>`
      : '<div class="empty">Noch keine Einträge.</div>';
  });
}
