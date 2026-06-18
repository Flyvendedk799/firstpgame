import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAMEPLAY_ANIMATION_POLISH_VERSION,
  buildEnemyHitReactionProfile,
  recordEnemyCombatStressAnimationPolish,
  recordEnemyHitAnimationPolish,
  buildEnemyAnimationPolishSnapshot
} from '../src/game/gameplayAnimationPolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const polish = readFileSync(join(root, 'src/game/gameplayAnimationPolish.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(GAMEPLAY_ANIMATION_POLISH_VERSION === 'gameplay-animation-polish.v6', 'unexpected animation polish version');
assert(polish.includes('buildEnemyHitReactionProfile'), 'hit reaction profile builder missing');
assert(polish.includes('weaponDrop'), 'weapon drop output missing');
assert(polish.includes('kneeBuckle'), 'knee buckle output missing');
assert(polish.includes('coverBreak'), 'cover break output missing');
assert(polish.includes('guardClutch'), 'guard clutch output missing');
assert(polish.includes('balanceLoss'), 'balance loss output missing');
assert(polish.includes('weaponSlip'), 'weapon slip output missing');
assert(polish.includes('rootDragPulse'), 'root drag recovery pulse missing');
assert(polish.includes('recoveryStepPulse'), 'recovery step pulse missing');
assert(polish.includes('turnLockPulse'), 'turn lock pulse missing');
assert(polish.includes('shotInterruptPulse'), 'shot interrupt pulse missing');
assert(polish.includes('attackInterrupt'), 'hit reaction attack interrupt output missing');
assert(polish.includes('weaponRecovery'), 'hit reaction weapon recovery output missing');
assert(polish.includes('reactionLockMs'), 'hit reaction lock duration missing');
assert(polish.includes('recordEnemyCombatStressAnimationPolish'), 'combat stress recorder missing');
assert(polish.includes('combatStressPulse'), 'combat stress pulse missing');
assert(main.includes('this._hitReactionProfile=_hitReactionProfile'), 'enemy does not store hit reaction profile');
assert(main.includes('this._weaponDropPulse'), 'enemy weapon drop pulse not wired');
assert(main.includes('this._kneeBucklePulse'), 'enemy knee buckle pulse not wired');
assert(main.includes('this._guardClutchPulse'), 'enemy guard clutch pulse not wired');
assert(main.includes('this._weaponSlipPulse'), 'enemy weapon slip pulse not wired');
assert(main.includes('impactAnimation'), 'enemy impact animation debug payload missing');
assert(main.includes('group.userData.hitReactionProfile'), 'runtime hit reaction debug payload missing');
assert(main.includes('react.staggerMul'), 'bullet/melee stagger does not use reaction profile');
assert(main.includes('react.snapStrength'), 'bullet snap does not use reaction profile');
assert(main.includes('function _applyEnemyWoundedGameplayState') && main.includes("version:'enemy-wounded-gameplay.v1'"), 'wounded gameplay helper missing');
assert(main.includes('_applyEnemyWoundedGameplayState(this,limbId,dmg,_hitReactionProfile,isMelee)'), 'wounded gameplay helper not called from damage path');
assert(main.includes('fireDelayMul') && main.includes('_woundedRetreatUntil'), 'wounded fire delay/retreat state missing');
assert(main.includes("kind:finishable?'finishable':'wounded'"), 'wounded gameplay does not record combat stress');
assert(main.includes('_attackDisruptedUntil') && main.includes('combatDisruption'), 'combat disruption runtime/debug missing');

const enemy = {
  type: 'soldier',
  staggerDir: { x: -1 },
  limbRig: {},
  group: { userData: {} }
};

