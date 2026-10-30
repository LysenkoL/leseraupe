export type ThemeId =
  | 'wiese' | 'weltraum' | 'meer' | 'zirkus' | 'zauberwald'
  | 'fruehling' | 'sommer' | 'herbst' | 'winter'
  | 'piraten' | 'burg' | 'bauernhof';

/** Alle Themen, die ein Blatt haben kann (auch die vier Jahreszeiten) */
export const THEME_IDS: ThemeId[] = ['wiese', 'weltraum', 'meer', 'zirkus', 'zauberwald', 'fruehling', 'sommer', 'herbst', 'winter', 'piraten', 'burg', 'bauernhof'];

/** „Jahreszeit“: wird beim Erstellen zur aktuellen Jahreszeit */
export type ThemeWahl = ThemeId | 'jahreszeit';
/** Was man auswählen kann – die Jahreszeiten nur zusammen */
export const THEME_WAHL: ThemeWahl[] = ['wiese', 'weltraum', 'meer', 'zirkus', 'zauberwald', 'jahreszeit', 'piraten', 'burg', 'bauernhof'];

export function jahreszeit(d = new Date()): ThemeId {
  const m = d.getMonth(); // 0 = Januar
  if (m >= 2 && m <= 4) return 'fruehling';
  if (m >= 5 && m <= 7) return 'sommer';
  if (m >= 8 && m <= 10) return 'herbst';
  return 'winter';
}

export function themeAus(w: ThemeWahl, d = new Date()): ThemeId {
  return w === 'jahreszeit' ? jahreszeit(d) : w;
}

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

const tulip = (fill: string) =>
  `<path d="M50 54 L50 94" stroke="#5E9B4E" stroke-width="5"/><path d="M50 80 Q30 66 28 52 Q44 60 50 74Z" fill="#7FC06D"/><path d="M30 20 L38 34 L50 18 L62 34 L70 20 Q74 50 50 58 Q26 50 30 20Z" fill="${fill}"/>`;
const ladybug = `<circle cx="50" cy="56" r="30" fill="#D9534F"/><path d="M50 26 L50 86" stroke="#1F2421" stroke-width="4"/><circle cx="50" cy="26" r="12" fill="#1F2421"/><circle cx="36" cy="48" r="6" fill="#1F2421"/><circle cx="64" cy="48" r="6" fill="#1F2421"/><circle cx="38" cy="70" r="5" fill="#1F2421"/><circle cx="62" cy="70" r="5" fill="#1F2421"/>`;
const sun = `<g stroke="#F2A65A" stroke-width="7" stroke-linecap="round"><path d="M50 6 L50 18"/><path d="M50 82 L50 94"/><path d="M6 50 L18 50"/><path d="M82 50 L94 50"/><path d="M19 19 L27 27"/><path d="M73 73 L81 81"/><path d="M19 81 L27 73"/><path d="M73 27 L81 19"/></g><circle cx="50" cy="50" r="24" fill="#F2C94C"/>`;
const eis = `<path d="M34 46 L50 96 L66 46Z" fill="#E9C46A"/><path d="M38 52 L60 74 M62 52 L42 76" stroke="#C9A042" stroke-width="3"/><circle cx="40" cy="38" r="14" fill="#F6B8C8"/><circle cx="60" cy="38" r="14" fill="#9FD18F"/><circle cx="50" cy="22" r="14" fill="#F7EBDD"/>`;
const ball = `<circle cx="50" cy="50" r="38" fill="#FFFFFF" stroke="#1F2421" stroke-width="3"/><path d="M50 12 A38 38 0 0 1 88 50 L50 50Z" fill="#D9534F"/><path d="M50 88 A38 38 0 0 1 12 50 L50 50Z" fill="#5FB3D6"/><circle cx="50" cy="50" r="7" fill="#F2C94C"/>`;
const leaf = (fill: string, vein: string) =>
  `<g transform="rotate(-30 50 50)"><path d="M50 8 Q84 30 74 64 Q62 90 50 92 Q38 90 26 64 Q16 30 50 8Z" fill="${fill}"/><path d="M50 14 L50 96" stroke="${vein}" stroke-width="3.5" stroke-linecap="round"/><path d="M50 40 L34 30 M50 40 L66 30 M50 60 L30 50 M50 60 L70 50" stroke="${vein}" stroke-width="2.5"/></g>`;
