# Campaign Room Flow Rework Plan

## Problem Statement

The current campaign geometry has many objects that look like subrooms, but the player experience is still a large open square. The screenshot from B01 after Deploy shows the core failure clearly:

- The player can stand near a perimeter corner and see across too much of the level.
- Interior walls do not reliably guide the player into a sequence of rooms.
- Empty floor remains between subrooms, so the map reads as a warehouse arena with obstacles.
- Enemies are visible or reachable from broad open angles instead of authored peek encounters.
- The HUD still thinks in `ROOMS 0 / 3`, because runtime progression is zone-based, not room-flow-based.
- The waypoint points at a far zone door, not the next tactical room/objective.
- Zone doors open from broad enemy clear rules, but the player is not being pulled room-by-room toward them.

This plan replaces “more subroom dressing” with a complete room-clear flow system: each level becomes a semi-linear chain of rooms, hallways, gates, and unique peek encounters that guide the player from Deploy to the final door.

## Non-Negotiable Design Target

Each campaign map must play like a compact tactical room-clearing level:

```text
Deploy -> entry vestibule -> first peek room -> connector hallway -> objective room
       -> flank/pressure room -> final threshold -> signature room -> exit door
```

The player may see optional side pockets, but the critical path must always be readable. The level should feel slightly maze-like because rooms turn, compress, reveal, and reconnect. It must not feel like a single arena with partition walls scattered around it.

## Level Design Is The Main Work

This rework is primarily a map design pass. Code helpers, gates, and validation are support systems. They are not the design.

For each building, the implementer must produce a map packet before placing final geometry:

1. **Top-down critical path**
   - Draw the intended player path from Deploy to exit.
   - Mark mandatory rooms, optional side pockets, connector halls, gates, and final arena.
   - The path must bend, compress, and reveal. It cannot be a straight line across a box.

2. **Room-by-room beat sheet**
   - Every room gets a gameplay verb: peek, breach, hold, flank, cross, clear, disable, survive, or duel.
   - Every room gets a reason to exist beyond decoration.
   - Empty transition space is only allowed if it creates anticipation, line-of-sight control, or recovery pacing.

3. **Sightline and occlusion plan**
   - Draw what the player can see from spawn, from each doorway, and from each objective.
   - Block long diagonal/perimeter sightlines that let the player solve future rooms from a corner.
   - Preserve deliberate previews: glass, slits, rails, arches, stair lips, and partial door reads.

4. **Gate and lock plan**
   - Mark which doors/gates are locked at Deploy.
   - Mark exactly what opens each gate.
   - Gates should make the route feel authored, not arbitrary.

5. **Enemy encounter plan**
   - Place enemies only after the room geometry exists.
   - Enemies must use the room: door angle, peek corner, side hall, overwatch window, objective cover.
   - Do not place enemies to “fill space.” Place them to create the room’s tactical problem.

6. **Negative-space pass**
   - Identify every large empty patch.
   - Either make it a deliberate readable combat floor, compress it into a hall, turn it into a room, or remove it with occlusion.
   - Large square floor areas are failures unless they are the signature arena.

7. **Route readability language**
   - Define how the player reads the next move without needing a minimap.
   - Use lighting gradients, floor markings, doorway hierarchy, landmark silhouettes, enemy placement, glass previews, and object orientation.
   - Every room should answer: “Where do I go next?” within two seconds of entry.

8. **Combat choreography**
   - Define the exact first-contact moment for each room.
   - Specify where the player first sees the enemy, where the safe cover is, where the enemy peeks from, when a flank reveals, and how the exit becomes readable after the fight.
   - Enemies should create authored beats, not generic pressure.

9. **Pacing and tension curve**
   - Define the rhythm across the whole level.
   - Alternate compression, reveal, contact, recovery, objective pressure, and escalation.
   - Do not make every room the same intensity or the level will feel like a corridor of identical fights.

The target is not “more walls.” The target is authored movement through meaningful spaces.

## Player-Feel Design Requirements

These requirements are mandatory because they define whether the maps actually feel good to play.

### Route Readability Language

The map must guide the player through environmental language, not just collision.

Required per room:

- a visible next threshold, landmark, light pool, floor marking, or enemy silhouette
- a hierarchy of doors: primary route reads stronger than optional side pockets
- floor/prop orientation that points along the intended path
- lighting contrast that pulls the player forward
- no equally important-looking dead ends unless they reconnect quickly
- waypoint support should confirm the route, not be the only way to understand it

