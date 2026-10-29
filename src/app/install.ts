import { PLAY } from './platform';
/**
 * Installation direkt aus der App (beforeinstallprompt).
 * Auf lysenkol.github.io liegen mehrere Apps; Chromes Menü meldet dort oft „bereits installiert“,
 * der direkte Aufruf installiert trotzdem die richtige App (eigene Manifest-id).
 */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function initInstall(): void {
  if (PLAY) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function canInstall(): boolean {
  return !PLAY && !!deferred && !isStandalone();
}

export function onInstallChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export async function install(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const choice = await e.userChoice.catch(() => null);
  listeners.forEach((f) => f());
  return choice?.outcome === 'accepted';
}
