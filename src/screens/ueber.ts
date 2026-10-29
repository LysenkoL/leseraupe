import { backButton } from '../app/ui';

export const KONTAKT = 'apps.by.lena@gmail.com';
/** Öffentliche Datenschutz-Seite (Google Sites); leer, solange es sie noch nicht gibt */
export const DATENSCHUTZ_URL = '';

export const VERSION_TEXT = `${__VERSION__} (${__BUILD__} UTC)`;

export function feedbackMailto(): string {
  const subject = 'Leseraupe Feedback';
  const body = `\n\n\n---\nVersion: ${VERSION_TEXT}`;
  return `mailto:${KONTAKT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** „Über die App“ (A3) – alles ohne Internet lesbar, nur das Senden der Mail braucht es. */
export function renderUeber(root: HTMLElement): void {
  root.innerHTML = `
<div class="screen">
  <div class="topbar">${backButton('#/einstellungen')}<div class="grow"><h1>Über die App</h1></div></div>
  <div class="content">
    <section class="card">
      <h2>Leseraupe</h2>
      <div>Tägliche Leseblätter für Erstklässler – nur mit den Buchstaben, die das Kind schon gelernt hat. Ausdrucken, lesen, Zeit stoppen.</div>
      <div class="hint">Version ${VERSION_TEXT}</div>
      <a class="btn ghost" href="#/willkommen?zurueck=%23%2Fueber">Einführung ansehen</a>
    </section>
    <section class="card" id="datenschutz">
      <h2>Datenschutz</h2>
      <div>Leseraupe sammelt keine Daten. Es gibt kein Konto, keine Werbung und keine Statistik.</div>
      <div>Buchstaben, Name des Kindes, Leseblätter und Protokoll werden nur auf diesem Gerät gespeichert. Sie werden nicht an uns oder an andere geschickt.</div>
      <div>Eine Sicherung ist eine Datei, die du selbst speicherst und selbst weitergibst.</div>
      <div>„Mit Chat erstellen“ kopiert nur einen Text. Erst wenn du Claude oder ChatGPT selbst öffnest und den Text dort einfügst, gelten die Regeln dieser Anbieter.</div>
      <div>Beim Löschen der App oder der Website-Daten werden alle Daten entfernt.</div>
      ${DATENSCHUTZ_URL ? `<a class="hint" href="${DATENSCHUTZ_URL}" target="_blank" rel="noopener">Datenschutzerklärung im Internet ›</a>` : ''}
    </section>
    <section class="card">
      <h2>Kontakt</h2>
      <div>Fragen, Fehler, Wünsche: <a href="mailto:${KONTAKT}">${KONTAKT}</a></div>
      <a class="btn green" id="feedback" href="${feedbackMailto()}">Feedback senden</a>
    </section>
    <section class="card">
      <h2>Schrift</h2>
      <div class="hint">Inter von Rasmus Andersson, SIL Open Font License 1.1.</div>
    </section>
  </div>
</div>`;
}
