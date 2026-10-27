# Wörterbuch-Quellen

Die Dateien hier sind die bearbeitbare Quelle des Wörterbuchs. `npm run dict` erzeugt daraus
`src/data/woerterbuch.json` (wird eingecheckt; ein Test prüft, dass beides übereinstimmt).

Format:
- `namen.txt` – ein Name pro Zeile (Kind-/Familiennamen, ohne Artikel)
- `nomen.txt` – `Artikel Wort | Tags`, Artikel: `r` (der), `e` (die), `s` (das), `pl` (die, Plural)
- `verben.txt` – `Infinitiv 3.Person | Tags`
- `adjektive.txt` – `Wort | Tags`
- `kleine.txt` – kleine Wörter, durch Leerzeichen getrennt
- `saetze.txt` – fertige kurze Sätze, einer pro Zeile
- `geschichten.txt` – Mini-Geschichten: `# Titel`, Sätze, `? Frage` für Eltern, Leerzeile trennt

Tags:
- Nomen: `essen`, `trinken`, `im` (Ort mit „im“), `am` (Ort mit „am“), `tier`, `ding`, `person`,
  Themen: `wiese`, `weltraum`, `meer`, `zirkus`, `zauberwald`, `winter`
- Verben: `intr` (Satz „Tim lacht.“), `akk` (mit Objekt: „Tim malt Mia.“ / „Tim malt das Lama.“),
  `essen` („isst Mais“), `trinken` („trinkt Tee“), `tier` (auch für Tiere als Subjekt)
- Adjektive: `p` (für Personen/Tiere: „Oma ist alt.“), `d` (für Dinge: „Das Eis ist kalt.“)
