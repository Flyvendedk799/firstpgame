export const ANIMATION_PIPELINE_VERSION = 1;

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
  heavy: { label: 'Heavy', weight: 1.42, turnSharpness: 0.68, stepEnergy: 0.82, recoilAbsorb: 1.4, intentLead: 0.85 },
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
  version: 1,
  id: 'aaa-final-v1',
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
    id: 'locomotion-feel.aaa-final',
    stride: 1.06,
    cameraWeight: 1.08,
    viewmodelWeight: 1.12,
    proxyWeight: 1.10,
    gaitWeight: 1.08,
    impactWeight: 1.18,
    counterStrafeWeight: 1.14,
    sprintWeight: 1.12,
    slideWeight: 1.16,
    vaultWeight: 1.10,
    wallKickWeight: 1.14,
    dropkickWeight: 1.18,
    adsDampen: 1.0
  },
  enemy: {
    default: BASE_ENEMY_FEEL,
    scout: { intentLead: 1.16, peekLead: 1.20, stepEnergy: 1.14, hitReact: 1.08 },
    pistolero: { intentLead: 1.12, weaponRaise: 1.14, shoulderCommit: 1.12 },
    heavy: { compression: 1.18, shoulderCommit: 1.16, hitReact: 0.92, deathCollapse: 1.16 },
    riot: { compression: 1.16, weaponRaise: 1.08, shoulderCommit: 1.18 },
    shielded: { compression: 1.16, weaponRaise: 1.08, shoulderCommit: 1.18 },
    marksman: { aimTension: 1.18, peekLead: 1.10, weaponRaise: 1.14 },
    sniper: { aimTension: 1.24, intentLead: 0.98, weaponRaise: 1.16 },
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
