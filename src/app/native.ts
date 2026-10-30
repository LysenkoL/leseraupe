/**
 * Android-App (Capacitor): Funktionen, die in der WebView anders gehen als im Browser.
 * Im Browser (GitHub Pages) ist NATIV false und alles bleibt wie bisher.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export const NATIV = Capacitor.isNativePlatform();

/** Eigenes Plugin: android/app/src/main/java/app/leseraupe/DruckPlugin.java */
export interface DruckPlugin {
  pdfDrucken(o: { pdf: string; name: string; seiten: number }): Promise<void>;
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
