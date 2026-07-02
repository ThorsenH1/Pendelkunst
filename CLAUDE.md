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
  its size with damping (ends the run sooner). bucketCapacity DOES bind for the heavier presets
  (measured 2026-07: Kaotisk/Galakse/Regnbue end by empty bucket; Rosett bottoms out at
  paintLevel 0.076) — Torricelli flow slows the drain but does not stop it.
- **Plateau–Rayleigh sputter (2026-07):** a starving stream (bucket almost empty) breaks into
  drops instead of stopping dead. `calcStreamBreakup(normFlow, viscosity)` in `physics.ts` returns
  starvation 0–1 (onset `0.14 + (1−viscosity)·0.08`; viscous paint holds a thread longer); the
  PaintCanvas hole loop then alternates bead segments (drawn slightly fatter, ×(1+0.35·starve))
  and pen-up gaps (per-hole state machine, gaps widen as starve→1). Pen-up segments advance the
  stroke anchor and store NO point — the WYSIWYG export replays identically for free. This turns
  the flat solid fields in the dense center into granular drip texture (see the changed presets).
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
- **Segment thresholds in `renderOnePoint` must SCALE with `canvasSize`** (2026-07 fix): the lower
  draw floor is `d > canvasSize * 1e-4` (≈ the live 0.3px floor at 3072, scaled). A fixed pixel
  floor (the old `d > 0.5`) silently dropped ~9% of stroke segments — the dense center — at
  export sizes ≤ 3072. Do not reintroduce fixed-pixel thresholds in the export path.
- **Symmetry is stored PER POINT (2026-07):** layers can be painted with different symmetry (the
  controls are enabled in `done`), so `renderOnePoint` replays each point with `p.sym ?? symmetry`
  — the global setting is only the fallback for older gallery points. Live landing splats use the
  particle's launch-time `sym` too. Before this, the export re-mirrored ALL layers with the
  current setting. `sym` is a shared reference to the settings object (cheap at 1M points); the
  headless QA sim must attach it the same way.
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
src/lib/share.ts      Shareable links: settings+seed ⇄ base64url `#del=` fragment, sanitized decode.
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
  With trail-point splash + segment merging, every preset's FULL run fits under it (max ≈ 890k,
  Kaotisk — re-measured 2026-07 in headless QA).
- Live paint canvas is `PAINT_SIZE = 3072` (raised from 2048 for save/export quality).
- Accessibility: `aria-pressed` on toggles, `aria-label`s, visible `:focus-visible`, honor reduced motion.
- Determinism in `painter.ts` is sacred (see §3).

## 6. Roadmap — how to make it even better (priority order)

