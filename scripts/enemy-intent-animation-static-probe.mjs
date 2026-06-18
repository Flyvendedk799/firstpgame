import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAMEPLAY_ANIMATION_POLISH_VERSION,
  buildEnemyCombatResponseSnapshot,
  buildEnemyIntentAnimationSnapshot,
  recordEnemyCombatStressAnimationPolish,
  recordEnemySquadCommandAnimationPolish,
  recordEnemySuppressionAnimationPolish
} from '../src/game/gameplayAnimationPolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(GAMEPLAY_ANIMATION_POLISH_VERSION === 'gameplay-animation-polish.v6', 'unexpected animation polish version');
assert(main.includes('buildEnemyIntentAnimationSnapshot'), 'enemy intent import/wiring missing');
assert(main.includes('group.userData.enemyIntentAnimation'), 'enemy intent userData missing');
assert(main.includes('intentAnimation:e.group'), 'enemy intent debug snapshot missing');
assert(main.includes('storyDirector:this._storyDirectorModifier'), 'story director is not passed to enemy intent animation');
assert(main.includes('storyBeat:this._storyBeatModifier'), 'story combat beat is not passed to enemy intent animation');
assert(main.includes('storyReadability') && main.includes('_storyReadabilityPulse'), 'story readability pose overlay missing');
assert(main.includes('storyTelegraph') && main.includes('storyStagedFlank') && main.includes('storyTargetSwap'), 'story v6 telegraph pose overlay missing');
assert(main.includes('_storyThreatReadPulse') && main.includes('storyThreatReadPulse:e._storyThreatReadPulse'), 'story v6 enemy threat-read pulse debug missing');
assert(main.includes('beatReadability') && main.includes('beatClutch') && main.includes('beatChain'), 'story beat pose overlay missing');
assert(main.includes('hitRecoveryLocomotion'), 'enemy recovery locomotion debug is not exposed');
assert(main.includes('recordEnemyCombatStressAnimationPolish'), 'enemy combat stress recorder is not wired in main');
assert(main.includes('stress-cover'), 'enemy stress-cover reposition reason missing');
assert(main.includes('combatStress') && main.includes('combatStressSide'), 'enemy combat stress pose overlay missing');
assert(main.includes('recordEnemySquadCommandAnimationPolish'), 'enemy squad command recorder is not wired in main');
assert(main.includes('squad-anchor') && main.includes('squad-regroup'), 'enemy squad cover reposition reasons missing');
assert(main.includes('squadDirective:this._squadDirective'), 'enemy squad directive is not passed to intent animation');
assert(main.includes('squadReadability') && main.includes('squadFlank') && main.includes('squadSuppress'), 'enemy squad pose overlay missing');

const baseEnemy = {
  type: 'soldier',
  aimReady: 0.72,
  peekAmt: 0,
  enemyReloadTimer: 0,
  shootRecoilTimer: 0,
  speed: 3.2,
  hp: 90,
  maxHp: 100
};

const reload = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'reload',
  reloadTimer: 1.1,
  aimReady: 0.1,
  speed: 0.2,
  atCover: true
});
assert(reload.intent === 'reload' && reload.reloadReach > 0.7 && reload.weaponLower > reload.weaponRaise, 'reload intent invalid');

const flank = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'flank',
  movementMode: 'flank',
  aimReady: 0.45,
  speed: 4.8
});
assert(flank.intent === 'flank' && flank.flankLean > 0.5 && flank.stepDrive > 0.65, 'flank intent invalid');

const suppressedEnemy = { ...baseEnemy, _gameplayAnimationPolish: null };
recordEnemySuppressionAnimationPolish(suppressedEnemy, { strength: 1.0, nowMs: 1000, side: -1 });
suppressedEnemy._suppressedUntil = Date.now() + 1000;
const suppressed = buildEnemyIntentAnimationSnapshot(suppressedEnemy, {
  poseState: 'suppressed',
  suppressed: true,
  aimReady: 0.25,
  speed: 0.4
});
assert(suppressed.intent === 'suppressed' && suppressed.coverTuck > 0.2 && suppressed.suppression > 0.6, 'suppressed intent invalid');

const fire = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'fire',
  shootRecoilTimer: 0.16,
  aimReady: 0.9,
  speed: 0.1
});
assert(fire.intent === 'fire' && fire.shot > 0.6 && fire.weaponRaise > 0.4 && fire.shoulderTension > 0.5, 'fire intent invalid');

