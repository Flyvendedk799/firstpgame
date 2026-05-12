# Player Animation Immersion Upgrade Plan

## Purpose

Drastically improve the player-facing animation experience in CLEARANCE so the game feels more physical, reactive, and authored while preserving the existing Vite + Three.js runtime, current gameplay rules, renderer fallbacks, save compatibility, and acceptance scripts.

This is a plan only. It is based on a codebase read of the current runtime, not a generic animation wishlist.

## Codebase Read Summary

The shipped game is a Vite / Three.js r170 browser FPS with most gameplay and animation code still concentrated in `src/main.js`.

Relevant existing systems:

- `src/main.js` owns player state through `P`, hand/viewmodel state through `H`, first-person weapon meshes through `gunGrp`, knife through `knifGrp`, and the shadow/reflection body through `PLAYER_PROXY`.
- `updateHands(dt)` already drives procedural right-hand, left-hand, index finger, ADS, idle sway, sprint, fire, reload, weapon swap, barrel heat, reticle pulse, and optic scale.
- The main loop already drives camera bob, landing kick, damage pitch/roll, vault camera motion, crouch/slide height, weapon sway, sprint pose, body lean, and scope PIP roll.
- `shoot()`, `startReload()`, `switchWeapon()`, `tryPistolWhip()`, `tryQuickThrow()`, `updateExecution()`, `updateThrowAnim()`, and movement/vault/slide branches are the key gameplay event hooks.
- `src/visualProfiles.js` defines `PLAYER_VIEWMODEL_PROFILE`, `PLAYER_PROXY_PROFILE`, `VIEWMODEL_STATE_MACHINE`, and `WEAPON_SOCKETS_SPEC`.
- `src/assetManifest.js` defines `SHARED_HAND_SKELETON`, `VIEWMODEL_MANIFEST`, `ANIMATION_CLIPS.viewmodel`, and `ANIMATION_MANIFEST['animation.viewmodel']`.
- `README.md` explicitly says the project has upgraded first-person hands/viewmodel metadata, player proxy metadata, and debug APIs such as `viewmodelStateMachine()`, `weaponVisualStatus()`, `characterVisualStatus()`, and `playerProxyProfile()`.
- Current authored GLB paths for soldier and Deagle are intentionally disabled. The working path is procedural fallback plus manifest contracts for later authored assets.
- Tests already check renderer/runtime/weapon/player-proxy visibility through `scripts/render-smoke.mjs`, `scripts/visual-runtime-acceptance.mjs`, `scripts/asset-budget.mjs`, and `scripts/visual-regression.mjs`.

Current limitations:

- Player animation is implemented as scattered procedural math rather than a centralized player animation controller.
- Camera, weapon, hands, reload, recoil, vault, slide, lean, damage, and inspect all write directly into the same transforms, so moments can fight each other.
- The first-person hands are mesh groups, not a skeletal hand rig, so fingers and wrist motion are limited.
- Reloads are mostly one generic timing curve plus a few per-weapon mesh hide/rack cases.
- Locomotion has readable bob/sway, but it lacks footstep-phase ownership, acceleration/deceleration weight, turn inertia, shoulder shift, and strong movement identity per stance.
- `PLAYER_PROXY` currently casts a simple capsule-like body shadow and scales for crouch/slide, but it does not yet mirror player locomotion, weapon pose, landing, vault, death, reflection, or killcam intent.
- There is a manifest contract for viewmodel animation clips, but no runtime clip abstraction for additive layers, priorities, or event notifies.

## North Star

Make every player action read as a body doing work:

- Movement has weight, acceleration, foot rhythm, turn inertia, landing compression, and stance-specific breathing.
- Weapons feel held by hands, not glued to the camera.
- Reloads, swaps, melee, throws, vaults, slides, damage, and focus each have distinct authored poses.
- The player proxy supports shadows, reflections, death cam, killcam, and third-person glimpses without leaking into normal first-person rendering.
- All animation is debug-visible, budgeted, and testable.

## Non-Negotiables

- Preserve current gameplay timings unless explicitly tuned with a measurable feel goal.
- Do not add a new runtime animation library. Use Three.js, the existing manifest contracts, and small local modules.
- Do not revive disabled GLB paths unless the full scale, skeleton, animation, and regression path is fixed.
- Keep the game runnable after every phase.
- Keep `window.__game.debug` useful; animation state should become more observable, not less.
- Keep scope PIP stable: viewmodel layer 1 remains ignored by the scope camera, and optic alignment must not drift.
- Keep authored asset budgets aligned with `ASSET_BUDGETS`; new effects must not force budget caps upward.

