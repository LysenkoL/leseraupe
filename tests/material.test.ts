import { describe, expect, it } from 'vitest';
import { analyzeMaterial, MIN_WOERTER } from '../src/core/material';
import { emptyHistory, generateSheet } from '../src/core/generator';
import { DEFAULT_BLOCKS } from '../src/core/types';
import { checkText, UNIT_IDS } from '../src/core/letters';

it('состав, а не число букв: две согласные пусты, M A L дают слоги, L S A I дают предложения', () => {
  expect(analyzeMaterial(['m','t']).available.saetze).toBe(false);
  expect(analyzeMaterial(['m','t']).available.silben).toBe(false);
  expect(analyzeMaterial(['m','a','l']).available.silben).toBe(true);
  expect(analyzeMaterial(['m','a','l']).available.saetze).toBe(false);
  expect(analyzeMaterial(['l','s','a','i']).sentences).toContain('Lisa las.');
  expect(analyzeMaterial(['l','s','a','e','i']).sentences).toContain('Lisa las alles.');
});
it('все положительные примеры проходят тот же фильтр, что ответ ИИ', () => {
  for (const letters of [[],['a'],['m','a'],['l','s','a','e','i'],['m','a','t','o','l','i','s'],UNIT_IDS]) {
    const material = analyzeMaterial(letters);
    const known = new Set(letters);
    for (const text of [...material.vocabulary,...material.silben,...material.sentences,...material.stories.flatMap(g=>[g.titel,...g.saetze])]) expect(checkText(text,known).ok,text).toBe(true);
    expect(material.available.saetze).toBe(material.sentences.length>0);
    expect(material.available.geschichte).toBe(material.stories.length>0);
  }
});
it('E и I не разрешают Eis, а отдельная единица Ei разрешает', () => {
  expect(analyzeMaterial(['e','i','s']).wordSet.has('eis')).toBe(false);
  expect(analyzeMaterial(['e','i','s','ei']).wordSet.has('eis')).toBe(true);
});
it('порядок выбора букв не меняет доступный материал', () => {
  expect(analyzeMaterial(['l','s','a','e','i'])).toEqual(analyzeMaterial(['e','s','i','a','l']));
});

it('сочетания в слогах доступны независимо от того, что выбрано последним', () => {
  expect(analyzeMaterial(['sch','a']).silben).toContain('scha');
  expect(analyzeMaterial(['m','ei']).silben).toContain('mei');
});
it('предложения возможны и без имени или слова Mama', () => {
  expect(analyzeMaterial(['d','a','s','i','t']).sentences).toContain('Das ist da.');
});

it.each([
  ['Kati isst Torte', ['s','a','e','i','o','r','t','k']],
  ['Ida isst Eis', ['a','d','ei','i','k','l','s','t']],
  ['Lina liest', ['a','e','i','ie','l','m','n','s','t']],
] as const)('findet die lokale Geschichte %s mit ihren Leseeinheiten', (titel, letters) => {
  expect(analyzeMaterial([...letters]).stories.map(story => story.titel)).toContain(titel);
  const withoutCombination = letters.filter(unit => unit.length === 1);
  if (withoutCombination.length < letters.length) {
    expect(analyzeMaterial(withoutCombination).stories.map(story => story.titel)).not.toContain(titel);
  }
});

describe('mindestens 4 verschiedene Wörter', () => {
  const blatt = (letters: string[]) => generateSheet({ letters, newLetter: null, minutes: 5, theme: 'wiese', childName: '', blocks: { ...DEFAULT_BLOCKS }, history: emptyHistory(), seed: 1 }).sheet;
  const verschieden = (woerter: string[]) => new Set(woerter.map((w) => w.toLowerCase())).size;
  const POOL = ['a', 'e', 'i', 'o', 'u', 'm', 'l', 't', 's', 'n'];
  const SETS = POOL.flatMap((a, i) => POOL.slice(i + 1).flatMap((b, j) => [[a, b], ...POOL.slice(i + j + 2).map((c) => [a, b, c])]));

  it('darunter ist kein Blatt möglich, auch nicht nur mit Silben', () => {
    for (const letters of [['m', 'a'], ['t', 'o'], ['l', 'a', 's']]) {
      const { available, template } = analyzeMaterial(letters);
      expect(Object.values(available).some(Boolean), letters.join('')).toBe(false);
      expect(template).toBeNull();
    }
  });

  it('ab 4 Wörtern ist es möglich, auch mit nur 3 Buchstaben', () => {
    for (const letters of [['m', 'a', 'o'], ['m', 'a', 'l'], ['t', 'o', 'm'], ['a', 'i', 's', 't']]) {
      expect(analyzeMaterial(letters).available.woerter, letters.join('')).toBe(true);
      expect(verschieden(blatt(letters).woerter), letters.join('')).toBeGreaterThanOrEqual(MIN_WOERTER);
    }
  });

  it('die Zusage stimmt mit dem Blatt überein', () => {
    for (const letters of SETS) {
      const { available } = analyzeMaterial(letters);
      const sheet = blatt(letters);
      const wort = letters.join('');
      expect(available.woerter, wort).toBe(verschieden(sheet.woerter) >= MIN_WOERTER);
      if (available.woerter) expect(available.saetze, wort).toBe(sheet.saetze.length > 0);
    }
  });
});
