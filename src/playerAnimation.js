/**
 * Player animation controller — intent/state only; main.js applies to Three.js.
 * @see PLAYER_ANIMATION_IMMERSION_PLAN.md
 */
import { createNotifyRing, resetFrameNotifies, emitPlayerAnimNotify, getRecentNotifies, getNotifyStats } from './playerAnimNotify.js';
import { getLocomotionFeelTuning } from './animation/profiles.js';
import {
  getReloadWeaponClass,
  reloadMagHidden,
  reloadHoloVisualProgress,
  reloadPhaseLabel
} from './reloadTimelines.js';
import { describeGripForDebug, blendFingerCurl, weaponTypeFromIdx } from './viewmodelHandRig.js';

export const PLAYER_ANIM_SCHEMA_VERSION = 11;

function dampL(current, target, lambda, dt) {
  const d = Math.max(0, dt || 0);
  return target + (current - target) * Math.exp(-lambda * d);
}

function smooth01(t) {
  const x = Math.max(0, Math.min(1, t || 0));
  return x * x * (3 - 2 * x);
}

function roundN(v, digits = 5) {
  return Number((Number(v) || 0).toFixed(digits));
}

function maxRowAbs(row) {
  let out = 0;
  for (const value of Object.values(row || {})) {
    if (typeof value === 'number' && Number.isFinite(value)) out = Math.max(out, Math.abs(value));
  }
  return out;
}

function copyPoseSnapshot(resolved) {
  return {
    camera: { ...(resolved?.camera || {}) },
    viewmodel: { ...(resolved?.viewmodel || {}) },
    proxy: { ...(resolved?.proxy || {}) }
  };
}

function resolvedPoseDelta(prev, next) {
  let maxDelta = 0;
  let nonFinite = 0;
  const markerKeys = new Set(['fireSide', 'pivotSide']);
  for (const section of ['camera', 'viewmodel', 'proxy']) {
    const src = next?.[section] || {};
    const old = prev?.[section] || {};
    for (const [key, value] of Object.entries(src)) {
      if (typeof value !== 'number') continue;
      if (markerKeys.has(key)) continue;
      if (!Number.isFinite(value)) {
        nonFinite++;
        src[key] = 0;
        continue;
      }
      const was = Number.isFinite(old[key]) ? old[key] : 0;
      maxDelta = Math.max(maxDelta, Math.abs(value - was));
    }
  }
  return { maxDelta, nonFinite };
}

function dominantLocomotionMode(loc = {}) {
  let best = 'idle';
  let bestWeight = -1;
  for (const [key, value] of Object.entries(loc)) {
    const w = Number(value) || 0;
    if (w > bestWeight) {
      best = key;
      bestWeight = w;
    }
  }
  return best;
}

export function updatePlayerAnimTransitionHealth(state, dt) {
  const tuning = getLocomotionFeelTuning();
  const health = state.transitionHealth;
  const mode = dominantLocomotionMode(state.layerWeights?.locomotion);
  if (health.lastMode !== mode) {
    health.lastMode = mode;
    health.transitionAgeMs = 0;
    health.recoveryMsLeft = tuning.transitionRecoveryMs || 260;
  } else {
    health.transitionAgeMs += Math.max(0, dt || 0) * 1000;
  }
  health.recoveryMsLeft = Math.max(0, (health.recoveryMsLeft || 0) - Math.max(0, dt || 0) * 1000);
  if (health.prevResolved) {
    const delta = resolvedPoseDelta(health.prevResolved, state.resolved);
    health.lastPoseDelta = delta.maxDelta;
    health.maxPoseDelta = Math.max(health.maxPoseDelta || 0, delta.maxDelta);
    health.nonFiniteCount = (health.nonFiniteCount || 0) + delta.nonFinite;
    if (delta.maxDelta > (tuning.transitionSnapThreshold || 0.62)) {
      health.snapCount = (health.snapCount || 0) + 1;
      health.lastSnapFrame = state.flags.frameSeq || 0;
    }
  }
  health.poseMagnitudes = {
    camera: maxRowAbs(state.resolved?.camera),
    viewmodel: maxRowAbs(state.resolved?.viewmodel),
    proxy: maxRowAbs(state.resolved?.proxy)
  };
  health.tuningId = tuning.id;
  health.prevResolved = copyPoseSnapshot(state.resolved);
}

function transitionHealthDebug(health = {}) {
  return {
    version: 1,
    tuningId: health.tuningId || getLocomotionFeelTuning().id,
    lastMode: health.lastMode || 'idle',
    transitionAgeMs: roundN(health.transitionAgeMs || 0, 1),
    recoveryMsLeft: roundN(health.recoveryMsLeft || 0, 1),
    snapCount: health.snapCount | 0,
    lastSnapFrame: health.lastSnapFrame | 0,
    lastPoseDelta: roundN(health.lastPoseDelta || 0, 5),
    maxPoseDelta: roundN(health.maxPoseDelta || 0, 5),
    nonFiniteCount: health.nonFiniteCount | 0,
    poseMagnitudes: {
      camera: roundN(health.poseMagnitudes?.camera || 0, 5),
      viewmodel: roundN(health.poseMagnitudes?.viewmodel || 0, 5),
      proxy: roundN(health.poseMagnitudes?.proxy || 0, 5)
    }
  };
}

const FIRE_VISUAL = {
  0: { dur: 0.22, kickRX: 0.28, kickRZ: 0.065, kickY: 0.008, kickZ: 0.015, driftX: 0.0026, autoBurstMul: 1 },
  1: { dur: 0.40, kickRX: 0.76, kickRZ: 0.18, kickY: 0.024, kickZ: 0.042, driftX: 0, autoBurstMul: 0 },
  3: { dur: 0.42, kickRX: 0.50, kickRZ: 0.18, kickY: 0.024, kickZ: 0.048, driftX: 0, autoBurstMul: 0 },
  4: { dur: 0.14, kickRX: 0.115, kickRZ: 0.030, kickY: 0.004, kickZ: 0.006, driftX: 0.0032, autoBurstMul: 1.10 },
  5: { dur: 0.32, kickRX: 0.42, kickRZ: 0.095, kickY: 0.014, kickZ: 0.026, driftX: 0, autoBurstMul: 0 },
  6: { dur: 0.34, kickRX: 0.54, kickRZ: 0.125, kickY: 0.017, kickZ: 0.030, driftX: 0, autoBurstMul: 0 },
  7: { dur: 0.38, kickRX: 0.56, kickRZ: 0.12, kickY: 0.017, kickZ: 0.034, driftX: 0, autoBurstMul: 0 }
};

const MOTION_VISUAL = {
  0: { bob: 1.04, inertia: 1.08, land: 1.06, adsSteady: 1.00, finger: 1.06 },
  1: { bob: 0.82, inertia: 0.74, land: 0.82, adsSteady: 1.18, finger: 1.20 },
  3: { bob: 1.12, inertia: 1.24, land: 1.20, adsSteady: 0.92, finger: 1.00 },
  4: { bob: 0.96, inertia: 0.90, land: 0.92, adsSteady: 1.05, finger: 1.16 },
  5: { bob: 1.06, inertia: 1.16, land: 1.10, adsSteady: 0.98, finger: 1.02 },
  6: { bob: 0.80, inertia: 0.70, land: 0.78, adsSteady: 1.20, finger: 1.22 },
  7: { bob: 1.10, inertia: 1.28, land: 1.24, adsSteady: 0.94, finger: 0.98 }
};

function getMotionVisualProfile(weaponIdx) {
  return MOTION_VISUAL[weaponIdx] || MOTION_VISUAL[0];
}

export function getFireVisualProfile(weaponIdx, burstIndex) {
  const base = FIRE_VISUAL[weaponIdx] || FIRE_VISUAL[0];
  const bi = burstIndex | 0;
  const climb = base.autoBurstMul && bi > 0 ? 1 + Math.min(8, bi) * 0.045 * base.autoBurstMul : 1;
  return {
    dur: base.dur,
    kickRX: base.kickRX * climb,
    kickRZ: base.kickRZ * (1 + Math.min(5, bi) * 0.02),
    kickY: base.kickY * climb,
    kickZ: base.kickZ * climb,
    driftX: base.driftX,
    burstIndex: bi
  };
}

