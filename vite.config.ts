import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: '/leseraupe/',
  define: {
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    __VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    VitePWA({
      // Android-App (VITE_TARGET=play): kein Service Worker, kein Manifest – die App kommt aus Google Play
      disable: process.env.VITE_TARGET === 'play',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['fonts/*.woff2', 'icons/*.png'],
      manifest: {
        // eigene id: nicht mit anderen Apps auf lysenkol.github.io verwechseln
        id: '/leseraupe/',
        name: 'Leseraupe',
        short_name: 'Leseraupe',
        description: 'Tägliche Leseblätter für Leseanfänger – nur mit Buchstaben, die das Kind schon kennt.',
        lang: 'de',
        start_url: '/leseraupe/',
        scope: '/leseraupe/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F8F2',
        theme_color: '#F4F8F2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
        navigateFallback: '/leseraupe/index.html',
        navigateFallbackDenylist: [/privacy\.html$/],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
