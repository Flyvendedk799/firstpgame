// AA Asset Manifest
//
// Stable, machine-readable declarations for every production asset the
// game expects to swap into the procedural runtime. Each entry lists:
//   - id: stable namespaced ID used to look up the asset at runtime.
//   - kind: high-level type (character, weapon, environment, vfx, material, animation).
//   - src: relative GLB/texture URL (null while the procedural fallback is
//     the authoritative visual).
//   - fallback: the runtime helper that produces a procedural stand-in if
//     `src` is null or fails to load.
//   - skeleton/sockets/clips/lods/maps: validation contract for the loader.
//
// The current codebase ships the procedural fallback for every entry — the
// manifest exists so the loader, validator, regression tests, and debug
// metadata can describe "missing authored asset → procedural in use" and
// every authored asset that arrives later passes through the same validation
// without changing call-sites.

export const SHARED_HUMANOID_SKELETON = [
  'root', 'pelvis', 'spine_01', 'spine_02', 'chest', 'neck', 'head',
  'clavicle_l', 'upperArm_l', 'forearm_l', 'hand_l', 'fingers_l',
  'clavicle_r', 'upperArm_r', 'forearm_r', 'hand_r', 'fingers_r',
  'thigh_l', 'calf_l', 'foot_l', 'toe_l',
  'thigh_r', 'calf_r', 'foot_r', 'toe_r',
  'gear_backpack', 'gear_shield', 'gear_helmet', 'gear_visor',
  'gear_strap_l', 'gear_strap_r', 'gear_holster_l', 'gear_holster_r',
  'weapon_grip', 'weapon_support'
];

export const SHARED_HAND_SKELETON = [
  'cameraRoot',
  'wrist_r', 'palm_r',
  'thumb_r_01', 'thumb_r_02', 'thumb_r_03',
  'index_r_01', 'index_r_02', 'index_r_03',
  'middle_r_01', 'middle_r_02', 'middle_r_03',
  'ring_r_01', 'ring_r_02', 'ring_r_03',
  'pinky_r_01', 'pinky_r_02', 'pinky_r_03',
  'wrist_l', 'palm_l',
  'thumb_l_01', 'thumb_l_02', 'thumb_l_03',
  'index_l_01', 'index_l_02', 'index_l_03',
  'middle_l_01', 'middle_l_02', 'middle_l_03',
  'ring_l_01', 'ring_l_02', 'ring_l_03',
  'pinky_l_01', 'pinky_l_02', 'pinky_l_03',
  'weapon_socket'
];

export const CHARACTER_LODS = [
  { id: 'high', label: 'LOD0', maxDistance: 12, triangleBudget: 28000 },
  { id: 'medium', label: 'LOD1', maxDistance: 28, triangleBudget: 12000 },
  { id: 'low', label: 'LOD2', maxDistance: 60, triangleBudget: 3600 },
  { id: 'impostor', label: 'LOD3', maxDistance: Infinity, triangleBudget: 240 }
];

export const ANIMATION_CLIPS = {
  enemy: [
    'idle', 'patrol', 'alert', 'sprint', 'strafeLeft', 'strafeRight',
    'crouch', 'peek', 'aim', 'fire', 'reload',
    'flinchHead', 'flinchTorso', 'flinchLeftArm', 'flinchRightArm', 'flinchLeg',
    'stagger', 'grenade', 'melee',
    'deathHead', 'deathTorso', 'deathSlump', 'deathBack',
    'takedownVictim', 'bossPhaseTell', 'bossPhaseTransition'
  ],
  viewmodel: [
    'idle', 'walkSway', 'sprint', 'ads',
    'reloadPistol', 'reloadRifle', 'reloadShotgun', 'reloadSmg', 'reloadMarksman', 'reloadHeavy',
    'inspect', 'melee', 'grenadeThrow', 'weaponSwap',
    'damageFlinch', 'focusMode', 'tacticalLean'
  ]
};