export function createPlayerAnimState(opts) {
  const slot = (opts && opts.slot) | 0;
  return {
    version: PLAYER_ANIM_SCHEMA_VERSION,
    slot,
    inputs: {},
    smoothed: {
      velLX: 0,
      velLZ: 0,
      accel: 0,
      footPhase: 0,
      turnInertia: 0,
      landEnv: 0,
      airEnv: 0,
      jumpEnv: 0,
      fallEnv: 0,
      apexEnv: 0,
      sprintEnv: 0,
      sprintStartEnv: 0,
      sprintStopEnv: 0,
      footstepPulse: 0,
      footPlantPulse: 0,
      footPlantRecover: 0,
      toeOffPulse: 0,
      stepReachPulse: 0,
      footPlantSide: 0,
      turnPlantPulse: 0,
      pivotSide: 0,
      cadencePower: 0,
      wallJumpEnv: 0,
      wallJumpSide: 0,
      dropkickEnv: 0,
      dropkickLandEnv: 0,
      slideEnv: 0,
      slideSide: 0,
      slideForward: 0,
      crouchEnv: 0,
      strafeLean: 0,
      breathPhase: 0,
      idleMicroPhase: 0,
      gaitLean: 0,
      gaitShoulder: 0,
      adsHold: 0,
      adsShoulderSettle: 0,
      prevAds: 0,
      weaponSettle: 0,
      combatReady: 0,
      fireSnap: 0,
      fireRecover: 0,
      fireTail: 0,
      prevPx: null,
      prevPz: null,
      prevVy: null
    },
    layerWeights: {
      locomotion: { idle: 1, walk: 0, sprint: 0, crouch: 0, slide: 0, jump: 0, fall: 0, land: 0, wallJump: 0, dropkick: 0 },
      weaponPose: { hip: 1, ads: 0, sprintLow: 0, reload: 0, fire: 0, inspect: 0, swap: 0 },
      interaction: { vault: 0, quickThrow: 0, pistolWhip: 0, execution: 0, grenadeThrow: 0 },
      additive: { damageFlinch: 0, suppression: 0, breath: 0, focus: 0, lean: 0, landing: 0 },
      camera: { bob: 1, turnInertia: 1, kick: 1 },
      proxy: { mirror: 1 }
    },
    resolved: {
      camera: {
        headBobX: 0,
        headBobY: 0,
        headRoll: 0,
        headPitch: 0,
        accelLagX: 0,
        accelLagZ: 0,
        turnLagYaw: 0,
        turnLagRoll: 0,
        landDip: 0,
        landRebound: 0,
        airFloat: 0,
        footstepDip: 0,
        footstepRoll: 0,
        sprintStartPitch: 0,
        sprintStopPitch: 0,
        sprintLeanPitch: 0,
        wallKickPitch: 0,
        wallKickRoll: 0,
        dropkickPitch: 0,
        dropkickRoll: 0,
        dropkickDip: 0,
        dropkickForward: 0,
        slideDrop: 0,
        slideRoll: 0,
        slideForwardPitch: 0,
        adsShoulderPitch: 0,
        adsSettleRoll: 0,
        adsSettleY: 0,
        breathX: 0,
        breathY: 0,
        gaitRoll: 0,
        gaitPitch: 0,
        braceDip: 0,
        impactSettlePitch: 0,
        impactSettleRoll: 0
      },
      viewmodel: {
        lagX: 0,
        lagY: 0,
        lagZ: 0,
        shoulderPump: 0,
        slideTuck: 0,
        crouchTuck: 0,
        landWrist: 0,
        airLift: 0,
        fallDrop: 0,
        apexFloat: 0,
        landPunch: 0,
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
        pivotSide: 0,
        sprintStartKick: 0,
        sprintStopKick: 0,
        wallKickX: 0,
        wallKickY: 0,
        wallKickZ: 0,
        wallKickPitch: 0,
        wallKickRoll: 0,
        dropkickTuck: 0,
        dropkickKick: 0,
        dropkickImpact: 0,
        adsSettleX: 0,
        adsSettleY: 0,
        adsSettleZ: 0,
        adsSettlePitch: 0,
        adsSettleRoll: 0,
        breathX: 0,
        breathY: 0,
        idleMicroX: 0,
        idleMicroY: 0,
        idleMicroRoll: 0,
        gaitLift: 0,
        gaitYaw: 0,
        gaitRoll: 0,
        weaponWeightX: 0,
        weaponWeightY: 0,
        weaponWeightZ: 0,
        supportBrace: 0,
        triggerSqueeze: 0,
        fireSnap: 0,
        fireRecover: 0,
        fireTail: 0,
        fireSide: 1,
        combatSettle: 0,
        adsMicroX: 0,
        adsMicroY: 0,
        adsMicroRoll: 0,
        landSettle: 0,
        fingerCurl: 0
      },
      proxy: {
        leanSh: 0,
        adsSh: 0,
        vaultBend: 0,
        wallBrace: 0,
        flinchTwist: 0,
        footSwing: 0,
        armSwing: 0,
        footPlant: 0,
        heelStrike: 0,
        toeOff: 0,
        strideReach: 0,
        stancePlant: 0,
        gaitFootSide: 0,
        sprintPose: 0,
        torsoTwist: 0,
        jumpPose: 0,
        fallPose: 0,
        dropkickPose: 0,
        vaultTuck: 0,
        landSquash: 0,
        shoulderRoll: 0,
        headCounter: 0,
        kneeBend: 0,
        turnLean: 0,
        combatReady: 0,
        weaponBrace: 0,
        deathCollapse: 0
      }
    },
    interaction: {
      vaultPhase: 'idle',
      meleePhase: 'idle',
      throwPhase: 'idle',
      inspectBlend: 0,
      focusBlend: 0
    },
    reload: {
      timelineClass: 'rifle',
      phase: 'idle',
      visualProgress: 0
    },
    lastShotVisual: null,
    notifyRing: createNotifyRing(),
    transitionHealth: {
      version: 1,
      tuningId: getLocomotionFeelTuning().id,
      lastMode: 'idle',
      transitionAgeMs: 0,
      recoveryMsLeft: 0,
      snapCount: 0,
      lastSnapFrame: 0,
      lastPoseDelta: 0,
      maxPoseDelta: 0,
      nonFiniteCount: 0,
      poseMagnitudes: { camera: 0, viewmodel: 0, proxy: 0 },
      prevResolved: null
    },
    flags: {
      slideWas: false,
      sprintWas: false,
      lastFootSign: 0,
      wallJumpWas: false,
      dropkickWas: false,
      dropkickImpactWas: false,
      dropkickLandWas: false,
      landKickWas: 0,
      reloadNotifyStage: 0,
      prevIntentR: 0,
      prevIntentF: 0,
      frameSeq: 0
    },
    eventsConsumed: []
  };
}

