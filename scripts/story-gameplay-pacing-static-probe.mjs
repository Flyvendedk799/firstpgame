import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STORY_GAMEPLAY_PACING_VERSION,
  buildStoryCombatBeatSnapshot,
  buildStoryGameplayDirectorSnapshot,
  buildStoryGameplayPacingSnapshot,
  buildStorySquadPressureSnapshot,
  resolveStoryEnemyDirective,
  resolveStorySquadMemberDirective
} from '../src/game/storyGameplayPacing.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(STORY_GAMEPLAY_PACING_VERSION === 'story-gameplay-pacing.v6', 'unexpected story gameplay pacing version');
assert(main.includes("from './game/storyGameplayPacing.js'"), 'main pacing import missing');
assert(main.includes('function _storyGameplayPacingSnapshot'), 'main pacing snapshot helper missing');
assert(main.includes('function tickStoryGameplayDirector'), 'story gameplay director tick missing');
assert(main.includes('storyGameplayPacing:G._storyGameplayPacing'), 'debug snapshot pacing missing');
assert(main.includes('storyGameplayPacing:()=>G._storyGameplayPacing'), 'debug accessor pacing missing');
assert(main.includes('storyGameplayDirector:G._storyGameplayDirector'), 'debug snapshot director missing');
assert(main.includes('buildStoryGameplayPacingSnapshot'), 'pacing builder not wired');
assert(main.includes('buildStoryGameplayDirectorSnapshot'), 'director builder not wired');
assert(main.includes('buildStoryCombatBeatSnapshot'), 'story combat beat builder not wired');
assert(main.includes('storyCombatBeat:G._storyCombatBeat') && main.includes('storyCombatBeat:()=>G._storyCombatBeat'), 'story combat beat debug state missing');
assert(main.includes('_storyBeatEntryPulse') && main.includes('_storyBeatClutchPulse') && main.includes('_storyBeatChainPulse'), 'story combat beat player pulses missing');
assert(main.includes('beatMod.enemyAccuracyMul') && main.includes('storyCombatBeat=beatMod'), 'story combat beat enemy modifiers missing');
assert(main.includes('resolveStoryEnemyDirective'), 'enemy directive resolver not wired');
assert(main.includes('buildStorySquadPressureSnapshot'), 'story squad pressure builder not wired');
assert(main.includes('resolveStorySquadMemberDirective'), 'story squad member directive resolver not wired');
assert(main.includes('recordEnemySquadCommandAnimationPolish'), 'story squad command animation recorder not wired');
assert(main.includes('storySquadPressure:()=>G._lastStorySquadPressure'), 'story squad debug accessor missing');
assert(main.includes('storySquad:e.group') && main.includes('storySquadDirective'), 'enemy story squad debug state missing');
assert(main.includes('_storyAccuracyMul') && main.includes('storyAccMul'), 'story accuracy does not affect enemy hit chance');
assert(main.includes('_storyChainWindowPulse') && main.includes('_storyTempoPulse'), 'story chain/tempo pulses are not wired');
assert(main.includes('_storyThreatReadPulse') && main.includes('_storyFlankTelegraphPulse') && main.includes('_storyTargetSwapPulse') && main.includes('_storyRecoveryBreatherPulse'), 'story v6 pacing cue pulses are not wired');
assert(main.includes("storyPacingCues:{version:'story-pacing-cues.v1'"), 'story pacing cues debug snapshot missing');
assert(main.includes('telegraphDelay=THREE.MathUtils.clamp') && main.includes('mod.telegraphLead') && main.includes('beatMod.enemyTelegraph'), 'story v6 enemy telegraph delay missing');
assert(main.includes('function _storyAmmoDropChance') && main.includes('function maybeSpawnStoryAmmoPickup'), 'story-aware ammo drop helper missing');
assert(main.includes("version:'story-ammo-drop.v1'") && main.includes('_storyResourceMercyPulse'), 'story ammo drop debug contract missing');
assert(main.includes('function applyStoryCombatReward') && main.includes("version:'story-combat-reward.v1'"), 'story combat reward helper missing');
assert(main.includes('_storyRecoveryRewardPulse') && main.includes('_storyChainRewardPulse') && main.includes('_storyRewardHudPulse'), 'story reward pulses are not wired');
assert(main.includes('_storyAimChainPulse') && main.includes('(P._storyAimChainPulse||0)*.070'), 'story aim chain pulse/crosshair wiring missing');
assert(main.includes('applyStoryCombatReward(P,{source:(opts&&opts.source)') && main.includes('closeRange:(opts&&opts.closeRange)||0'), 'combo story reward source context missing');
assert(main.includes("storyCombatReward:{version:'story-combat-reward.v1'"), 'story combat reward debug snapshot missing');
assert(main.includes("source:'gun-kill'") && main.includes("source:'takedown-kill'") && main.includes("source:'dropkick-kill'"), 'story combat reward kill sources missing');
assert(main.includes('function applyStoryMomentumShock') && main.includes("version:'story-momentum-shock.v1'"), 'story momentum shock helper missing');
assert(main.includes('_storyKillShockPulse') && main.includes('_storyKillShockSide') && main.includes('storyMomentumShock'), 'story momentum shock animation/debug state missing');
assert(main.includes("source:'knife-throw-kill'") && main.includes("source:'ricochet-kill'") && main.includes('applyStoryMomentumShock(enemy,h.point') && main.includes('applyStoryMomentumShock(t,t.group.position'), 'story momentum shock kill hooks missing');
assert(main.includes("version:'story-resource-magnet.v1'") && main.includes('_storyResourceMagnetPulse'), 'story resource magnet contract missing');
assert(main.includes('storyResourceMagnet') && main.includes('storyResourcePickup') && main.includes('_lastStoryResourcePickup'), 'story resource magnet runtime/debug state missing');
assert(main.includes('lowAmmo01') && main.includes('pullRadius=2.05+pull*1.35'), 'story resource magnet low-ammo pull tuning missing');
assert(main.includes("version:'story-suppression-near-miss.v1'") && main.includes('_storySuppressionPulse'), 'story suppression near-miss contract missing');
assert(main.includes('storySuppressionNearMiss') && main.includes('_lastStorySuppressionNearMiss'), 'story suppression near-miss debug state missing');
assert(main.includes('storyPower=THREE.MathUtils.clamp') && main.includes('storySuppressionSide'), 'story suppression animation tuning missing');
assert(main.includes('function applyStoryRoomClearBreather') && main.includes("version:'story-room-clear-breather.v1'"), 'story room-clear breather missing');
assert(main.includes('applyStoryRoomClearBreather(zoneId,{fullClear:false})') && main.includes('applyStoryRoomClearBreather(2,{fullClear:true})'), 'story room-clear breather triggers missing');
assert(main.includes('_storyRoomClearPulse') && main.includes('storyRoomClearBreather'), 'story room-clear breather pulse/debug missing');
assert(main.includes('function _applyStoryRoomClearEnemyMorale') && main.includes("version:'story-room-clear-enemy-morale.v1'"), 'story room-clear enemy morale missing');
assert(main.includes('_storyRoomClearHeardPulse') && main.includes('storyRoomClearEnemyMorale'), 'story room-clear enemy morale animation/debug missing');
assert(main.includes('function applyStoryRoomEntryCinematic') && main.includes("version:'story-room-entry-cinematic.v1'"), 'story room-entry cinematic helper missing');
assert(main.includes('function tickStoryRoomEntryCinematic') && main.includes('_storyRoomEntryKey'), 'story room-entry cinematic trigger missing');
assert(main.includes('_storyRoomEntryEnemyPulse') && main.includes('storyRoomEntryCinematic'), 'story room-entry enemy animation/debug missing');
assert(main.includes('_storyRoomEntryPulse') && main.includes('_storyRoomEntryBracePulse'), 'story room-entry player presentation missing');
assert(main.includes('function tickStoryExtractionFlow') && main.includes("version:'story-extraction-flow.v1'"), 'story extraction flow missing');
assert(main.includes('_storyExtractSprintAssist') && main.includes('const extractMul=1+THREE.MathUtils.clamp(P._storyExtractSprintAssist'), 'story extraction movement assist missing');
assert(main.includes('storyExtractionFlow:{version:\'story-extraction-flow.v1\'') && main.includes('_storyExitCompassPulse'), 'story extraction debug/presentation missing');
assert(main.includes("source:'execution-kill'") && main.includes("source==='execution-kill'"), 'legacy execution story reward/shock integration missing');
assert(main.includes('mh-task'), 'mission HUD task hook missing');

