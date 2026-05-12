# Lighting Performance Optimization Plan

## Purpose

Improve frame rate after `npm run build` + `npm run preview` without gutting the new visual direction. The current bottleneck is almost certainly GPU-side: too many real dynamic lights, expensive PBR/material features, high DPR/postprocessing cost, transparent overdraw, and scope PIP double-rendering during ADS.

This plan is written for an agentic coding agent. Follow it in order. Do not rewrite the renderer or port to another engine.

## Current Context

- Project root: `/Users/tobiasmastek/Desktop/firstpgame`
- Main runtime file: `src/main.js`
- Renderer subsystem: `src/rendering.js`
- Material presets: `src/materialLibrary.js`
- Visual profiles: `src/visualProfiles.js`
- The game is a Three.js FPS. Keep the existing Three renderer.
- Recent lighting work added:
  - `RoomEnvironment` PMREM environment lighting.
  - Per-building `_LEVEL_REFLECTION_PROFILES`.
  - Gloss/reflection floor catchers under lamps.
  - Camera-attached peripheral fill lights.
  - `adaptive-zone-lighting` controller.

## Success Criteria

The implementation is complete only when all are true:

- `npm run build` succeeds.
- `npm run preview` shows no runtime errors.
- On building 1 and building 8, the scene still looks visibly lit, reflective, and readable.
- Internal debug snapshots expose the active lighting budget and real light count.
- Default `high` settings are meaningfully faster than the current version.
- `ultra` may preserve heavier visuals, but `high` must be sane for normal play.
- Crosshair remains CSS-centered and stable.
- Scope ADS still works, but PIP resolution/scaling becomes performance-aware.

## Non-Goals

- Do not add Babylon.js.
- Do not remove PBR materials globally.
- Do not delete level dressing, enemies, scopes, or core gameplay.
- Do not rewrite `src/main.js` wholesale.
- Do not revert unrelated dirty worktree changes.

## Baseline First

Before changing code, collect baseline numbers.

Run:

```bash
npm run build
npm run preview
```

In browser console after page load:

```js
window.__game.debug.perfSnapshotForBuilding(1)
window.__game.debug.snapshot().visualRuntime
window.__PERF.snapshot()
```

Repeat for:

```js
window.__game.debug.perfSnapshotForBuilding(8)
```

Record:

- FPS / frame ms.
- `renderer.info.render.calls`.
- `renderer.info.render.triangles`.
- `renderer.info.memory.textures`.
- Dynamic light count.
- Postprocessing state.
- Pixel ratio / render scale.
- Scope PIP resolution.

Add missing debug fields if needed.

## Phase 1: Add A Real Lighting Budget

Create a small lighting budget helper in `src/main.js`, near the reflection/lighting profile helpers.

Target behavior:

- `low`: max 3 real world point lights.
- `medium`: max 4 real world point lights.
- `high`: max 5 real world point lights.
- `ultra`: max 8 real world point lights.

Rules:

- Directional key, ambient, hemisphere, and rim can remain.
- Count real `PointLight` objects carefully.
- Viewmodel-only/camera-only fill lights should be minimized and intensity-limited.
- Prefer emissive meshes and additive sprites for visual glow.
- Do not create many real point lights for decorative accents.

Implementation outline:

```js
function _lightingBudget(){
  const q = SETTINGS.quality || 'high';
  const visual = SETTINGS.lightingQuality || q;
  return ({ low:3, medium:4, high:5, ultra:8 })[visual] || 5;
}
```

Then in `buildLevel`:

- Keep the strongest/nearest/most important ceiling lights as real `PointLight`s.
- Convert extra ceiling lamps to emissive fixtures + additive light pool only.
- Do not push fake lights into `ceilingLights`.
- Store `visualStats.realPointLights`.
- Store `visualStats.fakeLightPools`.

Important:

- The adaptive lighting controller can use fake lamp metadata too. If converting a lamp to fake, store a lightweight object with `position`, `color`, and `userData.baseIntensity`, but do not add it to the scene as a `PointLight`.

## Phase 2: Reduce Camera/Player Fill Cost

Current peripheral/player lighting can add several real moving point lights.

Change it to:

- One camera-attached viewmodel fill light only.
- One optional player bounce light in the world on `high`/`ultra`.
- Disable extra peripheral real lights on `low`/`medium`.
- On `high`, use at most one peripheral fill.
- On `ultra`, allow up to two.

Expected code area:

- Around `viewmodelFill`.
- `_peripheralLightRig`.
- `_updatePeripheralLighting`.
- `playerBounceLight` in `buildLevel`.

Acceptance:

- `visualStats.dynamicLights` and debug snapshot show fewer real lights.
- Weapon/readability still improves near lamps.

## Phase 3: Replace Physical Reflection Catchers With Cheaper Materials

Current lamp reflection catchers use `MeshPhysicalMaterial` with clearcoat. That is expensive.

Change default `high` and below:

- Use `MeshBasicMaterial` or `MeshStandardMaterial`.
- Keep transparent radial alpha and color.
- Avoid `MeshPhysicalMaterial` and clearcoat unless `SETTINGS.quality === 'ultra'`.

Implementation:

