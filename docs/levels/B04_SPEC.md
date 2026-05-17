# B04 — Penthouse Ascent

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[4]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[4]`](../../src/campaignEncounters.js) · **Matrix:** long arc 32×60, sunken tier, spine → pocket → pinch, wine / exec suite.

## 1. Logline

Vertical prestige clear: gallery read, executive relay hack, helipad approach cage under owner office overwatch.

## 2. Three-second read

**Gallery spots** + **sunset fill**; **sunken tier** implies −Y commit; **glass crown** on back cage.

## 3. Route topology

Stable B01 graph ids; front = private gallery (`dock_intake`), mid = living spine + relay, back = cage + owner office.

## 4. Beat timeline

Front read → mid relay hold + `b04_alarm_pair` → back cage clear + mezz scout (`b04_foreman_read` pattern).

## 5. Encounter graph

Native clone: `b04_*` encounters, director traverse + hold interact, reinforcements active.

## 6. Spatial grammar

Spine living plate, pocket gallery, pinch wine approach, atrium cage — mix knee/chest/full per LEVELS_PLAN §3.4.

## 7–10. Polish, mastery, acceptance, traceability

Lighting moods in narrative overlay; alarm mastery B01-only in code; template checklist; trace B01 geometry until penthouse-specific props ship.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[4]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Elevator foyer -> Reception peek -> Gallery service hall -> Office approach -> Gallery relay console -> Wine-study flank -> Suite threshold -> Master suite -> Facade stair exit.

**Flow identity:** elevator foyer -> reception -> gallery/office -> wine/study -> suite.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b04_scout_fe_lane (lookout, b04_intake_peek); the first locked internal gate is b04_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Elevator foyer | entry_room | safe_orientation | Elevator foyer advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Elevator foyer uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Reception peek | peek_room | first_contact | Reception peek advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Reception peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Gallery service hall | connector_hall | recovery_connector | Gallery service hall advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Gallery service hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Office approach | threshold_room | tension_build | Office approach advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Office approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Gallery relay console | objective_room | objective_pressure | Gallery relay console advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Gallery relay console uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Wine-study flank | flank_room | flank_complication | Wine-study flank advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Wine-study flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Suite threshold | threshold_room | anticipation | Suite threshold advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Suite threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Master suite | signature_room | signature_escalation | Master suite advances elevator foyer -> reception -> gallery/office -> wine/study -> suite. | Master suite uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Reception peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Gallery relay console | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Wine-study flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Master suite | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Glass crown previews the underboss before the suite widens around gold cover. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b04_entry_vestibule | b04_intake_peek | threshold/open | enter b04_entry_vestibule | b04_entry_to_intake_gate |
| First internal gate | b04_intake_peek | b04_service_hall | locked | clear b04_intake_peek_clear | b04_intake_to_service_gate |
| Service threshold | b04_service_hall | b04_relay_approach | threshold/open | enter b04_service_hall | b04_service_to_relay_gate |
| Relay office gate | b04_relay_approach | b04_alarm_relay | locked | clear b04_relay_approach_clear | b04_relay_to_alarm_gate |
| Flank pressure gate | b04_alarm_relay | b04_drum_flank | locked | complete disable_alarm_panel | b04_alarm_to_drum_gate |
| Final threshold gate | b04_drum_flank | b04_cage_vestibule | locked | clear b04_drum_flank_clear | b04_drum_to_cage_gate |
| Cage vestibule threshold | b04_cage_vestibule | b04_relay_cage | threshold/open | enter b04_cage_vestibule | b04_cage_to_signature_gate |
| Exit door | b04_relay_cage | b04_exit_door | locked | clear b04_relay_cage_clear | b04_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Reception peek | b04_intake_peek_clear | b04_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Office approach | b04_relay_approach_clear | b04_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Gallery relay console | b04_alarm_relay | b04_mw_desk:anchor/guard_objective@relay_desk |
| Wine-study flank | b04_drum_flank_clear | b04_me_lane:flanker/flank_after_contact@drum_spool |
| Master suite | b04_relay_cage_clear | b04_bw_hold:patrol/suppress_lane@cage_pillar_west; b04_bc_heavy:anchor/hold_angle@cage_center_low; b04_bc_rifle:patrol/peek_from_cover@vestibule_face; b04_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
