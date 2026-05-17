# B03 — Nightclub (Obsidian Floor)

**Narrative:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[3]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[3]`](../../src/campaignEncounters.js) · **Matrix:** intimate pit + VIP, pocket → pinch → spine, pit / VIP glass signature.

## 1–2. Logline & three-second read

Own the floor: **violet neon** vestibule, **strobe** on VIP glass flank, booth **amber** relay, pit **hot spot** cage read.

## 3. Route topology

B01 skeleton ids; thematic: vestibule = `dock_intake`, bar pocket = `west_service_connector`, VIP approach = `east_flank_connector`, dance spine = `mid_lane_center`, booth relay = `alarm_relay_room`, pit cage = `relay_cage`, VIP mezz = `foreman_cage`.

## 4. Beat timeline

| T | Zone | Verb | Notes |
|---|------|------|------|
| 1 | 0 | read | low ceiling open to pit |
| 2 | 0 | flank | VIP glass pressure |
| 3 | 1 | hold | booth relay + alarm |
| 4 | 2 | clear | pit cage + VIP rail |

## 5. Encounter graph

`b03_*` ids; `b03_alarm_pair` reinforcements; director objectives remapped.

## 6. Spatial grammar

Pocket bar, pinch VIP approach, spine dance floor, pocket relay, atrium pit cage, overwatch VIP mezz — cover mix per LEVELS_PLAN §3.4.

## 7–8. Audio / lighting & mastery

Narrative `lightingMood`; alarm panel interact shared.

## 9. Acceptance

Template + validates.

## 10. Traceability

Shared geometry ids with B01 skeleton until nightclub-specific `EXTRA_ELEMENTS[3]` expansion; see `levelSequences.js`.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[3]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Queue vestibule -> Coat-check peek -> Bar service hall -> Dance-pit approach -> DJ relay booth -> VIP flank pocket -> Mirror-lounge threshold -> Mirrored lounge -> Backstage exit.

**Flow identity:** queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b03_scout_fe_lane (lookout, b03_intake_peek); the first locked internal gate is b03_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Queue vestibule | entry_room | safe_orientation | Queue vestibule advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | Queue vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Coat-check peek | peek_room | first_contact | Coat-check peek advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | Coat-check peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Bar service hall | connector_hall | recovery_connector | Bar service hall advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | Bar service hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Dance-pit approach | threshold_room | tension_build | Dance-pit approach advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | Dance-pit approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | DJ relay booth | objective_room | objective_pressure | DJ relay booth advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | DJ relay booth uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | VIP flank pocket | flank_room | flank_complication | VIP flank pocket advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | VIP flank pocket uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Mirror-lounge threshold | threshold_room | anticipation | Mirror-lounge threshold advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | Mirror-lounge threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Mirrored lounge | signature_room | signature_escalation | Mirrored lounge advances queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge. | Mirrored lounge uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Coat-check peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| DJ relay booth | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| VIP flank pocket | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Mirrored lounge | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Mirror reads multiply the target silhouette while VIP pressure enters through a short side loop. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b03_entry_vestibule | b03_intake_peek | threshold/open | enter b03_entry_vestibule | b03_entry_to_intake_gate |
| First internal gate | b03_intake_peek | b03_service_hall | locked | clear b03_intake_peek_clear | b03_intake_to_service_gate |
| Service threshold | b03_service_hall | b03_relay_approach | threshold/open | enter b03_service_hall | b03_service_to_relay_gate |
| Relay office gate | b03_relay_approach | b03_alarm_relay | locked | clear b03_relay_approach_clear | b03_relay_to_alarm_gate |
| Flank pressure gate | b03_alarm_relay | b03_drum_flank | locked | complete disable_alarm_panel | b03_alarm_to_drum_gate |
| Final threshold gate | b03_drum_flank | b03_cage_vestibule | locked | clear b03_drum_flank_clear | b03_drum_to_cage_gate |
| Cage vestibule threshold | b03_cage_vestibule | b03_relay_cage | threshold/open | enter b03_cage_vestibule | b03_cage_to_signature_gate |
| Exit door | b03_relay_cage | b03_exit_door | locked | clear b03_relay_cage_clear | b03_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Coat-check peek | b03_intake_peek_clear | b03_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Dance-pit approach | b03_relay_approach_clear | b03_fc_doorline:anchor/peek_from_cover@spine_pinch |
| DJ relay booth | b03_alarm_relay | b03_mw_desk:anchor/guard_objective@relay_desk |
| VIP flank pocket | b03_drum_flank_clear | b03_me_lane:flanker/flank_after_contact@drum_spool |
| Mirrored lounge | b03_relay_cage_clear | b03_bw_hold:patrol/suppress_lane@cage_pillar_west; b03_bc_heavy:anchor/hold_angle@cage_center_low; b03_bc_rifle:patrol/peek_from_cover@vestibule_face; b03_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
