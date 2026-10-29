import { getDraft, getSettings, setDraft, type Draft } from '../app/state';
import { renderSheet } from '../sheet/render';
import { mountPreview } from '../sheet/preview';
import { printSheet } from '../sheet/print';
import { sharePdf, sheetToPdf } from '../sheet/pdf';
import { addRead, nextNumber, saveOnPrint } from '../core/db';
import { rerollBlock } from '../core/generator';
import { checkText, unitById } from '../core/letters';
import { genParams, createDraft } from '../app/actions';
import { backButton, editDialog, esc, go, toast } from '../app/ui';
import { THEMES } from '../sheet/themes';
import { trimOnce } from '../app/fitflow';
import type { BlockId, SheetData } from '../core/types';

export function renderVorschau(root: HTMLElement): void {
  const draft = getDraft();
  if (!draft) {
    go('#/');
    return;
  }
  let disposed = false;

  const header = async (d: Draft) => {
    const nr = d.data.number ?? (await nextNumber());
    const letters = d.data.letters.map((id) => unitById(id)?.label.replace('-', '') ?? id).join(' ');
    const neu = d.data.newLetter ? ` · neu: ${unitById(d.data.newLetter)?.label.replace('-', '')}` : '';
    return { nr, title: `Blatt ${nr} · ${THEMES[d.data.theme].name}`, sub: `${d.data.minutes} Minuten · ${letters}${neu}${d.data.stufe ? ` · Stufe ${d.data.stufe}` : ''}` };
  };

  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1 id="pv-title">Blatt</h1><div class="sub" id="pv-sub"></div></div></div>
  <div id="pv-removed"></div>
  <div class="preview-wrap" id="pv"></div>
  <div class="hint" style="padding:6px 16px 0">Wort oder Satz antippen zum Ändern · ↻ mischt nur diesen Block</div>
  <div class="bottom">
    <div class="btnrow">
      <button class="btn ghost" id="mix">Neu mischen</button>
      <button class="btn green" id="print">Drucken</button>
      <button class="btn primary" id="timer">Timer</button>
    </div>
    <div class="btnrow two">
      <button class="btn ghost" id="pdf">Als PDF teilen</button>
      <button class="btn ghost" id="read">Gelesen ✓</button>
    </div>
    <a class="btn ghost" id="screen" href="#/lesen">Am Bildschirm lesen</a>
  </div>
</div>`;

  const pv = root.querySelector<HTMLElement>('#pv')!;

  const draw = async () => {
    const d = getDraft();
    if (!d || disposed) return;
    const h = await header(d);
    root.querySelector('#pv-title')!.textContent = h.title;
    root.querySelector('#pv-sub')!.textContent = h.sub;
    const rm = root.querySelector<HTMLElement>('#pv-removed')!;
    rm.innerHTML = d.removed.length
      ? `<div class="removed"><b>Entfernt:</b> ${d.removed.map((r) => `${esc(r.text)} (${esc(r.missing.join(', '))})`).join(' · ')}</div>`
      : '';
    let data: SheetData = d.data;
    let r = await mountPreview(pv, renderSheet(data, { displayNumber: h.nr, interactive: true }));
    // passt nicht? dann kürzen, bis es passt
    for (let i = 0; i < 40 && !r.fits; i++) {
      const t = trimOnce(data);
      if (!t) break;
      data = t;
      r = await mountPreview(pv, renderSheet(data, { displayNumber: h.nr, interactive: true }));
    }
    setDraft({ ...d, data, scale: r.scale });
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
    const v = await editDialog('Ändern', list[idx], (s) => {
      if (!s) return null;
      if (/\p{L}-\p{L}/u.test(s)) return 'Bitte ohne Silbentrennstriche.';
      const c = checkText(s, known);
      return c.ok ? null : `Nicht gelernt: ${c.missing.join(', ')}`;
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

  const doPrint = async (printed: boolean) => {
    const d = getDraft()!;
    const rec = await saveOnPrint(d.data, d.scale, d.savedId, printed);
    setDraft({ ...d, data: rec.data, savedId: rec.id ?? null });
    printSheet(renderSheet(rec.data, { displayNumber: rec.number, scale: rec.scale }));
    await draw();
  };

  root.querySelector('#print')!.addEventListener('click', () => doPrint(true));
  root.querySelector<HTMLButtonElement>('#pdf')!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const d = getDraft()!;
      const rec = await saveOnPrint(d.data, d.scale, d.savedId, false);
      setDraft({ ...d, data: rec.data, savedId: rec.id ?? null });
      const pdf = await sheetToPdf(renderSheet(rec.data, { displayNumber: rec.number, scale: rec.scale }), `Leseblatt ${rec.number}`);
      const r = await sharePdf(pdf, `Leseblatt-${rec.number}.pdf`);
      if (r === 'gespeichert') toast(`Leseblatt-${rec.number}.pdf gespeichert`);
      await draw();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      btn.disabled = false;
    }
  });
  root.querySelector('#mix')!.addEventListener('click', async () => {
    const keepTheme = getDraft()?.data.theme;
    await createDraft();
    const d = getDraft()!;
    if (keepTheme && getSettings().randomTheme) setDraft({ ...d, data: { ...d.data, theme: keepTheme } });
    await draw();
  });
  root.querySelector('#timer')!.addEventListener('click', () => go('#/timer'));
  root.querySelector('#read')!.addEventListener('click', async () => {
    const d = getDraft()!;
    const rec = await saveOnPrint(d.data, d.scale, d.savedId, 'none');
    setDraft({ ...d, data: rec.data, savedId: rec.id ?? null });
    await addRead(rec.id!, d.data.minutes, true);
    toast(`Blatt ${rec.number}: gelesen ✓`);
    await draw();
  });

  draw();
  window.addEventListener('hashchange', () => (disposed = true), { once: true });
}
