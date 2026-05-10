# Gameplay — Improvement Plan

A critical pass on the gameplay systems, written like a designer doing a
post-alpha review: what's actually working, what's noise, what to fix.

This document is **scoped for a single autonomous coding pass**. Section 0
(Implementation Manifest) gives the agent a flat map of every symbol the
plan touches with current line numbers in `src/main.js`. Sections 5–9
each end in a **Code targets** block telling the agent exactly what to
change. Section 15 (Execution Order) gives a deterministic sequence,
Section 16 (Acceptance) gives the validation gates, and Section 17 the
self-check before reporting done.

The game has more systems than depth right now: 8 weapons, ~17 perks
across 2 tiers, 4 operators, 16 attachments, 12+ enemy types, focus mode,
combo chain, take-downs, lieutenants, bosses, daily challenges,
achievement list, endless mode, and skill tree. Most of
these need *less*, not *more*. The plan below trims, sharpens, and pushes
effort into the moment-to-moment shooting loop where it matters.

---

## 0. Implementation Manifest

The repo:

- Working dir: `/Users/tobiasmastek/Desktop/firstpgame`
- Single 17 190-line gameplay file: `src/main.js`
- Level / sequence data: `src/levelSequences.js`
- Shell HUD markup: `index.html`
- Build: `npm run build` (Vite). Dev: `npm run dev` (port 5173).
- Smoke / playtest harness: `scripts/gameplay-test.mjs` (Playwright,
  takes screenshots into `./screenshots`, requires `npm run dev` on
  127.0.0.1:5173 in another shell).

### 0.1 Symbol map (all line numbers `src/main.js` unless noted)

| Symbol / system            | Lines        | Notes                                                                                     |
|----------------------------|--------------|-------------------------------------------------------------------------------------------|
| `WEAPONS` array            | 6995–7002    | M4A1, USP-T, THROWING KNIFE, TAC-12, MP9, MK14 DMR, P226, AWM. Fields: spread, recoilX/Z, shX/Y, dmg, hsDmg, fireRate, reloadTime, res, wallbang, suppressed. |
| `ATTACHMENT_DEFS`          | 7012–7037    | 4 slots × 4 tiers. Slots: scope, mag, muzzle, foregrip. Mods: spreadMul, adsSpreadMul, adsSpeedMul, recoilMul, magMul, reloadMul, dmgMul, suppressed flag. |
| `ATTACH_TIER_COL`          | 7038         | grey/green/blue/purple                                                                    |
| `PERK_DEFS` (tier 1)       | 14479–14495  | fastReload, biggerMag, hsBoost, wallbang, extraHp, fastSprint, dodgeRoll, silentSteps, focusCharge, execMaster, comboKeep, autoAmmo |
| `PERK_DEFS_T2`             | 12837–12844  | doubleJump, autoFocus, shellLoad, thrownBack, phantom, killer_inst — merged into PERK_DEFS via setTimeout at 12845 |
| `OPERATORS`                | 15830–15835  | echo, wraith, havoc, edge. Passives applied in `applyOperator()` 15837                    |
| Focus state on `P`         | 8955–9031    | P.focus, P.focusActive, P.timeScale. Activate threshold 20%. Drain ~0.42/s, refill ~0.18/s, time scale lerps to 0.30 |
| `killFeed(hs, opts)`       | 7339–7350    | DOM kill-feed entry (HEADSHOT/ELIM, distance, EXEC/WALLBANG)                              |
| `showHM(hs)`               | 7338         | Hitmark opacity + 'hs' class                                                              |
| Enemy state consts         | 3317         | PATROL=0, ALERT=1, CHASE=2, ATTACK=3, SEARCH=4, FLANK=5                                   |
| Enemy ctor stagger init    | 3344         | this.staggerTimer / this.staggerDur=0.1                                                   |
| Stagger applied on hit     | 4220 / 4224  | 0.22s on heavy, 0.14s on lower damage                                                     |
| `updateAI()`               | 4782–4871    | Shared state machine for every enemy type                                                 |
| `LIEU_BEHAVIOR`            | 12847–12854  | Lieutenant behavior table for buildings 2–7                                               |
| `wallbang` weapon flag     | 7000–7001    | MK14 + AWM                                                                                |
| `Penetrator` perk gate     | 8859         | `hasPerk('wallbang')`                                                                     |
| Smokes/flashes init        | 7069         | P.smokes=1, P.flashes=1; max 3 each at 7404, 7409                                         |
| `useHealPack()`            | 7387         | KeyH listener at 7294. Restores full HP, no commit window.                                |
| `tryMeleeOrExecution()`    | 7292         | KeyV. Combo / takedown / pistol-whip in one call.                                         |
| `tryTakedown()`            | 7307         | KeyE. Requires low-HP target ≤2m.                                                         |
| Combo state                | 14681–14705  | `P.combo = {count, timer, multiplier, peak}`. Timer 4s, mul cap 5.0. `comboKeep` perk gate at 14701. |
| `comboKill()`              | 14685–14705  | Increments combo, +0.15 focus if focusCharge perk                                         |
| `spawnByZone()`            | 5205–5281    | Front/Middle/Back zone distribution. Per-building enemy pools 5208–5227.                  |
| Zone Z split const         | 1521–1525    | `ZONE_Z_SPLIT`                                                                            |
| Boss base stats            | 3329         | hp:850, spd:3.4+diff*.3, dmg:18+diff*3                                                    |
| Boss phase intros          | 9415–9452    | bossPhase1Intro, bossPhase2Trans, bossPhase3Trans (camera/orbit only, not behavior).      |
| Ammo drop chance           | 6965 / 8821  | `Math.random()<.30`. autoAmmo perk forces 1.00 at 8821.                                   |
| Per-building enemy pools   | 5215–5227    | Drones from b≥5, riots from b≥6, marksman from b≥7, double-density at b=8.               |
| `SFX_VARIANTS`             | 10149        | Gun / explosion / impact catalogues                                                       |
| Per-weapon SFX recipes     | 5377–5390    | M4 dry crack, USP-T thwip, etc                                                            |
| Ambient event cadence      | 13446        | 4–12s per building                                                                        |
| Subway audio profile       | 13545        | Building 6                                                                                |
| `_grenadeFleeUntil`        | 4721 / 13893 | Set ~1.8s when grenade lands; checked in updateAI                                         |
| Skill-tree purchase        | 14497–14504  | `buyPerk(id)` deducts `PROGRESS.perkPoints`. UI refresh 15170, buy click 15191.           |
| Perk-point earn            | 14611        | `PROGRESS.perkPoints += 1` on level up                                                    |
| `triggerKillCamSlowMo()`   | 8972         | Sets `_killCamScale` and `_killCamDur`                                                    |
| Boss kill slowmo           | 8829         | scale 0.20, dur 2.5s                                                                      |
| Last-of-zone slowmo        | 8828         | scale 0.40, dur 0.85s                                                                     |
| 10-combo slowmo            | 12910        | scale 0.55, dur 0.50s                                                                     |

