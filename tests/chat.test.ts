import { analyzeMaterial } from '../src/core/material';
import { describe, expect, it } from 'vitest';
import { buildPrompt, extractJson, parseChat, sheetFromChat, PARSE_ERROR } from '../src/core/chat';
import { emptyHistory, readingTexts } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { checkText, UNIT_IDS } from '../src/core/letters';

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
    expect(p).toContain('Bekannte Buchstaben: M, L, S, A, I, O, T.');
    expect(p).toContain('Neuer Buchstabe: S.');
    expect(p).toContain('Bekannte Buchstabenverbindungen: keine.');
    expect(p).toContain('Lesezeit: 5 Minuten.');
    expect(p).toContain('Bis zu 20 verschiedene geläufige Wörter');
    expect(p).toContain('7 kurze, natürliche, vollständige Sätze');
    const p10 = buildPrompt(['t', 'sch', 'ei', 'ie'], 'ie', 10);
    expect(p10).toContain('Bekannte Buchstabenverbindungen: Sch, Ei, ie.');
    expect(p10).toContain('Bis zu 30 verschiedene geläufige Wörter');
    expect(p10).toContain('12 Sätzen');
    const afterRemoval = buildPrompt(['m', 'a', 'sch'], 's', 5);
    expect(afterRemoval).toContain('Bekannte Buchstaben: M, A.');
    expect(afterRemoval).toContain('Bekannte Buchstabenverbindungen: Sch.');
    expect(afterRemoval).toContain('Neuer Buchstabe: keiner.');
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
    expect(sheet.woerter).toEqual(['Oma', 'Mama', 'Lama', 'lila', 'Salat']);
    expect(sheet.saetze).toHaveLength(3);
    expect(sheet.saetze.slice(0, 2)).toEqual(['Mama malt.', 'Tom ist toll.']);
    expect(sheet.localBlocks).toEqual(expect.arrayContaining(['woerter', 'saetze']));
    expect(sheet.geschichte?.saetze).toEqual(analyzeMaterial(START).stories[0].saetze);
    expect(sheet.localBlocks).toContain('geschichte');
    expect(removed.map((r) => r.text)).toEqual(expect.arrayContaining(['Tisch', 'Eis', 'und', 'Oma isst Eis.', 'Tim sieht Oma.']));
    expect(removed.find((r) => r.text === 'Tisch')!.missing).toEqual(['Sch']);
    // Keine Fragen über eine Geschichte, aus der ein Satz entfernt werden musste
    expect(sheet.fragen).toEqual(analyzeMaterial(START).stories[0].fragen.slice(0,4));
    const known = new Set(START);
    for (const t of readingTexts(sheet)) expect(checkText(t, known).ok, t).toBe(true);
    expect(sheet.silben.length).toBe(18);
    expect(sheet.source).toBe('chat');
  });
});


describe('Antworten aus der Zwischenablage', () => {
  it('akzeptiert Markdown-escapte Klammern', () => {
    const text = JSON.stringify(GOOD).replaceAll('[', String.raw`\[`).replaceAll(']', String.raw`\]`);
    expect(parseChat(text)).toEqual(GOOD);
  });
  it('akzeptiert einen als JSON-String kopierten vollständigen Antworttext', () => {
    expect(parseChat(JSON.stringify(JSON.stringify(GOOD)))).toEqual(GOOD);
  });
  it('akzeptiert Kleinschreibung der Feldnamen', () => {
    expect(parseChat('{"woerter":["Mama"],"kleinewoerter":["am"]}').kleineWoerter).toEqual(['am']);
  });
  it('weist vollständig weggefilterten Lesetext zurück', () => {
    expect(() => sheetFromChat(parseChat('{"woerter":["Esel"]}'), { ...P, letters: ['a'] })).toThrow();
  });
});

it('Antwort mit nur kurzen Wörtern ist gültig', () => {
  expect(parseChat('{"kleineWoerter":["am"]}').kleineWoerter).toEqual(['am']);
});

