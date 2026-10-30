/**
 * Android-App (Capacitor): Funktionen, die in der WebView anders gehen als im Browser.
 * Im Browser (GitHub Pages) ist NATIV false und alles bleibt wie bisher.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export const NATIV = Capacitor.isNativePlatform();

/** Android-Version aus der WebView (dort steht die echte, z. B. „Android 17“); 0 = unbekannt */
export function androidVersion(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): number {
  return Number(ua.match(/Android (\d+)/)?.[1] ?? 0);
}

/** Ab Android 13 meldet das System selbst „Kopiert“ – dann keine zweite Meldung der App */
export const SYSTEM_MELDET_KOPIERT = NATIV && androidVersion() >= 13;

/** Eigenes Plugin: android/app/src/main/java/app/leseraupe/DruckPlugin.java */
export interface DruckPlugin {
  /** Seite der WebView (#print-root, print.css) über das Druckmenü drucken */
  seiteDrucken(o: { name: string }): Promise<void>;
  /** dieselbe Seite als A4-PDF, Base64 */
  seiteAlsPdf(o: { name: string }): Promise<{ pdf: string }>;
}
export const Druck = registerPlugin<DruckPlugin>('Druck');

/**
 * Datei über das Teilen-Menü von Android weitergeben (Drive, WhatsApp, Mail, „In Dateien speichern“ …).
 * Die Datei wird dafür im Cache der App abgelegt.
 */
export async function teileNativ(file: File, base64: string): Promise<'geteilt' | 'abgebrochen'> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const { uri } = await Filesystem.writeFile({ path: file.name, data: base64, directory: Directory.Cache });
  try {
    await Share.share({ title: file.name.replace(/\.\w+$/, ''), files: [uri] });
    return 'geteilt';
  } catch (e) {
    // Teilen-Menü ohne Auswahl geschlossen
    if (/cancel/i.test((e as Error).message ?? '')) return 'abgebrochen';
    throw e;
  }
}

let wachZaehler = 0;
/**
 * Bildschirm bleibt an (Lesen am Bildschirm, Timer). In der WebView gibt es kein navigator.wakeLock.
 * Mehrere Stellen können gleichzeitig wach halten (Lesen + Timer): erst wenn alle freigeben, darf er aus.
 * Gibt die Freigabe-Funktion zurück.
 */
export function wachHalten(): () => void {
  if (wachZaehler++ === 0) import('@capacitor-community/keep-awake').then(({ KeepAwake }) => KeepAwake.keepAwake()).catch(() => undefined);
  let frei = false;
  return () => {
    if (frei) return;
    frei = true;
    if (--wachZaehler === 0) import('@capacitor-community/keep-awake').then(({ KeepAwake }) => KeepAwake.allowSleep()).catch(() => undefined);
  };
}

/** Timer fertig: Vibration über Haptics (navigator.vibrate geht in der App nicht zuverlässig). */
export async function vibrieren(): Promise<void> {
  const { Haptics } = await import('@capacitor/haptics');
  for (const ms of [300, 300, 500]) {
    await Haptics.vibrate({ duration: ms });
    await new Promise((r) => setTimeout(r, ms + 150));
  }
}

/** Zwischenablage über Capacitor (Einfügen geht in der WebView sonst nicht). */
export async function kopieren(text: string): Promise<void> {
  const { Clipboard } = await import('@capacitor/clipboard');
  await Clipboard.write({ string: text });
}
export async function einfuegen(): Promise<string> {
  const { Clipboard } = await import('@capacitor/clipboard');
  return (await Clipboard.read()).value;
}
