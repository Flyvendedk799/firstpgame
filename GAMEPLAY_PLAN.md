# Gameplay — Improvement Plan

A critical pass on the gameplay systems, written like a designer doing a
post-alpha review: what's actually working, what's noise, what to fix.

The game has more systems than depth right now: 8 weapons, ~17 perks
across 3 tiers, 4 operators, 16 attachments, 12+ enemy types, focus mode,
combo chain, take-downs, lieutenants, bosses, daily challenges, achievement
list, endless mode, skill tree, story-mode hooks. Most of these need *less*,
not *more*. The plan below trims, sharpens, and pushes effort into the
moment-to-moment shooting loop where it matters.

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

`spread`, `recoilX/Z`, and `shX/Y` give the gun *stats* but the player
doesn't *feel* a difference between firing the M4 and the MP9 — both
happen at similar effective tempo on similar targets. The kill happens
silently against fog and the visual reload is the only "moment". The
core loop is hit, hit, hit, dead.

What's missing:

- **Tactile hit confirmation** is binary (yes/no hitmark). Different
  enemy types and damage tiers should read distinctly.
- **No flinch on enemies** — they keep firing through receiving hits.
  This removes the player's incentive to suppress.
- **No audible target ID** — everyone sounds the same. Nothing tells
  the player "marksman in the back" before the bullet arrives.

### 3.2 Focus mode is poorly paced

`P.focus` drains at .42/s and refills at .18/s — a 2.4s active window on
a 5.5s refill, gated behind 20% to activate. In practice:

- Players *forget Focus exists* in mid-fight because the activation
  threshold is high and the duration is short.
- The mode's only effect is global slow-time. There's no resource
  decision — you press F when you need it; you don't *plan around* it.

A meter that doesn't drive decisions is HUD noise.

### 3.3 The perk sprawl

`PERK_DEFS` has 11 base perks + `PERK_DEFS_T2` adds 6 more. Looking at
them critically:

- **Trivial perks** (Quick Hands −30% reload, Light Feet +15% sprint):
  not decisions, just stat tax. They get bought because they're cheap.
- **Build-defining perks** (Penetrator wallbang, Combat Roll i-frames):
  these are great. There are maybe 4 of them.
- **Vestigial perks** (Iron Will combo-keep, Throw Back, Killer Instinct
  highlight): symptoms of a system shipping more SKUs than ideas.

Synergies (`SKILL_SYNERGIES`) are listed in text but rarely *surface
mechanically*. "Reaper" reads cool but the actual effect is the same as
the two parent perks.

### 3.4 Operators are forgettable

`OPERATORS` is 4 entries. Three of them are tiny stat nudges (+25%
suppressed, +1 grenade, +30% melee). Echo is "no passives". This means:

- The pick screen doesn't shape playstyle.
- Switching operators doesn't change run feel.
- Most players will pick one once and ignore the screen forever.

Operators should be *playstyles*, not stat sliders.

### 3.5 Attachments are pick-once-and-forget

4 slots × 4 tiers gives 256 combos but the practical decision is "buy
the highest tier you can afford". Picking a Suppressor *does* matter
(silenced flag). The other 12 attachments are %-modifiers that don't
read in play.

### 3.6 Wave pacing is metronomic

Per-zone wave logic spawns enemies, player kills them, door opens,
repeat. Three zones, three claps. The middle zone is the worst because:

- Spawns trickle in instead of arriving as a wave.
- No mid-zone twist (no reinforcements, no environmental shift).
- The clear feels like the front zone again, dragged out.

### 3.7 Enemy AI is uniform underneath

All enemies share the same state machine (PATROL/ALERT/CHASE/ATTACK/
SEARCH/FLANK). Type stats vary (hp, speed, range) but *behavior shape*
is identical. A heavy and a scout chase the same way, just at different
speeds. The player can't read intent from movement.

### 3.8 Lethality is one-sided

Player headshots = instant kill. Enemy hits chip the player, but a
single *enemy* doesn't feel scary — the *number* of enemies does. Fixing
this: enemies need a "tell" attack that demands an answer (dodge,
takedown, kill-first) so each enemy is a small puzzle.

### 3.9 Boss/lieutenant fights are HP sponges

Lieutenants have unique behaviors (`LIEU_BEHAVIOR`) but bosses currently
trade HP at 850 with no phase signature beyond more aggression. After
the locked door drama, the actual fight is "shoot the guy until done."

