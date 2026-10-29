import { getDraft, getSerie, getSettings, setDraft, setSerieIndex, setSerieItem, type Draft } from '../app/state';
import { renderSheet } from '../sheet/render';
import { mountPreview } from '../sheet/preview';
import { printSheets } from '../sheet/print';
import { sharePdf, sheetsToPdf } from '../sheet/pdf';
import { addRead, nextNumber, saveOnPrint } from '../core/db';
import { rerollBlock } from '../core/generator';
import { checkText, unitById } from '../core/letters';
import { genParams, remixCurrent, saveSerieBis } from '../app/actions';
import { backButton, editDialog, esc, go, toast } from '../app/ui';
import { trimOnce } from '../app/fitflow';
import { stolperLink } from './stolper';
import type { BlockId, SheetData } from '../core/types';
import { t, themaName } from '../app/i18n';

export function renderVorschau(root: HTMLElement): void {
  const draft = getDraft();
  if (!draft) {
    go('#/');
    return;
  }
  let disposed = false;

  /** Nummer, die Blatt i bekommt: gespeicherte behalten ihre, die übrigen der Reihe nach */
  const nrFor = async (i: number) => {
    const items = getSerie()!.items;
    if (items[i].data.number) return items[i].data.number!;
    const unsavedBefore = items.slice(0, i).filter((x) => !x.data.number).length;
    return (await nextNumber()) + unsavedBefore;
  };

  const header = async (d: Draft) => {
    const nr = await nrFor(getSerie()!.idx);
    const letters = d.data.letters.map((id) => unitById(id)?.label.replace('-', '') ?? id).join(' ');
    const neu = d.data.newLetter ? ` · ${t('blatt.neu', { b: unitById(d.data.newLetter)?.label.replace('-', '') ?? '' })}` : '';
    return { nr, title: t('blatt.titel', { nr, thema: themaName(d.data.theme) }), sub: `${letters}${neu}${d.data.stufe ? ` · ${t('blatt.stufe', { n: d.data.stufe })}` : ''}` };
  };

  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1 id="pv-title">${t('vorschau.blatt')}</h1><div class="sub" id="pv-sub"></div></div></div>
  <div class="serie-nav" id="pv-nav"></div>
  <div id="pv-removed"></div>
  <div class="preview-wrap" id="pv"></div>
  <div class="hint" style="padding:6px 16px 0">${t('vorschau.hinweis')}</div>
  <div class="bottom">
    <div class="btnrow">
      <button class="btn ghost" id="mix">${t('vorschau.mischen')}</button>
      <button class="btn green" id="print">${t('aktion.drucken')}</button>
      <button class="btn primary" id="timer">${t('vorschau.timer')}</button>
    </div>
    <div class="btnrow two">
      <button class="btn ghost" id="pdf">${t('aktion.pdf')}</button>
      <button class="btn ghost" id="read">${t('vorschau.gelesen')}</button>
    </div>
    <a class="btn ghost" id="screen" href="#/lesen">${t('vorschau.bildschirm')}</a>
  </div>
</div>`;

  const pv = root.querySelector<HTMLElement>('#pv')!;

  /** Blatt in `host` einpassen; passt es nicht, wird gekürzt, bis es passt */
  const fit = async (host: HTMLElement, d: Draft, nr: number, interactive: boolean): Promise<Draft> => {
    let data: SheetData = d.data;
    let r = await mountPreview(host, renderSheet(data, { displayNumber: nr, interactive }));
    for (let i = 0; i < 40 && !r.fits; i++) {
      const t = trimOnce(data);
      if (!t) break;
      data = t;
      r = await mountPreview(host, renderSheet(data, { displayNumber: nr, interactive }));
    }
    return { ...d, data, scale: r.scale };
  };

  const drawNav = () => {
    const serie = getSerie()!;
    const n = serie.items.length;
    root.querySelector('#pv-nav')!.innerHTML =
      n > 1
        ? `<button class="iconbtn" id="pv-prev" aria-label="${t('vorschau.voriges')}" ${serie.idx === 0 ? 'disabled' : ''}>‹</button>
           <span><b>${serie.idx + 1} / ${n}</b> · ${t('vorschau.alle')}</span>
           <button class="iconbtn" id="pv-next" aria-label="${t('vorschau.naechstes')}" ${serie.idx === n - 1 ? 'disabled' : ''}>›</button>`
        : '';
    root.querySelector('#pv-prev')?.addEventListener('click', () => {
      setSerieIndex(serie.idx - 1);
      draw();
    });
    root.querySelector('#pv-next')?.addEventListener('click', () => {
      setSerieIndex(serie.idx + 1);
      draw();
    });
  };

  const draw = async () => {
    const d = getDraft();
    if (!d || disposed) return;
    drawNav();
    const h = await header(d);
    root.querySelector('#pv-title')!.textContent = h.title;
    root.querySelector('#pv-sub')!.textContent = h.sub;
    const rm = root.querySelector<HTMLElement>('#pv-removed')!;
    rm.innerHTML = d.removed.length
      ? `<div class="removed"><b>${t('vorschau.entfernt')}</b> ${d.removed.map((r) => `${esc(r.text)} (${esc(r.missing.join(', '))})`).join(' · ')}</div>`
      : '';
    setDraft(await fit(pv, d, h.nr, true));
  };

  /** Alle Blätter der Serie einpassen und der Reihe nach speichern; liefert das Druck-HTML */
  const saveAll = async (printed: boolean): Promise<{ html: string[]; first: number; last: number }> => {
    const hidden = document.createElement('div');
    hidden.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px';
    document.body.appendChild(hidden);
    const html: string[] = [];
    const nums: number[] = [];
    try {
      const n = getSerie()!.items.length;
      for (let i = 0; i < n; i++) {
        const fitted = await fit(hidden, getSerie()!.items[i], await nrFor(i), false);
        const rec = await saveOnPrint(fitted.data, fitted.scale, fitted.savedId, printed);
        setSerieItem(i, { ...fitted, data: rec.data, savedId: rec.id ?? null });
        html.push(renderSheet(rec.data, { displayNumber: rec.number, scale: rec.scale }));
        nums.push(rec.number);
      }
    } finally {
      hidden.remove();
    }
    return { html, first: nums[0], last: nums[nums.length - 1] };
  };

  const reroll = async (block: BlockId) => {
    const d = getDraft()!;
    const p = await genParams();
    p.minutes = d.data.minutes;
    p.theme = d.data.theme;
    p.letters = d.data.letters;
    p.newLetter = d.data.newLetter;
    p.blocks = d.data.blocks;
    p.stufe = d.data.stufe;
    setDraft({ ...d, data: rerollBlock(d.data, block, p) });
    await draw();
  };

  const edit = async (key: string) => {
    const d = getDraft()!;
    const [block, idxS] = key.split(':');
    const idx = Number(idxS);
    const data = structuredClone(d.data);
    const list = block === 'geschichte' ? data.geschichte!.saetze : (data[block as 'woerter' | 'kleine' | 'saetze'] as string[]);
    const known = new Set(data.letters);
    const v = await editDialog(t('vorschau.aendern'), list[idx], (s) => {
      if (!s) return null;
      if (/\p{L}-\p{L}/u.test(s)) return t('vorschau.ohneStriche');
      const c = checkText(s, known);
      return c.ok ? null : t('vorschau.nichtGelernt', { b: c.missing.join(', ') });
    });
    if (v === null) return;
    if (v === '') list.splice(idx, 1);
    else list[idx] = v;
    setDraft({ ...d, data });
    await draw();
  };

  pv.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const re = t.closest<HTMLElement>('[data-reroll]');
    if (re) {
      reroll(re.dataset.reroll as BlockId);
      return;
    }
    const ed = t.closest<HTMLElement>('[data-edit]');
    if (ed) edit(ed.dataset.edit!);
  });

  root.querySelector('#print')!.addEventListener('click', async () => {
    const { html } = await saveAll(true);
    printSheets(html);
    await draw();
  });
  root.querySelector<HTMLButtonElement>('#pdf')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const { html, first, last } = await saveAll(false);
      const name = first === last ? `Leseblatt-${first}` : `Leseblaetter-${first}-${last}`;
      const pdf = await sheetsToPdf(html, name.replace('-', ' '));
      const r = await sharePdf(pdf, `${name}.pdf`);
      if (r === 'gespeichert') toast(t('aktion.pdfGespeichert', { name }));
      await draw();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('aktion.pdfFehler'));
    } finally {
      btn.disabled = false;
    }
  });
  root.querySelector('#mix')!.addEventListener('click', async () => {
    await remixCurrent();
    await draw();
  });
  root.querySelector('#timer')!.addEventListener('click', () => go('#/timer'));
  root.querySelector('#read')!.addEventListener('click', async () => {
    const d = await saveSerieBis(getSerie()!.idx);
    await addRead(d.savedId!, getSettings().minutes, true);
    toast(t('blatt.gelesenToast', { nr: d.data.number! }));
    go(stolperLink(d.savedId!, '#/vorschau'));
  });

  draw();
  window.addEventListener('hashchange', () => (disposed = true), { once: true });
}
