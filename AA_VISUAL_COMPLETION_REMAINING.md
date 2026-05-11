# AA Visual Completion Remaining Work

## Purpose

This document describes what is still missing after the non-asset AA visual implementation pass, and how to complete each remaining piece without skipping corners.

The current codebase now has the main systems needed to receive higher-end content: renderer selection, WebGL post-processing, WebGPU post-processing experiments, visual profiles, PBR material helpers, procedural dressing, human-like procedural enemy stand-ins, player proxy/viewmodel metadata, VFX budgets, debug APIs, baseline capture scripts, and acceptance checks.

What remains is mostly production asset work plus one newly discovered renderer hardening item: `?renderer=webgl` works, but `auto` can produce a black screen on the user's real browser because it selects the WebGPU path.

## Current Completion State

Completed in code/procedural form:

- Renderer subsystem with `auto`, `webgpu`, and `webgl` modes.
- WebGL compatibility renderer and post-processing stack.
- WebGPU backend attempt with fallback support.
- Backend-neutral main rendering and scope PIP rendering.
- Per-building visual profiles and gameplay post profiles.
- PBR material library and generated procedural texture maps.
- Procedural AA-style level dressing, trims, grime, contact shadows, atmosphere sheets, and wet-surface metadata.
- Human-like procedural enemy archetype shells and readable silhouettes.
- Player proxy and upgraded procedural first-person viewmodel metadata.
- Weapon visual metadata and procedural detail pass.
- VFX budgets for trails, smoke, decals, flashes, shells, and impact effects.
- Debug API for renderer, profiles, materials, characters, weapons, scope PIP, VFX stress, screenshots, and perf captures.
- Acceptance scripts for campaign, AI, perf, visual runtime, render smoke, and baseline captures.

Still missing for full AA completion:

- Production WebGPU hardening on real browsers.
- Authored human character assets.
- Authored player arms/hands and full-body proxy assets.
- Authored animation clips and blend rules.
- Authored weapon GLB assets and attachment assets.
- Authored modular environment kits per building.
- Authored PBR texture sets and decals.
- Authored VFX sprite sheets/meshes/materials.
- Final lighting, atmosphere, reflection, and shadow authoring pass with real assets.
- Final LOD, memory, and performance tuning against real assets.
- Final visual regression and manual QA pass.

## 1. Renderer Hardening And WebGPU Black-Screen Fix

### What Is Missing

The game currently works when forced to WebGL with:

```text
?renderer=webgl
```

But the default `auto` path can select WebGPU and produce a black screen on at least one real browser/device combination. That means WebGPU is not yet production-ready as the automatic default.

### How To Achieve It

1. Add a startup black-frame detector.
   - Render several frames after renderer initialization.
   - Sample the canvas pixels.
   - Treat near-zero luminance and near-zero variance as a failed render.
   - Ignore the detector while intentional blackouts or loading fades are active.

2. Add automatic fallback.
   - If WebGPU initializes but produces black frames, destroy the WebGPU renderer path.
   - Recreate the renderer subsystem with WebGL.
   - Record the fallback reason as `webgpu-black-frame`.
   - Expose that reason through `window.__game.debug.rendererInfo()`.

3. Add a WebGPU post-processing kill switch.
   - If WebGPU base rendering works but node post produces black output, retry WebGPU without node post.
   - If direct WebGPU still fails, fallback to WebGL.
   - Record whether the failure came from `webgpu-init`, `webgpu-node-post`, or `webgpu-present`.

4. Make `auto` conservative until proven stable.
   - Keep `?renderer=webgpu` for explicit testing.
   - Allow `auto` to prefer WebGPU only after the black-frame detector passes.
   - Persist the last successful backend per browser in `clearance_settings` or a small renderer health cache.

5. Extend render smoke tests.
   - Add a black-frame assertion for WebGPU post, WebGPU direct, WebGL post, and WebGL direct.
   - Add a test that deliberately forces the WebGPU post path off and verifies fallback metadata.
   - Capture a screenshot for each backend path.

### Acceptance

