import { getSettings, setSettings } from '../app/state';
import { backButton, confirmDialog, esc, toast } from '../app/ui';
import { exportBackup, importBackup, log, parseBackup, useKind } from '../core/db';
import { activeKind, loadProfile, saveProfile } from '../core/store';
import { canInstall, install, isStandalone } from '../app/install';

export function renderEinstellungen(root: HTMLElement): void {
  const s = getSettings();
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/')}<div class="grow"><h1>Einstellungen</h1></div></div>
  <div class="content">
    <section class="card">
      <label class="field">Name des Kindes (steht auf jedem Blatt)
        <input id="name" value="${esc(s.childName)}" autocomplete="off" maxlength="40" />
      </label>
      <button class="btn green" id="save">Speichern</button>
    </section>
    <section class="card">
      <h2>Sicherung</h2>
      <div class="hint">Alle Blätter, das Protokoll und die Einstellungen in einer Datei. Die Datei kann man z. B. in Google Drive ablegen.</div>
      <button class="btn ghost" id="exp">Sicherung speichern</button>
      <label class="btn ghost" for="imp" style="cursor:pointer">Sicherung laden …</label>
      <input type="file" id="imp" accept="application/json,.json" hidden />
    </section>
    ${
      isStandalone()
        ? ''
        : `<section class="card">
      <h2>App aufs Handy</h2>
      ${canInstall() ? '<button class="btn green" id="inst">Leseraupe installieren</button>' : ''}
      <div class="hint">Android, Chrome: am besten diesen Knopf nutzen. Steht im Chrome-Menü ⋮ „bereits installiert“ (kommt vor, wenn unter derselben Adresse mehrere Apps liegen) – dann „Verknüpfung erstellen“ wählen.</div>
    </section>`
    }
    <a class="btn ghost" href="#/ueber">Über die App · Datenschutz · Feedback</a>
  </div>
</div>`;

  root.querySelector('#save')!.addEventListener('click', () => {
    const name = (root.querySelector<HTMLInputElement>('#name')!.value || '').trim();
    setSettings({ ...getSettings(), childName: name });
    toast('Gespeichert');
  });

  root.querySelector('#inst')?.addEventListener('click', async () => {
    if (await install()) toast('Fertig! Leseraupe ist jetzt bei den Apps.');
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
    toast('Sicherung gespeichert');
  });

  root.querySelector<HTMLInputElement>('#imp')!.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      const ok = await confirmDialog(`Sicherung vom ${new Date(b.exportedAt).toLocaleDateString('de-DE')} mit ${b.sheets.length} Blättern laden? Die jetzigen Daten werden ersetzt.`, 'Laden');
      if (!ok) return;
      await importBackup(b);
      saveProfile(b.profile);
      useKind(b.profile.activeKindId);
      setSettings(activeKind(b.profile).settings);
      await log('Sicherung geladen');
      toast('Sicherung geladen');
      renderEinstellungen(root);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Datei konnte nicht gelesen werden.');
    }
  });
}
