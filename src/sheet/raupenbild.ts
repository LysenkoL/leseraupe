/**
 * Die Raupe im Stil des App-Icons (für die Bildschirme, nicht für die gedruckten Themen-Blätter):
 * glänzender grüner Kopf mit großen Augen, Bäckchen, lachendem Mund, Fühler mit rotem und blauem Knopf,
 * Regenbogen-Perlen mit Glanzlicht und dunklem Umriss.
 */

export const KONTUR = '#1B2033';
/** vom Schwanz zum Kopf, wie auf dem Icon (lila … rot) */
export const REGENBOGEN = ['#8338EC', '#5B5BF0', '#3A86FF', '#2EC4F0', '#22C3A6', '#3BC14A', '#A3D93B', '#FFD23F', '#FF9F1C', '#FF4D6D'];

const f = (v: number) => +v.toFixed(1);

function hex(c: string): number[] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}
function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Sammelt Verläufe für ein SVG. Die ID hängt nur an der Farbe: stehen mehrere Raupen auf einer Seite,
 * sind gleiche IDs auch gleiche Verläufe – das stört nicht, und die Ausgabe bleibt immer gleich.
 */
export class RaupenMaler {
  private defs: string[] = [];
  private ids = new Map<string, string>();

  private verlauf(farbe: string): string {
    let id = this.ids.get(farbe);
    if (!id) {
      id = `rp${farbe.slice(1).toLowerCase()}`;
      this.ids.set(farbe, id);
      this.defs.push(
        `<radialGradient id="${id}" cx="0.38" cy="0.32" r="0.78" fx="0.3" fy="0.25"><stop offset="0" stop-color="${mix(farbe, '#ffffff', 0.6)}"/><stop offset="0.45" stop-color="${farbe}"/><stop offset="1" stop-color="${mix(farbe, '#000000', 0.28)}"/></radialGradient>`,
      );
    }
    return id;
  }

  /** glänzende Perle */
  perle(x: number, y: number, r: number, farbe: string, kontur = KONTUR, cls = ''): string {
    return (
      `<circle${cls ? ` class="${cls}"` : ''} cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${this.verlauf(farbe)})" stroke="${kontur}" stroke-width="${f(Math.max(1.5, r * 0.13))}"/>` +
      `<ellipse cx="${f(x - r * 0.32)}" cy="${f(y - r * 0.44)}" rx="${f(r * 0.36)}" ry="${f(r * 0.2)}" fill="#fff" opacity="0.85" transform="rotate(-32 ${f(x - r * 0.32)} ${f(y - r * 0.44)})"/>`
    );
  }

  /** noch leere Perle (gestrichelt) */
  leer(x: number, y: number, r: number, strich = '#9AA8A0', fuell = '#FFFFFF'): string {
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fuell}" stroke="${strich}" stroke-width="${f(Math.max(1.5, r * 0.14))}" stroke-dasharray="${f(r * 0.38)} ${f(r * 0.3)}"/>`;
  }

  /** Kopf mit Fühlern; (x, y) = Mitte des Kopfes */
  kopf(x: number, y: number, r: number, kontur = KONTUR): string {
    const k = r / 100;
    const sw = r * 0.09;
    let s = '';
    for (const [sg, farbe] of [[-1, '#FF4D6D'], [1, '#3A86FF']] as const) {
      s += `<path d="M${f(x + sg * 30 * k)} ${f(y - 80 * k)} C${f(x + sg * 34 * k)} ${f(y - 108 * k)} ${f(x + sg * 44 * k)} ${f(y - 126 * k)} ${f(x + sg * 58 * k)} ${f(y - 142 * k)}" fill="none" stroke="${kontur}" stroke-width="${f(r * 0.14)}" stroke-linecap="round"/>`;
      s += this.perle(x + sg * 62 * k, y - 152 * k, 20 * k, farbe, kontur);
    }
    const gruen = this.verlauf('#7FD437');
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${gruen})" stroke="${kontur}" stroke-width="${f(sw)}"/>`;
    s += `<ellipse cx="${f(x - 36 * k)}" cy="${f(y - 56 * k)}" rx="${f(30 * k)}" ry="${f(14 * k)}" fill="#fff" opacity="0.7" transform="rotate(-25 ${f(x - 36 * k)} ${f(y - 56 * k)})"/>`;
    // Augenbrauen
    s += `<path d="M${f(x - 52 * k)} ${f(y - 42 * k)} Q${f(x - 34 * k)} ${f(y - 56 * k)} ${f(x - 17 * k)} ${f(y - 45 * k)} M${f(x + 17 * k)} ${f(y - 45 * k)} Q${f(x + 34 * k)} ${f(y - 56 * k)} ${f(x + 52 * k)} ${f(y - 42 * k)}" fill="none" stroke="${kontur}" stroke-width="${f(r * 0.06)}" stroke-linecap="round"/>`;
    for (const sg of [-1, 1]) {
      const ex = x + sg * 31 * k;
      const ey = y - 8 * k;
      s += `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(24 * k)}" ry="${f(29 * k)}" fill="#fff" stroke="${kontur}" stroke-width="${f(r * 0.05)}"/>`;
      const px = ex + 5 * k;
      const py = ey + 4 * k;
      s += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(16 * k)}" ry="${f(19.5 * k)}" fill="${KONTUR}"/>`;
      s += `<circle cx="${f(px + 6 * k)}" cy="${f(py - 8 * k)}" r="${f(7 * k)}" fill="#fff"/><circle cx="${f(px - 6 * k)}" cy="${f(py + 8 * k)}" r="${f(3.2 * k)}" fill="#fff"/>`;
    }
    for (const sg of [-1, 1]) s += `<ellipse cx="${f(x + sg * 56 * k)}" cy="${f(y + 26 * k)}" rx="${f(14 * k)}" ry="${f(9 * k)}" fill="#FF6F86" opacity="0.75"/>`;
    // lachender Mund mit Zunge
    s += `<path d="M${f(x - 25 * k)} ${f(y + 22 * k)} Q${f(x)} ${f(y + 31 * k)} ${f(x + 25 * k)} ${f(y + 22 * k)} Q${f(x + 22 * k)} ${f(y + 56 * k)} ${f(x)} ${f(y + 57 * k)} Q${f(x - 22 * k)} ${f(y + 56 * k)} ${f(x - 25 * k)} ${f(y + 22 * k)} Z" fill="#7A1426" stroke="${kontur}" stroke-width="${f(r * 0.05)}" stroke-linejoin="round"/>`;
    s += `<path d="M${f(x - 14 * k)} ${f(y + 50 * k)} Q${f(x)} ${f(y + 40 * k)} ${f(x + 14 * k)} ${f(y + 50 * k)} Q${f(x)} ${f(y + 56 * k)} ${f(x - 14 * k)} ${f(y + 50 * k)} Z" fill="#FF6B81"/>`;
    return s;
  }

  svg(viewBox: string, inhalt: string, attrs = ''): string {
    return `<svg viewBox="${viewBox}" ${attrs}><defs>${this.defs.join('')}</defs>${inhalt}</svg>`;
  }
}
