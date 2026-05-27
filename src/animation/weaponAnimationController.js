import { getWeaponAnimationProfile, getWeaponFeelProfile, getWeaponFeelTuning, weaponTypeFromIndex } from './profiles.js';
import { resolveViewmodelPose } from './viewmodelPoseResolver.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function damp(current, target, lambda, dt) {
  const d = Math.max(0, Number(dt) || 0);
  return target + (current - target) * Math.exp(-Math.max(0, lambda) * d);
}

function pulseFrom(value, scale = 1) {
  return clamp01((Number(value) || 0) * scale);
}

export function createWeaponAnimationController(options = {}) {
  return {
    version: 2,
    enabled: options.enabled !== false,
    weaponIdx: -1,
    weaponType: 'rifle',
    tuningId: 'weapon-feel.rifle',
    profileId: 'weapon-feel-profile.m4-reference',
    manifestId: 'weapon.m4Reference',
    state: 'idle',
    phase: 0,
    fire: 0,
    reload: 0,
    sprint: 0,
    ads: 0,
    settle: 0,
    bodyCarry: 0,
    dryFire: 0,
    trigger: 0,
    chamber: 0,
    partMotion: {},
    pose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    poseLayers: [],
    lastNotifies: [],
    fallbackReasons: []
  };
}

export function updateWeaponAnimationController(controller, input = {}) {
  const c = controller || createWeaponAnimationController();
  const dt = Math.max(0, Number(input.dt) || 0);
  const weaponIdx = Number(input.weaponIdx) | 0;
  const weaponType = input.weaponType || weaponTypeFromIndex(weaponIdx);
  const profile = getWeaponAnimationProfile(weaponType);
  const tuning = getWeaponFeelTuning(weaponType);
  const feel = getWeaponFeelProfile(weaponIdx);
  const recoil = feel.recoil || {};
  const ads = clamp01(input.ads);
  const sprint = clamp01(input.sprint);
  const reloadProgress = clamp01(input.reloadProgress);
  const reloading = !!input.reloading;
  const shotImpulse = pulseFrom(input.shotImpulse, 1.2);
  const dryFire = pulseFrom(input.dryFire, 1.5);
  const lastRound = pulseFrom(input.lastRound, 1.2);
  const emptyClick = pulseFrom(input.emptyClick, 1.4);
  const movementKick = pulseFrom(input.footstepKick, 0.85);
  const bodyCarry = pulseFrom(input.bodyCarry, 1.0);
  const landing = pulseFrom(input.landing, 1.2);
  const wallKick = pulseFrom(input.wallKick, 1.0);
  const dropkick = pulseFrom(input.dropkick, 1.0);
  const settleTarget = Math.max(movementKick * 0.46, bodyCarry * 0.62, landing, wallKick * 0.82, dropkick * 0.74);
  const adsProtect = Math.max(0, Math.min(1, ads * (profile.adsProtection || 1)));
  const hipWeight = 1 - Math.min(0.88, adsProtect * 0.88);

  if (c.weaponIdx !== weaponIdx) {
    c.phase = 0;
    c.fire = 0;
    c.reload = 0;
    c.sprint = 0;
    c.settle = 0;
    c.bodyCarry = 0;
    c.dryFire = 0;
    c.chamber = 0;
  }

  c.weaponIdx = weaponIdx;
  c.weaponType = weaponType;
  c.tuningId = tuning.id;
  c.profileId = feel.id;
  c.manifestId = feel.manifestId;
  c.phase += dt * (1.2 + (profile.snap || 1) * 0.35) * (tuning.mechanicalSettle || 1);
  c.ads = damp(c.ads || 0, ads, 16 * (tuning.adsSettle || 1), dt);
  c.sprint = damp(c.sprint || 0, sprint, 10, dt);
  c.reload = damp(c.reload || 0, reloading ? Math.max(0.2, Math.sin(reloadProgress * Math.PI)) : 0, reloading ? 12 : 16, dt);
  c.bodyCarry = damp(c.bodyCarry || 0, bodyCarry, bodyCarry > (c.bodyCarry || 0) ? 18 : 9, dt);
  c.settle = damp(c.settle || 0, settleTarget, settleTarget > (c.settle || 0) ? 22 : 8, dt);
  c.fire = Math.max(damp(c.fire || 0, 0, 18 * (profile.recovery || 1) * (tuning.returnSpeed || 1) * (recoil.recover || 1), dt), shotImpulse * (recoil.snap || 1), lastRound * 0.8);
  c.dryFire = Math.max(damp(c.dryFire || 0, 0, 22 * (tuning.returnSpeed || 1), dt), dryFire, emptyClick * 0.55);
  c.trigger = Math.max(c.fire * 0.9, c.dryFire * 0.7);
  c.chamber = damp(c.chamber || 0, reloading && reloadProgress > 0.68 ? 1 : 0, 18, dt);

  const fire = c.fire * (tuning.recoilVisual || 1);
  const dry = c.dryFire * (tuning.dryFireVisual || 1);
  const reload = c.reload * (tuning.reloadVisual || 1);
  const reloadParts = c.reload * (1 - Math.min(0.55, ads * 0.55)) * (tuning.reloadVisual || 1);
  const sprintPose = c.sprint * (tuning.sprintLow || 1);
  const gait = movementKick * hipWeight;
  const mass = profile.mass || 1;
  const side = input.fireSide == null ? 1 : Math.sign(Number(input.fireSide) || 1);
  const resolvedPose = resolveViewmodelPose({
    weaponIdx,
    weaponType,
    animationProfile: profile,
    phase: c.phase,
    ads,
    sprint: sprintPose,
    reload,
    fire,
    dryFire: dry,
    footstepKick: gait,
    fireSide: side,
    bodyCarry: c.bodyCarry,
    settle: c.settle,
    landing,
    wallKick,
    dropkick,
    lean: input.lean,
    guard: input.guard,
    slide: input.slide,
    hit: input.hit,
    damage: input.damage
  });

  c.pose = resolvedPose.pose;
  c.poseLayers = resolvedPose.layers;

  c.partMotion = {
    trigger: Number((c.trigger * (tuning.trigger || 1)).toFixed(4)),
    slide: Number(((weaponType === 'pistol' ? c.fire : 0) * hipWeight * (tuning.slide || 1)).toFixed(4)),
    bolt: Number(((weaponType !== 'pistol' ? c.fire : c.chamber * 0.55) * hipWeight * (tuning.bolt || 1)).toFixed(4)),
    pump: Number(((weaponType === 'shotgun' ? Math.max(c.fire * 0.75, c.chamber) : 0) * hipWeight * (tuning.pump || 1)).toFixed(4)),
    magazine: Number((reloadParts * (tuning.magazine || 1)).toFixed(4)),
    chamber: Number((c.chamber * (tuning.chamber || 1)).toFixed(4)),
    supportBrace: Number((ads * (1 - sprint) * (1 + mass * 0.08) * (tuning.supportBrace || 1)).toFixed(4))
  };

  c.state = reloading ? 'reload'
    : sprint > 0.35 && ads < 0.2 ? 'sprintLow'
    : c.fire > 0.04 ? 'fire'
        : ads > 0.5 ? 'ads'
          : 'hip';
  c.lastNotifies = Array.isArray(input.notifies) ? input.notifies.slice(-8) : [];
  c.fallbackReasons = [];
  if (!input.hasAuthoredParts) c.fallbackReasons.push('procedural-weapon-parts');
  return c;
}

