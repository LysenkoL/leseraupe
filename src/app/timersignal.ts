/**
 * Timer-Signal auch bei gesperrtem Handy (nur Android-App): beim Start des Timers wird eine lokale
 * Benachrichtigung zum Ende geplant, bei Pause, Zurücksetzen, Verlassen oder Ende wieder abgesagt.
 * Läuft die App sichtbar, kommen Ton und Vibration wie bisher aus der App selbst.
 * Nicht minutengenau erzwungen (ohne SCHEDULE_EXACT_ALARM): Android kann sie selten etwas später zeigen.
 * Die Erlaubnis für Benachrichtigungen wird höchstens einmal gefragt, beim ersten Timer-Start.
 */
import { t } from './i18n';
import { NATIV } from './native';

const ID = 900;
const KANAL = 'timer';
const GEFRAGT = 'leseraupe.timerSignal.gefragt';

/** Aufrufe nacheinander: ein schnelles Pause nach Start darf nicht vor dem Planen ankommen */
let kette: Promise<unknown> = Promise.resolve();
const nacheinander = (f: () => Promise<unknown>) => (kette = kette.then(f).catch(() => undefined));

async function erlaubt(): Promise<boolean> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let stand = (await LocalNotifications.checkPermissions()).display;
  if (stand !== 'granted' && stand !== 'denied') {
    let schonGefragt = false;
    try {
      schonGefragt = localStorage.getItem(GEFRAGT) === '1';
      localStorage.setItem(GEFRAGT, '1');
    } catch {
      /* dann eben jedes Mal fragen – das Android-Fenster selbst kommt nur, solange nicht abgelehnt */
    }
    if (!schonGefragt) stand = (await LocalNotifications.requestPermissions()).display;
  }
  return stand === 'granted';
}

/** Signal in `sekunden` planen (ersetzt ein früheres). */
export function signalPlanen(sekunden: number, aktiv = NATIV): Promise<unknown> {
  if (!aktiv || !(sekunden > 0)) return Promise.resolve();
  // 2 s später als die App selbst: läuft sie sichtbar, sagt sie das Signal vorher ab (kein doppelter Ton)
  const at = new Date(Date.now() + (Math.ceil(sekunden) + 2) * 1000);
  return nacheinander(async () => {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    if (!(await erlaubt())) return;
    await LocalNotifications.createChannel({ id: KANAL, name: t('timer.kanal'), importance: 4, visibility: 1, vibration: true });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID,
          title: t('timer.signalTitel'),
          body: t('timer.signalText'),
          channelId: KANAL,
          smallIcon: 'ic_stat_raupe',
          iconColor: '#2F6B3A',
          // nicht exakt: sonst öffnet das Plugin die Einstellung „Wecker und Erinnerungen“
          isExactNotification: false,
          schedule: { at, allowWhileIdle: true },
        },
      ],
    });
  });
}

/** Geplantes Signal absagen (Pause, Zurücksetzen, Verlassen, Ende in der App). */
export function signalAbsagen(aktiv = NATIV): Promise<unknown> {
  if (!aktiv) return Promise.resolve();
  return nacheinander(async () => {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
  });
}
