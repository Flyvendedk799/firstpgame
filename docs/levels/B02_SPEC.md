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