export function updatePlayerAnimInputs(state, ctx) {
  const {
    P,
    dt,
    inputDt = dt,
    now,
    keys,
    mouseDx = 0,
    frameId = 0,
    dampFn = dampL
  } = ctx;
  const K = keys || {};
  const moving = !!(K.KeyW || K.KeyS || K.KeyA || K.KeyD);
  const intentR = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
  const intentF = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0);
  const grounded = !!P.grounded;
  const sprintBlend = Math.max(0, Math.min(1, Number.isFinite(P.sprintBlend) ? P.sprintBlend : (P.running ? 1 : (P.sprintAmt || 0))));
  const contactStall = Math.max(0, Math.min(1, P._moveContactStall || 0));
  const moveSpeedN = Math.max(0, Math.min(1, (P._moveSpeedSmooth || 0) / 10.5));
  const speed = moving ? Math.max(0, Math.min(1, moveSpeedN * (1.18 - sprintBlend * 0.08) * (1 - contactStall * 0.76))) : 0;
  const strideDrive = smooth01((speed - 0.035) / 0.36);
  const sprintMoveDrive = smooth01((speed - 0.08) / 0.34);
  const sprintOn = moving && grounded && !P.dropkickActive && !P.vaulting && !P.crouching && sprintBlend > 0.48 && sprintMoveDrive > 0.10;
  const yawDelta = Math.max(-120, Math.min(120, mouseDx || 0));
  const nowSec = Number.isFinite(now) ? now : performance.now() * 0.001;
  const vy = P.vy != null ? P.vy : 0;
  const px = P.pos.x;
  const pz = P.pos.z;
  const yaw = P.yaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let vlx = 0;
  let vlz = 0;
  if (state.smoothed.prevPx != null) {
    const dx = px - state.smoothed.prevPx;
    const dz = pz - state.smoothed.prevPz;
    vlx = dx * rx + dz * rz;
    vlz = dx * fx + dz * fz;
  }
  state.smoothed.prevPx = px;
  state.smoothed.prevPz = pz;
  const dtCl = Math.max(0, dt || 0);
  const inputDtCl = Math.max(0.001, Number.isFinite(inputDt) ? inputDt : dtCl);
  state.smoothed.breathPhase = ((state.smoothed.breathPhase || 0) + dtCl * (0.72 + sprintBlend * 0.22 + (P.focusActive ? -0.18 : 0))) % 62.83;
  state.smoothed.idleMicroPhase = ((state.smoothed.idleMicroPhase || 0) + dtCl * (0.37 + speed * 0.42 + sprintBlend * 0.18)) % 62.83;
  const accel = inputDtCl > 1e-4 ? Math.hypot(vlx - state.smoothed.velLX, vlz - state.smoothed.velLZ) / inputDtCl : 0;
  state.smoothed.velLX = dampL(state.smoothed.velLX, vlx, 10, dtCl);
  state.smoothed.velLZ = dampL(state.smoothed.velLZ, vlz, 10, dtCl);
  state.smoothed.accel = dampL(state.smoothed.accel, Math.min(18, accel), 6, dtCl);
  state.smoothed.sprintEnv = dampFn(
    state.smoothed.sprintEnv || 0,
    moving && grounded && !P.dropkickActive ? sprintBlend * sprintMoveDrive : 0,
    sprintBlend > (state.smoothed.sprintEnv || 0) ? 14 : 8,
    dtCl
  );
  state.smoothed.sprintStartEnv = dampFn(state.smoothed.sprintStartEnv || 0, 0, 7.5, dtCl);
  state.smoothed.sprintStopEnv = dampFn(state.smoothed.sprintStopEnv || 0, 0, 9, dtCl);
  state.smoothed.footstepPulse = dampFn(state.smoothed.footstepPulse || 0, 0, sprintBlend > 0.45 ? 9 : 10.5, dtCl);
  state.smoothed.footPlantPulse = dampFn(state.smoothed.footPlantPulse || 0, 0, sprintBlend > 0.45 ? 13.5 : 15.5, dtCl);
  state.smoothed.footPlantRecover = dampFn(state.smoothed.footPlantRecover || 0, 0, sprintBlend > 0.45 ? 7.5 : 8.5, dtCl);
  state.smoothed.toeOffPulse = dampFn(state.smoothed.toeOffPulse || 0, 0, sprintBlend > 0.45 ? 6.8 : 7.6, dtCl);
  state.smoothed.stepReachPulse = dampFn(state.smoothed.stepReachPulse || 0, 0, sprintBlend > 0.45 ? 9.2 : 10.5, dtCl);
  state.smoothed.footPlantSide = dampFn(state.smoothed.footPlantSide || 0, 0, 5.5, dtCl);
  state.smoothed.turnPlantPulse = dampFn(state.smoothed.turnPlantPulse || 0, 0, 10.5, inputDtCl);
  state.smoothed.pivotSide = dampFn(state.smoothed.pivotSide || 0, 0, 7.5, inputDtCl);
  const stride = (3.25 + sprintBlend * 2.85) * speed * strideDrive * (grounded ? 1 : 0.35) * dtCl;
  state.smoothed.footPhase = (state.smoothed.footPhase + stride) % 62.83;
  const adsNow = Math.max(0, Math.min(1, P.adsVis != null ? P.adsVis : (P.ads || 0)));
  const gaitLeanTarget = grounded && moving
    ? (intentR * (0.055 + sprintBlend * 0.035) - yawDelta * 0.00042 - state.smoothed.velLX * 0.18) * (1 - adsNow * 0.70)
    : yawDelta * -0.00030 * (1 - adsNow * 0.45);
  state.smoothed.gaitLean = dampL(
    state.smoothed.gaitLean || 0,
    Math.max(-0.13, Math.min(0.13, gaitLeanTarget)),
    moving ? 9.5 : 7.5,
    inputDtCl
  );
  state.smoothed.gaitShoulder = dampL(
    state.smoothed.gaitShoulder || 0,
    moving && grounded ? speed * (0.18 + sprintBlend * 0.72) * (1 - adsNow * 0.42) : 0,
    moving ? 8.5 : 11,
    dtCl
  );
  state.smoothed.adsHold = dampL(
    state.smoothed.adsHold || 0,
    adsNow > 0.62 && !P.reloading && !P.dropkickActive ? adsNow : 0,
    adsNow > (state.smoothed.adsHold || 0) ? 7.5 : 11,
    dtCl
  );
  const prevAds = Number.isFinite(state.smoothed.prevAds) ? state.smoothed.prevAds : adsNow;
  const adsRise = Math.max(0, adsNow - prevAds);
  const adsFall = Math.max(0, prevAds - adsNow);
  if (adsRise > 0.045 || adsFall > 0.055) {
    state.smoothed.adsShoulderSettle = Math.max(
      state.smoothed.adsShoulderSettle || 0,
      Math.min(1, adsRise * 3.2 + adsFall * 1.8)
    );
  }
  state.smoothed.adsShoulderSettle = dampL(state.smoothed.adsShoulderSettle || 0, 0, adsNow > prevAds ? 7 : 9.5, dtCl);
  state.smoothed.prevAds = adsNow;
  const shotAge = state.lastShotVisual ? Math.max(0, nowSec - state.lastShotVisual.t) : 999;
  const shotDur = state.lastShotVisual ? Math.max(0.08, state.lastShotVisual.dur || 0.18) : 0.18;
  const shotRaw = Math.max(0, Math.min(1.35, shotAge / shotDur));
  const fireSnapTarget = shotAge < shotDur ? 1 - smooth01((shotRaw - 0.018) / 0.200) : 0;
  const fireRecoverTarget = shotAge < shotDur * 1.25
    ? smooth01((shotRaw - 0.10) / 0.34) * (1 - smooth01((shotRaw - 0.58) / 0.45))
    : 0;
  const fireTailTarget = shotAge < shotDur * 1.45
    ? smooth01((shotRaw - 0.34) / 0.54) * (1 - smooth01((shotRaw - 0.98) / 0.46))
    : 0;
  state.smoothed.fireSnap = dampL(state.smoothed.fireSnap || 0, fireSnapTarget, fireSnapTarget > (state.smoothed.fireSnap || 0) ? 36 : 14, dtCl);
  state.smoothed.fireRecover = dampL(state.smoothed.fireRecover || 0, fireRecoverTarget, fireRecoverTarget > (state.smoothed.fireRecover || 0) ? 18 : 8, dtCl);
  state.smoothed.fireTail = dampL(state.smoothed.fireTail || 0, fireTailTarget, fireTailTarget > (state.smoothed.fireTail || 0) ? 10 : 5.5, dtCl);
  const shotReady = shotAge < 0.42 ? 1 - smooth01(shotAge / 0.42) : 0;
  const combatReadyTarget = Math.max(shotReady * 0.82, Math.min(1, (P._combatFlow || 0) * 0.62 + (P._hitFlowPulse || 0) * 0.24));
  state.smoothed.combatReady = dampL(
    state.smoothed.combatReady || 0,
    combatReadyTarget,
    combatReadyTarget > (state.smoothed.combatReady || 0) ? 18 : 5.5,
    dtCl
  );
  state.smoothed.weaponSettle = dampL(
    state.smoothed.weaponSettle || 0,
    Math.min(1, adsNow * 0.48 + sprintBlend * 0.22 + state.smoothed.combatReady * 0.30 + (P.reloading ? 0.30 : 0)),
    6,
    dtCl
  );
  state.smoothed.cadencePower = dampL(
    state.smoothed.cadencePower || 0,
    moving && grounded ? speed * (0.30 + sprintBlend * 0.46) : 0,
    moving ? 6.5 : 9,
    dtCl
  );
  state.smoothed.turnInertia = dampL(state.smoothed.turnInertia, yawDelta * 0.0041, 11.5, inputDtCl);
  state.smoothed.strafeLean = dampL(state.smoothed.strafeLean, intentR * (1 - Math.abs(P.ads || 0)) * 0.042, 7.5, dtCl);
  const prevIntentR = Number.isFinite(state.flags.prevIntentR) ? state.flags.prevIntentR : 0;
  const prevIntentF = Number.isFinite(state.flags.prevIntentF) ? state.flags.prevIntentF : 0;
  const strafeFlip = grounded && moving && intentR && prevIntentR && Math.sign(intentR) !== Math.sign(prevIntentR);
  const forwardFlip = grounded && moving && intentF && prevIntentF && Math.sign(intentF) !== Math.sign(prevIntentF);
  const turnPlantDrive = grounded && moving
    ? Math.max(
      strafeFlip ? 0.82 : 0,
      forwardFlip ? 0.58 : 0,
      Math.min(0.74, Math.abs(yawDelta) * (sprintBlend > 0.45 ? 0.010 : 0.0065))
    )
    : 0;
  if (turnPlantDrive > 0.08) {
    state.smoothed.turnPlantPulse = Math.max(state.smoothed.turnPlantPulse || 0, turnPlantDrive * (1 - adsNow * 0.35));
    state.smoothed.pivotSide = Math.sign(intentR || yawDelta || prevIntentR || 1) || 1;
  }
  state.flags.prevIntentR = intentR;
  state.flags.prevIntentF = intentF;
  const landKick = P.landKick || 0;
  state.smoothed.landEnv = dampL(state.smoothed.landEnv, landKick, 12, dtCl);
  state.smoothed.airEnv = dampFn(state.smoothed.airEnv, grounded ? 0 : 1, grounded ? 10 : 7, dtCl);
  const jumpIntent = !grounded && vy > 0.45 ? 1 : 0;
  const fallIntent = !grounded && vy < -0.35 ? 1 : 0;
  const apexIntent = !grounded && Math.abs(vy) <= 1.2 ? 1 : 0;
  state.smoothed.jumpEnv = dampFn(state.smoothed.jumpEnv, jumpIntent, jumpIntent ? 13 : 9, dtCl);
  state.smoothed.fallEnv = dampFn(state.smoothed.fallEnv, fallIntent, fallIntent ? 10 : 12, dtCl);
  state.smoothed.apexEnv = dampFn(state.smoothed.apexEnv, apexIntent, apexIntent ? 8 : 10, dtCl);
  const wallJumpDur = Math.max(0.001, P.wallJumpDur || 0.24);
  const wallJump = P.wallJumpTimer > 0 ? Math.max(0, Math.min(1, P.wallJumpTimer / wallJumpDur)) : 0;
  const wallJumpSide = Number.isFinite(P.wallJumpSide) ? P.wallJumpSide : 0;
  const dropkickDur = Math.max(0.001, P.dropkickDur || 0.62);
  const dropkickPhase = P.dropkickActive ? Math.max(0, Math.min(1, (P.dropkickT || 0) / dropkickDur)) : 0;
  const dropkickLandDur = Math.max(0.001, P.dropkickLandDur || 0.42);
  const dropkickLand = P.dropkickLandTimer > 0 ? Math.max(0, Math.min(1, P.dropkickLandTimer / dropkickLandDur)) : 0;
  const dropkickContactDur = Math.max(0.001, P.dropkickContactDur || 0.16);
  const dropkickContact = P.dropkickContactTimer > 0 ? Math.max(0, Math.min(1, P.dropkickContactTimer / dropkickContactDur)) : 0;
  const dropkickStopDur = Math.max(0.001, P._dropkickImpactStopDur || 0.001);
  const dropkickStopRemain = P._dropkickImpactStopTimer > 0 ? Math.max(0, Math.min(1, P._dropkickImpactStopTimer / dropkickStopDur)) : 0;
  const dropkickStopAge = dropkickStopRemain > 0 ? 1 - dropkickStopRemain : 1;
  const dropkickStop = dropkickStopRemain > 0
    ? (1 - smooth01((dropkickStopAge - 0.018) / 0.210)) * Math.max(0.65, Math.min(1.22, P._dropkickImpactStopPower || 1))
    : 0;
  state.smoothed.wallJumpEnv = dampFn(
    state.smoothed.wallJumpEnv,
    wallJump,
    wallJump > state.smoothed.wallJumpEnv ? 22 : 8,
    dtCl
  );
  state.smoothed.wallJumpSide = dampFn(
    state.smoothed.wallJumpSide,
    wallJump > 0.02 ? wallJumpSide : 0,
    wallJump > 0.02 ? 18 : 7,
    dtCl
  );
  state.smoothed.dropkickEnv = dampFn(
    state.smoothed.dropkickEnv,
    P.dropkickActive ? 1 : 0,
    P.dropkickActive ? 34 : 14,
    dtCl
  );
  state.smoothed.dropkickLandEnv = dampFn(
    state.smoothed.dropkickLandEnv,
    dropkickLand,
    dropkickLand > state.smoothed.dropkickLandEnv ? 34 : 14,
    dtCl
  );
  const slideAmt = P.slideAmt || 0;
  state.smoothed.slideEnv = dampFn(state.smoothed.slideEnv, P.sliding || slideAmt > 0.12 ? 1 : 0, 9, dtCl);
  const rawSlideSide = Math.max(-1, Math.min(1, Number.isFinite(P.slideLocalR) ? P.slideLocalR : 0));
  const rawSlideForward = Math.max(-1, Math.min(1, Number.isFinite(P.slideLocalF) ? P.slideLocalF : 1));
  const slideDirActive = P.sliding || slideAmt > 0.05;
  state.smoothed.slideSide = dampFn(state.smoothed.slideSide || 0, slideDirActive ? rawSlideSide : 0, slideDirActive ? 14 : 8, dtCl);
  state.smoothed.slideForward = dampFn(state.smoothed.slideForward || 0, slideDirActive ? rawSlideForward : 0, slideDirActive ? 14 : 8, dtCl);
  const crouchAmt = P.crouchAmt || 0;
  state.smoothed.crouchEnv = dampFn(state.smoothed.crouchEnv, crouchAmt, 6, dtCl);
  state.inputs = {
    moving,
    now: nowSec,
    speed,
    intentR,
    intentF,
    yawDelta,
    grounded,
    vy,
    ads: P.adsVis != null ? P.adsVis : P.ads,
    adsTarget: P.adsTarget || 0,
    adsKick: Number.isFinite(P.adsKick) ? P.adsKick : 0,
    adsSettle: Number.isFinite(P.adsSettle) ? P.adsSettle : 0,
    scopeSettle: Number.isFinite(P.scopeSettle) ? P.scopeSettle : 0,
    sprintBlend,
    reloading: !!P.reloading,
    vaulting: !!P.vaulting,
    vaultT: P.vaultT || 0,
    vaultDir: P.vaultDir || 'forward',
    wallJump,
    wallJumpImpact: P.wallJumpImpact || 0,
    wallJumpSide,
    wallContact: !!P.wallContact,
    dropkick: !!P.dropkickActive,
    dropkickPhase,
    dropkickImpact: Math.max(P.dropkickImpact || 0, dropkickContact),
    dropkickContact,
    dropkickStop,
    dropkickTwirlSide: Number.isFinite(P.dropkickTwirlSide) ? P.dropkickTwirlSide : 1,
    dropkickLand,
    sprintAmt: Math.max(P.sprintAmt || 0, sprintBlend),
    sprintStart: state.smoothed.sprintStartEnv || 0,
    sprintStop: state.smoothed.sprintStopEnv || 0,
    footstepPulse: state.smoothed.footstepPulse || 0,
    footPlantSide: state.smoothed.footPlantSide || 0,
    cadencePower: state.smoothed.cadencePower || 0,
    counterStrafePulse: Number.isFinite(P._counterStrafePulse) ? P._counterStrafePulse : 0,
    combatFlow: Number.isFinite(P._combatFlow) ? P._combatFlow : 0,
    jumpInputPulse: Number.isFinite(P._jumpInputPulse) ? P._jumpInputPulse : 0,
    killFlowPulse: Number.isFinite(P._killFlowPulse) ? P._killFlowPulse : 0,
    nearMissPulse: Number.isFinite(P._nearMissPulse) ? P._nearMissPulse : 0,
    nearMissSide: Number.isFinite(P._nearMissSide) ? P._nearMissSide : 1,
    damageShock: Number.isFinite(P._damageShock) ? P._damageShock : 0,
    damageShockSide: Number.isFinite(P._damageShockSide) ? P._damageShockSide : 1,
    turnDrivePulse: Number.isFinite(P._turnDrivePulse) ? P._turnDrivePulse : 0,
    turnDriveSide: Number.isFinite(P._turnDriveSide) ? P._turnDriveSide : 0,
    landingSlidePulse: Number.isFinite(P._landingSlidePulse) ? P._landingSlidePulse : 0,
    slidePower: Number.isFinite(P._slidePower) ? P._slidePower : 1,
    slideLocalR: rawSlideSide,
    slideLocalF: rawSlideForward,
    slideAnimSide: Number.isFinite(P._slideAnimSide) ? P._slideAnimSide : 1,
    moveSpeed: Number.isFinite(P._moveSpeedSmooth) ? P._moveSpeedSmooth : 0,
    moveAccel: Number.isFinite(P._moveAccel) ? P._moveAccel : 0,
    slideAmt,
    crouchAmt,
    lean: P.lean || 0,
    hpRatio: P.hp / Math.max(1, P.maxHp || 100),
    focusActive: !!P.focusActive,
    suppression: P._suppressionLevel || 0,
    weaponIdx: P.weaponIdx | 0,
    dead: !!P.dead,
    reloadTimer: P.reloadTimer,
    RELOAD_TIME: P.RELOAD_TIME,
    dmgRoll: P.dmgRoll || 0,
    dmgPitch: P.dmgPitch || 0
  };
  resetFrameNotifies(state.notifyRing, frameId);
  const slideOn = !!(P.sliding || slideAmt > 0.12);
  if (slideOn && !state.flags.slideWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'slideStart', { slot: state.slot });
  }
  if (slideOn && (speed > 0.08 || slideAmt > 0.18)) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'slideScrape', {
      slot: state.slot,
      strength: Math.max(0.35, Math.min(1.2, slideAmt + speed * 0.45)),
      side: rawSlideSide
    });
  }
  if (!slideOn && state.flags.slideWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'slideExit', { slot: state.slot });
  }
  state.flags.slideWas = slideOn;
  if (P.reloading && P.RELOAD_TIME > 0 && P.reloadTimer != null) {
    const reloadProgress = Math.max(0, Math.min(1, 1 - P.reloadTimer / P.RELOAD_TIME));
    const stage = state.flags.reloadNotifyStage || 0;
    if (reloadProgress >= 0.18 && stage < 1) {
      emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'magOut', { slot: state.slot, progress: reloadProgress });
      state.flags.reloadNotifyStage = 1;
    }
    if (reloadProgress >= 0.46 && stage < 2) {
      emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'magIn', { slot: state.slot, progress: reloadProgress });
      state.flags.reloadNotifyStage = 2;
    }
    if (reloadProgress >= 0.70 && stage < 3) {
      emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'chamber', { slot: state.slot, progress: reloadProgress });
      state.flags.reloadNotifyStage = 3;
    }
    if (reloadProgress >= 0.84 && stage < 4) {
      emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'boltForward', { slot: state.slot, progress: reloadProgress });
      state.flags.reloadNotifyStage = 4;
    }
  } else {
    state.flags.reloadNotifyStage = 0;
  }
  if (sprintOn && !state.flags.sprintWas) {
    state.smoothed.sprintStartEnv = Math.max(state.smoothed.sprintStartEnv || 0, 1);
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'sprintStart', { slot: state.slot });
  }
  if (!sprintOn && state.flags.sprintWas) {
    state.smoothed.sprintStopEnv = Math.max(state.smoothed.sprintStopEnv || 0, 0.82);
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'sprintStop', { slot: state.slot });
  }
  state.flags.sprintWas = sprintOn;
  const wallJumpOn = wallJump > 0.05;
  if (wallJumpOn && !state.flags.wallJumpWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'wallJump', {
      slot: state.slot,
      side: wallJumpSide
    });
  }
  state.flags.wallJumpWas = wallJumpOn;
  const dropkickOn = !!P.dropkickActive;
  if (dropkickOn && !state.flags.dropkickWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'dropkickStart', { slot: state.slot });
  }
  if (dropkickOn && dropkickPhase >= 0.24 && !state.flags.dropkickImpactWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'dropkickImpact', {
      slot: state.slot,
      phase: dropkickPhase
    });
    state.flags.dropkickImpactWas = true;
  }
  if (!dropkickOn) state.flags.dropkickImpactWas = false;
  state.flags.dropkickWas = dropkickOn;
  const dropkickLandOn = dropkickLand > 0.08;
  if (dropkickLandOn && !state.flags.dropkickLandWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'dropkickLand', { slot: state.slot });
  }
  state.flags.dropkickLandWas = dropkickLandOn;
  if (landKick > (state.flags.landKickWas || 0) + 0.02) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), landKick > 0.12 ? 'landHeavy' : 'landLight', { slot: state.slot });
  }
  state.flags.landKickWas = landKick;
  const foot = state.smoothed.footPhase;
  if (moving && grounded && speed > 0.4) {
    const s = Math.sin(foot);
    const footSign = s >= 0 ? 1 : -1;
    if (Math.abs(s) > 0.965 && state.flags.lastFootSign !== footSign) {
      state.flags.lastFootSign = footSign;
      state.smoothed.footstepPulse = Math.max(state.smoothed.footstepPulse || 0, sprintBlend > 0.45 ? 0.065 : 0.12);
      state.smoothed.footPlantPulse = Math.max(state.smoothed.footPlantPulse || 0, sprintBlend > 0.45 ? 0.11 : 0.19);
      state.smoothed.footPlantRecover = Math.max(state.smoothed.footPlantRecover || 0, sprintBlend > 0.45 ? 0.10 : 0.16);
      state.smoothed.toeOffPulse = Math.max(state.smoothed.toeOffPulse || 0, sprintBlend > 0.45 ? 0.09 : 0.15);
      state.smoothed.stepReachPulse = Math.max(state.smoothed.stepReachPulse || 0, sprintBlend > 0.45 ? 0.085 : 0.16);
      {
        const sideBlend = sprintBlend > 0.45 ? 0.42 : 0.68;
        state.smoothed.footPlantSide = (state.smoothed.footPlantSide || 0) * (1 - sideBlend) + footSign * sideBlend;
      }
      emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), footSign > 0 ? 'footstepRight' : 'footstepLeft', {
        slot: state.slot,
        sprint: sprintBlend > 0.45,
        strength: sprintBlend > 0.45 ? 0.82 : 0.58
      });
    }
  } else {
    state.flags.lastFootSign = 0;
  }
  state.flags.frameSeq = frameId;
  return state;
}

