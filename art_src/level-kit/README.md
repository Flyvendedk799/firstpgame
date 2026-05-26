# Clearance B01 Level Kit

`clearance_b01_level_kit.blend` is the Blender source for the in-game editor
prefabs, seeded from the B01 Megaplex authored scene. Run
`blender --background --python scripts/export-level-kit.py` to open the source
file and regenerate the runtime kit.

The committed runtime contract lives in `scripts/level-kit-source.mjs` and
generates `public/assets/level-kit/b01-megaplex/manifest.json`, per-prefab GLBs,
and thumbnails with `npm run build:level-kit`.
