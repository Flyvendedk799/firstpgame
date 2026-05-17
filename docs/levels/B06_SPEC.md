# B06 — Subway Line 7

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[6]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[6]`](../../src/campaignEncounters.js) · **Matrix:** linear 36×70, track pit + platform, pinch → spine → pinch, platform / tunnel signature.

## 1. Logline

Turnstile to tunnel: vendor pocket, platform spine commit, relay closet hack, tunnel cage under signal box overwatch.

## 2. Three-second read

**Fluorescent tunnel**, **tactile strip** spine, **amber platform edge** on east flank.

## 3–6. Maps

Route: same ids; beats emphasize **linear pressure** and pinch at vendor / relay; encounters `b06_*`; spatial grammar spine + lateral drum lane as subway flank.

## 7–10

Narrative lighting; validates; geometry shares B01 nav until line-specific mesh extends `EXTRA_ELEMENTS[6]`.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[6]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Turnstile vestibule -> Platform peek -> Track service hall -> Power-closet approach -> Power relay closet -> Locker flank pocket -> Switch-chamber threshold -> Switch chamber -> Tunnel exit.

**Flow identity:** turnstile -> platform tunnel -> power closet -> switch chamber.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b06_scout_fe_lane (lookout, b06_intake_peek); the first locked internal gate is b06_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Turnstile vestibule | entry_room | safe_orientation | Turnstile vestibule advances turnstile -> platform tunnel -> power closet -> switch chamber. | Turnstile vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Platform peek | peek_room | first_contact | Platform peek advances turnstile -> platform tunnel -> power closet -> switch chamber. | Platform peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Track service hall | connector_hall | recovery_connector | Track service hall advances turnstile -> platform tunnel -> power closet -> switch chamber. | Track service hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Power-closet approach | threshold_room | tension_build | Power-closet approach advances turnstile -> platform tunnel -> power closet -> switch chamber. | Power-closet approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Power relay closet | objective_room | objective_pressure | Power relay closet advances turnstile -> platform tunnel -> power closet -> switch chamber. | Power relay closet uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Locker flank pocket | flank_room | flank_complication | Locker flank pocket advances turnstile -> platform tunnel -> power closet -> switch chamber. | Locker flank pocket uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Switch-chamber threshold | threshold_room | anticipation | Switch-chamber threshold advances turnstile -> platform tunnel -> power closet -> switch chamber. | Switch-chamber threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Switch chamber | signature_room | signature_escalation | Switch chamber advances turnstile -> platform tunnel -> power closet -> switch chamber. | Switch chamber uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Platform peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Power relay closet | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Locker flank pocket | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Switch chamber | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Switch chamber opens under red rail glow while dispatch glass reveals the overwatch. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b06_entry_vestibule | b06_intake_peek | threshold/open | enter b06_entry_vestibule | b06_entry_to_intake_gate |
| First internal gate | b06_intake_peek | b06_service_hall | locked | clear b06_intake_peek_clear | b06_intake_to_service_gate |
| Service threshold | b06_service_hall | b06_relay_approach | threshold/open | enter b06_service_hall | b06_service_to_relay_gate |
| Relay office gate | b06_relay_approach | b06_alarm_relay | locked | clear b06_relay_approach_clear | b06_relay_to_alarm_gate |
| Flank pressure gate | b06_alarm_relay | b06_drum_flank | locked | complete disable_alarm_panel | b06_alarm_to_drum_gate |
| Final threshold gate | b06_drum_flank | b06_cage_vestibule | locked | clear b06_drum_flank_clear | b06_drum_to_cage_gate |
| Cage vestibule threshold | b06_cage_vestibule | b06_relay_cage | threshold/open | enter b06_cage_vestibule | b06_cage_to_signature_gate |
| Exit door | b06_relay_cage | b06_exit_door | locked | clear b06_relay_cage_clear | b06_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Platform peek | b06_intake_peek_clear | b06_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Power-closet approach | b06_relay_approach_clear | b06_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Power relay closet | b06_alarm_relay | b06_mw_desk:anchor/guard_objective@relay_desk |
| Locker flank pocket | b06_drum_flank_clear | b06_me_lane:flanker/flank_after_contact@drum_spool |
| Switch chamber | b06_relay_cage_clear | b06_bw_hold:patrol/suppress_lane@cage_pillar_west; b06_bc_heavy:anchor/hold_angle@cage_center_low; b06_bc_rifle:patrol/peek_from_cover@vestibule_face; b06_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
