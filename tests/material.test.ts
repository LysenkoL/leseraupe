import { expect, it } from 'vitest';
import { analyzeMaterial } from '../src/core/material';
import { checkText, UNIT_IDS } from '../src/core/letters';

it('состав, а не число букв: две согласные пусты, M A дают слоги, L S A I дают предложения', () => {
  expect(analyzeMaterial(['m','t']).available.saetze).toBe(false);
  expect(analyzeMaterial(['m','t']).available.silben).toBe(false);
  expect(analyzeMaterial(['m','a']).available.silben).toBe(true);
  expect(analyzeMaterial(['m','a']).available.saetze).toBe(false);
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
