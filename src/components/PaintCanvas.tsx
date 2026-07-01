'use client';

import { useRef, useEffect, useCallback, useState, MutableRefObject } from 'react';
import { SimulationSettings, SimulationState, PaintPoint, SplashParticle, DropPosition } from '@/lib/types';
import {
  calcPosition, calcVelocity, isSimulationDone, prepareHarmonograph,
  calcPaintFlowRate, calcDropRadius, calcDropOpacity, calcBobHeight,
  calcCentripetalAccel, shouldSplash, calcPaintLevel, calcCanvasOffset,
} from '@/lib/physics';
import { drawThickStroke, drawSplashSplat, drawPaperTexture, getSymmetryTransforms, copySeed, mulberry32, Rng, SPLASH_GRAVITY, splashDrag } from '@/lib/painter';

const PAINT_SIZE = 3072;
const STEPS_PER_FRAME = 14;
const DT = 0.012;
/** Physics->canvas scale: pos [-1,1] maps to canvas [0.05, 0.95]. */
const SCALE = 0.45;
/** Safety cap: stop a single run before memory/perf degrade (very long pieces).
 *  Splash droplets now store ONE trail point each (not one per step), so full
 *  runs of every preset complete comfortably under this. */
const MAX_POINTS = 1_000_000;
/** Merge stroke segments shorter than this (normalized units ≈ 0.4px live):
 *  the dying pendulum otherwise emits millions of invisible micro-segments. */
