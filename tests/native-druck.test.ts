import { describe, expect, it, vi } from 'vitest';

// Android-App: Drucken geht über das eigene Plugin (Seite der WebView), nicht über window.print()
const seiteDrucken = vi.fn(async () => undefined);
vi.mock('../src/app/native', () => ({ NATIV: true, Druck: { seiteDrucken } }));
vi.mock('../src/app/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/app/i18n', () => ({ t: (k: string) => k }));

describe('Drucken in der Android-App', () => {
  it('Serie aus 3 Blättern → alle in #print-root, ein Druckauftrag', async () => {
    const print = vi.fn();
    const root = { id: '', innerHTML: '', querySelectorAll: () => [] };
    vi.stubGlobal('window', { print });
    vi.stubGlobal('document', { getElementById: () => root, fonts: { ready: Promise.resolve() } });
    const { printSheets } = await import('../src/sheet/print');
    await printSheets(['<a/>', '<b/>', '<c/>'], 'Leseblaetter-1-3');
    expect(root.innerHTML).toBe('<a/><b/><c/>');
    expect(seiteDrucken).toHaveBeenCalledTimes(1);
    expect(seiteDrucken).toHaveBeenCalledWith({ name: 'Leseblaetter-1-3' });
    expect(print).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
