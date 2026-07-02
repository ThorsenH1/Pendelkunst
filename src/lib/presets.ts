import { PresetConfig, SimulationSettings } from './types';

export function createDefaultSettings(): SimulationSettings {
  return {
    pendulum: {
      stringLength: 1.0,       // 1 m string -> omega ~ 3.13 rad/s, T ~ 2 s
      frequencyRatio: 1.02,    // slight Y-string precession -> gentle rosette
      damping: 0.0032,
    },
    paint: {
      holes: [{ offsetX: 0, offsetY: 0, color: '#1a1a2e', thickness: 1 }],
      baseThickness: 3,
      brushType: 'bucket',
      splashEnabled: true,
      splashIntensity: 0.5,
      opacity: 0.85,
      viscosity: 0.5,
      bucketCapacity: 55,
      wetBlend: false,
    },
    symmetry: { mode: 'none', rotationalOrder: 4 },
    canvasMotion: { mode: 'still', speed: 1, amplitude: 0.3, damping: 0.003 },
    dropPosition: { x: 0.8, y: 0 },
    // Gentle CCW toss (a true 'drop' paints a narrow precessing fan — realistic
    // but sparse; the classic full rosette needs a slight circular launch).
    throwMode: 'throw-ccw',
    throwSpeed: 0.7,
    speed: 1,
    backgroundColor: '#faf8f5',
    paperTexture: 0,
    seed: 1,
    showRig: true,
  };
}

/** Random seed in a friendly, typeable range. */
export function newSeed(): number {
  return 1 + Math.floor(Math.random() * 999_998);
}

