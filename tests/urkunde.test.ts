import { describe, expect, it } from 'vitest';
import { geradeVoll, PERLEN_JE_RAUPE, raupenstand, renderUrkunde } from '../src/sheet/urkunde';

const blatt = (...tage: number[]) => ({ reads: tage.map((t) => ({ at: `2026-10-${String(t).padStart(2, '0')}T17:00:00.000Z` })) });

describe('B4: Leseraupe aus dem Verlauf', () => {
  it('jeder Lesetag eine Perle; nochmal lesen zählt, zwei Lesungen am selben Tag nur einmal', () => {
    expect(raupenstand([])).toEqual({ perlen: 0, fertig: [] });
    // Tage 3, 1, 5, 6, 2 – Tag 3 kommt doppelt vor (zwei Blätter am selben Tag)
    const s = raupenstand([blatt(3), blatt(), blatt(1, 5, 6), blatt(2), blatt(3)]);
    expect(s.perlen).toBe(5);
    expect(s.fertig).toEqual([]);
  });

  it('bei 10 Perlen eine Urkunde mit dem Tag der 10. Perle, dann neue Raupe', () => {
    // 23 Blätter, Tag 23 … 1 (absichtlich rückwärts)
    const list = Array.from({ length: 23 }, (_, i) => blatt(23 - i));
    const s = raupenstand(list);
    expect(s.perlen).toBe(3);
    expect(s.fertig.map((f) => [f.nr, f.gesamt, f.datum.slice(0, 10)])).toEqual([
      [1, 10, '2026-10-10'],
      [2, 20, '2026-10-20'],
    ]);
    expect(PERLEN_JE_RAUPE).toBe(10);
  });

  it('Fest nur für die Lesung, die die 10. Perle bringt – nicht für eine zweite am selben Tag', () => {
    const zehn = Array.from({ length: 10 }, (_, i) => blatt(i + 1));
    expect(geradeVoll(raupenstand(zehn), '2026-10-10T17:00:00.000Z')).toBe(1);
    // zweite Lesung am 10. Tag: keine neue Perle, kein zweites Fest
    const zweite = [...zehn, { reads: [{ at: '2026-10-10T18:00:00.000Z' }] }];
    expect(geradeVoll(raupenstand(zweite), '2026-10-10T18:00:00.000Z')).toBeNull();
    // 9 Perlen oder 11 Perlen: nichts
    expect(geradeVoll(raupenstand(zehn.slice(0, 9)), '2026-10-09T17:00:00.000Z')).toBeNull();
    expect(geradeVoll(raupenstand([...zehn, blatt(11)]), '2026-10-11T17:00:00.000Z')).toBeNull();
  });

  it('Urkunde: Name oder Linie, Zahl der Blätter, Datum', () => {
    const mit = renderUrkunde({ name: 'Mia', nr: 1, datum: '2026-10-10T17:00:00.000Z', gesamt: 10 });
    expect(mit).toContain('Mia');
    expect(mit).toContain('hat an 10 Tagen gelesen.');
    expect(mit).toContain('<b>10</b><small>Lesetage</small>');
    expect(mit).toContain('10.10.2026');
    expect(renderUrkunde({ name: '', nr: 2, datum: '2026-10-20T17:00:00.000Z', gesamt: 20 })).toContain('uk-linie');
    expect(renderUrkunde({ name: '<b>x</b>', nr: 1, datum: '2026-10-10T17:00:00.000Z', gesamt: 10 })).toContain('&lt;b&gt;');
  });
});