- Loading the game with no query string never produces a black screen.
- `?renderer=webgl` works.
- `?renderer=webgpu` either works or clearly falls back with a visible reason.
- `window.__game.debug.rendererInfo()` reports the selected backend, fallback reason, post path, and black-frame status.
- Render smoke tests cover `auto`, `webgl`, and `webgpu`.

## 2. Character Art Direction And Source Generation

### What Is Missing

The current enemies are procedural human-like stand-ins. They prove the silhouettes, hitbox alignment, and class metadata, but they are not final AA-quality character assets.

Missing final character source assets:

- Scout.
- Marksman.
- Riot.
- Heavy.
- Drone/operator.
- Boss variants.
- Player first-person arms/hands.
- Player full-body proxy.
- Skin, cloth, armor, visor, strap, boot, glove, blood, sweat, dirt, and damage texture variants.

### How To Achieve It

1. Create a character art bible.
   - Use the existing archetypes as gameplay constraints.
   - Define proportions, silhouette rules, armor zones, weak points, color accents, and readability rules.
   - Create front, side, back, and three-quarter references for each archetype.

2. Use AI for concept and texture source material.
   - Generate character sheets for each archetype.
   - Generate clothing, armor, helmet, glove, visor, and fabric texture references.
   - Generate damage and dirt overlays.
   - Reject concepts that hide the head, weapon orientation, or class silhouette.

3. Create or generate base 3D meshes.
   - Use AI mesh generation, kitbashing, or Blender-assisted sculpting.
   - Keep topology clean enough for deformation.
   - Use consistent scale and forward axis.
   - Keep head, torso, arms, legs, hands, and feet separable enough for damage overlays and LODs.

4. Retopologize and clean.
   - Fix non-manifold geometry.
   - Remove unnecessary interior faces.
   - Keep shoulder, elbow, wrist, hip, knee, ankle, and neck loops animation-friendly.
   - Maintain consistent material slots.

5. Produce final GLBs.
   - Export one high-quality GLB per archetype.
   - Export separate LOD meshes or include LOD nodes in the same GLB.
   - Keep names stable and machine-readable.

### Acceptance

- Every enemy class has a final human-like authored model.
- Each archetype is readable within one second at combat distance.
- Head and weapon orientation stay readable under fog, bloom, muzzle flash, and strobe effects.
- Mesh scale matches existing gameplay hitboxes.
- Each model has high, medium, low, and cheap fallback representation.

## 3. Character Rigging, Hitboxes, And LODs

### What Is Missing

The current procedural rig is a useful placeholder, but final characters need production humanoid rigs, stable deformation, hitbox alignment, and LOD switching.

### How To Achieve It

1. Define a shared humanoid skeleton.
   - Root, pelvis, spine, chest, neck, head.
   - Clavicles, upper arms, forearms, hands.
   - Thighs, calves, feet, toes.
   - Optional gear bones for backpacks, shields, helmets, visors, straps, and boss equipment.

2. Rig every character to the shared skeleton.
   - Use consistent bone names.
   - Keep bind poses identical.
   - Use clean skin weights.
   - Avoid extreme weights that make armor collapse.

3. Bind hitboxes to visible body parts.
   - Head hitbox must match the visible head volume.
   - Torso hitbox must match chest/abdomen armor.
   - Limb hitboxes must match arms and legs closely.
   - Armor zones and weak points must have visible matching geometry.

4. Build LODs.
   - LOD0: close combat hero mesh.
   - LOD1: mid-range simplified mesh.
   - LOD2: low-range simplified silhouette mesh.
   - LOD3: impostor or cheap fallback.

5. Add LOD validation.
   - Debug overlay for active LOD.
   - Screenshot comparisons at known distances.
   - Hitbox overlay comparisons for each LOD.

### Acceptance

- All final character GLBs use the same skeleton.
- Animations can be shared or retargeted across all non-boss humanoids.
- Hitboxes align to visible bodies.
- LOD switching does not pop in a way that affects aim readability.
- Low LODs still preserve class identity and head location.

## 4. Character Animation Production

### What Is Missing

The current procedural animation communicates intent, but final completion requires authored animation clips.

Missing enemy clips:

- Idle.
- Patrol.
- Alert.
- Sprint.
- Strafe left and right.
- Crouch.
- Peek.
- Aim.
- Fire.
- Reload.
- Flinch by hit zone.
- Stagger.
- Grenade.
- Melee.
- Death variants.
- Takedown victim.
- Boss phase tells.

Missing player/viewmodel clips:

- Idle.
- Walk sway.
- Sprint.
- ADS.
- Reloads for each weapon class.
- Inspect.
- Melee.
- Grenade throw.
- Weapon swap.
- Damage flinch.
- Focus mode.
- Tactical lean.

### How To Achieve It

1. Generate or capture motion sources.
   - Use AI animation tools, mocap libraries, or hand-keyed Blender animation.
   - Keep motion grounded and tactically readable.
   - Avoid exaggerated poses that hide hitboxes.

2. Retarget to the shared skeleton.
   - Normalize clip length, root motion policy, and bone names.
   - Remove foot sliding where it affects combat believability.
   - Keep aim/firing upper-body layers compatible with locomotion.

3. Build animation state machines.
   - Locomotion base layer.
   - Upper-body aim/fire layer.
   - Hit reaction additive layer.
   - Death/takedown override layer.
   - Boss phase tell layer.

4. Tune competitive constraints.
   - No animation may move the head hitbox away from the visible head.
   - No flinch may make a registered target look unhittable.
   - No reload/turn/peek may fake impossible body orientation.

5. Add deterministic runtime checks.
   - Expose animation state in debug metadata.
   - Capture clips under fixed time steps.
   - Compare state names and approximate bone bounds in tests.

### Acceptance

- Every enemy archetype has complete combat animation coverage.
- Player hands align with every weapon during idle, ADS, reload, and swap.
- Hit reactions are zone-specific and readable.
- Animation blending does not break aim, hitboxes, or silhouettes.

## 5. Player Arms, Hands, And Full-Body Proxy

### What Is Missing

The current player presentation is procedural. Final completion needs authored first-person arms/hands and a full-body proxy for shadows, reflections, killcam/death cam, and future third-person moments.

### How To Achieve It

1. Model first-person arms and hands.
   - Gloves, sleeves, wrists, and skin variants.
   - Separate materials for glove, cloth, skin, stitching, rubber, and dirt.
   - Proper deformation around wrists and knuckles.

2. Rig viewmodel hands.
   - Use a hand skeleton compatible with weapon grip poses.
   - Add weapon grip reference bones.
   - Add attachment-specific hand offsets.

3. Build full-body proxy.
   - Lower-detail full character body.
   - Hidden from normal first-person camera unless needed.
   - Visible to shadows, reflections, death cam, and debug views.

4. Align with weapons.
   - Each weapon gets left-hand and right-hand sockets.
   - ADS pose must not block critical center-screen information.
   - Reload clips must line up with magazine, bolt, pump, or chamber geometry.

### Acceptance

- Player arms/hands look authored and high quality.
- Hands align with every weapon and attachment.
- Player proxy casts plausible shadows without clipping through the camera.
- Death cam and debug views show a coherent body.

## 6. Weapon And Attachment Asset Production

### What Is Missing

The current weapons have upgraded procedural presentation, but final AA completion needs real weapon GLBs and attachment meshes.

Missing assets:

- Pistol.
- Rifle.
- Shotgun.
- SMG.
- Marksman weapon.
- Heavy weapon.
- Suppressor.
- Scope.
- Sights.
- Magazines.
- Shell casings.
- Muzzle devices.
- Reticle and lens assets.

### How To Achieve It

1. Generate or model weapon meshes.
   - Use AI concepting, kitbash references, or Blender modeling.
   - Keep readable FPS silhouettes.
   - Keep geometry clean around moving parts.

2. Add attachment sockets.
   - Muzzle.
   - Optic.
   - Magazine.
   - Ejection port.
   - Left-hand grip.
   - Right-hand grip.
   - Muzzle flash origin.
   - Scope PIP camera origin.

3. Author PBR materials.
   - Scratched metal.
   - Polymer.
   - Rubber.
   - Glass.
   - Reticle emissive.
   - Heat wear.
   - Dirt and fingerprints.

4. Integrate animation.
   - Reload moving parts.
   - Shell ejection.
   - Recoil.
   - ADS settle.
   - Suppressed/unsuppressed muzzle behavior.

