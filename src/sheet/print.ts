/** Druckt genau ein Blatt: es wird in #print-root gelegt, der Rest der App ist beim Drucken unsichtbar. */
export function printSheet(sheetHtml: string): void {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = sheetHtml;
  window.print();
}
