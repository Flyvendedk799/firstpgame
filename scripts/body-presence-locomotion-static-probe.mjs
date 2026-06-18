import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BODY_PRESENCE_LOCOMOTION_VERSION,
  buildBodyPresenceLocomotionFrame,
  buildBodyPresenceProbeSample,
  resolveBodyPresenceStrideMatch,
  resolveBodyPresenceYawFrame,
  solveBodyPresenceLegPose
} from '../src/game/bodyPresenceLocomotion.js';
import {
  PLAYER_ANIM_SCHEMA_VERSION,
  createPlayerAnimState,
  updatePlayerAnimInputs,
  resolvePlayerAnimLayers
} from '../src/playerAnimation.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const playerAnimation = readFileSync(join(root, 'src/playerAnimation.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(BODY_PRESENCE_LOCOMOTION_VERSION === 'body-presence-locomotion.v6', 'unexpected body presence locomotion version');
assert(main.includes("from './game/bodyPresenceLocomotion.js'"), 'main body locomotion import missing');
assert(main.includes('solveBodyPresenceLegPose(Object.assign'), 'body leg solver wiring missing');
assert(main.includes('bodyPresenceFootState'), 'body foot debug state missing');
assert(main.includes('locomotionVersion:BODY_PRESENCE_LOCOMOTION_VERSION'), 'body locomotion debug version missing');
assert(main.includes('vaultClearance:Number((liveFrame.vaultClearance||0).toFixed(3))'), 'body vault clearance runtime debug missing');
assert(main.includes('footPlantBias:Number((liveFrame.footPlantBias||0).toFixed(3))'), 'body foot plant runtime debug missing');
assert(main.includes('strideLength:Number((liveFrame.strideLength||0).toFixed(3))'), 'body stride length runtime debug missing');
assert(main.includes('strideSpeedMatch:Number((liveFrame.strideSpeedMatch||0).toFixed(3))'), 'body stride speed-match runtime debug missing');
assert(main.includes('antiSlideBoost:Number((liveFrame.antiSlideBoost||0).toFixed(3))'), 'body anti-slide boost runtime debug missing');
assert(main.includes('footLockReach:Number((liveFrame.footLockReach||0).toFixed(3))'), 'body foot-lock reach runtime debug missing');
assert(main.includes('toeCatch:Number((liveFrame.toeCatch||0).toFixed(3))'), 'body toe-catch runtime debug missing');
assert(main.includes('contactWindow:Number((liveFrame.contactWindow||0).toFixed(3))'), 'body contact window runtime debug missing');
assert(main.includes('soleLock:Number((liveFrame.soleLock||0).toFixed(3))'), 'body sole-lock runtime debug missing');
assert(main.includes('plantedStepComp:Number((liveFrame.plantedStepComp||0).toFixed(3))'), 'body planted step compensation runtime debug missing');
assert(main.includes('legReachClamp:Number((liveFrame.legReachClamp||0).toFixed(3))'), 'body leg reach clamp runtime debug missing');
assert(main.includes('plantStrength:Number((liveFrame.plantStrength||0).toFixed(3))'), 'body plant strength runtime debug missing');
assert(main.includes('vaultKneeClearance:Number((liveFrame.vaultKneeClearance||0).toFixed(3))'), 'body vault knee clearance runtime debug missing');
assert(main.includes('vaultHipClearance:Number((liveFrame.vaultHipClearance||0).toFixed(3))'), 'body vault hip clearance runtime debug missing');
assert(main.includes('lookDownInspection:Number((liveFrame.lookDownInspection||0).toFixed(3))'), 'body look-down inspection runtime debug missing');
assert(main.includes('scene.add(bodyPresenceGrp)'), 'normal body legs should be scene/yaw anchored');
assert(!main.includes('camera.add(bodyPresenceGrp)'), 'normal body legs must not follow camera pitch');
assert(main.includes('camera.add(slideLegsGrp)'), 'slide legs should remain camera-local');
assert(main.includes('followsCameraPitch:false'), 'body presence pitch-follow debug flag missing');
assert(main.includes('resolveBodyPresenceYawFrame'), 'body presence yaw resolver is not wired');
assert(main.includes('slide:THREE.MathUtils.clamp(P.slideAmt||(P.sliding?1:0),0,1)'), 'body presence slide yaw input missing');
assert(main.includes('yawMode:yawFrame.mode'), 'body yaw debug mode missing');
assert(main.includes('slideFollow:!!yawFrame.slideFollow'), 'body slide-follow debug state missing');
assert(main.includes('lowerBodyYawIsolation:Number((yawFrame.lowerBodyYawIsolation||0).toFixed(3))'), 'lower-body yaw isolation debug state missing');
assert(main.includes('world:Object.assign({},bodyPresenceGrp.userData.worldBodyPresence'), 'body world yaw snapshot missing');
assert(main.includes('P.vaulting=!!opts.vault'), 'embodiment vault probe missing');
assert(playerAnimation.includes('heelStrike') && playerAnimation.includes('toeOff') && playerAnimation.includes('strideReach') && playerAnimation.includes('vaultTuck'), 'player lower-body semantic fields missing');
assert(PLAYER_ANIM_SCHEMA_VERSION >= 11, 'player animation schema was not bumped');

