import { describe, expect, it } from 'vitest';
import { buildPrompt, extractJson, parseChat, sheetFromChat, PARSE_ERROR } from '../src/core/chat';
import { emptyHistory, readingTexts } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { checkText } from '../src/core/letters';

const START = ['t', 'o', 'm', 'l', 'a', 'i', 's'];
const P = {
  letters: START,
  newLetter: 's',
  minutes: 5 as const,
  theme: 'wiese' as const,
  childName: 'Mia',
  blocks: DEFAULT_BLOCKS,
  aehnlichPair: ['l', 'I'] as [string, string],
  history: emptyHistory(),
  seed: 3,
};

const GOOD = {
  woerter: ['Mama', 'Oma', 'Tisch', 'Salat', 'Ma-ma', 'Eis'],
  kleineWoerter: ['am', 'im', 'und'],
  saetze: ['Mama malt.', 'Oma isst Eis.', 'Tom ist toll.'],
  geschichte: { titel: 'Im Tal', saetze: ['Tim ist im Tal.', 'Tim sieht Oma.', 'Toll, Tim!'] },
  fragen: ['Wo ist Tim?', 'Wen sieht Tim?', 'Was sagt Tim?'],
};

describe('Prompt', () => {
  it('enthält Buchstaben, Verbindungen, neuen Buchstaben und Mengen', () => {
    const p = buildPrompt(['t', 'o', 'm', 'l', 'a', 'i', 's'], 's', 5);
    expect(p).toContain('Das Kind kennt NUR diese Buchstaben: M, L, S, A, I, O, T.');
    expect(p).toContain('Neuester Buchstabe (bitte oft verwenden): S.');
    expect(p).toContain('Bekannte Buchstabenverbindungen: keine.');
    expect(p).toContain('Lesezeit: 5 Minuten.');
    expect(p).toContain('"woerter": [20 Wörter]');
    expect(p).toContain('"saetze": [7 Sätze]');
    const p10 = buildPrompt(['t', 'sch', 'ei', 'ie'], 'ie', 10);
    expect(p10).toContain('Bekannte Buchstabenverbindungen: Sch, Ei, ie.');
    expect(p10).toContain('"woerter": [30 Wörter]');
    expect(p10).toContain('"geschichte": { "titel": "...", "saetze": [12 Sätze] }');
  });
});

describe('JSON aus der Antwort', () => {
  it('reines JSON', () => {
    expect(extractJson(JSON.stringify(GOOD))).toEqual(GOOD);
  });
  it('mit ```json und Text drumherum', () => {
    const t = `Hier ist dein Lesetext:\n\n\`\`\`json\n${JSON.stringify(GOOD, null, 2)}\n\`\`\`\n\nViel Spaß beim Lesen!`;
    expect(extractJson(t)).toEqual(GOOD);
  });
  it('mit Text, ohne Codeblock, mit Komma am Ende', () => {
    const t = `Klar! { "woerter": ["Mama", "Oma",], "saetze": ["Mama malt."], "geschichte": {"titel": "A", "saetze": []}, "fragen": [] } Fertig.`;
    expect(parseChat(t).woerter).toEqual(['Mama', 'Oma']);
  });
  it('Fehler bei Unsinn', () => {
    expect(() => parseChat('Ich kann leider nicht helfen.')).toThrow(PARSE_ERROR);
    expect(() => parseChat('{"foo": 1}')).toThrow(PARSE_ERROR);
  });
});

describe('Blatt aus Chat-Antwort', () => {
  it('fremde Buchstaben werden aussortiert und angezeigt', () => {
    const { sheet, removed } = sheetFromChat(parseChat(JSON.stringify(GOOD)), P);
    expect(sheet.woerter).toEqual(['Oma', 'Mama', 'Salat']);
    expect(sheet.saetze).toEqual(['Mama malt.', 'Tom ist toll.']);
    expect(sheet.geschichte).toEqual({ titel: 'Im Tal', saetze: ['Tim ist im Tal.', 'Toll, Tim!'] });
    expect(removed.map((r) => r.text)).toEqual(expect.arrayContaining(['Tisch', 'Eis', 'und', 'Oma isst Eis.', 'Tim sieht Oma.']));
    expect(removed.find((r) => r.text === 'Tisch')!.missing).toEqual(['Sch']);
    // Fragen an Eltern sind ausgenommen
    expect(sheet.fragen).toHaveLength(3);
    const known = new Set(START);
    for (const t of readingTexts(sheet)) expect(checkText(t, known).ok, t).toBe(true);
    expect(sheet.silben.length).toBe(18);
    expect(sheet.source).toBe('chat');
  });
});