### 0.2 Conventions for the agent

- **One file at a time.** Make all `src/main.js` edits before touching
  `index.html` or `levelSequences.js`. Keeps git diffs reviewable.
- **Preserve identifier naming.** Don't rename existing fields
  (`P.focus`, `staggerTimer`, etc.) — other code references them by
  string in places.
- **Don't reorder existing top-level objects.** Append new keys; insert
  new perks at the end of `PERK_DEFS` so existing indices stay stable.
- **Save format compatibility.** Adding fields to `PROGRESS` is fine.
  Removing fields requires a migration in the load path (search for
  `JSON.parse` near `localStorage`).
- **Phase-by-phase commits.** One commit per phase (A, B, C, D), not
  one per file. The commit message should reference the section number.
- **Don't add libraries.** Everything required (three.js + Vite) is
  already in `package.json`. No new SFX assets — Section 5.4 reassigns
  existing ones.
- **No new HUD elements unless this plan explicitly calls for one.**
  Section 16 fails the change if HUD gains more than one element.

---

## 1. First Principles

What this game wants to be:

- A **fast, lethal, room-by-room shooter** — Sifu's tempo with an AR.
- **Reads first, reflexes second** — every threat must be readable.
- **Decisions over inputs** — pressing a button matters because of *when*.
- **Replayable, not grindy** — mastery is built through reading rooms
  and managing meter, not through level-up curves.

What it is *not*:

- A loot shooter.
- A class-based hero shooter.
- A roguelite with build variance.
- A tactical milsim.

The systems below are evaluated against those four north stars. Anything
that doesn't sharpen them gets removed or paused.

---

## 2. What's Already Working (don't touch)

Naming what's good is half of triage:

- **Headshot lethality.** One-shot heads on most enemies anchors the skill
  ceiling. Don't water this down.
- **Vault traversal.** Vaulting low cover with momentum reads correctly
  and looks correct. Keep it as-is, just expose it more (Section 7.1).
- **Killcam orbit + slowmo on key kills.** Earned, not constant. Good
  feedback amplifier.
- **Per-building briefing + dossier.** The cinematic frame around the
  run is the game's tonal identity. Keep, don't dilute.
- **Take-down (E-key).** A real risk/reward verb that's rare-but-decisive.
- **Per-building enemy variants.** Drones in server farm, riots in
  subway: composition does communicate place identity.

---

## 3. The Real Problems

Diagnostic, in priority order. Each is concrete with code refs.

### 3.1 Combat-feel: bullets without weight

`spread`, `recoilX/Z`, and `shX/Y` (in `WEAPONS`, lines 6995–7002) give
the gun *stats* but the player doesn't *feel* a difference between
firing the M4 and the MP9 — both happen at similar effective tempo on
similar targets. The kill happens silently against fog and the visual
reload is the only "moment". The core loop is hit, hit, hit, dead.

What's missing:

- **Tactile hit confirmation** is binary (yes/no hitmark, see
  `showHM()` 7338). Different enemy types and damage tiers should read
  distinctly.
- **No flinch on enemies** — they keep firing through receiving hits.
  Stagger exists (3344, 4220) but doesn't visibly interrupt their
  shooting cadence. This removes the player's incentive to suppress.
- **No audible target ID** — everyone sounds the same. Nothing tells
  the player "marksman in the back" before the bullet arrives.

### 3.2 Focus mode is poorly paced

`P.focus` drains at ~0.42/s and refills at ~0.18/s (lines 9026, 9030) —
a 2.4s active window on a 5.5s refill, gated behind 20% to activate
(8955). In practice:

- Players *forget Focus exists* in mid-fight because the activation
  threshold is high and the duration is short.
- The mode's only effect is global slow-time. There's no resource
  decision — you press F when you need it; you don't *plan around* it.

A meter that doesn't drive decisions is HUD noise.

### 3.3 The perk sprawl

`PERK_DEFS` has 12 base perks (14479–14495) + `PERK_DEFS_T2` adds 6 more
(12837–12844). Looking at them critically:

- **Trivial perks** (fastReload −30% reload, fastSprint +15% sprint):
  not decisions, just stat tax. They get bought because they're cheap.
- **Build-defining perks** (wallbang, dodgeRoll i-frames): these are
  great. There are maybe 4 of them.
- **Vestigial perks** (comboKeep keep-on-damage, thrownBack, killer_inst
  highlight): symptoms of a system shipping more SKUs than ideas.

There is **no SKILL_SYNERGIES table** — synergies described in narrative
material aren't actually wired. Mentions of "Reaper" and similar are
flavor, not code.

### 3.4 Operators are forgettable

`OPERATORS` is 4 entries (15830–15835). Three of them are tiny stat
nudges (+25% suppressed, +1 grenade, +30% melee). Echo is "no passives".
This means:

- The pick screen doesn't shape playstyle.
- Switching operators doesn't change run feel.
- Most players will pick one once and ignore the screen forever.

Operators should be *playstyles*, not stat sliders.

### 3.5 Attachments are pick-once-and-forget

4 slots × 4 tiers gives 256 combos but the practical decision is "buy
the highest tier you can afford". Picking a Suppressor *does* matter
(silenced flag on `ATTACHMENT_DEFS.muzzle.*`). The other 12 attachments
are %-modifiers that don't read in play.

### 3.6 Wave pacing is metronomic

Per-zone wave logic in `spawnByZone()` (5205–5281) spawns enemies, player
kills them, door opens, repeat. Three zones (front/middle/back, split by
`ZONE_Z_SPLIT` 1521–1525), three claps. The middle zone is the worst
because:

- Spawns trickle in instead of arriving as a wave.
- No mid-zone twist (no reinforcements, no environmental shift).
- The clear feels like the front zone again, dragged out.

### 3.7 Enemy AI is uniform underneath

All enemies share the same state machine in `updateAI()` (4782–4871):
PATROL/ALERT/CHASE/ATTACK/SEARCH/FLANK. Type stats vary (hp, speed,
range) but *behavior shape* is identical. A heavy and a scout chase the
same way, just at different speeds. The player can't read intent from
movement.

