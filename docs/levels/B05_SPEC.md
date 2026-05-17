# B05 — Sterling Medical Ward

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[5]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[5]`](../../src/campaignEncounters.js) · **Matrix:** corridor grid 40×60, roof bridge intent, spine → pinch → pocket, ICU / surgery signature.

## 1. Logline

Clinical lane push: triage court read, nurse relay under alarm, ICU lock cage under observation glass.

## 2. Three-second read

**6500K fill**, **green exit bias** on east fast corridor, **sterile high contrast** on back cage.

## 3–5. Topology, beats, encounters

Shared skeleton; thematic labels in narrative; `b05_*` ids; `b05_alarm_pair`; full director wiring.

## 6. Spatial grammar

Corridor spine, cabinet pockets, relay pocket with hard offset door, cage atrium read.

## 7–10

See [LEVEL_SPEC_TEMPLATE](LEVEL_SPEC_TEMPLATE.md); validate + trace to `EXTRA_ELEMENTS[5]` when expanded.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[5]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Triage vestibule -> Pharmacy peek -> Patient connector hall -> Nurse-station approach -> Nurse relay -> Patient curtain flank -> Surgery scrub threshold -> Surgery theater -> Sterile exit.

**Flow identity:** triage -> pharmacy/patient hall -> nurse relay -> surgery theater.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b05_scout_fe_lane (lookout, b05_intake_peek); the first locked internal gate is b05_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Triage vestibule | entry_room | safe_orientation | Triage vestibule advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Triage vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Pharmacy peek | peek_room | first_contact | Pharmacy peek advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Pharmacy peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Patient connector hall | connector_hall | recovery_connector | Patient connector hall advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Patient connector hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Nurse-station approach | threshold_room | tension_build | Nurse-station approach advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Nurse-station approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Nurse relay | objective_room | objective_pressure | Nurse relay advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Nurse relay uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Patient curtain flank | flank_room | flank_complication | Patient curtain flank advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Patient curtain flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Surgery scrub threshold | threshold_room | anticipation | Surgery scrub threshold advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Surgery scrub threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Surgery theater | signature_room | signature_escalation | Surgery theater advances triage -> pharmacy/patient hall -> nurse relay -> surgery theater. | Surgery theater uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Pharmacy peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Nurse relay | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Patient curtain flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Surgery theater | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Observation glass previews the theater anchor while curtains hide the reconnecting flank. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b05_entry_vestibule | b05_intake_peek | threshold/open | enter b05_entry_vestibule | b05_entry_to_intake_gate |
| First internal gate | b05_intake_peek | b05_service_hall | locked | clear b05_intake_peek_clear | b05_intake_to_service_gate |
| Service threshold | b05_service_hall | b05_relay_approach | threshold/open | enter b05_service_hall | b05_service_to_relay_gate |
| Relay office gate | b05_relay_approach | b05_alarm_relay | locked | clear b05_relay_approach_clear | b05_relay_to_alarm_gate |
| Flank pressure gate | b05_alarm_relay | b05_drum_flank | locked | complete disable_alarm_panel | b05_alarm_to_drum_gate |
| Final threshold gate | b05_drum_flank | b05_cage_vestibule | locked | clear b05_drum_flank_clear | b05_drum_to_cage_gate |
| Cage vestibule threshold | b05_cage_vestibule | b05_relay_cage | threshold/open | enter b05_cage_vestibule | b05_cage_to_signature_gate |
| Exit door | b05_relay_cage | b05_exit_door | locked | clear b05_relay_cage_clear | b05_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Pharmacy peek | b05_intake_peek_clear | b05_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Nurse-station approach | b05_relay_approach_clear | b05_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Nurse relay | b05_alarm_relay | b05_mw_desk:anchor/guard_objective@relay_desk |
| Patient curtain flank | b05_drum_flank_clear | b05_me_lane:flanker/flank_after_contact@drum_spool |
| Surgery theater | b05_relay_cage_clear | b05_bw_hold:patrol/suppress_lane@cage_pillar_west; b05_bc_heavy:anchor/hold_angle@cage_center_low; b05_bc_rifle:patrol/peek_from_cover@vestibule_face; b05_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