export const WEAPON_SOCKETS = [
  'muzzle', 'optic', 'magazine', 'ejectionPort',
  'gripLeft', 'gripRight', 'muzzleFlash', 'scopeCamera',
  'attachmentMuzzle', 'attachmentMag', 'attachmentForegrip', 'attachmentLaser'
];

export const ENVIRONMENT_MODULE_CATEGORIES = [
  'wallPanel', 'floorPanel', 'ceilingPanel',
  'door', 'doorFrame', 'window', 'glassFrame',
  'vent', 'pipe', 'cable', 'rail',
  'stair', 'trim', 'prop', 'signage',
  'debrisCluster', 'lightCard', 'emissiveFixture'
];

export const PBR_TEXTURE_CATEGORIES = [
  'concrete', 'tile', 'metal', 'paintedMetal', 'glass', 'wood', 'rubber', 'fabric',
  'plastic', 'skin', 'hair', 'armor', 'emissivePanel', 'wetSurface', 'grime',
  'blood', 'bulletHole', 'scorchMark', 'glassCrack', 'warningPaint', 'signage',
  'marble', 'brass', 'chrome', 'leather'
];

export const DECAL_CATEGORIES = [
  'bulletHole', 'bloodSpray', 'bloodPool', 'grime', 'scuff',
  'crack', 'sparkStain', 'scorch'
];

export const VFX_FAMILIES = [
  'muzzleFlash', 'suppressedMuzzleFlash', 'smoke', 'dust', 'sparks',
  'bloodImpact', 'armorImpact', 'glassShard', 'explosion',
  'flashbang', 'smokeGrenade', 'focusOverlay', 'lowHpOverlay',
  'killBeatOverlay', 'bossWarning'
];

const enemyClips = ANIMATION_CLIPS.enemy.slice();
const vmClips = ANIMATION_CLIPS.viewmodel.slice();
const requiredEnemySockets = ['root', 'head', 'weapon_grip'];

function characterEntry(id, type, label, accent, options = {}) {
  return {
    id,
    kind: 'character',
    type,
    label,
    accent,
    src: options.src || null,
    skeleton: options.skeleton || SHARED_HUMANOID_SKELETON,
    requiredBones: options.requiredBones || requiredEnemySockets,
    clips: options.clips || enemyClips,
    lods: options.lods || CHARACTER_LODS.map(l => l.id),
    materials: options.materials || ['armor', 'fabric', 'rubber', 'metal', 'skin'],
    damageOverlays: options.damageOverlays || ['blood', 'grime', 'scorch'],
    weakPoints: options.weakPoints || ['head', 'chestPlate'],
    hitboxBindings: options.hitboxBindings || ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'],
    fallback: options.fallback || 'enemy.procedural.archetype',
    triangleBudgets: options.triangleBudgets || CHARACTER_LODS.reduce((m, l) => (m[l.id] = l.triangleBudget, m), {}),
    boss: !!options.boss,
    drone: !!options.drone
  };
}

