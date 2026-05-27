import { getLocomotionFeelTuning } from './profiles.js';

export const LOCOMOTION_FEEL_VERSION = 1;

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function clamp(v, min, max) {
  const n = Number(v) || 0;
  return Math.max(min, Math.min(max, n));
}

function damp(current, target, lambda, dt) {
  const d = Math.max(0, Number(dt) || 0);
  return target + (current - target) * Math.exp(-Math.max(0, lambda) * d);
}

function smooth01(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function round(v, digits = 5) {
  return Number((Number(v) || 0).toFixed(digits));
}

function add(target, key, value) {
  if (!target || !finite(value) || value === 0) return;
  target[key] = (Number(target[key]) || 0) + value;
}

function roundedRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) out[key] = round(value);
  return out;
}

function rowMagnitude(row) {
  let max = 0;
  for (const value of Object.values(row || {})) {
    if (typeof value === 'number' && Number.isFinite(value)) max = Math.max(max, Math.abs(value));
  }
  return round(max, 5);
}

function sanitizeRow(row) {
  if (!row) return;
  for (const key of Object.keys(row)) {
    if (!Number.isFinite(row[key])) row[key] = 0;
  }
}

function zeroAdditives() {
  return {
    camera: {
      headBobX: 0,
      headBobY: 0,
      headPitch: 0,
      headRoll: 0,
      accelLagX: 0,
      accelLagZ: 0,
      footstepDip: 0,
      footstepRoll: 0,
      sprintStartPitch: 0,
      sprintStopPitch: 0,
      slideDrop: 0,
      slideRoll: 0,
      slideForwardPitch: 0,
      wallKickPitch: 0,
      wallKickRoll: 0,
      dropkickPitch: 0,
      dropkickRoll: 0,
      dropkickDip: 0,
      dropkickForward: 0,
      gaitPitch: 0,
      gaitRoll: 0,
      impactSettlePitch: 0,
      impactSettleRoll: 0
    },
    viewmodel: {
      lagX: 0,
      lagY: 0,
      lagZ: 0,
      runStepX: 0,
      runStepY: 0,
      runStepRoll: 0,
      runStepPitch: 0,
      runInertiaX: 0,
      runInertiaY: 0,
      shoulderSway: 0,
      footstepKick: 0,
      footstepRoll: 0,
      plantDip: 0,
      toePush: 0,
      pivotTuck: 0,
      sprintStartKick: 0,
      sprintStopKick: 0,
      wallKickX: 0,
      wallKickY: 0,
      wallKickZ: 0,
      wallKickPitch: 0,
      wallKickRoll: 0,
      slideTuck: 0,
      landPunch: 0,
      landSettle: 0,
      dropkickTuck: 0,
      dropkickKick: 0,
      dropkickImpact: 0,
      weaponWeightX: 0,
      weaponWeightY: 0,
      weaponWeightZ: 0,
      gaitYaw: 0,
      gaitRoll: 0,
      fingerCurl: 0
    },
    proxy: {
      leanSh: 0,
      footSwing: 0,
      armSwing: 0,
      footPlant: 0,
      sprintPose: 0,
      torsoTwist: 0,
      jumpPose: 0,
      fallPose: 0,
      dropkickPose: 0,
      landSquash: 0,
      shoulderRoll: 0,
      headCounter: 0,
      kneeBend: 0,
      turnLean: 0,
      wallBrace: 0,
      weaponBrace: 0
    }
  };
}

function scaleRow(row, multiplier) {
  const m = Number(multiplier) || 1;
  if (!row || m === 1) return;
  for (const key of Object.keys(row)) row[key] *= m;
}

function scaleKeys(row, keys, multiplier) {
  const m = Number(multiplier) || 1;
  if (!row || m === 1) return;
  for (const key of keys) {
    if (typeof row[key] === 'number') row[key] *= m;
  }
}