Good examples:

- warm light spilling from the relay office while side storage is dimmer
- glass showing a future enemy but a locked gate forcing the current room first
- floor hazard stripe leading to a service door
- a tall silhouette or landmark framing the next room

Bad examples:

- four identical openings with no hierarchy
- a huge open floor where every direction looks valid
- an enemy placed in the distance just to draw the eye
- wayfinding that only works because the HUD points to it

### Combat Choreography Per Room

Every combat room needs a designed tactical sentence:

```text
Player enters/readies -> first contact appears -> player chooses cover/angle
-> enemy reacts/peeks/flanks -> room resolves -> next exit is revealed
```

Required per combat room:

- first visual contact location
- first shot angle
- player-safe cover or lean edge
- enemy primary cover/peek edge
- enemy movement or flank trigger, if any
- what changes after the room is clear
- how the next room is revealed

Room examples:

- **Peek room:** player sees a lookout through a doorway slit; safe cover is one step left; clearing the lookout opens a small gate.
- **Objective room:** anchor covers the objective desk; player must clear the angle before holding interact.
- **Flank room:** side door opens after first shot; flanker crosses behind glass before entering.
- **Signature room:** heavy is visible behind a final gate; overwatch creates pressure until player commits.

### Pacing And Tension Curve

Each map must have a deliberately authored rhythm.

Recommended level rhythm:

```text
safe spawn -> quiet read -> sharp first contact -> short recovery connector
-> objective pressure -> flank complication -> final threshold -> signature escalation
```

Required pacing rules:

- first contact should happen quickly but not instantly
- every intense room should be followed by a short read/reposition moment
- objective rooms should raise pressure through layout and enemy role, not only timers
- final rooms should be wider or more layered than earlier rooms, but still gated by a strong threshold
- optional side pockets should create curiosity or tactical advantage, not confusion
- a room chain should include at least one quiet anticipation beat and one escalation beat

For B01 specifically:

- spawn vestibule = safe orientation
- intake peek = first sharp contact
- service hall = short compression/recovery
- relay approach = tension build
- alarm relay = objective pressure
- drum flank = complication
- cage vestibule = anticipation
- relay cage = signature escalation

## Design Tooling Support

Blender MCP and image generation can support the map design process, but they should not become random asset generators.

Use Blender MCP for:

- fast top-down blockout inspection of room scale, corridor width, gate spacing, and sightline depth
- checking whether a proposed room chain feels like connected architecture rather than scattered blockers
- validating proportions: 1.15-1.4m tight service hall, 1.6-2.2m combat doorway, 3-5m small room, 6-9m signature room
- testing representative B01 blockouts before converting them into `levelSequences.js`
- inspecting existing Blender source assets only for scale/style consistency

Use image generation only for:

- mood/reference boards for a level identity
- quick top-down concept thumbnails for route language
- signature-room visual ideas
- player-facing landmark concepts

Do not use image generation as implementation truth. Every final gameplay space must be represented in the code-authored map graph and validated by room-flow rules.

Required design artifacts per map:

- top-down route sketch or Blender MCP blockout
- room beat list
- sightline/occlusion notes
- gate/open condition list
- enemy role placement list
- empty-space fixes

## Key Rule Change

The campaign must stop treating “front / middle / back” as the player-facing room structure.

Zones can remain as implementation bands for spawn budgeting and legacy systems, but the authored experience must be driven by smaller room nodes:

- `entry_room`
- `peek_room`
- `connector_hall`
- `objective_room`
- `flank_room`
- `threshold_room`
- `signature_room`
- `exit_room`

Every enemy, door, objective, patrol, cover anchor, and waypoint should belong to one of these authored room nodes.

## Required Runtime Changes

### 1. Add A Real Room Flow Graph

Create a new campaign flow data structure, likely in `campaignEncounters.js` or a new `campaignRoomFlows.js`.

Each building needs:

```js
{
  building: 1,
  startRoom: 'b01_entry_vestibule',
  exitRoom: 'b01_exit_cage_door',
  rooms: {
    b01_entry_vestibule: {
      parentZone: 0,
      bounds: { x0, x1, z0, z1 },
      kind: 'entry_room',
      next: ['b01_intake_peek'],
      gatesOut: ['b01_entry_to_intake'],
      encounterId: null,
      waypoint: { x, z },
      visibilityBudgetM: 8
    }
  },
  gates: {
    b01_entry_to_intake: {
      from: 'b01_entry_vestibule',
      to: 'b01_intake_peek',
      opensOn: { type: 'encounter_clear', encounterId: 'b01_intake_peek_clear' },
      meshId: 'b01_entry_to_intake_gate'
    }
  }
}
```

