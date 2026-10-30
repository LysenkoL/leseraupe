import { t as tr } from '../app/i18n';
import type { BlockId, SheetData } from '../core/types';
import { unitById } from '../core/letters';
import { esc } from '../core/html';
import { silbenVon } from '../core/dict';
import { THEMES, raupeSvg, raupeOutlineSvg, decoSvg } from './themes';

export interface RenderOptions {
  /** Nummer, die im Kopf und in der Perle steht (bei noch nicht vergebener Nummer: die nächste) */
  displayNumber: number | null;
  /** ↻-Knöpfe an den Blöcken (nur Vorschau) */
  interactive?: boolean;
  /** Schriftskala (aus fitSheet) */
  scale?: number;
}

const QUEST_LABEL = { finde: 'Finde!', zaehle: 'Zähle!', male: 'Male!', geheimwort: 'Geheimwort' } as const;

function colW(items: string[]): string {
  const max = items.reduce((m, s) => Math.max(m, [...s].length), 2);
  return `${(max * 0.62 + 1.4).toFixed(2)}em`;
}

function editAttr(edit: string | null, i: number): string {
  return edit ? ` data-edit="${edit}:${i}"` : '';
}

/**
 * Lesetext als HTML; mit „Silben farbig“ (B3) bekommt jede Silbe abwechselnd eine Farbe –
 * ohne Strich und ohne Lücke, jedes Wort beginnt mit der ersten Farbe.
 */
export function lesetext(s: string, farbig: boolean | undefined): string {
  if (!farbig) return esc(s);
  return s
    .split(/(\p{L}+)/u)
    .map((part, i) =>
      i % 2 ? silbenVon(part).map((sy, k) => `<span class="sy${(k % 2) + 1}">${esc(sy)}</span>`).join('') : esc(part),
    )
    .join('');
}

function grid(items: string[], cls: string, edit: string | null, farbig?: boolean): string {
  return `<div class="sh-grid ${cls}" style="--colw:${colW(items)}">${items.map((w, i) => `<span${editAttr(edit, i)}>${lesetext(w, farbig)}</span>`).join('')}</div>`;
}

function blockHead(n: number, title: string, id: BlockId, interactive: boolean): string {
  const re = interactive ? `<button class="blk-re" type="button" data-reroll="${id}" aria-label="${tr('vorschau.blockMischen')}">↻</button>` : '';
  return `<div class="blk-h"><span class="blk-n">${n}</span><h2>${esc(title)}</h2>${re}</div>`;
}