it('запрос явно запрещает неизученные буквы и сочетания, включает проверенные слова', () => {
  const prompt = buildPrompt(['l','s','d','a','i','o','ü','h','r','t','k','c'], 'h', 5);
  expect(prompt).toContain('Bekannte Buchstaben');
  expect(prompt).toContain('bleiben gesperrt');
  expect(prompt).toContain('die einzelnen Buchstaben bekannt');
});
it('12 выбранных букв допускают предложения без невыученных сочетаний', () => {
  const letters = ['l','s','d','a','i','o','ü','h','r','t','k','c'];
  const answer = parseChat(JSON.stringify({woerter:['Rad'],saetze:['Lisa hat das Rad.','Das Rad ist rot.'],geschichte:{titel:'Das Rad',saetze:['Lisa hat das Rad.','Das Rad ist rot.']}}));
  const {sheet} = sheetFromChat(answer,{...P,letters,newLetter:'h'});
  expect(sheet.saetze).toHaveLength(2);
  expect(sheet.geschichte?.saetze).toHaveLength(2);
});


describe('Качество начального листа из ИИ', () => {
  const letters = ['l','s','a','i'];
  const screenshot = { woerter: ['Ali','All','als','Ass','Aal','Aas','Lisa','lila','Saal','Silas','Lissi','Lilli'], kleineWoerter: ['als'], saetze: [], geschichte: {titel:'',saetze:[]}, fragen: [] };
  it('не печатает Aas и Ass, ограничивает имена и не строит отдельный блок для als', () => {
    const {sheet} = sheetFromChat(parseChat(JSON.stringify(screenshot)), {...P, letters, newLetter:null});
    const words = [...sheet.woerter,...sheet.kleine];
    expect(words.map(w=>w.toLowerCase())).not.toContain('aas');
    expect(words.map(w=>w.toLowerCase())).not.toContain('ass');
    const names = new Set(words.filter(w=>['Ali','Lisa','Silas','Lissi','Lilli'].includes(w)));
    expect(names.size).toBeLessThanOrEqual(2);
    expect(sheet.kleine).toEqual([]);
    expect(sheet.saetze).toContain('Lisa las.');
    expect(sheet.quest?.kind).not.toBe('geheimwort');
    expect(sheet.practice).not.toBe(true);
    expect(sheet.geschichte).toBeNull();
    for (const text of readingTexts(sheet)) expect(checkText(text,new Set(letters)).ok).toBe(true);
  });
  it('не вырезает середину истории, оставляя вопросы о вырезанном', () => {
    const {sheet} = sheetFromChat(parseChat(JSON.stringify(GOOD)),P);
    expect(sheet.geschichte?.saetze).toEqual(analyzeMaterial(START).stories[0].saetze);
    expect(sheet.localBlocks).toContain('geschichte');
    expect(sheet.fragen).toEqual(analyzeMaterial(START).stories[0].fragen.slice(0,4));
  });
});


describe('Один фильтр до и после ИИ', () => {
  const letters = ['l','s','a','e','i'];
  it('создаёт доступные выбранные предложения, даже если ответ ИИ прислал только слова', () => {
    const answer = parseChat('{"woerter":["Lisa","Esel","Eis"],"saetze":[]}');
    const {sheet,removed} = sheetFromChat(answer,{...P,letters,newLetter:'e'});
    expect(sheet.saetze).toContain('Lisa las alles.');
    expect(sheet.practice).not.toBe(true);
    expect(sheet.localBlocks).toContain('saetze');
    expect(removed.some(r=>r.text==='Eis' && r.missing.includes('Ei'))).toBe(true);
    for (const text of readingTexts(sheet)) expect(checkText(text,new Set(letters)).ok).toBe(true);
  });
});

it('не добавляет предложения вопреки явному выбору пользователя', () => {
  const blocks = {...DEFAULT_BLOCKS,saetze:false,geschichte:false,fragen:false};
  const {sheet} = sheetFromChat(parseChat('{"woerter":["Lisa","lila"]}'),{...P,letters:['l','s','a','e','i'],blocks});
  expect(sheet.saetze).toEqual([]);
  expect(sheet.localBlocks ?? []).not.toContain('saetze');
  expect(buildPrompt(['l','s','a','e','i'],null,5,blocks)).not.toContain('saetze darf nicht leer sein');
});

it('заголовок истории проходит тот же фильтр смысла и словаря, что её предложения', () => {
  const answer = parseChat('{"woerter":["Mama"],"geschichte":{"titel":"Aas","saetze":["Mama malt."]}}');
  const {sheet,removed} = sheetFromChat(answer,P);
  expect(sheet.geschichte?.titel).not.toBe('Aas');
  expect(removed.some(r=>r.text==='Aas' && r.reason==='unsuitable')).toBe(true);
});
it('правильный пустой JSON разрешён, когда выбраны только локальные слоги', () => {
  const blocks = Object.fromEntries(Object.keys(DEFAULT_BLOCKS).map(key=>[key,key==='silben'])) as typeof DEFAULT_BLOCKS;
  const answer = parseChat('{"woerter":[],"kleineWoerter":[],"saetze":[],"geschichte":{"titel":"","saetze":[]},"fragen":[]}');
  const {sheet} = sheetFromChat(answer,{...P,letters:['m','a'],blocks});
  expect(sheet.silben.length).toBeGreaterThan(0);
});