export const presets: PresetConfig[] = [
  {
    name: 'Rosett',
    thumbnail: '/presets/rosett.webp',
    description: 'Klassisk pendelmønster som i virale videoer',
    emoji: '🌹',
    settings: {
      pendulum: { stringLength: 1.0, frequencyRatio: 1.022, damping: 0.0026 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#e63946', thickness: 1.2 },
          { offsetX: 0.03, offsetY: 0.02, color: '#457b9d', thickness: 0.8 },
          { offsetX: -0.02, offsetY: 0.03, color: '#f4a261', thickness: 1.0 },
        ],
        baseThickness: 3.5, brushType: 'bucket', splashEnabled: true, splashIntensity: 0.55, opacity: 0.8, viscosity: 0.35, bucketCapacity: 65,
      },
      dropPosition: { x: 0.82, y: 0.05 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.7,
      backgroundColor: '#fefae0',
    },
  },
  {
    name: 'Organisk',
    thumbnail: '/presets/organisk.webp',
    description: 'Lang snor og jordfarger — rolig, naturlig rosett',
    emoji: '🌿',
    settings: {
      pendulum: { stringLength: 1.5, frequencyRatio: 1.006, damping: 0.0024 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#606c38', thickness: 1.1 },
          { offsetX: 0.02, offsetY: -0.01, color: '#283618', thickness: 0.8 },
          { offsetX: -0.02, offsetY: 0.02, color: '#a68a64', thickness: 0.9 },
        ],
        baseThickness: 4, brushType: 'drip-stick', splashEnabled: true, splashIntensity: 0.3, opacity: 0.8, viscosity: 0.55, bucketCapacity: 70,
      },
      dropPosition: { x: 0.8, y: 0.08 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.7,
      backgroundColor: '#fefae0',
    },
  },
  {
    name: 'Geometrisk',
    thumbnail: '/presets/geometrisk.webp',
    description: 'Tette, presise linjer som tegner skarpe figurer',
    emoji: '📐',
    settings: {
      pendulum: { stringLength: 0.95, frequencyRatio: 1.005, damping: 0.003 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#264653', thickness: 1.0 },
          { offsetX: 0.02, offsetY: 0.02, color: '#2a9d8f', thickness: 0.8 },
        ],
        baseThickness: 2.8, brushType: 'bucket', splashEnabled: false, splashIntensity: 0, opacity: 0.8, viscosity: 0.45, bucketCapacity: 45,
      },
      dropPosition: { x: 0.82, y: 0 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.7,
      backgroundColor: '#ffffff',
    },
  },
  {
    name: 'Kaotisk',
    thumbnail: '/presets/kaotisk.webp',
    description: 'Tett, vevd stjernemønster som fyller lerretet',
    emoji: '🌀',
    settings: {
      pendulum: { stringLength: 0.6, frequencyRatio: 1.0907, damping: 0.0025 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#9b2226', thickness: 1.0 },
          { offsetX: 0.04, offsetY: 0, color: '#005f73', thickness: 0.9 },
          { offsetX: -0.02, offsetY: 0.035, color: '#bb3e03', thickness: 1.1 },
          { offsetX: -0.02, offsetY: -0.035, color: '#0a9396', thickness: 0.8 },
        ],
        baseThickness: 3.4, brushType: 'marker', splashEnabled: true, splashIntensity: 0.45, opacity: 0.8, viscosity: 0.3, bucketCapacity: 90,
      },
      dropPosition: { x: 0.9, y: -0.2 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.95,
      backgroundColor: '#f5f0eb',
    },
  },
  {
    name: 'Zen',
    thumbnail: '/presets/zen.webp',
    description: 'Ren, rolig spiral — meditativt og enkelt',
    emoji: '🧘',
    settings: {
      pendulum: { stringLength: 1.2, frequencyRatio: 1.0, damping: 0.0034 },
      paint: {
        holes: [{ offsetX: 0, offsetY: 0, color: '#2b2d42', thickness: 1 }],
        baseThickness: 3.0, brushType: 'marker', splashEnabled: false, splashIntensity: 0, opacity: 0.95, viscosity: 0.8, bucketCapacity: 50,
      },
      dropPosition: { x: 0.78, y: 0 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.95,
      backgroundColor: '#edf2f4',
    },
  },
  {
    name: 'Galakse',
    thumbnail: '/presets/galakse.webp',
    description: 'Lang, sakte spiral-ring med kosmiske farger',
    emoji: '🌌',
    settings: {
      pendulum: { stringLength: 1.5, frequencyRatio: 1.004, damping: 0.0012 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#7209b7', thickness: 1.0 },
          { offsetX: 0.015, offsetY: 0.015, color: '#3a0ca3', thickness: 0.6 },
          { offsetX: -0.015, offsetY: -0.015, color: '#f72585', thickness: 0.8 },
        ],
        baseThickness: 2.5, brushType: 'squeeze', splashEnabled: true, splashIntensity: 0.35, opacity: 0.85, viscosity: 0.4, bucketCapacity: 70,
      },
      dropPosition: { x: 0.8, y: 0.2 },
      throwMode: 'throw-cw',
      throwSpeed: 1.1,
      backgroundColor: '#0d1b2a',
    },
  },
  {
    name: 'Blomst',
    thumbnail: '/presets/blomst.webp',
    description: 'Kronblad-rosett i varme blomsterfarger',
    emoji: '🌸',
    settings: {
      pendulum: { stringLength: 0.85, frequencyRatio: 1.006, damping: 0.0032 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#ff006e', thickness: 1.0 },
          { offsetX: 0.02, offsetY: 0, color: '#8338ec', thickness: 0.8 },
        ],
        baseThickness: 3, brushType: 'squeeze', splashEnabled: false, splashIntensity: 0, opacity: 0.85, viscosity: 0.55, bucketCapacity: 45,
      },
      dropPosition: { x: 0.82, y: 0.03 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.7,
      backgroundColor: '#fff8f0',
    },
  },
  {
    name: 'Regnbue',
    thumbnail: '/presets/regnbue.webp',
    description: 'Alle regnbuens farger i en sirkel-rosett',
    emoji: '🌈',
    settings: {
      pendulum: { stringLength: 0.9, frequencyRatio: 1.035, damping: 0.0028 },
      paint: {
        holes: [
          { offsetX: 0, offsetY: -0.035, color: '#ff0000', thickness: 0.9 },
          { offsetX: 0.025, offsetY: -0.025, color: '#ff8800', thickness: 0.8 },
          { offsetX: 0.035, offsetY: 0, color: '#ffdd00', thickness: 0.85 },
          { offsetX: 0.025, offsetY: 0.025, color: '#22cc44', thickness: 0.9 },
          { offsetX: 0, offsetY: 0.035, color: '#0088ff', thickness: 0.85 },
          { offsetX: -0.025, offsetY: 0.025, color: '#4400cc', thickness: 0.8 },
          { offsetX: -0.035, offsetY: 0, color: '#8800cc', thickness: 0.9 },
        ],
        baseThickness: 5.5, brushType: 'squeeze', splashEnabled: true, splashIntensity: 0.5, opacity: 0.85, viscosity: 0.35, bucketCapacity: 90,
      },
      dropPosition: { x: 0.75, y: 0.12 },
      throwMode: 'throw-ccw',
      throwSpeed: 0.9,
      backgroundColor: '#fafafa',
    },
  },
];

