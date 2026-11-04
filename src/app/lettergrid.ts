import { UNITS, unitById } from '../core/letters';
import { alleAbwaehlen, alleFrageFaellig, alleWaehlen, nurLesetexte, toggleLetter, type Settings } from '../core/store';
import { log } from '../core/db';
import { getSettings, setSettings } from './state';
import { confirmDialog, esc } from './ui';
import { t } from './i18n';

const alle = (s: Settings) => s.letters.length >= UNITS.length;

/** Raster der 43 Buchstaben mit Legende – auf Start und in der Einführung. */
export function lettersHtml(s: Settings): string {
  // Nur die Anzeige gruppieren: IDs und gespeicherte Auswahl bleiben unverändert.
  const groups = [
    { title: '', units: UNITS.filter(u => /^[a-z]$/.test(u.id)).sort((a, b) => a.id.localeCompare(b.id, 'de')) },
    { title: t('buchst.umlaute'), units: ['ä', 'ö', 'ü', 'ß'].map(id => unitById(id)!) },
    { title: t('buchst.verbindungen'), units: UNITS.filter(u => u.id.length > 1).sort((a, b) => a.id.localeCompare(b.id, 'de')) },
  ];
  const letters = groups.map(group => {
    const heading = group.title ? `<span class="letter-group-title">${esc(group.title)}</span>` : '';
    return heading + group.units.map(u => {
      const on = s.letters.includes(u.id);
      const cls = u.id === s.newLetter ? 'neu' : on ? 'on' : '';
      // Buchstaben groß, Verbindungen einheitlich klein; ß bleibt als eigene Lerneinheit klein.
      const label = u.id.length > 1 || u.id === 'ß' ? u.id : u.id.toUpperCase();
      const small = label.length > 2 ? ' small' : '';
      const state = u.id === s.newLetter ? t('buchst.neu') : on ? t('buchst.gelernt') : t('buchst.nochnicht');
      return `<button class="lt ${cls}${small}" data-l="${u.id}" aria-label="${esc(label)}: ${state}">${esc(label)}</button>`;
    }).join('');
  }).join('');
  // Gesamtauswahl auf eigener Zeile nach allen drei Gruppen.
  const alleBtn = `<button class="pillbtn alle-btn" type="button" data-alle="${alle(s) ? 'ab' : 'an'}"><span class="alle-an">${t('buchst.alle')}</span><span class="alle-ab">${t('buchst.keine')}</span></button>`;
  return `<div class="letters">${letters}${alleBtn}</div>
      <div class="legend"><span><i style="background:#9FD18F"></i>${t('buchst.gelernt')}</span><span><i style="background:#F2A65A"></i>${t('buchst.neu')}</span><span><i style="background:#fff;border:1px solid #CCD3CE"></i>${t('buchst.nochnicht')}</span></div>`;
}

/**
 * Protokoll für Buchstaben: nicht jeder Tipp, sondern das Ergebnis. Beim ersten Tipp merken wir uns die
 * Buchstaben von vorher; erst beim Verlassen des Bildschirms oder beim Erstellen eines Blatts
 * wird verglichen – hin und her getippte Buchstaben tauchen dann gar nicht auf.
 */
// in localStorage: übersteht Neuladen und Neustart der App, bis der Bildschirm verlassen wird
const MERK = 'leseraupe.buchstaben.vorher';
function leseVorher(): Set<string> | null {
  try {
    const raw = localStorage.getItem(MERK);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
function merkeVorher(v: string[] | null): void {
  try {
    if (v) localStorage.setItem(MERK, JSON.stringify(v));
    else localStorage.removeItem(MERK);
  } catch {
    /* ohne Speicher: dann eben kein Protokolleintrag */
  }
}

export async function buchstabenProtokollieren(): Promise<void> {
  const alt = leseVorher();
  if (!alt) return;
  merkeVorher(null);
  const jetzt = new Set(getSettings().letters);
  const lbl = (id: string) => unitById(id)?.label ?? id;
  for (const id of jetzt) if (!alt.has(id)) await log(`Buchstabe ${lbl(id)} hinzugefügt`);
  for (const id of alt) if (!jetzt.has(id)) await log(`Buchstabe ${lbl(id)} entfernt`);
}

if (typeof window !== 'undefined') window.addEventListener('hashchange', () => void buchstabenProtokollieren());

/** C2: Sind jetzt alle Buchstaben gewählt, einmal fragen, ob nur noch Lesetexte kommen sollen. */
async function alleFrage(redraw: () => void): Promise<void> {
  if (!alleFrageFaellig(getSettings())) return;
  setSettings({ ...getSettings(), alleGefragt: true });
  if (await confirmDialog(t('buchst.alleFrage'), t('buchst.alleJa'), t('buchst.alleNein'), false, { titel: t('buchst.alleTitel'), untereinander: true })) {
    setSettings(nurLesetexte(getSettings()));
    redraw();
  }
}

/** Tippen auf einen Buchstaben: speichern, neu zeichnen (Protokoll später, siehe oben). */
export function bindLetters(root: HTMLElement, redraw: () => void): void {
  const aendern = (f: (s: Settings) => Settings) => {
    if (!leseVorher()) merkeVorher(getSettings().letters);
    setSettings(f(getSettings()));
    redraw();
    void alleFrage(redraw);
  };
  root.querySelectorAll<HTMLButtonElement>('[data-l]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.l!;
      aendern((s) => toggleLetter(s, id).settings);
      // Das Raster wurde neu gezeichnet: Tastatur und Screenreader bleiben auf derselben Buchstabe
      root.querySelector<HTMLButtonElement>(`[data-l="${id}"]`)?.focus({ preventScroll: true });
    }),
  );
  // „Alle auswählen“ ↔ „Alle abwählen“: ein Tipp macht den anderen rückgängig
  root.querySelector<HTMLButtonElement>('[data-alle]')?.addEventListener('click', () => aendern(alle(getSettings()) ? alleAbwaehlen : alleWaehlen));
}