function applyFinalLocomotionTuning(addv, tuning) {
  if (!addv || !tuning) return addv;
  scaleRow(addv.camera, tuning.cameraWeight);
  scaleRow(addv.viewmodel, tuning.viewmodelWeight);
  scaleRow(addv.proxy, tuning.proxyWeight);
  scaleKeys(addv.camera, ['headBobX', 'headBobY', 'headPitch', 'headRoll', 'accelLagX', 'accelLagZ', 'braceDip'], tuning.bodyCarryWeight);
  scaleKeys(addv.viewmodel, ['lagX', 'lagY', 'lagZ', 'weaponWeightX', 'weaponWeightY', 'weaponWeightZ', 'shoulderSway'], tuning.bodyCarryWeight);
  scaleKeys(addv.proxy, ['leanSh', 'shoulderRoll', 'headCounter', 'torsoTwist', 'turnLean'], tuning.bodyCarryWeight);
  scaleKeys(addv.camera, ['headBobX', 'headBobY', 'footstepDip', 'footstepRoll', 'gaitPitch', 'gaitRoll'], tuning.gaitWeight);
  scaleKeys(addv.viewmodel, ['runStepX', 'runStepY', 'runStepRoll', 'runStepPitch', 'footstepKick', 'footstepRoll', 'plantDip', 'toePush', 'gaitYaw', 'gaitRoll'], tuning.gaitWeight);
  scaleKeys(addv.proxy, ['footSwing', 'armSwing', 'footPlant'], tuning.gaitWeight);
  scaleKeys(addv.camera, ['headRoll', 'accelLagX', 'impactSettleRoll'], tuning.counterStrafeWeight);
  scaleKeys(addv.viewmodel, ['lagX', 'pivotTuck', 'gaitYaw', 'gaitRoll'], tuning.counterStrafeWeight);
  scaleKeys(addv.proxy, ['leanSh', 'torsoTwist', 'shoulderRoll', 'headCounter', 'turnLean'], tuning.counterStrafeWeight);
  scaleKeys(addv.camera, ['sprintStartPitch', 'sprintStopPitch'], tuning.sprintWeight);
  scaleKeys(addv.viewmodel, ['sprintStartKick', 'sprintStopKick'], tuning.sprintWeight);
  scaleKeys(addv.proxy, ['sprintPose'], tuning.sprintWeight);
  scaleKeys(addv.camera, ['slideDrop', 'slideRoll', 'slideForwardPitch'], tuning.slideWeight);
  scaleKeys(addv.viewmodel, ['slideTuck'], tuning.slideWeight);
  scaleKeys(addv.proxy, ['kneeBend'], tuning.slideWeight);
  scaleKeys(addv.camera, ['wallKickPitch', 'wallKickRoll'], tuning.wallKickWeight);
  scaleKeys(addv.viewmodel, ['wallKickX', 'wallKickY', 'wallKickZ', 'wallKickPitch', 'wallKickRoll'], tuning.wallKickWeight);
  scaleKeys(addv.proxy, ['wallBrace'], tuning.wallKickWeight);
  scaleKeys(addv.camera, ['dropkickPitch', 'dropkickRoll', 'dropkickDip', 'dropkickForward'], tuning.dropkickWeight);
  scaleKeys(addv.viewmodel, ['dropkickTuck', 'dropkickKick', 'dropkickImpact'], tuning.dropkickWeight);
  scaleKeys(addv.proxy, ['dropkickPose'], tuning.dropkickWeight);
  scaleKeys(addv.camera, ['impactSettlePitch', 'impactSettleRoll'], tuning.impactWeight);
  scaleKeys(addv.viewmodel, ['landPunch', 'landSettle'], tuning.impactWeight);
  scaleKeys(addv.proxy, ['landSquash'], tuning.impactWeight);
  sanitizeRow(addv.camera);
  sanitizeRow(addv.viewmodel);
  sanitizeRow(addv.proxy);
  return addv;
}

function locomotionMode(loc, inp) {
  if (inp.dead) return 'dead';
  if (loc.dropkick > 0.15 || inp.dropkick) return 'dropkick';
  if (loc.wallJump > 0.12 || inp.wallJump > 0.08) return 'wallJump';
  if (inp.vaulting) return 'vault';
  if (loc.slide > 0.16 || inp.slideAmt > 0.16) return 'slide';
  if (!inp.grounded && (loc.fall > 0.2 || inp.vy < -0.2)) return 'fall';
  if (!inp.grounded && (loc.jump > 0.2 || inp.vy > 0.2)) return 'jump';
  if (loc.land > 0.12) return 'land';
  if (loc.sprint > 0.35) return 'sprint';
  if (loc.crouch > 0.22) return 'crouch';
  if (loc.walk > 0.08 || inp.moving) return 'walk';
  return 'idle';
}

