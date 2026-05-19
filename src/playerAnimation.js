/**
 * Player animation controller — intent/state only; main.js applies to Three.js.
 * @see PLAYER_ANIMATION_IMMERSION_PLAN.md
 */
import { createNotifyRing, resetFrameNotifies, emitPlayerAnimNotify, getRecentNotifies } from './playerAnimNotify.js';
import {
  getReloadWeaponClass,
  reloadMagHidden,
  reloadHoloVisualProgress,
  reloadPhaseLabel
} from './reloadTimelines.js';
import { describeGripForDebug, blendFingerCurl, weaponTypeFromIdx } from './viewmodelHandRig.js';

export const PLAYER_ANIM_SCHEMA_VERSION = 3;

function dampL(current, target, lambda, dt) {
  const d = Math.max(0, dt || 0);
  return target + (current - target) * Math.exp(-lambda * d);
}

const FIRE_VISUAL = {
  0: { dur: 0.22, kickRX: 0.22, kickRZ: 0.05, kickY: 0.006, kickZ: 0.01, driftX: 0.002, autoBurstMul: 1 },
  1: { dur: 0.4, kickRX: 0.55, kickRZ: 0.1, kickY: 0.015, kickZ: 0.024, driftX: 0, autoBurstMul: 0 },
  3: { dur: 0.48, kickRX: 0.42, kickRZ: 0.15, kickY: 0.02, kickZ: 0.04, driftX: 0, autoBurstMul: 0 },
  4: { dur: 0.16, kickRX: 0.1, kickRZ: 0.025, kickY: 0.003, kickZ: 0.005, driftX: 0.003, autoBurstMul: 1.15 },
  5: { dur: 0.36, kickRX: 0.38, kickRZ: 0.08, kickY: 0.012, kickZ: 0.022, driftX: 0, autoBurstMul: 0 },
  6: { dur: 0.34, kickRX: 0.42, kickRZ: 0.09, kickY: 0.012, kickZ: 0.02, driftX: 0, autoBurstMul: 0 },
  7: { dur: 0.42, kickRX: 0.48, kickRZ: 0.1, kickY: 0.014, kickZ: 0.028, driftX: 0, autoBurstMul: 0 }
};

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
      wallJumpEnv: 0,
      wallJumpSide: 0,
      slideEnv: 0,
      crouchEnv: 0,
      strafeLean: 0,
      prevPx: null,
      prevPz: null,
      prevVy: null
    },
    layerWeights: {
      locomotion: { idle: 1, walk: 0, sprint: 0, crouch: 0, slide: 0, jump: 0, fall: 0, land: 0, wallJump: 0 },
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
        wallKickPitch: 0,
        wallKickRoll: 0,
        slideDrop: 0,
        slideRoll: 0,
        slideForwardPitch: 0
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
        wallKickX: 0,
        wallKickY: 0,
        wallKickZ: 0,
        wallKickPitch: 0,
        wallKickRoll: 0,
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
        jumpPose: 0,
        fallPose: 0,
        landSquash: 0,
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
    flags: { slideWas: false, wallJumpWas: false, landKickWas: 0, frameSeq: 0 },
    eventsConsumed: []
  };
}

