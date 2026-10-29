import type { ThemeId } from '../sheet/themes';

export type Minutes = 5 | 10;

export type BlockId = 'silben' | 'woerter' | 'kleine' | 'aehnlich' | 'saetze' | 'geschichte' | 'quest' | 'fragen';

export type QuestKind = 'finde' | 'zaehle' | 'male' | 'geheimwort';

export interface Quest {
  kind: QuestKind;
  /** Aufgabentext (geprüft) */
  text: string;
  /** Finde: gesuchter Buchstabe; Zähle: gesuchtes Wort; Geheimwort: Lösungswort */
  target?: string;
  /** Geheimwort: Wörter, deren erste Buchstaben das Lösungswort ergeben */
  words?: string[];
}

export interface Aehnlich {
  pair: [string, string];
  /** pro Buchstabe einige Wörter, die ihn enthalten */
  words: [string[], string[]];
}

export interface Geschichte {
  titel: string;
  saetze: string[];
}

export interface SheetData {
  /** Blatt-Nr., erst beim ersten Drucken/Speichern vergeben */
  number: number | null;
  minutes: Minutes;
  theme: ThemeId;
  /** gelernte Einheiten (IDs, z. B. "t", "sch", "ie") in Fibel-Reihenfolge */
  letters: string[];
  newLetter: string | null;
  childName: string;
  blocks: Record<BlockId, boolean>;
  silben: string[];
  woerter: string[];
  kleine: string[];
  aehnlich: Aehnlich | null;
  saetze: string[];
  geschichte: Geschichte | null;
  quest: Quest | null;
  fragen: string[];
  /** Schwierigkeit 1–5 (B1); alte Blätter haben keine */
  stufe?: number;
  /** Silben abwechselnd farbig (B3) */
  silbenFarbig?: boolean;
  /** Herkunft: Wörterbuch oder Chat */
  source: 'dict' | 'chat';
}

export const DEFAULT_BLOCKS: Record<BlockId, boolean> = {
  silben: true,
  woerter: true,
  kleine: true,
  aehnlich: false,
  saetze: true,
  geschichte: true,
  quest: true,
  fragen: true,
};