export function createLocomotionFeelState(options = {}) {
  return {
    version: LOCOMOTION_FEEL_VERSION,
    enabled: options.enabled !== false,
    slot: options.slot | 0,
    mode: 'idle',
    footPhase: 0,
    strideEnergy: 0,
    accelerationLean: 0,
    forwardSurge: 0,
    counterStrafe: 0,
    counterStrafeSide: 0,
    sprintStart: 0,
    sprintStop: 0,
    footCompression: 0,
    slide: 0,
    slideSide: 0,
    wallKick: 0,
    wallSide: 0,
    vault: 0,
    vaultSide: 0,
    dropkick: 0,
    landing: 0,
    tuningId: getLocomotionFeelTuning().id,
    additive: zeroAdditives(),
    fallbackReasons: []
  };
}

export function updateLocomotionFeelState(state, input = {}) {
  const s = state || createLocomotionFeelState(input);
  const dt = Math.max(0, Number(input.dt) || 0);
  if (input.enabled === false) {
    s.enabled = false;
    s.mode = 'disabled';
    s.additive = zeroAdditives();
    s.fallbackReasons = [];
    return s;
  }

  const anim = input.playerAnimation || input.animState || {};
  const tuning = getLocomotionFeelTuning();
  const inp = anim.inputs || input.inputs || {};
  const sm = anim.smoothed || input.smoothed || {};
  const loc = anim.layerWeights?.locomotion || input.locomotion || {};
  const intr = anim.layerWeights?.interaction || input.interaction || {};
  const addv = zeroAdditives();

  const ads = clamp01(inp.ads);
  const adsDamp = Math.max(0.13, 1 - ads * 0.76 * (tuning.adsDampen || 1));
  const speed = clamp01(inp.speed ?? ((inp.moveSpeed || 0) / 10.5));
  const sprint = clamp01(loc.sprint ?? inp.sprintAmt);
  const walk = clamp01(loc.walk ?? (inp.moving ? speed : 0));
  const slide = clamp01(loc.slide || inp.slideAmt);
  const jump = clamp01(loc.jump);
  const fall = clamp01(loc.fall);
  const land = clamp01(loc.land || (sm.landEnv || 0) * 3.5);
  const wall = clamp01(loc.wallJump || sm.wallJumpEnv || inp.wallJump);
  const dropkick = clamp01(loc.dropkick || sm.dropkickEnv || (inp.dropkick ? 1 : 0));
  const vault = clamp01(intr.vault || (inp.vaulting ? 1 : 0));
  const strideEnergyTarget = clamp01((walk * 0.55 + sprint * 1.0) * (tuning.stride || 1) * (1 - slide * 0.55) * (1 - dropkick * 0.85));
  const phase = finite(sm.footPhase) ? sm.footPhase : s.footPhase + dt * (3.2 + sprint * 3.6) * strideEnergyTarget;
  const footWave = Math.sin(phase);
  const footHalf = Math.cos(phase * 0.5);
  const heelStrike = Math.pow(clamp01((Math.abs(footWave) - 0.62) / 0.38), 1.55) * strideEnergyTarget;
  const toeOff = Math.pow(clamp01((Math.cos(phase) - 0.12) / 0.88), 1.45) * strideEnergyTarget;
  const footSide = clamp(sm.footPlantSide || Math.sign(footWave || 1), -1, 1);
  const pivotPulse = clamp01(sm.turnPlantPulse || 0);
  const pivotSide = clamp(sm.pivotSide || inp.turnDriveSide || footSide, -1, 1);
  const accel = clamp((sm.accel || inp.moveAccel || 0) / 18, 0, 1.4);
  const velLX = clamp(sm.velLX || 0, -1.2, 1.2);
  const velLZ = clamp(sm.velLZ || 0, -1.2, 1.2);
  const intentR = clamp(inp.intentR || 0, -1, 1);
  const intentF = clamp(inp.intentF || 0, -1, 1);
  const turnInertia = clamp(sm.turnInertia || 0, -0.18, 0.18);
  const counterPulse = clamp01(inp.counterStrafePulse || pivotPulse * 0.7);
  const counterSide = clamp(pivotSide || intentR || footSide, -1, 1);
  const sprintStart = clamp01(sm.sprintStartEnv || inp.sprintStart);
  const sprintStop = clamp01(sm.sprintStopEnv || inp.sprintStop);
  const slideSide = clamp((sm.slideSide || inp.slideLocalR || 0), -1, 1);
  const slideForward = clamp((sm.slideForward || inp.slideLocalF || 1), -1, 1);
  const wallSide = clamp(sm.wallJumpSide || inp.wallJumpSide || 0, -1, 1);
  const wallShock = clamp01(Math.max(wall, inp.wallJumpImpact || 0));
  const vaultSide = inp.vaultDir === 'left' ? -1 : inp.vaultDir === 'right' ? 1 : 0;
  const vaultPhase = clamp01(inp.vaultT || 0);
  const vaultReach = vault * Math.sin(Math.min(1, vaultPhase / 0.75) * Math.PI);
  const dropkickImpact = clamp01(Math.max(inp.dropkickImpact || 0, inp.dropkickContact || 0, inp.dropkickStop || 0, sm.dropkickLandEnv || 0));
  const landing = clamp01(Math.max(land, sm.dropkickLandEnv || 0));
  const threat = clamp01(Math.max(inp.damageShock || 0, (inp.nearMissPulse || 0) * 0.70) * (tuning.nearMissWeight || 1));
  const threatSide = clamp(inp.damageShockSide || inp.nearMissSide || inp.turnDriveSide || 1, -1, 1);
  const lateralTarget = clamp((-velLX * 0.58 - intentR * 0.18 - turnInertia * 3.4) * adsDamp, -1, 1);
  const surgeTarget = clamp((velLZ * 0.52 + intentF * accel * 0.24 + sprintStart * 0.40 - sprintStop * 0.34) * adsDamp, -1, 1);

  s.enabled = true;
  s.slot = input.slot == null ? s.slot : input.slot | 0;
  s.mode = locomotionMode(loc, inp);
  s.tuningId = tuning.id;
  s.footPhase = phase;
  s.strideEnergy = damp(s.strideEnergy || 0, strideEnergyTarget, strideEnergyTarget > (s.strideEnergy || 0) ? 13 : 9, dt);
  s.accelerationLean = damp(s.accelerationLean || 0, lateralTarget, 11, dt);
  s.forwardSurge = damp(s.forwardSurge || 0, surgeTarget, 10, dt);
  s.counterStrafe = damp(s.counterStrafe || 0, counterPulse, counterPulse > (s.counterStrafe || 0) ? 20 : 11, dt);
  s.counterStrafeSide = counterSide;
  s.sprintStart = damp(s.sprintStart || 0, sprintStart, sprintStart > (s.sprintStart || 0) ? 24 : 9, dt);
  s.sprintStop = damp(s.sprintStop || 0, sprintStop, sprintStop > (s.sprintStop || 0) ? 22 : 10, dt);
  s.footCompression = damp(s.footCompression || 0, Math.max(heelStrike, landing * 0.7), 15, dt);
  s.slide = damp(s.slide || 0, slide, slide > (s.slide || 0) ? 15 : 10, dt);
  s.slideSide = damp(s.slideSide || 0, slideSide, 14, dt);
  s.wallKick = damp(s.wallKick || 0, wallShock, wallShock > (s.wallKick || 0) ? 24 : 9, dt);
  s.wallSide = damp(s.wallSide || 0, wallShock > 0.02 ? wallSide : 0, wallShock > 0.02 ? 20 : 8, dt);
  s.vault = damp(s.vault || 0, vaultReach, vaultReach > (s.vault || 0) ? 18 : 12, dt);
  s.vaultSide = damp(s.vaultSide || 0, vaultReach > 0.02 ? vaultSide : 0, 12, dt);
  s.dropkick = damp(s.dropkick || 0, Math.max(dropkick, dropkickImpact * 0.65), dropkick > (s.dropkick || 0) ? 26 : 12, dt);
  s.landing = damp(s.landing || 0, landing, landing > (s.landing || 0) ? 24 : 12, dt);

  const footEnergy = s.strideEnergy;
  const compression = s.footCompression;
  const lean = s.accelerationLean;
  const surge = s.forwardSurge;
  const counter = s.counterStrafe * s.counterStrafeSide;
  const slideStyle = s.slideSide || (slideForward < -0.05 ? -0.35 : 0.35);
  const slideBack = clamp01(-slideForward);
  const slideForwardOnly = clamp01(slideForward);
  const drop = s.dropkick;

  addv.camera.headBobX = footHalf * footEnergy * 0.0038 * adsDamp + lean * 0.0032 + counter * 0.0028 + threatSide * threat * 0.0028;
  addv.camera.headBobY = -compression * 0.0046 + toeOff * 0.0018 - s.landing * 0.010 + dropkickImpact * -0.010 - threat * 0.0028;
  addv.camera.headPitch = -surge * 0.016 - s.sprintStart * 0.014 + s.sprintStop * 0.018 - s.landing * 0.030 - s.wallKick * 0.050 - dropkickImpact * 0.040 + jump * -0.012 + fall * 0.014 + threat * 0.012;
  addv.camera.headRoll = lean * 0.030 + counter * 0.023 + s.slide * slideStyle * 0.040 + s.wallKick * s.wallSide * 0.056 + s.vault * (s.vaultSide || 0.38) * 0.035 + threatSide * threat * 0.018;
  addv.camera.accelLagX = lean * 0.008;
  addv.camera.accelLagZ = -surge * 0.006;
  addv.camera.footstepDip = -heelStrike * 0.0038 - compression * 0.0028;
  addv.camera.footstepRoll = footSide * heelStrike * 0.0042 + counter * 0.006;
  addv.camera.sprintStartPitch = -s.sprintStart * 0.018;
  addv.camera.sprintStopPitch = s.sprintStop * 0.022;
  addv.camera.slideDrop = -s.slide * (0.026 + slideBack * 0.018 + Math.abs(slideStyle) * 0.010);
  addv.camera.slideRoll = s.slide * slideStyle * (0.055 + slideBack * 0.020);
  addv.camera.slideForwardPitch = s.slide * (0.030 + slideForwardOnly * 0.018 - slideBack * 0.030);
  addv.camera.wallKickPitch = -s.wallKick * 0.060;
  addv.camera.wallKickRoll = s.wallKick * s.wallSide * 0.080;
  addv.camera.dropkickPitch = -drop * 0.070 - dropkickImpact * 0.055;
  addv.camera.dropkickRoll = (inp.dropkickTwirlSide || 1) * (drop * 0.055 + dropkickImpact * 0.060);
  addv.camera.dropkickDip = -drop * 0.032 - dropkickImpact * 0.050;
  addv.camera.dropkickForward = drop * 0.050 - dropkickImpact * 0.030;
  addv.camera.gaitPitch = toeOff * -0.006 + heelStrike * 0.004 - s.footCompression * 0.002;
  addv.camera.gaitRoll = lean * 0.020 + footSide * heelStrike * 0.004 + counter * 0.010;
  addv.camera.impactSettlePitch = s.landing * 0.016 + dropkickImpact * 0.025 + threat * 0.010;
  addv.camera.impactSettleRoll = counter * 0.008 + dropkickImpact * (inp.dropkickTwirlSide || 1) * 0.018 + threatSide * threat * 0.014;

  addv.viewmodel.lagX = lean * 0.014 + counter * 0.006 + s.slide * slideStyle * 0.012 + threatSide * threat * 0.006;
  addv.viewmodel.lagY = -accel * 0.0022 - s.landing * 0.006 - threat * 0.005;
  addv.viewmodel.lagZ = -surge * 0.016 - s.sprintStart * 0.012 + s.sprintStop * 0.010 + s.slide * (-0.020 + slideBack * 0.030) - threat * 0.010;
  addv.viewmodel.runStepX = footHalf * footEnergy * 0.0045 * adsDamp + counter * 0.006;
  addv.viewmodel.runStepY = -heelStrike * 0.0048 - compression * 0.0026 + toeOff * 0.0018;
  addv.viewmodel.runStepRoll = -footHalf * footEnergy * 0.0065 + lean * -0.020 + counter * 0.012 + s.slide * slideStyle * 0.030;
  addv.viewmodel.runStepPitch = footWave * footEnergy * 0.0068 + heelStrike * 0.006 - s.landing * 0.022 + s.slide * 0.018;
  addv.viewmodel.runInertiaX = lean * 0.010;
  addv.viewmodel.runInertiaY = -accel * 0.0026;
  addv.viewmodel.shoulderSway = footSide * heelStrike * 0.004 + counter * 0.004;
  addv.viewmodel.footstepKick = heelStrike * 0.080 + compression * 0.050;
  addv.viewmodel.footstepRoll = footSide * heelStrike * 0.0038 + counter * 0.006;
  addv.viewmodel.plantDip = heelStrike * 0.080 + s.landing * 0.090;
  addv.viewmodel.toePush = toeOff * 0.090;
  addv.viewmodel.pivotTuck = s.counterStrafe * 0.30;
  addv.viewmodel.sprintStartKick = s.sprintStart * 0.28;
  addv.viewmodel.sprintStopKick = s.sprintStop * 0.24;
  addv.viewmodel.wallKickX = s.wallKick * s.wallSide * 0.030;
  addv.viewmodel.wallKickY = s.wallKick * 0.025;
  addv.viewmodel.wallKickZ = -s.wallKick * 0.040;
  addv.viewmodel.wallKickPitch = s.wallKick * 0.090;
  addv.viewmodel.wallKickRoll = -s.wallKick * s.wallSide * 0.120;
  addv.viewmodel.slideTuck = s.slide * (0.055 + slideBack * 0.020 + Math.abs(slideStyle) * 0.018);
  addv.viewmodel.landPunch = s.landing * 0.030 + dropkickImpact * 0.055 + threat * 0.018;
  addv.viewmodel.landSettle = s.landing * 0.18 + dropkickImpact * 0.20 + threat * 0.10;
  addv.viewmodel.dropkickTuck = drop * 0.20 + dropkickImpact * 0.16;
  addv.viewmodel.dropkickKick = drop * 0.20 + dropkickImpact * 0.20;
  addv.viewmodel.dropkickImpact = dropkickImpact * 0.26;
  addv.viewmodel.weaponWeightX = -lean * 0.020 + s.slide * slideStyle * 0.010 + threatSide * threat * 0.004;
  addv.viewmodel.weaponWeightY = -s.landing * 0.004 - heelStrike * 0.002 - threat * 0.003;
  addv.viewmodel.weaponWeightZ = -s.sprintStart * 0.006 + s.sprintStop * 0.004 - s.slide * 0.004 - threat * 0.006;
  addv.viewmodel.gaitYaw = -lean * 0.030 + counter * 0.012 + s.slide * slideStyle * 0.035;
  addv.viewmodel.gaitRoll = -lean * 0.050 + footSide * heelStrike * 0.006 + counter * 0.018 + s.slide * slideStyle * 0.050;
  addv.viewmodel.fingerCurl = clamp01(s.sprintStart * 0.035 + s.slide * 0.035 + s.wallKick * 0.050 + drop * 0.080 + s.landing * 0.045);

  addv.proxy.leanSh = lean * 0.060 + threatSide * threat * 0.040;
  addv.proxy.footSwing = footWave * footEnergy * 0.050 + s.slide * (-0.065 + slideBack * 0.075) - drop * 0.22;
  addv.proxy.armSwing = footHalf * footEnergy * 0.080 + counter * 0.030 + s.slide * slideStyle * 0.045;
  addv.proxy.footPlant = footSide * clamp01(heelStrike * 1.5 + compression) + counter * 0.24;
  addv.proxy.sprintPose = sprint * 0.18 + s.sprintStart * 0.12;
  addv.proxy.torsoTwist = footHalf * sprint * 0.050 + counter * 0.055 + s.slide * slideStyle * 0.15;
  addv.proxy.jumpPose = jump * 0.16;
  addv.proxy.fallPose = fall * 0.14;
  addv.proxy.dropkickPose = drop * 0.25 + dropkickImpact * 0.25;
  addv.proxy.landSquash = s.landing * 0.26 + dropkickImpact * 0.18 + threat * 0.08;
  addv.proxy.shoulderRoll = lean * 0.28 + counter * 0.10 + footSide * heelStrike * 0.035 + threatSide * threat * 0.10;
  addv.proxy.headCounter = -lean * 0.16 - counter * 0.06 - threatSide * threat * 0.05;
  addv.proxy.kneeBend = s.slide * 0.22 + s.landing * 0.28 + heelStrike * 0.12 + s.sprintStop * 0.12;
  addv.proxy.turnLean = lean * 0.40 + counter * 0.34;
  addv.proxy.wallBrace = s.wallKick * 0.35;
  addv.proxy.weaponBrace = clamp01(ads * 0.10 + s.landing * 0.10 + dropkickImpact * 0.12);

  s.additive = applyFinalLocomotionTuning(addv, tuning);
  s.fallbackReasons = [];
  if (!anim.resolved) s.fallbackReasons.push('missing-player-resolved-targets');
  return s;
}

