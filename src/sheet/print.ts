import { NATIV, Druck } from '../app/native';
import { toast } from '../app/ui';
import { t } from '../app/i18n';

/**
 * Legt die Blätter in #print-root: beim Drucken ist nur dieser Bereich sichtbar (print.css),
 * jedes Blatt beginnt auf einer neuen A4-Seite. Wartet, bis alle Bilder (Dekorationen) geladen sind.
 */
export async function druckBereich(sheetsHtml: string[]): Promise<void> {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = sheetsHtml.join('');
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
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = sheetsHtml.join('');
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
