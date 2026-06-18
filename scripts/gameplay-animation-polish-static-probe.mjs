import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAMEPLAY_ANIMATION_POLISH_VERSION,
  applyEnemyAnimationPolishAccuracy,
  buildEnemyAnimationPolishSnapshot,
  buildEnemySuppressionNearMissSnapshot,
  buildPlayerCombatStanceSnapshot,
  buildPlayerWeaponAnimationPolishSnapshot,
  recordEnemyHitAnimationPolish,
  recordEnemyMoraleAnimationPolish,
  recordEnemySuppressionAnimationPolish,
  tickEnemyAnimationPolish,
  tickPlayerCombatStancePolish,
  tickPlayerWeaponAnimationPolish
} from '../src/game/gameplayAnimationPolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const combatFeedback = readFileSync(join(root, 'src/game/combatFeedback.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

for (const fn of [
  recordEnemyHitAnimationPolish,
  recordEnemyMoraleAnimationPolish,
  recordEnemySuppressionAnimationPolish,
  tickEnemyAnimationPolish,
  applyEnemyAnimationPolishAccuracy,
  tickPlayerWeaponAnimationPolish,
  tickPlayerCombatStancePolish,
  buildEnemyAnimationPolishSnapshot,
  buildEnemySuppressionNearMissSnapshot,
  buildPlayerWeaponAnimationPolishSnapshot,
  buildPlayerCombatStanceSnapshot
]) {
  assert(typeof fn === 'function', `missing function export: ${fn && fn.name}`);
}

