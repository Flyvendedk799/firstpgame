# B02 — Continental Lobby

**Narrative overlay:** [`NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[2]`](../../src/campaign/nativeEncounterNarrative.js) · **Encounter:** [`CAMPAIGN_ENCOUNTERS[2]`](../../src/campaignEncounters.js) · **Matrix:** formal 38×56, 1 + mezzanine, atrium → pocket → spine, concierge / salon signature.

## 1. Logline

Assault a marble grand lobby: salon pocket or security flank, hack the concierge relay under glass pressure, clear the salon cage under mezzanine overwatch.

## 2. Three-second read

**Chandelier warm fill** on triple lane marble; **mezzanine rail** silhouettes the back cage; security amber on the **west relay desk**.

## 3. Route topology map

Same stable graph as B01 skeleton (see [B01_SPEC](B01_SPEC.md) §3) with space ids unchanged for tooling; **thematic** nodes: atrium = `dock_intake`, salon pocket = `west_service_connector`, security flank = `east_flank_connector`, lobby spine = `mid_lane_center`, relay = `alarm_relay_room`, signature cage = `relay_cage`, mezz = `foreman_cage`.

## 4. Beat timeline map

| T | Zone | Verb | Composition | Geometry dependency |
|---|------|------|-------------|----------------------|
| 1 | 0 | read / pick_route | formal triple lane | atrium bounds + threshold |
| 2 | 0 | flank | east glass compression | east connector |
| 3 | 1 | hold / hack | desk anchor + alarm | relay offset door |
| 4 | 2 | clear vertical read | cage + mezz overwatch | catwalk sightline |

## 5. Encounter graph

Remapped ids `b02_*`; reinforcements **`b02_alarm_pair`**; director objectives mirror B01 with remapped `completeEncounterId` / `clearReinforcementSquads`.

## 6. Spatial grammar map

| Space | Shape | Door | Cover | Sight |
|-------|-------|------|-------|-------|
| dock_intake | atrium | public triple | mixed apron | long read to relay |
| west_service_connector | pocket | service | salon low + partition | narrow peek |
| east_flank_connector | pinch | public→mid | mullion edge | door preview |
| mid_lane_center | spine | zone_door | spine pinch | center_to_relay |
| alarm_relay_room | pocket | hard offset | desk + manifest | office_to_mid |
| relay_cage | atrium signature | vestibule | pillars | catwalk_over_bc |
| foreman_cage | pocket high | glass | rail / mullion | foreman_to_relay_cage |

## 7. Audio / lighting identity

Room `lightingMood` strings in narrative overlay (chandelier, sconce, amber console).

## 8. Mastery / setpiece

Alarm mastery path shared engine with B01 pattern on building 1 only in code; B02 uses same alarm interact mesh id `alarm_panel`.

## 9. Acceptance checklist

Template checklist; `validate:campaign` + geometry on preview.

## 10. Traceability table

Shared B01 `EXTRA_ELEMENTS[2]` where authored; floorplan `requiredGeometry` **not stripped** (native clone). Trace relay/cage rows to [B01_SPEC](B01_SPEC.md) §10 geometry ids until B02-exclusive meshes land.

<!-- ROOM_FLOW_REWORK_PACKET_START -->

## Room-Flow Rework Packet

**Runtime source:** `CAMPAIGN_ROOM_FLOWS[2]` in `src/campaignRoomFlows.js`.

**Baseline / failure note:** Before this rework the campaign shell behaved like an open zone arena: macro zone doors and broad zone spawns could make the waypoint favor a far door, the HUD read `ROOMS 0 / 3`, and future-room hostiles could participate before the player had crossed authored thresholds. This packet replaces that with flow-room gates, room-local encounters, and `ROOM n / 8` progress.

**Top-down critical path:** Lobby vestibule -> Coat-check peek -> Salon service hall -> Concierge approach -> Security relay desk -> Salon flank pocket -> Manager-suite threshold -> Manager suite -> Service elevator exit.

**Flow identity:** lobby vestibule -> coat check -> concierge/security -> manager suite.

**Pacing curve:** safe_orientation -> first_contact -> recovery_connector -> tension_build -> objective_pressure -> flank_complication -> anticipation -> signature_escalation.

**Deploy acceptance:** active start roster is b02_scout_fe_lane (lookout, b02_intake_peek); the first locked internal gate is b02_intake_to_service and is authored within the 8-12m deploy target.

### Room Beat List

