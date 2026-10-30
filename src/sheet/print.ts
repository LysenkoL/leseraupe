import { NATIV, Druck } from '../app/native';
import { toast } from '../app/ui';
import { t } from '../app/i18n';

/**
 * Eigene IDs für die Druck-Kopie (Farbverläufe der Perlen, Masken der Urkunde). Sonst zeigt url(#…)
 * auf dieselbe ID in der Vorschau – die ist beim Drucken versteckt, und Perlen/Rahmen kommen weiß heraus.
 */
export function eigeneIds(html: string): string {
  const ids = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
  let out = html;
  for (const id of ids) {
    out = out
      .replaceAll(` id="${id}"`, ` id="druck-${id}"`)
      .replaceAll(`url(#${id})`, `url(#druck-${id})`)
      .replaceAll(`href="#${id}"`, `href="#druck-${id}"`);
  }
  return out;
}

/**
 * Legt die Blätter in #print-root: beim Drucken ist nur dieser Bereich sichtbar (print.css),
 * jedes Blatt beginnt auf einer neuen A4-Seite.
 */
function fuelleDruckBereich(sheetsHtml: string[]): HTMLElement {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = eigeneIds(sheetsHtml.join(''));
  return root;
}

/** wie oben, und wartet, bis alle Bilder (Dekorationen) geladen sind – für die Android-App */
export async function druckBereich(sheetsHtml: string[]): Promise<void> {
  const root = fuelleDruckBereich(sheetsHtml);
  await Promise.all(Array.from(root.querySelectorAll('img'), (img) => img.decode().catch(() => undefined)));
  await document.fonts.ready;
}

/**
 * Druckt Blätter in einem Auftrag. In der Android-App geht window.print() nicht:
 * dort druckt Android dieselbe Seite über das eigene Druckmenü (Papier A4 voreingestellt).
 */
export async function printSheets(sheetsHtml: string[], name = 'Leseblatt'): Promise<void> {
  if (NATIV) {
    try {
      await druckBereich(sheetsHtml);
      await Druck.seiteDrucken({ name });
    } catch (e) {
      // App war gerade nicht auf dem Bildschirm (z. B. Display aus) – Android öffnet das Druckmenü dann nicht
      const code = (e as { code?: string }).code;
      toast(t(code === 'NICHT_SICHTBAR' ? 'aktion.druckUnterbrochen' : code === 'BESCHAEFTIGT' ? 'aktion.druckLaeuft' : 'aktion.druckFehler'), 4000);
    }
    return;
  }
  fuelleDruckBereich(sheetsHtml);
  window.print();
}

/**
 * Druck-Knopf: sofort „Druck wird vorbereitet …“ und gesperrt, bis das Druckmenü offen ist –
 * weitere Tipps starten keinen zweiten Auftrag.
 */
export async function mitDruckKnopf(btn: HTMLButtonElement, arbeit: () => Promise<void>): Promise<void> {
  if (btn.disabled) return;
  const text = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('aktion.druckVorbereiten');
  try {
    await arbeit();
  } finally {
    btn.disabled = false;
    btn.textContent = text;
  }
}

export function printSheet(sheetHtml: string, name?: string): Promise<void> {
  return printSheets([sheetHtml], name);
}