export function applyWeaponPoseToObject(object3d, pose, options = {}) {
  if (!object3d || !pose) return false;
  const scale = Number.isFinite(Number(options.scale)) ? Number(options.scale) : 1;
  const ads = clamp01(options.ads);
  const adsProtect = 1 - Math.min(0.72, ads * 0.72);
  object3d.position.x += (Number(pose.x) || 0) * scale * adsProtect;
  object3d.position.y += (Number(pose.y) || 0) * scale * adsProtect;
  object3d.position.z += (Number(pose.z) || 0) * scale * (1 - Math.min(0.58, ads * 0.58));
  object3d.rotation.x += (Number(pose.rx) || 0) * scale * adsProtect;
  object3d.rotation.y += (Number(pose.ry) || 0) * scale * adsProtect;
  object3d.rotation.z += (Number(pose.rz) || 0) * scale * adsProtect;
  object3d.userData.weaponAnimationPose = {
    x: Number((pose.x || 0).toFixed(5)),
    y: Number((pose.y || 0).toFixed(5)),
    z: Number((pose.z || 0).toFixed(5)),
    rx: Number((pose.rx || 0).toFixed(5)),
    ry: Number((pose.ry || 0).toFixed(5)),
    rz: Number((pose.rz || 0).toFixed(5)),
    adsProtect: Number(adsProtect.toFixed(4))
  };
  return true;
}

export function weaponAnimationDebug(controller) {
  const c = controller || createWeaponAnimationController();
  return {
    version: c.version || 1,
    enabled: c.enabled !== false,
    weaponIdx: c.weaponIdx,
    weaponType: c.weaponType,
    tuningId: c.tuningId || `weapon-feel.${c.weaponType || 'rifle'}`,
    profileId: c.profileId || null,
    manifestId: c.manifestId || null,
    state: c.state,
    ads: Number((c.ads || 0).toFixed(4)),
    sprint: Number((c.sprint || 0).toFixed(4)),
    bodyCarry: Number((c.bodyCarry || 0).toFixed(4)),
    settle: Number((c.settle || 0).toFixed(4)),
    fire: Number((c.fire || 0).toFixed(4)),
    reload: Number((c.reload || 0).toFixed(4)),
    dryFire: Number((c.dryFire || 0).toFixed(4)),
    pose: Object.fromEntries(Object.entries(c.pose || {}).map(([k, v]) => [k, Number((v || 0).toFixed(5))])),
    poseLayers: Array.isArray(c.poseLayers) ? c.poseLayers.map((l) => ({
      name: l.name,
      weight: Number((l.weight || 0).toFixed(4)),
      source: l.source || null,
      pose: Object.fromEntries(Object.entries(l.pose || {}).map(([k, v]) => [k, Number((v || 0).toFixed(5))]))
    })) : [],
    partMotion: { ...(c.partMotion || {}) },
    fallbackReasons: (c.fallbackReasons || []).slice(),
    recentNotifies: (c.lastNotifies || []).map((n) => n.name || n).slice(-8)
  };
}
