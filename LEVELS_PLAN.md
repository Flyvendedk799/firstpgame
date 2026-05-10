# Deploy Levels — Design Improvement Plan

A single source of truth for how the 8 Deploy buildings should evolve from
"large boxes with sequenced cells" to **purpose-built, hand-feeling single-
player arenas**. Written from a level designer's chair: intent first,
geometry second, code last.

The current pass introduced a 3×3 cell skeleton (FW/FC/FE · MW·ME · BW/BC/BE)
with 8 themed sub-areas per building. It works, but the bones are still a
flat rectangle bisected three times. This document defines what to build
next so each building reads like a place a real person designed for the player.

---

## 1. North Stars

These five constraints discipline every later decision. Anything that
violates one of them is wrong, even if it sounds cool in isolation.

1. **Place legibility.** A player dropped into any sequence should know,
   from a 3-second glance, which building they're in and where the exit is.
   Lighting, palette, and signage do this — not a HUD label.
2. **Combat readability.** Cover, sightlines, and threat directions must
   be obvious before a shot is fired. Soft cover (waist) reads differently
   from hard cover (over-the-shoulder), and from full walls. No ambiguous
   half-walls that look like cover but don't actually block bullets.
3. **One verb per beat.** Each sequence has a dominant verb: *push*,
   *hold*, *flank*, *climb*, *bypass*, *clear*, *defend*, *exfil*. If a
   sequence has no clean verb, it isn't a sequence yet.
4. **Three-sided readability.** Player can always read at least three of
   the four cardinal threats from any cover position they're meant to use.
   No 360° pinches without warning.
5. **Replayable, not random.** Routes branch but commit. Mastery means
   knowing the building, not memorizing this run's permutation.

---

## 2. Footprint and Scale

The current `RW=36, RD=52, RH=4.25` rectangle limits everything. To make
levels feel like "real" places, we need more spatial vocabulary, not just
more square meters.

### 2.1 Footprint per building (target)

Different buildings should *feel* different sizes. Use these targets to
brief subsequent geometry work:

| Bldg | Identity                | Target footprint    | Vertical layers |
|------|-------------------------|---------------------|-----------------|
| 1    | Loading Dock            | 44 × 64 (wide-flat) | 1 + catwalk     |
| 2    | Continental Lobby       | 38 × 56 (formal)    | 1 + mezzanine   |
| 3    | Nightclub               | 36 × 52 (intimate)  | 2 (pit + VIP)   |
| 4    | Penthouse               | 32 × 60 (long arc)  | 1.5 (sunken)    |
| 5    | Sterling Medical        | 40 × 60 (corridor)  | 1 + roof bridge |
| 6    | Subway Line 7           | 36 × 70 (linear)    | 1 + track pit   |
| 7    | Azure Yacht             | 28 × 64 (narrow)    | 2 (deck + cabin)|
| 8    | Server Farm Δ           | 44 × 56 (grid)      | 1 + raised floor|

Per-building dimensions require `RW`/`RD` to become arrays indexed by `bn`,
and zone-bound math (`ZONE_Z_SPLIT`, sp[], spawn-door offsets) to scale
proportionally. This is plumbing work but unlocks a huge amount of
identity.

### 2.2 Verticality (the highest-impact addition)

Currently the player floor is flat. Adding even one layer of verticality
per building changes combat shape entirely.

- **Pit**: lower a region by 0.8–1.2m (e.g., dance floor, surgery pit, MRI
  trench). Players above own the angle until they descend.
- **Mezzanine**: a half-floor at ~2.4m with a stair, railing, and 2–3
  shooting lanes down. Forces ladder/stair commit decisions.
- **Catwalk**: walkable overhead path connecting two cells. Requires a
  vault-up + traverse + drop choreography.
- **Raised stage**: small podium platforms 0.6–0.85m tall (already
  supported via `plat`). Use sparingly to denote authority points.
- **Ceiling drop ducts**: vertical funnels enemies fall from. AI must
  know to use them.

**Engine deltas required:**
- Player capsule already does step/vault. Stairs need a small AABB-stack
  helper so AI can climb without bespoke nav data.
- Catwalks need walkable nav with falloff edges (drop-down points). AI
  must understand "I am up, target is below" and act on it (suppress, or
  move to drop point).

### 2.3 Curved and angled walls