- In the lamp pool creation block, branch:
  - `ultra`: keep `MeshPhysicalMaterial`.
  - otherwise: use `MeshBasicMaterial` with `transparent`, `opacity`, `depthWrite:false`, `blending:THREE.AdditiveBlending`, `alphaMap:_softRadialTex`.

Acceptance:

- Reflections still read as colored floor sheen.
- Shader program count and frame time improve.

## Phase 4: Postprocessing Defaults

The defaults are too expensive for normal play.

Change defaults in `SETTINGS`:

- `aoQuality`: from `ultra` to `high` or `medium`.
- `bloomQuality`: keep `high`, but lower strength slightly.
- `pixelRatioCap`: reduce default to around `1.35`.
- `renderScale`: keep `auto`, but make auto less aggressive on Retina.
- `scopePipResolution`: default lower for high settings.

Suggested defaults:

```js
pixelRatioCap: 1.35
aoQuality: 'high'
bloomQuality: 'high'
scopePipResolution: 768
```

Also inspect `src/rendering.js`:

- GTAO ultra should be reserved for `ultra`.
- `high` should not use the most expensive GTAO settings.
- Make sure post stack is not reconfigured every frame unless signature changes.

Acceptance:

- Visual style remains.
- `high` no longer behaves like a hidden `ultra`.

## Phase 5: Scope PIP Performance

Scope PIP may render the scene a second time.

Implement performance-aware PIP:

- Default PIP resolution:
  - low: 384
  - medium: 512
  - high: 768
  - ultra: 1024 or 1536
- During low FPS, temporarily drop PIP resolution one tier.
- Do not render PIP when:
  - not ADS,
  - optic not visible,
  - scope opacity below visible threshold,
  - player is sprinting/reloading and ADS target is zero.

Acceptance:

- Scoped ADS still looks correct.
- FPS drop during ADS is smaller.
- No scope/crosshair regression.

## Phase 6: Debug And Telemetry

Extend `window.__game.debug.snapshot().visualRuntime` with:

```js
lighting: {
  id,
  building,
  zone,
  near,
  exposure,
  env,
  budget,
  realPointLights,
  fakeLightPools,
  peripheralLights,
  playerBounceEnabled
}
```

Add a helper:

```js
window.__game.debug.lightingStats()
```

It should return:

- Current quality.
- Pixel ratio.
- Real light count.
- Fake light count.
- Post enabled.
- AO quality.
- Bloom quality.
- Scope PIP render target size.

Acceptance:

- A future agent can measure regressions without reading code.

## Phase 7: Quality Preset Behavior

Make quality tiers meaningful.

Low:

- Post off or minimal.
- No player bounce.
- No extra peripheral lights.
- Cheap reflection catchers only.
- Scope PIP <= 384 or disabled if needed.

Medium:

- Max 4 real world point lights.
- Cheap reflection catchers.
- AO medium or off.
- Scope PIP 512.

High:

- Max 5 real world point lights.
- One player bounce light.
- One peripheral/viewmodel fill.
- AO high or medium.
- Scope PIP 768.

Ultra:

- Up to 8 real world point lights.
- Physical reflection catchers allowed.
- Higher PIP.
- Heavier AO.

## Phase 8: Validation Matrix

Run:

```bash
npm run build
npm run preview
```

Browser console checks:

```js
window.__game.debug.perfSnapshotForBuilding(1)
window.__game.debug.perfSnapshotForBuilding(3)
window.__game.debug.perfSnapshotForBuilding(8)
window.__game.debug.snapshot().visualRuntime
window.__game.debug.lightingStats?.()
```

Manual checks:

- Building 1: wet dock still has readable light pools.
- Building 3: nightclub color still works but does not explode real light count.
- Building 8: server farm still has cyan/cold reflections.
- ADS scope still aligns.
- Crosshair remains centered and not jittery.
- Reload holographic UI remains readable.

## Implementation Pitfalls

- Do not count fake lamp metadata as real lights.
- Do not remove `ceilingLights` entirely; flicker/peripheral tinting depends on it.
- If fake lights are used by adaptive lighting, make sure they have `position` and `color`.
- Avoid optional chaining mixed with ternaries in compact expressions; this repo already had one crosshair bug from that pattern.
- Do not mutate shared texture repeat values unless intentionally global.
- Do not dispose materials/textures still shared by other meshes.
- Avoid per-frame allocation inside lighting ticks. Reuse `THREE.Color` and `THREE.Vector3`.
- Do not call `_renderStack.configure` per frame.
- Do not add new postprocessing passes.

## Preferred Order Of Edits

1. Add lighting budget helper and debug counters.
2. Convert excess ceiling/accent lights to fake lights.
3. Reduce peripheral/player bounce light count by quality tier.
4. Make reflection catchers cheap except on ultra.
5. Adjust defaults and postprocessing quality.
6. Optimize scope PIP resolution/render conditions.
7. Add debug helpers.
8. Build and browser-check.

## Final Report Requirements

The implementing agent should report:

- Files changed.
- Build result.
- Runtime smoke result.
- Before/after light counts.
- Before/after debug snapshots for buildings 1 and 8.
- Any visual compromises made.