export const CHARACTER_MANIFEST = {
  'character.scout': characterEntry('character.scout', 'scout', 'Scout', 0x40ff80, {}),
  'character.soldier': characterEntry('character.soldier', 'soldier', 'Soldier', 0xff3030, {}),
  'character.marksman': characterEntry('character.marksman', 'marksman', 'Marksman', 0xa0c8ff, {}),
  'character.sniper': characterEntry('character.sniper', 'sniper', 'Sniper', 0x40a0ff, {}),
  'character.riot': characterEntry('character.riot', 'riot', 'Riot', 0xff5040, { materials: ['armor', 'fabric', 'rubber', 'metal', 'glass'] }),
  'character.heavy': characterEntry('character.heavy', 'heavy', 'Heavy', 0xff7020, { materials: ['armor', 'fabric', 'metal', 'paintedMetal'] }),
  'character.demolitions': characterEntry('character.demolitions', 'demolitions', 'Demolitions', 0xff8040, {}),
  'character.pistolero': characterEntry('character.pistolero', 'pistolero', 'Pistolero', 0xa040ff, {}),
  'character.lieutenant': characterEntry('character.lieutenant', 'lieutenant', 'Lieutenant', 0xffd060, {}),
  'character.drone': characterEntry('character.drone', 'drone', 'Drone Operator', 0x40c8ff, {
    drone: true,
    skeleton: ['root', 'core', 'rotor_f', 'rotor_b', 'rotor_l', 'rotor_r', 'eye', 'gunHardpoint'],
    requiredBones: ['root', 'core', 'eye'],
    clips: ['idle', 'hover', 'engage', 'fire', 'reposition', 'damage', 'death'],
    materials: ['metal', 'plastic', 'emissivePanel'],
    weakPoints: ['eye', 'rotor']
  }),
  'character.boss.continental': characterEntry('character.boss.continental', 'boss', 'Continental Boss', 0xffd040, { boss: true }),
  'character.boss.nightclub': characterEntry('character.boss.nightclub', 'boss', 'Nightclub Boss', 0xffd040, { boss: true }),
  'character.boss.medical': characterEntry('character.boss.medical', 'boss', 'Sterling Medical Boss', 0xffd040, { boss: true }),
  'character.boss.subway': characterEntry('character.boss.subway', 'boss', 'Subway Boss', 0xffd040, { boss: true }),
  'character.boss.yacht': characterEntry('character.boss.yacht', 'boss', 'Yacht Boss', 0xffd040, { boss: true }),
  'character.boss.server': characterEntry('character.boss.server', 'boss', 'Server Farm Boss', 0xffd040, { boss: true }),
  'character.boss.spire': characterEntry('character.boss.spire', 'boss', 'Spire Boss', 0xffd040, { boss: true })
};

export const VIEWMODEL_MANIFEST = {
  'viewmodel.operative.hands': {
    id: 'viewmodel.operative.hands',
    kind: 'viewmodel',
    label: 'Operative First-Person Hands',
    src: null,
    skeleton: SHARED_HAND_SKELETON,
    requiredBones: ['cameraRoot', 'wrist_r', 'palm_r', 'wrist_l', 'palm_l', 'weapon_socket'],
    materials: ['skin', 'glove', 'fabric', 'rubber'],
    clips: vmClips,
    fallback: 'viewmodel.procedural.hands'
  },
  'viewmodel.operative.proxy': {
    id: 'viewmodel.operative.proxy',
    kind: 'viewmodel-proxy',
    label: 'Operative Full-Body Proxy',
    src: null,
    skeleton: SHARED_HUMANOID_SKELETON,
    requiredBones: ['root', 'pelvis', 'chest', 'head'],
    materials: ['armor', 'fabric', 'rubber', 'leather'],
    fallback: 'viewmodel.procedural.proxy'
  }
};

function weaponEntry(id, type, label, options = {}) {
  return {
    id,
    kind: 'weapon',
    type,
    label,
    src: options.src || null,
    sockets: options.sockets || WEAPON_SOCKETS,
    requiredSockets: options.requiredSockets || ['muzzle', 'gripLeft', 'gripRight', 'muzzleFlash'],
    materials: options.materials || ['metal', 'paintedMetal', 'plastic', 'rubber'],
    clips: options.clips || ['idle', 'fire', 'reload', 'ads', 'inspect'],
    triangleBudget: options.triangleBudget ?? 8000,
    fallback: options.fallback || `weapon.procedural.${type}`,
    attachments: options.attachments || ['scope', 'muzzle', 'magazine', 'foregrip']
  };
}