### 3.10 Reload economy is too generous

Default ammo reserves are huge (`res:90` on M4). Combined with the 30%
ammo drop (or 100% with Scrounger), the player rarely runs dry. This
removes the moment-to-moment weapon switching that should be the
secondary skill.

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

---

## 5. Tier 1 — Core Combat Feel

The highest-impact, smallest-risk work. Every hour spent here pays back
across every encounter in every level.

### 5.1 Weapon identity through differentiation

Each of the 8 weapons should answer one question better than the others.
Today they overlap. Re-tag them by *role*, then tune to fit:

| Weapon         | Role question answered           | Tuning lever                      |
|----------------|----------------------------------|-----------------------------------|
| M4A1           | "I'm fine at everything"         | Baseline. Don't touch.            |
| USP-T          | "I want a quiet starter"         | Already suppressed. Buff hs dmg.  |
| Throwing Knife | "I want a one-shot stealth tool" | Increase recover-from-corpse rate |
| TAC-12         | "I'm in their face"              | Tighter pellet count, hard rolloff outside 6m |
| MP9 Suppressed | "I want to mow without alerting" | Add **damage drop with distance** so it's only mid-range |
| MK14 DMR       | "Make distance my advantage"     | Boost wallbang meaningfulness (Section 5.6) |
| P226 SUPP      | "Pistol I'd actually carry"      | Faster ADS than USP, slightly less hs        |
| AWM Sniper     | "One pull, one kill"             | Add 0.4s breath-hold ADS sway     |

**No new SKUs.** The change is: each weapon must *fail* somewhere it
currently doesn't. The MP9 should feel useless at 25m. The TAC-12
should feel useless at 12m. That creates loadout decisions.

### 5.2 Hit feedback hierarchy

Right now hitmarkers are binary. Tier the response so the player
*hears the math* of each shot:

- **Body hit** — soft thump + small white hitmark.
- **Headshot** — sharp crack + red hitmark + 60ms gun-shake.
- **Armored body hit** — *spark* + dull hitmark + 0 damage announcement
  (existing armor system).
- **Wallbang kill** — distinct double-thud + extended killfeed tag.
- **Take-down kill** — meaty boneshatter + brief screen pulse.

Implementation: extend `killFeed`'s `opts` and the existing hitmark code
to read enemy state. Sound assets are 5 short stingers — already inside
the existing palette.

### 5.3 Enemy flinch and stagger

Enemies need to react to being shot mid-action. Without flinch, the
player has no reason to suppress. Implement two states:

- **Stagger** (already partially in via `staggerTimer`/`staggerDur`):
  any non-headshot body hit interrupts shooting for ~0.2s. Cap to once
  per second per enemy so a held-trigger SMG doesn't permanently lock
  them.
- **Recoil hop** — visible animation: lean back ~10°, weapon dips, then
  re-aim. Currently enemies just *eat* shots and keep firing.

This single change reframes every fight: now suppressing fire matters,
SMGs become useful, and the marksman *who can't be staggered at long
range* feels distinct.

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

Most weapon SFX exist; this is reassignment + a few new stingers.

### 5.5 Melee as first-class verb

Melee (`KeyV`) and take-down (`KeyE`) currently feel like two separate
buttons doing similar things. Consolidate:

- **Tap V** — quick melee. Knockback, no kill except on low HP.
- **Hold V** — heavy melee. ~0.8s windup, kills on hit, breaks shields,
  is interruptible.
- **E** stays as the dedicated stealth take-down (existing logic).

Effect: melee becomes a *decision* (commit to heavy = vulnerable but
high reward). Right now V is a desperate spam.

### 5.6 Wallbang made real

`wallbang` flag exists on DMR/Sniper and the `Penetrator` perk gates it
on ARs. Today, wallbang feels random because the player can't tell
which surfaces are penetrable. Add:

- **Material tag** on cover meshes (wood, metal-thin, metal-thick,
  concrete, glass). Already implicit via `breakable`.
- **Visible tell**: when the player ADS toward penetrable cover, a
  subtle reticle outline color shift indicates "you can shoot through
  this."
- **Damage reduction curve** — penetrating cover halves damage. Strong
  rifles still pop, SMGs deal chip.

Now `Penetrator` is a build choice, not a free upgrade.