The `EncounterDirector` should track:

- current authored room
- active gate
- current room encounter
- next objective/room waypoint
- room clear state
- room visit order

The room graph should become the source of truth for player guidance.

### 2. Add Progression Doors Inside Zones

Add `roomGates` separate from existing `zoneDoors`.

`zoneDoors` can remain for major band transitions. `roomGates` must control the actual moment-to-moment room flow.

Required behavior:

- Gates are physical blockers with visible door/lock/read geometry.
- Gates open when the linked room encounter is complete.
- Gates can also open from objective completion, such as disabling the alarm relay.
- Gates rebuild nav/corner/cover data when opened, same as current zone doors.
- The waypoint should target the active room gate, not the far zone door.

Acceptance:

- In B01, after Deploy, waypoint should point to the first room threshold, not the final zone door 35m away.
- `ROOMS 0 / 3` should be replaced or supplemented with authored room progress, such as `ROOM 1 / 7`.

### 3. Spawn Enemies Per Room, Not Per Whole Zone

Stop spawning all zone hostiles as a broad set the player can see from corner positions.

Author enemies by room:

- `lookout` appears at the first peek angle.
- `anchor` holds a defensible full-height corner inside the active room.
- `flanker` starts in a side pocket connected to the room.
- `overwatch` appears only after the player reaches the room that can read that sightline.
- reinforcements enter through a gate, spawn door, or hallway that makes spatial sense.

Enemies in future rooms should be hidden, inactive, or physically occluded until their room is active or alerted.

Acceptance:

- From B01 spawn/corner, the player should not see 8-11 active hostiles across the map.
- First contact should be a deliberate peek encounter, not a broad arena shootout.

### 4. Replace Open Squares With Connected Occlusion

Subrooms must be structural, not decorative.

Every level needs a connected wall-and-door chain that prevents long open sightlines across the whole footprint. Use:

- solid divider walls
- L-shaped and U-shaped rooms
- dogleg hallways
- vestibules
- glass previews
- partial-height cover only after the route is already controlled
- locked gates between authored rooms

Hard map rule:

- No starting position should see deeper than the next two authored rooms.
- No combat room should have more than one uncontrolled open side.
- Every 8-10 meters of travel needs a threshold, turn, gate, glass read, or cover decision.
- Empty rectangular floor patches larger than roughly 6m x 8m must be broken by wall, route cover, elevation, prop cluster, or objective landmark.

### 5. Make Peek Encounters Unique

Each room should have a tactical micro-scenario:

- enemy behind glass before entry
- guard visible through a slit but not shootable until a better angle
- anchor covering the door from full-height cover
- flanker heard/seen crossing a side hallway
- suppressor enemy watching a long connector
- heavy revealed behind a final threshold
- overwatch visible but unreachable until a later room

This is the missing “game map” layer. The player should remember rooms by what they asked the player to do, not by prop type.

## B01 Gold Slice Requirement

B01 must be rebuilt first and used as the acceptance reference for the other 11 maps.

Current B01 failure:

- It has walls and subrooms, but the first area is still too open.
- The player can see too many enemies and too much level structure at once.
- The first door objective is too far away.
- The room clear system is zone-based and does not guide room-by-room.

Target B01 flow:

```text
1. Spawn vestibule
   Small protected starting pocket. Player sees one lit threshold and hears/reads the dock beyond.

2. Intake peek room
   One lookout visible through a partial angle. Player learns lean/peek.
   Clear opens the first internal gate.

3. West service hall / east flank preview
   Short dogleg connector. Player chooses a fast side angle but cannot bypass the room chain.

4. Relay approach
   Narrow threshold into alarm relay office. Anchor holds desk angle.
   Alarm panel is visible before entry but not safely interactable until room is controlled.

5. Drum flank pressure
   Side room wakes after relay contact. Flanker uses return loop, not open-field movement.

6. Cage vestibule
   Final pre-read through glass/rails. Heavy is glimpsed before full commitment.

7. Relay cage signature room
   Multi-angle final fight with catwalk/foreman read.
   Clear opens exit/final door.
```

B01 acceptance:

- From Deploy, player sees only the entry threshold and first peek room.
- First enemy contact happens inside or at the edge of the intake peek room.
- First internal gate is within 8-12 meters of spawn.
- Relay objective cannot be reached by crossing open floor.
- Cage fight cannot be engaged safely from the starting half of the level.
- HUD/waypoint always points to the next room/gate/objective.

## All-Map Requirements

After B01 is proven, apply the same room-flow standard to every map:

| Map | Required Flow Identity |
| --- | --- |
| B01 Loading Dock | service vestibule -> intake peek -> relay office -> cage |
| B02 Continental | lobby vestibule -> coat check -> concierge/security -> manager suite |
| B03 Nightclub | queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge |
| B04 Penthouse | elevator foyer -> reception -> gallery/office -> wine/study -> suite |
| B05 Medical | triage -> pharmacy/patient hall -> nurse relay -> surgery theater |
| B06 Subway | turnstile -> platform tunnel -> power closet -> switch chamber |
| B07 Yacht | aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite |
| B08 Server | mantrap -> cold aisle -> patch crawl -> ops relay -> core vault |
| B09 Border | inspection booth -> customs gate -> vehicle search -> tower/customs |
| B10 Cathedral | narthex/transept -> nave -> confessionals -> sacristy -> altar |
| B11 Freighter | cargo row -> companionway -> engine relay -> bridge approach |
| B12 Spire | glass lobby -> boardroom/vault -> maintenance spine -> helipad |

Each map must have:

- at least 6 authored room nodes
- at least 4 physical room gates or thresholds
- at least 2 connector hallways
- at least 2 glass/partial pre-reads
- at least 1 side loop that reconnects quickly
- 1 signature final room with a unique encounter rule

## Agent Execution Contract

This section is written for an agentic coding agent. Execute it in order. Do not skip a sequence because later sequences depend on previous acceptance gates. Do not start B02-B12 until B01 passes the gold-slice checks.

General rules for the agent:

- Keep the player experience goal visible at all times: guided tactical room clearing, not structure placement.
- Do not add geometry unless it belongs to a named room, gate, sightline, encounter, or negative-space fix.
- Do not place enemies before the room geometry and gate logic exist.
- After each sequence, run the listed validation and update the plan notes if the implementation discovers a better constraint.
- Preserve existing user changes. Do not revert unrelated work.
- Use Blender MCP for blockout/scale/sightline support where useful. Use image generation only for concept/mood, never as implementation truth.

## Agent Implementation Sequences

### Sequence 0: Establish Baseline And Failure Repro

Goal: capture the exact current failure so the agent cannot accidentally optimize the wrong thing.

Primary files:

- `src/levelSequences.js`
- `src/campaignEncounters.js`
- `src/encounterDirector.js`
- `src/main.js`
- `scripts/sequence-def-density-audit.mjs`
- optional diagnostic script under `scripts/`

Work:

- Inspect B01 current geometry, zone doors, enemy spawns, HUD room count, and waypoint behavior.
- Record a B01 failure note in this plan or a dedicated implementation note:
  - what player sees from Deploy
  - what enemies are active at start
  - first waypoint target
  - first locked/open door
  - largest empty open floor patch
- Use Blender MCP for a quick metric blockout check if changing room proportions.

Exit checks:

- Agent can state the current B01 failure in concrete terms.
- Agent has identified the minimum runtime systems that must change before geometry changes can solve the problem.

Stop rule:

- Do not start geometry edits until this sequence is complete.

### Sequence 1: Define Room Flow Schema

Goal: add the data model for authored room progression without changing all maps yet.

Primary files:

- new `src/campaignRoomFlows.js` or equivalent
- `src/campaignEncounters.js`
- `src/campaignFloorplanAuthoring.js`
- `scripts/validate-campaign.mjs`
- new `scripts/validate-room-flow.mjs`

Work:

- Add `CAMPAIGN_ROOM_FLOWS`.
- Define room node fields:
  - `id`
  - `building`
  - `parentZone`
  - `kind`
  - `bounds`
  - `next`
  - `gatesOut`
  - `encounterId`
  - `waypoint`
  - `visibilityBudgetM`
  - `purpose`
  - `readabilityCue`
  - `pacingTag`
  - `choreography` for combat rooms
- Define gate fields:
  - `id`
  - `from`
  - `to`
  - `meshId`
  - `opensOn`
  - `startsLocked`
  - `blockingAabb`
  - `label`