Every wall in the level is currently axis-aligned. Even a single 30°
diagonal wall reframes a room — it disrupts the shooter-gallery feel.
Three guidelines:

- One non-axis hero wall per building, used as the level's silhouette
  signature (the curve of the yacht hull, the apse of the courtroom).
- Diagonal cover should be 45° or 30°, never arbitrary, so map editing and
  AI nav stay sane.
- Curved walls (penthouse window, atrium ring) approximated with 6–8
  segments — geometry remains AABB-friendly under the hood.

---

## 3. Spatial Design Language

What turns a room into a *space*: rules for shaping volumes the player will
remember.

### 3.1 The four room shapes

Every cell should be one of these, intentionally:

- **Pinch** — narrow throat, one entry, one exit. Cover hugs walls.
  Verb: *push*. Example: subway service vent, pharmacy cabinet row.
- **Pocket** — wider than tall, multiple covers in the middle, perimeter
  fall-back. Verb: *hold*. Example: bank vault floor, dance floor.
- **Spine** — long axis, perpendicular cover ribs, one strong sightline
  the player must close. Verb: *advance under fire*. Example: corridor
  ward, container row.
- **Atrium** — vertical, mezzanines and balconies, multi-elevation
  threats. Verb: *clear high before low*. Example: hotel lobby grand
  stair, server-farm core.

A building is a *sequence of room shapes*, not a string of equal-sized
boxes. Vary them like a punch combo.

### 3.2 Door and threshold language

Doors carry meaning — they should not all look the same.

- **Public door** (visible, unlocked) — wide arch, lit threshold. Player
  expects open passage. *Most doors.*
- **Service door** (functional) — flush metal, no signage, slightly
  recessed. Used for flank routes and shortcuts. *Discoverable.*
- **Hard door** (locked / wave gate) — heavy frame, red stripe, electronic
  panel. Already implemented as zoneDoors. *Earned passage.*
- **One-way door** (drop-only) — a vault-down ledge that can't be climbed
  back. Used to commit the player forward without backtracking. *New.*

Each building should use at least three of these; never repeat the same
door type more than 3 times in a row.

### 3.3 Sightlines

Right now sightlines run almost entirely along Z. That's why levels feel
generic. Rules:

- Every cell must offer at least one **off-axis sightline** (at 30–60° to
  the dominant Z spine).
- The player's first long sightline in a building should be *interesting*
  — pointing at a hero piece (chandelier, helm, statue, surgical light)
  rather than a wall.
- Sniper lanes need a **visible source** — a window, balcony, or duct,
  with a tell that fires before the bullet does (laser dot, silhouette,
  brass on the floor).

### 3.4 Cover grammar

Three cover heights, used deliberately:

- **Knee** (0.55m): bench, sandbag, planter. Read as "you can shoot over
  but they can also shoot you."
- **Chest** (0.85–0.95m): counter, vault barrier, console. Read as "you
  can crouch behind, peek over."
- **Full** (≥1.6m): pillar, locker, server rack. Read as "you're hidden,
  must lean to peek."

A cell with all three reads as varied; a cell with one repeated 6× reads
as decorative. Right now the cell decorate tables lean too uniform —
audit and force at least one of each per cell.

---

## 4. Combat Scenario Design

### 4.1 Per-zone role contract

Each zone (front/middle/back) plays a tightly defined role. Right now they
just hold "wave 1 / 2 / 3" — that's a wave count, not a beat.

| Zone   | Role         | Tempo               | Composition                           |
|--------|--------------|---------------------|---------------------------------------|
| Front  | Read         | Slow, escalating    | Soldiers + scout. One marksman tell.  |
| Middle | Brawl        | Burst               | Pinch from MW + ME, one elite or 2 riot. |
| Back   | Boss + cleanup| Phase'd            | Lieutenant + adds; arena hazards on.  |

The middle zone is the most boring today (just more enemies). Fix:

- **Pinch trigger**: spawning in MW *and* ME at the same time forces
  player to commit one direction. Already supported by spawn doors.
- **Elite anchor**: one slow-moving elite that holds MC, cannot be
  ignored, must be dealt with before the doors at z=-zSplit open.
- **Cover degrade**: 1–2 mid-zone covers that break under sustained fire,
  shifting the geometry mid-fight.

### 4.2 Encounter archetypes (per cell role)

Each cell should be tagged as one of these, with composition rules
derived from the tag:

- **Read** — 2–3 enemies, exposed, telegraph mechanics. Always the first
  encounter of a zone.
- **Brawl** — 4–6 mixed, partial cover, no winning angle.
- **Hold** — player is approached from two directions; defensive verb.
- **Snipe** — long lane, marksman or two; cover advance under fire.
- **Stealth-or-loud** — civilian / patrol density allows quiet entry, but
  noise commits to brawl.
- **Boss** — phased, with a respite window.

Author each cell's tag in the sequence data and let the wave spawner read
it instead of the current "diff/zone" lookup. This is the lever that
turns identical waves into character.

### 4.3 World states

Levels should react. Today only the wave timer ticks. Add:

- **Alarm** — triggered by detection or breaking a key prop. Lights flash
  red, side spawn doors open earlier, one path locks.
- **Power-down** — triggered by player at a panel. Half the lights go
  out, fog deepens, AI vision range shrinks, player NV is more effective.
- **Hazard primed** — environmental kill (oil + spark, MRI charge, third
  rail) made live. Player can trigger to AoE-clear a cluster. One-shot
  per level.

Each building gets two of the three to keep them distinct.

### 4.4 Reinforcement choreography

Spawn doors today fire in fixed slots. Improvements:

- **Telegraphed entry** — a 1.5s door-glow + low rumble before enemies
  emerge. Players need a moment to decide.
- **Clustered spawn**: 2–3 enemies via the same door in a pulse, then
  silence, instead of streamed singles.
- **Late wave**: the *last* spawn of a zone is always a heavier enemy
  (riot, demolitions) so the rhythm escalates rather than plateaus.

---

## 5. Per-Building Creative Directions

Concrete deltas keyed to each building's identity. These are the items I'd
ship in priority order, not all-at-once.

### 5.1 Loading Dock — *cold open, brutal industry*

- **Hero set-piece**: a half-loaded freight container the player can
  enter — interior darkness, narrow exit, one enemy waiting inside as a
  guaranteed close-quarters moment.
- **Catwalk**: walkable from FE to BE, one drop-down between FE and the
  containers. Sniper variant patrols it.
- **Container maze**: replace BW open box with two perpendicular
  container rows that form an L-corridor. Forces commit.
- **Hazard**: oil slick + sparking forklift in the boss arena. Shoot the
  drum, get an AoE. One-shot.
- **Weather/ambient**: ceiling dust shafts (already there) but punch
  them through *holes in the roof* — small visible sky discs add
  outdoor-ness.

### 5.2 Continental Lobby — *civilians, social pressure, ceremony*

- **Hero set-piece**: a working chandelier above the concierge court,
  shootable to drop on a cluster. Damage dealt = scripted, not physics.
- **Mezzanine**: a half-floor balcony ringing the front zone, accessed by
  the grand stair (BE). Allows guard repositioning above, gives the
  player a verticality option.
- **Civilians**: 4–6 staff and guests pacing pre-combat. Shooting one
  before alarm = score penalty (existing morale system can hook in).
- **Door language**: brass-handled wood doors for public, recessed
  service hatches for the kitchen and bellhop routes.
- **Music cue**: lobby pianist NPC; killing them silences the music.

### 5.3 Nightclub — *strobe, layered floors, tempo*

- **Pit**: dance floor sunk 0.9m. Player enters down a 3-step deck.
  Threats from the rim above; cover at the rim is high-value real
  estate.
- **DJ tier**: existing platform stays, but add a sliding gate (one-way)
  between the booth and VIP — committing to VIP closes pit retreat.
- **Stroboscopic alarm**: when alarm trips, strobes desync from music,
  enemy silhouette pulses make targeting harder. Reward: focus mode
  builds 2× faster.
- **VIP door**: the manager retreats to mirrored lounge if he sees the
  player. Closing his door triggers a hard reset of the lounge's spawn.
- **Sound design**: bassline ducks during ADS — the music is part of the
  combat pace.

### 5.4 Penthouse — *long sightlines, glass, status*

- **Hero set-piece**: a floor-to-ceiling window wall on the back face,
  destructible, behind which is the city skybox. Shoot it = wind sweeps
  in, fog clears, distant flash effects punctuate the boss fight.
- **Conversation pit**: sunken seating area in FE, 0.6m drop. Provides
  hard cover from the FC bar.
