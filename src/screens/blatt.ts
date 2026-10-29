import { addRead, getSheet, saveOnPrint, statusOf } from '../core/db';
import { renderSheet } from '../sheet/render';
import { mountPreview } from '../sheet/preview';
import { printSheet } from '../sheet/print';
import { sharePdf, sheetToPdf } from '../sheet/pdf';
import { backButton, esc, formatDate, go, toast } from '../app/ui';
import { THEMES } from '../sheet/themes';
import { getSettings } from '../app/state';

/** Ein gespeichertes Blatt: genau so wieder drucken, Timer, „gelesen“ von Hand. */
export function renderBlatt(root: HTMLElement, id: number): void {
  root.innerHTML = `<div class="screen"><div class="topbar">${backButton('#/verlauf')}<div class="grow"><h1 id="b-t">Blatt</h1><div class="sub" id="b-s"></div></div></div>
  <div class="preview-wrap" id="b-pv"></div>
  <div class="bottom">
    <div class="btnrow"><button class="btn ghost" id="b-read">Gelesen ✓</button><button class="btn green" id="b-print">Nochmal drucken</button><button class="btn primary" id="b-timer">Timer</button></div>
    <div class="btnrow two"><button class="btn ghost" id="b-pdf">Als PDF teilen</button><a class="btn ghost" href="#/lesen?id=${id}">Am Bildschirm lesen</a></div>
  </div></div>`;
  const draw = async () => {
    const r = await getSheet(id);
    if (!r) {
      go('#/verlauf');
      return;
    }
    root.querySelector('#b-t')!.textContent = `Blatt ${r.number} · ${THEMES[r.data.theme].name}`;
    const reads = r.reads.length ? ` · gelesen: ${r.reads.map((x) => formatDate(x.at)).join(', ')}` : '';
    root.querySelector('#b-s')!.textContent = `${formatDate(r.createdAt)} · ${statusOf(r)}${reads}`;
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
      if ((await sharePdf(pdf, `Leseblatt-${r.number}.pdf`)) === 'gespeichert') toast(`Leseblatt-${r.number}.pdf gespeichert`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.');
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
    toast(`Blatt ${esc(String(r.number))}: gelesen ✓`);
    draw();
  });
}
