import { getDraft, getSettings, setSettings } from '../app/state';
import { getSheet } from '../core/db';
import { confirmDialog, esc, go, toast, aktuelleRoute, nochAktuell } from '../app/ui';
import { questSpielAktiv, questSpielHtml } from './questspiel';
import { createCountdown, recordRead } from '../app/lesezeit';
import { stolperLink } from './stolper';
import type { SheetData } from '../core/types';
import { lesetext } from '../sheet/render';
import { t } from '../app/i18n';

interface Page {
  title: string;
  html: string;
  /** Wörter/Silben als Raster oder Sätze untereinander */
  kind: 'grid' | 'lines' | 'small' | 'quest';
}

/** Blätter in Bildschirm-Seiten zerlegen – gleiche Reihenfolge wie auf dem Papier. */
export function readingPages(d: SheetData): Page[] {
  const pages: Page[] = [];
  const lt = (s: string) => lesetext(s, d.silbenFarbig);
  // jedes Wort / jede Silbe auf eigener Karte – sonst liest man „Alm All ist alt“ als Satz
  const grid = (items: string[]) => items.map((w) => `<span class="rd-card">${lt(w)}</span>`).join('');
  const lines = (items: string[]) => items.map((s) => `<p>${lt(s)}</p>`).join('');
  if (d.blocks.silben && d.silben.length) pages.push({ title: t('block.silben'), html: grid(d.silben), kind: 'grid' });
  if (d.blocks.woerter && d.woerter.length) pages.push({ title: t('block.woerter'), html: grid(d.woerter), kind: 'grid' });
  if (d.blocks.kleine && d.kleine.length) pages.push({ title: t('block.kleine'), html: grid(d.kleine), kind: 'grid' });
  if (d.blocks.aehnlich && d.aehnlich) {
    const [a, b] = d.aehnlich.pair;
    const title = a === 'l' && b === 'I' ? `Klein ${a} oder groß ${b}?` : `${a} oder ${b}?`;
    const html = d.aehnlich.words
      .map((ws, i) => `<div class="rd-ae"><b>${esc(d.aehnlich!.pair[i])}</b>${ws.map((w) => `<span class="rd-card">${esc(w)}</span>`).join('')}</div>`)
      .join('');
    pages.push({ title, html, kind: 'grid' });
  }
  if (d.blocks.saetze && d.saetze.length) pages.push({ title: t('block.saetze'), html: lines(d.saetze), kind: 'lines' });
  if (d.blocks.geschichte && d.geschichte) {
    const g = d.geschichte;
    pages.push({ title: g.titel ? `${t('block.geschichte')}: ${g.titel}` : t('block.geschichte'), html: lines(g.saetze), kind: 'lines' });
  }
  // Quest als kleines Spiel; Anleitung klein in der Sprache der Oberfläche
  if (d.blocks.quest && d.quest) pages.push({ title: t('block.quest'), html: questSpielHtml(d.quest, d), kind: 'quest' });
  if (d.blocks.fragen && d.fragen.length) pages.push({ title: t('lesen.fragen'), html: lines(d.fragen), kind: 'small' });
  return pages;
}

/** Eine Zeile pro Satz (Zeilenfall): Schrift so weit verkleinern, dass der längste Satz passt. */
export function fitLines(container: HTMLElement, minPx = 22): void {
  const ps = [...container.querySelectorAll<HTMLElement>('.rd-lines p')];
  if (!ps.length) return;
  ps.forEach((p) => {
    p.style.fontSize = '';
    p.style.whiteSpace = 'nowrap';
  });
  let size = parseFloat(getComputedStyle(ps[0]).fontSize) || 40;
  const over = () => ps.some((p) => p.scrollWidth > p.clientWidth + 1);
  while (over() && size > minPx) {
    size -= 2;
    ps.forEach((p) => (p.style.fontSize = `${size}px`));
  }
  // passt selbst klein nicht: dann doch umbrechen
  if (over()) ps.forEach((p) => (p.style.whiteSpace = 'normal'));
}

