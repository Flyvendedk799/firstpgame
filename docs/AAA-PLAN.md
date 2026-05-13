# Player experience: next-level plan

This document captures a **player-first** bar (“what a gamer notices”) and a practical order of work. It is not about DCC tools or file formats; it is about **what to achieve** and **in what sequence** so the game reads as intentional, physical, and shippable.

---

## What “next level” means for the player

Players stay engaged when:

- The world and characters **look and feel believable**, not like placeholders.
- **Motion matches action**—walking, aiming, reloading, and getting hit flow instead of snapping or sliding.
- **Guns feel like objects** in your hands: firing, recoil, and reload tell a clear story.
- **Enemies feel like opponents**—readable intent, satisfying reactions, clear outcomes.
- The game **stays smooth** when fights get busy.
- **Feedback is obvious**: hits, misses, ammo, danger—without studying the UI.
- **Audio and polish** support the same fantasy; small bugs do not pile up into “cheap.”

---

## Workstreams (what you need to do)

### 1. Visual believability

- Raise fidelity so silhouettes and gear read at a glance (authored or heavily upgraded models, not ambiguous blocks).
- Light the scene so materials make sense: highlights on metal, readable dark areas, muzzle flash briefly affecting nearby surfaces.
- Ground objects: shadows, contact with geometry, less floating and clipping through floors or walls.

### 2. Motion that feels human

- Animations match **speed and effort** (walk vs sprint vs strafe are distinct, not the same pose scaled).
- Smooth **transitions** for aim, reload, hit reactions, and stance—unless a stylized snap is a deliberate choice.
- Viewmodel and camera **move as one believable system**: sway when moving, settle when stopping, recoil that returns instead of random jitter.

### 3. Guns that feel physical

- **Cause and effect** on every shot: trigger → flash + sound + kick + optional tracer/shell → world/enemy reaction.
- **Reload reads as a short story** (mag out, mag in, rack if needed) and lines up with the reload window the player feels in gameplay.
- **Per-weapon identity**: cadence, kick, and sound differ—not only spreadsheet damage.

### 4. Enemies that feel like people fighting you

- **Readable behavior** before maximum danger: holding, pushing, flanking, suppressed—so players can read intent.
- **Hit reactions** that sell impact: flinch, stagger, surface-appropriate VFX (sparks, dust, blood) so shooting feels effective.
- **Death and downtime read clearly**: no awkward freeze or slide; the player knows the threat is over.

### 5. Performance under stress

- Steady experience on the **real target** (e.g. browser + typical hardware): busy fights do not become a slideshow.
- **Centralized governor**: frame-percentile stress/chill bands drive post downgrades (bloom → AO → Phase‑2 holds) and optional TAA accumulation easing before the ladder trips fully—see `src/perfGovernor.js` + `_tickPerfAdaptive`.
- **Detail where it matters**: simpler far away, rich up close—budget follows where the player looks.

### 6. Feedback that cannot be missed

- **Hits**: sound + visual (impact, flinch, optional numbers) so landed vs missed is never ambiguous.
- **Player state**: ammo, reload, low health, suppressed—glanceable HUD or diegetic cues (breathing, desaturation) without clutter.
- **Spatial audio**: gun tails, impacts, footsteps, barks—enough directionality to orient under stress.

### 7. Polish and coherence

- Basics: sensitivity, FOV, volume, accessibility where you can.
- **Remove friction**: wrong sounds, clipping viewmodels, broken prompts, inconsistent icons—players accumulate these as “cheap.”
- **One fantasy**: art, UI, and audio feel like **one game**, not stacked experiments.

---

## Recommended order of operations

Execute in roughly this order so players benefit early and expensive art does not sit on a shaky foundation.

| Phase | Focus | Why this order |
|-------|--------|----------------|
| **1** | Performance floor | If it stutters in a fight, nothing else reads as “premium.” |
| **2** | Hit feedback + core gun loop | Landed/missed, recoil return, fire cadence—combat must feel fair and juicy first. |
| **3** | Enemy reactions + AI readability | Hits need to matter; behavior needs to read before you invest in full character art. |
| **4** | Full art pass | Characters, weapons, environments, lighting—once combat sells, fidelity scales impact. |
| **5** | Audio pass | Gun tails, impacts, footsteps, space—half the fantasy after visuals are in range. |
| **6** | Polish pass | Menus, options, edge-case bugs, consistency—turns “strong core” into “I’d pay for this.” |

---

## Definition of done (quick checklist)

Use this as a retro or milestone gate.

- [ ] Busy combat holds a stable, acceptable frame rate on target hardware.
- [ ] Every shot has clear **audio + visual** feedback; misses feel like misses.
- [ ] Reload and fire cadence **match** what the player sees on the gun.
- [ ] Enemies show **intent** and **reaction** to being shot; deaths read clearly.
- [ ] Viewmodel does not distract with clipping, wrong scale, or motion that fights the camera.
- [ ] Lighting and materials support readability in dark and bright areas.
- [ ] A blind playtester could describe **what weapon they are using** from sound and kick alone.
- [ ] No recurring “cheap” bugs in a 30-minute session (clips, broken UI, silent hits).

---

## Notes

- **Technical work** (manifest-driven GLB, sockets, animation layers) exists to **serve** the checklist above; it is not the goal in itself.
- **IP**: placeholder or extracted commercial-game art is fine for learning; shipping publicly needs **replaceable** original or licensed assets when you care about distribution.

---

*Derived from design discussion; adjust phases to match your schedule and scope.*
