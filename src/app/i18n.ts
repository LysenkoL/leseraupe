import de from '../i18n/de.json';
import uk from '../i18n/uk.json';
import { loadProfile, saveProfile, type Sprache } from '../core/store';

/**
 * Sprache der Oberfläche (B6). Nur die App – Leseblätter, PDF und Urkunde bleiben immer deutsch.
 * Texte stehen in src/i18n/de.json und uk.json; de.json ist vollständig und die Rückfallebene.
 */
export type Key = keyof typeof de;
const TEXTE: Record<Sprache, Partial<Record<Key, string>>> = { de, uk };

/** Sprache des Telefons: Ukrainisch → uk, sonst Deutsch */
export function systemSprache(langs: readonly string[] = globalThis.navigator?.languages ?? []): Sprache {
  return langs.some((l) => l.toLowerCase().startsWith('uk')) ? 'uk' : 'de';
}

let aktuell: Sprache = (() => {
  try {
    return loadProfile().sprache ?? systemSprache();
  } catch {
    return 'de';
  }
})();

export function sprache(): Sprache {
  return aktuell;
}

/** null = wie das Telefon */
export function setSprache(s: Sprache | null): void {
  saveProfile({ ...loadProfile(), sprache: s });
  aktuell = s ?? systemSprache();
  if (typeof document !== 'undefined') document.documentElement.lang = aktuell;
}

/** Text zum Schlüssel; {name} wird ersetzt */
export function t(key: Key, params: Record<string, string | number> = {}): string {
  const s = TEXTE[aktuell][key] ?? de[key];
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Für Tests: Sprache direkt setzen, ohne zu speichern */
export function _setSpracheFuerTest(s: Sprache): void {
  aktuell = s;
}

/** Name eines Themas in der Oberfläche (auf dem Blatt bleibt der deutsche Name) */
export function themaName(id: string): string {
  return t(`thema.${id}` as Key);
}