/**
 * „Am Bildschirm lesen“ (A4): das Blatt Block für Block in großer Schrift,
 * wischen oder „Weiter“, die Lesezeit läuft ab dem Öffnen. Bildschirm bleibt an.
 * Auf der letzten Seite hält die Zeit an: „Fertig ✓“ speichert die Lesung, „Weiterlesen“ lässt sie weiterlaufen.
 */
export async function renderLesen(root: HTMLElement, params: URLSearchParams): Promise<void> {
  const sheetId = params.get('id') ? Number(params.get('id')) : null;
  const draft = sheetId ? null : getDraft();
  const routeNr = aktuelleRoute();
  const rec = sheetId ? await getSheet(sheetId) : null;
  if (!nochAktuell(routeNr)) return;
  const data = rec?.data ?? draft?.data;
  if (!data) {
    go('#/');
    return;
  }
  const back = sheetId ? `#/blatt/${sheetId}` : '#/vorschau';
  // Lesezeit wie zuletzt im Timer gewählt (A6), nicht der Umfang des Blatts
  const minutes = getSettings().minutes;
  let farbig = !!data.silbenFarbig;
  let pages = readingPages(data);
  if (!pages.length) {
    // Blatt ohne Blöcke: nichts zu lesen
    toast(t('start.keinBlock'));
    go(back);
    return;
  }
  const name = getSettings().childName;
  let idx = 0;
  let left = false;

  root.innerHTML = `
<div class="screen lesen">
  <div class="topbar">
    <button class="iconbtn" id="rd-close" aria-label="${t('ui.schliessen')}">✕</button>
    <div class="grow rd-pos" id="rd-pos"></div>
    <button class="pillbtn sy-toggle${data.silbenFarbig ? ' on' : ''}" id="rd-silben" aria-pressed="${!!data.silbenFarbig}" aria-label="${t('vorschau.silben')}"><span class="sy1">Ma</span><span class="sy2">ma</span></button>
    <button class="pillbtn rd-clock" id="rd-clock" aria-label="${t('lesen.starten')}">▶ <span id="rd-time"></span></button>
  </div>
  <div class="content rd-body" id="rd-body"></div>
  <div class="bottom">
    <div class="btnrow two">
      <button class="btn ghost big" id="rd-prev">${t('ui.zurueck')}</button>
      <button class="btn primary big" id="rd-next">${t('timer.weiter')}</button>
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

  // Bildschirm bleibt an, sobald das Lesen geöffnet ist – nicht erst mit der Zeit
  let wake: WakeLockSentinel | null = null;
  const lock = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !left) wake = await navigator.wakeLock.request('screen');
    } catch {
      wake = null;
    }
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') lock();
  };
  document.addEventListener('visibilitychange', onVis);
  lock();

  let readId: number | null = null;
  let gespeichert = false;
  const cd = createCountdown(minutes * 60, {
    tick: showTime,
    done: async () => {
      clockBtn.textContent = t('lesen.toll');
      clockBtn.classList.add('fertig');
      try {
        const r = await recordRead(sheetId, draft, minutes);
        if (r) {
          readId = r.id;
          gespeichert = true;
          toast(t('blatt.gelesenToast', { nr: r.number }));
        }
      } catch {
        toast(t('lesung.fehler'));
      }
    },
  });

  const syncClock = () => {
    if (cd.done) return;
    clockBtn.firstChild!.textContent = cd.running ? '❚❚ ' : '▶ ';
    clockBtn.setAttribute('aria-label', cd.running ? t('lesen.anhalten') : t('lesen.starten'));
  };

  const gestartet = () => cd.running || cd.done || cd.remaining < minutes * 60;
  // am Ende angehalten (nicht von Hand): beim Zurückblättern läuft die Zeit weiter
  let amEndeAngehalten = false;

  const draw = () => {
    const p = pages[idx];
    const last = idx === pages.length - 1;
    root.querySelector('#rd-pos')!.textContent = `${idx + 1} / ${pages.length}`;
    if (last && cd.running) {
      cd.pause();
      amEndeAngehalten = true;
      syncClock();
    }
    const ende = last
      ? `<div class="rd-end">${name ? t('lesen.endeName', { name: esc(name) }) : t('lesen.ende')}</div>
         ${!cd.done && gestartet() ? `<button class="btn ghost" id="rd-more">▶ ${t('lesen.weiterlesen')}</button>` : ''}
         <p class="qs-hint">${t('lesen.stolperHinweis')}</p>`
      : '';
    body.innerHTML = `<h1>${esc(p.title)}</h1><div class="rd-${p.kind}">${p.html}</div>${ende}`;
    body.scrollTop = 0;
    if (p.kind === 'lines') fitLines(body);
    if (p.kind === 'quest') questSpielAktiv(body);
    (root.querySelector('#rd-prev') as HTMLButtonElement).disabled = idx === 0;
    root.querySelector('#rd-next')!.textContent = last ? t('lesen.fertigOk') : t('timer.weiter');
    root.querySelector('#rd-more')?.addEventListener('click', () => {
      amEndeAngehalten = false;
      cd.start();
      syncClock();
      idx = 0;
      draw();
    });
  };

  const leave = (to: string) => {
    left = true;
    go(to);
  };

  /** „Fertig ✓“: Lesung mit der tatsächlichen Zeit speichern, dann „Wo hat es gestockt?“ */
  const finish = async () => {
    if (readId) return leave(stolperLink(readId, back));
    if (!gestartet()) return leave(back);
    cd.pause();
    const sec = minutes * 60 - cd.remaining;
    const min = Math.max(1, Math.round(sec / 60));
    try {
      const r = await recordRead(sheetId, draft, min);
      if (r) {
        gespeichert = true;
        toast(t('blatt.gelesenToast', { nr: r.number }));
        return leave(stolperLink(r.id, back));
      }
    } catch {
      toast(t('lesung.fehler'));
    }
    leave(back);
  };

  const next = () => {
    if (idx < pages.length - 1) {
      idx++;
      draw();
    } else finish();
  };
  const prev = () => {
    if (idx > 0) {
      idx--;
      if (amEndeAngehalten && !cd.done) {
        amEndeAngehalten = false;
        cd.start();
        syncClock();
      }
      draw();
    }
  };

  /** Versehentliches Schließen: nachfragen, wenn gelesen wird und noch nichts gespeichert ist */
  const darfGehen = async () => {
    if (gespeichert || !gestartet() || cd.done) return true;
    return confirmDialog(t('lesen.beenden'), t('lesen.beendenJa'), t('lesen.weiterlesen'));
  };
  root.querySelector('#rd-close')!.addEventListener('click', async () => {
    if (await darfGehen()) leave(back);
  });
  // Android-Zurück: ein eigener Verlaufseintrag fängt den ersten Schritt zurück ab
  history.pushState({ lesen: true }, '', location.href);
  const onPop = async () => {
    if (left) return;
    if (await darfGehen()) leave(back);
    else history.pushState({ lesen: true }, '', location.href);
  };
  window.addEventListener('popstate', onPop);

  clockBtn.addEventListener('click', () => {
    if (cd.done) return;
    amEndeAngehalten = false;
    if (cd.running) cd.pause();
    else cd.start();
    syncClock();
  });
  // Silben farbig während des Lesens umschalten (nur Anzeige; wird für die nächsten Blätter gemerkt)
  root.querySelector('#rd-silben')!.addEventListener('click', (e) => {
    farbig = !farbig;
    const b = e.currentTarget as HTMLButtonElement;
    b.classList.toggle('on', farbig);
    b.setAttribute('aria-pressed', String(farbig));
    setSettings({ ...getSettings(), silbenFarbig: farbig });
    pages = readingPages({ ...data, silbenFarbig: farbig });
    draw();
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
  const onResize = () => {
    if (pages[idx]?.kind === 'lines') fitLines(body);
  };
  window.addEventListener('resize', onResize);

  showTime(minutes * 60);
  // Lesezeit läuft ab dem Öffnen (Pause oben rechts) – eine klare Regel statt „ab dem ersten Weiter“
  cd.start();
  syncClock();
  draw();
  window.addEventListener(
    'hashchange',
    () => {
      left = true;
      cd.dispose();
      wake?.release().catch(() => undefined);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('resize', onResize);
    },
    { once: true },
  );
}
