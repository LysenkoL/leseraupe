/**
 * Druckt Blätter in einem Auftrag: sie werden in #print-root gelegt, der Rest der App
 * ist beim Drucken unsichtbar. Jedes Blatt beginnt auf einer neuen A4-Seite (print.css).
 */
export function printSheets(sheetsHtml: string[]): void {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = sheetsHtml.join('');
  window.print();
}

export function printSheet(sheetHtml: string): void {
  printSheets([sheetHtml]);
}
