# firstpgame Audit — Collated Findings

**244 raw findings** from 31 auditors → **235 after dedupe** (9 merged).

Ranking: (1) crash/bug/state-desync/leak by severity, (2) contradiction/deadcode, (3) aaa-visual/aaa-feel/perf by visible impact.

## Top 40 by priority

| # | Kind | Sev | Vis | File:Lines | Title | Fix (one-line) |
|---|------|-----|-----|-----------|-------|----------------|
| 1 | bug | high | high | `levelSequences.js:1376-1381` | crate2: shooting the TOP crate destroys the BOTTOM crate (linkedSibling semantics inverted vs _shatterMesh) | Remove the `b.userData.linkedSibling = a;` line (line 1380). |
| 2 | bug | high | high | `rendering.js:512-519` | setLUT3D disposes cache-owned LUT textures, corrupting the per-building LUT cache (use-after-dispose) | Stop disposing inside setLUT3D since the LUT textures are owned by main.js's _lutCacheByBn (and torn down elsewhere). |
| 3 | bug | high | high | `main.js:32457-32463` | Combo milestone FX fire twice per milestone (double toast, double money, double slowmo) | Remove the duplicate milestone call inside the wrapper at lines 32460-32462 (the original comboKill already fires it). |
| 4 | bug | high | high | `main.js:31401-31453` | Radial quick-select menu is non-functional — never exits pointer lock, mouse can't hover/click slots | In openRadial after RADIAL.open=true add `if(locked)try{document.exitPointerLock();}catch(_){}` and in closeRadial re-lock with `if(RADIA... |
| 5 | bug | high | high | `main.js:32910-33024` | Endless mode fires a phantom 'WAVE 0' reward and double-schedules the first wave | Guard the transition on a started wave: change line 33005 to `if(alive===0 && ENDLESS.wave>0 && !ENDLESS._waveTransition){`. |
| 6 | state-desync | high | medium | `main.js:41578-44619` | G._frame is read by 4 frame-throttle gates but is NEVER incremented anywhere — every throttle fires every frame | Add a single increment near the top of the animation loop, e.g. |
| 7 | bug | high | medium | `main.js:25437-25459` | NECK/SPINE critical hits do no bonus (and SPINE does a penalty) because consumer divides crit mul by 2.0 | Make _isCritHit return multipliers relative to the actual baseDmg, OR fix the consumer at line 26417 to not divide body crits by 2. |
| 8 | state-desync | high | medium | `main.js:32457-32463` | comboKill wrapper drops the opts arg (source/closeRange), starving the story-combat feel system | Delete the entire wrapper (32457-32463) |
| 9 | bug | medium | high | `main.js:37089-37122` | Death cam freezes (no camera motion) when player dies with no alive enemy nearby | At the top of startDeathCam set `DEATHCAM.killerPos=null;`. |
| 10 | state-desync | medium | medium | `locomotionFeelController.js:344-345` | Locomotion-feel camera wall-kick (wallKickPitch/wallKickRoll) is computed every frame then discarded | Either (a) |
| 11 | state-desync | medium | medium | `combatFeedback.js:34-36` | _attackBreakPulse/_weaponBreakPulse/_coverBreakPulse are decayed twice per frame (combatFeedback AND gunplayPolish both own them) | Remove the three keys '_attackBreakPulse', '_weaponBreakPulse', '_coverBreakPulse' from ONE module's DECAY table. |
| 12 | state-desync | medium | medium | `levelSequences.js:1365-1381` | crate2: bottom crate's wall/vault AABB removed on break leaves the top crate floating; top break leaves bottom's collider orphaned | Give each box its own AABB/vault entry: build a separate `aabbTop`/`vaultTop` for `b` and set b.userData.linkedAABB/linkedVault to them. |
| 13 | state-desync | medium | medium | `main.js:5939-5959` | Environment-cohesion grade never reaches grouped signature props | In _applyCoreEnvironmentCohesionPass, recurse into groups: replace the flat loop with `for(const root of ob){ root.traverse(node=>{ if(!n... |
| 14 | state-desync | medium | medium | `main.js:22564-22567` | Main HUD health bar width and color thresholds use raw HP, not HP/maxHp — bar overflows and mis-colors with the extraHp perk / health powerup | Mirror the split-HUD math: `const ratio=(P.hp\|\|0)/Math.max(1,P.maxHp\|\|100); const pct=Math.min(100,ratio*100); _hudSetText('hp-val',h); _... |
| 15 | leak | medium | medium | `main.js:19829-19844` | _resetKnifeRuntime leaks the stuck-knife pickup beacon (orphan VFX + GPU resources) | In _resetKnifeRuntime, inside the `for(const k of G.knives)` loop, call `_disposeKnifeBeacon(k);` before/after scene.remove(k.grp). |
| 16 | state-desync | medium | medium | `main.js:25540-25563` | tickProjectiles fires triggerHitStop for any owner, but hitstop only affects player slot 0 (P) | Guard both triggerHitStop calls with (p.ownerSlot\|0)===0, e.g. |
| 17 | bug | medium | medium | `main.js:31090-31097` | autoFocus perk focus regen applied multiple times (tickFocus wrapper duplicates work the original already does) | Delete the extra regen block in the wrapper (31092-31095) |
| 18 | state-desync | medium | medium | `main.js:37196-37224` | Last Stand stores previous weapon but never restores it on revive — player stuck on pistol | In tickLastStand's revive branch (right after `P.hp=25;`, line 37222) |
| 19 | state-desync | medium | medium | `main.js:17967-17969` | Wrist-armband holo HP bar divides by hardcoded 100, ignoring P.maxHp (extraHp perk -> bar under-reports damage) | Replace the hardcoded 100 with the player's max HP: const hpRatio=Math.max(0,Math.min(1,(P.hp\|\|0)/Math.max(1,P.maxHp\|\|100)));  This mirro... |
| 20 | bug | medium | low | `client.js:745-753` | Drone fire/up/down buttons never clear on pointercancel — drone can fire or climb forever | For fire-btn add `el('fire-btn').addEventListener('pointercancel',()=>{state.sticks.fireHeld=false;});` and likewise add pointercancel ha... |
| 21 | state-desync | medium | low | `customMapCompiler.js:984-989` | Custom-map zone doors advance their open animation twice per frame (double dt) | Remove the redundant `tickZoneDoors(dt);` call from the compiler's tickDynProps (line 985), keeping `tickOpenableDoors(dt);` (which the m... |
| 22 | bug | medium | low | `schema.js:161-165` | normalizeMarkers drops playerSpawn defaults (id/yaw/floorY) for partial input | Merge defaults UNDER the input: `out.playerSpawn = Object.assign({}, defaultMarkers().playerSpawn, markers.playerSpawn \|\| {});` (capture ... |
| 23 | state-desync | medium | low | `encounterBehavior.js:53-60` | encounterAlertLink and encounterPreferredState are written from authored data but never read anywhere — authored squad alert-coordination and preferred-state are dead | If alert links are desired (cheap AAA feel — coordinated room wake): in main.js where an enemy first acquires the player / sets lastKnown... |
| 24 | bug | medium | low | `main.js:12758-12763` | Boss-spawned adds mis-tagged to zone 2 when boss is in zone 0 (`\|\|` swallows zoneId 0) | Change line 12763 to `newE.zoneId=Number.isFinite(boss.zoneId)?boss.zoneId:2;` (mirror the opts on line 12758). |
| 25 | bug | medium | low | `main.js:29817-29837` | loadProfileSlot does Object.assign(PROGRESS, partial) — would clobber PROGRESS with a partial shape (violates save-merge rule); whole profile-slot system is dead | If the feature ships, route loads through the same defaults-merge used for clearance_progress (deep-merge JSON.parse(raw) |
| 26 | leak | medium | low | `main.js:32879,32924,35383,38388,38563,38665,38886` | Level/mode transitions remove trail meshes from scene but never dispose their geometry/material (GPU leak on every building advance) | Replace each `G.trails.forEach(t=>{...scene.remove...})` cleanup with `for(let i=G.trails.length-1;i>=0;i--)_disposeTrail(G.trails[i]); G... |
| 27 | leak | medium | none | `main.js:26643-26664` | spawnDroppedMag leaks two BoxGeometries every reload (Group pushed as t.mesh, child geometries never disposed) | Either dispose child geometries in _disposeTrail for grouped trails (`if(t.mesh){scene.remove(t.mesh);t.mesh.traverse&&t.mesh.traverse(o=... |
| 28 | state-desync | medium | medium | `main.js:11337-11407` | Riot charge and shielded body-block move the enemy, then the ATTACK switch-case moves it AGAIN the same frame | When the riot melee-charge (or shielded body-block) |
| 29 | bug | medium | low | `main.js:23271-23274` | Enemy-thrown (demolitions) grenades route through explodeGrenade and friendly-fire other enemies, awarding the player money/kills | Either (a) |
| 30 | bug | medium | low | `main.js:37782-37783` | Zone-door gate-id regex uses \\. (literal backslash) instead of \. so the float-formatted '.0' suffix never matches | Replace `\\.` with `\.`: `/mega_zone_gate_22(?:\.0)?_/` and `/mega_zone_gate_-22(?:\.0)?_/`. |
| 31 | state-desync | medium | low | `main.js:35846-35894` | Resuming a saved coop (or non-custom) run silently loads it as solo | Either (a) |
| 32 | bug | low | medium | `campaignStoryExperience.js:107-139` | B02/B03 boss reveal cues omit tone/duration args, rendering with tone='story' (3300ms) instead of 'boss' (3800ms) | Add `, 'boss', 3800` to the cue() |
| 33 | bug | low | medium | `levelSequences.js:846-853` | bench backrest placed at un-rotated -z offset, so rotated benches (rotY=π/2) have a detached/misplaced backrest | Rotate the local backrest offset by e.rotY before applying: const c=Math.cos(e.rotY\|\|0), s=Math.sin(e.rotY\|\|0); const off=-d*0.5+0.05; bk... |
| 34 | bug | low | low | `campaignStoryExperience.js:422-430` | Alarm setpiece shows the same 'Alarm Silenced' cue twice (silenced + reward paths reuse cset.silenced with different keys) | Either drop the reward-path enqueue (lines 427-430) |
| 35 | state-desync | low | low | `main.js:13371-13375` | _pulseCloseCombatFeedback writes P._knifeThrowImpactPulse for the 'knife_throw' branch, but nothing ever reads it — knife-throw hit feedback is computed and discarded | Either (a) |
| 36 | bug | low | low | `main.js:22421` | KeyF focus toggle has no e.repeat guard — holding F rapidly flip-flops focus mode on key auto-repeat | Add the repeat guard: `if(e.code==='KeyF'&&!P.dead&&!G.menuOpen&&!e.repeat)toggleFocus();` |
| 37 | bug | low | low | `main.js:14476-14519` | Heavy-stab hit flash uses lifetime 0.30 but fade divisor is hardcoded 0.22 — opacity starts pinned >1 | Store the flash duration when arming it (e.g. |
| 38 | state-desync | low | low | `main.js:26440-26443` | Hit-FX throttle uses global P instead of the firing player pl (cross-player desync in P2/duel) | Replace both `P._suppressHitFxUntil` references on lines 26440 and 26443 with `pl._suppressHitFxUntil`. |
| 39 | bug | low | low | `main.js:36275` | Combo HUD fill divisor hardcoded to 4.8 but body-kill combo timer is 4.35 — bar never reads full | Track the window length on the combo object: in comboKill set `P.combo.window=isHead?4.8:4.35;` and in comboTick divide by `(P.combo.wind... |
| 40 | leak | low | none | `levelEditor.js:632-666, 1283` | Editor material cache grows unbounded with route waypoint index keys | Drop `${index}` from the route-dot cache key (line 1283) |

## Bugs & contradictions to fix

_93 crash/bug/state-desync/leak + 106 contradiction/deadcode._

### Critical / High severity (fix first)

- **[#1 bug/high]** `levelSequences.js:1376-1381` — crate2: shooting the TOP crate destroys the BOTTOM crate (linkedSibling semantics inverted vs _shatterMesh)
  - Fix: Remove the `b.userData.linkedSibling = a;` line (line 1380).
- **[#2 bug/high]** `rendering.js:512-519` — setLUT3D disposes cache-owned LUT textures, corrupting the per-building LUT cache (use-after-dispose)
  - Fix: Stop disposing inside setLUT3D since the LUT textures are owned by main.js's _lutCacheByBn (and torn down elsewhere).
- **[#3 bug/high]** `main.js:32457-32463` — Combo milestone FX fire twice per milestone (double toast, double money, double slowmo)
  - Fix: Remove the duplicate milestone call inside the wrapper at lines 32460-32462 (the original comboKill already fires it).
- **[#4 bug/high]** `main.js:31401-31453` — Radial quick-select menu is non-functional — never exits pointer lock, mouse can't hover/click slots
  - Fix: In openRadial after RADIAL.open=true add `if(locked)try{document.exitPointerLock();}catch(_){}` and in closeRadial re-lock with `if(RADIA...
- **[#5 bug/high]** `main.js:32910-33024` — Endless mode fires a phantom 'WAVE 0' reward and double-schedules the first wave
  - Fix: Guard the transition on a started wave: change line 33005 to `if(alive===0 && ENDLESS.wave>0 && !ENDLESS._waveTransition){`.
- **[#6 state-desync/high]** `main.js:41578-44619` — G._frame is read by 4 frame-throttle gates but is NEVER incremented anywhere — every throttle fires every frame
  - Fix: Add a single increment near the top of the animation loop, e.g.
- **[#7 bug/high]** `main.js:25437-25459` — NECK/SPINE critical hits do no bonus (and SPINE does a penalty) because consumer divides crit mul by 2.0
  - Fix: Make _isCritHit return multipliers relative to the actual baseDmg, OR fix the consumer at line 26417 to not divide body crits by 2.
- **[#8 state-desync/high]** `main.js:32457-32463` — comboKill wrapper drops the opts arg (source/closeRange), starving the story-combat feel system
  - Fix: Delete the entire wrapper (32457-32463)
- **[#94 contradiction/high]** `main.js:470-502,15502,23458` — STABLE_RENDERING_MODE=true makes the ENTIRE post-processing chain dead at runtime (no bloom, AO, color grade, vignette, SMAA, sharpen, SSR, DoF, LUT)
  - Fix: This is clearly a deliberate stability kill-switch (likely from the WebGPU/black-frame saga).
- **[#95 contradiction/high]** `nativeEncounterTactics.js:205-305` — Per-building patrol retag is a permanent no-op (ROOM_PATROL_KIND keyed by floorplan ids, looked up with flow ids) — _makeCampaignRoutes() output is entirely dead
  - Fix: Make the room-key namespaces agree.

### Medium severity

- **[#9 bug]** `main.js:37089-37122` — Death cam freezes (no camera motion) when player dies with no alive enemy nearby
- **[#10 state-desync]** `locomotionFeelController.js:344-345` — Locomotion-feel camera wall-kick (wallKickPitch/wallKickRoll) is computed every frame then discarded
- **[#11 state-desync]** `combatFeedback.js:34-36` — _attackBreakPulse/_weaponBreakPulse/_coverBreakPulse are decayed twice per frame (combatFeedback AND gunplayPolish both own them)
- **[#12 state-desync]** `levelSequences.js:1365-1381` — crate2: bottom crate's wall/vault AABB removed on break leaves the top crate floating; top break leaves bottom's collider orphaned
- **[#13 state-desync]** `main.js:5939-5959` — Environment-cohesion grade never reaches grouped signature props
- **[#14 state-desync]** `main.js:22564-22567` — Main HUD health bar width and color thresholds use raw HP, not HP/maxHp — bar overflows and mis-colors with the extraHp perk / health powerup
- **[#15 leak]** `main.js:19829-19844` — _resetKnifeRuntime leaks the stuck-knife pickup beacon (orphan VFX + GPU resources)
- **[#16 state-desync]** `main.js:25540-25563` — tickProjectiles fires triggerHitStop for any owner, but hitstop only affects player slot 0 (P)
- **[#17 bug]** `main.js:31090-31097` — autoFocus perk focus regen applied multiple times (tickFocus wrapper duplicates work the original already does)
- **[#18 state-desync]** `main.js:37196-37224` — Last Stand stores previous weapon but never restores it on revive — player stuck on pistol
- **[#19 state-desync]** `main.js:17967-17969` — Wrist-armband holo HP bar divides by hardcoded 100, ignoring P.maxHp (extraHp perk -> bar under-reports damage)
- **[#20 bug]** `client.js:745-753` — Drone fire/up/down buttons never clear on pointercancel — drone can fire or climb forever
- **[#21 state-desync]** `customMapCompiler.js:984-989` — Custom-map zone doors advance their open animation twice per frame (double dt)
- **[#22 bug]** `schema.js:161-165` — normalizeMarkers drops playerSpawn defaults (id/yaw/floorY) for partial input
- **[#23 state-desync]** `encounterBehavior.js:53-60` — encounterAlertLink and encounterPreferredState are written from authored data but never read anywhere — authored squad alert-coordination and preferred-state are dead
- **[#24 bug]** `main.js:12758-12763` — Boss-spawned adds mis-tagged to zone 2 when boss is in zone 0 (`||` swallows zoneId 0)
- **[#25 bug]** `main.js:29817-29837` — loadProfileSlot does Object.assign(PROGRESS, partial) — would clobber PROGRESS with a partial shape (violates save-merge rule); whole profile-slot system is dead
- **[#26 leak]** `main.js:32879,32924,35383,38388,38563,38665,38886` — Level/mode transitions remove trail meshes from scene but never dispose their geometry/material (GPU leak on every building advance)
- **[#27 leak]** `main.js:26643-26664` — spawnDroppedMag leaks two BoxGeometries every reload (Group pushed as t.mesh, child geometries never disposed)
- **[#28 state-desync]** `main.js:11337-11407` — Riot charge and shielded body-block move the enemy, then the ATTACK switch-case moves it AGAIN the same frame
- **[#29 bug]** `main.js:23271-23274` — Enemy-thrown (demolitions) grenades route through explodeGrenade and friendly-fire other enemies, awarding the player money/kills
- **[#30 bug]** `main.js:37782-37783` — Zone-door gate-id regex uses \\. (literal backslash) instead of \. so the float-formatted '.0' suffix never matches
- **[#31 state-desync]** `main.js:35846-35894` — Resuming a saved coop (or non-custom) run silently loads it as solo
- **[#96 deadcode]** `main.js:29108-29119` — applyHudTheme sets --hud-* CSS vars that nothing in the project reads (inert theming feature)
- **[#97 deadcode]** `main.js:26927-26965` — KILLCAM third-person orbit is fully dead — never triggered, would also never restore the camera
- **[#98 contradiction]** `main.js:26341-26343` — FX_CAP clamps multi-pellet FX to 1, contradicting the comment ('first 3 pellets') — shotgun shows a single tracer/impact
- **[#99 deadcode]** `main.js:31815-31842` — Scripted cinematic building-intro flythrough is fully implemented but never triggered
- **[#100 deadcode]** `main.js:33699-33702,25230,25555,26549` — Floating damage numbers fully removed — spawnDmgNumber() is a no-op that just clears the DOM container, yet 3 hit sites still build+discard a world position every hit
- **[#101 deadcode]** `campaignStoryExperience.js:30-36` — campaignCuePack only defines a 'pressure' setpiece, but no building ever sets setpiece.kind='pressure' — buildings 4-12 get zero setpiece story cues
- **[#102 deadcode]** `encounterBehavior.js:27-43, 49-98` — Authored 'overwatch_catwalk' behavior and 'sniper' role are unhandled — the signature-room overwatch enemy is a plain default scout in all 12 buildings
- **[#103 contradiction]** `main.js:13071-13119` — MUSIC_PROFILES has only 8 entries but the game has 12 buildings; reverb has 12 — late buildings get the wrong music key/tempo
- **[#104 contradiction]** `main.js:10327-10327` — Hard 22m vision cap in canSee() defeats sniper/marksman attackRange (up to ~27m)
- **[#105 contradiction]** `main.js:23123-23130` — Player grenade kills skip P.kills++, killfeed and combo — every other kill source credits them; grenade kills are 'silent'
- **[#106 contradiction]** `main.js:41684-41699` — Two competing writers drive the same #low-hp vignette element with different thresholds in the same frame
- **[#107 deadcode]** `main.js:14276-14276` — Overhead-slam combo (s===2) animation + slash FX are unreachable — MELEE.slash is never 2
- **[#108 deadcode]** `main.js:29880-29888` — tickHealthRegen (passive out-of-combat HP regen) is never called; CONFIG.player.hpRegen/hpRegenDelay also unused
- **[#109 contradiction]** `main.js:32157-32208` — OBJECTIVE_DEFS stealth/timer objectives fail the wrong building mastery (B07/B10 mismatch)
- **[#110 contradiction]** `main.js:30974-30980` — Enemy HP never scales with difficulty — _adjustEnemyHp / DIFF_HP_MUL / DIFFICULTY_MODIFIERS are all dead, descriptions promise tougher enemies
- **[#111 deadcode]** `main.js:33030-33094` — AGILITY powerup (fastReload) has zero effect — never read as a powerup
- **[#112 contradiction]** `nativeEncounterTactics.js:167-199` — Hand-authored COVER_HINT_ANCHOR_PATCH_BY_BN values for buildings 2-7 and 10 are silently overwritten at module load by the computed loop
- **[#113 deadcode]** `main.js:6063-6063,8383-8383,12866-12866` — SUPPRESS / HOLD_CORNER / PEEK_FIRE state enums are declared but never assigned to this.state
- **[#114 deadcode]** `main.js:29977-30005` — RUN_STATS per-weapon/per-enemy tracking is never populated; compileFullRunStats() returns empty breakdowns
- **[#115 deadcode]** `main.js:33031-33094` — DOUBLER powerup (doubleScore) has zero effect — never read anywhere
- **[#116 deadcode]** `main.js:35939` — extraFocus unlock applies +0.0 — a no-op; 'Enhanced focus (Lv 5)' reward does nothing
- **[#117 deadcode]** `main.js:18807-18810, 19431-19506` — Authored M4 viewmodel GLBs (~7.6MB) are loaded every session but can never be shown
- **[#118 deadcode]** `levelSequences.js:62-65` — EXTRA_ELEMENTS[1] and ROUTE_COMPLETION_ELEMENTS_BY_BN[1] are never executed (B01 returns early)
- **[#119 deadcode]** `main.js:28482-28494` — logBuildingClear()/BUILDING_CLEAR_LOG never called and never restored from save
- **[#120 contradiction]** `main.js:28916-28925` — RECOIL_PATTERNS is a dead duplicate of the live RECOIL_PATTERNS_LEARNABLE table
- **[#121 contradiction]** `rendering.js:88-91` — Color-grade pass applies a Reinhard tonemap that double-tonemaps with the renderer's ACES + OutputPass
- **[#122 contradiction]** `main.js:8090-8096` — Bullet/melee _pushImpulse nudges enemy TOWARD the shooter, opposing the stagger knockback

## High-visible-impact AAA upgrades

### Highest visible impact

- **[#200 aaa-visual]** `customMapCompiler.js:870-877` — Compiled custom map key light has no shadow camera frustum, so shadows are invisible/badly clipped
  - Fix: In customMapCompiler.js right after creating `key` (line 870), configure its shadow to cover the map: `key.shadow.mapSize.set(1024,1024);...
- **[#201 aaa-visual]** `main.js:37989-37998` — Megaplex B01 level casts ZERO shadows — directional key light has castShadow=false and is never registered as a shadow caster
  - Fix: Set `key.castShadow=true` (the shadow camera is already sized -75..75 / -135..135 near 1 far 180, covering the level)
- **[#202 aaa-visual]** `main.js:16812-16819` — Player muzzle flash uses normal blending + tone-mapped color, so it reads dull on every shot
  - Fix: Add `blending:THREE.AdditiveBlending, toneMapped:false` to the `_pmfMat` definition at line 16812 and the `_pmfMatP2` definition at line ...
- **[#203 aaa-visual]** `levelSequences.js:1653-1656` — Primary tactical-glass `window` builder uses flat MeshPhongMaterial while ctx.aaPhysicalGlass (transmission glass) sits unused
  - Fix: Mirror the `glass` builder's quality gate: at line 1653, if (ctx.settings?.quality === 'high' || 'ultra')
- **[#204 aaa-visual]** `main.js:23152-23156` — Explosion corona disc is never billboarded — the blast's brightest element is edge-on / invisible from most angles
  - Fix: Add faceCameraBillboard:true to the corona trail entry and orient it once at spawn: after `corona.position.copy(pos);` add `_orientVfxBil...
- **[#205 aaa-visual]** `main.js:20177-20186` — Outgoing thrown knife has NO motion trail — return arc is lavish, throw is a bare spinning box
  - Fix: In the physics tick (after `k.grp.position.copy(next)` around line 20180), add a throttled motion trail mirroring the return style, e.g.:...
- **[#206 aaa-visual]** `main.js:25493-25524` — Ballistic tracer is a fixed 0.30m stub that teleports in large gaps for fast rounds
  - Fix: After _alignCyl in tickProjectiles, stretch the tracer along its local Y to cover the swept segment: compute segLen=p.pos.distanceTo(prev...
- **[#207 aaa-visual]** `main.js:7045-7060,12889-12924` — Enemy gunfire casts NO dynamic light — flat additive sprite only; player gun has a PointLight muzzle flash
  - Fix: Add ONE shared scene PointLight (e.g.

### Medium visible impact

- **[#208 perf]** `levelEditor.js:1296-1303` — addRouteOverlay recompiles the entire map geometry once per route waypoint, every render
- **[#209 aaa-feel]** `main.js:12966-12997` — All SFX connect raw to ctx.destination with no master limiter — heavy auto-fire clips/distorts; a single DynamicsCompressor is a cheap AAA audio polish
- **[#210 aaa-feel]** `main.js:13128-13136` — Per-building convolution reverb is wired ONLY to the music master; gunshots/melee never get the room reverb, so every environment sounds acoustically identical
- **[#211 aaa-visual]** `main.js:37983-37997` — Megaplex base lighting is very dim/flat (hemi .42, ambient .18, key .95, no shadows) and point lights hard-capped to 3 visible
- **[#212 aaa-feel]** `campaignStoryExperience.js:5-6` — Rich per-cue 'tone' metadata (danger/boss/success/objective) is authored but only mapped to a data-attribute — high-value, low-risk styling hook
- **[#213 aaa-visual]** `customMapCompiler.js:866-877` — Compiled custom map lighting is a single hemi + one key, much flatter than campaign
- **[#214 aaa-visual]** `main.js:3597-3608` — Animated CRT monitor material exists but only 2-3 wall monitors use it
- **[#215 aaa-visual]** `main.js:3309-3337` — Faked god-ray cones only render on low/medium; high/ultra get nothing unless Phase2 volumetrics shipped
- **[#216 aaa-visual]** `main.js:5723-5728` — Cathedral choir-loft candles are bare emissive cylinders with no pool/glow lamp
- **[#217 aaa-visual]** `main.js:23158-23165` — Explosion sparks are low-poly SphereGeometry blobs instead of the textured additive spark quads used by the rest of the VFX
- **[#218 aaa-visual]** `main.js:12896-12905` — Enemy muzzle flash is a flat on/off pop — add a 2-3 frame additive decay + brief warm light for punch
- **[#219 aaa-visual]** `main.js:29659-29664` — _flashScreenColor uses mix-blend-mode:screen at z-index:14 — likely under the HUD and dependent on backdrop; opacity .55 is harsh
- **[#220 aaa-feel]** `main.js:27450-27456` — Dropkick launch has shake + gun dip but no camera FOV punch — cheap way to make the lunge read as a committed AAA move
- **[#221 aaa-visual]** `main.js:16851-16852` — Muzzle flash light is modest (intensity ~3-4) — a brighter, slightly longer flash reads far more AAA
- **[#222 aaa-visual]** `main.js:32096-32113` — Objective ticker HUD is a flat box — cheap polish opportunity
- **[#223 aaa-feel]** `main.js:42826-42827` — Global screen-shake (PP.shakeX/Y) is applied to camera only as a tiny POSITIONAL offset (x0.012 / x0.008) and never as rotation — explosions/hits barely move the view

## Findings per owner file

| Owner file | Findings |
|------------|----------|
| `src/main.js` | 174 |
| `src/levelSequences.js` | 11 |
| `src/rendering.js` | 7 |
| `src/campaignStoryExperience.js` | 6 |
| `src/customMaps/customMapCompiler.js` | 3 |
| `src/encounterBehavior.js` | 3 |
| `src/campaign/nativeEncounterTactics.js` | 3 |
| `src/animation/locomotionFeelController.js` | 2 |
| `src/game/combatFeedback.js` | 2 |
| `src/customMaps/levelEditor.js` | 2 |
| `src/cover-graph.js` | 2 |
| `src/encounterDirector.js` | 2 |
| `src/playerAnimation.js` | 2 |
| `src/aaaPresence.js` | 2 |
| `src/companion/client.js` | 1 |
| `src/customMaps/schema.js` | 1 |
| `src/visualProfiles.js` | 1 |
| `src/environmentMaps.js` | 1 |
| `src/duelArena.js` | 1 |
| `src/audio.js` | 1 |
| `src/postGodRayPass.js` | 1 |
| `src/animation/profiles.js` | 1 |
| `src/data/weapons.js` | 1 |
| `src/companion/protocol.js` | 1 |
| `src/encounterPatrolRoutes.js` | 1 |
| `src/game/hologramVisuals.js` | 1 |
| `src/animation/importedClipController.js` | 1 |
| `src/weaponViewmodelLoader.js` | 1 |
