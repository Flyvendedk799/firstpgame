#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { prune, dedup, weld } from '@gltf-transform/functions';
import * as gltfValidator from 'gltf-validator';
import * as maath from 'maath';
import * as bvh from 'three-mesh-bvh';
import {
  ALL_MANIFESTS,
  ANIMATION_MANIFEST,
  WEAPON_MANIFEST,
  validateAllManifests
} from '../src/assetManifest.js';
import {
  ANIMATION_PIPELINE_VERSION,
  TOOLING_CAPABILITIES,
  SEMANTIC_MIXAMO_CLIPS,
  animationTuningDebug,
  animationFeatureFlags,
  getEnemyFeelTuning,
  getHandFeelTuning,
  getLocomotionFeelTuning,
  getWeaponAnimationProfile,
  getWeaponFeelTuning
} from '../src/animation/profiles.js';
import { createAnimationGraphState, updateAnimationGraphState, animationGraphDebug } from '../src/animation/graph.js';
import { createWeaponAnimationController, updateWeaponAnimationController, weaponAnimationDebug } from '../src/animation/weaponAnimationController.js';
import { createHandGripState, updateHandGripState, handGripDebug, getHandGripProfile } from '../src/animation/handGripController.js';
import { createLocomotionFeelState, updateLocomotionFeelState, applyLocomotionFeelToPlayerAnim, locomotionFeelDebug } from '../src/animation/locomotionFeelController.js';
import { buildSemanticClipBinding, resolveImportedClipPlan } from '../src/animation/importedClipController.js';
import { resolveEnemyAnimationStatus } from '../src/animation/enemyAnimationController.js';
import { buildAnimationHealthReport } from '../src/animation/health.js';
import {
  ASSET_IMPORT_STAGES,
  IMPORT_HANDOFF_CHECKLIST,
  IMPORT_PROFILE_TEMPLATES,
  buildAssetPipelineReport,
  buildEditorAssetPreview,
  buildImportHandoffGuide,
  buildLevelEditorAssetHealth,
  preflightManifestEntry,
  summarizeLevelEditorAssetRefs,
  validateLevelEditorAssetRefs
} from '../src/animation/assetPipeline.js';
import { normalizeCustomMapPack, normalizePlacedObject } from '../src/customMaps/schema.js';

assert.equal(ANIMATION_PIPELINE_VERSION, 1);
assert.equal(typeof NodeIO, 'function', 'glTF Transform NodeIO should be importable');
assert.equal(typeof Document, 'function', 'glTF Transform Document should be importable');
assert.equal(typeof prune, 'function', 'glTF Transform prune should be importable');
assert.equal(typeof dedup, 'function', 'glTF Transform dedup should be importable');
assert.equal(typeof weld, 'function', 'glTF Transform weld should be importable');
assert.equal(typeof gltfValidator.validateBytes, 'function', 'Khronos glTF validator should be importable');
assert.ok(maath.easing, 'maath easing namespace should be available');
assert.equal(typeof bvh.acceleratedRaycast, 'function', 'three-mesh-bvh accelerated raycast should be importable');

const flags = animationFeatureFlags({
  weaponGraphEnabled: false,
  bvhQueriesEnabled: true
});
assert.equal(flags.animationGraphEnabled, true);
assert.equal(flags.weaponGraphEnabled, false);
assert.equal(flags.importedAnimationEnabled, false, 'imported animation playback should be guarded by default');
assert.equal(flags.bvhQueriesEnabled, true);
const tuningDebug = animationTuningDebug();
assert.equal(tuningDebug.id, 'aaa-final-v1');
assert.ok(tuningDebug.policy.gameplayAuthorityLocked.includes('damage'));
assert.ok(tuningDebug.policy.safeToTune.includes('weapon visual pose'));

