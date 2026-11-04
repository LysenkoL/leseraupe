import { describe, expect, it } from 'vitest';
import { tippBerechnen, tippHtml } from '../src/app/tipp';
import { mischeKurzeWoerter } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';

const einBuchstabe = async (letters: string[], blocks = DEFAULT_BLOCKS) => (await tippBerechnen(letters, blocks))!;

describe('Hinweis auf den nächsten Buchstaben', () => {
  it('nennt den einen Buchstaben, der Sätze oder Geschichten bringt', async () => {
    const zeilen = await einBuchstabe(['m', 'l', 'a', 'o']);
    expect(zeilen.length).toBeGreaterThan(0);
    const alle = zeilen.flatMap((z) => z.bloecke);
    expect(alle).toEqual(expect.arrayContaining(['saetze', 'geschichte']));
    expect(zeilen[0].unit).not.toBeNull();
    expect(tippHtml(zeilen)).toContain('Noch 1 Buchstabe');
  });

  it('ohne Vokal: Silben und Wörter fehlen, ein Vokal hilft', async () => {
    const [erste] = await einBuchstabe(['m', 'l', 'b', 's', 'd']);
    expect(['a', 'e', 'i', 'o', 'u']).toContain(erste.unit);
    expect(erste.bloecke).toEqual(expect.arrayContaining(['silben', 'woerter']));
  });

  it('reicht ein Buchstabe nicht, sagt er das ehrlich', async () => {
    const zeilen = await einBuchstabe(['m', 'a']);
    const ohne = zeilen.find((z) => z.unit === null);
    expect(ohne?.bloecke).toContain('geschichte');
    expect(tippHtml(zeilen)).toContain('noch mehr Buchstaben');
  });

  it('abgewählte Blöcke werden nicht versprochen; alles möglich = kein Hinweis', async () => {
    const ohne = { ...DEFAULT_BLOCKS, saetze: false, geschichte: false };
    expect(await einBuchstabe(['m', 'a'], ohne)).toEqual([]);
    expect(await einBuchstabe(['m', 'l', 's', 'a', 'o', 'i', 't', 'e', 'n'])).toEqual([]);
  });

  it('einzelne Buchstaben gehen vor Verbindungen', async () => {
    const zeilen = await einBuchstabe(['m', 'l', 'a', 'o']);
    for (const z of zeilen) if (z.unit) expect(z.unit.length).toBe(1);
  });

  it('bricht ab, wenn schon weitergetippt wurde', async () => {
    expect(await tippBerechnen(['m', 'a'], DEFAULT_BLOCKS, () => true)).toBeNull();
  });
});

describe('Kurze Wörter im Wortblock', () => {
  it('stehen verteilt, nichts geht verloren', () => {
    const lang = ['Oma', 'Lama', 'Mama', 'Salat', 'Tomate', 'Salami'];
    const out = mischeKurzeWoerter(lang, ['am', 'im']);
    expect([...out].sort()).toEqual([...lang, 'am', 'im'].sort());
    expect(out.indexOf('am')).toBeGreaterThan(0);
    expect(out.indexOf('im')).toBeGreaterThan(out.length / 2);
  });
  it('ohne kurze Wörter bleibt alles gleich', () => {
    expect(mischeKurzeWoerter(['Oma'], [])).toEqual(['Oma']);
  });
});
