# B12 — The Spire (Helipad Run)

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[12]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[12]`](../../src/campaignEncounters.js) · **Matrix:** helipad run 40×60, crown glass + catwalk layers, spine → atrium → pinch, helipad apex signature.

## 1. Logline

Sky lobby to helipad: express vs service read, crown relay hack under panel pulse, helipad threshold cage under crown office overwatch.

## 2. Three-second read

**City bounce fill**, **high-key glass spine**, **sky reflection** on mullion lane, **apex contrast** on cage.

## 3–6

Vertigo spine verb; `b12_*`; atrium cage read; pinch security wedge.

## 7–10

Tallest `RH` in `BUILDING_DIMS`; native encounter + narrative; validates; helipad-specific mesh future trace.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[12]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Glass-lobby vestibule -> Reception peek -> Boardroom connector -> Vault approach -> Board relay -> Maintenance-spine flank -> Helipad threshold -> Helipad apex -> Helipad exit.

**Flow identity:** glass lobby -> boardroom/vault -> maintenance spine -> helipad.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b12_scout_fe_lane (lookout, b12_intake_peek); the first locked internal gate is b12_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Glass-lobby vestibule | entry_room | safe_orientation | Glass-lobby vestibule advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Glass-lobby vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Reception peek | peek_room | first_contact | Reception peek advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Reception peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Boardroom connector | connector_hall | recovery_connector | Boardroom connector advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Boardroom connector uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Vault approach | threshold_room | tension_build | Vault approach advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Vault approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Board relay | objective_room | objective_pressure | Board relay advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Board relay uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Maintenance-spine flank | flank_room | flank_complication | Maintenance-spine flank advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Maintenance-spine flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Helipad threshold | threshold_room | anticipation | Helipad threshold advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Helipad threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Helipad apex | signature_room | signature_escalation | Helipad apex advances glass lobby -> boardroom/vault -> maintenance spine -> helipad. | Helipad apex uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Reception peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Board relay | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Maintenance-spine flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Helipad apex | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | The helicopter is visible behind glass before the final apex room unlocks. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b12_entry_vestibule | b12_intake_peek | threshold/open | enter b12_entry_vestibule | b12_entry_to_intake_gate |
| First internal gate | b12_intake_peek | b12_service_hall | locked | clear b12_intake_peek_clear | b12_intake_to_service_gate |
| Service threshold | b12_service_hall | b12_relay_approach | threshold/open | enter b12_service_hall | b12_service_to_relay_gate |
| Relay office gate | b12_relay_approach | b12_alarm_relay | locked | clear b12_relay_approach_clear | b12_relay_to_alarm_gate |
| Flank pressure gate | b12_alarm_relay | b12_drum_flank | locked | complete disable_alarm_panel | b12_alarm_to_drum_gate |
| Final threshold gate | b12_drum_flank | b12_cage_vestibule | locked | clear b12_drum_flank_clear | b12_drum_to_cage_gate |
| Cage vestibule threshold | b12_cage_vestibule | b12_relay_cage | threshold/open | enter b12_cage_vestibule | b12_cage_to_signature_gate |
| Exit door | b12_relay_cage | b12_exit_door | locked | clear b12_relay_cage_clear | b12_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Reception peek | b12_intake_peek_clear | b12_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Vault approach | b12_relay_approach_clear | b12_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Board relay | b12_alarm_relay | b12_mw_desk:anchor/guard_objective@relay_desk |
| Maintenance-spine flank | b12_drum_flank_clear | b12_me_lane:flanker/flank_after_contact@drum_spool |
| Helipad apex | b12_relay_cage_clear | b12_bw_hold:patrol/suppress_lane@cage_pillar_west; b12_bc_heavy:anchor/hold_angle@cage_center_low; b12_bc_rifle:patrol/peek_from_cover@vestibule_face; b12_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
