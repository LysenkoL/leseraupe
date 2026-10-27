import { UNITS, unitById } from '../core/letters';
import { toggleLetter } from '../core/store';
import { getSettings, setSettings } from '../app/state';
import { esc, go, toast, GEAR_ICON } from '../app/ui';
import { THEMES, THEME_IDS } from '../sheet/themes';
import { allSheets, log } from '../core/db';
import { createDraft } from '../app/actions';
import type { BlockId } from '../core/types';

const BLOCK_NAMES: [BlockId, string][] = [
  ['silben', 'Silben'],
  ['woerter', 'Wörter'],
  ['kleine', 'Kleine Wörter'],
  ['aehnlich', 'Ähnliche Buchstaben'],
  ['saetze', 'Sätze'],
  ['geschichte', 'Geschichte'],
  ['quest', 'Quest'],
  ['fragen', 'Fragen für Eltern'],
];

const RAUPE_MINI = `<svg viewBox="0 0 116 56" aria-hidden="true"><circle cx="14" cy="38" r="12" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="36" cy="34" r="13" fill="#9FD18F" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="60" cy="38" r="13" fill="#BFE0B5" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="88" cy="28" r="18" fill="#7FC06D" stroke="#2F6B3A" stroke-width="2.5"/><circle cx="82" cy="24" r="3" fill="#1F2421"/><circle cx="94" cy="24" r="3" fill="#1F2421"/><path d="M81 34 Q88 40 96 34" fill="none" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export function renderStart(root: HTMLElement): void {
  const draw = (count = -1) => {
    const s = getSettings();
    const letters = UNITS.map((u) => {
      const on = s.letters.includes(u.id);
      const cls = u.id === s.newLetter ? 'neu' : on ? 'on' : '';
      const small = u.label.length > 2 ? ' small' : '';
      const state = u.id === s.newLetter ? 'neu' : on ? 'gelernt' : 'noch nicht';
      return `<button class="lt ${cls}${small}" data-l="${u.id}" aria-label="${esc(u.label)}: ${state}">${esc(u.label)}</button>`;
    }).join('');
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
    <section class="card">
      <div class="row"><h2>Gelernte Buchstaben</h2><span class="hint">${s.letters.length} von 43 · neu: ${esc(neu ?? '–')}</span></div>
      <div class="letters">${letters}</div>
      <div class="legend"><span><i style="background:#9FD18F"></i>gelernt</span><span><i style="background:#F2A65A"></i>neu</span><span><i style="background:#fff;border:1px solid #CCD3CE"></i>noch nicht</span></div>
      <div class="hint">Tippen: noch nicht → neu → gelernt → noch nicht</div>
    </section>
    <section class="card">
      <h2>Lesezeit</h2>
      <div class="seg">
        <button data-min="5" class="${s.minutes === 5 ? 'on' : ''}">5 Minuten</button>
        <button data-min="10" class="${s.minutes === 10 ? 'on' : ''}">10 Minuten</button>
      </div>
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
    <button class="btn primary big" id="create">Leseblatt erstellen</button>
    <a class="btn ghost" href="#/chat">Mit Chat erstellen (Claude / ChatGPT) …</a>
  </div>
</div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-l]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.l!;
        const r = toggleLetter(getSettings(), id);
        setSettings(r.settings);
        const lbl = unitById(id)!.label.replace('-', '');
        if (r.added) await log(`Buchstabe ${lbl} hinzugefügt`);
        if (r.removed) await log(`Buchstabe ${lbl} entfernt`);
        draw(count);
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-min]').forEach((b) =>
      b.addEventListener('click', () => {
        setSettings({ ...getSettings(), minutes: Number(b.dataset.min) as 5 | 10 });
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
    root.querySelectorAll<HTMLInputElement>('[data-block]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const s2 = getSettings();
        setSettings({ ...s2, blocks: { ...s2.blocks, [cb.dataset.block!]: cb.checked } });
      }),
    );
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
  allSheets().then((l) => draw(l.length)).catch(() => undefined);
}
