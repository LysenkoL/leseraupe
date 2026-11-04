import { expect, it } from 'vitest';
import { analyzeMaterial } from '../src/core/material';
import { parseChat, sheetFromChat } from '../src/core/chat';
import { emptyHistory, generateSheet, readingTexts, rerollBlock } from '../src/core/generator';
import { UNIT_IDS } from '../src/core/letters';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { Vocab } from '../src/core/vocab';

const params = { letters: UNIT_IDS, newLetter:null, minutes:5 as const, theme:'wiese' as const, childName:'', blocks:DEFAULT_BLOCKS, history:emptyHistory(), seed:13 };

it('все изученные буквы не разрешают ругательства и исключения произношения', () => {
  const vocab = new Vocab(new Set(UNIT_IDS));
  for (const word of ['Mist','MIST','Misthaufen','Idiot','Scheiße','Arschloch','Toast','Toasts','Toastbrot','Budget','Budgets','Chance','Chancen','Baby','Teddy','Giraffe','Ski']) {
    expect(vocab.has(word),word).toBe(false);
  }
  for (const word of ['Mama','Wasser','Tasse','Klasse','Biene','Mistel','weint']) expect(vocab.has(word),word).toBe(true);
});

it('исключения не попадают в разрешённый словарь и положительные примеры запроса', () => {
  const material = analyzeMaterial(UNIT_IDS);
  for (const word of ['mist','toast','budget','chance','baby','teddy','giraffe']) {
    expect(material.wordSet.has(word),word).toBe(false);
  }
});

it('фильтр ответа проверяет также заголовок, целую историю и вопросы для родителей', () => {
  const answer = parseChat(JSON.stringify({woerter:['Mama','Baby','Teddy','Toast','Mist'],saetze:['Mama malt.'],geschichte:{titel:'Das Bild',saetze:['Mama malt.','Mama malt das Bild.','Das Bild ist bunt.']},fragen:['Was malt Mama?','Ist Mama ein Idiot?']}));
  const {sheet,removed} = sheetFromChat(answer,params);
  expect(sheet.woerter).toContain('Mama');
  for (const word of ['Baby','Teddy','Toast','Mist']) expect(sheet.woerter).not.toContain(word);
  expect(sheet.fragen).toEqual(['Was malt Mama?']);
  expect(removed.find(r=>r.text==='Mist')?.reason).toBe('unsuitable');
  expect(removed.find(r=>r.text==='Toast')?.reason).toBe('pronunciation');
  const badStory = sheetFromChat({...answer,geschichte:{titel:'Mist',saetze:['Mama malt.','Mama ist ein Idiot.','Das Bild ist bunt.']}},params);
  expect(badStory.sheet.geschichte?.saetze).not.toContain('Mama ist ein Idiot.');
});

it('из локального генератора и переброса блока исключены сложные заимствования', () => {
  const forbidden = /\b(?:ski|giraffen?|manege|vulkan|baby|teddy)\b/i;
  for (let seed=1; seed<=12; seed++) {
    const p = {...params,seed};
    const original = generateSheet(p).sheet;
    for (const sheet of [original,rerollBlock(original,'woerter',p),rerollBlock(original,'geschichte',p)]) {
      for (const text of [...readingTexts(sheet),...sheet.fragen]) expect(text, text).not.toMatch(forbidden);
    }
  }
});
