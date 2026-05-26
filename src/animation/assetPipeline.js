import {
  SEMANTIC_MIXAMO_CLIPS,
  TOOLING_CAPABILITIES,
  getWeaponAnimationProfile
} from './profiles.js';

export const IMPORT_PIPELINE_VERSION = 1;

export const CANONICAL_ASSET_CONTRACT = Object.freeze({
  units: 'meters',
  objectScale: 1,
  armatureScale: 1,
  forwardAxis: '-Z',
  upAxis: '+Y',
  rootMotionPolicy: 'ignore-by-default',
  meshScalePolicy: 'normalize-offline',
  runtimePolicy: 'fallback-safe'
});

export const ASSET_IMPORT_STAGES = Object.freeze([
  { id: 'sourceImport', label: 'Source import', phase: 'offline', required: true },
  { id: 'gltfValidator', label: 'glTF validator', phase: 'offline', required: true },
  { id: 'gltfTransformCleanup', label: 'glTF Transform cleanup', phase: 'offline', required: true },
  { id: 'projectPreflight', label: 'Project preflight', phase: 'offline', required: true },
  { id: 'manifestProfile', label: 'Manifest/profile binding', phase: 'data', required: true },
  { id: 'runtimeLoad', label: 'Runtime load/fallback', phase: 'runtime', required: true },
  { id: 'graphBinding', label: 'Animation graph binding', phase: 'runtime', required: true },
  { id: 'editorAvailability', label: 'Level editor availability', phase: 'editor', required: true }
]);

export const EDITOR_ANIMATION_PREVIEW_STATES = Object.freeze([
  'idle',
  'walk',
  'run',
  'reload',
  'fire',
  'hit',
  'death',
  'inspect'
]);

const PREVIEW_CLIP_ALIASES = Object.freeze({
  idle: ['idle', 'Idle'],
  walk: ['walk', 'patrol', 'Walking', 'walkSway'],
  run: ['run', 'sprint', 'Running'],
  reload: ['reload', 'Reload', 'reloadRifle', 'reloadPistol', 'reloadShotgun', 'reloadSmg', 'reloadMarksman', 'reloadHeavy'],
  fire: ['fire', 'Fire', 'fireAdditive'],
  hit: ['hitBody', 'hitHead', 'hitLeg', 'flinchTorso', 'flinchHead', 'flinchLeg', 'damageFlinch'],
  death: ['deathForward', 'deathBack', 'deathSide', 'deathTorso', 'deathHead', 'deathSlump', 'Dead'],
  inspect: ['inspect']
});

const LEVEL_EDITOR_REF_CONTRACTS = Object.freeze({
  weaponProfiles: { prefix: 'weapon.', buckets: ['weapons'], strict: true },
  enemyProfiles: { prefix: 'character.', buckets: ['characters'], strict: true },
  visualProfiles: { prefix: '', buckets: ['environments', 'characters'], strict: false },
  modelProfiles: { prefix: '', buckets: ['characters', 'viewmodels', 'weapons', 'attachments', 'environments'], strict: false },
  animationProfiles: { prefix: 'animation.', buckets: ['animations'], strict: true },
  importedAssets: { prefix: '', buckets: [], strict: false, external: true }
});