export function updatePlayerAnimInputs(state, ctx) {
  const {
    P,
    dt,
    now,
    keys,
    mouseDx = 0,
    frameId = 0,
    dampFn = dampL
  } = ctx;
  const K = keys || {};
  const moving = !!(K.KeyW || K.KeyS || K.KeyA || K.KeyD);
  const speed = moving ? (P.running ? 1 : 0.55) : 0;
  const yawDelta = mouseDx || 0;
  const grounded = !!P.grounded;
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
  const accel = dtCl > 1e-4 ? Math.hypot(vlx - state.smoothed.velLX, vlz - state.smoothed.velLZ) / dtCl : 0;
  state.smoothed.velLX = dampL(state.smoothed.velLX, vlx, 10, dtCl);
  state.smoothed.velLZ = dampL(state.smoothed.velLZ, vlz, 10, dtCl);
  state.smoothed.accel = dampL(state.smoothed.accel, Math.min(18, accel), 6, dtCl);
  const stride = (P.running ? 5.8 : 3.2) * speed * dtCl;
  state.smoothed.footPhase = (state.smoothed.footPhase + stride) % 62.83;
  state.smoothed.turnInertia = dampL(state.smoothed.turnInertia, yawDelta * 0.008, 9, dtCl);
  const stx = (K.KeyA ? -1 : 0) + (K.KeyD ? 1 : 0);
  state.smoothed.strafeLean = dampL(state.smoothed.strafeLean, stx * (1 - Math.abs(P.ads || 0)) * 0.11, 6, dtCl);
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
  const slideAmt = P.slideAmt || 0;
  state.smoothed.slideEnv = dampFn(state.smoothed.slideEnv, P.sliding || slideAmt > 0.12 ? 1 : 0, 9, dtCl);
  const crouchAmt = P.crouchAmt || 0;
  state.smoothed.crouchEnv = dampFn(state.smoothed.crouchEnv, crouchAmt, 6, dtCl);
  state.inputs = {
    moving,
    speed,
    yawDelta,
    grounded,
    vy,
    ads: P.adsVis != null ? P.adsVis : P.ads,
    reloading: !!P.reloading,
    vaulting: !!P.vaulting,
    vaultT: P.vaultT || 0,
    vaultDir: P.vaultDir || 'forward',
    wallJump,
    wallJumpImpact: P.wallJumpImpact || 0,
    wallJumpSide,
    wallContact: !!P.wallContact,
    sprintAmt: P.sprintAmt || 0,
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
  if (!slideOn && state.flags.slideWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'slideExit', { slot: state.slot });
  }
  state.flags.slideWas = slideOn;
  const wallJumpOn = wallJump > 0.05;
  if (wallJumpOn && !state.flags.wallJumpWas) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'wallJump', {
      slot: state.slot,
      side: wallJumpSide
    });
  }
  state.flags.wallJumpWas = wallJumpOn;
  if (landKick > (state.flags.landKickWas || 0) + 0.02) {
    emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), landKick > 0.12 ? 'landHeavy' : 'landLight', { slot: state.slot });
  }
  state.flags.landKickWas = landKick;
  const foot = state.smoothed.footPhase;
  if (moving && grounded && speed > 0.4) {
    const s = Math.sin(foot);
    if (s > 0.97) emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'footstepRight', { slot: state.slot });
    if (s < -0.97) emitPlayerAnimNotify(state.notifyRing, frameId, performance.now(), 'footstepLeft', { slot: state.slot });
  }
  state.flags.frameSeq = frameId;
  return state;
}