## Phase 1 - Centralize Player Animation State

Create a small player animation runtime before adding more motion.

### Implementation

Add `src/playerAnimation.js` with pure-ish controller helpers:

- `createPlayerAnimState()`
- `updatePlayerAnimInputs(state, P, H, K, M, G, dt, now)`
- `resolvePlayerAnimLayers(state, dt)`
- `applyViewmodelPose(state, rigTargets)`
- `applyCameraPose(state, cameraTargets)`
- `getPlayerAnimDebug(state)`

Keep Three.js object writes in `src/main.js` at first, but move intent/state calculation out of the hot monolith.

Create explicit layers:

- `locomotion`: idle, walk, sprint, crouch, slide, jump, fall, land.
- `weaponPose`: hip, ADS, sprint-low, reload, fire, inspect, swap.
- `interaction`: vault, quick throw, pistol whip, execution, grenade throw.
- `additive`: damage flinch, suppression wobble, breath, focus, lean, landing.
- `camera`: bob, turn inertia, kick, tilt, head height.
- `proxy`: shadow/reflection/death body pose.

Each layer should output scalar weights and target offsets, not mutate meshes directly.

### Main.js Integration Points

- Replace target math inside `updateHands(dt)` with controller outputs gradually.
- Replace the main-loop gun settle block around camera/vault/sprint/lean with controller outputs gradually.
- Keep existing `damp()` usage and current transform values as initial compatibility defaults.
- Keep `P.ads`, `P.adsVis`, `P.sprintAmt`, `P.slideAmt`, `P.crouchAmt`, `P.bobPhase`, and `P.bobAmt` for compatibility until the new state fully owns them.

### Acceptance

- No visual regression yet; behavior should match current feel with cleaner ownership.
- `window.__game.debug.playerAnimation()` returns active state, layer weights, camera offsets, viewmodel offsets, proxy state, and last event notifies.
- `npm run build` passes.

## Phase 2 - Movement Weight And Camera Body Feel

Upgrade locomotion from basic bob to a full first-person body feel.

### Implementation

Add animation state derived from actual movement:

- Smoothed velocity vector in player-local space.
- Acceleration and deceleration impulse.
- Strafe lean separate from head lean.
- Turn-rate inertia from mouse yaw delta.
- Footstep phase based on distance traveled, not only time.
- Landing compression from impact velocity.
- Slide entry, hold, and exit envelopes.
- Crouch settle and uncrouch rebound.
- Jump/fall hand float and landing catch.

Camera outputs:

- `headBobX`, `headBobY`, `headRoll`, `headPitch`.
- `accelLagX`, `accelLagZ`.
- `turnLagYaw`, `turnLagRoll`.
- `landDip`, `landRebound`.
- `slideDrop`, `slideRoll`, `slideForwardPitch`.

Viewmodel outputs:

- Weapon lags behind acceleration.
- Sprint has a lower, more diagonal run pose with rhythmic shoulder pump.
- Sliding rotates the weapon inward and down, then catches on exit.
- Crouch subtly tucks elbows and lowers the support hand.
- Landing compresses wrists and then rebounds.

### Main.js Integration Points

- Movement logic around the horizontal movement branch updates local velocity and foot phase.
- Landing branch where `P.landKick` and `PP.shakeY` are set emits `land` notify.
- Slide trigger emits `slideStart` and slide end emits `slideExit`.
- Camera block uses controller camera offsets before setting `camera.position` and `camera.rotation`.
- Gun settle block uses controller viewmodel offsets before final ADS/optic correction.

### Acceptance

- Walking, sprinting, crouching, sliding, jumping, and landing are visibly distinct without affecting collision.
- ADS remains centered and scope PIP remains aligned.
- No text/UI overlap changes.
- Add a Playwright runtime probe that records debug state after walk, sprint, slide, jump/land, and ADS.

## Phase 3 - First-Person Hand Rig Upgrade

Keep the procedural meshes, but make the hands behave like a lightweight rig.

### Implementation

Refactor `rGrp`, `lGrp`, `rIdxGrp`, `rCurlGrp`, `rThGrp`, `lFingGrp`, and `lThGrp` into named bones/control groups:

- Right clavicle proxy.
- Right forearm.
- Right wrist.
- Right palm.
- Right thumb, index, curled fingers.
- Left forearm.
- Left wrist.
- Left palm.
- Left thumb and support fingers.
- Weapon socket control.

Add helpers:

- `captureViewmodelRestPose()`
- `applyHandPose(targets, dt)`
- `blendFingerCurl(hand, pose, weight)`
- `applyWeaponGripPose(weaponType, adsWeight, sprintWeight)`

Expand per-weapon grip data using `PLAYER_VIEWMODEL_PROFILE.weaponGripOffsets` and `WEAPON_SOCKETS_SPEC`.

Required hand poses:

- Rifle support grip.
- Pistol two-hand cup grip.
- Shotgun pump-ready grip.
- SMG compact grip.
- DMR/sniper optic support.
- Knife grip.
- Empty off-hand throw pose.
- Wristband/holo readable pose.

### Acceptance

- The left hand lands on plausible contact points for every visible two-handed weapon.
- The right index finger independently curls on fire and relaxes after.
- ADS never lets hands block the aim point.
- Weapon swap and reload do not snap hand positions.
- `weaponVisualStatus()` includes active grip pose and hand contact metadata.

## Phase 4 - Authored Procedural Reloads Per Weapon

Replace the generic reload envelope with weapon-specific procedural reload mini-timelines.

### Implementation

Add a local timeline system:

```text
reloadStart -> release -> remove -> retrieve -> insert -> chamber -> settle
```

Each timeline supports:

- Duration fractions.
- Hand targets.
- Weapon group offsets.
- Magazine visibility windows.
- Dropped magazine notify.
- Slide/bolt/pump/charging handle motion.
- Wrist holo readability protection.
- Audio notify hooks.
- Cancel windows for reload-cancel-on-fire/swap/melee.

Per-weapon reload identity:

- Rifle: mag release, left-hand mag pull/drop, fresh mag insert, charging handle tug.
- Pistol: support hand strips mag, inserts, slide/hammer settles.
- Shotgun: shell-by-shell or tube insert rhythm if gameplay keeps a full reload, with visible left-hand pump/port motion.
- SMG: fast mag rock-in, slap/rack.
- DMR: deliberate mag insert and bolt tug.
- Sniper: slower heavy mag/bolt manipulation.
- Suppressed pistol: compact magazine and slide rack.
- Knife: no reload; use inspect/twirl recovery instead.

### Main.js Integration Points

- `startReload()` starts a reload timeline and stores weapon/ammo context.
- Existing `P.reloadTimer` remains the gameplay truth until timeline fully replaces it.
- Existing mag visibility code in `updateHands(dt)` moves into timeline notifies.
- `spawnDroppedMag()` fires from timeline notify, not only `_prog >= 0.20`.
- `_drawReloadHolo()` reads the same timeline progress.

### Acceptance

- Every firearm has a distinct reload silhouette.
- Cancelling reload by firing/swap/melee ends visual timeline cleanly.
- Dropped magazine syncs with the hidden mag.
- Reload bar and holo remain accurate.
- Add a Playwright debug test that starts reload on each firearm and asserts timeline phase progresses and ends.

## Phase 5 - Recoil, Firing, Heat, And Weapon Personality

Make weapons feel different in hands, camera, and recovery.

### Implementation

Move current recoil data from `updateHands()` and `shoot()` into named fire profiles:

- `cameraKickPitch`
- `cameraKickYaw`
- `cameraShake`
- `weaponKickBack`
- `weaponKickUp`
- `weaponRoll`
- `supportHandBrace`
- `triggerCurl`
- `slideCycle`
- `boltCycle`
- `pumpCycle`
- `heatGlow`
- `settleDuration`

Keep `RECOIL_PATTERNS_LEARNABLE` and aim mechanics intact; this phase only improves visible response.

Add sustained-fire behavior:

- M4 and SMG climb and settle rhythmically.
- Shotgun has a heavy backward punch and slow shoulder recovery.
- DMR/sniper have strong single-shot recoil and deliberate return.
- Pistols have slide/hammer motion, trigger squeeze, and wrist snap.
- Suppressed weapons have smaller flash but clearer mechanical motion.

### Acceptance

