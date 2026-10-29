# Leseraupe

PWA für Eltern von Kindern, die lesen lernen (Vorschule, Grundschule): erzeugt tägliche A4-Leseblätter nur aus gelernten Buchstaben
(Reihenfolge wie in vielen Fibeln), druckt sie, misst die Lesezeit und führt Verlauf und Protokoll.

**App:** https://lysenkol.github.io/leseraupe/ – in Chrome auf Android öffnen → Menü → „App installieren“.

## Entwicklung

```bash
npm install
npm run dev      # lokaler Server
npm test         # Vitest (inkl. Browser-Tests mit Playwright)
npm run build    # Produktions-Build nach dist/
npm run dict     # Wörterbuch aus src/data/quelle/ neu bauen
```

- Spezifikation: `docs/TZ.md`, Projektregeln: `CLAUDE.md`
- Wörterbuch bearbeiten: `src/data/quelle/*.txt`, danach `npm run dict`
- Deploy: GitHub Actions baut bei Push auf `main` und veröffentlicht auf GitHub Pages
  (Einstellungen → Pages → Source: „GitHub Actions“).