### 3.8 Lethality is one-sided

Player headshots = instant kill. Enemy hits chip the player, but a
single *enemy* doesn't feel scary — the *number* of enemies does. Fixing
this: enemies need a "tell" attack that demands an answer (dodge,
takedown, kill-first) so each enemy is a small puzzle.

### 3.9 Boss/lieutenant fights are HP sponges

Lieutenants have unique behavior metadata (`LIEU_BEHAVIOR` 12847–12854)
but the runtime doesn't fully consume it. Bosses currently trade HP at
`hp:850` (3329) with three phase *cinematics* (bossPhase1Intro,
bossPhase2Trans, bossPhase3Trans @ 9415–9452) that are camera-only — no
behavior change behind them. After the locked door drama, the actual
fight is "shoot the guy until done."

### 3.10 Reload economy is too generous

Default ammo reserves are huge (`res:90` on M4 in `WEAPONS` 6995).
Combined with the 30% ammo drop (line 6965/8821) and the autoAmmo perk
which forces 100% (8821), the player rarely runs dry. This removes the
moment-to-moment weapon switching that should be the secondary skill.

---

## 4. Anti-Goals

What I will *not* propose, even when tempted:

- **No 9th weapon.** The roster covers the cases. Adding more dilutes
  identity.
- **No new operators.** Fix the 4 first.
- **No new perks.** Cut existing first.
- **No new enemy types.** The 12 are enough; behavior is the gap.
- **No more mode kinds.** No horde lite, no PvP, no co-op, no daily
  rotation overhaul.
- **No XP-curve rebalance.** Progression is fine; what runs feel like
  is the bug.
- **No "souls-style stamina" added on top.** Movement is fast and clean;
  don't punish it.
- **No skill check QTEs.** The game is real-time. Keep it real-time.
- **No new dependencies.** No new `npm` packages. No new GLB/audio
  asset files. Reassignment of existing assets is fine.

---

## 5. Tier 1 — Core Combat Feel

The highest-impact, smallest-risk work. Every hour spent here pays back
across every encounter in every level.

### 5.1 Weapon identity through differentiation

Each of the 8 weapons should answer one question better than the others.
Today they overlap. Re-tag them by *role*, then tune to fit:

| Weapon         | Role question answered           | Tuning lever                                  |
|----------------|----------------------------------|-----------------------------------------------|
| M4A1           | "I'm fine at everything"         | Baseline. Don't touch.                        |
| USP-T          | "I want a quiet starter"         | Already suppressed. Buff hsDmg from 65→80.    |
| Throwing Knife | "I want a one-shot stealth tool" | Increase recover-from-corpse rate to 100%.    |
| TAC-12         | "I'm in their face"              | Hard rolloff: dmg ×0.25 beyond 6m; pellets ×0.85. |
| MP9 Suppressed | "I want to mow without alerting" | Add **damage drop with distance**: dmg ×1.0 ≤15m, ×0.5 ≥25m, linear between. |
| MK14 DMR       | "Make distance my advantage"    | Boost wallbang meaningfulness (Section 5.6).  |
| P226 SUPP      | "Pistol I'd actually carry"      | adsTime ×0.85 vs USP, hsDmg −5.               |
| AWM Sniper     | "One pull, one kill"             | Add 0.4s breath-hold ADS sway window.         |

**No new SKUs.** The change is: each weapon must *fail* somewhere it
currently doesn't.

#### Code targets

- File: `src/main.js`
- `WEAPONS` array, lines 6995–7002. Add per-weapon optional fields:
  - `falloffNear` (m), `falloffFar` (m), `falloffMul` (multiplier at
    `falloffFar`). When unset, weapon is unaffected.
  - `recoverChance` (0–1) for throwing knife corpse recovery.
  - `breathHold` (seconds) for AWM ADS sway.
- Damage path: find the bullet-hit damage compute (search
  `dmg *` near the projectile/raycast hit handler — it lives in the
  same neighborhood as the wallbang gate at 8859). Apply the linear
  falloff multiplier there. Add a single helper `applyFalloff(weapon,
  distance, dmg)` rather than inlining at every call site.
- AWM breath-hold: when ADS-held continuously for `breathHold`s, set a
  flag `P.breathHeld = true`; while true, sway amplitude → 0; clear when
  ADS released.
- Throwing knife recover: find the existing recover logic (grep
  `THROWING KNIFE`) and set probability to 1.0 only if the weapon has
  `recoverChance:1`.

### 5.2 Hit feedback hierarchy

Right now hitmarkers are binary (`showHM()` 7338). Tier the response so
the player *hears the math* of each shot:

- **Body hit** — soft thump + small white hitmark.
- **Headshot** — sharp crack + red hitmark + 60ms gun-shake.
- **Armored body hit** — *spark* + dull hitmark + 0 damage announcement
  (existing armor system).
- **Wallbang kill** — distinct double-thud + extended killfeed tag.
- **Take-down kill** — meaty boneshatter + brief screen pulse.

#### Code targets

- Extend `showHM(hs)` 7338 to `showHM(kind)` where `kind` is one of
  `'body' | 'head' | 'armor' | 'wallbang' | 'takedown'`. Update all
  call sites; default `'body'`.
- Map `kind` to CSS class (`hm hm-body`, `hm-head`, `hm-armor`, …) on
  the existing hitmark element. Add the four new classes in
  `index.html` `<style>` block (find the existing `.hm.hs` rule).
- Extend `killFeed(hs, opts)` 7339–7350 to include `opts.wallbang` /
  `opts.takedown` flags rendering distinct tags (existing EXEC tag is
  template).
- SFX: route `kind` through `SFX_VARIANTS` (10149). Reuse existing
  stingers; tag five entries `hit_body`, `hit_head`, `hit_armor`,
  `hit_wallbang`, `hit_takedown`. Pick from the existing impact pool.
- Gun-shake on headshot: add a 60ms `_gunShakeTimer` on `P` and a
  read in the per-frame view-model offset.

### 5.3 Enemy flinch and stagger

Enemies need to react to being shot mid-action. Without flinch, the
player has no reason to suppress.

#### Code targets

- Per-type stagger table near `LIEU_BEHAVIOR` (12847). Add a const
  `ENEMY_FLINCH = { soldier:0.20, scout:0.18, heavy:0.05, sniper:0.30,
  riot:0.08, demolitions:0.20, drone:0.15, marksman:0.25, shielded:0.05,
  pistolero:0.20 }` (seconds). Heavies and shields shrug; snipers and
  marksmen flinch hardest.
