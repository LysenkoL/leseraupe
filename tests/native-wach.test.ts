import { describe, expect, it, vi } from 'vitest';

// Lesen am Bildschirm + Timer halten gleichzeitig wach: erst wenn beide freigeben, darf der Bildschirm aus
const keepAwake = vi.fn(async () => undefined);
const allowSleep = vi.fn(async () => undefined);
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: { keepAwake, allowSleep } }));

const warten = () => new Promise((r) => setTimeout(r, 10));

describe('Bildschirm wach halten (Android-App)', () => {
  it('zählt mehrere Stellen, doppelte Freigabe zählt nicht', async () => {
    const { wachHalten } = await import('../src/app/native');
    const lesen = wachHalten();
    const timer = wachHalten();
    await warten();
    expect(keepAwake).toHaveBeenCalledTimes(1);
    timer();
    timer();
    await warten();
    expect(allowSleep).not.toHaveBeenCalled();
    lesen();
    await warten();
    expect(allowSleep).toHaveBeenCalledTimes(1);
  });
});

describe('Android-Version aus der WebView', () => {
  it('liest die Version, ab 13 meldet das System „Kopiert“ selbst', async () => {
    const { androidVersion } = await import('../src/app/native');
    expect(androidVersion('Mozilla/5.0 (Linux; Android 17; SM-S942B Build/CP2A; wv) AppleWebKit/537.36')).toBe(17);
    expect(androidVersion('Mozilla/5.0 (Linux; Android 12; Pixel 5; wv)')).toBe(12);
    expect(androidVersion('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(0);
  });
});
