# Campaign Level Rework Plan

## Goal

Turn the game from "open box plus door wave" into a true authored campaign: physically built-out spaces, connected rooms, hallways, thresholds, side routes, readable combat scenarios, environment-specific enemy behavior, and encounter pacing that changes from building to building.

The most important vision: a level is not done if it still feels like one large arena with props. The player should move through authored architecture: entry rooms, hallways, side rooms, glassed-off interiors, service corridors, chokepoints, flank loops, objective rooms, boss rooms, and transitions that make the building feel like a place.

This plan is for an agentic coding agent. It should be implemented carefully in small phases, with build and runtime checks after each phase. Do not rewrite the renderer, enemy system, or whole game loop. Build on the systems already present.

## Current Diagnosis

The project already has many good pieces:

- `src/levelSequences.js` subdivides each building into named cells: `FW`, `FC`, `FE`, `MW`, `ME`, `BW`, `BE`, `BC`.
- `src/main.js` builds three broad progression zones using `zoneBounds`, `zoneDoors`, `zoneSpawns`, and `checkZoneClears`.
- Enemy AI already supports useful tactical states: `PATROL`, `SEARCH`, `CHASE`, `ATTACK`, `FLANK`, `REPOSITION`, `HOLD_CORNER`, `PEEK_FIRE`, `SUPPRESS`.
- `coverSlots`, `cornerEdges`, `navGrid`, `wallIndex`, and vertical `floorRegions` already exist.
- Campaign metadata exists for 12 buildings with pressure types, beat types, enemy bias, intel, shortcuts, mastery goals, and boss phases.

The problem is that these pieces are not yet unified into authored floorplans and authored encounters. The current structure still reads like:

- Enter zone.
- Door closes.
- Spawn enemies.
- Kill all.
- Open next door.

The fix is not "more props" or "more enemies." The fix is a physical level architecture layer first, then an encounter authoring layer that maps combat intent onto that architecture.

There are two required layers:

1. **Physical Buildout Layer**: rooms, hallways, thresholds, partitions, windows, interior glass, flank corridors, doorways, height changes, and sightline blockers.
2. **Encounter Layer**: enemy roles, patrols, objectives, reinforcements, tactical door states, and behavior that fits the room.

Do not implement the encounter layer without the physical buildout layer. Enemy scripting on an empty box will not achieve the goal.

## Non-Goals

- Do not port to another engine.
- Do not rewrite all of `src/main.js`.
- Do not delete existing `levelSequences.js` cell decoration work.
- Do not remove the three-zone progression immediately; support it as a fallback while the new campaign encounter system comes online.
- Do not make every level larger just for scale.
- Do not solve level richness by increasing enemy count.
- Do not treat decoration as level design. Props help, but the floorplan must change how the player moves and fights.
- Do not add unbudgeted real `PointLight`s.
- Do not break ADS/scope alignment, CSS-centered crosshair, lighting telemetry, reload hologram readability, or performance work.

## Success Criteria

The rework is complete when:

- Every building has a distinct combat identity, not only a visual identity.
- Every building has a physical floorplan graph of named rooms and transitions.
- The player physically moves through rooms, hallways, thresholds, and side routes rather than sweeping one open space.
- Each building contains multiple authored encounter rooms or beats.
- Enemies are placed with intent before the player sees them, not only spawned as abstract waves.
- Enemies behave differently based on their environment and role.
- Doors and room divisions create flow, flanks, and pressure, not just gates.
- Hallways, partial sightlines, interior windows, and thresholds create pre-contact reads.
- Empty spaces are intentionally shaped into lanes, rooms, or negative space, not left as accidental voids.
- Patrols, guards, ambushers, snipers, heavies, drones, and riot units are used for specific tactical jobs.
- The player can read the room before committing.
- Each building has at least one signature scenario.
- Runtime debug tools can print active encounter, room id, enemy roles, and objective state.
- `npm run build` passes.

## Important Files

Read first:

- `src/main.js`
- `src/levelSequences.js`
- `src/levelSequences.js` `CELL_REGIONS`, `SEQUENCE_DEFS`, `EXTRA_ELEMENTS`, `applySequenceLayout`
- `src/main.js` `buildLevel`
- `src/main.js` `Enemy`
- `src/main.js` `EnemyManager`
- `src/main.js` `checkZoneClears`
- `src/main.js` `CAMPAIGN_LEVELS`
- `src/main.js` `PATROL_ROUTES`

