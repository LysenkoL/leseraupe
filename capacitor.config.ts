import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android-App für Google Play. Die Web-App (VITE_TARGET=play) liegt komplett in der App,
 * ohne Internet. Bauen: npm run android
 * appId nie ändern – Google Play erkennt die App daran.
 */
const config: CapacitorConfig = {
  appId: 'app.leseraupe',
  appName: 'Leseraupe',
  webDir: 'dist',
};

export default config;