const rifle = getWeaponAnimationProfile(0);
const pistol = getWeaponAnimationProfile('usp-t');
assert.equal(rifle.type, 'rifle');
assert.equal(pistol.type, 'pistol');
assert.ok(pistol.movingParts.includes('slide'));
assert.equal(getHandGripProfile('shotgun').id, 'hands.shotgun.pump');
assert.ok(getWeaponFeelTuning('shotgun').pump > getWeaponFeelTuning('rifle').pump, 'shotgun should get stronger pump visual tuning');
assert.ok(getHandFeelTuning('sniper').mechanicalPart > getHandFeelTuning('rifle').mechanicalPart, 'sniper should get stronger bolt hand tuning');
assert.ok(getLocomotionFeelTuning().impactWeight > 1, 'final locomotion tuning should amplify impact readability');
assert.ok(getEnemyFeelTuning('scout').peekLead > 1, 'enemy tuning should improve readable intent');

const graph = createAnimationGraphState({ settings: flags });
updateAnimationGraphState(graph, {
  frame: 12,
  settings: flags,
  movement: { speed: 4.2, sprint: 1, forward: 1 },
  weaponIdx: 1,
  ads: 0,
  sprint: 1,
  notifies: [{ name: 'footstepLeft', frame: 12 }]
});
const graphDebug = animationGraphDebug(graph);
assert.equal(graphDebug.activeStates.locomotion, 'sprint');
assert.equal(graphDebug.activeStates.weapon, 'sprintLow');
assert.equal(graphDebug.channels.ok, true);

const weapon = createWeaponAnimationController();
updateWeaponAnimationController(weapon, {
  dt: 1 / 60,
  weaponIdx: 1,
  ads: 0,
  sprint: 0,
  shotImpulse: 1,
  dryFire: 0,
  hasAuthoredParts: false,
  notifies: [{ name: 'muzzleFlash' }]
});
const weaponDebug = weaponAnimationDebug(weapon);
assert.equal(weaponDebug.weaponType, 'pistol');
assert.equal(weaponDebug.tuningId, 'weapon-feel.pistol');
assert.equal(weaponDebug.state, 'fire');
assert.ok(weaponDebug.partMotion.slide > 0, 'pistol fire should drive slide part motion');
assert.ok(weaponDebug.fallbackReasons.includes('procedural-weapon-parts'));
assert.equal(Object.hasOwn(weaponDebug, 'ammo'), false, 'weapon visual debug must not own gameplay ammo truth');
assert.equal(Object.hasOwn(weaponDebug, 'damage'), false, 'weapon visual debug must not own gameplay damage truth');

const shotgun = createWeaponAnimationController();
updateWeaponAnimationController(shotgun, {
  dt: 1 / 60,
  weaponIdx: 3,
  shotImpulse: 1,
  hasAuthoredParts: false
});
assert.ok(shotgun.partMotion.pump > 0, 'shotgun fire should drive pump motion');
assert.ok(shotgun.partMotion.trigger > 0, 'shotgun fire should drive trigger motion');

const sniper = createWeaponAnimationController();
updateWeaponAnimationController(sniper, {
  dt: 1 / 60,
  weaponIdx: 7,
  shotImpulse: 1,
  hasAuthoredParts: false
});
assert.ok(sniper.partMotion.bolt > 0, 'sniper fire should drive bolt motion');

const rifleReload = createWeaponAnimationController();
updateWeaponAnimationController(rifleReload, {
  dt: 1 / 60,
  weaponIdx: 0,
  reloading: true,
  reloadProgress: 0.9,
  hasAuthoredParts: true
});
assert.ok(rifleReload.partMotion.magazine > 0, 'reload should drive magazine motion');
assert.ok(rifleReload.partMotion.chamber > 0, 'late reload should drive chamber motion');
assert.equal(rifleReload.fallbackReasons.length, 0, 'authored part support should not report procedural fallback');

