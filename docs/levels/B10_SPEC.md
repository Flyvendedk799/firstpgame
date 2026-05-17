# B10 — Cathedral of San Marco

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[10]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[10]`](../../src/campaignEncounters.js) · **Matrix:** nave + loft 36×66, choir loft, atrium → pinch → pocket, altar / loft signature.

## 1. Logline

Sacred axis assault: narthex candle read, sacristy relay hack, crossing cage under choir loft overwatch.

## 2. Three-second read

**Candle warm haze**, **stained edge** on procession flank, **vault neutral** spine, **altar hot contrast** on cage.

## 3–6

Procession and colonnade verbs; `b10_*`; pocket chapel / pinch crossing; atrium crossing cage.

## 7–10

`b10_alarm_pair`; director wired; validates.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[10]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Narthex vestibule -> Transept peek -> Nave connector -> Sacristy approach -> Sacristy relay -> Confessional flank -> Altar threshold -> High altar -> Bell stair exit.

**Flow identity:** narthex/transept -> nave -> confessionals -> sacristy -> altar.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b10_scout_fe_lane (lookout, b10_intake_peek); the first locked internal gate is b10_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Narthex vestibule | entry_room | safe_orientation | Narthex vestibule advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Narthex vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Transept peek | peek_room | first_contact | Transept peek advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Transept peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Nave connector | connector_hall | recovery_connector | Nave connector advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Nave connector uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Sacristy approach | threshold_room | tension_build | Sacristy approach advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Sacristy approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Sacristy relay | objective_room | objective_pressure | Sacristy relay advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Sacristy relay uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Confessional flank | flank_room | flank_complication | Confessional flank advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Confessional flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Altar threshold | threshold_room | anticipation | Altar threshold advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | Altar threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | High altar | signature_room | signature_escalation | High altar advances narthex/transept -> nave -> confessionals -> sacristy -> altar. | High altar uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Transept peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Sacristy relay | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Confessional flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| High altar | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Stained-glass previews the altar duel while confessional slits hide the last flank. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b10_entry_vestibule | b10_intake_peek | threshold/open | enter b10_entry_vestibule | b10_entry_to_intake_gate |
| First internal gate | b10_intake_peek | b10_service_hall | locked | clear b10_intake_peek_clear | b10_intake_to_service_gate |
| Service threshold | b10_service_hall | b10_relay_approach | threshold/open | enter b10_service_hall | b10_service_to_relay_gate |
| Relay office gate | b10_relay_approach | b10_alarm_relay | locked | clear b10_relay_approach_clear | b10_relay_to_alarm_gate |
| Flank pressure gate | b10_alarm_relay | b10_drum_flank | locked | complete disable_alarm_panel | b10_alarm_to_drum_gate |
| Final threshold gate | b10_drum_flank | b10_cage_vestibule | locked | clear b10_drum_flank_clear | b10_drum_to_cage_gate |
| Cage vestibule threshold | b10_cage_vestibule | b10_relay_cage | threshold/open | enter b10_cage_vestibule | b10_cage_to_signature_gate |
| Exit door | b10_relay_cage | b10_exit_door | locked | clear b10_relay_cage_clear | b10_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Transept peek | b10_intake_peek_clear | b10_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Sacristy approach | b10_relay_approach_clear | b10_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Sacristy relay | b10_alarm_relay | b10_mw_desk:anchor/guard_objective@relay_desk |
| Confessional flank | b10_drum_flank_clear | b10_me_lane:flanker/flank_after_contact@drum_spool |
| High altar | b10_relay_cage_clear | b10_bw_hold:patrol/suppress_lane@cage_pillar_west; b10_bc_heavy:anchor/hold_angle@cage_center_low; b10_bc_rifle:patrol/peek_from_cover@vestibule_face; b10_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
