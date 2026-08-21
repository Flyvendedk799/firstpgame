# Clearance Architecture

This project is a Vite + three.js game. The long-term direction is to keep
`src/main.js` as the composition root and move game behavior into explicit
modules with named exports.

## Module Map

- `src/main.js` boots the app, prepares the patched `THREE` namespace, creates
  renderer/scene/cameras, wires systems, installs debug APIs, and starts the
  frame loop.
- `src/data/` contains static tables and pure lookup helpers. These modules
  should not touch the DOM, `window`, renderer state, or mutable gameplay state.
- `src/game/` contains focused gameplay modules with named exports. Keep these
  modules side-effect-light and let `src/main.js` wire them into scene/runtime
  objects.
  - `state.js`: player/game state factories.
  - `aimFeel.js`, `gunplayPolish.js`, `reloadFeel.js`, `combatFeedback.js`,
    `incomingFirePolish.js`, `playerDamageResponse.js`: weapon and combat feel.
  - `highClassFeel.js`: a final gameplay-feel director that smooths aim,
    gunplay, combat feedback, incoming fire, and reload signals into cohesive
    camera, crosshair, recoil-return, and viewmodel outputs.
  - `gameplayAnimationPolish.js`, `bodyPresenceLocomotion.js`,
    `traversalFeel.js`, `knifeFeel.js`: animation and embodiment logic.
  - `storyGameplayPacing.js`, `storyObjectiveFeel.js`: story-mode pacing and
    objective pressure.
  - `hologramSignals.js`: gameplay-driven signal state for hologram UIs.
  - `hologramVisuals.js`: canvas drawing, textures, depth frames, motes,
    ripples, and ghost projection helpers for hologram UIs.
- `src/systems/` is for runtime systems such as weapons, enemies, VFX, campaign
  flow, player movement, level building, and perf HUD.
- `src/ui/` is for DOM lookup, menu/HUD/settings rendering, and input binding.
- `src/debug/` owns `window.__game`, `window.__PERF`, and test-facing debug
  wrappers.
- `src/styles/game.css` contains the main game stylesheet that used to live
  inline in `index.html`.

## Where To Change Things

- Weapon balance, slots, and attachment data: start in `src/data/weapons.js`.
- Player/global state shape: start in `src/game/state.js`.
- Wrist/reload/shop holograms: put signal logic in
  `src/game/hologramSignals.js`, visual helper code in
  `src/game/hologramVisuals.js`, and leave only scene attachment/runtime wiring
  in `src/main.js`.
- Debug or Playwright-facing APIs: start in `src/debug/installDebugApi.js`.
- Visual profile data, material manifests, and authored assets: keep using the
  existing dedicated modules in `src/`.
- Custom maps: keep changes in `src/customMaps/` unless boot orchestration needs
  to call into them.

## First-Person Viewmodel Rendering

- The world renders with the gameplay `camera` (layer 0; FOV changes with ADS /
  sprint / focus). The first-person viewmodel — `gunGrp`, the procedural hands,
  knife, holograms, drop-kick feet, slide legs — renders in a **second pass**
  through `vmCamera` (child of `camera`, fixed FOV `VIEWMODEL_FOV_DEFAULT`
  = 56, near 0.012, layer 1). `vmCameraP2` / layer 2 does the same for the
  split-screen second player. Body presence (legs under the camera) is layer 3:
  rendered by the gameplay camera but never by the scope/PIP cameras.
- Consequences: zooming the world never magnifies/warps the gun, ADS uses
  `viewFit` scale 1 (see `src/animation/profiles.js`; `viewFit.z` is relative to
  the per-weapon hip rest z in `WEAPON_HAND_FITS[idx].gun`), and the viewmodel
  never clips into walls (depth is cleared before the pass).
- Anything you add under `gunGrp` is forced onto the viewmodel layer every frame
  (`_enforceFirstPersonViewmodelLayers`); lights get all render layers
  (`_tagLightForAllLayers`, also applied in the patched light constructors).
- World-space VFX that must line up with the barrel / magwell (tracers, muzzle
  ring, smoke, shells, dropped mags) must map their origin through
  `_gunLocalToVisualWorld` / `_viewmodelVisualToWorld`, because the viewmodel's
  screen position differs from its true world position.
- The iron-sight and pistol-RDS solvers project through `vmCamera`
  (`_syncViewmodelCamera(camera)`), never through `camera`.
- `gunGrp` z/rotation are driven from damped base trackers
  (`P._vmBaseZ/_vmBaseRX/_vmBaseRY/_vmBaseRZ`) plus per-frame additive pulses; do
  not damp `gunGrp` from its own previous-frame pose (that feeds additive offsets
  back and makes the gun drift). After snapping the root directly, call
  `_resetViewmodelBaseTrackers()`.
- Toggle procedural hand parts only through `_setVmPartVisible` so the legacy
  blockout meshes hidden by the AA-shell dedupe never reappear.

## Debug API Contract

Playwright and regression scripts use `window.__game.debug` and
`window.__PERF.snapshot()`. Preserve script-critical methods unless the scripts
are updated in the same change.

Script-critical debug methods include:

- `snapshot`
- `buildLevel`
- `settings`
- `P`
- `G`
- `rendererInfo`
- `rendererHealthMonitor`
- `blackFrameSelfTest`
- `sampleRuntimeFrame`
- `visualRuntime`
- `materialStats`
- `weaponVisualStatus`
- `characterVisualStatus`
- `scopePip`
- `switchWeapon`
- `playableWeaponIndices`
- `perfSnapshotForBuilding`
- `perfStressForBuilding`
- `runAuthoringValidation`
- `customMaps`

## Side-Effect Rule

New modules should avoid import-time side effects. DOM event listeners, window
globals, renderer mutation, localStorage writes, and scene mutations should be
performed by explicit installer/factory functions such as `installDebugApi(ctx)`
or `createUiRuntime(ctx)`.

## Verification

After each extraction phase, run:

```sh
npm run build
git diff --check
npm run validate:custom-maps
npm run validate:campaign
npm run validate:room-flow
```

After UI, debug, runtime, or level-building changes, also run the relevant
Playwright checks:

```sh
npm run test:campaign
npm run test:custom-editor
npm run test:player:anim
npm run test:render
npm run test:visual:runtime
npm run test:perf
```

Run `npm run test:acceptance` before merging a broad refactor, and
`npm run test:acceptance:full` before a release.
