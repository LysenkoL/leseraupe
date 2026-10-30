import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/app/native', () => ({ NATIV: true, Druck: { seiteDrucken: vi.fn() } }));
vi.mock('../src/app/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/app/i18n', () => ({ t: (k: string) => k }));

describe('Druck-Knopf', () => {
  it('sofort gesperrt mit Hinweis; weitere Tipps starten keinen zweiten Auftrag', async () => {
    const { mitDruckKnopf } = await import('../src/sheet/print');
    const btn = { disabled: false, textContent: 'Drucken' } as HTMLButtonElement;
    let fertig!: () => void;
    const arbeit = vi.fn(() => new Promise<void>((r) => (fertig = r)));
    const erster = mitDruckKnopf(btn, arbeit);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('aktion.druckVorbereiten');
    await mitDruckKnopf(btn, arbeit);
    await mitDruckKnopf(btn, arbeit);
    expect(arbeit).toHaveBeenCalledTimes(1);
    fertig();
    await erster;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Drucken');
  });

  it('Display aus: Hinweis „unterbrochen“ statt stiller Fehler', async () => {
    const native = await import('../src/app/native');
    const ui = await import('../src/app/ui');
    vi.mocked(native.Druck.seiteDrucken).mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'NICHT_SICHTBAR' }));
    vi.stubGlobal('document', { getElementById: () => ({ innerHTML: '', querySelectorAll: () => [] }), fonts: { ready: Promise.resolve() } });
    const { printSheets } = await import('../src/sheet/print');
    await printSheets(['<a/>']);
    vi.unstubAllGlobals();
    expect(ui.toast).toHaveBeenCalledWith('aktion.druckUnterbrochen', 4000);
  });
});
