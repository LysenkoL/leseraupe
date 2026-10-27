import { describe, expect, it } from 'vitest';
import { UNITS, tokenizeWord, checkText, isAllowed, sortUnits, countUnit } from '../src/core/letters';

const set = (...ids: string[]) => new Set(ids);
const START = set('t', 'o', 'm', 'l', 'a', 'i', 's');

describe('Einheiten nach Schreibtabelle der Fibel', () => {
  it('43 Einheiten in der richtigen Reihenfolge', () => {
    expect(UNITS).toHaveLength(43);
    expect(UNITS.map((u) => u.label).join(' ')).toBe(
      'M L Ch B S D W Sch G A E I O U Au Ei Eu Ö Ü -ie Ä -äu N H R P Z T F J K Sp St Pf Qu X V Y C -ß -ng -ck -tz',
    );
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(43);
  });

  it('sortUnits ordnet in Fibel-Reihenfolge', () => {
    expect(sortUnits(['t', 'o', 'm', 'l', 'a', 'i', 's'])).toEqual(['m', 'l', 's', 'a', 'i', 'o', 't']);
  });
});

describe('Zerlegung in Einheiten', () => {
  const cases: [string, string[]][] = [
    ['Schule', ['sch', 'u', 'l', 'e']],
    ['Eis', ['ei', 's']],
    ['Tisch', ['t', 'i', 'sch']],
    ['Sport', ['sp', 'o', 'r', 't']],
    ['Stern', ['st', 'e', 'r', 'n']],
    ['ist', ['i', 's', 't']],
    ['Mast', ['m', 'a', 's', 't']],
    ['Wespe', ['w', 'e', 's', 'p', 'e']],
    ['Biene', ['b', 'ie', 'n', 'e']],
    ['Feier', ['f', 'ei', 'e', 'r']],
    ['Häuser', ['h', 'äu', 's', 'e', 'r']],
    ['Haus', ['h', 'au', 's']],
    ['Eule', ['eu', 'l', 'e']],
    ['Fuß', ['f', 'u', 'ß']],
    ['Ring', ['r', 'i', 'ng']],
    ['Schnecke', ['sch', 'n', 'e', 'ck', 'e']],
    ['Katze', ['k', 'a', 'tz', 'e']],
    ['Pferd', ['pf', 'e', 'r', 'd']],
    ['Qualle', ['qu', 'a', 'l', 'l', 'e']],
    ['Buch', ['b', 'u', 'ch']],
    ['Äpfel', ['ä', 'pf', 'e', 'l']],
    ['Öl', ['ö', 'l']],
  ];
  for (const [w, units] of cases) {
    it(w, () => expect(tokenizeWord(w).units).toEqual(units));
  }
  it('q ohne u und fremde Zeichen sind unbekannt', () => {
    expect(tokenizeWord('Café').unknown).toEqual(['é']);
    expect(tokenizeWord('Qatar').unknown).toEqual(['q']);
  });
});

describe('Filter: nur gelernte Buchstaben', () => {
  it('Startbuchstaben T O M L A I S', () => {
    for (const w of ['Mama', 'Oma', 'Tom', 'Salat', 'Toast', 'ist', 'Mast', 'Lasso', 'Atlas', 'isst']) expect(isAllowed(w, START), w).toBe(true);
    for (const w of ['Tisch', 'Eis', 'Sport', 'Stall', 'Opa', 'Lupe', 'Mia?']) {
      if (w === 'Mia?') expect(isAllowed(w, START)).toBe(true);
      else expect(isAllowed(w, START), w).toBe(false);
    }
  });

  it('Buchstabenverbindung muss selbst gelernt sein', () => {
    const k = set('e', 'i', 's', 'm', 'a', 'l');
    expect(isAllowed('Eis', k)).toBe(false);
    expect(isAllowed('Eis', set(...k, 'ei'))).toBe(true);
    const k2 = set('s', 'p', 'o', 'r', 't');
    expect(isAllowed('Sport', k2)).toBe(false);
    expect(isAllowed('Sport', set(...k2, 'sp'))).toBe(true);
    expect(isAllowed('Tisch', set('t', 'i', 's', 'c', 'h'))).toBe(false);
    expect(isAllowed('Tisch', set('t', 'i', 'sch'))).toBe(true);
  });

  it('Groß- und Kleinschreibung sind gleich', () => {
    expect(isAllowed('TOM', START)).toBe(true);
    expect(isAllowed('tom', START)).toBe(true);
  });

  it('meldet fehlende Einheiten lesbar', () => {
    expect(checkText('Tisch', START)).toEqual({ ok: false, missing: ['Sch'] });
    expect(checkText('Oma isst Eis.', START).missing).toEqual(['Ei']);
    expect(checkText('Ein Hund.', START).missing.sort()).toEqual(['Ei', 'H', 'N', 'U', 'D'].sort());
    expect(checkText('Die Biene', START).missing.sort()).toEqual(['D', 'ie', 'B', 'N', 'E'].sort());
  });

  it('Satzzeichen und Ziffern werden ignoriert', () => {
    expect(isAllowed('„Mama!“, malt Tom – 1x.', START)).toBe(false); // x
    expect(isAllowed('„Mama!“, malt Tom – 1.', START)).toBe(true);
  });

  it('zählt Einheiten', () => {
    expect(countUnit('Lisa isst Salat.', 's')).toBe(4);
    expect(countUnit('Sport ist toll', 'sp')).toBe(1);
  });
});
