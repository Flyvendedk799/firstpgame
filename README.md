# Firstp — three.js r170 (Vite)

Vite-based port of the original `Firstp/index.html` (which is r128 / inline-script). The original stays as the working reference — this folder is the migration target.

## Run

```
cd Firstp-r170
npm install
npm run dev
```

Vite opens http://localhost:5173 automatically.

## Renderer note (visual fidelity)

For the **full HDR + screen-post stack** (GTAO, bloom, SMAA, color grade), **WebGL** is the reference path. **WebGPU** uses a lighter node-based post chain; for “cinematic” parity prefer `?renderer=webgl` or set **Renderer: WebGL** in settings until WebGPU post catches up.

## Build

```
npm run build      # outputs dist/
npm run preview    # serve dist/
```

## Acceptance checks

```
npm run test:campaign            # campaign regression
npm run test:ai                  # tactical AI probe
npm run test:perf                # perf snapshot
npm run test:perf:stress         # perf stress matrix
npm run test:visual:runtime      # 12 buildings × 9 post states
npm run test:render              # auto/webgl/webgpu smoke + post + scope PIP
npm run test:assets:budget       # asset manifest validation + budget enforcement
npm run test:visual:regression   # baseline regression + missing-asset detection
npm run test:acceptance          # CI-quick: ~4.5 min (5 buildings × 5 post states, auto only)
npm run test:acceptance:full     # Release-grade: full 12 × 9 matrix + all renderer modes
npm run capture:baseline         # capture screenshots/aa-baseline-pack/
```

`test:render` expects the preview server on `http://127.0.0.1:4173` unless `BASE_URL` is set. It checks `auto`, `webgl`, and `webgpu` modes; screen post; scope PIP; texture-quality material tiers; all eight weapon slots; required enemy archetypes; player proxy/viewmodel metadata; character damage overlays; low-LOD impostors; and the renderer health monitor / black-frame self-test guards.

`test:visual:runtime` also expects the server. It walks all 12 building profiles across normal, ADS, focus, low HP, kill beat, death, menu, alarm, and blackout post states, then checks renderer metadata, PBR maps, screen post, shadows, and canvas nonblank pixel variation.

`test:assets:budget` validates `ALL_MANIFESTS` (characters, viewmodels, weapons, attachments, environments, materials, decals, VFX, animations) and asserts `ASSET_BUDGETS` are not exceeded in a worst-case stress scene (building 8, max enemies, scope PIP, VFX stress).

`test:visual:regression` captures per-building / per-state thresholds with structured assertions for blank frames, missing textures, invisible enemies, invisible weapons, broken scope PIP, extreme overexposure, and black-screen fallback metadata.

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

The r170 port now has an extracted renderer subsystem with a WebGPU high-end path and a hardened WebGL fallback.

- `rendererMode`: `auto`, `webgpu`, or `webgl`; default is `auto`.
- URL overrides: `?renderer=webgpu` and `?renderer=webgl`.
- `auto` is conservative: first-ever loads use WebGL. WebGPU is attempted only after a recorded successful WebGPU run, or when explicitly requested via URL / settings.
- Renderer health is persisted in `localStorage` (`aa_renderer_health`) and a session fallback flag in `sessionStorage` (`aa_force_webgl_fallback`) prevents reload-loops when a backend produces black frames.
- The boot black-frame self-test renders a calibration scene to an off-screen target and reads it back; if the active renderer produces near-zero luma, the WebGPU node-post chain is disabled and the test re-runs. If the renderer still fails, the page reloads with `?renderer=webgl`.
- A runtime canvas-luma sampler runs every ~12 frames and flips to WebGL after five consecutive black canvas samples.
- WebGL uses the composer stack: render pass, GTAO, bloom, color grade, SMAA, and output pass.
- WebGPU uses a node-post chain (`viewportTexture`, highlight bloom, film, FXAA, render output) plus the screen-space post overlay path, with direct rendering fallback if node post cannot initialize.
- WebGPURenderer's silent WebGL2 fallback (when `navigator.gpu` advertises support but no adapter is granted) is detected and rejected so the renderer takes the proper WebGL path instead of mis-asserting WebGPU code paths.
- Scope PIP is routed through backend-neutral render-target calls and is covered by smoke tests in both backends.

Visual systems added in this branch include:

- Per-building visual profiles, post profiles, atmosphere/fog/grade controls, and screen post overlays.
- PBR material library with quality-scaled generated normal, roughness, and metalness maps.
- Modular AA environment dressing, trim/decal density, authored shadow/fog/light profiles, and visual runtime metadata.

Phase 2 cinematic backlog (when present under `public/assets/`): authored decal sheets (`decals/*.png`), VFX atlases (`vfx/*_atlas.png`), SSR mesh list refresh on enemy spawn/remove (includes alive enemy meshes for reflective picks), centralized perf governor thresholds in `src/perfGovernor.js`, adaptive TAA sample easing before full Phase‑2 holds, irradiance peek via multi-sample probe RT (`src/lightProbeWalker.js`), and thinner geometric grade when LUT is active (`src/rendering.js`). Runtime maps optional loads into `window.__OPTIONAL_PUB_ASSET_STATE` — exposed on `__game.debug.snapshot()` / `visualRuntime.optionalPubAssets` for QA.

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

- `rendererInfo()` reports backend, requested mode, WebGPU support, post path, render scale, fallback reason, and the renderer plan/health snapshot.
- `rendererHealth()` and `rendererHealthMonitor()` expose persisted backend health, session fallback state, boot self-test result, post-disabled self-test result, runtime sample history, and fallback-fired status.
- `blackFrameSelfTest()` and `sampleRuntimeFrame()` re-run the boot calibration and grab a runtime canvas sample on demand.
- `forceWebgpuPostOff()` / `restoreWebgpuPost()` exercise the WebGPU node-post kill-switch.
- `resetRendererHealth()` / `clearRendererSessionFallback()` clear the persisted health record + session fallback so the next load may re-attempt WebGPU.
- `visualProfile()`, `postProfile()`, and `postContext()` expose active authored visual state.
- `lightingProfile()`, `environmentKit()`, `playerProxyProfile()` expose per-building authored data.
- `assetManifests()`, `assetManifest('characters')`, `assetPreflight()`, `assetRegistryStatus()`, `assetBudgets()`, `loadAsset(kind,id)`, and `disposeAsset(kind,id)` expose the asset manifest module from Section 11.
- `enemyStateMachine()`, `viewmodelStateMachine()`, `weaponSocketSpec()`, `vfxProfiles()` expose Sections 4/6/9 data tables.
- `materialLibrary()` and `materialStats()` expose PBR family, quality, and texture-map coverage.
- `weaponVisualStatus()` reports the active weapon viewmodel, AA detail parts, PBR/AA materials, and scope visibility.
- `characterVisualStatus()` reports live archetypes, human shells, hitbox ownership, weak-point markers, LOD, weapon silhouettes, player proxy, and viewmodel profile.
- `scopePip()` reports scope render-target status, material opacity, and backend render-target metadata.
- `vfxStress()` spawns procedural impacts, smoke, dust, flashes, decals, and shell casings, then returns budgeted runtime stats.
- `rendererBudget()` reports drawCalls/triangles/geometries/textures vs `ASSET_BUDGETS.scene`.
- `captureScreenshot()` and `capturePerf()` are available for manual visual QA.
