import { getSettings, setSettings } from '../app/state';
import { esc, go } from '../app/ui';
import { bindLetters, lettersHtml } from '../app/lettergrid';
import { setOnboarded } from '../core/store';

const RAUPE = `<svg viewBox="0 0 116 56" aria-hidden="true"><circle cx="14" cy="38" r="12" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="36" cy="34" r="13" fill="#9FD18F" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="60" cy="38" r="13" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="88" cy="28" r="18" fill="#7FC06D" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="82" cy="24" r="3" fill="#1F2421"/><circle cx="94" cy="24" r="3" fill="#1F2421"/><path d="M81 34 Q88 40 96 34" fill="none" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/></svg>`;

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
          <h1>Willkommen bei der Leseraupe</h1>
          <p>Tägliche Leseblätter nur mit den Buchstaben, die dein Kind schon kennt.</p>
          <p class="hint">Blatt erstellen, drucken oder am Bildschirm lesen, Timer an – fertig.</p>`;
      case 1:
        return `<div class="onb-art onb-steps" aria-hidden="true"><span>1</span><span>2</span><span>3</span></div>
          <h1>Die App wächst mit</h1>
          <p>Mit jedem Blatt wird es ein kleines bisschen schwerer. Wörter, bei denen dein Kind stockt, kommen öfter wieder – bis sie sitzen.</p>`;
      case 2:
        return `<h1>Welche Buchstaben kennt dein Kind?</h1>
          <p class="hint">Tippe alle an, die in der Schule schon dran waren. Das geht später jederzeit auf der Startseite.</p>
          <section class="card">${lettersHtml(s)}</section>`;
      default:
        return `<h1>Wie heißt dein Kind?</h1>
          <p class="hint">Steht oben auf jedem Leseblatt. Du kannst das Feld auch leer lassen – dann schreibt dein Kind den Namen selbst.</p>
          <input id="onb-name" class="onb-input" autocomplete="off" maxlength="40" placeholder="z. B. Mia" aria-label="Name des Kindes" value="${esc(s.childName)}" />`;
    }
  };

  const draw = () => {
    const last = step === STEPS - 1;
    const dots = Array.from({ length: STEPS }, (_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('');
    root.innerHTML = `
<div class="screen onb">
  <div class="topbar">
    <div class="grow onb-dots" aria-label="Schritt ${step + 1} von ${STEPS}">${dots}</div>
    ${last ? '' : `<button class="pillbtn" id="onb-skip">Überspringen</button>`}
  </div>
  <div class="content onb-body" id="onb-body">${body()}</div>
  <div class="bottom">
    <button class="btn primary big" id="onb-next">${last ? 'Los geht’s' : 'Weiter'}</button>
    ${step > 0 ? `<button class="btn ghost" id="onb-prev">Zurück</button>` : ''}
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

    // Wischen: links → weiter, rechts → zurück (nicht über dem Buchstabenraster)
    const area = root.querySelector<HTMLElement>('#onb-body')!;
    let x0: number | null = null;
    area.addEventListener('pointerdown', (e) => {
      x0 = (e.target as HTMLElement).closest('.letters, input') ? null : e.clientX;
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
