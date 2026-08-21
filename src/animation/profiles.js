export const ANIMATION_PIPELINE_VERSION = 2;

export const ANIMATION_FEATURE_FLAG_DEFAULTS = Object.freeze({
  animationGraphEnabled: true,
  weaponGraphEnabled: true,
  enemyGraphEnabled: true,
  importedAnimationEnabled: false,
  limitedIKEnabled: false,
  bvhQueriesEnabled: false,
  animationDebugOverlayEnabled: false,
  editorAnimationPreviewEnabled: true,
  editorAssetPreflightEnabled: true
});

export const ANIMATION_CHANNELS = Object.freeze([
  'camera',
  'body',
  'proxy',
  'hands',
  'weapon',
  'enemy',
  'additive',
  'vfx',
  'audio',
  'editorPreview'
]);

export const PLAYER_LOCOMOTION_STATES = Object.freeze([
  'idle',
  'walk',
  'jog',
  'sprint',
  'sprintStart',
  'sprintStop',
  'strafe',
  'backpedal',
  'crouchIdle',
  'crouchWalk',
  'slide',
  'jumpStart',
  'fallLoop',
  'landLight',
  'landHeavy',
  'wallJump',
  'vault',
  'dropkick'
]);

export const SEMANTIC_MIXAMO_CLIPS = Object.freeze([
  'idle',
  'walk',
  'run',
  'strafeLeft',
  'strafeRight',
  'crouchIdle',
  'crouchWalk',
  'jumpStart',
  'fallLoop',
  'landLight',
  'landHeavy',
  'vault',
  'reload',
  'fireAdditive',
  'hitHead',
  'hitBody',
  'hitLeg',
  'deathForward',
  'deathBack',
  'deathSide'
]);

export const TOOLING_CAPABILITIES = Object.freeze({
  runtime: [
    'three.AnimationMixer',
    'three.AnimationAction',
    'three.GLTFLoader',
    'three.KTX2Loader',
    'three.DRACOLoader',
    'three.MeshoptDecoder',
    'three.SkeletonUtils',
    'three.CCDIKSolver',
    'maath.easing',
    'three-mesh-bvh'
  ],
  offline: [
    '@gltf-transform/core',
    '@gltf-transform/functions',
    '@gltf-transform/cli',
    'gltf-validator'
  ],
  policies: [
    'offline-first retargeting',
    'runtime procedural fallback',
    'feature-flagged IK/BVH',
    'editor-safe stable profile IDs'
  ]
});

export const WEAPON_INDEX_TYPE = Object.freeze({
  0: 'rifle',
  1: 'pistol',
  2: 'knife',
  3: 'shotgun',
  4: 'smg',
  5: 'marksman',
  6: 'pistol',
  7: 'sniper'
});

export const FIREARM_WEAPON_INDICES = Object.freeze([0, 1, 3, 4, 5, 6, 7]);

const ZERO_POSE = Object.freeze({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });

function pose(values = {}) {
  return Object.freeze({
    x: Number(values.x) || 0,
    y: Number(values.y) || 0,
    z: Number(values.z) || 0,
    rx: Number(values.rx) || 0,
    ry: Number(values.ry) || 0,
    rz: Number(values.rz) || 0
  });
}

function sightPoint(local, extra = {}) {
  return Object.freeze({ local: Object.freeze(local.slice(0, 3)), ...extra });
}

function feelProfile(index, type, label, values = {}) {
  return Object.freeze({
    weaponIdx: index,
    type,
    id: values.id || `weapon-feel-profile.${index}`,
    manifestId: values.manifestId || null,
    label,
    ads: Object.freeze({
      inLambda: values.ads?.inLambda ?? 32,
      outLambda: values.ads?.outLambda ?? 22,
      visualLambda: values.ads?.visualLambda ?? 13,
      settleInLambda: values.ads?.settleInLambda ?? 12,
      settleOutLambda: values.ads?.settleOutLambda ?? 16,
      fovDelta: values.ads?.fovDelta ?? 32,
      shoulderKick: values.ads?.shoulderKick ?? 1,
      speedMul: values.ads?.speedMul ?? 1,
      viewFit: values.ads?.viewFit ? Object.freeze({ ...values.ads.viewFit }) : null
    }),
    sight: values.sight ? Object.freeze({
      mode: values.sight.mode || 'iron',
      front: values.sight.front || null,
      rear: values.sight.rear || null,
      aimNdcX: values.sight.aimNdcX ?? 0,
      aimNdcY: values.sight.aimNdcY ?? 0,
      maxX: values.sight.maxX ?? 0.18,
      maxY: values.sight.maxY ?? 0.28,
      maxPitch: values.sight.maxPitch ?? 0.08,
      maxYaw: values.sight.maxYaw ?? 0.06,
      lineWeight: values.sight.lineWeight ?? 1,
      lineTargetY: values.sight.lineTargetY ?? 0,
      maxResidualNdc: values.sight.maxResidualNdc ?? (values.sight.mode === 'bead' ? 0.026 : 0.015)
    }) : null,
    recoil: Object.freeze({
      viewmodelKick: values.recoil?.viewmodelKick ?? 1,
      cameraKick: values.recoil?.cameraKick ?? 1,
      snap: values.recoil?.snap ?? 1,
      recover: values.recoil?.recover ?? 1,
      shoulderAbsorb: values.recoil?.shoulderAbsorb ?? 1,
      tail: values.recoil?.tail ?? 1
    }),
    pose: Object.freeze({
      base: pose(values.pose?.base || ZERO_POSE),
      adsAdditive: pose(values.pose?.adsAdditive || ZERO_POSE),
      fire: pose(values.pose?.fire || ZERO_POSE),
      reload: pose(values.pose?.reload || ZERO_POSE),
      sprint: pose(values.pose?.sprint || ZERO_POSE),
      inspect: pose(values.pose?.inspect || ZERO_POSE)
    }),
    hand: Object.freeze({
      profile: values.hand?.profile || type,
      contactTension: values.hand?.contactTension ?? 1,
      supportBrace: values.hand?.supportBrace ?? 1,
      triggerDiscipline: values.hand?.triggerDiscipline ?? 1
    }),
    notifies: Object.freeze({
      muzzleFlash: values.notifies?.muzzleFlash ?? 0.02,
      shellEject: values.notifies?.shellEject ?? 0.055,
      mechanical: values.notifies?.mechanical ?? 0.12,
      reloadMagOut: values.notifies?.reloadMagOut ?? 0.22,
      reloadMagIn: values.notifies?.reloadMagIn ?? 0.68
    })
  });
}

