import { elternCheck } from '../app/elterncheck';
import { getDraft, getSerie, getSettings, setDraft, setSerieIndex, setSerieItem, setSettings, type Draft } from '../app/state';
import { kopfKompakt, renderSheet } from '../sheet/render';
import { mountPreview } from '../sheet/preview';
import { mitDruckKnopf, printSheets } from '../sheet/print';
import { pdfName, sharePdf, sheetsToPdf } from '../sheet/pdf';
import { log, nextNumber, saveOnPrint } from '../core/db';
import { rerollBlock } from '../core/generator';
import { checkText, unitById, UNIT_IDS } from '../core/letters';
import { genParams, remixCurrent, saveSerieBis } from '../app/actions';
import { backButton, editDialog, esc, go, toast } from '../app/ui';
import { trimOnce } from '../app/fitflow';
import { stolperLink } from './stolper';
import { lesungSpeichern } from '../app/lesezeit';
import type { BlockId, SheetData } from '../core/types';
import { t, themaName } from '../app/i18n';

/** Gewählt, aber mit diesen Buchstaben noch nicht möglich: Sätze / Geschichte – kurz sagen, warum sie fehlen */
export function fehltHinweis(d: SheetData): string {
  const saetze = d.blocks.saetze && !d.saetze.length;
  const geschichte = d.blocks.geschichte && !d.geschichte;
  const key = saetze && geschichte ? 'vorschau.fehltBeide' : saetze ? 'vorschau.fehltSaetze' : geschichte ? 'vorschau.fehltGeschichte' : '';
  return key ? `<div class="hint pv-fehlt">${t(key)}</div>` : '';
}

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
    // C1: bei vielen Buchstaben kurz „36 Buchstaben“ statt der ganzen Liste (wie im Blattkopf)
    const letters = !kopfKompakt(d.data.letters, d.data.newLetter)
      ? d.data.letters.map((id) => unitById(id)?.label.replace('-', '') ?? id).join(' ')
      : d.data.letters.length >= UNIT_IDS.length
        ? t('blatt.alleBuchstaben')
        : t('blatt.buchstaben', { n: d.data.letters.length });
    const neu = d.data.newLetter ? ` · ${t('blatt.neu', { b: unitById(d.data.newLetter)?.label.replace('-', '') ?? '' })}` : '';
    return { nr, title: t('blatt.titel', { nr, thema: themaName(d.data.theme) }), sub: `${letters}${neu}${d.data.stufe ? ` · ${t('blatt.stufe', { n: d.data.stufe })}` : ''}` };
  };

  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1 id="pv-title">${t('vorschau.blatt')}</h1><div class="sub" id="pv-sub"></div></div>
    <button class="pillbtn sy-toggle" id="pv-silben" aria-pressed="false" title="${t('vorschau.silben')}" aria-label="${t('vorschau.silben')}"><span class="sy1">Ma</span><span class="sy2">ma</span></button></div>
  <div class="serie-nav" id="pv-nav"></div>
  <div id="pv-removed"></div>
  <div id="pv-fehlt"></div>
  <div class="preview-wrap" id="pv"></div>
  <div class="hint" style="padding:6px 16px 0">${t('vorschau.hinweis')}</div>
  <div class="bottom">
    <!-- zwei Hauptwege: auf Papier oder am Bildschirm; der Rest kleiner darunter -->
    <div class="btnrow two">
      <button class="btn green" id="print">${t('aktion.drucken')}</button>
      <a class="btn primary" id="screen" href="#/lesen">${t('vorschau.bildschirm')}</a>
    </div>
    <div class="btnrow four">
      <button class="btn ghost sm" id="mix">${t('vorschau.mischen')}</button>
      <button class="btn ghost sm" id="timer">${t('vorschau.timer')}</button>
      <button class="btn ghost sm" id="pdf">${t('aktion.pdf')}</button>
      <button class="btn ghost sm" id="read">${t('vorschau.gelesen')}</button>
    </div>
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
    // in einer Serie eindeutig: nur dieses Blatt wird als gelesen markiert
    root.querySelector('#read')!.textContent = t('vorschau.gelesenNr', { nr: h.nr });
    root.querySelector('#pv-sub')!.textContent = h.sub;
    const rm = root.querySelector<HTMLElement>('#pv-removed')!;
    rm.innerHTML = d.removed.length
      ? `<div class="removed"><b>${t('vorschau.entfernt')}</b> ${d.removed.map((r) => `${esc(r.text)} (${esc(r.missing.join(', '))})`).join(' · ')}</div>`
      : '';
    const sy = root.querySelector<HTMLButtonElement>('#pv-silben')!;
    sy.setAttribute('aria-pressed', String(!!d.data.silbenFarbig));
    sy.classList.toggle('on', !!d.data.silbenFarbig);
    const fertig = await fit(pv, d, h.nr, true);
    setDraft(fertig);
    root.querySelector('#pv-fehlt')!.innerHTML = fehltHinweis(fertig.data);
  };

  // Silben farbig direkt hier umschalten – gilt für alle Blätter der Serie und wird gemerkt
  root.querySelector('#pv-silben')!.addEventListener('click', async () => {
    const cur = getDraft();
    if (!cur) return;
    const an = !cur.data.silbenFarbig;
    setSettings({ ...getSettings(), silbenFarbig: an });
    const serie = getSerie();
    serie?.items.forEach((it, i) => setSerieItem(i, { ...it, data: { ...it.data, silbenFarbig: an } }));
    if (!serie) setDraft({ ...cur, data: { ...cur.data, silbenFarbig: an } });
    await draw();
  });

  /** Alle Blätter der Serie einpassen und der Reihe nach speichern; liefert das Druck-HTML */
  const saveAll = async (printed: boolean | 'none'): Promise<{ html: string[]; first: number; last: number; nums: number[] }> => {
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
    return { html, first: nums[0], last: nums[nums.length - 1], nums };
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

  root.querySelector<HTMLButtonElement>('#print')!.addEventListener('click', (e) =>
    mitDruckKnopf(e.currentTarget as HTMLButtonElement, async () => {
      const { html, nums } = await saveAll(true);
      await printSheets(html, pdfName(nums));
      await draw();
    }),
  );
  root.querySelector<HTMLButtonElement>('#pdf')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      // Nummern vergeben, aber erst ins Protokoll, wenn das PDF wirklich geteilt/gespeichert ist
      const { html, nums } = await saveAll('none');
      const name = pdfName(nums);
      const pdf = await sheetsToPdf(html, name.replace('-', ' '));
      if (!(await elternCheck())) return;
      const r = await sharePdf(pdf, `${name}.pdf`);
      if (r !== 'abgebrochen') for (const nr of nums) await log(`Blatt ${nr} als PDF gespeichert`);
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
    await lesungSpeichern(d.savedId!, getSettings().minutes, true);
    toast(t('blatt.gelesenToast', { nr: d.data.number! }));
    go(stolperLink(d.savedId!, '#/vorschau'));
  });

  draw();
  window.addEventListener('hashchange', () => (disposed = true), { once: true });
}
