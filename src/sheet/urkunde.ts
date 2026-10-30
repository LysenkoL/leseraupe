import { RaupenMaler, REGENBOGEN } from './raupenbild';
import { esc } from '../core/html';
import { t } from '../app/i18n';

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
  // Raupe wie auf dem App-Icon: gelesene Tage als Regenbogen-Perlen (vom Kopf aus), offene gestrichelt
  // Perlen dicht an dicht in einem sanften Bogen, die letzte stößt an den Kopf
  const m = new RaupenMaler();
  const r = 16;
  const schritt = 2 * r + 5;
  const kopfR = 26;
  const kopfX = r + 3 + (PERLEN_JE_RAUPE - 1) * schritt + r + 18;
  const w = kopfX + 37;
  let s = '';
  for (let i = 0; i < PERLEN_JE_RAUPE; i++) {
    const cx = r + 3 + i * schritt;
    const cy = 60 - 5 * Math.sin((Math.PI * i) / (PERLEN_JE_RAUPE - 1));
    // die Raupe wächst vom Kopf aus: die Perle direkt hinter dem Kopf kommt zuerst
    s += i >= PERLEN_JE_RAUPE - voll ? m.perle(cx, cy, r, REGENBOGEN[i], undefined, 'voll') : m.leer(cx, cy, r);
  }
  s += m.kopf(kopfX, 50, kopfR);
  return m.svg(`0 0 ${w} 80`, s, `class="${cls}" role="img" aria-label="${voll} von ${PERLEN_JE_RAUPE} Perlen"`);
}

/** kleiner Zufall mit festem Samen: Konfetti liegt immer gleich */
function zufall(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (v: number) => +v.toFixed(1);
const stern = (x: number, y: number, r: number, farbe: string) =>
  `<path d="M${n1(x)} ${n1(y - r)} Q${n1(x + r * 0.2)} ${n1(y - r * 0.2)} ${n1(x + r)} ${n1(y)} Q${n1(x + r * 0.2)} ${n1(y + r * 0.2)} ${n1(x)} ${n1(y + r)} Q${n1(x - r * 0.2)} ${n1(y + r * 0.2)} ${n1(x - r)} ${n1(y)} Q${n1(x - r * 0.2)} ${n1(y - r * 0.2)} ${n1(x)} ${n1(y - r)} Z" fill="${farbe}"/>`;

/** Hintergrund, Rahmen, Konfetti, Band, Raupe im Bogen und Medaille – alles in mm (Blatt 190 × 276) */
function urkundeBild(nr: number): string {
  const m = new RaupenMaler();
  const W = 190;
  const H = 276;
  let s = '';
  // Sonnenstrahlen hinter der Raupe
  const cx = 95;
  const cy = 98;
  let strahlen = '';
  for (let i = 0; i < 28; i++) {
    const a1 = (i / 28) * Math.PI * 2;
    const a2 = ((i + 0.5) / 28) * Math.PI * 2;
    strahlen += `<path d="M${cx} ${cy} L${n1(cx + 90 * Math.cos(a1))} ${n1(cy + 90 * Math.sin(a1))} L${n1(cx + 90 * Math.cos(a2))} ${n1(cy + 90 * Math.sin(a2))} Z" fill="#FFE98A"/>`;
  }
  s += `<defs>
<radialGradient id="ukLicht" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="ukMaske"><circle cx="${cx}" cy="${cy}" r="88" fill="url(#ukLicht)"/></mask>
<linearGradient id="ukRahmen" x1="0" y1="0" x2="1" y2="1">${REGENBOGEN.map((c, i) => `<stop offset="${(i / (REGENBOGEN.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>
<radialGradient id="ukGold" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="#FFF4B0"/><stop offset="0.5" stop-color="#FFC93C"/><stop offset="1" stop-color="#D9952A"/></radialGradient>
</defs>`;
  s += `<g mask="url(#ukMaske)" opacity="0.7">${strahlen}</g>`;
  // Regenbogen-Rahmen und goldene Innenlinie
  s += `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="11" fill="none" stroke="url(#ukRahmen)" stroke-width="3.2"/>`;
  s += `<rect x="7.5" y="7.5" width="${W - 15}" height="${H - 15}" rx="8" fill="none" stroke="#FFC93C" stroke-width="0.7" stroke-dasharray="2.2 1.6"/>`;
  // Konfetti am Rand (nicht über Text und Raupe)
  const r = zufall(nr * 97 + 13);
  // nur am Rand, und unten frei für Nummer, Datum und Unterschrift
  const frei = (x: number, y: number) => (x < 24 || x > W - 24 || y < 15) && y < 246;
  let k = 0;
  for (let i = 0; i < 400 && k < 46; i++) {
    const x = 11 + r() * (W - 22);
    const y = 11 + r() * (H - 22);
    if (!frei(x, y)) continue;
    k++;
    const c = REGENBOGEN[Math.floor(r() * REGENBOGEN.length)];
    const art = r();
    const w = 1.6 + r() * 1.6;
    if (art < 0.35) s += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(w * 0.55)}" fill="${c}"/>`;
    else if (art < 0.75) s += `<rect x="${n1(x - w / 2)}" y="${n1(y - w / 4)}" width="${n1(w)}" height="${n1(w / 2)}" rx="0.4" fill="${c}" transform="rotate(${Math.round(r() * 180)} ${n1(x)} ${n1(y)})"/>`;
    else s += stern(x, y, w * 0.9, c);
  }
  // Band für den Titel
  s += `<path d="M22 36 L34 30 L34 46 L22 52 L27 44 Z" fill="#B3263A"/><path d="M168 36 L156 30 L156 46 L168 52 L163 44 Z" fill="#B3263A"/>`;
  s += `<path d="M34 22 Q95 15 156 22 L156 44 Q95 37 34 44 Z" fill="#E63950"/><path d="M34 22 Q95 15 156 22 L156 25 Q95 18 34 25 Z" fill="#FF6B7D"/>`;
  s += stern(26, 18, 3.4, '#FFC93C') + stern(164, 17, 2.8, '#FFC93C') + stern(176, 58, 2.2, '#FFD23F') + stern(15, 64, 2.4, '#FFD23F');
  // Raupe im Bogen: zehn Regenbogen-Perlen, Kopf vom App-Icon
  const bx = 95;
  const by = 128;
  const br = 62;
  // symmetrischer Bogen: erste Perle bei 200°, Kopf bei 340° – beide auf gleicher Höhe.
  // Regenbogen hier umgekehrt (rot hinten, lila am Kopf): so liegt der rote Fühler nicht auf einer roten Perle.
  const schritt = 140 / PERLEN_JE_RAUPE;
  for (let i = 0; i < PERLEN_JE_RAUPE; i++) {
    const a = ((200 + i * schritt) * Math.PI) / 180;
    s += m.perle(bx + br * Math.cos(a), by + br * Math.sin(a), 7.2, REGENBOGEN[PERLEN_JE_RAUPE - 1 - i]);
  }
  const ka = (340 * Math.PI) / 180;
  s += m.kopf(bx + br * Math.cos(ka), by + br * Math.sin(ka), 10.5);
  // Medaille
  const mx = 95;
  const my = 168;
  const R = 24; // Radius der Medaille
  const mk = R / 20;
  const band = (sg: number, farbe: string) =>
    `<path d="M${n1(mx + sg * 10 * mk)} ${n1(my + 8 * mk)} L${n1(mx + sg * 17 * mk)} ${n1(my + 34 * mk)} L${n1(mx + sg * 10 * mk)} ${n1(my + 30 * mk)} L${n1(mx + sg * 6 * mk)} ${n1(my + 37 * mk)} L${n1(mx + sg * 1 * mk)} ${n1(my + 12 * mk)} Z" fill="${farbe}"/>`;
  // Bänder grün und lila (nicht blau-rot: keine Flaggenfarben)
  s += band(-1, '#2FB344') + band(1, '#8338EC');
  let zacken = '';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    zacken += `<circle cx="${n1(mx + R * Math.cos(a))}" cy="${n1(my + R * Math.sin(a))}" r="3"/>`;
  }
  s += `<g fill="#F2B21F">${zacken}</g><circle cx="${mx}" cy="${my}" r="${R}" fill="url(#ukGold)" stroke="#C98A1A" stroke-width="0.8"/><circle cx="${mx}" cy="${my}" r="${R - 5}" fill="none" stroke="#FFF4B0" stroke-width="0.7" stroke-dasharray="1.2 1"/>`;
  return m.svg(`0 0 ${W} ${H}`, s, 'class="uk-bild" aria-hidden="true"');
}

