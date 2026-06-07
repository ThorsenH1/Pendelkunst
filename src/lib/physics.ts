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
    // 'drop': a gentle, fixed perpendicular nudge (CCW) opens the line into a
    // graceful precessing ellipse instead of a degenerate straight stroke.
    const tangentAngle = angle - Math.PI / 2;
    const vMag = omega0 * dist * 0.7;
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

  return {
    xComponents: [{ amplitude: Rx, frequency: omegaDX, phase: phiX, damping: gamma }],
    yComponents: [{ amplitude: Ry, frequency: omegaDY, phase: phiY, damping: gamma }],
  };
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
  return { x, y };
}

export function calcVelocity(t: number, config: HarmonographConfig) {
  return {
    vx: evalDerivative(config.xComponents, t),
    vy: evalDerivative(config.yComponents, t),
  };
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

/** Drop radius: thicker when slow (pooling), thinner when fast (stretching) */
export function calcDropRadius(baseThickness: number, holeThickness: number, speed: number, height: number, flowRate: number, viscosity: number): number {
  const holeRadius = baseThickness * holeThickness * 0.002;
  const speedStretch = 1 / (1 + speed * 2.5);
  const heightSpread = 1 + Math.max(height, 0) * 0.4;
  const flowFactor = 0.3 + flowRate * 0.7;
  const viscositySpread = 0.7 + (1 - viscosity) * 0.6;
  return holeRadius * speedStretch * heightSpread * flowFactor * viscositySpread;
}

export function calcDropOpacity(baseOpacity: number, radius: number, baseRadius: number, flowRate: number): number {
  const sizeRatio = Math.min(radius / Math.max(baseRadius, 0.0001), 2);
  return Math.min(baseOpacity * (0.4 + sizeRatio * 0.4) * (0.5 + flowRate * 0.5), 1);
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