Likely edit:

- `src/levelSequences.js`
- `src/main.js`
- Optional new file: `src/campaignEncounters.js`

Preferred architecture:

- Put static campaign encounter definitions in a new `src/campaignEncounters.js`.
- Keep geometry builders in `src/levelSequences.js`.
- Keep runtime orchestration in `src/main.js`, but keep it thin.

## Core Design Principle

Each level should answer four questions:

1. What does this place do in the story?
2. How does the architecture shape player choices?
3. What are enemies trying to do here?
4. What changes after the first shot?

If a room does not change player behavior, it is just decoration. If a "room" has no boundary, threshold, sightline, flank, or traversal decision, it is not a room yet.

## Physical Floorplan Vision

Build every level as a small tactical building, not a combat carpet.

Each building should have:

- An **entry space** where the player reads the first threat.
- At least one **hallway or compressed connector** that changes movement speed and weapon choice.
- At least one **side room** that can be used for flanking, retreating, or optional objective play.
- At least one **threshold** before a major fight: doorway, glass window, corner, stair lip, catwalk edge, curtain wall, server row, container gap, nave arch, bridge hatch, or elevator vestibule.
- At least one **partial sightline** into danger before full commitment.
- At least one **flank loop** that enemies and the player can both understand.
- A **signature room** that sells the building fantasy and changes the combat rules.
- A **boss/objective room** with supporting geometry, not an empty back box.

Physical elements to use:

- Full-height partitions.
- Half-height cover walls.
- Door frames and thresholds.
- Narrow hallways.
- Offset doorways.
- Interior glass, shoot-through/vault-through windows, and broken sightlines.
- Side service corridors.
- Catwalks, pits, raised platforms, stair steps, and ramps where already supported.
- Soft blockers such as curtains, server racks, pews, containers, medical screens, concierge desks, and cargo stacks.
- One-way reads: windows/slits that show movement before giving a clean shot.

Avoid:

- Large undivided rectangles.
- Long empty center lanes with cover sprinkled randomly.
- Symmetrical left/right copies unless the level fiction demands it.
- Rooms whose only difference is prop theme.
- Doors that exist only to spawn the next wave.

## Physical Buildout Contract

Before authoring enemies for a building, define its floorplan graph.

Example:

```js
floorplan: {
  spaces: {
    dock_intake: {
      kind: 'entry_room',
      cells: ['FW', 'FC', 'FE'],
      bounds: { x0: -18, x1: 18, z0: 10, z1: 25 },
      physicalIntent: 'wide first read split by containers and forklift lane',
      requiredGeometry: ['container_wall_left', 'forklift_choke', 'office_window'],
      sightlines: ['office_window_to_relay', 'catwalk_to_center'],
      exits: ['relay_connector_left', 'relay_connector_right']
    },
    relay_connector_left: {
      kind: 'hallway',
      cells: ['MW'],
      physicalIntent: 'compressed left service hall with one cross-window',
      exits: ['relay_floor']
    },
    relay_floor: {
      kind: 'objective_room',
      cells: ['MW', 'ME'],
      physicalIntent: 'alarm relay room with two cover anchors and side flank'
    }
  },
  transitions: {
    dock_intake_to_relay_left: {
      from: 'dock_intake',
      to: 'relay_connector_left',
      kind: 'doorway',
      threshold: { x: -7.5, z: 7.8 },
      previewSightline: true
    }
  }
}
```

The runtime does not need to understand all geometry labels at first, but the data should make the design intent explicit.

## Phase 0: Physical Floorplan Buildout

Do this before replacing enemy spawning.

For each building, author a physical plan using the existing `CELL_REGIONS` and `applySequenceLayout` system.

Minimum for the first vertical slice, B01:

- Convert the front area into a real **dock intake** with at least three readable subspaces.
- Add a left or right **service hallway** connecting front to middle.
- Add an **alarm relay room** with an objective wall/panel and offset entry.
- Add an **office/foreman cage** with glass or partial sightline into the next danger area.
- Add at least one **flank connector** that is not just the same central lane.
- Add thresholds that tell the player "you are entering a new room."

Implementation notes:

- Use `levelSequences.js` for geometry, partitions, and cell decoration.
- Push blocking geometry into `wl`.
- Push vaultable geometry into `vl` when appropriate.
- Tag important geometry with `userData`:

```js
mesh.userData.roomId = 'relay_floor';
mesh.userData.floorplanRole = 'threshold';
mesh.userData.sightlineId = 'office_to_alarm_panel';
```

