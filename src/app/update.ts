import { registerSW } from 'virtual:pwa-register';
import { toast } from './ui';
import { t } from './i18n';

/**
 * Neue Versionen schnell holen: beim Öffnen, beim Zurückkehren in die App, bei wieder
 * vorhandenem Internet und alle 10 Minuten. Ist eine neue Version installiert, lädt die
 * App neu und sagt das kurz an. Dazu ein Knopf „Nach Updates suchen“ unter „Über die App“.
 */
const MERKER = 'leseraupe.update.geladen';
let reg: ServiceWorkerRegistration | undefined;

export function initUpdate(): void {
  try {
    if (sessionStorage.getItem(MERKER)) {
      sessionStorage.removeItem(MERKER);
      setTimeout(() => toast(t('update.geladen')), 300);
    }
  } catch {
    /* ohne sessionStorage nur keine Meldung */
  }
  registerSW({
    immediate: true,
    onNeedReload() {
      try {
        sessionStorage.setItem(MERKER, '1');
      } catch {
        /* egal */
      }
      window.location.reload();
    },
    onRegisteredSW(_url, r) {
      reg = r;
      if (!r) return;
      const check = () => {
        if (navigator.onLine) r.update().catch(() => undefined);
      };
      check();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('online', check);
      setInterval(() => document.visibilityState === 'visible' && check(), 10 * 60 * 1000);
    },
  });
}

/** Für den Knopf: sofort nachsehen. „neu“ = wird gerade geladen, die App startet gleich neu. */
export async function pruefeUpdate(): Promise<'neu' | 'aktuell' | 'offline' | 'fehler'> {
  if (!navigator.onLine) return 'offline';
  if (!reg) return 'fehler';
  try {
    await reg.update();
  } catch {
    return 'fehler';
  }
  // wartet eine neue Version (alter Service Worker ohne skipWaiting): anstoßen – die App lädt dann neu
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
  return reg.installing || reg.waiting ? 'neu' : 'aktuell';
}
