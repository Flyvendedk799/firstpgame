import { getHandFeelTuning, getWeaponAnimationProfile, getWeaponFeelProfile, weaponTypeFromIndex } from './profiles.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function damp(current, target, lambda, dt) {
  const d = Math.max(0, Number(dt) || 0);
  return target + (current - target) * Math.exp(-Math.max(0, lambda) * d);
}

function round(v, digits = 5) {
  const n = Number(v) || 0;
  return Number(n.toFixed(digits));
}

function zeroPose() {
  return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
}

function copyPose(src) {
  return {
    x: Number(src?.x) || 0,
    y: Number(src?.y) || 0,
    z: Number(src?.z) || 0,
    rx: Number(src?.rx) || 0,
    ry: Number(src?.ry) || 0,
    rz: Number(src?.rz) || 0
  };
}

function roundedPose(src) {
  const p = copyPose(src);
  return {
    x: round(p.x),
    y: round(p.y),
    z: round(p.z),
    rx: round(p.rx),
    ry: round(p.ry),
    rz: round(p.rz)
  };
}

function addScaledPose(out, pose, weight) {
  const w = Number(weight) || 0;
  if (!pose || !w) return out;
  out.x += (Number(pose.x) || 0) * w;
  out.y += (Number(pose.y) || 0) * w;
  out.z += (Number(pose.z) || 0) * w;
  out.rx += (Number(pose.rx) || 0) * w;
  out.ry += (Number(pose.ry) || 0) * w;
  out.rz += (Number(pose.rz) || 0) * w;
  return out;
}

function availableSocketSet(input = {}) {
  const out = new Set();
  const readiness = input.socketReadiness || null;
  if (readiness && readiness.sockets && typeof readiness.sockets === 'object') {
    for (const [name, ok] of Object.entries(readiness.sockets)) if (ok) out.add(name);
  }
  const raw = input.availableSockets;
  if (Array.isArray(raw)) {
    for (const name of raw) if (name) out.add(String(name));
  } else if (raw && typeof raw.keys === 'function') {
    for (const name of raw.keys()) if (name) out.add(String(name));
  } else if (raw && typeof raw === 'object') {
    for (const [name, ok] of Object.entries(raw)) if (ok) out.add(name);
  }
  return out;
}

const BASE_GRIP_PROFILE = Object.freeze({
  type: 'rifle',
  id: 'hands.rifle.socketed',
  label: 'Rifle Grip',
  twoHanded: true,
  requiredSockets: ['gripRight', 'gripLeft', 'magazine'],
  right: {
    ads: { x: 0.002, y: -0.002, z: -0.006, rx: -0.016, ry: 0.004, rz: 0.004 },
    sprint: { x: 0.002, y: -0.004, z: 0.006, rx: 0.024, ry: 0.006, rz: -0.015 },
    fire: { x: 0, y: -0.002, z: -0.005, rx: -0.018, ry: 0.003, rz: 0.006 },
    reload: { x: -0.002, y: 0.004, z: 0.006, rx: 0.012, ry: -0.002, rz: -0.01 },
    part: { x: 0, y: -0.001, z: -0.002, rx: -0.012, ry: 0, rz: 0.002 }
  },
  left: {
    ads: { x: 0.006, y: -0.003, z: -0.012, rx: 0.032, ry: -0.006, rz: -0.018 },
    sprint: { x: -0.004, y: 0.004, z: 0.01, rx: 0.036, ry: 0.026, rz: 0.03 },
    fire: { x: 0.001, y: -0.003, z: -0.007, rx: 0.026, ry: 0.004, rz: -0.012 },
    reload: { x: -0.01, y: -0.015, z: 0.02, rx: 0.07, ry: -0.012, rz: -0.04 },
    part: { x: 0, y: -0.002, z: -0.006, rx: 0.03, ry: -0.006, rz: -0.012 }
  },
  fingers: {
    triggerTravel: 0.22,
    gripCurl: 0.1,
    supportCurl: 0.15,
    handOpen: 0.1
  }
});