const MIN_SEGMENT = 0.4 / PAINT_SIZE;

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
  // Per-run seeded rng: jitter and splash decisions are reproducible from settings.seed.
  const runRngRef = useRef<Rng>(mulberry32(1));
  const layerIndexRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const [canvasSize, setCanvasSize] = useState(600);
  const [dpr, setDpr] = useState(1);
  const [hoveredDrop, setHoveredDrop] = useState<DropPosition | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSupported, setRecSupported] = useState(false);

  const nextSeed = () => {
    const s = seedRef.current;
    seedRef.current = (seedRef.current + 1) >>> 0 || 1;
    return s;
  };

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
    setRecSupported(
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      'captureStream' in HTMLCanvasElement.prototype,
    );
  }, []);

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
    drawPaperTexture(ctx, PAINT_SIZE, sRef.current.paperTexture ?? 0);
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
      layerIndexRef.current = 0;
      clearPaint();
      blit();
    } else if (simState === 'running') {
      if (prev === 'done' || prev === 'idle') {
        resetRun();
        // New run/layer: derive a fresh deterministic rng from the settings seed
        // and the layer index, so layers differ but the whole piece replays from one seed.
        layerIndexRef.current += 1;
        const base = (sRef.current.seed ?? 1) >>> 0;
        runRngRef.current = mulberry32((Math.imul(base, 2654435761) + layerIndexRef.current * 7919) >>> 0);
      }
      // prev === 'paused' -> resume seamlessly: keep tRef and all run state.
    } else if (simState === 'done') {
      // Wipe the rig/HUD overlay so the finished painting shows clean.
      blit();
    }

    prevStateRef.current = simState;
  }, [simState, clearPaint, blit, pointsRef, resetRun]);

  // ── Repaint background when idle ──
  useEffect(() => {
    if (simState === 'idle') { clearPaint(); blit(); }
  }, [settings.backgroundColor, settings.paperTexture, simState, clearPaint, blit]);

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

  // ── Video recording of the painting process (display canvas → webm) ──
  const startRecording = useCallback(() => {
    const canvas = displayRef.current;
    if (!canvas || recorderRef.current) return;
    try {
      const stream = canvas.captureStream(30);
      const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4']
        .find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
      recChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = rec.mimeType || 'video/webm';
        const blob = new Blob(recChunksRef.current, { type });
        recChunksRef.current = [];
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pendelkunst-video.${type.includes('mp4') ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(500);
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  // Stop cleanly if the component unmounts mid-recording.
  useEffect(() => () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

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
      const rng = runRngRef.current;
      const wet = ps.wetBlend === true;

      // When the run ends, any droplet still in the air lands NOW — the live
      // canvas must show every splat the export will replay.
      const landRemainingParticles = () => {
        const drag = splashDrag(ps.viscosity);
        for (const p of particles.current) {
          while (p.life > 0) {
            p.x += p.vx; p.y += p.vy;
            p.vy += SPLASH_GRAVITY;
            p.vx *= drag;
            p.vy *= drag;
            p.life -= p.decay;
          }
          const copies = getSymmetryTransforms(p.x * PAINT_SIZE, p.y * PAINT_SIZE, PAINT_SIZE, sym);
          for (let i = 0; i < copies.length; i++) {
            drawSplashSplat(paintCtx, copies[i].x, copies[i].y, p.radius * PAINT_SIZE, p.color, ps.opacity, p.vx, p.vy, ps.viscosity, copySeed(p.seed, i));
          }
        }
        particles.current = [];
      };
      const finishRun = () => {
        paintCtx.globalCompositeOperation = wet ? 'multiply' : 'source-over';
        landRemainingParticles();
        paintCtx.globalCompositeOperation = 'source-over';
        cbRef.current('done');
      };

      if (pointsRef.current.length >= MAX_POINTS) { finishRun(); return; }

      // Wet-on-wet: overlapping strokes multiply like real pigment on the canvas.
      paintCtx.globalCompositeOperation = wet ? 'multiply' : 'source-over';

      for (let step = 0; step < STEPS_PER_FRAME; step++) {
        const t = tRef.current;
        if (isSimulationDone(t, prepared)) { finishRun(); return; }

        const pos = calcPosition(t, prepared);
        const vel = calcVelocity(t, prepared);
        const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
        const zHeight = calcBobHeight(pos.x, pos.y, s.pendulum.stringLength);

        const co = calcCanvasOffset(t, s.canvasMotion);

        const centripetal = calcCentripetalAccel(vel.vx, vel.vy, prevVel.current.vx, prevVel.current.vy, DT);
        const paintLevel = calcPaintLevel(totalFlow.current, ps.holes.length, ps.bucketCapacity);
        if (paintLevel <= 0) { finishRun(); return; }

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
          const jx = (rng() - 0.5) * radius * turb;
          const jy = (rng() - 0.5) * radius * turb;
          const jr = radius * (0.85 + rng() * 0.3);

          const px = (hx + jx) * PAINT_SIZE;
          const py = (hy + jy) * PAINT_SIZE;
          const pr = jr * PAINT_SIZE;

          const normX = hx + jx;
          const normY = hy + jy;

          const prevNorm = prevHoleNorm.current.get(h);
          const segLen = prevNorm
            ? Math.sqrt((normX - prevNorm.x) ** 2 + (normY - prevNorm.y) ** 2)
            : Infinity;

          // Merge micro-segments: the dying pendulum moves less than a pixel per
          // step — carry until the segment is long enough to actually draw.
          if (segLen >= MIN_SEGMENT) {
            const strokeSeed = nextSeed();
            const prev = prevHolePx.current.get(h);
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
              blend: wet || undefined,
            });
            prevHoleNorm.current.set(h, { x: normX, y: normY });
          }
          totalFlow.current += normFlow * DT * 0.01;

          if (ps.splashEnabled && prevPos.current) {
            const sp = shouldSplash(speed, radius, ps.viscosity, ps.splashIntensity);
            if (sp.splash && rng() < 0.35) {
              const moveAngle = Math.atan2(vel.vy, vel.vx);
              for (let p = 0; p < sp.particleCount; p++) {
                const angle = moveAngle + (rng() - 0.5) * Math.PI * 1.5;
                const pv = 0.0003 + rng() * sp.maxSpeed * 0.01;
                const sizePow = Math.pow(rng(), 2.5);
                const splashR = jr * (0.03 + sizePow * 0.35);
                const particle = {
                  x: hx, y: hy, vx: Math.cos(angle) * pv, vy: Math.sin(angle) * pv,
                  radius: splashR, color: hole.color, life: 1,
                  decay: 0.015 + rng() * 0.05 + ps.viscosity * 0.03,
                  seed: nextSeed(),
                };
                particles.current.push(particle);
                // ONE stored point per droplet: the export replays the whole
                // deterministic flight from this initial state (see drawSplashTrail).
                pointsRef.current.push({
                  x: particle.x, y: particle.y,
                  radius: particle.radius,
                  color: particle.color,
                  opacity: ps.opacity,
                  vx: particle.vx, vy: particle.vy,
                  viscosity: ps.viscosity,
                  isSplash: true,
                  decay: particle.decay,
                  seed: particle.seed,
                  blend: wet || undefined,
                });
              }
            }
          }
        }

        prevPos.current = { x: cx, y: cy };
        prevVel.current = { vx: vel.vx, vy: vel.vy };

        // Droplets fly through the AIR (invisible — the bucket hangs above the
        // canvas) and leave one opaque splat where they land. Integration is
        // EXACTLY what the export replays (shared SPLASH_GRAVITY / splashDrag).
        const drag = splashDrag(ps.viscosity);
        particles.current = particles.current.filter(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += SPLASH_GRAVITY;
          p.vx *= drag;
          p.vy *= drag;
          p.life -= p.decay;
          if (p.life > 0) return true;
          // Landed: splat.
          const copies = getSymmetryTransforms(p.x * PAINT_SIZE, p.y * PAINT_SIZE, PAINT_SIZE, sym);
          for (let i = 0; i < copies.length; i++) {
            drawSplashSplat(paintCtx, copies[i].x, copies[i].y, p.radius * PAINT_SIZE, p.color, ps.opacity, p.vx, p.vy, ps.viscosity, copySeed(p.seed, i));
          }
          return false;
        });

        tRef.current += DT * s.speed;
      }

      paintCtx.globalCompositeOperation = 'source-over';
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

          if (sRef.current.showRig !== false) {
            // Pendulum rig seen from above: pivot at center, string to the bob,
            // the bob drawn as a paint container. Shadow offset grows with swing height.
            const cx = display.width / 2, cy = display.height / 2;
            const bobR = Math.max(display.width * 0.014, 7);
            const h = calcBobHeight(pos.x, pos.y, sRef.current.pendulum.stringLength);
            const bobColor = ps.holes[0]?.color ?? '#333';

            // Shadow on the canvas beneath the bob
            ctx.globalAlpha = 0.18 * (1 - h * 0.5);
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(ix + bobR * 0.35 + h * bobR, iy + bobR * 0.5 + h * bobR, bobR * (1 + h * 0.6), bobR * (0.8 + h * 0.5), 0, 0, Math.PI * 2);
            ctx.fill();

            // String from pivot to bob
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(ix, iy);
            ctx.stroke();

            // Pivot marker
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Paint container (bob)
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = bobColor;
            ctx.beginPath();
            ctx.arc(ix, iy, bobR, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ix, iy, bobR, 0, Math.PI * 2);
            ctx.stroke();
            // Rim highlight + outlet hole
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ix, iy, bobR * 0.72, -Math.PI * 0.85, -Math.PI * 0.25);
            ctx.stroke();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.arc(ix, iy, bobR * 0.18, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ix, iy, 6, 0, Math.PI * 2);
            ctx.stroke();
          }

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
          aria-label="Pendelmaleri-lerret. Klikk for å plassere pendelens slipp-punkt."
          role="img"
        />

        {recSupported && (simState === 'running' || simState === 'paused' || recording) && (
          <button
            onClick={recording ? stopRecording : startRecording}
            aria-pressed={recording}
            aria-label={recording ? 'Stopp videoopptak og last ned' : 'Start videoopptak av maleprosessen'}
            className={`absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur transition-colors ${
              recording
                ? 'bg-red-600/90 text-white hover:bg-red-500'
                : 'bg-gray-900/80 text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${recording ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
            {recording ? 'Stopp opptak' : 'Ta opp video'}
          </button>
        )}

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
                  ? 'Klikk for å plassere — pendelen kastes i sirkelbevegelse'
                  : 'Klikk for å plassere pendelen — lenger ut = mer energi'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