// ── "Surprise me" — random but tasteful settings within proven ranges ──
const PALETTES: string[][] = [
  ['#e63946', '#457b9d', '#f4a261', '#2a9d8f'],
  ['#7209b7', '#3a0ca3', '#f72585', '#4cc9f0'],
  ['#606c38', '#283618', '#bc6c25', '#dda15e'],
  ['#ff006e', '#8338ec', '#3a86ff', '#ffbe0b'],
  ['#264653', '#2a9d8f', '#e9c46a', '#e76f51'],
  ['#0d3b66', '#faf0ca', '#f4d35e', '#ee964b'],
  ['#22223b', '#4a4e69', '#9a8c98', '#c9ada7'],
  ['#d00000', '#ffba08', '#3f88c5', '#032b43'],
  ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'],
  ['#590d22', '#a4133c', '#ff4d6d', '#ffb3c1'],
  ['#132a13', '#4f772d', '#90a955', '#ecf39e'],
  ['#03045e', '#0077b6', '#00b4d8', '#90e0ef'],
  ['#6f1d1b', '#bb9457', '#99582a', '#432818'],
  ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'],
];
const LIGHT_BG = ['#faf8f5', '#fefae0', '#ffffff', '#edf2f4', '#fff8f0', '#f5f0eb', '#f8f4ff', '#f0f7f4'];
const DARK_BG = ['#0d1b2a', '#1a1a2e', '#10002b', '#03071e', '#1b263b', '#2b2024'];
const BRUSHES = ['bucket', 'fine-brush', 'flat-brush', 'marker', 'drip-stick', 'squeeze', 'spray'] as const;

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min: number, max: number): number { return min + Math.random() * (max - min); }

// ── Contrast guard: paint must never drown in the canvas color ──
function relLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixToward(hex: string, target: number, amount: number): string {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * amount).toString(16).padStart(2, '0');
  };
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

/** Push a color away from the background until it has enough luminance contrast. */
export function ensureContrast(color: string, bg: string, minDiff = 0.22): string {
  const bgL = relLuminance(bg);
  let c = color;
  for (let guard = 0; guard < 8 && Math.abs(relLuminance(c) - bgL) < minDiff; guard++) {
    c = bgL > 0.5 ? mixToward(c, 0, 0.35) : mixToward(c, 255, 0.35);
  }
  return c;
}

export function randomSettings(): SimulationSettings {
  const base = createDefaultSettings();
  const dark = Math.random() < 0.3;
  const bg = dark ? pick(DARK_BG) : pick(LIGHT_BG);
  // Every paint color is contrast-guarded against the chosen canvas color.
  const fg = pick(PALETTES).map((c) => ensureContrast(c, bg));
  const holeCount = 1 + Math.floor(Math.random() * 5);
  const aStep = (2 * Math.PI) / holeCount;
  const r = holeCount > 1 ? 0.025 : 0;
  const holes = Array.from({ length: holeCount }, (_, i) => ({
    offsetX: holeCount > 1 ? Math.cos(aStep * i) * r : 0,
    offsetY: holeCount > 1 ? Math.sin(aStep * i) * r : 0,
    color: fg[i % fg.length],
    thickness: rnd(0.7, 1.3),
  }));
  // Mostly throws — a true drop paints a narrow rotating fan (kept as spice).
  const isThrow = Math.random() < 0.85;
  const throwMode = isThrow ? (Math.random() < 0.5 ? 'throw-cw' : 'throw-ccw') : 'drop';
  const rotational = Math.random() < 0.25;
  const withMotion = Math.random() < 0.12;

  return {
    ...base,
    seed: newSeed(),
    // Occasionally showcase the realism extras (texture always subtle;
    // wet-on-wet only on light grounds where multiply blending reads correctly).
    paperTexture: Math.random() < 0.35 ? rnd(0.3, 0.7) : 0,
    pendulum: {
      stringLength: rnd(0.6, 1.8),
      // Keep close to 1.0 — Airy precession draws the rosette; large detuning
      // shears the pattern into moiré bands. Occasional Lissajous ratios for variety.
      frequencyRatio: Math.random() < 0.85 ? rnd(1.0, 1.025) : pick([1.5, 5 / 3, 2.0]),
      damping: rnd(0.0012, 0.0038),
    },
    paint: {
      holes,
      baseThickness: rnd(2.2, 4),
      brushType: pick(BRUSHES),
      splashEnabled: Math.random() < 0.7,
      splashIntensity: rnd(0.3, 0.8),
      opacity: rnd(0.65, 0.9),
      viscosity: rnd(0.25, 0.7),
      bucketCapacity: Math.round(rnd(55, 95)),
      wetBlend: !dark && Math.random() < 0.3,
    },
    symmetry: rotational
      ? { mode: 'rotational', rotationalOrder: 2 + Math.floor(Math.random() * 5) }
      : { mode: 'none', rotationalOrder: 4 },
    canvasMotion: withMotion
      ? { mode: pick(['circular', 'linear-x', 'figure8'] as const), speed: rnd(0.3, 1.2), amplitude: rnd(0.1, 0.3), damping: 0.003 }
      : base.canvasMotion,
    dropPosition: { x: rnd(0.6, 0.95) * (Math.random() < 0.5 ? 1 : -1), y: rnd(-0.2, 0.25) },
    throwMode,
    throwSpeed: isThrow ? rnd(0.65, 1.35) : 1,
    backgroundColor: bg,
  };
}
