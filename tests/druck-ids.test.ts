import { describe, expect, it } from 'vitest';
import { eigeneIds } from '../src/sheet/print';
import { renderSheet } from '../src/sheet/render';
import { renderUrkunde } from '../src/sheet/urkunde';
import { SAMPLE_SHEET } from '../src/core/sample';

// Die Vorschau steht beim Drucken (versteckt) mit denselben IDs im Dokument.
// Zeigt url(#…) dorthin, kommen die Perlen der Raupe weiß aus dem Drucker.
function pruefe(html: string) {
  const out = eigeneIds(html);
  const ids = new Set(Array.from(out.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
  expect(ids.size).toBeGreaterThan(0);
  for (const id of ids) expect(id.startsWith('druck-')).toBe(true);
  const refs = Array.from(out.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g), (m) => m[1] ?? m[2]);
  expect(refs.length).toBeGreaterThan(0);
  for (const r of refs) expect(ids.has(r)).toBe(true);
}

describe('Druck-Kopie: eigene IDs für Farbverläufe', () => {
  it('Leseblatt (Raupe mit Perlen)', () => pruefe(renderSheet(SAMPLE_SHEET, { displayNumber: 3 })));
  it('Urkunde (Rahmen, Maske, Medaille)', () => pruefe(renderUrkunde({ name: 'Mia', datum: '2026-10-30', nr: 1, gesamt: 10 })));
});
