import {
  SimulationSettings,
  HoleConfig,
  BrushType,
  ThrowMode,
  CanvasMotionMode,
} from './types';
import { createDefaultSettings } from './presets';

/**
 * Shareable links: a painting = settings + seed (the app is fully deterministic),
 * so the whole recipe fits in a URL fragment — no backend needed.
 *
 * Format: `#del=<base64url(JSON {v, s})>`. The fragment never reaches the server.
 * Decoding NEVER trusts the payload: every field is validated, clamped to the UI's
 * ranges and backfilled from defaults, so a mangled or malicious link can neither
 * crash the app nor start a degenerate run (e.g. damping 0 or stringLength 0).
 */

const SHARE_VERSION = 1;
/** Fragment parameter name ("del" = share, Norwegian). */
export const SHARE_PARAM = 'del';

const BRUSH_TYPES: readonly BrushType[] = ['bucket', 'fine-brush', 'flat-brush', 'marker', 'drip-stick', 'squeeze', 'spray'];
const THROW_MODES: readonly ThrowMode[] = ['drop', 'throw-cw', 'throw-ccw'];
const MOTION_MODES: readonly CanvasMotionMode[] = ['still', 'circular', 'linear-x', 'linear-y', 'figure8'];
const SYMMETRY_MODES = ['none', 'mirror-x', 'mirror-y', 'mirror-both', 'rotational'] as const;

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function hexColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Validate + clamp an untrusted settings payload into a safe SimulationSettings. */
export function sanitizeSettings(raw: unknown): SimulationSettings {
  const d = createDefaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Record<string, unknown>;
  const pend = (s.pendulum ?? {}) as Record<string, unknown>;
  const paint = (s.paint ?? {}) as Record<string, unknown>;
  const sym = (s.symmetry ?? {}) as Record<string, unknown>;
  const cm = (s.canvasMotion ?? {}) as Record<string, unknown>;
  const dp = (s.dropPosition ?? {}) as Record<string, unknown>;

  const rawHoles = Array.isArray(paint.holes) ? paint.holes.slice(0, 8) : [];
  const holes: HoleConfig[] = rawHoles.map((h) => {
    const hh = (h ?? {}) as Record<string, unknown>;
    return {
      offsetX: num(hh.offsetX, -0.2, 0.2, 0),
      offsetY: num(hh.offsetY, -0.2, 0.2, 0),
      color: hexColor(hh.color, d.paint.holes[0].color),
      thickness: num(hh.thickness, 0.3, 2, 1),
    };
  });

  return {
    pendulum: {
      stringLength: num(pend.stringLength, 0.3, 3.0, d.pendulum.stringLength),
      frequencyRatio: num(pend.frequencyRatio, 0.5, 2.0, d.pendulum.frequencyRatio),
      damping: num(pend.damping, 0.0005, 0.05, d.pendulum.damping),
    },
    paint: {
      holes: holes.length > 0 ? holes : d.paint.holes,
      baseThickness: num(paint.baseThickness, 0.5, 8, d.paint.baseThickness),
      brushType: oneOf(paint.brushType, BRUSH_TYPES, d.paint.brushType),
      splashEnabled: bool(paint.splashEnabled, d.paint.splashEnabled),
      splashIntensity: num(paint.splashIntensity, 0, 1, d.paint.splashIntensity),
      opacity: num(paint.opacity, 0.1, 1, d.paint.opacity),
      viscosity: num(paint.viscosity, 0, 1, d.paint.viscosity),
      bucketCapacity: num(paint.bucketCapacity, 10, 100, d.paint.bucketCapacity),
      wetBlend: bool(paint.wetBlend, false),
    },
    symmetry: {
      mode: oneOf(sym.mode, SYMMETRY_MODES, d.symmetry.mode),
      rotationalOrder: Math.round(num(sym.rotationalOrder, 2, 12, d.symmetry.rotationalOrder)),
    },
    canvasMotion: {
      mode: oneOf(cm.mode, MOTION_MODES, d.canvasMotion.mode),
      speed: num(cm.speed, 0.1, 5, d.canvasMotion.speed),
      amplitude: num(cm.amplitude, 0.05, 1, d.canvasMotion.amplitude),
      damping: num(cm.damping, 0, 0.02, d.canvasMotion.damping),
    },
    dropPosition: {
      x: num(dp.x, -1.5, 1.5, d.dropPosition.x),
      y: num(dp.y, -1.5, 1.5, d.dropPosition.y),
    },
    throwMode: oneOf(s.throwMode, THROW_MODES, d.throwMode),
    throwSpeed: num(s.throwSpeed, 0.3, 3, d.throwSpeed),
    speed: num(s.speed, 0.1, 5, d.speed),
    backgroundColor: hexColor(s.backgroundColor, d.backgroundColor),
    paperTexture: num(s.paperTexture, 0, 1, 0),
    seed: Math.round(num(s.seed, 1, 999999, 1)),
    paintShadow: bool(s.paintShadow, false),
    showRig: bool(s.showRig, true),
  };
}

/** Encode settings as a base64url token for the URL fragment. */
export function encodeShare(settings: SimulationSettings): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: SHARE_VERSION, s: settings }));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a share token. Returns null on any malformed input (never throws). */
export function decodeShare(token: string): SimulationSettings | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    if (p.v !== SHARE_VERSION || !p.s || typeof p.s !== 'object') return null;
    return sanitizeSettings(p.s);
  } catch {
    return null;
  }
}

/** Full share URL for the current page (fragment — never sent to the server). */
export function buildShareUrl(settings: SimulationSettings): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${SHARE_PARAM}=${encodeShare(settings)}`;
}

/** Read a shared setup from the current URL fragment, if present and valid. */
export function readShareFromLocation(): SimulationSettings | null {
  const hash = window.location.hash;
  const prefix = `#${SHARE_PARAM}=`;
  if (!hash.startsWith(prefix)) return null;
  return decodeShare(hash.slice(prefix.length));
}