export const IMPORT_PROFILE_TEMPLATES = Object.freeze({
  weaponViewmodel: {
    id: 'weapon.example.rifle',
    kind: 'weapon',
    type: 'rifle',
    src: 'assets/weapons/example/example_viewmodel.glb',
    sockets: ['muzzle', 'gripRight', 'gripLeft', 'magazine', 'ejectionPort', 'muzzleFlash', 'scopeCamera'],
    requiredSockets: ['muzzle', 'gripRight', 'gripLeft', 'magazine', 'ejectionPort'],
    clips: ['idle', 'fire', 'reload', 'ads', 'inspect'],
    fallback: 'weapon.procedural.rifle',
    source: 'authored-glb',
    normalizedOffline: true
  },
  handsViewmodel: {
    id: 'viewmodel.example.hands',
    kind: 'viewmodel',
    src: 'assets/viewmodels/example_hands.glb',
    requiredBones: ['cameraRoot', 'wrist_r', 'palm_r', 'wrist_l', 'palm_l', 'weapon_socket'],
    clips: ['idle', 'walkSway', 'sprint', 'ads', 'reloadRifle', 'inspect'],
    fallback: 'viewmodel.procedural.hands',
    normalizedOffline: true
  },
  humanoidCharacter: {
    id: 'character.example.humanoid',
    kind: 'character',
    type: 'soldier',
    src: 'assets/characters/example_soldier.glb',
    skeletonType: 'humanoid',
    retargetProfile: 'project.shared-humanoid.v1',
    requiredBones: ['root', 'pelvis', 'chest', 'head', 'weapon_grip'],
    fallback: 'enemy.procedural.archetype',
    normalizedOffline: true
  },
  mixamoAnimationSet: {
    id: 'animation.example.mixamo',
    kind: 'animation-set',
    source: 'mixamo-import',
    skeletonType: 'humanoid',
    retargetProfile: 'project.shared-humanoid.v1',
    clips: SEMANTIC_MIXAMO_CLIPS.slice(),
    fallback: 'animation.procedural.humanoid',
    rootMotionPolicy: 'ignore',
    normalizedOffline: true
  },
  meshyProp: {
    id: 'asset.meshy.example-prop',
    kind: 'external-import',
    source: 'meshy',
    src: 'assets/imports/meshy/example_prop.glb',
    fallback: 'environment.procedural.prop',
    normalizedOffline: true,
    scalePolicy: 'meters-applied-scale-1'
  },
  marketplaceStaticProp: {
    id: 'model.marketplace.example-prop',
    kind: 'environment-kit',
    source: 'marketplace',
    src: 'assets/imports/marketplace/example_prop.glb',
    fallback: 'environment.procedural.prop',
    normalizedOffline: true,
    collisionPolicy: 'decorative-or-authored-aabb'
  }
});

export const IMPORT_HANDOFF_CHECKLIST = Object.freeze([
  'Apply object and armature scale to 1.0 in meters.',
  'Normalize forward/up axes to the project contract.',
  'Keep a clean root transform and no runtime scale hacks.',
  'Validate GLB/GLTF with gltf-validator.',
  'Run glTF Transform cleanup before committing the asset.',
  'Add a stable manifest/profile ID; never store runtime object references in levels.',
  'Map weapon sockets, character bones, and Mixamo clips to semantic names.',
  'Keep materials, textures, triangles, and LOD/fallbacks inside budget.',
  'Run asset preflight and confirm editor preview/health warnings are authoring-only.',
  'Keep imported animation playback, IK, BVH, and retargeting behind guarded flags until validated.'
]);

