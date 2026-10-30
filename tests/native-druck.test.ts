import { describe, expect, it, vi } from 'vitest';

// Android-App: Drucken geht über das eigene Plugin, nicht über window.print()
const pdfDrucken = vi.fn(async () => undefined);
vi.mock('../src/app/native', () => ({ NATIV: true, Druck: { pdfDrucken } }));
vi.mock('../src/app/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/app/i18n', () => ({ t: (k: string) => k }));
const sheetsToPdf = vi.fn(async (html: string[]) => new Uint8Array(html.length));
vi.mock('../src/sheet/pdf', () => ({ sheetsToPdf, toBase64: () => 'QUJD' }));

describe('Drucken in der Android-App', () => {
  it('Serie aus 3 Blättern → ein PDF, ein Druckauftrag mit 3 Seiten', async () => {
    const print = vi.fn();
    vi.stubGlobal('window', { print });
    const { printSheets } = await import('../src/sheet/print');
    await printSheets(['<a/>', '<b/>', '<c/>'], 'Leseblaetter-1-3');
    expect(sheetsToPdf).toHaveBeenCalledTimes(1);
    expect(sheetsToPdf.mock.calls[0][0]).toHaveLength(3);
    expect(pdfDrucken).toHaveBeenCalledWith({ pdf: 'QUJD', name: 'Leseblaetter-1-3', seiten: 3 });
    expect(print).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