export function renderSheet(d: SheetData, opt: RenderOptions): string {
  const t = THEMES[d.theme];
  const interactive = !!opt.interactive;
  const nr = opt.displayNumber;

  const letters = d.letters
    .map((id) => {
      const u = unitById(id);
      if (!u) return '';
      const wide = u.circle.length > 2 ? ' wide' : '';
      const neu = id === d.newLetter ? ' neu' : '';
      return `<span class="sh-l${wide}${neu}">${esc(u.circle)}</span>`;
    })
    .join('');

  const head = `
<header class="sh-head">
  <div class="sh-headtext">
    <div class="sh-title" data-zone="title"><h1>Ich lese!</h1><span class="sh-pill">Thema: ${esc(t.name)}</span></div>
    <div class="sh-letters" data-zone="letters">${letters}</div>
    <div class="sh-namedate" data-zone="namedate">
      <span class="lbl">Name:</span><span class="sh-name">${esc(d.childName)}</span>
      <span class="lbl">Datum:</span><span class="sh-date"></span>
    </div>
  </div>
  <div class="sh-headdeco" data-slotzone="head">
    ${t.headDeco.map((s, i) => `<div class="deco deco-h${i}" data-deco>${decoSvg(s)}</div>`).join('')}
  </div>
  <div class="sh-raupe" data-zone="raupe">${raupeSvg(t, 'sh-raupe-svg')}<span class="sh-blatt">${nr ? `Blatt ${nr}` : 'Blatt'}</span></div>
</header>
<div class="sh-strip" data-slotzone="strip"><svg class="deco" data-deco viewBox="0 0 720 24" preserveAspectRatio="none" aria-hidden="true">${t.strip}</svg></div>`;

  const blocks: string[] = [];
  let n = 0;
  let alt = false;
  const section = (id: BlockId, title: string, body: string, extra = '') => {
    n++;
    alt = !alt;
    return `<section class="blk blk-${id}${alt ? '' : ' alt'}${extra}" data-zone="block" data-block="${id}">${blockHead(n, title, id, interactive)}${body}</section>`;
  };

  if (d.blocks.silben && d.silben.length) blocks.push(section('silben', 'Silben', grid(d.silben, 'g-silben', null)));
  if (d.blocks.woerter && d.woerter.length) blocks.push(section('woerter', 'Wörter', grid(d.woerter, 'g-woerter', interactive ? 'woerter' : null, d.silbenFarbig)));
  if (d.blocks.kleine && d.kleine.length) blocks.push(section('kleine', 'Kleine Wörter', grid(d.kleine, 'g-kleine', interactive ? 'kleine' : null, d.silbenFarbig)));
  if (d.blocks.aehnlich && d.aehnlich) {
    const [a, b] = d.aehnlich.pair;
    const title = a.toLowerCase() === b.toLowerCase() || (a === 'l' && b === 'I') ? `Klein ${a} oder groß ${b}?` : `${a} oder ${b}?`;
    const panel = (letter: string, words: string[], cls: string) =>
      `<div class="ae-panel ${cls}"><span class="ae-big">${esc(letter)}</span><span class="ae-words">${words.map(esc).join(' · ') || '&nbsp;'}</span></div>`;
    blocks.push(section('aehnlich', title, `<div class="ae-row">${panel(a, d.aehnlich.words[0], 'p1')}${panel(b, d.aehnlich.words[1], 'p2')}</div>`));
  }

  const saetze =
    d.blocks.saetze && d.saetze.length ? () => section('saetze', 'Sätze', `<div class="sh-lines">${d.saetze.map((s, i) => `<p${editAttr(interactive ? 'saetze' : null, i)}>${lesetext(s, d.silbenFarbig)}</p>`).join('')}</div>`) : null;
  const gesch =
    d.blocks.geschichte && d.geschichte && d.geschichte.saetze.length
      ? () => {
          const g = d.geschichte!;
          const lines = g.saetze
            .map((s, i) => `<p${i === g.saetze.length - 1 && s.trim().endsWith('!') ? ' class="hl"' : ''}${editAttr(interactive ? 'geschichte' : null, i)}>${lesetext(s, d.silbenFarbig)}</p>`)
            .join('');
          return section('geschichte', g.titel ? `Geschichte: ${g.titel}` : 'Geschichte', `<div class="sh-lines">${lines}</div>`, ' story');
        }
      : null;
  if (saetze && gesch) blocks.push(`<div class="blk-row">${saetze()}${gesch()}</div>`);
  else if (saetze) blocks.push(saetze());
  else if (gesch) blocks.push(gesch());

  if (d.blocks.quest && d.quest) {
    const q = d.quest;
    let extra = '';
    if (q.kind === 'zaehle') extra = `<span class="q-box"></span>`;
    if (q.kind === 'geheimwort' && q.target) {
      // Wörter und Kästchen bleiben zusammen in einer Zeile
      extra = `<span class="q-gw"><span class="q-words">${(q.words ?? []).map((w) => `<u>${esc(w)}</u>`).join(' · ')}</span><span class="q-secret">${[...q.target].map(() => '<span></span>').join('')}</span></span>`;
    }
    const male = q.kind === 'male' ? raupeOutlineSvg(t) : '';
    blocks.push(
      `<section class="blk-quest" data-zone="quest" data-block="quest"><span class="q-label">Quest · ${QUEST_LABEL[q.kind]}</span><span class="q-text">${esc(q.text)}</span>${extra}${male}${
        interactive ? `<button class="blk-re" type="button" data-reroll="quest" aria-label="${tr('vorschau.blockMischen')}">↻</button>` : ''
      }</section>`,
    );
  }

  const fragen =
    d.blocks.fragen && d.blocks.geschichte && d.fragen.length
      ? `<span class="f-h">Für Eltern – Fragen zur Geschichte:</span><span class="f-q">${d.fragen.map(esc).join(' · ')}</span>`
      : '';

  const foot = `
<footer class="sh-foot">
  <div class="sh-eltern" data-zone="eltern">${fragen}</div>
  <div class="sh-footdeco" data-slotzone="foot"><div class="deco" data-deco>${decoSvg(t.footDeco)}</div></div>
  <div class="sh-perle" data-zone="perle">${nr ?? ''}</div>
</footer>`;

  const style = `--main:${t.main};--light:${t.light};--border:${t.border};--fs:${(opt.scale ?? 1).toFixed(3)}`;
  return `<div class="sheet theme-${t.id} m${d.minutes}" style="${style}">${head}<main class="sh-blocks">${blocks.join('')}</main>${foot}</div>`;
}