it('пустая история null также разрешена для локальных слогов', () => {
  const answer = parseChat('{"woerter":[],"kleineWoerter":[],"saetze":[],"geschichte":null,"fragen":[]}');
  expect(answer.geschichte).toEqual({titel:'',saetze:[]});
});

it('отключённые поля ответа не проверяются и не возвращаются на лист', () => {
  const blocks = {...DEFAULT_BLOCKS,saetze:false,geschichte:false,fragen:false};
  const {sheet,removed} = sheetFromChat(parseChat(JSON.stringify(GOOD)),{...P,blocks});
  expect(sheet.saetze).toEqual([]);
  expect(sheet.geschichte).toBeNull();
  expect(sheet.fragen).toEqual([]);
  expect(removed.map(x=>x.text)).not.toContain('Tim sieht Oma.');
});

it('цельная история из восьми предложений не заменяется молча', () => {
  const story = {titel:'Das Bild',saetze:['Lisa hat ein Bild.','Das Bild ist bunt.','Lisa malt ein Haus.','Ali malt eine Blume.','Lisa malt die Sonne.','Ali malt den Baum.','Das Bild ist nun bunt.','Lisa und Ali lachen.']};
  const {sheet} = sheetFromChat({...parseChat('{"woerter":["Bild"]}'),geschichte:story},{...P,letters:UNIT_IDS,newLetter:null});
  expect(sheet.geschichte).toEqual(story);
  expect(sheet.localBlocks).not.toContain('geschichte');
});

it('JSON-ремонт не меняет содержимое строк и немецкие кавычки', () => {
  expect(parseChat('{"saetze":["Mama,}","Mama sagt: „Hallo!“",],}').saetze).toEqual(['Mama,}','Mama sagt: „Hallo!“']);
});
it('оборванный ответ не принимается за правильный по одному вложенному объекту', () => {
  expect(()=>parseChat('{"woerter":["Mama"],"geschichte":{"titel":"Mama","saetze":["Mama malt."]}')).toThrow(PARSE_ERROR);
  expect(parseChat('Hinweis: {kein JSON}. Antwort: {"woerter":["Mama"]}').woerter).toEqual(['Mama']);
});
it('знаки и цифры не считаются содержательными предложениями', () => {
  const {sheet,removed} = sheetFromChat(parseChat('{"woerter":["Lisa"],"saetze":["!!!","12345"]}'),{...P,letters:['l','s','a','e','i']});
  expect(sheet.saetze).toContain('Lisa las alles.');
  expect(removed.map(r=>r.text)).toEqual(expect.arrayContaining(['!!!','12345']));
});
it('существительные из kleineWoerter переходят в слова без двойного блока', () => {
  const {sheet} = sheetFromChat(parseChat('{"kleineWoerter":["Mama","Ball"]}'),{...P,letters:UNIT_IDS});
  expect(sheet.kleine).not.toContain('Mama');
  expect(sheet.kleine).not.toContain('Ball');
  expect(sheet.woerter.filter(w=>w==='Mama')).toHaveLength(1);
});
it('offers every achievable text level regardless of local examples or block settings', () => {
  const letters = ['l', 'a', 'i', 'o', 't', 'k'];
  const prompt = buildPrompt(letters, 'l', 5);
  expect(prompt).toBe(buildPrompt(letters, 'l', 5, {...DEFAULT_BLOCKS, saetze:false, geschichte:false}));
  expect(prompt).toContain('Nutze jede Stufe');
  expect(prompt).not.toContain('Erlaubter Wortschatz');
  expect(prompt.length).toBeLessThan(2000);
});

it('keeps a complete readable story with words outside the local vocabulary', () => {
  const letters = ['m','a','l','t','s','o','i','k'];
  const geschichte = {titel:'Kakao', saetze:['Mama malt Kakao.', 'Lisa malt Salat.']};
  const answer = parseChat(JSON.stringify({woerter:['Kakao'], geschichte}));
  const {sheet} = sheetFromChat(answer, {...P, letters});
  expect(sheet.woerter).toContain('Kakao');
  expect(sheet.geschichte).toEqual(geschichte);
});
