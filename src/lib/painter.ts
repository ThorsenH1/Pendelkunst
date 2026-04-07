import { SymmetrySettings, BrushType } from './types';

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

function varyColor(hex: string, amount: number): string {
  const [r, g, b] = parseColor(hex);
  const vary = (c: number) => Math.max(0, Math.min(255, Math.round(c + (Math.random() - 0.5) * 2 * amount * 255)));
  return `rgb(${vary(r)},${vary(g)},${vary(b)})`;
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
// BRUSH-TYPE STROKE RENDERERS
// ═══════════════════════════════════════════════════════════

/** Bucket hole: thick blobby paint, irregular edges, pools at slow points */
function strokeBucket(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, viscosity: number, speed: number,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  // Thickness varies — thicker at slow spots (pooling)
  const speedVar = 1 / (1 + speed * 0.5);
  const wobble = 1 + (Math.random() - 0.5) * 0.25 * (1 - viscosity);
  const r = radius * speedVar * wobble;

  ctx.globalAlpha = Math.min(opacity * (0.85 + Math.random() * 0.15), 1);
  ctx.strokeStyle = varyColor(color, 0.02);
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Irregular edge roughness
  if (r > 2) {
    const edgeCount = Math.floor(dist / (r * 0.8)) + 1;
    for (let i = 0; i < edgeCount; i++) {
      const t = Math.random();
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;
      const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const side = Math.random() > 0.5 ? 1 : -1;
      const blobR = r * (0.15 + Math.random() * 0.35);
      const bx = mx + Math.cos(angle) * side * (r + blobR * 0.3);
      const by = my + Math.sin(angle) * side * (r + blobR * 0.3);
      ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.3);
      ctx.fillStyle = varyColor(color, 0.03);
      ctx.beginPath();
      ctx.arc(bx, by, blobR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Edge darkening
  if (r > 1.5) {
    ctx.globalAlpha = opacity * (0.08 + viscosity * 0.06);
    ctx.strokeStyle = darken(color, 0.3);
    ctx.lineWidth = r * 2 + r * 0.2;
    ctx.lineCap = 'round';
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
  radius: number, color: string, opacity: number, _viscosity: number, speed: number,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const pressure = 0.3 + 0.7 / (1 + speed * 1.5);
  const r = radius * 0.4 * pressure;

  ctx.globalAlpha = Math.min(opacity * (0.7 + pressure * 0.3), 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(r * 2, 0.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Ink bleed at slow speeds
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
  radius: number, color: string, opacity: number, viscosity: number, _speed: number,
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
    const bristleWobble = (Math.random() - 0.5) * r * 0.1;
    const bx1 = x1 + perpX * (spread + bristleWobble);
    const by1 = y1 + perpY * (spread + bristleWobble);
    const bx2 = x2 + perpX * (spread + bristleWobble * 0.7);
    const by2 = y2 + perpY * (spread + bristleWobble * 0.7);

    const bristleWidth = (r * 2 / bristleCount) * (0.6 + Math.random() * 0.6);
    const bristleOpacity = opacity * (0.5 + Math.random() * 0.5) * (1 - Math.abs(t) * 0.4);

    ctx.globalAlpha = Math.min(bristleOpacity, 1);
    ctx.strokeStyle = varyColor(color, 0.015);
    ctx.lineWidth = bristleWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.lineTo(bx2, by2);
    ctx.stroke();
  }

  // Edge accumulation
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

/** Marker/felt-tip: clean edges, consistent width, transparency layering */
function strokeMarker(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, _viscosity: number, _speed: number,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const r = radius * 0.7;
  const [cr, cg, cb] = parseColor(color);

  ctx.globalAlpha = Math.min(opacity * 0.6, 1);
  ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'bevel';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Darker core
  ctx.globalAlpha = opacity * 0.25;
  ctx.lineWidth = r * 1.2;
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
  radius: number, color: string, opacity: number, viscosity: number, speed: number,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const dripPhase = Math.sin((x1 + y1) * 0.03) * 0.5 + 0.5;
  const isGlobule = dripPhase > 0.65 && speed < 1.5;
  const r = isGlobule ? radius * (1.2 + Math.random() * 0.8) : radius * (0.15 + Math.random() * 0.25);

  ctx.globalAlpha = Math.min(opacity * (isGlobule ? 0.9 : 0.65 + Math.random() * 0.3), 1);
  ctx.strokeStyle = varyColor(color, 0.025);
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  if (isGlobule) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.globalAlpha = opacity * 0.4;
    ctx.fillStyle = varyColor(color, 0.03);
    ctx.beginPath();
    ctx.arc(mx + (Math.random() - 0.5) * r, my + (Math.random() - 0.5) * r, r * (0.5 + Math.random() * 0.5), 0, Math.PI * 2);
    ctx.fill();

    // Gravity drip from globule
    if (Math.random() < 0.15 * (1 - viscosity)) {
      const dripLen = r * (1 + Math.random() * 3);
      ctx.globalAlpha = opacity * 0.3;
      ctx.lineWidth = r * 0.2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + (Math.random() - 0.5) * r * 0.3, my + dripLen);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + (Math.random() - 0.5) * r * 0.3, my + dripLen, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Squeeze bottle: smooth, raised, consistent line */
function strokeSqueeze(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  radius: number, color: string, opacity: number, _viscosity: number, _speed: number,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const r = radius * 0.85;

  // Main bead
  ctx.globalAlpha = Math.min(opacity, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Highlight for 3D raised bead
  ctx.globalAlpha = opacity * 0.12;
  ctx.strokeStyle = lighten(color, 0.5);
  ctx.lineWidth = r * 0.7;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Shadow underneath
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
  radius: number, color: string, opacity: number, _viscosity: number, _speed: number,
) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  const sprayRadius = radius * 3;
  const dotCount = Math.floor(4 + radius * 2 + Math.random() * 3);
  const [cr, cg, cb] = parseColor(color);

  for (let i = 0; i < dotCount; i++) {
    const t = Math.random();
    const mx = x1 + (x2 - x1) * t;
    const my = y1 + (y2 - y1) * t;

    const angle = Math.random() * Math.PI * 2;
    const spread = sprayRadius * Math.sqrt(Math.random()) * (0.3 + Math.random() * 0.7);
    const dx = mx + Math.cos(angle) * spread;
    const dy = my + Math.sin(angle) * spread;

    const dotR = 0.3 + Math.random() * 1.5;
    const distFromCenter = spread / sprayRadius;
    const dotOpacity = opacity * (0.15 + Math.random() * 0.35) * (1 - distFromCenter * 0.5);

    ctx.globalAlpha = Math.min(dotOpacity, 1);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Faint core line
  ctx.globalAlpha = opacity * 0.15;
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 0.3;
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
) {
  if (radius < 0.3) return;

  switch (brushType) {
    case 'bucket':      strokeBucket(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
    case 'fine-brush':  strokeFineBrush(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
    case 'flat-brush':  strokeFlatBrush(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
    case 'marker':      strokeMarker(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
    case 'drip-stick':  strokeDripStick(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
    case 'squeeze':     strokeSqueeze(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
    case 'spray':       strokeSpray(ctx, x1, y1, x2, y2, radius, color, opacity, viscosity, speed); break;
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
) {
  if (r < 0.15) return;
  ctx.save();

  const speed = Math.sqrt(vx * vx + vy * vy);
  const elongation = Math.min(speed * 400, 3);

  if (elongation > 0.5 && r > 0.5) {
    // Elongated teardrop
    const angle = Math.atan2(vy, vx);
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.globalAlpha = Math.min(opacity, 1);
    ctx.fillStyle = varyColor(color, 0.02);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1 + elongation * 0.5), r * (0.6 + (1 - elongation / 3) * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();

    // Trailing tail for fast droplets
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
    // Small/slow: circular with slight irregularity
    ctx.globalAlpha = Math.min(opacity, 1);
    ctx.fillStyle = varyColor(color, 0.02);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // High viscosity: filament trail
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

// ── Paint accumulation blob ──

export function drawPaintBlob(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  color: string,
  opacity: number,
  viscosity: number,
) {
  if (radius < 0.5) return;

  ctx.save();
  const [r, g, b] = parseColor(color);

  ctx.globalAlpha = Math.min(opacity * 0.7, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Irregular edge blobs for organic pooling
  const blobCount = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < blobCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.3 + Math.random() * 0.5);
    const bR = radius * (0.15 + Math.random() * 0.25);
    ctx.globalAlpha = opacity * (0.2 + Math.random() * 0.3);
    ctx.fillStyle = varyColor(color, 0.02);
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, bR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft gradient edge
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


// ── High-resolution export renderer ──

export function renderPointsHighRes(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number; fromX?: number; fromY?: number; radius: number; color: string; opacity: number; viscosity?: number; brushType?: BrushType; speed?: number }>,
  canvasSize: number,
  symmetry: SymmetrySettings,
  backgroundColor: string
) {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  for (const p of points) {
    const x2 = p.x * canvasSize;
    const y2 = p.y * canvasSize;
    const r = p.radius * canvasSize;
    const visc = p.viscosity ?? 0.5;
    const brush = p.brushType ?? 'bucket';
    const spd = p.speed ?? 0;

    if (p.fromX != null && p.fromY != null) {
      const x1 = p.fromX * canvasSize;
      const y1 = p.fromY * canvasSize;
      const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (d < canvasSize * 0.15 && d > 0.5) {
        const transforms2 = getSymmetryTransforms(x2, y2, canvasSize, symmetry);
        const transforms1 = getSymmetryTransforms(x1, y1, canvasSize, symmetry);
        for (let i = 0; i < transforms2.length; i++) {
          drawThickStroke(ctx, transforms1[i].x, transforms1[i].y, transforms2[i].x, transforms2[i].y, r, p.color, p.opacity, visc, brush, spd);
        }
      }
    } else {
      if (r > 0.3) {
        for (const t of getSymmetryTransforms(x2, y2, canvasSize, symmetry)) {
          drawPaintBlob(ctx, t.x, t.y, r * 0.8, p.color, p.opacity * 0.5, visc);
        }
      }
    }
  }
}