export const WEAPON_MANIFEST = {
  'weapon.pistol': weaponEntry('weapon.pistol', 'pistol', 'Sidearm', { triangleBudget: 4200 }),
  'weapon.rifle': weaponEntry('weapon.rifle', 'rifle', 'Service Rifle', { triangleBudget: 8200 }),
  'weapon.shotgun': weaponEntry('weapon.shotgun', 'shotgun', 'Combat Shotgun', { triangleBudget: 7600 }),
  'weapon.smg': weaponEntry('weapon.smg', 'smg', 'SMG', { triangleBudget: 6800 }),
  'weapon.marksman': weaponEntry('weapon.marksman', 'marksman', 'Marksman Rifle', { triangleBudget: 9200 }),
  'weapon.heavy': weaponEntry('weapon.heavy', 'heavy', 'Heavy Weapon', { triangleBudget: 12000 }),
  'weapon.knife': weaponEntry('weapon.knife', 'knife', 'Combat Knife', { triangleBudget: 1800, requiredSockets: ['gripRight'], clips: ['idle', 'attack', 'throw', 'inspect'] }),
  'weapon.grenade': weaponEntry('weapon.grenade', 'grenade', 'Frag Grenade', { triangleBudget: 2400, requiredSockets: ['gripRight'], clips: ['idle', 'throw'] })
};

export const ATTACHMENT_MANIFEST = {
  'attachment.scope.tier1': { id: 'attachment.scope.tier1', kind: 'attachment', tier: 1, type: 'scope', src: null, materials: ['metal', 'glass', 'rubber'], fallback: 'attachment.procedural.scope.tier1' },
  'attachment.scope.tier2': { id: 'attachment.scope.tier2', kind: 'attachment', tier: 2, type: 'scope', src: null, materials: ['metal', 'glass', 'rubber'], fallback: 'attachment.procedural.scope.tier2' },
  'attachment.scope.tier3': { id: 'attachment.scope.tier3', kind: 'attachment', tier: 3, type: 'scope', src: null, materials: ['metal', 'glass', 'rubber'], fallback: 'attachment.procedural.scope.tier3' },
  'attachment.scope.tier4': { id: 'attachment.scope.tier4', kind: 'attachment', tier: 4, type: 'scope', src: null, materials: ['metal', 'glass', 'rubber', 'emissivePanel'], fallback: 'attachment.procedural.scope.tier4' },
  'attachment.muzzle.suppressor': { id: 'attachment.muzzle.suppressor', kind: 'attachment', type: 'muzzle', src: null, materials: ['metal', 'paintedMetal'], fallback: 'attachment.procedural.suppressor' },
  'attachment.muzzle.compensator': { id: 'attachment.muzzle.compensator', kind: 'attachment', type: 'muzzle', src: null, materials: ['metal'], fallback: 'attachment.procedural.compensator' },
  'attachment.magazine.extended': { id: 'attachment.magazine.extended', kind: 'attachment', type: 'magazine', src: null, materials: ['metal', 'plastic'], fallback: 'attachment.procedural.magazine.extended' },
  'attachment.foregrip.vertical': { id: 'attachment.foregrip.vertical', kind: 'attachment', type: 'foregrip', src: null, materials: ['rubber', 'plastic'], fallback: 'attachment.procedural.foregrip.vertical' },
  'attachment.foregrip.angled': { id: 'attachment.foregrip.angled', kind: 'attachment', type: 'foregrip', src: null, materials: ['rubber', 'plastic'], fallback: 'attachment.procedural.foregrip.angled' }
};

function environmentEntry(id, building, label, options = {}) {
  return {
    id,
    kind: 'environment-kit',
    building,
    label,
    src: options.src || null,
    modules: options.modules || ENVIRONMENT_MODULE_CATEGORIES,
    materials: options.materials || ['concrete', 'metal', 'paintedMetal'],
    propBudget: options.propBudget ?? 240,
    decalBudget: options.decalBudget ?? 96,
    lightBudget: options.lightBudget ?? 18,
    fallback: options.fallback || `environment.procedural.${building}`,
    densityRules: options.densityRules || ['near', 'mid', 'far'],
    collisionPolicy: options.collisionPolicy || 'decorative-only'
  };
}

