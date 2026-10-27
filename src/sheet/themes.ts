export type ThemeId = 'wiese' | 'weltraum' | 'meer' | 'zirkus' | 'zauberwald' | 'winter';

export const THEME_IDS: ThemeId[] = ['wiese', 'weltraum', 'meer', 'zirkus', 'zauberwald', 'winter'];

export interface Theme {
  id: ThemeId;
  name: string;
  /** Hauptfarbe: Überschriften, Nummernkreise */
  main: string;
  /** heller Hintergrund (Buchstabenkreise, Geschichte) */
  light: string;
  /** Rahmenfarbe der Blöcke */
  border: string;
  /** Raupensegmente: hell / mittel */
  seg: [string, string];
  /** Kostüm der Raupe (SVG im Raupen-Koordinatensystem 0..210 × -10..90) */
  costume: string;
  /** Deko im Kopf-Slot (SVG, viewBox 0 0 100 100) – drei Stück */
  headDeco: string[];
  /** Deko im Fuß-Slot (SVG, viewBox 0 0 100 100) */
  footDeco: string;
  /** Band zwischen Kopf und Blöcken (SVG, viewBox 0 0 720 24, preserveAspectRatio none) */
  strip: string;
}

const star = (fill: string) =>
  `<polygon points="50,8 61,37 92,39 68,58 76,89 50,72 24,89 32,58 8,39 39,37" fill="${fill}"/>`;
const flower = (petal: string) =>
  `<circle cx="50" cy="28" r="20" fill="${petal}"/><circle cx="72" cy="50" r="20" fill="${petal}"/><circle cx="50" cy="72" r="20" fill="${petal}"/><circle cx="28" cy="50" r="20" fill="${petal}"/><circle cx="50" cy="50" r="15" fill="#F2C94C"/>`;
const fish = (fill: string, flip = false) =>
  `<g transform="translate(50 50) scale(${flip ? -3 : 3} 3)"><ellipse cx="-3" cy="0" rx="11" ry="7" fill="${fill}"/><path d="M7 0 L16 -7 L16 7 Z" fill="${fill}"/><circle cx="-9" cy="-2" r="1.6" fill="#1F2421"/></g>`;
const snowflake = (stroke: string) =>
  `<g stroke="${stroke}" stroke-width="7" stroke-linecap="round"><path d="M14 50 L86 50"/><path d="M32 19 L68 81"/><path d="M68 19 L32 81"/></g>`;
const mushroom = `<rect x="40" y="52" width="20" height="34" rx="7" fill="#F7EBDD"/><path d="M12 58 Q50 4 88 58 Z" fill="#D9534F"/><circle cx="36" cy="40" r="6" fill="#FFF"/><circle cx="60" cy="34" r="5" fill="#FFF"/><circle cx="70" cy="48" r="4" fill="#FFF"/>`;
const balloon = (fill: string) =>
  `<ellipse cx="50" cy="36" rx="24" ry="30" fill="${fill}"/><path d="M46 66 L54 66 L50 72 Z" fill="${fill}"/><path d="M50 72 q-10 12 2 26" fill="none" stroke="#9AA59E" stroke-width="2.5"/>`;
const butterfly = `<path d="M50 50 C30 15 5 25 15 50 C5 75 30 85 50 50 C70 85 95 75 85 50 C95 25 70 15 50 50Z" fill="#F2A65A" opacity="0.9"/><rect x="47" y="34" width="6" height="32" rx="3" fill="#7A4A1A"/>`;
const planet = `<circle cx="50" cy="50" r="24" fill="#E8896A"/><ellipse cx="50" cy="50" rx="44" ry="11" fill="none" stroke="#C25E3F" stroke-width="5"/>`;
const rocket = `<g transform="translate(50 50) rotate(35) scale(2.6)"><path d="M0 -16 Q8 -6 6 10 L-6 10 Q-8 -6 0 -16Z" fill="#FFFFFF" stroke="#2B3A67" stroke-width="2"/><circle cx="0" cy="-2" r="3" fill="#8FA4E8"/><path d="M-3 12 L0 20 L3 12" fill="#F2A65A"/></g>`;
const bubbles = `<circle cx="30" cy="70" r="14" fill="none" stroke="#8FCDE6" stroke-width="5"/><circle cx="62" cy="40" r="10" fill="none" stroke="#8FCDE6" stroke-width="5"/><circle cx="78" cy="14" r="7" fill="none" stroke="#8FCDE6" stroke-width="4"/>`;
const tree = `<path d="M50 4 L74 46 L62 46 L84 82 L16 82 L38 46 L26 46 Z" fill="#7FC06D"/><rect x="44" y="82" width="12" height="14" fill="#8B5E3C"/>`;
const flag = `<path d="M20 10 L20 92" stroke="#9AA59E" stroke-width="5"/><path d="M22 12 L82 28 L22 46 Z" fill="#D9534F"/>`;

