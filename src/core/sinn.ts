/**
 * Regeln für Sätze aus Vorlagen: richtige Formen (n-Deklination) und sinnvolle Kombinationen.
 * Ein Kind soll nie „Nora sucht den Hase“, „Luna muht“ oder „Das Eis ist sauer“ lesen.
 * Fertige Sätze und Geschichten aus dem Wörterbuch sind von Hand geschrieben und brauchen das nicht.
 */

/** Maskuline Nomen der n-Deklination: Akkusativ (und Dativ) mit -(e)n – „den Hasen“, „den Bären“. */
export const N_DEKLINATION: Record<string, string> = {
  Hase: 'Hasen', Bär: 'Bären', Eisbär: 'Eisbären', Waschbär: 'Waschbären', Rabe: 'Raben', Löwe: 'Löwen',
  Affe: 'Affen', Elefant: 'Elefanten', Drache: 'Drachen', Falke: 'Falken', Spatz: 'Spatzen', Fink: 'Finken',
  Ochse: 'Ochsen', Name: 'Namen', Buchstabe: 'Buchstaben', Planet: 'Planeten', Komet: 'Kometen',
  Satellit: 'Satelliten', Astronaut: 'Astronauten', Junge: 'Jungen', Prinz: 'Prinzen', Riese: 'Riesen',
  Pirat: 'Piraten', Polizist: 'Polizisten', Bauer: 'Bauern', Herr: 'Herrn', Mensch: 'Menschen', Held: 'Helden',
  Nachbar: 'Nachbarn', Kunde: 'Kunden', Bote: 'Boten', Matrose: 'Matrosen', Hirte: 'Hirten',
  Automat: 'Automaten', Diamant: 'Diamanten', Soldat: 'Soldaten', Student: 'Studenten', Kollege: 'Kollegen',
  Gedanke: 'Gedanken', Funke: 'Funken', Same: 'Samen', Wille: 'Willen', Glaube: 'Glauben',
};

/** Verben, die zu Tieren oder Dingen passen, aber nicht zu einem Kind als Subjekt („Luna muht“). */
export const NICHT_FUER_PERSONEN = new Set(
  'bellt miaut quakt muht wiehert brummt nagt kriecht flattert wedelt kratzt frisst landet startet leuchtet blinkt schmeckt knallt hupt bremst parkt rast rührt tippt hängt fällt klebt wacht lebt wohnt schießt fliegt'.split(' '),
);

/** Adjektive, die über ein Kind nicht gesagt werden sollen (Aussehen) oder nicht passen. */
export const NICHT_FUER_PERSONEN_ADJ = new Set(['grau', 'zahm', 'dick', 'dünn']);
/** Adjektive, die zu Tieren nicht passen; grau und zahm nur für die passenden Tiere. */
export const NICHT_FUER_TIERE_ADJ = new Set(['dick', 'dünn', 'sauer', 'fit']);
export const GRAUE_TIERE = new Set(['Maus', 'Elefant', 'Esel', 'Wolf', 'Nashorn', 'Nilpferd', 'Delfin', 'Hai', 'Taube', 'Koala', 'Robbe', 'Elch', 'Mammut', 'Walross']);
/** Haustiere und Tiere vom Hof: „Mia hat den Hamster“, „holt das Huhn“; auch „zahm“ */
export const HAUSTIERE = new Set(['Hund', 'Katze', 'Kater', 'Hamster', 'Kaninchen', 'Maus', 'Fisch', 'Hase', 'Pferd', 'Papagei', 'Küken', 'Huhn', 'Lamm', 'Fohlen', 'Kalb', 'Schaf', 'Ziege', 'Esel', 'Kuh', 'Ente', 'Gans', 'Schwein']);

/** Keine Gegenstände: nie Objekt von „malt / sieht / hat / sucht …“ („Lissi malt das Rennen“, „Oma findet den Zauber“). */
export const ABSTRAKT = new Set(
  `Zeit Woche Jahr Tag Nacht Morgen Abend Mittag Vormittag Nachmittag Hunger Durst Spaß Angst Freude Hilfe Mut Glück
   Traum Idee Frage Antwort Name Zahl Satz Wort Buchstabe Zauber Kälte Hitze Ende Ebbe Flut Masse Rasse Rolle Motto
   Atom Slalom Salto Advent Fahrt Klasse Post Seite Land Note Mine Rennen Sportfest Geburtstag Pause Reise Wanderung
   Sonnenschein Wetter Frost Hagel Donner Wind Sturm Nebel Rauch Erde Galaxie Zeit Laub Heu Teig Masse Klee`.split(/\s+/),
);
/** Körperteile: „Ella malt das Haar“, „Mia mag den Hals“ – lieber nicht. */
export const KOERPER = new Set('Kopf Nase Mund Ohr Auge Haar Hand Arm Bein Fuß Bauch Rücken Zahn Finger Daumen Knie Hals Zunge Po Pfote Flosse Flügel Schwanz Schnabel Fell Stachel'.split(' '));
/** Nur „mag“: Lied, Musik, Fest … mag man, sieht oder hat man aber nicht. */
export const NUR_MAG = new Set('Lied Musik Sport Fest Märchen Geschichte Picknick Winter Sommer Frühling Herbst Regen Spiel'.split(' '));

