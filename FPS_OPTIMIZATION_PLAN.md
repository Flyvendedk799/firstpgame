# FPS optimization — full-scope execution plan

This document is a **single, complete work order** for an agentic coding agent. **Do not reorder or prioritize internally** unless two tasks deadlock; execute all scopes below to completion unless a blocker is hit (then document the blocker in the PR/commit message).

**Technical context:** Browser FPS on Vite + Three.js (`three@0.170.0`). Primary gameplay and rendering live in [`src/main.js`](src/main.js). Level geometry is procedural in `buildLevel()`. Clearing rooms and enemies use 2D wall AABB logic; projectile/world hits use raycasts against [`G.levelData.solids`](src/main.js).

**Goal:** Raise **stable median frame rate** and **worst‑case frametime spikes** across deploy runs (and story playtest where applicable) **without changing core game design contracts** unless explicitly noted as an optional fidelity trade‑off subsection.

### Code‑verified baseline (audit before implementing)

These facts come from grepping [`src/main.js`](src/main.js); treat the §§ below as **building on** what exists:

| Topic | Already in codebase | Impact on §§ below |
|--------|---------------------|---------------------|
| WebGL/renderer | ~`5973`: `THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' })` | Do not restate “add powerPreference”; only tune if refactoring init |
| Resolution / DPI | ~`5974` sets initial `setPixelRatio` **and** **`applyQuality()` ~7792–7800** wires `SETTINGS.quality` (`low/medium/high/ultra`) to pixel ratios **`1`, `1.25`, `min(dpr,2)`, `min(dpr,2)`** plus scope RT size | Renderer §2: tie new DPI caps **through `applyQuality` + pause menu**, not a standalone number |
| Color / HDR | ~`5976–5977`: `SRGBColorSpace`, `ACESFilmicToneMapping`, `toneMappingExposure=1.18` | Color §2 item = regression guard / optional cheaper path, not bootstrap |
| Post-process | Imports ~`13–41` addons; **`EffectComposer`, `RenderPass`, `UnrealBloomPass`** ~5988+, `_composer.render()` in RAF (~16275, ~17089); bloom strength keyed off **`SETTINGS.quality`** ~7794–7797 | **Must be in scope explicitly** — half‑res bloom, skip composer tier, resize on resize handler |
| Shadows | No `shadowMap` / `castShadow` usage found | §3 unchanged |
| Raycast | Pooled **`const rc`** ~8266 (`rc.far=80`) for bullets; **`new THREE.Raycaster`** still elsewhere (e.g. ~6959 knives, ~7973 wall helper) | §9 partially done — consolidate remaining hotspots only |
| Settings | **`SETTINGS`** + **`clearance_settings`** `localStorage` ~7789+; includes **`quality`**, **`gore`**, FOV/audio | Prefer extending `SETTINGS` / `saveSettings()` over unrelated storage keys |

---

## 0. Non‑negotiables (read before edits)

- **Preserve behavior parity** for gameplay rules unless a subsection explicitly allows a “fidelity toggle” fallback.
- **No silent regressions** to zone clears, spawning, LOS semantics, vaulting, pickups, story test flags, or build output.
- **Every optimization** must remain **reversible** behind a compile‑time constant, `SETTINGS` flag, or query‑string/`localStorage` dev override where runtime A/B comparison is valuable.
- **Measure before/after** using the instrumentation in §1 for any change touching the render loop, per‑frame allocations, raycast budgets, light counts, or draw calls.

---

## 1. Baseline instrumentation (add first, keep after)

Implement and leave enabled (dev + optional `--stats`/`?perf=1`):

1. **`performance.now()` frame timer** smoothed via exponential moving average (EMA) — log `fps`, `frameMs`, `p99-ish spike` ring buffer (~120 samples).
2. **`renderer.info`** polling (throttled to 1 Hz in dev overlay): calls, triangles, lines, points, geometries, textures.
3. **Optional `stats.js`‑style HUD** gated by `SETTINGS.showPerfHud` or `URLSearchParams`; must not allocate per frame inside the HUD text path (reuse DOM nodes or a single `<canvas>`).
4. **`console.time` markers** around `buildLevel` / building load and teardown to catch load spikes separately from steady‑state FPS.
5. **`memory` hints** where supported: `(performance as any).memory` in Chromium — log `{ usedJSHeapSize }` once per 5 s when perf mode on.

**Acceptance:** With perf HUD off, **zero allocations** added to the hot path (verify with Chrome Performance → allocation sampling on a 30 s combat session).

---

## 2. Renderer and global Three.js configuration

Reconcile every change with **existing** **`applyQuality()`** (~7792) and **`WebGLRenderer` init** (~5973):