export function resolvePlayerAnimLayers(state, dt) {
  const dtCl = Math.max(0, dt || 0);
  const inp = state.inputs;
  const sm = state.smoothed;
  const loc = state.layerWeights.locomotion;
  const sprintLayer = inp.dead ? 0 : Math.min(1, Math.max(inp.sprintAmt || 0, sm.sprintEnv || 0));
  const vaultW = inp.vaulting ? 1 : 0;
  if (inp.dead) {
    loc.idle = 0;
    loc.walk = 0;
    loc.sprint = 0;
    loc.crouch = 0;
    loc.slide = 0;
    loc.jump = 0;
    loc.fall = 0;
    loc.land = 0;
    loc.wallJump = 0;
    loc.dropkick = 0;
  } else {
    const wallJumpW = Math.min(1, sm.wallJumpEnv * 1.15);
    const dropkickW = Math.min(1, Math.max(sm.dropkickEnv, sm.dropkickLandEnv * 0.65));
    loc.idle = 1 - Math.min(1, inp.speed * 1.2);
    loc.walk = inp.moving && !inp.reloading ? Math.min(1, inp.speed) * (1 - sprintLayer) * (1 - inp.slideAmt) : 0;
    loc.sprint = sprintLayer * (1 - inp.slideAmt) * (1 - inp.ads * 0.9);
    loc.crouch = inp.crouchAmt * (1 - inp.slideAmt);
    loc.slide = inp.slideAmt;
    loc.wallJump = wallJumpW;
    loc.dropkick = dropkickW;
    loc.jump = (!inp.grounded && inp.vy > 0.2 ? 1 : 0) * (1 - wallJumpW * 0.55) * (1 - dropkickW * 0.92) * (1 - vaultW);
    loc.fall = (!inp.grounded && inp.vy <= 0.2 ? 1 : 0) * (1 - wallJumpW * 0.4) * (1 - dropkickW * 0.78) * (1 - vaultW);
    loc.land = sm.landEnv > 0.02 ? Math.min(1, sm.landEnv * 4) : 0;
  }
  const wp = state.layerWeights.weaponPose;
  const fireAge = state.lastShotVisual ? Math.max(0, (inp.now || performance.now() * 0.001) - state.lastShotVisual.t) : 999;
  const fireDur = state.lastShotVisual ? Math.max(0.08, state.lastShotVisual.dur || 0.18) : 0.18;
  const fireRaw = Math.max(0, Math.min(1, fireAge / fireDur));
  const fireW = fireAge < fireDur ? Math.sin((1 - fireRaw) * Math.PI * 0.5) : 0;
  wp.hip = 1 - inp.ads;
  wp.ads = inp.ads;
  wp.sprintLow = sprintLayer * (1 - inp.ads);
  wp.reload = inp.reloading ? 1 : 0;
  wp.fire = Math.max(fireW, (sm.fireSnap || 0) * 0.72, (sm.fireRecover || 0) * 0.32);
  wp.inspect = 0;
  wp.swap = 0;
  const intr = state.layerWeights.interaction;
  intr.vault = inp.vaulting ? 1 : 0;
  intr.quickThrow = 0;
  intr.pistolWhip = 0;
  intr.execution = 0;
  intr.grenadeThrow = 0;
  const ad = state.layerWeights.additive;
  ad.damageFlinch = Math.min(1, (Math.abs(inp.dmgRoll || 0) + Math.abs(inp.dmgPitch || 0)) * 3);
  ad.suppression = Math.min(1, (inp.suppression || 0) * 1.2);
  ad.breath = (1 - inp.ads * 0.5) * 0.25;
  ad.focus = inp.focusActive ? 1 : 0;
  ad.lean = Math.abs(inp.lean || 0);
  ad.landing = loc.land;
  const cam = state.resolved.camera;
  const motion = getMotionVisualProfile(inp.weaponIdx);
  const bobW = (loc.walk * 0.62 + loc.sprint * 1.05 + loc.crouch * 0.24) * motion.bob;
  const adsDamp = Math.max(0.045, 1 - inp.ads * (0.86 + motion.adsSteady * 0.035));
  const sprintStartW = Math.min(1, sm.sprintStartEnv || inp.sprintStart || 0) * (1 - inp.ads * 0.55);
  const sprintStopW = Math.min(1, sm.sprintStopEnv || inp.sprintStop || 0) * (1 - inp.ads * 0.45);
  const footPulse = Math.min(1, sm.footstepPulse || inp.footstepPulse || 0) * (1 - loc.slide * 0.55) * (1 - loc.dropkick * 0.85);
  const plantPulse = Math.min(1, sm.footPlantPulse || 0) * (1 - loc.slide * 0.42) * (1 - loc.dropkick * 0.88);
  const plantRecover = Math.min(1, sm.footPlantRecover || 0) * (1 - loc.slide * 0.35) * (1 - loc.dropkick * 0.88);
  const toePulse = Math.min(1, sm.toeOffPulse || 0) * (1 - loc.slide * 0.45) * (1 - loc.dropkick * 0.88);
  const stepReachPulse = Math.min(1, sm.stepReachPulse || 0) * (1 - loc.slide * 0.45) * (1 - loc.dropkick * 0.88);
  const footSide = Math.max(-1, Math.min(1, sm.footPlantSide || inp.footPlantSide || 0));
  const cadencePower = Math.min(0.88, sm.cadencePower || inp.cadencePower || 0) * adsDamp;
  const adsFocus = smooth01((inp.ads - 0.12) / 0.76);
  const adsSettle = Math.max(0, Math.min(1, inp.adsSettle || 0));
  const adsKick = Math.min(1.2, inp.adsKick || 0);
  const adsUnsettled = adsFocus * Math.max(0, 1 - adsSettle);
  const adsShoulder = adsUnsettled + adsKick * adsFocus * 0.52;
  const counterPulse = Math.min(1, inp.counterStrafePulse || 0) * (1 - inp.ads * 0.55);
  const combatFlow = Math.min(1.35, inp.combatFlow || 0);
  const jumpPulse = Math.min(1, inp.jumpInputPulse || 0);
  const killPulse = Math.min(1.12, inp.killFlowPulse || 0);
  const threatPulse = Math.min(1.35, Math.max(inp.damageShock || 0, (inp.nearMissPulse || 0) * 0.55));
  const turnDrivePulse = Math.min(1, inp.turnDrivePulse || 0);
  const turnDriveSide = Math.max(-1, Math.min(1, inp.turnDriveSide || 0));
  const pivotPulse = Math.min(1, sm.turnPlantPulse || 0) * (1 - loc.slide * 0.30) * (1 - loc.dropkick * 0.78);
  const pivotSide = Math.max(-1, Math.min(1, sm.pivotSide || turnDriveSide || footSide || 0));
  const landingSlidePulse = Math.min(1, inp.landingSlidePulse || 0);
  const slidePower = Math.max(1, Math.min(1.32, inp.slidePower || 1));
  const slideSideRaw = Math.max(-1, Math.min(1, (sm.slideSide || 0) || (inp.slideLocalR || 0)));
  const slideForwardRaw = Math.max(-1, Math.min(1, (sm.slideForward || 0) || (inp.slideLocalF || 0)));
  const slideSideAbs = Math.min(1, Math.abs(slideSideRaw));
  const slideBack = Math.max(0, -slideForwardRaw);
  const slideForward = Math.max(0, slideForwardRaw);
  const slideStyleSide = Math.abs(slideSideRaw) > 0.08 ? slideSideRaw : (Math.sign(inp.slideAnimSide || 1) || 1) * (0.28 + slideBack * 0.16);
  const wallSide = sm.wallJumpSide || inp.wallJumpSide || 0;
  const wallShock = Math.max(sm.wallJumpEnv, inp.wallJump * 0.75, inp.wallJumpImpact || 0);
  const dropkickW = Math.min(1, Math.max(sm.dropkickEnv, loc.dropkick || 0));
  const dropkickLandW = Math.min(1, Math.max(sm.dropkickLandEnv, inp.dropkickLand || 0));
  const dropkickHitW = Math.min(1, inp.dropkickImpact || 0);
  const dropkickContactW = Math.min(1, inp.dropkickContact || 0);
  const dropkickStopW = Math.min(1, inp.dropkickStop || 0);
  const dropkickContactAge = dropkickContactW > 0 ? 1 - dropkickContactW : 1;
  const dropkickContactSnap = Math.max(dropkickStopW * 0.94, dropkickContactW > 0 ? 1 - smooth01((dropkickContactAge - 0.018) / 0.130) : 0);
  const dropkickContactRebound = dropkickContactW > 0
    ? smooth01((dropkickContactAge - 0.120) / 0.250) * (1 - smooth01((dropkickContactAge - 0.390) / 0.330))
    : 0;
  const dropkickContactSettle = dropkickContactW > 0
    ? smooth01((dropkickContactAge - 0.440) / 0.260) * (1 - smooth01((dropkickContactAge - 0.720) / 0.240))
    : 0;
  const dkPhase = inp.dropkickPhase || 0;
  const dkLandPhase = inp.dropkickLand > 0 ? 1 - Math.max(0, Math.min(1, inp.dropkickLand)) : 1;
  const dropkickTwirlSide = Math.sign(inp.dropkickTwirlSide || 1) || 1;
  const dropkickChamber = dropkickW * (1 - smooth01((dkPhase - 0.012) / 0.095));
  const dropkickExtend = dropkickW * smooth01((dkPhase - 0.070) / 0.145);
  const dropkickStrike = dropkickW * Math.sin(Math.max(0, Math.min(1, (dkPhase - 0.125) / 0.175)) * Math.PI);
  const dropkickRecover = dropkickW * smooth01((dkPhase - 0.360) / 0.315);
  const dropkickContactHold = Math.min(1, Math.max(dropkickHitW * (dropkickW > 0.05 ? 1.10 : 0.78), dropkickContactW * 1.04, dropkickContactSnap * 0.96, dropkickStopW * 1.08));
  const dropkickRecoverPose = dropkickRecover * (1 - dropkickContactHold * 0.68);
  const dropkickStrikeArc = dropkickW * Math.sin(Math.max(0, Math.min(1, (dkPhase - 0.065) / 0.375)) * Math.PI) * (1 - dropkickRecoverPose * 0.44);
  const dropkickTwirl = dropkickW * Math.sin(Math.max(0, Math.min(1, (dkPhase - 0.020) / 0.510)) * Math.PI) * (1 - dropkickRecoverPose * 0.52) + dropkickStrikeArc * 0.120 + dropkickContactHold * 0.330 + dropkickContactSnap * 0.220 - dropkickContactRebound * 0.086 + dropkickContactSettle * 0.034;
  const dropkickGroundStomp = dropkickLandW * (1 - smooth01((dkLandPhase - 0.090) / 0.210));
  const dropkickGroundSettle = dropkickLandW * smooth01((dkLandPhase - 0.180) / 0.320);
  const dropkickSnap = Math.max(dropkickExtend * (1 - dropkickRecoverPose * 0.66), dropkickStrike * 1.24, dropkickStrikeArc * 1.10, dropkickHitW * 1.34, dropkickContactSnap * 1.18, dropkickStopW * 1.22, dropkickLandW * 0.76);
  const airW = Math.min(1, sm.airEnv);
  const jumpW = Math.min(1, sm.jumpEnv);
  const fallW = Math.min(1, sm.fallEnv);
  const apexW = Math.min(1, sm.apexEnv);
  const airPitch = (jumpW * -0.040 + fallW * 0.050 + apexW * -0.012) * adsDamp;
  const airRoll = airW * Math.max(-0.10, Math.min(0.10, sm.velLX * 0.12)) * adsDamp;
  cam.wallKickPitch = wallShock * -0.16;
  cam.wallKickRoll = wallShock * wallSide * 0.26;
  cam.footstepDip = -(footPulse * (0.0065 + loc.sprint * 0.0075) + plantPulse * (0.0048 + loc.sprint * 0.0054) - plantRecover * 0.0018 - toePulse * 0.0014) * motion.land * adsDamp;
  cam.footstepRoll = (footSide * (footPulse * (0.004 + loc.sprint * 0.005) + plantPulse * (0.0054 + loc.sprint * 0.0042)) + pivotSide * pivotPulse * 0.0075) * adsDamp;
  cam.sprintStartPitch = sprintStartW * -0.028 * motion.inertia;
  cam.sprintStopPitch = sprintStopW * 0.020 * motion.inertia;
  cam.sprintLeanPitch = loc.sprint * -0.012 * adsDamp;
  cam.dropkickPitch = dropkickChamber * -0.048 - dropkickExtend * 0.118 - dropkickStrikeArc * 0.030 - dropkickHitW * 0.150 - dropkickContactSnap * 0.080 - dropkickStopW * 0.075 + dropkickContactRebound * 0.060 - dropkickContactSettle * 0.014 + dropkickStrike * 0.040 + dropkickRecoverPose * 0.078 - dropkickGroundStomp * 0.126 + dropkickGroundSettle * 0.066;
  cam.dropkickYaw = dropkickTwirlSide * (dropkickTwirl * 0.066 + dropkickStrikeArc * 0.018 + dropkickHitW * 0.030 + dropkickContactSnap * 0.046 + dropkickStopW * 0.030 - dropkickContactRebound * 0.030 + dropkickContactSettle * 0.010 - dropkickGroundStomp * 0.014);
  cam.dropkickRoll = dropkickTwirlSide * (dropkickTwirl * 0.205 + dropkickStrikeArc * 0.044 + dropkickContactSnap * 0.074 + dropkickStopW * 0.050 - dropkickContactRebound * 0.048 + dropkickContactSettle * 0.016) + Math.sin(dkPhase * Math.PI) * dropkickW * 0.036 + dropkickHitW * 0.068 - dropkickGroundStomp * 0.036 + dropkickGroundSettle * 0.018;
  cam.dropkickDip = -dropkickChamber * 0.024 - dropkickExtend * 0.056 - dropkickStrikeArc * 0.016 - dropkickHitW * 0.112 - dropkickContactSnap * 0.052 - dropkickStopW * 0.040 + dropkickContactRebound * 0.040 - dropkickContactSettle * 0.008 + dropkickRecoverPose * 0.030 - dropkickGroundStomp * 0.104 + dropkickGroundSettle * 0.044;
  cam.dropkickForward = -dropkickChamber * 0.036 + dropkickExtend * 0.266 + dropkickStrike * 0.096 + dropkickStrikeArc * 0.046 + dropkickHitW * 0.132 - dropkickStopW * 0.070 + dropkickContactSnap * 0.020 - dropkickContactRebound * 0.126 - dropkickContactSettle * 0.020 - dropkickRecoverPose * 0.082 + dropkickGroundStomp * 0.030 - dropkickGroundSettle * 0.060;
  const runStep = Math.sin(sm.footPhase);
  const runStep2 = Math.cos(sm.footPhase * 0.5);
  const gaitFootSide = Math.max(-1, Math.min(1, runStep));
  const plantWave = Math.max(0, -runStep);
  const stridePunch = plantWave * cadencePower + plantPulse * (0.18 + loc.sprint * 0.12) + stepReachPulse * 0.055;
  const heelStrike = Math.pow(Math.max(0, (Math.abs(runStep) - 0.72) / 0.28), 1.7) * cadencePower + plantPulse * (0.26 + loc.sprint * 0.18);
  const toeOff = Math.pow(Math.max(0, (Math.cos(sm.footPhase) - 0.18) / 0.82), 1.55) * cadencePower + toePulse * (0.24 + loc.sprint * 0.12);
  const gaitLean = Math.max(-0.14, Math.min(0.14, sm.gaitLean || 0));
  const gaitShoulder = Math.min(1, sm.gaitShoulder || 0);
  const breathPhase = sm.breathPhase || 0;
  const idlePhase = sm.idleMicroPhase || 0;
  const idleMicro = (1 - Math.min(1, inp.speed * 1.55)) * (1 - loc.dropkick) * (1 - loc.slide * 0.85);
  const adsHold = Math.min(1, sm.adsHold || 0);
  const combatReady = Math.min(1, sm.combatReady || 0);
  const weaponSettle = Math.min(1, sm.weaponSettle || 0);
  const shotSide = state.lastShotVisual ? ((state.lastShotVisual.burstIndex || 0) % 2 ? 1 : -1) : 1;
  const fireSnap = Math.min(1, Math.max(sm.fireSnap || 0, fireAge < fireDur ? 1 - smooth01((fireRaw - 0.018) / 0.200) : 0)) * (1 - inp.ads * 0.18);
  const fireRecover = Math.min(1, Math.max(sm.fireRecover || 0, fireAge < fireDur * 1.25
    ? smooth01((fireRaw - 0.10) / 0.34) * (1 - smooth01((fireRaw - 0.58) / 0.45))
    : 0)) * (1 - inp.ads * 0.26);
  const fireTail = Math.min(1, Math.max(sm.fireTail || 0, fireAge < fireDur * 1.45
    ? smooth01((fireRaw - 0.34) / 0.54) * (1 - smooth01((fireRaw - 0.98) / 0.46))
    : 0)) * (1 - inp.ads * 0.34);
  const fireSettle = Math.max(fireW * (1 - inp.ads * 0.35), fireSnap * 0.76, fireRecover * 0.58);
  const breathDamp = (1 - loc.sprint * 0.45) * (1 - loc.slide * 0.75) * (1 - loc.dropkick * 0.95);
  cam.headBobX = runStep2 * (0.014 + cadencePower * 0.003) * bobW * adsDamp + counterPulse * footSide * 0.003 + turnDriveSide * turnDrivePulse * 0.004 + pivotSide * pivotPulse * 0.004;
  cam.headBobY = (runStep * 0.014 - plantWave * (loc.sprint * 0.0015 + cadencePower * 0.0038) - plantPulse * (0.0028 + loc.sprint * 0.0022) + plantRecover * 0.0015 + toePulse * 0.0012) * bobW * adsDamp - jumpPulse * 0.010 - threatPulse * 0.006 + killPulse * 0.007 + combatFlow * 0.003;
  cam.headRoll = sm.turnInertia * -0.115 + sm.strafeLean * 0.105 + cam.wallKickRoll + airRoll + counterPulse * footSide * 0.010 + turnDriveSide * turnDrivePulse * 0.004 + pivotSide * pivotPulse * 0.018;
  // Acceleration "physics tilt" (start/stop of W/S movement) is steadied hard while
  // aiming so the view doesn't lurch when you release a movement key under ADS.
  const _accelAdsSteady = 1 - inp.ads * 0.82;
  cam.headPitch = sm.accel * -0.0014 * motion.inertia * _accelAdsSteady + sm.landEnv * -0.13 * motion.land + Math.sin(sm.footPhase) * (0.0045 + cadencePower * 0.0022) * loc.sprint * adsDamp + stridePunch * 0.0038 - plantPulse * (0.0045 + loc.sprint * 0.0040) + toePulse * 0.0030 + cam.wallKickPitch + airPitch - jumpPulse * 0.016 - combatFlow * 0.004 - killPulse * 0.010 + threatPulse * 0.018 + landingSlidePulse * 0.020 + fireSnap * 0.006 - fireRecover * 0.003;
  cam.accelLagX = sm.accel * -0.0022 * motion.inertia * Math.sign(sm.velLX || 1) * _accelAdsSteady;
  cam.accelLagZ = sm.accel * -0.0018 * motion.inertia * Math.sign(sm.velLZ || 1) * _accelAdsSteady;
  cam.turnLagYaw = sm.turnInertia * 0.125;
  cam.turnLagRoll = sm.turnInertia * -0.038;
  cam.landDip = sm.landEnv * -0.06 * motion.land;
  cam.landRebound = sm.landEnv * 0.025 * motion.land;
  cam.airFloat = (apexW * 0.018 + jumpW * 0.010 - fallW * 0.014) * adsDamp;
  cam.slideDrop = loc.slide * (-0.158 - landingSlidePulse * 0.038 - slideSideAbs * 0.020 - slideBack * 0.016);
  cam.slideRoll = loc.slide * (slideStyleSide * (0.115 + (slidePower - 1) * 0.20 + slideSideAbs * 0.052) + slideBack * slideStyleSide * 0.025);
  cam.slideForwardPitch = loc.slide * (0.060 + slideForward * 0.032 - slideBack * 0.045 + landingSlidePulse * 0.055 + slideSideAbs * 0.010);
  const adsSettlePulse = Math.min(1, sm.adsShoulderSettle || 0);
  cam.adsShoulderPitch = adsShoulder * -0.018 + adsKick * adsFocus * 0.010 - adsSettlePulse * 0.006;
  cam.adsSettleRoll = footSide * adsUnsettled * 0.010 - adsKick * adsFocus * 0.006 + shotSide * adsSettlePulse * 0.0025;
  cam.adsSettleY = -adsShoulder * 0.006 - adsSettlePulse * 0.0018;
  cam.breathX = Math.sin(breathPhase * 1.12) * 0.0017 * breathDamp * (1 - adsHold * 0.42) + Math.sin(idlePhase * 0.71) * 0.0009 * idleMicro;
  cam.breathY = Math.cos(breathPhase * 0.94) * 0.0019 * breathDamp * (1 - adsHold * 0.55) + Math.sin(idlePhase * 0.53) * 0.0008 * idleMicro;
  cam.gaitRoll = (gaitLean * 0.46 + Math.sin(sm.footPhase * 0.5 + 0.35) * gaitShoulder * 0.010 + gaitFootSide * heelStrike * 0.0048 + pivotSide * pivotPulse * 0.012) * adsDamp;
  cam.gaitPitch = (-toeOff * 0.008 + heelStrike * 0.005 + gaitShoulder * loc.sprint * -0.006 - plantPulse * 0.0028 + plantRecover * 0.0020) * adsDamp;
  cam.braceDip = -(adsHold * 0.0025 + combatReady * 0.0045 + weaponSettle * 0.0018 + fireSnap * 0.0018);
  cam.impactSettlePitch = fireSnap * 0.024 + fireRecover * 0.012 - fireTail * 0.004 + combatReady * 0.006 - threatPulse * 0.004;
  cam.impactSettleRoll = shotSide * (fireSnap * 0.010 + fireRecover * 0.006 - fireTail * 0.002) + gaitLean * combatReady * 0.035;
  const vm = state.resolved.viewmodel;
  // The accel-driven weapon lag (the "kick" felt when starting/stopping movement) is
  // steadied under ADS so the gun doesn't lurch/tilt when you stop while aiming.
  vm.lagX = sm.accel * -0.0014 * motion.inertia * _accelAdsSteady + loc.slide * slideSideRaw * 0.034 + pivotSide * pivotPulse * 0.003;
  vm.lagY = sm.accel * -0.0009 * motion.inertia * _accelAdsSteady;
  vm.lagZ = (loc.sprint * -0.024 - sprintStartW * 0.010 + sprintStopW * 0.008) * motion.inertia + loc.slide * (-0.018 - slideForward * 0.020 + slideBack * 0.034);
  vm.shoulderPump = loc.sprint * Math.sin(sm.footPhase * 2) * (0.013 + cadencePower * 0.0045) * motion.bob + stepReachPulse * 0.004;
  vm.slideTuck = loc.slide * (0.19 + (slidePower - 1) * 0.12 + landingSlidePulse * 0.060 + slideSideAbs * 0.035 + slideBack * 0.026);
  vm.crouchTuck = loc.crouch * 0.07;
  vm.landWrist = loc.land * 0.07 * motion.land;
  vm.airLift = -jumpW * 0.026 * adsDamp;
  vm.fallDrop = fallW * 0.038 * adsDamp;
  vm.apexFloat = -apexW * 0.014 * adsDamp;
  vm.landPunch = loc.land * 0.085 * motion.land;
  vm.runStepX = runStep2 * (0.0062 + cadencePower * 0.0018) * bobW * adsDamp + counterPulse * footSide * 0.006 + turnDriveSide * turnDrivePulse * 0.010 + pivotSide * pivotPulse * 0.014;
  vm.runStepY = (plantWave * -(0.0040 + cadencePower * 0.0030) - plantPulse * 0.0040 + plantRecover * 0.0022 + toePulse * 0.0018) * bobW * adsDamp - jumpPulse * 0.010 - threatPulse * 0.010 + killPulse * 0.006 + combatFlow * 0.003;
  vm.runStepRoll = runStep2 * -(0.010 + cadencePower * 0.0045) * bobW * adsDamp + counterPulse * footSide * 0.014 + turnDriveSide * turnDrivePulse * 0.012 + pivotSide * pivotPulse * 0.024 + loc.slide * slideStyleSide * 0.064;
  vm.runStepPitch = runStep * (0.010 + cadencePower * 0.0052) * bobW * adsDamp + stridePunch * 0.011 - plantPulse * 0.010 + toePulse * 0.006 - jumpPulse * 0.025 - combatFlow * 0.006 - killPulse * 0.018 + threatPulse * 0.030 + landingSlidePulse * 0.035 + loc.slide * (0.026 + slideForward * 0.020 - slideBack * 0.038);
  vm.runInertiaX = Math.max(-0.018, Math.min(0.018, sm.velLX * -0.26 * motion.inertia)) * adsDamp;
  vm.runInertiaY = -Math.min(0.018, Math.abs(inp.moveAccel || 0) * 0.00042) * motion.inertia * adsDamp;
  vm.shoulderSway = (footSide * (footPulse * (0.0045 + loc.sprint * 0.0055) + plantPulse * 0.0030) + pivotSide * pivotPulse * 0.006) * adsDamp;
  vm.footstepKick = (footPulse * (0.20 + loc.sprint * 0.11 + cadencePower * 0.06) + plantPulse * (0.055 + loc.sprint * 0.040) + plantRecover * 0.030) * adsDamp;
  vm.footstepRoll = (footSide * (footPulse * (0.005 + loc.sprint * 0.005 + cadencePower * 0.0025) + plantPulse * 0.0045) + pivotSide * pivotPulse * 0.010) * adsDamp;
  vm.plantDip = plantPulse * (0.28 + loc.sprint * 0.18) + plantRecover * 0.10;
  vm.toePush = toePulse * (0.24 + loc.sprint * 0.12) + stepReachPulse * 0.08;
  vm.pivotTuck = pivotPulse;
  vm.pivotSide = pivotSide;
  vm.sprintStartKick = sprintStartW;
  vm.sprintStopKick = sprintStopW;
  vm.wallKickX = wallShock * wallSide * 0.075;
  vm.wallKickY = wallShock * 0.055;
  vm.wallKickZ = wallShock * -0.090;
  vm.wallKickPitch = wallShock * 0.30;
  vm.wallKickRoll = wallShock * wallSide * -0.48;
  vm.dropkickTuck = dropkickChamber * 0.34 + dropkickExtend * (1 - dropkickRecoverPose * 0.66) * 1.12 + dropkickStrike * 0.24 + dropkickStrikeArc * 0.20 + dropkickHitW * 0.48 + dropkickContactSnap * 0.24 + dropkickStopW * 0.20 + dropkickGroundStomp * 0.22 + dropkickGroundSettle * 0.09;
  vm.dropkickKick = dropkickSnap;
  vm.dropkickImpact = Math.max(dropkickLandW, dropkickHitW * 0.96, dropkickContactSnap * 1.08, dropkickStopW * 1.10, dropkickContactRebound * 0.24);
  vm.adsSettleX = -adsUnsettled * 0.012 + adsKick * adsFocus * 0.003 + shotSide * adsSettlePulse * 0.0018;
  vm.adsSettleY = adsUnsettled * 0.010 - adsKick * adsFocus * 0.004 - adsSettlePulse * 0.0032;
  vm.adsSettleZ = -adsUnsettled * 0.020 - adsKick * adsFocus * 0.006 - adsSettlePulse * 0.006;
  vm.adsSettlePitch = -adsUnsettled * 0.070 + adsKick * adsFocus * 0.030 - adsSettlePulse * 0.016;
  vm.adsSettleRoll = footSide * adsUnsettled * 0.018 - adsKick * adsFocus * 0.010 + shotSide * adsSettlePulse * 0.004;
  vm.breathX = Math.sin(breathPhase * 1.08) * 0.0023 * breathDamp * (1 - adsHold * 0.58);
  vm.breathY = Math.cos(breathPhase * 0.88) * 0.0020 * breathDamp * (1 - adsHold * 0.64);
  vm.idleMicroX = Math.sin(idlePhase * 0.63) * 0.0019 * idleMicro;
  vm.idleMicroY = Math.sin(idlePhase * 0.49 + 0.6) * 0.0016 * idleMicro;
  vm.idleMicroRoll = Math.sin(idlePhase * 0.57 + 0.3) * 0.0055 * idleMicro * (1 - inp.ads * 0.55);
  vm.gaitLift = (heelStrike * -0.006 + toeOff * 0.004 + gaitShoulder * loc.sprint * -0.0035 - plantPulse * 0.0026 + plantRecover * 0.0020) * adsDamp;
  vm.gaitYaw = (gaitLean * -0.42 + Math.sin(sm.footPhase * 0.5) * gaitShoulder * 0.020 + pivotSide * pivotPulse * 0.030 + loc.slide * slideSideRaw * 0.070) * adsDamp;
  vm.gaitRoll = (gaitLean * -0.70 + gaitFootSide * heelStrike * 0.012 + pivotSide * pivotPulse * 0.024 + Math.sin(sm.footPhase * 0.5 + 0.8) * gaitShoulder * 0.018 + loc.slide * slideStyleSide * 0.110) * adsDamp;
  vm.weaponWeightX = -gaitLean * 0.075 - sm.turnInertia * 0.030 - combatReady * 0.002 + footSide * plantPulse * 0.006 + pivotSide * pivotPulse * 0.008 + loc.slide * slideSideRaw * 0.026;
  vm.weaponWeightY = -weaponSettle * 0.008 - heelStrike * 0.004 + toeOff * 0.0025 + adsHold * 0.002 - plantPulse * 0.0022 + plantRecover * 0.0018;
  vm.weaponWeightZ = -weaponSettle * 0.010 + loc.sprint * -0.006 + combatReady * -0.004 + toePulse * 0.0030 - plantPulse * 0.0024;
  vm.supportBrace = Math.min(1, adsHold * 0.45 + fireSnap * 0.62 + fireRecover * 0.56 + fireTail * 0.20 + combatReady * 0.35 + loc.land * 0.30);
  vm.triggerSqueeze = Math.min(1, fireSnap * 1.18 + fireRecover * 0.48 + adsHold * 0.12 + combatReady * 0.10);
  vm.fireSnap = fireSnap;
  vm.fireRecover = fireRecover;
  vm.fireTail = fireTail;
  vm.fireSide = shotSide;
  vm.combatSettle = Math.min(1, combatReady * (1 - loc.dropkick * 0.80) + fireRecover * 0.22 + fireTail * 0.12);
  vm.adsMicroX = Math.sin(breathPhase * 0.82 + 1.3) * 0.0008 * adsHold * (1 - (inp.scopeSettle || 0) * 0.55);
  vm.adsMicroY = Math.cos(breathPhase * 0.76 + 0.4) * 0.0007 * adsHold * (1 - (inp.scopeSettle || 0) * 0.55);
  vm.adsMicroRoll = Math.sin(breathPhase * 0.68) * 0.0026 * adsHold * (1 - (inp.scopeSettle || 0) * 0.62);
  vm.landSettle = Math.min(1, loc.land * 0.70 + sm.landEnv * 0.45 + dropkickLandW * 0.55);
  vm.fingerCurl = Math.min(1, (0.10 + loc.sprint * 0.17 + footPulse * 0.035 + plantPulse * 0.030 + fireSnap * 0.060 + sprintStartW * 0.05 + loc.slide * 0.10 + loc.wallJump * 0.32 + loc.dropkick * 0.48 + loc.land * 0.18 + airW * 0.08 + wallShock * 0.08 + (inp.reloading ? 0.10 : 0)) * motion.finger);
  const pr = state.resolved.proxy;
  pr.leanSh = inp.lean * 0.15;
  pr.adsSh = inp.ads * 0.12;
  pr.vaultBend = intr.vault * 0.35;
  pr.wallBrace = wallShock;
  pr.flinchTwist = ad.damageFlinch * 0.2;
  pr.footSwing = runStep * 0.08 * bobW + footSide * (footPulse * 0.05 + plantPulse * 0.08 - toePulse * 0.035) + pivotSide * pivotPulse * 0.045 + jumpW * -0.10 + fallW * 0.08 + dropkickSnap * -0.38 + loc.slide * (-0.10 * slideForward + 0.12 * slideBack + slideSideRaw * 0.055);
  pr.armSwing = runStep2 * (0.11 + cadencePower * 0.05) * bobW * motion.inertia + footSide * (footPulse * 0.04 + plantPulse * 0.030) + pivotSide * pivotPulse * 0.028 + loc.slide * slideStyleSide * 0.065;
  pr.footPlant = Math.max(-1, Math.min(1, footSide * Math.min(1, footPulse + plantPulse * 1.9 + plantRecover * 0.65) + pivotSide * pivotPulse * 0.32));
  pr.heelStrike = Math.min(1.4, heelStrike);
  pr.toeOff = Math.min(1.4, toeOff);
  pr.strideReach = Math.min(1.6, stridePunch + toeOff * 0.52 + heelStrike * 0.38 + stepReachPulse * 0.28);
  pr.stancePlant = Math.min(1.4, plantWave * cadencePower + plantPulse * 1.15 + plantRecover * 0.34);
  pr.gaitFootSide = gaitFootSide;
  pr.sprintPose = Math.min(1, loc.sprint + sprintStartW * 0.34) * (1 - loc.slide * 0.55);
  pr.torsoTwist = runStep2 * (loc.sprint * 0.10 + loc.walk * 0.05) * motion.inertia + turnDriveSide * turnDrivePulse * 0.045 + pivotSide * pivotPulse * 0.070 + loc.slide * slideSideRaw * 0.22;
  pr.jumpPose = jumpW + apexW * 0.35;
  pr.fallPose = fallW;
  pr.dropkickPose = Math.min(1, Math.max(dropkickSnap, dropkickLandW * 0.92));
  pr.vaultTuck = intr.vault * (0.32 + Math.min(0.68, Math.sin(Math.max(0, Math.min(1, inp.vaultT || 0)) * Math.PI) * 0.68));
  pr.landSquash = loc.land;
  pr.shoulderRoll = gaitLean * 1.25 + footSide * (footPulse * 0.050 + plantPulse * 0.040) + pivotSide * pivotPulse * 0.050 + fireSettle * 0.035 * shotSide;
  pr.headCounter = -gaitLean * 0.74 + sm.turnInertia * -0.055 - pivotSide * pivotPulse * 0.035;
  pr.kneeBend = Math.min(1, loc.sprint * 0.18 + loc.crouch * 0.34 + loc.land * 0.50 + heelStrike * 0.26 + plantPulse * 0.20 + pivotPulse * 0.14 + loc.dropkick * 0.16 + loc.slide * (0.54 + slideBack * 0.10));
  pr.turnLean = Math.max(-1, Math.min(1, gaitLean * 5.2 + sm.turnInertia * -0.70 + pivotSide * pivotPulse * 0.42));
  pr.combatReady = combatReady;
  pr.weaponBrace = Math.min(1, vm.supportBrace + inp.ads * 0.35);
  pr.deathCollapse = inp.dead ? 1 : 0;
  const widx = inp.weaponIdx;
  state.reload.timelineClass = getReloadWeaponClass(widx);
  if (inp.reloading && inp.reloadTimer != null && inp.RELOAD_TIME > 0) {
    const rt = 1 - inp.reloadTimer / inp.RELOAD_TIME;
    state.reload.phase = reloadPhaseLabel(rt, widx);
    state.reload.visualProgress = reloadHoloVisualProgress(rt, widx);
  } else {
    state.reload.phase = 'idle';
    state.reload.visualProgress = 0;
  }
  return state;
}