- Keep bullet collision and nav-grid behavior intact.
- Do not add permanent real `PointLight`s.
- Do not overfill: use walls, glass, and thresholds more than random cover blocks.

## Phase 0.5: Floorplan Debugging

Add debug helpers before making combat depend on the new layout:

```js
window.__game.debug.floorplan()
window.__game.debug.roomAtPlayer()
window.__game.debug.floorplanSpaces()
```

Each should report:

- building
- current room/space id
- spaces and bounds
- transitions
- expected geometry ids
- missing geometry ids if detectable

This lets future prompts verify that levels are physically built out before encounter scripting begins.

## Phase 1: Add An Encounter Data Model

Create `src/campaignEncounters.js`.

Export:

```js
export const CAMPAIGN_ENCOUNTERS = {
  1: {
    id: 'dock7',
    floorplan: { ... },
    flow: ['infiltration_yard', 'relay_floor', 'foreman_cage'],
    rooms: { ... },
    encounters: [ ... ],
    director: { ... }
  }
};

export function getCampaignEncounterDef(building) {
  return CAMPAIGN_ENCOUNTERS[building] || CAMPAIGN_ENCOUNTERS[1];
}
```

Use stable ids. Do not use random labels as ids.

### Room Schema

Each room maps to one or more existing cell regions from `levelSequences.js`.

```js
rooms: {
  infiltration_yard: {
    label: 'Container Intake',
    cells: ['FW', 'FC', 'FE'],
    zone: 0,
    intent: 'read_and_pick_route',
    physicalIntent: 'wide dock intake compressed by container walls into three routes',
    entry: { x: 0, z: 18 },
    exits: ['relay_floor'],
    primaryCover: ['forklift', 'container', 'low_crates'],
    flankLanes: ['FW_to_MW', 'FE_to_ME'],
    sightlines: ['center_long', 'left_catwalk'],
    hazards: ['alarm_panel'],
    lightingMood: 'cold_dock_warm_alarm'
  }
}
```

Rooms should describe both physical structure and combat purpose. Do not define a room as only a spawn bucket.

### Encounter Schema

```js
encounters: [
  {
    id: 'dock_relay_first_contact',
    room: 'infiltration_yard',
    trigger: { type: 'enter_room', room: 'infiltration_yard' },
    objective: { type: 'clear_or_disable', target: 'alarm_panel' },
    lockdown: { doors: ['front_to_mid'], soft: true },
    enemies: [
      {
        id: 'dock_lookout_01',
        type: 'scout',
        role: 'lookout',
        spawn: { cell: 'FE', x: 12, z: 16 },
        facing: 3.14,
        behavior: 'patrol_then_alarm',
        patrol: 'dock_front_catwalk',
        cover: 'right_container_corner',
        alertLink: ['dock_heavy_01']
      },
      {
        id: 'dock_heavy_01',
        type: 'heavy',
        role: 'anchor',
        spawn: { cell: 'MW', x: -13, z: 1 },
        behavior: 'hold_angle',
        preferredState: 'HOLD_CORNER',
        cover: 'relay_box_left'
      }
    ],
    reinforcements: [
      {
        trigger: { type: 'alarm_active_for', seconds: 8 },
        squad: 'dock_alarm_pair',
        entry: 'spawnDoor_FE'
      }
    ],
    completion: { type: 'objective_and_room_safe' },
    rewards: { shortcutHint: true }
  }
]
```

### Enemy Behavior Contract

Do not rely on enemy `type` alone. Add an encounter-level `role` and `behavior`.

Roles:

- `lookout`: sees early, calls alert, avoids hard push.
- `anchor`: holds a strong angle from cover.
- `flanker`: rotates after player commits.
- `breacher`: pushes through smoke/door/short lane.
- `sniper`: long angle, relocates after shot.
- `shield`: slow pressure, protects backline.
- `demolitions`: denies static cover.
- `drone`: flushes or marks.
- `boss_guard`: protects boss phase space.
- `civilian_guard`: aims around no-shoot/hostage constraints.
- `runner`: attempts objective like burning ledger or triggering alarm.

Behaviors:

- `patrol_then_alarm`
- `hold_angle`
- `peek_from_cover`
- `flank_after_contact`
- `suppress_lane`
- `rush_when_player_reloads`
- `guard_objective`
- `retreat_to_next_room`
- `escort_target`
- `ambush_on_crossing`
- `sniper_relocate`
- `riot_screen_push`
- `grenade_flush_cover`

