# Campaign level specs (B01–B12)

Authoritative **design → implementation** trail for each campaign building. Each building has a `B##_SPEC.md` derived from [`LEVEL_SPEC_TEMPLATE.md`](LEVEL_SPEC_TEMPLATE.md). Normative spatial language: [`LEVELS_PLAN.md`](../../LEVELS_PLAN.md). Sub-room kits and validation tooling: [`SUBROOM_FLOW_PLAN.md`](../../SUBROOM_FLOW_PLAN.md).

## Index

| bn | Spec | Encounter source | Status |
|----|------|-------------------|--------|
| 01 | [B01_SPEC.md](B01_SPEC.md) | [`CAMPAIGN_ENCOUNTERS[1]`](../../src/campaignEncounters.js) | Gold / shipped |
| 02 | [B02_SPEC.md](B02_SPEC.md) | Native clone + narrative overlay | Impl |
| 03 | [B03_SPEC.md](B03_SPEC.md) | Native clone + narrative overlay | Impl |
| 04 | [B04_SPEC.md](B04_SPEC.md) | Native clone + narrative overlay | Impl |
| 05 | [B05_SPEC.md](B05_SPEC.md) | Native clone + narrative overlay | Impl |
| 06 | [B06_SPEC.md](B06_SPEC.md) | Native clone + narrative overlay | Impl |
| 07 | [B07_SPEC.md](B07_SPEC.md) | Native clone + narrative overlay | Impl |
| 08 | [B08_SPEC.md](B08_SPEC.md) | Native clone + narrative overlay | Impl |
| 09 | [B09_SPEC.md](B09_SPEC.md) | Native clone + narrative overlay | Impl |
| 10 | [B10_SPEC.md](B10_SPEC.md) | Native clone + narrative overlay | Impl |
| 11 | [B11_SPEC.md](B11_SPEC.md) | Native clone + narrative overlay | Impl |
| 12 | [B12_SPEC.md](B12_SPEC.md) | Native clone + narrative overlay | Impl |

## Workflow (non-negotiable order)

1. Complete all four **maps** in the spec (route topology, beat timeline, encounter graph, spatial grammar).
2. Review against [`LEVELS_PLAN.md`](../../LEVELS_PLAN.md) north stars.
3. Implement / adjust [`CAMPAIGN_ENCOUNTERS[bn]`](../../src/campaignEncounters.js) floorplan + encounters; keep [`SEQUENCE_DEFS` / `EXTRA_ELEMENTS`](../../src/levelSequences.js) aligned via traceability table.
4. Run `npm run validate:campaign` (includes mandatory floorplan space ids from `MANDATORY_FLOORPLAN_SPACE_IDS_BY_BN`).
5. Run `npm run build` and `npm run preview` (note preview port), then `BASE_URL=http://127.0.0.1:<port>/ npm run validate:geometry`.
6. Playtest sign-off (date + build hash in spec).

## Meso room clearance (ship checklist)

Native campaign uses **meso gating**: where `director.zoneDoorRequires` is authored, zone doors open only after **zone kill-clear** (when `alsoRequireZoneClear` is true) **and** every listed encounter is completed (`EncounterDirector` + `room_clear` completion in data). Same rules are checked statically:

| Step | Command / note |
|------|------------------|
| Encounter + door graph | `npm run validate:campaign` (also exposed as `npm run validate:encounter-graph`) — validates `zoneDoorRequires` encounter ids, `authoredSpawns` ids vs encounter enemies, `room_clear` hostiles, `alertLink`, `completeEncounterId` |
| Build | `npm run build` |
| Geometry / nav | `BASE_URL=http://127.0.0.1:<port>/ npm run validate:geometry` — use a free port (`vite preview --strictPort --port 4174` if 4173 is busy) |
| Verbose geometry triage | `GEOMETRY_VERBOSE=1` — drive new regressions to zero or file an owner per warning (see below) |

Runtime dev unblock: `window.__game.debug.forceMesoZoneDoor(0|1)` (or equivalent) completes required encounter ids for that zone door index during tuning.

## Geometry validation triage

- `npm run validate:geometry` summarizes authoring warnings unless **`GEOMETRY_VERBOSE=1`** is set:

  `GEOMETRY_VERBOSE=1 BASE_URL=http://127.0.0.1:4173/ npm run validate:geometry`

- Warnings include zone-door prism samples and transition probes that are not hard failures; errors block exit code 1.

## Footprint and verticality (code)

Per-building `RW` / `RD` / `RH` and `layers[]` live in **`BUILDING_DIMS`** in [`src/main.js`](../../src/main.js) (search `BUILDING_DIMS`). Encounter floorplans currently share the B01 cell skeleton (`dock_intake` … `foreman_cage` space ids) while narrative and matrix identity are layered in specs, [`nativeEncounterNarrative.js`](../../src/campaign/nativeEncounterNarrative.js), and machine tactics patches in [`nativeEncounterTactics.js`](../../src/campaign/nativeEncounterTactics.js) (spawn nudges, per-BN cover anchors, alarm reinforcement `entry`).

## Mandatory floorplan spaces

Static validation requires these space ids on every building: `dock_intake`, `mid_lane_center`, `relay_cage`, `alarm_relay_room`. See [`MANDATORY_FLOORPLAN_SPACE_IDS_BY_BN`](../../src/campaignEncounters.js).

## Why Deploy can still feel “the same”

Completing the **data** work (native `CAMPAIGN_ENCOUNTERS`, narrative overlays, specs) does **not** by itself change what you walk through:

- **One shared partition skeleton** — [`buildCellSkeleton`](../../src/levelSequences.js) uses the same wall cuts and doorway gaps for every building.
- **Two macro layout modes in `buildLevel`** — spawn offsets, some partition dressing, and caution-sign placement follow `layout` (dock vs lobby macro). That capped how different adjacent buildings could feel when `(bn-1)%2` alternated strictly by parity.
- **Per-building identity today** is mostly [`SEQUENCE_DEFS[bn]`](../../src/levelSequences.js) props/accent, [`EXTRA_ELEMENTS[bn]`](../../src/levelSequences.js), [`BUILDING_DIMS`](../../src/main.js) footprint, sky/light profiles — not a new floorplan graph per level yet.

True “12 different places” per the plan still needs **geometry passes**: distinct `EXTRA_ELEMENTS` / optional [`BUILDING_SKELETON_POST`](../../src/levelSequences.js) / floorplan bounds where the matrix calls for it, then `validate:geometry` per building.

`buildLevel` now uses an explicit **per-building `layout` map** (B01 stays dock-style `0`) so campaign buildings do not all follow the same odd/even shell rhythm; that is a small feel tweak, not a substitute for bespoke topology.