const sprintFrame = buildBodyPresenceLocomotionFrame({
  speed: 8.8,
  speedN: 1,
  sprint: 1,
  ads: 0,
  phase: Math.PI * 0.36,
  vis: 0.72,
  kneeBend: 0.18
});
const sprintMatch = resolveBodyPresenceStrideMatch({
  speed: 8.8,
  speedN: 1,
  sprint: 1,
  ads: 0,
  vault: 0,
  land: 0,
  baseStrideLength: 0.78,
  baseCadence: 2.9
});
assert(sprintMatch.movingConfidence > 0.8, 'stride speed match should detect sprint confidence');
assert(sprintMatch.antiSlideBoost > 0.10, 'stride speed match should create anti-slide boost');
assert(sprintMatch.footLockReach > 0.08, 'stride speed match should create foot-lock reach');
assert(sprintMatch.contactWindow > 0.60, 'stride match should lengthen sprint contact window');
assert(sprintMatch.soleLock > 0.20, 'stride match should create sole lock');
assert(sprintMatch.plantedStepComp > 0.08, 'stride match should create planted step compensation');
assert(sprintFrame.strideSpeedMatch > 0.75, 'body frame lost stride speed match');
assert(sprintFrame.antiSlideBoost > 0.10, 'body frame lost anti-slide boost');
assert(sprintFrame.contactWindow > 0.60, 'body frame lost contact window');
assert(sprintFrame.soleLock > 0.20, 'body frame lost sole lock');
assert(sprintFrame.plantedStepComp > 0.08, 'body frame lost planted step compensation');
assert(sprintFrame.legReachClamp > 0.08, 'body frame lost leg reach clamp');
const leftPlant = solveBodyPresenceLegPose({ ...sprintFrame, side: -1, phase: Math.PI * 0.36 });
const rightSwing = solveBodyPresenceLegPose({ ...sprintFrame, side: 1, phase: Math.PI * 0.36 + Math.PI });
assert(leftPlant.state.plantLock > 0.35, 'left stance foot does not plant');
assert(leftPlant.state.antiSlide > 0.60, 'stance foot anti-slide lock too weak');
assert(leftPlant.state.footWorldStabilize > 0.48, 'stance foot world stabilization missing');
assert(leftPlant.state.plantedTravelHold > 0.025, 'stance foot travel hold missing');
assert(leftPlant.state.plantStrength > 0.45, 'stance foot plant strength missing');
assert(leftPlant.state.toeDragSuppression > 0.35, 'stance toe drag suppression missing');
assert(leftPlant.state.footPinning > 0.60, 'stance foot pinning missing');
assert(leftPlant.state.antiSlideBoost > 0.10, 'stance foot anti-slide boost missing');
assert(leftPlant.state.footLockReach > 0.08, 'stance foot lock reach missing');
assert(leftPlant.state.toeCatch > 0.12, 'stance toe catch missing');
assert(leftPlant.state.contactWindow > 0.60, 'stance contact window missing');
assert(leftPlant.state.stanceAnchor > 0.55, 'stance anchor missing');
assert(leftPlant.state.contactTravelHold > 0.08, 'stance contact travel hold missing');
assert(leftPlant.state.soleFlatten > 0.30, 'stance sole flatten missing');
assert(leftPlant.state.ankleCompression > 0.03, 'stance ankle compression missing');
assert(leftPlant.state.stanceCompression > 0.08, 'stance compression missing');
assert(leftPlant.state.strideLength > 0.45, 'sprint stride length too short');
assert(rightSwing.state.swingLift > 0.20, 'opposite foot does not swing/lift');
const leftFootZ = leftPlant.root.z + leftPlant.parts.boot.z;
const rightFootZ = rightSwing.root.z + rightSwing.parts.boot.z;
assert(Math.abs(leftFootZ - rightFootZ) > 0.12, 'feet do not separate through stride');

