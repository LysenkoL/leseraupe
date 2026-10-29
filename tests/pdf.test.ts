import { describe, expect, it } from 'vitest';
import { jpegsToPdf } from '../src/sheet/pdf';

/** Kleinstes „JPEG“ reicht für den Aufbau der Datei */
const fake = (n: number) => ({ jpeg: new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9]), px: { w: 10, h: 14 }, wMm: 190, hMm: 276 });

describe('PDF (A4, A6)', () => {
  it('mehrere Blätter: eine Seite je Blatt, gültige Querverweise', () => {
    const pdf = Buffer.from(jpegsToPdf([fake(1), fake(2), fake(3)], 'Leseblätter 7–9'));
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(3);
    expect(text).toContain('/Count 3');
    expect(text.match(/\/MediaBox \[0 0 595.28 841.89\]/g)).toHaveLength(3);
    // xref: jeder Eintrag zeigt genau auf „n 0 obj“
    const start = Number(text.match(/startxref\n(\d+)/)![1]);
    const xref = text.slice(start).split('\n');
    const size = Number(xref[1].split(' ')[1]);
    expect(size).toBe(1 + 2 + 3 * 3 + 1);
    for (let n = 1; n < size; n++) {
      const off = Number(xref[2 + n].slice(0, 10));
      expect(text.slice(off, off + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    }
    // Titel nur ASCII
    expect(text).toContain('/Title (Lesebltter 79)');
  });
});
