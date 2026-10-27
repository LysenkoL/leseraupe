import { describe, expect, it, beforeEach } from 'vitest';
import { loadSettings, saveSettings, toggleLetter, DEFAULT_SETTINGS } from '../src/core/store';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

describe('Einstellungen', () => {
  it('Start: T O M L A I S, neu S, Mia', () => {
    const s = loadSettings();
    expect(s.letters.sort()).toEqual(['a', 'i', 'l', 'm', 'o', 's', 't']);
    expect(s.newLetter).toBe('s');
    expect(s.childName).toBe('Mia');
  });

  it('Buchstaben bleiben nach Neustart erhalten', () => {
    const { settings } = toggleLetter(loadSettings(), 'e');
    saveSettings(settings);
    const again = loadSettings();
    expect(again.letters).toContain('e');
    expect(again.newLetter).toBe('e');
  });

  it('ein Tippen fügt hinzu und markiert als neu', () => {
    const r = toggleLetter(DEFAULT_SETTINGS, 'n');
    expect(r.added).toBe(true);
    expect(r.settings.newLetter).toBe('n');
    expect(r.settings.letters).toContain('s');
  });

  it('neu → gelernt → entfernt', () => {
    let s = toggleLetter(DEFAULT_SETTINGS, 's').settings;
    expect(s.newLetter).toBeNull();
    expect(s.letters).toContain('s');
    s = toggleLetter(s, 's').settings;
    expect(s.letters).not.toContain('s');
  });

  it('kaputte Daten werden repariert', () => {
    localStorage.setItem('leseraupe.settings.v1', '{"letters":["x1","t"],"minutes":7,"theme":"foo"}');
    const s = loadSettings();
    expect(s.letters).toEqual(['t']);
    expect(s.minutes).toBe(5);
    expect(s.theme).toBe('wiese');
  });
});
