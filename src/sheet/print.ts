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
    toast(t('aktion.druckVorbereiten'));
    try {
      const pdf = await sheetsToPdf(sheetsHtml, name);
      await Druck.pdfDrucken({ pdf: toBase64(pdf.buffer as ArrayBuffer), name, seiten: sheetsHtml.length });
    } catch {
      toast(t('aktion.druckFehler'));
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

export function printSheet(sheetHtml: string, name?: string): Promise<void> {
  return printSheets([sheetHtml], name);
}