assert(GAMEPLAY_ANIMATION_POLISH_VERSION === 'gameplay-animation-polish.v6', 'unexpected polish version');
assert(main.includes("from './game/gameplayAnimationPolish.js'"), 'main import missing');
assert(main.includes('recordEnemyHitAnimationPolish(this'), 'enemy damage hook missing');
assert(main.includes('recordEnemyMoraleAnimationPolish(e'), 'enemy morale hook missing');
assert(main.includes('recordEnemyMoraleAnimationPolish(this.leader'), 'squad leader morale hook missing');
assert(main.includes('tickEnemyAnimationPolish(this'), 'enemy tick hook missing');
assert(main.includes('impactAnimation'), 'enemy impact animation debug payload missing');
assert(main.includes('_guardClutchPulse'), 'guard clutch runtime pulse missing');
assert(main.includes('_weaponSlipPulse'), 'weapon slip runtime pulse missing');
assert(main.includes('_balanceLossPulse'), 'balance loss runtime pulse missing');
assert(main.includes('enemy-hit-recovery-locomotion.v1'), 'enemy hit recovery locomotion runtime missing');
assert(main.includes('_lastRecoveryMoveMul'), 'enemy recovery movement multiplier debug missing');
assert(main.includes('_attackDisruptedUntil') && main.includes("_poseTarget='reacquire'"), 'enemy attack disruption runtime missing');
assert(main.includes('combatDisruption:e.group') && main.includes('attackDisruptedMsLeft'), 'enemy combat disruption debug state missing');
assert(main.includes('function _applyEnemyWoundedGameplayState') && main.includes("version:'enemy-wounded-gameplay.v1'"), 'enemy wounded gameplay state helper missing');
assert(main.includes('_woundedGameplayUntil') && main.includes('woundedGameplay:e._woundedGameplay||null'), 'enemy wounded gameplay debug state missing');
assert(main.includes('wounded.moveMul') && main.includes('wounded.accuracyMul'), 'enemy wounded gameplay not wired into move/accuracy multipliers');
assert(main.includes('closeCombatChoreography') && main.includes('GUN_BASH_CHOREOGRAPHY_VERSION') && main.includes('KNIFE_CLOSE_CHOREOGRAPHY_VERSION'), 'close-combat choreography debug/runtime missing');
assert(main.includes('_woundedStrafe') && main.includes("reason='wounded'"), 'enemy wounded strafe/retreat behavior missing');
assert(main.includes('recordEnemySuppressionAnimationPolish(e'), 'enemy suppression hook missing');
assert(main.includes('buildEnemySuppressionNearMissSnapshot'), 'enemy near-miss suppression resolver missing');
assert(main.includes('suppressionNearMiss'), 'enemy near-miss suppression debug missing');
assert(main.includes('applyEnemyAnimationPolishAccuracy(enemy'), 'enemy accuracy hook missing');
assert(main.includes('tickPlayerWeaponAnimationPolish(P'), 'player weapon polish tick missing');
assert(main.includes('tickPlayerCombatStancePolish(P'), 'player combat stance tick missing');
assert(main.includes('buildPlayerWeaponAnimationPolishSnapshot(P)'), 'player weapon polish snapshot missing');
assert(main.includes('buildPlayerCombatStanceSnapshot(P)'), 'player combat stance snapshot missing');
assert(main.includes('_combatStanceSnapshot') && main.includes('viewmodelPitch'), 'player combat stance runtime/viewmodel wiring missing');
assert(main.includes('_weaponLowAmmoFidget'), 'viewmodel low-ammo polish missing');
assert(main.includes('_weaponSwitchPulse'), 'weapon switch pulse missing');
assert(main.includes('_weaponDrawPulse'), 'weapon draw pulse missing');
assert(main.includes('_weaponSwitchBlend'), 'viewmodel weapon switch blend missing');
assert(main.includes('_pickupCollectPulse'), 'pickup collect pulse missing');
assert(main.includes('_spawnPickupCollectVfx'), 'pickup collect vfx missing');
assert(main.includes('_reloadFlowPulse'), 'reload flow pulse missing');
assert(main.includes('_reloadMagPulse'), 'reload mag pulse missing');
assert(main.includes('setWeaponHandlingPolishProbe'), 'weapon handling debug probe missing');
assert(main.includes('gameplayAnimationPolishState'), 'debug state missing');
assert(main.includes('setEnemyInjuryPolishProbe'), 'injury debug probe missing');
assert(main.includes('setEnemyMoralePolishProbe'), 'morale debug probe missing');
assert(main.includes('_ensureKnifeStuckBeacon'), 'knife stuck beacon missing');
assert(main.includes("kind:'knife-return'"), 'knife return trail missing');
assert(main.includes("poseState='stunned'"), 'stunned pose state missing');
assert(main.includes("_poseTarget='stunned'"), 'stunned AI gate missing');
assert(main.includes('_shotgunBlastPulse'), 'shotgun blast pulse missing');
assert(main.includes('_sniperOverkillPulse'), 'sniper overkill pulse missing');
assert(main.includes('enemy-death-choreography.v1'), 'enemy death choreography contract missing');
assert(main.includes('deathChoreographyRuntime'), 'enemy death choreography runtime debug missing');
assert(main.includes('head-snap-collapse'), 'headshot death choreography missing');
assert(main.includes('leg-fold-collapse'), 'leg death choreography missing');
assert(main.includes('weapon-slip-collapse'), 'arm death choreography missing');
assert(main.includes('blast-collapse'), 'blast death choreography missing');
assert(main.includes('knife-collapse'), 'knife death choreography missing');
assert(main.includes('hurtAnimation'), 'wounded enemy pose state missing');
assert(main.includes('incomingSnap&&incomingSnap.pressure') && main.includes('P._weaponHandlingUrgency=Math.max(P._weaponHandlingUrgency||0,THREE.MathUtils.clamp'), 'near-miss weapon urgency missing');
assert(main.includes('limbPenalty'), 'limb penalty debug state missing');
assert(combatFeedback.includes('_reloadFlowPulse'), 'reload flow decay missing');
assert(combatFeedback.includes('_reloadMagPulse'), 'reload mag decay missing');
assert(combatFeedback.includes('_weaponSwitchPulse'), 'weapon switch decay missing');
assert(combatFeedback.includes('_weaponDrawPulse'), 'weapon draw decay missing');
assert(combatFeedback.includes('_pickupCollectPulse'), 'pickup collect decay missing');

