export interface PendulumComponent {
  amplitude: number;
  frequency: number;
  phase: number;
  damping: number;
}

export interface HarmonographConfig {
  xComponents: PendulumComponent[];
  yComponents: PendulumComponent[];
  /** Airy precession rate Ω₀ (rad/s, signed by orbit direction). A real spherical
   *  pendulum's elliptical orbit ROTATES slowly (Ω = ⅜·ω·a·b/L²) — this is what turns
   *  a decaying ellipse into the round rosettes of real pendulum painting. */
  precessionRate?: number;
  /** Amplitude damping γ — precession slows as e^(-2γt) since Ω ∝ a·b. */
  precessionDamping?: number;
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
  /** Wet-on-wet blending: overlapping strokes multiply like real pigment. Optional for
   *  backward compatibility with gallery-stored settings (treated as false). */
  wetBlend?: boolean;
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
  /** Canvas/paper grain strength 0–1 (0 = off). Deterministic, included in export. */
  paperTexture?: number;
  /** Run seed: same seed + same settings → pixel-identical painting (reproducible art). */
  seed?: number;
  /** Faint relief shadow under each stroke (light from top-left): the paint reads as
   *  physically raised on the canvas. Off by default; stored per point → WYSIWYG export. */
  paintShadow?: boolean;
  /** Show the swinging pendulum rig (string + paint container) while painting. UI-only. */
  showRig?: boolean;
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
  /** Wet-on-wet: render this point with multiply compositing (real pigment mixing). */
  blend?: boolean;
  /** Relief shadow: draw a faint offset shadow under this point (paintShadow was on). */
  shadow?: boolean;
  /** Splash-trail points: life decay per step. When set, (x, y, vx, vy, radius, decay)
   *  are the droplet's INITIAL state and the renderer replays the whole deterministic
   *  trajectory — one stored point per droplet instead of one per animation step. */
  decay?: number;
  /** Symmetry active when this point was painted. Layers can be painted with different
   *  symmetry, so the export replays each point with ITS OWN symmetry — not the current
   *  global setting. Absent on older points → fall back to the setting passed in.
   *  Stored as a shared reference (one object per settings change), so it is cheap. */
  sym?: SymmetrySettings;
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
  /** Paint state at LAUNCH. The export replays the flight and splat from the stored
   *  point's launch-time values, so the live landing must use the same ones — even if
   *  the user moves the opacity/viscosity sliders while the droplet is mid-air.
   *  (Viscosity also sets the air drag, i.e. WHERE the droplet lands.) */
  opacity: number;
  viscosity: number;
  blend?: boolean;
  shadow?: boolean;
  /** Symmetry at launch — the landing splat must use the SAME symmetry as the stored
   *  point, even if the user changes symmetry while the droplet is mid-air. */
  sym?: SymmetrySettings;
}

export type SimulationState = 'idle' | 'running' | 'paused' | 'done';

export interface PresetConfig {
  name: string;
  description: string;
  emoji: string;
  /** Deterministic mini-render of this preset (seed 1), committed under public/presets/.
   *  Regenerate with the headless QA pipeline whenever the preset or physics change. */
  thumbnail?: string;
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
