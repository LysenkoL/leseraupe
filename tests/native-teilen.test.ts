import { describe, expect, it, vi } from 'vitest';

// Android-App: PDF und Sicherung gehen über Filesystem + Teilen-Menü, nicht über einen Download-Link
const teileNativ = vi.fn(async () => 'geteilt' as const);
vi.mock('../src/app/native', () => ({ NATIV: true, teileNativ }));

describe('Teilen in der Android-App', () => {
  it('Sicherung → Teilen-Menü mit Dateiinhalt als Base64', async () => {
    const { teileDatei } = await import('../src/sheet/pdf');
    const f = new File(['{"a":1}'], 'leseraupe-sicherung.json', { type: 'application/json' });
    expect(await teileDatei(f)).toBe('geteilt');
    expect(teileNativ).toHaveBeenCalledWith(f, btoa('{"a":1}'));
  });
});
