import { RaupenMaler, REGENBOGEN } from '../sheet/raupenbild';
import { getDraft, getSettings, setSettings } from '../app/state';
import { getSheet } from '../core/db';
import { esc, toast, aktuelleRoute, nochAktuell } from '../app/ui';
import { createCountdown, recordRead } from '../app/lesezeit';
import { stolperLink } from './stolper';
import { t } from '../app/i18n';

export const TIMER_WAHL = [5, 10, 15, 20];
export const TIMER_MAX = 60;

/** Perlen der Raupe: bis 15 Minuten eine je Minute, darüber eine je 2, 3 … Minuten */
export function perlenSchritt(minutes: number): number {
  return Math.ceil(minutes / 15);
}

/**
 * Perlen bleiben immer gleich groß. Passen sie nicht in eine Reihe, windet sich die Raupe
 * stärker (größere Welle) statt kleiner zu werden. Perle 0 ist das Schwanzende.
 */
export const RAUPE_Y = 60;
export function raupeLayout(zahl: number): { pos: { x: number; y: number }[]; amp: number } {
  const step = 35;
  const start = 400 - 40 - 48; // erste Perle direkt hinter dem Kopf
  const links = 18;
  const welle = (amp: number) => (x: number) => RAUPE_Y - amp * Math.sin(((start - x) * 2 * Math.PI) / 130);
  // entlang der Kurve gehen und Perlen im Abstand „step“ setzen
  const setzen = (amp: number) => {
    const y = welle(amp);
    const pos = [{ x: start, y: y(start) }];
    let x = start;
    while (pos.length < zahl && x > links) {
      x -= 0.5;
      const p = pos[pos.length - 1];
      if (Math.hypot(p.x - x, p.y - y(x)) >= step) pos.push({ x, y: y(x) });
    }
    return pos;
  };
  let amp = 5;
  let pos = setzen(amp);
  while (pos.length < zahl && amp < 60) pos = setzen((amp += 1));
  return { pos: pos.reverse(), amp };
}

export function raupeSvg(n: number, zahl: number): string {
  const r = 15;
  const { pos, amp } = raupeLayout(zahl);
  // Welle kann über den Kopf hinausgehen: Rahmen an die Perlen anpassen
  const oben = Math.min(0, RAUPE_Y - amp - 18);
  const h = Math.max(86, RAUPE_Y + amp + 18) - oben;
  // wie auf dem App-Icon: gelesene Minuten als Regenbogen-Perlen, Kopf mit Fühlern
  const m = new RaupenMaler();
  let s = '';
  pos.forEach(({ x, y }, i) => {
    const farbe = REGENBOGEN[Math.min(REGENBOGEN.length - 1, Math.floor((i * REGENBOGEN.length) / zahl))];
    s += i < n ? m.perle(x, y, r, farbe, undefined, 'voll') : m.leer(x, y, r, '#6B7AA6', 'none');
  });
  s += m.kopf(400 - 40, 50, 26);
  return m.svg(`0 ${oben.toFixed(1)} 400 ${h.toFixed(1)}`, s, `aria-label="${n} von ${zahl} Perlen"`);
}

/**
 * Vollbild-Timer: Wake Lock, Perlen, Ton + Vibration am Ende.
 * Die Zeit wählt man vor dem Start (A6), unabhängig vom Blatt; sie wird gemerkt.
 */