export const HAND_GRIP_PROFILES = Object.freeze({
  rifle: BASE_GRIP_PROFILE,
  smg: {
    ...BASE_GRIP_PROFILE,
    type: 'smg',
    id: 'hands.smg.foregrip',
    label: 'SMG Foregrip',
    left: {
      ...BASE_GRIP_PROFILE.left,
      ads: { x: 0.008, y: -0.002, z: -0.009, rx: 0.038, ry: -0.01, rz: -0.02 },
      fire: { x: 0.002, y: -0.002, z: -0.005, rx: 0.022, ry: 0.006, rz: -0.01 }
    },
    fingers: { triggerTravel: 0.2, gripCurl: 0.12, supportCurl: 0.18, handOpen: 0.1 }
  },
  shotgun: {
    ...BASE_GRIP_PROFILE,
    type: 'shotgun',
    id: 'hands.shotgun.pump',
    label: 'Shotgun Pump',
    requiredSockets: ['gripRight', 'gripLeft', 'muzzle'],
    right: {
      ...BASE_GRIP_PROFILE.right,
      fire: { x: 0, y: -0.004, z: -0.012, rx: -0.03, ry: -0.002, rz: 0.01 }
    },
    left: {
      ...BASE_GRIP_PROFILE.left,
      part: { x: 0, y: -0.004, z: 0.025, rx: 0.075, ry: -0.026, rz: -0.022 },
      fire: { x: 0.002, y: -0.005, z: -0.011, rx: 0.045, ry: 0.004, rz: -0.016 }
    },
    fingers: { triggerTravel: 0.26, gripCurl: 0.14, supportCurl: 0.23, handOpen: 0.16 }
  },
  marksman: {
    ...BASE_GRIP_PROFILE,
    type: 'marksman',
    id: 'hands.marksman.braced',
    label: 'Marksman Brace',
    left: {
      ...BASE_GRIP_PROFILE.left,
      ads: { x: 0.006, y: -0.004, z: -0.016, rx: 0.042, ry: -0.012, rz: -0.02 },
      fire: { x: 0.001, y: -0.004, z: -0.01, rx: 0.035, ry: 0.002, rz: -0.014 }
    },
    fingers: { triggerTravel: 0.2, gripCurl: 0.12, supportCurl: 0.2, handOpen: 0.08 }
  },
  sniper: {
    ...BASE_GRIP_PROFILE,
    type: 'sniper',
    id: 'hands.sniper.bolt',
    label: 'Sniper Bolt Brace',
    requiredSockets: ['gripRight', 'gripLeft', 'magazine', 'ejectionPort'],
    right: {
      ...BASE_GRIP_PROFILE.right,
      part: { x: 0.002, y: 0.004, z: 0.02, rx: -0.045, ry: 0.035, rz: 0.018 },
      fire: { x: 0, y: -0.005, z: -0.014, rx: -0.036, ry: 0, rz: 0.01 }
    },
    left: {
      ...BASE_GRIP_PROFILE.left,
      ads: { x: 0.005, y: -0.005, z: -0.02, rx: 0.045, ry: -0.012, rz: -0.016 },
      fire: { x: 0, y: -0.004, z: -0.012, rx: 0.034, ry: 0, rz: -0.014 }
    },
    fingers: { triggerTravel: 0.18, gripCurl: 0.1, supportCurl: 0.18, handOpen: 0.08 }
  },
  pistol: {
    type: 'pistol',
    id: 'hands.pistol.twohand',
    label: 'Two-Hand Pistol',
    twoHanded: true,
    requiredSockets: ['gripRight', 'magazine'],
    right: {
      ads: { x: 0.001, y: -0.003, z: -0.004, rx: -0.014, ry: 0.002, rz: 0.006 },
      sprint: { x: 0.001, y: -0.002, z: 0.002, rx: 0.016, ry: 0.002, rz: -0.008 },
      fire: { x: 0.002, y: -0.003, z: -0.006, rx: -0.025, ry: 0.002, rz: 0.014 },
      reload: { x: -0.006, y: 0.002, z: 0.006, rx: 0.014, ry: -0.004, rz: -0.012 },
      part: { x: 0, y: -0.001, z: -0.003, rx: -0.012, ry: 0, rz: 0.003 }
    },
    left: {
      ads: { x: 0.004, y: -0.011, z: -0.009, rx: 0.02, ry: -0.026, rz: -0.02 },
      sprint: { x: -0.002, y: 0.002, z: 0.004, rx: 0.018, ry: 0.012, rz: 0.014 },
      fire: { x: 0.001, y: -0.002, z: -0.004, rx: 0.014, ry: -0.006, rz: -0.012 },
      reload: { x: -0.018, y: -0.012, z: 0.02, rx: 0.08, ry: -0.018, rz: -0.04 },
      part: { x: 0, y: -0.001, z: -0.002, rx: 0.012, ry: -0.002, rz: -0.006 }
    },
    fingers: { triggerTravel: 0.27, gripCurl: 0.11, supportCurl: 0.16, handOpen: 0.14 }
  },
  heavy: {
    ...BASE_GRIP_PROFILE,
    type: 'heavy',
    id: 'hands.heavy.mass',
    label: 'Heavy Weapon Brace',
    right: {
      ...BASE_GRIP_PROFILE.right,
      fire: { x: 0, y: -0.006, z: -0.016, rx: -0.034, ry: -0.004, rz: 0.012 }
    },
    left: {
      ...BASE_GRIP_PROFILE.left,
      ads: { x: 0.005, y: -0.006, z: -0.018, rx: 0.05, ry: -0.012, rz: -0.02 },
      fire: { x: 0.001, y: -0.006, z: -0.014, rx: 0.045, ry: 0.002, rz: -0.018 }
    },
    fingers: { triggerTravel: 0.25, gripCurl: 0.18, supportCurl: 0.26, handOpen: 0.08 }
  },
  knife: {
    type: 'knife',
    id: 'hands.knife.primary',
    label: 'Knife Grip',
    twoHanded: false,
    requiredSockets: ['gripRight'],
    right: {
      ads: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
      sprint: { x: 0.004, y: 0.002, z: 0.006, rx: -0.016, ry: 0.035, rz: 0.026 },
      fire: { x: 0.012, y: -0.004, z: -0.026, rx: -0.06, ry: 0.08, rz: 0.055 },
      reload: zeroPose(),
      part: zeroPose()
    },
    left: {
      ads: zeroPose(),
      sprint: { x: -0.012, y: 0.006, z: 0.012, rx: 0.03, ry: -0.02, rz: 0.02 },
      fire: { x: -0.03, y: 0.004, z: -0.015, rx: -0.05, ry: -0.06, rz: -0.04 },
      reload: zeroPose(),
      part: zeroPose()
    },
    fingers: { triggerTravel: 0, gripCurl: 0.18, supportCurl: 0.05, handOpen: 0.44 }
  },
  grenade: {
    type: 'grenade',
    id: 'hands.grenade.throw',
    label: 'Grenade Throw',
    twoHanded: false,
    requiredSockets: ['gripRight'],
    right: {
      ads: zeroPose(),
      sprint: { x: 0.003, y: 0, z: 0.006, rx: -0.012, ry: 0.025, rz: 0.018 },
      fire: { x: 0.01, y: -0.003, z: -0.022, rx: -0.07, ry: 0.065, rz: 0.05 },
      reload: zeroPose(),
      part: zeroPose()
    },
    left: {
      ads: zeroPose(),
      sprint: { x: -0.01, y: 0.004, z: 0.012, rx: 0.025, ry: -0.015, rz: 0.018 },
      fire: { x: -0.026, y: 0.003, z: -0.012, rx: -0.045, ry: -0.048, rz: -0.035 },
      reload: zeroPose(),
      part: zeroPose()
    },
    fingers: { triggerTravel: 0, gripCurl: 0.12, supportCurl: 0.04, handOpen: 0.62 }
  }
});

