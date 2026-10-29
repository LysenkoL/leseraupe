import { describe, expect, it } from 'vitest';
import { generateSheet, emptyHistory, historyFrom, readingTexts, rerollBlock, COUNTS, MAX_STUFE, silbenZahl, stufeFor, withSerie, type GenParams } from '../src/core/generator';
import { DEFAULT_BLOCKS, type SheetData, type BlockId } from '../src/core/types';
import { checkText, countUnit, UNIT_IDS, wordsOf } from '../src/core/letters';
import { mulberry32, shuffle } from '../src/core/random';

const START = ['t', 'o', 'm', 'l', 'a', 'i', 's'];
const ALL_BLOCKS = { ...DEFAULT_BLOCKS, aehnlich: true };

function params(letters: string[], over: Partial<GenParams> = {}): GenParams {
  return {
    letters,
    newLetter: letters[letters.length - 1],
    minutes: 5,
    theme: 'wiese',
    childName: 'Mia',
    blocks: ALL_BLOCKS,
    history: emptyHistory(),
    seed: 1,
    ...over,
  };
}

function letterSets(): string[][] {
  const rng = mulberry32(42);
  const sets: string[][] = [START];
  // Fibel-Reihenfolge, wachsend
  for (let n = 4; n <= 43; n += 3) sets.push(UNIT_IDS.slice(0, n));
  // T O M L A I S + zufällige weitere
  for (let i = 0; i < 25; i++) {
    const extra = shuffle(UNIT_IDS.filter((u) => !START.includes(u)), rng).slice(0, Math.floor(rng() * 20));
    sets.push([...START, ...extra]);
  }
  // ganz zufällige, auch sehr kleine Mengen
  for (let i = 0; i < 15; i++) sets.push(shuffle(UNIT_IDS, rng).slice(0, 2 + Math.floor(rng() * 25)));
  return sets;
}

function assertOnlyKnown(sheet: SheetData, letters: string[]) {
  const known = new Set(letters);
  for (const t of readingTexts(sheet)) {
    const r = checkText(t, known);
    expect(r.ok, `"${t}" enthält ${r.missing.join(', ')} – gelernt: ${letters.join(' ')}`).toBe(true);
  }
}

describe('Generator: kein ungelernter Buchstabe', () => {
  const sets = letterSets();
  for (const [i, letters] of sets.entries()) {
    for (const minutes of [5, 10] as const) {
      it(`Menge ${i} (${letters.length} Einheiten), ${minutes} Min`, () => {
        for (const seed of [1, 2, 3]) {
          const { sheet } = generateSheet(params(letters, { minutes, seed }));
          assertOnlyKnown(sheet, letters);
        }
      });
    }
  }
});

describe('Generator: Umfang', () => {
  for (const minutes of [5, 10] as const) {
    it(`T O M L A I S, ${minutes} Min: volle Blöcke`, () => {
      const c = COUNTS[minutes];
      const { sheet } = generateSheet(params(START, { minutes }));
      expect(sheet.silben).toHaveLength(c.silben);
      expect(sheet.woerter).toHaveLength(c.woerter);
      expect(sheet.kleine).toHaveLength(c.kleine);
      expect(sheet.saetze).toHaveLength(c.saetze);
      expect(sheet.geschichte!.saetze.length).toBe(c.geschichte);
      expect(sheet.fragen.length).toBeGreaterThanOrEqual(c.fragen[0]);
      expect(sheet.fragen.length).toBeLessThanOrEqual(c.fragen[1]);
      expect(sheet.quest).not.toBeNull();
      expect(sheet.aehnlich).toBeNull(); // Block „Ähnliche Buchstaben“ entfällt (A6)
    });
  }

  it('wenige Buchstaben: Blöcke kürzer statt erfunden', () => {
    const { sheet } = generateSheet(params(['m', 'a']));
    expect(sheet.woerter.length).toBeLessThan(20);
    assertOnlyKnown(sheet, ['m', 'a']);
  });

  it('keine Silbentrennstriche', () => {
    for (const letters of letterSets().slice(0, 20)) {
      const { sheet } = generateSheet(params(letters, { minutes: 10 }));
      for (const t of readingTexts(sheet)) expect(t).not.toMatch(/\p{L}-\p{L}/u);
    }
  });

  it('Wörter: zuerst kurze', () => {
    const { sheet } = generateSheet(params(START));
    const lens = sheet.woerter.map((w) => [...w].length);
    expect([...lens].sort((a, b) => a - b)).toEqual(lens);
  });

  it('keine doppelten Wörter innerhalb eines Blatts', () => {
    const { sheet } = generateSheet(params(UNIT_IDS.slice(0, 30), { minutes: 10 }));
    const all = [...sheet.woerter, ...sheet.kleine];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(sheet.saetze).size).toBe(sheet.saetze.length);
    for (const s of sheet.saetze) expect(sheet.geschichte!.saetze).not.toContain(s);
  });
});

