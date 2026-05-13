# Level spec template — `B##_SPEC.md`

Copy to `docs/levels/B##_SPEC.md` and replace `##` / `NN` placeholders. Remove this instruction block when filing.

---

## 1. Logline

One sentence player fantasy for this building only.

## 2. Three-second read

What (architecture, light, landmark) tells the player **which building** this is and **where pressure / exit** lives—without HUD.

## 3. Route topology map

**Nodes:** floorplan `spaces` ids (stable keys used in [`CAMPAIGN_ENCOUNTERS`](../../src/campaignEncounters.js)).

**Edges:** `rooms[].exits`, `floorplan.transitions` (`doorway`, `zone_door`, `line_of_sight`, `drop_read`).

**Mark:** mandatory happy path (`primaryRoutes[]` per space where authored), optional loops, any dead-end with purpose (loot, read, one-way drop per LEVELS_PLAN §3.2).

Include ASCII or mermaid `flowchart`; no ambiguous edges.

## 4. Beat timeline map

| T (order) | Zone | Verb | Composition intent | Geometry dependency |
|-----------|------|------|--------------------|------------------------|
| … | 0 / 1 / 2 | read / hold / push / … | roles / elites | corridor / pinch / panel offset / … |

Align macro bands to LEVELS_PLAN §4.1 (front read → mid commit → back signature).

## 5. Encounter graph

**Nodes:** `encounters[].id`, `room`, `objective`, `completion`.

**Edges:** `reinforcements[]` (trigger → squad), `director.objectives`, zone-door policy via transitions.

**Spawn binding:** `authoredSpawns` → `roomId`; patrol tags → `ENCOUNTER_PATROL_ROUTES` in `main.js`.

## 6. Spatial grammar map

Per cell or per space: **shape** (pinch / pocket / spine / atrium), **door type** (public / service / hard / one-way), **cover mix** (knee / chest / full), **sightline** (off-axis reads, hero prop focal).

## 7. Audio / lighting identity

Zone or room hooks (`tickLighting`, `reverbSetBuilding`) within project light budget (see CAMPAIGN_LEVELS_REWORK_PLAN).

## 8. Mastery / setpiece

Campaign mastery id or setpiece note if applicable.

## 9. Acceptance checklist

- [ ] Chokes authored, no surprise 360° pinches without telegraph
- [ ] Optional loop returns to spine with purpose
- [ ] Signature threshold readable
- [ ] No softlock; zone doors and spawn doors respected
- [ ] `validate:campaign` green
- [ ] `validate:geometry` green (or only accepted warnings)
- [ ] Playtest sign-off: date ______ build hash ______

## 10. Traceability table

| Spec geometry / room | `EXTRA_ELEMENTS` / `SEQUENCE_DEFS` | `floorplan.spaces` | Notes |
|----------------------|-----------------------------------|--------------------|-------|
| … | … | … | … |
