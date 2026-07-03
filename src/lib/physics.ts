import { HarmonographConfig, PendulumComponent, PendulumConfig, CanvasMotion, DropPosition, ThrowMode } from './types';

// ── Constants ──
const G = 9.81; // m/s² — gravitational acceleration

// ── Harmonograph evaluator (internal) ──
// position(t) = Σ Aᵢ · sin(ωᵢt + φᵢ) · e^(-dᵢt)

function evalComponents(components: PendulumComponent[], t: number): number {
  return components.reduce((sum, c) => {
    return sum + c.amplitude * Math.sin(c.frequency * t + c.phase) * Math.exp(-c.damping * t);
  }, 0);
}

function evalDerivative(components: PendulumComponent[], t: number): number {
  return components.reduce((sum, c) => {
    const decay = Math.exp(-c.damping * t);
    return sum + c.amplitude * (c.frequency * Math.cos(c.frequency * t + c.phase) - c.damping * Math.sin(c.frequency * t + c.phase)) * decay;
  }, 0);
}

// ── Physical pendulum → harmonograph conversion ──
// A damped pendulum released from (x₀, y₀) with velocity (vx₀, vy₀):
//   x(t) = e^(-γt) · [Ax cos(ωₓt) + Bx sin(ωₓt)]
//   Ax = x₀,  Bx = (vx₀ + γ·x₀) / ωₓ
// Rewritten as: Rx · sin(ωₓt + φx) · e^(-γt)  where Rx = √(Ax²+Bx²), φx = atan2(Ax, Bx)

function pendulumToHarmonograph(
  config: PendulumConfig,
  drop: DropPosition,
  throwMode: ThrowMode,
  throwSpeed: number,
): HarmonographConfig {
  const L = config.stringLength;
  const gamma = config.damping;

  // Natural frequencies from string length: ω = √(g/L)
  const omega0 = Math.sqrt(G / L);
  const omegaX = omega0;
  const omegaY = omega0 * config.frequencyRatio;

  // Damped frequencies: ωd = √(ω² - γ²)
  const omegaDX = Math.sqrt(Math.max(omegaX * omegaX - gamma * gamma, 0.01));
  const omegaDY = Math.sqrt(Math.max(omegaY * omegaY - gamma * gamma, 0.01));

  // Initial conditions from drop position
  const x0 = drop.x;
  const y0 = drop.y;

  // Initial velocity. A real pendulum release is never perfectly radial:
  // the hand always imparts a slight sideways motion, so the swing opens into a
  // thin, slowly-precessing ellipse — the classic rosette of real pendulum art.
  // 'throw' makes that sideways motion strong and directional (near-circular orbit).
  const dist = Math.sqrt(x0 * x0 + y0 * y0) || 0.01;
  const angle = Math.atan2(y0, x0);
  let vx0 = 0, vy0 = 0;
  if (throwMode === 'throw-cw' || throwMode === 'throw-ccw') {
    const dir = throwMode === 'throw-cw' ? 1 : -1;
    const tangentAngle = angle + dir * Math.PI / 2;
    // Characteristic velocity scales with natural frequency and displacement.
    const vMag = throwSpeed * omega0 * dist;
    vx0 = vMag * Math.cos(tangentAngle);
    vy0 = vMag * Math.sin(tangentAngle);
  } else {
    // 'drop': a TRUE hand release. Nearly radial — only the tiny, unavoidable
    // sideways tremor of a real hand (≈15% of circular speed). The swing traces a
    // narrow ellipse that Airy-precesses into a slowly rotating fan — exactly what
    // a real dropped paint bucket paints. (Was 0.7, which behaved like a throw.)
    const tangentAngle = angle - Math.PI / 2;
    const vMag = omega0 * dist * 0.15;
    vx0 = vMag * Math.cos(tangentAngle);
    vy0 = vMag * Math.sin(tangentAngle);
  }

  // Solve initial-value problem for each axis
  // x(t) = e^(-γt)[Ax cos(ωd·t) + Bx sin(ωd·t)]  →  Rx sin(ωd·t + φx) e^(-γt)
  const Ax = x0;
  const Bx = (vx0 + gamma * x0) / omegaDX;
  const Rx = Math.sqrt(Ax * Ax + Bx * Bx) || 0.001;
  const phiX = Math.atan2(Ax, Bx);

  const Ay = y0;
  const By = (vy0 + gamma * y0) / omegaDY;
  const Ry = Math.sqrt(Ay * Ay + By * By) || 0.001;
  const phiY = Math.atan2(Ay, By);

  // ── Airy precession (the physics behind REAL pendulum-art rosettes) ──
  // A spherical pendulum on an elliptical orbit precesses in the direction of
  // circulation at Ω = (3/8)·ω·(a·b)/L² (a, b = angular semi-axes). For the
  // isotropic part of the motion, a·b = |Lz|/ω where Lz = x₀vy₀ − y₀vx₀, so
  // Ω₀ = (3/8)·K²·Lz with K² converting normalized canvas units to radians².
  // This ROTATES the decaying ellipse instead of shearing it — round rosettes,
  // not the square Lissajous envelope a plain detuned oscillator produces.
  const Lz = x0 * vy0 - y0 * vx0;
  const PRECESS_K2 = 0.32;
  const precessionRate = 0.375 * PRECESS_K2 * Lz;

  return {
    xComponents: [{ amplitude: Rx, frequency: omegaDX, phase: phiX, damping: gamma }],
    yComponents: [{ amplitude: Ry, frequency: omegaDY, phase: phiY, damping: gamma }],
    precessionRate,
    precessionDamping: gamma,
  };
}

