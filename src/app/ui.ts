import { esc } from '../core/html';
import { t } from './i18n';

export { esc };

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
}

let toastTimer = 0;
export function toast(msg: string, ms = 2600): void {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), ms);
}

export function go(hash: string): void {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export const BACK_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const GEAR_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

export function backButton(target = '#/'): string {
  return `<a class="iconbtn" href="${target}" aria-label="${t('ui.zurueck')}">${BACK_ICON}</a>`;
}

/** Kleines Dialogfenster mit Textfeld. Liefert den neuen Text oder null (abgebrochen). */
export function editDialog(
  title: string,
  value: string,
  validate: (s: string) => string | null,
): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2>
      <input class="modal-input" value="${esc(value)}" autocomplete="off" autocapitalize="off" spellcheck="false" />
      <div class="modal-err" aria-live="polite"></div>
      <div class="btnrow two">
        <button type="button" class="btn ghost" data-x="cancel">${t('ui.abbrechen')}</button>
        <button type="submit" class="btn green">${t('ui.uebernehmen')}</button>
      </div>
    </form>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector<HTMLInputElement>('.modal-input')!;
    const err = wrap.querySelector<HTMLElement>('.modal-err')!;
    input.focus();
    input.select();
    const close = (v: string | null) => {
      wrap.remove();
      resolve(v);
    };
    wrap.querySelector('[data-x="cancel"]')!.addEventListener('click', () => close(null));
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) close(null);
    });
    wrap.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const msg = validate(v);
      if (msg) err.textContent = msg;
      else close(v);
    });
  });
}

export function confirmDialog(text: string, yes = t('ui.ja'), no = t('ui.abbrechen')): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p>${esc(text)}</p>
      <div class="btnrow two"><button class="btn ghost" data-x="no">${esc(no)}</button><button class="btn green" data-x="yes">${esc(yes)}</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-x="no"]')!.addEventListener('click', () => (wrap.remove(), resolve(false)));
    wrap.querySelector('[data-x="yes"]')!.addEventListener('click', () => (wrap.remove(), resolve(true)));
  });
}

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}
