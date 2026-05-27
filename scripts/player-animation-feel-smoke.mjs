#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  createPlayerAnimState,
  updatePlayerAnimInputs,
  resolvePlayerAnimLayers,
  updatePlayerAnimTransitionHealth,
  getPlayerAnimDebug,
  getMovementAnimState,
  onWeaponFired,
  playerAnimEmitNotify
} from '../src/playerAnimation.js';
import {
  getLocomotionFeelTuning,
  getWeaponSightProfile
} from '../src/animation/profiles.js';
import {
  createLocomotionFeelState,
  updateLocomotionFeelState,
  applyLocomotionFeelToPlayerAnim,
  locomotionFeelDebug
} from '../src/animation/locomotionFeelController.js';
import {
  createWeaponAnimationController,
  updateWeaponAnimationController,
  weaponAnimationDebug
} from '../src/animation/weaponAnimationController.js';
import {
  createHandGripState,
  updateHandGripState,
  handGripDebug
} from '../src/animation/handGripController.js';
import { resolveEnemyAnimationStatus } from '../src/animation/enemyAnimationController.js';
import { buildAnimationHealthReport } from '../src/animation/health.js';

function assertFiniteObject(obj, label) {
  for (const [key, value] of Object.entries(obj || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) assertFiniteObject(value, `${label}.${key}`);
    else if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label}.${key} must be finite`);
  }
}

function makePlayer() {
  return {
    pos: { x: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: true,
    running: false,
    sprintBlend: 0,
    sprintAmt: 0,
    crouching: false,
    crouchAmt: 0,
    sliding: false,
    slideAmt: 0,
    slideLocalR: 0,
    slideLocalF: 1,
    vaulting: false,
    vaultT: 0,
    vaultDir: 'forward',
    dropkickActive: false,
    dropkickT: 0,
    dropkickDur: 0.62,
    dropkickLandTimer: 0,
    dropkickLandDur: 0.42,
    wallJumpTimer: 0,
    wallJumpDur: 0.24,
    wallJumpSide: 0,
    wallJumpImpact: 0,
    vy: 0,
    landKick: 0,
    jumpH: 0,
    ads: 0,
    adsVis: 0,
    adsTarget: 0,
    adsSettle: 0,
    scopeSettle: 0,
    adsKick: 0,
    reloading: false,
    reloadTimer: 0,
    RELOAD_TIME: 1.4,
    weaponIdx: 0,
    hp: 100,
    maxHp: 100,
    dmgRoll: 0,
    dmgPitch: 0,
    focusActive: false,
    _moveSpeedSmooth: 0,
    _moveAccel: 0,
    _counterStrafePulse: 0,
    _combatFlow: 0,
    _jumpInputPulse: 0,
    _killFlowPulse: 0,
    _nearMissPulse: 0,
    _nearMissSide: 1,
    _damageShock: 0,
    _damageShockSide: 1,
    _turnDrivePulse: 0,
    _turnDriveSide: 0,
    _landingSlidePulse: 0,
    _slidePower: 1,
    _slideAnimSide: 1
  };
}

function step(anim, feel, player, keys = {}, options = {}) {
  const frames = options.frames || 1;
  const dt = options.dt || 1 / 60;
  const dx = options.dx || 0;
  const dz = options.dz || 0;
  let now = options.now || 1;
  for (let i = 0; i < frames; i++) {
    player.pos.x += dx;
    player.pos.z += dz;
    updatePlayerAnimInputs(anim, {
      P: player,
      dt,
      now,
      keys,
      mouseDx: options.mouseDx || 0,
      frameId: (options.frameBase || 0) + i + 1
    });
    resolvePlayerAnimLayers(anim, dt);
    updateLocomotionFeelState(feel, { enabled: true, playerAnimation: anim, dt, now, slot: 0 });
    applyLocomotionFeelToPlayerAnim(anim, feel);
    updatePlayerAnimTransitionHealth(anim, dt);
    now += dt;
  }
}

const tuning = getLocomotionFeelTuning();
assert.equal(tuning.id, 'locomotion-feel.grounded-aaa-v2');
assert.ok(tuning.bodyCarryWeight > 1, 'grounded profile should add body carry');
assert.ok(tuning.transitionSnapThreshold > 0, 'transition snap threshold should be configured');

const anim = createPlayerAnimState({ slot: 0 });
const feel = createLocomotionFeelState({ slot: 0 });
const player = makePlayer();

step(anim, feel, player, {}, { frames: 8 });

player.running = true;
player.sprintBlend = 1;
player.sprintAmt = 1;
player._moveSpeedSmooth = 8.5;
step(anim, feel, player, { KeyW: true }, { frames: 18, dz: 0.10, mouseDx: 1.2 });
let debug = getPlayerAnimDebug(anim);
assert.ok(debug.layerWeights.locomotion.sprint > 0.35, 'sprint layer should blend in');
assert.equal(debug.transitionHealth.snapCount, 0, 'sprint start should not register pose snaps');
assertFiniteObject(debug.resolved, 'sprint.resolved');

player.running = false;
player.sprintBlend = 0;
player.sprintAmt = 0;
player._moveSpeedSmooth = 0.2;
step(anim, feel, player, {}, { frames: 18 });
debug = getPlayerAnimDebug(anim);
assert.equal(debug.transitionHealth.snapCount, 0, 'sprint stop should recover without pose snaps');

player.crouching = true;
player.crouchAmt = 0.45;
step(anim, feel, player, { KeyC: true }, { frames: 10 });
assert.ok(getPlayerAnimDebug(anim).resolved.viewmodel.crouchTuck > 0.02, 'crouch should tuck the viewmodel');
player.crouching = false;
player.crouchAmt = 0;
step(anim, feel, player, {}, { frames: 10 });
assertFiniteObject(getPlayerAnimDebug(anim).resolved, 'crouch.recovered');

player.sliding = true;
player.slideAmt = 1;
player.slideLocalR = -0.7;
player.slideLocalF = 0.8;
player._moveSpeedSmooth = 9;
step(anim, feel, player, { KeyW: true }, { frames: 8, dz: 0.13, frameBase: 100 });
player.sliding = false;
player.slideAmt = 0;
step(anim, feel, player, {}, { frames: 4, frameBase: 120 });
debug = getPlayerAnimDebug(anim);
assert.ok(debug.recentNotifies.some((n) => n.name === 'slideStart'), 'slide start notify should fire');
assert.ok(debug.recentNotifies.some((n) => n.name === 'slideScrape'), 'slide scrape notify should fire');
assert.ok(debug.recentNotifies.some((n) => n.name === 'slideExit'), 'slide exit notify should fire');
assert.ok(debug.notifyStats.rateLimited > 0, 'slide scrape should be rate-limited during repeated frames');

player.grounded = false;
player.vy = 6.2;
player.jumpH = 0.4;
step(anim, feel, player, { KeyW: true }, { frames: 8, dz: 0.04, frameBase: 150 });
player.vy = 0.2;
step(anim, feel, player, {}, { frames: 6, frameBase: 170 });
player.vy = -5.2;
step(anim, feel, player, {}, { frames: 8, frameBase: 190 });
player.grounded = true;
player.vy = 0;
player.landKick = 0.16;
step(anim, feel, player, {}, { frames: 5, frameBase: 220 });
debug = getPlayerAnimDebug(anim);
assert.ok(debug.recentNotifies.some((n) => n.name === 'landHeavy'), 'heavy landing notify should fire');
assertFiniteObject(debug.resolved, 'jump-land.resolved');

player.ads = 1;
player.adsVis = 1;
player.adsSettle = 1;
player.scopeSettle = 1;
step(anim, feel, player, {}, { frames: 12, frameBase: 250 });
const sight = getWeaponSightProfile(0);
assert.ok(Math.min(sight.maxResidualNdc, tuning.adsAlignmentTolerance) <= 0.015, 'ADS tolerance should remain strict for iron sights');
assert.ok(Math.abs(getPlayerAnimDebug(anim).resolved.viewmodel.adsMicroRoll) <= 0.003, 'ADS micro roll should stay sight-safe');

onWeaponFired(anim, player.weaponIdx, 0);
player.reloading = true;
player.RELOAD_TIME = 1.4;
player.reloadTimer = 1.4 * 0.12;
step(anim, feel, player, {}, { frames: 1, frameBase: 300 });
debug = getPlayerAnimDebug(anim);
for (const name of ['triggerPull', 'muzzleFlash', 'magOut', 'magIn', 'chamber', 'boltForward']) {
  assert.ok(debug.recentNotifies.some((n) => n.name === name), `${name} notify should be present`);
}

player.reloading = false;
player._nearMissPulse = 1;
player._nearMissSide = -1;
player._damageShock = 0.75;
player._damageShockSide = 1;
step(anim, feel, player, {}, { frames: 4, frameBase: 330 });
const movement = getMovementAnimState(anim);
assert.equal(movement.runtimePulses.nearMissSide, -1);
assert.equal(movement.runtimePulses.damageShockSide, 1);
assertFiniteObject(getPlayerAnimDebug(anim).resolved, 'threat-pulse.resolved');

playerAnimEmitNotify(anim, 500, 'inspectFocusPoint', { slot: 0 });
playerAnimEmitNotify(anim, 500, 'inspectFocusPoint', { slot: 0 });
assert.ok(getPlayerAnimDebug(anim).notifyStats.deduped > 0, 'same-frame notify dedupe should be counted');

const weapon = createWeaponAnimationController();
updateWeaponAnimationController(weapon, {
  dt: 1 / 60,
  weaponIdx: 0,
  ads: 0.4,
  sprint: 0.2,
  shotImpulse: 0.75,
  footstepKick: getPlayerAnimDebug(anim).resolved.viewmodel.footstepKick,
  bodyCarry: 1,
  landing: 0.7,
  wallKick: 0.4,
  dropkick: 0.2,
  hasAuthoredParts: false,
  notifies: debug.recentNotifies
});
const weaponDebug = weaponAnimationDebug(weapon);
assert.ok(weaponDebug.bodyCarry > 0, 'weapon controller should expose body carry');
assert.ok(weaponDebug.settle > 0, 'weapon controller should expose settle');
assertFiniteObject(weaponDebug.pose, 'weapon.pose');

const handGrip = createHandGripState({ weaponIdx: 0 });
updateHandGripState(handGrip, {
  dt: 1 / 60,
  weaponIdx: 0,
  ads: 0.82,
  sprint: 0.15,
  reloading: false,
  reloadProgress: 0,
  shotImpulse: 0.8,
  partMotion: { trigger: 1, supportBrace: 0.95, slide: 0.25, chamber: 0.12 },
  hasAuthoredWeaponParts: false
});
const handGripStatus = handGripDebug(handGrip);
assert.equal(handGripStatus.placement.nonFiniteEvents, 0, 'hand grip placement should not produce non-finite offsets');
assert.ok(handGripStatus.placement.rightAnchor > 0, 'right hand should anchor under ADS/fire tension');
assert.ok(handGripStatus.placement.supportAnchor > 0, 'support hand should anchor under ADS/fire tension');
assert.ok(handGripStatus.placement.maxOffset <= 0.25, 'hand additive offsets should stay inside placement envelope');
assert.ok(handGripStatus.placement.maxRotation <= 0.78, 'hand additive rotations should stay inside placement envelope');
assertFiniteObject(handGripStatus.offsets, 'handGrip.offsets');

const enemy = {
  type: 'scout',
  animationState: 'peek',
  _movementMode: 'flank',
  _moveVelX: 2.2,
  _moveVelZ: 1.1,
  aimReady: 0.8,
  peekAmt: 0.7,
  atCover: true,
  strafeDir: -1,
  group: { userData: {} }
};
const beforeMode = enemy._movementMode;
const enemyStatus = resolveEnemyAnimationStatus(enemy, { importedAnimationEnabled: false });
assert.equal(enemy._movementMode, beforeMode, 'enemy animation status must not mutate AI movement mode');
assert.ok(enemyStatus.intentCue.headLead > 0, 'enemy peek should expose head lead cue');
assert.ok(enemyStatus.intentCue.weaponRaise > 0, 'enemy aim should expose weapon raise cue');
assertFiniteObject(enemyStatus.intentCue, 'enemy.intentCue');

const deathStatus = resolveEnemyAnimationStatus({
  type: 'heavy',
  dead: true,
  animationState: 'death',
  group: { userData: {} }
}, { importedAnimationEnabled: false });
assert.ok(deathStatus.intentCue.deathCollapse > 0, 'death should expose collapse cue');

const locomotionDebug = locomotionFeelDebug(feel);
assert.ok(locomotionDebug.magnitudes.camera >= 0, 'locomotion magnitude debug should exist');
assertFiniteObject(locomotionDebug.additive, 'locomotion.additive');

const health = buildAnimationHealthReport({
  settings: { importedAnimationEnabled: false },
  playerAnimation: getPlayerAnimDebug(anim),
  weaponAnimation: weaponDebug,
  handGrip: handGripStatus,
  locomotionFeel: locomotionDebug,
  enemyAnimation: [enemyStatus, deathStatus]
});
assert.equal(health.ok, true, `animation health should be ok: ${JSON.stringify(health.issues)}`);

console.log(JSON.stringify({
  ok: true,
  tuning: tuning.id,
  transitionHealth: getPlayerAnimDebug(anim).transitionHealth,
  notifyStats: getPlayerAnimDebug(anim).notifyStats,
  locomotionMagnitudes: locomotionDebug.magnitudes,
  weapon: { bodyCarry: weaponDebug.bodyCarry, settle: weaponDebug.settle },
  handGrip: handGripStatus.placement,
  enemyIntent: enemyStatus.intentCue,
  health: { ok: health.ok, warnings: health.warnings.length }
}, null, 2));