export function applyLocomotionFeelToPlayerAnim(playerAnimation, feelState) {
  if (!playerAnimation || !playerAnimation.resolved || !feelState || feelState.enabled === false) return false;
  const additive = feelState.additive || zeroAdditives();
  const cam = playerAnimation.resolved.camera || (playerAnimation.resolved.camera = {});
  const vm = playerAnimation.resolved.viewmodel || (playerAnimation.resolved.viewmodel = {});
  const proxy = playerAnimation.resolved.proxy || (playerAnimation.resolved.proxy = {});
  for (const [key, value] of Object.entries(additive.camera || {})) add(cam, key, value);
  for (const [key, value] of Object.entries(additive.viewmodel || {})) add(vm, key, value);
  for (const [key, value] of Object.entries(additive.proxy || {})) add(proxy, key, value);
  playerAnimation.locomotionFeel = locomotionFeelDebug(feelState);
  return true;
}

export function locomotionFeelDebug(state) {
  const s = state || createLocomotionFeelState();
  return {
    version: s.version || LOCOMOTION_FEEL_VERSION,
    enabled: s.enabled !== false,
    slot: s.slot | 0,
    mode: s.mode || 'idle',
    tuningId: s.tuningId || getLocomotionFeelTuning().id,
    footPhase: round(s.footPhase || 0, 4),
    strideEnergy: round(s.strideEnergy || 0, 4),
    accelerationLean: round(s.accelerationLean || 0, 4),
    forwardSurge: round(s.forwardSurge || 0, 4),
    counterStrafe: round(s.counterStrafe || 0, 4),
    counterStrafeSide: round(s.counterStrafeSide || 0, 4),
    sprintStart: round(s.sprintStart || 0, 4),
    sprintStop: round(s.sprintStop || 0, 4),
    footCompression: round(s.footCompression || 0, 4),
    slide: round(s.slide || 0, 4),
    slideSide: round(s.slideSide || 0, 4),
    wallKick: round(s.wallKick || 0, 4),
    wallSide: round(s.wallSide || 0, 4),
    vault: round(s.vault || 0, 4),
    vaultSide: round(s.vaultSide || 0, 4),
    dropkick: round(s.dropkick || 0, 4),
    landing: round(s.landing || 0, 4),
    additive: {
      camera: roundedRow(s.additive?.camera),
      viewmodel: roundedRow(s.additive?.viewmodel),
      proxy: roundedRow(s.additive?.proxy)
    },
    magnitudes: {
      camera: rowMagnitude(s.additive?.camera),
      viewmodel: rowMagnitude(s.additive?.viewmodel),
      proxy: rowMagnitude(s.additive?.proxy)
    },
    fallbackReasons: Array.isArray(s.fallbackReasons) ? s.fallbackReasons.slice() : []
  };
}
