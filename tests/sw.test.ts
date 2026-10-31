import { describe, expect, it } from 'vitest';
import { build } from 'vite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('Service Worker (Web-Version)', () => {
  it('neue Version wird sofort aktiv – sonst blieb sie auf Android hängen („Neue Version gefunden“ ohne Neustart)', async () => {
    const out = mkdtempSync(join(tmpdir(), 'leseraupe-sw-'));
    try {
      await build({ root: resolve(__dirname, '..'), logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
      const sw = readFileSync(join(out, 'sw.js'), 'utf8');
      // skipWaiting beim Installieren (nicht nur auf Nachricht) und clientsClaim
      expect(sw).toMatch(/self\.skipWaiting\(\)[,;]/);
      expect(sw).toMatch(/clientsClaim\(\)/);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
