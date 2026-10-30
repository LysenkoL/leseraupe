/**
 * B5: Erinnerung „Lesezeit!“ – lokale Benachrichtigung, nur in der Android-App, ohne Server.
 * Nicht auf die Minute genau (ohne SCHEDULE_EXACT_ALARM): Android darf sie etwas später zeigen.
 * Die Einstellung gehört zum Gerät, nicht zum Kind – darum eigener Schlüssel, nicht in der Sicherung.
 * Nach einem Neustart des Handys plant das Plugin die Erinnerungen selbst neu (BOOT_COMPLETED).
 */
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import { t } from './i18n';
import { NATIV } from './native';

export interface Erinnerung {
  an: boolean;
  /** „HH:MM“ */
  zeit: string;
  /** Wochentage 1 = Montag … 7 = Sonntag */
  tage: number[];
}

export const ERINNERUNG_STANDARD: Erinnerung = { an: false, zeit: '18:00', tage: [1, 2, 3, 4, 5] };
const KEY = 'leseraupe.erinnerung';
const KANAL = 'lesezeit';
/** feste IDs je Wochentag (101 = Montag … 107 = Sonntag) */
const ID_BASIS = 100;

function gueltigeZeit(z: unknown): z is string {
  return typeof z === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(z);
}

export function ladeErinnerung(): Erinnerung {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw) return { ...ERINNERUNG_STANDARD };
    const tage = Array.isArray(raw.tage) ? [...new Set<number>(raw.tage.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7))].sort() : ERINNERUNG_STANDARD.tage;
    return { an: raw.an === true, zeit: gueltigeZeit(raw.zeit) ? raw.zeit : ERINNERUNG_STANDARD.zeit, tage };
  } catch {
    return { ...ERINNERUNG_STANDARD };
  }
}

export function speichereErinnerung(e: Erinnerung): void {
  localStorage.setItem(KEY, JSON.stringify(e));
}

/** Tage + Uhrzeit → Benachrichtigungen: je Wochentag eine, die sich jede Woche wiederholt. Aus → leer. */
export function zeitplan(e: Erinnerung, text: { title: string; body: string }): LocalNotificationSchema[] {
  if (!e.an || !gueltigeZeit(e.zeit)) return [];
  const [hour, minute] = e.zeit.split(':').map(Number);
  return [...new Set(e.tage)]
    .filter((d) => d >= 1 && d <= 7)
    .sort()
    .map((d) => ({
      id: ID_BASIS + d,
      title: text.title,
      body: text.body,
      channelId: KANAL,
      smallIcon: 'ic_stat_raupe',
      iconColor: '#2F6B3A',
      // ohne das öffnet das Plugin die Einstellung „Wecker und Erinnerungen“ – wir wollen bewusst nicht minutengenau
      isExactNotification: false,
      // Android zählt Sonntag = 1, Montag = 2 … Samstag = 7
      schedule: { on: { weekday: (d % 7) + 1, hour, minute }, allowWhileIdle: true },
    }));
}

export type ErinnerungErgebnis = 'an' | 'aus' | 'verweigert';

/**
 * Plant die Erinnerungen neu (alte werden immer zuerst gelöscht).
 * `fragen`: nur beim Einschalten nach der Erlaubnis fragen, beim Start der App nicht.
 */
export async function erinnerungAnwenden(e: Erinnerung, fragen: boolean): Promise<ErinnerungErgebnis> {
  if (!NATIV) return 'aus';
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const offen = await LocalNotifications.getPending();
  if (offen.notifications.length) await LocalNotifications.cancel({ notifications: offen.notifications.map((n) => ({ id: n.id })) });
  const liste = zeitplan(e, { title: t('erinn.titel'), body: t('erinn.text') });
  if (!liste.length) return 'aus';
  let erlaubt = (await LocalNotifications.checkPermissions()).display;
  if (erlaubt !== 'granted' && fragen) erlaubt = (await LocalNotifications.requestPermissions()).display;
  if (erlaubt !== 'granted') return 'verweigert';
  await LocalNotifications.createChannel({ id: KANAL, name: t('erinn.kanal'), importance: 3, visibility: 1 });
  await LocalNotifications.schedule({ notifications: liste });
  return 'an';
}

/** Beim Start der App: gespeicherte Erinnerung wieder einplanen (z. B. nach Sprachwechsel oder Update) */
export function erinnerungBeimStart(): void {
  if (!NATIV) return;
  const e = ladeErinnerung();
  if (e.an) erinnerungAnwenden(e, false).catch(() => undefined);
}