- Firing any weapon communicates its class within one second.
- Full-auto no longer looks like the same single-frame kick repeated.
- ADS recoil remains readable but not nausea-inducing.
- Debug shows last shot profile and fire layer weight.

## Phase 6 - Interaction Animations

Give non-shooting actions authored physical beats.

### Implementation

Upgrade:

- Vault: direction-specific hand plant, shoulder dip, weapon tuck, push-off, settle.
- Slide: entry drop, weapon tuck, ground scrape shake, exit catch.
- Pistol whip: windup, strike, recoil, recovery, with weapon-specific reach.
- Knife melee/throw: shoulder draw, wrist snap, blade follow-through, re-equip settle.
- Grenade/quick throw: off-hand reaches out of frame, pin/throw beat, weapon regrip.
- Execution: camera approach, hand/body strike, target-relative recoil, exit settle.
- Inspect: per-weapon rotate, hand reposition, small finger taps, optic/attachment reveal.
- Focus: breath slows, hands steady, micro-tremor fades, subtle readiness lift.
- Damage: directional flinch from hit vector, hand brace, weapon dips but aim remains recoverable.

### Main.js Integration Points

- `tryPistolWhip()` emits `meleeStart`.
- `tryQuickThrow()`, `spawnGrenadeProjectile()`, and `spawnKnifeProjectile()` emit throw events.
- Vault trigger and vault tick emit `vaultStart`, `vaultApex`, `vaultLand`.
- `toggleFocus()` starts/stops focus layer.
- `takeDamage(amt)` emits damage flinch with direction/intensity.
- `startInspect()` and `updateInspect()` should be absorbed by the player animation controller.

### Acceptance

- Each interaction has anticipation, action, and recovery.
- Interactions blend correctly with ADS/sprint/reload cancellation rules.
- No interaction leaves `gunGrp`, `knifGrp`, or hands in a bad transform.

## Phase 7 - Player Proxy Body For Shadows, Reflections, Death Cam, And Killcam

Make `PLAYER_PROXY` an actual player body animation target, still hidden from first-person view.

### Implementation

Replace the simple scale-only proxy update with named body parts:

- Pelvis.
- Chest.
- Head.
- Upper/lower arms.
- Hands.
- Thighs/calves/feet.
- Weapon silhouette socket.

Drive proxy from the same player animation state:

- Walk/sprint foot phase.
- Crouch/slide height.
- Lean/ADS shoulder stance.
- Vault climb posture.
- Reload/support hand movement.
- Damage flinch.
- Death/last-stand collapse.

Keep `mat.colorWrite = false` for shadow-only mode, but support optional reflection-visible/debug-visible modes.

Add debug toggles:

- `debug.setPlayerProxy(true/false)` already exists; extend with mode: `shadow`, `visible`, `reflection`.
- `debug.playerProxy()` returns active pose, locomotion phase, visibility mode, and part count.

### Acceptance

- Player shadow/reflection no longer looks like a static capsule.
- Death cam and killcam have a plausible body source.
- Proxy never renders into normal first-person view or scope PIP unless explicitly debug-enabled.

## Phase 8 - Animation Events And Notifies

Make animation drive secondary feedback cleanly.

### Implementation

Introduce notifies emitted by the controller:

- `footstepLeft`, `footstepRight`
- `landLight`, `landHeavy`
- `reloadMagOut`, `reloadMagDrop`, `reloadMagIn`, `reloadChamber`
- `weaponSwapHide`, `weaponSwapShow`
- `meleeImpactFrame`
- `throwRelease`
- `inspectFocusPoint`
- `slideScrape`
- `breathPeak`

Wire notifies to existing systems:

- Footstep audio/dust later; debug now.
- Dropped mag.
- Reload holo progress.
- Muzzle/slide/bolt/pump mechanical movement.
- Melee hit timing.
- Throw projectile release timing.

### Acceptance

- Projectiles and melee no longer fire at the start of an animation when the visual release says otherwise, unless gameplay requires instant response.
- Every notify is visible in `debug.playerAnimation().recentNotifies`.
- No repeated notify spam when a frame rate hiccup occurs.

## Phase 9 - Optional Authored Asset Path

Use the existing manifest contract to prepare for real viewmodel animation clips, but keep procedural fallback authoritative.

### Implementation

Do not start by importing GLBs. First extend contracts:

- Add clip metadata for one-shot vs loop vs additive.
- Add root motion policy: ignored for first-person, sampled for proxy only if needed.
- Add per-weapon grip/socket validation.
- Add clip event markers for reload/fire/throw.
- Add fallback mapping from authored clip name to procedural timeline.

Potential future authored clips:

- `idle`
- `walkSway`
- `sprint`
- `ads`
- `reloadPistol`
- `reloadRifle`
- `reloadShotgun`
- `reloadSmg`
- `reloadMarksman`
- `reloadHeavy`
- `inspect`
- `melee`
- `grenadeThrow`
- `weaponSwap`
- `damageFlinch`
- `focusMode`
- `tacticalLean`

### Acceptance

- `assetPreflight()` can validate viewmodel animation metadata.
- Missing authored assets still use procedural timelines without warnings becoming errors.
- No disabled GLB path is revived casually.

## Phase 10 - Debug, QA, And Regression Tests

Animation feel needs visual QA plus machine checks.

### Debug API Additions

Add under `window.__game.debug`:

- `playerAnimation()`
- `setAnimDebugOverlay(on)`
- `setPlayerProxyMode(mode)`
- `forcePlayerAnimEvent(name, options)`
- `viewmodelPose()`
- `reloadTimeline()`
- `movementAnimState()`

### Test Additions

Extend or add small Playwright scripts:

- Boot, move, sprint, slide, jump/land, ADS, fire, reload, swap, quick throw, pistol whip, focus.
- Assert no NaN transforms in camera, `gunGrp`, `knifGrp`, hands, reload holo, and player proxy.
- Assert `weaponVisualStatus()` still reports viewmodel/weapon parts.
- Assert `visualRuntime()` still reports player proxy and character animation states.
- Capture screenshots for normal, ADS, reload, sprint, slide, vault, and inspect.
- Run `npm run build`.
- Run `npm run test:render`.
- Run `npm run test:visual:runtime`.
- Run `npm run test:assets:budget`.

### Manual QA Checklist

- M4 hipfire, ADS fire, sprint cancel, reload cancel.
- Pistol ADS, suppressed fire, reload, quick melee.
- Shotgun fire/reload feel.
- SMG sustained fire.
- DMR/sniper ADS with scope PIP.
- Knife equip, melee, throw, execution.
- Sprint to slide to ADS.
- Jump/land while firing.
- Vault forward/back/left/right.
- Low HP damage flinch.
- Focus on/off.
- Player proxy visible in debug and hidden in normal play.

## Recommended Implementation Order

1. Add `src/playerAnimation.js` and debug state without changing visuals.
2. Move camera/viewmodel target calculations into the controller with parity.
3. Add movement weight: velocity, acceleration, turn inertia, land/slide/crouch layers.
4. Refactor hand controls and per-weapon grip targets.
5. Replace generic reload with per-weapon timelines.
6. Upgrade fire/recoil profiles.
7. Upgrade interactions: vault, slide, quick throw, pistol whip, inspect, damage, focus.
8. Upgrade `PLAYER_PROXY` with body pose mirroring.
9. Add notifies and route dropped mag/projectile release/melee impact through them.
10. Extend debug/test scripts and capture screenshots.

## Success Criteria

The upgrade is successful when:

- The first-person view feels like a body holding tools, not a camera with a weapon mesh attached.
- Movement, reloads, weapon swaps, impacts, vaults, slides, and throws each have a readable physical beat.
- Every weapon has a distinct animation personality.
- The player shadow/reflection/death body supports immersion instead of exposing the procedural placeholder.
- The animation state is inspectable through debug APIs.
- Build and current visual/runtime acceptance checks remain green.
- Scope PIP, ADS alignment, recoil mechanics, ammo state, save state, and gameplay timings remain intact.

## Blank Agent Start Prompt

```text
You are in /Users/tobiasmastek/Desktop/firstpgame. Read PLAYER_ANIMATION_IMMERSION_PLAN.md fully, then implement it phase by phase.

Start by adding a small player animation controller module and debug API with parity behavior before changing feel. Keep the game runnable after every phase. Do not add runtime animation libraries. Do not revive disabled GLB paths unless fully fixing the asset pipeline. Preserve ADS/scope PIP alignment, gameplay timings, save compatibility, and existing acceptance scripts.

After each phase, run npm run build and the smallest relevant Playwright/runtime checks. Before finishing, run npm run test:render and any added animation probes. Report exactly what changed, what was verified, and any residual risks.
```
