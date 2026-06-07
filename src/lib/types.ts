export interface PendulumComponent {
  amplitude: number;
  frequency: number;
  phase: number;
  damping: number;
}

export interface HarmonographConfig {
  xComponents: PendulumComponent[];
  yComponents: PendulumComponent[];
}

/** Physical pendulum configuration — all art is derived from these real-world parameters */
export interface PendulumConfig {
  /** String/rope length in meters (0.3–3.0). Determines natural frequency ω = √(g/L). */
  stringLength: number;
  /** Ratio ωy/ωx (0.5–2.0). Models Y-string suspension geometry.
   *  1.0 = symmetric → ellipse. ≈1.01–1.05 → rosette / petal patterns (viral videos).
   *  Rational ratios like 3/2 → Lissajous figures. */
  frequencyRatio: number;
  /** Friction/damping coefficient (0.001–0.05). Higher = stops sooner. */
  damping: number;
}

export interface HoleConfig {
  offsetX: number;
  offsetY: number;
  color: string;
  thickness: number;
}

export type BrushType = 'bucket' | 'fine-brush' | 'flat-brush' | 'marker' | 'drip-stick' | 'squeeze' | 'spray';

export interface PaintSettings {
  holes: HoleConfig[];
  baseThickness: number;
  brushType: BrushType;
  splashEnabled: boolean;
  splashIntensity: number;
  opacity: number;
  viscosity: number;
  bucketCapacity: number;
}

export interface SymmetrySettings {
  mode: 'none' | 'mirror-x' | 'mirror-y' | 'mirror-both' | 'rotational';
  rotationalOrder: number;
}

export type CanvasMotionMode = 'still' | 'circular' | 'linear-x' | 'linear-y' | 'figure8';

export interface CanvasMotion {
  mode: CanvasMotionMode;
  speed: number;
  amplitude: number;
  damping: number;
}

export interface DropPosition {
  x: number;
  y: number;
}

export type ThrowMode = 'drop' | 'throw-cw' | 'throw-ccw';

export interface SimulationSettings {
  pendulum: PendulumConfig;
  paint: PaintSettings;
  symmetry: SymmetrySettings;
  canvasMotion: CanvasMotion;
  dropPosition: DropPosition;
  throwMode: ThrowMode;
  throwSpeed: number;
  speed: number;
  backgroundColor: string;
}

export interface PaintPoint {
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  radius: number;
  color: string;
  opacity: number;
  viscosity?: number;
  brushType?: BrushType;
  speed?: number;
  /** Deterministic seed so export replays identically to the live canvas. */
  seed?: number;
  /** Splash particles carry velocity (normalized units) for teardrop shaping. */
  vx?: number;
  vy?: number;
  /** True for splash droplets (rendered with drawSplashDot, not as a stroke). */
  isSplash?: boolean;
}

export interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  decay: number;
  /** Stable seed for this particle's deterministic appearance. */
  seed: number;
}

export type SimulationState = 'idle' | 'running' | 'paused' | 'done';

export interface PresetConfig {
  name: string;
  description: string;
  emoji: string;
  settings: Partial<SimulationSettings>;
}

export interface SavedPainting {
  id: string;
  name: string;
  date: number;
  thumbnail: Blob;
  fullImage: Blob;
  points: PaintPoint[];
  settings: SimulationSettings;
}
