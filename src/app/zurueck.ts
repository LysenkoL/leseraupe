/**
 * Android-Zurück (Taste oder Geste) in der App: MainActivity.java fragt `window.__zurueck()`.
 * true = die App hat es erledigt; false = Android macht das Übliche (App in den Hintergrund).
 *
 * Zurück führt dorthin, wohin auch der Pfeil oben links führt – nicht durch den ganzen Browserverlauf.
 * Offenes Fenster → schließen; Lesen/Timer → wie ✕ (mit der Frage „Lesen beenden?“);
 * Startseite und erster Schritt der Einführung → App verlassen.
 */
export function zurueck(doc: Document = document): boolean {
  const fenster = [...doc.querySelectorAll<HTMLElement>('.modal-bg')].pop();
  if (fenster) {
    const abbrechen = fenster.querySelector<HTMLElement>('[data-x="no"], [data-x="cancel"], [data-x="spaeter"]');
    if (abbrechen) abbrechen.click();
    else fenster.remove();
    return true;
  }
  const pfad = (doc.defaultView?.location.hash ?? '').replace(/^#/, '').split('?')[0] || '/';
  const app = doc.getElementById('app');
  if (!app) return false;
  // Einführung: einen Schritt zurück, im ersten Schritt raus
  if (app.querySelector('.onb')) {
    const vorher = app.querySelector<HTMLElement>('#onb-prev');
    if (vorher) {
      vorher.click();
      return true;
    }
    // aus „Über die App“ wieder geöffnet: dorthin zurück; bei der ersten Einführung: App verlassen
    if (pfad !== '/willkommen') return false;
    const ziel = new URLSearchParams(doc.defaultView!.location.hash.split('?')[1] ?? '').get('zurueck') ?? '';
    doc.defaultView!.location.hash = ziel.startsWith('#/') ? ziel : '#/ueber';
    return true;
  }
  if (pfad === '/') return false;
  // Pfeil, ✕ beim Lesen/Timer oder „Überspringen“ nach dem Lesen
  const knopf = app.querySelector<HTMLElement>('.topbar > a.iconbtn, .topbar > button.iconbtn#rd-close, #st-skip');
  if (knopf) {
    knopf.click();
    return true;
  }
  doc.defaultView!.location.hash = '#/';
  return true;
}
