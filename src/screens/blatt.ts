import { elternCheck } from '../app/elterncheck';
import { addRead, getSheet, saveOnPrint, statusOf } from '../core/db';
import { renderSheet } from '../sheet/render';
import { mountPreview } from '../sheet/preview';
import { printSheet } from '../sheet/print';
import { sharePdf, sheetToPdf } from '../sheet/pdf';
import { backButton, formatDate, go, toast, aktuelleRoute, nochAktuell } from '../app/ui';
import { getSettings } from '../app/state';
import { stolperLink } from './stolper';
import { t, themaName } from '../app/i18n';

/** Ein gespeichertes Blatt: genau so wieder drucken, Timer, „gelesen“ von Hand. */
export function renderBlatt(root: HTMLElement, id: number): void {
  const routeNr = aktuelleRoute();
  root.innerHTML = `<div class="screen"><div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1 id="b-t">${t('vorschau.blatt')}</h1><div class="sub" id="b-s"></div></div></div>
  <div class="preview-wrap" id="b-pv"></div>
  <div class="bottom">
    <div class="btnrow"><button class="btn ghost" id="b-read">${t('vorschau.gelesen')}</button><button class="btn green" id="b-print">${t('blatt.nochmal')}</button><button class="btn primary" id="b-timer">${t('vorschau.timer')}</button></div>
    <div class="btnrow two"><button class="btn ghost" id="b-pdf">${t('aktion.pdf')}</button><a class="btn ghost" href="#/lesen?id=${id}">${t('vorschau.bildschirm')}</a></div>
  </div></div>`;
  const draw = async () => {
    const r = await getSheet(id);
    if (!nochAktuell(routeNr)) return;
    if (!r) {
      go('#/verlauf');
      return;
    }
    root.querySelector('#b-t')!.textContent = t('blatt.titel', { nr: r.number, thema: themaName(r.data.theme) });
    const reads = r.reads.length ? ` · ${t('blatt.gelesenAm', { daten: r.reads.map((x) => formatDate(x.at)).join(', ') })}` : '';
    root.querySelector('#b-s')!.textContent = `${formatDate(r.createdAt)} · ${t(`status.${statusOf(r)}`)}${reads}`;
    await mountPreview(root.querySelector('#b-pv')!, renderSheet(r.data, { displayNumber: r.number, scale: r.scale }), { fixedScale: r.scale });
    return r;
  };
  draw();
  root.querySelector('#b-print')!.addEventListener('click', async () => {
    const r = await getSheet(id);
    if (!r) return;
    await saveOnPrint(r.data, r.scale, id, true);
    printSheet(renderSheet(r.data, { displayNumber: r.number, scale: r.scale }));
    draw();
  });
  root.querySelector<HTMLButtonElement>('#b-pdf')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const r = await getSheet(id);
    if (!r) return;
    btn.disabled = true;
    try {
      const pdf = await sheetToPdf(renderSheet(r.data, { displayNumber: r.number, scale: r.scale }), `Leseblatt ${r.number}`);
      if (!(await elternCheck())) return;
      if ((await sharePdf(pdf, `Leseblatt-${r.number}.pdf`)) === 'gespeichert') toast(t('aktion.pdfGespeichert', { name: `Leseblatt-${r.number}` }));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('aktion.pdfFehler'));
    } finally {
      btn.disabled = false;
    }
  });
  root.querySelector('#b-timer')!.addEventListener('click', async () => {
    const r = await getSheet(id);
    if (r) go(`#/timer?id=${id}`);
  });
  root.querySelector('#b-read')!.addEventListener('click', async () => {
    const r = await getSheet(id);
    if (!r) return;
    await addRead(id, getSettings().minutes, true);
    toast(t('blatt.gelesenToast', { nr: r.number }));
    go(stolperLink(id, `#/blatt/${id}`));
  });
}
