# Integrating 3D Rules

Rules for taking Codex + Blender authored assets into this game without breaking the first-person experience. This complements [gun-standards.md](gun-standards.md); if the two disagree, use the stricter rule.

## Core Principle

Every authored asset must enter the game through the manifest, the reusable runtime loader, static validation, and a visual fit check. A good `.blend` is not enough, and a good screenshot is not enough. The asset has to be reproducible, named correctly, socketed correctly, budgeted, validated, and able to fall back cleanly.

Procedural visuals stay as fallback. Do not delete fallback meshes just because an authored GLB exists.

## Source Of Truth

- Blender source files live under `art_src/`.
- Runtime GLBs live under `public/assets/`.
- Asset IDs live in [src/assetManifest.js](src/assetManifest.js).
- Reproducible generated viewmodels should be built from scripts such as [scripts/build-m4-viewmodel-assets.py](scripts/build-m4-viewmodel-assets.py).
- Do not keep mystery GLBs. If a GLB matters, there should be a `.blend` or generator script that can recreate it.

Current reference assets:

- `weapon.rifle` -> `art_src/weapons/m4/m4_viewmodel.blend` -> `public/assets/weapons/m4/m4_viewmodel.glb`
- `weapon.pistol` -> `art_src/weapons/usp/usp_viewmodel.blend` -> `public/assets/weapons/usp_viewmodel.glb`
- `viewmodel.operative.hands` -> `art_src/viewmodels/operative_hands.blend` -> `public/assets/viewmodels/operative_hands.glb`

## Manifest First

New authored runtime assets must be declared in `src/assetManifest.js` before runtime integration is considered complete.

Rules:

- Weapons use stable IDs like `weapon.rifle`, `weapon.pistol`.
- Hands/viewmodels use stable IDs like `viewmodel.operative.hands`.
- Attachments use stable IDs like `attachment.scope.tier1`, `attachment.muzzle.suppressor`.
- Environment kits use stable IDs like `env.docks`.
- Null `src` means procedural fallback is authoritative.
- Non-null `src` means the asset must pass validation and runtime fallback behavior.

Do not add direct one-off `GLTFLoader.load("assets/...")` paths for production assets. Use the asset registry path so `assetRegistryStatus()`, cache/dispose behavior, `BASE_URL`, and fallback reporting stay correct.

## Coordinate And Scale Rules

Blender authoring convention:

- Author weapon forward as `+Y` in Blender.
- glTF export maps that to game-forward `-Z`.
- `WeaponRoot` must have identity transform: location `0,0,0`, rotation identity, scale `1,1,1`.
- Apply object scale before export. Non-applied scale creates bad sockets, bad bounds, and bad auto-fit behavior.
- The runtime may scale a whole viewmodel to a target first-person length, but internal sockets and authored parts must still be coherent.

Do not guess from viewport appearance alone. Check actual node transforms and exported GLB validation.

## Weapon Contract

Every authored first-person weapon needs:

```text
WeaponRoot
  visual
    mag
    trigger
    chargingHandle
    receiver/body/barrel/rail/grip parts...
  sockets
    muzzle
    muzzleFlash
    gripRight
    gripLeft
    magazine
    ejectionPort
    optic
    scopeCamera
    attachmentMuzzle
    attachmentMag
    attachmentForegrip
    attachmentLaser
```

Required clips:

```text
idle
fire
reload
ads
inspect
```

Rules:

- `muzzle` / `muzzleFlash` drive muzzle flash, smoke, lighting, hitscan debug, and VFX.
- `magazine` and `mag` must support reload timing and dropped-mag spawn points.
- `gripRight` and `gripLeft` must be plausible palm contact points, not decorative guesses.
- `optic` and `scopeCamera` must exist even if the weapon has no built-in optic. They define attachment/PIP alignment.
- Keep logical parts split if gameplay or animation may touch them later.
- First-person cropping may hide rear-only geometry at runtime, but source assets should remain logically complete when useful.

## Hands And Wristband Contract

The shared hands asset must satisfy [gun-standards.md](gun-standards.md), plus these hard lessons:

- `palm_r` must be a local child of `wrist_r`.
- `palm_l` must be a local child of `wrist_l`.
- Palm local offsets must be short wrist-local offsets. Do not accidentally put world-space palm positions under wrist parents.
- If palms are wrong, runtime socket snapping will drag the whole arm away from the weapon.
- The left wristband must live on the left forearm as a real 3D object, not as a flat HUD workaround.
- The wristband must remain visible while holding the M4 unless a specific animation intentionally occludes it.
- Hologram panels and rays must be 3D objects tilted toward the player. Runtime canvas textures can fill them, but the geometry must already face the player plausibly.

Known validation guard:

- `scripts/validate-weapon-glb.mjs --type hands` checks that palms are parented correctly and not using giant world-space offsets.

## Runtime Integration Rules

Use the reusable authored viewmodel path:

- Load via `createAssetRegistry()` and manifest IDs.
- Clone GLTF scenes safely.
- Run `configureViewmodelScene()` on authored viewmodels.
- Put first-person viewmodel objects on layer `1`.
- Preserve procedural fallback meshes.
- Keep gameplay timing authoritative. Animations follow gameplay state, not the reverse.

Gameplay-owned timing includes:

- fire
- reload
- ADS
- inspect
- weapon swap
- recoil
- ammo/magazine state

Authored animation binding should use current gameplay state:

- `reload` scrubs from `P.reloadTimer / P.RELOAD_TIME`.
- `ads` blends from ADS amount.
- `fire` plays as a shot one-shot.
- `inspect` plays from inspect input.
- `idle` loops when nothing else has priority.

## Slot Routing

Weapon slot visuals must match weapon IDs:

- Slot 1 / `weaponIdx === 0` is `weapon.rifle` / M4.
- Slot 2 / `weaponIdx === 1` is `weapon.pistol` / USP.

Do not let a newly generated pistol asset take over the M4 slot, and do not leave slot 2 on procedural fallback if `weapon.pistol.src` points at a valid authored GLB.

Debug state should make this obvious:

- `weaponVisualStatus().activeManifestId`
- `weaponVisualStatus().authoredViewmodels.weapon`
- `weaponVisualStatus().authoredViewmodels.authoredPistol`
- `assetRegistryStatus()`

## Attachments

Attachments should mount to sockets declared in `WEAPON_MANIFEST` / `ATTACHMENT_MANIFEST`.

Rules:

- Scopes mount to `optic` and align PIP using `scopeCamera`.
- Muzzle attachments mount to `attachmentMuzzle`.
- Magazine attachments mount to `attachmentMag`.
- Foregrips mount to `attachmentForegrip`.
- Lasers/lights mount to `attachmentLaser`.
- Do not bake scope/suppressor/foregrip variants permanently into a base weapon unless that weapon always owns them.

## Characters

Keep procedural enemies as fallback until authored character GLBs satisfy the runtime adapter shape.

Future character GLBs need:

- a stable manifest ID
- skeleton/bone validation
- animation clip validation
- LOD policy
- hitbox and weak-point bindings
- damage overlay material families
- status in `characterVisualStatus()`
- clean fallback if the GLB fails

Do not start by hand-patching gameplay AI around a character GLB. First make the authored character fit the manifest and debug contracts.

## Environment Props And Kits

Environment assets should enter as kit modules, not random one-off scene clutter.

Rules:

- Put authored kit modules behind `ENVIRONMENT_MANIFEST`.
- Keep procedural dressing fallback active.
- Validate collision policy: decorative-only, blocker, cover, or interactable.
- Keep density budgets stable. Do not raise `ASSET_BUDGETS` just because an asset is expensive.
- Debug status should show which kits are authored and which are procedural.

## Material And Lighting Rules

Every authored viewmodel should pass through `configureViewmodelScene()`.

Rules:

- Use correct color space for color maps.
- Avoid missing external texture paths.
- Keep env map intensity controlled.
- Disable SSR/reflection picking for first-person viewmodel meshes unless intentionally needed.
- Disable heavy shadow behavior on first-person viewmodels unless there is a measured reason.
- Put viewmodels on layer `1` so scope/PIP cameras can ignore them.
- Do not increase budgets to make failing assets pass. Fix the asset.

Default targets:

- Weapon: one 2K atlas preferred.
- Hands: up to 10 materials allowed.
- GLBs should be small enough to load quickly; avoid shipping giant generated assets when simple authored geometry does the job.

## Validation Commands

Run these before browser visual testing:

```bash
npm run validate:weapons
npm run test:asset-registry
npm run build
```

Useful direct checks:

```bash
node scripts/validate-weapon-glb.mjs public/assets/weapons/m4/m4_viewmodel.glb --type weapon
node scripts/validate-weapon-glb.mjs public/assets/weapons/usp_viewmodel.glb --type weapon
node scripts/validate-weapon-glb.mjs public/assets/viewmodels/operative_hands.glb --type hands
node scripts/asset-registry-probe.mjs
```

Use Playwright/browser checks only after static/build checks pass and only when a runtime visual pass is actually needed.

## Visual Acceptance

Static validation is necessary but not enough. Before finalizing, visually inspect:

- hipfire
- ADS
- scoped ADS/PIP
- fire
- reload early/mid/late phase
- inspect
- weapon swap
- forced authored fallback
- slot 1 M4
- slot 2 USP
- wristband idle screen
- inventory hologram
- reload hologram
- shop hologram

Common first-person failures:

- hand palm socket is technically aligned, but the forearm is visually detached
- support hand hides behind the receiver
- wristband becomes only a thin cyan edge
- hologram planes face the world instead of the player
- model looks correct in Blender but becomes tiny/huge after runtime scale-to-length
- old direct GLTF path overrides the manifest asset
- procedural fallback and authored mesh both render at once
- M4 and pistol slot routing are swapped

## Blender Preview Before Game Preview

For viewmodel fitting, use Blender MCP or Blender CLI preview first:

- Load the weapon `.blend`.
- Load the hands `.blend`.
- Apply the same source-space scale/offset logic that runtime uses.
- Retarget palms to `gripRight`, `gripLeft`, and `magazine`.
- Render a quick Blender thumbnail.
- Check wristband visibility and hand contact.

Only then move to in-game screenshot testing.

## Final Gate

A 3D asset is game-ready when all are true:

- It has a source `.blend` or reproducible generator.
- It has a manifest ID.
- It loads through the asset registry.
- Procedural fallback still works.
- Static GLB validation passes.
- `npm run build` passes.
- Blender-side fit preview looks plausible.
- Runtime debug status reports correct source and active manifest ID.
- Final in-game visual pass shows correct slot, scale, hand contact, sockets, and animations.
