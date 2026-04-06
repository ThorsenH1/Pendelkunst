import { SymmetrySettings } from './types';

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

// ── Core paint stroke: thick, opaque, continuous line with soft edges ──
// This is the PRIMARY rendering function. Strokes are the painting, not dots.

export function drawThickStroke(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  radius: number,
  color: string,
  opacity: number,
  viscosity: number,
) {
  if (radius < 0.3) return;

  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (dist < 0.1) return;

  ctx.save();

  // Main thick stroke — full opacity, round cap for continuous look
  ctx.globalAlpha = Math.min(opacity, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Edge darkening for paint depth (thicker paint = more visible edges)
  if (radius > 1.5) {
    const edgeW = radius * (0.15 + viscosity * 0.1);
    ctx.globalAlpha = opacity * (0.12 + viscosity * 0.08);
    ctx.strokeStyle = darken(color, 0.35);
    ctx.lineWidth = radius * 2 + edgeW;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Inner glow for wet paint specular highlight
    ctx.globalAlpha = opacity * 0.06;
    ctx.strokeStyle = lighten(color, 0.4);
    ctx.lineWidth = radius * 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Small splash dot (for splatter effects only) ──

export function drawSplashDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number,
  color: string,
  opacity: number,
) {
  if (r < 0.2) return;
  ctx.save();
  ctx.globalAlpha = Math.min(opacity, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Tiny edge shadow for 3D
  if (r > 1) {
    ctx.globalAlpha = opacity * 0.15;
    ctx.fillStyle = darken(color, 0.4);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Paint accumulation blob at slow speed / direction changes ──

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

  // Solid opaque center (like real pooled paint)
  ctx.globalAlpha = Math.min(opacity * 0.7, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Soft gradient edge (paint spreading)
  const grad = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${0.5 * opacity})`);
  grad.addColorStop(0.5 + viscosity * 0.3, `rgba(${r},${g},${b},${0.2 * opacity})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  if (radius > 2 && viscosity > 0.3) {
    ctx.globalAlpha = opacity * 0.07;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - radius * 0.15, y - radius * 0.15, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}


// ── High-resolution export renderer ──
// Re-renders from stored points as strokes. This is 100% strokes, no dots as primary.

export function renderPointsHighRes(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number; fromX?: number; fromY?: number; radius: number; color: string; opacity: number; viscosity?: number }>,
  canvasSize: number,
  symmetry: SymmetrySettings,
  backgroundColor: string
) {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Render all strokes with full quality
  for (const p of points) {
    const x2 = p.x * canvasSize;
    const y2 = p.y * canvasSize;
    const r = p.radius * canvasSize;
    const visc = p.viscosity ?? 0.5;

    if (p.fromX != null && p.fromY != null) {
      // Connected stroke segment (primary visual)
      const x1 = p.fromX * canvasSize;
      const y1 = p.fromY * canvasSize;
      const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (d < canvasSize * 0.15 && d > 0.5) {
        const transforms2 = getSymmetryTransforms(x2, y2, canvasSize, symmetry);
        const transforms1 = getSymmetryTransforms(x1, y1, canvasSize, symmetry);
        for (let i = 0; i < transforms2.length; i++) {
          drawThickStroke(ctx, transforms1[i].x, transforms1[i].y, transforms2[i].x, transforms2[i].y, r, p.color, p.opacity, visc);
        }
      }
    } else {
      // Starting point — draw a small paint blob
      if (r > 0.3) {
        for (const t of getSymmetryTransforms(x2, y2, canvasSize, symmetry)) {
          drawPaintBlob(ctx, t.x, t.y, r * 0.8, p.color, p.opacity * 0.5, visc);
        }
      }
    }
  }
}
