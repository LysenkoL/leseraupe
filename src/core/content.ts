import { wordsOf } from './letters';

export type ContentIssue = 'unsuitable' | 'pronunciation';

// Produktregel für diese Erstleseblätter, keine allgemeine Bewertung von Kinderbüchern.
// Ganze Wörter / ausdrückliche Wortfamilien, niemals naive Teilstrings wie „ass“ in „Wasser“.
const UNSUITABLE = new Set(`aas ass asse mist scheisse scheiss scheisser arsch arschloch arschlöcher
idiot idioten idiotin depp deppen trottel dummkopf dummköpfe blödmann blödmänner
schlampe schlampen hure huren nutte nutten hurensohn wichser bastard bastarde
fuck shit bitch asshole piss pisse kacke kacka kotze kotzen kotzt
sex sexy porno pornografie pornographie nackt nackte nackten penis vagina ficken
alkohol bier biere wein weine weins schnaps vodka wodka zigarette zigaretten tabak
droge drogen kokain heroin cannabis marihuana haschisch
mord mörder mörderin leiche leichen tot tote toten tod todes töten tötet getötet
sterben stirbt starb gestorben suizid selbstmord krieg kriege kriegen waffe waffen
pistole pistolen gewehr gewehre peitsche peitschen folter blut blutig hass hassen hasst
nazi nazis rassist rassisten rassistisch`.split(/\s+/));
const UNSUITABLE_FAMILIES = /^(?:scheiss|arsch|fick|wichs|porn|hurensohn|idiot|trottel|dummkopf|blödmann|zigarett|alkohol|kokain|heroin|töt|mord|folter|rassist|nazi)|^(?:dumm|blöd|doof)(?:e|er|es|en|em)?$|^mist(?:haufen|gabel|kerl|stück|ig)|^(?:todes|selbstmord|suizid)/u;

// Ausnahmen, deren Aussprache nicht aus den ausgewählten Buchstabeneinheiten folgt.
// Die Liste wird zusammen mit dem geprüften positiven KI-Wortschatz eingesetzt.
const PRONUNCIATION = new Set(`toast budget chance baby babys babies teddy teddys teddies
ski skis skifahren manege manegen giraffe giraffen vulkan vulkane vase vasen
computer computers laptop laptops tablet tablets smartphone smartphones handy handys
couch couches cool team teams jeans shirt shirts tshirt sandwich sandwiches
pizza pizzen spaghetti spagetti pommes croissant croissants baguette baguettes
orange orangen garage garagen café cafés cafe cafes restaurant restaurants
chef chefs chips clown clowns chor chöre chaos china chinesisch champignon champignons
chamäleon champagner charme charakter charaktere christkind christbaum
cent cents city cities camping cowboy cowboys walkie talkie joystick game games
ballon ballons balkon balkone boje bojen`.split(/\s+/));
const PRONUNCIATION_FAMILIES = /^(?:toast|budget|chanc|sandwich|croissant|baguette|smartphone|computer|tshirt|jeans|champignon|champagner)/u;

/** Elternfragen brauchen keine Buchstabengrenze, aber dieselbe Inhaltsgrenze. */
export function contentIssue(text: string, readerText = true): ContentIssue | null {
  const normalized = text.normalize('NFKC').replace(/\p{Cf}/gu,'').toLowerCase().replace(/ß/g,'ss');
  const words = wordsOf(normalized);
  const unsuitable = (word: string) => UNSUITABLE.has(word) || UNSUITABLE_FAMILIES.test(word);
  if (words.some(unsuitable)) return 'unsuitable';
  // Einfache Schreibvarianten mit Ziffern dürfen den Inhaltsfilter nicht umgehen.
  if (/\p{N}/u.test(normalized)) {
    const substitutions: Record<string,string> = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'};
    if (wordsOf(normalized.replace(/[013457]/g,c=>substitutions[c])).some(unsuitable)) return 'unsuitable';
  }
  if (readerText && words.some(word=>PRONUNCIATION.has(word) || PRONUNCIATION_FAMILIES.test(word))) return 'pronunciation';
  return null;
}

export const isSuitable = (text: string, readerText = true): boolean => contentIssue(text,readerText) === null;