describe('Generator: neuer Buchstabe häufiger', () => {
  it('mindestens die Hälfte der Wörter enthält den neuen Buchstaben', () => {
    const letters = [...START, 'e', 'n'];
    const { sheet } = generateSheet(params(letters, { newLetter: 'n' }));
    const withN = sheet.woerter.filter((w) => countUnit(w, 'n') > 0).length;
    expect(withN / sheet.woerter.length).toBeGreaterThanOrEqual(0.5);
    const withNSilben = sheet.silben.filter((s) => s.includes('n')).length;
    expect(withNSilben / sheet.silben.length).toBeGreaterThanOrEqual(0.4);
  });
});

describe('Generator: keine Wiederholung mit den letzten zwei Blättern', () => {
  it('zwei Blätter hintereinander haben keine gemeinsamen Wörter', () => {
    const letters = [...START, 'e', 'n', 'r'];
    const stored: { seq: number; data: SheetData }[] = [];
    for (let seq = 1; seq <= 4; seq++) {
      const h = historyFrom(stored, seq);
      const { sheet } = generateSheet(params(letters, { history: h, seed: seq * 11 }));
      for (const prev of stored.slice(-2)) {
        const overlap = sheet.woerter.filter((w) => prev.data.woerter.includes(w));
        expect(overlap, `Blatt ${seq} vs ${prev.seq}`).toEqual([]);
        expect(sheet.saetze.filter((s) => prev.data.saetze.includes(s))).toEqual([]);
      }
      stored.push({ seq, data: sheet });
    }
  });

  it('wenn Wörter knapp sind, kommen die am längsten unbenutzten', () => {
    const letters = ['m', 'a', 'l', 'o'];
    const stored: { seq: number; data: SheetData }[] = [];
    for (let seq = 1; seq <= 3; seq++) {
      const { sheet } = generateSheet(params(letters, { history: historyFrom(stored, seq), seed: seq }));
      assertOnlyKnown(sheet, letters);
      stored.push({ seq, data: sheet });
    }
    expect(stored[2].data.woerter.length).toBeGreaterThan(0);
  });
});

describe('↻ einzelner Block', () => {
  const blocks: BlockId[] = ['silben', 'woerter', 'kleine', 'aehnlich', 'saetze', 'geschichte', 'quest'];
  for (const b of blocks) {
    it(b, () => {
      const p = params([...START, 'e', 'n', 'r', 'u', 'h', 'd']);
      const { sheet } = generateSheet(p);
      const s2 = rerollBlock(sheet, b, { ...p, seed: 99 });
      assertOnlyKnown(s2, p.letters);
      const other = blocks.filter((x) => x !== b && !(b === 'geschichte' && x === 'quest'));
      for (const o of other) {
        if (o === 'geschichte') expect(s2.geschichte).toEqual(sheet.geschichte);
        else if (o !== 'quest') expect((s2 as unknown as Record<string, unknown>)[o]).toEqual((sheet as unknown as Record<string, unknown>)[o]);
      }
    });
  }
});