- **Wine vault**: BW reduced lighting, racks form parallel corridors. A
  marksman holds the back of the racks; player must pick which corridor
  to commit to.
- **Glass**: existing glass partitions stay, but a few become destructible
  — break one and a side route opens. Once.
- **Boss arrival**: Vasari emerges through a slow elevator door at BC —
  pre-arrival the elevator panel pulses, telegraphing.

### 5.5 Sterling Medical — *clinical decay, fluorescent failure*

- **Hero set-piece**: an MRI machine in BW that the player can charge
  up, then trigger to AoE-pulse the boss arena (one-shot, requires
  positioning the boss adjacent during phase 2).
- **Patient bays**: the curtain rows are perfect ambush masks — add an
  enemy that pretends to be a patient (sit-up startle). One per
  playthrough, not more.
- **Lighting failure**: each cell has 1 bulb that dies as the player
  enters — gives the place a "this hospital is dying" rhythm.
- **Roof bridge**: connect FE to BE via a covered exterior bridge with
  rain. Slowed footsteps + visible breath. Quiet space between brawls.
- **Boss arena**: surgical-light dome stays on the player. When boss
  enters phase 2, it swings to follow him — reverses the lighting.

### 5.6 Subway Line 7 — *concrete claustrophobia, electric hazard*

- **Hero set-piece**: a slow train passes through the Tunnel Junction
  (BW) on a 90-second timer. Player can wait it out or use it for cover
  movement. Standing on the track when it arrives = death. One pass.
- **Third rail**: existing live track in MW expanded to a "live zone."
  Falling off the platform is bad. Enemies pushed onto it die. Players
  too.
- **Power room toggle**: BE has a breaker the player can hit to
  black-out half the level for 12 seconds. One use.
- **Pillar grid**: middle zone gets an additional ring of subway pillars
  with tile detail — tight cover dance.
- **Posters and tile**: peeling line-7 posters, signage that *means*
  something (LINE 7 → DOWNTOWN arrows), hard graffiti. Place identity.

### 5.7 Azure Yacht — *narrow corridors, water through windows*

- **Hero set-piece**: the yacht is *moving* — outside the windows the sea
  rolls past. Subtle camera roll (±0.4°) sells the motion. Quiet sound
  of wave impact at random intervals.
- **Aft deck**: the aft is exterior. Open sky above (no ceiling), wind
  audible, slight player roll affect. Distinct from interior.
- **Stateroom hallway**: ME elongated and narrow (corridor 2.4m wide),
  multiple doors on both sides — players pick the right approach to the
  bridge.
- **Engine room**: BW is hot, red-lit, loud. Fire flicker (already
  supported by fire dynProp), pipe shadows. Hazard primed: rupture a
  pipe with grenade for a burst window of suppression on enemies.
- **Helm pavilion**: replace the BC helm with an actual pilothouse — a
  small interior room with panoramic windows showing the dark sea.

### 5.8 Server Farm Δ — *cyan grid, surveillance*

- **Hero set-piece**: a floor-to-ceiling status wall behind the core
  vault — glowing rack diagrams the player has come to destroy. The
  vault boss fight ends with the wall darkening one rack at a time.
- **Hot/cold aisle layout**: middle zone becomes two parallel hot/cold
  aisles separated by glass. Player can break the glass to switch lanes
  mid-fight (one-shot).
- **Cooling vent gust**: short floor vents in the cold aisle that briefly
  obscure (light particle gust) when triggered. Tactical screen.
- **Drone enemies**: server-farm specific; enter from ceiling vents.
  Already supported by enemy types.
- **Surveillance feedback**: monitor screens around the level show *the
  player's own back*. Subtle, but unsettling.

---

## 6. Variation Systems

What makes a level replayable beyond memorization:

### 6.1 Layout variants (already partially in)

Each building has two layouts (0 and 1, mirrored). Expand:

- **Tier-A variant**: full mirror (current).
- **Tier-B variant**: 1–2 cells reshaped (different cover layout, cell
  identity preserved). Example: B1's BW alternates between vent loop
  (current) and "fuel dump" (drum maze).
- **Tier-C ironman**: one-shot per save. A high-difficulty cell remix
  for late-game progression.

### 6.2 Time-of-day

Hard-coded today (briefing time text only). Make it lighting-real:

- **Night** (1, 4, 6): low ambient, hard rim, point lights dominate.
- **Dawn** (5, 6 transition): cool ambient, low-angle directional, fog
  amber.
