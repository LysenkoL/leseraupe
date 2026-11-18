import { beforeEach, describe, expect, it, vi } from 'vitest';

// Timer-Signal bei gesperrtem Handy (Android-App): planen beim Start, absagen bei Pause; Erlaubnis nur einmal fragen
const stand = { display: 'prompt' as 'prompt' | 'granted' | 'denied' };
const LN = {
  checkPermissions: vi.fn(async () => ({ ...stand })),
  requestPermissions: vi.fn(async () => {
    stand.display = 'granted';
    return { ...stand };
  }),
  createChannel: vi.fn(async () => undefined),
  schedule: vi.fn(async () => undefined),
  cancel: vi.fn(async () => undefined),
};
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: LN }));

const speicher = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => void speicher.set(k, v),
  removeItem: (k: string) => void speicher.delete(k),
  clear: () => speicher.clear(),
  key: () => null,
  length: 0,
};

describe('Timer-Signal', () => {
  beforeEach(() => {
    Object.values(LN).forEach((f) => f.mockClear());
  });

  it('Start plant eine Benachrichtigung zum Ende (nicht exakt, eigener Kanal), Erlaubnis wird einmal gefragt', async () => {
    const { signalPlanen } = await import('../src/app/timersignal');
    const vorher = Date.now();
    await signalPlanen(300, true);
    expect(LN.requestPermissions).toHaveBeenCalledTimes(1);
    expect(LN.schedule).toHaveBeenCalledTimes(1);
    const n = (LN.schedule.mock.calls[0] as unknown as [{ notifications: { id: number; channelId: string; isExactNotification: boolean; schedule: { at: Date } }[] }])[0].notifications[0];
    expect(n.id).toBe(900);
    expect(n.channelId).toBe('timer');
    expect(n.isExactNotification).toBe(false);
    const sek = (n.schedule.at.getTime() - vorher) / 1000;
    expect(sek).toBeGreaterThanOrEqual(301);
    expect(sek).toBeLessThan(304);
  });

  it('Pause sagt ab; abgelehnte Erlaubnis wird nicht erneut gefragt und nichts geplant', async () => {
    const { signalPlanen, signalAbsagen } = await import('../src/app/timersignal');
    await signalAbsagen(true);
    expect(LN.cancel).toHaveBeenCalledWith({ notifications: [{ id: 900 }] });
    stand.display = 'prompt';
    LN.requestPermissions.mockClear();
    LN.schedule.mockClear();
    await signalPlanen(60, true);
    // schon einmal gefragt (Merker gesetzt) → keine zweite Frage, kein Signal
    expect(LN.requestPermissions).not.toHaveBeenCalled();
    expect(LN.schedule).not.toHaveBeenCalled();
  });

  it('im Browser (nicht nativ) passiert nichts', async () => {
    const { signalPlanen, signalAbsagen } = await import('../src/app/timersignal');
    await signalPlanen(60, false);
    await signalAbsagen(false);
    expect(LN.schedule).not.toHaveBeenCalled();
    expect(LN.cancel).not.toHaveBeenCalled();
  });
});