const handGrip = createHandGripState();
updateHandGripState(handGrip, {
  dt: 1 / 60,
  weaponIdx: 0,
  ads: 0.82,
  sprint: 0,
  reloading: true,
  reloadProgress: 0.5,
  partMotion: rifleReload.partMotion,
  hasAuthoredWeaponParts: true,
  limitedIKEnabled: true,
  socketReadiness: {
    ok: true,
    ready: 3,
    total: 3,
    sockets: { gripRight: true, gripLeft: true, magazine: true },
    missing: []
  },
  availableSockets: ['gripRight', 'gripLeft', 'magazine']
});
const handGripReport = handGripDebug(handGrip);
assert.equal(handGripReport.weaponType, 'rifle');
assert.equal(handGripReport.tuningId, 'hand-feel.rifle');
assert.equal(handGripReport.ik.active, true, 'complete authored sockets should be IK-ready');
assert.ok(handGripReport.offsets.left.z !== 0, 'reload/support state should move support hand');
assert.ok(handGripReport.fingers.gripCurl > 0, 'grip controller should contribute finger curl');

const missingSocketGrip = createHandGripState();
updateHandGripState(missingSocketGrip, {
  dt: 1 / 60,
  weaponIdx: 7,
  partMotion: sniper.partMotion,
  hasAuthoredWeaponParts: true,
  limitedIKEnabled: true,
  availableSockets: ['gripRight']
});
const missingSocketGripReport = handGripDebug(missingSocketGrip);
assert.equal(missingSocketGripReport.ik.active, false);
assert.ok(missingSocketGripReport.fallbackReasons.some((reason) => reason.startsWith('ik-disabled-missing-sockets')));

const locomotionFeel = createLocomotionFeelState({ slot: 0 });
const fakePlayerAnim = {
  inputs: {
    moving: true,
    speed: 0.86,
    intentR: 1,
    intentF: 1,
    grounded: true,
    ads: 0.12,
    sprintAmt: 0.9,
    slideAmt: 0,
    moveAccel: 16,
    counterStrafePulse: 0.72,
    turnDriveSide: -1,
    vaulting: false,
    dropkick: false,
    vy: 0,
    weaponIdx: 0
  },
  smoothed: {
    footPhase: Math.PI * 1.28,
    velLX: 0.34,
    velLZ: 0.82,
    accel: 12,
    sprintStartEnv: 0.85,
    sprintStopEnv: 0,
    footPlantPulse: 0.52,
    footPlantRecover: 0.22,
    toeOffPulse: 0.18,
    turnPlantPulse: 0.58,
    pivotSide: -1,
    footPlantSide: 1,
    wallJumpEnv: 0,
    dropkickEnv: 0,
    dropkickLandEnv: 0,
    slideSide: 0,
    slideForward: 1
  },
  layerWeights: {
    locomotion: { idle: 0, walk: 0.1, sprint: 0.82, crouch: 0, slide: 0, jump: 0, fall: 0, land: 0, wallJump: 0, dropkick: 0 },
    interaction: { vault: 0 }
  },
  resolved: { camera: {}, viewmodel: {}, proxy: {} }
};
updateLocomotionFeelState(locomotionFeel, {
  enabled: true,
  playerAnimation: fakePlayerAnim,
  dt: 1 / 60,
  now: 12,
  slot: 0
});
const locomotionFeelReport = locomotionFeelDebug(locomotionFeel);
assert.equal(locomotionFeelReport.mode, 'sprint');
assert.equal(locomotionFeelReport.tuningId, 'locomotion-feel.aaa-final');
assert.ok(Math.abs(locomotionFeelReport.additive.camera.headRoll) > 0, 'sprint/counter-strafe should add camera roll');
assert.ok(locomotionFeelReport.additive.viewmodel.sprintStartKick > 0, 'sprint start should add viewmodel kick');
assert.ok(locomotionFeelReport.additive.proxy.sprintPose > 0, 'sprint should add proxy pose');
const preHeadRoll = fakePlayerAnim.resolved.camera.headRoll || 0;
assert.equal(applyLocomotionFeelToPlayerAnim(fakePlayerAnim, locomotionFeel), true);
assert.notEqual(fakePlayerAnim.resolved.camera.headRoll, preHeadRoll, 'locomotion feel should apply additively to resolved camera');