describe('B1: Schwierigkeit wächst innerhalb einer Buchstabe', () => {
  const MITTEL = UNIT_IDS.slice(0, 25);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const messen = (stufe: number, letters: string[]) => {
    const wortLen: number[] = [];
    const satzLen: number[] = [];
    const mehr: number[] = [];
    for (let seed = 1; seed <= 25; seed++) {
      const s = generateSheet(params(letters, { seed, stufe })).sheet;
      expect(s.stufe).toBe(stufe);
      wortLen.push(avg(s.woerter.map((w) => [...w].length)));
      mehr.push(s.woerter.filter((w) => silbenZahl(w) >= 2).length / s.woerter.length);
      satzLen.push(avg(s.saetze.map((x) => wordsOf(x).length)));
      for (const t of readingTexts(s)) expect(checkText(t, new Set(letters)).ok, t).toBe(true);
    }
    return { wort: avg(wortLen), satz: avg(satzLen), mehr: avg(mehr) };
  };

  it('Stufe 1 hat kürzere Wörter, weniger Zweisilber und kürzere Sätze als Stufe 3', () => {
    for (const letters of [START, MITTEL]) {
      const s1 = messen(1, letters);
      const s3 = messen(3, letters);
      expect(s1.wort, letters.join('')).toBeLessThan(s3.wort);
      expect(s1.satz, letters.join('')).toBeLessThan(s3.satz);
      expect(s1.mehr, letters.join('')).toBeLessThan(s3.mehr);
    }
  });

  it('Stufe zählt Blätter mit denselben Buchstaben; neue Buchstabe → wieder Stufe 1', () => {
    const blatt = (letters: string[]) => ({ letters });
    expect(stufeFor([], START)).toBe(1);
    expect(stufeFor([blatt(START), blatt([...START].reverse())], START)).toBe(3);
    expect(stufeFor([blatt(START), blatt(START)], [...START, 'e'])).toBe(1);
    expect(stufeFor(Array.from({ length: 9 }, () => blatt(START)), START)).toBe(MAX_STUFE);
  });
});

describe('A6: mehrere Blätter auf einmal', () => {
  it('4 Blätter: keine Wörter, Sätze oder Geschichten doppelt', () => {
    const letters = UNIT_IDS.slice(0, 25);
    const done: SheetData[] = [];
    for (let i = 0; i < 4; i++) {
      const h = withSerie({ ...emptyHistory(), seq: 1 + i }, done);
      done.push(generateSheet(params(letters, { seed: 100 + i, stufe: 1 + i, history: h })).sheet);
    }
    const woerter = done.flatMap((d) => [...d.woerter, ...d.kleine]);
    expect(new Set(woerter).size).toBe(woerter.length);
    const saetze = done.flatMap((d) => d.saetze);
    expect(new Set(saetze).size).toBe(saetze.length);
    const titel = done.flatMap((d) => (d.geschichte ? [d.geschichte.titel] : []));
    expect(new Set(titel).size).toBe(titel.length);
    expect(done.map((d) => d.stufe)).toEqual([1, 2, 3, 4]);
  });
});

describe('Neue Buchstabe im Mittelpunkt (Review 29.10.)', () => {
  const letters = ['m', 'l', 's', 'a', 'e', 'i', 'o', 't'];
  for (const stufe of [undefined, 1, 3, 5]) {
    it(`Stufe ${stufe ?? '–'}: ≥ 50 % der Wörter und Sätze mit E/e`, () => {
      let w = 0, wt = 0, s = 0, st = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const sh = generateSheet(params(letters, { newLetter: 'e', seed, stufe })).sheet;
        w += sh.woerter.filter((x) => countUnit(x, 'e') > 0).length;
        wt += sh.woerter.length;
        s += sh.saetze.filter((x) => countUnit(x, 'e') > 0).length;
        st += sh.saetze.length;
      }
      expect(w / wt).toBeGreaterThanOrEqual(0.5);
      expect(s / st).toBeGreaterThanOrEqual(0.5);
    });
  }

  it('Silben: Reihen und Spiegelpaare mit der neuen Buchstabe', () => {
    const sh = generateSheet(params(letters, { newLetter: 'e', seed: 4 })).sheet;
    const s = sh.silben;
    expect(s.filter((x) => x.includes('e')).length / s.length).toBeGreaterThanOrEqual(0.4);
    // Spiegelpaar „el“ steht direkt vor „le“ (o. ä.)
    const pair = s.findIndex((x, i) => x.length === 2 && x[0] === 'e' && s[i + 1] === x[1] + 'e');
    expect(pair).toBeGreaterThanOrEqual(0);
  });

  it('Quest „Finde!“ nennt groß und klein', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = generateSheet(params(letters, { newLetter: 'e', seed })).sheet.quest!;
      if (q.kind === 'finde') {
        expect(q.text).toBe('Kreise alle Wörter mit E oder e ein.');
        return;
      }
    }
    throw new Error('kein Finde-Quest erzeugt');
  });
});
