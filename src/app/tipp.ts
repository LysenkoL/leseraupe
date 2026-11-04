import { analyzeMaterial, moeglich, type HinweisBlock } from '../core/material';
import { UNIT_IDS, unitById } from '../core/letters';
import { t } from './i18n';

/** Reihenfolge, in der die Blöcke im Hinweis genannt werden */
const REIHE: HinweisBlock[] = ['silben', 'woerter', 'saetze', 'geschichte'];

export interface TippZeile {
  /** Dieser Buchstabe öffnet die Blöcke; null = ein einzelner Buchstabe reicht dafür nicht */
  unit: string | null;
  bloecke: HinweisBlock[];
}

/**
 * Welche gewählten Blöcke fehlen, und welcher eine Buchstabe öffnet die meisten davon?
 * Einzelne Buchstaben gehen vor Verbindungen; bei Gleichstand der, der am meisten Lesestoff bringt. Arbeitet in kleinen Schritten, damit das Antippen
 * einer Buchstabe flüssig bleibt; `abgebrochen` meldet, dass schon wieder etwas anderes getippt wurde.
 */
export async function tippBerechnen(
  letters: string[],
  gewaehlt: Record<string, boolean>,
  abgebrochen: () => boolean = () => false,
): Promise<TippZeile[] | null> {
  let fehlt = REIHE.filter((b) => gewaehlt[b] && !moeglich(letters, b));
  if (!fehlt.length) return [];
  const kandidaten = UNIT_IDS.filter((id) => !letters.includes(id)).sort((a, b) => a.length - b.length);
  const oeffnet = new Map<string, HinweisBlock[]>();
  for (let i = 0; i < kandidaten.length; i++) {
    if (i % 4 === 0) {
      await new Promise((r) => setTimeout(r));
      if (abgebrochen()) return null;
    }
    const id = kandidaten[i];
    const mit = [...letters, id];
    oeffnet.set(id, fehlt.filter((b) => moeglich(mit, b)));
  }
  const zeilen: TippZeile[] = [];
  while (fehlt.length && zeilen.length < 2) {
    let bester: string | null = null;
    let anzahl = 0;
    let stoff = -1;
    for (const id of kandidaten) {
      const n = (oeffnet.get(id) ?? []).filter((b) => fehlt.includes(b)).length;
      if (!n || n < anzahl) continue;
      // Verbindungen nur, wenn kein einzelner Buchstabe dasselbe schafft
      if (n === anzahl && bester && id.length > bester.length) continue;
      const m = analyzeMaterial([...letters, id]);
      const menge = m.sentences.length + m.stories.length * 3;
      if (n > anzahl || id.length < (bester?.length ?? 9) || menge > stoff) { bester = id; anzahl = n; stoff = menge; }
    }
    if (!bester) break;
    const bloecke = oeffnet.get(bester)!.filter((b) => fehlt.includes(b));
    zeilen.push({ unit: bester, bloecke });
    fehlt = fehlt.filter((b) => !bloecke.includes(b));
  }
  if (fehlt.length) zeilen.push({ unit: null, bloecke: fehlt });
  return zeilen;
}

const aufzaehlung = (bloecke: HinweisBlock[]): string => {
  const namen = bloecke.map((b) => t(`start.was.${b}`));
  return namen.length > 1 ? `${namen.slice(0, -1).join(', ')} ${t('start.und')} ${namen[namen.length - 1]}` : namen[0];
};

/** Der Hinweis als HTML; die Texte kommen aus den Sprachdateien, die Namen der Einheiten aus der Tabelle. */
export function tippHtml(zeilen: TippZeile[]): string {
  return zeilen
    .map((z) => {
      if (!z.unit) return `<p>${t('start.tippMehr', { was: aufzaehlung(z.bloecke) })}</p>`;
      const unit = unitById(z.unit)?.label.replace('-', '') ?? z.unit;
      return `<p>${t('start.tippEins', { unit, was: aufzaehlung(z.bloecke) })}</p>`;
    })
    .join('');
}

/** Für die Startseite: Hinweis berechnen und einsetzen, sobald er fertig ist. */
export function buchstabenTipp(host: HTMLElement, letters: string[], gewaehlt: Record<string, boolean>, abgebrochen: () => boolean): void {
  void tippBerechnen(letters, gewaehlt, abgebrochen).then((zeilen) => {
    if (!zeilen || abgebrochen()) return;
    host.innerHTML = tippHtml(zeilen);
    host.hidden = !zeilen.length;
  });
}
