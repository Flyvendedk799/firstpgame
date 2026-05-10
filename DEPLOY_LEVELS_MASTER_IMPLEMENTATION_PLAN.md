# Deploy Maps & Levels Master Implementation Plan (Actionable for Coding Agent)

## Mission
Upgrade **all deploy maps/levels** into distinct, high-quality, replayable spaces with strong identity, better combat readability, richer traversal, and systemic depth. Explicitly ignore `teststory` and any throwaway test content. Focus only on the runtime/deploy pipeline that builds and serves real campaign content.

---

## Scope Guardrails (Do First)
1. Treat deploy content as sources under `src/story/levels.js`, `src/story/sifuDepthPack.js`, `src/levelSequences.js`, and integration points in `src/main.js`.
2. Add a strict filter so any IDs/tables associated with `teststory` are excluded from production sequence generation, progression, validation, and build artifacts.
3. Add a CI/assertion script that fails if non-deploy story IDs enter deploy bundles.

Deliverable: a `DEPLOY_ONLY_LEVEL_MANIFEST` constant and validation script that must pass before release.

---

## Phase 1 — Data Model Upgrade (High Leverage)
### Goals
- Convert current level descriptors into richer design documents that code can consume directly.
- Preserve backward compatibility while adding new fields.

### Tasks
1. Extend each level entry with:
   - `spatialSignature` (e.g., atrium, spine, pocket, pinch mix)
   - `verticalLayers` (ground/mezzanine/catwalk/pit)
   - `landmarkSet` (hero prop, silhouette marker, objective beacon)
   - `threatLanes` (primary, secondary, off-axis)
   - `stateMachines` (alarm/power/hazard transitions)
   - `replayUnlockGraph` (shortcut unlock dependencies)
2. Add a typed validation function to enforce schema completeness for all deploy IDs.
3. Build migration defaults so old saves/data still load.

Definition of done:
- All deploy levels (L01–L12) validate with zero missing required fields.
- Invalid fields produce precise error messages (level ID + key).

---

## Phase 2 — Spatial Variety System (Kill Generic Box Feel)
### Goals
- Break axis-aligned sameness.
- Create recognizable architecture per level.

### Tasks
1. In `src/levelSequences.js`, add support for room-shape primitives:
   - `pinch`, `pocket`, `spine`, `atrium` templates with parameterized dimensions.
2. Add non-orthogonal geometry helpers:
   - 30°/45° cover placement,
   - segmented curved walls,
   - asymmetric choke points.
3. Add per-level footprint profiles instead of one-size dimensions.
4. Introduce vertical anchors:
   - mezzanine platforms,
   - catwalk connectors,
   - pit depressions,
   - one-way drop routes.

Definition of done:
- Every deploy level has at least one non-axis focal geometry and one vertical engagement layer.

---

## Phase 3 — Encounter Choreography 2.0
### Goals
- Replace generic wave feeling with authored tactical beats.

### Tasks
1. Add `encounterBeatType` per room card: `read`, `brawl`, `hold`, `snipe`, `stealth_or_loud`, `boss`.
2. Build a beat-driven spawn director that reads geometry + threat lanes.
3. Add reinforcement telegraphing:
   - pre-door lights,
   - audible rumble,
   - delayed breach timing.
4. Add adaptive pressure rules:
   - if player hard-holds one lane, trigger flank lane,
   - if player speed-runs, escalate elite injection in next beat.
5. Add controlled respite windows before boss thresholds.

Definition of done:
- Encounter logs show beat progression rather than flat zone wave counts.
- Playtest can identify each room’s intended combat verb.

---

## Phase 4 — World-State Reactivity
### Goals
- Make levels feel alive and situational.

### Tasks
1. Implement per-level state graphs with at least two dynamic switches:
   - Alarm state,
   - Power state,
   - Hazard primed state.
2. Ensure state transitions alter both navigation and combat composition.
3. Persist replay unlocks (doors/vents/shortcuts) across runs when earned.
4. Add visual language per state (lighting, emissive cues, signage status).

Definition of done:
- Triggering a state change in each level produces measurable route/combat differences.

---

## Phase 5 — Per-Level Identity Pass (L01–L12)
For each deploy level, perform a structured pass:
1. **Landmark pass**: one unforgettable hero space visible early.
2. **Route pass**: 1 main route + 2 meaningful alternates with tradeoffs.
3. **Combat pass**: one signature encounter unique to level fantasy.
4. **Traversal pass**: one mastery shortcut unlocked by performance.
5. **Readability pass**: signage, sightline framing, objective pull.

Ship checklist per level:
- Distinct silhouette,
- Distinct traversal gimmick,
- Distinct hazard/state behavior,
- Distinct boss threshold setup.

---

## Phase 6 — Integration, Tooling, and QA
### Tasks
1. Add lint/validation script for deploy level schema and sequence constraints.
2. Add snapshot tests for level manifests (IDs, route layers, encounter counts).
3. Add smoke traversal bot to verify all critical paths are completable.
4. Add perf budget checks (mesh count, dynamic lights, spawned actors).
5. Add “identity regression” checklist to prevent genericization in future edits.

Success metrics:
- 100% deploy levels pass schema + traversal + perf gates.
- 0 teststory contamination in deploy output.
- Average playtest rating on “map uniqueness” and “combat readability” improves release-over-release.

---

## Execution Order & Timeline
1. Week 1: Scope guardrails + schema upgrade + validation.
2. Week 2: Spatial primitives + geometry helpers + first 4 levels retrofitted.
3. Week 3: Encounter choreography + world-state reactivity on all levels.
4. Week 4: Identity pass L01–L12 + performance optimization + release candidate QA.

Parallelization suggestions:
- Agent A: data/schema/validators.
- Agent B: geometry primitives + sequence layout engine.
- Agent C: encounter director + state machine logic.
- Agent D: QA scripts + performance instrumentation.

---

## Hard Acceptance Criteria (Must All Be True)
- Deploy-only filter is enforced and tested.
- All 12 deploy levels have unique identity signatures and no generic-layout fallback in shipped build.
- Every level supports at least one mastery shortcut and one state-reactive route change.
- Encounter pacing is beat-authored and observable in telemetry.
- No breaking regression in progression, saves, or performance budgets.

If any criterion fails, do not mark complete.
