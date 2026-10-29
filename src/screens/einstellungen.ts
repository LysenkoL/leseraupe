import { STOLPER_FREI } from '../core/stolper';
import { getSettings, setSettings } from '../app/state';
import { backButton, confirmDialog, esc, toast } from '../app/ui';
import { exportBackup, importBackup, log, parseBackup, useKind } from '../core/db';
import { activeKind, loadProfile, saveProfile } from '../core/store';
import { canInstall, install, isStandalone } from '../app/install';
import { PLAY } from '../app/platform';
import { setSprache, t } from '../app/i18n';

export function renderEinstellungen(root: HTMLElement): void {
  const s = getSettings();
  const spracheGewaehlt = loadProfile().sprache;
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1>${t('einst.titel')}</h1></div></div>
  <div class="content">
    <section class="card">
      <label class="field">${t('einst.name')}
        <input id="name" value="${esc(s.childName)}" autocomplete="off" maxlength="40" />
      </label>
      <div class="hint saved-hint" id="name-saved" aria-live="polite"></div>
    </section>
    <section class="card">
      <label class="field">${t('einst.sprache')}
        <select id="sprache">
          <option value="" ${spracheGewaehlt === null ? 'selected' : ''}>${t('einst.spracheAuto')}</option>
          <option value="de" ${spracheGewaehlt === 'de' ? 'selected' : ''}>${t('sprache.de')}</option>
          <option value="uk" ${spracheGewaehlt === 'uk' ? 'selected' : ''}>${t('sprache.uk')}</option>
        </select>
      </label>
      <div class="hint">${t('einst.spracheHinweis')}</div>
    </section>
    <section class="card" id="stolper">
      <div class="row"><h2>${t('einst.stolper')}</h2><span class="hint">${t('einst.besiegt', { n: s.stolperBesiegt })}</span></div>
      ${
        s.stolper.length
          ? `<div class="st-list">${s.stolper
              .map(
                (x, i) =>
                  `<div class="st-row${x.ok >= STOLPER_FREI ? ' bereit' : ''}"><b>${esc(x.w)}</b><small>${t('einst.fluessig', { n: x.ok })}${
                    x.ok >= STOLPER_FREI ? ` · ${t('einst.bereit')}` : ''
                  }</small><button class="pillbtn" data-st-kann="${i}">${t('einst.kannEs')}</button><button class="pillbtn" data-st-del="${i}" aria-label="${t('einst.entfernen')}">✕</button></div>`,
              )
              .join('')}</div>
      <button class="btn ghost" id="st-all">${t('einst.alleLoeschen')}</button>`
          : `<div class="hint">${t('einst.stolperLeer')}</div>`
      }
      <div class="hint">${t('einst.stolperHinweis')}</div>
    </section>
    <section class="card">
      <h2>${t('einst.sicherung')}</h2>
      <div class="hint">${t('einst.sicherungHinweis')}</div>
      <button class="btn ghost" id="exp">${t('einst.sicherungSpeichern')}</button>
      <label class="btn ghost" for="imp" style="cursor:pointer">${t('einst.sicherungLaden')}</label>
      <input type="file" id="imp" accept="application/json,.json" hidden />
    </section>
    ${
      PLAY || isStandalone()
        ? ''
        : `<section class="card">
      <h2>${t('start.appAufsHandy')}</h2>
      ${canInstall() ? `<button class="btn green" id="inst">${t('start.installieren')}</button>` : ''}
      <div class="hint">${t('einst.installHinweis')}</div>
    </section>`
    }
    <a class="btn ghost" href="#/ueber">${t('einst.ueber')}</a>
  </div>
</div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-st-kann]').forEach((b) =>
    b.addEventListener('click', async () => {
      const cur = getSettings();
      const i = Number(b.dataset.stKann);
      const w = cur.stolper[i]?.w;
      if (!w) return;
      setSettings({ ...cur, stolper: cur.stolper.filter((_, j) => j !== i), stolperBesiegt: cur.stolperBesiegt + 1 });
      await log(`Besiegt: ${w}`);
      toast(t('stolper.besiegt', { w }));
      renderEinstellungen(root);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-st-del]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = getSettings();
      setSettings({ ...cur, stolper: cur.stolper.filter((_, i) => i !== Number(b.dataset.stDel)) });
      renderEinstellungen(root);
    }),
  );
  root.querySelector('#st-all')?.addEventListener('click', async () => {
    if (!(await confirmDialog(t('einst.stolperFrage'), t('einst.loeschen')))) return;
    setSettings({ ...getSettings(), stolper: [] });
    renderEinstellungen(root);
  });

  root.querySelector<HTMLSelectElement>('#sprache')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    setSprache(v === 'de' || v === 'uk' ? v : null);
    renderEinstellungen(root);
  });

  // Name wird beim Tippen gespeichert (kurz verzögert) und beim Verlassen des Feldes
  const nameInput = root.querySelector<HTMLInputElement>('#name')!;
  const savedHint = root.querySelector<HTMLElement>('#name-saved')!;
  let nameTimer = 0;
  const saveName = () => {
    clearTimeout(nameTimer);
    const name = nameInput.value.trim();
    if (name === getSettings().childName) return;
    setSettings({ ...getSettings(), childName: name });
    savedHint.textContent = `${t('einst.gespeichert')} ✓`;
  };
  nameInput.addEventListener('input', () => {
    savedHint.textContent = '';
    clearTimeout(nameTimer);
    nameTimer = window.setTimeout(saveName, 500);
  });
  nameInput.addEventListener('blur', saveName);
  window.addEventListener('hashchange', saveName, { once: true });

  root.querySelector('#inst')?.addEventListener('click', async () => {
    if (await install()) toast(t('start.installiert'));
    renderEinstellungen(root);
  });

  root.querySelector('#exp')!.addEventListener('click', async () => {
    const b = await exportBackup(loadProfile());
    const blob = new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leseraupe-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(t('einst.sicherungGespeichert'));
  });

  root.querySelector<HTMLInputElement>('#imp')!.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      const ok = await confirmDialog(t('einst.sicherungFrage', { datum: new Date(b.exportedAt).toLocaleDateString('de-DE'), n: b.sheets.length }), t('einst.laden'));
      if (!ok) return;
      await importBackup(b);
      saveProfile(b.profile);
      useKind(b.profile.activeKindId);
      setSettings(activeKind(b.profile).settings);
      await log('Sicherung geladen');
      toast(b.uebersprungen ? t('einst.sicherungTeilweise', { n: b.sheets.length, s: b.uebersprungen }) : t('einst.sicherungGeladen'));
      renderEinstellungen(root);
    } catch (err) {
      toast(t('einst.dateiFehler'));
    }
  });
}
