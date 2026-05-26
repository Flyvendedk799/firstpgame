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
- `src/game/` contains state factories, persistence helpers, shared math, and
  runtime context assembly.
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
- Debug or Playwright-facing APIs: start in `src/debug/installDebugApi.js`.
- Visual profile data, material manifests, and authored assets: keep using the
  existing dedicated modules in `src/`.
- Custom maps: keep changes in `src/customMaps/` unless boot orchestration needs
  to call into them.

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