- **Day** (7 yacht in the middle of the day): bright ambient, soft
  shadows, no fog.

Reuse the existing per-building light profile system — just add a
TOD index. Night feels different from day even with the same geometry.

### 6.3 Dynamic geometry

Small set of geometry that *moves* during a run:

- Sliding doors that close behind the player (one per building, hard
  commit to the next zone).
- Drop-down barricades when alarm fires.
- One destructible cover per cell. Rebuild on retry.

### 6.4 Optional spaces

Each building gets one **optional cell** the player can choose to enter
or skip. Reward: small cash drop or weapon attachment. Risk: extra fight.

- B1: a refrigerated container (cold breath VFX) with a cash drop.
- B2: the bellhop locker room with a unique knife.
- B3: the cold-storage freezer with a knife + 1 elite.
- B4: a panic room with armor and 2 bodyguards.
- B5: morgue corridor (heavy mood) with a syringe heal.
- B6: flooded pump cell with a smoke pickup.
- B7: crew bunkroom with a pistol attachment.
- B8: tape archive with money and 1 marksman.

These hang off the existing 8-cell skeleton — they're a 9th doorway,
not a redesign.

---

## 7. Feel — Audio, Lighting, Ambient Life

The largest gap between "generated" and "designed" is the layer that
isn't geometry.

### 7.1 Audio

- **Per-building ambient bed** distinct enough to identify with eyes
  closed: dock = wind + harbor sirens, hotel = distant string quartet,
  club = bassline, penthouse = HVAC + city hum, hospital = monitor beep
  + buzz, subway = low rumble + drip, yacht = wave + creak, server farm
  = fan whine + relay click.
- **Footstep substrate** changes per cell: concrete, marble, dance
  floor, carpet, tile, gravel ballast, teak, raised metal grate.
- **Bullet impact**: differentiate concrete, glass, wood, metal sheet,
  fabric. Two-tap cue gives the player free intel about cover quality.
- **Reverb zones** per cell. Atriums echo. Vaults thunk.

### 7.2 Lighting (mood)

- **Two-color rule**: each cell uses one warm + one cool light source,
  never just one. This is what stops levels from looking flat.
- **Light direction**: avoid placing the only light directly above the
  player. Cross-light from one wall produces contrast and silhouettes.
- **Failure lights**: one fluorescent per building flickers and
  *eventually dies* during the run, never resets.

### 7.3 Ambient life

The single biggest "is this a real place?" multiplier.

- **Pre-combat civilians/staff**: 4–8 NPCs walk paths, sit, smoke. Combat
  start = they panic, run for exits, hide. Hooked into existing morale
  system.
- **Animals**: club has a stray cat, dock has gulls overhead, yacht has
  a parrot in the salon. Tiny detail, huge identity.
- **Worn-in props**: a coffee cup half full at the concierge desk. A
  tipped-over chair in the manager's office. Cigarette butts at the
  service entrance. These cost nothing and read as "humans were here."

### 7.4 Environmental storytelling

Each building should tell a 3-beat micro-story without any text:

- **Setup** (front zone): something is wrong but nobody's reacting yet.
  *Dock*: a manifest lies open showing the wrong cargo. *Hotel*: the
  concierge desk is unmanned mid-shift.
- **Escalation** (middle zone): the wrong thing has consequences.
  *Dock*: scattered shell casings in an office. *Hotel*: a half-set
  banquet table, plates broken on the floor.
- **Climax** (back zone): the boss's signature. *Dock*: a man's coat
  on the foreman's chair, still warm. *Hotel*: a private dossier open,
  player's photo inside.

These are *prop placements*, not scripted events. Cheap, high-impact.

---

## 8. Engineering Work Required

What the design above costs in code, ranked by impact:

### Tier 1 — High impact, contained

1. **Per-building footprint** — `RW`/`RD` become arrays indexed by `bn`;
   audit `ZONE_Z_SPLIT`, sp[], spawn-door offsets, ceiling-light grid,
   wave spawner zone bucketing. ~1 day.
2. **Cell role tags + spawner contract** — encounter archetype tag per
   cell, wave spawner reads it. Replaces current "diff/zone" lookup.
   ~0.5 day.
3. **World-state hooks** — alarm, power-down, hazard-primed bits live
   on `G.levelData.state`, with door/spawn/light reactors. ~1 day.

