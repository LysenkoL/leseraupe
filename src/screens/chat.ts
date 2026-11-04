import { hatBlock } from '../core/types';
import { getSettings, setDraft } from '../app/state';
import { backButton, esc, go, toast } from '../app/ui';
import { buildPrompt, parseChat, sheetFromChat, PARSE_ERROR } from '../core/chat';
import { analyzeMaterial } from '../core/material';
import type { BlockId } from '../core/types';
import { genParams } from '../app/actions';
import { t } from '../app/i18n';
import { NATIV, SYSTEM_MELDET_KOPIERT, einfuegen, kopieren } from '../app/native';

export function renderChat(root: HTMLElement): void {
  const s = getSettings();
  const prompt = buildPrompt(s.letters, s.newLetter, 5, s.blocks);
  const material = analyzeMaterial(s.letters);
  const storyAttempt = s.blocks.geschichte && (material.available.geschichte || material.available.saetze);
  const fields = (['woerter','saetze'] as BlockId[]).filter(id=>s.blocks[id] && material.available[id]);
  const localOnly = !fields.length && !storyAttempt && s.blocks.silben && material.available.silben;
  const canCreate = !!(localOnly || fields.length || storyAttempt);
  const summary = localOnly ? t('chat.nurLokal') : !canCreate ? t('start.keinMaterial') : '';
  // Nur wenn eine eingefügte Antwort auch benutzt wird; den Prompt kopieren kann man immer
  const braucheAntwort = canCreate && !localOnly;
  const q = encodeURIComponent(prompt);
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1>${t('chat.titel')}</h1></div></div>
  <div class="content">
    ${summary ? `<p class="hint" id="chat-material" role="status">${esc(summary)}</p>` : ''}
    <section class="card">
      <h2>${t('chat.schritt1')}</h2>
      <button class="btn green" id="copy">${t('chat.kopieren')}</button>
      <details><summary class="hint">${t('chat.ansehen')}</summary><pre class="prompt">${esc(prompt)}</pre></details>
    </section>
    ${braucheAntwort ? `
    <section class="card">
      <h2>${t('chat.schritt2')}</h2>
      <div class="btnrow two">
        <a class="btn ghost" href="https://claude.ai/new?q=${q}" target="_blank" data-eltern rel="noopener">${t('chat.claude')}</a>
        <a class="btn ghost" href="https://chatgpt.com/?q=${q}" target="_blank" data-eltern rel="noopener">${t('chat.chatgpt')}</a>
      </div>
    </section>
    <section class="card">
      <h2>${t('chat.schritt3')}</h2>
      <button class="btn ghost" id="paste">${t('chat.ausZwischenablage')}</button>
      <label class="field" aria-label="${t('chat.antwort')}">
        <textarea id="answer" placeholder="${t('chat.platzhalter')}"></textarea>
      </label>
    </section>
    ` : ''}
    <div class="modal-err" id="err" aria-live="polite"></div>
  </div>
  <div class="bottom"><button class="btn primary big" id="make" ${canCreate ? '' : 'disabled'}>${t('chat.erstellen')}</button></div>
</div>`;

  const ta = root.querySelector<HTMLTextAreaElement>('#answer');
  const err = root.querySelector<HTMLElement>('#err')!;

  root.querySelector('#copy')!.addEventListener('click', async () => {
    try {
      if (NATIV) await kopieren(prompt);
      else await navigator.clipboard.writeText(prompt);
      if (!SYSTEM_MELDET_KOPIERT) toast(t('chat.kopiert'));
    } catch {
      const tmp = document.createElement('textarea');
      tmp.value = prompt;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      tmp.remove();
      toast(t('chat.kopiert'));
    }
  });
  root.querySelector('#paste')?.addEventListener('click', async () => {
    try {
      ta!.value = NATIV ? await einfuegen() : await navigator.clipboard.readText();
    } catch {
      toast(t('chat.langTippen'));
    }
  });
  root.querySelector('#make')!.addEventListener('click', async () => {
    err.textContent = '';
    if (!hatBlock(getSettings().blocks)) {
      err.textContent = t('start.keinBlock');
      return;
    }
    try {
      const answer = localOnly ? {woerter:[],kleineWoerter:[],saetze:[],geschichte:{titel:'',saetze:[]},fragen:[]} : parseChat(ta!.value);
      const p = await genParams();
      const { sheet, removed } = sheetFromChat(answer, p);
      setDraft({ data: sheet, seed: p.seed, removed, savedId: null, scale: 1 });
      go('#/vorschau');
    } catch (e) {
      // Meldung in der Sprache der Oberfläche
      if (e instanceof Error && e.message === 'CHAT_EMPTY') { err.textContent = t('chat.keinMaterial'); return; }
      err.textContent = !(e instanceof Error) || e.message === PARSE_ERROR ? t('chat.parseFehler') : e.message;
    }
  });
}
