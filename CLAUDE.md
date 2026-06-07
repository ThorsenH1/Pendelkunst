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
- `drop`: gentle fixed perpendicular nudge (`ω0 · dist · 0.7`, CCW). A real hand-release is never
  perfectly radial, so the swing opens into a precessing ellipse = the classic rosette. **Never let
  `drop` produce a pure straight line** — that's the degenerate, ugly case.
- **frequencyRatio ≈ 1.0–1.09 is the physically realistic AND most beautiful range** (a real
  Y-pendulum's two effective lengths are nearly equal → slow precession → rosette/spiral).
  Simple fractions (3:2, 5:3, 2:1) are harmonograph territory and tend to look like comets/bowties
  here unless the box is squared (throwSpeed ≈ ratio). Prefer near-1.0 ratios for presets.
- `calcBobHeight` must depend on L (longer string → smaller swing angle → flatter arc → less spread).

## 3. WYSIWYG export — the core invariant (READ BEFORE TOUCHING `painter.ts`)

Export must be **pixel-identical (scaled) to the live canvas**. This is achieved by determinism:

- Every brush/splash routine draws through a seeded `mulberry32(seed)` RNG — **never `Math.random()`
  inside `painter.ts`**. (Positional jitter that must vary per run is rolled in `PaintCanvas` and
  baked into the stored point's coordinates/radius; texture randomness is seeded.)
- Each `PaintPoint` carries a `seed`. Live and export both derive per-symmetry-copy seeds with
  `copySeed(seed, i)`. Same seed in → same pixels out.
- Splash points store `vx, vy, isSplash`; export renders them with the SAME `drawSplashDot`, not a
  different blob. Stroke points store `fromX/fromY, brushType, viscosity, speed`.
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
- Keep the hot loop allocation-light; guard runaway runs with `MAX_POINTS` (~350k) in `PaintCanvas`.
- Accessibility: `aria-pressed` on toggles, `aria-label`s, visible `:focus-visible`, honor reduced motion.
- Determinism in `painter.ts` is sacred (see §3).

## 6. Roadmap — how to make it even better (priority order)

1. **Per-preset visual QA**: a few presets are good-but-improvable (Geometrisk/Blomst/Zen). Tune via
   the headless harness (see §7) until each fills tastefully. Consider a `previewThumbnail` per preset.
2. **Optional canvas/paper texture** (subtle grain) and a faint drop-shadow on dry paint for realism.
   Add as an off-by-default toggle so presets are unaffected.
3. **Wet-on-wet color blending** where strokes overlap (multiply/▒ blend zones) for true paint feel.
4. **Shareable links / server gallery** (would need a backend; today gallery is local).
5. **Video/GIF capture** of the painting being drawn.
6. **Pendulum rig visualization** (show the swinging bob + string) as an optional overlay for realism/teaching.
7. **i18n** (English toggle) to widen reach.
8. **Determinism seed surfaced in UI** ("seed: 12345") so a piece is fully reproducible/shareable.
9. Replace `MAX_POINTS` hard stop with graceful densification (decimate older points) for very long runs.

## 7. How to develop & VERIFY in this environment (important gotchas)

- **The repo lives on a OneDrive-synced folder.** The Linux shell mount serves a *session-start
  snapshot* for pre-existing files: edits made with the file-tools (Write/Edit) are NOT visible to
  `bash`/`tsc`/`git`. **Author via `bash` here** (bash reads its own writes; git + the real Windows
  file then see them). New files written by the file-tool ARE visible to bash.
- **Type-check fast:** `./node_modules/.bin/tsc --noEmit` (a full `next build` exceeds the 45s shell cap;
  Vercel runs it on deploy). `npm run lint` for ESLint.
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

- Vercel project `pendelkunst` is linked to GitHub `ThorsenH1/Pendelkunst` (auto-deploys on push to `master`).
- Flow: commit changes here → user runs `git push` → Vercel builds & deploys. (`.vercel/project.json`
  has the project/org IDs; CLI deploy `vercel --prod` also works with a token.)
- Pre-deploy checklist: `tsc --noEmit` clean · lint clean · headless render of presets looks right ·
  no leftover sentinel/scratch files committed.