### Tier 2 — Big returns once Tier 1 lands

4. **Verticality primitives** — stair AABB-stack helper, walkable
   catwalk + drop edge in nav grid, one-way drop ledge cover type.
   ~1.5 days.
5. **Destructible cover** — flag a subset of `cov`/`bar` elements as
   destructible; track HP; on break swap mesh and recompute the AABB
   in `wl[]`. ~0.75 day.
6. **Civilian NPC layer** — hooks into existing enemy AI but with
   non-combatant state, panic state, hide state. ~1 day.

### Tier 3 — Polish, after gameplay shape lands

7. **Per-cell footstep substrate + reverb zone** — 8 cells × 8 buildings
   metadata table; one global function listens for player cell change.
   ~0.5 day.
8. **Curve walls** — small library: `arc(x, z, radius, sweep, segments)`
   that emits N axis-aligned wall segments approximating the curve.
   ~0.5 day.
9. **TOD lighting variants** — duplicate `lightProfile` with TOD index;
   per-building TOD assignment; saved on level meta. ~0.5 day.

Roughly 6–7 engineering days end-to-end if executed in tier order.

---

## 9. Phasing — What Ships First

A phased rollout that keeps each phase shippable on its own:

### Phase 1 — Bones (1 week)

- Per-building footprint sizes (Tier 1.1).
- Cell role tags wired into spawner (Tier 1.2).
- World-state alarm + one hazard-primed prop per building (Tier 1.3).
- Two-color lighting rule audit across existing 64 cells.
- Footstep substrate table.

After Phase 1, the existing 64 cells already feel substantially less
generic without changing their geometry.

### Phase 2 — Vertical (1 week)

- Verticality primitives (stairs, catwalks, drops).
- Hero set-pieces 1, 2, 3 (Dock, Hotel, Club) — the highest-traffic
  early game.
- Destructible cover system + 1 destructible per cell where it makes
  sense.

### Phase 3 — Identity (1 week)

- Hero set-pieces 4–8 (Penthouse, Hospital, Subway, Yacht, Server Farm).
- Curved hero walls per building (1 each).
- Per-building ambient audio bed + reverb.
- Civilian NPCs in the four buildings that have civilian space (2, 5,
  4, 7).

### Phase 4 — Variation (0.5 week)

- TOD lighting per building.
- Layout B and C variants for 4 highest-traffic buildings.
- Optional cells unlocked.

### Phase 5 — Storytelling (ongoing)

- 3-beat prop micro-stories per building.
- Worn-in detail pass.
- Animals, music NPCs, ambient surprises.

---

## 10. Anti-Goals

Things to *not* do, even when tempted:

- **No procedural cover.** Every cover position is hand-placed, every
  time. We have 8 buildings; we can author them.
- **No more rectangles.** If a new cell defaults to a 6×6 box, it's
  rejected. Cells must have shape intent.
- **No cinematic-only set pieces.** If a set piece doesn't change a
  combat decision, it isn't worth its build cost.
- **No more enemy types this round.** The existing roster is enough.
  Make levels make them feel different.
- **No "tutorial" overlays.** If the level needs an overlay to be
  understood, the level is wrong.

---

## 11. Validation

A level passes design review if all of these are true:

- Cold-start playtest: the player can identify the building from a
  10-second screenshot.
- A casual playtester reaches the boss with no UI at full HP at least
  10% of the time. (Geometry is doing the teaching.)
- Each cell can be described in one sentence with a verb.
- Each building has at least one hero moment a tester will mention
  unprompted afterward.
- Each building has at least one alarm/power/hazard interaction that
  measurably changes outcomes.
- The exit is visible or audible from at least 60% of the map.

---

## 12. Open Questions

Decisions that should be made before Phase 2:

- **Destructible glass — bullets only, or also melee?** Affects the
  penthouse window and server-farm aisle moments.
- **Civilian morality cost — score penalty or hard fail?** Sets the tone
  of the Continental and hospital missions.
- **Boss arena exits — sealed (commit) or open?** Currently open via
  exit door; sealing creates real "you're in this" moments but punishes
  unprepared loadouts.
- **One-way ledges — auto-vault down, or prompt?** Player feel question.
- **TOD per run — fixed by building, or randomized?** Replay vs.
  identity tradeoff.

Resolve these via short playtest passes during Phase 1; don't let them
block bones work.
