import { describe, expect, it } from 'vitest';
import { eigenesWortPruefen, sanitizeEigene, eigeneFehlen, MAX_EIGENE, type EigenesWort } from '../src/core/eigene';
import { generateSheet, historyFrom, readingTexts, emptyHistory } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { checkText, sortUnits, wordsOf } from '../src/core/letters';
import { sanitize } from '../src/core/store';

const TOMLAIS = sortUnits(['t', 'o', 'm', 'l', 'a', 'i', 's']);
const MEHR = sortUnits(['m', 'a', 'l', 'i', 'o', 's', 't', 'e', 'n', 'r', 'u', 'h', 'd']);

const blatt = (letters: string[], eigene: EigenesWort[], seed: number, history = emptyHistory(), neu: string | null = null) =>
  generateSheet({ letters, newLetter: neu, minutes: 5, theme: 'wiese', childName: '', blocks: { ...DEFAULT_BLOCKS }, history, seed, stufe: 3, eigene }).sheet;

describe('Eigene Wörter: Eingabe', () => {
  it('ein Wort aus Buchstaben, 2–20 Zeichen; Namen groß; ohne Doppelte und Unpassendes', () => {
    expect(eigenesWortPruefen(' lotta ', 'name')).toEqual({ w: 'Lotta', typ: 'name' });
    expect(eigenesWortPruefen('Fahrrad', 'wort')).toEqual({ w: 'Fahrrad', typ: 'wort' });
    expect(eigenesWortPruefen('lila', 'wort')).toEqual({ w: 'lila', typ: 'wort' });
    expect(eigenesWortPruefen('', 'name')).toEqual({ fehler: 'leer' });
    expect(eigenesWortPruefen('Oma Rosi', 'name')).toEqual({ fehler: 'zeichen' });
    expect(eigenesWortPruefen('Anna-Lena', 'name')).toEqual({ fehler: 'zeichen' });
    expect(eigenesWortPruefen('Tom2', 'name')).toEqual({ fehler: 'zeichen' });
    expect(eigenesWortPruefen('A', 'name')).toEqual({ fehler: 'lang' });
    expect(eigenesWortPruefen('Idiot', 'wort')).toEqual({ fehler: 'inhalt' });
    expect(eigenesWortPruefen('lotta', 'name', [{ w: 'Lotta', typ: 'name' }])).toEqual({ fehler: 'doppelt' });
    const voll = Array.from({ length: MAX_EIGENE }, (_, i) => ({ w: `Wort${'a'.repeat(i % 5)}`, typ: 'wort' as const }));
    expect(eigenesWortPruefen('Neu', 'wort', voll)).toEqual({ fehler: 'voll' });
  });

  it('Sicherung/alte Daten: kaputte Einträge fallen weg, Einstellungen ohne Feld → leere Liste', () => {
    expect(sanitizeEigene([{ w: 'Bello', typ: 'name' }, { w: 'x y', typ: 'wort' }, { w: 3 }, null, { w: 'bello', typ: 'wort' }])).toEqual([{ w: 'Bello', typ: 'name' }]);
    expect(sanitize({}).eigene).toEqual([]);
  });

  it('zeigt, welche Buchstaben noch fehlen', () => {
    expect(eigeneFehlen('Lotta', new Set(TOMLAIS))).toEqual([]);
    expect(eigeneFehlen('Bello', new Set(TOMLAIS))).toEqual(['B', 'E']);
  });
});

describe('Eigene Wörter auf dem Blatt', () => {
  const eigene: EigenesWort[] = [
    { w: 'Lotta', typ: 'name' },
    { w: 'Bello', typ: 'name' },
    { w: 'Atlas', typ: 'wort' },
  ];

  it('nie ein eigenes Wort, dessen Buchstaben noch nicht gelernt sind (harte Regel 1)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = blatt(TOMLAIS, eigene, seed);
      for (const t of readingTexts(s)) expect(checkText(t, new Set(TOMLAIS)).ok, t).toBe(true);
      expect(readingTexts(s).some((t) => wordsOf(t).includes('Bello'))).toBe(false);
    }
  });

  it('lesbare eigene Wörter stehen im Wortblock, höchstens zwei', () => {
    const s = blatt(TOMLAIS, eigene, 7);
    const drin = s.woerter.filter((w) => ['Lotta', 'Atlas'].includes(w));
    expect(drin.length).toBeGreaterThanOrEqual(1);
    expect(drin.length).toBeLessThanOrEqual(2);
  });

  it('nicht zweimal hintereinander: ein einziges Wort kommt jedes zweite Blatt', () => {
    const nur = [{ w: 'Lotta', typ: 'name' as const }];
    const saved: { seq: number; data: ReturnType<typeof blatt> }[] = [];
    const da: boolean[] = [];
    for (let i = 1; i <= 6; i++) {
      const s = blatt(TOMLAIS, nur, 100 + i, historyFrom(saved, i));
      da.push(s.woerter.includes('Lotta'));
      saved.push({ seq: i, data: s });
    }
    expect(da).toEqual([true, false, true, false, true, false]);
  });

  it('ein eigener Name kommt in einen Satz – die neue Buchstabe bleibt vorn', () => {
    let mitName = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = blatt(MEHR, [{ w: 'Hanno', typ: 'name' }], seed, emptyHistory(), 'd');
      if (s.saetze.some((x) => wordsOf(x).includes('Hanno'))) mitName++;
      const mitD = s.saetze.filter((x) => /d/i.test(x)).length;
      expect(mitD, s.saetze.join(' | ')).toBeGreaterThanOrEqual(4);
    }
    expect(mitName).toBeGreaterThanOrEqual(18);
  });

  it('ohne eigene Wörter bleibt das Blatt genau wie vorher', () => {
    expect(blatt(TOMLAIS, [], 5)).toEqual(blatt(TOMLAIS, undefined as unknown as EigenesWort[], 5));
  });
});
