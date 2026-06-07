'use client';

import { useRef, useEffect, useCallback, useState, MutableRefObject } from 'react';
import { SimulationSettings, SimulationState, PaintPoint, SplashParticle, DropPosition } from '@/lib/types';
import {
  calcPosition, calcVelocity, isSimulationDone, prepareHarmonograph,
  calcPaintFlowRate, calcDropRadius, calcDropOpacity, calcBobHeight,
  calcCentripetalAccel, shouldSplash, calcPaintLevel, calcCanvasOffset,
} from '@/lib/physics';
import { drawThickStroke, drawSplashDot, getSymmetryTransforms, copySeed } from '@/lib/painter';

const PAINT_SIZE = 2048;
const STEPS_PER_FRAME = 14;
const DT = 0.012;
/** Physics->canvas scale: pos [-1,1] maps to canvas [0.05, 0.95]. */
const SCALE = 0.45;
/** Safety cap: stop a single run before memory/perf degrade (very long pieces). */
const MAX_POINTS = 350_000;

interface Props {
  settings: SimulationSettings;
  onSettingsChange: (s: SimulationSettings) => void;
  simState: SimulationState;
  onSimStateChange: (state: SimulationState) => void;
  pointsRef: MutableRefObject<PaintPoint[]>;
  offscreenCanvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  loadImage?: Blob | null;
  onImageLoaded?: () => void;
}