- Add validators for:
  - every `next` room exists
  - every gate `from` / `to` exists
  - every gate has an open condition
  - every encounter id resolves
  - every room has a gameplay `purpose`
  - every room has a `readabilityCue`
  - every room has a `pacingTag`
  - every combat room has `choreography`
  - every building has start room and exit room

Exit checks:

- `npm run validate:campaign` still passes.
- `node scripts/validate-room-flow.mjs` passes for a minimal B01-only draft.

Stop rule:

- Do not touch B01 final geometry until room-flow data validates.

### Sequence 2: Runtime Room Flow Director

Goal: make room flow the guidance system, while keeping legacy zones only as a fallback/budgeting layer.

Primary files:

- `src/encounterDirector.js`
- `src/main.js`
- `src/campaignRoomFlows.js`
- `src/campaignObjectives.js` if needed

Work:

- Add `currentFlowRoomId`, `previousFlowRoomId`, `activeRoomGateId`, `completedFlowRooms`, and `roomGateState`.
- Add room entry detection from `CAMPAIGN_ROOM_FLOWS` bounds.
- Add room clear tracking independent of `zoneClears`.
- Add `debug.roomFlow()` returning:
  - current flow room
  - active gate
  - next room
  - active encounter
  - blocked reason
  - completed flow rooms
  - room visit order
- Update waypoint selection:
  - first priority: active room objective
  - second: active locked gate
  - third: current-room hostile
  - fourth: exit after final room clear
- Update HUD to show authored room progress, for example `ROOM 1 / 7`, while preserving zone info only if useful.

Exit checks:

- B01 debug flow room changes as the player moves through draft bounds.
- Waypoint no longer defaults to far macro zone door when a room gate/objective is active.
- Existing campaign start/build does not crash.

Stop rule:

- Do not implement B02-B12 flow until B01 runtime flow works.

### Sequence 3: Room Gates And Nav Rebuild

Goal: add physical progression doors inside zones.

Primary files:

- `src/main.js`
- `src/levelSequences.js`
- `src/campaignRoomFlows.js`
- possible helper module for gate creation

Work:

- Add `levelData.roomGates`.
- Add a `makeRoomGate()` helper similar to `makeZoneDoor()` but driven by room-flow gate ids.
- Gates must:
  - be visible
  - block movement while locked
  - open from encounter/objective completion
  - mark their wall AABB as broken/unblocked
  - rebuild nav grid, wall index, corner edges, and cover slots when opened
- Add gate mesh ids matching `CAMPAIGN_ROOM_FLOWS.gates[*].meshId`.

Exit checks:

- B01 first gate exists and starts locked.
- Opening the gate changes nav reachability.
- `debug.roomFlow()` shows the blocked/unblocked reason correctly.

Stop rule:

- Do not place final B01 enemies until gates can control room traversal.

### Sequence 4: B01 Level Design Packet

Goal: design B01 as an actual map before final code placement.

Primary files/artifacts:

- `docs/levels/B01_SPEC.md`
- `CAMPAIGN_ROOM_FLOW_REWORK_PLAN.md`
- optional Blender MCP blockout
- optional generated top-down concept image for route language

Work:

- Produce B01 packet:
  - top-down critical path
  - seven room beat list
  - route readability language for each room
  - combat choreography sentence for each combat room
  - pacing/tension curve across the full B01 route
  - gate/open condition list
  - sightline/occlusion notes
  - enemy role placement list
  - empty-space fixes
- Use Blender MCP to sanity-check:
  - spawn vestibule size
  - first gate distance
  - corridor widths
  - relay room dimensions
  - cage vestibule scale
- If using image generation, create only a concept/reference for top-down route language, then translate manually into code-authored geometry.

Exit checks:

- B01 packet has no unnamed spaces.
- Every large floor patch has a purpose or a fix.
- Every enemy role belongs to a specific room beat.
- Every room has a readability cue that points to the next room/gate/objective.
- Every combat room has a first-contact angle, player cover answer, enemy peek/flank behavior, and exit reveal.
- The B01 route includes safe orientation, first contact, recovery, objective pressure, complication, anticipation, and final escalation.

Stop rule:

- Do not add B01 final geometry until the packet is complete.

### Sequence 5: B01 Structural Rebuild

Goal: make B01 no longer resemble the screenshot failure.

Primary files:

- `src/levelSequences.js`
- `src/campaignRoomFlows.js`
- `src/campaignEncounters.js`
- `scripts/validate-room-flow.mjs`

Work:

- Build the B01 room chain:
  - spawn vestibule
  - intake peek room
  - service/flank connector
  - relay approach
  - relay objective room
  - drum pressure room
  - cage vestibule
  - relay cage signature room
- Replace optional-looking route structures with mandatory walls/gates where needed.
- Block spawn-corner sightlines into mid/back rooms.
- Move the first room gate to 8-12m from Deploy.
- Remove or fill open floor that does not serve the room flow.

Exit checks:

- B01 has at least 7 flow rooms.
- B01 has at least 5 gates/thresholds.
- From spawn, final cage is not meaningfully visible.
- Player cannot reach relay/cage without passing the intended gates.
- `validate-room-flow` passes for B01.
- `npm run validate:campaign` passes.

Stop rule:

- Do not tune B01 enemies until structural traversal is correct.

### Sequence 6: B01 Encounter And AI Rebuild

Goal: make enemies use the B01 room architecture.

Primary files:

- `src/campaignEncounters.js`
- `src/campaign/nativeEncounterTactics.js`
- `src/encounterPatrolRoutes.js`
- `src/encounterBehavior.js`
- `src/encounterDirector.js`

Work:

- Re-author B01 encounters by flow room.
- Spawn or wake enemies room-by-room.
- Ensure active enemies at Deploy are only in room 1 and controlled room 2 preview.
- Assign every enemy:
  - `roomId`
  - `encounterId`
  - `role`
  - `behavior`
  - `cover` / `coverHint`
  - patrol route if moving
  - alert links only to spatially adjacent rooms
- Add or adjust cover anchors so enemies choose real corners in the authored room.
- Ensure flanker routes use side loops/halls, not open-floor strafing.

Exit checks:

- First contact is a deliberate peek encounter.
- Future-room enemies do not solve the room from across the map.
- Clearing a room opens/reveals the next step.
- `debug.roomFlow()` and encounter debug agree on current room.
- `npm run validate:campaign` and `node scripts/validate-room-flow.mjs` pass.

Stop rule:

- Do not generalize to all maps until B01 plays as the gold slice.

### Sequence 7: B01 Acceptance Pass

Goal: prove the desired experience before scaling.

Primary files/scripts:

- `scripts/validate-room-flow.mjs`
- optional B01 diagnostic script
- `docs/levels/B01_SPEC.md`

Work:

- Add static acceptance checks:
  - spawn to first gate distance <= 12m
  - active enemies at start only in allowed first rooms
  - every B01 gate opens from encounter/objective completion
  - every encounter belongs to a flow room
  - every room has purpose, gate/threshold, waypoint, and visibility budget
  - every room has route readability cue metadata
  - every combat room has choreography metadata
  - B01 includes safe orientation, first contact, recovery, objective pressure, complication, anticipation, and escalation pacing tags
- If browser/visual diagnostics are allowed later, add a B01 camera diagnostic for spawn sightlines. Static checks remain mandatory.
- Update B01 spec with final route and room-flow traceability.

Exit checks:

- B01 no longer resembles the screenshot failure.
- Player is pulled through the rooms by gates, objectives, enemies, and waypoint.
- Player can read the next route from lighting/landmark/threshold language before relying on the HUD.
- Combat rooms have designed first-contact angles, player cover answers, enemy peek/flank behavior, and exit reveals.
- The full B01 route has a deliberate tension curve, not same-intensity repetition.
- B01 passes build and all allowed validators.

Stop rule:

- Do not begin all-map implementation until B01 passes this sequence.

### Sequence 8: B02-B12 Map Packets

Goal: design every remaining map before implementation.

Primary files/artifacts:

- `docs/levels/B02_SPEC.md` through `docs/levels/B12_SPEC.md`
- optional Blender MCP blockouts
- optional generated reference images for route identity

Work:

- For each building, create a map packet with:
  - top-down critical path
  - 6+ flow rooms
  - 4+ gates/thresholds
  - 2+ connector halls
  - 2+ preview reads
  - 1 quick reconnecting side loop
  - 1 signature final room rule
  - route readability language per room
  - combat choreography per combat room
  - pacing/tension curve for the full level
  - enemy role plan
  - negative-space fix list
