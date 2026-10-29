import { getDraft, getSettings } from '../app/state';
import { getSheet } from '../core/db';
import { esc, toast } from '../app/ui';
import { createCountdown, recordRead } from '../app/lesezeit';

/** Vollbild-Timer: Wake Lock, Perlen pro Minute, Ton + Vibration am Ende. */
export function renderTimer(root: HTMLElement, params: URLSearchParams): void {
  const sheetId = params.get('id') ? Number(params.get('id')) : null;
  const draft = getDraft();
  const minutes = Number(params.get('min')) || (draft?.data.minutes ?? getSettings().minutes);
  const total = minutes * 60;
  const name = getSettings().childName;

  const back = sheetId ? `#/blatt/${sheetId}` : draft ? '#/vorschau' : '#/';
  const nrLabel = sheetId ? '' : draft?.data.number ? `Blatt ${draft.data.number} · ` : '';

  root.innerHTML = `
<div class="screen timer">
  <div class="topbar"><a class="iconbtn dark" href="${back}" aria-label="Schließen">✕</a><div class="grow tcenter" id="t-top">${esc(nrLabel)}Lesezeit</div><span style="width:44px"></span></div>
  <div class="t-main">
    <div class="t-hello">${name ? `Lies mal, ${esc(name)}!` : 'Lies mal!'}</div>
    <div class="t-digits" id="t-digits" aria-live="off">00:00</div>
    <div class="t-sub" id="t-sub">von ${minutes} Minuten übrig</div>
    <div class="t-raupe" id="t-raupe"></div>
    <div class="t-hint">Jede Minute bekommt die Raupe eine neue Perle</div>
  </div>
  <div class="bottom dark">
    <div class="btnrow two">
      <button class="btn primary big" id="t-start">Start</button>
      <button class="btn outline big" id="t-reset">Neustart</button>
    </div>
    <div class="t-foot">Bildschirm bleibt an · am Ende Ton und Vibration</div>
  </div>
</div>`;

  const digits = root.querySelector<HTMLElement>('#t-digits')!;
  const startBtn = root.querySelector<HTMLButtonElement>('#t-start')!;
  const raupe = root.querySelector<HTMLElement>('#t-raupe')!;

  const perlen = (n: number) => {
    const r = 15;
    const gap = 4;
    const w = minutes * (2 * r + gap) + 70;
    let s = '';
    for (let i = 0; i < minutes; i++) {
      const cx = r + 4 + i * (2 * r + gap);
      s += i < n
        ? `<circle cx="${cx}" cy="56" r="${r}" fill="#7FC06D" stroke="#BFE0B5" stroke-width="2.5"/>`
        : `<circle cx="${cx}" cy="56" r="${r}" fill="none" stroke="#6B7AA6" stroke-width="2.5" stroke-dasharray="5 4"/>`;
    }
    const hx = w - 34;
    s += `<path d="M${hx - 10} 28 L${hx - 16} 12 M${hx + 10} 28 L${hx + 16} 12" stroke="#A9D99A" stroke-width="3" stroke-linecap="round"/><circle cx="${hx - 16}" cy="11" r="4" fill="#F2A65A"/><circle cx="${hx + 16}" cy="11" r="4" fill="#F2A65A"/>`;
    s += `<circle cx="${hx}" cy="50" r="26" fill="#A3D78F" stroke="#C9EBBE" stroke-width="3"/><circle cx="${hx - 9}" cy="45" r="3.6" fill="#1F2421"/><circle cx="${hx + 9}" cy="45" r="3.6" fill="#1F2421"/><path d="M${hx - 11} 58 Q${hx} 66 ${hx + 11} 58" fill="none" stroke="#1F2421" stroke-width="3" stroke-linecap="round"/>`;
    raupe.innerHTML = `<svg viewBox="0 0 ${w} 86" aria-label="${n} von ${minutes} Perlen">${s}</svg>`;
  };

  const show = (remaining: number) => {
    const sec = Math.max(0, Math.ceil(remaining));
    digits.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    perlen(Math.min(minutes, Math.floor((total - remaining) / 60)));
  };

  const cd = createCountdown(total, {
    tick: show,
    done: async () => {
      root.querySelector('#t-sub')!.innerHTML = '<span class="t-toll">Toll gelesen!</span>';
      startBtn.textContent = 'Fertig';
      try {
        const nr = await recordRead(sheetId, draft, minutes);
        if (nr) toast(`Blatt ${nr}: gelesen ✓`);
      } catch {
        toast('Lesung konnte nicht gespeichert werden.');
      }
    },
  });

  startBtn.addEventListener('click', () => {
    if (cd.done) {
      location.hash = back;
    } else if (cd.running) {
      cd.pause();
      startBtn.textContent = 'Weiter';
    } else {
      cd.start();
      startBtn.textContent = 'Pause';
    }
  });
  root.querySelector('#t-reset')!.addEventListener('click', () => {
    cd.reset();
    startBtn.textContent = 'Start';
    root.querySelector('#t-sub')!.textContent = `von ${minutes} Minuten übrig`;
  });

  if (sheetId) getSheet(sheetId).then((r) => r && (root.querySelector('#t-top')!.textContent = `Blatt ${r.number} · Lesezeit`));

  show(total);
  window.addEventListener('hashchange', () => cd.dispose(), { once: true });
}