- In the hit handler that currently sets `staggerTimer = 0.22` (line
  4220), look up the per-type value instead. Cap to once per second per
  enemy via `e._lastStaggerAt`.
- During stagger, force the enemy's fire-control gate off — find the
  `if(this.state===ATTACK)` shoot branch in `updateAI()` and add an
  `&& this.staggerTimer<=0` guard.
- Visible "recoil hop": add a 0.18s `_flinchAnimTimer` and apply a
  small additive Y-rotation (~10° lean back) on the enemy's torso bone
  (the bone lookup pattern exists in the takedown code).

### 5.4 Audio target ID

Enemy types need distinct firing signatures so the player can localize:

- **Soldier**: AR burst, tight tempo.
- **Heavy**: slow, heavy thump.
- **Scout**: rapid pistol/SMG.
- **Sniper/Marksman**: single sharp crack with a 0.5s gap, *audible
  reload click*.
- **Riot**: shotgun thunder with a slight reload pump.
- **Demolitions**: characteristic "throw" yell + distinct grenade sound.
- **Drone**: high-pitched whine.

Most weapon SFX exist; this is reassignment + a few stinger reuses.

#### Code targets

- `SFX_VARIANTS` (10149) already contains the per-weapon recipes
  (5377–5390). Add a parallel const `ENEMY_FIRE_SFX` keyed by enemy
  type name → a recipe id picked from the existing pool.
- Find the enemy fire call (search `bulletFromEnemy` or similar near
  the ATTACK branch in `updateAI()`). Replace the generic SFX call with
  `playEnemyFireSFX(enemy.type, enemy.position)`.
- Drone whine is continuous — add a per-drone `whineSrc` started on
  spawn and stopped on death.

### 5.5 Melee as first-class verb

Melee (`KeyV` → `tryMeleeOrExecution()` 7292) and take-down (`KeyE` →
`tryTakedown()` 7307) currently feel like two separate buttons doing
similar things. Consolidate:

- **Tap V (≤180ms)** — quick melee. Knockback, no kill except on low HP.
- **Hold V (>180ms, fires at ~800ms)** — heavy melee. ~0.8s windup,
  kills on hit, breaks shields, is interruptible.
- **E** stays as the dedicated stealth take-down (existing logic).

#### Code targets

- Add `P._meleeHoldStart` set on KeyV down (find existing KeyV listener
  near 7292/7294).
- On KeyV up, branch: hold duration ≥ 0.18 → schedule heavy at +0.8s
  via `P._heavyMeleeAt`. Else fire existing quick path.
- Heavy windup: lock weapon ADS off, play swing animation on view model
  (reuse melee animation if present), set `P._heavyVulnerable=true`.
- Heavy hit applies `dmg ≥ 200` (one-shot any non-shielded), breaks
  riot shields by setting target's `shieldBroken=true`.

### 5.6 Wallbang made real

`wallbang` flag exists on DMR/Sniper (7000–7001) and the `wallbang`
perk gates it on ARs (8859). Today, wallbang feels random because the
player can't tell which surfaces are penetrable.

#### Code targets

- Material tag on cover meshes. Find the cover construction (search
  `breakable:true` near building-zone setup; mesh `userData` is the
  carrier). Add `userData.material = 'wood' | 'metal_thin' |
  'metal_thick' | 'concrete' | 'glass'`. Default existing breakables
  to `wood`.
- Penetration table: const `PEN_DMG_MUL = { wood:0.6, metal_thin:0.45,
  glass:0.85, metal_thick:0.0, concrete:0.0 }`.
- ADS reticle tell: when ADS-aim hits a mesh whose
  `userData.material` is in the table, set reticle CSS class to
  `reticle reticle-pen`. Find reticle in `index.html` and add a styled
  outline color (e.g. amber).
- Damage path: when a bullet ray pierces a `material`-tagged mesh,
  multiply post-pierce dmg by `PEN_DMG_MUL[material]`. Already
  partially in the wallbang branch at 8859.

---

## 6. Tier 2 — Decision Economy

Fix the meters and abilities so pressing buttons matters.

### 6.1 Focus rebalance

Current: 2.4s active, 5.5s refill, 20% activate threshold. New:

- **Activation cost: 25% meter chunk** (no minimum-to-activate threshold;
  if you have ≥25%, you can pop it).
- **Duration: 1.6s** at 0.50× time scale (was 0.40× for 2.4s).
- **Refill: kills give +20% per kill** (existing `focusCharge` perk
  becomes baseline at +15%, perk gives an extra +20% per kill on top).
- **Headshot in focus**: +50% credits, +0.4s extension. Rewards the
  combo-style play the game wants.

#### Code targets

- Lines 8955–9031 (`P.focus` lifecycle). Replace the 0.20 threshold
  with: on activate, if `P.focus < 0.25` → bail; else `P.focus -= 0.25`,
  set `P.focusActive=true`, `P._focusEndsAt = now + 1.6`.
- Drain mode: instead of continuous 0.42/s drain, drive the end via
  `_focusEndsAt`. Time scale lerps to 0.50 (was 0.30) while active.
- Refill: kills already call `comboKill()` (14685). In that function,
  add `P.focus = Math.min(1, P.focus + (hasPerk('focusCharge') ? 0.35 :
  0.20))` (the existing 0.15 line at 14697 becomes 0.20/0.35 split).
- Headshot in focus: in the headshot path (search
  `hs ? wpn.hsDmg`), if `P.focusActive`, add `+50% credit`, extend
  `_focusEndsAt += 0.4`.

### 6.2 Smoke and flash get committed roles

`P.smokes` / `P.flashes` (7069) read identically. Differentiate:

- **Smoke** — denial. Lasts 6s. Enemies inside lose LOS to player.
  Player can use it to retreat or revive. Single-button action.
- **Flash** — offensive opener. Bright, blinds enemies in a 90° cone
  for 1.8s. Player must commit to enter the room while it ticks.

#### Code targets

- Find smoke / flash throw handlers (grep `P.smokes`, `P.flashes`).
- Smoke: ensure enemy LOS check (the alertness raycast) treats smoke
  AABB as opaque while alive.
- Flash: on detonation, for each enemy in 90° cone of detonation→enemy
  vector and within 14m, set `e._blindUntil = now+1.8`. AI gate:
  while blinded, accuracy floor (multiply spread × 4), no headshot.
