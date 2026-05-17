# B08 — Server Farm Delta

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[8]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[8]`](../../src/campaignEncounters.js) · **Matrix:** grid 44×56, raised floor + floor, spine → pinch → atrium, hot/cold / core signature.

## 1. Logline

Cold aisle to core: PDU pocket, ops relay hack under console pulse, core cage under SOC glass overwatch.

## 2. Three-second read

**Blue cold aisle**, **amber hot aisle** east, **rack LED** rhythm, **glass enfilade** to cage.

## 3–6

Route / beats / encounters / spatial grammar follow B01 skeleton with data-center verbs (push aisles, hold ops, clear core).

## 7–10

`b08_*` native; alarm + director; validates; `EXTRA_ELEMENTS[8]` trace when server-specific kits land.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[8]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Mantrap vestibule -> Cold-aisle peek -> Patch crawl hall -> Ops approach -> Ops relay -> Hot-aisle flank -> Core-vault threshold -> Core vault -> Data-core exit.

**Flow identity:** mantrap -> cold aisle -> patch crawl -> ops relay -> core vault.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b08_scout_fe_lane (lookout, b08_intake_peek); the first locked internal gate is b08_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Mantrap vestibule | entry_room | safe_orientation | Mantrap vestibule advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Mantrap vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Cold-aisle peek | peek_room | first_contact | Cold-aisle peek advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Cold-aisle peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Patch crawl hall | connector_hall | recovery_connector | Patch crawl hall advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Patch crawl hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Ops approach | threshold_room | tension_build | Ops approach advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Ops approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Ops relay | objective_room | objective_pressure | Ops relay advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Ops relay uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Hot-aisle flank | flank_room | flank_complication | Hot-aisle flank advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Hot-aisle flank uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Core-vault threshold | threshold_room | anticipation | Core-vault threshold advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Core-vault threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Core vault | signature_room | signature_escalation | Core vault advances mantrap -> cold aisle -> patch crawl -> ops relay -> core vault. | Core vault uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Cold-aisle peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Ops relay | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Hot-aisle flank | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Core vault | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Core vault glass reveals the final guard while server aisles constrain every angle. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b08_entry_vestibule | b08_intake_peek | threshold/open | enter b08_entry_vestibule | b08_entry_to_intake_gate |
| First internal gate | b08_intake_peek | b08_service_hall | locked | clear b08_intake_peek_clear | b08_intake_to_service_gate |
| Service threshold | b08_service_hall | b08_relay_approach | threshold/open | enter b08_service_hall | b08_service_to_relay_gate |
| Relay office gate | b08_relay_approach | b08_alarm_relay | locked | clear b08_relay_approach_clear | b08_relay_to_alarm_gate |
| Flank pressure gate | b08_alarm_relay | b08_drum_flank | locked | complete disable_alarm_panel | b08_alarm_to_drum_gate |
| Final threshold gate | b08_drum_flank | b08_cage_vestibule | locked | clear b08_drum_flank_clear | b08_drum_to_cage_gate |
| Cage vestibule threshold | b08_cage_vestibule | b08_relay_cage | threshold/open | enter b08_cage_vestibule | b08_cage_to_signature_gate |
| Exit door | b08_relay_cage | b08_exit_door | locked | clear b08_relay_cage_clear | b08_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Cold-aisle peek | b08_intake_peek_clear | b08_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Ops approach | b08_relay_approach_clear | b08_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Ops relay | b08_alarm_relay | b08_mw_desk:anchor/guard_objective@relay_desk |
| Hot-aisle flank | b08_drum_flank_clear | b08_me_lane:flanker/flank_after_contact@drum_spool |
| Core vault | b08_relay_cage_clear | b08_bw_hold:patrol/suppress_lane@cage_pillar_west; b08_bc_heavy:anchor/hold_angle@cage_center_low; b08_bc_rifle:patrol/peek_from_cover@vestibule_face; b08_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
