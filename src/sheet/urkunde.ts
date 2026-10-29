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
  // etwas kleiner und mit Luft dazwischen – auf schmalen Handys kleben sie sonst aneinander
  const r = 13;
  const gap = 7;
  const w = PERLEN_JE_RAUPE * (2 * r + gap) + 66;
  let s = '';
  for (let i = 0; i < PERLEN_JE_RAUPE; i++) {
    const cx = r + 3 + i * (2 * r + gap);
    const cy = i % 2 ? 52 : 58;
    s += i < voll
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${i % 2 ? '#9FD18F' : '#BFE0B5'}" stroke="#2F6B3A" stroke-width="2.5"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#9AA8A0" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  const hx = w - 32;
  s += `<path d="M${hx - 9} 26 L${hx - 15} 10 M${hx + 9} 26 L${hx + 15} 10" stroke="#2F6B3A" stroke-width="2.5" stroke-linecap="round"/><circle cx="${hx - 15}" cy="9" r="4" fill="#F2A65A"/><circle cx="${hx + 15}" cy="9" r="4" fill="#F2A65A"/>`;
  s += `<circle cx="${hx}" cy="48" r="24" fill="#7FC06D" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="${hx - 8}" cy="44" r="3.4" fill="#1F2421"/><circle cx="${hx + 8}" cy="44" r="3.4" fill="#1F2421"/><path d="M${hx - 10} 55 Q${hx} 63 ${hx + 10} 55" fill="none" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<svg class="${cls}" viewBox="0 0 ${w} 80" role="img" aria-label="${voll} von ${PERLEN_JE_RAUPE} Perlen">${s}</svg>`;
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
