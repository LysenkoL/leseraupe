import { describe, expect, it } from 'vitest';
import { sanitizeStolper, sheetReadingWords, updateStolper, STOLPER_PRO_BLATT, type Stolper } from '../src/core/stolper';
import { emptyHistory, generateSheet, readingTexts, type GenParams } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { checkText, UNIT_IDS } from '../src/core/letters';
import { SAMPLE_SHEET } from '../src/core/sample';

describe('B2: Stolperwörter – Liste', () => {
  it('angetippt → auf die Liste; schon drauf → wieder bei 0', () => {
    let r = updateStolper([], ['Mama', 'malt'], ['Mama']);
    expect(r.list).toEqual([{ w: 'Mama', ok: 0 }]);
    r = updateStolper([{ w: 'Mama', ok: 2 }], ['Mama'], ['mama']);
    expect(r.list).toEqual([{ w: 'Mama', ok: 0 }]);
    expect(r.bereit).toEqual([]);
  });

  it('verschwindet nie von selbst: nach 3× nicht angetippt nur ein Hinweis', () => {
    let list: Stolper[] = [{ w: 'Salat', ok: 0 }];
    for (let i = 1; i <= 2; i++) {
      const r = updateStolper(list, ['Salat', 'isst'], []);
      list = r.list;
      expect(list).toEqual([{ w: 'Salat', ok: i }]);
      expect(r.bereit).toEqual([]);
    }
    let r = updateStolper(list, ['Salat'], []);
    expect(r.list).toEqual([{ w: 'Salat', ok: 3 }]);
    expect(r.bereit).toEqual(['Salat']);
    // weiter auf der Liste, Hinweis nur einmal
    r = updateStolper(r.list, ['Salat'], []);
    expect(r.list).toEqual([{ w: 'Salat', ok: 4 }]);
    expect(r.bereit).toEqual([]);
  });

  it('nicht auf dem Blatt → zählt nicht', () => {
    const r = updateStolper([{ w: 'Salat', ok: 2 }], ['Mama'], []);
    expect(r.list).toEqual([{ w: 'Salat', ok: 2 }]);
  });

  it('Wörter zum Antippen: nur aus Wörtern, Sätzen, Geschichte – jedes einmal', () => {
    const w = sheetReadingWords({ ...SAMPLE_SHEET, silben: ['xy'] });
    expect(w).not.toContain('xy');
    const texte = [...SAMPLE_SHEET.woerter, ...SAMPLE_SHEET.kleine, ...SAMPLE_SHEET.saetze, SAMPLE_SHEET.geschichte!.titel, ...SAMPLE_SHEET.geschichte!.saetze].join(' ');
    for (const x of w) expect(texte).toContain(x);
    expect(new Set(w.map((x) => x.toLowerCase())).size).toBe(w.length);
    expect(w).toEqual(expect.arrayContaining(SAMPLE_SHEET.woerter));
  });

  it('kaputte Daten werden repariert', () => {
    expect(sanitizeStolper([{ w: ' Oma ', ok: -1 }, { w: 'oma', ok: 1 }, { w: '' }, null, 5])).toEqual([{ w: 'Oma', ok: 0 }]);
    expect(sanitizeStolper('x')).toEqual([]);
  });
});

describe('B2: Stolperwörter kommen öfter vor, aber nicht immer', () => {
  const letters = [...UNIT_IDS.slice(0, 25), 't']; // bis R, dazu T – ohne K
  const params = (seed: number, stolper: Stolper[]): GenParams => ({
    letters,
    newLetter: null,
    minutes: 5,
    theme: 'wiese',
    childName: '',
    blocks: { ...DEFAULT_BLOCKS },
    history: emptyHistory(),
    seed,
    stufe: 3,
    stolper,
  });
  const STOLPER: Stolper[] = ['Mama', 'malt', 'Ball', 'im'].map((w) => ({ w, ok: 0 }));
  const on = (seed: number, list: Stolper[]) => {
    const s = generateSheet(params(seed, list)).sheet;
    const words = new Set([...s.woerter, ...s.kleine].map((x) => x.toLowerCase()));
    return { s, hits: list.filter((x) => words.has(x.w.toLowerCase())).map((x) => x.w) };
  };

  it('jedes Stolperwort auf 25–95 % der Blätter, höchstens 3 je Blatt, nur gelernte Buchstaben', () => {
    const count = new Map<string, number>();
    const N = 60;
    for (let seed = 1; seed <= N; seed++) {
      const { s, hits } = on(seed, STOLPER);
      expect(hits.length).toBeLessThanOrEqual(STOLPER_PRO_BLATT);
      for (const h of hits) count.set(h, (count.get(h) ?? 0) + 1);
      for (const t of readingTexts(s)) expect(checkText(t, new Set(letters)).ok, t).toBe(true);
    }
    for (const w of STOLPER.map((x) => x.w)) {
      const share = (count.get(w) ?? 0) / N;
      expect(share, w).toBeGreaterThan(0.25);
      expect(share, w).toBeLessThan(0.95);
    }
    // ohne Liste deutlich seltener
    let ohne = 0;
    for (let seed = 1; seed <= N; seed++) {
      const s = generateSheet(params(seed, [])).sheet;
      if (s.woerter.includes('Ball')) ohne++;
    }
    expect(ohne).toBeLessThan(count.get('Ball') ?? 0);
  });

  it('Wort mit nicht gelernter Buchstabe kommt nie aufs Blatt', () => {
    for (let seed = 1; seed <= 20; seed++) expect(on(seed, [{ w: 'Kuchen', ok: 0 }]).hits).toEqual([]);
  });
});
