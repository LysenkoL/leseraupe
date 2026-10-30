import { unitById } from '../core/letters';
import { allSheets, dayKey, readingDays, stats, statusOf, streak, type SheetRecord } from '../core/db';
import { backButton, esc, formatDate, aktuelleRoute, nochAktuell } from '../app/ui';
import { THEMES } from '../sheet/themes';
import { getSettings } from '../app/state';
import { raupenstand } from '../sheet/urkunde';
import { raupenKarte } from '../app/raupe';
import { t, themaName } from '../app/i18n';


export function calendarHtml(year: number, month: number, days: Set<string>, today = new Date()): string {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Montag = 0
  const n = new Date(year, month + 1, 0).getDate();
  let cells = '<span></span>'.repeat(offset);
  for (let d = 1; d <= n; d++) {
    const key = dayKey(new Date(year, month, d));
    const read = days.has(key);
    const isToday = key === dayKey(today);
    cells += `<span class="cal-d${read ? ' read' : ''}${isToday ? ' today' : ''}" ${read ? `aria-label="${t('verlauf.gelesen')}"` : ''}>${d}</span>`;
  }
  return `<div class="cal">${t('verlauf.tage').split(',').map((w) => `<span class="cal-w">${w}</span>`).join('')}${cells}</div>`;
}

/** 1 Minute / 2 Minuten (uk: 1 хвилина, 2–4 хвилини, 5+ хвилин) */
function minutenWort(n: number): string {
  const z = n % 10, h = n % 100;
  if (z === 1 && h !== 11) return t('verlauf.minute');
  if (z >= 2 && z <= 4 && (h < 12 || h > 14)) return t('verlauf.minuten2');
  return t('verlauf.minuten');
}

export function renderVerlauf(root: HTMLElement): void {
  const routeNr = aktuelleRoute();
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  let list: SheetRecord[] = [];

  const draw = () => {
    const st = stats(list);
    const days = readingDays(list);
    const monthDays = [...days].filter((d) => d.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).length;
    const items = list
      .map((r) => {
        const s = statusOf(r);
        const th = THEMES[r.data.theme];
        return `<a class="sheet-item" href="#/blatt/${r.id}">
          <span class="si-n" style="background:${th.light};color:${th.main}">${r.number}</span>
          <span class="si-main"><b>${esc(r.data.geschichte?.titel || `${t('vorschau.blatt')} ${r.number}`)}</b>
          <small>${formatDate(r.createdAt)}${r.data.stufe ? ` · ${t('blatt.stufe', { n: r.data.stufe })}` : ''}${r.data.newLetter ? ` · ${t('verlauf.neu', { b: esc(unitById(r.data.newLetter)?.label.replace('-', '') ?? r.data.newLetter) })}` : ''} · ${themaName(r.data.theme)}${r.reads.length ? ` · ${t('verlauf.minGelesen', { n: r.reads.reduce((a, x) => a + x.minutes, 0) })}` : ''}${r.reads.length > 1 ? ` · ${r.reads.length}×` : ''}</small></span>
          <span class="si-st st-${s}">${t(`status.${s}`)}</span></a>`;
      })
      .join('');
    const cfg = getSettings();
    const stand = raupenstand(list);
    const urkunden = stand.fertig.length
      ? `<div class="uk-liste">${stand.fertig.map((f) => `<a class="pillbtn" href="#/urkunde?nr=${f.nr}">${t('verlauf.urkunde', { nr: f.nr })}</a>`).join('')}</div>`
      : '';
    root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1>${t('verlauf.titel')}</h1></div></div>
  <div class="content">
    <div class="tiles">
      <div class="tile"><b>${st.erstellt}</b><small>${t('status.erstellt')}</small></div>
      <div class="tile"><b>${st.gedruckt}</b><small>${t('status.gedruckt')}</small></div>
      <div class="tile${st.gelesen > 0 ? ' on' : ''}"><b>${st.gelesen}</b><small>${t('verlauf.gelesen')}</small></div>
      <div class="tile"><b>${st.minuten}</b><small>${minutenWort(st.minuten)}</small></div>
    </div>
    ${
      cfg.stolper.length || cfg.stolperBesiegt
        ? `<div class="hint" id="st-info">${t('verlauf.stolper', { b: cfg.stolperBesiegt, n: cfg.stolper.length })}</div>`
        : ''
    }
    ${raupenKarte(stand).replace('</section>', `${urkunden}</section>`)}
    <section class="card">
      <div class="row">
        <button class="iconbtn sm" id="prev" aria-label="${t('verlauf.vorigerMonat')}">‹</button>
        <h2>${t('verlauf.monate').split(',')[m]} ${y}</h2>
        <button class="iconbtn sm" id="next" aria-label="${t('verlauf.naechsterMonat')}">›</button>
      </div>
      <div class="hint">${t(monthDays === 1 ? 'verlauf.lesetag' : 'verlauf.lesetage', { n: monthDays, s: streak(days) })}</div>
      ${calendarHtml(y, m, days)}
    </section>
    <h2 class="section-h">${t('verlauf.blaetter')}</h2>
    <div class="list">${items || `<div class="empty">${t('verlauf.leer')}</div>`}</div>
  </div>
  <div class="bottom"><div class="btnrow two"><a class="btn ghost" href="#/protokoll">${t('protokoll.titel')}</a><a class="btn ghost" href="#/einstellungen">${t('verlauf.sicherung')}</a></div></div>
</div>`;
    root.querySelector('#prev')!.addEventListener('click', () => {
      m--;
      if (m < 0) (m = 11), y--;
      draw();
    });
    root.querySelector('#next')!.addEventListener('click', () => {
      m++;
      if (m > 11) (m = 0), y++;
      draw();
    });
  };
  draw();
  allSheets().then((l) => {
    if (!nochAktuell(routeNr)) return;
    list = l;
    draw();
  });
}