### Acceptance

- All weapons are authored GLBs with PBR materials.
- Weapon sockets match player hand poses.
- Scope PIP works in WebGL and WebGPU/fallback paths.
- No weapon blocks critical aim information.
- Gameplay projectile and hitscan behavior remains unchanged.

## 7. Modular Environment Art Kits

### What Is Missing

The current environment art pass is procedural. It adds density and visual identity, but final completion needs authored modular kits for every building.

Required kits:

- Docks: wet concrete, containers, cranes, puddles, industrial lights.
- Continental: polished stone, brass, wood, carpets, warm fixtures.
- Nightclub: neon, mirror panels, emissive floor, smoke, strobes.
- Penthouse: glass, metal, luxury props, skyline reflections.
- Medical: tile, surgical glass, blackout props, emergency lighting.
- Subway: rails, dirty concrete, warning paint, red haze.
- Yacht: teak, chrome, glass, moonlit deck, ocean mist.
- Server farm: racks, cables, panels, cold vapor, battery rooms.
- Any remaining campaign buildings mapped to the same visual-profile system.

### How To Achieve It

1. Define kit modules.
   - Wall panels.
   - Floor panels.
   - Ceiling panels.
   - Doors.
   - Door frames.
   - Windows and glass frames.
   - Vents.
   - Pipes.
   - Cables.
   - Rails.
   - Stairs and trims.
   - Props.
   - Signage.
   - Debris clusters.
   - Light cards and emissive fixtures.

2. Generate or model assets per building.
   - Use AI for concept/reference and texture generation.
   - Use Blender for clean modular geometry.
   - Keep dimensions compatible with existing layout and collision.

3. Preserve gameplay collision.
   - Do not replace authoritative collision with decorative mesh collision.
   - Visual modules must sit on top of the existing layout.
   - Any large new prop must be intentionally marked as blocking or decorative.

4. Add placement manifests.
   - Each building gets a list of decorative modules.
   - Modules include position, rotation, scale, material variant, LOD group, collision flag, and visibility tier.

5. Build prop density rules.
   - Every combat view should have near, mid, and far detail.
   - Props must not hide enemies unfairly.
   - Props must not create false cover unless gameplay collision agrees.

### Acceptance

- Every building has an authored visual kit.
- Gameplay navigation and cover rules remain intact.
- Every room/combat view has readable detail density.
- No decorative object creates fake collision expectations.
- Visual identity is obvious in screenshots without relying on HUD labels.

## 8. PBR Texture Sets, Decals, And Material Packing

### What Is Missing

The current material library can generate procedural maps, but final completion requires authored texture sets and decal atlases.

Missing texture categories:

- Concrete.
- Tile.
- Metal.
- Painted metal.
- Glass.
- Wood.
- Rubber.
- Fabric.
- Plastic.
- Skin.
- Hair.
- Armor.
- Emissive panels.
- Wet surfaces.
- Grime.
- Blood.
- Bullet holes.
- Scorch marks.
- Glass cracks.
- Warning paint.
- Signage.

### How To Achieve It

1. Generate or source base textures.
   - Use AI texture generation for albedo, height, normal, roughness, and masks.
   - Keep texture content tileable where required.
   - Avoid baked lighting in albedo.

2. Convert to engine-ready PBR maps.
   - Albedo in sRGB.
   - Normal in linear.
   - Roughness in linear.
   - Metalness in linear.
   - Emissive in sRGB.
   - Opacity/mask where needed.

3. Pack maps.
   - Use packed ORM where appropriate.
   - Build texture-size tiers for low, medium, high, and ultra.
   - Generate mipmaps and compression-ready outputs.

4. Build decal atlases.
   - Bullet holes.
   - Blood sprays.
   - Blood pools.
   - Grime.
   - Scuffs.
   - Cracks.
   - Sparks/impact stains.

5. Connect to material library.
   - Replace generated maps with authored maps when available.
   - Keep procedural fallback for missing or low-quality modes.
   - Track texture count and memory in debug metadata.

### Acceptance