const enemy = {
  group: { userData: {} },
  limbRig: {
    leftShin: { disabled: false },
    rightForearm: { disabled: false }
  },
  staggerDir: { x: -1 }
};
recordEnemyHitAnimationPolish(enemy, { limbId: 'leftShin', damage: 100, flags: { impactWeight: 1.3 }, nowMs: 1000 });
let snap = buildEnemyAnimationPolishSnapshot(enemy, 1100);
assert(snap.active && snap.limp > 0.2 && snap.limpSide === -1, 'leg hit did not produce limp');
assert(snap.balanceCatchPulse > 0.2 && snap.footShufflePulse > 0.2, 'leg hit did not produce balance/shuffle animation');
assert(snap.rootDragPulse > 0.2 && snap.recoveryStepPulse > 0.2 && snap.turnLockPulse > 0.1, 'leg hit did not produce recovery locomotion pulses');
assert(snap.shotInterruptPulse > 0.15 && snap.painTellPulse > 0.15, 'leg hit did not produce disruption tell pulses');
recordEnemyHitAnimationPolish(enemy, { limbId: 'rightForearm', damage: 80, flags: { impactWeight: 1.1 }, nowMs: 1200 });
snap = buildEnemyAnimationPolishSnapshot(enemy, 1300);
assert(snap.arm > 0.2 && snap.armSide === 1 && snap.aimPenalty > 0.1, 'arm hit did not produce arm/aim penalty');
assert(snap.weaponSlipPulse > 0.2 && snap.guardClutchPulse > 0.1, 'arm hit did not produce weapon slip/clutch animation');
assert(snap.weaponRecoverPulse > 0.2 && snap.shotInterruptPulse > 0.2, 'arm hit did not produce weapon recovery interruption');
recordEnemyMoraleAnimationPolish(enemy, { kind: 'ally_down', strength: 1.0, side: -1, nowMs: 1350 });
snap = buildEnemyAnimationPolishSnapshot(enemy, 1400);
assert(snap.panicPulse > 0.2 && snap.scanPulse > 0.1 && snap.moraleSide === -1, 'morale event did not produce panic/scan');
recordEnemyMoraleAnimationPolish(enemy, { kind: 'leader_call', strength: 0.8, side: 1, nowMs: 1450 });
snap = buildEnemyAnimationPolishSnapshot(enemy, 1500);
assert(snap.signalPulse > 0.2 && snap.lastMoraleEvent === 'leader_call', 'leader signal morale did not apply');
assert(applyEnemyAnimationPolishAccuracy(enemy, 1, 1300) < 1, 'accuracy penalty did not apply');

const pinned = buildEnemySuppressionNearMissSnapshot({ prox: 0.88, pressure: 1.25, quality: 0.72, rough: false, type: 'sniper' });
const armored = buildEnemySuppressionNearMissSnapshot({ prox: 0.88, pressure: 1.25, quality: 0.72, rough: false, type: 'heavy' });
assert(pinned.label === 'pinned' && pinned.peekBreak && pinned.durationMs > 900, 'pinned suppression snapshot invalid');
assert(pinned.durationMs > armored.durationMs && pinned.coverBias >= armored.coverBias, 'suppression class shaping invalid');

const player = { adsVis: 0.9, _combatFlow: 0.5, _lowAmmoPulse: 0.6, _suppressionLevel: 0.2, _weaponSwitchPulse: .8, _weaponDrawPulse: .6, _weaponSwitchSide: -1, _pickupCollectPulse: .7 };
tickPlayerWeaponAnimationPolish(player, 1 / 60, { ads: 0.9, speed: 1.2, lowAmmo: 0.8, weaponWeight: 1.1 });
const ps = buildPlayerWeaponAnimationPolishSnapshot(player);
assert(ps.ready >= 0 && ps.urgency > 0 && ps.finite, 'player weapon polish snapshot invalid');
assert(ps.switchPulse > 0.5 && ps.switchSide === -1 && ps.pickupCollectPulse > 0.5, 'player switch/pickup pulses missing');
const stance = tickPlayerCombatStancePolish(player, 1 / 60, {
  ads: 0.85,
  speed: 6.5,
  sprint: 0.35,
  slide: 0.1,
  lowAmmo: 0.8,
  reload: { active: true, pressure: 0.65, fumble: 0.24 },
  incoming: { pressure: 0.72, threat: 0.68 },
  gunplay: { followThroughHold: 0.62, sightReturnBoost: 0.48, burstDisciplinePulse: 0.44 },
  damage: { weaponDrop: 0.28, movementStagger: 0.18 },
  storyDirector: { recovery: 0.25, chainWindow: 0.2 },
  weapon: ps
});
const stancePure = buildPlayerCombatStanceSnapshot(player, { ads: 0.85, speed: 6.5, reload: { active: true, pressure: 0.65 }, incoming: { pressure: 0.72, threat: 0.68 }, gunplay: { followThroughHold: 0.62 } });
assert(stance.finite && stance.pressure > 0.05 && stance.reloadShield > 0.04 && Math.abs(stance.viewmodelRoll) > 0.001, 'player combat stance snapshot invalid');
assert(stancePure.label === 'reload-stance' || stancePure.pressure > 0.3, 'player combat stance pure builder invalid');

console.log(JSON.stringify({
  ok: true,
  version: GAMEPLAY_ANIMATION_POLISH_VERSION,
  enemy: { limp: snap.limp, arm: snap.arm, aimPenalty: snap.aimPenalty, signal: snap.signalPulse, pinnedMs: pinned.durationMs },
  player: { ready: ps.ready, urgency: ps.urgency, switch: ps.switchPulse, pickup: ps.pickupCollectPulse, stance: Number(stance.pressure.toFixed(3)), roll: Number(stance.viewmodelRoll.toFixed(4)) }
}, null, 2));