/** Was ein Kind haben, holen, suchen und finden kann – Spielsachen, Schulsachen, Kleidung, Fundstücke. */
export const TRAGBAR = new Set(
  `Muschel Korb Schlitten Ball Puppe Buch Heft Stift Tafel Mappe Ranzen Schere Kleber Farbe Pinsel Bild Papier Hut Mütze
   Schal Jacke Hose Hemd Rock Kleid Schuh Stiefel Socke Pulli Brille Uhr Tasse Teller Gabel Löffel Topf Kanne Flasche Glas
   Becher Lampe Kissen Decke Schlüssel Kiste Eimer Schaufel Rechen Seil Tasche Koffer Schirm Rad Fahrrad Roller Drachen
   Fahne Trommel Flöte Gitarre Geige Glocke Kerze Geschenk Blatt Blume Rose Tulpe Pilz Stein Stock Ast Perle Krone
   Zauberstab Besen Zauberbuch Ring Kette Netz Angel Telefon Radio Foto Murmel Würfel Karte Brief Maske Schnorchel Helm
   Lasso Atlas Lineal Anorak Laterne Kugel Reifen Kostüm Eichel Tannenzapfen Kastanie Kamm Bürste Seife Handtuch
   Zahnbürste Lupe Münze Geld Sack Tüte Paket Kuscheltier Roboter Schatz Rucksack Kompass Taschenlampe Fernglas
   Badeanzug Badehose Luftmatratze Schwamm Gießkanne Pokal Turnbeutel Lesebuch Schneeball Mehl Salz Einrad Rodel
   Schlittschuh Kürbis Gold Knochen Schild Lesebuch Fliegenpilz Sonnenblume Pusteblume Gänseblümchen Löwenzahn Mohnblume Feder`.split(/\s+/),
);
/** Außerdem findet und sucht man: Nest, Spur, Höhle, Weg … (haben oder holen kann man sie nicht). */
export const FINDBAR = new Set('Nest Spur Höhle Weg Insel Burg Hütte Quelle Pfütze Sandburg'.split(' '));

/** Lebensmittel, die man nicht einfach „isst“ („Bea isst Futter“, „isst Senf“). */
export const NICHT_ESSEN = new Set('Futter Senf Butter Zucker Soße Marmelade Frühstück Mittagessen Abendbrot Mehl Salz Teig'.split(' '));

const SUESS = 'Honig Kuchen Torte Eis Keks Kekse Schokolade Pudding Lolli Melone Erdbeere Kirsche Banane Birne Apfel Waffel Plätzchen Lebkuchen Rosine Pflaume Beere Müsli Obst'.split(' ');
const WARM = 'Suppe Brot Brötchen Kuchen Pudding Omelett Waffel Reis Kartoffel Ei Brezel Kakao Tee Milch'.split(' ');
const FRISCH = 'Brot Brötchen Obst Salat Fisch Ei Gurke Tomate Apfel Birne Möhre Erdbeere Kirsche Brezel Melone Banane Milch'.split(' ');
/** „Der Kuchen ist süß“, „Die Zitrone ist sauer“ – welches Adjektiv zu welchem Essen passt; '*' = zu allem */
export const ESSEN_ADJ: Record<string, Set<string> | '*'> = {
  lecker: '*', toll: '*', super: '*', prima: '*',
  süß: new Set(SUESS),
  sauer: new Set(['Zitrone', 'Apfel', 'Kirsche', 'Gurke']),
  salzig: new Set(['Brezel', 'Suppe', 'Wurst', 'Salami', 'Käse', 'Omelett']),
  kalt: new Set(['Eis', 'Melone', 'Quark', 'Pudding', 'Milch', 'Saft', 'Limo', 'Wasser', 'Sprudel', 'Limonade']),
  warm: new Set(WARM),
  heiß: new Set(['Suppe', 'Kakao', 'Tee', 'Ofen']),
  frisch: new Set(FRISCH),
};

export function essenAdjOk(adj: string, essen: string): boolean {
  const s = ESSEN_ADJ[adj];
  return s === '*' || (!!s && s.has(essen));
}

export type ObjektVerb = 'malt' | 'sieht' | 'sucht' | 'findet' | 'mag' | 'hat' | 'holt';

/** Passt das Nomen als Objekt zu diesem Verb? */
export function objektOk(verb: string, wort: string, istTier: boolean): boolean {
  if (KOERPER.has(wort) || ABSTRAKT.has(wort)) return false;
  if (istTier) return verb === 'hat' || verb === 'holt' ? HAUSTIERE.has(wort) : true;
  switch (verb) {
    case 'mag':
      return true;
    case 'malt':
    case 'sieht':
      return !NUR_MAG.has(wort);
    case 'sucht':
    case 'findet':
      return TRAGBAR.has(wort) || FINDBAR.has(wort);
    case 'hat':
    case 'holt':
      return TRAGBAR.has(wort);
    default:
      return false;
  }
}

export function personAdjOk(adj: string): boolean {
  return !NICHT_FUER_PERSONEN_ADJ.has(adj);
}

export function tierAdjOk(adj: string, tier: string): boolean {
  if (NICHT_FUER_TIERE_ADJ.has(adj)) return false;
  if (adj === 'grau') return GRAUE_TIERE.has(tier);
  if (adj === 'zahm') return HAUSTIERE.has(tier);
  return true;
}