/**
 * Urkunde nach einer vollen Raupe: A4 wie ein Leseblatt (Klasse .sheet → Druck und PDF wie gewohnt).
 * Feierlich gestaltet (Regenbogenrahmen, Konfetti, Band, Raupe im Bogen, Medaille mit den Lesetagen).
 * Anders als die Leseblätter in der Sprache der App – die Urkunde ist für Kind und Familie.
 * Der Name des Kindes darf fehlen – dann eine Linie zum Selberschreiben.
 */
export function renderUrkunde(u: { name: string; nr: number; datum: string; gesamt: number }): string {
  const d = new Date(u.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `<div class="sheet urkunde">
  ${urkundeBild(u.nr)}
  <div class="uk-titel">${esc(t('urk.titel'))}</div>
  <div class="uk-voll">${esc(t('urk.voll', { n: PERLEN_JE_RAUPE })).replace('\n', '<br>')}</div>
  <div class="uk-name${[...u.name].length > 11 ? ' lang' : ''}">${u.name ? `<span class="uk-stern">★</span>${esc(u.name)}<span class="uk-stern">★</span>` : '<span class="uk-linie"></span>'}</div>
  <div class="uk-medaille"><b>${u.gesamt}</b><small>${esc(t('urk.tage'))}</small></div>
  <div class="uk-text">${esc(t('urk.gelesen', { n: u.gesamt }))}</div>
  <div class="uk-toll">${esc(t('urk.toll'))}</div>
  <div class="uk-fuss">${esc(t('urk.raupe', { nr: u.nr }))} · ${d}</div>
</div>`;
}
