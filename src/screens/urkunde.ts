import { elternCheck } from '../app/elterncheck';
import { allSheets } from '../core/db';
import { getSettings } from '../app/state';
import { backButton, go, toast, aktuelleRoute, nochAktuell } from '../app/ui';
import { mountPreview } from '../sheet/preview';
import { printSheets } from '../sheet/print';
import { sharePdf, sheetsToPdf } from '../sheet/pdf';
import { raupenstand, renderUrkunde } from '../sheet/urkunde';
import { t } from '../app/i18n';

/** Urkunde Nr. n (B4): Vorschau, Drucken, als PDF teilen */
export async function renderUrkundeScreen(root: HTMLElement, params: URLSearchParams): Promise<void> {
  const nr = Number(params.get('nr'));
  const routeNr = aktuelleRoute();
  const stand = raupenstand(await allSheets());
  if (!nochAktuell(routeNr)) return;
  const f = stand.fertig.find((x) => x.nr === nr);
  if (!f) {
    go('#/verlauf');
    return;
  }
  const html = renderUrkunde({ name: getSettings().childName, ...f });
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1>${t('urkunde.titel', { nr })}</h1><div class="sub">${t('urkunde.sub', { n: f.gesamt })}</div></div></div>
  <div class="preview-wrap" id="uk-pv"></div>
  <div class="bottom">
    <div class="btnrow two">
      <button class="btn green" id="uk-print">${t('aktion.drucken')}</button>
      <button class="btn ghost" id="uk-pdf">${t('aktion.pdf')}</button>
    </div>
  </div>
</div>`;
  await mountPreview(root.querySelector<HTMLElement>('#uk-pv')!, html, { fixedScale: 1 });
  root.querySelector('#uk-print')!.addEventListener('click', () => printSheets([html], `Urkunde-${nr}`));
  root.querySelector('#uk-pdf')!.addEventListener('click', async () => {
    try {
      const name = `Urkunde-${nr}`;
      if (!(await elternCheck())) return;
      if ((await sharePdf(await sheetsToPdf([html], `Urkunde ${nr}`), `${name}.pdf`)) === 'gespeichert') toast(t('aktion.pdfGespeichert', { name }));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('aktion.pdfFehler'));
    }
  });
}
