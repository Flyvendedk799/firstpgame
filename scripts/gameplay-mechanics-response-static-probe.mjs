import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAMEPLAY_ANIMATION_POLISH_VERSION,
  buildEnemyCombatResponseSnapshot,
  recordEnemyHitAnimationPolish,
  recordEnemySuppressionAnimationPolish,
} from '../src/game/gameplayAnimationPolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const polish = readFileSync(join(root, 'src/game/gameplayAnimationPolish.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function requireSnippet(src, snippet, label) {
  assert(src.includes(snippet), `missing ${label}: ${snippet}`);
}

assert(GAMEPLAY_ANIMATION_POLISH_VERSION === 'gameplay-animation-polish.v6', 'unexpected animation polish version');

for (const snippet of [
  'export function buildEnemyCombatResponseSnapshot',
  'movementMul',
  'aimMul',
  'fireDelayMul',
  'coverBias',
  'guardClutch',
  'weaponSlip',
  'balanceCatch',
  'rootDrag',
  'recoveryStep',
  'turnLock',
  'shotInterrupt',
  'weaponRecovery',
  'painTell',
  'coverBreak',
  'reactionLockMs',
  'return clamp((Number.isFinite(base) ? base : 1) * (response.aimMul || 1), 0.18, 1.2);',
]) {
  requireSnippet(polish, snippet, 'combat response contract');
}

for (const snippet of [
  'buildEnemyCombatResponseSnapshot',
  'enemy._combatResponseSnapshot=response',
  'target*=combatResponse.aimMul||1',
  'combatResponse.coverBias',
  'enemy-hit-recovery-locomotion.v1',
  'attackResponse.fireDelayMul',
  'attackResponse.shotInterrupt',
  '_attackDisruptedUntil',
  "this._poseTarget='reacquire'",
  'this.peekState=',
]) {
  requireSnippet(main, snippet, 'main combat response wiring');
}

const enemy = {
  type: 'soldier',
  staggerDir: { x: 1 },
  group: { userData: {} },
  limbRig: {}
};
recordEnemyHitAnimationPolish(enemy, {
  limbId: 'leftShin',
  damage: 95,
  isHead: false,
  isMelee: false,
  side: -1,
  nowMs: 1000
});
const legResponse = buildEnemyCombatResponseSnapshot(enemy, 1120);
assert(legResponse.active, 'leg hit response should be active');
assert(legResponse.movementMul < 1, 'leg hit should reduce movement multiplier');
assert(legResponse.fireDelayMul > 1, 'heavy leg hit should increase fire delay');
assert(legResponse.source.balanceCatch > 0.2 && legResponse.source.footShuffle > 0.2, 'leg hit should expose balance/shuffle response');
assert(legResponse.source.rootDrag > 0.2 && legResponse.source.recoveryStep > 0.2 && legResponse.source.turnLock > 0.1, 'leg hit should expose recovery locomotion response');
assert(legResponse.shotInterrupt > 0.1 && legResponse.painTell > 0.1 && legResponse.reactionLockMs > 120, 'leg hit should expose disruption response');

const armEnemy = {
  type: 'soldier',
  staggerDir: { x: -1 },
  group: { userData: {} },
  limbRig: {}
};
recordEnemyHitAnimationPolish(armEnemy, {
  limbId: 'rightForearm',
  damage: 82,
  isHead: false,
  isMelee: false,
  side: 1,
  nowMs: 1400
});
const armResponse = buildEnemyCombatResponseSnapshot(armEnemy, 1460);
assert(armResponse.weaponRecovery > legResponse.weaponRecovery, 'arm hit should produce stronger weapon recovery than leg hit');
assert(armResponse.shotInterrupt > 0.2 && armResponse.fireDelayMul > 1.2, 'arm hit should interrupt enemy attack');

recordEnemySuppressionAnimationPolish(enemy, {
  strength: 1.0,
  side: 1,
  nowMs: 1200
});
const suppressedResponse = buildEnemyCombatResponseSnapshot(enemy, 1260);
assert(suppressedResponse.coverBias > legResponse.coverBias, 'suppression should increase cover bias');
assert(suppressedResponse.aimMul < 1, 'suppression should reduce aim multiplier');
assert(suppressedResponse.finite, 'combat response must remain finite');

console.log(JSON.stringify({
  ok: true,
  version: GAMEPLAY_ANIMATION_POLISH_VERSION,
  legResponse: {
    movementMul: Number(legResponse.movementMul.toFixed(3)),
    aimMul: Number(legResponse.aimMul.toFixed(3)),
    fireDelayMul: Number(legResponse.fireDelayMul.toFixed(3)),
    coverBias: Number(legResponse.coverBias.toFixed(3))
  },
  suppressedResponse: {
    movementMul: Number(suppressedResponse.movementMul.toFixed(3)),
    aimMul: Number(suppressedResponse.aimMul.toFixed(3)),
    fireDelayMul: Number(suppressedResponse.fireDelayMul.toFixed(3)),
    coverBias: Number(suppressedResponse.coverBias.toFixed(3))
  },
  armResponse: {
    shotInterrupt: Number(armResponse.shotInterrupt.toFixed(3)),
    weaponRecovery: Number(armResponse.weaponRecovery.toFixed(3)),
    reactionLockMs: armResponse.reactionLockMs
  }
}, null, 2));
