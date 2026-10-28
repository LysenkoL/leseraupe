import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/leseraupe/',
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['fonts/*.woff2', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        // eigene id: nicht mit anderen Apps auf lysenkol.github.io verwechseln
        id: '/leseraupe/',
        name: 'Leseraupe',
        short_name: 'Leseraupe',
        description: 'Tägliche Leseblätter für die 1. Klasse – nur mit gelernten Buchstaben.',
        lang: 'de',
        start_url: '/leseraupe/',
        scope: '/leseraupe/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F8F2',
        theme_color: '#2F6B3A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
        navigateFallback: '/leseraupe/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
});
