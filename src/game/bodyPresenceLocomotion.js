export const BODY_PRESENCE_LOCOMOTION_VERSION = 'body-presence-locomotion.v6';

const TAU = Math.PI * 2;

function clamp(v, min = 0, max = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function smooth01(v) {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
}

function smoothstep(v, min, max) {
  if (max === min) return v >= max ? 1 : 0;
  return smooth01((v - min) / (max - min));
}

function wrap01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return ((n % 1) + 1) % 1;
}

function wrapAngle(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const tau = Math.PI * 2;
  return ((((n + Math.PI) % tau) + tau) % tau) - Math.PI;
}

function dampAngle(current, target, lambda, dt) {
  const c = Number.isFinite(current) ? current : target;
  const t = Number.isFinite(target) ? target : c;
  return c + wrapAngle(t - c) * (1 - Math.exp(-Math.max(0.001, lambda) * Math.max(0, dt || 0)));
}

function roundPose(pose = {}) {
  return {
    x: Number((pose.x || 0).toFixed(5)),
    y: Number((pose.y || 0).toFixed(5)),
    z: Number((pose.z || 0).toFixed(5)),
    rx: Number((pose.rx || 0).toFixed(5)),
    ry: Number((pose.ry || 0).toFixed(5)),
    rz: Number((pose.rz || 0).toFixed(5))
  };
}

function pose(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return { x, y, z, rx, ry, rz };
}

function vaultLeadSide(dir = 'forward') {
  if (dir === 'left' || dir === 'backward') return -1;
  return 1;
}

