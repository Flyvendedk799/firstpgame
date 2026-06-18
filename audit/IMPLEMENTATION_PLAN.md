# firstpgame — Implementation Plan (Wave A)

Derived from `audit/findings.json` (235 findings). Scope = correctness fixes + **forward-pipeline** AAA visible upgrades.

## Hard decision: DO NOT flip `STABLE_RENDERING_MODE`
It is a deliberate black-frame/stability kill-switch (`const STABLE_RENDERING_MODE=true`, ~25 refs, UI says "Stable WebGL renderer is locked for this build"). Flipping it risks reintroducing black frames — the opposite of "instant visible impact". All AAA wins below are chosen because they render through the **forward pipeline** (shadows, materials, VFX, lighting, audio), independent of the post-FX composer.

## Verification (no playwright)
- `npm run build` (vite) — hard gate.
- 32 `scripts/*-static-probe.mjs` (pure node).
- Pure-node validators: `validate-campaign.mjs`, `validate-room-flow.mjs`, `validate-custom-maps.mjs`, `sequence-def-density-audit.mjs`.
- Each implementer also runs `node --check <file>` on edited files.

## main.js — 5 SEQUENTIAL groups (avoids write races; locate edits by CONTENT not line#)
- **M1 combat-logic**: del comboKill wrapper (double-fire + opts-drop), del tickFocus autofocus wrapper, crit neck/spine consumer, projectile hitstop slot guard, grenade-kill credit, enemy-grenade friendly-fire, boss-add zone0, endless phantom wave0, canSee per-archetype sight, riot/shielded double-move (careful), pushImpulse sign (careful).
- **M2 hud-camera-state**: main HP bar maxHp, armband HP maxHp, low-hp vignette dup writers, radial pointer-lock, last-stand weapon restore, deathcam null-killer, G._frame increment, objective-wrong-mastery, profile-slot defensive merge.
- **M3 leaks-audio-data**: knife beacon leak, trail dispose on transition, dropped-mag geo leak, sfxShoot→master bus, gunshot reverb send, MUSIC_PROFILES 8→12, delete dead RECOIL_PATTERNS dup.
- **M4 aaa-visual-forward**: megaplex shadows, player muzzle additive+toneMapped, brighter muzzle light, enemy muzzle additive, enemy muzzle shared light, explosion corona billboard, thrown-knife trail, tracer length-scale, shotgun FX cap→3, camera rotational shake, gentle megaplex lighting lift.
- **M5 aaa-juice-revival**: floating damage numbers (reimplement), cinematicKillEnhanced on boss/LT kills, casing-clatter sfx, body-fall sfx.

## Other files — PARALLEL (all disjoint from main.js)
- levelSequences.js: crate2 linkedSibling, crate2 floating collider, window transmission glass, bench backrest rotation.
- rendering.js: setLUT3D use-after-dispose.
- customMaps/customMapCompiler.js: shadow frustum config, zone-door double-dt.
- campaign/nativeEncounterTactics.js: patrol-retag namespace (careful), cover-anchors merge order.
- game/combatFeedback.js: break-pulse double-decay.
- animation/locomotionFeelController.js: wall-kick fold into consumed channels.
- companion/client.js: drone pointercancel.
- customMaps/schema.js: normalizeMarkers defaults merge.
- campaignStoryExperience.js: boss-cue tone B2/B3, setpiece cue fallback.
- encounterBehavior.js: sniper role + overwatch_catwalk tuning (additive).
- audio.js: master DynamicsCompressor bus in getAC.