- HUD: in `index.html`, change smoke/flash icons to distinct glyphs
  (smoke = circle, flash = star) and tooltip strings. **Exactly one
  HUD addition allowed by Section 16; this counts as zero because it
  reuses the existing two slots.**

### 6.3 Ammo scarcity (a small tightening)

Cut starting reserves by ~30%, raise drop chance to 50%. Net = same
median ammo, but the player feels the tap-out and switches weapons
*because they have to*.

#### Code targets

- `WEAPONS` 6995–7002: multiply each `res` by 0.7 (round to nearest
  whole number). E.g. M4 res 90 → 63.
- Ammo drop chance: lines 6965 / 8821 — change `0.30` → `0.50`.
- `autoAmmo` perk (line 14494) currently sets to 1.0; **deprecate** —
  see Section 8.1 (this perk is cut).

### 6.4 Heal pack as a real decision

`useHealPack()` 7387 currently restores HP instantly. Add:

- **1.4s commit** to heal — player roots, weapon lowers.
- **Cancellable** by taking damage (heal partially refunded, health
  doesn't apply).
- **Visible animation** so other systems can react.

#### Code targets

- Replace instant HP add at 7388 with: set `P._healingUntil = now+1.4`,
  store `P._healPendingHP = hp_to_restore`.
- Per-frame: if `P._healingUntil` set and `now >= _healingUntil`, apply
  the pending HP, lower `P.healPacks` by 1, clear flags.
- Damage handler: if `P._healingUntil` is set, refund 1 healPack (don't
  spend), clear `_healingUntil`, no HP applied.
- Movement: while healing, `P.maxSpeed *= 0.5`, weapon ADS forced off,
  `P._weaponLowered=true`.

---

## 7. Tier 3 — Enemy AI Personality

Make enemy *types* read through behavior, not just stats.

### 7.1 Per-type behavior trees

Instead of one shared `updateAI()` (4782–4871) with stat overrides, give
each type its own movement preferences. Implement as a dispatch table,
not a class hierarchy — keep the existing state constants.

- **Soldier** — current baseline. Cover, peek, fire, reposition.
- **Scout** — actively flanks. If LOS broken for 2s, sprints to a side
  cover. Closes for shotgun.
- **Heavy** — anchors. Doesn't take cover; walks straight, fires from
  hip. Has a 0.6s "wind-up" stagger window the player can exploit.
- **Sniper** — repositions when player closes 6m or marker is fired.
  Has visible laser tracer 0.4s before shot (the *tell*).
- **Shielded** — only takes damage from sides/back. Charges player if
  approached frontally. Telegraphs the charge.
- **Pistolero** — twitchy, dodges sideways when shot at, no cover.
  Burst-fires from movement.
- **Riot** — slow shield advance, fires from behind shield. Drops shield
  after taking N hits to it.
- **Demolitions** — throws grenade with visible 1.5s cooked tell. Avoids
  close range.
- **Drone** — circles player, can't enter narrow rooms.
- **Marksman** — DMR variant of sniper, faster cadence, more mobile.
- **Lieutenant** — already has unique table (12847); wire it.
- **Boss** — see Section 9.

#### Code targets

- Refactor `updateAI()` into:
  ```
  function updateAI(e, dt) { /* shared sense + state churn */
    BEHAVIOR[e.type] ? BEHAVIOR[e.type](e, dt) : BEHAVIOR.soldier(e, dt);
  }
  ```
- New table `BEHAVIOR` keyed by `e.type` returning per-type movement
  and fire-control logic. Each entry is ≤80 lines and shares helpers
  (`moveToCover`, `peekFire`, `flankTo`, `chargeAt`).
- Wire `LIEU_BEHAVIOR` (12847) by adding a `lieutenant` BEHAVIOR entry
  that reads `e._lieuRow` (set on lieutenant spawn) and dispatches.

### 7.2 Telegraphed attacks

Every dangerous enemy gets a 0.3–0.7s pre-attack tell:

- Sniper laser dot.
- Heavy hip-fire wind-up shoulder check.
- Riot shield slam stomp.
- Shielded charge yell.
- Demolitions grenade arm-swing.
- Boss phase-2 audio ramp.

#### Code targets

- Per type, add a `telegraph(e, kind, durationS)` helper that:
  - Spawns a transient mesh on `e` (laser line for sniper, ground
    decal for charge, etc).
  - Plays a one-shot SFX from `SFX_VARIANTS`.
  - Sets `e._fireGateAt = now + durationS` so the actual shoot is
    delayed by the telegraph window.
- Sniper laser: `THREE.Line` from muzzle to predicted player point,
  red emissive. Auto-removed when fire fires or telegraph cancels.

### 7.3 Group cohesion

Enemies should know about each other:

- A soldier in cover near a riot uses the riot's shield as cover.
- A demolitions fleeing the player's grenade pulls allies with him
  (already partial via `_grenadeFleeUntil` 4721/13893).
- When a team is reduced to 1 left, that survivor flanks aggressively
  (panic state).

#### Code targets

- Per-zone "team brain": at zone activation, build `zone.team = {alive,
  members[]}`. On enemy death, decrement; if `alive===1`, set
  `survivor._panic=true` (BEHAVIOR table treats `_panic` as forced FLANK
  with +20% speed).
- Cover cohesion: when a soldier picks cover, score covers behind a
  living riot's shield 1.5× higher.

---

## 8. Tier 4 — Progression Coherence

Cut the slop, sharpen the core.

### 8.1 Perk audit (cut to 8 from 18)

Keep only perks that change *how you play*, not *what your stats are*.

**Keep (8):**
- `wallbang` (Penetrator)
- `dodgeRoll` (Combat Roll, i-frames)
- `silentSteps` (Silent Step)
- `doubleJump` (Air Dancer, T2)
- `phantom` (Phantom Step, T2)
- `killer_inst` (Killer Instinct, T2)
- `focusCharge` (Adrenal — now: extra +20% per kill on top of baseline)
- `execMaster` (Executioner)

**Cut (10):**
- `fastReload` — bake reload speed into base.
- `biggerMag` — fold into Tier 4 attachment.
- `hsBoost` — already strong; redundant.
- `extraHp` — fold into `phantom` synergy.
- `fastSprint` — apply +5% sprint to base for everyone.
- `comboKeep` — combo system rework (Section 9.4) decides this.
- `autoAmmo` — collides with scarcity push (Section 6.3).
- `autoFocus` (T2) — bake into base via Section 6.1.
- `shellLoad` (T2) — make this base shotgun behavior.
- `thrownBack` (T2) — too niche.

#### Code targets

- Remove the 10 cut entries from `PERK_DEFS` (14479–14495) and
  `PERK_DEFS_T2` (12837–12844). Order matters: keep the kept entries
  contiguous.
- Search for each cut perk id (e.g. `hasPerk('fastReload')`) and either
  remove the conditional or bake the effect into the base path. List:
  - `fastReload` → bake reload `* 0.85` into base.
  - `biggerMag` → remove gate, attach effect to a (future) tier-4
    `mag` attachment slot. For this pass, just delete.
  - `hsBoost` → delete the gate. Headshot multiplier stays at base.
  - `extraHp` → delete; the hp boost is folded into `phantom` adding
    +25 max HP.
  - `fastSprint` → delete; `P.sprintMul *= 1.05` applied unconditionally
    at sprint init.
  - `comboKeep` → delete (Section 9.4 makes drop-on-damage canonical).
  - `autoAmmo` → delete (Section 6.3 sets baseline 50%).
  - `autoFocus` → delete (Section 6.1 already baked).
  - `shellLoad` → delete; shotgun reload becomes `shellByShell` always.
  - `thrownBack` → delete entirely.
- **Save migration**: in the `PROGRESS` load path (search
  `localStorage.getItem('progress')` or similar), filter
  `PROGRESS.ownedPerks` to only ids that still exist; refund
  `PROGRESS.perkPoints` for each removed perk's `cost`.

### 8.2 Operator overhaul

Make operators distinct *playstyles*, not stat nudges.

- **Echo** — Adaptive. Default. No starting perks but earns a perk pick
  every 2 buildings cleared.
- **Wraith** — Stealth. Starts with `silentSteps`. Suppressed kills
  give +50% credits. Can't sprint while ADS.
- **Havoc** — Demolitions. Starts with +2 grenade, +1 smoke. All
  explosive damage +30%. Takes +20% damage from melee.
- **Edge** — Brawler. Starts with `dodgeRoll`. Melee kills heal +15
  HP. ADS time +10% (slower aim). Pulls you toward fists.

#### Code targets

- Replace the 4 entries in `OPERATORS` (15830–15835) with new
  passives objects: `{ id, name, startPerks:[], passives:{...} }`.
- Rewrite `applyOperator(op)` (15837) to read from `passives`:
  - `passives.suppressedCreditMul` → applied in credit grant
  - `passives.explosiveDmgMul` → applied in grenade damage path
  - `passives.meleeKillHeal` → applied in melee kill path
  - `passives.adsTimeMul`, `passives.cantSprintAds`,
    `passives.meleeTakeMul`
  - `passives.echoFreePerkEvery: 2` (buildings) → check at
    building-clear hook
- Test: pick each operator in succession; confirm starting state
  (perks unlocked, ammo) differs.

### 8.3 Attachments — fewer, more identity

Currently 4 slots × 4 tiers in `ATTACHMENT_DEFS` (7012–7037). Reduce
to **3 slots × 3 options** with real tradeoffs:

- **Optic** — red dot, holo, scope.
- **Underbarrel** — grip, laser sight, foregrip-bipod.
- **Muzzle** — suppressor, compensator, brake.

#### Code targets

- Replace `ATTACHMENT_DEFS` (7012–7037) entirely. New shape:
  ```
  ATTACHMENT_DEFS = {
    optic:       { reddot:{...}, holo:{...}, scope:{...} },
    underbarrel: { grip:{...},   laser:{...}, bipod:{...} },
    muzzle:      { supp:{...},   comp:{...},  brake:{...} },
  }
  ```
- Slot: drop `tier` colour logic and `ATTACH_TIER_COL` (7038).
- Save migration: read old `wpnAttach` shape, drop tier index,
  default each slot to first option (e.g. reddot/grip/comp).
- UI: the attachment panel reads slot keys; rename references to
  `scope`/`mag`/`muzzle`/`foregrip`. New keys:
  `optic`/`underbarrel`/`muzzle`. Run `npm run dev` and visually
  confirm the panel still renders.

### 8.4 Skill tree — paths over points

Today perks are bought ad-hoc with `PROGRESS.perkPoints` (14497–14504).
Convert to **three short paths** (5 nodes each).

- **Path A — Marksman**: hsBoost (re-introduced as path-only),
  wallbang, focus extension, breath-hold, phantom.
- **Path B — Phantom**: silentSteps, dodgeRoll, doubleJump, smoke
  duration, phantom.
- **Path C — Tactician**: grenade dmg, execMaster, focusCharge, flash
  extension, killer_inst.

Earn 5 nodes per path; pick a primary (full unlock) and dabble in a
secondary (top 2 nodes only).

#### Code targets

- New const `SKILL_PATHS = { marksman:[node1,…,node5],
  phantom:[…], tactician:[…] }`.
- `PROGRESS.pathPrimary` (string), `PROGRESS.pathSecondary` (string).
- `buyPerk(id)` (14497) becomes `unlockNode(pathId, idx)`:
  - if `pathId === pathPrimary` → all 5 nodes unlockable
  - if `pathId === pathSecondary` → only `idx ∈ [0,1]`
  - else → reject
- Existing `hasPerk(id)` calls keep working: each node still maps to
  a perk id; `hasPerk` walks unlocked nodes.

---

## 9. Tier 5 — Run Loop Rhythm

The wave loop is the lowest-hanging fruit you'll feel every run.

### 9.1 Zone tempo contract

Re-tune `spawnByZone()` (5205–5281) so the three zones differ:

- **Front (Read)** — 2 paced encounters, max 3 enemies onscreen, gives
  the player time to settle. Scout patrol introduces stealth option.
- **Middle (Brawl)** — 1 dense fight, 5–8 enemies, mixed roles, one
  elite. Spawns are simultaneous (telegraphed via spawn-door glow).
- **Back (Boss)** — short approach corridor with 2–3 elite guards, then
  boss phase 1. After phase 1, 4 reinforcements spawn (telegraphed).
  Phase 2 ends fight.

Total fight time per building drops from ~6 minutes to ~3.5 minutes.

#### Code targets

- New const `ZONE_TEMPO = { front:{maxConcurrent:3, encounters:2,
  drip:true}, middle:{maxConcurrent:8, encounters:1, drip:false,
  spawnAllAtOnce:true, eliteCount:1}, back:{guards:3, reinforcements:4} }`.
- `spawnByZone()` reads tempo per zone instead of looping the same
  pattern. Middle-zone "spawn-door glow": find the spawn-door mesh
  setup, set `mat.emissive` to red 0.8s before the simultaneous wave.
- Trim per-building enemy *count*: scan 5215–5227 and reduce by ~30%
  (so net intensity matches new pacing).

### 9.2 Boss phases that mean something

Every boss gets *two* phases with distinct behavior, not just an HP
bar. Currently `bossPhase1Intro` / `bossPhase2Trans` /
`bossPhase3Trans` (9415–9452) are camera cinematics with no behavior
behind them.

- **Phase 1** — Boss is supported by guards. Player can't easily focus
  him. Killing 2 guards transitions to phase 2.
- **Phase 2** — Boss alone, signature move unlocks (e.g., Vasari draws
  a hand cannon, Roux activates VIP strobes, the Patriarch boots a
  drone swarm). Phase 2 is faster, deadlier, shorter.

#### Code targets

- Boss object: add `boss.phase = 1`, `boss.guardKills = 0`.
- New const `BOSS_SIGNATURES` keyed by building id (1–8):
  `{ buildingId: { sig:'handCannon'|'strobes'|'droneSwarm'|…, phase2Mods:{spd:×1.4, fireRate:×1.5, hpRefund:0} } }`.
- Drop `bossPhase3Trans` cinematic (we're going two-phase). Repurpose
  its camera as the kill-cam for the boss death.
- Phase transition: when 2 supporting guards die or boss HP < 0.5,
  advance to phase 2: apply mods, run `bossPhase2Trans` cinematic, then
  unlock the signature move.

### 9.3 The "kill-room" moment per building

Each building gets one scripted kill-room where the player feels like
an action protagonist:

- **Dock** — burst out of the manifest office into the container yard.
  6 enemies arranged for a clean sweep.
- **Continental** — mirror lounge breach, 5 enemies repositioning to
  the chandelier drop.
- **Nightclub** — strobe corridor, slowmo's natural home.
- **Penthouse** — glass shatter into the city, wind sweep, 4 elites.
- **Hospital** — operating theater entry, surgical light snaps to
  player.
- **Subway** — train passing, use it for cover.
- **Yacht** — engine room flame burst.
- **Server farm** — core vault as the lights cut row by row.

#### Code targets

- New file is **not** required — add to `src/levelSequences.js`.
  Append a `KILL_ROOMS` const keyed by building id with:
  `{ triggerZone:'middle', spawnPattern:[...local positions], cameraNudge:{from,to,duration}, audioCue:'string_id' }`.
- Hook: at zone-middle activation, if `KILL_ROOMS[buildingId]` exists,
  swap default spawn for the scripted pattern; trigger camera nudge
  for 0.6s; play audio cue.
- All eight cues use existing `SFX_VARIANTS` ids — none net new.

### 9.4 Combo chain matters

`P.combo` (14681–14705) exists but its effect is mostly UI. Make it
tactile:

- **2× chain** — kill credits +20%.
- **5× chain** — kill credits +40% + screen-shake on kill.
- **10× chain** — kill credits +75% + Focus pulse refunds 10% per kill.
- **Drop on damage** unconditional. (`comboKeep` perk is cut in
  Section 8.1.)

#### Code targets

- In `comboKill()` (14685–14705), compute multiplier from
  `count`: `if(count>=10) mul=1.75; else if(count>=5) mul=1.40; else
  if(count>=2) mul=1.20; else mul=1.0`.
- Apply `mul` to credit grant.
- Screen-shake: at count crossing 5 and 10, set
  `P._screenShakeUntil = now+0.18`.
- Focus refund: while `count >= 10`, after each kill add
  `P.focus = min(1, P.focus + 0.10)`.
- Damage handler: drop combo to 0 on player damage. Remove the
  `comboKeep` branch at 14701.

---

## 10. Engineering Notes — effort by tier

- Tier 1: hit feedback, flinch, audio ID, wallbang readability,
  weapon falloff. ~2 days.
- Tier 2: focus rebalance, smoke/flash split, ammo tightening, heal
  commit. ~1.5 days.
- Tier 3: per-type behavior dispatch, telegraphs, group cohesion.
  ~3.5 days. Largest single chunk.
- Tier 4: perk cut, operator overhaul, attachment reduction, skill
  paths. ~2.5 days.
- Tier 5: zone tempo, boss phases, kill-room scripts, combo wiring.
  ~3 days.

End to end: ~12.5 engineering days, ordered by impact. Tier 1 alone
already makes every fight feel different.

---

## 11. Phasing — Ship in Slices

### Phase A — Feel (3–4 days)

Tier 1 (5.1, 5.2, 5.3, 5.4, 5.5, 5.6) + Focus rebalance (6.1) + Combo
wiring (9.4). After Phase A, the same maps with the same enemies will
play substantially better.

### Phase B — Depth (4–5 days)

Tier 3 in full (per-type behavior, telegraphs, group cohesion). This is
the chunky one but it's also the most game-defining.

### Phase C — Coherence (3 days)

Tier 4 (perk cut, operator overhaul, attachment reduction, skill paths)
+ Tier 2 leftovers (smoke/flash, ammo, heal). Lots of UI churn.

### Phase D — Spectacle (3 days)

Tier 5 minus 9.4 (zone tempo, boss phases, kill-rooms). Best after
maps verticality work so kill-rooms can leverage it.

Cross-cut: every phase ships with a quick playtest + revert switch.
None of these changes should require breaking saved progress (Section
8.1 includes the migration).

---

## 12. Validation

A change passes if:

- A 30-second clip *sounds different* before vs. after (Phase A).
- A fresh playtester can describe each enemy type's behavior after one
  run (Phase B).
- The player picks a different operator on consecutive runs (Phase C).
- The boss fight is described as "the boss did X" not "the boss had
  too much HP" (Phase D).

A change fails if:

- TTK on average enemies changes by more than 15% in either direction.
- A core verb (shoot, vault, melee, dodge) loses readability.
- The HUD gains more than one element.
- `npm run build` fails or the smoke harness
  (`scripts/gameplay-test.mjs`) errors.

---

## 13. Open Questions

These need calls before each phase ships:

- **Difficulty curve** — should easy/normal/hard apply to enemy AI
  aggression (decision frequency) instead of stat scaling? Instinct: yes.
- **Persistence vs. ephemerality** — should focus, perks, attachments
  persist across deaths inside a run? Today they do.
- **Save vs. checkpoint** — building-by-building checkpoint is safe but
  blunts tension. Consider a single mid-building checkpoint at boss
  approach instead.
- **Slowmo vs. focus** — kill-cam already does slowmo. Should focus use
  a distinct visual treatment (chromatic aberration vs. desaturation)?
- **Score grade rubric** — is the current S/A/B grading rewarding
  *aggression* or *survival*? If both, players don't know which game to
  play.

For an autonomous pass: **defer all open questions**. Implement the
explicit changes; flag the open question in the commit body so the
human can resolve.

---

## 14. Anti-Anti-Goals

A few things I *am* willing to add if Phase A through D land cleanly,
and only then:

- One hero weapon as a late-game unlock (mid-run pickup, not menu).
- One new boss-only enemy type (final fight).
- One traversal verb if vertical levels demand it (e.g., wall-jump).

These are *rewards for finishing the rest*, not pre-approvals.

---

## 15. Execution Order (for the autonomous pass)

This is the deterministic sequence. Stick to it; don't skip ahead.

1. **Read sweep.** Open `src/main.js` and read each line range listed
   in Section 0.1 to confirm the line numbers still match. If any have
   drifted, update Section 0.1 in the working copy of this doc as you
   go (do not commit the doc changes until the end).

2. **Phase A — Feel.** In one branch / one commit:
   1. 6.1 Focus rebalance (smallest blast radius; verify build).
   2. 9.4 Combo wiring (depends on `comboKill()` stable).
   3. 5.2 Hit feedback hierarchy (extends `showHM` and `killFeed`).
   4. 5.3 Enemy flinch (extends stagger; verify TTK ±15%).
   5. 5.4 Audio target ID (reassignment only).
   6. 5.6 Wallbang readability (material tags + reticle).
   7. 5.5 Melee tap/hold (touch carefully; KeyV listeners).
   8. 5.1 Weapon falloff + role tuning (last, easiest to undo).
   9. Run `npm run build`. Run `scripts/gameplay-test.mjs` against
      `npm run dev`. Confirm 0 console errors. Commit.

3. **Phase B — Depth.** New commit:
   1. 7.1 Refactor `updateAI()` into `BEHAVIOR` dispatch. Keep all
      existing types routing to a `BEHAVIOR.soldier` function first
      (no behavior change). Verify.
   2. Add type-specific BEHAVIOR functions one at a time, build &
      smoke after each (scout, heavy, sniper, riot, demolitions,
      drone, marksman, shielded, pistolero, lieutenant).
   3. 7.2 Telegraph helpers + per-type tells.
   4. 7.3 Team brain.
   5. Build, smoke, commit.

4. **Phase C — Coherence.** New commit:
   1. 6.2 Smoke/flash split (HUD icons in `index.html`).
   2. 6.3 Ammo scarcity (constants in WEAPONS).
   3. 6.4 Heal commit window.
   4. 8.1 Perk audit (delete cuts; save migration; rebalance keeps).
   5. 8.2 Operator overhaul (rewrite `applyOperator()`).
   6. 8.3 Attachment reduction (replace `ATTACHMENT_DEFS`; UI rename).
   7. 8.4 Skill paths (`SKILL_PATHS`, `unlockNode()`).
   8. Build, smoke, commit.

5. **Phase D — Spectacle.** New commit:
   1. 9.1 Zone tempo contract (`ZONE_TEMPO`).
   2. 9.2 Boss phases (`BOSS_SIGNATURES`).
   3. 9.3 Kill-rooms (`KILL_ROOMS` in `levelSequences.js`).
   4. Build, smoke, commit.

6. **Final pass.** Run the smoke harness through the first three
   buildings end-to-end. Confirm: no console errors, TTK within ±15%
   on a soldier (record number in commit body), HUD has gained ≤1
   element.

If any step's build or smoke fails, **stop and report the error**
verbatim. Do not patch around with disabled checks or removed asserts.

---

## 16. Acceptance Gates (per phase)

Each phase must satisfy *all* of:

- `npm run build` exits 0 with no warnings beyond the pre-existing
  Vite asset-size warning.
- `node scripts/gameplay-test.mjs` (with `npm run dev` running)
  produces screenshots without console errors. (Errors are accumulated
  in the script and printed; tail must read `errors: 0`.)
- A grep for any cut perk id (`fastReload`, `biggerMag`, `hsBoost`,
  `extraHp`, `fastSprint`, `comboKeep`, `autoAmmo`, `autoFocus`,
  `shellLoad`, `thrownBack`) returns zero matches in `src/main.js`
  after Phase C. (String-key references too — these were the bug
  surface in [chat-kind validators drift](memory).)
- `git diff --stat` for the phase commit shows changes scoped to the
  expected files (Phase A: `src/main.js`, `index.html`. Phase B:
  `src/main.js` only. Phase C: `src/main.js`, `index.html`. Phase D:
  `src/main.js`, `src/levelSequences.js`).

---

## 17. Self-Check Before Reporting Done

The agent must verify each of these literally; do not paraphrase.

1. ☐ All 4 phase commits exist on the branch, in order A→B→C→D.
2. ☐ `npm run build` clean.
3. ☐ Playwright smoke completed without console errors.
4. ☐ `WEAPONS` array still has 8 entries.
5. ☐ `OPERATORS` still has 4 entries with new shape.
6. ☐ `PERK_DEFS` + `PERK_DEFS_T2` combined: 8 entries (down from 18).
7. ☐ `ATTACHMENT_DEFS` has exactly 3 slots, 3 options each.
8. ☐ `BEHAVIOR` table covers every enemy type referenced in
   `spawnByZone()`.
9. ☐ `SKILL_PATHS` has 3 paths × 5 nodes each.
10. ☐ `BOSS_SIGNATURES` has an entry for every building 1–8 that has a
    boss in `levelSequences.js`.
11. ☐ `KILL_ROOMS` has 8 entries.
12. ☐ Save migration runs without throwing on a save written before
    these changes (test by clearing localStorage halfway and reloading).
13. ☐ HUD added at most one new element across the whole pass.
14. ☐ No new files under `src/`. No new files under `public/`. No new
    `npm` dependencies.
15. ☐ A 30-second gameplay clip sounds different before vs. after.
    (Verify via the `scripts/gameplay-test.mjs` screenshot at minute
    0:30 — if visually a different fight is in progress, audio diff
    is implied. Note any caveats in the commit body.)

If any box can't be checked, report it explicitly and stop. Do not
silently downgrade the requirement.
