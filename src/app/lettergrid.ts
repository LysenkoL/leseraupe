import { UNITS, unitById } from '../core/letters';
import { alleFrageFaellig, alleWaehlen, nurLesetexte, toggleLetter, type Settings } from '../core/store';
import { log } from '../core/db';
import { getSettings, setSettings } from './state';
import { confirmDialog, esc } from './ui';
import { t } from './i18n';

/** Raster der 43 Buchstaben mit Legende – auf Start und in der Einführung. */
export function lettersHtml(s: Settings): string {
  const letters = UNITS.map((u) => {
    const on = s.letters.includes(u.id);
    const cls = u.id === s.newLetter ? 'neu' : on ? 'on' : '';
    const small = u.label.length > 2 ? ' small' : '';
    const state = u.id === s.newLetter ? t('buchst.neu') : on ? t('buchst.gelernt') : t('buchst.nochnicht');
    return `<button class="lt ${cls}${small}" data-l="${u.id}" aria-label="${esc(u.label)}: ${state}">${esc(u.label)}</button>`;
  }).join('');
  return `<div class="letters">${letters}</div>
      <div class="legend-row"><div class="legend"><span><i style="background:#9FD18F"></i>${t('buchst.gelernt')}</span><span><i style="background:#F2A65A"></i>${t('buchst.neu')}</span><span><i style="background:#fff;border:1px solid #CCD3CE"></i>${t('buchst.nochnicht')}</span></div>
        <button class="pillbtn alle-btn" type="button" data-alle ${s.letters.length >= UNITS.length ? 'disabled' : ''}>${t('buchst.alle')}</button></div>
      <div class="hint">${t('buchst.hinweis')}</div>`;
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
  if (await confirmDialog(t('buchst.alleFrage'), t('ui.ja'), t('buchst.alleNein'))) {
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
    b.addEventListener('click', () => aendern((s) => toggleLetter(s, b.dataset.l!).settings)),
  );
  root.querySelector<HTMLButtonElement>('[data-alle]')?.addEventListener('click', () => aendern(alleWaehlen));
}