const heldYaw = resolveBodyPresenceYawFrame({
  viewYaw: Math.PI * 0.72,
  prevYaw: 0,
  moveDx: 0,
  moveDz: 0,
  speed: 0,
  sprint: 0,
  vault: 0,
  dt: 1 / 60
});
assert(heldYaw.mode === 'held-lower-body', 'idle body yaw should hold previous lower-body heading');
assert(Math.abs(heldYaw.yaw) < 0.001, 'idle body yaw should not follow view yaw');
assert(Math.abs(heldYaw.yawDelta) > 1.0, 'idle look yaw delta should remain visible');
assert(heldYaw.lowerBodyYawIsolation > 0.9, 'idle lower body should remain isolated from camera yaw');
assert(!heldYaw.slideFollow, 'idle body should not use slide camera alignment');

const moveYaw = resolveBodyPresenceYawFrame({
  viewYaw: Math.PI * 0.72,
  prevYaw: 0,
  moveDx: 0,
  moveDz: -0.12,
  speed: 7.5,
  sprint: 1,
  vault: 0,
  dt: 1 / 60
});
assert(moveYaw.mode === 'movement-anchored', 'moving body yaw should anchor to travel direction');
assert(moveYaw.finite, 'moving body yaw frame should be finite');
assert(Math.abs(moveYaw.yaw - 0) < 0.55, 'forward movement yaw should stay near world-forward lower-body heading');
assert(moveYaw.lowerBodyYawIsolation > 0.45, 'moving lower body should preserve yaw isolation');

const slideYaw = resolveBodyPresenceYawFrame({
  viewYaw: Math.PI * 0.72,
  prevYaw: 0,
  moveDx: 0,
  moveDz: -0.12,
  speed: 7.5,
  sprint: 1,
  vault: 0,
  slide: 1,
  dt: 1 / 60
});
assert(slideYaw.mode === 'slide-camera-aligned', 'slide body yaw should explicitly follow camera');
assert(slideYaw.slideFollow, 'slide yaw frame should mark camera-aligned slide follow');
assert(slideYaw.lowerBodyYawIsolation < 0.05, 'slide lower body should release yaw isolation');
assert(Math.abs(slideYaw.yaw) > Math.abs(moveYaw.yaw) + 0.05, 'slide yaw should turn toward camera more than regular movement');

