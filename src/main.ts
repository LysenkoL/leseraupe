import './styles/fonts.css';
import './styles/app.css';
import './styles/sheet.css';
import './styles/print.css';
import { registerSW } from 'virtual:pwa-register';
import { renderSheet } from './sheet/render';
import { mountPreview } from './sheet/preview';
import { printSheet } from './sheet/print';
import { SAMPLE_SHEET as sample } from './core/sample';

registerSW({ immediate: true });


const app = document.getElementById('app')!;
app.innerHTML = `
<div class="screen">
  <div class="topbar"><div class="grow"><h1>Probeblatt</h1><div class="sub">Druck-Test · A4 · Inter (Schulvariante)</div></div></div>
  <div class="preview-wrap" id="pv"></div>
  <div class="bottom"><button class="btn green big" id="print">Drucken</button></div>
</div>`;

const pv = document.getElementById('pv')!;
mountPreview(pv, renderSheet(sample, { displayNumber: 1 })).then((r) => {
  document.getElementById('print')!.addEventListener('click', () => printSheet(r.html));
});
