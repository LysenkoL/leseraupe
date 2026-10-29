import { describe, expect, it, afterEach } from 'vitest';
import de from '../src/i18n/de.json';
import uk from '../src/i18n/uk.json';
import { systemSprache, t, _setSpracheFuerTest } from '../src/app/i18n';
import { protokollText } from '../src/app/protokolltext';
import { renderSheet } from '../src/sheet/render';
import { renderUrkunde } from '../src/sheet/urkunde';
import { SAMPLE_SHEET } from '../src/core/sample';

const platzhalter = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => _setSpracheFuerTest('de'));

describe('B6: Sprache der Oberfläche', () => {
  it('de.json und uk.json haben dieselben Schlüssel, nichts leer, gleiche Platzhalter', () => {
    expect(Object.keys(uk).sort()).toEqual(Object.keys(de).sort());
    for (const [k, v] of Object.entries(de)) {
      const u = (uk as Record<string, string>)[k];
      expect(v.trim(), k).not.toBe('');
      expect(u.trim(), k).not.toBe('');
      expect(platzhalter(u), k).toEqual(platzhalter(v));
    }
    expect(Object.keys(de).length).toBeGreaterThan(150);
  });

  it('Standard: Ukrainisch nur, wenn das Telefon Ukrainisch spricht', () => {
    expect(systemSprache(['uk-UA', 'de-DE'])).toBe('uk');
    expect(systemSprache(['de-DE', 'uk'])).toBe('uk');
    expect(systemSprache(['ru-RU', 'en-US'])).toBe('de');
    expect(systemSprache([])).toBe('de');
  });

  it('t() übersetzt und setzt Werte ein', () => {
    expect(t('start.erstellenN', { n: 3 })).toBe('3 Leseblätter erstellen');
    _setSpracheFuerTest('uk');
    expect(t('start.erstellenN', { n: 3 })).toBe('Створити аркуші: 3');
  });

  it('Protokoll: gespeicherte deutsche Einträge werden angezeigt übersetzt', () => {
    expect(protokollText('Blatt 12 gelesen, 5 Min (von Hand)')).toBe('Blatt 12 gelesen, 5 Min (von Hand)');
    _setSpracheFuerTest('uk');
    expect(protokollText('Blatt 12 gelesen, 5 Min (von Hand)')).toBe('Аркуш 12 прочитано, 5 хв (вручну)');
    expect(protokollText('Buchstabe Sch hinzugefügt')).toBe('Літеру Sch додано');
    expect(protokollText('etwas Unbekanntes')).toBe('etwas Unbekanntes');
  });

  it('Leseblatt und Urkunde bleiben immer deutsch', () => {
    const blatt = renderSheet({ ...SAMPLE_SHEET, silbenFarbig: true }, { displayNumber: 4 });
    const urk = renderUrkunde({ name: 'Mia', nr: 1, datum: '2026-10-10T10:00:00.000Z', gesamt: 10 });
    _setSpracheFuerTest('uk');
    expect(renderSheet({ ...SAMPLE_SHEET, silbenFarbig: true }, { displayNumber: 4 })).toBe(blatt);
    expect(renderUrkunde({ name: 'Mia', nr: 1, datum: '2026-10-10T10:00:00.000Z', gesamt: 10 })).toBe(urk);
  });
});
