# CLAUDE.md — Pendelkunst master prompt & engineering guide

> This file is the saved "prompt for yourself." Read it first in any session.
> Mission: make Pendelkunst the best, most realistic pendulum-painting app on the web —
> professional, flawless (feilfri), and launch-ready. Live: https://pendelkunst.vercel.app

---

## 1. What this app IS (the meaning behind it)

Pendelkunst recreates **real pendulum painting** ("pendelmaleri"): a paint container hangs
on a string/Y-suspension over a canvas; you release or throw it; gravity + damping trace a
slowly-decaying, precessing orbit; paint flows out and draws the pattern. The output must look
like the real thing — **rosettes, Lissajous figures, and spiral rings that FILL the canvas** —
not thin lines or sterile vector curves. Every visible feature should be physically motivated.

The north star: a non-technical artist opens it, picks a preset or "Overrask meg", clicks Start,
and gets a gallery-worthy piece they can export at print resolution.

## 2. The physics that makes it look real (READ BEFORE TOUCHING `physics.ts`)

A point mass on a string is a 2D damped harmonic oscillator:

```
x(t) = Rx · sin(ωx·t + φx) · e^(-γt)
y(t) = Ry · sin(ωy·t + φy) · e^(-γt)
ωx = √(g/L),  ωy = ωx · frequencyRatio
```

**The single most important insight (do not regress this):**
With a near-1:1 frequency ratio the figure is confined to its `Rx × Ry` bounding box. If
`Rx ≫ Ry` you get a flat horizontal band / "comet" — the failure mode the original app shipped
with. To **fill a disc like real pendulum art you need a roughly ROUND orbit (Rx ≈ Ry)**, which
requires the initial perpendicular velocity to be on the order of `ω·r` (a factor ~1.0, NOT 0.4).

- `throw`: `vMag = throwSpeed · ω0 · dist` → `throwSpeed = 1` ≈ circular orbit. 0.3 = thin, 2 = tall.
- `drop` (2026-07): a TRUE hand release — tiny 0.15 perpendicular tremor only. It paints a narrow
  Airy-precessing fan (honest physics; users noticed the old 0.7 nudge "behaved like a throw").
  The classic full rosettes come from `throw-ccw` at `throwSpeed ≈ 0.7` — presets use that.
- **Airy precession is what makes it ROUND (2026-07 upgrade — the second most important insight):**
  a plain detuned oscillator (`ratio 1.02`) does NOT rotate the ellipse — it drifts the relative
  phase, which alternates ellipse ↔ diagonal line and fills a SQUARE envelope (the boxy/bowtie
  failure mode). A real spherical pendulum's orbit instead ROTATES in the circulation direction at
  `Ω = ⅜·ω·a·b/L²`. `physics.ts` implements this: `Ω₀ = 0.375·K²·Lz` (Lz = x₀vy₀ − y₀vx₀,
  `PRECESS_K2 = 0.32`), accumulated as `θ(t) = Ω₀(1−e^(−2γt))/(2γ)` and applied as a rotation in
  `calcPosition`/`calcVelocity`. **This is what draws round rosettes. Do not remove it.**
- **frequencyRatio: keep presets at 1.000–1.006.** With precession doing the rosette work, larger
  detuning (≥1.01) shears the pattern into moiré bands / fills the middle with a solid blob over a
  long run. 1.0907 (Kaotisk) is a deliberate airy woven-web look. Simple fractions (3:2, 5:3, 2:1)
  are Lissajous territory and now slowly rotate — usable for variety.
- The dense center that appears late in a run is the pendulum settling (physically real); control
  its size with damping (ends the run sooner) — bucketCapacity mostly does NOT bind because
  Torricelli flow slows as the bucket empties.
- `calcBobHeight` must depend on L (longer string → smaller swing angle → flatter arc → less spread).

## 3. WYSIWYG export — the core invariant (READ BEFORE TOUCHING `painter.ts`)

Export must be **pixel-identical (scaled) to the live canvas**. This is achieved by determinism:

- Every brush/splash routine draws through a seeded `mulberry32(seed)` RNG — **never `Math.random()`
  inside `painter.ts`**. (Positional jitter that must vary per run is rolled in `PaintCanvas` and
  baked into the stored point's coordinates/radius; texture randomness is seeded.)
- Each `PaintPoint` carries a `seed`. Live and export both derive per-symmetry-copy seeds with
  `copySeed(seed, i)`. Same seed in → same pixels out.
- Splash droplets store ONE point each (2026-07): `x, y, vx, vy, radius, decay, isSplash` are the
  INITIAL state. Droplets fly through the AIR (nothing drawn in flight — the bucket hangs above
  the canvas) and land as ONE opaque splat (`drawSplashSplat`: elongated ellipse + satellites).
  `drawSplashTrail` replays the flight with the exact same integration/constants as the live loop
  (`SPLASH_GRAVITY`, `splashDrag` — shared exports; never fork these). When a run ends with
  droplets mid-air, `finishRun` in PaintCanvas lands them immediately (live must show every splat
  the export replays). Legacy per-step splash points (`decay == null`) render as single dots.
- **Paint is OPAQUE (2026-07 — user-driven fix "alt er for svakt"):** `calcDropOpacity` keeps alpha
  at 0.82–0.95× the paint's own opacity (speed thins the LINE WIDTH via 1/√v mass conservation in
  `calcDropRadius`, it does not fade the color). Marker draws a full-strength solid line (round
  caps — butt caps left notches). Do not reintroduce speed→transparency coupling.
- Stroke points store `fromX/fromY, brushType, viscosity, speed`; segments shorter than
  `MIN_SEGMENT` (0.4px) are merged in `PaintCanvas` — the dying pendulum otherwise emits millions
  of invisible micro-segments (this was why runs hit MAX_POINTS early and "ended too soon").
- `renderPointsHighResAsync` is chunked + yields to keep the UI responsive with a progress bar.

If you add a brush or effect: thread `seed` through it, keep it deterministic, and store whatever
the export renderer needs on the point.

## 4. Architecture map

```
src/lib/types.ts      Shared types. PaintPoint is the export contract — extend carefully.
src/lib/physics.ts    Pendulum→harmonograph, flow (Torricelli), drop radius/opacity, splash, canvas motion.
src/lib/painter.ts    Seeded RNG, 7 brushes, splash, blob, getSymmetryTransforms, renderPointsHighRes[Async].
src/lib/presets.ts    createDefaultSettings, 8 presets, randomSettings() ("Overrask meg").
src/lib/gallery.ts    IndexedDB save/load/list/delete (thumbnail + full PNG + points + settings).
src/components/PaintCanvas.tsx  The engine: rAF loop, 2048px offscreen canvas, blit, HUD, drop UI.
src/components/ControlPanel.tsx All controls + actions + a11y (aria-pressed) + shortcut hints.
src/components/ExportDialog.tsx Resolution/format picker, async WYSIWYG render + progress.
src/components/GalleryPanel.tsx Saved-paintings grid.
src/app/{layout,page}.tsx       Metadata/viewport; page = state owner + ErrorBoundary + shortcuts + undo.
src/app/manifest.ts, opengraph-image.png, apple-icon.png, icon.svg, public/icon-{192,512}.png
```

Data flow: `page.tsx` owns `settings` + `simState` + `pointsRef` + `offscreenRef`. `PaintCanvas`
runs the sim into the offscreen canvas and pushes points into `pointsRef`. Export/gallery read those.

### State machine (don't break pause/resume)
`idle` → full reset (blank, clear points, seed=1). `idle/done → running` resets the *run* but keeps
canvas+points (new layer). `running ↔ paused` must **continue** (never reset `tRef`). Tracked via
`prevStateRef`. Layer snapshots (for Undo) are taken in `page.tsx` before each `running` start.

## 5. Coding standards & invariants

