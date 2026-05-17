# B09 — Border Crossing

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[9]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[9]`](../../src/campaignEncounters.js) · **Matrix:** long sand axis 42×62, watchtower layer, spine → pocket → pinch, customs / tower signature.

## 1. Logline

Desert checkpoint breach: customs yard read, tower relay hack, gate cage under watchtower overwatch.

## 2. Three-second read

**Harsh sun**, **dust heat** on convoy flank, **beacon pulse** on relay, **tower silhouette** on cage approach.

## 3–6

Linear sand axis read; pinch inspection pocket; reinforcements `b09_alarm_pair`; spatial grammar emphasizes long spine with tower vertical read (mesh phase).

## 7–10

Native `b09_*`; checklist; validates.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[9]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Inspection vestibule -> Customs-gate peek -> Vehicle-search hall -> Border-office approach -> Customs relay office -> Truck-bay flank -> Tower threshold -> Tower customs room -> Barrier exit.

**Flow identity:** inspection booth -> customs gate -> vehicle search -> tower/customs.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b09_scout_fe_lane (lookout, b09_intake_peek); the first locked internal gate is b09_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Inspection vestibule | entry_room | safe_orientation | Inspection vestibule advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Inspection vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Customs-gate peek | peek_room | first_contact | Customs-gate peek advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Customs-gate peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Vehicle-search hall | connector_hall | recovery_connector | Vehicle-search hall advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Vehicle-search hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Border-office approach | threshold_room | tension_build | Border-office approach advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Border-office approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Customs relay office | objective_room | objective_pressure | Customs relay office advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Customs relay office uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Truck-bay flank | flank_room | flank_complication | Truck-bay flank advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Truck-bay flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Tower threshold | threshold_room | anticipation | Tower threshold advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Tower threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Tower customs room | signature_room | signature_escalation | Tower customs room advances inspection booth -> customs gate -> vehicle search -> tower/customs. | Tower customs room uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Customs-gate peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Customs relay office | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Truck-bay flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Tower customs room | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Watchtower pressure appears through the gate before the customs office opens. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b09_entry_vestibule | b09_intake_peek | threshold/open | enter b09_entry_vestibule | b09_entry_to_intake_gate |
| First internal gate | b09_intake_peek | b09_service_hall | locked | clear b09_intake_peek_clear | b09_intake_to_service_gate |
| Service threshold | b09_service_hall | b09_relay_approach | threshold/open | enter b09_service_hall | b09_service_to_relay_gate |
| Relay office gate | b09_relay_approach | b09_alarm_relay | locked | clear b09_relay_approach_clear | b09_relay_to_alarm_gate |
| Flank pressure gate | b09_alarm_relay | b09_drum_flank | locked | complete disable_alarm_panel | b09_alarm_to_drum_gate |
| Final threshold gate | b09_drum_flank | b09_cage_vestibule | locked | clear b09_drum_flank_clear | b09_drum_to_cage_gate |
| Cage vestibule threshold | b09_cage_vestibule | b09_relay_cage | threshold/open | enter b09_cage_vestibule | b09_cage_to_signature_gate |
| Exit door | b09_relay_cage | b09_exit_door | locked | clear b09_relay_cage_clear | b09_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Customs-gate peek | b09_intake_peek_clear | b09_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Border-office approach | b09_relay_approach_clear | b09_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Customs relay office | b09_alarm_relay | b09_mw_desk:anchor/guard_objective@relay_desk |
| Truck-bay flank | b09_drum_flank_clear | b09_me_lane:flanker/flank_after_contact@drum_spool |
| Tower customs room | b09_relay_cage_clear | b09_bw_hold:patrol/suppress_lane@cage_pillar_west; b09_bc_heavy:anchor/hold_angle@cage_center_low; b09_bc_rifle:patrol/peek_from_cover@vestibule_face; b09_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