export function reloadMagShouldHide(state, rt) {
  return reloadMagHidden(rt, state.inputs.weaponIdx);
}

export function getPlayerAnimDebug(state) {
  return {
    version: state.version,
    slot: state.slot,
    inputs: state.inputs,
    layerWeights: state.layerWeights,
    resolved: state.resolved,
    transitionHealth: transitionHealthDebug(state.transitionHealth),
    reload: state.reload,
    lastShotVisual: state.lastShotVisual,
    recentNotifies: getRecentNotifies(state.notifyRing, 28),
    notifyStats: getNotifyStats(state.notifyRing),
    interaction: state.interaction
  };
}

export function onWeaponFired(state, weaponIdx, burstIndex) {
  state.lastShotVisual = Object.assign({ t: performance.now() * 0.001, weaponIdx }, getFireVisualProfile(weaponIdx, burstIndex));
  const frameId = (state.flags?.frameSeq || 0) + 1;
  emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'triggerPull', { slot: state.slot, weaponIdx });
  emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'muzzleFlash', { slot: state.slot, weaponIdx, burstIndex: burstIndex | 0 });
}

export function getGripDebug(state) {
  const inp = state.inputs || {};
  return describeGripForDebug(inp.weaponIdx, inp.ads || 0, inp.sprintAmt || 0);
}

