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
