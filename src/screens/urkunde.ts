import { allSheets } from '../core/db';
import { getSettings } from '../app/state';
import { backButton, go, toast } from '../app/ui';
import { mountPreview } from '../sheet/preview';
import { printSheets } from '../sheet/print';
import { sharePdf, sheetsToPdf } from '../sheet/pdf';
import { raupenstand, renderUrkunde } from '../sheet/urkunde';

/** Urkunde Nr. n (B4): Vorschau, Drucken, als PDF teilen */
export async function renderUrkundeScreen(root: HTMLElement, params: URLSearchParams): Promise<void> {
  const nr = Number(params.get('nr'));
  const stand = raupenstand(await allSheets());
  const f = stand.fertig.find((x) => x.nr === nr);
  if (!f) {
    go('#/verlauf');
    return;
  }
  const html = renderUrkunde({ name: getSettings().childName, ...f });
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1>Urkunde ${nr}</h1><div class="sub">${f.gesamt} Leseblätter gelesen</div></div></div>
  <div class="preview-wrap" id="uk-pv"></div>
  <div class="bottom">
    <div class="btnrow two">
      <button class="btn green" id="uk-print">Drucken</button>
      <button class="btn ghost" id="uk-pdf">Als PDF teilen</button>
    </div>
  </div>
</div>`;
  await mountPreview(root.querySelector<HTMLElement>('#uk-pv')!, html, { fixedScale: 1 });
  root.querySelector('#uk-print')!.addEventListener('click', () => printSheets([html]));
  root.querySelector('#uk-pdf')!.addEventListener('click', async () => {
    try {
      const name = `Urkunde-${nr}`;
      if ((await sharePdf(await sheetsToPdf([html], `Urkunde ${nr}`), `${name}.pdf`)) === 'gespeichert') toast(`${name}.pdf gespeichert`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.');
    }
  });
}
