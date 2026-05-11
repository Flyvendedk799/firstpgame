# Firstp — three.js r170 (Vite)

Vite-based port of the original `Firstp/index.html` (which is r128 / inline-script). The original stays as the working reference — this folder is the migration target.

## Run

```
cd Firstp-r170
npm install
npm run dev
```

Vite opens http://localhost:5173 automatically.

## Build

```
npm run build      # outputs dist/
npm run preview    # serve dist/
```

## Acceptance checks

```
npm run test:campaign
npm run test:ai
npm run test:perf
npm run test:perf:stress
npm run test:visual:runtime
npm run test:render
npm run test:acceptance
npm run capture:baseline
```

`test:render` expects the Vite dev server on `http://127.0.0.1:5173` unless `BASE_URL` is set. It checks `auto`, `webgl`, and `webgpu` modes; screen post; scope PIP; texture-quality material tiers; all eight weapon slots; required enemy archetypes; player proxy/viewmodel metadata; character damage overlays; and low-LOD impostors.

`test:visual:runtime` also expects the dev server. It walks all 12 building profiles across normal, ADS, focus, low HP, kill beat, death, menu, alarm, and blackout post states, then checks renderer metadata, PBR maps, screen post, shadows, and canvas nonblank pixel variation.

`test:visual` captures all building baselines and expects a preview server on `http://127.0.0.1:4173` unless `BASE_URL` is set.

`capture:baseline` creates a full AA acceptance pack under `screenshots/aa-baseline-pack/`: every building, the major gameplay post states, all weapon slots, scope PIP, renderer/material/perf metadata, and a Playwright session video.

## Layout

```
Firstp-r170/
├── package.json          three@0.170.0 + vite
├── vite.config.js        es2020, sourcemap
├── index.html            shell — HUD markup + <script src="/src/main.js">
├── src/main.js           imports + extracted game body (was inline)
└── public/assets/        symlink → ../../Firstp/assets/ (GLBs)
```

`public/assets/` is a symlink to `Firstp/assets/`. Files there are served at the root: `/assets/soldier-char.glb` etc. Edit GLBs in either location — both see the same files.

## Renderer and AA visual path

The r170 port now has an extracted renderer subsystem with a WebGPU-first high-end path and WebGL compatibility fallback.

- `rendererMode`: `auto`, `webgpu`, or `webgl`; default is `auto`.
- URL overrides: `?renderer=webgpu` and `?renderer=webgl`.
- `auto` prefers WebGPU when browser initialization succeeds, then falls back to WebGL with a recorded fallback reason.
- WebGL uses the composer stack: render pass, GTAO, bloom, color grade, SMAA, and output pass.
- WebGPU uses a guarded node-post chain (`viewportTexture`, highlight bloom, film, FXAA, render output) plus the screen-space post overlay path, with direct rendering fallback if node post cannot initialize.
- Scope PIP is routed through backend-neutral render-target calls and is covered by smoke tests in both backends.

Visual systems added in this branch include:

- Per-building visual profiles, post profiles, atmosphere/fog/grade controls, and screen post overlays.
- PBR material library with quality-scaled generated normal, roughness, and metalness maps.
- Modular AA environment dressing, trim/decal density, authored shadow/fog/light profiles, and visual runtime metadata.
- Human-like enemy archetype rigs with readable silhouettes, LODs, damage overlays, weak-point markers, and hitbox metadata.
- Upgraded first-person hands/viewmodel, player proxy body, weapon surface detail pass, and scope PIP diagnostics.

Legacy compatibility shims remain in place for imports, output color space, physically-correct light intensity, and r170 material/skinning behavior.

## When the rig misbehaves

The Meshy soldier GLB has a baked 0.01 cm→m Armature scale. The auto-fit math in `applyMeshyRig()` measures the rig with `Box3.setFromObject(rig)` (default `precise=false`), which uses bind-pose bounding spheres — that's the un-Armature-scaled measurement the math expects.

**Do not pass `precise=true` to `setFromObject` on this rig.** It'll walk vertices through the Armature transform and the bbox comes back ~100× smaller, scale becomes ~175×, and the soldier renders enormous and animates wildly.

Same caveat for `attachDeagleGlbModel()`.

## Going further

- **Asset normalization** — apply transforms in Blender so the Armature scale is 1.0; then the auto-fit math becomes uninteresting.
- **Modularize** — split `src/main.js` (currently 16,800 lines) into `building.js`, `enemies.js`, `weapons.js`, etc. Vite hot-reloads modules independently.
- **Steam shell** — Electron + `steamworks.js` per `THREE_UPGRADE_PLAN.md` §11.

## Campaign Runtime

The shipped campaign is the 8-building runtime in `src/main.js`, with spatial identity and encounter metadata in `src/levelSequences.js`.

The old standalone 12-level story prototype was removed so deploy, level select, range, endless, and tests all point at the same production campaign path. Keep future level work focused on:
- `CAMPAIGN_LEVELS` in `src/main.js`
- `BUILDING_INFO` compatibility data in `src/main.js`
- `SEQUENCE_DEFS` and `getSequenceGameplayProfile()` in `src/levelSequences.js`
- Playwright checks in `scripts/smoke-test.mjs` and `scripts/campaign-regression.mjs`

## Performance controls and capture

- `?perf=1` URL flag or `SETTINGS.perfHud=true` enables the in-game perf HUD.
- Perf HUD reports EMA fps/frame time, p99-ish frame spike, and `renderer.info` counters.
- `window.__PERF.snapshot()` returns a JSON-safe baseline sample for regressions.
- Additional settings persisted in `clearance_settings` include:
  - `rendererMode`
  - `postEnabled`
  - `aoQuality` / `bloomQuality`
  - `colorGrade` / `gradeIntensity`
  - `filmGrain` / `sharpen` / `chromaticAberration` / `vignette` / `smaa`
  - `shadowQuality`
  - `atmosphereQuality`
  - `textureQuality`
  - `characterQuality`
  - `weaponQuality`
  - `renderScale`
  - `scopePipEnabled` / `scopePipResolution`
  - `pixelRatioCap`
  - `maxPointLightsEffective`
  - `aiSkipFramesModulo`
  - `raycastSpatialIndex`
  - `maxParticlesBlood` / `maxParticlesSmoke`
  - `cheapMaterials`
  - `reducedBloomish`

### Perf bug-report workflow

1. Start with `npm run dev`.
2. Open a reproducible scene and append `?perf=1`.
3. Record a 10–20 second Chrome Performance trace while moving + combat.
4. In DevTools console run `window.__PERF.snapshot()` and save output JSON.
5. Attach one screenshot/GIF of the camera pose + HUD values with the trace.

## Debug visual API

The in-page debug surface is under `window.__game.debug`:

- `rendererInfo()` reports backend, requested mode, WebGPU support, post path, render scale, and fallback reason.
- `visualProfile()`, `postProfile()`, and `postContext()` expose active authored visual state.
- `materialLibrary()` and `materialStats()` expose PBR family, quality, and texture-map coverage.
- `weaponVisualStatus()` reports the active weapon viewmodel, AA detail parts, PBR/AA materials, and scope visibility.
- `characterVisualStatus()` reports live archetypes, human shells, hitbox ownership, weak-point markers, LOD, weapon silhouettes, player proxy, and viewmodel profile.
- `scopePip()` reports scope render-target status, material opacity, and backend render-target metadata.
- `vfxStress()` spawns procedural impacts, smoke, dust, flashes, decals, and shell casings, then returns budgeted runtime stats.
- `captureScreenshot()` and `capturePerf()` are available for manual visual QA.