const wave = (stroke: string, step: number) => {
  let d = `M0 14`;
  for (let x = 0; x < 720; x += step * 2) d += ` Q${x + step / 2} ${4} ${x + step} 14 T${x + step * 2} 14`;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="3"/>`;
};
const row = (n: number, item: (x: number, i: number) => string) =>
  Array.from({ length: n }, (_, i) => item(((i + 0.5) * 720) / n, i)).join('');

export const THEMES: Record<ThemeId, Theme> = {
  wiese: {
    id: 'wiese',
    name: 'Wiese',
    main: '#2F6B3A',
    light: '#E9F3E6',
    border: '#CFE3C8',
    seg: ['#BFE0B5', '#9FD18F'],
    costume: `<g><circle cx="166" cy="-1" r="6" fill="#E8896A"/><circle cx="173" cy="6" r="6" fill="#E8896A"/><circle cx="166" cy="13" r="6" fill="#E8896A"/><circle cx="159" cy="6" r="6" fill="#E8896A"/><circle cx="166" cy="6" r="4.5" fill="#F2C94C"/></g>`,
    headDeco: [flower('#F6B8C8'), butterfly, flower('#B9A4E8')],
    footDeco: flower('#F6B8C8'),
    strip:
      wave('#9FD18F', 20) +
      row(12, (x) => `<path d="M${x - 4} 22 L${x - 2} 10 M${x} 22 L${x} 7 M${x + 4} 22 L${x + 3} 11" stroke="#7FC06D" stroke-width="2" stroke-linecap="round"/>`),
  },
  weltraum: {
    id: 'weltraum',
    name: 'Weltraum',
    main: '#2B3A67',
    light: '#E6EAF8',
    border: '#C9D3F5',
    seg: ['#C9D3F5', '#A9B8EE'],
    costume: `<path d="M138 30 A28 28 0 0 1 194 30" fill="#DCE6F7" stroke="#2B3A67" stroke-width="3"/><circle cx="166" cy="2" r="4" fill="#E8896A"/><path d="M166 6 L166 12" stroke="#2B3A67" stroke-width="2.5"/>`,
    headDeco: [star('#F2C94C'), planet, rocket],
    footDeco: star('#F2C94C'),
    strip: row(18, (x, i) => `<polygon transform="translate(${x} 12) scale(${i % 2 ? 0.09 : 0.13}) translate(-50 -50)" points="50,8 61,37 92,39 68,58 76,89 50,72 24,89 32,58 8,39 39,37" fill="${i % 3 ? '#8FA4E8' : '#F2C94C'}"/>`),
  },
  meer: {
    id: 'meer',
    name: 'Meer',
    main: '#1D5E80',
    light: '#E3F2FA',
    border: '#BDE3F2',
    seg: ['#BDE3F2', '#8FCDE6'],
    costume: `<rect x="150" y="26" width="32" height="14" rx="7" fill="#BDE3F2" stroke="#1D5E80" stroke-width="2.5"/><path d="M184 32 L192 32 L192 4" fill="none" stroke="#E8896A" stroke-width="4" stroke-linecap="round"/>`,
    headDeco: [fish('#F2A65A'), bubbles, fish('#8FCDE6', true)],
    footDeco: fish('#E8896A', true),
    strip: wave('#5FB3D6', 16),
  },
  zirkus: {
    id: 'zirkus',
    name: 'Zirkus',
    main: '#9C2B45',
    light: '#FCE8EC',
    border: '#F7C9D3',
    seg: ['#F7C9D3', '#F2C94C'],
    costume: `<rect x="150" y="-6" width="32" height="24" fill="#1F2421"/><rect x="142" y="16" width="48" height="6" rx="3" fill="#1F2421"/><rect x="150" y="10" width="32" height="5" fill="#D9534F"/>`,
    headDeco: [balloon('#D9534F'), flag, balloon('#5FB3D6')],
    footDeco: balloon('#F2C94C'),
    strip:
      `<path d="M0 3 Q180 12 360 3 T720 3" fill="none" stroke="#9AA59E" stroke-width="1.5"/>` +
      row(20, (x, i) => `<path d="M${x - 6} ${5 + (i % 2) * 2} l6 13 l6 -13Z" fill="${['#D9534F', '#F2C94C', '#5FB3D6', '#7FC06D'][i % 4]}"/>`),
  },
  zauberwald: {
    id: 'zauberwald',
    name: 'Zauberwald',
    main: '#5B3A8C',
    light: '#EFE8F8',
    border: '#D9CCF0',
    seg: ['#D9CCF0', '#B9A4E8'],
    costume: `<path d="M146 22 L148 2 L157 12 L166 -2 L175 12 L184 2 L186 22 Z" fill="#F2C94C" stroke="#B8860B" stroke-width="2"/>`,
    headDeco: [mushroom, star('#B9A4E8'), star('#F2C94C')],
    footDeco: mushroom,
    strip: row(14, (x, i) =>
      i % 2
        ? `<polygon transform="translate(${x} 12) scale(0.1) translate(-50 -50)" points="50,8 61,37 92,39 68,58 76,89 50,72 24,89 32,58 8,39 39,37" fill="${i % 4 === 1 ? '#F2C94C' : '#B9A4E8'}"/>`
        : `<g transform="translate(${x - 9} 1) scale(0.2)">${mushroom}</g>`,
    ),
  },
  winter: {
    id: 'winter',
    name: 'Winter',
    main: '#2E5E8C',
    light: '#EAF2FA',
    border: '#DDE9F5',
    seg: ['#DDE9F5', '#B8D2EC'],
    costume: `<path d="M144 26 Q166 -4 188 26 Z" fill="#D9534F"/><rect x="142" y="22" width="48" height="8" rx="4" fill="#FFFFFF" stroke="#D9534F" stroke-width="2"/><circle cx="166" cy="0" r="6" fill="#FFFFFF" stroke="#D9534F" stroke-width="2"/>`,
    headDeco: [snowflake('#8FB8DE'), tree, snowflake('#B8D2EC')],
    footDeco: snowflake('#8FB8DE'),
    strip: row(16, (x, i) => `<g transform="translate(${x - 9} 3) scale(0.18)">${snowflake(i % 2 ? '#B8D2EC' : '#8FB8DE')}</g>`),
  },
};

/** Raupe mit Kostüm, Segmentfarben aus dem Thema. */
export function raupeSvg(theme: Theme, cls = ''): string {
  const [a, b] = theme.seg;
  const s = theme.main;
  return `<svg class="${cls}" viewBox="0 -10 210 100" aria-hidden="true">
<circle cx="22" cy="62" r="18" fill="${a}" stroke="${s}" stroke-width="2.5"/>
<circle cx="54" cy="56" r="20" fill="${b}" stroke="${s}" stroke-width="2.5"/>
<circle cx="90" cy="62" r="20" fill="${a}" stroke="${s}" stroke-width="2.5"/>
<circle cx="126" cy="56" r="20" fill="${b}" stroke="${s}" stroke-width="2.5"/>
<circle cx="166" cy="50" r="26" fill="#7FC06D" stroke="#2F6B3A" stroke-width="2.5"/>
<circle cx="158" cy="46" r="4" fill="#1F2421"/><circle cx="176" cy="46" r="4" fill="#1F2421"/>
<path d="M156 60 Q166 68 178 60" fill="none" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/>
${theme.costume}</svg>`;
}

/** Raupe nur als Umriss (für das Quest „Male!“). */
export function raupeOutlineSvg(theme: Theme): string {
  const s = '#1F2421';
  return `<svg class="quest-male" viewBox="0 -10 210 100" aria-hidden="true">
<g fill="#FFFFFF" stroke="${s}" stroke-width="2">
<circle cx="22" cy="62" r="18"/><circle cx="54" cy="56" r="20"/><circle cx="90" cy="62" r="20"/><circle cx="126" cy="56" r="20"/><circle cx="166" cy="50" r="26"/>
</g>
<circle cx="158" cy="46" r="3.5" fill="${s}"/><circle cx="176" cy="46" r="3.5" fill="${s}"/>
<path d="M156 60 Q166 68 178 60" fill="none" stroke="${s}" stroke-width="2" stroke-linecap="round"/>
<g fill="#FFFFFF" stroke="${s}" stroke-width="2">${theme.costume.replace(/fill="[^"]*"/g, 'fill="#FFFFFF"').replace(/stroke="[^"]*"/g, `stroke="${s}"`)}</g>
</svg>`;
}

export function decoSvg(inner: string): string {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
}
