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
