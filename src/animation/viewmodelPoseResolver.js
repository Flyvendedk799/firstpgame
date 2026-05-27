import { getWeaponAnimationProfile, getWeaponFeelProfile, weaponTypeFromIndex } from './profiles.js';

export const VIEWMODEL_POSE_LAYER_ORDER = Object.freeze([
  'baseHold',
  'locomotionInertia',
  'ads',
  'fireRecoil',
  'reload',
  'inspectSwap',
  'sprint',
  'leanGuardSlide',
  'hitDamage',
  'finalSightCorrection'
]);

const POSE_KEYS = Object.freeze(['x', 'y', 'z', 'rx', 'ry', 'rz']);
const ZERO_POSE = Object.freeze({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function clampWeight(v, max = 2) {
  return Math.max(0, Math.min(max, Number(v) || 0));
}

function finite(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function poseFrom(src = ZERO_POSE) {
  const out = {};
  for (const key of POSE_KEYS) out[key] = finite(src[key]);
  return out;
}

function addScaled(dst, src, weight = 1, side = 1) {
  const w = finite(weight);
  if (Math.abs(w) < 1e-6 || !src) return dst;
  const s = Math.sign(Number(side) || 1);
  dst.x += finite(src.x) * w * s;
  dst.y += finite(src.y) * w;
  dst.z += finite(src.z) * w;
  dst.rx += finite(src.rx) * w;
  dst.ry += finite(src.ry) * w * s;
  dst.rz += finite(src.rz) * w * s;
  return dst;
}

function roundedPose(src) {
  const out = {};
  for (const key of POSE_KEYS) out[key] = Number(finite(src[key]).toFixed(6));
  return out;
}

function layer(name, pose, weight = 1, source = 'procedural') {
  return {
    name,
    weight: Number(finite(weight).toFixed(4)),
    source,
    pose: roundedPose(pose)
  };
}

export function resolveViewmodelPose(input = {}) {
  const weaponIdx = Number(input.weaponIdx) | 0;
  const weaponType = input.weaponType || weaponTypeFromIndex(weaponIdx);
  const feel = getWeaponFeelProfile(weaponIdx);
  const animationProfile = input.animationProfile || getWeaponAnimationProfile(weaponType);
  const recoil = feel.recoil || {};
  const feelPose = feel.pose || {};
  const phase = finite(input.phase);
  const side = input.fireSide == null ? 1 : Math.sign(Number(input.fireSide) || 1);
  const ads = clamp01(input.ads);
  const hipWeight = 1 - Math.min(0.88, ads * (animationProfile.adsProtection || 1) * 0.88);
  const movementKick = clampWeight(input.footstepKick, 1.5);
  const fireWeight = clampWeight(input.fire) * hipWeight * (recoil.viewmodelKick || 1);
  const dryWeight = clampWeight(input.dryFire, 1.5) * hipWeight;
  const reloadWeight = clampWeight(input.reload, 1.5) * (1 - Math.min(0.55, ads * 0.55));
  const sprintWeight = clampWeight(input.sprint, 1.5) * (1 - ads);
  const inspectWeight = clamp01(input.inspect || input.swap || 0);
  const leanWeight = clamp01(Math.abs(input.lean || 0) + Math.abs(input.guard || 0) + Math.abs(input.slide || 0));
  const hitWeight = clamp01(input.hit || input.damage || 0);
  const finalSightWeight = clamp01(input.finalSightCorrection || 0);
  const mass = finite(animationProfile.mass || 1);
  const wave = Math.sin(phase * 8.0);
  const total = poseFrom(feelPose.base || ZERO_POSE);
  const layers = [];

  const baseHold = poseFrom(feelPose.base || ZERO_POSE);
  layers.push(layer('baseHold', baseHold, 1, feel.id));

  const locomotion = {
    x: wave * movementKick * 0.002 * mass,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0
  };
  addScaled(total, locomotion, 1, side);
  layers.push(layer('locomotionInertia', locomotion, movementKick, 'locomotion'));

  const adsPose = poseFrom(feelPose.adsAdditive || ZERO_POSE);
  addScaled(total, adsPose, ads, side);
  layers.push(layer('ads', adsPose, ads, feel.id));

  const firePose = poseFrom(feelPose.fire || animationProfile.firePose || ZERO_POSE);
  addScaled(total, firePose, fireWeight, side);
  if (dryWeight > 0) {
    addScaled(total, { x: 0, y: -0.002, z: -0.006, rx: 0.018, ry: 0, rz: 0.015 }, dryWeight, side);
  }
  layers.push(layer('fireRecoil', firePose, fireWeight, feel.id));

  const reloadPose = poseFrom(feelPose.reload || animationProfile.reloadPose || ZERO_POSE);
  addScaled(total, reloadPose, reloadWeight, 1);
  layers.push(layer('reload', reloadPose, reloadWeight, feel.id));

  const inspectPose = poseFrom(feelPose.inspect || ZERO_POSE);
  addScaled(total, inspectPose, inspectWeight, side);
  layers.push(layer('inspectSwap', inspectPose, inspectWeight, feel.id));

  const sprintPose = poseFrom(feelPose.sprint || animationProfile.sprintPose || ZERO_POSE);
  addScaled(total, sprintPose, sprintWeight, side);
  layers.push(layer('sprint', sprintPose, sprintWeight, feel.id));

  const leanGuardSlide = {
    x: finite(input.lean) * 0.006 + finite(input.guard) * 0.004,
    y: -Math.abs(finite(input.slide)) * 0.006,
    z: Math.abs(finite(input.guard)) * 0.010,
    rx: -Math.abs(finite(input.slide)) * 0.018,
    ry: finite(input.lean) * 0.010,
    rz: -finite(input.lean) * 0.018
  };
  addScaled(total, leanGuardSlide, 1, 1);
  layers.push(layer('leanGuardSlide', leanGuardSlide, leanWeight, 'posture'));

  const hitDamage = {
    x: 0,
    y: -hitWeight * 0.006,
    z: hitWeight * 0.012,
    rx: hitWeight * 0.020,
    ry: 0,
    rz: hitWeight * 0.010 * side
  };
  addScaled(total, hitDamage, 1, 1);
  layers.push(layer('hitDamage', hitDamage, hitWeight, 'damage'));

  const finalSight = poseFrom(input.sightCorrection || ZERO_POSE);
  addScaled(total, finalSight, finalSightWeight, 1);
  layers.push(layer('finalSightCorrection', finalSight, finalSightWeight, 'ads-solver'));

  return {
    weaponIdx,
    weaponType,
    profileId: feel.id,
    manifestId: feel.manifestId,
    pose: roundedPose(total),
    layers: layers.sort((a, b) => VIEWMODEL_POSE_LAYER_ORDER.indexOf(a.name) - VIEWMODEL_POSE_LAYER_ORDER.indexOf(b.name)),
    order: VIEWMODEL_POSE_LAYER_ORDER.slice()
  };
}