1. **Pixel ratio —** integrate with **`SETTINGS.quality`** (today: `low` → **1**, `medium` → **1.25**, `high/ultra` → **min(dpr, 2)**). New caps (**e.g.** max **1.5**) must be wired through **`applyQuality` + pause quality buttons**, not silently overridden at init only.
2. **`powerPreference: 'high-performance'`** — already set; verify if any alternate renderer constructors appear (story/test paths).
3. **Tone mapping / color space —** already ACESFilmic + SRGB; optional work is **tiered downgrade** (cheaper preset) behind SETTINGS with before/after stills only.
4. **Transparent sorting / renderOrder —** audit only where profiler shows overhead; changing defaults can break layering.
5. **MSAA (`antialias:true`) vs post stack —** quantify cost jointly with **`UnrealBloomPass`** composer (see §2A); optionally disable HW AA on tiers that rely on softness from bloom/downscale instead.

### 2A. EffectComposer and UnrealBloomPass (explicit)

1. **`_composer.setPixelRatio`** / **`setSize`** behavior on `resize` — must stay consistent with **`renderer`** and **`applyQuality`** to avoid allocating full‑res buffers unnecessarily.
2. **Half‑resolution bloom** option on **`low`** / **`medium`** (separate bloom render target vs full viewport) measured before shipping.
3. **`low`** tier candidate: **`_composer`** bypass → **`renderer.render(scene, camera)`** only when `SETTINGS` allows (restore current look on `high+`).
4. Document **pass count per frame**: `RenderPass` + `UnrealBloomPass`; any added passes require matching perf evidence.

**Acceptance:** Same visual intent at default fidelity; screenshots before/after for one building × one layout (`npm run dev` stationary + combat); capture **median frameMs** delta with composer on vs composer bypass on same hardware profile.

---

## 3. Shadow policy (explicit choice)

1. Audit whether **shadow maps** exist; if shadows are absent, **leave them off by default** and document as intentional perf win for browser FPS unless a subsection below adds optional **cheap contact shadows only** via baked tricks.
2. If shadows are enabled: switch to **`PCFsoft` vs `PCF`** cost trade, reduce map sizes, restrict **shadow casters** to player + hero props only, **`camera.near/far`** fit to room bounds.
3. If adding shadows **is out of scope** for this pass: state explicitly in changelog that shadows remain disabled until a dedicated rendering milestone.

---

## 4. Lights: count, types, update cost

Locate all **`AmbientLight` / `HemisphereLight` / `DirectionalLight` / `PointLight`** creation (notably [`buildLevel` ceiling grid](src/main.js) and building accents):

1. **Cap total dynamic point lights** per scene; consolidate accent lights where possible into **fewer stronger lights + emissive trims** already used in maps.
2. **Remove per‑frame `.position` jitter** unless required; animate intensity only cheaply (`sin`), not color object churn (reuse `Color.copyHex` sparingly — prefer uniforms or preallocated colors).
3. **Flicker implementation** — no `new THREE.Color(...)` inside flicker ticks; mutate existing color or typed scalars only.
4. **Distance and decay** (`PointLight.distance`, decay model in r170 defaults) tuned so lights don’t affect distant fragments unnecessarily.
5. **Light baking fake:** swap some fill for **hemisphere/key/rim-only** setups if measured win (same mood profile table in `buildLevel`).

**Acceptance:** `renderer.info.lights` (if available via scene graph inspection) reduced or stable; frametime variance lower during disco/strobe accents (club building).

---

## 5. Materials: shader variants and compile hitches

1. **Reduce unique `Mesh*` material instances** produced in `buildLevel` and runtime VFX — share materials (`material.clone()` only where opacity differs).
2. **`MeshPhongMaterial` vs simpler Lambert/Basic:** profile hot meshes; downgrade non‑hero surfaces (distant crates, gantries marked `noBlock`) to **`MeshLambertMaterial`** where lighting response is negligible.
3. **`onBeforeCompile` / custom shaders:** if any exist elsewhere, consolidate; forbid duplicate defines that trigger **additional program variants**.
4. **Derivative materials from map textures** — enforce **single repeat + offset** mutate per atlas family, no per‑mesh `map.repeat.set` duplication that forces upload churn (batch per building palette apply block — already partly done; audit for stragglers).
5. **Transparent additive particles** — cap simultaneous layers; reuse geometry (instancing optional in §11).

**Acceptance:** Chrome “Rendering” tab shows **fewerPrograms** stabler across building loads; eliminate frame spikes correlate with material creation bursts during grenade/smoke bursts if any.

---

## 6. Geometry, meshes, and scene graph cardinality