/** Accumulated precession angle: θ(t) = Ω₀·(1 − e^(−2γt))/(2γ) — slows as the swing dies. */
function precessionAngle(t: number, config: HarmonographConfig): number {
  const rate = config.precessionRate ?? 0;
  if (rate === 0) return 0;
  const g2 = 2 * (config.precessionDamping ?? 0);
  return g2 < 1e-9 ? rate * t : rate * (1 - Math.exp(-g2 * t)) / g2;
}

/** Prepare the internal harmonograph config from physical pendulum parameters */
export function prepareHarmonograph(
  config: PendulumConfig,
  drop: DropPosition,
  throwMode: ThrowMode,
  throwSpeed: number,
): HarmonographConfig {
  return pendulumToHarmonograph(config, drop, throwMode, throwSpeed);
}

export function calcPosition(t: number, config: HarmonographConfig) {
  const x = evalComponents(config.xComponents, t);
  const y = evalComponents(config.yComponents, t);
  const th = precessionAngle(t, config);
  if (th === 0) return { x, y };
  const c = Math.cos(th), s = Math.sin(th);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function calcVelocity(t: number, config: HarmonographConfig) {
  const vx = evalDerivative(config.xComponents, t);
  const vy = evalDerivative(config.yComponents, t);
  const th = precessionAngle(t, config);
  if (th === 0) return { vx, vy };
  // d/dt[R(θ)p] = R(θ)(v + θ'·J·p), J·p = (−y, x)
  const x = evalComponents(config.xComponents, t);
  const y = evalComponents(config.yComponents, t);
  const rate = (config.precessionRate ?? 0) * Math.exp(-2 * (config.precessionDamping ?? 0) * t);
  const ux = vx - rate * y;
  const uy = vy + rate * x;
  const c = Math.cos(th), s = Math.sin(th);
  return { vx: ux * c - uy * s, vy: ux * s + uy * c };
}

/** Pendulum bob height above lowest point (0 at center, >0 at extremes).
 *  Real geometry: h = L(1 - cos theta) ~= r^2/(2L) for small swings, where r is the
 *  horizontal displacement. A LONGER string swings through a smaller angle for the
 *  same displacement, so the bob rises less -> a flatter arc and gentler paint spread.
 *  Normalized so L = 1 m reproduces the original look while genuinely tracking L. */
export function calcBobHeight(x: number, y: number, stringLength: number): number {
  const r2 = x * x + y * y;
  return Math.min(r2 / stringLength, 1);
}

export function getMaxAmplitude(t: number, config: HarmonographConfig): number {
  const xEnv = config.xComponents.reduce((s, comp) => s + comp.amplitude * Math.exp(-comp.damping * t), 0);
  const yEnv = config.yComponents.reduce((s, comp) => s + comp.amplitude * Math.exp(-comp.damping * t), 0);
  return Math.max(xEnv, yEnv);
}

export function isSimulationDone(t: number, config: HarmonographConfig, threshold = 0.005): boolean {
  return getMaxAmplitude(t, config) < threshold;
}

// ── Canvas surface movement ──

export function calcCanvasOffset(t: number, motion: CanvasMotion): { ox: number; oy: number } {
  if (motion.mode === 'still' || motion.amplitude === 0) return { ox: 0, oy: 0 };

  const a = motion.amplitude * 0.15;
  const w = motion.speed * 0.5;
  const decay = Math.exp(-(motion.damping || 0) * t);

  switch (motion.mode) {
    case 'circular':
      return { ox: a * decay * Math.cos(w * t), oy: a * decay * Math.sin(w * t) };
    case 'linear-x':
      return { ox: a * decay * Math.sin(w * t), oy: 0 };
    case 'linear-y':
      return { ox: 0, oy: a * decay * Math.sin(w * t) };
    case 'figure8':
      return { ox: a * decay * Math.sin(w * t), oy: a * decay * Math.sin(w * t * 2) * 0.5 };
    default:
      return { ox: 0, oy: 0 };
  }
}

// ── Realistic paint physics ──

/** Paint flow rate using Torricelli's law: v = √(2gh) adjusted for centripetal force */
export function calcPaintFlowRate(centripetal: number, viscosity: number, paintLevel: number): number {
  const effectiveG = G + centripetal * 0.5;
  const torricelli = Math.sqrt(2 * effectiveG * Math.max(paintLevel, 0));
  return torricelli / (1 + viscosity * 2);
}

/** Drop radius: thicker when slow (pooling), thinner when fast (stretching).
 *  Mass conservation: the stream's cross-section shrinks with speed, so the
 *  laid-down line width goes as 1/√v — NOT 1/v, which starved fast lines. */
export function calcDropRadius(baseThickness: number, holeThickness: number, speed: number, height: number, flowRate: number, viscosity: number): number {
  const holeRadius = baseThickness * holeThickness * 0.002;
  const speedStretch = 1 / Math.sqrt(1 + speed * 2.5);
  const heightSpread = 1 + Math.max(height, 0) * 0.4;
  const flowFactor = 0.3 + flowRate * 0.7;
  const viscositySpread = 0.7 + (1 - viscosity) * 0.6;
  return holeRadius * speedStretch * heightSpread * flowFactor * viscositySpread;
}

/** Acrylic is OPAQUE: speed makes the line thinner, it does NOT make it
 *  translucent. Opacity stays close to the paint's own opacity, with only a
 *  slight easing when the stream is stretched thin or the flow is dying. */
export function calcDropOpacity(baseOpacity: number, radius: number, baseRadius: number, flowRate: number): number {
  const sizeRatio = Math.min(radius / Math.max(baseRadius, 0.0001), 1);
  return Math.min(baseOpacity * (0.82 + sizeRatio * 0.13) * (0.9 + flowRate * 0.1), 1);
}

/** Plateau–Rayleigh breakup: how starved the paint stream is (0 = continuous jet,
 *  1 = fully broken into drops). A real thin stream from a near-empty bucket doesn't
 *  just stop — surface tension pinches it into droplets, so the drawn line sputters
 *  into beads and gaps before the paint runs out. Viscous paint holds a continuous
 *  thread longer (breakup onset at lower flow). */
export function calcStreamBreakup(normFlow: number, viscosity: number): number {
  const onset = 0.14 + (1 - viscosity) * 0.08;
  if (normFlow >= onset) return 0;
  return Math.min(1, Math.pow(1 - normFlow / onset, 1.4));
}

// ── Liquid rope coiling ──
// A viscous stream falling onto a surface that moves slower than the jet buckles
// and coils like poured honey — the classic "liquid rope coiling" instability.
// In pendulum painting this is what thick paint does when the bucket dawdles:
// instead of laying a straight line it stacks tiny loops. We model the landing
// point of the stream as a small circle traced around the point directly beneath
// the hole. Deliberately rng-FREE (pure function of t), so the offset is baked
// into the stored point coordinates and the WYSIWYG export replays it for free.
/** Buckling frequency (rad/s). At DT = 0.012 one loop spans ~12 sim steps —
 *  comfortably resolved, no aliasing. */
const COIL_FREQ = 46;
/** Thinner paint splashes/stretches rather than ropes — no coiling below this. */
const COIL_ONSET_VISC = 0.45;
/** Coiling only happens when the bucket moves slower than the falling jet
 *  (physics units — the settling phase and the tips of narrow drop-fans). */
const COIL_SPEED_MAX = 0.35;
/** Max coil radius in stream radii — real coils are a couple of stream widths. */
const COIL_RADIUS = 2.6;

/** Landing offset of a coiling viscous stream (normalized canvas units).
 *  Returns {0,0} for thin paint or a fast-moving bucket — most of the pattern
 *  is untouched; coils appear only where real paint would coil. `phase` keeps
 *  multiple holes from coiling in sync (pass e.g. holeIndex · golden angle). */
export function calcRopeCoiling(
  t: number,
  speed: number,
  viscosity: number,
  streamRadius: number,
  phase: number,
): { dx: number; dy: number } {
  const thick = (viscosity - COIL_ONSET_VISC) / (1 - COIL_ONSET_VISC);
  if (thick <= 0) return { dx: 0, dy: 0 };
  const slow = 1 - speed / COIL_SPEED_MAX;
  if (slow <= 0) return { dx: 0, dy: 0 };
  // slow² ramps the coil in gently as the bucket decelerates.
  const r = streamRadius * COIL_RADIUS * Math.min(thick, 1) * slow * slow;
  const a = COIL_FREQ * t + phase;
  return { dx: r * Math.cos(a), dy: r * Math.sin(a) };
}

// ── Ballistic stream lag ──
// The paint leaves the outlet WITH the bucket's horizontal velocity and needs a
// finite time to fall to the canvas, so it lands AHEAD of the bucket along the
// direction of motion — never directly beneath the hole. The fall is shortened
// by the stream's downward Torricelli exit speed (a full bucket squirts fast and
// lands almost beneath the hole; a starving stream drifts further) and lengthened
// when the swing arc lifts the bucket. Deliberately rng-FREE (pure function of
// state) and baked into the stored point coordinates by PaintCanvas, so the
// WYSIWYG export replays it for free and the rng call order is untouched.
/** The bucket outlet hangs this far above the canvas (m) at rest. */
const STREAM_GAP = 0.1;
/** Cap on the extra fall height from the swing arc (m) — real painters keep the
 *  rig low; without a cap wide throws on long strings overshoot the canvas. */
const SWING_RISE_MAX = 0.25;
/** Tilted-outlet spread: the bucket hangs ALONG the string, so the jet leaves
 *  the hole slanted — its horizontal component points radially OUTWARD (away
 *  from the pivot) with magnitude exitSpeed·sin(swing angle). 0.2 calibrates
 *  the model's exaggerated Torricelli head (≈1 m of paint) down to a real
 *  bucket's, so the drift stays a gentle ~2% of the canvas at full flow. */
const TILT_SPREAD = 0.2;
/** Cap on the outward drift per unit displacement — extreme manual setups
 *  (short string, far drop, watery paint) must not spray off the canvas. */
const TILT_MAX = 0.12;

/** Landing offset of the falling stream (physics units — caller applies SCALE).
 *  `zHeight` is calcBobHeight's normalized rise (r²/L); the real rise is r²/2L.
 *  `x, y` = bob displacement from center: a full bucket's slanted jet pushes the
 *  outer loops outward (∝ r and the Torricelli flow), the dying flow doesn't. */
export function calcStreamAdvection(
  vx: number,
  vy: number,
  zHeight: number,
  stringLength: number,
  exitSpeed: number,
  x = 0,
  y = 0,
): { dx: number; dy: number } {
  const h = STREAM_GAP + Math.min(zHeight * stringLength * 0.5, SWING_RISE_MAX);
  // h = v₀t + ½gt² → t = (√(v₀² + 2gh) − v₀)/g, v₀ = downward exit speed.
  const tFall = (Math.sqrt(exitSpeed * exitSpeed + 2 * G * h) - exitSpeed) / G;
  // sin(swing angle) ≈ r/L → outward drift = exitSpeed·(r/L)·tFall, per unit r.
  const tilt = Math.min(TILT_SPREAD * exitSpeed * tFall / stringLength, TILT_MAX);
  return { dx: vx * tFall + x * tilt, dy: vy * tFall + y * tilt };
}

// ── Terminal drain pool ──
// When the swing has died below the stop threshold the bucket hangs (almost)
// still over one spot. If paint remains, it doesn't vanish — it keeps draining
// straight down and spreads into a puddle at the rest point, exactly like the
// dense center pool of a real pendulum piece left to finish on its own.
// (Runs that end because the bucket is EMPTY, or that the artist stops by hand
// — the "lift the bucket away" move — get no pool.)

/** Pools smaller than this (normalized units ≈ 6px live) are skipped entirely,
 *  so the threshold is resolution-independent — never a fixed pixel floor. */
export const END_POOL_MIN_RADIUS = 0.002;

/** Radius of the terminal drain pool (normalized canvas units). The remaining
 *  volume drains into a disc, so area ∝ volume → r ∝ √V; watery paint spreads
 *  wider, thick paint mounds up. Capped — a real canvas only absorbs so much. */
export function calcEndPoolRadius(
  paintLevel: number,
  bucketCapacity: number,
  holeCount: number,
  viscosity: number,
): number {
  if (paintLevel <= 0.01) return 0;
  const vol = (paintLevel * bucketCapacity) / Math.max(holeCount, 1);
  const spread = 0.8 + (1 - viscosity) * 0.7;
  return Math.min(0.0035 * Math.sqrt(vol) * spread, 0.028);
}

export function calcCentripetalAccel(vx: number, vy: number, prevVx: number, prevVy: number, dt: number): number {
  const ax = (vx - prevVx) / dt;
  const ay = (vy - prevVy) / dt;
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < 0.001) return 0;
  return Math.abs(vx * ay - vy * ax) / speed;
}

export function shouldSplash(speed: number, dropRadius: number, viscosity: number, splashIntensity: number): { splash: boolean; particleCount: number; maxSpeed: number } {
  const weber = speed * speed * dropRadius * 1000;
  const threshold = 0.3 + viscosity * 1.5;
  if (weber < threshold || splashIntensity <= 0) return { splash: false, particleCount: 0, maxSpeed: 0 };
  const intensity = Math.sqrt(weber / threshold) * splashIntensity;
  return { splash: true, particleCount: Math.min(Math.floor(1 + intensity * 2), 8), maxSpeed: speed * 0.15 * splashIntensity * (1 - viscosity * 0.5) };
}

export function calcPaintLevel(totalFlowed: number, holeCount: number, bucketCapacity: number): number {
  return Math.max(0, 1 - (totalFlowed * holeCount) / bucketCapacity);
}
