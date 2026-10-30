import { NATIV, Druck } from '../app/native';
import { sheetsToPdf, toBase64 } from './pdf';
import { toast } from '../app/ui';
import { t } from '../app/i18n';

/**
 * Druckt Blätter in einem Auftrag: sie werden in #print-root gelegt, der Rest der App
 * ist beim Drucken unsichtbar. Jedes Blatt beginnt auf einer neuen A4-Seite (print.css).
 * In der Android-App geht window.print() nicht: dort wird dasselbe A4-PDF wie bei
 * „Als PDF teilen“ erzeugt und über das Druckmenü von Android gedruckt.
 */
export async function printSheets(sheetsHtml: string[], name = 'Leseblatt'): Promise<void> {
  if (NATIV) {
    try {
      const pdf = await sheetsToPdf(sheetsHtml, name);
      await Druck.pdfDrucken({ pdf: toBase64(pdf.buffer as ArrayBuffer), name, seiten: sheetsHtml.length });
    } catch (e) {
      // App war gerade nicht auf dem Bildschirm (z. B. Display aus) – Android öffnet das Druckmenü dann nicht
      toast(t((e as { code?: string }).code === 'NICHT_SICHTBAR' ? 'aktion.druckUnterbrochen' : 'aktion.druckFehler'), 4000);
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
