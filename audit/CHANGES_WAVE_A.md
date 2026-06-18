# firstpgame — Audit & Fix Wave A (2026-06-14)

Multi-agent audit (31 auditors → 235 findings) → fix (16 agents, 58 changes) → verify. All gates green.

## Verification (no playwright)
- `npm run build` → **pass** (vite, exit 0)
- 32 `scripts/*-static-probe.mjs` → **32/32 pass**
- `validate-campaign` / `validate-room-flow` / `validate-custom-maps` / `sequence-def-density-audit` → **4/4 pass**
- `node --check` on every edited file → pass
- 5 highest-risk behavioral changes independently re-verified by hand.

## Decision: STABLE_RENDERING_MODE left ON
It's a deliberate black-frame kill-switch. All visible wins were chosen to render through the **forward pipeline** (shadows/materials/VFX/lighting/audio), independent of the disabled post-FX composer.

## Heavy instant visible impact (shipped)
- **Floating damage numbers** — reimplemented (gutted no-op → projected gold/white/red rising numbers, capped at 24 nodes).
- **B01 directional shadows** — key light `castShadow` was false + never registered; now grounded shadows (+ gentle key/hemi lift).
- **Muzzle flashes** — player + enemy materials → additive + `toneMapped:false` + brighter peak; one shared enemy-gun PointLight (dynamic light, bounded to 1).
- **Explosion corona billboarded** (was edge-on/invisible from most angles).
- **Thrown-knife motion trail**; **ballistic tracers length-scaled** to their swept segment (no more teleporting stubs).
- **Shotgun FX cap 1→3** (visible pellet spread).
- **Rotational camera shake** added to explosions/hits (was position-only).
- **Audio**: master `DynamicsCompressor` limiter (kills auto-fire clipping) + per-building gunshot reverb send (rooms now sound distinct).
- **Transmission glass** on tactical windows (high/ultra).
- **Boss/Lieutenant cinematic kills** (gold flash + slow-mo); **casing-clatter** + **body-fall** SFX wired.

## Correctness / contradiction fixes (shipped)
crit NECK/SPINE multiplier, player grenade kill-credit (+ enemy grenades no longer pad player score), endless phantom WAVE 0, deathcam freeze on no-killer, last-stand weapon restore, `G._frame` never incremented (4 throttles re-enabled), double comboKill milestone + dropped opts, triple autoFocus regen, projectile hitstop slot guard, boss-add zone-0 mis-tag, canSee per-archetype sight (snipers/marksmen), riot/shielded double-move, push-impulse sign, objective→wrong-mastery, low-hp vignette dual writers, music profiles 8→12, dead RECOIL_PATTERNS dup, profile-slot save-merge hardening; GPU leaks: stuck-knife beacon, trail dispose on transition, dropped-mag geometry; plus levelSequences crate2 (linked-sibling inversion + floating collider + bench backrest), rendering.js LUT use-after-dispose, customMapCompiler shadow frustum + double-dt doors, nativeEncounterTactics patrol-retag + cover-anchor merge order, combatFeedback double-decay, locomotion wall-kick, companion drone pointercancel, schema marker defaults, campaign boss-cue tone + setpiece fallback, encounterBehavior sniper/overwatch role, audio master bus.

## Remaining backlog
~176 lower-priority findings (mostly low-severity dead code / optional feature revival) remain in `audit/findings.json` for a future wave — deliberately deferred (low visible return, higher regression risk).
