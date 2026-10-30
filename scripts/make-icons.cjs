// Erzeugt alle App-Icons aus assets/icon/figur.png (Raupe + „Mama“-Karte, freigestellt).
// Hintergrund (gelber Verlauf) und Funkeln werden hier gezeichnet, die Figur je nach Form skaliert.
// Aufruf: node scripts/make-icons.cjs   (Ergebnis wird eingecheckt)
//
// Formen:
//  - Play Store (512, Quadrat ohne Rundung – Play rundet selbst)
//  - Web-App „any“ (192/512, abgerundete Kachel mit transparenten Ecken)
//  - Web-App „maskable“ (512): alles Wichtige im Kreis mit 40 % Radius
//  - Android adaptiv (Capacitor, 1024): Vordergrund im Kreis mit 28 % Radius (sichtbar sind 33 %), Hintergrund extra
//  - iPhone (apple-touch-icon 180, Quadrat) und Favicon (48, Kachel)
// Freistellung (einmalig, aus assets/icon/vorlage.webp): gelber Hintergrund per Flutfüllung vom Rand aus
// entfernt – die dunklen Umrisse halten die Füllung auf, die gelbe Perle bleibt.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const bild = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets/icon', f)).toString('base64');
const QUELLE = { figur: bild('figur.png'), hell: bild('figur-hell.png') };

/** art: 'quadrat' | 'kachel' | 'vorder' | 'hinter'; maß: Anteil der Figur (Begrenzungsrahmen) an der Größe oder Kreisradius */
const AUSGABE = [
  ['public/icons/icon-192.png', 192, 'kachel', { rahmen: 0.86 }],
  ['public/icons/icon-512.png', 512, 'kachel', { rahmen: 0.86 }],
  ['public/icons/icon-maskable-512.png', 512, 'quadrat', { kreis: 0.4 }],
  ['public/icons/apple-touch-icon.png', 180, 'quadrat', { rahmen: 0.84 }],
  ['public/icons/favicon-48.png', 48, 'kachel', { rahmen: 0.92 }],
  ['assets/icon/play-store-512.png', 512, 'quadrat', { rahmen: 0.88 }],
  // Figur für helle Bildschirme (Einführung): ohne Lichtstriche, Rand ohne gelben Schimmer (figur-hell.png)
  ['public/icons/figur-400.png', 400, 'vorder', { rahmen: 0.98, quelle: 'hell' }],
  ['assets/icon-only.png', 1024, 'quadrat', { rahmen: 0.88 }],
  ['assets/icon-foreground.png', 1024, 'vorder', { kreis: 0.28 }],
  ['assets/icon-background.png', 1024, 'hinter', {}],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  for (const [datei, size, art, mass] of AUSGABE) {
    const figur = QUELLE[mass.quelle ?? 'figur'];
    const url = await p.evaluate(
      async ({ figur, size, art, mass }) => {
        const img = new Image();
        img.src = figur;
        await img.decode();
        const W = img.width;
        // Begrenzung und weitester Punkt der Figur (Alpha > 50 %)
        const t = document.createElement('canvas');
        t.width = t.height = W;
        const tc = t.getContext('2d');
        tc.drawImage(img, 0, 0);
        const d = tc.getImageData(0, 0, W, W).data;
        let x0 = W, y0 = W, x1 = 0, y1 = 0;
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 127) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        let rmax = 0;
        for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (d[(y * W + x) * 4 + 3] > 127) rmax = Math.max(rmax, Math.hypot(x - mx, y - my));
        const k = mass.kreis ? (mass.kreis * size) / rmax : ((mass.rahmen ?? 0.86) * size) / Math.max(x1 - x0, y1 - y0);

        const c = document.getElementById('c');
        c.width = c.height = size;
        const g = c.getContext('2d');
        g.clearRect(0, 0, size, size);
        if (art === 'kachel') {
          const r = size * 0.22;
          g.beginPath();
          g.roundRect(0, 0, size, size, r);
          g.clip();
        }
        if (art !== 'vorder') {
          // Hintergrund: warmes Gelb, oben heller Schein
          const bg = g.createRadialGradient(size * 0.48, size * 0.22, 0, size * 0.48, size * 0.22, size * 0.95);
          bg.addColorStop(0, '#FFF7B8');
          bg.addColorStop(0.18, '#FFEC7A');
          bg.addColorStop(0.45, '#FFD933');
          bg.addColorStop(0.8, '#FFCD12');
          bg.addColorStop(1, '#FDC40A');
          g.fillStyle = bg;
          g.fillRect(0, 0, size, size);
        }
        if (art === 'hinter') return c.toDataURL('image/png');
        // Figur mittig, mit weichem Schatten
        const cx = size / 2, cy = size / 2 + size * 0.01;
        g.save();
        g.translate(cx, cy);
        g.scale(k, k);
        g.translate(-mx, -my);
        if (art !== 'vorder' && size >= 96) {
          g.shadowColor = 'rgba(180, 110, 0, 0.35)';
          g.shadowBlur = 28;
          g.shadowOffsetY = 18;
        }
        g.drawImage(img, 0, 0);
        g.shadowColor = 'transparent';
        // Funkeln (in Figur-Koordinaten des Originals)
        const funkeln = (x, y, r) => {
          g.beginPath();
          g.moveTo(x, y - r);
          g.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
          g.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
          g.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
          g.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
          g.fillStyle = '#FFFFFF';
          g.fill();
        };
        if (art !== 'vorder' && size >= 96) {
          funkeln(132, 880, 46);
          funkeln(1098, 588, 40);
        }
        g.restore();
        return c.toDataURL('image/png');
      },
      { figur, size, art, mass },
    );
    fs.writeFileSync(path.join(ROOT, datei), Buffer.from(url.split(',')[1], 'base64'));
    console.log(datei, size);
  }
  await b.close();
})();
