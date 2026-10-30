import { getSettings, setSettings } from '../app/state';
import { esc, go } from '../app/ui';
import { bindLetters, lettersHtml } from '../app/lettergrid';
import { setOnboarded } from '../core/store';
import { t } from '../app/i18n';

/** dieselbe Raupe wie auf dem App-Icon */
const RAUPE = `<img src="icons/figur-400.png" alt="" width="200" height="200" />`;

const STEPS = 4;

/**
 * Einführung beim ersten Start (A2): 4 Schritte, wischen oder „Weiter“, jederzeit „Überspringen“.
 * `back`: wohin es danach geht (wiederholt aus „Über die App“).
 */
export function renderWillkommen(root: HTMLElement, back = '#/'): void {
  let step = 0;

  const finish = () => {
    setOnboarded();
    go(back);
  };

  const body = (): string => {
    const s = getSettings();
    switch (step) {
      case 0:
        return `<div class="onb-art">${RAUPE}</div>
          <h1>${t('onb.willkommen')}</h1>
          <p>${t('onb.text1')}</p>
          <p class="hint">${t('onb.hint1')}</p>`;
      case 1:
        return `<div class="onb-art onb-steps" aria-hidden="true"><span>1</span><span>2</span><span>3</span></div>
          <h1>${t('onb.titel2')}</h1>
          <p>${t('onb.text2')}</p>`;
      case 2:
        return `<h1>${t('onb.titel3')}</h1>
          <p class="hint">${t('onb.hint3')}</p>
          <section class="card">${lettersHtml(s)}</section>`;
      default:
        return `<h1>${t('onb.titel4')}</h1>
          <p class="hint">${t('onb.hint4')}</p>
          <input id="onb-name" class="onb-input" autocomplete="off" maxlength="40" placeholder="${t('start.namePlatzhalter')}" aria-label="${t('start.nameTitel')}" value="${esc(s.childName)}" />`;
    }
  };

  const draw = () => {
    const last = step === STEPS - 1;
    const dots = Array.from({ length: STEPS }, (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('');
    root.innerHTML = `
<div class="screen onb">
  <div class="topbar">
    <div class="grow onb-dots" aria-label="${t('onb.schritt', { n: step + 1, max: STEPS })}">${dots}</div>
    ${last ? '' : `<button class="pillbtn" id="onb-skip">${t('onb.ueberspringen')}</button>`}
  </div>
  <div class="content onb-body" id="onb-body">${body()}</div>
  <div class="bottom">
    <div class="btnrow${step > 0 ? ' onb-zwei' : ''}">
      ${step > 0 ? `<button class="btn ghost" id="onb-prev">${t('ui.zurueck')}</button>` : ''}
      <button class="btn primary big" id="onb-next">${last ? t('onb.los') : t('timer.weiter')}</button>
    </div>
  </div>
</div>`;

    const saveName = () => {
      const el = root.querySelector<HTMLInputElement>('#onb-name');
      if (el) setSettings({ ...getSettings(), childName: el.value.trim() });
    };
    const next = () => {
      saveName();
      if (step === STEPS - 1) return finish();
      step++;
      draw();
    };
    const prev = () => {
      if (step === 0) return;
      saveName();
      step--;
      draw();
    };

    root.querySelector('#onb-skip')?.addEventListener('click', finish);
    root.querySelector('#onb-next')!.addEventListener('click', next);
    root.querySelector('#onb-prev')?.addEventListener('click', prev);
    root.querySelector<HTMLInputElement>('#onb-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') next();
    });
    bindLetters(root, draw);

    // Wischen: links → weiter, rechts → zurück (nicht über dem Buchstabenraster; über dem Namensfeld schon –
    // es steht mitten im Bild, genau dort wischt man)
    const area = root.querySelector<HTMLElement>('#onb-body')!;
    let x0: number | null = null;
    area.addEventListener('pointerdown', (e) => {
      x0 = (e.target as HTMLElement).closest('.letters') ? null : e.clientX;
    });
    area.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (dx < -60) next();
      else if (dx > 60) prev();
    });
  };

  draw();
}