const base = {
  started: true,
  building: 1,
  enemyCount: 4,
  player: { hp: 100, maxHp: 100, ammo: 20, weaponIdx: 0 },
  mag: 30,
  story: {
    building: 1,
    currentRoom: 'b01_intake_peek',
    hud: { roomLabel: 'INTAKE PEEK', taskLabel: 'Intake Peek' },
    activeCue: { kind: 'room', tone: 'story' }
  },
  director: {
    currentFlowRoomId: 'b01_intake_peek',
    getRoomProgress: () => ({ current: 1, total: 7 })
  }
};

const clear = buildStoryGameplayPacingSnapshot(base);
const recover = buildStoryGameplayPacingSnapshot({
  ...base,
  enemyCount: 5,
  player: { hp: 28, maxHp: 100, ammo: 2, weaponIdx: 0, _suppressionLevel: 0.55 },
  mag: 30
});
const objective = buildStoryGameplayPacingSnapshot({
  ...base,
  enemyCount: 1,
  objective: { completed: false, failed: false, dwellStart: 1200, def: { timerS: 90 }, remainingS: 55 }
});
const extract = buildStoryGameplayPacingSnapshot({ ...base, enemyCount: 0, exitUnlocked: true });
const exploit = buildStoryGameplayPacingSnapshot({
  ...base,
  enemyCount: 3,
  player: { hp: 94, maxHp: 100, ammo: 24, weaponIdx: 0, _combatFlow: 0.86, _killFlowPulse: 0.72, combo: { count: 5 } },
  mag: 30
});
const recoverDirector = buildStoryGameplayDirectorSnapshot(recover, { playMode: 'solo' });
const dangerDirector = buildStoryGameplayDirectorSnapshot(clear, { playMode: 'solo' });
const objectiveDirector = buildStoryGameplayDirectorSnapshot(objective, { playMode: 'solo' });
const exploitDirector = buildStoryGameplayDirectorSnapshot(exploit, { playMode: 'solo' });
const entryBeat = buildStoryCombatBeatSnapshot(clear, dangerDirector, {
  playMode: 'solo',
  player: base.player,
  enemyCount: clear.enemyCount,
  roomAgeS: 1.8,
  mag: 30
});
const clutchBeat = buildStoryCombatBeatSnapshot(recover, recoverDirector, {
  playMode: 'solo',
  player: recover.player,
  enemyCount: recover.enemyCount,
  roomAgeS: 12,
  mag: 30
});
const chainBeat = buildStoryCombatBeatSnapshot(exploit, exploitDirector, {
  playMode: 'solo',
  player: exploit.player,
  enemyCount: exploit.enemyCount,
  roomAgeS: 10,
  mag: 30
});
const objectiveBeat = buildStoryCombatBeatSnapshot(objective, objectiveDirector, {
  playMode: 'solo',
  player: objective.player,
  objective: objective.objective,
  enemyCount: objective.enemyCount,
  roomAgeS: 9,
  mag: 30
});
const recoverEnemy = resolveStoryEnemyDirective({ type: 'soldier', hp: 80, maxHp: 100 }, recoverDirector);
const dangerEnemy = resolveStoryEnemyDirective({ type: 'soldier', hp: 80, maxHp: 100 }, dangerDirector);
const marksmanObjective = resolveStoryEnemyDirective({ type: 'marksman', hp: 100, maxHp: 100 }, objectiveDirector);
const exploitEnemy = resolveStoryEnemyDirective({ type: 'soldier', hp: 100, maxHp: 100 }, exploitDirector);
const squadPressure = buildStorySquadPressureSnapshot({
  director: dangerDirector,
  player: { hp: 100, maxHp: 100, _enemyShotPressure: 0.58 },
  enemyCount: 5,
  state: 'advance',
  squad: { id: 2, state: 'advance' },
  members: [
    { type: 'soldier', hp: 100, maxHp: 100 },
    { type: 'scout', hp: 65, maxHp: 65 },
    { type: 'heavy', hp: 220, maxHp: 220 }
  ],
  leader: { type: 'soldier', hp: 100, maxHp: 100 }
});
const flankerDirective = resolveStorySquadMemberDirective(
  { type: 'scout', hp: 65, maxHp: 65 },
  { ...squadPressure, recommendedState: 'flank', flankNeed: Math.max(0.62, squadPressure.flankNeed) },
  { role: 'flanker', state: 'flank', side: -1, orderChanged: true }
);
const suppressDirective = resolveStorySquadMemberDirective(
  { type: 'soldier', hp: 100, maxHp: 100 },
  { ...squadPressure, recommendedState: 'suppress', suppressNeed: Math.max(0.66, squadPressure.suppressNeed) },
  { role: 'suppressor', state: 'suppress', side: 1 }
);

