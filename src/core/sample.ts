import { DEFAULT_BLOCKS, type SheetData } from './types';

/** Probeblatt (wie docs/design/Main.html) – für den Drucktest und Tests. */
export const SAMPLE_SHEET: SheetData = {
  number: null,
  minutes: 5,
  theme: 'wiese',
  letters: ['m', 'l', 's', 'a', 'i', 'o', 't'],
  newLetter: 's',
  childName: '',
  blocks: { ...DEFAULT_BLOCKS },
  silben: ['ma', 'mi', 'mo', 'la', 'li', 'lo', 'ta', 'ti', 'to', 'sa', 'si', 'so', 'am', 'im', 'al', 'il', 'as', 'it'],
  woerter: ['Mama', 'Oma', 'Tom', 'Tim', 'Mia', 'Lisa', 'Lola', 'Sam', 'Lama', 'Mais', 'Salat', 'Saal', 'Ast', 'Mast', 'Tal', 'Moos', 'Lasso', 'Salto', 'Lilo', 'Atom'],
  kleine: ['am', 'im', 'ist', 'so', 'mal', 'toll', 'alt', 'isst'],
  aehnlich: null,
  saetze: ['Mama malt.', 'Oma isst Mais.', 'Tim isst Salat.', 'Tom ist toll.', 'Lisa isst Salat.', 'Mia malt Lola.', 'Ist Tom im Tal?'],
  geschichte: { titel: 'Im Tal', saetze: ['Tim ist im Tal.', 'Mia ist im Tal.', 'Tim isst Salat.', 'Mia isst Mais.', 'Oma malt Tim.', 'Oma malt Mia.', 'Toll, Oma!'] },
  quest: { kind: 'finde', text: 'Kreise alle Wörter mit S ein.', target: 's' },
  fragen: ['Wo ist Tim?', 'Was isst Tim? Was isst Mia?', 'Wen malt Oma?'],
  source: 'dict',
};