export function resolveBodyPresenceYawFrame(opts = {}) {
  const viewYaw = Number.isFinite(opts.viewYaw) ? opts.viewYaw : 0;
  const prevYaw = Number.isFinite(opts.prevYaw) ? opts.prevYaw : viewYaw;
  const moveDx = Number.isFinite(opts.moveDx) ? opts.moveDx : 0;
  const moveDz = Number.isFinite(opts.moveDz) ? opts.moveDz : 0;
  const speed = Math.max(0, Number(opts.speed) || 0);
  const sprint = clamp(opts.sprint, 0, 1);
  const vault = clamp(opts.vault, 0, 1);
  const slide = clamp(opts.slide, 0, 1);
  const dt = Math.max(0, Number(opts.dt) || 0);
  const moveLen = Math.hypot(moveDx, moveDz);
  const moving = moveLen > 0.006 || speed > 0.42 || vault > 0.08;
  const moveYaw = moving && moveLen > 0.0001 ? Math.atan2(-moveDx, -moveDz) : prevYaw;
  const slideFollow = slide > 0.10;
  const targetYaw = slideFollow ? viewYaw : (moving ? moveYaw : prevYaw);
  const lambda = slideFollow ? (8.5 + slide * 5.8) : (moving ? (5.5 + sprint * 4.8 + vault * 5.2 + Math.min(1, speed / 7) * 2.0) : 1.2);
  const yaw = dampAngle(prevYaw, targetYaw, lambda, dt);
  const yawDelta = wrapAngle(viewYaw - yaw);
  const lowerBodyYawIsolation = clamp((slideFollow ? 0 : 1) * (moving ? 0.62 : 1.0) * (1 - vault * 0.18), 0, 1);
  const out = {
    version: BODY_PRESENCE_LOCOMOTION_VERSION,
    yaw,
    viewYaw,
    targetYaw,
    moveYaw,
    yawDelta,
    yawDelta01: clamp(Math.abs(yawDelta) / (Math.PI * 0.72), 0, 1),
    moving,
    speed,
    slide,
    moveLen,
    lambda,
    lowerBodyYawIsolation,
    slideFollow,
    mode: slideFollow ? 'slide-camera-aligned' : (moving ? 'movement-anchored' : 'held-lower-body')
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function resolveBodyPresenceStrideMatch(opts = {}) {
  const speed = Math.max(0, Number(opts.speed) || 0);
  const speedN = clamp(Number.isFinite(opts.speedN) ? opts.speedN : speed / 6.5, 0, 1);
  const sprint = clamp(opts.sprint, 0, 1);
  const ads = clamp(opts.ads, 0, 1);
  const vault = clamp(opts.vault, 0, 1);
  const land = clamp(opts.land, 0, 1);
  const air = clamp(opts.air, 0, 1);
  const baseStrideLength = clamp(opts.baseStrideLength || 0.42, 0.20, 1.05);
  const baseCadence = clamp(opts.baseCadence || 1.4, 0.70, 3.40);
  const gaitMeters = Math.max(0.16, baseStrideLength * baseCadence * 1.68);
  const expectedMeters = clamp(speed / Math.max(0.001, gaitMeters), 0.34, 2.10);
  const targetStride = clamp(baseStrideLength * (0.82 + expectedMeters * 0.26 + sprint * 0.10 - ads * 0.035), 0.24, 0.96);
  const strideError = clamp(Math.abs(targetStride - baseStrideLength) / Math.max(0.001, baseStrideLength), 0, 1.6);
  const movingConfidence = clamp(smoothstep(speed, 0.45, 4.2) + sprint * 0.18 - ads * 0.06 - air * 0.20 - vault * 0.18, 0, 1.15);
  const cadenceScale = clamp(0.92 + speedN * 0.18 + sprint * 0.08 - ads * 0.045 - vault * 0.055, 0.78, 1.24);
  const strideScale = clamp(1 + (targetStride - baseStrideLength) * 0.40 + sprint * 0.025 - vault * 0.020, 0.84, 1.18);
  const antiSlideBoost = clamp(movingConfidence * (0.075 + strideError * 0.16) + sprint * 0.050 + land * 0.065 - vault * 0.025, 0, 0.34);
  const footLockReach = clamp(movingConfidence * (0.030 + speedN * 0.072 + sprint * 0.030) + land * 0.045, 0, 0.19);
  const toeCatch = clamp(movingConfidence * (0.080 + speedN * 0.12) + sprint * 0.050 - air * 0.040, 0, 0.28);
  const contactWindow = clamp(0.570 + movingConfidence * 0.025 + sprint * 0.018 + land * 0.016 - vault * 0.055 - air * 0.046, 0.52, 0.64);
  const soleLock = clamp(movingConfidence * (0.150 + speedN * 0.100) + sprint * 0.055 + land * 0.060 - air * 0.070 - vault * 0.040, 0, 0.40);
  const plantedStepComp = clamp(movingConfidence * (0.032 + speedN * 0.070 + sprint * 0.030) + land * 0.035 - vault * 0.018, 0, 0.17);
  const out = {
    version: BODY_PRESENCE_LOCOMOTION_VERSION,
    speed,
    speedN,
    baseStrideLength,
    baseCadence,
    expectedMeters,
    targetStride,
    strideError,
    movingConfidence,
    strideScale,
    cadenceScale,
    antiSlideBoost,
    footLockReach,
    toeCatch,
    contactWindow,
    soleLock,
    plantedStepComp,
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function buildBodyPresenceLocomotionFrame(opts = {}) {
  const speed = Math.max(0, Number(opts.speed) || 0);
  const speedN = clamp(Number.isFinite(opts.speedN) ? opts.speedN : speed / 6.5, 0, 1);
  const ads = clamp(opts.ads, 0, 1);
  const sprint = clamp(opts.sprint, 0, 1);
  const crouch = clamp(opts.crouch, 0, 1);
  const jump = clamp(opts.jump, 0, 1);
  const fall = clamp(opts.fall, 0, 1);
  const land = clamp(opts.land, 0, 1);
  const turn = clamp(Number.isFinite(opts.turn) ? opts.turn : 0, -1, 1);
  const phase = Number.isFinite(opts.phase) ? opts.phase : 0;
  const vis = clamp(opts.vis, 0, 1);
  const vault = clamp(opts.vault, 0, 1);
  const vaultT = clamp(opts.vaultT, 0, 1);
  const vaultDir = String(opts.vaultDir || 'forward');
  const lookDown = clamp(opts.lookDown, 0, 1);
  const air = Math.max(jump, fall);
  const vPlant = vault * smoothstep(vaultT, 0.04, 0.18) * (1 - smoothstep(vaultT, 0.34, 0.56));
  const vCrest = vault * smoothstep(vaultT, 0.18, 0.42) * (1 - smoothstep(vaultT, 0.62, 0.90));
  const vExit = vault * smoothstep(vaultT, 0.52, 0.88);
  const vaultClearance = clamp(vault * (vPlant * 0.28 + vCrest * 0.94 + vExit * 0.24), 0, 1.16);
  const vSide = vaultLeadSide(vaultDir);
  const walk = clamp(speedN * (1 - ads * 0.35) * (1 - air * 0.32) * (1 - vault * 0.58) + sprint * 0.10 * (1 - vault * 0.46), 0, 1);
  const baseTarget = 0.105 + speedN * 0.330 + sprint * 0.140 + crouch * 0.155 + air * 0.245 + land * 0.290 + Math.abs(turn) * 0.050 + vault * (0.420 + vCrest * 0.180);
  const targetPresence = clamp(baseTarget * (1 - ads * 0.54) + vault * 0.100, 0, 0.88);
  const footPlantBias = clamp(walk * (0.50 + sprint * 0.42) * (1 - air * 0.44) * (1 - vault * 0.28) + land * 0.16 + vPlant * 0.12 + vCrest * 0.11, 0, 1);
  const footClearanceBias = clamp(swing01(phase / TAU) * walk + vaultClearance * 0.72 + air * 0.22, 0, 1.2);
  const baseStrideLength = clamp(0.30 + speedN * 0.36 + sprint * 0.16 - ads * 0.06 + vault * 0.08, 0.24, 0.92);
  const baseStrideCadence = clamp(1.18 + speedN * 1.30 + sprint * 0.48 - crouch * 0.18 + vault * 0.20, 0.82, 3.10);
  const strideMatch = resolveBodyPresenceStrideMatch({ speed, speedN, sprint, ads, vault, land, air, baseStrideLength, baseCadence: baseStrideCadence });
  const strideLength = clamp(baseStrideLength * strideMatch.strideScale + strideMatch.footLockReach * 0.10, 0.24, 0.96);
  const strideCadence = clamp(baseStrideCadence * strideMatch.cadenceScale, 0.78, 3.32);
  const plantStrength = clamp(footPlantBias * (0.66 + sprint * 0.30 + land * 0.12 + strideMatch.antiSlideBoost * 0.34) * (1 - air * 0.35) + strideMatch.antiSlideBoost * 0.16, 0, 1.26);
  const vaultFootClearance = clamp(vaultClearance * (0.72 + vCrest * 0.36 + vExit * 0.12), 0, 1.34);
  const lookDownInspection = clamp(lookDown * (1 - ads * 0.62) * (1 - vault * 0.32), 0, 1);
  const vaultKneeClearance = clamp(vaultFootClearance * (0.46 + vCrest * 0.24) + vaultClearance * 0.22, 0, 1.28);
  const contactWindow = strideMatch.contactWindow;
  const soleLock = strideMatch.soleLock;
  const plantedStepComp = strideMatch.plantedStepComp;
  const legReachClamp = clamp(strideMatch.movingConfidence * (0.045 + speedN * 0.080) + sprint * 0.035 + lookDownInspection * 0.025 - vault * 0.025, 0, 0.22);
  const vaultHipClearance = clamp(vaultClearance * (0.38 + vCrest * 0.34) + vault * (vPlant * 0.14 + vExit * 0.10), 0, 1.14);
  const root = {
    x: clamp(turn * 0.020 + Math.sin(phase * 0.5) * walk * 0.004 + vSide * (vPlant * 0.012 + vCrest * 0.028 - vExit * 0.010), -0.12, 0.12),
    y: clamp(-0.865 + crouch * 0.040 + air * 0.082 - land * 0.055 + vis * 0.020 - ads * 0.060 + vault * 0.050 + vPlant * 0.050 + vCrest * 0.150 - vExit * 0.040 + vaultClearance * 0.030 + lookDownInspection * 0.030, -1.12, -0.52),
    z: clamp(-0.535 - speedN * 0.032 - crouch * 0.034 + air * 0.060 + land * 0.040 + ads * 0.040 - vault * 0.035 - vPlant * 0.060 - vCrest * 0.100 + vExit * 0.045 - vaultClearance * 0.030 + lookDownInspection * 0.045, -0.84, -0.30),
    rx: clamp(0.470 + crouch * 0.130 + air * 0.155 - land * 0.080 - ads * 0.070 + vault * 0.105 + vPlant * 0.160 + vCrest * 0.100 - vExit * 0.080 + vaultClearance * 0.055 - lookDownInspection * 0.035, 0.20, 0.98),
    ry: clamp(turn * 0.075 + Math.sin(phase) * walk * 0.008 + vSide * (vPlant * 0.055 + vCrest * 0.105 - vExit * 0.045), -0.30, 0.30),
    rz: clamp(-turn * 0.125 + Math.sin(phase * 0.5) * walk * 0.012 + vSide * (vPlant * 0.060 + vCrest * 0.140 - vExit * 0.070), -0.38, 0.38)
  };
  return {
    version: BODY_PRESENCE_LOCOMOTION_VERSION,
    speed,
    speedN,
    ads,
    sprint,
    crouch,
    jump,
    fall,
    air,
    land,
    turn,
    phase,
    vis,
    walk,
    vault,
    vaultT,
    vaultDir,
    vaultLeadSide: vSide,
    vaultPlant: vPlant,
    vaultCrest: vCrest,
    vaultExit: vExit,
    vaultClearance,
    targetPresence,
    root,
    rootScale: clamp(0.690 + vis * 0.055 + crouch * 0.020 + land * 0.040 - ads * 0.025 + vault * 0.035 + vCrest * 0.025, 0.58, 0.84),
    spread: clamp(0.135 + crouch * 0.030 + ads * 0.045 + walk * 0.014 + speedN * 0.012 - vCrest * 0.018, 0.11, 0.22),
    kneeBend: clamp(opts.kneeBend || 0, 0, 1),
    footPlantBias,
    footClearanceBias,
    strideLength,
    strideCadence,
    strideSpeedMatch: strideMatch.movingConfidence,
    strideMatch,
    antiSlideBoost: strideMatch.antiSlideBoost,
    footLockReach: strideMatch.footLockReach,
    toeCatch: strideMatch.toeCatch,
    contactWindow,
    soleLock,
    plantedStepComp,
    legReachClamp,
    plantStrength,
    vaultFootClearance,
    vaultKneeClearance,
    vaultHipClearance,
    lookDown,
    lookDownInspection,
    gaitDrive: clamp(walk + vault * 0.65 + air * 0.25 + land * 0.35, 0, 1.4)
  };
}

function swing01(v) {
  const cycle = wrap01(v);
  return cycle < 0.62 ? 0 : Math.sin(clamp((cycle - 0.62) / 0.38, 0, 1) * Math.PI);
}

export function solveBodyPresenceLegPose(opts = {}) {
  const side = (opts.side || 0) < 0 ? -1 : 1;
  const phase = Number.isFinite(opts.phase) ? opts.phase : 0;
  const walk = clamp(opts.walk, 0, 1);
  const sprint = clamp(opts.sprint, 0, 1);
  const crouch = clamp(opts.crouch, 0, 1);
  const air = clamp(opts.air, 0, 1);
  const land = clamp(opts.land, 0, 1);
  const turn = clamp(Number.isFinite(opts.turn) ? opts.turn : 0, -1, 1);
  const spread = clamp(opts.spread, 0.10, 0.24);
  const baseKnee = clamp(opts.kneeBend, 0, 1.2);
  const vault = clamp(opts.vault, 0, 1);
  const vPlant = clamp(opts.vaultPlant, 0, 1);
  const vCrest = clamp(opts.vaultCrest, 0, 1);
  const vExit = clamp(opts.vaultExit, 0, 1);
  const plantBias = clamp(Number.isFinite(opts.footPlantBias) ? opts.footPlantBias : walk, 0, 1);
  const strideLength = clamp(Number.isFinite(opts.strideLength) ? opts.strideLength : 0.40 + walk * 0.22 + sprint * 0.12, 0.24, 0.94);
  const framePlantStrength = clamp(Number.isFinite(opts.plantStrength) ? opts.plantStrength : plantBias, 0, 1.22);
  const frameVaultFootClearance = clamp(Number.isFinite(opts.vaultFootClearance) ? opts.vaultFootClearance : 0, 0, 1.36);
  const frameVaultKneeClearance = clamp(Number.isFinite(opts.vaultKneeClearance) ? opts.vaultKneeClearance : 0, 0, 1.36);
  const lookDownInspection = clamp(Number.isFinite(opts.lookDownInspection) ? opts.lookDownInspection : 0, 0, 1);
  const antiSlideBoost = clamp(Number.isFinite(opts.antiSlideBoost) ? opts.antiSlideBoost : 0, 0, 0.38);
  const footLockReach = clamp(Number.isFinite(opts.footLockReach) ? opts.footLockReach : 0, 0, 0.22);
  const toeCatch = clamp(Number.isFinite(opts.toeCatch) ? opts.toeCatch : 0, 0, 0.32);
  const speedN = clamp(Number.isFinite(opts.speedN) ? opts.speedN : 0, 0, 1);
  const contactWindow = clamp(Number.isFinite(opts.contactWindow) ? opts.contactWindow : 0.62, 0.52, 0.70);
  const soleLock = clamp(Number.isFinite(opts.soleLock) ? opts.soleLock : 0, 0, 0.44);
  const plantedStepComp = clamp(Number.isFinite(opts.plantedStepComp) ? opts.plantedStepComp : 0, 0, 0.20);
  const legReachClamp = clamp(Number.isFinite(opts.legReachClamp) ? opts.legReachClamp : 0, 0, 0.24);
  const frameVaultHipClearance = clamp(Number.isFinite(opts.vaultHipClearance) ? opts.vaultHipClearance : 0, 0, 1.18);
  const lead = side === (opts.vaultLeadSide || 1) ? 1 : 0;
  const trail = 1 - lead;
  const cycle = wrap01(phase / TAU);
  const stanceT = clamp(cycle / contactWindow, 0, 1);
  const swingT = clamp((cycle - contactWindow) / Math.max(0.001, 1 - contactWindow), 0, 1);
  const inStance = cycle < contactWindow;
  const stanceLock = inStance ? smoothstep(stanceT, 0.04, 0.22) * (1 - smoothstep(stanceT, 0.82, 1.00)) : 0;
  const heelStrike = inStance ? (1 - smoothstep(stanceT, 0.03, 0.24)) * walk : 0;
  const toeOff = inStance ? smoothstep(stanceT, 0.70, 0.98) * walk : 0;
  const swingLift = inStance ? 0 : Math.sin(swingT * Math.PI) * walk;
  const strideScale = (1 + sprint * 0.45) * (0.74 + strideLength * 0.74);
  const stanceTravel = (-0.055 + smooth01(stanceT) * 0.122) * strideScale;
  const swingTravel = (0.086 - smooth01(swingT) * 0.178) * strideScale;
  const strideTravel = walk * (inStance ? stanceTravel : swingTravel);
  const plantLock = stanceLock * walk;
  const stanceAnchor = clamp(plantLock * (0.56 + sprint * 0.30 + plantBias * 0.22 + antiSlideBoost * 0.42 + lookDownInspection * 0.08) + heelStrike * 0.12 + land * 0.11 - swingLift * 0.18 - air * 0.16, 0, 1.36);
  const plantStrength = clamp(plantLock * (0.62 + sprint * 0.32 + framePlantStrength * 0.30 + lookDownInspection * 0.08 + antiSlideBoost * 0.38 + soleLock * 0.20) + heelStrike * (0.11 + toeCatch * 0.12) + land * 0.12 + antiSlideBoost * 0.18 + stanceAnchor * 0.10, 0, 1.52);
  const contactTravelHold = stanceAnchor * (plantedStepComp + 0.028 + speedN * 0.032 + sprint * 0.026 + footLockReach * 0.30 + antiSlideBoost * 0.046 + legReachClamp * 0.18);
  const plantedTravelHold = plantLock * (0.050 + sprint * 0.034 + plantBias * 0.032 + strideLength * 0.022 + lookDownInspection * 0.012 + footLockReach * 0.44 + antiSlideBoost * 0.035) + contactTravelHold;
  const footWorldStabilize = clamp(plantStrength * (0.54 + sprint * 0.28 + plantBias * 0.24 + lookDownInspection * 0.06 + antiSlideBoost * 0.26 + soleLock * 0.20) + stanceAnchor * 0.18 - swingLift * 0.17 - air * 0.18, 0, 1.42);
  const toeDragSuppression = clamp(footWorldStabilize * 0.72 + plantStrength * 0.26, 0, 1.24);
  const footPinning = clamp(footWorldStabilize * 0.68 + plantStrength * 0.30 + lookDownInspection * 0.08 + stanceAnchor * 0.14, 0, 1.44);
  const stanceCompression = clamp(plantStrength * 0.135 + land * 0.18 + lookDownInspection * 0.055, 0, 0.34);
  const soleFlatten = clamp(stanceAnchor * (0.58 + soleLock * 0.82) + heelStrike * 0.18 + land * 0.13 - swingLift * 0.16, 0, 1.32);
  const ankleCompression = clamp(stanceCompression * 0.70 + soleFlatten * 0.075 + heelStrike * 0.035, 0, 0.28);
  const toeRollDamp = clamp(1 - toeDragSuppression * 0.40 - soleFlatten * 0.18, 0.30, 1);
  const yawDamp = clamp(1 - footWorldStabilize * 0.56 - soleFlatten * 0.14, 0.24, 1);
  const vaultTuck = clamp(vault * (lead * (vPlant * 0.82 + vCrest * 0.62 + vExit * 0.18) + trail * (vPlant * 0.18 + vCrest * 0.50 + vExit * 0.30)), 0, 1.12);
  const vaultClearance = clamp(vault * (lead * (vPlant * 0.42 + vCrest * 0.96 + vExit * 0.22) + trail * (vPlant * 0.12 + vCrest * 0.64 + vExit * 0.34)) + frameVaultFootClearance * (lead ? 0.22 : 0.16), 0, 1.36);
  const vaultKneeClearance = clamp(frameVaultKneeClearance * (lead ? 0.52 : 0.36) + vaultTuck * 0.24 + vaultClearance * 0.18 + frameVaultHipClearance * 0.12, 0, 1.32);
  const vaultTrailSweep = clamp(vault * trail * (vPlant * 0.16 + vCrest * 0.46 + vExit * 0.58), 0, 0.92);
  const knee = clamp(baseKnee + swingLift * (0.38 + sprint * 0.18) + plantLock * 0.10 + toeOff * 0.20 + heelStrike * 0.14 + land * 0.45 + crouch * 0.28 + air * 0.16 + vaultTuck * 0.78 + vaultClearance * 0.18 + vaultKneeClearance * 0.12, 0, 1.78);
  const sideSpread = spread + side * (turn * 0.006) + vault * side * (lead ? 0.018 + vCrest * 0.016 : -0.010 - vCrest * 0.012);
  const root = {
    x: side * sideSpread,
    y: -0.024 + swingLift * 0.040 - plantStrength * 0.024 - stanceCompression * 0.055 - ankleCompression * 0.045 - land * 0.012 - crouch * 0.020 + vaultTuck * 0.092 + vCrest * 0.030 + vaultClearance * 0.046 + vaultKneeClearance * 0.018 + frameVaultHipClearance * 0.026,
    z: 0.020 + strideTravel * 0.35 - plantedTravelHold + plantLock * 0.006 - contactTravelHold * 0.26 + vault * (lead * (-0.105 * vPlant - 0.165 * vCrest + 0.032 * vExit) + trail * (0.050 * vPlant - 0.052 * vCrest + 0.086 * vExit + vaultTrailSweep * 0.030)),
    rx: 0.020 + air * 0.075 + land * 0.055 + crouch * 0.040 + vaultTuck * 0.520 + lead * vPlant * 0.185 - vExit * 0.085,
    ry: side * ((turn * 0.110 + strideTravel * 0.115) * yawDamp + lead * vCrest * 0.065 - trail * vCrest * 0.035),
    rz: side * ((strideTravel * 0.330 + turn * 0.085) * toeRollDamp + lead * (vPlant * 0.130 + vCrest * 0.085) - trail * vCrest * 0.095)
  };
  const bootDip = plantStrength * (0.036 + sprint * 0.012 + antiSlideBoost * 0.014 + soleLock * 0.008) + heelStrike * (0.011 + toeCatch * 0.010) + land * 0.042 + crouch * 0.010 + stanceCompression * 0.10 + ankleCompression * 0.050;
  const clearanceLift = vaultClearance * 0.070 + frameVaultHipClearance * 0.025;
  const lowerLift = swingLift * 0.055 + vaultTuck * 0.055 + clearanceLift;
  const footPitch = (heelStrike * (0.180 + toeCatch * 0.085) - toeOff * (0.300 + toeCatch * 0.055) + swingLift * 0.320 - air * 0.125 - land * 0.160 + crouch * 0.060 - soleFlatten * 0.075) * toeRollDamp + vaultTuck * 0.390 + vaultClearance * 0.230 + vaultTrailSweep * 0.075;
  const footYaw = side * ((turn * 0.060 + strideTravel * 0.200) * yawDamp + vaultTuck * 0.055);
  const footRoll = side * ((0.024 + strideTravel * 0.480 + turn * 0.035) * toeRollDamp + lead * vCrest * 0.050 - trail * vCrest * 0.030);
  const reach = strideTravel;
  const parts = {
    thigh: pose(0, -knee * 0.010 + lowerLift * 0.22 + frameVaultHipClearance * 0.026, reach * 0.20 - plantedTravelHold * 0.18 - contactTravelHold * 0.12 + vaultTrailSweep * 0.018, knee * 0.200 + air * 0.090 + crouch * 0.080 + vaultTuck * 0.160 + vaultClearance * 0.060 + frameVaultHipClearance * 0.045, side * ((turn * 0.030 + reach * 0.130) * yawDamp), side * reach * 0.250 * toeRollDamp),
    knee: pose(0, -knee * 0.012 + lowerLift * 0.30 + vaultClearance * 0.018 + vaultKneeClearance * 0.034 + frameVaultHipClearance * 0.030, reach * 0.36 - plantedTravelHold * 0.35 - contactTravelHold * 0.18 + vaultTrailSweep * 0.026, knee * 0.155 + land * 0.060 + vaultTuck * 0.130 + vaultClearance * 0.090 + vaultKneeClearance * 0.085 + frameVaultHipClearance * 0.052, side * ((turn * 0.035 + reach * 0.100) * yawDamp), side * reach * 0.210 * toeRollDamp),
    shin: pose(0, -knee * 0.024 + lowerLift * 0.54 + vaultClearance * 0.026 + vaultKneeClearance * 0.046 + frameVaultHipClearance * 0.034, reach * 0.54 - plantedTravelHold * 0.58 - contactTravelHold * 0.24 + vaultTrailSweep * 0.034, knee * 0.295 - air * 0.060 - land * 0.080 + vaultTuck * 0.260 + vaultClearance * 0.140 + vaultKneeClearance * 0.120 + frameVaultHipClearance * 0.060, side * ((turn * 0.040 + reach * 0.145) * yawDamp), -side * reach * 0.320 * toeRollDamp),
    calfGuard: pose(0, -knee * 0.022 + lowerLift * 0.48 + vaultClearance * 0.022 + vaultKneeClearance * 0.036 + frameVaultHipClearance * 0.028, reach * 0.50 - plantedTravelHold * 0.52 - contactTravelHold * 0.22 + vaultTrailSweep * 0.030, knee * 0.235 - air * 0.050 - land * 0.055 + vaultTuck * 0.220 + vaultClearance * 0.120 + vaultKneeClearance * 0.098 + frameVaultHipClearance * 0.052, side * ((turn * 0.044 + reach * 0.130) * yawDamp), -side * reach * 0.280 * toeRollDamp),
    boot: pose(side * turn * 0.006 * yawDamp, -bootDip + lowerLift - ankleCompression * 0.018, reach * 0.78 - plantLock * 0.030 - plantedTravelHold * 0.84 - contactTravelHold * 0.30 + vaultTrailSweep * 0.040, footPitch, footYaw, footRoll),
    sole: pose(side * turn * 0.006 * yawDamp, -bootDip - 0.010 + lowerLift - ankleCompression * 0.020, reach * 0.82 - plantLock * 0.036 - plantedTravelHold * 0.90 - contactTravelHold * 0.34 + vaultTrailSweep * 0.044, footPitch + (toeOff * 0.035 - heelStrike * 0.020 - soleFlatten * 0.030) * toeRollDamp, footYaw, footRoll * (1 - soleFlatten * 0.18)),
    heel: pose(0, -bootDip * 0.76 + lowerLift * 0.68 - ankleCompression * 0.012, reach * 0.62 - plantLock * 0.018 - plantedTravelHold * 0.62 - contactTravelHold * 0.22 + vaultTrailSweep * 0.030, knee * 0.220 - air * 0.070 - land * 0.095 + vaultTuck * 0.170 + vaultClearance * 0.075 + frameVaultHipClearance * 0.034, side * ((turn * 0.042 + reach * 0.110) * yawDamp), side * reach * 0.190 * toeRollDamp),
    toe: pose(side * turn * 0.010 * yawDamp, -bootDip * 0.70 + lowerLift * 1.08 + vaultClearance * 0.020 - ankleCompression * 0.008, reach * 0.98 - plantLock * 0.046 - plantedTravelHold * 1.04 - contactTravelHold * 0.40 + vaultTrailSweep * 0.052, footPitch + (toeOff * 0.160 + swingLift * 0.060 - soleFlatten * 0.024) * toeRollDamp + vaultTuck * 0.090, side * ((turn * 0.070 + reach * 0.210) * yawDamp + vaultTuck * 0.025), side * ((0.034 + reach * 0.560) * toeRollDamp + vaultTuck * 0.045))
  };
  return {
    version: BODY_PRESENCE_LOCOMOTION_VERSION,
    side,
    root,
    parts,
    state: {
      cycle: Number(cycle.toFixed(4)),
      stance: inStance ? 1 : 0,
      plantLock: Number(plantLock.toFixed(4)),
      heelStrike: Number(heelStrike.toFixed(4)),
      toeOff: Number(toeOff.toFixed(4)),
      swingLift: Number(swingLift.toFixed(4)),
      strideTravel: Number(strideTravel.toFixed(4)),
      vaultTuck: Number(vaultTuck.toFixed(4)),
      vaultClearance: Number(vaultClearance.toFixed(4)),
      knee: Number(knee.toFixed(4)),
      antiSlide: Number((plantStrength * (1 + sprint * 0.46 + plantBias * 0.24)).toFixed(4)),
      footWorldStabilize: Number(footWorldStabilize.toFixed(4)),
      plantedTravelHold: Number(plantedTravelHold.toFixed(4)),
      strideLength: Number(strideLength.toFixed(4)),
      plantStrength: Number(plantStrength.toFixed(4)),
      antiSlideBoost: Number(antiSlideBoost.toFixed(4)),
      footLockReach: Number(footLockReach.toFixed(4)),
      toeCatch: Number(toeCatch.toFixed(4)),
      contactWindow: Number(contactWindow.toFixed(4)),
      soleLock: Number(soleLock.toFixed(4)),
      plantedStepComp: Number(plantedStepComp.toFixed(4)),
      legReachClamp: Number(legReachClamp.toFixed(4)),
      stanceAnchor: Number(stanceAnchor.toFixed(4)),
      contactTravelHold: Number(contactTravelHold.toFixed(4)),
      soleFlatten: Number(soleFlatten.toFixed(4)),
      ankleCompression: Number(ankleCompression.toFixed(4)),
      toeDragSuppression: Number(toeDragSuppression.toFixed(4)),
      footPinning: Number(footPinning.toFixed(4)),
      stanceCompression: Number(stanceCompression.toFixed(4)),
      vaultFootClearance: Number(frameVaultFootClearance.toFixed(4)),
      vaultKneeClearance: Number(vaultKneeClearance.toFixed(4)),
      vaultHipClearance: Number(frameVaultHipClearance.toFixed(4)),
      vaultTrailSweep: Number(vaultTrailSweep.toFixed(4)),
      lookDownInspection: Number(lookDownInspection.toFixed(4))
    }
  };
}

export function buildBodyPresenceProbeSample(opts = {}) {
  const frame = buildBodyPresenceLocomotionFrame(opts);
  const left = solveBodyPresenceLegPose({ ...frame, side: -1, phase: frame.phase });
  const right = solveBodyPresenceLegPose({ ...frame, side: 1, phase: frame.phase + Math.PI });
  return {
    version: BODY_PRESENCE_LOCOMOTION_VERSION,
    frame: {
      targetPresence: Number(frame.targetPresence.toFixed(4)),
      walk: Number(frame.walk.toFixed(4)),
      vaultCrest: Number(frame.vaultCrest.toFixed(4)),
      vaultClearance: Number(frame.vaultClearance.toFixed(4)),
      footPlantBias: Number(frame.footPlantBias.toFixed(4)),
      strideLength: Number(frame.strideLength.toFixed(4)),
      strideCadence: Number(frame.strideCadence.toFixed(4)),
      plantStrength: Number(frame.plantStrength.toFixed(4)),
      contactWindow: Number(frame.contactWindow.toFixed(4)),
      soleLock: Number(frame.soleLock.toFixed(4)),
      plantedStepComp: Number(frame.plantedStepComp.toFixed(4)),
      legReachClamp: Number(frame.legReachClamp.toFixed(4)),
      vaultFootClearance: Number(frame.vaultFootClearance.toFixed(4)),
      vaultKneeClearance: Number(frame.vaultKneeClearance.toFixed(4)),
      vaultHipClearance: Number(frame.vaultHipClearance.toFixed(4)),
      lookDownInspection: Number(frame.lookDownInspection.toFixed(4)),
      root: roundPose(frame.root)
    },
    left: { root: roundPose(left.root), state: left.state },
    right: { root: roundPose(right.root), state: right.state }
  };
}