- Final materials use authored PBR maps.
- Low quality still works with cheaper maps or procedural fallbacks.
- No missing textures appear in any building, weapon, or character.
- Texture memory stays within budget.

## 9. VFX Asset Production

### What Is Missing

The current VFX systems have budgets and procedural behavior, but final completion requires authored VFX assets.

Missing VFX assets:

- Muzzle flash sprites/meshes.
- Suppressed muzzle flash variants.
- Smoke sprites.
- Dust sprites.
- Sparks.
- Blood impacts.
- Armor impacts.
- Glass shards.
- Explosion elements.
- Flashbang effect assets.
- Smoke grenade sheets.
- Focus mode overlays.
- Low HP overlays.
- Kill beat overlays.
- Boss warning elements.

### How To Achieve It

1. Create VFX atlas sheets.
   - Generate sprite frames with AI or simulation tools.
   - Pack into atlases by effect family.
   - Keep alpha clean and premultiplied behavior consistent.

2. Build material variants.
   - Additive sparks and flashes.
   - Alpha-blended smoke and dust.
   - Decal blood and bullet impacts.
   - Distortion or heat shimmer where supported.

3. Integrate with existing budget system.
   - Use existing lifetime caps.
   - Use existing pooling and disposal paths.
   - Add high, medium, low, and off/reduced variants.

4. Author effect profiles.
   - Weapon-specific muzzle flash.
   - Surface-specific impact.
   - Enemy-specific blood/armor feedback.
   - Building-specific atmosphere and setpiece VFX.

### Acceptance

- Combat feedback is more legible and more polished than the procedural version.
- VFX never hide head/weapon orientation unfairly.
- Budgets prevent runaway mesh/material creation.
- Reduced-quality variants preserve gameplay feedback.

## 10. Lighting, Reflection, And Atmosphere Final Pass

### What Is Missing

The code now supports authored profiles, shadows, fog, glow, and atmosphere metadata. The final pass needs these systems tuned against real assets.

### How To Achieve It

1. Author lighting per building.
   - Ambient.
   - Hemisphere.
   - Key.
   - Fill.
   - Rim.
   - Local accents.
   - Emissive intensity.
   - Fog density and color.
   - Shadow budget.

2. Add reflection support where useful.
   - Environment maps for glass, metal, wet floors, and luxury interiors.
   - Cheap reflection alternatives for WebGL.
   - Disable or reduce reflection features in low quality.

3. Tune atmosphere.
   - Docks rain/wet fog.
   - Nightclub smoke/strobes.
   - Medical blackout haze.
   - Subway dust/red haze.
   - Yacht mist/moonlight.
   - Server cold vapor.

4. Validate readability.
   - Enemies must remain visible.
   - Head and weapon direction must remain readable.
   - Scope PIP must remain usable.
   - HUD overlays must not combine into unreadable states.

### Acceptance

- Each building has a distinct lighting mood.
- Real assets are grounded by shadows, AO, and contact shading.
- Atmosphere improves identity without harming competitive clarity.
- WebGL and WebGPU/fallback paths are visually close enough for production.

## 11. Asset Loading, Manifests, And Runtime Integration

### What Is Missing

The code has systems ready for assets, but final completion needs a clean way to declare, load, validate, and swap authored assets.

### How To Achieve It

1. Add asset manifests.
   - Characters.
   - Weapons.
   - Attachments.
   - Environment kits.
   - Materials.
   - VFX atlases.
   - Animations.

2. Define stable asset IDs.
   - `character.scout`.
   - `character.marksman`.
   - `weapon.rifle`.
   - `kit.docks.wall_panel_a`.
   - `vfx.impact.concrete`.
   - `material.wet_concrete`.

3. Add validation.
   - File exists.
   - GLB loads.
   - Required nodes exist.
   - Required sockets exist.
   - Required animation clips exist.
   - Required maps exist.
   - LODs exist.
   - Scale is valid.

4. Add graceful fallbacks.
   - Missing character asset falls back to procedural archetype.
   - Missing weapon asset falls back to procedural weapon.
   - Missing material map falls back to generated material.
   - Missing VFX atlas falls back to procedural effect.

