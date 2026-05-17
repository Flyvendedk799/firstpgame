# B11 — Karelia Freighter

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[11]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[11]`](../../src/campaignEncounters.js) · **Matrix:** deck spine 30×68, engine / bridge layers, spine → pinch → pocket, engine room / bridge signature.

## 1. Logline

Steel deck clearance: stores pocket, engine relay hack, engine room cage under bridge access overwatch.

## 2. Three-second read

**Industrial sodium**, **rust edge** winch approach, **machinery hot** cage, **bridge warm** glass.

## 3–6

Industrial narrow spine; `b11_*`; pinch stores; flank starboard lane.

## 7–10

Native full wiring; `EXTRA_ELEMENTS[11]` when freighter kits expand; validates.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[11]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Cargo-row vestibule -> Container peek -> Companionway hall -> Engine approach -> Engine relay -> Crew companionway flank -> Bridge-approach threshold -> Bridge approach -> Bridge wing exit.

**Flow identity:** cargo row -> companionway -> engine relay -> bridge approach.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b11_scout_fe_lane (lookout, b11_intake_peek); the first locked internal gate is b11_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Cargo-row vestibule | entry_room | safe_orientation | Cargo-row vestibule advances cargo row -> companionway -> engine relay -> bridge approach. | Cargo-row vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Container peek | peek_room | first_contact | Container peek advances cargo row -> companionway -> engine relay -> bridge approach. | Container peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Companionway hall | connector_hall | recovery_connector | Companionway hall advances cargo row -> companionway -> engine relay -> bridge approach. | Companionway hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Engine approach | threshold_room | tension_build | Engine approach advances cargo row -> companionway -> engine relay -> bridge approach. | Engine approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Engine relay | objective_room | objective_pressure | Engine relay advances cargo row -> companionway -> engine relay -> bridge approach. | Engine relay uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Crew companionway flank | flank_room | flank_complication | Crew companionway flank advances cargo row -> companionway -> engine relay -> bridge approach. | Crew companionway flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Bridge-approach threshold | threshold_room | anticipation | Bridge-approach threshold advances cargo row -> companionway -> engine relay -> bridge approach. | Bridge-approach threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Bridge approach | signature_room | signature_escalation | Bridge approach advances cargo row -> companionway -> engine relay -> bridge approach. | Bridge approach uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Container peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Engine relay | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Crew companionway flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Bridge approach | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Bridge-window overwatch turns on as the cargo row funnels into the final companionway. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b11_entry_vestibule | b11_intake_peek | threshold/open | enter b11_entry_vestibule | b11_entry_to_intake_gate |
| First internal gate | b11_intake_peek | b11_service_hall | locked | clear b11_intake_peek_clear | b11_intake_to_service_gate |
| Service threshold | b11_service_hall | b11_relay_approach | threshold/open | enter b11_service_hall | b11_service_to_relay_gate |
| Relay office gate | b11_relay_approach | b11_alarm_relay | locked | clear b11_relay_approach_clear | b11_relay_to_alarm_gate |
| Flank pressure gate | b11_alarm_relay | b11_drum_flank | locked | complete disable_alarm_panel | b11_alarm_to_drum_gate |
| Final threshold gate | b11_drum_flank | b11_cage_vestibule | locked | clear b11_drum_flank_clear | b11_drum_to_cage_gate |
| Cage vestibule threshold | b11_cage_vestibule | b11_relay_cage | threshold/open | enter b11_cage_vestibule | b11_cage_to_signature_gate |
| Exit door | b11_relay_cage | b11_exit_door | locked | clear b11_relay_cage_clear | b11_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Container peek | b11_intake_peek_clear | b11_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Engine approach | b11_relay_approach_clear | b11_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Engine relay | b11_alarm_relay | b11_mw_desk:anchor/guard_objective@relay_desk |
| Crew companionway flank | b11_drum_flank_clear | b11_me_lane:flanker/flank_after_contact@drum_spool |
| Bridge approach | b11_relay_cage_clear | b11_bw_hold:patrol/suppress_lane@cage_pillar_west; b11_bc_heavy:anchor/hold_angle@cage_center_low; b11_bc_rifle:patrol/peek_from_cover@vestibule_face; b11_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