const vaultSample = buildBodyPresenceProbeSample({
  speed: 5.0,
  speedN: 0.62,
  sprint: 0.3,
  ads: 0,
  phase: Math.PI * 0.25,
  vis: 0.7,
  vault: 1,
  vaultT: 0.44,
  vaultDir: 'forward',
  lookDown: 0.72,
  kneeBend: 0.34
});
assert(vaultSample.frame.targetPresence > 0.55, 'vault body presence too hidden');
assert(vaultSample.frame.vaultCrest > 0.25, 'vault crest not detected');
assert(vaultSample.frame.vaultClearance > 0.35, 'vault clearance not detected');
assert(vaultSample.frame.vaultFootClearance > 0.28, 'vault foot clearance frame missing');
assert(vaultSample.frame.vaultKneeClearance > 0.24, 'vault knee clearance frame missing');
assert(vaultSample.frame.vaultHipClearance > 0.20, 'vault hip clearance frame missing');
assert(vaultSample.frame.lookDownInspection > 0.30, 'look-down inspection frame missing');
assert(vaultSample.frame.footPlantBias > 0.18, 'body foot plant bias missing');
assert(Math.max(vaultSample.left.state.vaultTuck, vaultSample.right.state.vaultTuck) > 0.45, 'vault leg tuck missing');
assert(Math.max(vaultSample.left.state.vaultClearance, vaultSample.right.state.vaultClearance) > 0.38, 'vault foot clearance missing');
assert(Math.max(vaultSample.left.state.vaultKneeClearance, vaultSample.right.state.vaultKneeClearance) > 0.26, 'vault knee clearance missing');
assert(Math.max(vaultSample.left.state.vaultHipClearance, vaultSample.right.state.vaultHipClearance) > 0.20, 'vault hip clearance missing');
assert(Math.max(vaultSample.left.state.vaultTrailSweep, vaultSample.right.state.vaultTrailSweep) > 0.10, 'vault trailing leg sweep missing');

const anim = createPlayerAnimState({ slot: 0 });
const player = {
  pos: { x: 0, z: 0 },
  yaw: 0,
  grounded: true,
  running: true,
  sprintBlend: 1,
  sprintAmt: 1,
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
  _moveSpeedSmooth: 8.8,
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
for (let i = 0; i < 12; i++) {
  player.pos.z += 0.12;
  updatePlayerAnimInputs(anim, { P: player, dt: 1 / 60, now: 1 + i / 60, keys: { KeyW: true }, frameId: i + 1 });
  resolvePlayerAnimLayers(anim, 1 / 60);
}
assert(anim.resolved.proxy.strideReach > 0.05, 'player stride reach semantic missing');
assert(anim.resolved.proxy.stancePlant >= 0, 'player stance plant semantic invalid');
player.vaulting = true;
player.vaultT = 0.45;
player.grounded = false;
updatePlayerAnimInputs(anim, { P: player, dt: 1 / 60, now: 2, keys: { KeyW: true }, frameId: 40 });
resolvePlayerAnimLayers(anim, 1 / 60);
assert(anim.resolved.proxy.vaultTuck > 0.45, 'player vault tuck semantic missing');

console.log(JSON.stringify({
  ok: true,
  version: BODY_PRESENCE_LOCOMOTION_VERSION,
  sprint: {
    plant: leftPlant.state.plantLock,
    plantStrength: leftPlant.state.plantStrength,
    antiSlide: leftPlant.state.antiSlide,
    toeDragSuppression: leftPlant.state.toeDragSuppression,
    footPinning: leftPlant.state.footPinning,
    stanceAnchor: leftPlant.state.stanceAnchor,
    soleFlatten: leftPlant.state.soleFlatten,
    contactTravelHold: leftPlant.state.contactTravelHold,
    swing: rightSwing.state.swingLift,
    heldYawDelta: Number(heldYaw.yawDelta.toFixed(3))
  },
  vault: {
    target: vaultSample.frame.targetPresence,
    crest: vaultSample.frame.vaultCrest,
    clearance: vaultSample.frame.vaultClearance,
    footClearance: vaultSample.frame.vaultFootClearance,
    kneeClearance: vaultSample.frame.vaultKneeClearance,
    hipClearance: vaultSample.frame.vaultHipClearance,
    tuck: Math.max(vaultSample.left.state.vaultTuck, vaultSample.right.state.vaultTuck)
  },
  proxy: {
    schema: PLAYER_ANIM_SCHEMA_VERSION,
    strideReach: Number(anim.resolved.proxy.strideReach.toFixed(3)),
    vaultTuck: Number(anim.resolved.proxy.vaultTuck.toFixed(3)),
    strideSpeedMatch: Number(sprintFrame.strideSpeedMatch.toFixed(3)),
    antiSlideBoost: Number(sprintFrame.antiSlideBoost.toFixed(3))
  }
}, null, 2));