function arrayValue(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function entrySourceText(entry = {}, fallback = '') {
  return [
    fallback,
    entry.id,
    entry.src,
    entry.source,
    entry.importSource,
    entry.provider
  ].filter(Boolean).join(' ').toLowerCase();
}

export function inferAssetSourceKind(idOrPath = '', entry = {}) {
  const text = entrySourceText(entry, idOrPath);
  if (text.includes('mixamo')) return 'mixamo';
  if (text.includes('meshy')) return 'meshy';
  if (text.includes('marketplace') || text.includes('fab.') || text.includes('sketchfab')) return 'marketplace';
  if (text.endsWith('.glb') || text.endsWith('.gltf') || text.includes('.glb ') || text.includes('.gltf ')) return 'gltf';
  if (entry.src) return 'authored-gltf';
  if (entry.id && String(entry.id).startsWith('asset.')) return 'external-import';
  return 'manifest';
}

export function findManifestEntry(manifests = {}, id = '') {
  if (!id) return { entry: null, bucket: null };
  for (const [bucket, manifest] of Object.entries(manifests || {})) {
    if (manifest && manifest[id]) return { entry: manifest[id], bucket };
  }
  return { entry: null, bucket: null };
}

function requiredSocketsForEntry(entry) {
  if (!entry || typeof entry !== 'object') return [];
  if (entry.kind === 'weapon') {
    const profile = getWeaponAnimationProfile(entry.type);
    return unique([
      ...arrayValue(entry.requiredSockets),
      ...arrayValue(profile.requiredSockets)
    ]);
  }
  return unique([
    ...arrayValue(entry.requiredSockets),
    ...arrayValue(entry.requiredBones),
    ...arrayValue(entry.gripValidationSockets)
  ]);
}

function socketPreviewForEntry(entry) {
  const available = unique([
    ...arrayValue(entry?.sockets),
    ...arrayValue(entry?.skeleton),
    ...arrayValue(entry?.requiredBones),
    ...arrayValue(entry?.gripValidationSockets)
  ]);
  const required = requiredSocketsForEntry(entry);
  const optional = available.filter((socket) => !required.includes(socket));
  const missingRequired = required.filter((socket) => !available.includes(socket));
  const markers = unique([...required, ...optional]).slice(0, 16).map((id, index) => ({
    id,
    required: required.includes(id),
    available: available.includes(id),
    order: index
  }));
  return { available, required, optional, missingRequired, markers };
}

function resolvePreviewClip(clips, state) {
  const clipSet = new Set(arrayValue(clips));
  const aliases = PREVIEW_CLIP_ALIASES[state] || [state];
  return aliases.find((name) => clipSet.has(name)) || null;
}

function animationPreviewForEntry(entry) {
  const clips = arrayValue(entry?.clips);
  const previewStates = EDITOR_ANIMATION_PREVIEW_STATES.map((state) => {
    const clip = resolvePreviewClip(clips, state);
    return {
      state,
      clip,
      available: !!clip,
      fallback: clip ? null : (entry?.fallback || 'procedural-fallback')
    };
  });
  const missingSemantic = entry?.kind === 'animation-set'
    ? SEMANTIC_MIXAMO_CLIPS.filter((clip) => !clips.includes(clip))
    : [];
  return {
    clips,
    clipCount: clips.length,
    previewStates,
    availablePreviewStates: previewStates.filter((row) => row.available).length,
    missingSemantic
  };
}

function requiresSemanticClips(entry, options = {}) {
  if (options.requireMixamoSemanticClips) return true;
  const source = inferAssetSourceKind(entry?.id || '', entry);
  return entry?.kind === 'animation-set' && source === 'mixamo';
}

export function assetImportChecklist(entryOrRef, options = {}) {
  const entry = typeof entryOrRef === 'string'
    ? { id: entryOrRef, kind: 'external-import', src: entryOrRef, fallback: 'runtime.safe-default' }
    : (entryOrRef || {});
  const preflight = preflightManifestEntry(entry, options);
  const sourceKind = inferAssetSourceKind(entry.id || entry.src || '', entry);
  const hasSource = !!entry.src || ['external-import', 'gltf', 'meshy', 'mixamo', 'marketplace'].includes(sourceKind);
  const normalizedScale = (entry.objectScale == null || Math.abs(Number(entry.objectScale) - 1) <= 0.0001)
    && (entry.armatureScale == null || Math.abs(Number(entry.armatureScale) - 1) <= 0.0001)
    && (!entry.scaleFix || !String(entry.scaleFix).includes('preciseBox3'));
  const hasManifestBinding = !!entry.id && !!entry.kind;
  const hasRuntimeFallback = !!entry.fallback;
  const hasGraphSurface = ['weapon', 'character', 'viewmodel', 'viewmodel-proxy', 'animation-set', 'external-import'].includes(entry.kind);

  const stateByStage = {
    sourceImport: {
      status: hasSource ? 'ready' : 'fallback',
      ok: true,
      detail: hasSource ? sourceKind : 'procedural fallback has no authored source yet'
    },
    gltfValidator: {
      status: hasSource ? 'pending-offline' : 'not-applicable',
      ok: true,
      detail: hasSource ? 'run scripts/asset-preflight.mjs or gltf-validator before binding' : 'procedural fallback'
    },
    gltfTransformCleanup: {
      status: normalizedScale ? 'ready' : 'needs-cleanup',
      ok: normalizedScale,
      detail: normalizedScale ? 'scale/armature policy satisfied' : 'normalize transforms offline before runtime use'
    },
    projectPreflight: {
      status: preflight.ok ? 'ready' : 'blocked',
      ok: preflight.ok,
      detail: preflight.ok ? 'manifest metadata passes project contract' : preflight.issues.map((i) => i.code).join(', ')
    },
    manifestProfile: {
      status: hasManifestBinding ? 'ready' : 'missing',
      ok: hasManifestBinding,
      detail: hasManifestBinding ? `${entry.id}:${entry.kind}` : 'stable id/kind required'
    },
    runtimeLoad: {
      status: hasRuntimeFallback ? (entry.src ? 'authored-or-fallback' : 'fallback-ready') : 'missing-fallback',
      ok: hasRuntimeFallback,
      detail: hasRuntimeFallback ? entry.fallback : 'runtime fallback is required'
    },
    graphBinding: {
      status: hasGraphSurface ? 'ready' : 'not-bound',
      ok: true,
      detail: hasGraphSurface ? 'safe to resolve through animation/model profile IDs' : 'static asset, no animation graph binding'
    },
    editorAvailability: {
      status: 'ready',
      ok: true,
      detail: 'editor stores stable IDs and runtime resolves defensively'
    }
  };

  return ASSET_IMPORT_STAGES.map((stage) => ({
    ...stage,
    ...(stateByStage[stage.id] || { status: 'unknown', ok: false, detail: 'stage not implemented' })
  }));
}

export function validateProfileId(value, prefix = '') {
  if (value == null || value === '') return { ok: true, id: null, optional: true };
  const id = String(value);
  const ok = /^[a-z0-9_.:-]+$/i.test(id) && (!prefix || id.startsWith(prefix));
  return { ok, id, optional: false, reason: ok ? null : 'profile-id-format' };
}

export function preflightManifestEntry(entry, options = {}) {
  const issues = [];
  const warnings = [];
  if (!entry || typeof entry !== 'object') {
    return { ok: false, issues: [{ code: 'missing-entry', level: 'error' }], warnings: [], summary: null };
  }
  if (!entry.id) issues.push({ code: 'missing-id', level: 'error' });
  if (!entry.kind) issues.push({ code: 'missing-kind', level: 'error' });
  if (!entry.fallback) warnings.push({ code: 'missing-fallback', level: 'warning' });

  if (entry.scaleFix && String(entry.scaleFix).includes('preciseBox3')) {
    issues.push({ code: 'meshy-precise-box3-scale-risk', level: 'error' });
  }
  if (entry.armatureScale != null && Math.abs(Number(entry.armatureScale) - 1) > 0.0001) {
    warnings.push({ code: 'armature-scale-not-applied', level: 'warning', value: Number(entry.armatureScale) });
  }
  if (entry.objectScale != null && Math.abs(Number(entry.objectScale) - 1) > 0.0001) {
    warnings.push({ code: 'object-scale-not-applied', level: 'warning', value: Number(entry.objectScale) });
  }

  if (entry.kind === 'weapon') {
    const sockets = Array.isArray(entry.sockets) ? entry.sockets : [];
    for (const socket of requiredSocketsForEntry(entry)) {
      if (!sockets.includes(socket)) warnings.push({ code: `missing-profile-socket:${socket}`, level: 'warning' });
    }
  }

  if (entry.kind === 'animation-set') {
    const clips = Array.isArray(entry.clips) ? entry.clips : [];
    if (requiresSemanticClips(entry, options)) {
      for (const clip of SEMANTIC_MIXAMO_CLIPS) {
        if (!clips.includes(clip)) warnings.push({ code: `missing-semantic-clip:${clip}`, level: 'warning' });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    summary: {
      id: entry.id || null,
      kind: entry.kind || null,
      src: entry.src || null,
      fallback: entry.fallback || null,
      contract: CANONICAL_ASSET_CONTRACT.runtimePolicy
    }
  };
}

export function buildAssetPipelineReport(manifests = {}, options = {}) {
  const rows = [];
  let errors = 0;
  let warnings = 0;
  for (const [kind, manifest] of Object.entries(manifests || {})) {
    for (const entry of Object.values(manifest || {})) {
      const out = preflightManifestEntry(entry, options);
      errors += out.issues.length;
      warnings += out.warnings.length;
      rows.push({ kind, id: entry && entry.id, ok: out.ok, issues: out.issues, warnings: out.warnings });
    }
  }
  return {
    version: IMPORT_PIPELINE_VERSION,
    ok: errors === 0,
    errors,
    warnings,
    tooling: TOOLING_CAPABILITIES,
    contract: CANONICAL_ASSET_CONTRACT,
    importStages: ASSET_IMPORT_STAGES,
    editorPreviewStates: EDITOR_ANIMATION_PREVIEW_STATES,
    handoff: buildImportHandoffGuide(),
    rows
  };
}

export function buildImportHandoffGuide() {
  return {
    version: IMPORT_PIPELINE_VERSION,
    contract: CANONICAL_ASSET_CONTRACT,
    importStages: ASSET_IMPORT_STAGES,
    checklist: IMPORT_HANDOFF_CHECKLIST.slice(),
    templates: Object.fromEntries(
      Object.entries(IMPORT_PROFILE_TEMPLATES).map(([key, value]) => [key, { ...value }])
    ),
    guardedRuntimeFlags: ['importedAnimationEnabled', 'limitedIKEnabled', 'bvhQueriesEnabled'],
    debugSurfaces: [
      'debug.assetPreflight(idOrPath)',
      'debug.animationHealth()',
      'debug.levelEditorAssetHealth()',
      'debug.animationProfiles()'
    ]
  };
}

export function buildEditorAssetPreview(entryOrRef, options = {}) {
  const entry = typeof entryOrRef === 'string'
    ? { id: entryOrRef, kind: 'external-import', src: entryOrRef, source: entryOrRef, fallback: 'runtime.safe-default' }
    : (entryOrRef || {});
  const preflight = preflightManifestEntry(entry, options);
  const sockets = socketPreviewForEntry(entry);
  const animation = animationPreviewForEntry(entry);
  const sourceKind = inferAssetSourceKind(entry.id || entry.src || '', entry);
  const checklist = assetImportChecklist(entry, options);
  const warnings = preflight.warnings.slice();
  if (sourceKind === 'meshy' && !entry.normalizedOffline) {
    warnings.push({ code: 'meshy-import-needs-offline-normalization', level: 'warning' });
  }
  if (sourceKind === 'mixamo' && entry.kind === 'animation-set' && animation.missingSemantic.length) {
    warnings.push({ code: 'mixamo-semantic-clips-missing', level: 'warning', missing: animation.missingSemantic.slice() });
  }
  const authored = !!entry.src;
  return {
    id: entry.id || entry.src || null,
    kind: entry.kind || 'external-import',
    label: entry.label || entry.id || entry.src || 'External asset',
    sourceKind,
    authored,
    runtimeStatus: authored ? 'authored-or-fallback' : 'procedural-fallback',
    fallback: entry.fallback || null,
    ok: preflight.ok && checklist.every((stage) => stage.ok !== false),
    issues: preflight.issues.slice(),
    warnings,
    preflight,
    sockets,
    animation,
    importChecklist: checklist,
    handoffChecklist: IMPORT_HANDOFF_CHECKLIST.slice(),
    editor: {
      available: true,
      storesStableId: !!entry.id,
      previewModes: EDITOR_ANIMATION_PREVIEW_STATES.slice(),
      socketMarkerCount: sockets.markers.length,
      validationRequiredForBoot: false
    }
  };
}

export function validateLevelEditorAssetRefs(mapOrPack, manifests = {}, options = {}) {
  const summary = summarizeLevelEditorAssetRefs(mapOrPack);
  const errors = [];
  const warnings = [];
  const resolvedRefs = [];

  for (const [bucket, contract] of Object.entries(LEVEL_EDITOR_REF_CONTRACTS)) {
    for (const id of summary.refs[bucket] || []) {
      const idCheck = validateProfileId(id, contract.prefix);
      if (!idCheck.ok) {
        errors.push({ code: 'invalid-profile-id', bucket, id, reason: idCheck.reason });
        continue;
      }
      if (contract.external) {
        const sourceKind = inferAssetSourceKind(id, { id, source: id });
        warnings.push({ code: 'external-import-needs-preflight', bucket, id, sourceKind, authoringOnly: true, blocksRuntime: false });
        resolvedRefs.push({ bucket, id, sourceKind, entry: null, manifestBucket: null, external: true });
        continue;
      }

      const resolved = findManifestEntry(manifests, id);
      const allowedBucket = !resolved.bucket || !contract.buckets.length || contract.buckets.includes(resolved.bucket);
      if (!resolved.entry || !allowedBucket) {
        const row = {
          code: contract.strict ? 'missing-required-profile' : 'unregistered-optional-profile',
          bucket,
          id,
          expectedBuckets: contract.buckets.slice(),
          authoringOnly: !contract.strict,
          blocksRuntime: false
        };
        if (contract.strict) errors.push(row);
        else warnings.push(row);
        resolvedRefs.push({ bucket, id, entry: null, manifestBucket: null, external: false });
        continue;
      }
      resolvedRefs.push({ bucket, id, entry: resolved.entry, manifestBucket: resolved.bucket, external: false });
    }
  }

  return {
    ok: errors.length === 0,
    summary,
    errors,
    warnings,
    resolvedRefs,
    contracts: LEVEL_EDITOR_REF_CONTRACTS
  };
}

export function buildLevelEditorAssetHealth(mapOrPack, manifests = {}, options = {}) {
  const validation = validateLevelEditorAssetRefs(mapOrPack, manifests, options);
  const previews = [];
  for (const ref of validation.resolvedRefs) {
    if (ref.entry) {
      previews.push({
        bucket: ref.bucket,
        id: ref.id,
        manifestBucket: ref.manifestBucket,
        preview: buildEditorAssetPreview(ref.entry, options)
      });
    } else if (ref.external) {
      previews.push({
        bucket: ref.bucket,
        id: ref.id,
        manifestBucket: null,
        preview: buildEditorAssetPreview({
          id: ref.id,
          kind: 'external-import',
          source: ref.sourceKind,
          src: null,
          fallback: 'runtime.safe-default'
        }, options)
      });
    }
  }

  return {
    version: IMPORT_PIPELINE_VERSION,
    ok: validation.ok,
    editorReady: options.editorReady !== false,
    editorOpen: !!options.editorOpen,
    summary: validation.summary,
    errors: validation.errors,
    warnings: validation.warnings,
    warningDisposition: validation.warnings.map((row) => ({
      code: row.code,
      bucket: row.bucket || null,
      id: row.id || null,
      authoringOnly: row.authoringOnly !== false,
      blocksRuntime: !!row.blocksRuntime
    })),
    errorDisposition: validation.errors.map((row) => ({
      code: row.code,
      bucket: row.bucket || null,
      id: row.id || null,
      authoringOnly: row.authoringOnly !== false,
      blocksRuntime: !!row.blocksRuntime
    })),
    resolvedRefs: validation.resolvedRefs.map((ref) => ({
      bucket: ref.bucket,
      id: ref.id,
      manifestBucket: ref.manifestBucket,
      external: !!ref.external,
      resolved: !!ref.entry
    })),
    previews,
    contract: CANONICAL_ASSET_CONTRACT,
    importStages: ASSET_IMPORT_STAGES,
    editorPreviewStates: EDITOR_ANIMATION_PREVIEW_STATES,
    handoff: buildImportHandoffGuide(),
    compatibility: {
      profileFieldsOptional: true,
      storesStableProfileIds: true,
      oldLevelsFallbackToDefaults: true,
      editorValidationNotRequiredForBoot: true,
      runtimeHandlesMissingAssetsDefensively: true
    }
  };
}

export function summarizeLevelEditorAssetRefs(mapOrPack) {
  const maps = Array.isArray(mapOrPack?.maps) ? mapOrPack.maps : (mapOrPack ? [mapOrPack] : []);
  const refs = {
    weaponProfiles: new Set(),
    enemyProfiles: new Set(),
    visualProfiles: new Set(),
    modelProfiles: new Set(),
    animationProfiles: new Set(),
    importedAssets: new Set()
  };
  let objectCount = 0;
  let enemyCount = 0;
  for (const map of maps) {
    for (const obj of Array.isArray(map?.objects) ? map.objects : []) {
      objectCount++;
      if (obj.weaponProfileId) refs.weaponProfiles.add(obj.weaponProfileId);
      if (obj.visualProfileId) refs.visualProfiles.add(obj.visualProfileId);
      if (obj.modelProfileId) refs.modelProfiles.add(obj.modelProfileId);
      if (obj.animationProfileId) refs.animationProfiles.add(obj.animationProfileId);
      if (obj.importedAssetId) refs.importedAssets.add(obj.importedAssetId);
    }
    const enemies = map?.markers && Array.isArray(map.markers.enemySpawns) ? map.markers.enemySpawns : [];
    for (const enemy of enemies) {
      enemyCount++;
      if (enemy.enemyAnimationProfileId) refs.enemyProfiles.add(enemy.enemyAnimationProfileId);
      if (enemy.weaponProfileId) refs.weaponProfiles.add(enemy.weaponProfileId);
      if (enemy.visualProfileId) refs.visualProfiles.add(enemy.visualProfileId);
      if (enemy.enemyModelProfileId) refs.modelProfiles.add(enemy.enemyModelProfileId);
      if (enemy.animationProfileId) refs.animationProfiles.add(enemy.animationProfileId);
      if (enemy.importedAssetId) refs.importedAssets.add(enemy.importedAssetId);
    }
  }
  return {
    maps: maps.length,
    objectCount,
    enemyCount,
    refs: Object.fromEntries(Object.entries(refs).map(([key, set]) => [key, Array.from(set).sort()]))
  };
}
