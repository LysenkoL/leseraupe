/**
 * Die Raupe im Stil des App-Icons (für die Bildschirme, nicht für die gedruckten Themen-Blätter):
 * der Kopf ist das Bild vom Icon, dazu Regenbogen-Perlen mit Glanzlicht und dunklem Umriss.
 */

import KOPF from './raupenkopf.png?inline';
import KOPF_OHNE from './raupenkopf-ohne.png?inline';

export const KONTUR = '#1B2033';
/** Maße des Kopf-Bildes: Größe, Kopfmitte und Kopfradius in Bildpunkten */
const KOPF_BILD = { w: 168, h: 200, mx: 75.7, my: 131.1, r: 72 };
/** derselbe Kopf ohne Fühler – für die Blätter, dort trägt die Raupe Hut, Krone, Helm … */
const KOPF_OHNE_BILD = { w: 173, h: 160, mx: 86.3, my: 79.8, r: 82 };
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

  /**
   * Kopf mit Fühlern – genau der vom App-Icon (aus assets/icon/kopf.png ausgeschnitten, eingebettet,
   * damit er auch im PDF erscheint). (x, y) = Mitte des Kopfes, r = Kopfradius.
   */
  kopf(x: number, y: number, r: number): string {
    const k = r / KOPF_BILD.r;
    return `<image href="${KOPF}" x="${f(x - KOPF_BILD.mx * k)}" y="${f(y - KOPF_BILD.my * k)}" width="${f(KOPF_BILD.w * k)}" height="${f(KOPF_BILD.h * k)}"/>`;
  }

  /** Kopf ohne Fühler (Themen-Blätter mit Kopfbedeckung) */
  kopfOhneFuehler(x: number, y: number, r: number): string {
    const k = r / KOPF_OHNE_BILD.r;
    return `<image href="${KOPF_OHNE}" x="${f(x - KOPF_OHNE_BILD.mx * k)}" y="${f(y - KOPF_OHNE_BILD.my * k)}" width="${f(KOPF_OHNE_BILD.w * k)}" height="${f(KOPF_OHNE_BILD.h * k)}"/>`;
  }

  svg(viewBox: string, inhalt: string, attrs = ''): string {
    return `<svg viewBox="${viewBox}" ${attrs}><defs>${this.defs.join('')}</defs>${inhalt}</svg>`;
  }
}
