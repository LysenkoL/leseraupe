import { elternCheck } from '../app/elterncheck';
import { dayKey, getSheet, saveOnPrint, statusOf } from '../core/db';
import { renderSheet } from '../sheet/render';
import { mountPreview } from '../sheet/preview';
import { mitDruckKnopf, printSheet } from '../sheet/print';
import { sharePdf, sheetToPdf } from '../sheet/pdf';
import { backButton, confirmDialog, formatDate, go, toast, aktuelleRoute, nochAktuell } from '../app/ui';
import { getSettings } from '../app/state';
import { stolperLink } from './stolper';
import { lesungSpeichern } from '../app/lesezeit';
import { t, themaName } from '../app/i18n';

/** Ein gespeichertes Blatt: genau so wieder drucken, Timer, „gelesen“ von Hand. */
export function renderBlatt(root: HTMLElement, id: number): void {
  const routeNr = aktuelleRoute();
  root.innerHTML = `<div class="screen"><div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1 id="b-t">${t('vorschau.blatt')}</h1><div class="sub" id="b-s"></div></div></div>
  <div class="preview-wrap" id="b-pv"></div>
  <div class="bottom">
    <!-- wie in der Vorschau: zwei Hauptwege groß, der Rest kleiner darunter -->
    <div class="btnrow two"><button class="btn green" id="b-print">${t('blatt.nochmal')}</button><a class="btn primary" href="#/lesen?id=${id}">${t('vorschau.bildschirm')}</a></div>
    <div class="btnrow four"><button class="btn ghost sm" id="b-timer">${t('vorschau.timer')}</button><button class="btn ghost sm" id="b-pdf">${t('aktion.pdf')}</button><button class="btn ghost sm" id="b-read">${t('vorschau.gelesen')}</button></div>
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
    // heute schon gelesen: der Knopf sagt es (und fragt vor einer zweiten Lesung)
    const heute = r.reads.some((x) => dayKey(new Date(x.at)) === dayKey(new Date()));
    const lesenBtn = root.querySelector<HTMLButtonElement>('#b-read')!;
    lesenBtn.textContent = t(heute ? 'blatt.heuteGelesen' : 'vorschau.gelesen');
    lesenBtn.classList.toggle('erledigt', heute);
    await mountPreview(root.querySelector('#b-pv')!, renderSheet(r.data, { displayNumber: r.number, scale: r.scale }), { fixedScale: r.scale });
    return r;
  };
  draw();
  root.querySelector<HTMLButtonElement>('#b-print')!.addEventListener('click', (e) =>
    mitDruckKnopf(e.currentTarget as HTMLButtonElement, async () => {
      const r = await getSheet(id);
      if (!r) return;
      await saveOnPrint(r.data, r.scale, id, true);
      await printSheet(renderSheet(r.data, { displayNumber: r.number, scale: r.scale }), `Leseblatt-${r.number}`);
      draw();
    }),
  );
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
    const heute = r.reads.some((x) => dayKey(new Date(x.at)) === dayKey(new Date()));
    if (heute && !(await confirmDialog(t('blatt.nochmalGelesen'), t('blatt.nochmalGelesenJa')))) return;
    await lesungSpeichern(id, getSettings().minutes, true);
    toast(t('blatt.gelesenToast', { nr: r.number }));
    go(stolperLink(id, `#/blatt/${id}`));
  });
}
