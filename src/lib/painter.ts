import { SymmetrySettings, BrushType, PaintPoint } from './types';

// ═══════════════════════════════════════════════════════════
// DETERMINISTIC RNG
// Every stroke carries a seed so the live canvas and the
// high-resolution export render bit-for-bit identically.
// mulberry32: fast, well-distributed 32-bit PRNG.
// ═══════════════════════════════════════════════════════════

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a per-symmetry-copy seed from a point's base seed. */
export function copySeed(baseSeed: number, copyIndex: number): number {
  return (baseSeed * 2654435761 + copyIndex * 40503) >>> 0;
}

// ── Color helpers ──

function parseColor(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = parseColor(hex);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = parseColor(hex);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))},${Math.min(255, Math.round(g + (255 - g) * amount))},${Math.min(255, Math.round(b + (255 - b) * amount))})`;
}

function varyColor(hex: string, amount: number, rng: Rng): string {
  const [r, g, b] = parseColor(hex);
  const vary = (c: number) => Math.max(0, Math.min(255, Math.round(c + (rng() - 0.5) * 2 * amount * 255)));
  return `rgb(${vary(r)},${vary(g)},${vary(b)})`;
}

// ═══════════════════════════════════════════════════════════
// PAPER / CANVAS TEXTURE
// Deterministic grain drawn under the paint. Speck/fiber COUNTS
// are fixed (not size-dependent) and positions come from one
// seeded rng, so live 2048px and any export size render the
// same normalized pattern — the WYSIWYG invariant holds.
// ═══════════════════════════════════════════════════════════

const TEXTURE_SEED = 0xc0ffee;

export function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  size: number,
  strength: number,
) {
  if (strength <= 0) return;
  const rng = mulberry32(TEXTURE_SEED);
  ctx.save();

  // Fine tooth: tiny specks, half darker / half lighter than the ground.
  const speckCount = 9000;
  for (let i = 0; i < speckCount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = (0.3 + rng() * 0.9) * (size / 2048);
    const dark = rng() < 0.5;
    ctx.globalAlpha = strength * (0.015 + rng() * 0.035);
    ctx.fillStyle = dark ? '#000000' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Weave fibers: faint short horizontal/vertical threads, like canvas weave.
  const fiberCount = 260;
  for (let i = 0; i < fiberCount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = (10 + rng() * 60) * (size / 2048);
    const horizontal = rng() < 0.5;
    ctx.globalAlpha = strength * (0.008 + rng() * 0.02);
    ctx.strokeStyle = rng() < 0.5 ? '#000000' : '#ffffff';
    ctx.lineWidth = (0.4 + rng() * 0.7) * (size / 2048);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (horizontal ? len : 0), y + (horizontal ? 0 : len));
    ctx.stroke();
  }

  ctx.restore();
}

// ── Symmetry ──

export function getSymmetryTransforms(x: number, y: number, size: number, sym: SymmetrySettings): Array<{ x: number; y: number }> {
  const cx = size / 2, cy = size / 2;
  const pts: Array<{ x: number; y: number }> = [{ x, y }];
  const dx = x - cx, dy = y - cy;

  switch (sym.mode) {
    case 'mirror-x':
      pts.push({ x: cx - dx, y });
      break;
    case 'mirror-y':
      pts.push({ x, y: cy - dy });
      break;
    case 'mirror-both':
      pts.push({ x: cx - dx, y }, { x, y: cy - dy }, { x: cx - dx, y: cy - dy });
      break;
    case 'rotational':
      for (let i = 1; i < sym.rotationalOrder; i++) {
        const a = (2 * Math.PI * i) / sym.rotationalOrder;
        pts.push({ x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) });
      }
      break;
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════
// BRUSH-TYPE STROKE RENDERERS  (all deterministic via rng)
// ═══════════════════════════════════════════════════════════

/** Bucket hole: thick blobby paint, irregular edges, pools at slow points */
function strokeBucket(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, viscosity: number, speed: number, rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const speedVar = 1 / (1 + speed * 0.5);
  const wobble = 1 + (rng() - 0.5) * 0.25 * (1 - viscosity);
  const r = radius * speedVar * wobble;

  ctx.globalAlpha = Math.min(opacity * (0.9 + rng() * 0.1), 1);
  ctx.strokeStyle = varyColor(color, 0.015, rng);
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (r > 2) {
    const edgeCount = Math.floor(dist / (r * 0.8)) + 1;
    for (let i = 0; i < edgeCount; i++) {
      const t = rng();
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;
      const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const side = rng() > 0.5 ? 1 : -1;
      const blobR = r * (0.15 + rng() * 0.35);
      const bx = mx + Math.cos(angle) * side * (r + blobR * 0.3);
      const by = my + Math.sin(angle) * side * (r + blobR * 0.3);
      ctx.globalAlpha = opacity * (0.25 + rng() * 0.25);
      ctx.fillStyle = varyColor(color, 0.025, rng);
      ctx.beginPath();
      ctx.arc(bx, by, blobR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wet-edge ("coffee ring"): real paint dries darker along the stroke edges.
  if (r > 1.5) {
    const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const ex = Math.cos(angle) * r * 0.85;
    const ey = Math.sin(angle) * r * 0.85;
    ctx.globalAlpha = opacity * (0.1 + viscosity * 0.08);
    ctx.strokeStyle = darken(color, 0.28);
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x1 + ex * s, y1 + ey * s);
      ctx.lineTo(x2 + ex * s, y2 + ey * s);
      ctx.stroke();
    }
  }

  // Wet sheen: a faint light streak along the middle of slow, fat strokes.
  if (r > 3 && speed < 0.8) {
    ctx.globalAlpha = opacity * 0.07 * (1 - viscosity * 0.4);
    ctx.strokeStyle = lighten(color, 0.55);
    ctx.lineWidth = r * 0.45;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

/** Fine brush: thin, elegant line with pressure variation */
function strokeFineBrush(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, _viscosity: number, speed: number, _rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const pressure = 0.45 + 0.55 / (1 + speed * 1.5);
  const r = radius * 0.4 * pressure;

  ctx.globalAlpha = Math.min(opacity * (0.85 + pressure * 0.15), 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(r * 2, 0.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (speed < 0.5 && r > 1) {
    ctx.globalAlpha = opacity * 0.08;
    ctx.lineWidth = r * 3.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

/** Flat brush: wide stroke with visible bristle lines */
function strokeFlatBrush(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, viscosity: number, _speed: number, rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const r = radius * 1.3;
  const bristleCount = Math.max(3, Math.floor(r * 0.5));

  for (let b = 0; b < bristleCount; b++) {
    const t = (b / (bristleCount - 1)) - 0.5;
    const spread = r * 2 * t;
    const bristleWobble = (rng() - 0.5) * r * 0.1;
    const bx1 = x1 + perpX * (spread + bristleWobble);
    const by1 = y1 + perpY * (spread + bristleWobble);
    const bx2 = x2 + perpX * (spread + bristleWobble * 0.7);
    const by2 = y2 + perpY * (spread + bristleWobble * 0.7);

    const bristleWidth = (r * 2 / bristleCount) * (0.7 + rng() * 0.6);
    const bristleOpacity = opacity * (0.75 + rng() * 0.25) * (1 - Math.abs(t) * 0.25);

    ctx.globalAlpha = Math.min(bristleOpacity, 1);
    ctx.strokeStyle = varyColor(color, 0.015, rng);
    ctx.lineWidth = bristleWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.lineTo(bx2, by2);
    ctx.stroke();
  }

  if (r > 2) {
    ctx.globalAlpha = opacity * 0.1 * viscosity;
    ctx.strokeStyle = darken(color, 0.25);
    const edgeW = r * 0.15;
    for (const side of [-1, 1]) {
      ctx.lineWidth = edgeW;
      ctx.beginPath();
      ctx.moveTo(x1 + perpX * r * side, y1 + perpY * r * side);
      ctx.lineTo(x2 + perpX * r * side, y2 + perpY * r * side);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Marker/felt-tip: a SOLID, complete ink line with a slightly saturated core */
function strokeMarker(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, _viscosity: number, _speed: number, _rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const r = radius * 0.7;

  // Full-strength ink — a real marker line is complete, never washed out.
  ctx.globalAlpha = Math.min(opacity, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(r * 2, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Ink pooling: slightly darker, saturated core.
  ctx.globalAlpha = opacity * 0.3;
  ctx.strokeStyle = darken(color, 0.12);
  ctx.lineWidth = Math.max(r * 1.1, 0.6);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.restore();
}

/** Drip stick: irregular — alternating thin drizzles and fat drips */
function strokeDripStick(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, viscosity: number, speed: number, rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  // Seeded, not position-based: position-based phase creates ugly coherent
  // diagonal bands of globules across the whole painting.
  const isGlobule = rng() < 0.3 && speed < 1.5;
  const r = isGlobule ? radius * (1.2 + rng() * 0.8) : radius * (0.18 + rng() * 0.25);

  ctx.globalAlpha = Math.min(opacity * (isGlobule ? 0.95 : 0.82 + rng() * 0.18), 1);
  ctx.strokeStyle = varyColor(color, 0.025, rng);
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (isGlobule) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.globalAlpha = opacity * 0.4;
    ctx.fillStyle = varyColor(color, 0.03, rng);
    ctx.beginPath();
    ctx.arc(mx + (rng() - 0.5) * r, my + (rng() - 0.5) * r, r * (0.5 + rng() * 0.5), 0, Math.PI * 2);
    ctx.fill();

    if (rng() < 0.15 * (1 - viscosity)) {
      const dripLen = r * (1 + rng() * 3);
      const jitter = (rng() - 0.5) * r * 0.3;
      ctx.globalAlpha = opacity * 0.3;
      ctx.lineWidth = r * 0.2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + jitter, my + dripLen);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + jitter, my + dripLen, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Squeeze bottle: smooth, raised, consistent line */
function strokeSqueeze(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, _viscosity: number, _speed: number, _rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const r = radius * 0.85;

  ctx.globalAlpha = Math.min(opacity, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.globalAlpha = opacity * 0.12;
  ctx.strokeStyle = lighten(color, 0.5);
  ctx.lineWidth = r * 0.7;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.globalAlpha = opacity * 0.08;
  ctx.strokeStyle = darken(color, 0.4);
  ctx.lineWidth = r * 2.3;
  ctx.beginPath();
  ctx.moveTo(x1 + r * 0.1, y1 + r * 0.15);
  ctx.lineTo(x2 + r * 0.1, y2 + r * 0.15);
  ctx.stroke();

  ctx.restore();
}

/** Spray can: scattered fine dots in a cone */
function strokeSpray(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, _viscosity: number, _speed: number, rng: Rng,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const sprayRadius = radius * 3;
  const dotCount = Math.floor(5 + radius * 2 + rng() * 3);
  const [cr, cg, cb] = parseColor(color);

  for (let i = 0; i < dotCount; i++) {
    const t = rng();
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;

    const angle = rng() * Math.PI * 2;
    const spread = sprayRadius * Math.sqrt(rng()) * (0.3 + rng() * 0.7);
    const dx = mx + Math.cos(angle) * spread;
    const dy = my + Math.sin(angle) * spread;

    // Dot size scales with the stroke radius (resolution-independent: the old
    // fixed-pixel size rendered differently at export resolutions).
    const dotR = radius * (0.1 + rng() * 0.4);
    const distFromCenter = spread / sprayRadius;
    const dotOpacity = opacity * (0.55 + rng() * 0.45) * (1 - distFromCenter * 0.35);

    ctx.globalAlpha = Math.min(dotOpacity, 1);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = opacity * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 0.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

export function drawThickStroke(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  radius: number,
  color: string,
  opacity: number,
  viscosity: number,
  brushType: BrushType = 'bucket',
  speed: number = 0,
  seed: number = 1,
) {
  if (radius < 0.3) return;
  const rng = mulberry32(seed);

  switch (brushType) {
    case 'bucket':      strokeBucket(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
    case 'fine-brush':  strokeFineBrush(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
    case 'flat-brush':  strokeFlatBrush(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
    case 'marker':      strokeMarker(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
    case 'drip-stick':  strokeDripStick(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
    case 'squeeze':     strokeSqueeze(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
    case 'spray':       strokeSpray(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed, rng); break;
  }
}

// ═══════════════════════════════════════════════════════════
// REALISTIC SPLASH — elongated teardrops, filaments, power-law sizes
// ═══════════════════════════════════════════════════════════

export function drawSplashDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number,
  color: string,
  opacity: number,
  vx: number = 0,
  vy: number = 0,
  viscosity: number = 0.5,
  seed: number = 1,
) {
  if (r < 0.15) return;
  const rng = mulberry32(seed);
  ctx.save();

  const speed = Math.sqrt(vx * vx + vy * vy);
  const elongation = Math.min(speed * 400, 3);

  if (elongation > 0.5 && r > 0.5) {
    const angle = Math.atan2(vy, vx);
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.globalAlpha = Math.min(opacity, 1);
    ctx.fillStyle = varyColor(color, 0.02, rng);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1 + elongation * 0.5), r * (0.6 + (1 - elongation / 3) * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();

    if (elongation > 1.2 && r > 1) {
      const tailLen = r * elongation * 0.8;
      ctx.globalAlpha = opacity * 0.3;
      ctx.lineWidth = r * 0.3;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.lineTo(-r * 0.5 - tailLen, 0);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = Math.min(opacity, 1);
    ctx.fillStyle = varyColor(color, 0.02, rng);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (viscosity > 0.6 && r > 1 && speed > 0.0001) {
    const filLen = r * 2 * viscosity;
    const angle = Math.atan2(vy, vx);
    ctx.globalAlpha = opacity * 0.15 * viscosity;
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle) * filLen, y - Math.sin(angle) * filLen);
    ctx.stroke();
  }

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// REALISTIC SPLATTER
// A real paint droplet flies through the AIR (invisible — the
// bucket hangs above the canvas) and leaves ONE opaque splat
// where it LANDS: an ellipse elongated along the impact
// direction, plus small satellite droplets thrown ahead.
// The flight is deterministic given the initial state, so one
// stored PaintPoint fully determines the landing.
//   x += vx; y += vy; vy += GRAV; v *= drag; life -= decay
// ═══════════════════════════════════════════════════════════

export const SPLASH_GRAVITY = 0.00003;

export function splashDrag(viscosity: number): number {
  return 0.96 + viscosity * 0.03;
}

/** One landed splat. (x, y, r) in pixels; (vxNorm, vyNorm) in NORMALIZED
 *  units/step so elongation is resolution-independent. Solid paint alpha. */
export function drawSplashSplat(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number,
  color: string,
  opacity: number,
  vxNorm: number, vyNorm: number,
  viscosity: number,
  seed: number,
) {
  if (r < 0.2) return;
  const rng = mulberry32(seed);
  ctx.save();

  const speed = Math.sqrt(vxNorm * vxNorm + vyNorm * vyNorm);
  // Fast impacts smear into elongated splats; thick paint stays rounder.
  const elong = Math.min(speed * 900, 2.5) * (1 - viscosity * 0.4);
  const angle = Math.atan2(vyNorm, vxNorm);

  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.globalAlpha = Math.min(opacity * (0.88 + rng() * 0.12), 1);
  ctx.fillStyle = varyColor(color, 0.02, rng);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (1.1 + elong * 0.5), r * Math.max(1.05 - elong * 0.14, 0.55), 0, 0, Math.PI * 2);
  ctx.fill();

  // Pointed nose in the impact direction.
  if (elong > 0.6) {
    ctx.beginPath();
    ctx.ellipse(r * (0.9 + elong * 0.55), (rng() - 0.5) * r * 0.3, r * 0.45, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Satellite droplets thrown ahead of the main splat.
  const satCount = r > 1 ? Math.round((rng() * 2 + elong) * (1 - viscosity * 0.5)) : 0;
  for (let i = 0; i < satCount; i++) {
    const dist = r * (1.8 + rng() * 3.5);
    const off = (rng() - 0.5) * r * 1.8;
    const sr = r * (0.12 + rng() * 0.22);
    ctx.globalAlpha = Math.min(opacity * (0.8 + rng() * 0.2), 1);
    ctx.beginPath();
    ctx.arc(dist, off, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Replay one droplet's deterministic flight (drawing nothing in the air) and
 *  draw the landing splat — EXACTLY the same integration as the live loop. */
export function drawSplashTrail(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number; vx: number; vy: number; radius: number; color: string; opacity: number; decay: number; seed: number },
  viscosity: number,
  canvasSize: number,
  symmetry: SymmetrySettings,
) {
  let x = p.x, y = p.y, vx = p.vx, vy = p.vy, life = 1;
  const drag = splashDrag(viscosity);
  while (life > 0) {
    x += vx; y += vy;
    vy += SPLASH_GRAVITY;
    vx *= drag; vy *= drag;
    life -= p.decay;
  }
  const copies = getSymmetryTransforms(x * canvasSize, y * canvasSize, canvasSize, symmetry);
  for (let i = 0; i < copies.length; i++) {
    drawSplashSplat(ctx, copies[i].x, copies[i].y, p.radius * canvasSize, p.color, p.opacity, vx, vy, viscosity, copySeed(p.seed, i));
  }
}

// ── Paint accumulation blob (used for layer-start dots / loaded points) ──

export function drawPaintBlob(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  color: string,
  opacity: number,
  viscosity: number,
  seed: number = 1,
) {
  if (radius < 0.5) return;
  const rng = mulberry32(seed);

  ctx.save();
  const [r, g, b] = parseColor(color);

  ctx.globalAlpha = Math.min(opacity * 0.7, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();

  const blobCount = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < blobCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = radius * (0.3 + rng() * 0.5);
    const bR = radius * (0.15 + rng() * 0.25);
    ctx.globalAlpha = opacity * (0.2 + rng() * 0.3);
    ctx.fillStyle = varyColor(color, 0.02, rng);
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, bR, 0, Math.PI * 2);
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${0.5 * opacity})`);
  grad.addColorStop(0.5 + viscosity * 0.3, `rgba(${r},${g},${b},${0.2 * opacity})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// HIGH-RESOLUTION EXPORT RENDERER
// Replays stored points at any resolution. Because every point
// carries its own seed, the result is identical (scaled) to the
// live canvas — true WYSIWYG export.
// ═══════════════════════════════════════════════════════════

function renderOnePoint(
  ctx: CanvasRenderingContext2D,
  p: PaintPoint,
  canvasSize: number,
  symmetry: SymmetrySettings,
) {
  const x2 = p.x * canvasSize;
  const y2 = p.y * canvasSize;
  const r = p.radius * canvasSize;
  const visc = p.viscosity ?? 0.5;
  const brush = p.brushType ?? 'bucket';
  const spd = p.speed ?? 0;
  const baseSeed = p.seed ?? 1;

  // Wet-on-wet points composite with multiply, like real pigment layering.
  ctx.globalCompositeOperation = p.blend ? 'multiply' : 'source-over';

  if (p.isSplash) {
    if (p.decay != null) {
      // Droplet point: replay the deterministic flight, splat at the landing.
      drawSplashTrail(
        ctx,
        { x: p.x, y: p.y, vx: p.vx ?? 0, vy: p.vy ?? 0, radius: p.radius, color: p.color, opacity: p.opacity, decay: p.decay, seed: baseSeed },
        visc, canvasSize, symmetry,
      );
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    // Legacy single-dot splash point (older gallery paintings).
    if (r < 0.15) { ctx.globalCompositeOperation = 'source-over'; return; }
    const vx = (p.vx ?? 0) * canvasSize;
    const vy = (p.vy ?? 0) * canvasSize;
    const copies = getSymmetryTransforms(x2, y2, canvasSize, symmetry);
    for (let i = 0; i < copies.length; i++) {
      drawSplashDot(ctx, copies[i].x, copies[i].y, r, p.color, p.opacity, vx, vy, visc, copySeed(baseSeed, i));
    }
    ctx.globalCompositeOperation = 'source-over';
    return;
  }

  if (p.fromX != null && p.fromY != null) {
    const x1 = p.fromX * canvasSize;
    const y1 = p.fromY * canvasSize;
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    // Both bounds scale with resolution so the export replays exactly what live
    // drew: live paints every merged segment (≥ 0.4px at 3072), and a fixed
    // 0.5px floor silently dropped the dense-center micro-segments at export
    // sizes ≤ 3072. 1e-4 · canvasSize ≈ the live 0.3px floor, scaled.
    if (d < canvasSize * 0.15 && d > canvasSize * 1e-4) {
      const t2 = getSymmetryTransforms(x2, y2, canvasSize, symmetry);
      const t1 = getSymmetryTransforms(x1, y1, canvasSize, symmetry);
      for (let i = 0; i < t2.length; i++) {
        drawThickStroke(ctx, t1[i].x, t1[i].y, t2[i].x, t2[i].y, r, p.color, p.opacity, visc, brush, spd, copySeed(baseSeed, i));
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Synchronous render — fine for small/medium sizes and tests. */
export function renderPointsHighRes(
  ctx: CanvasRenderingContext2D,
  points: PaintPoint[],
  canvasSize: number,
  symmetry: SymmetrySettings,
  backgroundColor: string,
  paperTexture = 0,
) {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  drawPaperTexture(ctx, canvasSize, paperTexture);
  for (const p of points) renderOnePoint(ctx, p, canvasSize, symmetry);
}

/** Async chunked render — keeps the UI responsive and reports progress. */
export async function renderPointsHighResAsync(
  ctx: CanvasRenderingContext2D,
  points: PaintPoint[],
  canvasSize: number,
  symmetry: SymmetrySettings,
  backgroundColor: string,
  onProgress?: (fraction: number) => void,
  chunkSize = 4000,
  paperTexture = 0,
): Promise<void> {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  drawPaperTexture(ctx, canvasSize, paperTexture);

  const total = points.length;
  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total);
    for (let i = start; i < end; i++) renderOnePoint(ctx, points[i], canvasSize, symmetry);
    onProgress?.(end / Math.max(total, 1));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  onProgress?.(1);
}
