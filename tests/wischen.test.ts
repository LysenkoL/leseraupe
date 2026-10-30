import { describe, expect, it } from 'vitest';
import { wischRichtung } from '../src/screens/willkommen';

describe('Einführung: Wischen erkennen', () => {
  it('waagerecht nach links → weiter, nach rechts → zurück', () => {
    expect(wischRichtung(-120, 10)).toBe('weiter');
    expect(wischRichtung(120, -10)).toBe('zurueck');
  });
  it('Tipp (kaum Bewegung) und senkrechtes Scrollen zählen nicht', () => {
    expect(wischRichtung(5, 3)).toBeNull();
    expect(wischRichtung(-50, 0)).toBeNull();
    expect(wischRichtung(-80, 200)).toBeNull();
  });
});
