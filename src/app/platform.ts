/**
 * Zielplattform des Builds: „web“ (GitHub Pages, PWA) oder „play“ (Android-App aus Google Play).
 * Build für Play: npm run build:play (Android-Projekt: npm run android)
 * In der Play-App gibt es keinen Browser-Installieren-Knopf, keinen Service Worker
 * und keine Hinweise auf Chrome oder Website-Daten.
 */
export const PLAY = import.meta.env.VITE_TARGET === 'play';