---

## 6. Tier 2 — Decision Economy

Fix the meters and abilities so pressing buttons matters.

### 6.1 Focus rebalance

Current: 2.4s active, 5.5s refill, 20% activate threshold. New:

- **Activation cost: 25% meter chunk** (no minimum-to-activate threshold;
  if you have ≥25%, you can pop it).
- **Duration: 1.6s** at 0.50× time scale (was 0.40× for 2.4s).
- **Refill: kills give +20% per kill** (existing `focusCharge` perk
  becomes baseline, perk becomes "+35% per kill").
- **Headshot in focus**: +50% credits, +0.4s extension. Rewards the
  combo-style play the game wants.

This turns Focus into a per-encounter resource. You pop it on the spike
moment, kill 2–3 in slowmo, and now *have* to score kills or lose it.

### 6.2 Smoke and flash get committed roles

`smokes`/`flashes` count today is 1/1 default. They're both "AOE
denial". Differentiate:

- **Smoke** — denial. Lasts 6s. Enemies inside lose LOS to player.
  Player can use it to retreat or revive. Single-button action.
- **Flash** — offensive opener. Bright, blinds enemies in a 90° cone
  for 1.8s. Player must commit to enter the room while it ticks.

Today they read the same. Tag them with discrete UX prompts (smoke =
defensive icon, flash = offensive icon).

### 6.3 Ammo scarcity (a small tightening)

Cut starting reserves by ~30%, raise drop chance to 50%. Net = same
median ammo, but the player feels the tap-out and switches weapons
*because they have to*. Right now the secondary is a cosmetic.

### 6.4 Heal pack as a real decision

`H` heals. There's no animation hold or vulnerability window. Add:

- **1.4s commit** to heal — player roots, weapon lowers.
- **Cancellable** by taking damage (heal partially refunded, health
  doesn't apply).
- **Visible animation** so other systems can react.

This turns the heal from "spam H" into a positioning question.

---

## 7. Tier 3 — Enemy AI Personality

Make enemy *types* read through behavior, not just stats.

### 7.1 Per-type behavior trees

Instead of one shared state machine with stat overrides, give each type
its own movement preferences:

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
- **Drone** — circles player, can't enter narrow rooms (gameplay-driven
  cover incentive).
- **Marksman** — DMR variant of sniper, faster cadence, more mobile.
- **Lieutenant** — already has unique table; expand each.
- **Boss** — see Section 9.

This is the largest engineering ask in the plan. It's also the change
that will most transform gameplay feel.

### 7.2 Telegraphed attacks

Every dangerous enemy gets a 0.3–0.7s pre-attack tell:

- Sniper laser dot.
- Heavy hip-fire wind-up shoulder check.
- Riot shield slam stomp.
- Shielded charge yell.
- Demolitions grenade arm-swing.
- Boss phase-2 audio ramp.

The player sees the tell, has time to react. This is the difference
between "frustrating" and "challenging."

### 7.3 Group cohesion

Enemies should know about each other:

- A soldier in cover near a riot uses the riot's shield as cover.
- A demolitions fleeing the player's grenade pulls allies with him
  (already partially in via `_grenadeFleeUntil`).
- When a team is reduced to 1 left, that survivor flanks aggressively
  (panic state).

Implementation: a per-zone "team brain" that emits orders the individual
state machines respect.

---

## 8. Tier 4 — Progression Coherence

Cut the slop, sharpen the core.

### 8.1 Perk audit (cut to 8 from 17)

Keep only perks that change *how you play*, not *what your stats are*:

**Keep:**
- Penetrator (wallbang) — build-defining.
- Combat Roll (dodge with i-frames) — verb add.
- Silent Step — stealth build.
- Air Dancer (double jump) — verb add.
- Phantom Step (sprint after dodge) — verb add.
- Killer Instinct (highlight weak point) — readability.
- Adrenal (kills restore focus) — meter loop.
- Executioner (take-down credits + heal) — playstyle reward.

**Cut:**
- Quick Hands (reload speed) — bake reload speed into base.
- Extended Mag (mag size) — bake into Tier 4 attachment.
- Headhunter (hs damage) — already strong; redundant.
- Bulletproof (+25 HP) — fold into Phantom synergy.
- Light Feet (sprint speed) — base speed bump everyone.
- Iron Will (combo on damage) — combo system needs review first.
- Scrounger (100% ammo) — collides with scarcity push.
- Auto-Focus (regen rate) — bake into base via Section 6.1.
- Shell-By-Shell (shotgun reload) — make this base shotgun behavior.
- Throw Back (knife/grenade return) — too niche.