export const ENVIRONMENT_MANIFEST = {
  'env.docks': environmentEntry('env.docks', 1, 'Loading Dock', { materials: ['concrete', 'paintedMetal', 'wetSurface', 'grime', 'emissivePanel'] }),
  'env.continental': environmentEntry('env.continental', 2, 'Continental Lobby', { materials: ['marble', 'brass', 'wood', 'fabric', 'emissivePanel'] }),
  'env.nightclub': environmentEntry('env.nightclub', 3, 'Nightclub', { materials: ['plastic', 'metal', 'emissivePanel', 'rubber', 'glass'], decalBudget: 132 }),
  'env.penthouse': environmentEntry('env.penthouse', 4, 'Penthouse', { materials: ['glass', 'metal', 'marble', 'leather'] }),
  'env.medical': environmentEntry('env.medical', 5, 'Sterling Medical', { materials: ['tile', 'metal', 'glass', 'plastic', 'emissivePanel'] }),
  'env.subway': environmentEntry('env.subway', 6, 'Subway Line 7', { materials: ['concrete', 'metal', 'rubber', 'paintedMetal', 'grime'] }),
  'env.yacht': environmentEntry('env.yacht', 7, 'Azure Yacht', { materials: ['wood', 'chrome', 'glass', 'leather', 'wetSurface'] }),
  'env.server': environmentEntry('env.server', 8, 'Server Farm Delta', { materials: ['metal', 'plastic', 'rubber', 'emissivePanel'] }),
  'env.border': environmentEntry('env.border', 9, 'Border Crossing', { materials: ['concrete', 'paintedMetal', 'grime'] }),
  'env.cathedral': environmentEntry('env.cathedral', 10, 'Cathedral of San Marco', { materials: ['marble', 'brass', 'glass', 'wood', 'emissivePanel'] }),
  'env.freighter': environmentEntry('env.freighter', 11, 'Karelia Freighter', { materials: ['metal', 'paintedMetal', 'wetSurface', 'grime'] }),
  'env.spire': environmentEntry('env.spire', 12, 'The Spire', { materials: ['glass', 'chrome', 'marble', 'paintedMetal'] })
};

function materialEntry(id, presetName, options = {}) {
  return {
    id,
    kind: 'material',
    preset: presetName,
    src: options.src || null,
    maps: options.maps || ['albedo', 'normal', 'roughness', 'metalness'],
    qualityTiers: options.qualityTiers || ['low', 'medium', 'high', 'ultra'],
    fallback: options.fallback || `material.procedural.${presetName}`
  };
}

export const MATERIAL_MANIFEST = PBR_TEXTURE_CATEGORIES.reduce((m, name) => {
  m[`material.${name}`] = materialEntry(`material.${name}`, name, {});
  return m;
}, {});

export const DECAL_MANIFEST = DECAL_CATEGORIES.reduce((m, name) => {
  m[`decal.${name}`] = {
    id: `decal.${name}`,
    kind: 'decal-atlas',
    family: name,
    src: null,
    cellGrid: name === 'bulletHole' ? [4, 4] : [3, 3],
    fallback: `decal.procedural.${name}`,
    qualityTiers: ['low', 'medium', 'high']
  };
  return m;
}, {});

function vfxEntry(id, family, options = {}) {
  return {
    id,
    kind: 'vfx',
    family,
    src: options.src || null,
    spriteAtlas: options.spriteAtlas || `vfx.${family}.atlas`,
    materialVariants: options.materialVariants || ['additive', 'alphaBlend', 'decal'],
    lifetimeMs: options.lifetimeMs || 700,
    qualityTiers: options.qualityTiers || ['off', 'low', 'medium', 'high'],
    budgetCategory: options.budgetCategory || family,
    fallback: options.fallback || `vfx.procedural.${family}`
  };
}

export const VFX_MANIFEST = VFX_FAMILIES.reduce((m, family) => {
  m[`vfx.${family}`] = vfxEntry(`vfx.${family}`, family, {});
  return m;
}, {});