const head = buildEnemyHitReactionProfile(enemy, {
  limbId: 'head',
  isHead: true,
  damage: 120,
  flags: { sniper: true, impactWeight: 1.5 },
  side: -1
});
const leg = buildEnemyHitReactionProfile(enemy, {
  limbId: 'leftShin',
  damage: 36,
  flags: { smg: true, impactWeight: 0.82 },
  side: -1
});
const arm = buildEnemyHitReactionProfile(enemy, {
  limbId: 'rightForearm',
  damage: 44,
  flags: { pistolHeavy: true, impactWeight: 1.08 },
  side: 1
});

assert(head.impactClass === 'break', 'head sniper profile should be break class');
assert(head.headWhip > leg.headWhip, 'head hit should produce stronger head whip than leg hit');
assert(leg.kneeBuckle > arm.kneeBuckle, 'leg hit should produce stronger knee buckle than arm hit');
assert(arm.weaponDrop > leg.weaponDrop, 'arm hit should produce stronger weapon drop than leg hit');
assert(arm.weaponSlip > leg.weaponSlip, 'arm hit should produce stronger weapon slip than leg hit');
assert(leg.balanceLoss > arm.balanceLoss, 'leg hit should produce stronger balance loss than arm hit');
assert(head.painLook > leg.painLook, 'head hit should produce stronger pain-look than leg hit');
assert(head.hitStopMs > leg.hitStopMs, 'heavy head hit should have longer hit stop than leg hit');
assert(head.attackInterrupt > leg.attackInterrupt, 'head hit should produce stronger attack interrupt than leg hit');
assert(arm.weaponRecovery > leg.weaponRecovery, 'arm hit should produce stronger weapon recovery than leg hit');
assert(head.reactionLockMs > leg.reactionLockMs, 'severe head hit should lock reaction longer than leg hit');
assert(head.finite && leg.finite && arm.finite, 'profiles should be finite');

recordEnemyHitAnimationPolish(enemy, {
  limbId: 'rightForearm',
  damage: 44,
  flags: { pistolHeavy: true, impactWeight: 1.08 },
  nowMs: 1000
});
const snap = buildEnemyAnimationPolishSnapshot(enemy, 1100);
assert(snap.arm > 0.2, 'arm polish snapshot did not react to arm hit');
assert(snap.aimPenalty > 0.2, 'arm hit did not create aim penalty');
assert(snap.weaponSlipPulse > 0.2 && snap.guardClutchPulse > 0.1, 'arm hit did not create weapon slip/clutch pulses');
assert(snap.turnLockPulse > 0.1 && snap.rootDragPulse > 0.1, 'arm hit did not create recovery locomotion pulses');
assert(snap.weaponRecoverPulse > 0.2 && snap.shotInterruptPulse > 0.2, 'arm hit did not create attack disruption pulses');

recordEnemyCombatStressAnimationPolish(enemy, { kind: 'wounded', strength: 1.0, side: -1, nowMs: 1200 });
const stressSnap = buildEnemyAnimationPolishSnapshot(enemy, 1250);
assert(stressSnap.combatStress > 0.4, 'wounded combat stress did not enter polish snapshot');
assert(stressSnap.lastStressEvent === 'wounded', 'wounded combat stress event label missing');

console.log(JSON.stringify({
  ok: true,
  version: GAMEPLAY_ANIMATION_POLISH_VERSION,
  head: {
    impactClass: head.impactClass,
    headWhip: Number(head.headWhip.toFixed(3)),
    hitStopMs: head.hitStopMs
  },
  leg: {
    kneeBuckle: Number(leg.kneeBuckle.toFixed(3)),
    staggerMul: Number(leg.staggerMul.toFixed(3))
  },
  arm: {
    weaponDrop: Number(arm.weaponDrop.toFixed(3)),
    weaponSlip: Number(arm.weaponSlip.toFixed(3)),
    aimBreak: Number(arm.aimBreak.toFixed(3)),
    weaponRecovery: Number(arm.weaponRecovery.toFixed(3))
  },
  stress: {
    combatStress: Number(stressSnap.combatStress.toFixed(3)),
    event: stressSnap.lastStressEvent
  }
}, null, 2));