export function resolvePlayerAnimLayers(state, dt) {
  const dtCl = Math.max(0, dt || 0);
  const inp = state.inputs;
  const sm = state.smoothed;
  const loc = state.layerWeights.locomotion;
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
  } else {
    const wallJumpW = Math.min(1, sm.wallJumpEnv * 1.15);
    loc.idle = 1 - Math.min(1, inp.speed * 1.2);
    loc.walk = inp.moving && !inp.reloading ? Math.min(1, inp.speed) * (1 - inp.sprintAmt) * (1 - inp.slideAmt) : 0;
    loc.sprint = inp.sprintAmt * (1 - inp.slideAmt) * (1 - inp.ads * 0.9);
    loc.crouch = inp.crouchAmt * (1 - inp.slideAmt);
    loc.slide = inp.slideAmt;
    loc.wallJump = wallJumpW;
    loc.jump = (!inp.grounded && inp.vy > 0.2 ? 1 : 0) * (1 - wallJumpW * 0.55);
    loc.fall = (!inp.grounded && inp.vy <= 0.2 ? 1 : 0) * (1 - wallJumpW * 0.4);
    loc.land = sm.landEnv > 0.02 ? Math.min(1, sm.landEnv * 4) : 0;
  }
  const wp = state.layerWeights.weaponPose;
  wp.hip = 1 - inp.ads;
  wp.ads = inp.ads;
  wp.sprintLow = inp.sprintAmt * (1 - inp.ads);
  wp.reload = inp.reloading ? 1 : 0;
  wp.fire = 0;
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
  const bobW = loc.walk * 0.72 + loc.sprint * 1.22 + loc.crouch * 0.28;
  const adsDamp = 1 - inp.ads * 0.88;
  const wallSide = sm.wallJumpSide || inp.wallJumpSide || 0;
  const wallShock = Math.max(sm.wallJumpEnv, inp.wallJump * 0.75, inp.wallJumpImpact || 0);
  const airW = Math.min(1, sm.airEnv);
  const jumpW = Math.min(1, sm.jumpEnv);
  const fallW = Math.min(1, sm.fallEnv);
  const apexW = Math.min(1, sm.apexEnv);
  const airPitch = (jumpW * -0.040 + fallW * 0.050 + apexW * -0.012) * adsDamp;
  const airRoll = airW * Math.max(-0.10, Math.min(0.10, sm.velLX * 0.12)) * adsDamp;
  cam.wallKickPitch = wallShock * -0.16;
  cam.wallKickRoll = wallShock * wallSide * 0.26;
  const runStep = Math.sin(sm.footPhase);
  const runStep2 = Math.cos(sm.footPhase * 0.5);
  cam.headBobX = runStep2 * 0.018 * bobW * adsDamp;
  cam.headBobY = runStep * 0.023 * bobW * adsDamp;
  cam.headRoll = sm.turnInertia * -0.58 + sm.strafeLean * 0.38 + cam.wallKickRoll + airRoll;
  cam.headPitch = sm.accel * -0.0017 + sm.landEnv * -0.13 + Math.sin(sm.footPhase) * 0.006 * loc.sprint * adsDamp + cam.wallKickPitch + airPitch;
  cam.accelLagX = sm.accel * -0.0022 * Math.sign(sm.velLX || 1);
  cam.accelLagZ = sm.accel * -0.0018 * Math.sign(sm.velLZ || 1);
  cam.turnLagYaw = sm.turnInertia * 0.30;
  cam.turnLagRoll = sm.turnInertia * -0.30;
  cam.landDip = sm.landEnv * -0.06;
  cam.landRebound = sm.landEnv * 0.025;
  cam.airFloat = (apexW * 0.018 + jumpW * 0.010 - fallW * 0.014) * adsDamp;
  cam.slideDrop = loc.slide * -0.16;
  cam.slideRoll = loc.slide * 0.10;
  cam.slideForwardPitch = loc.slide * 0.07;
  const vm = state.resolved.viewmodel;
  vm.lagX = sm.accel * -0.0014;
  vm.lagY = sm.accel * -0.0009;
  vm.lagZ = loc.sprint * -0.024;
  vm.shoulderPump = loc.sprint * Math.sin(sm.footPhase * 2) * 0.017;
  vm.slideTuck = loc.slide * 0.18;
  vm.crouchTuck = loc.crouch * 0.07;
  vm.landWrist = loc.land * 0.07;
  vm.airLift = -jumpW * 0.026 * adsDamp;
  vm.fallDrop = fallW * 0.038 * adsDamp;
  vm.apexFloat = -apexW * 0.014 * adsDamp;
  vm.landPunch = loc.land * 0.085;
  vm.runStepX = runStep2 * 0.0075 * bobW * adsDamp;
  vm.runStepY = Math.abs(runStep) * -0.0065 * bobW * adsDamp;
  vm.runStepRoll = runStep2 * -0.020 * bobW * adsDamp;
  vm.runStepPitch = runStep * 0.014 * bobW * adsDamp;
  vm.wallKickX = wallShock * wallSide * 0.075;
  vm.wallKickY = wallShock * 0.055;
  vm.wallKickZ = wallShock * -0.090;
  vm.wallKickPitch = wallShock * 0.30;
  vm.wallKickRoll = wallShock * wallSide * -0.48;
  vm.fingerCurl = Math.min(1, 0.10 + loc.sprint * 0.16 + loc.slide * 0.10 + loc.wallJump * 0.32 + loc.land * 0.18 + airW * 0.08 + wallShock * 0.08 + (inp.reloading ? 0.10 : 0));
  const pr = state.resolved.proxy;
  pr.leanSh = inp.lean * 0.15;
  pr.adsSh = inp.ads * 0.12;
  pr.vaultBend = intr.vault * 0.35;
  pr.wallBrace = wallShock;
  pr.flinchTwist = ad.damageFlinch * 0.2;
  pr.footSwing = runStep * 0.08 * bobW + jumpW * -0.10 + fallW * 0.08;
  pr.armSwing = runStep2 * 0.11 * bobW;
  pr.jumpPose = jumpW + apexW * 0.35;
  pr.fallPose = fallW;
  pr.landSquash = loc.land;
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
    reload: state.reload,
    lastShotVisual: state.lastShotVisual,
    recentNotifies: getRecentNotifies(state.notifyRing, 28),
    interaction: state.interaction
  };
}

export function onWeaponFired(state, weaponIdx, burstIndex) {
  state.lastShotVisual = Object.assign({ t: performance.now() * 0.001, weaponIdx }, getFireVisualProfile(weaponIdx, burstIndex));
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
    jumpEnv: state.smoothed.jumpEnv,
    fallEnv: state.smoothed.fallEnv,
    apexEnv: state.smoothed.apexEnv,
    wallJumpEnv: state.smoothed.wallJumpEnv,
    wallJumpSide: state.smoothed.wallJumpSide,
    crouchEnv: state.smoothed.crouchEnv,
    turnInertia: state.smoothed.turnInertia
  };
}

export { reloadMagHidden, reloadHoloVisualProgress, reloadPhaseLabel, blendFingerCurl, weaponTypeFromIdx };