export const ANIMATION_MANIFEST = {
  'animation.enemy': {
    id: 'animation.enemy',
    kind: 'animation-set',
    skeleton: SHARED_HUMANOID_SKELETON,
    clips: ANIMATION_CLIPS.enemy,
    layers: ['locomotion', 'upperBodyAim', 'hitReactionAdditive', 'deathOverride', 'bossPhase'],
    fallback: 'animation.procedural.enemy'
  },
  'animation.viewmodel': {
    id: 'animation.viewmodel',
    kind: 'animation-set',
    skeleton: SHARED_HAND_SKELETON,
    clips: ANIMATION_CLIPS.viewmodel,
    layers: ['locomotion', 'weaponPose', 'damageFlinch', 'tacticalLean'],
    fallback: 'animation.procedural.viewmodel',
    rootMotionPolicy: 'ignore',
    clipMeta: [
      { id: 'idle', playback: 'loop', additive: false, fallbackProcedure: 'procedural.idle' },
      { id: 'reloadRifle', playback: 'oneshot', additive: false, fallbackProcedure: 'reloadTimelines.rifle' },
      { id: 'reloadPistol', playback: 'oneshot', additive: false, fallbackProcedure: 'reloadTimelines.pistol' },
      { id: 'ads', playback: 'loop', additive: false, fallbackProcedure: 'procedural.ads' },
      { id: 'inspect', playback: 'oneshot', additive: false, markers: [{ t: 0.5, name: 'inspectFocusPoint' }] }
    ],
    gripValidationSockets: ['gripLeft', 'gripRight', 'magazine']
  }
};

export const ALL_MANIFESTS = {
  characters: CHARACTER_MANIFEST,
  viewmodels: VIEWMODEL_MANIFEST,
  weapons: WEAPON_MANIFEST,
  attachments: ATTACHMENT_MANIFEST,
  environments: ENVIRONMENT_MANIFEST,
  materials: MATERIAL_MANIFEST,
  decals: DECAL_MANIFEST,
  vfx: VFX_MANIFEST,
  animations: ANIMATION_MANIFEST
};

// Per-LOD/per-asset budget caps used by performance acceptance.
export const ASSET_BUDGETS = {
  character: {
    triangles: { high: 28000, medium: 12000, low: 3600, impostor: 240 },
    bones: 96,
    materials: 8,
    textureMb: 24
  },
  weapon: {
    triangles: 12000,
    materials: 6,
    textureMb: 18
  },
  environment: {
    triangles: 64000,
    materials: 18,
    textureMb: 96,
    decals: 96,
    props: 240,
    lights: 18,
    shadowCasters: 12
  },
  vfx: {
    activeParticles: { low: 240, medium: 480, high: 960, ultra: 1600 },
    activeDecals: { low: 24, medium: 48, high: 96, ultra: 160 },
    activeMixers: 36
  },
  // Scene-wide budget reflects the maximum allowed under a stress scene
  // (worst-case building 8, 12+ enemies, scope PIP, VFX stress).  The
  // procedural fallback currently sits ~50–60% of these caps; the goal is
  // for authored assets to land WITHOUT raising these caps further.
  scene: {
    drawCalls: 2400,
    triangles: 3_600_000,
    geometries: 1800,
    textures: 480
  }
};

export function listManifests() {
  return Object.fromEntries(
    Object.entries(ALL_MANIFESTS).map(([k, v]) => [k, Object.keys(v).length])
  );
}

export function manifestSummary() {
  let total = 0;
  let authored = 0;
  let fallback = 0;
  const perKind = {};
  for (const [kind, manifest] of Object.entries(ALL_MANIFESTS)) {
    let kAuthored = 0;
    let kFallback = 0;
    for (const entry of Object.values(manifest)) {
      total++;
      if (entry.src) {
        authored++;
        kAuthored++;
      } else {
        fallback++;
        kFallback++;
      }
    }
    perKind[kind] = { total: kAuthored + kFallback, authored: kAuthored, fallback: kFallback };
  }
  return { total, authored, fallback, perKind };
}