assert(clear.finite && recover.finite && objective.finite && extract.finite && exploit.finite, 'pacing snapshots should be finite');
assert(clear.intent === 'clear' || clear.intent === 'thin-room', `unexpected clear intent ${clear.intent}`);
assert(recover.intent === 'recover', `low hp/ammo should recover, got ${recover.intent}`);
assert(recover.pressure > clear.pressure, 'recover pressure should exceed clear pressure');
assert(objective.intent === 'objective' && objective.taskLabel === 'HOLD OBJECTIVE', 'objective dwell should request hold objective');
assert(extract.intent === 'extract' && extract.tone === 'success', 'exit unlocked should request extraction');
assert(exploit.intent === 'exploit' && exploit.chainWindow > 0.45, `momentum should open exploit chain window, got ${exploit.intent}`);
assert(recoverDirector.recovery > dangerDirector.recovery && recoverDirector.playerRecoveryMul > 1, 'recover director should open recovery window');
assert(recoverEnemy.shootDelayAdd > dangerEnemy.shootDelayAdd, 'recover enemy should have longer shot delay');
assert(dangerEnemy.aggressionMul >= recoverEnemy.aggressionMul, 'danger enemy should be more aggressive than recover enemy');
assert(objectiveDirector.objectiveHold > 0.3 && marksmanObjective.accuracyMul > 0.7, 'objective director should preserve aimed pressure');
assert(exploitDirector.label === 'chain-window' && exploitDirector.chainWindow > 0.45, 'exploit director should expose chain-window label');
assert(exploitEnemy.readability > dangerEnemy.readability && exploitEnemy.chainWindow > 0.45, 'chain-window enemy directive should increase readability');
assert(dangerDirector.readability > 0.18 && dangerDirector.telegraphLead > 0.10, 'director should expose combat readability and telegraph lead');
assert(dangerDirector.flankTelegraph >= 0 && dangerDirector.threatCadence >= 0, 'director v6 flank/threat cues invalid');
assert(exploitDirector.targetSwapWindow > 0.30, 'exploit director should open target-swap window');
assert(recoverDirector.recoveryBreather > dangerDirector.recoveryBreather, 'recover director should raise recovery breather');
assert(recoverEnemy.telegraphLead >= 0 && recoverEnemy.recoveryBreather > dangerEnemy.recoveryBreather, 'enemy directive should inherit recovery/telegraph cues');
assert(exploitEnemy.targetSwapWindow > dangerEnemy.targetSwapWindow, 'chain-window directive should carry target-swap cue');
assert(entryBeat.finite && clutchBeat.finite && chainBeat.finite && objectiveBeat.finite, 'story combat beat snapshots should be finite');
assert(entryBeat.phase === 'entry' || entryBeat.entry > 0.2, `entry beat should emphasize room entry, got ${entryBeat.phase}`);
assert(clutchBeat.phase === 'clutch' && clutchBeat.reloadGrace > entryBeat.reloadGrace, 'clutch beat should grant recovery/reload grace');
assert(chainBeat.phase === 'chain' && chainBeat.weaponReadyBoost > clutchBeat.weaponReadyBoost * 0.45, 'chain beat should raise weapon readiness');
assert(objectiveBeat.objective > 0.35 && objectiveBeat.enemyAggressionMul >= 0.8, 'objective beat should preserve readable pressure');
assert(chainBeat.targetSwapWindow > 0.25 && chainBeat.enemyTelegraph > 0.10, 'chain beat should expose target swap and enemy telegraph');
assert(clutchBeat.reloadCover > entryBeat.reloadCover, 'clutch beat should create reload cover');
assert(squadPressure.finite && squadPressure.active && squadPressure.aliveCount === 3, 'squad pressure snapshot invalid');
assert(squadPressure.suppressNeed > 0.2 || squadPressure.flankNeed > 0.2 || squadPressure.advanceNeed > 0.2, 'squad pressure did not produce tactical needs');
assert(flankerDirective.active && flankerDirective.role === 'flanker' && flankerDirective.flankBias > suppressDirective.flankBias, 'flanker directive invalid');
assert(suppressDirective.suppressBias > flankerDirective.suppressBias && suppressDirective.shootDelayAdd <= flankerDirective.shootDelayAdd + 0.1, 'suppressor directive invalid');

