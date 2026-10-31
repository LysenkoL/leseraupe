import './styles/fonts.css';
import './styles/app.css';
import './styles/sheet.css';
import './styles/print.css';
import { initUpdate } from './app/update';
import { renderStart } from './screens/start';
import { renderVorschau } from './screens/vorschau';
import { renderTimer } from './screens/timer';
import { renderVerlauf } from './screens/verlauf';
import { renderProtokoll } from './screens/protokoll';
import { renderBlatt } from './screens/blatt';
import { renderThema } from './screens/thema';
import { renderEinstellungen } from './screens/einstellungen';
import { renderChat } from './screens/chat';
import { renderWillkommen } from './screens/willkommen';
import { renderUeber } from './screens/ueber';
import { renderLesen } from './screens/lesen';
import { renderStolper } from './screens/stolper';
import { renderUrkundeScreen } from './screens/urkunde';
import { loadProfile } from './core/store';
import { initInstall } from './app/install';
import { neueRoute } from './app/ui';
import { PLAY } from './app/platform';
import { statusleiste } from './app/native';
import { initElternLinks } from './app/elterncheck';
import { sprache } from './app/i18n';
import { erinnerungBeimStart } from './app/erinnerung';

if (!PLAY) initUpdate();

initInstall();
initElternLinks();
erinnerungBeimStart();
document.documentElement.lang = sprache();

const app = document.getElementById('app')!;

function route(): void {
  neueRoute();
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  window.scrollTo(0, 0);
  statusleiste(path === '/timer');
  // Neuinstallation: zuerst die Einführung
  if (path !== '/willkommen' && !loadProfile().onboarded) return renderWillkommen(app);
  const blatt = path.match(/^\/blatt\/(\d+)$/);
  if (blatt) return renderBlatt(app, Number(blatt[1]));
  switch (path) {
    case '/vorschau':
      return renderVorschau(app);
    case '/timer':
      return renderTimer(app, params);
    case '/verlauf':
      return renderVerlauf(app);
    case '/protokoll':
      return renderProtokoll(app);
    case '/thema':
      return renderThema(app);
    case '/einstellungen':
      return renderEinstellungen(app);
    case '/chat':
      return renderChat(app);
    case '/urkunde':
      renderUrkundeScreen(app, params);
      return;
    case '/stolper':
      renderStolper(app, params);
      return;
    case '/lesen':
      renderLesen(app, params);
      return;
    case '/ueber':
      return renderUeber(app);
    case '/willkommen': {
      const back = params.get('zurueck') ?? '';
      return renderWillkommen(app, back.startsWith('#/') ? back : '#/');
    }
    default:
      return renderStart(app);
  }
}

/**
 * Doppel-Tipp-Schutz: Ist der neue Bildschirm noch nicht fertig (langsames Handy), landet ein
 * zweiter Finger-Tipp sonst auf einem Knopf, der gerade erst unter dem Finger erschienen ist.
 * Finger-Tipps kurz nach dem Wechsel und während der Bildschirm noch aufgebaut wird zählen nicht.
 */
let wechsel = -Infinity;
let ruhigAb = 0;
new MutationObserver((records) => {
  const jetzt = performance.now();
  // nur neu eingefügte Elemente zählen – eine laufende Uhr (nur Text) nicht
  const aufbau = records.some((r) => [...r.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE));
  if (aufbau && jetzt - wechsel < 2000) ruhigAb = Math.max(ruhigAb, jetzt + 250);
}).observe(app, { childList: true, subtree: true });
document.addEventListener(
  'click',
  (e) => {
    if ((e as PointerEvent).pointerType === 'touch' && e.timeStamp < ruhigAb) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);
window.addEventListener('hashchange', () => {
  wechsel = performance.now();
  ruhigAb = wechsel + 400;
});
window.addEventListener('hashchange', route);
route();
