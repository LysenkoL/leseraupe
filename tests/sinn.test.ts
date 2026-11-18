import { describe, expect, it } from 'vitest';
import { Vocab } from '../src/core/vocab';
import { pools, templateSentences, templateStory } from '../src/core/saetze';
import { mulberry32 } from '../src/core/random';
import { sortUnits, UNIT_IDS, wordsOf } from '../src/core/letters';
import { DICT } from '../src/core/dict';
import { generateSheet, historyFrom, stufeFor, zaehlWoerter } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { N_DEKLINATION, NICHT_FUER_PERSONEN, NICHT_FUER_PERSONEN_ADJ, ABSTRAKT, KOERPER, TRAGBAR, HAUSTIERE, NICHT_ESSEN, essenAdjOk, FINDBAR } from '../src/core/sinn';

/** Zwei typische Reihenfolgen der Fibeln und die Startbuchstaben der App */
const REIHEN = [
  ['m', 'a', 'l', 'i', 'o', 's', 't', 'e', 'n', 'r', 'u', 'h', 'd', 'ei', 'au', 'b', 'f', 'w', 'k', 'g', 'p', 'z', 'ie', 'ch', 'sch', 'ck'],
  ['a', 'm', 'o', 'l', 'i', 't', 'e', 'n', 's', 'r', 'u', 'd', 'w', 'ei', 'h', 'f', 'k', 'b', 'au', 'g', 'sch', 'ch', 'p', 'ie', 'z', 'j'],
  ['t', 'o', 'm', 'l', 'a', 'i', 's', 'e', 'n', 'r', 'u', 'h', 'd', 'ei', 'b', 'f', 'w', 'k', 'au', 'g', 'p', 'z', 'ie', 'ch', 'sch', 'ck'],
];

const NAMEN = new Set(DICT.woerter.filter((e) => e.typ === 'Name').map((e) => e.w));
const TIERE = new Set(DICT.woerter.filter((e) => e.tags.includes('tier')).map((e) => e.w));
const ESSEN = new Set(DICT.woerter.filter((e) => e.tags.includes('essen')).map((e) => e.w));

/** Alle Vorlagensätze und -geschichten für alle Buchstabenstände der Reihenfolgen */
function alleVorlagen(): string[] {
  const out = new Set<string>();
  const sets = [...REIHEN.flatMap((r) => r.map((_, i) => r.slice(0, i + 1)).filter((l) => l.length >= 5)), [...UNIT_IDS]];
  for (const l of sets) {
    const v = new Vocab(new Set(sortUnits(l)));
    const p = pools(v);
    for (let seed = 1; seed <= 6; seed++) {
      const rng = mulberry32(seed * 977 + l.length);
      for (const s of templateSentences(v, p, rng, 160)) out.add(s);
      const st = templateStory(v, p, rng, 12);
      if (st) for (const s of st.saetze) out.add(s);
    }
  }
  return [...out];
}

describe('Vorlagensätze: richtig und sinnvoll', () => {
  const saetze = alleVorlagen();

  it('es gibt genug Vorlagensätze zum Prüfen', () => {
    expect(saetze.length).toBeGreaterThan(3000);
  });

  it('n-Deklination: nie „den Hase“, „den Elefant“ – immer „den Hasen“, „den Elefanten“', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      return w.some((x, i) => (w[i - 1] === 'den' || w[i - 1] === 'einen') && x in N_DEKLINATION && N_DEKLINATION[x] !== x);
    });
    expect(falsch).toEqual([]);
  });

  it('Kinder bellen, muhen und fliegen nicht („Luna muht“)', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      return w.length === 2 && NAMEN.has(w[0]) && NICHT_FUER_PERSONEN.has(w[1]);
    });
    expect(falsch).toEqual([]);
  });

  it('über Kinder kein „dick“, „dünn“, „grau“, „zahm“', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      return NAMEN.has(w[0]) && w[1] === 'ist' && NICHT_FUER_PERSONEN_ADJ.has(w[w.length - 1]);
    });
    expect(falsch).toEqual([]);
  });

  it('Objekte passen zum Verb: nichts Abstraktes, keine Körperteile; haben/holen nur Tragbares und Haustiere', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      if (w.length !== 4 || !NAMEN.has(w[0]) || !['der', 'die', 'das', 'den'].includes(w[2])) return false;
      const [, vb, , o0] = w;
      // „den Drachen“ ist auch der Papierdrachen (tragbar)
      const o = TRAGBAR.has(o0) ? o0 : (Object.entries(N_DEKLINATION).find(([, f]) => f === o0)?.[0] ?? o0);
      if (ABSTRAKT.has(o) || KOERPER.has(o)) return true;
      if (vb === 'hat' || vb === 'holt') return !(TRAGBAR.has(o) || HAUSTIERE.has(o));
      if (vb === 'sucht' || vb === 'findet') return !(TRAGBAR.has(o) || FINDBAR.has(o) || TIERE.has(o));
      return false;
    });
    expect(falsch).toEqual([]);
  });

  it('„mag“ ohne Artikel: „mag Nudeln“, nie „mag eine Nudel“', () => {
    expect(saetze.filter((s) => /\bmag (eine?n?|ein) /.test(s))).toEqual([]);
  });

  it('Kinder essen kein Futter und keinen Senf', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      return w.includes('isst') && w.some((x) => NICHT_ESSEN.has(x));
    });
    expect(falsch).toEqual([]);
  });

  it('Essen und Adjektiv passen („Der Kuchen ist süß“, nie „Das Eis ist sauer“)', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      return w.length === 4 && ['Der', 'Die', 'Das'].includes(w[0]) && ESSEN.has(w[1]) && !TIERE.has(w[1]) && w[2] === 'ist' && !essenAdjOk(w[3], w[1]);
    });
    expect(falsch).toEqual([]);
  });

  it('Tiere sind nicht „sauer“ oder „dick“; grau nur graue Tiere', () => {
    const falsch = saetze.filter((s) => {
      const w = wordsOf(s);
      if (w.length !== 4 || !['Der', 'Die', 'Das'].includes(w[0]) || !TIERE.has(w[1]) || w[2] !== 'ist') return false;
      return ['sauer', 'dick', 'dünn', 'fit'].includes(w[3]) || (w[3] === 'grau' && !['Maus', 'Elefant', 'Esel', 'Wolf', 'Nashorn', 'Nilpferd', 'Delfin', 'Hai', 'Taube', 'Koala', 'Robbe', 'Elch', 'Mammut', 'Walross'].includes(w[1]));
    });
    expect(falsch).toEqual([]);
  });
});

