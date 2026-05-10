# CLEARANCE Full-Finish Agent Plan

## Summary

Build a large, cohesive finishing patch for CLEARANCE: a stylish first-person room-clearing revenge shooter with Sifu-like pacing, fast lethal gunplay, executions, focus slow-time, authored building identities, and a replayable 8-building campaign.

The playable game is the 8-building runtime in `src/main.js`. The old 12-level story prototype package has been removed so future coding agents work on the shipped campaign path only.

## Agent Rules

- Work from `/Users/tobiasmastek/Desktop/firstpgame`.
- Preserve Vite + Three.js only; do not add new runtime libraries.
- Treat `src/main.js` as the main surface, with focused edits to `index.html` and `src/levelSequences.js` when needed.
- Keep save compatibility for `clearance_progress` and `clearance_settings`; migrate missing fields defensively.
- Do not revive disabled GLB soldier/deagle paths unless fully fixing the asset path.
- Use existing test scripts and add only small targeted Playwright checks if needed.
- Implement in sequence, but keep the game runnable after each phase.

## Implementation Target

- Add a single campaign data layer for the 8 playable buildings with target, threat, mission verb, signature pressure, setpiece identity, encounter beats, mastery objective, reward, shortcut, and visual identity.
- Add encounter beat metadata for `read`, `brawl`, `hold`, `snipe`, `stealth_or_loud`, and `boss`.
- Normalize runtime state on `G`: `campaignLevel`, `levelState`, `zoneClears`, `currentBeat`, `mastery`, and `runModifiers`.
- Normalize runtime state on `P`: full 8-weapon ammo arrays, tactical resources, attachments including `foregrip`, focus, combo, operator, and run stats.
- Keep `window.__game.debug` working and extend it with campaign/beat/perf snapshots.

## Phase Checklist

1. Stabilize: validation/build green; no missing ammo slots; no `NaN` attachment scores; save/resume preserves `foregrip`, smokes, flashes, HP, and difficulty.
2. Campaign spine: all briefing, dossier, level select, HUD, setpiece, victory, defeat, and boss copy can read campaign metadata.
3. Level identity: every building has a hero landmark, off-axis cue, vertical/pseudo-vertical visual layer, alternate route cue, and boss-threshold read.
4. Encounter director: zones run authored beats; reinforcements are telegraphed; lieutenants and the final boss read distinctly.
5. Combat feel: weapons are differentiated; focus is intentional; melee/takedown prompts are clear; hit feedback is readable.
6. Progression: operators become playstyles; mastery objectives persist; scoring rewards accuracy, speed, headshots, executions, mastery, and difficulty.
7. Narrative: keep only the lightweight 8-building typewriter story cards in `src/main.js`; do not recreate alternate story-map runtimes.
8. QA: run `npm run build`, `node scripts/smoke-test.mjs`, and `npm run test:campaign` with a dev server.

## Hard Acceptance Criteria

- The 8-building campaign feels intentionally authored, not like a prototype wave room.
- All menu modes launch and return safely.
- No `NaN` attachment comparisons, missing weapon ammo slots, broken save/resume fields, or hard-coded wrong building counts.
- Every building has a distinct setpiece, encounter identity, visual identity, and mastery objective.
- The final boss and ending feel like a campaign conclusion.
- Build and validation commands pass with no new console errors in normal boot.

## Blank Claude Code Start Prompt

```text
You are in /Users/tobiasmastek/Desktop/firstpgame. Read GAME_COMPLETION_MASTER_PLAN.md fully, then implement it as one ambitious, coherent finishing patch for CLEARANCE.

Prioritize the shipped 8-building campaign in src/main.js and src/levelSequences.js. Do not recreate or work from the removed 12-level story-map prototype. Start with Phase 0 stability fixes, then proceed phase by phase. Keep the game runnable after each phase, preserve save compatibility, do not add new runtime libraries, and do not resurrect disabled GLB paths unless you fully fix them.

Run: npm run build, node scripts/smoke-test.mjs, and npm run test:campaign with a dev server. Report exactly what changed, what was verified, and any residual risks.
```
