import { getSettings, setDraft } from '../app/state';
import { backButton, esc, go, toast } from '../app/ui';
import { buildPrompt, parseChat, sheetFromChat, PARSE_ERROR } from '../core/chat';
import { genParams } from '../app/actions';

export function renderChat(root: HTMLElement): void {
  const s = getSettings();
  const prompt = buildPrompt(s.letters, s.newLetter, s.minutes);
  const q = encodeURIComponent(prompt);
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1>Mit Chat erstellen</h1><div class="sub">ohne API-Schlüssel · ${s.minutes} Minuten</div></div></div>
  <div class="content">
    <section class="card">
      <h2>1. Prompt kopieren</h2>
      <button class="btn green" id="copy">Prompt kopieren</button>
      <details><summary class="hint">Prompt ansehen</summary><pre class="prompt">${esc(prompt)}</pre></details>
    </section>
    <section class="card">
      <h2>2. Im Chat einfügen</h2>
      <div class="btnrow two">
        <a class="btn ghost" href="https://claude.ai/new?q=${q}" target="_blank" rel="noopener">Claude öffnen</a>
        <a class="btn ghost" href="https://chatgpt.com/?q=${q}" target="_blank" rel="noopener">ChatGPT öffnen</a>
      </div>
    </section>
    <section class="card">
      <h2>3. Antwort einfügen</h2>
      <button class="btn ghost" id="paste">Aus Zwischenablage einfügen</button>
      <label class="field">Antwort einfügen
        <textarea id="answer" placeholder="Die ganze Antwort aus dem Chat hier einfügen …"></textarea>
      </label>
      <div class="modal-err" id="err" aria-live="polite"></div>
    </section>
  </div>
  <div class="bottom"><button class="btn primary big" id="make">Leseblatt erstellen</button></div>
</div>`;

  const ta = root.querySelector<HTMLTextAreaElement>('#answer')!;
  const err = root.querySelector<HTMLElement>('#err')!;

  root.querySelector('#copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Prompt kopiert');
    } catch {
      const t = document.createElement('textarea');
      t.value = prompt;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
      toast('Prompt kopiert');
    }
  });
  root.querySelector('#paste')!.addEventListener('click', async () => {
    try {
      ta.value = await navigator.clipboard.readText();
    } catch {
      toast('Bitte lange ins Feld tippen und „Einfügen“ wählen.');
    }
  });
  root.querySelector('#make')!.addEventListener('click', async () => {
    err.textContent = '';
    try {
      const answer = parseChat(ta.value);
      const p = await genParams();
      const { sheet, removed } = sheetFromChat(answer, p);
      setDraft({ data: sheet, seed: p.seed, removed, savedId: null, scale: 1 });
      go('#/vorschau');
    } catch (e) {
      err.textContent = e instanceof Error ? e.message : PARSE_ERROR;
    }
  });
}