Eight strong perks > seventeen forgettable ones.

### 8.2 Operator overhaul

Make operators distinct *playstyles*, not stat nudges. Suggestion:

- **Echo** — Adaptive. Default. No starting perks but earns a perk pick
  every 2 buildings cleared (currency for skill tree on the run).
- **Wraith** — Stealth. Starts with Silent Step. Suppressed kills give
  +50% credits. Can't sprint while ADS. Trade speed for quiet.
- **Havoc** — Demolitions. Starts with +2 grenade, +1 smoke. All
  explosive damage +30%. Trade-off: takes +20% damage from melee.
- **Edge** — Brawler. Starts with Combat Roll. Melee kills heal +15
  HP. ADS time +10% (slower aim). Pulls you toward fists.

Each pick now *changes the run*. Today none of them do.

### 8.3 Attachments — fewer, more identity

Currently 4 slots × 4 tiers, mostly invisible math. Reduce to:

- **Optic** — 3 options (red dot, holo, scope). Optics now carry
  real downsides at the wrong range (scope is bad in CQB).
- **Underbarrel** — 3 options (grip, laser sight, foregrip-bipod). Each
  changes one verb (grip = recoil, laser = hipfire, bipod = ADS standing
  still).
- **Muzzle** — 3 options (suppressor, compensator, brake). Real trade-
  offs (suppressor = quiet but range loss).

Three slots × three options = nine permutations per weapon. Each is
*felt*. Drop the % grind.

### 8.4 Skill tree — paths over points

Today perks are bought ad-hoc with `perkPoints`. Convert to **three short
paths** (5 nodes each) the player commits to per-character:

- **Path A — Marksman**: hs dmg, wallbang, focus extension, breath-hold,
  Phantom Step.
- **Path B — Phantom**: silent step, dodge, double-jump, smoke duration,
  Phantom Step.
- **Path C — Tactician**: grenade dmg, take-down credits, focus regen,
  flash extension, Executioner.

Earn 5 nodes per path; pick a primary (full unlock) and dabble in a
secondary (top 2 nodes only). Removes "buy everything" trap.

---

## 9. Tier 5 — Run Loop Rhythm

The wave loop is the lowest-hanging fruit you'll feel every run.

### 9.1 Zone tempo contract

The current "front/middle/back" runs at the same tempo. Re-tune:

- **Front (Read)** — 2 paced encounters, max 3 enemies onscreen, gives
  the player time to settle. Scout patrol introduces stealth option.
- **Middle (Brawl)** — 1 dense fight, 5–8 enemies, mixed roles, one
  elite. Spawns are simultaneous (telegraphed via spawn-door glow), not
  drip-fed.
- **Back (Boss)** — short approach corridor with 2–3 elite guards, then
  boss phase 1. After phase 1, 4 reinforcements spawn (telegraphed).
  Phase 2 ends fight.

Total fight time per building drops from ~6 minutes to ~3.5 minutes,
intensity goes up. Better than longer.

### 9.2 Boss phases that mean something

Every boss gets *two clean phases* with distinct behavior, not just an
HP bar:

- **Phase 1** — Boss is supported by guards. Player can't easily focus
  him. Killing 2 guards transitions to phase 2.
- **Phase 2** — Boss alone, signature move unlocks (e.g., Vasari draws
  a hand cannon, Roux activates VIP strobes, the Patriarch boots a
  drone swarm). Phase 2 is faster, deadlier, shorter.

The boss isn't a tankier soldier — he's a *fight*.

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

Already half-described in the maps plan; the gameplay side of it is
*scripted spawn pattern + camera nudge + audio cue*, not new code per
building.

### 9.4 Combo chain matters

`P.combo` exists but its effect is mostly UI. Make it tactile:

- **2× chain** — kill credits +20%.
- **5× chain** — kill credits +40% + screen-shake on kill.
- **10× chain** — kill credits +75% + Focus pulse refunds 10% per kill.
- **Drop on damage** unless Iron Will perk owned (and Iron Will is
  cheap, since dropping the chain is what makes it pressure).

