# Animation Import Handoff

This project stays Three.js-based. Imported models and clips should enter through
offline normalization, manifest/profile metadata, editor preview, and runtime
fallbacks before they are trusted in gameplay.

## Checklist

- Apply object and armature scale to `1.0` in meters.
- Normalize forward/up axes to `-Z` forward and `+Y` up.
- Keep a clean root transform; do not add runtime scale hacks.
- Validate GLB/GLTF with `gltf-validator`.
- Run glTF Transform cleanup before committing authored assets.
- Store stable manifest/profile IDs in level/editor data.
- Map weapon sockets, character bones, and Mixamo clips to semantic names.
- Keep materials, textures, triangles, LODs, and fallbacks inside budget.
- Confirm `debug.assetPreflight(idOrPath)` and editor asset health warnings are actionable.
- Keep imported animation playback, limited IK, BVH replacement, and retargeting behind guarded flags until validated.

## Profile Templates

Use the runtime templates from `IMPORT_PROFILE_TEMPLATES` in
`src/animation/assetPipeline.js` as the source of truth. They cover:

- `weaponViewmodel`
- `handsViewmodel`
- `humanoidCharacter`
- `mixamoAnimationSet`
- `meshyProp`
- `marketplaceStaticProp`

## Debug Surfaces

- `debug.assetPreflight(idOrPath)`
- `debug.animationHealth()`
- `debug.levelEditorAssetHealth()`
- `debug.animationProfiles()`

Warnings should state whether they are authoring-only or runtime-blocking. Bad
assets should fall back safely instead of preventing the editor or game from
booting.
