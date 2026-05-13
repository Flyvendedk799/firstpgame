/**
 * Named procedural "bones" for first-person hands + weapon socket offsets.
 * Uses PLAYER_VIEWMODEL_PROFILE.weaponGripOffsets (array [x,y,z] tuples).
 */
import { PLAYER_VIEWMODEL_PROFILE, WEAPON_SOCKETS_SPEC } from './visualProfiles.js';
import { getReloadWeaponClass } from './reloadTimelines.js';

const SKELETON_KEYS = [
  'rightClavicle', 'rightForearm', 'rightWrist', 'rightPalm',
  'rightThumb', 'rightIndex', 'rightMiddle', 'rightRing', 'rightPinky', 'rightCurl',
  'leftForearm', 'leftWrist', 'leftPalm', 'leftIndex', 'leftMiddle', 'leftRing', 'leftPinky', 'leftFingers', 'leftThumb',
  'weaponSocket'
];

export function createHandRigBindings() {
  const o = {};
  for (const k of SKELETON_KEYS) o[k] = null;
  return o;
}

export function captureViewmodelRestPose(bindings) {
  const rest = {};
  for (const k of SKELETON_KEYS) {
    const g = bindings[k];
    if (!g || !g.position) continue;
    rest[k] = {
      px: g.position.x, py: g.position.y, pz: g.position.z,
      rx: g.rotation.x, ry: g.rotation.y, rz: g.rotation.z
    };
  }
  return rest;
}

export function weaponTypeFromIdx(weaponIdx) {
  const c = getReloadWeaponClass(weaponIdx);
  if (c === 'knife') return 'knife';
  if (c === 'shotgun') return 'shotgun';
  if (c === 'smg') return 'smg';
  if (c === 'marksman' || c === 'sniper') return 'marksman';
  if (c === 'rifle') return 'rifle';
  if (c === 'pistol' || c === 'pistolCompact') return 'pistol';
  return 'rifle';
}

export function applyWeaponGripPose(weaponIdx, adsWeight, sprintWeight, out) {
  const wt = weaponTypeFromIdx(weaponIdx);
  const g = (PLAYER_VIEWMODEL_PROFILE.weaponGripOffsets || {})[wt] || PLAYER_VIEWMODEL_PROFILE.weaponGripOffsets.rifle;
  const o = out || { left: [0, 0, 0], right: [0, 0, 0] };
  const L = g && g.left ? g.left : [0, 0, 0];
  const R = g && g.right ? g.right : [0.02, -0.02, -0.04];
  const ads = Math.max(0, Math.min(1, adsWeight || 0));
  const spr = Math.max(0, Math.min(1, sprintWeight || 0));
  const tuck = (1 - ads) * spr * 0.35;
  o.left = [L[0] * (1 - ads * 0.25) - tuck * 0.02, L[1] - tuck * 0.015, L[2] + tuck * 0.01];
  o.right = [R[0] * (1 - ads * 0.15), R[1], R[2]];
  return o;
}

export function blendFingerCurl(curl01, outEuler) {
  const c = Math.max(0, Math.min(1, curl01));
  const o = outEuler || [0, 0, 0];
  o[0] = c * 0.55;
  o[1] = 0;
  o[2] = c * -0.08;
  return o;
}

export function getWeaponSocketMeta(weaponIdx) {
  const wt = weaponTypeFromIdx(weaponIdx);
  return WEAPON_SOCKETS_SPEC[wt] || null;
}

export function describeGripForDebug(weaponIdx, adsWeight, sprintWeight) {
  const wt = weaponTypeFromIdx(weaponIdx);
  const g = applyWeaponGripPose(weaponIdx, adsWeight, sprintWeight);
  const sock = getWeaponSocketMeta(weaponIdx);
  return {
    gripPoseId: wt,
    weaponClass: getReloadWeaponClass(weaponIdx),
    leftOffset: g.left.slice(),
    rightOffset: g.right.slice(),
    sockets: sock ? sock.sockets : [],
    hands: sock ? sock.hands : []
  };
}