// Validate a manifest entry — confirms required metadata is present so the
// loader can fail loudly before the game silently renders a missing asset.
export function validateManifestEntry(entry) {
  const issues = [];
  if (!entry || typeof entry !== 'object') {
    return { ok: false, issues: [{ code: 'missing-entry', level: 'error' }] };
  }
  if (!entry.id) issues.push({ code: 'missing-id', level: 'error' });
  if (!entry.kind) issues.push({ code: 'missing-kind', level: 'error' });
  if (!entry.fallback) issues.push({ code: 'missing-fallback', level: 'warning' });
  if (entry.kind === 'character' || entry.kind === 'viewmodel') {
    if (!Array.isArray(entry.skeleton) || entry.skeleton.length === 0) issues.push({ code: 'missing-skeleton', level: 'error' });
    if (entry.requiredBones && Array.isArray(entry.skeleton)) {
      for (const bone of entry.requiredBones) {
        if (!entry.skeleton.includes(bone)) issues.push({ code: `missing-required-bone:${bone}`, level: 'error' });
      }
    }
  }
  if (entry.kind === 'weapon') {
    if (!Array.isArray(entry.sockets) || entry.sockets.length === 0) issues.push({ code: 'missing-sockets', level: 'error' });
    if (entry.requiredSockets && Array.isArray(entry.sockets)) {
      for (const socket of entry.requiredSockets) {
        if (!entry.sockets.includes(socket)) issues.push({ code: `missing-required-socket:${socket}`, level: 'error' });
      }
    }
  }
  if (entry.kind === 'animation-set' && Array.isArray(entry.clipMeta)) {
    for (const c of entry.clipMeta) {
      if (!c || typeof c !== 'object' || !c.id) {
        issues.push({ code: 'clipMeta-missing-id', level: 'error' });
        continue;
      }
      if (c.playback && !['loop', 'oneshot', 'additive'].includes(c.playback)) {
        issues.push({ code: `clipMeta-bad-playback:${c.id}`, level: 'warning' });
      }
      if (c.rootMotion && !['ignore', 'proxyOnly'].includes(c.rootMotion)) {
        issues.push({ code: `clipMeta-bad-rootMotion:${c.id}`, level: 'warning' });
      }
    }
  }
  const errors = issues.filter(i => i.level === 'error').length;
  return { ok: errors === 0, issues };
}

export function validateAllManifests() {
  const result = { ok: true, perKind: {}, errors: 0, warnings: 0 };
  for (const [kind, manifest] of Object.entries(ALL_MANIFESTS)) {
    const out = { entries: 0, errors: 0, warnings: 0, items: [] };
    for (const entry of Object.values(manifest)) {
      const v = validateManifestEntry(entry);
      out.entries++;
      const errs = v.issues.filter(i => i.level === 'error').length;
      const wrn = v.issues.filter(i => i.level === 'warning').length;
      out.errors += errs;
      out.warnings += wrn;
      if (!v.ok) result.ok = false;
      out.items.push({ id: entry.id, ok: v.ok, issues: v.issues });
    }
    result.errors += out.errors;
    result.warnings += out.warnings;
    result.perKind[kind] = out;
  }
  return result;
}

