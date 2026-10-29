import { getDraft, getSettings } from '../app/state';
import { getSheet } from '../core/db';
import { esc, go, toast } from '../app/ui';
import { createCountdown, recordRead } from '../app/lesezeit';
import { stolperLink } from './stolper';
import type { SheetData } from '../core/types';
import { lesetext } from '../sheet/render';

interface Page {
  title: string;
  html: string;
  /** Wörter/Silben als Raster oder Sätze untereinander */
  kind: 'grid' | 'lines' | 'small';
}

/** Blätter in Bildschirm-Seiten zerlegen – gleiche Reihenfolge wie auf dem Papier. */
export function readingPages(d: SheetData): Page[] {
  const pages: Page[] = [];
  const t = (s: string) => lesetext(s, d.silbenFarbig);
  const grid = (items: string[]) => items.map((w) => `<span>${t(w)}</span>`).join('');
  const lines = (items: string[]) => items.map((s) => `<p>${t(s)}</p>`).join('');
  if (d.blocks.silben && d.silben.length) pages.push({ title: 'Silben', html: grid(d.silben), kind: 'grid' });
  if (d.blocks.woerter && d.woerter.length) pages.push({ title: 'Wörter', html: grid(d.woerter), kind: 'grid' });
  if (d.blocks.kleine && d.kleine.length) pages.push({ title: 'Kleine Wörter', html: grid(d.kleine), kind: 'grid' });
  if (d.blocks.aehnlich && d.aehnlich) {
    const [a, b] = d.aehnlich.pair;
    const title = a === 'l' && b === 'I' ? `Klein ${a} oder groß ${b}?` : `${a} oder ${b}?`;
    const html = d.aehnlich.words
      .map((ws, i) => `<div class="rd-ae"><b>${esc(d.aehnlich!.pair[i])}</b>${ws.map((w) => `<span>${esc(w)}</span>`).join('')}</div>`)
      .join('');
    pages.push({ title, html, kind: 'grid' });
  }
  if (d.blocks.saetze && d.saetze.length) pages.push({ title: 'Sätze', html: lines(d.saetze), kind: 'lines' });
  if (d.blocks.geschichte && d.geschichte) {
    const g = d.geschichte;
    pages.push({ title: g.titel ? `Geschichte: ${g.titel}` : 'Geschichte', html: lines(g.saetze), kind: 'lines' });
  }
  if (d.blocks.quest && d.quest && d.quest.kind !== 'male') {
    const extra = d.quest.words?.length ? `<p class="rd-q">${d.quest.words.map(esc).join(' · ')}</p>` : '';
    pages.push({ title: 'Quest', html: `<p>${esc(d.quest.text)}</p>${extra}`, kind: 'lines' });
  }
  if (d.blocks.fragen && d.fragen.length) pages.push({ title: 'Für Eltern – Fragen', html: lines(d.fragen), kind: 'small' });
  return pages;
}

/**
 * „Am Bildschirm lesen“ (A4): das Blatt Block für Block in großer Schrift,
 * wischen oder „Weiter“, oben läuft die Lesezeit. Bildschirm bleibt an.
 */
export async function renderLesen(root: HTMLElement, params: URLSearchParams): Promise<void> {
  const sheetId = params.get('id') ? Number(params.get('id')) : null;
  const draft = sheetId ? null : getDraft();
  const rec = sheetId ? await getSheet(sheetId) : null;
  const data = rec?.data ?? draft?.data;
  if (!data) {
    go('#/');
    return;
  }
  const back = sheetId ? `#/blatt/${sheetId}` : '#/vorschau';
  // Lesezeit wie zuletzt im Timer gewählt (A6), nicht der Umfang des Blatts
  const minutes = getSettings().minutes;
  const pages = readingPages(data);
  const name = getSettings().childName;
  let idx = 0;

  root.innerHTML = `
<div class="screen lesen">
  <div class="topbar">
    <a class="iconbtn" href="${back}" aria-label="Schließen">✕</a>
    <div class="grow rd-pos" id="rd-pos"></div>
    <button class="pillbtn rd-clock" id="rd-clock" aria-label="Lesezeit starten">▶ <span id="rd-time"></span></button>
  </div>
  <div class="content rd-body" id="rd-body"></div>
  <div class="bottom">
    <div class="btnrow two">
      <button class="btn ghost big" id="rd-prev">Zurück</button>
      <button class="btn primary big" id="rd-next">Weiter</button>
    </div>
  </div>
</div>`;

  const body = root.querySelector<HTMLElement>('#rd-body')!;
  const clockBtn = root.querySelector<HTMLButtonElement>('#rd-clock')!;
  const time = root.querySelector<HTMLElement>('#rd-time')!;

  const showTime = (remaining: number) => {
    const sec = Math.max(0, Math.ceil(remaining));
    time.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  };

  let readId: number | null = null;
  const cd = createCountdown(minutes * 60, {
    tick: showTime,
    done: async () => {
      clockBtn.innerHTML = 'Toll gelesen! ✓';
      clockBtn.classList.add('fertig');
      try {
        const r = await recordRead(sheetId, draft, minutes);
        if (r) {
          readId = r.id;
          toast(`Blatt ${r.number}: gelesen ✓`);
        }
      } catch {
        toast('Lesung konnte nicht gespeichert werden.');
      }
    },
  });

  const syncClock = () => {
    if (cd.done) return;
    clockBtn.firstChild!.textContent = cd.running ? '❚❚ ' : '▶ ';
    clockBtn.setAttribute('aria-label', cd.running ? 'Lesezeit anhalten' : 'Lesezeit starten');
  };

  const draw = () => {
    const p = pages[idx];
    const last = idx === pages.length - 1;
    root.querySelector('#rd-pos')!.textContent = `${idx + 1} / ${pages.length}`;
    body.innerHTML = `<h1>${esc(p.title)}</h1><div class="rd-${p.kind}">${p.html}</div>${
      last ? `<div class="rd-end">${name ? `Super, ${esc(name)}!` : 'Super!'} Das ganze Blatt ist geschafft.</div>` : ''
    }`;
    body.scrollTop = 0;
    (root.querySelector('#rd-prev') as HTMLButtonElement).disabled = idx === 0;
    root.querySelector('#rd-next')!.textContent = last ? 'Fertig' : 'Weiter';
  };

  const next = () => {
    // erstes Weiter startet die Lesezeit, falls noch nicht geschehen
    if (!cd.running && !cd.done && cd.remaining === minutes * 60) {
      cd.start();
      syncClock();
    }
    if (idx < pages.length - 1) {
      idx++;
      draw();
    } else {
      go(readId ? stolperLink(readId, back) : back);
    }
  };
  const prev = () => {
    if (idx > 0) {
      idx--;
      draw();
    }
  };

  clockBtn.addEventListener('click', () => {
    if (cd.done) return;
    if (cd.running) cd.pause();
    else cd.start();
    syncClock();
  });
  root.querySelector('#rd-next')!.addEventListener('click', next);
  root.querySelector('#rd-prev')!.addEventListener('click', prev);

  let x0: number | null = null;
  let y0 = 0;
  body.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    y0 = e.clientY;
  });
  body.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) next();
    else prev();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };
  document.addEventListener('keydown', onKey);

  showTime(minutes * 60);
  draw();
  window.addEventListener(
    'hashchange',
    () => {
      cd.dispose();
      document.removeEventListener('keydown', onKey);
    },
    { once: true },
  );
}