const slideFeel = createLocomotionFeelState({ slot: 0 });
fakePlayerAnim.inputs.slideAmt = 0.8;
fakePlayerAnim.inputs.sprintAmt = 0;
fakePlayerAnim.inputs.vaulting = true;
fakePlayerAnim.inputs.vaultT = 0.38;
fakePlayerAnim.inputs.vaultDir = 'right';
fakePlayerAnim.smoothed.slideSide = 0.7;
fakePlayerAnim.smoothed.slideForward = 1;
fakePlayerAnim.layerWeights.locomotion = { idle: 0, walk: 0, sprint: 0, crouch: 0, slide: 0.8, jump: 0, fall: 0, land: 0, wallJump: 0, dropkick: 0 };
fakePlayerAnim.layerWeights.interaction = { vault: 1 };
updateLocomotionFeelState(slideFeel, {
  enabled: true,
  playerAnimation: fakePlayerAnim,
  dt: 1 / 60,
  now: 12.05,
  slot: 0
});
const slideFeelReport = locomotionFeelDebug(slideFeel);
assert.equal(slideFeelReport.mode, 'vault');
assert.ok(slideFeelReport.additive.camera.slideDrop < 0, 'slide should lower camera');
assert.ok(slideFeelReport.vault > 0, 'vault phase should feed locomotion feel');

const legacySoldierActions = {
  Idle: {},
  Walking: {},
  Running: {},
  Reload: {},
  Fire: {},
  FlinchLeg: {},
  Dead: {}
};
const legacyBinding = buildSemanticClipBinding({ id: 'soldier.actions', actions: legacySoldierActions });
assert.equal(legacyBinding.map.idle, 'Idle');
assert.equal(legacyBinding.map.walk, 'Walking');
assert.equal(legacyBinding.map.run, 'Running');
assert.equal(legacyBinding.map.hitLeg, 'FlinchLeg');

const importedFlankPlan = resolveImportedClipPlan({
  status: { state: 'flank', intent: 'flank', speed: 4.2, assetProfiles: { animation: 'animation.mixamo.humanoid' } },
  enemy: { actions: legacySoldierActions },
  manifestEntry: { id: 'soldier.actions', actions: legacySoldierActions, fallback: 'animation.procedural.enemy' },
  importedAnimationEnabled: true
});
assert.equal(importedFlankPlan.base.clip, 'Running');
assert.equal(importedFlankPlan.base.playback, 'loop');
assert.equal(importedFlankPlan.fallbackReasons.length, 0);

const guardedImportedPlan = resolveImportedClipPlan({
  status: { state: 'flank', intent: 'flank', speed: 4.2, assetProfiles: { animation: 'animation.mixamo.humanoid' } },
  enemy: { actions: legacySoldierActions },
  manifestEntry: { id: 'soldier.actions', actions: legacySoldierActions, fallback: 'animation.procedural.enemy' }
});
assert.equal(guardedImportedPlan.enabled, false);
assert.ok(guardedImportedPlan.fallbackReasons.includes('imported-animation-disabled'));

const importedReloadPlan = resolveImportedClipPlan({
  status: { state: 'reload', intent: 'reload', speed: 0, assetProfiles: { animation: 'animation.mixamo.humanoid' } },
  enemy: { actions: legacySoldierActions },
  manifestEntry: { id: 'soldier.actions', actions: legacySoldierActions, fallback: 'animation.procedural.enemy' },
  importedAnimationEnabled: true
});
assert.equal(importedReloadPlan.base.clip, 'Reload');
assert.equal(importedReloadPlan.upper.clip, 'Reload');