| # | Room | Kind | Pacing | Gameplay purpose | Readability cue |
|---|------|------|--------|------------------|-----------------|
| 1 | Lobby vestibule | entry_room | safe_orientation | Lobby vestibule advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Lobby vestibule uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 2 | Coat-check peek | peek_room | first_contact | Coat-check peek advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Coat-check peek uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 3 | Salon service hall | connector_hall | recovery_connector | Salon service hall advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Salon service hall uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 4 | Concierge approach | threshold_room | tension_build | Concierge approach advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Concierge approach uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 5 | Security relay desk | objective_room | objective_pressure | Security relay desk advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Security relay desk uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 6 | Salon flank pocket | flank_room | flank_complication | Salon flank pocket advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Salon flank pocket uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 7 | Manager-suite threshold | threshold_room | anticipation | Manager-suite threshold advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Manager-suite threshold uses lighting, threshold scale, and prop orientation to confirm the next room. |
| 8 | Manager suite | signature_room | signature_escalation | Manager suite advances lobby vestibule -> coat check -> concierge/security -> manager suite. | Manager suite uses lighting, threshold scale, and prop orientation to confirm the next room. |

### Combat Choreography

| Room | First contact | Player cover answer | Enemy reaction | Exit reveal |
|------|---------------|---------------------|----------------|-------------|
| Coat-check peek | Lookout appears at the partial doorway read before the player can see deeper rooms. | Spawn-side jamb or low apron immediately left of the threshold. | Peek from cover, then alarm only the adjacent approach. | Hazard stripe and gate light pull toward the connector. |
| Security relay desk | Objective anchor guards the interact lane. | Offset partition edge and objective desk. | Guard objective until cleared. | Side-loop marker and changed relay light point to the flank room. |
| Salon flank pocket | Flanker crosses the side pocket after relay contact. | Drum stack / service-jamb cover. | Flank after contact and try to reconnect behind glass. | Final threshold light becomes visible through the connector. |
| Manager suite | Signature heavy is previewed before the player commits through the final threshold. | Threshold face and first interior pillar. | Manager bodyguard holds a velvet suite while a mezzanine silhouette previews the last angle. | Back-lit exit threshold is exposed behind the final room. |

### Gate / Lock Plan

| Gate | From | To | Start | Opens on | Mesh id |
|------|------|----|-------|----------|---------|
| Intake threshold | b02_entry_vestibule | b02_intake_peek | threshold/open | enter b02_entry_vestibule | b02_entry_to_intake_gate |
| First internal gate | b02_intake_peek | b02_service_hall | locked | clear b02_intake_peek_clear | b02_intake_to_service_gate |
| Service threshold | b02_service_hall | b02_relay_approach | threshold/open | enter b02_service_hall | b02_service_to_relay_gate |
| Relay office gate | b02_relay_approach | b02_alarm_relay | locked | clear b02_relay_approach_clear | b02_relay_to_alarm_gate |
| Flank pressure gate | b02_alarm_relay | b02_drum_flank | locked | complete disable_alarm_panel | b02_alarm_to_drum_gate |
| Final threshold gate | b02_drum_flank | b02_cage_vestibule | locked | clear b02_drum_flank_clear | b02_drum_to_cage_gate |
| Cage vestibule threshold | b02_cage_vestibule | b02_relay_cage | threshold/open | enter b02_cage_vestibule | b02_cage_to_signature_gate |
| Exit door | b02_relay_cage | b02_exit_door | locked | clear b02_relay_cage_clear | b02_signature_to_exit_gate |

### Enemy Role Placement

| Room | Encounter | Roles / behavior / cover |
|------|-----------|--------------------------|
| Coat-check peek | b02_intake_peek_clear | b02_scout_fe_lane:lookout/peek_from_cover@intake_apron |
| Concierge approach | b02_relay_approach_clear | b02_fc_doorline:anchor/peek_from_cover@spine_pinch |
| Security relay desk | b02_alarm_relay | b02_mw_desk:anchor/guard_objective@relay_desk |
| Salon flank pocket | b02_drum_flank_clear | b02_me_lane:flanker/flank_after_contact@drum_spool |
| Manager suite | b02_relay_cage_clear | b02_bw_hold:patrol/suppress_lane@cage_pillar_west; b02_bc_heavy:anchor/hold_angle@cage_center_low; b02_bc_rifle:patrol/peek_from_cover@vestibule_face; b02_be_scout:sniper/overwatch_catwalk@desk_rail |

### Sightline And Negative-Space Fixes

- Spawn sightlines are capped by the entry threshold and first peek room visibility budget. Future-room enemies are dormant until the room graph activates them.
- Locked room gates break the old open-square solve pattern; the waypoint targets the active room gate/objective before macro zone doors.
- Large floor patches are assigned to named purposes: connector recovery, objective pressure, side-loop flank, anticipation threshold, or signature escalation.
- Preview reads are deliberate: peek-room silhouette, objective/relay glass, final-threshold rails or glass, and signature-room landmark lighting.

<!-- ROOM_FLOW_REWORK_PACKET_END -->
