# Gun Standards

This is the production contract for every first-person gun model in this project. The M4 is the reference implementation. Future Image -> Blender MCP -> GLB work should match this file before runtime integration starts.

## Required Weapon GLB

Every authored weapon GLB must export with this hierarchy and exact node names:

```text
WeaponRoot
  visual
    body / receiver / rails / stock / barrel parts...
    mag
    trigger
    chargingHandle
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

- Game forward is `-Z`; the model must face forward down `-Z` after import.
- `WeaponRoot` has applied transforms: location `0,0,0`, rotation identity, scale `1,1,1`.
- The muzzle socket is the source of truth for hitscan origin, muzzle flash, smoke, rings, debug probes, and spill lighting.
- `magazine` plus the `mag` part define reload animation and dropped-mag spawning.
- `optic` and `scopeCamera` define attachment mounting and scope/PIP alignment.
- Do not bake a permanent optic into the base gun unless that weapon always owns it. Base rifles should expose rails and attach optics through the socket contract.
- Scope meshes are attachments. Temporary procedural scopes and future authored scope GLBs must mount to `optic`/`scopeCamera`; they must not be baked into the rifle model.
- One 2K weapon atlas is the default target. Optional normal, roughness, and metalness maps are allowed, but there must be no missing external texture paths.
- Split logical parts by gameplay use: magazine, trigger, charging handle, muzzle device, receiver/body, handguard, stock, rails, attachment bodies.
- First-person viewmodels may crop or hide rear-only geometry such as stock/buttpad/buffer tube when it blocks the camera. Full logical parts should still exist in source assets when useful, but the runtime view must not cover the crosshair or critical aim information.

## Shared Hands GLB

The shared first-person hand GLB must export with:

```text
ViewmodelRoot
  cameraRoot
    weapon_socket
    wrist_r
      palm_r
      fingers_r...
    wrist_l
      palm_l
      fingers_l...
```

Required hand clips for rifles:

```text
idle
walkSway
sprint
ads
reloadRifle
fireRifle
inspect
weaponSwap
tacticalLean
```

Both hands share the same rig asset, but the right and left wrist/palm/finger chains must be individually controllable and keyed independently. Runtime may blend, scrub, or override one hand without forcing the other hand into the same pose.

Hands must be retargetable to `gripRight`, `gripLeft`, and `magazine` sockets. Sleeve or wrist geometry must stay outside the crosshair region in hipfire and ADS.

## Export And Validation

Before a weapon enters runtime:

1. Build or edit the `.blend` in `art_src/weapons/<id>/`.
2. Export the game GLB to `public/assets/weapons/<id>/<id>_viewmodel.glb`.
3. Put textures under `public/assets/weapons/<id>/textures/`.
4. Run:

```bash
npm run validate:weapons
```

For a new gun, run the validator directly:

```bash
node scripts/validate-weapon-glb.mjs public/assets/weapons/<id>/<id>_viewmodel.glb --type weapon
node scripts/validate-weapon-glb.mjs public/assets/viewmodels/operative_hands.glb --type hands
```

The runtime loader must reject missing sockets, missing clips, over-budget materials, missing textures, or invalid transforms and fall back to procedural visuals instead of breaking gameplay.

## Runtime Contract

Authored weapons are loaded through the reusable viewmodel loader, not a weapon-specific one-off. Manifest URLs must resolve through `import.meta.env.BASE_URL`.

At runtime:

- Authored M4 is used for singleplayer `weaponIdx === 0`.
- Procedural M4 remains the fallback and remains available for unsupported split-screen paths.
- Procedural hands remain the fallback if the shared authored hands fail validation.
- Gameplay stats, recoil, ammo, fire rate, reload authority, attachments, and scope/PIP logic stay gameplay-owned.
- Weapon `reload` is time-scrubbed from `P.reloadTimer / P.RELOAD_TIME`; the animation follows gameplay, not the other way around.
- `idle` loops, `fire` triggers on shot, `ads` blends with ADS amount, and `inspect` triggers from inspect input.
- Debug status must expose authored/fallback source, validation result, active clip names, socket readiness, visible authored mesh counts, and budget stats.

## Acceptance Checklist

For every future production gun:

- GLB validator passes for weapon and hands.
- `npm run build` passes.
- `npm run test:player:anim` passes.
- `npm run test:render` passes.
- `npm run test:assets:budget` passes.
- Hipfire, ADS, scoped ADS/PIP, fire, reload mid-phase, and inspect are visually checked.
- Muzzle flash originates at `muzzle` or `muzzleFlash`.
- Dropped magazine spawns from `magazine`.
- Scope and attachments align to sockets.
- Hands contact the weapon plausibly in hipfire, ADS, reload, and inspect.
- No authored weapon, hand, sleeve, stock, or attachment mesh overlaps the center aim region in hipfire unless it is an intentional ADS optic view.
- Temporarily invalidating the GLB path causes a clean procedural fallback.
