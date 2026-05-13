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