export default function PaintCanvas({
  settings, onSettingsChange, simState, onSimStateChange,
  pointsRef, offscreenCanvasRef, loadImage, onImageLoaded,
}: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sRef = useRef(settings);
  const stateRef = useRef(simState);
  const cbRef = useRef(onSimStateChange);
  const tRef = useRef(0);
  const particles = useRef<SplashParticle[]>([]);
  const raf = useRef(0);
  const prevPos = useRef<{ x: number; y: number } | null>(null);
  const prevVel = useRef({ vx: 0, vy: 0 });
  const totalFlow = useRef(0);
  const prevHolePx = useRef<Map<number, { x: number; y: number }>>(new Map());
  const prevHoleNorm = useRef<Map<number, { x: number; y: number }>>(new Map());
  const prevStateRef = useRef<SimulationState>('idle');
  const seedRef = useRef(1);
  const [canvasSize, setCanvasSize] = useState(600);
  const [dpr, setDpr] = useState(1);
  const [hoveredDrop, setHoveredDrop] = useState<DropPosition | null>(null);

  const nextSeed = () => {
    const s = seedRef.current;
    seedRef.current = (seedRef.current + 1) >>> 0 || 1;
    return s;
  };

  useEffect(() => { setDpr(window.devicePixelRatio || 1); }, []);

  useEffect(() => { sRef.current = settings; }, [settings]);
  useEffect(() => { stateRef.current = simState; }, [simState]);
  useEffect(() => { cbRef.current = onSimStateChange; }, [onSimStateChange]);

  // ── Initialize offscreen paint canvas ──
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = PAINT_SIZE;
    c.height = PAINT_SIZE;
    paintRef.current = c;
    if (offscreenCanvasRef) offscreenCanvasRef.current = c;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = sRef.current.backgroundColor;
    ctx.fillRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize display canvas to fill container ──
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    function onResize() {
      if (!box) return;
      const w = box.clientWidth;
      const h = box.clientHeight;
      const s = Math.max(Math.min(w, h) - 32, 200);
      setCanvasSize(s);
    }
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // ── Update display from paint canvas ──
  const blit = useCallback(() => {
    const d = displayRef.current;
    const p = paintRef.current;
    if (!d || !p) return;
    const ctx = d.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, d.width, d.height);
    ctx.drawImage(p, 0, 0, d.width, d.height);
  }, []);

  // ── Clear paint canvas (fully reset context state) ──
  const clearPaint = useCallback(() => {
    const c = paintRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
    ctx.fillStyle = sRef.current.backgroundColor;
    ctx.fillRect(0, 0, PAINT_SIZE, PAINT_SIZE);
  }, []);

  // Reset just the per-run simulation state (keeps canvas + accumulated points).
  const resetRun = useCallback(() => {
    tRef.current = 0;
    totalFlow.current = 0;
    particles.current = [];
    prevPos.current = null;
    prevVel.current = { vx: 0, vy: 0 };
    prevHolePx.current.clear();
    prevHoleNorm.current.clear();
  }, []);

  // ── State transitions ──
  // idle           -> full reset (blank canvas, clear points)
  // idle -> running -> fresh run
  // running->paused -> freeze (loop simply stops)
  // paused->running -> CONTINUE from where it stopped (no reset)
  // done  ->running -> new layer: reset run but keep canvas + points
  useEffect(() => {
    const prev = prevStateRef.current;

    if (simState === 'idle') {
      resetRun();
      pointsRef.current = [];
      seedRef.current = 1;
      clearPaint();
      blit();
    } else if (simState === 'running') {
      if (prev === 'done' || prev === 'idle') {
        resetRun();
      }
      // prev === 'paused' -> resume seamlessly: keep tRef and all run state.
    }

    prevStateRef.current = simState;
  }, [simState, clearPaint, blit, pointsRef, resetRun]);

  // ── Repaint background when idle ──
  useEffect(() => {
    if (simState === 'idle') { clearPaint(); blit(); }
  }, [settings.backgroundColor, simState, clearPaint, blit]);

  // ── Load saved painting image ──
  useEffect(() => {
    if (!loadImage || !paintRef.current) return;
    const ctx = paintRef.current.getContext('2d')!;
    createImageBitmap(loadImage).then(img => {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, PAINT_SIZE, PAINT_SIZE);
      ctx.drawImage(img, 0, 0, PAINT_SIZE, PAINT_SIZE);
      img.close();
      blit();
      onImageLoaded?.();
    });
  }, [loadImage, blit, onImageLoaded]);

  // ── Click to set drop position (idle/done only) ──
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== 'idle' && stateRef.current !== 'done') return;
    const rect = displayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasNormX = (e.clientX - rect.left) / rect.width;
    const canvasNormY = (e.clientY - rect.top) / rect.height;
    const physX = (canvasNormX - 0.5) / SCALE;
    const physY = (canvasNormY - 0.5) / SCALE;
    const clamped: DropPosition = {
      x: Math.max(-1.5, Math.min(1.5, physX)),
      y: Math.max(-1.5, Math.min(1.5, physY)),
    };
    onSettingsChange({ ...sRef.current, dropPosition: clamped });
  }, [onSettingsChange]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current !== 'idle' && stateRef.current !== 'done') { setHoveredDrop(null); return; }
    const rect = displayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasNormX = (e.clientX - rect.left) / rect.width;
    const canvasNormY = (e.clientY - rect.top) / rect.height;
    const physX = (canvasNormX - 0.5) / SCALE;
    const physY = (canvasNormY - 0.5) / SCALE;
    setHoveredDrop({
      x: Math.max(-1.5, Math.min(1.5, physX)),
      y: Math.max(-1.5, Math.min(1.5, physY)),
    });
  }, []);

  // ── Main animation loop ──
  useEffect(() => {
    if (simState !== 'running') return;
    const paintCtx = paintRef.current?.getContext('2d');
    if (!paintCtx) return;

    let alive = true;
    const animate = () => {
      if (!alive || stateRef.current !== 'running') return;

      const s = sRef.current;
      const ps = s.paint;
      const sym = s.symmetry;
      const drop = s.dropPosition;
      const prepared = prepareHarmonograph(s.pendulum, drop, s.throwMode, s.throwSpeed);

      if (pointsRef.current.length >= MAX_POINTS) { cbRef.current('done'); return; }

      for (let step = 0; step < STEPS_PER_FRAME; step++) {
        const t = tRef.current;
        if (isSimulationDone(t, prepared)) { cbRef.current('done'); return; }

        const pos = calcPosition(t, prepared);
        const vel = calcVelocity(t, prepared);
        const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
        const zHeight = calcBobHeight(pos.x, pos.y, s.pendulum.stringLength);

        const co = calcCanvasOffset(t, s.canvasMotion);

        const centripetal = calcCentripetalAccel(vel.vx, vel.vy, prevVel.current.vx, prevVel.current.vy, DT);
        const paintLevel = calcPaintLevel(totalFlow.current, ps.holes.length, ps.bucketCapacity);
        if (paintLevel <= 0) { cbRef.current('done'); return; }

        const flowRate = calcPaintFlowRate(centripetal, ps.viscosity, paintLevel);
        const normFlow = Math.min(flowRate / 5, 1);

        const cx = 0.5 + pos.x * SCALE + co.ox;
        const cy = 0.5 + pos.y * SCALE + co.oy;

        for (let h = 0; h < ps.holes.length; h++) {
          const hole = ps.holes[h];
          const hx = cx + hole.offsetX;
          const hy = cy + hole.offsetY;

          const baseR = ps.baseThickness * hole.thickness * 0.002;
          const radius = calcDropRadius(ps.baseThickness, hole.thickness, speed, zHeight, normFlow, ps.viscosity);
          const opacity = calcDropOpacity(ps.opacity, radius, baseR, normFlow);

          const turb = (1 - ps.viscosity) * 0.3;
          const jx = (Math.random() - 0.5) * radius * turb;
          const jy = (Math.random() - 0.5) * radius * turb;
          const jr = radius * (0.85 + Math.random() * 0.3);

          const px = (hx + jx) * PAINT_SIZE;
          const py = (hy + jy) * PAINT_SIZE;
          const pr = jr * PAINT_SIZE;

          const normX = hx + jx;
          const normY = hy + jy;

          const strokeSeed = nextSeed();

          const prev = prevHolePx.current.get(h);
          const prevNorm = prevHoleNorm.current.get(h);
          if (prev) {
            const d = Math.sqrt((px - prev.x) ** 2 + (py - prev.y) ** 2);
            if (d < PAINT_SIZE * 0.15 && d > 0.3) {
              const ts = getSymmetryTransforms(px, py, PAINT_SIZE, sym);
              const pts = getSymmetryTransforms(prev.x, prev.y, PAINT_SIZE, sym);
              for (let i = 0; i < ts.length; i++) {
                drawThickStroke(paintCtx, pts[i].x, pts[i].y, ts[i].x, ts[i].y, pr, hole.color, opacity, ps.viscosity, ps.brushType, speed, copySeed(strokeSeed, i));
              }
            }
          }
          prevHolePx.current.set(h, { x: px, y: py });

          pointsRef.current.push({
            x: normX, y: normY,
            fromX: prevNorm?.x, fromY: prevNorm?.y,
            radius: jr, color: hole.color, opacity,
            viscosity: ps.viscosity,
            brushType: ps.brushType,
            speed,
            seed: strokeSeed,
          });
          prevHoleNorm.current.set(h, { x: normX, y: normY });
          totalFlow.current += normFlow * DT * 0.01;

          if (ps.splashEnabled && prevPos.current) {
            const sp = shouldSplash(speed, radius, ps.viscosity, ps.splashIntensity);
            if (sp.splash && Math.random() < 0.35) {
              const moveAngle = Math.atan2(vel.vy, vel.vx);
              for (let p = 0; p < sp.particleCount; p++) {
                const angle = moveAngle + (Math.random() - 0.5) * Math.PI * 1.5;
                const pv = 0.0003 + Math.random() * sp.maxSpeed * 0.01;
                const sizePow = Math.pow(Math.random(), 2.5);
                const splashR = jr * (0.03 + sizePow * 0.35);
                particles.current.push({
                  x: hx, y: hy, vx: Math.cos(angle) * pv, vy: Math.sin(angle) * pv,
                  radius: splashR, color: hole.color, life: 1,
                  decay: 0.015 + Math.random() * 0.05 + ps.viscosity * 0.03,
                  seed: nextSeed(),
                });
              }
            }
          }
        }

        prevPos.current = { x: cx, y: cy };
        prevVel.current = { vx: vel.vx, vy: vel.vy };

        particles.current = particles.current.filter(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.00003;
          p.vx *= 0.96 + ps.viscosity * 0.03;
          p.vy *= 0.96 + ps.viscosity * 0.03;
          p.life -= p.decay;
          if (p.life > 0) {
            const ppx = p.x * PAINT_SIZE, ppy = p.y * PAINT_SIZE, ppr = p.radius * PAINT_SIZE * p.life;
            const pvx = p.vx * PAINT_SIZE, pvy = p.vy * PAINT_SIZE;
            const copies = getSymmetryTransforms(ppx, ppy, PAINT_SIZE, sym);
            for (let i = 0; i < copies.length; i++) {
              drawSplashDot(paintCtx, copies[i].x, copies[i].y, ppr, p.color, p.life * 0.5, pvx, pvy, ps.viscosity, copySeed(p.seed, i));
            }
            pointsRef.current.push({
              x: p.x, y: p.y,
              radius: p.radius * p.life,
              color: p.color,
              opacity: p.life * 0.5,
              vx: p.vx, vy: p.vy,
              viscosity: ps.viscosity,
              isSplash: true,
              seed: p.seed,
            });
            return true;
          }
          return false;
        });

        tRef.current += DT * s.speed;
      }

      blit();

      const display = displayRef.current;
      if (display) {
        const ctx = display.getContext('2d');
        if (ctx) {
          const pos = calcPosition(tRef.current, prepared);
          const co = calcCanvasOffset(tRef.current, sRef.current.canvasMotion);
          const ps = sRef.current.paint;

          const ix = (0.5 + pos.x * SCALE + co.ox) * display.width;
          const iy = (0.5 + pos.y * SCALE + co.oy) * display.height;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ix, iy, 6, 0, Math.PI * 2);
          ctx.stroke();

          const pl = calcPaintLevel(totalFlow.current, ps.holes.length, ps.bucketCapacity);
          const bw = 4, bh = 50, bx = display.width - 16, by = 12;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#fff';
          ctx.fillRect(bx, by, bw, bh);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = pl > 0.2 ? '#818cf8' : '#ef4444';
          ctx.fillRect(bx, by + bh * (1 - pl), bw, bh * pl);
          ctx.globalAlpha = 1;
        }
      }

      raf.current = requestAnimationFrame(animate);
    };

    raf.current = requestAnimationFrame(animate);
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, [simState, blit, pointsRef]);

  useEffect(() => { blit(); }, [canvasSize, blit]);

  const pxW = canvasSize * dpr;
  const pxH = canvasSize * dpr;

  const showDrop = simState === 'idle';
  const dp = settings.dropPosition;
  const dropPxX = (0.5 + dp.x * SCALE) * canvasSize;
  const dropPxY = (0.5 + dp.y * SCALE) * canvasSize;
  const dropDist = Math.sqrt(dp.x * dp.x + dp.y * dp.y);

  const isThrow = settings.throwMode === 'throw-cw' || settings.throwMode === 'throw-ccw';
  const throwAngle = Math.atan2(dp.y, dp.x) + (settings.throwMode === 'throw-cw' ? Math.PI / 2 : -Math.PI / 2);

  return (
    <div ref={boxRef} className="flex-1 flex items-center justify-center w-full h-full relative">
      <div className="relative" style={{ width: canvasSize, height: canvasSize }}>
        <canvas
          ref={displayRef}
          width={pxW}
          height={pxH}
          style={{ width: canvasSize, height: canvasSize }}
          className="canvas-frame rounded-lg block cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          onMouseLeave={() => setHoveredDrop(null)}
          aria-label="Pendelmaleri-lerret. Klikk for a plassere pendelens slipp-punkt."
          role="img"
        />

        {showDrop && (
          <>
            <div
              className="absolute pointer-events-none"
              style={{ left: dropPxX - 12, top: dropPxY - 12, width: 24, height: 24 }}
            >
              <div className="w-full h-full rounded-full border-2 border-indigo-400 bg-indigo-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
              </div>
            </div>

            <svg className="absolute inset-0 pointer-events-none" width={canvasSize} height={canvasSize}>
              <line
                x1={canvasSize / 2} y1={canvasSize / 2}
                x2={dropPxX} y2={dropPxY}
                stroke="rgba(129,140,248,0.3)" strokeWidth="1" strokeDasharray="4 4"
              />
              {isThrow && dropDist > 0.1 && (
                <>
                  <line
                    x1={dropPxX} y1={dropPxY}
                    x2={dropPxX + Math.cos(throwAngle) * 30} y2={dropPxY + Math.sin(throwAngle) * 30}
                    stroke="rgba(168,85,247,0.6)" strokeWidth="2"
                  />
                  <circle
                    cx={dropPxX + Math.cos(throwAngle) * 30}
                    cy={dropPxY + Math.sin(throwAngle) * 30}
                    r="3" fill="rgba(168,85,247,0.6)"
                  />
                </>
              )}
            </svg>

            <div
              className="absolute pointer-events-none text-[10px] bg-gray-900/80 text-indigo-300 px-1.5 py-0.5 rounded"
              style={{ left: dropPxX + 16, top: dropPxY - 8 }}
            >
              {isThrow ? 'Kast' : 'Slipp'}: {Math.round(dropDist / 1.5 * 100)}%
            </div>

            {hoveredDrop && (
              <div
                className="absolute pointer-events-none w-4 h-4 rounded-full border border-indigo-300/40"
                style={{
                  left: (0.5 + hoveredDrop.x * SCALE) * canvasSize - 8,
                  top: (0.5 + hoveredDrop.y * SCALE) * canvasSize - 8,
                }}
              />
            )}

            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="text-[11px] bg-gray-900/80 backdrop-blur text-gray-400 px-3 py-1.5 rounded-full">
                {isThrow
                  ? 'Klikk for a plassere - pendelen kastes i sirkelbevegelse'
                  : 'Klikk for a plassere pendelen - lenger ut = mer energi'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