export function getHandGripProfile(indexOrType) {
  const type = weaponTypeFromIndex(indexOrType);
  return HAND_GRIP_PROFILES[type] || HAND_GRIP_PROFILES.rifle;
}

export function createHandGripState(options = {}) {
  const profile = getHandGripProfile(options.weaponType || options.weaponIdx || 0);
  return {
    version: 1,
    enabled: options.enabled !== false,
    weaponIdx: Number(options.weaponIdx ?? -1) | 0,
    weaponType: profile.type,
    profileId: profile.id,
    tuningId: `hand-feel.${profile.type}`,
    ads: 0,
    sprint: 0,
    reload: 0,
    fire: 0,
    part: 0,
    supportContact: 0,
    gripTightness: 0,
    offsets: { right: zeroPose(), left: zeroPose() },
    fingers: { triggerCurl: 0, triggerSnap: 0, gripCurl: 0, supportCurl: 0, handOpen: 0 },
    sockets: { mode: 'procedural', required: profile.requiredSockets.slice(), available: [], missing: [] },
    ik: { enabled: false, active: false, reason: 'disabled' },
    fallbackReasons: [],
    lastInputAt: 0
  };
}

export function updateHandGripState(state, input = {}) {
  const c = state || createHandGripState(input);
  const dt = Math.max(0, Number(input.dt) || 0);
  if (input.enabled === false) {
    c.enabled = false;
    c.offsets.right = zeroPose();
    c.offsets.left = zeroPose();
    c.fingers = { triggerCurl: 0, triggerSnap: 0, gripCurl: 0, supportCurl: 0, handOpen: 0 };
    c.fallbackReasons = [];
    c.ik = { enabled: false, active: false, reason: 'feature-flag-disabled' };
    return c;
  }

  const weaponIdx = Number(input.weaponIdx) | 0;
  const weaponType = input.weaponType || weaponTypeFromIndex(weaponIdx);
  const weaponProfile = getWeaponAnimationProfile(weaponType);
  const weaponFeelProfile = getWeaponFeelProfile(weaponIdx);
  const handIntent = weaponFeelProfile.hand || {};
  const profile = getHandGripProfile(weaponType);
  const tuning = getHandFeelTuning(weaponType);
  const parts = input.partMotion || {};
  const ads = clamp01(input.ads);
  const sprint = clamp01(input.sprint);
  const reloadProgress = clamp01(input.reloadProgress);
  const reloading = !!input.reloading;
  const trigger = clamp01(parts.trigger);
  const slide = clamp01(parts.slide);
  const bolt = clamp01(parts.bolt);
  const pump = clamp01(parts.pump);
  const magazine = clamp01(parts.magazine);
  const chamber = clamp01(parts.chamber);
  const supportBrace = clamp01(parts.supportBrace);
  const shotImpulse = clamp01(input.shotImpulse);
  const fireTarget = clamp01(Math.max(trigger, slide * 0.6, bolt * 0.52, pump * 0.65, shotImpulse));
  const partTarget = clamp01(Math.max(pump, bolt, chamber, magazine * 0.35));
  const reloadTarget = reloading ? Math.max(magazine, Math.sin(reloadProgress * Math.PI) * 0.75) : 0;
  const supportTarget = clamp01(Math.max(supportBrace, ads * (1 - sprint * 0.75)) * (handIntent.supportBrace || 1));
  const gripTarget = clamp01((ads * 0.55 + fireTarget * 0.5 + supportTarget * 0.4 - sprint * 0.18) * (handIntent.contactTension || 1));
  const sprintCarry = sprint * (1 - ads * 0.65);
  const mass = Number(weaponProfile.mass) || 1;
  const recoilMass = Math.max(0.72, Math.min(1.55, mass));

  if (c.weaponIdx !== weaponIdx || c.weaponType !== weaponType) {
    c.fire = 0;
    c.part = 0;
    c.reload = 0;
    c.supportContact = 0;
    c.gripTightness = 0;
  }

  c.enabled = true;
  c.weaponIdx = weaponIdx;
  c.weaponType = weaponType;
  c.profileId = profile.id;
  c.weaponFeelProfileId = weaponFeelProfile.id;
  c.handIntent = {
    profile: handIntent.profile || weaponType,
    contactTension: handIntent.contactTension || 1,
    supportBrace: handIntent.supportBrace || 1,
    triggerDiscipline: handIntent.triggerDiscipline || 1
  };
  c.tuningId = tuning.id;
  c.ads = damp(c.ads || 0, ads, 18, dt);
  c.sprint = damp(c.sprint || 0, sprintCarry, 12, dt);
  c.reload = damp(c.reload || 0, reloadTarget, reloading ? 14 : 20, dt);
  c.fire = Math.max(damp(c.fire || 0, 0, 22 / recoilMass, dt), fireTarget);
  c.part = damp(c.part || 0, partTarget, 18, dt);
  c.supportContact = damp(c.supportContact || 0, supportTarget, 16, dt);
  c.gripTightness = damp(c.gripTightness || 0, gripTarget, 14, dt);

  const adsBrace = c.ads * (1 - c.sprint * 0.82);
  const right = zeroPose();
  const left = zeroPose();
  addScaledPose(right, profile.right.ads, adsBrace * (tuning.adsTension || 1));
  addScaledPose(right, profile.right.sprint, c.sprint * (tuning.sprintLoosen || 1));
  addScaledPose(right, profile.right.fire, c.fire * recoilMass * (tuning.wristRecoil || 1));
  addScaledPose(right, profile.right.reload, c.reload * (tuning.reloadReach || 1));
  addScaledPose(right, profile.right.part, c.part * (tuning.mechanicalPart || 1));
  addScaledPose(left, profile.left.ads, adsBrace * (tuning.adsTension || 1));
  addScaledPose(left, profile.left.sprint, c.sprint * (tuning.sprintLoosen || 1));
  addScaledPose(left, profile.left.fire, c.fire * recoilMass * (tuning.wristRecoil || 1));
  addScaledPose(left, profile.left.reload, c.reload * (tuning.reloadReach || 1));
  addScaledPose(left, profile.left.part, c.part * (tuning.mechanicalPart || 1));

  const contact = c.supportContact * (tuning.supportBrace || 1);
  if (profile.twoHanded) {
    left.y -= contact * 0.0025;
    left.z -= contact * 0.0055;
    left.rx += contact * 0.018;
    left.rz -= contact * 0.012;
  } else {
    left.x -= c.fire * 0.012;
    left.y += c.sprint * 0.003;
  }

  c.offsets.right = right;
  c.offsets.left = left;
  c.fingers = {
    triggerCurl: round(clamp01(trigger * (profile.fingers.triggerTravel || 0) * (tuning.triggerCurl || 1) * (handIntent.triggerDiscipline || 1)) * 1.6, 4),
    triggerSnap: round(clamp01(c.fire * 0.55 + trigger * 0.3), 4),
    gripCurl: round(clamp01(((profile.fingers.gripCurl || 0) + c.gripTightness * 0.22) * (tuning.gripCurl || 1)), 4),
    supportCurl: round(clamp01(((profile.fingers.supportCurl || 0) + contact * 0.22 + c.fire * 0.08) * (tuning.supportCurl || 1)), 4),
    handOpen: round(clamp01((c.sprint * (profile.fingers.handOpen || 0) + c.reload * 0.16 + (profile.twoHanded ? 0 : c.fire * 0.34)) * (tuning.handOpen || 1)), 4)
  };

  const available = availableSocketSet(input);
  const required = Array.isArray(profile.requiredSockets) ? profile.requiredSockets.slice() : [];
  const missing = required.filter((name) => !available.has(name));
  const hasAuthoredParts = !!input.hasAuthoredWeaponParts;
  const limitedIK = !!input.limitedIKEnabled;
  c.sockets = {
    mode: hasAuthoredParts ? 'authored' : 'procedural',
    required,
    available: Array.from(available).sort(),
    missing: hasAuthoredParts ? missing : []
  };
  c.ik = {
    enabled: limitedIK,
    active: limitedIK && hasAuthoredParts && missing.length === 0,
    reason: !limitedIK ? 'feature-flag-disabled'
      : !hasAuthoredParts ? 'procedural-weapon-parts'
        : missing.length ? 'missing-sockets'
          : 'socket-correction-ready'
  };
  c.fallbackReasons = [];
  if (!hasAuthoredParts) c.fallbackReasons.push('procedural-hand-fit');
  if (limitedIK && hasAuthoredParts && missing.length) c.fallbackReasons.push(`ik-disabled-missing-sockets:${missing.join(',')}`);
  c.lastInputAt = Number(input.now) || 0;
  return c;
}