The chain becomes the player's mid-fight scoreboard. Right now it's
flavor text.

---

## 10. Engineering Notes

Where the code work lives.

### Tier 1 changes — small, mostly tuning

- Hit feedback (5.2) — extend `killFeed.opts` and hitmark dispatch.
  ~0.5 day.
- Enemy flinch (5.3) — already has stagger; expose via per-type
  modifier table. ~0.5 day.
- Audio target ID (5.4) — assign existing SFX to per-type fire calls.
  ~0.5 day.
- Wallbang readability (5.6) — material tag on cover, ADS color hook.
  ~0.5 day.

### Tier 2 — meter rework

- Focus rebalance (6.1) — change drain/refill and threshold constants;
  add headshot extension hook. ~0.5 day.
- Smoke/flash split (6.2) — UX icons + tooltip. ~0.25 day.
- Heal pack commit window (6.4) — animation + cancel logic. ~0.5 day.

### Tier 3 — AI personality

- Per-type behavior trees (7.1) — biggest item. Restructure existing
  state machine into a "behavior selector" that varies by type. ~3 days.
- Telegraphed attacks (7.2) — tell visuals + delay timing. ~1 day.
- Group cohesion (7.3) — zone-team brain. ~1 day.

### Tier 4 — progression cleanup

- Perk audit (8.1) — delete code paths, rebalance kept perks. ~0.5 day.
- Operator overhaul (8.2) — ~0.5 day.
- Attachment reduction (8.3) — ~1 day (UI updates).
- Skill tree paths (8.4) — ~1 day.

### Tier 5 — wave loop

- Zone tempo contract (9.1) — wave spawner re-tune. ~1 day.
- Boss phases (9.2) — per-boss phase data + transitions. ~1.5 days.
- Kill-room moments (9.3) — per-building scripted spawn cue. ~1 day.
- Combo chain effects (9.4) — wire combo into focus and credits. ~0.5
  day.

End to end: ~13–15 engineering days, ordered by impact. Tier 1 alone
(~2 days) will already make every fight feel different.

---

## 11. Phasing — Ship in Slices

### Phase A — Feel (3–4 days)

Tier 1 (5.2, 5.3, 5.4, 5.6) + Focus rebalance (6.1) + Combo wiring (9.4).
After Phase A, the same maps with the same enemies will play
substantially better.

### Phase B — Depth (4–5 days)

Tier 3 in full (per-type behavior, telegraphs, group cohesion). This is
the chunky one but it's also the most game-defining.

### Phase C — Coherence (3 days)

Tier 4 (perk cut, operator overhaul, attachment reduction, skill paths).
Lots of UI churn but the player encounters this every menu.

### Phase D — Spectacle (3 days)

Tier 5 (zone tempo, boss phases, kill-rooms). Best done after maps
plan's verticality work so kill-rooms can actually leverage it.

Cross-cut: every phase ships with a quick playtest + revert switch.
None of these changes should require breaking saved progress.

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

---

## 13. Open Questions

These need calls before each phase ships:

- **Difficulty curve** — should easy/normal/hard apply to enemy AI
  aggression (decision frequency) instead of stat scaling? My instinct
  is yes; lower difficulty = enemies hesitate more, miss more.
- **Persistence vs. ephemerality** — should focus, perks, attachments
  persist across deaths inside a run? Today they do. Roguelite players
  expect run-resets; story-mode players expect persistence. Pick one,
  commit.
- **Save vs. checkpoint** — building-by-building checkpoint is safe but
  blunts tension. Consider a single mid-building checkpoint at boss
  approach instead.
- **Slowmo vs. focus** — kill-cam already does slowmo. Should focus use
  a distinct visual treatment so they don't blur together?
- **Score grade rubric** — is the current S/A/B grading rewarding
  *aggression* or *survival*? If both, players don't know which game to
  play.

Resolve these via two-day playtests at the start of each phase, not by
committee.

---

## 14. Anti-Anti-Goals

A few things I *am* willing to add if Phase A through D land cleanly,
and only then:

- One hero weapon as a late-game unlock (mid-run pickup, not menu).
- One new boss-only enemy type (final fight). Specifically excluded
  from the regular roster.
- One traversal verb if vertical levels demand it (e.g., wall-jump,
  but only with strong design justification).

These are *rewards for finishing the rest*, not pre-approvals.