describe('Zähle!', () => {
  it('nur Nomen und Namen – nie „Er“, „Am“, „Nun“, „Toll“', () => {
    const verboten = /^(Der|Die|Das|Er|Sie|Es|Am|Im|Da|Nun|Dann|Doch|Ich|Auf|Alle|Und|Toll|Heute|Nach|Eine|Ein|Mein|Unter|Leise|Hallo|Erste|Wuff|Quak|Tuuut)$/;
    const ziele = DICT.geschichten.flatMap((g) => zaehlWoerter(g.saetze));
    expect(ziele.filter((w) => verboten.test(w))).toEqual([]);
    // es bleiben genug Ziele übrig
    expect(DICT.geschichten.filter((g) => zaehlWoerter(g.saetze).length).length).toBeGreaterThan(120);
  });

  it('gezählt wird genau: das Wort steht so oft da, wie die Lösung sagt, und nicht auch als „Toms“', () => {
    for (const g of DICT.geschichten) {
      for (const w of zaehlWoerter(g.saetze)) {
        const alle = wordsOf(g.saetze.join(' '));
        expect(alle.filter((x) => x === w).length).toBeGreaterThanOrEqual(2);
        expect(alle.includes(`${w}s`)).toBe(false);
      }
    }
  });
});

describe('Abwechslung im Satzblock', () => {
  it('neue Buchstabe H: nicht ständig „… ist im Hotel“ – jedes Inhaltswort höchstens zweimal pro Blatt', () => {
    const letters = sortUnits(['m', 'a', 'l', 'i', 'o', 's', 't', 'e', 'n', 'r', 'u', 'h']);
    const saved: { seq: number; data: ReturnType<typeof generateSheet>['sheet'] }[] = [];
    for (let i = 1; i <= 8; i++) {
      const stufe = stufeFor(saved.map((x) => ({ letters: x.data.letters })), letters);
      const g = generateSheet({ letters, newLetter: 'h', minutes: 5, theme: 'wiese', childName: '', blocks: { ...DEFAULT_BLOCKS }, history: historyFrom(saved, i), seed: 4242 + i * 7919, stufe });
      const zaehl = new Map<string, number>();
      for (const s of g.sheet.saetze) for (const w of new Set(wordsOf(s).slice(1).filter((x) => x.length >= 3 && !['ist', 'malt', 'isst', 'den', 'die', 'das', 'der', 'hat', 'und', 'mag', 'mit', 'auf', 'aus', 'ein', 'eine', 'einen', 'sind', 'nicht', 'ganz', 'auch', 'noch'].includes(x.toLowerCase())))) zaehl.set(w, (zaehl.get(w) ?? 0) + 1);
      expect(Math.max(0, ...zaehl.values()), g.sheet.saetze.join(' | ')).toBeLessThanOrEqual(2);
      // R1: die neue Buchstabe bleibt im Satzblock vorn – auch auf hohen Stufen
      expect(g.sheet.saetze.filter((x) => /h/i.test(x)).length, `Blatt ${i}: ${g.sheet.saetze.join(' | ')}`).toBeGreaterThanOrEqual(4);
      saved.push({ seq: i, data: g.sheet });
    }
  });
});

describe('Fertige Texte: keiner ist „tot“', () => {
  it('jede Geschichte und jeder Satz kann bei allen Buchstaben aufs Blatt (kein Wort vom Aussprache- oder Inhaltsfilter)', async () => {
    const { isSuitable } = await import('../src/core/content');
    const { checkText } = await import('../src/core/letters');
    const alle = new Set(UNIT_IDS);
    const tot = [
      ...DICT.geschichten.flatMap((g) => [g.titel, ...g.saetze].filter((s) => !isSuitable(s) || !checkText(s, alle).ok).map((s) => `${g.titel}: ${s}`)),
      ...DICT.saetze.filter((s) => !isSuitable(s) || !checkText(s, alle).ok),
    ];
    expect(tot).toEqual([]);
  });

  it('n-Deklination auch in fertigen Texten: nie „den Bauer“, „einen Kuschelbär“', () => {
    const stamm = Object.keys(N_DEKLINATION).join('|');
    const re = new RegExp(`\\b(den|dem|einen|einem|meinen|meinem|seinen|seinem|ihren|ihrem|unseren|unserem|alten|kleinen|großen)\\s+(\\p{Lu}\\p{Ll}*)?(${stamm})\\b`, 'u');
    const falsch = [...DICT.saetze, ...DICT.geschichten.flatMap((g) => [...g.saetze, ...g.fragen])].filter((s) => {
      const m = s.match(re);
      return m && !/(Drachen)$/.test(m[0]);
    });
    expect(falsch).toEqual([]);
  });
});