export const WEAPON_FEEL_PROFILES = Object.freeze({
  0: feelProfile(0, 'rifle', 'M4A1 Reference', {
    id: 'weapon-feel-profile.m4-reference',
    manifestId: 'weapon.m4Reference',
    ads: { inLambda: 34, outLambda: 23, fovDelta: 31, viewFit: { y: -0.016, z: 0.060, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'iron',
      front: sightPoint([0, 0.071, -0.296], { socket: 'frontSight' }),
      rear: sightPoint([0, 0.067, 0.040], { socket: 'rearSight' }),
      maxX: 0.16,
      maxY: 0.24,
      maxPitch: 0.075,
      maxYaw: 0.055,
      lineTargetY: 0.026
    },
    recoil: { viewmodelKick: 1.06, cameraKick: 1.0, snap: 1.05, recover: 1.08, shoulderAbsorb: 1.05 },
    pose: {
      fire: { x: 0.002, y: -0.006, z: -0.014, rx: 0.028, ry: 0.004, rz: 0.006 },
      reload: { x: -0.012, y: -0.024, z: 0.038, rx: 0.13, ry: -0.05, rz: -0.08 },
      sprint: { x: 0.014, y: -0.024, z: 0.024, rx: 0.1, ry: 0.02, rz: -0.04 }
    },
    hand: { contactTension: 1.08, supportBrace: 1.12, triggerDiscipline: 1.04 }
  }),
  1: feelProfile(1, 'pistol', 'USP-T Suppressed', {
    id: 'weapon-feel-profile.usp-t',
    manifestId: 'weapon.uspT',
    // viewFit.scale 0.52 is iron-sight ADS only; attachable RDS uses optic profile viewFit in main.js
    // ADS raise: crisp punch-in (inLambda) with a slightly slower, settled release so the
    // sight/dot doesn't snap back jarringly. Tactical sidearm — fast to aim, calm to lower.
    ads: { inLambda: 18, outLambda: 15, fovDelta: 24, viewFit: { y: -0.030, z: -0.150, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'iron',
      front: sightPoint([0, 0.069, -0.074], { node: 'front_sight', nodeLocal: [0, 0.003, 0], socket: 'frontSight' }),
      rear: sightPoint([0, 0.067, 0.058], { node: 'rear_sight', nodeLocal: [0, 0.003, 0], socket: 'rearSight' }),
      aimNdcY: -0.032,
      maxX: 0.18,
      maxY: 0.28,
      maxPitch: 0.085,
      maxYaw: 0.060,
      lineTargetY: -0.006
    },
    // USP-T single-shot feel: a contained muzzle flip then a snappy recover so the sight
    // is back on target quickly (semi-auto sidearm cadence). Viewmodel kick kept modest so
    // the gun doesn't heave on every shot; cameraKick carries the actual aim recoil.
    recoil: { viewmodelKick: 0.96, cameraKick: 0.98, snap: 1.16, recover: 1.34, shoulderAbsorb: 0.94, tail: 1.0 },
    pose: {
      fire: { x: 0.003, y: -0.007, z: -0.011, rx: 0.030, ry: 0.002, rz: 0.015 },
      reload: { x: -0.020, y: -0.018, z: 0.028, rx: 0.18, ry: -0.08, rz: -0.14 },
      sprint: { x: 0.007, y: -0.011, z: 0.011, rx: 0.050, ry: 0.010, rz: -0.016 }
    },
    hand: { contactTension: 1.16, supportBrace: 1.08, triggerDiscipline: 1.18 }
  }),
  2: feelProfile(2, 'knife', 'Throwing Knife', {
    id: 'weapon-feel-profile.throwing-knife',
    manifestId: 'weapon.knife',
    ads: { inLambda: 42, outLambda: 30, fovDelta: 0, viewFit: null },
    recoil: { viewmodelKick: 0.72, cameraKick: 0.64, snap: 1.35, recover: 1.34 },
    pose: {
      fire: { x: 0.018, y: -0.018, z: -0.035, rx: -0.08, ry: 0.18, rz: 0.12 },
      sprint: { x: 0.020, y: -0.006, z: 0.018, rx: -0.04, ry: 0.10, rz: 0.08 }
    },
    hand: { contactTension: 0.84, supportBrace: 0.58, triggerDiscipline: 0 }
  }),
  3: feelProfile(3, 'shotgun', 'TAC-12 Shotgun', {
    id: 'weapon-feel-profile.tac12',
    manifestId: 'weapon.tac12',
    ads: { inLambda: 15, outLambda: 13, fovDelta: 20, viewFit: { y: -0.018, z: 0.080, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'bead',
      front: sightPoint([0, 0.071, -0.498], { socket: 'frontSight' }),
      rear: sightPoint([0, 0.061, 0.070], { socket: 'rearSight' }),
      maxX: 0.18,
      maxY: 0.30,
      maxPitch: 0.090,
      maxYaw: 0.060,
      lineTargetY: 0.045,
      maxResidualNdc: 0.026
    },
    recoil: { viewmodelKick: 1.32, cameraKick: 1.18, snap: 0.86, recover: 0.78, shoulderAbsorb: 1.30, tail: 1.18 },
    pose: {
      fire: { x: -0.002, y: -0.017, z: -0.036, rx: 0.074, ry: -0.006, rz: 0.024 },
      reload: { x: -0.024, y: -0.034, z: 0.052, rx: 0.20, ry: -0.08, rz: -0.10 },
      sprint: { x: 0.015, y: -0.028, z: 0.030, rx: 0.12, ry: 0.02, rz: -0.05 }
    },
    hand: { contactTension: 1.20, supportBrace: 1.26, triggerDiscipline: 1.0 },
    notifies: { shellEject: 0.18, mechanical: 0.30, reloadMagOut: 0.25, reloadMagIn: 0.72 }
  }),
  4: feelProfile(4, 'smg', 'MP9 Suppressed', {
    id: 'weapon-feel-profile.mp9-suppressed',
    manifestId: 'weapon.mp9Suppressed',
    ads: { inLambda: 17, outLambda: 15, fovDelta: 23, viewFit: { y: -0.018, z: 0.040, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'iron',
      front: sightPoint([0, 0.046, -0.043], { socket: 'frontSight' }),
      rear: sightPoint([0, 0.046, 0.034], { socket: 'rearSight' }),
      maxX: 0.18,
      maxY: 0.30,
      maxPitch: 0.070,
      maxYaw: 0.055,
      lineWeight: 0.70,
      lineTargetY: 0.035
    },
    recoil: { viewmodelKick: 0.92, cameraKick: 0.82, snap: 1.18, recover: 1.35, shoulderAbsorb: 0.88, tail: 0.78 },
    pose: {
      fire: { x: 0.004, y: -0.004, z: -0.010, rx: 0.022, ry: 0.006, rz: 0.010 },
      reload: { x: -0.016, y: -0.022, z: 0.034, rx: 0.12, ry: -0.04, rz: -0.07 },
      sprint: { x: 0.012, y: -0.020, z: 0.022, rx: 0.085, ry: 0.018, rz: -0.032 }
    },
    hand: { contactTension: 1.10, supportBrace: 1.18, triggerDiscipline: 1.14 }
  }),
  5: feelProfile(5, 'marksman', 'MK14 DMR', {
    id: 'weapon-feel-profile.mk14',
    manifestId: 'weapon.mk14',
    ads: { inLambda: 21, outLambda: 16, settleInLambda: 10, fovDelta: 38, viewFit: { y: -0.020, z: 0.120, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'optic',
      front: sightPoint([0, 0.080, 0.034], { socket: 'scopeCamera' }),
      rear: sightPoint([0, 0.080, 0.024], { socket: 'optic' }),
      maxX: 0.12,
      maxY: 0.18,
      maxPitch: 0.050,
      maxYaw: 0.040,
      lineTargetY: 0
    },
    recoil: { viewmodelKick: 1.22, cameraKick: 1.08, snap: 0.92, recover: 0.92, shoulderAbsorb: 1.16, tail: 1.05 },
    pose: {
      fire: { x: 0.001, y: -0.012, z: -0.026, rx: 0.052, ry: 0.002, rz: 0.012 },
      reload: { x: -0.018, y: -0.027, z: 0.048, rx: 0.17, ry: -0.060, rz: -0.080 },
      sprint: { x: 0.014, y: -0.026, z: 0.028, rx: 0.105, ry: 0.018, rz: -0.040 }
    },
    hand: { contactTension: 1.15, supportBrace: 1.22, triggerDiscipline: 1.02 }
  }),
  6: feelProfile(6, 'pistol', 'P226 Suppressed', {
    id: 'weapon-feel-profile.p226-suppressed',
    manifestId: 'weapon.p226Supp',
    ads: { inLambda: 18, outLambda: 15, fovDelta: 24, viewFit: { y: -0.032, z: -0.150, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'iron',
      front: sightPoint([0, 0.054, -0.080], { socket: 'frontSight' }),
      rear: sightPoint([0, 0.050, 0.060], { socket: 'rearSight' }),
      aimNdcY: -0.030,
      maxX: 0.18,
      maxY: 0.28,
      maxPitch: 0.085,
      maxYaw: 0.060,
      lineTargetY: 0.004
    },
    recoil: { viewmodelKick: 1.02, cameraKick: 0.88, snap: 1.35, recover: 1.28, shoulderAbsorb: 0.82 },
    pose: {
      fire: { x: 0.003, y: -0.007, z: -0.011, rx: 0.032, ry: 0.002, rz: 0.016 },
      reload: { x: -0.018, y: -0.016, z: 0.026, rx: 0.165, ry: -0.075, rz: -0.13 },
      sprint: { x: 0.006, y: -0.010, z: 0.010, rx: 0.046, ry: 0.008, rz: -0.014 }
    },
    hand: { contactTension: 1.13, supportBrace: 1.05, triggerDiscipline: 1.22 }
  }),
  7: feelProfile(7, 'sniper', 'AWM Sniper', {
    id: 'weapon-feel-profile.awm',
    manifestId: 'weapon.awm',
    ads: { inLambda: 16, outLambda: 13, settleInLambda: 8.5, settleOutLambda: 13, fovDelta: 48, viewFit: { y: -0.022, z: 0.140, rx: 0, scale: 1.0 } },
    sight: {
      mode: 'optic',
      front: sightPoint([0, 0.092, 0.034], { socket: 'scopeCamera' }),
      rear: sightPoint([0, 0.092, 0.024], { socket: 'optic' }),
      maxX: 0.10,
      maxY: 0.16,
      maxPitch: 0.044,
      maxYaw: 0.035,
      lineTargetY: 0
    },
    recoil: { viewmodelKick: 1.36, cameraKick: 1.16, snap: 0.72, recover: 0.70, shoulderAbsorb: 1.32, tail: 1.28 },
    pose: {
      fire: { x: 0, y: -0.019, z: -0.048, rx: 0.090, ry: 0, rz: 0.020 },
      reload: { x: -0.020, y: -0.030, z: 0.060, rx: 0.23, ry: -0.06, rz: -0.08 },
      sprint: { x: 0.016, y: -0.032, z: 0.036, rx: 0.135, ry: 0.018, rz: -0.048 }
    },
    hand: { contactTension: 1.20, supportBrace: 1.28, triggerDiscipline: 0.96 },
    notifies: { shellEject: 0.34, mechanical: 0.42, reloadMagOut: 0.28, reloadMagIn: 0.82 }
  })
});

const BASE_WEAPON_PROFILE = Object.freeze({
  type: 'rifle',
  label: 'Rifle',
  mass: 1,
  snap: 1,
  recovery: 1,
  sprintDrop: 1,
  adsProtection: 1,
  triggerTravel: 0.012,
  firePose: { x: 0.002, y: -0.006, z: -0.014, rx: 0.028, ry: 0.004, rz: 0.006 },
  reloadPose: { x: -0.012, y: -0.024, z: 0.038, rx: 0.13, ry: -0.05, rz: -0.08 },
  sprintPose: { x: 0.014, y: -0.024, z: 0.024, rx: 0.1, ry: 0.02, rz: -0.04 },
  movingParts: ['trigger', 'bolt', 'magazine'],
  requiredSockets: ['muzzle', 'gripRight', 'gripLeft', 'magazine', 'ejectionPort'],
  reloadMarkers: ['magOut', 'magDrop', 'magIn', 'boltForward', 'settle']
});

export const WEAPON_ANIMATION_PROFILES = Object.freeze({
  pistol: {
    ...BASE_WEAPON_PROFILE,
    type: 'pistol',
    label: 'Pistol',
    mass: 0.62,
    snap: 1.35,
    recovery: 1.28,
    sprintDrop: 0.52,
    triggerTravel: 0.016,
    firePose: { x: 0.004, y: -0.008, z: -0.012, rx: 0.036, ry: 0.002, rz: 0.018 },
    reloadPose: { x: -0.02, y: -0.018, z: 0.028, rx: 0.18, ry: -0.08, rz: -0.14 },
    sprintPose: { x: 0.008, y: -0.012, z: 0.012, rx: 0.055, ry: 0.01, rz: -0.018 },
    movingParts: ['trigger', 'slide', 'magazine'],
    requiredSockets: ['muzzle', 'gripRight', 'magazine', 'ejectionPort'],
    reloadMarkers: ['magOut', 'magDrop', 'magIn', 'slideRelease', 'settle']
  },
  rifle: BASE_WEAPON_PROFILE,
  smg: {
    ...BASE_WEAPON_PROFILE,
    type: 'smg',
    label: 'SMG',
    mass: 0.78,
    snap: 1.24,
    recovery: 1.35,
    firePose: { x: 0.004, y: -0.004, z: -0.01, rx: 0.022, ry: 0.006, rz: 0.01 },
    reloadPose: { x: -0.016, y: -0.022, z: 0.034, rx: 0.12, ry: -0.04, rz: -0.07 },
    movingParts: ['trigger', 'bolt', 'magazine']
  },
  shotgun: {
    ...BASE_WEAPON_PROFILE,
    type: 'shotgun',
    label: 'Shotgun',
    mass: 1.26,
    snap: 0.88,
    recovery: 0.76,
    firePose: { x: -0.002, y: -0.016, z: -0.032, rx: 0.068, ry: -0.006, rz: 0.022 },
    reloadPose: { x: -0.024, y: -0.034, z: 0.052, rx: 0.2, ry: -0.08, rz: -0.1 },
    movingParts: ['trigger', 'pump', 'shell', 'ejectionPort'],
    reloadMarkers: ['shellOut', 'shellIn', 'pumpBack', 'pumpForward', 'settle']
  },
  marksman: {
    ...BASE_WEAPON_PROFILE,
    type: 'marksman',
    label: 'Marksman',
    mass: 1.08,
    snap: 0.92,
    recovery: 0.9,
    adsProtection: 1.25,
    firePose: { x: 0.001, y: -0.012, z: -0.025, rx: 0.05, ry: 0.002, rz: 0.012 },
    movingParts: ['trigger', 'bolt', 'magazine', 'optic']
  },
  sniper: {
    ...BASE_WEAPON_PROFILE,
    type: 'sniper',
    label: 'Sniper',
    mass: 1.38,
    snap: 0.72,
    recovery: 0.62,
    adsProtection: 1.45,
    firePose: { x: 0, y: -0.018, z: -0.044, rx: 0.084, ry: 0, rz: 0.018 },
    reloadPose: { x: -0.02, y: -0.03, z: 0.06, rx: 0.23, ry: -0.06, rz: -0.08 },
    movingParts: ['trigger', 'bolt', 'magazine', 'optic'],
    reloadMarkers: ['boltBack', 'magOut', 'magIn', 'boltForward', 'settle']
  },
  heavy: {
    ...BASE_WEAPON_PROFILE,
    type: 'heavy',
    label: 'Heavy',
    mass: 1.6,
    snap: 0.68,
    recovery: 0.58,
    firePose: { x: -0.004, y: -0.02, z: -0.048, rx: 0.092, ry: -0.004, rz: 0.024 },
    reloadPose: { x: -0.028, y: -0.04, z: 0.07, rx: 0.25, ry: -0.08, rz: -0.12 },
    movingParts: ['trigger', 'belt', 'chargingHandle', 'cover']
  },
  knife: {
    ...BASE_WEAPON_PROFILE,
    type: 'knife',
    label: 'Knife',
    mass: 0.36,
    snap: 1.5,
    recovery: 1.4,
    firePose: { x: 0.018, y: -0.018, z: -0.035, rx: -0.08, ry: 0.18, rz: 0.12 },
    reloadPose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    sprintPose: { x: 0.02, y: -0.006, z: 0.018, rx: -0.04, ry: 0.1, rz: 0.08 },
    movingParts: ['blade', 'hand'],
    requiredSockets: ['gripRight'],
    reloadMarkers: ['throwRelease']
  },
  grenade: {
    ...BASE_WEAPON_PROFILE,
    type: 'grenade',
    label: 'Grenade',
    mass: 0.45,
    snap: 1.1,
    recovery: 1.1,
    firePose: { x: 0.014, y: -0.012, z: -0.03, rx: -0.12, ry: 0.1, rz: 0.1 },
    reloadPose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    movingParts: ['pin', 'spoon', 'hand'],
    requiredSockets: ['gripRight'],
    reloadMarkers: ['grenadePin', 'throwRelease']
  }
});

export const ENEMY_ANIMATION_PROFILES = Object.freeze({
  scout: { label: 'Scout', weight: 0.75, turnSharpness: 1.35, stepEnergy: 1.3, recoilAbsorb: 0.78, intentLead: 1.18 },
  soldier: { label: 'Soldier', weight: 1, turnSharpness: 1, stepEnergy: 1, recoilAbsorb: 1, intentLead: 1 },
  pistolero: { label: 'Pistolero', weight: 0.86, turnSharpness: 1.2, stepEnergy: 1.12, recoilAbsorb: 0.86, intentLead: 1.1 },
  lieutenant: { label: 'Lieutenant', weight: 1.14, turnSharpness: 0.92, stepEnergy: 1.02, recoilAbsorb: 1.18, intentLead: 1.16 },
  heavy: { label: 'Heavy', weight: 1.42, turnSharpness: 0.68, stepEnergy: 0.82, recoilAbsorb: 1.4, intentLead: 0.85 },
  boss: { label: 'Boss', weight: 1.56, turnSharpness: 0.62, stepEnergy: 0.78, recoilAbsorb: 1.55, intentLead: 0.9 },
  riot: { label: 'Riot', weight: 1.3, turnSharpness: 0.72, stepEnergy: 0.84, recoilAbsorb: 1.28, intentLead: 0.9 },
  shielded: { label: 'Shielded', weight: 1.3, turnSharpness: 0.72, stepEnergy: 0.84, recoilAbsorb: 1.28, intentLead: 0.9 },
  marksman: { label: 'Marksman', weight: 0.98, turnSharpness: 0.92, stepEnergy: 0.9, recoilAbsorb: 1.12, intentLead: 0.98 },
  sniper: { label: 'Sniper', weight: 1.02, turnSharpness: 0.82, stepEnergy: 0.82, recoilAbsorb: 1.18, intentLead: 0.92 },
  demolitions: { label: 'Demolitions', weight: 1.16, turnSharpness: 0.86, stepEnergy: 0.95, recoilAbsorb: 1.2, intentLead: 0.9 },
  drone: { label: 'Drone', weight: 0.5, turnSharpness: 1.5, stepEnergy: 0, recoilAbsorb: 0.6, intentLead: 1.25 }
});

const BASE_WEAPON_FEEL = Object.freeze({
  id: 'weapon-feel.default',
  recoilVisual: 1.08,
  returnSpeed: 1.05,
  dryFireVisual: 1.12,
  reloadVisual: 1.08,
  sprintLow: 1.06,
  trigger: 1.10,
  slide: 1.08,
  bolt: 1.06,
  pump: 1.10,
  magazine: 1.08,
  chamber: 1.08,
  supportBrace: 1.06,
  adsSettle: 1.0,
  mechanicalSettle: 1.04
});

const BASE_HAND_FEEL = Object.freeze({
  id: 'hand-feel.default',
  adsTension: 1.08,
  sprintLoosen: 1.08,
  wristRecoil: 1.10,
  reloadReach: 1.12,
  mechanicalPart: 1.10,
  supportBrace: 1.12,
  triggerCurl: 1.12,
  gripCurl: 1.10,
  supportCurl: 1.12,
  handOpen: 1.08
});

const BASE_ENEMY_FEEL = Object.freeze({
  id: 'enemy-feel.default',
  intentLead: 1.08,
  peekLead: 1.14,
  weaponRaise: 1.10,
  compression: 1.08,
  shoulderCommit: 1.10,
  stepEnergy: 1.06,
  reloadReach: 1.12,
  hitReact: 1.10,
  deathCollapse: 1.08,
  aimTension: 1.10
});

export const ANIMATION_FEEL_TUNING = Object.freeze({
  version: 2,
  id: 'aaa-grounded-v2',
  policy: {
    safeToTune: [
      'weapon visual pose',
      'weapon moving part offsets',
      'hand pose offsets',
      'finger curl',
      'camera/viewmodel additive feel',
      'player proxy pose readability',
      'enemy pose intent cues',
      'editor preview metadata'
    ],
    gameplayAuthorityLocked: [
      'damage',
      'ammo',
      'fire rate',
      'spread',
      'hit detection',
      'gameplay recoil truth',
      'AI decisions',
      'pathing',
      'collision',
      'save data'
    ],
    guardedRuntimeFlags: ['importedAnimationEnabled', 'limitedIKEnabled', 'bvhQueriesEnabled']
  },
  weapon: {
    default: BASE_WEAPON_FEEL,
    rifle: { recoilVisual: 1.10, bolt: 1.10, magazine: 1.08, supportBrace: 1.10 },
    pistol: { recoilVisual: 1.16, returnSpeed: 1.18, dryFireVisual: 1.18, trigger: 1.18, slide: 1.18, magazine: 1.12, sprintLow: 0.96 },
    smg: { recoilVisual: 1.08, returnSpeed: 1.22, trigger: 1.20, bolt: 1.12, magazine: 1.10, mechanicalSettle: 1.12 },
    shotgun: { recoilVisual: 1.24, returnSpeed: 0.92, trigger: 1.14, pump: 1.35, chamber: 1.22, supportBrace: 1.18 },
    marksman: { recoilVisual: 1.18, returnSpeed: 0.96, bolt: 1.18, adsSettle: 1.12, supportBrace: 1.16 },
    sniper: { recoilVisual: 1.28, returnSpeed: 0.84, bolt: 1.34, chamber: 1.24, adsSettle: 1.16, supportBrace: 1.20 },
    heavy: { recoilVisual: 1.30, returnSpeed: 0.78, trigger: 1.10, bolt: 1.20, magazine: 1.18, sprintLow: 1.18, supportBrace: 1.24 },
    knife: { recoilVisual: 1.18, returnSpeed: 1.24, trigger: 0, sprintLow: 1.08, dryFireVisual: 1.0 },
    grenade: { recoilVisual: 1.10, returnSpeed: 1.10, trigger: 0, sprintLow: 1.04, dryFireVisual: 1.0 }
  },
  hand: {
    default: BASE_HAND_FEEL,
    rifle: { adsTension: 1.10, supportBrace: 1.14 },
    pistol: { adsTension: 1.16, wristRecoil: 1.18, triggerCurl: 1.18, handOpen: 1.10 },
    smg: { wristRecoil: 1.10, triggerCurl: 1.18, supportCurl: 1.16 },
    shotgun: { wristRecoil: 1.20, reloadReach: 1.14, mechanicalPart: 1.34, supportCurl: 1.24 },
    marksman: { adsTension: 1.16, wristRecoil: 1.14, supportBrace: 1.20 },
    sniper: { adsTension: 1.18, wristRecoil: 1.22, mechanicalPart: 1.28, supportBrace: 1.22 },
    heavy: { adsTension: 1.14, sprintLoosen: 1.12, wristRecoil: 1.24, supportCurl: 1.28 },
    knife: { sprintLoosen: 1.18, wristRecoil: 1.18, handOpen: 1.22 },
    grenade: { sprintLoosen: 1.16, wristRecoil: 1.12, handOpen: 1.30 }
  },
  locomotion: {
    id: 'locomotion-feel.grounded-aaa-v2',
    stride: 1.08,
    cameraWeight: 1.10,
    viewmodelWeight: 1.15,
    proxyWeight: 1.13,
    gaitWeight: 1.10,
    bodyCarryWeight: 1.16,
    impactWeight: 1.24,
    counterStrafeWeight: 1.17,
    sprintWeight: 1.16,
    slideWeight: 1.20,
    vaultWeight: 1.12,
    wallKickWeight: 1.18,
    dropkickWeight: 1.22,
    nearMissWeight: 1.14,
    adsDampen: 1.06,
    adsAlignmentTolerance: 0.015,
    beadAlignmentTolerance: 0.026,
    transitionSnapThreshold: 1.3,
    transitionRecoveryMs: 260,
    notifyDedupeBudget: 3
  },
  enemy: {
    default: BASE_ENEMY_FEEL,
    scout: { intentLead: 1.18, peekLead: 1.22, stepEnergy: 1.16, hitReact: 1.10 },
    pistolero: { intentLead: 1.14, weaponRaise: 1.16, shoulderCommit: 1.14 },
    heavy: { compression: 1.20, shoulderCommit: 1.18, hitReact: 0.94, deathCollapse: 1.18 },
    riot: { compression: 1.16, weaponRaise: 1.08, shoulderCommit: 1.18 },
    shielded: { compression: 1.16, weaponRaise: 1.08, shoulderCommit: 1.18 },
    marksman: { aimTension: 1.20, peekLead: 1.12, weaponRaise: 1.16 },
    sniper: { aimTension: 1.26, intentLead: 1.00, weaponRaise: 1.18 },
    demolitions: { compression: 1.12, reloadReach: 1.18, shoulderCommit: 1.12 },
    drone: { intentLead: 1.20, stepEnergy: 0.80, hitReact: 0.95 }
  }
});

function mergeTuning(base, override, id) {
  return Object.freeze({ ...base, ...(override || {}), id: override?.id || id || base.id });
}

export function animationFeatureFlags(settings = {}) {
  const out = {};
  for (const [key, fallback] of Object.entries(ANIMATION_FEATURE_FLAG_DEFAULTS)) {
    out[key] = settings[key] == null ? fallback : !!settings[key];
  }
  return out;
}

export function weaponTypeFromIndex(indexOrType) {
  if (typeof indexOrType === 'string' && indexOrType) {
    const s = indexOrType.toLowerCase();
    const canonical = CANONICAL_WEAPON_TYPE_BY_ID[normalizeWeaponKey(s)];
    if (canonical) return canonical;
    if (s.includes('sniper')) return 'sniper';
    if (s.includes('shotgun')) return 'shotgun';
    if (s.includes('smg')) return 'smg';
    if (s.includes('marksman') || s.includes('dmr')) return 'marksman';
    if (s.includes('heavy')) return 'heavy';
    if (s.includes('knife')) return 'knife';
    if (s.includes('grenade')) return 'grenade';
    if (s.includes('pistol') || s.includes('usp') || s.includes('p226')) return 'pistol';
    return WEAPON_ANIMATION_PROFILES[s] ? s : 'rifle';
  }
  return WEAPON_INDEX_TYPE[Number(indexOrType) | 0] || 'rifle';
}

function normalizeWeaponKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[._-]/g, '');
}

const CANONICAL_WEAPON_TYPE_BY_ID = Object.freeze({
  weaponm4reference: 'rifle',
  weaponrifle: 'rifle',
  m4reference: 'rifle',
  m4a1reference: 'rifle',
  rifle: 'rifle',
  weaponuspt: 'pistol',
  weaponpistol: 'pistol',
  uspt: 'pistol',
  weaponp226supp: 'pistol',
  p226supp: 'pistol',
  p226suppressed: 'pistol',
  pistol: 'pistol',
  weapontac12: 'shotgun',
  weaponshotgun: 'shotgun',
  tac12: 'shotgun',
  shotgun: 'shotgun',
  weaponmp9suppressed: 'smg',
  weaponsmg: 'smg',
  mp9suppressed: 'smg',
  smg: 'smg',
  weaponmk14: 'marksman',
  weaponmarksman: 'marksman',
  mk14: 'marksman',
  marksman: 'marksman',
  dmr: 'marksman',
  weaponawm: 'sniper',
  weaponsniper: 'sniper',
  awm: 'sniper',
  sniper: 'sniper',
  weaponheavy: 'heavy',
  heavy: 'heavy',
  weaponknife: 'knife',
  knife: 'knife',
  weapongrenade: 'grenade',
  grenade: 'grenade'
});

const CANONICAL_WEAPON_FEEL_KEY_BY_ID = Object.freeze({
  weaponm4reference: '0',
  weaponrifle: '0',
  m4reference: '0',
  m4a1reference: '0',
  weaponuspt: '1',
  weaponpistol: '1',
  uspt: '1',
  weaponknife: '2',
  knife: '2',
  weapontac12: '3',
  weaponshotgun: '3',
  tac12: '3',
  weaponmp9suppressed: '4',
  weaponsmg: '4',
  mp9suppressed: '4',
  weaponmk14: '5',
  weaponmarksman: '5',
  mk14: '5',
  weaponp226supp: '6',
  p226supp: '6',
  p226suppressed: '6',
  weaponawm: '7',
  weaponsniper: '7',
  awm: '7'
});

function weaponFeelProfileKey(indexOrType) {
  if (typeof indexOrType === 'number' && Number.isFinite(indexOrType)) return String(indexOrType | 0);
  if (typeof indexOrType === 'string' && indexOrType) {
    const s = indexOrType.toLowerCase();
    const canonical = CANONICAL_WEAPON_FEEL_KEY_BY_ID[normalizeWeaponKey(s)];
    if (canonical) return canonical;
    for (const [key, profile] of Object.entries(WEAPON_FEEL_PROFILES)) {
      if (!profile) continue;
      if (
        s === key ||
        s === profile.id.toLowerCase() ||
        s === profile.manifestId?.toLowerCase() ||
        s === profile.label.toLowerCase()
      ) return key;
    }
    if (s.includes('m4')) return '0';
    if (s.includes('usp')) return '1';
    if (s.includes('tac') || s.includes('shotgun')) return '3';
    if (s.includes('mp9') || s.includes('smg')) return '4';
    if (s.includes('mk14') || s.includes('marksman') || s.includes('dmr')) return '5';
    if (s.includes('p226')) return '6';
    if (s.includes('awm') || s.includes('sniper')) return '7';
    if (s.includes('knife')) return '2';
  }
  return String(Number(indexOrType) | 0);
}

export function getWeaponFeelProfile(indexOrType) {
  const key = weaponFeelProfileKey(indexOrType);
  return WEAPON_FEEL_PROFILES[key] || WEAPON_FEEL_PROFILES[0];
}

export function getWeaponAdsViewFit(indexOrType) {
  return getWeaponFeelProfile(indexOrType).ads?.viewFit || null;
}

export function getWeaponSightProfile(indexOrType) {
  return getWeaponFeelProfile(indexOrType).sight || null;
}

export function getWeaponAnimationProfile(indexOrType) {
  const type = weaponTypeFromIndex(indexOrType);
  return WEAPON_ANIMATION_PROFILES[type] || WEAPON_ANIMATION_PROFILES.rifle;
}

export function getEnemyAnimationProfile(type = 'soldier') {
  return ENEMY_ANIMATION_PROFILES[String(type || 'soldier').toLowerCase()] || ENEMY_ANIMATION_PROFILES.soldier;
}

export function getWeaponFeelTuning(indexOrType) {
  const type = weaponTypeFromIndex(indexOrType);
  return mergeTuning(ANIMATION_FEEL_TUNING.weapon.default, ANIMATION_FEEL_TUNING.weapon[type], `weapon-feel.${type}`);
}

export function getHandFeelTuning(indexOrType) {
  const type = weaponTypeFromIndex(indexOrType);
  return mergeTuning(ANIMATION_FEEL_TUNING.hand.default, ANIMATION_FEEL_TUNING.hand[type], `hand-feel.${type}`);
}

export function getLocomotionFeelTuning() {
  return ANIMATION_FEEL_TUNING.locomotion;
}

export function getEnemyFeelTuning(type = 'soldier') {
  const key = String(type || 'soldier').toLowerCase();
  return mergeTuning(ANIMATION_FEEL_TUNING.enemy.default, ANIMATION_FEEL_TUNING.enemy[key], `enemy-feel.${key}`);
}

export function weaponFeelProfileDebug(indexOrType = null) {
  const profiles = indexOrType == null
    ? Object.values(WEAPON_FEEL_PROFILES)
    : [getWeaponFeelProfile(indexOrType)];
  const summarize = (profile) => ({
    weaponIdx: profile.weaponIdx,
    id: profile.id,
    type: profile.type,
    label: profile.label,
    manifestId: profile.manifestId,
    ads: {
      inLambda: profile.ads.inLambda,
      outLambda: profile.ads.outLambda,
      visualLambda: profile.ads.visualLambda,
      settleInLambda: profile.ads.settleInLambda,
      settleOutLambda: profile.ads.settleOutLambda,
      fovDelta: profile.ads.fovDelta,
      speedMul: profile.ads.speedMul,
      viewFit: profile.ads.viewFit ? { ...profile.ads.viewFit } : null
    },
    sight: profile.sight ? {
      mode: profile.sight.mode,
      maxResidualNdc: profile.sight.maxResidualNdc,
      hasFront: !!profile.sight.front,
      hasRear: !!profile.sight.rear,
      frontSocket: profile.sight.front?.socket || profile.sight.front?.node || null,
      rearSocket: profile.sight.rear?.socket || profile.sight.rear?.node || null
    } : null,
    recoil: { ...profile.recoil },
    hand: { ...profile.hand },
    notifies: { ...profile.notifies }
  });
  return indexOrType == null ? profiles.map(summarize) : summarize(profiles[0]);
}

export function animationTuningDebug() {
  return {
    version: ANIMATION_FEEL_TUNING.version,
    id: ANIMATION_FEEL_TUNING.id,
    policy: {
      safeToTune: ANIMATION_FEEL_TUNING.policy.safeToTune.slice(),
      gameplayAuthorityLocked: ANIMATION_FEEL_TUNING.policy.gameplayAuthorityLocked.slice(),
      guardedRuntimeFlags: ANIMATION_FEEL_TUNING.policy.guardedRuntimeFlags.slice()
    },
    defaults: {
      featureFlags: { ...ANIMATION_FEATURE_FLAG_DEFAULTS },
      weapon: { ...ANIMATION_FEEL_TUNING.weapon.default },
      hand: { ...ANIMATION_FEEL_TUNING.hand.default },
      locomotion: { ...ANIMATION_FEEL_TUNING.locomotion },
      enemy: { ...ANIMATION_FEEL_TUNING.enemy.default }
    }
  };
}