5. Cache and dispose safely.
   - Reuse loaded GLBs/textures across levels.
   - Dispose unused render targets, geometries, and materials.
   - Track memory and asset counts in debug metadata.

### Acceptance

- Every production asset is referenced through a manifest.
- The game never silently fails into a black or invisible state because an asset is missing.
- Debug metadata exposes loaded assets, fallback assets, texture counts, and disposal status.
- Level reloads do not leak assets.

## 12. Performance And Quality Tuning With Real Assets

### What Is Missing

The current tests validate procedural systems. Real assets will change triangle counts, texture memory, animation cost, draw calls, and shader pressure.

### How To Achieve It

1. Define budgets.
   - Per-character triangle budgets by LOD.
   - Per-weapon triangle budgets.
   - Per-building prop budgets.
   - Texture memory budgets by quality tier.
   - Max active decals.
   - Max active particles.
   - Max shadow casters.
   - Max animation mixers.

2. Add asset-budget tests.
   - Parse manifests.
   - Load GLBs in a headless or browser test.
   - Count meshes, materials, bones, triangles, texture maps, and clips.
   - Fail when assets exceed budget without an explicit override.

3. Tune runtime quality.
   - Render scale.
   - AO.
   - Bloom.
   - Shadows.
   - Texture resolution.
   - Character LOD.
   - Weapon LOD.
   - Scope PIP resolution.
   - Atmosphere density.
   - Decal count.

4. Run stress scenes.
   - Max enemies.
   - Max VFX.
   - Worst building.
   - Scope PIP active.
   - Low HP overlay active.
   - Focus mode active.
   - Strobes/blackout/alarm active.

### Acceptance

- High quality looks materially better than the procedural version.
- Medium quality remains production-ready.
- Low quality remains readable and playable.
- No level reload leaks memory.
- Perf HUD and captures report renderer, post path, draw calls, triangles, texture count, render targets, character count, VFX count, decals, and quality tier.

## 13. Final QA And Visual Acceptance

### What Is Missing

The acceptance framework exists, but final completion requires running it against real assets and expanding it for asset-specific failure modes.

### How To Achieve It

1. Capture a new baseline pack.
   - Every building.
   - Every weapon.
   - Every enemy archetype.
   - Every boss.
   - Scope PIP.
   - ADS.
   - Focus mode.
   - Death cam.
   - Low HP.
   - Menus.
   - Setpieces.

2. Add visual regression thresholds.
   - Detect blank frames.
   - Detect missing textures.
   - Detect invisible enemies.
   - Detect invisible weapons.
   - Detect broken scope PIP.
   - Detect extreme overexposure.
   - Detect black-screen fallback.

3. Manual verification matrix.
   - Each renderer mode.
   - Each quality tier.
   - Each building.
   - Each weapon.
   - Each character archetype.
   - Each major post state.
   - Each setpiece.

4. Gameplay regression.
   - Campaign flow unchanged.
   - Hit registration unchanged.
   - Movement unchanged.
   - Input feel unchanged.
   - Scope behavior unchanged.
   - AI behavior unchanged.

### Acceptance

- All automated acceptance checks pass.
- Manual QA confirms no missing textures, blank frames, broken effects, broken animations, or broken scope PIP.
- Final screenshots show a dramatic visual improvement.
- Gameplay behavior remains intact.

## Recommended Completion Sequence

1. Fix WebGPU black-screen fallback first.
   - This protects every future asset pass from being confused with renderer failure.

2. Build the asset manifest format.
   - Characters, weapons, environment kits, materials, VFX, and animations need stable IDs before bulk asset work starts.

3. Produce one vertical slice.
   - One building.
   - One enemy archetype.
   - One weapon.
   - One viewmodel hand set.
   - One VFX family.
   - One lighting profile.

4. Validate the vertical slice.
   - WebGL.
   - WebGPU or fallback.
   - Scope PIP.
   - Hitbox overlays.
   - LOD switching.
   - Perf capture.
   - Baseline screenshot pack.

5. Expand to all characters.
   - Finish shared skeleton, rigs, LODs, damage overlays, and animation coverage.

6. Expand to all weapons.
   - Finish GLBs, PBR materials, sockets, attachments, animation alignment, and scope behavior.

