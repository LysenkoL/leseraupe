import { describe, expect, it, beforeEach, vi } from 'vitest';

// B5: Erinnerung „Lesezeit!“ – Plan aus Tagen + Uhrzeit, Plugin wird nur nachgebildet
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const plugin = {
  offen: [] as { id: number }[],
  erlaubnis: 'prompt' as string,
  antwort: 'granted' as string,
  getPending: vi.fn(async () => ({ notifications: plugin.offen })),
  cancel: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
    plugin.offen = plugin.offen.filter((n) => !notifications.some((c) => c.id === n.id));
  }),
  checkPermissions: vi.fn(async () => ({ display: plugin.erlaubnis })),
  requestPermissions: vi.fn(async () => ({ display: (plugin.erlaubnis = plugin.antwort) })),
  createChannel: vi.fn(async () => undefined),
  schedule: vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
    plugin.offen.push(...notifications.map((n) => ({ id: n.id })));
    return { notifications };
  }),
};
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));
vi.mock('../src/app/native', () => ({ NATIV: true }));

const TEXT = { title: 'Lesezeit!', body: 'Zeit fürs Leseblatt' };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  plugin.offen = [];
  plugin.erlaubnis = 'prompt';
  plugin.antwort = 'granted';
  vi.clearAllMocks();
});

describe('Zeitplan der Erinnerung', () => {
  it('je gewähltem Tag eine wöchentliche Benachrichtigung zur gewählten Uhrzeit', async () => {
    const { zeitplan } = await import('../src/app/erinnerung');
    const liste = zeitplan({ an: true, zeit: '07:05', tage: [5, 1, 3] }, TEXT);
    expect(liste.map((n) => n.id)).toEqual([101, 103, 105]);
    // Montag → 2, Mittwoch → 4, Freitag → 6 (Android: Sonntag = 1)
    expect(liste.map((n) => n.schedule?.on)).toEqual([
      { weekday: 2, hour: 7, minute: 5 },
      { weekday: 4, hour: 7, minute: 5 },
      { weekday: 6, hour: 7, minute: 5 },
    ]);
    expect(liste.every((n) => n.title === TEXT.title && n.body === TEXT.body && n.channelId === 'lesezeit')).toBe(true);
  });

  it('Samstag und Sonntag, Mitternacht und 23:59', async () => {
    const { zeitplan } = await import('../src/app/erinnerung');
    expect(zeitplan({ an: true, zeit: '00:00', tage: [6, 7] }, TEXT).map((n) => n.schedule?.on)).toEqual([
      { weekday: 7, hour: 0, minute: 0 },
      { weekday: 1, hour: 0, minute: 0 },
    ]);
    expect(zeitplan({ an: true, zeit: '23:59', tage: [7] }, TEXT)[0].schedule?.on).toEqual({ weekday: 1, hour: 23, minute: 59 });
  });

  it('aus, keine Tage oder kaputte Uhrzeit → nichts', async () => {
    const { zeitplan } = await import('../src/app/erinnerung');
    expect(zeitplan({ an: false, zeit: '18:00', tage: [1, 2] }, TEXT)).toEqual([]);
    expect(zeitplan({ an: true, zeit: '18:00', tage: [] }, TEXT)).toEqual([]);
    expect(zeitplan({ an: true, zeit: '24:00', tage: [1] }, TEXT)).toEqual([]);
    expect(zeitplan({ an: true, zeit: '18:00', tage: [0, 8, 1, 1] }, TEXT).map((n) => n.id)).toEqual([101]);
  });

  it('Standard ist aus; gespeicherte Werte werden geprüft', async () => {
    const { ladeErinnerung, speichereErinnerung, ERINNERUNG_STANDARD } = await import('../src/app/erinnerung');
    expect(ladeErinnerung()).toEqual(ERINNERUNG_STANDARD);
    expect(ERINNERUNG_STANDARD.an).toBe(false);
    speichereErinnerung({ an: true, zeit: '19:30', tage: [2, 6] });
    expect(ladeErinnerung()).toEqual({ an: true, zeit: '19:30', tage: [2, 6] });
    localStorage.setItem('leseraupe.erinnerung', '{"an":"ja","zeit":"99:99","tage":[9,3]}');
    expect(ladeErinnerung()).toEqual({ an: false, zeit: '18:00', tage: [3] });
    localStorage.setItem('leseraupe.erinnerung', 'kaputt');
    expect(ladeErinnerung()).toEqual(ERINNERUNG_STANDARD);
  });
});

describe('Erinnerung einplanen (Android)', () => {
  it('Einschalten fragt nach der Erlaubnis und plant alle Tage', async () => {
    const { erinnerungAnwenden } = await import('../src/app/erinnerung');
    expect(await erinnerungAnwenden({ an: true, zeit: '18:00', tage: [1, 2, 3] }, true)).toBe('an');
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
    expect(plugin.createChannel).toHaveBeenCalled();
    expect(plugin.offen.map((n) => n.id)).toEqual([101, 102, 103]);
  });

  it('Erlaubnis verweigert → nichts geplant, ehrliche Rückmeldung', async () => {
    plugin.antwort = 'denied';
    const { erinnerungAnwenden } = await import('../src/app/erinnerung');
    expect(await erinnerungAnwenden({ an: true, zeit: '18:00', tage: [1] }, true)).toBe('verweigert');
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('beim Start der App wird nie gefragt', async () => {
    const { erinnerungAnwenden } = await import('../src/app/erinnerung');
    expect(await erinnerungAnwenden({ an: true, zeit: '18:00', tage: [1] }, false)).toBe('verweigert');
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });

  it('Ändern ersetzt den alten Plan, Ausschalten löscht alles', async () => {
    plugin.erlaubnis = 'granted';
    const { erinnerungAnwenden } = await import('../src/app/erinnerung');
    await erinnerungAnwenden({ an: true, zeit: '18:00', tage: [1, 2, 3, 4, 5] }, true);
    await erinnerungAnwenden({ an: true, zeit: '08:00', tage: [6, 7] }, true);
    expect(plugin.offen.map((n) => n.id)).toEqual([106, 107]);
    expect(await erinnerungAnwenden({ an: false, zeit: '08:00', tage: [6, 7] }, true)).toBe('aus');
    expect(plugin.offen).toEqual([]);
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });
});
