import { getSettings, setSettings } from '../app/state';
import { getSheet, log, setGefuehl } from '../core/db';
import { esc, go, toast, aktuelleRoute, nochAktuell } from '../app/ui';
import { sheetReadingWords, updateStolper } from '../core/stolper';
import { t } from '../app/i18n';

/** Link zum Schritt „Wo hat dein Kind gestockt?“ nach einer Lesung */
export function stolperLink(sheetId: number, back: string): string {
  return `#/stolper?id=${sheetId}&zurueck=${encodeURIComponent(back)}`;
}

/**
 * Nach dem Lesen (B2, freiwillig): Eltern tippen die Wörter an, bei denen das Kind gestockt hat.
 * „Überspringen“ ändert nichts – auch die Zähler der Stolperwörter nicht.
 */
export async function renderStolper(root: HTMLElement, params: URLSearchParams): Promise<void> {
  const id = Number(params.get('id'));
  const backRaw = params.get('zurueck') ?? '';
  const back = backRaw.startsWith('#/') ? backRaw : '#/';
  const routeNr = aktuelleRoute();
  const rec = id ? await getSheet(id) : undefined;
  if (!nochAktuell(routeNr)) return;
  if (!rec) {
    go(back);
    return;
  }
  const words = sheetReadingWords(rec.data);
  const known = new Set(getSettings().stolper.map((s) => s.w.toLowerCase()));
  const tapped = new Set<string>();

  root.innerHTML = `
<div class="screen">
  <div class="topbar"><div class="grow"><h1>${t('stolper.titel')}</h1><div class="sub">${t('stolper.sub', { nr: rec.number })}</div></div></div>
  <div class="content">
    <section class="card gefuehl">
      <h2>${t('gefuehl.frage')}</h2>
      <div class="seg three">${(['leicht', 'geht', 'schwer'] as const)
        .map((g) => `<button data-g="${g}" aria-pressed="${rec.reads[rec.reads.length - 1]?.gefuehl === g}" class="${rec.reads[rec.reads.length - 1]?.gefuehl === g ? 'on' : ''}">${t(`gefuehl.${g}`)}</button>`)
        .join('')}</div>
      <div class="hint">${t('gefuehl.hinweis')}</div>
    </section>
    <div class="hint">${t('stolper.hinweis')}</div>
    <div class="st-words">${words
      .map((w) => `<button class="st-w${known.has(w.toLowerCase()) ? ' alt' : ''}" data-w="${esc(w)}" aria-pressed="false">${esc(w)}</button>`)
      .join('')}</div>
  </div>
  <div class="bottom">
    <button class="btn primary big" id="st-ok">${t('timer.fertig')}</button>
    <button class="btn ghost" id="st-skip">${t('stolper.ueberspringen')}</button>
  </div>
</div>`;

  const ok = root.querySelector<HTMLButtonElement>('#st-ok')!;
  const label = () => {
    ok.textContent = tapped.size === 0 ? t('stolper.fertig0') : tapped.size === 1 ? t('stolper.fertig1') : t('stolper.fertigN', { n: tapped.size });
  };
  label();
  root.querySelectorAll<HTMLButtonElement>('[data-w]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = b.dataset.w!;
      if (tapped.has(w)) tapped.delete(w);
      else tapped.add(w);
      b.classList.toggle('on', tapped.has(w));
      b.setAttribute('aria-pressed', String(tapped.has(w)));
      label();
    }),
  );

  root.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) =>
    b.addEventListener('click', async () => {
      root.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      await setGefuehl(id, b.dataset.g as 'leicht' | 'geht' | 'schwer');
    }),
  );
  root.querySelector('#st-skip')!.addEventListener('click', () => go(back));
  ok.addEventListener('click', async () => {
    const s = getSettings();
    const r = updateStolper(s.stolper, words, [...tapped]);
    setSettings({ ...s, stolper: r.list });
    if (tapped.size) await log(`Stolperwörter: ${[...tapped].join(', ')}`);
    // nichts verschwindet von selbst – nur ein Hinweis, die Eltern entscheiden
    if (r.bereit.length) toast(t('stolper.bereit', { w: r.bereit.join(', ') }), 5000);
    go(back);
  });
}
