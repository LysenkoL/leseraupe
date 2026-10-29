import { getSerie, getSettings, setSerie, setSerieItem, themeForToday, type Draft } from './state';
import { generateSheet, historyFrom, MAX_STUFE, stufeFor, withSerie, type GenParams } from '../core/generator';
import { allSheets, nextNumber, saveOnPrint } from '../core/db';
import { randomSeed } from '../core/random';

/** Parameter für den Generator aus Einstellungen + Verlauf. */
export async function genParams(seed = randomSeed()): Promise<GenParams> {
  const s = getSettings();
  const sheets = await allSheets();
  const next = await nextNumber();
  return {
    letters: s.letters,
    newLetter: s.newLetter,
    // ein Blattumfang für alle (A6); die Lesezeit stellt der Timer ein
    minutes: 5,
    theme: themeForToday(),
    childName: s.childName,
    blocks: s.blocks,
    history: historyFrom(sheets.map((r) => ({ seq: r.number, data: r.data })), next),
    seed,
    stufe: stufeFor(sheets.map((r) => r.data), s.letters),
    stolper: s.stolper,
  };
}

const toDraft = (p: GenParams): Draft => {
  const g = generateSheet(p);
  return { data: g.sheet, seed: p.seed, removed: g.removed, savedId: null, scale: 1 };
};

/**
 * Neue Blätter aus dem Wörterbuch (A6: so viele wie in den Einstellungen).
 * Jedes weitere Blatt eine Stufe schwerer (B1), keine Wiederholungen innerhalb der Serie.
 */
export async function createDraft(anzahl = getSettings().blaetter): Promise<void> {
  const base = await genParams();
  const items: Draft[] = [];
  for (let i = 0; i < anzahl; i++) {
    const p: GenParams = {
      ...base,
      seed: i ? randomSeed() : base.seed,
      stufe: Math.min(MAX_STUFE, (base.stufe ?? 1) + i),
      history: withSerie({ ...base.history, seq: base.history.seq + i }, items.map((d) => d.data)),
    };
    items.push(toDraft(p));
  }
  setSerie(items);
}

/** „Neu mischen“: nur das gezeigte Blatt neu, Stufe und Thema bleiben. */
export async function remixCurrent(): Promise<void> {
  const serie = getSerie();
  if (!serie) return createDraft();
  const cur = serie.items[serie.idx];
  const base = await genParams();
  const andere = serie.items.filter((_, i) => i !== serie.idx).map((d) => d.data);
  // ein schon gespeichertes Blatt bleibt, wie es gedruckt wurde: das neue ist ein neues Blatt
  const d = toDraft({
    ...base,
    theme: cur.data.theme,
    stufe: cur.savedId ? base.stufe : (cur.data.stufe ?? base.stufe),
    history: withSerie({ ...base.history, seq: base.history.seq + serie.idx }, andere),
  });
  setSerieItem(serie.idx, d);
}

/**
 * Blätter der Serie bis einschließlich `bis` speichern, damit die Nummern
 * der Reihenfolge entsprechen (Blatt 1 vor Blatt 2 …). Liefert das Blatt `bis`.
 */
export async function saveSerieBis(bis: number, printed: boolean | 'none' = 'none'): Promise<Draft> {
  const serie = getSerie()!;
  for (let i = 0; i <= bis; i++) {
    const d = serie.items[i];
    if (d.savedId && i < bis) continue;
    const rec = await saveOnPrint(d.data, d.scale, d.savedId, i === bis ? printed : 'none');
    setSerieItem(i, { ...d, data: rec.data, savedId: rec.id ?? null });
  }
  return getSerie()!.items[bis];
}
