import './styles/fonts.css';
import './styles/app.css';
import './styles/sheet.css';
import './styles/print.css';
import { registerSW } from 'virtual:pwa-register';
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
import { loadProfile } from './core/store';
import { initInstall } from './app/install';

// Neue Version wird beim Start mit Internet automatisch geladen:
// beim Öffnen, beim Zurückkehren in die App und stündlich nach Updates sehen.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => {
      if (navigator.onLine) reg.update().catch(() => undefined);
    };
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 60 * 60 * 1000);
  },
});

initInstall();

const app = document.getElementById('app')!;

function route(): void {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  window.scrollTo(0, 0);
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

window.addEventListener('hashchange', route);
route();
