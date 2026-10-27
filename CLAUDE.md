# Leseraupe — Projektregeln für Claude

PWA für Eltern von Erstklässlern: erzeugt tägliche A4-Leseblätter nur aus gelernten Buchstaben (Reihenfolge wie in vielen Fibeln), druckt sie, misst die Lesezeit, führt Verlauf und Protokoll.

## Immer zuerst lesen
- `docs/TZ.md` — vollständige Spezifikation (Russisch). Sie ist verbindlich.
- `docs/design/*.html` — Mockups (Leseblätter, Screens, Themen-Kopfzeilen). Nur als Vorlage für Layout und Farben.
- Schrift-Vorbild: Grundschrift, Schreibtabelle der Fibel (keine Dateien im Repo).

## Harte Regeln
1. Auf einem Leseblatt erscheint **kein** Buchstabe und **keine** Buchstabenverbindung, die nicht als gelernt markiert ist (Ausnahme: Name des Kindes, Elternfragen). Immer per Code prüfen, nie dem Wörterbuch oder dem Chat vertrauen.
2. **Keine Silbentrennstriche** in Wörtern und Sätzen.
3. Schrift: lokale Inter-Dateien aus `public/fonts/`, Lesetext immer mit `font-feature-settings: 'cv05' 1, 'cv11' 1`. Nie Inter von Google Fonts.
4. Leseblatt = genau 1 Seite A4, nichts abgeschnitten.
5. Dekorationen (Fische, Pilze, Ballons …) **nie** über Text, Name- oder Datum-Feld — nur in festen Slots außerhalb dieser Zonen; Test dafür.
6. UI komplett auf Deutsch. Keine API-Keys.
7. Alle Daten nur lokal (localStorage / IndexedDB).

## Arbeitsweise
- Mit der Projektinhaberin auf Russisch sprechen, kurz und direkt.
- Zuerst einen Plan in Etappen vorschlagen und auf ihr OK warten, dann Etappe für Etappe bauen.
- Nach jeder Etappe: `npm run build` und `npm test` müssen grün sein; kurz zeigen, was fertig ist.
- Bei Usage-Limits nach dem Reset weitermachen, bis alles fertig ist.
- Commits klein und mit klarer Nachricht.