console.log(JSON.stringify({
  ok: true,
  version: STORY_GAMEPLAY_PACING_VERSION,
  intents: {
    clear: clear.intent,
    recover: recover.intent,
    objective: objective.intent,
    extract: extract.intent,
    exploit: exploit.intent
  },
  pressures: {
    clear: Number(clear.pressure.toFixed(3)),
    recover: Number(recover.pressure.toFixed(3)),
    objective: Number(objective.pressure.toFixed(3)),
    exploitMomentum: Number(exploit.momentum.toFixed(3)),
    exploitChain: Number(exploit.chainWindow.toFixed(3)),
    readability: Number(clear.combatReadability.toFixed(3)),
    flankPreview: Number(clear.flankPreview.toFixed(3))
  },
  director: {
    recover: { label: recoverDirector.label, shotDelay: Number(recoverEnemy.shootDelayAdd.toFixed(3)) },
    clear: { label: dangerDirector.label, aggression: Number(dangerEnemy.aggressionMul.toFixed(3)) },
    objective: { label: objectiveDirector.label, accuracy: Number(marksmanObjective.accuracyMul.toFixed(3)) },
    exploit: { label: exploitDirector.label, readability: Number(exploitEnemy.readability.toFixed(3)), targetSwap: Number(exploitDirector.targetSwapWindow.toFixed(3)) }
  },
  beats: {
    entry: { phase: entryBeat.phase, intensity: Number(entryBeat.intensity.toFixed(3)) },
    clutch: { phase: clutchBeat.phase, reloadGrace: Number(clutchBeat.reloadGrace.toFixed(3)), reloadCover: Number(clutchBeat.reloadCover.toFixed(3)) },
    chain: { phase: chainBeat.phase, ready: Number(chainBeat.weaponReadyBoost.toFixed(3)), targetSwap: Number(chainBeat.targetSwapWindow.toFixed(3)) },
    objective: { phase: objectiveBeat.phase, pressure: Number(objectiveBeat.objective.toFixed(3)) }
  },
  squad: {
    label: squadPressure.label,
    recommended: squadPressure.recommendedState,
    suppressNeed: Number(squadPressure.suppressNeed.toFixed(3)),
    flankNeed: Number(squadPressure.flankNeed.toFixed(3)),
    flankerBias: Number(flankerDirective.flankBias.toFixed(3)),
    suppressBias: Number(suppressDirective.suppressBias.toFixed(3))
  }
}, null, 2));