## Phase 2: Connect Encounters To Existing Rooms

Do not throw away `CELL_REGIONS`.

Also do not stop at cell labels. A cell is only a coarse coordinate region. The authored floorplan must add the missing architecture inside and between cells.

In `src/levelSequences.js`, export enough metadata for runtime encounter placement:

```js
export const CAMPAIGN_CELL_REGIONS = CELL_REGIONS;
```

If direct export is awkward, duplicate the minimal region definitions in `campaignEncounters.js`. Prefer export if simple.

In `buildLevel`, after `applySequenceLayout`, attach:

```js
levelData.sequenceCells = CAMPAIGN_CELL_REGIONS;
levelData.encounterDef = getCampaignEncounterDef(bn);
```

If circular import risk appears, pass definitions from `main.js` into the sequence builder instead.

## Phase 3: Build An Encounter Runtime

Add a small runtime manager in `src/main.js` or a new module.

Suggested shape:

```js
class EncounterDirector {
  constructor(scene, levelData, enemyMgr) {}
  startBuilding(building) {}
  tick(dt, player) {}
  enterRoom(roomId) {}
  startEncounter(encounterId) {}
  completeEncounter(encounterId) {}
  snapshot() {}
}
```

The director should own:

- Current room.
- Active encounter.
- Encounter objectives.
- Which authored enemies are alive.
- Which reinforcements have fired.
- Which doors are locked/open.
- Which patrols are active.
- Which room transitions are available.

It should not own rendering.

### Runtime State

```js
G.encounterDirector = null;
G.currentRoomId = null;
G.activeEncounterId = null;
```

Add debug:

```js
window.__game.debug.encounterState()
```

Return:

- building
- currentRoom
- activeEncounter
- roomVisited
- objectiveState
- aliveByRole
- aliveByRoom
- reinforcementsFired
- lockedDoors
- lastTrigger

## Phase 4: Replace Zone Wave Spawning With Authored Squads

Keep `EnemyManager.spawnByZone` as fallback, but campaign mode should use authored encounters.

Current flow:

- `startBuilding`
- `spawnByZone`
- `checkZoneClears`
- `openZoneDoor`

New flow:

- `startBuilding`
- Build level
- Create director
- Director preplaces or spawns first room enemies
- Player crosses room trigger
- Director starts encounter
- Director tracks objective completion
- Director opens next transition

Important:

- Do not spawn every enemy at once if performance suffers.
- But enemies should feel authored, not like generic wave buckets.
- Use "sleeping" authored enemies if needed: invisible/inactive until room is entered, but with fixed authored positions.

### Enemy Instantiation

Extend `Enemy` or configure after construction:

```js
enemy.encounterId = encounter.id;
enemy.roomId = room.id;
enemy.role = spec.role;
enemy.behavior = spec.behavior;
enemy.patrolRoute = spec.patrol;
enemy.preferredCoverId = spec.cover;
enemy.alertLinks = spec.alertLink || [];
enemy.holdFireUntilAlert = spec.holdFireUntilAlert;
enemy.objectiveTarget = spec.objectiveTarget;
```

Do not overfit behavior inside constructor. Configure after spawn.

## Phase 5: Add Environment-Aware AI Directives

Implement role/behavior interpretation as a thin layer above existing AI.

### Behavior Mapping

`hold_angle`:

- Assign nearest authored cover slot.
- Prefer `HOLD_CORNER` or `PEEK_FIRE`.
- Reposition only if flanked or suppressed.

`flank_after_contact`:

- Stay in `PATROL` or `SEARCH` until the player commits.
- When another enemy has LOS or takes damage, rotate through flank lane.

`patrol_then_alarm`:

- Follow route until player seen.
- If not killed quickly, trigger room alarm/reinforcement.

`suppress_lane`:

- If no clean LOS but player is known behind cover, use `SUPPRESS`.
- Do not chase blindly.

`sniper_relocate`:

- Fire from long sightline.
- After shot or near miss, move to second anchor.

`grenade_flush_cover`:

- Prefer grenades when player remains behind same cover too long.
- Do not spam; respect cooldown.

`riot_screen_push`:

- Advance slowly from cover to cover.
- Other enemies use riot as moving pressure.

`rush_when_player_reloads`:

- Listen for `P.reloading`.
- Only close distance if lane is safe enough.

### Required Additions

