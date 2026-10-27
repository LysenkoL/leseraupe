import { getDraft, getSettings, setDraft } from '../app/state';
import { addRead, getSheet, saveOnPrint } from '../core/db';
import { esc, toast } from '../app/ui';

/** Vollbild-Timer: Wake Lock, Perlen pro Minute, Ton + Vibration am Ende. */
export function renderTimer(root: HTMLElement, params: URLSearchParams): void {
  const sheetId = params.get('id') ? Number(params.get('id')) : null;
  const draft = getDraft();
  const minutes = Number(params.get('min')) || (draft?.data.minutes ?? getSettings().minutes);
  const total = minutes * 60;
  const name = getSettings().childName;

  let remaining = total;
  let endAt = 0;
  let running = false;
  let done = false;
  let tick = 0;
  let wake: WakeLockSentinel | null = null;
  let audio: AudioContext | null = null;

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

  const show = () => {
    const sec = Math.max(0, Math.ceil(remaining));
    digits.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    perlen(Math.min(minutes, Math.floor((total - remaining) / 60)));
  };

  const lockScreen = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen');
    } catch {
      wake = null;
    }
  };
  const unlockScreen = () => {
    wake?.release().catch(() => undefined);
    wake = null;
  };
  const onVis = () => {
    if (document.visibilityState === 'visible' && running) lockScreen();
  };
  document.addEventListener('visibilitychange', onVis);

  const chime = () => {
    try {
      const ctx = audio ?? new AudioContext();
      const t0 = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.22);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.22 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.9);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + i * 0.22);
        o.stop(t0 + i * 0.22 + 1);
      });
    } catch {
      /* kein Ton möglich */
    }
  };

  const finish = async () => {
    running = false;
    done = true;
    clearInterval(tick);
    remaining = 0;
    show();
    chime();
    try {
      navigator.vibrate?.([300, 150, 300, 150, 500]);
    } catch {
      /* keine Vibration */
    }
    unlockScreen();
    root.querySelector('#t-sub')!.innerHTML = '<span class="t-toll">Toll gelesen!</span>';
    startBtn.textContent = 'Fertig';
    try {
      if (sheetId) {
        const r = await addRead(sheetId, minutes);
        if (r) toast(`Blatt ${r.number}: gelesen ✓`);
      } else if (draft) {
        const d = getDraft() ?? draft;
        const rec = await saveOnPrint(d.data, d.scale, d.savedId, 'none');
        setDraft({ ...d, data: rec.data, savedId: rec.id ?? null });
        await addRead(rec.id!, minutes);
        toast(`Blatt ${rec.number}: gelesen ✓`);
      }
    } catch {
      toast('Lesung konnte nicht gespeichert werden.');
    }
  };

  const loop = () => {
    remaining = (endAt - performance.now()) / 1000;
    if (remaining <= 0) finish();
    else show();
  };

  const start = () => {
    if (done) {
      location.hash = back;
      return;
    }
    if (!audio) {
      try {
        audio = new AudioContext();
      } catch {
        audio = null;
      }
    }
    audio?.resume();
    endAt = performance.now() + remaining * 1000;
    running = true;
    tick = window.setInterval(loop, 250);
    lockScreen();
    startBtn.textContent = 'Pause';
  };
  const pause = () => {
    running = false;
    clearInterval(tick);
    remaining = (endAt - performance.now()) / 1000;
    unlockScreen();
    startBtn.textContent = 'Weiter';
    show();
  };

  startBtn.addEventListener('click', () => (running ? pause() : start()));
  root.querySelector('#t-reset')!.addEventListener('click', () => {
    clearInterval(tick);
    running = false;
    done = false;
    remaining = total;
    unlockScreen();
    startBtn.textContent = 'Start';
    root.querySelector('#t-sub')!.textContent = `von ${minutes} Minuten übrig`;
    show();
  });

  if (sheetId) getSheet(sheetId).then((r) => r && (root.querySelector('#t-top')!.textContent = `Blatt ${r.number} · Lesezeit`));

  show();
  window.addEventListener(
    'hashchange',
    () => {
      clearInterval(tick);
      unlockScreen();
      document.removeEventListener('visibilitychange', onVis);
      audio?.close().catch(() => undefined);
    },
    { once: true },
  );
}