export function renderTimer(root: HTMLElement, params: URLSearchParams): void {
  const sheetId = params.get('id') ? Number(params.get('id')) : null;
  const draft = getDraft();
  const minutes = Number(params.get('min')) || getSettings().minutes;
  const total = minutes * 60;
  const schritt = perlenSchritt(minutes);
  const perlenZahl = Math.ceil(minutes / schritt);
  const name = getSettings().childName;

  const back = sheetId ? `#/blatt/${sheetId}` : draft ? '#/vorschau' : '#/';
  // Timer ist fürs Lesen auf Papier – sagen, was gelesen wird, und den Weg zum Bildschirm zeigen
  const nr = sheetId ? null : draft?.data.number;
  const lesenLink = sheetId ? `#/lesen?id=${sheetId}` : draft ? '#/lesen' : '';
  const papier = nr ? t('timer.papierNr', { nr }) : t('timer.papier');
  const nrLabel = sheetId ? '' : draft?.data.number ? t('timer.blattNr', { nr: draft.data.number }) : '';

  root.innerHTML = `
<div class="screen timer">
  <div class="topbar"><a class="iconbtn dark" href="${back}" aria-label="${t('ui.schliessen')}">✕</a><div class="grow tcenter" id="t-top">${esc(nrLabel)}${t('timer.lesezeit')}</div><span style="width:44px"></span></div>
  <div class="t-main">
    <div class="t-hello">${name ? t('timer.halloName', { name: esc(name) }) : t('timer.hallo')}</div>
    ${lesenLink ? `<div class="t-papier">${esc(papier)} · <a href="${lesenLink}">${t('vorschau.bildschirm')}</a></div>` : ''}
    <div class="t-digits" id="t-digits" aria-live="off">00:00</div>
    <div class="t-sub" id="t-sub">${t('timer.uebrig', { n: minutes })}</div>
    <div class="t-wahl" id="t-wahl">
      ${TIMER_WAHL.map((m) => `<button class="chip${m === minutes ? ' on' : ''}" data-tmin="${m}">${t('timer.min', { n: m })}</button>`).join('')}
      <button class="chip" data-tstep="-5" aria-label="${t('timer.weniger')}" ${minutes <= 5 ? 'disabled' : ''}>−</button>
      <button class="chip" data-tstep="5" aria-label="${t('timer.mehr')}" ${minutes >= TIMER_MAX ? 'disabled' : ''}>+</button>
    </div>
    <div class="t-raupe" id="t-raupe"></div>
    <div class="t-hint">${schritt === 1 ? t('timer.perleMinute') : t('timer.perleN', { n: schritt })}</div>
  </div>
  <div class="bottom dark">
    <div class="btnrow two">
      <button class="btn primary big" id="t-start">${t('timer.start')}</button>
      <button class="btn outline big" id="t-reset" disabled>${t('timer.neustart')}</button>
    </div>
    <div class="t-foot">${t('timer.fuss')}</div>
  </div>
</div>`;

  const digits = root.querySelector<HTMLElement>('#t-digits')!;
  const startBtn = root.querySelector<HTMLButtonElement>('#t-start')!;
  const raupe = root.querySelector<HTMLElement>('#t-raupe')!;

  const perlen = (n: number) => {
    raupe.innerHTML = raupeSvg(n, perlenZahl);
  };

  const show = (remaining: number) => {
    const sec = Math.max(0, Math.ceil(remaining));
    digits.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    perlen(Math.min(perlenZahl, Math.floor((total - remaining) / 60 / schritt)));
  };

  let readId: number | null = null;
  const cd = createCountdown(total, {
    tick: show,
    done: async () => {
      root.querySelector('#t-sub')!.innerHTML = `<span class="t-toll">${t('timer.toll')}</span>`;
      startBtn.textContent = t('timer.fertig');
      try {
        const r = await recordRead(sheetId, draft, minutes);
        if (r) {
          readId = r.id;
          toast(t('blatt.gelesenToast', { nr: r.number }));
        }
      } catch {
        toast(t('lesung.fehler'));
      }
    },
  });

  // Zeit wählen geht nur vor dem Start; neue Wahl zeichnet den Timer neu
  const wahl = root.querySelector<HTMLElement>('#t-wahl')!;
  const neueZeit = (m: number) => {
    const n = Math.min(TIMER_MAX, Math.max(5, m));
    setSettings({ ...getSettings(), minutes: n });
    cd.dispose();
    const q = new URLSearchParams(params);
    q.delete('min');
    renderTimer(root, q);
  };
  wahl.querySelectorAll<HTMLButtonElement>('[data-tmin]').forEach((b) => b.addEventListener('click', () => neueZeit(Number(b.dataset.tmin))));
  wahl.querySelectorAll<HTMLButtonElement>('[data-tstep]').forEach((b) => b.addEventListener('click', () => neueZeit(minutes + Number(b.dataset.tstep))));

  startBtn.addEventListener('click', () => {
    if (cd.done) {
      // danach freiwillig: Wo hat das Kind gestockt? (B2)
      location.hash = readId ? stolperLink(readId, back) : back;
    } else if (cd.running) {
      cd.pause();
      startBtn.textContent = t('timer.weiter');
    } else {
      cd.start();
      wahl.hidden = true;
      resetBtn.disabled = false;
      startBtn.textContent = t('timer.pause');
    }
  });
  // Zurücksetzen erst, wenn die Zeit schon einmal lief
  const resetBtn = root.querySelector<HTMLButtonElement>('#t-reset')!;
  resetBtn.addEventListener('click', () => {
    cd.reset();
    resetBtn.disabled = true;
    wahl.hidden = false;
    startBtn.textContent = t('timer.start');
    root.querySelector('#t-sub')!.textContent = t('timer.uebrig', { n: minutes });
  });

  const routeNr = aktuelleRoute();
  if (sheetId) getSheet(sheetId).then((r) => r && nochAktuell(routeNr) && (root.querySelector('#t-top')!.textContent = t('timer.blattNr', { nr: r.number }) + t('timer.lesezeit')));

  show(total);
  window.addEventListener('hashchange', () => cd.dispose(), { once: true });
}