Add helper:

```js
function applyEncounterBehavior(enemy, spec, director) {}
```

Add lightweight tick hook:

```js
director.tickEnemyIntent(enemy, dt)
```

Avoid invasive rewrites of `Enemy.update`. Start with targeted fields the existing AI already respects:

- `state`
- `coverSlot`
- `targetCover`
- `lastKnownPos`
- `searchTimer`
- `suppressUntil`
- `attackRange`
- movement mode fields

Only add new methods when necessary.

## Phase 6: Make Doors And Rooms Tactical

Doors should create tactical choices:

- Peek into next room.
- Bait a patrol.
- Force side lane.
- Lock temporarily because objective is active.
- Open after non-kill objectives.

Add transition types:

```js
transitions: {
  front_to_mid: {
    from: 'infiltration_yard',
    to: 'relay_floor',
    door: 'zone0',
    lock: 'until_objective',
    opensOn: 'alarm_panel_disabled_or_room_clear',
    previewSightline: true
  }
}
```

Use existing `zoneDoors`, `spawnDoors`, and `openZoneDoor`. Do not make a second unrelated door system unless needed.

Physical transition requirements:

- Every major door/threshold should have a reason to exist beyond gating progression.
- At least one transition per building should offer a preview sightline into danger.
- At least one transition per building should support a flank or alternate route.
- Doorways should be offset where possible so players do not always fight down the same center axis.

## Phase 7: Add Non-Kill Objectives

Not every room should complete by killing all enemies.

Objective types:

- `disable_alarm_panel`
- `protect_civilians`
- `reach_ledger_before_burn`
- `survive_hold_timer`
- `destroy_server_rack`
- `interrupt_courier`
- `secure_elevator`
- `kill_lieutenant`
- `escape_before_timer`

Implementation should be simple:

- Use meshes already in level decor or add small interactable props.
- Add `userData.objectiveId`.
- Use existing prompt UI if possible.
- Objectives should be optional for mastery when possible, required for progression when needed.

Example:

```js
objective: {
  id: 'dock_alarm_panel',
  type: 'disable_alarm_panel',
  interactRadius: 1.4,
  holdSeconds: 1.2,
  failTrigger: { type: 'alarm_active_for', seconds: 12 }
}
```

## Phase 8: Per-Building Encounter Bible

Implement one building at a time. Do not author all 12 badly. First do buildings 1, 3, 5, 8 as vertical slices. Then fill the rest.

### B01 Loading Dock - Alarm Relay

Identity:

- Industrial intake, forklifts, containers, catwalk silhouette.
- Enemies are smugglers trying to trigger an alarm chain.

Rooms:

- `dock_intake`: physically divided by containers, forklift, office window, and side service lane; three-lane first read, lookout patrol, silent opener possible.
- `relay_connector`: narrow service hallway or container gap between intake and relay room; creates the first real threshold.
- `relay_floor`: alarm panel objective room with offset entries, heavy anchor, scout flanker, and a partial sightline from intake/office.
- `foreman_cage`: office/cage room with glass, short hallway/catwalk route, mini boss/lieutenant.

Scenarios:

- Kill lookout before alarm.
- If alarm triggers, spawn door pair enters from side.
- Heavy holds relay box while scout flanks through opposite lane.

Enemy behavior:

- Scouts patrol and call alert.
- Heavy anchors middle.
- Soldier pair uses suppress lane.

Mastery:

- Disable alarm before reinforcement.

### B02 Continental Lobby - Hostage Protocol

Identity:

- Formal lobby, columns, concierge desk, civilians/hostage constraints.

Rooms:

- `arrival_hall`: lobby vestibule with columns, rope barriers, side check-in alcove, pistoleros near civilians, no grenade pressure.
- `concierge_split`: actual desk/hall split with back-office side route; riot unit screens while pistolero retreats.
- `vault_lounge`: private lounge behind offset doorway/glass with fixer guarded by disciplined soldiers.

Scenarios:

- Player must avoid collateral damage.
- Enemies use columns and hostage sightlines.
- One runner attempts to move hostage or call elevator.

Enemy behavior:

- Pistoleros peek quickly.
- Riot screens center.
- Soldiers hold formal column angles.

Mastery:

- No civilian hits.

### B03 Nightclub - Bass Ambush

Identity:

- Neon, low visibility, dance bowl, VIP side lanes.

Rooms:

- `entry_bar`: narrow bar/hallway compression before the dance floor.
- `dj_floor`: bowl-like dance space with booth, partial side windows, ambush triggers when player crosses light grid.
- `vip_split`: actual two-room side route with doors/curtains; enemies rotate through side rooms.
- `mirror_lounge`: reflective lounge with broken sightlines where demolitions flush cover.

Scenarios:

- Lights/strobes create timing.
- Scouts flank during bass drop.
- Riot unit creates moving screen.

Enemy behavior:

- Scouts rush side lanes.
- Demolitions punishes static cover.
- Riot advances through dance floor.

Mastery:

- Clear ambush without losing combo.

### B04 Penthouse - Precision Hunt

Identity:

- Long glass sightlines, skyline, gold/marble, precision enemies.

Rooms:

- `elevator_gallery`: threshold out of elevator/entry hall into glass space.
- `glass_gallery`: long but interrupted by planters, glass fins, and lounge partitions; marksman long angle, alternate cover path.
- `suite_crossfire`: two-level or side-rail pressure with offset doorway.
- `underboss_office`: real office suite with desk, side corridor, and boss relocations.

Scenarios:

- Sniper tell before shot.
- Player can break sightline with route choice.
- Guards reposition after missed shots.

Enemy behavior:

- Marksman relocates after firing.
- Heavy anchors suite doorway.
- Soldier suppresses while marksman moves.

Mastery:

- Required headshot streak or low missed-shot count.

### B05 Hospital - Blackout Ward

Identity:

- Curtains, surgical pit, glass silhouettes, power cuts.

Rooms:

- `triage_dark`: curtain-separated triage room and hallway; patrols visible by silhouettes.
- `surgery_connector`: narrow medical corridor with glass and gurney blockers.
- `surgery_hold`: operating-room pit with riot/drone pressure around operating lights.
- `records_room`: side records room with marksman behind glass.

Scenarios:

- Lights fail after first contact.
- Enemies react to flashlight/noise.
- Drone flushes hiding player.

Enemy behavior:

- Riot advances slowly in dark.
- Drone marks player position.
- Marksman holds glass corridor.

Mastery:

- Clear blackout with low damage.

### B06 Subway Line 7 - Platform Hold

Identity:

- Narrow platform, live rail trench, switch room.

Rooms:

- `ticket_choke`: turnstile/ticket hallway first contact in narrow lane.
- `platform_hold`: actual platform edge and live rail trench; timed hold around rail hazard.
- `service_tunnel`: side tunnel flank route.
- `switch_chamber`: utility room with demolitions and riot push.

Scenarios:

- Player must move when grenades deny platform cover.
- Rail hazard shapes movement.
- Reinforcements arrive from trackside doors.

Enemy behavior:

- Demolitions flush.
- Riot pushes.
- Drone or scout pressures opposite side.

Mastery:

- Hold without healing.

### B07 Azure Yacht - Boarding Pressure

Identity:

- Narrow luxury deck, crew hatch, bridge suite, ocean-side flanks.

Rooms:

- `salon_entry`: tight luxury interior with furniture lanes; stealth or loud opener.
- `crew_hatch_connector`: narrow side connector/downstairs hatch.
- `deck_boarding`: exterior narrow deck with below-deck doors and rail-side exposure.
- `bridge_suite`: bridge room behind offset threshold with marksman/heavy protection.

Scenarios:

- Boarders enter from side doors after player fires.
- Narrow lanes reward decisive pushes.
- Grenades are dangerous but must not be spammed.

Enemy behavior:

- Marksman holds deck.
- Heavy blocks bridge.
- Demolitions flushes salon cover.

Mastery:

- No heal deck clear.

### B08 Server Farm - Final Lockdown

Identity:

- Cold aisles, battery bay, core vault, drones, lockdown protocol.

Rooms:

- `rack_aisles`: real server-row maze with cross-aisles; drones scout vertical/side lanes.
- `maintenance_cross`: narrow service crossing with glass/control windows.
- `battery_bay`: objective room with riot/heavy locking down power node.
- `core_vault`: final room behind vault threshold with boss pressure and lockdown.

Scenarios:

- Server racks create tight lanes and sound/visibility reads.
- Player disables lockdown nodes.
- Drones mark and flush.

Enemy behavior:

- Drone marks player.
- Riot screens node.
- Marksman holds end of aisle.
- Heavy protects core.

Mastery:

- Break lockdown before berserk timer.

### B09 Border Crossing - Ledger Burn

Identity:

- Watchtower, customs office, sand, cargo gantry.

Rooms:

- `inspection_lane`: long lane broken by customs booths and vehicle barriers.
- `watchtower_connector`: covered side route under/near tower sightline.
- `cargo_gantry`: cargo room/yard segment where courier tries to burn ledger.
- `customs_office`: enclosed office holdout with windows and offset doorway.

Scenarios:

- Player must cross dangerous open lane.
- Courier runner creates time pressure.
- Sniper relocates from watchtower to office angle.

Enemy behavior:

- Marksman long hold.
- Soldier suppresses crossing.
- Demolitions denies cargo cover.

Mastery:

- Secure ledger before burn.

### B10 Cathedral - Silent Choir

Identity:

- Nave, stained glass, choir loft, confessionals, vault.

Rooms:

- `narthex_entry`: compressed entry before nave.
- `nave`: pew lanes, columns, confessionals; stealth route possible through side confessionals.
- `choir_loft`: raised or implied elevated route with sniper/marksman above.
- `bell_vault`: enclosed vault/apse room with ambush around target.

Scenarios:

- Firing in nave triggers choir ambush.
- Silent route rewards patience.
- Riot blocks center aisle while pistoleros peek pews.

Enemy behavior:

- Pistoleros quick peek.
- Riot center push.
- Sniper holds loft until displaced.

Mastery:

- Reach choir loft without firing in nave.

### B11 Karelia Freighter - Engine Alarm

Identity:

- Container maze, engine room, bridge wing, open ocean.

Rooms:

- `container_maze`: physically built container lanes with cross gaps and one overlook.
- `companionway`: narrow ship corridor connector.
- `engine_hold`: objective room around alarm/panel.
- `bridge_wing`: enclosed bridge entry with captain protected by heavy and marksman.

Scenarios:

- Engine alarm escalates reinforcements.
- Container lanes create flank choices.
- Heavy anchors bridge stairs.

Enemy behavior:

- Heavy blocks bridge.
- Drone marks in cargo.
- Marksman holds bridge wing.

Mastery:

- Reach bridge before engine alarm.

### B12 The Spire - Helicopter Escape

Identity:

- Glass crown, executive vault, helipad, final director.

Rooms:

- `apex_lobby`: elevator/lobby threshold with glass partitions; drone/marksman precision entry.
- `executive_gallery`: side office/gallery loop with glass sightlines.
- `executive_vault`: layered defense with heavy/riot and objective lock.
- `helipad`: final exterior/roof room with timed boss escape.

Scenarios:

- Helicopter timer changes objective priority.
- Glass sightlines expose player and enemies.
- Boss phases tied to room control.

Enemy behavior:

- Lieutenant coordinates.
- Drone marks.
- Heavy anchors.
- Marksman punishes open glass crossing.

Mastery:

- Ground helicopter before lift-off.

## Phase 9: Patrol Routes And Room Lanes

`PATROL_ROUTES` exists but is not enough by itself. Add per-building route ids matching encounter definitions.

Example:

```js
const ENCOUNTER_PATROL_ROUTES = {
  dock_front_catwalk: [
    { x: 12, z: 18, wait: 0.6, look: -1.57 },
    { x: 7, z: 15, wait: 0.4, look: 3.14 }
  ]
};
```

Add route metadata:

- `isFlank`
- `isLongSightline`
- `isRetreat`
- `danger`
- `coverIds`

Enemy behavior should choose routes based on role.

## Phase 10: Cover Semantics

The game already bakes cover slots. Add semantic tags where authored.

Cover slot tags:

- `anchor`
- `flank`
- `sniper`
- `riot`
- `objective_guard`
- `fallback`
- `weak`
- `one_way`

Implementation options:

1. Add `coverHints` to encounter definitions and match nearest baked cover slot.
2. Add `userData.coverHint` to props created by `levelSequences.js`.
3. During cover bake, attach hint ids if nearby.

Prefer option 1 first because it is less invasive.

## Phase 11: Room Trigger Volumes

Add trigger volumes per room:

```js
roomTriggers: [
  { room: 'relay_floor', x0: -18, x1: 18, z0: -7, z1: 7 }
]
```

Each tick:

- Determine room containing `P.pos`.
- If room changed, call `director.enterRoom(roomId)`.
- Start corresponding encounter if not started.

Use broad AABB checks only. Do not raycast for room detection.

## Phase 12: Debug And Authoring Tools

Add:

```js
window.__game.debug.encounterState()
window.__game.debug.encounterRooms()
window.__game.debug.forceEncounter(id)
window.__game.debug.roomAtPlayer()
```

Optional debug overlay:

- Room bounds in top-down map.
- Enemy role labels.
- Active objective label.

Do not show debug overlay by default.

## Phase 13: Migration Plan

Implement in safe slices.

### Slice A: Data Only

- Add `campaignEncounters.js`.
- Add room/encounter definitions for B01 only.
- Add debug functions that can read definitions.
- No gameplay changes.

Build and verify.

### Slice B: Director Skeleton

- Add `EncounterDirector`.
- Track current room.
- No enemy spawn changes yet.
- Debug `encounterState()` works.

Build and verify.

### Slice C: B01 Authored Spawns

- For B01 only, use authored enemies for first room.
- Other buildings still use old zone spawn.
- Verify enemies spawn in correct cells and do not clip.

Build and verify.

### Slice D: Objective And Door Control

- Add B01 alarm panel objective.
- Open next door based on objective/room clear.
- Verify old `checkZoneClears` fallback still works if director disabled.

Build and verify.

### Slice E: Behavior Roles

- Apply encounter role fields to B01 enemies.
- `lookout`, `anchor`, `flanker` should behave differently.
- Verify no AI state crash.

Build and verify.

### Slice F: Extend To B03, B05, B08

- Implement one signature encounter per building first.
- Do not author all rooms until the pattern feels good.

Build and verify.

### Slice G: Fill Remaining Buildings

- Author all core rooms for 12 buildings.
- Add mastery hooks.
- Add narrative/intel room labels.

Build and verify.

## Phase 14: Runtime Fallbacks

Add a setting or debug flag:

```js
SETTINGS.authoredCampaignEncounters = true
```

If false or if encounter definition missing:

- Use existing `spawnByZone`.
- Use existing `zoneClears`.

This lets implementation ship incrementally.

## Phase 15: Validation Checklist

For every authored building:

- `npm run build` passes.
- Floorplan debug shows named rooms/spaces and transitions.
- The player can physically identify when they move from one room/hallway/threshold into another.
- The building no longer plays as one large open rectangle.
- `window.__game.debug.encounterState()` returns valid state.
- Entering each room starts the expected encounter.
- Enemies do not spawn inside walls.
- Enemies do not stack on each other.
- Doors open/close as intended.
- Objectives complete and fail correctly.
- Killing all enemies still cannot softlock progression.
- Reinforcements fire once, not every frame.
- Performance telemetry remains sane.
- `lightingStats()` still reports no unbudgeted permanent world lights.
- Crosshair remains centered.
- ADS scope still aligns.
- Reload hologram remains readable.

Manual playtest questions:

- Can the player read the next danger before entering?
- Is there a real threshold before each major fight?
- Does the player move through connected spaces instead of just across an arena?
- Are there hallways/side rooms/flank loops that matter?
- Does the room create at least two viable choices?
- Does enemy behavior match the place?
- Is there a reason to move?
- Is there a reason to use different weapons?
- Does the encounter end cleanly?
- Does the next room feel different?

## Definition Of Done For A True Campaign Level

A building is "campaign-ready" when it has:

- A physical floorplan graph with named spaces and transitions.
- At least 3 authored rooms.
- At least 1 hallway or compressed connector.
- At least 1 side room or flank loop.
- At least 1 threshold/preview sightline before a major fight.
- At least 1 non-kill objective or pressure mechanic.
- At least 1 environment-specific enemy behavior.
- At least 1 patrol or pre-contact setup.
- At least 1 meaningful flank route.
- At least 1 signature combat moment.
- Mastery condition wired to the building identity.
- Debug snapshot showing room, encounter, objective, and role counts.

## Implementation Warnings

- Do not spawn enemies every tick from trigger checks. Gate triggers with fired flags.
- Do not author enemy positions outside navigable areas.
- Do not put snipers in rooms with no long sightline.
- Do not put demolitions in tiny rooms where grenades become unfair.
- Do not create permanent new `PointLight`s for encounter props.
- Do not lock doors without a guaranteed unlock path.
- Do not require stealth in a game that may already be loud unless loud fallback exists.
- Do not make bosses wait in empty boxes; boss rooms need supporting geometry and phases.
- Do not make all rooms symmetrical. Symmetry kills memory.
- Do not overfill with cover. Strong empty space is part of encounter design.
