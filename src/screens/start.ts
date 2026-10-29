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

const BLOCK_NAMES: [BlockId, string][] = [
  ['silben', 'Silben'],
  ['woerter', 'Wörter'],
  ['kleine', 'Kleine Wörter'],
  ['saetze', 'Sätze'],
  ['geschichte', 'Geschichte'],
  ['quest', 'Quest'],
  ['fragen', 'Fragen für Eltern'],
];

const RAUPE_MINI = `<svg viewBox="0 0 116 56" aria-hidden="true"><circle cx="14" cy="38" r="12" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="36" cy="34" r="13" fill="#9FD18F" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="60" cy="38" r="13" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="88" cy="28" r="18" fill="#7FC06D" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="82" cy="24" r="3" fill="#1F2421"/><circle cx="94" cy="24" r="3" fill="#1F2421"/><path d="M81 34 Q88 40 96 34" fill="none" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export function renderStart(root: HTMLElement): void {
  let count = -1;
  let stand: Raupenstand | null = null;
  const draw = (c = count) => {
    count = c;
    const s = getSettings();
    const neu = s.newLetter ? unitById(s.newLetter)?.label.replace('-', '') : '–';
    const themeChips = THEME_IDS.map((id) => {
      const t = THEMES[id];
      const on = !s.randomTheme && s.theme === id ? ' on' : '';
      return `<button class="chip${on}" data-theme="${id}" style="background:${t.light};color:${t.main}">${t.name}</button>`;
    }).join('');
    const blocks = BLOCK_NAMES.map(
      ([id, name]) => `<label class="toggle small"><input type="checkbox" data-block="${id}" ${s.blocks[id] ? 'checked' : ''}/> ${name}</label>`,
    ).join('');

    root.innerHTML = `
<div class="screen">
  <div class="topbar">
    <div class="brand grow">${RAUPE_MINI}<span>Leseraupe</span></div>
    <a class="pillbtn" href="#/verlauf" style="display:flex;align-items:center;text-decoration:none">Verlauf${count >= 0 ? ` · ${count}` : ''}</a>
    <a class="iconbtn" href="#/einstellungen" aria-label="Einstellungen">${GEAR_ICON}</a>
  </div>
  <div class="content">
    ${
      canInstall()
        ? `<section class="card install"><h2>App aufs Handy</h2><button class="btn green" id="install">Leseraupe installieren</button></section>`
        : ''
    }
    ${
      s.childName
        ? ''
        : `<section class="card"><h2>Name des Kindes</h2>
      <div class="hint">Steht oben auf jedem Leseblatt. Leer lassen, wenn das Kind den Namen selbst schreiben soll. Später änderbar in den Einstellungen.</div>
      <form class="name-row" id="name-form"><input id="child-name" autocomplete="off" maxlength="40" placeholder="z. B. Mia" aria-label="Name des Kindes" /><button class="btn green" type="submit">Speichern</button></form>
    </section>`
    }
    ${stand && (stand.perlen || stand.fertig.length) ? raupenKarte(stand) : ''}
    <section class="card">
      <div class="row"><h2>Gelernte Buchstaben</h2><span class="hint">${s.letters.length} von 43 · neu: ${esc(neu ?? '–')}</span></div>
      ${lettersHtml(s)}
    </section>
    <section class="card">
      <div class="row"><h2>Blätter auf einmal</h2><span class="hint">jedes weitere etwas schwerer</span></div>
      <div class="stepper">
        <button class="iconbtn" data-bl="-1" aria-label="Ein Blatt weniger" ${s.blaetter <= 1 ? 'disabled' : ''}>−</button>
        <b id="bl-n">${s.blaetter}</b>
        <button class="iconbtn" data-bl="1" aria-label="Ein Blatt mehr" ${s.blaetter >= MAX_BLAETTER ? 'disabled' : ''}>+</button>
      </div>
      <label class="toggle"><input type="checkbox" id="silben-farbig" ${s.silbenFarbig ? 'checked' : ''}/> Silben farbig <span class="sy-demo"><span class="sy1">Ma</span><span class="sy2">ma</span></span></label>
    </section>
    <section class="card">
      <div class="row"><h2>Thema</h2><a class="hint" href="#/thema">Vorschau ›</a></div>
      <div class="chips">${themeChips}<button class="chip${s.randomTheme ? ' on' : ''}" data-theme="zufall" style="color:#3D4A56">Zufall</button></div>
    </section>
    <details class="card">
      <summary><h2 style="display:inline">Blöcke</h2></summary>
      <div class="blocks">${blocks}</div>
    </details>
  </div>
  <div class="bottom">
    <button class="btn primary big" id="create">${s.blaetter > 1 ? `${s.blaetter} Leseblätter erstellen` : 'Leseblatt erstellen'}</button>
    <a class="btn ghost" href="#/chat">Mit Chat erstellen (Claude / ChatGPT) …</a>
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
        const t = b.dataset.theme!;
        if (t === 'zufall') setSettings({ ...getSettings(), randomTheme: !getSettings().randomTheme });
        else setSettings({ ...getSettings(), theme: t as never, randomTheme: false });
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
      toast('Name gespeichert');
      draw(count);
    });
    root.querySelector('#install')?.addEventListener('click', async () => {
      if (await install()) toast('Fertig! Leseraupe ist jetzt bei den Apps.');
      draw(count);
    });
    root.querySelector('#create')!.addEventListener('click', async () => {
      const s2 = getSettings();
      if (!s2.letters.length) {
        toast('Bitte zuerst gelernte Buchstaben antippen.');
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
