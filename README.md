# Firstp — three.js r170 (Vite)

Vite-based port of the original `Firstp/index.html` (which is r128 / inline-script). The original stays as the working reference — this folder is the migration target.

## Run

```
cd Firstp-r170
npm install
npm run dev
```

Vite opens http://localhost:5173 automatically.

## Build

```
npm run build      # outputs dist/
npm run preview    # serve dist/
```

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

## What's different from r128

The legacy 16k-line body is still in one file (`src/main.js`) and is unchanged except for four mechanical fixes:

1. **Imports at top** instead of 11 r128 `<script src=...>` tags. Addons (`GLTFLoader`, `SkeletonUtils`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`) are imported as named exports and re-attached to a mutable `THREE` clone so legacy `THREE.GLTFLoader` references still work.
2. **Light-intensity boost** — every `Ambient/Hemisphere/Directional/Point/Spot/RectAreaLight` constructor is wrapped to multiply `.intensity *= Math.PI`. r155+ flipped to physically-correct lighting; legacy intensities are ~π× too dim without this.
3. **`renderer.outputColorSpace = SRGBColorSpace`** — replaces the deprecated `outputEncoding`.
4. **`material.skinning = true` removed** at 4 sites — auto-detected in r155+, and setting it now throws.

That's it — no PMREM, no OutputPass, no envMapIntensity touching. The original Phong/Lambert wall materials look identical to r128 since they aren't routed through `scene.environment`.

## When the rig misbehaves

The Meshy soldier GLB has a baked 0.01 cm→m Armature scale. The auto-fit math in `applyMeshyRig()` measures the rig with `Box3.setFromObject(rig)` (default `precise=false`), which uses bind-pose bounding spheres — that's the un-Armature-scaled measurement the math expects.

**Do not pass `precise=true` to `setFromObject` on this rig.** It'll walk vertices through the Armature transform and the bbox comes back ~100× smaller, scale becomes ~175×, and the soldier renders enormous and animates wildly.

Same caveat for `attachDeagleGlbModel()`.

## Going further

- **Asset normalization** — apply transforms in Blender so the Armature scale is 1.0; then the auto-fit math becomes uninteresting.
- **Modularize** — split `src/main.js` (currently 16,800 lines) into `building.js`, `enemies.js`, `weapons.js`, etc. Vite hot-reloads modules independently.
- **Steam shell** — Electron + `steamworks.js` per `THREE_UPGRADE_PLAN.md` §11.