1. **Merge static room geometry** inside `buildLevel` where mats allow — e.g., all non‑animated slabs of identical material → single `BufferGeometryUtils.mergeVertices`‑style merge (prefer Three’s merge utilities compatible with r170) **or** `InstancedMesh` for repeated pillars/crates if counts justify.
2. **Frustum culling stays on by default**; audit large groups that incorrectly disable frustum (`frustumCulled=false`) — remove necessity or bound with LOD.
3. **`userData.noBlock` décor** excluded from solids but still drawn — ensure these don’t inflate draw calls gratuitously post‑merge plan.
4. **Disposal discipline** — on `cleanup()` / quit / building teardown, **`dispose()`** geometries and materials currently leaked; chase `renderer.info.memory` climbs across 10 building restarts without full page reload.
5. **Solids array** rebuilding must not duplicate mesh references indefinitely when toggling modes.

**Acceptance:** Steady‑state triangles + draw calls trending **down ≥15%** on deploy map vs pre‑optimization baseline capture (same camera pose set), OR document why merges were unsafe (mixed animation states).

---

## 7. Textures and GPU upload churn

Audit canvas textures (`*_Tex` generators in [`src/main.js`](src/main.js)), emoji/skyline, monitor emissive textures:

1. **Fix dimensions** to **power‑of‑two only where mipmaps/aniso apply**; else keep POT where filtering benefits.
2. **Mark static textures `texture.needsUpdate=false`** after first upload unless animated; animated canvases **`Math.min` redraw rate** — e.g. CRT monitor `.60–10 Hz`, not screen refresh unless needed.
3. **Compression path** — optionally convert heavy RGBA canvases to **GPU‑compressed** assets only if build pipeline permits (if out of toolchain scope, defer with explicit NOTE).
4. **Anisotropic filtering** capped (`Math.min(cap, texture.anisotropy)`) sane default (e.g., 4) for angled floors.

---

## 8. Animations tied to gameplay (tick cost)

Enumerate all **`tickDynProps`, doors, chandeliers, disco, fountains, ragdolls, bullet casings**:

1. **`tickDynProps`:** reduce Euler writes; prefer reuse of quaternions/vectors cached on `userData` instead of `new THREE.Vector3()` per branch per frame — search for **`new THREE.`** allocations inside `@main` RAF loop hotspots.
2. **Door motion** stays but uses cheap lerp shared across doors.
3. **Pick one max cost** ornamental system per building to sleep when off‑camera (bounding sphere vs camera frustum) **if measurable** — must not glitch audio cues tied to visuals (gate by distance + time).

---

## 9. Raycasting and projectile physics

Locate **`Raycaster`** uses (knives, wall hits, pickups, melee checks):

1. **`Raycaster` instance reuse:** one pooled `THREE.Raycaster` with `layers` masks if beneficial; forbid `new Raycaster(...)` inner loops per frame allocations.
2. **`intersectObjects` target sets:** pass **narrow arrays** (`G.levelData.solids` vs whole scene); ensure solids exclude skinned fluff; consider **spatial bucketing** (uniform grid keyed by xz cell) wrapping static mesh list if ray volume high.
3. **Line‑of‑sight** (`Enemy.canSee`) sampling step `STEP=0.12` vs wall count — precompute **`walls` hashed grid** aligned with STEP or reduce walls checked via **spatial index** (`Map` bucket by floor cell indices). Maintain identical semantic (no seeing through pillars if wall AABB says blocked).
4. **Grenade swept‑AABB:** profile inner loop × wall count — same spatial index acceleration as §9.3.
5. **Pickups proximity:** avoid `Raycaster` for every frame if distance threshold suffices.

**Acceptance:** Worst grenade‑throw + shotgun spray scenario shows **≤ X% CPU** slice reduction in Performance tab (capture numbers in commit message).

---

## 10. Enemy and AI update budget (`EnemyManager.update`)

1. **`update` LOD:** dormant enemies (>N m + not alerted) reduced tick frequency (every 2nd/3rd frame) preserving fairness — **deterministic modulo on entity id**, not RNG, so behavior reproduces across runs.
2. **`pathfinding` (`_navAStar`)** recurrence guard — widen recalc timers under stress; reuse partial paths unless player moved **`> thresh`**.
3. **Squad tick** amortization — stagger squad brain updates via index ring.
4. **Barks / audio** capped per second globally (existing limits audited).
5. **Animation skinning / morph** — verify mesh counts per enemy; simplify distant enemy materials (LOD).

**Acceptance:** 30 s combat with ≥12 enemies maintains median frameMs within **budget** documented in HUD (derive budget from baseline median + 15% slack).

---

## 11. VFX: particles, blood, decals, smoke, flashes

Survey arrays like `G.trails`, shells, decals:

1. **Hard caps** per category (blood splats, persistent decals, bullet trails, smoke spheres); **oldest eviction** deterministic.
2. **Object pooling** for sphere/box particles — reset scale/opacity instead of allocate.
3. **Additive transparency** bursts — constrain shader cost (limit overlap count); prefer **fewer bigger sprites** vs many tiny meshes if current uses mesh spheres excessively.
4. **Screen shake / blur** hooks — clamp duration and cumulative amplitude to avoid cascading camera matrix churn.

