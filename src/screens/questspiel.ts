import type { Quest, SheetData } from '../core/types';
import { countUnit, unitById, wordsOf } from '../core/letters';
import { sheetReadingWords } from '../core/stolper';
import { mulberry32, shuffle } from '../core/random';
import { esc } from '../app/ui';
import { t } from '../app/i18n';
import { THEMES, raupeOutlineSvg } from '../sheet/themes';

/**
 * Quest am Bildschirm – ganz kleine Spiele statt „Kreise ein“ / „Schreibe in die Kästchen“.
 * Die Anleitung steht klein in der Sprache der Oberfläche (für Eltern),
 * groß stehen nur Wörter aus gelernten Buchstaben.
 */

const FARBEN = ['#FFFFFF', '#9FD18F', '#F2C94C', '#8FCDE6', '#F6B8C8', '#B9A4E8', '#F2A65A'];

function seedOf(d: SheetData): number {
  return (d.number ?? 0) * 7919 + d.woerter.length * 31 + (d.quest?.text.length ?? 0);
}

function label(unit: string): string {
  const l = (unit && unitById(unit)?.label.replace('-', '')) || unit.toUpperCase();
  const k = l.toLowerCase();
  return k !== l ? `${l} / ${k}` : l;
}

/** Wörter für „Finde!“: etwa die Hälfte mit der gesuchten Buchstabe */
export function findeWoerter(d: SheetData, unit: string, n = 8): { w: string; ja: boolean }[] {
  const rng = mulberry32(seedOf(d));
  const all = sheetReadingWords(d).filter((w) => [...w].length >= 2);
  const ja = shuffle(all.filter((w) => countUnit(w, unit) > 0), rng).slice(0, Math.ceil(n / 2));
  const nein = shuffle(all.filter((w) => countUnit(w, unit) === 0), rng).slice(0, n - ja.length);
  return shuffle([...ja.map((w) => ({ w, ja: true })), ...nein.map((w) => ({ w, ja: false }))], rng);
}

/** Wie oft steht das Wort in der Geschichte? */
export function zaehleRichtig(d: SheetData, wort: string): number {
  return (d.geschichte?.saetze ?? []).flatMap(wordsOf).filter((w) => w === wort).length;
}

export function questSpielHtml(q: Quest, d: SheetData): string {
  const hint = (text: string) => `<p class="qs-hint">${esc(text)}</p>`;
  const done = `<p class="qs-done" hidden>⭐ ${esc(t('quest.super'))}</p>`;
  if (q.kind === 'finde' && q.target) {
    const items = findeWoerter(d, q.target);
    return `${hint(t('quest.finde', { x: label(q.target) }))}
<div class="qs-grid" data-qs="finde">${items.map((x) => `<button class="qs-w" data-ja="${x.ja ? 1 : 0}">${esc(x.w)}</button>`).join('')}</div>${done}`;
  }
  if (q.kind === 'geheimwort' && q.target && q.words?.length) {
    const ziel = [...q.target];
    const rng = mulberry32(seedOf(d) + 1);
    const extra = shuffle(
      d.letters.filter((id) => [...id].length === 1 && /\p{L}/u.test(id)).map((id) => id.toUpperCase()).filter((x) => !ziel.includes(x)),
      rng,
    ).slice(0, Math.max(2, 8 - new Set(ziel).size));
    const tasten = shuffle([...new Set([...ziel, ...extra])], rng);
    return `${hint(t('quest.geheim'))}
<div class="qs-geheim" data-qs="geheim" data-ziel="${esc(q.target)}">
  ${q.words.map((w, i) => `<div class="qs-gw"><span class="qs-word">${esc(w)}</span><span class="qs-box" data-i="${i}"></span></div>`).join('')}
</div>
<div class="qs-keys">${tasten.map((k) => `<button class="qs-key" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>${done}`;
  }
  if (q.kind === 'zaehle' && q.target) {
    const richtig = zaehleRichtig(d, q.target);
    const max = Math.max(5, richtig + 2);
    return `${hint(t('quest.zaehle'))}
<p class="qs-ziel">${esc(q.target)}</p>
<div class="qs-keys" data-qs="zaehle" data-richtig="${richtig}">${Array.from({ length: max }, (_, i) => `<button class="qs-key" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>${done}`;
  }
  // „Male!“: Kreise der Raupe antippen, jede Berührung = nächste Farbe
  return `${hint(t('quest.male'))}<div class="qs-male" data-qs="male">${raupeOutlineSvg(THEMES[d.theme])}</div>`;
}

/** Klicks verdrahten (nach dem Einfügen des HTML). */
export function questSpielAktiv(root: HTMLElement): void {
  const box = root.querySelector<HTMLElement>('[data-qs]');
  if (!box) return;
  const doneEl = root.querySelector<HTMLElement>('.qs-done');
  const fertig = () => {
    if (doneEl) doneEl.hidden = false;
  };
  const wackeln = (el: HTMLElement) => {
    el.classList.remove('nein');
    void el.offsetWidth;
    el.classList.add('nein');
  };
  const art = box.dataset.qs;
  if (art === 'finde') {
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.qs-w');
      if (!b || b.classList.contains('ok')) return;
      if (b.dataset.ja === '1') b.classList.add('ok');
      else wackeln(b);
      if (!box.querySelector('.qs-w[data-ja="1"]:not(.ok)')) fertig();
    });
  } else if (art === 'geheim') {
    const ziel = [...(box.dataset.ziel ?? '')];
    const boxes = [...box.querySelectorAll<HTMLElement>('.qs-box')];
    let pos = 0;
    root.querySelector('.qs-keys')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.qs-key');
      if (!b || pos >= ziel.length) return;
      if (b.dataset.k === ziel[pos]) {
        boxes[pos].textContent = ziel[pos];
        boxes[pos].classList.add('ok');
        pos++;
        if (pos === ziel.length) fertig();
      } else wackeln(b);
    });
  } else if (art === 'zaehle') {
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.qs-key');
      if (!b) return;
      if (b.dataset.n === box.dataset.richtig) {
        b.classList.add('ok');
        fertig();
      } else wackeln(b);
    });
  } else if (art === 'male') {
    // weiße Flächen (auch die, die ihre Farbe von der Gruppe erben) werden ausmalbar
    box.querySelectorAll<SVGElement>('circle, path, rect').forEach((el) => {
      const fill = el.getAttribute('fill') ?? el.parentElement?.getAttribute('fill');
      if (fill === '#FFFFFF') {
        el.setAttribute('fill', '#FFFFFF');
        el.classList.add('qs-fill');
      }
    });
    box.addEventListener('click', (e) => {
      const el = (e.target as Element).closest('.qs-fill') as SVGElement | null;
      if (!el) return;
      const i = (FARBEN.indexOf(el.getAttribute('fill') ?? '#FFFFFF') + 1) % FARBEN.length;
      el.setAttribute('fill', FARBEN[i]);
    });
  }
}