// Registry: a lightweight runtime that knows which manifest entries have
// authored assets, which fall back to procedural, and tracks load/dispose
// state so debug metadata can answer "what is currently in memory?".
export function createAssetRegistry(options = {}) {
  const THREE = options.THREE;
  const gltfLoader = options.gltfLoader || null;
  const textureLoader = options.textureLoader || null;
  const getSettings = options.getSettings || (() => ({}));

  const cache = new Map();
  const inFlight = new Map();
  const usage = {
    loaded: 0,
    fallback: 0,
    failed: 0,
    bytes: 0
  };
  const fallbackLog = [];

  function lookup(id) {
    for (const manifest of Object.values(ALL_MANIFESTS)) {
      if (manifest[id]) return manifest[id];
    }
    return null;
  }

  function noteFallback(id, reason) {
    usage.fallback++;
    fallbackLog.push({ id, reason: String(reason || 'no-src'), at: Date.now() });
    if (fallbackLog.length > 64) fallbackLog.shift();
  }

  async function load(id) {
    const entry = lookup(id);
    if (!entry) {
      usage.failed++;
      return { id, status: 'unknown', source: 'none', entry: null };
    }
    if (cache.has(id)) return cache.get(id);
    if (!entry.src) {
      const out = { id, entry, status: 'fallback', source: 'procedural', reason: 'no-src' };
      cache.set(id, out);
      noteFallback(id, 'no-src');
      return out;
    }
    if (inFlight.has(id)) return inFlight.get(id);
    const promise = (async () => {
      try {
        if (entry.kind === 'character' || entry.kind === 'viewmodel' || entry.kind === 'weapon' || entry.kind === 'environment-kit' || entry.kind === 'attachment') {
          if (!gltfLoader) throw new Error('no GLTFLoader');
          const gltf = await new Promise((res, rej) => gltfLoader.load(entry.src, res, undefined, rej));
          const out = { id, entry, status: 'loaded', source: 'authored', gltf };
          cache.set(id, out);
          usage.loaded++;
          return out;
        }
        if (entry.kind === 'material' || entry.kind === 'decal-atlas' || entry.kind === 'vfx') {
          if (!textureLoader) throw new Error('no TextureLoader');
          const tex = await new Promise((res, rej) => textureLoader.load(entry.src, res, undefined, rej));
          const out = { id, entry, status: 'loaded', source: 'authored', texture: tex };
          cache.set(id, out);
          usage.loaded++;
          return out;
        }
        const out = { id, entry, status: 'fallback', source: 'procedural', reason: 'kind-not-loaded' };
        cache.set(id, out);
        noteFallback(id, 'kind-not-loaded');
        return out;
      } catch (err) {
        const reason = String(err && err.message || err);
        const out = { id, entry, status: 'fallback', source: 'procedural', reason };
        cache.set(id, out);
        noteFallback(id, reason);
        usage.failed++;
        return out;
      } finally {
        inFlight.delete(id);
      }
    })();
    inFlight.set(id, promise);
    return promise;
  }

  function get(id) {
    return cache.get(id) || null;
  }

  function dispose(id) {
    const slot = cache.get(id);
    if (!slot) return false;
    try {
      if (slot.gltf?.scene) {
        slot.gltf.scene.traverse(o => {
          if (o.geometry?.dispose) o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose?.());
          else if (o.material?.dispose) o.material.dispose();
        });
      }
      if (slot.texture?.dispose) slot.texture.dispose();
    } catch (_) {}
    cache.delete(id);
    return true;
  }

  function disposeAll() {
    for (const id of Array.from(cache.keys())) dispose(id);
  }

  function status() {
    const loaded = [];
    const fallback = [];
    for (const slot of cache.values()) {
      if (slot.status === 'loaded') loaded.push({ id: slot.id, source: slot.source });
      else fallback.push({ id: slot.id, reason: slot.reason });
    }
    return {
      cached: cache.size,
      inFlight: inFlight.size,
      usage: { ...usage },
      loaded,
      fallback,
      fallbackLog: fallbackLog.slice(-16)
    };
  }

  function preflight() {
    const summary = manifestSummary();
    const validation = validateAllManifests();
    const procedural = [];
    for (const manifest of Object.values(ALL_MANIFESTS)) {
      for (const entry of Object.values(manifest)) {
        if (!entry.src) procedural.push({ id: entry.id, kind: entry.kind, fallback: entry.fallback });
      }
    }
    const vmAnim = ALL_MANIFESTS.animations && ALL_MANIFESTS.animations['animation.viewmodel'];
    return {
      summary,
      validation,
      procedural: procedural.length,
      proceduralSample: procedural.slice(0, 16),
      viewmodelAnimations: vmAnim
        ? {
            id: vmAnim.id,
            clipCount: (vmAnim.clips && vmAnim.clips.length) || 0,
            clipMetaCount: (vmAnim.clipMeta && vmAnim.clipMeta.length) || 0,
            rootMotionPolicy: vmAnim.rootMotionPolicy || 'ignore'
          }
        : null
    };
  }

  return {
    load,
    get,
    dispose,
    disposeAll,
    status,
    preflight,
    lookup,
    manifestSummary,
    listManifests,
    validateAllManifests
  };
}
