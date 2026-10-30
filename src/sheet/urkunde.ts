import { RaupenMaler, REGENBOGEN } from './raupenbild';
import { esc } from '../core/html';

/** So viele Perlen hat eine volle Raupe (B4) */
export const PERLEN_JE_RAUPE = 10;

export interface Raupenstand {
  /** Perlen der aktuellen Raupe (0–9) */
  perlen: number;
  /** fertige Raupen: Nummer, Tag der 10. Perle, Lesetage insgesamt */
  fertig: { nr: number; datum: string; gesamt: number }[];
}

/** Tag (lokales Datum) einer Lesung */
function tagVon(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Perlen aus dem Verlauf (nicht aus einem eigenen Zähler): jeder Tag, an dem gelesen wurde,
 * ist eine Perle – wie im Lesepass. Auch nochmal dasselbe Blatt zählt; mehrere Lesungen
 * an einem Tag geben trotzdem nur eine Perle (Gewohnheit statt Menge).
 */
export function raupenstand(sheets: { reads: { at: string }[] }[]): Raupenstand {
  const ersteJeTag = new Map<string, string>();
  for (const s of sheets)
    for (const r of s.reads) {
      const tag = tagVon(r.at);
      const bisher = ersteJeTag.get(tag);
      if (!bisher || r.at < bisher) ersteJeTag.set(tag, r.at);
    }
  const tage = [...ersteJeTag.values()].sort();
  const fertig: Raupenstand['fertig'] = [];
  for (let nr = 1; nr * PERLEN_JE_RAUPE <= tage.length; nr++) {
    fertig.push({ nr, datum: tage[nr * PERLEN_JE_RAUPE - 1], gesamt: nr * PERLEN_JE_RAUPE });
  }
  return { perlen: tage.length % PERLEN_JE_RAUPE, fertig };
}

/** Raupe mit Perlen: volle Perlen grün, leere gestrichelt */
export function perlenRaupeSvg(voll: number, cls = ''): string {
  // Raupe wie auf dem App-Icon: gelesene Tage als Regenbogen-Perlen, offene gestrichelt
  const m = new RaupenMaler();
  const r = 13;
  const gap = 7;
  const w = PERLEN_JE_RAUPE * (2 * r + gap) + 66;
  let s = '';
  for (let i = 0; i < PERLEN_JE_RAUPE; i++) {
    const cx = r + 3 + i * (2 * r + gap);
    const cy = i % 2 ? 54 : 60;
    s += i < voll ? m.perle(cx, cy, r, REGENBOGEN[i], undefined, 'voll') : m.leer(cx, cy, r);
  }
  s += m.kopf(w - 36, 50, 24);
  return m.svg(`0 0 ${w} 80`, s, `class="${cls}" role="img" aria-label="${voll} von ${PERLEN_JE_RAUPE} Perlen"`);
}

/**
 * Urkunde nach einer vollen Raupe: A4 wie ein Leseblatt (Klasse .sheet → Druck und PDF wie gewohnt).
 * Der Name des Kindes darf fehlen – dann eine Linie zum Selberschreiben.
 */
export function renderUrkunde(u: { name: string; nr: number; datum: string; gesamt: number }): string {
  const d = new Date(u.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `<div class="sheet urkunde">
  <div class="uk-rand">
    <div class="uk-titel">Urkunde</div>
    <div class="uk-raupe">${perlenRaupeSvg(PERLEN_JE_RAUPE)}</div>
    <div class="uk-text">Die Leseraupe ist voll!</div>
    <div class="uk-name">${u.name ? esc(u.name) : '<span class="uk-linie"></span>'}</div>
    <div class="uk-text">hat schon an <b>${u.gesamt}</b> Tagen gelesen.</div>
    <div class="uk-toll">Super gemacht!</div>
    <div class="uk-fuss"><span>Raupe Nr. ${u.nr}</span><span>${d}</span></div>
  </div>
</div>`;
}
