import { DICT, type FertigeGeschichte } from './dict';
import { checkText, sortUnits, wordsOf } from './letters';
import { FIRST_WORDS, FIRST_NAMES } from './lesewortschatz';
import { isSuitable } from './content';
import { makeSilben } from './silbenuebung';
import { mulberry32 } from './random';
import { pools, templateStory, type StoryResult } from './saetze';
import { Vocab } from './vocab';
import type { BlockId } from './types';

export interface Material {
  words: string[];
  kleine: string[];
  vocabulary: string[];
  wordSet: ReadonlySet<string>;
  silben: string[];
  sentences: string[];
  stories: FertigeGeschichte[];
  template: StoryResult | null;
  available: Record<BlockId, boolean>;
}
/** Inhaltliche Obergrenze; die Druckaufbereitung erhält Geschichten immer als Ganzes. */
export const MAX_STORY_SENTENCES = 14;
const cache = new Map<string, Material>();
const SMALL = new Set('am im in an auf aus mit und oder ein eine der die das den dem einen einem einer ich du wir ihr es er sie so ja nein da hier dort als alles'.split(' '));
const FAMILY = new Set(['mama','papa','oma','opa']);
const FINITE = new Set('las ist sind hat haben mag malt liest spielt läuft rennt rollt sucht findet lacht isst trinkt ruft hilft hält holt teilt gibt nimmt sitzt steht liegt'.split(' '));
const unique = (list: string[]) => [...new Map(list.map(word => [word.toLowerCase(),word])).values()];

/** Positive evidence from actual readable material, independent of randomness, new letter, history and difficulty. */
export function analyzeMaterial(letters: string[]): Material {
  const ids = sortUnits(letters);
  const key = ids.join(',');
  const cached = cache.get(key);
  if (cached) return cached;
  const known = new Set(ids);
  const fits = (text: string) => checkText(text,known).ok && isSuitable(text);
  const vocab = new Vocab(known);
  const names = new Set(vocab.names.map(w=>w.toLowerCase()).filter(w=>!FAMILY.has(w)));
  const namesIn = (text: string) => unique(wordsOf(text).filter(w=>names.has(w.toLowerCase())));
  const stories = DICT.geschichten.filter(story => story.saetze.length >= 3 && story.saetze.length <= MAX_STORY_SENTENCES && fits(story.titel) && story.saetze.every(fits) && story.fragen.every(question=>isSuitable(question,false)) && namesIn(story.saetze.join(' ')).length <= 2)
    .sort((a,b)=>Number(!!b.handlung)-Number(!!a.handlung) || Math.abs(a.saetze.length-7)-Math.abs(b.saetze.length-7));
  const firstStory = stories[0];
  let template: StoryResult | null = null;
  if (!firstStory) {
    const candidates = pools(vocab);
    const rng = mulberry32(1);
    for (let attempt = 0; attempt < 10 && !template; attempt++) {
      const story = templateStory(vocab, candidates, rng, 7);
      if (story && fits(story.titel) && story.saetze.every(fits) && story.fragen.every(question => isSuitable(question, false))) {
        template = story;
      }
    }
  }
  const persons = unique([...(firstStory ? namesIn(firstStory.saetze.join(' ')) : []), ...FIRST_NAMES.filter(fits)]).slice(0,2);
  // Geprüfte Flexionsformen aus allen lesbaren Geschichten; kein ungefilterter Rohwörterbuch-Import.
  const dictionaryWords = new Map(vocab.words.filter(entry=>entry.typ!=='Name').map(entry=>[entry.w.toLowerCase(),entry.w]));
  const storyWords = [
    ...(firstStory ? wordsOf([firstStory.titel,...firstStory.saetze].join(' ')) : []),
    ...stories.flatMap(story=>wordsOf([story.titel,...story.saetze].join(' '))).flatMap(word=>dictionaryWords.has(word.toLowerCase()) ? [dictionaryWords.get(word.toLowerCase())!] : []),
  ];
  const vocabulary = unique([...FIRST_WORDS.filter(fits), ...persons, ...storyWords]);
  const wordSet = new Set(vocabulary.map(w=>w.toLowerCase()));
  const accepts = (text: string) => fits(text) && wordsOf(text).every(w=>wordSet.has(w.toLowerCase()));
  const subjects = unique([...persons,...['Mama','Papa','Oma','Opa'].filter(fits)]);
  const candidates: string[] = [];
  for (const who of subjects) {
    // Both present and familiar past forms are legitimate; no artificial tense/letter-count gate.
    for (const tail of ['las alles.','las.','ist da.','ist hier.','malt.','lacht.','spielt.','rennt.','sitzt.']) {
      const sentence = `${who} ${tail}`;
      if (accepts(sentence)) candidates.push(sentence);
    }
    for (const object of ['das Rad','den Ball','das Buch','die Puppe','die Katze','die Blume','das Bild']) {
      for (const verb of ['hat','holt','sucht','malt']) {
        const sentence = `${who} ${verb} ${object}.`;
        if (accepts(sentence)) candidates.push(sentence);
      }
    }
  }
  for (const sentence of ['Das ist da.', 'Das ist rot.', 'Das ist lila.', 'Das ist ein Esel.', 'Das ist ein Lama.', 'Es ist nass.', 'Es ist warm.', 'Es ist kalt.']) {
    if (accepts(sentence)) candidates.push(sentence);
  }
  const sentences = [...new Set([...candidates,...DICT.saetze.filter(s=>wordsOf(s).length>=2 && wordsOf(s).some(w=>FINITE.has(w.toLowerCase())) && accepts(s))])];
  const words = vocabulary.filter(w=>!SMALL.has(w.toLowerCase()));
  const kleine = vocabulary.filter(w=>SMALL.has(w.toLowerCase()));
  const silben = makeSilben(ids,null,1000,mulberry32(1));
  const readable = !!(silben.length || words.length || kleine.length || sentences.length || stories.length);
  const material: Material = {words,kleine,vocabulary,wordSet,silben,sentences,stories,template,available:{silben:!!silben.length,woerter:!!words.length,kleine:!!kleine.length,saetze:!!sentences.length,geschichte:!!stories.length,fragen:!!firstStory?.fragen.length,quest:readable,aehnlich:false}};
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key,material);
  return material;
}