7. Expand to all buildings.
   - Finish modular kits, textures, decals, props, lighting, atmosphere, and readability tuning.

8. Finish VFX and decals.
   - Replace procedural-looking effects with authored atlases and materials while keeping existing budgets.

9. Run full performance tuning.
   - Tune quality tiers and memory with all real assets loaded.

10. Run final acceptance.
   - Automated tests.
   - Baseline captures.
   - Manual QA matrix.
   - Final comparison against the original visual baseline.

## How It Wires Together For Full Completion

Full completion should be wired around a manifest-driven asset pipeline, with the current procedural systems kept as fallbacks.

The final structure should work like this:

1. Asset manifests declare every production asset.
   - Character manifests map enemy archetypes to GLBs, skeletons, animations, LODs, materials, damage overlays, and hitbox bindings.
   - Weapon manifests map weapon IDs to GLBs, sockets, attachments, hand poses, reload clips, muzzle origins, shell origins, scope origins, and material sets.
   - Environment manifests map building visual profiles to modular kits, prop placements, decals, lights, atmosphere emitters, and reflection assets.
   - VFX manifests map gameplay events to sprite atlases, mesh effects, materials, lifetimes, quality variants, and budget categories.

2. The loader validates manifests before gameplay starts.
   - It confirms files exist and required nodes, sockets, clips, maps, and LODs are present.
   - It records any fallback use in debug metadata.
   - It prevents silent invisible assets.

3. The existing renderer subsystem displays the result.
   - WebGL remains the production compatibility path.
   - WebGPU remains the high-end path after black-frame detection passes.
   - Scope PIP uses the same backend-neutral render-target path.
   - Post profiles are selected by building and gameplay state.

4. The material library becomes the bridge between authored and procedural content.
   - Authored PBR maps are used when present.
   - Generated PBR maps remain fallback assets.
   - Quality settings choose texture sizes, normal strength, reflection detail, and shader complexity.

5. Character factories swap procedural shells for authored rigs.
   - The enemy archetype still comes from gameplay.
   - The visual model comes from the character manifest.
   - The hitboxes remain authoritative and are bound to visible body zones.
   - Animation state, damage overlays, weak points, and LOD state are exposed through debug APIs.

6. Weapon factories swap procedural weapons for authored GLBs.
   - Gameplay weapon behavior remains unchanged.
   - Visual sockets drive hands, muzzle flashes, shell ejection, scope PIP, and attachments.
   - Player arms/hands are loaded as the viewmodel rig and aligned per weapon.

7. Level building keeps collision authoritative.
   - Existing layout and collision define gameplay.
   - Environment manifests add visual-only or explicitly blocking modules.
   - Props, decals, trims, lights, and atmosphere are selected from the building visual profile.

8. VFX systems keep their budgets.
   - Authored VFX assets replace procedural visuals.
   - Existing pooling, lifetime caps, and quality tiers prevent runaway cost.
   - Debug stress tests prove impacts, smoke, blood, flashes, shells, and decals stay bounded.

9. Acceptance proves completion.
   - Build and gameplay tests prove behavior did not regress.
   - Render smoke tests prove WebGL, WebGPU/fallback, post, scope PIP, characters, weapons, and VFX render.
   - Visual runtime tests prove every building and gameplay post state is visible and nonblank.
   - Baseline capture packs prove the final presentation is dramatically improved.
   - Manual QA confirms readability, hitbox trust, animation quality, and visual consistency.

When all of those pieces pass together, the upgrade is complete: real assets replace the procedural placeholders, the renderer is stable on real browsers, gameplay remains authoritative, and the game reaches the intended AA visual target without relying on fragile one-off fixes.

## Implementation Status (engine pass complete)

The non-asset engine work described above is now wired in code; the only outstanding work is the production of authored GLBs, animations, textures, atlases, and lighting probes that the engine is ready to load.

What is done in this branch:

- **Section 1 — Renderer hardening.** `src/rendering.js` adds a renderer health record in `localStorage`, a session fallback flag in `sessionStorage`, a conservative `auto` plan, off-canvas `blackFrameSelfTest`, a runtime canvas-luma sampler, a WebGPU node-post kill switch, detection of WebGPURenderer's silent WebGL2 fallback, and a defensive `init()` timeout. `src/main.js` runs the boot self-test in a microtask, samples the canvas every ~12 frames, and reloads to `?renderer=webgl` after consecutive black frames. `scripts/render-smoke.mjs` covers `auto`, `webgl`, and `webgpu`, the post kill-switch, and runtime sample assertions.
- **Sections 2/3/5/6 — Character/animation/viewmodel/socket data.** `src/visualProfiles.js` carries the expanded character art bible (weapon types, armor zones, weak points, damage overlay policies), shared humanoid + hand skeletons, LOD spec, player proxy profile, enemy state machine, viewmodel state machine, and per-weapon socket spec. Debug API exposes each of these under `window.__game.debug`.
- **Section 7 — Modular environment kits.** `ENVIRONMENT_KITS` in `visualProfiles.js` declares per-building module categories, prop densities, collision policies, and budgets. Reachable as `dbg.environmentKit(building)`.
- **Section 8 — Extended PBR materials + decals.** `src/materialLibrary.js` includes blood, bullet holes, scorch, glass crack, warning paint, signage, marble, brass, chrome, leather, and grime presets with proper transparent/decal flags. `MATERIAL_MANIFEST` and `DECAL_MANIFEST` in `src/assetManifest.js` mirror the production set.
- **Section 9 — VFX profiles.** `VFX_PROFILES` in `visualProfiles.js` carries weapon, surface, enemy, building, and HUD families with budgeted lifetimes and quality tiers. Reachable as `dbg.vfxProfile(category, key)`.
- **Section 10 — Per-building lighting.** `LIGHTING_PROFILES` carries ambient, hemisphere, key/fill/rim, locals, emissive, fog, shadow budgets, reflection, and atmosphere per building. Reachable as `dbg.lightingProfile(building)`.
- **Section 11 — Asset manifest module.** `src/assetManifest.js` exports `ALL_MANIFESTS` (characters, viewmodels, weapons, attachments, environments, materials, decals, VFX, animations) with stable IDs, required-bone validation, and an asset registry (`createAssetRegistry`) that loads GLBs/textures on demand and tracks cache + dispose. Debug surface: `dbg.assetManifests()`, `dbg.assetManifest(kind)`, `dbg.assetPreflight()`, `dbg.assetRegistryStatus()`, `dbg.loadAsset(kind, id)`, `dbg.disposeAsset(kind, id)`, `dbg.disposeAllAssets()`.
- **Section 12 — Asset/perf budgets.** `ASSET_BUDGETS` (`src/assetManifest.js`) defines per-category limits and scene-wide caps. `scripts/asset-budget.mjs` validates the manifest and asserts the stress scene fits all caps. `dbg.assetBudgets()` and `dbg.rendererBudget()` surface the comparison at runtime.
- **Section 13 — Visual regression thresholds + QA matrix.** `scripts/visual-regression.mjs` walks all 12 buildings × 9 post states and enforces blank-frame, color-variation, overexposure, missing-texture, invisible-enemy, invisible-weapon, broken-scope-PIP, and fallback-metadata thresholds. Wired into `npm run test:acceptance`.

What remains:

- Production GLB authoring for every character, viewmodel, weapon, attachment, environment kit, and VFX prop.
- Real animation clips (the manifest declares the clip IDs; the engine plays whatever the loaded GLB provides and falls back to procedural sway/state otherwise).
- Production PBR texture sets, normal maps, roughness/metalness, AO, emissive, decals and atlases at the categories declared in `MATERIAL_MANIFEST` and `DECAL_MANIFEST`.
- Final lighting bake / probe authoring per building. The data table is in place; only the authored cube/IBL probes are missing.
- Authored VFX atlases and meshes for each entry in `VFX_MANIFEST`.

Until the authored assets land, the engine remains in fully procedural fallback mode — every system in the manifest reports `fallback` in `dbg.assetPreflight()`, the runtime tests pass, and the acceptance budgets stay green. When an artist drops a new GLB at the path declared in the manifest (or wires it through `dbg.loadAsset`), the registry takes over and the procedural fallback is bypassed for that ID without further code changes.