---

## 12. Input, audio, DOM, HUD

1. **DOM HUD updates** (`textContent`) — throttle aggregated labels (enemy count only whenchanged); avoid layout thrashing (single RAF batch).
2. **Audio (`AudioContext` oscillators)** — verify no runaway spawning on rapid events; recycle nodes or throttle SFX overlaps.
3. **Pointer lock / menu** transitions must not rerun heavy `attachTexture` pipelines.

---

## 13. Build, delivery, and loading

1. **`vite build` analysis** — rollup visualizer (`rollup-plugin-visualizer`) optional ONE‑SHOT to confirm accidental duplicate three imports (none expected if single entry).
2. **Code-splitting (`main.js`):** OPTIONAL only if profiler shows JS parse bottleneck; extracting `buildLevel` to `levelGen.js` is allowed if coupling untangled cleanly **without cyclic imports**.
3. **Asset preloading:** avoid blocking splash; critical textures first — document order.
4. **Source maps prod policy** — off by default in prod build if size matters.

---

## 14. Story mode and teardown paths parity

Ensure optimizations apply uniformly:

1. **Story teardown** frees same classes of GPU resources as deploy (`cleanup`, `unloadStoryLevel`).
2. **Conditional logic** (`G.storyTestMode`) avoids extra branching in hot RAF inner loop — hoist mode checks outward where possible once per frame.

---

## 15. Configuration surface (expose all knobs)

Extend `SETTINGS` (or parallel `PERF_SETTINGS` exported from [`src/main.js`](src/main.js)):

- `pixelRatioCap`
- `maxPointLightsEffective`
- `perfHud`
- `aiSkipFramesModulo`
- `raycastSpatialIndex=true|false`
- `maxParticlesBlood`, `maxParticlesSmoke`
- optional `cheapMaterials=true` for QA potatoes

Persist dev‑only overlays / perf keys via **`SETTINGS` merge**: prefer **`localStorage`** key **`clearance_settings`** (existing) for user‑facing flags; **`firstp_perf`** JSON merge acceptable **only for dev‑only probes** so production saves remain compatible.

---

## 16. Automated verification hooks

Extend [`scripts/full-test.mjs`](scripts/full-test.mjs), [`scripts/gameplay-test.mjs`](scripts/gameplay-test.mjs), or add **`scripts/fps-regression.mjs`**:

1. **Playwright/Puppeteer** headless Chromium run **fixed seed** deterministic short scenario (shooting wall, spawn grenade IF scriptable safely) harvesting `window.__PERF.snapshot()`.
2. CI optional (non-blocking) archive JSON artifact **triangle/draw/frameMs p95**.
3. **Smoke assertion:** `vite build && node scripts/smoke-test.mjs` still passes unchanged exit codes.

---

## 17. Documentation deliverables updated in-repo

Modify [`README.md`](README.md):

- Perf flags / `SETTINGS` keys
- How to capture a baseline GIF + Perf trace for bug reports

---

## 18. Acceptance matrix (must all pass before closing work)

| Gate | Check |
|------|-------|
| A | `npm run build` succeeds unchanged contract |
| B | Manual 60 s combat: no obvious hitching vs saved baseline `.json` Perf snapshot artifact |
| C | Navigate 10 building cycles (menu restart) JS heap drift **< heuristic** (document absolute MB; if env noisy, cite why) |
| D | Enemy LOS / grenade collisions **golden tests**: small deterministic harness OR scripted asserts in `fps-regression` |
| E | Zone clear / exit unlock unaffected (automated gameplay script if exists) |

---

## 19. Work product packaging for the coding agent

1. Prefer **few wide commits logically grouped** BUT user asked agent do in one pass — acceptable as **single commit** titled `perf: FPS optimization sweep (planned)` with exhaustive body bullets mapping §§ above.
2. PR description must embed **baseline vs after table** `{ fpsMedian, fpsP95, drawCallsMedian, trianglesMedian }`.

---

## 20. Optional fidelity trade-offs (isolate behind flags ONLY)

Implement subordinate toggles ONLY after core scopes above landed:

| Flag | Behavior |
|------|----------|
| `SETTINGS.reducedBloomish` | reduce additive overlays |
| `SETTINGS.lowSkyboxPollution` | static skyline LOD |
| `SETTINGS.disableNonCriticalDecor` | skip gantries/stacked crates not on `walls` |

Default remains **maximum fidelity comparable to pre‑work** minus measured waste.

---

**End scope.** Execute numbered sections §0–§20 as written (**including §2A post-processing**, which supplements §2–§8 thematically); unresolved dependencies must be flagged inline in README under “Perf backlog” with reproduction steps rather than silently skipping.