const acorn = `<path d="M28 44 Q50 30 72 44 Q74 84 50 94 Q26 84 28 44Z" fill="#C98A4B"/><path d="M22 46 Q50 16 78 46 Q50 38 22 46Z" fill="#7A4A1A"/><path d="M50 26 Q52 14 60 10" stroke="#7A4A1A" stroke-width="5" fill="none" stroke-linecap="round"/>`;
const ship = `<path d="M50 10 L50 70" stroke="#7A4A1A" stroke-width="4"/><path d="M53 14 L82 58 L53 58Z" fill="#FFFFFF" stroke="#3A3F47" stroke-width="2.5"/><path d="M47 22 L24 58 L47 58Z" fill="#F7EBDD" stroke="#3A3F47" stroke-width="2.5"/><path d="M50 10 L64 14 L50 18Z" fill="#D9534F"/><path d="M12 66 L88 66 L76 88 L24 88Z" fill="#8B5E3C"/>`;
const truhe = `<rect x="14" y="42" width="72" height="44" rx="4" fill="#8B5E3C"/><path d="M14 46 Q14 18 50 18 Q86 18 86 46Z" fill="#A0703F"/><rect x="14" y="40" width="72" height="8" fill="#F2C94C"/><rect x="44" y="40" width="12" height="18" rx="2" fill="#F2C94C"/><circle cx="30" cy="28" r="0" fill="none"/>`;
const anker = `<g fill="none" stroke="#3A3F47" stroke-width="7" stroke-linecap="round"><circle cx="50" cy="18" r="9"/><path d="M50 27 L50 88"/><path d="M32 42 L68 42"/><path d="M18 64 Q22 88 50 88 Q78 88 82 64"/></g>`;
const turm = `<path d="M24 30 L24 92 L76 92 L76 30Z" fill="#B9C3D1"/><path d="M20 18 L20 32 L80 32 L80 18 L70 18 L70 26 L60 26 L60 18 L50 18 L50 26 L40 26 L40 18 L30 18 L30 26 L20 26Z" fill="#8D99AB"/><path d="M42 92 L42 70 Q50 60 58 70 L58 92Z" fill="#7A4A1A"/><rect x="45" y="40" width="10" height="14" rx="5" fill="#44546A"/>`;
const schild = `<path d="M50 8 L86 20 Q86 66 50 92 Q14 66 14 20Z" fill="#1F6F6B"/><path d="M50 8 L50 92 M14 34 L86 34" stroke="#F2C94C" stroke-width="6"/>`;
const wimpel = `<path d="M22 8 L22 94" stroke="#7A4A1A" stroke-width="5" stroke-linecap="round"/><path d="M24 12 L84 26 L24 42Z" fill="#9ACFCB"/><path d="M24 22 L64 26 L24 32Z" fill="#1F6F6B"/>`;
const scheune = `<path d="M10 46 L50 14 L90 46 L90 92 L10 92Z" fill="#B03A2E"/><path d="M10 46 L50 14 L90 46" fill="none" stroke="#FFFFFF" stroke-width="4"/><rect x="36" y="58" width="28" height="34" fill="#FFFFFF"/><path d="M36 58 L64 92 M64 58 L36 92" stroke="#B03A2E" stroke-width="4"/>`;
const sonnenblume = `<path d="M50 50 L50 96" stroke="#5E9B4E" stroke-width="5"/><g fill="#F2C94C">${Array.from({ length: 10 }, (_, i) => `<ellipse cx="50" cy="20" rx="8" ry="15" transform="rotate(${i * 36} 50 40)"/>`).join('')}</g><circle cx="50" cy="40" r="13" fill="#7A4A1A"/>`;
const moehre = `<path d="M50 94 L34 34 Q50 24 66 34Z" fill="#F2A65A"/><path d="M42 50 L50 50 M44 62 L54 62 M46 74 L52 74" stroke="#D9853A" stroke-width="3"/><path d="M50 30 Q40 10 30 8 M50 30 Q50 8 50 4 M50 30 Q60 10 70 8" stroke="#7FC06D" stroke-width="5" fill="none" stroke-linecap="round"/>`;