const storyPush = buildEnemyIntentAnimationSnapshot({ ...baseEnemy, _storyReadabilityPulse: 0.5 }, {
  poseState: 'attack',
  aimReady: 0.66,
  speed: 3.4,
  storyDirector: { label: 'pressure-push', aggressionMul: 1.28, flankMul: 1.32, readability: 0.62 }
});
const storyRecovery = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'attack',
  aimReady: 0.66,
  speed: 0.8,
  storyDirector: { label: 'recovery-beat', aggressionMul: 0.78, flankMul: 0.84, readability: 0.58 }
});
const storyTelegraph = buildEnemyIntentAnimationSnapshot({ ...baseEnemy, _storyThreatReadPulse: 0.45 }, {
  poseState: 'attack',
  aimReady: 0.62,
  speed: 3.1,
  storyDirector: {
    label: 'pressure-push',
    aggressionMul: 1.14,
    flankMul: 1.22,
    readability: 0.58,
    telegraphLead: 0.72,
    flankTelegraph: 0.66,
    targetSwapWindow: 0.60,
    stagedThreat: 0.58
  },
  storyBeat: { phase: 'chain', targetSwapWindow: 0.62, chain: 0.68, readability: 0.64 }
});
assert(storyPush.storyPush > 0.3 && storyPush.torsoCommit > storyRecovery.torsoCommit, 'story pressure push did not drive intent');
assert(storyRecovery.storyRecovery > 0.5 && storyRecovery.weaponLower > storyPush.weaponLower, 'story recovery did not lower enemy posture');
assert(storyTelegraph.storyTelegraph > 0.65 && storyTelegraph.storyStagedFlank > 0.45 && storyTelegraph.storyTargetSwap > 0.45, 'story v6 telegraph fields did not resolve');
assert(storyTelegraph.flankLean > storyPush.flankLean && storyTelegraph.readable > storyPush.readable, 'story v6 telegraph should improve silhouette/readability');

const beatChain = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'attack',
  aimReady: 0.70,
  speed: 3.2,
  storyDirector: { label: 'chain-window', aggressionMul: 1.06, flankMul: 1.08, readability: 0.42 },
  storyBeat: { phase: 'chain', chain: 0.82, readability: 0.72, intensity: 0.76 }
});
const beatClutch = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'attack',
  aimReady: 0.54,
  speed: 0.7,
  storyDirector: { label: 'recovery-beat', aggressionMul: 0.80, flankMul: 0.84, readability: 0.44 },
  storyBeat: { phase: 'clutch', clutch: 0.86, readability: 0.76, reloadGrace: 0.62, intensity: 0.84 }
});
const beatObjective = buildEnemyIntentAnimationSnapshot(baseEnemy, {
  poseState: 'attack',
  aimReady: 0.68,
  speed: 1.2,
  storyDirector: { label: 'objective-hold', aggressionMul: 1.02, flankMul: 0.94, readability: 0.52 },
  storyBeat: { phase: 'objective', objective: 0.78, readability: 0.70, intensity: 0.72 }
});
assert(beatChain.beatChain > 0.7 && beatChain.weaponRaise > beatClutch.weaponRaise, 'chain beat should raise weapon/silhouette');
assert(beatClutch.beatClutch > 0.7 && beatClutch.recoveryHunch > beatChain.recoveryHunch, 'clutch beat should produce recovery hunch');
assert(beatObjective.beatObjective > 0.7 && beatObjective.storyHold > storyPush.storyHold, 'objective beat should drive hold posture');

const recoveryEnemy = { ...baseEnemy, staggerDir: { x: -1 }, group: { userData: {} }, limbRig: {} };
recordEnemySuppressionAnimationPolish(recoveryEnemy, { strength: 0.2, nowMs: 1600, side: -1 });
recoveryEnemy._gameplayAnimationPolish.rootDragPulse = 0.7;
recoveryEnemy._gameplayAnimationPolish.recoveryStepPulse = 0.65;
recoveryEnemy._gameplayAnimationPolish.turnLockPulse = 0.45;
const recovery = buildEnemyIntentAnimationSnapshot(recoveryEnemy, { poseState: 'walk', speed: 2.6 });
assert(recovery.rootDrag > 0.4 && recovery.recoveryStep > 0.4 && recovery.recoveryHunch > storyRecovery.recoveryHunch, 'recovery locomotion intent invalid');

