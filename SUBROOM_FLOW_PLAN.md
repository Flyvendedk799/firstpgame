# Tactical sub-room flow — execution summary

This document links the **physical buildout** roadmap to the broader campaign rework. For narrative beats and zone economy, see [CAMPAIGN_LEVELS_REWORK_PLAN.md](./CAMPAIGN_LEVELS_REWORK_PLAN.md).

## Authoring contracts

| Constant | Value | Role |
|----------|-------|------|
| `AUTHORING_PLAYER_R` | `0.35` | Matches `PR` in `src/main.js` — doorway / prism clearance samples |
| `AUTHORING_NAV_AGENT_R` | `0.36` | Matches nav bake in `_buildNavGrid` — AI capsule vs `wl` |
| `BUILDING_SKELETON_POST` | `src/levelSequences.js` | Optional `(ctx) => void` after shared `buildCellSkeleton` — keep empty unless geometry is validated |

Floorplan **`spaces[id]`** should define `bounds`, `exits[]`, and optionally `primaryRoutes[]`, `connectorWidth`. Static graph checks: `npm run validate:campaign`.

## Tooling

- **`npm run validate:campaign`** — `bounds` / `exits` / `primaryRoutes` / transitions graph + zone door strings.
- **`npm run validate:geometry`** — requires **built** app + **`npm run preview`** on `4173` or `4174` (set `BASE_URL`). Opens zone doors 0+1 for nav bake parity, floods **front/mid spawns → back zone band**, zone-door prism + threshold polyline samples as **warnings** (use `GEOMETRY_VERBOSE=1` for full list). Hard-fails only on disconnected nav.
- **`window.__game.debug.runAuthoringValidation(bn)`** — same geometry report in devtools.
- **`window.__game.debug.setFloorplanDebugHud(true)`** — HUD strip: active `spaceId`, `exits`, `transitionsFrom`.
- **`window.__game.debug.setFloorplanMapLabels(true)`** — pause/full map draws floorplan space labels.

## Geometry kits (`ELEMENT_BUILDERS`)

- **`corridor`** — parallel `divider` pair (`width`, `gap`, `gapPos`, `len`, `rotY`).
- **`vestibule`** — two linked dividers (dog-leg / airlock).
- **`dogleg`** — two segments with independent gaps (`len1` / `len2`, `rotY1` / `rotY2`, optional `x2`/`z2`).

## Runtime hooks

- **Traverse objectives** — `director.objectives[]` entries `{ id, type: 'traverse_room', roomId }` complete when the player enters that floorplan space (`EncounterDirector`).
- **AI** — `tickEncounterEnemyIntent` sets `_fpHoldBoost` in connector-like `kind`s; cover risk uses `holdRiskCap + _fpHoldBoost`.
- **Reinforcements** — alarm pair spawn picks `roomId` via `pickFloorplanSpaceId` at spawn position.

## Per-building acceptance (playtest checklist)

| Bn | Choke reads (≥2) | Optional loop | Signature readable | Notes |
|----|------------------|------------------|---------------------|-------|
| 01 | west run, east compression, relay wedge, cage vestibule | west→MW→relay vs center | relay cage | Reference layout |
| 02 | coat check, vestibule kit | salon glass | concierge | `vestibule` kit |
| 03 | VIP cordon, DJ glass | mirror lounge | pit | |
| 04 | wine vault pair | study window | exec glass | |
| 05 | ICU, triage | observation | surgery glass | |
| 06 | ticket booth, maintenance `corridor` | operator window | platform | Wave C1 |
| 07 | stateroom ME, galley | bridge glass | deck | |
| 08 | hot/cold glass, control booth | cold aisle | racks | |
| 09 | customs, lanes | tower | sand axis | |
| 10 | sacristy, confessional | loft | altar | |
| 11 | engine `dogleg`, container spine | bridge wings | bridge | Wave C1 |
| 12 | boardroom, vault, helipad glass | reception | apex | |

Tick boxes during QA; tighten `EXTRA_ELEMENTS` / `floorplan.transitions` when a row fails.

## Polish backlog

- Decision-node signage: reuse `addSequencePlacard` / hero beacon strip in `addSequenceIdentityLayer` for authored T-junctions.
- Connector reverb: extend `reverbSetBuilding` or `tickLighting` when `pickFloorplanSpaceId` returns `connector` / `service_hall` (keep CPU/GPU budget in mind).