const enemyStatus = resolveEnemyAnimationStatus({
  type: 'scout',
  animationState: 'peek',
  _movementMode: 'flank',
  _moveVelX: 2,
  _moveVelZ: 1,
  aimReady: 0.8,
  peekAmt: 0.7,
  weaponProfileId: 'weapon.rifle',
  animationProfileId: 'animation.mixamo.humanoid',
  importedAssetId: 'asset.meshy.scout'
});
assert.equal(enemyStatus.intent, 'peek');
assert.equal(enemyStatus.readability.tuningId, 'enemy-feel.scout');
assert.ok(enemyStatus.intentCue.headLead > 0, 'enemy peek should produce a head-lead intent cue');
assert.ok(enemyStatus.intentCue.weaponRaise > 0, 'enemy aim should produce a weapon-raise intent cue');
assert.equal(enemyStatus.assetProfiles.animation, 'animation.mixamo.humanoid');
assert.equal(enemyStatus.clipPlan.enabled, false, 'enemy imported clips should be guarded unless explicitly enabled');
assert.equal(enemyStatus.clipPlan.base.semantic, 'walk');
assert.equal(enemyStatus.clipPlan.base.clip, 'walk');

const enemyHitStatus = resolveEnemyAnimationStatus({
  type: 'heavy',
  animationState: 'hit-body',
  _lastHitLimbId: 'leftShin',
  _hitImpactStrength: 1.4,
  actions: legacySoldierActions,
  animationProfileId: 'animation.mixamo.humanoid'
});
assert.equal(enemyHitStatus.intent, 'hit');
assert.equal(enemyHitStatus.hitZone, 'leg');
assert.equal(enemyHitStatus.clipPlan.base.clip, 'FlinchLeg');
assert.ok(enemyHitStatus.intentCue.hitReact > 0, 'enemy hit should produce hit-react cue');

const enemyDeathStatus = resolveEnemyAnimationStatus({
  type: 'soldier',
  dead: true,
  _deathByDropkick: true,
  actions: legacySoldierActions,
  animationProfileId: 'animation.mixamo.humanoid'
});
assert.equal(enemyDeathStatus.intent, 'death');
assert.equal(enemyDeathStatus.deathVariant, 'deathBack');
assert.equal(enemyDeathStatus.clipPlan.base.clip, 'Dead');

const manifestValidation = validateAllManifests();
assert.equal(manifestValidation.ok, true);

const pipeline = buildAssetPipelineReport(ALL_MANIFESTS);
assert.equal(pipeline.ok, true);
assert.ok(pipeline.tooling.offline.includes('@gltf-transform/cli'));
assert.ok(pipeline.importStages.some((stage) => stage.id === 'editorAvailability'));
assert.ok(pipeline.handoff.checklist.length >= IMPORT_HANDOFF_CHECKLIST.length);
assert.ok(TOOLING_CAPABILITIES.runtime.includes('three.CCDIKSolver'));
const handoff = buildImportHandoffGuide();
assert.ok(handoff.guardedRuntimeFlags.includes('limitedIKEnabled'));
assert.ok(IMPORT_PROFILE_TEMPLATES.weaponViewmodel.sockets.includes('muzzle'));
assert.ok(IMPORT_PROFILE_TEMPLATES.mixamoAnimationSet.clips.includes('deathBack'));

const riflePreflight = preflightManifestEntry(WEAPON_MANIFEST['weapon.rifle']);
assert.equal(riflePreflight.ok, true);
const riflePreview = buildEditorAssetPreview(WEAPON_MANIFEST['weapon.rifle']);
assert.equal(riflePreview.ok, true);
assert.equal(riflePreview.sockets.missingRequired.length, 0);
assert.ok(riflePreview.animation.previewStates.some((row) => row.state === 'reload' && row.available));

const mixamoPreview = buildEditorAssetPreview(ANIMATION_MANIFEST['animation.mixamo.humanoid']);
assert.equal(mixamoPreview.ok, true);
assert.equal(mixamoPreview.animation.missingSemantic.length, 0);
assert.ok(ASSET_IMPORT_STAGES.some((stage) => stage.id === 'gltfTransformCleanup'));

const mixamoSemantic = new Set(SEMANTIC_MIXAMO_CLIPS);
assert.ok(mixamoSemantic.has('fireAdditive'));
assert.ok(ANIMATION_MANIFEST['animation.viewmodel'].clips.includes('reloadRifle'));