- TypeScript strict; no `any` creep. Keep the `PaintPoint` shape backward-compatible (gallery stores it).
- All UI copy in **Norwegian (Bokmål)**.
- No `localStorage`/`sessionStorage` reliance for art data — gallery uses IndexedDB.
- Keep the hot loop allocation-light; guard runaway runs with `MAX_POINTS` (1M) in `PaintCanvas`.
  With trail-point splash + segment merging, every preset's FULL run fits under it (max ≈ 830k).
- Live paint canvas is `PAINT_SIZE = 3072` (raised from 2048 for save/export quality).
- Accessibility: `aria-pressed` on toggles, `aria-label`s, visible `:focus-visible`, honor reduced motion.
- Determinism in `painter.ts` is sacred (see §3).

## 6. Roadmap — how to make it even better (priority order)

DONE (2026-07): Airy precession physics (§2) · per-preset QA (all 8 + Default verified round &
canvas-filling via headless montage) · paper texture toggle (`paperTexture`, deterministic, in
export) · wet-on-wet multiply blending (`paint.wetBlend`, stored per point as `blend`) · pendulum
rig overlay (`showRig`, display-only) · video capture (MediaRecorder → WebM/MP4 on the display
canvas) · seed surfaced in UI (`settings.seed`; run rng = `mulberry32(imul(seed,2654435761)+layer·7919)`)
· "Slik gjør du det hjemme" help dialog.

Remaining:
1. **Shareable links** — encode `settings` (incl. seed) in a URL query/fragment; no backend needed
   for reproduction since a piece = settings + seed. (Server gallery would need a backend.)
2. **i18n** (English toggle) to widen reach.
3. Replace `MAX_POINTS` hard stop with graceful densification (decimate older points) for very long runs.
4. Preset `previewThumbnail`s in the picker.
5. Faint drop-shadow on dry paint (off-by-default).

## 7. How to develop & VERIFY in this environment (important gotchas)

- **OneDrive gotcha (environment-dependent):** in the Linux-mount environment, file-tool edits to
  pre-existing files are NOT visible to `bash`/`tsc`/`git` — author via `bash` there. In a native
  Windows session (PowerShell/Git Bash) the file tools and shell see the same files; verify once
  with `git diff --stat` after the first edit and proceed normally.
- **Type-check fast:** `./node_modules/.bin/tsc --noEmit` (a full `next build` may exceed the shell
  timeout; Vercel runs it on deploy). There is NO ESLint config in the repo — `npm run lint` prompts
  interactively; don't run it, rely on tsc.
- **Visual verification (do this for any physics/paint change):** transpile the lib and render PNGs
  headlessly with `@napi-rs/canvas` (prebuilt, no system deps), then inspect:
  ```
  tsc src/lib/{types,physics,painter,presets}.ts --outDir /tmp/rt/lib --module commonjs \
      --target es2020 --skipLibCheck --moduleResolution node
  # node script: simulate (mirror the PaintCanvas loop) → renderPointsHighRes → toBuffer('image/png')
  ```
  Render all 8 presets + Default in a montage and eyeball that they fill the canvas like real
  pendulum art before shipping.

## 8. Deploy / relaunch

- **GitHub push does NOT auto-deploy** (verified 2026-07: pushes to `ThorsenH1/Pendelkunst` produced
  no Vercel deployment; the Git integration is not active). Deploy explicitly with the CLI:
  `npx vercel --prod` from the repo root (CLI is authenticated as `thorsenh1`; `.vercel/project.json`
  has the project/org IDs). Verify with `npx vercel ls pendelkunst` (newest deployment → Production)
  and `npx vercel inspect <url>` (aliases must include `https://pendelkunst.vercel.app`).
- `curl https://pendelkunst.vercel.app` returns a 403 bot-challenge (`X-Vercel-Mitigated: challenge`)
  — you cannot verify content over plain HTTP; trust the CLI status/aliases or use a real browser.
- Flow: commit → `git push` (keeps GitHub in sync) → `npx vercel --prod` (actually ships).
- Pre-deploy checklist: `tsc --noEmit` clean · `npm run build` clean · headless render of presets
  looks right · no leftover sentinel/scratch files committed.