export function handGripDebug(state) {
  const c = state || createHandGripState();
  return {
    version: c.version || 1,
    enabled: c.enabled !== false,
    weaponIdx: c.weaponIdx,
    weaponType: c.weaponType,
    profileId: c.profileId,
    weaponFeelProfileId: c.weaponFeelProfileId || null,
    tuningId: c.tuningId || `hand-feel.${c.weaponType || 'rifle'}`,
    handIntent: c.handIntent ? { ...c.handIntent } : null,
    ads: round(c.ads || 0, 4),
    sprint: round(c.sprint || 0, 4),
    reload: round(c.reload || 0, 4),
    fire: round(c.fire || 0, 4),
    part: round(c.part || 0, 4),
    supportContact: round(c.supportContact || 0, 4),
    gripTightness: round(c.gripTightness || 0, 4),
    offsets: {
      right: roundedPose(c.offsets?.right),
      left: roundedPose(c.offsets?.left)
    },
    fingers: {
      triggerCurl: round(c.fingers?.triggerCurl || 0, 4),
      triggerSnap: round(c.fingers?.triggerSnap || 0, 4),
      gripCurl: round(c.fingers?.gripCurl || 0, 4),
      supportCurl: round(c.fingers?.supportCurl || 0, 4),
      handOpen: round(c.fingers?.handOpen || 0, 4)
    },
    sockets: {
      mode: c.sockets?.mode || 'procedural',
      required: Array.isArray(c.sockets?.required) ? c.sockets.required.slice() : [],
      available: Array.isArray(c.sockets?.available) ? c.sockets.available.slice() : [],
      missing: Array.isArray(c.sockets?.missing) ? c.sockets.missing.slice() : []
    },
    ik: { ...(c.ik || { enabled: false, active: false, reason: 'unknown' }) },
    fallbackReasons: Array.isArray(c.fallbackReasons) ? c.fallbackReasons.slice() : []
  };
}