export function playerAnimEmitNotify(state, frameId, name, payload) {
  emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), name, payload || null);
}

export function getMovementAnimState(state) {
  return {
    footPhase: state.smoothed.footPhase,
    velLX: state.smoothed.velLX,
    velLZ: state.smoothed.velLZ,
    accel: state.smoothed.accel,
    slideEnv: state.smoothed.slideEnv,
    slideSide: state.smoothed.slideSide,
    slideForward: state.smoothed.slideForward,
    jumpEnv: state.smoothed.jumpEnv,
    fallEnv: state.smoothed.fallEnv,
    apexEnv: state.smoothed.apexEnv,
    sprintEnv: state.smoothed.sprintEnv,
    sprintStartEnv: state.smoothed.sprintStartEnv,
    sprintStopEnv: state.smoothed.sprintStopEnv,
    footstepPulse: state.smoothed.footstepPulse,
    footPlantPulse: state.smoothed.footPlantPulse,
    footPlantRecover: state.smoothed.footPlantRecover,
    toeOffPulse: state.smoothed.toeOffPulse,
    stepReachPulse: state.smoothed.stepReachPulse,
    footPlantSide: state.smoothed.footPlantSide,
    turnPlantPulse: state.smoothed.turnPlantPulse,
    pivotSide: state.smoothed.pivotSide,
    cadencePower: state.smoothed.cadencePower,
    runtimePulses: {
      counterStrafe: state.inputs.counterStrafePulse || 0,
      turnDrive: state.inputs.turnDrivePulse || 0,
      landingSlide: state.inputs.landingSlidePulse || 0,
      damageShock: state.inputs.damageShock || 0,
      damageShockSide: state.inputs.damageShockSide || 1,
      nearMiss: state.inputs.nearMissPulse || 0,
      nearMissSide: state.inputs.nearMissSide || 1,
      killFlow: state.inputs.killFlowPulse || 0
    },
    wallJumpEnv: state.smoothed.wallJumpEnv,
    wallJumpSide: state.smoothed.wallJumpSide,
    dropkickEnv: state.smoothed.dropkickEnv,
    dropkickLandEnv: state.smoothed.dropkickLandEnv,
    crouchEnv: state.smoothed.crouchEnv,
    turnInertia: state.smoothed.turnInertia,
    gaitLean: state.smoothed.gaitLean,
    gaitShoulder: state.smoothed.gaitShoulder,
    adsHold: state.smoothed.adsHold,
    adsShoulderSettle: state.smoothed.adsShoulderSettle,
    combatReady: state.smoothed.combatReady,
    weaponSettle: state.smoothed.weaponSettle,
    fireSnap: state.smoothed.fireSnap,
    fireRecover: state.smoothed.fireRecover,
    fireTail: state.smoothed.fireTail,
    transitionHealth: transitionHealthDebug(state.transitionHealth),
    notifyStats: getNotifyStats(state.notifyRing)
  };
}

export { reloadMagHidden, reloadHoloVisualProgress, reloadPhaseLabel, blendFingerCurl, weaponTypeFromIdx };
