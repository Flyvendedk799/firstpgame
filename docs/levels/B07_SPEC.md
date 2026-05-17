# B07 — Azure Yacht Deck

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[7]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[7]`](../../src/campaignEncounters.js) · **Matrix:** narrow deck 28×64, deck + cabin, spine → pocket → atrium, bridge / hull signature (hero diagonal candidate per LEVELS_PLAN §2.3).

## 1. Logline

Board the yacht: teak reception, nav relay hack belowdecks pressure, engine hatch cage under bridge wing overwatch.

## 2. Three-second read

**Teak / brass**, **sun deck wash** vs **below-deck cool**, **water reflection** hints on starboard lane.

## 3–6

Skeleton graph; diagonal hull read is **spec intent** for future mesh; gameplay uses current axis-aligned cells.

## 7–10

Native `b07_*`; full alarm chain; checklist + validates.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[7]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Aft-deck vestibule -> Salon-cabin peek -> Galley connector -> Nav-relay approach -> Navigation relay -> Stateroom flank -> Owner-suite threshold -> Bridge owner suite -> Bridge wing exit.

**Flow identity:** aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b07_scout_fe_lane (lookout, b07_intake_peek); the first locked internal gate is b07_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Aft-deck vestibule | entry_room | safe_orientation | Aft-deck vestibule advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Aft-deck vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Salon-cabin peek | peek_room | first_contact | Salon-cabin peek advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Salon-cabin peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Galley connector | connector_hall | recovery_connector | Galley connector advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Galley connector uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Nav-relay approach | threshold_room | tension_build | Nav-relay approach advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Nav-relay approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Navigation relay | objective_room | objective_pressure | Navigation relay advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Navigation relay uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Stateroom flank | flank_room | flank_complication | Stateroom flank advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Stateroom flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Owner-suite threshold | threshold_room | anticipation | Owner-suite threshold advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Owner-suite threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Bridge owner suite | signature_room | signature_escalation | Bridge owner suite advances aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite. | Bridge owner suite uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Salon-cabin peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Navigation relay | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Stateroom flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Bridge owner suite | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Bridge glass previews the owner suite while the narrow deck makes the last push decisive. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b07_entry_vestibule | b07_intake_peek | threshold/open | enter b07_entry_vestibule | b07_entry_to_intake_gate |
| First internal gate | b07_intake_peek | b07_service_hall | locked | clear b07_intake_peek_clear | b07_intake_to_service_gate |
| Service threshold | b07_service_hall | b07_relay_approach | threshold/open | enter b07_service_hall | b07_service_to_relay_gate |
| Relay office gate | b07_relay_approach | b07_alarm_relay | locked | clear b07_relay_approach_clear | b07_relay_to_alarm_gate |
| Flank pressure gate | b07_alarm_relay | b07_drum_flank | locked | complete disable_alarm_panel | b07_alarm_to_drum_gate |
| Final threshold gate | b07_drum_flank | b07_cage_vestibule | locked | clear b07_drum_flank_clear | b07_drum_to_cage_gate |
| Cage vestibule threshold | b07_cage_vestibule | b07_relay_cage | threshold/open | enter b07_cage_vestibule | b07_cage_to_signature_gate |
| Exit door | b07_relay_cage | b07_exit_door | locked | clear b07_relay_cage_clear | b07_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Salon-cabin peek | b07_intake_peek_clear | b07_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Nav-relay approach | b07_relay_approach_clear | b07_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Navigation relay | b07_alarm_relay | b07_mw_desk:anchor/guard_objective@relay_desk |
| Stateroom flank | b07_drum_flank_clear | b07_me_lane:flanker/flank_after_contact@drum_spool |
| Bridge owner suite | b07_relay_cage_clear | b07_bw_hold:patrol/suppress_lane@cage_pillar_west; b07_bc_heavy:anchor/hold_angle@cage_center_low; b07_bc_rifle:patrol/peek_from_cover@vestibule_face; b07_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