- Keep each map identity distinct:
  - B02 lobby/social pockets
  - B03 club pit/VIP pressure
  - B04 penthouse luxury suites
  - B05 hospital corridors
  - B06 subway platform/tunnel
  - B07 yacht cabin compression
  - B08 server aisles
  - B09 checkpoint lanes
  - B10 cathedral procession
  - B11 freighter companionways
  - B12 spire/helipad apex

Exit checks:

- Every map packet is complete.
- No map is a clone of B01 with different props.
- Every map has a unique signature encounter rule.
- Every map has readable route language that works without relying only on HUD waypoint.
- Every map has varied pacing rather than same-intensity room repetition.

Stop rule:

- Do not code B02-B12 geometry before their packets exist.

### Sequence 9: B02-B12 Structural Implementation

Goal: convert map packets into code-authored room chains.

Primary files:

- `src/levelSequences.js`
- `src/campaignRoomFlows.js`
- `src/campaignEncounters.js`

Work:

- Implement flow rooms and gates for B02-B12.
- Convert existing route kits into structural mandatory rooms where they are currently only decorative.
- Remove, replace, or block any geometry that creates open-box play.
- Ensure each map has enough occlusion to prevent spawn-corner full-level reads.
- Keep corridor widths and combat rooms within the proportions validated in B01.

Exit checks:

- `validate-room-flow` passes for all 12 maps.
- `npm run validate:campaign` passes.
- Every map meets all-map requirements.

Stop rule:

- Do not finalize enemies until all structural room chains validate.

### Sequence 10: B02-B12 Encounter And AI Implementation

Goal: make enemy behavior match the new map layouts.

Primary files:

- `src/campaignEncounters.js`
- `src/campaign/nativeEncounterTactics.js`
- `src/encounterPatrolRoutes.js`
- `src/encounterBehavior.js`

Work:

- Assign every encounter to a flow room.
- Move enemies into room-specific tactical positions.
- Add room-specific patrols and cover anchors.
- Keep future-room enemies inactive, hidden, or occluded until room/gate state allows.
- Tune alert links so neighboring rooms can wake logically without collapsing the whole map into one fight.
- Ensure final rooms use the signature rule for that map.

Exit checks:

- Every enemy has a room, role, cover hint, and behavior.
- Patrol routes resolve and remain inside/near their intended room.
- Room-gate progression is driven by clear encounter/objective completion.
- `validate-room-flow`, `validate:campaign`, and build pass.

Stop rule:

- Do not mark the campaign complete until final acceptance passes.

### Sequence 11: Final Campaign Acceptance

Goal: verify the whole campaign delivers the desired experience end to end.

Required checks:

- `npm run validate:campaign`
- `node scripts/validate-room-flow.mjs`
- `npm run audit:sequence-def`
- `npm run build`

Experience checks, starting with B01 and then every map:

- Deploy view shows the first threshold, not the whole level.
- The waypoint points to the next tactical room/gate/objective.
- The player can read the next route from environmental language before relying on the HUD.
- The player reaches the first meaningful encounter within 8-12m.
- Each room has a distinct tactical ask.
- Each combat room has a designed first-contact angle and player cover answer.
- Each map has a clear pacing curve, not same-intensity repetition.
- Clearing each room opens, reveals, or directs the next step.
- Future-room enemies do not participate before the player can read the room.
- No large empty square remains unless it is a deliberate signature arena.
- Exit/final door opens only after the authored final room is solved.

Completion rule:

- The work is not complete if any map can still be played as “stand in a corner, clear visible enemies, run to far door.”

## Why The Previous Pass Was Not Enough

The previous route-completion pass added useful pieces:

- route kits
- non-wave floorplan subspaces
- cover anchors
- patrol route tags
- audit reporting

But it did not change the central play contract:

- room progression is still zone-based
- doors are still mostly macro zone doors
- enemies still spawn broadly by zone
- waypoint still targets the next zone door
- open floor still allows corner-based arena play
- subrooms are not guaranteed to be mandatory traversal spaces

This rework must treat room flow as the primary system.

## Definition Of Done

The work is done only when:

- B01 no longer resembles the screenshot failure case.
- The player is pulled through rooms and hallways in a clear but tense order.
- Each room introduces a deliberate peek/clear problem.
- Enemy placement uses the room architecture.
- Doors open from room/encounter completion, not just broad zone clears.
- The HUD and waypoint guide the next room objective.
- Every map has a complete authored path from Deploy to exit door.
- Static validation proves the room-flow graph, gates, encounters, and AI assignments are coherent.