const wave = (stroke: string, step: number) => {
  let d = `M0 14`;
  for (let x = 0; x + step * 2 <= 720; x += step * 2) d += ` Q${x + step / 2} 4 ${x + step} 14 T${x + step * 2} 14`;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="3"/>`;
};
/** kleine Blume für den Blumenkranz */
const kranzBlume = (x: number, y: number, c: string) =>
  `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(4.2 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(4.2 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" r="3.6" fill="${c}"/>`).join('')}<circle r="2.6" fill="#F2C94C"/></g>`;
const kranz = () => {
  const farben = ['#F6B8C8', '#B9A4E8', '#E8896A', '#B9A4E8', '#F6B8C8'];
  const winkel = [-158, -122, -90, -58, -22];
  const ranke = `<path d="M142 41 A25 25 0 0 1 190 41" fill="none" stroke="#7FC06D" stroke-width="3" stroke-linecap="round"/>`;
  return ranke + winkel.map((w, i) => kranzBlume(166 + 25 * Math.cos((w * Math.PI) / 180), 50 + 25 * Math.sin((w * Math.PI) / 180), farben[i])).join('');
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
    costume: kranz(),
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
    costume: `<path d="M166 17 L166 6" stroke="#2B3A67" stroke-width="2.5"/><circle cx="166" cy="4" r="4" fill="#E8896A"/><circle cx="166" cy="50" r="33" fill="#DCE6F7" fill-opacity="0.15" stroke="#2B3A67" stroke-width="3"/><path d="M145 36 A24 24 0 0 1 158 25" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/><path d="M142 74 Q166 90 190 74" fill="none" stroke="#2B3A67" stroke-width="5" stroke-linecap="round"/>`,
    headDeco: [star('#F2C94C'), planet, rocket],
    footDeco: star('#F2C94C'),
    strip: row(18, (x, i) => `<polygon transform="translate(${x} 12) scale(${i % 2 ? 0.13 : 0.19}) translate(-50 -50)" points="50,8 61,37 92,39 68,58 76,89 50,72 24,89 32,58 8,39 39,37" fill="${i % 3 ? '#8FA4E8' : '#F2C94C'}"/>`),
  },
  meer: {
    id: 'meer',
    name: 'Meer',
    main: '#1D5E80',
    light: '#E3F2FA',
    border: '#BDE3F2',
    seg: ['#BDE3F2', '#8FCDE6'],
    costume: `<path d="M149 43 L141 41 M184 43 L191 41" stroke="#1D5E80" stroke-width="3" stroke-linecap="round"/><rect x="149" y="37" width="35" height="17" rx="8" fill="#BDE3F2" fill-opacity="0.55" stroke="#1D5E80" stroke-width="2.5"/><path d="M166 38 L166 53" stroke="#1D5E80" stroke-width="2"/><path d="M184 49 L193 49 Q197 49 197 45 L197 12" fill="none" stroke="#E8896A" stroke-width="4" stroke-linecap="round"/><rect x="193" y="6" width="8" height="7" rx="2" fill="#1D5E80"/>`,
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
    costume: `<g transform="rotate(-10 166 28)"><rect x="153" y="3" width="26" height="25" rx="2" fill="#1F2421"/><rect x="153" y="19" width="26" height="5" fill="#D9534F"/><ellipse cx="166" cy="28" rx="21" ry="4.5" fill="#1F2421"/></g>`,
    headDeco: [balloon('#D9534F'), flag, balloon('#5FB3D6')],
    footDeco: balloon('#F2C94C'),
    strip:
      `<path d="M0 3 Q180 12 360 3 Q540 12 720 3" fill="none" stroke="#9AA59E" stroke-width="1.5"/>` +
      row(20, (x, i) => `<path d="M${x - 6} ${5 + (i % 2) * 2} l6 13 l6 -13Z" fill="${['#D9534F', '#F2C94C', '#5FB3D6', '#7FC06D'][i % 4]}"/>`),
  },
  zauberwald: {
    id: 'zauberwald',
    name: 'Zauberwald',
    main: '#5B3A8C',
    light: '#EFE8F8',
    border: '#D9CCF0',
    seg: ['#D9CCF0', '#B9A4E8'],
    costume: `<path d="M148 31 L145 10 L156 19 L166 4 L176 19 L187 10 L184 31 Q166 25 148 31 Z" fill="#F2C94C" stroke="#B8860B" stroke-width="2" stroke-linejoin="round"/><circle cx="166" cy="24" r="3" fill="#D9534F"/><circle cx="155" cy="26" r="2.2" fill="#8FCDE6"/><circle cx="177" cy="26" r="2.2" fill="#8FCDE6"/>`,
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
    costume: `<path d="M141 40 Q141 12 166 12 Q191 12 191 40 Z" fill="#D9534F"/><path d="M138 38 Q166 28 194 38 L194 45 Q166 35 138 45 Z" fill="#FFFFFF" stroke="#D9534F" stroke-width="2"/><circle cx="166" cy="9" r="7" fill="#FFFFFF" stroke="#D9534F" stroke-width="2"/><path d="M145 70 Q166 82 187 70 L189 77 Q166 89 143 77 Z" fill="#2E5E8C"/><path d="M178 79 L181 89 L188 88 L184 78 Z" fill="#2E5E8C"/>`,
    headDeco: [snowflake('#8FB8DE'), tree, snowflake('#B8D2EC')],
    footDeco: snowflake('#8FB8DE'),
    strip: row(16, (x, i) => `<g transform="translate(${x - 9} 3) scale(0.18)">${snowflake(i % 2 ? '#B8D2EC' : '#8FB8DE')}</g>`),
  },
  fruehling: {
    id: 'fruehling',
    name: 'Frühling',
    main: '#A63D63',
    light: '#FCEAF0',
    border: '#F6CFDC',
    seg: ['#F9D5E0', '#BFE0B5'],
    // Hasenohren auf einem Haarreif
    costume: `<g transform="rotate(-14 154 26)"><ellipse cx="154" cy="8" rx="7" ry="18" fill="#FFFFFF" stroke="#A63D63" stroke-width="2.5"/><ellipse cx="154" cy="9" rx="3.2" ry="12" fill="#F6B8C8"/></g><g transform="rotate(14 178 26)"><ellipse cx="178" cy="8" rx="7" ry="18" fill="#FFFFFF" stroke="#A63D63" stroke-width="2.5"/><ellipse cx="178" cy="9" rx="3.2" ry="12" fill="#F6B8C8"/></g><path d="M143 36 Q166 18 189 36" fill="none" stroke="#A63D63" stroke-width="4" stroke-linecap="round"/>`,
    headDeco: [tulip('#F6B8C8'), ladybug, tulip('#F2C94C')],
    footDeco: ladybug,
    strip: row(16, (x, i) => `<g transform="translate(${x - 6} 0) scale(0.13)">${tulip(['#F6B8C8', '#F2C94C', '#B9A4E8'][i % 3])}</g>`) + `<path d="M0 22 L720 22" stroke="#9FD18F" stroke-width="2"/>`,
  },
  sommer: {
    id: 'sommer',
    name: 'Sommer',
    main: '#A35F00',
    light: '#FFF4DE',
    border: '#F8DFAE',
    seg: ['#FFE29A', '#8FCDE6'],
    // Sonnenhut und Sonnenbrille
    costume: `<path d="M150 29 Q150 9 166 9 Q182 9 182 29 Z" fill="#F2C94C" stroke="#A35F00" stroke-width="2"/><path d="M150 22 Q166 18 182 22 L182 26 Q166 22 150 26 Z" fill="#D9534F"/><ellipse cx="166" cy="29" rx="31" ry="5.5" fill="#F2C94C" stroke="#A35F00" stroke-width="2"/><g fill="#1F2421"><rect x="148" y="40" width="16" height="11" rx="5"/><rect x="169" y="40" width="16" height="11" rx="5"/></g><path d="M163 44 L170 44 M148 43 L141 41 M185 43 L191 41" stroke="#1F2421" stroke-width="2.5" stroke-linecap="round"/>`,
    headDeco: [sun, eis, ball],
    footDeco: sun,
    strip: wave('#8FCDE6', 18) + row(12, (x) => `<circle cx="${x}" cy="20" r="2.2" fill="#F2C94C"/>`),
  },
  herbst: {
    id: 'herbst',
    name: 'Herbst',
    main: '#A8481A',
    light: '#FDEDE1',
    border: '#F5D2B8',
    seg: ['#F8D3B0', '#E8A86A'],
    // Ahornblatt als Mütze
    costume: `<g transform="rotate(-12 166 24)"><path d="M140 30 Q146 8 166 8 Q186 8 192 30 Q166 23 140 30 Z" fill="#E8762D"/><path d="M166 10 L166 26 M166 16 L155 12 M166 16 L177 12 M166 22 L149 19 M166 22 L183 19" stroke="#A84D12" stroke-width="1.6" stroke-linecap="round"/><path d="M166 8 Q168 1 173 -3" fill="none" stroke="#7A4A1A" stroke-width="2.5" stroke-linecap="round"/></g>`,
    headDeco: [leaf('#E8762D', '#A84D12'), acorn, leaf('#D9534F', '#9C2B2B')],
    footDeco: acorn,
    strip: row(16, (x, i) => `<g transform="translate(${x - 9} 1) scale(0.2)">${leaf(['#E8762D', '#F2C94C', '#D9534F'][i % 3], '#A84D12')}</g>`),
  },
  piraten: {
    id: 'piraten',
    name: 'Piraten',
    main: '#3A3F47',
    light: '#FBF3E6',
    border: '#DDD7CC',
    seg: ['#FFFFFF', '#E58A84'],
    // Piratenhut und Augenklappe
    costume: `<path d="M146 32 L190 50" stroke="#1F2421" stroke-width="2"/><ellipse cx="176" cy="46.5" rx="7.5" ry="6.5" fill="#1F2421"/><path d="M137 31 Q148 4 166 13 Q184 4 195 31 Q166 22 137 31 Z" fill="#1F2421"/><path d="M139 30 Q166 21 193 30" fill="none" stroke="#F2C94C" stroke-width="2.5"/><circle cx="166" cy="19" r="4.5" fill="#F2C94C"/>`,
    headDeco: [ship, truhe, anker],
    footDeco: anker,
    strip: wave('#7A8A99', 18) + row(10, (x) => `<path d="M${x - 4} 16 l8 8 m0 -8 l-8 8" stroke="#D9534F" stroke-width="2.5" stroke-linecap="round"/>`),
  },
  burg: {
    id: 'burg',
    name: 'Ritterburg',
    main: '#1F6F6B',
    light: '#E5F3F2',
    border: '#C4E3E1',
    seg: ['#C4E3E1', '#9ACFCB'],
    // Ritterhelm mit Feder
    costume: `<path d="M166 15 Q158 0 170 -8 Q169 3 178 0 Q172 9 169 15 Z" fill="#D9534F"/><path d="M140 40 Q140 15 166 15 Q192 15 192 40 Z" fill="#B9C3D1" stroke="#44546A" stroke-width="2"/><rect x="140" y="31" width="52" height="8" rx="3" fill="#8D99AB" stroke="#44546A" stroke-width="2"/><rect x="163" y="37" width="6" height="14" rx="2" fill="#8D99AB" stroke="#44546A" stroke-width="1.5"/>`,
    headDeco: [turm, schild, wimpel],
    footDeco: schild,
    strip: `<path d="M0 22 ${Array.from({ length: 30 }, (_, i) => `L${i * 24} 22 L${i * 24} 10 L${i * 24 + 12} 10 L${i * 24 + 12} 22`).join(' ')} L720 22" fill="none" stroke="#9ACFCB" stroke-width="3"/>`,
  },
  bauernhof: {
    id: 'bauernhof',
    name: 'Bauernhof',
    main: '#7A5230',
    light: '#F7EEDF',
    border: '#EAD7B8',
    seg: ['#FBE3A6', '#E9C46A'],
    // Strohhut und Strohhalm
    costume: `<path d="M150 28 Q150 10 166 10 Q182 10 182 28 Z" fill="#E9C46A" stroke="#A87B2A" stroke-width="2"/><path d="M150 22 Q166 18 182 22 L182 26 Q166 22 150 26 Z" fill="#7FC06D"/><path d="M135 31 Q166 20 197 31 Q166 37 135 31 Z" fill="#E9C46A" stroke="#A87B2A" stroke-width="2"/><path d="M140 32 l-3 4 M150 34 l-2 4 M182 34 l2 4 M192 32 l3 4" stroke="#A87B2A" stroke-width="1.5"/><path d="M176 63 L199 53" stroke="#D9A43A" stroke-width="2.5" stroke-linecap="round"/><path d="M197 54 l3 -5 M198 54 l5 -1" stroke="#D9A43A" stroke-width="1.5" stroke-linecap="round"/>`,
    headDeco: [scheune, sonnenblume, moehre],
    footDeco: sonnenblume,
    strip: `<path d="M0 10 L720 10 M0 18 L720 18" stroke="#C9A06A" stroke-width="2.5"/>` + row(24, (x) => `<path d="M${x} 4 L${x} 23" stroke="#A87B2A" stroke-width="3" stroke-linecap="round"/>`),
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
