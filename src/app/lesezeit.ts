import { addRead } from '../core/db';
import { getSerie, type Draft } from './state';
import { saveSerieBis } from './actions';

/**
 * Countdown für die Lesezeit – gemeinsam für den Vollbild-Timer und „Am Bildschirm lesen“:
 * Bildschirm bleibt an (Wake Lock), am Ende Ton und Vibration.
 */
export interface Countdown {
  start(): void;
  pause(): void;
  reset(): void;
  readonly running: boolean;
  readonly done: boolean;
  /** Restzeit in Sekunden */
  readonly remaining: number;
  dispose(): void;
}

export function createCountdown(totalSec: number, on: { tick: (remaining: number) => void; done: () => void }): Countdown {
  let remaining = totalSec;
  let endAt = 0;
  let running = false;
  let done = false;
  let timer = 0;
  let wake: WakeLockSentinel | null = null;
  let audio: AudioContext | null = null;

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

  const finish = () => {
    running = false;
    done = true;
    clearInterval(timer);
    remaining = 0;
    on.tick(0);
    chime();
    try {
      navigator.vibrate?.([300, 150, 300, 150, 500]);
    } catch {
      /* keine Vibration */
    }
    unlockScreen();
    on.done();
  };

  const loop = () => {
    remaining = (endAt - performance.now()) / 1000;
    if (remaining <= 0) finish();
    else on.tick(remaining);
  };

  return {
    get running() {
      return running;
    },
    get done() {
      return done;
    },
    get remaining() {
      return remaining;
    },
    start() {
      if (running || done) return;
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
      timer = window.setInterval(loop, 250);
      lockScreen();
    },
    pause() {
      if (!running) return;
      running = false;
      clearInterval(timer);
      remaining = (endAt - performance.now()) / 1000;
      unlockScreen();
      on.tick(remaining);
    },
    reset() {
      clearInterval(timer);
      running = false;
      done = false;
      remaining = totalSec;
      unlockScreen();
      on.tick(remaining);
    },
    dispose() {
      clearInterval(timer);
      unlockScreen();
      document.removeEventListener('visibilitychange', onVis);
      audio?.close().catch(() => undefined);
    },
  };
}

/**
 * Lesung speichern: gespeichertes Blatt (sheetId) oder der aktuelle Entwurf,
 * der dabei eine Nummer bekommt. Liefert id und Nummer des Blatts.
 */
export async function recordRead(sheetId: number | null, draft: Draft | null, minutes: number): Promise<{ id: number; number: number } | null> {
  if (sheetId) {
    const r = await addRead(sheetId, minutes);
    return r ? { id: sheetId, number: r.number } : null;
  }
  const serie = getSerie();
  if (draft && serie) {
    // frühere Blätter der Serie zuerst speichern, damit die Nummern stimmen
    const d = await saveSerieBis(serie.idx);
    await addRead(d.savedId!, minutes);
    return { id: d.savedId!, number: d.data.number! };
  }
  return null;
}