DONE (2026-07): Airy precession physics (§2) · per-preset QA (all 8 + Default verified round &
canvas-filling via headless montage) · paper texture toggle (`paperTexture`, deterministic, in
export) · wet-on-wet multiply blending (`paint.wetBlend`, stored per point as `blend`) · pendulum
rig overlay (`showRig`, display-only) · video capture (MediaRecorder → WebM/MP4 on the display
canvas) · seed surfaced in UI (`settings.seed`; run rng = `mulberry32(imul(seed,2654435761)+layer·7919)`)
· "Slik gjør du det hjemme" help dialog · shareable links (`share.ts`: `#del=<base64url(JSON)>`
fragment; decode NEVER trusts the payload — every field is validated/clamped via
`sanitizeSettings`, garbage → null; determinism verified: link round-trip → byte-identical PNG.
Loaded on mount in `page.tsx`, then the fragment is stripped; "Del oppsettet" button copies it)
· export micro-segment fix (scaled draw floor in `renderOnePoint`, see §3) · Web Share API on
mobile ("Del oppsettet" opens the native share sheet via `navigator.share` when the UA is mobile;
AbortError = user closed the sheet, silently ignored; desktop keeps clipboard copy + prompt fallback)
· preset thumbnails in the picker (`PresetConfig.thumbnail` → `public/presets/<slug>.webp`;
deterministic mini-renders of each preset at seed 1 — headless sim at 480px via renderPointsHighRes,
downscaled to 240px webp q82, ~8–23 KB each. **Regenerate them with the headless QA pipeline
whenever a preset or the physics/paint code changes**, otherwise the picker lies about the result.
No `loading="lazy"` on these — 8 × ~15 KB doesn't need it and lazy left them unloaded in preview QA)
· relief shadow on dry paint (`settings.paintShadow`, off by default, stored per point as `shadow`;
"Relieffskygge på malingen" toggle in Realisme. `drawStrokeShadow`/splat-shadow in `painter.ts` are
deliberately **rng-FREE** and scaled purely by stroke radius, so (a) shadow-off renders stay
byte-identical to pre-feature output — verified 9/9 hashes vs HEAD — and (b) live/export always
match at any size. Per-brush width via `SHADOW_WIDTH` (spray = 0: mist has no ridge); tuning knobs
`SHADOW_ALPHA = 0.1`, `SHADOW_OFFSET = 0.45` (light from top-left). If you add a brush, add its
`SHADOW_WIDTH` entry. "Overrask meg" enables it 25% of the time on light grounds only)
· Plateau–Rayleigh sputter (see §2; 2026-07): the dying stream beads into drops before the bucket
empties. QA-verified: Default/Organisk/Geometrisk/Zen/Blomst render byte-identically to pre-feature
(they never starve); Rosett/Kaotisk/Galakse/Regnbue gained drip texture in the dense center and
their 4 picker thumbnails were regenerated. Kaotisk's full run is now ≈778k points (was ≈888k).
**QA gotcha:** the headless sim must mirror the sputter state machine EXACTLY, including rng call
order per hole: jitter jx/jy/jr → sputter rng (ONLY when starve > 0: 1 call on state init, 1 on
each bead↔gap flip) → splash rngs. A mismatch silently desyncs every later stroke seed.
· per-point symmetry in the export (2026-07, see §3 — fixes multi-layer WYSIWYG when symmetry
changes between layers; QA: splash-off presets byte-identical to pre-change, per-point-wins and
no-sym-fallback both verified byte-exactly, two-layer scenario renders differently from the old
buggy path) · coffee-ring rim on splash splats (2026-07): drying droplets deposit pigment along
the edge, so splats dry with a faint darker outline — strongest for watery paint
(`alpha = opacity·(0.16 − 0.06·viscosity)`, width `0.16r`, `darken(color, 0.3)`). The ring is
deliberately **rng-FREE and drawn before the satellites**, so every previously rendered pixel
stays byte-identical; the 5 splash presets' picker thumbnails were regenerated (non-splash
Geometrisk/Zen/Blomst verified byte-identical).
· liquid rope coiling (2026-07): thick paint from a dawdling bucket buckles into tiny loops
(honey-coiling instability) instead of laying a straight line. `calcRopeCoiling(t, speed,
viscosity, streamRadius, phase)` in `physics.ts` returns a landing offset traced as a circle
(`COIL_FREQ = 46` rad/s ≈ 12 steps/loop at DT, onset `viscosity > 0.45`, active below bucket
speed 0.35, radius up to 2.6 stream radii, `slow²` ramp); PaintCanvas adds it to the hole
position BEFORE jitter, per hole with golden-angle phase (`h·2.618`). Deliberately **rng-FREE**
(pure function of t) and baked into stored point coordinates → the WYSIWYG export replays it for
free and the rng call order is untouched. Effect: flat dense-center fields gain a subtle swirl
texture (thick paint), drop-fan tips get faint apex wobbles. QA-verified: the 5 presets with
viscosity ≤ 0.45 (Rosett/Geometrisk/Kaotisk/Galakse/Regnbue) render byte-identically to
pre-feature; Default/Organisk/Zen/Blomst differ (point counts +2–6%, max still Kaotisk ≈778k);
organisk/zen/blomst picker thumbnails regenerated. **The headless QA sim must apply the coil
offset identically** (computed after `radius`, added to the hole position before jitter).
· orbit path preview (2026-07): in `idle` a faint indigo SVG polyline (PaintCanvas overlay)
shows the trajectory the pendulum WILL trace — computed with the exact run physics
(`prepareHarmonograph` + `calcPosition`, 22 s sampled at 0.04 s; first 30% drawn stronger so
start + direction read). While hovering it follows the cursor (preview BEFORE the click);
in `done` it shows only while hovering, so the finished piece stays clean. Hidden while
running/paused. Display-only — zero WYSIWYG/determinism impact (2026-07 QA baseline re-verified:
montage of 9 renders round & canvas-filling, same-seed/diff-seed determinism PASS, point counts
unchanged, max Kaotisk ≈778k). Gotcha: compute the preview from the `settings` prop, NOT
`sRef.current` — the ref updates in an effect after render, so it lags one render behind.

Remaining:
1. **i18n** (English toggle) to widen reach.
2. Replace `MAX_POINTS` hard stop with graceful densification (decimate older points) for very long runs.

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
  pendulum art before shipping. The same pipeline regenerates the preset picker thumbnails
  (480px render → 240px webp q82 → `public/presets/<slug>.webp`) — do that in the same pass.
- **Multiline/quoted commit messages fail in Windows PowerShell 5.1** (embedded `"` splits the
  `-m` argument into pathspecs even inside a here-string). Write the message to a scratch file
  and run `git commit -F <file>` from Git Bash instead.
- **Never edit UTF-8 source with Windows PowerShell 5.1 string ops** (`Get-Content -Raw` →
  `-replace` → `Set-Content`): it decodes as ANSI and writes back mojibake (ø→Ã¸, —→â€”, broken
  emoji) plus a BOM. Use the Edit/Write file tools for source edits; PowerShell only for commands.

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
