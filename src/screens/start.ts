import { unitById } from '../core/letters';
import { bindLetters, lettersHtml } from '../app/lettergrid';
import { MAX_BLAETTER } from '../core/store';
import { raupenstand, type Raupenstand } from '../sheet/urkunde';
import { raupenKarte } from '../app/raupe';
import { getSettings, setSettings } from '../app/state';
import { esc, go, toast, GEAR_ICON } from '../app/ui';
import { THEMES, THEME_IDS } from '../sheet/themes';
import { allSheets } from '../core/db';
import { createDraft } from '../app/actions';
import type { BlockId } from '../core/types';
import { canInstall, install, isStandalone, onInstallChange } from '../app/install';
import { t, themaName } from '../app/i18n';

const BLOCKS: BlockId[] = ['silben', 'woerter', 'kleine', 'saetze', 'geschichte', 'quest', 'fragen'];

const RAUPE_MINI = `<svg viewBox="0 0 116 56" aria-hidden="true"><circle cx="14" cy="38" r="12" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="36" cy="34" r="13" fill="#9FD18F" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="60" cy="38" r="13" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="88" cy="28" r="18" fill="#7FC06D" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="82" cy="24" r="3" fill="#1F2421"/><circle cx="94" cy="24" r="3" fill="#1F2421"/><path d="M81 34 Q88 40 96 34" fill="none" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export function renderStart(root: HTMLElement): void {
  let count = -1;
  let stand: Raupenstand | null = null;
  const draw = (c = count) => {
    count = c;
    const s = getSettings();
    const neu = s.newLetter ? unitById(s.newLetter)?.label.replace('-', '') : '–';
    const themeChips = THEME_IDS.map((id) => {
      const th = THEMES[id];
      const on = !s.randomTheme && s.theme === id ? ' on' : '';
      return `<button class="chip${on}" data-theme="${id}" style="background:${th.light};color:${th.main}">${themaName(id)}</button>`;
    }).join('');
    const blocks = BLOCKS.map(
      (id) => `<label class="toggle small"><input type="checkbox" data-block="${id}" ${s.blocks[id] ? 'checked' : ''}/> ${t(`block.${id}`)}</label>`,
    ).join('');

    root.innerHTML = `
<div class="screen">
  <div class="topbar">
    <div class="brand grow">${RAUPE_MINI}<span>Leseraupe</span></div>
    <a class="pillbtn" href="#/verlauf" style="display:flex;align-items:center;text-decoration:none">${t('start.verlauf')}${count >= 0 ? ` · ${count}` : ''}</a>
    <a class="iconbtn" href="#/einstellungen" aria-label="${t('start.einstellungen')}">${GEAR_ICON}</a>
  </div>
  <div class="content">
    ${
      canInstall()
        ? `<section class="card install"><h2>${t('start.appAufsHandy')}</h2><button class="btn green" id="install">${t('start.installieren')}</button></section>`
        : ''
    }
    ${
      s.childName
        ? ''
        : `<section class="card"><h2>${t('start.nameTitel')}</h2>
      <div class="hint">${t('start.nameHinweis')}</div>
      <form class="name-row" id="name-form"><input id="child-name" autocomplete="off" maxlength="40" placeholder="${t('start.namePlatzhalter')}" aria-label="${t('start.nameTitel')}" /><button class="btn green" type="submit">${t('start.speichern')}</button></form>
    </section>`
    }
    ${stand && (stand.perlen || stand.fertig.length) ? raupenKarte(stand) : ''}
    <section class="card">
      <div class="row"><h2>${t('start.buchstaben')}</h2><span class="hint">${t('start.buchstabenZahl', { n: s.letters.length, neu: esc(neu ?? '–') })}</span></div>
      ${lettersHtml(s)}
    </section>
    <section class="card">
      <div class="row"><h2>${t('start.blaetter')}</h2><span class="hint">${t('start.blaetterHinweis')}</span></div>
      <div class="stepper">
        <button class="iconbtn" data-bl="-1" aria-label="${t('start.blattWeniger')}" ${s.blaetter <= 1 ? 'disabled' : ''}>−</button>
        <b id="bl-n">${s.blaetter}</b>
        <button class="iconbtn" data-bl="1" aria-label="${t('start.blattMehr')}" ${s.blaetter >= MAX_BLAETTER ? 'disabled' : ''}>+</button>
      </div>
      <label class="toggle"><input type="checkbox" id="silben-farbig" ${s.silbenFarbig ? 'checked' : ''}/> ${t('start.silbenFarbig')} <span class="sy-demo"><span class="sy1">Ma</span><span class="sy2">ma</span></span></label>
    </section>
    <section class="card">
      <div class="row"><h2>${t('start.thema')}</h2><a class="hint" href="#/thema">${t('start.themaVorschau')}</a></div>
      <div class="chips">${themeChips}<button class="chip${s.randomTheme ? ' on' : ''}" data-theme="zufall" style="color:#3D4A56">${t('start.zufall')}</button></div>
    </section>
    <details class="card">
      <summary><h2 style="display:inline">${t('start.bloecke')}</h2></summary>
      <div class="blocks">${blocks}</div>
    </details>
  </div>
  <div class="bottom">
    <button class="btn primary big" id="create">${s.blaetter > 1 ? t('start.erstellenN', { n: s.blaetter }) : t('start.erstellen1')}</button>
    <a class="btn ghost" href="#/chat">${t('start.chat')}</a>
  </div>
</div>`;

    bindLetters(root, () => draw(count));
    root.querySelectorAll<HTMLButtonElement>('[data-bl]').forEach((b) =>
      b.addEventListener('click', () => {
        const n = Math.min(MAX_BLAETTER, Math.max(1, getSettings().blaetter + Number(b.dataset.bl)));
        setSettings({ ...getSettings(), blaetter: n });
        draw(count);
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((b) =>
      b.addEventListener('click', () => {
        const th = b.dataset.theme!;
        if (th === 'zufall') setSettings({ ...getSettings(), randomTheme: !getSettings().randomTheme });
        else setSettings({ ...getSettings(), theme: th as never, randomTheme: false });
        draw(count);
      }),
    );
    root.querySelector<HTMLInputElement>('#silben-farbig')!.addEventListener('change', (e) => {
      setSettings({ ...getSettings(), silbenFarbig: (e.target as HTMLInputElement).checked });
    });
    root.querySelectorAll<HTMLInputElement>('[data-block]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const s2 = getSettings();
        setSettings({ ...s2, blocks: { ...s2.blocks, [cb.dataset.block!]: cb.checked } });
      }),
    );
    root.querySelector<HTMLFormElement>('#name-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = root.querySelector<HTMLInputElement>('#child-name')!.value.trim();
      if (!name) return;
      setSettings({ ...getSettings(), childName: name });
      toast(t('start.nameGespeichert'));
      draw(count);
    });
    root.querySelector('#install')?.addEventListener('click', async () => {
      if (await install()) toast(t('start.installiert'));
      draw(count);
    });
    root.querySelector('#create')!.addEventListener('click', async () => {
      const s2 = getSettings();
      if (!s2.letters.length) {
        toast(t('start.erstBuchstaben'));
        return;
      }
      await createDraft();
      go('#/vorschau');
    });
  };
  draw();
  if (!isStandalone()) {
    const off = onInstallChange(() => draw(count));
    window.addEventListener('hashchange', off, { once: true });
  }
  allSheets()
    .then((l) => {
      stand = raupenstand(l);
      draw(l.length);
    })
    .catch(() => undefined);
}