const placed = normalizePlacedObject({
  prefabId: 'cover.half_crate',
  weaponProfileId: 'weapon.rifle',
  visualProfileId: 'env.docks',
  modelProfileId: 'model.marketplace.crate',
  animationProfileId: 'animation.viewmodel',
  importedAssetId: 'asset.meshy.crate'
});
assert.equal(placed.weaponProfileId, 'weapon.rifle');
assert.equal(placed.visualProfileId, 'env.docks');
assert.equal(placed.modelProfileId, 'model.marketplace.crate');
assert.equal(placed.animationProfileId, 'animation.viewmodel');
assert.equal(placed.importedAssetId, 'asset.meshy.crate');

const pack = normalizeCustomMapPack({
  title: 'Animation Pipeline Compatibility',
  maps: [{
    title: 'Roundtrip',
    objects: [placed],
    markers: {
      enemySpawns: [{
        id: 'enemy_1',
        x: 0,
        z: 0,
        enemyType: 'soldier',
        enemyAnimationProfileId: 'character.soldier',
        enemyModelProfileId: 'character.soldier',
        animationProfileId: 'animation.enemy'
      }]
    }
  }]
});
const editorRefs = summarizeLevelEditorAssetRefs(pack);
assert.equal(editorRefs.refs.weaponProfiles[0], 'weapon.rifle');
assert.equal(editorRefs.refs.enemyProfiles[0], 'character.soldier');
assert.ok(editorRefs.refs.visualProfiles.includes('env.docks'));
assert.ok(editorRefs.refs.modelProfiles.includes('character.soldier'));
assert.ok(editorRefs.refs.animationProfiles.includes('animation.enemy'));
const editorRefValidation = validateLevelEditorAssetRefs(pack, ALL_MANIFESTS);
assert.equal(editorRefValidation.ok, true);
assert.ok(editorRefValidation.warnings.some((w) => w.code === 'external-import-needs-preflight'));
assert.ok(editorRefValidation.warnings.some((w) => w.code === 'unregistered-optional-profile'));

const editorAssetHealth = buildLevelEditorAssetHealth(pack, ALL_MANIFESTS, { editorReady: true });
assert.equal(editorAssetHealth.ok, true);
assert.equal(editorAssetHealth.compatibility.storesStableProfileIds, true);
assert.ok(editorAssetHealth.previews.some((row) => row.id === 'weapon.rifle' && row.preview.sockets.required.includes('muzzle')));
assert.ok(editorAssetHealth.previews.some((row) => row.id === 'animation.enemy' && row.preview.animation.availablePreviewStates > 0));

const health = buildAnimationHealthReport({
  settings: flags,
  manifests: ALL_MANIFESTS,
  weaponAnimation: weaponDebug,
  handGrip: handGripReport,
  locomotionFeel: locomotionFeelReport,
  enemyAnimation: [enemyStatus, enemyHitStatus, enemyDeathStatus],
  registryPreflight: {
    validation: manifestValidation
  },
  levelEditorHealth: editorAssetHealth
});
assert.equal(health.ok, true);
assert.ok(health.warnings.some((w) => w.code === 'weapon-procedural-fallback'));
assert.equal(health.flags.importedAnimationEnabled, false);
assert.ok(health.warningDisposition.every((row) => row.blocksRuntime === false));
assert.ok(health.tuning.policy.gameplayAuthorityLocked.includes('hit detection'));

console.log(JSON.stringify({
  ok: true,
  graph: graphDebug.activeStates,
  weapon: weaponDebug,
  handGrip: handGripReport,
  locomotionFeel: locomotionFeelReport,
  manifestEntries: Object.values(ALL_MANIFESTS).reduce((sum, m) => sum + Object.keys(m).length, 0),
  editorRefs,
  editorAssetHealth: {
    ok: editorAssetHealth.ok,
    warnings: editorAssetHealth.warnings.length,
    previews: editorAssetHealth.previews.length
  },
  tooling: {
    offline: TOOLING_CAPABILITIES.offline,
    runtime: TOOLING_CAPABILITIES.runtime
  }
}, null, 2));
