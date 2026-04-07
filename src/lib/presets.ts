import { PresetConfig, SimulationSettings } from './types';

export function createDefaultSettings(): SimulationSettings {
  return {
    pendulum: {
      stringLength: 1.0,       // 1 meter string → ω ≈ 3.13 rad/s, T ≈ 2s
      frequencyRatio: 1.02,    // slight Y-string precession → gentle rosette
      damping: 0.004,          // moderate friction
    },
    paint: {
      holes: [{ offsetX: 0, offsetY: 0, color: '#1a1a2e', thickness: 1 }],
      baseThickness: 3,
      brushType: 'bucket',
      splashEnabled: true,
      splashIntensity: 0.5,
      opacity: 0.85,
      viscosity: 0.5,
      bucketCapacity: 50,
    },
    symmetry: { mode: 'none', rotationalOrder: 4 },
    canvasMotion: { mode: 'still', speed: 1, amplitude: 0.3, damping: 0.003 },
    dropPosition: { x: 0.7, y: 0 },
    throwMode: 'drop',
    throwSpeed: 1,
    speed: 1,
    backgroundColor: '#faf8f5',
  };
}

export const presets: PresetConfig[] = [
  {
    name: 'Rosett',
    description: 'Klassisk pendelmønster som i virale videoer',
    emoji: '🌹',
    settings: {
      pendulum: {
        stringLength: 1.0,       // 1m → natural, medium speed
        frequencyRatio: 1.025,   // slight Y-string → petal pattern
        damping: 0.003,
      },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#e63946', thickness: 1.2 },
          { offsetX: 0.03, offsetY: 0.02, color: '#457b9d', thickness: 0.8 },
          { offsetX: -0.02, offsetY: 0.03, color: '#f4a261', thickness: 1.0 },
        ],
        baseThickness: 3.5, brushType: 'bucket', splashEnabled: true, splashIntensity: 0.7, opacity: 0.8, viscosity: 0.3, bucketCapacity: 60,
      },
      dropPosition: { x: 0.85, y: 0.1 },
      backgroundColor: '#fefae0',
    },
  },
  {
    name: 'Organisk',
    description: 'Lang snor, sakte svingninger med jordfarger',
    emoji: '🌿',
    settings: {
      pendulum: {
        stringLength: 2.0,       // 2m → slow, graceful swings
        frequencyRatio: 1.01,    // very subtle precession
        damping: 0.003,
      },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#606c38', thickness: 1.0 },
          { offsetX: 0.02, offsetY: -0.01, color: '#283618', thickness: 0.7 },
        ],
        baseThickness: 4, brushType: 'drip-stick', splashEnabled: true, splashIntensity: 0.3, opacity: 0.75, viscosity: 0.6, bucketCapacity: 55,
      },
      dropPosition: { x: 0.6, y: 0.3 },
      backgroundColor: '#fefae0',
    },
  },
  {
    name: 'Lissajous',
    description: 'Presise geometriske figurer (3:2 frekvensforhold)',
    emoji: '📐',
    settings: {
      pendulum: {
        stringLength: 0.7,       // shorter → faster, crisper pattern
        frequencyRatio: 1.5,     // 3:2 → classic Lissajous figure
        damping: 0.004,
      },
      paint: {
        holes: [{ offsetX: 0, offsetY: 0, color: '#264653', thickness: 0.8 }],
        baseThickness: 2.5, brushType: 'fine-brush', splashEnabled: false, splashIntensity: 0, opacity: 0.9, viscosity: 0.7, bucketCapacity: 40,
      },
      dropPosition: { x: 0.75, y: 0.3 },
      backgroundColor: '#ffffff',
    },
  },
  {
    name: 'Kaotisk',
    description: 'Tett, komplekst mønster som fyller hele lerretet',
    emoji: '🌀',
    settings: {
      pendulum: {
        stringLength: 0.6,       // short → fast oscillations
        frequencyRatio: 1.4907,  // irrational near 3:2 → ergodic, fills space
        damping: 0.0015,         // low friction → swings a long time
      },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#9b2226', thickness: 1.0 },
          { offsetX: 0.04, offsetY: 0, color: '#005f73', thickness: 0.9 },
          { offsetX: -0.02, offsetY: 0.035, color: '#bb3e03', thickness: 1.1 },
          { offsetX: -0.02, offsetY: -0.035, color: '#0a9396', thickness: 0.8 },
        ],
        baseThickness: 3, brushType: 'bucket', splashEnabled: true, splashIntensity: 0.9, opacity: 0.7, viscosity: 0.2, bucketCapacity: 70,
      },
      dropPosition: { x: 0.95, y: -0.3 },
      backgroundColor: '#f5f0eb',
    },
  },
  {
    name: 'Zen',
    description: 'Enkel ellipse-spiral, meditativt og rent',
    emoji: '🧘',
    settings: {
      pendulum: {
        stringLength: 1.2,      // medium-long string
        frequencyRatio: 1.0,    // perfect symmetry → pure ellipse spiral
        damping: 0.006,         // higher damping → short, clean pattern
      },
      paint: {
        holes: [{ offsetX: 0, offsetY: 0, color: '#2b2d42', thickness: 1 }],
        baseThickness: 2, brushType: 'marker', splashEnabled: false, splashIntensity: 0, opacity: 0.9, viscosity: 0.8, bucketCapacity: 35,
      },
      dropPosition: { x: 0.5, y: 0.2 },
      backgroundColor: '#edf2f4',
    },
  },
  {
    name: 'Galakse',
    description: 'Lang, sakte spiral med kosmiske farger',
    emoji: '🌌',
    settings: {
      pendulum: {
        stringLength: 1.5,       // long → slow, majestic
        frequencyRatio: 1.003,   // almost symmetric → very slow precession → tight spiral
        damping: 0.001,          // minimal friction → swings 200+ times
      },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#7209b7', thickness: 1.0 },
          { offsetX: 0.015, offsetY: 0.015, color: '#3a0ca3', thickness: 0.6 },
          { offsetX: -0.015, offsetY: -0.015, color: '#f72585', thickness: 0.8 },
        ],
        baseThickness: 2.5, brushType: 'squeeze', splashEnabled: true, splashIntensity: 0.4, opacity: 0.85, viscosity: 0.4, bucketCapacity: 65,
      },
      dropPosition: { x: 0.8, y: 0.2 },
      throwMode: 'throw-cw',
      throwSpeed: 1.2,
      backgroundColor: '#0d1b2a',
    },
  },
  {
    name: 'Blomst',
    description: 'Kronblad-mønster med 5:3 frekvensforhold',
    emoji: '🌸',
    settings: {
      pendulum: {
        stringLength: 0.8,
        frequencyRatio: 5 / 3,   // 5:3 → petal pattern
        damping: 0.003,
      },
      paint: {
        holes: [
          { offsetX: 0, offsetY: 0, color: '#ff006e', thickness: 0.9 },
          { offsetX: 0.02, offsetY: 0, color: '#8338ec', thickness: 0.7 },
        ],
        baseThickness: 3, brushType: 'fine-brush', splashEnabled: false, splashIntensity: 0, opacity: 0.8, viscosity: 0.55, bucketCapacity: 45,
      },
      dropPosition: { x: 0.65, y: 0.25 },
      backgroundColor: '#fff8f0',
    },
  },
  {
    name: 'Regnbue',
    description: 'Alle regnbuens farger med sirkel-kast',
    emoji: '🌈',
    settings: {
      pendulum: {
        stringLength: 0.9,
        frequencyRatio: 1.04,    // moderate precession → evolving pattern
        damping: 0.002,
      },
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
        baseThickness: 2.5, brushType: 'flat-brush', splashEnabled: true, splashIntensity: 0.5, opacity: 0.75, viscosity: 0.35, bucketCapacity: 80,
      },
      dropPosition: { x: 0.9, y: 0.15 },
      throwMode: 'throw-ccw',
      throwSpeed: 1.5,
      backgroundColor: '#fafafa',
    },
  },
];