const stressedEnemy = { ...baseEnemy, staggerDir: { x: 1 }, group: { userData: {} }, limbRig: {} };
recordEnemyCombatStressAnimationPolish(stressedEnemy, { kind: 'near-miss', strength: 1.12, side: 1, nowMs: 2000 });
const stressedResponse = buildEnemyCombatResponseSnapshot(stressedEnemy, 2050);
const stressedIntent = buildEnemyIntentAnimationSnapshot(stressedEnemy, {
  poseState: 'attack',
  aimReady: 0.72,
  speed: 1.0
});
assert(stressedResponse.source.combatStress > 0.45, 'combat stress response source missing');
assert(stressedResponse.aimMul < 0.9 && stressedResponse.fireDelayMul > 1.2, 'combat stress does not affect aim/fire');
assert(stressedResponse.coverBias > 0.2, 'combat stress does not bias toward cover');
assert(stressedIntent.combatStress > 0.45 && stressedIntent.weaponLower > 0.1, 'combat stress intent animation invalid');

const squadEnemy = { ...baseEnemy, group: { userData: {} }, limbRig: {}, _squadRole: 'flanker' };
const squadDirective = {
  active: true,
  role: 'flanker',
  state: 'flank',
  flankBias: 0.78,
  suppressBias: 0.12,
  coverBias: 0.22,
  advanceBias: 0.55,
  speedMul: 1.18,
  accuracyMul: 0.94,
  readability: 0.74,
  side: -1
};
squadEnemy._squadDirective = squadDirective;
recordEnemySquadCommandAnimationPolish(squadEnemy, { directive: squadDirective, role: 'flanker', state: 'flank', side: -1, nowMs: 2400, orderChanged: true });
const squadResponse = buildEnemyCombatResponseSnapshot(squadEnemy, 2450);
const squadIntent = buildEnemyIntentAnimationSnapshot(squadEnemy, {
  poseState: 'flank',
  movementMode: 'flank',
  aimReady: 0.56,
  speed: 4.6,
  squadDirective
});
assert(squadResponse.source.squadFlank > 0.4 && squadResponse.movementMul >= 0.8, 'squad command combat response invalid');
assert(squadIntent.squadFlank > 0.6 && squadIntent.flankLean > flank.flankLean && squadIntent.stepDrive > 0.7, 'squad flank intent invalid');

console.log(JSON.stringify({
  ok: true,
  version: GAMEPLAY_ANIMATION_POLISH_VERSION,
  intents: {
    reload: { reach: Number(reload.reloadReach.toFixed(3)), lower: Number(reload.weaponLower.toFixed(3)) },
    flank: { lean: Number(flank.flankLean.toFixed(3)), step: Number(flank.stepDrive.toFixed(3)) },
    suppressed: { tuck: Number(suppressed.coverTuck.toFixed(3)), suppression: Number(suppressed.suppression.toFixed(3)) },
    fire: { shot: Number(fire.shot.toFixed(3)), tension: Number(fire.shoulderTension.toFixed(3)) },
    story: { push: Number(storyPush.storyPush.toFixed(3)), recovery: Number(storyRecovery.storyRecovery.toFixed(3)), telegraph: Number(storyTelegraph.storyTelegraph.toFixed(3)), targetSwap: Number(storyTelegraph.storyTargetSwap.toFixed(3)) },
    beat: { chain: Number(beatChain.beatChain.toFixed(3)), clutch: Number(beatClutch.recoveryHunch.toFixed(3)), objective: Number(beatObjective.storyHold.toFixed(3)) },
    hitRecovery: { rootDrag: Number(recovery.rootDrag.toFixed(3)), step: Number(recovery.recoveryStep.toFixed(3)), hunch: Number(recovery.recoveryHunch.toFixed(3)) },
    stress: { stress: Number(stressedIntent.combatStress.toFixed(3)), aimMul: Number(stressedResponse.aimMul.toFixed(3)), fireDelayMul: Number(stressedResponse.fireDelayMul.toFixed(3)), coverBias: Number(stressedResponse.coverBias.toFixed(3)) },
    squad: { flank: Number(squadIntent.squadFlank.toFixed(3)), step: Number(squadIntent.stepDrive.toFixed(3)), moveMul: Number(squadResponse.movementMul.toFixed(3)) }
  }
}, null, 2));
