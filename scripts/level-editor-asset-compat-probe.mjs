#!/usr/bin/env node
import assert from 'node:assert/strict';
import { ALL_MANIFESTS, ANIMATION_MANIFEST, WEAPON_MANIFEST } from '../src/assetManifest.js';
import {
  ASSET_IMPORT_STAGES,
  buildEditorAssetPreview,
  buildImportHandoffGuide,
  buildLevelEditorAssetHealth,
  findManifestEntry,
  validateLevelEditorAssetRefs
} from '../src/animation/assetPipeline.js';
import {
  createDefaultCustomMapPack,
  normalizeCustomMapPack,
  normalizePlacedObject
} from '../src/customMaps/schema.js';

const legacyPack = createDefaultCustomMapPack({ title: 'Legacy No Profile Fields' });
const legacyHealth = buildLevelEditorAssetHealth(legacyPack, ALL_MANIFESTS, { editorReady: true });
assert.equal(legacyHealth.ok, true);
assert.equal(legacyHealth.summary.refs.weaponProfiles.length, 0);
assert.equal(legacyHealth.compatibility.oldLevelsFallbackToDefaults, true);

const profiledObject = normalizePlacedObject({
  id: 'obj_profiled_weapon',
  prefabId: 'cover.half_crate',
  x: 1,
  z: 2,
  weaponProfileId: 'weapon.rifle',
  visualProfileId: 'env.docks',
  animationProfileId: 'animation.viewmodel',
  importedAssetId: 'asset.meshy.cover-crate'
});

const externalModelObject = normalizePlacedObject({
  id: 'obj_external_marketplace',
  prefabId: 'prop.small_table',
  x: 3,
  z: 4,
  modelProfileId: 'model.marketplace.table'
});

const profiledPack = normalizeCustomMapPack({
  title: 'Profiled Asset Compatibility',
  maps: [{
    title: 'Profiles',
    objects: [profiledObject, externalModelObject],
    markers: {
      enemySpawns: [{
        id: 'enemy_profiled',
        x: 0,
        z: 0,
        enemyType: 'soldier',
        enemyAnimationProfileId: 'character.soldier',
        enemyModelProfileId: 'character.soldier',
        animationProfileId: 'animation.mixamo.humanoid',
        weaponProfileId: 'weapon.pistol',
        importedAssetId: 'asset.mixamo.soldier-idle'
      }]
    }
  }]
});

const refValidation = validateLevelEditorAssetRefs(profiledPack, ALL_MANIFESTS);
assert.equal(refValidation.ok, true);
assert.ok(refValidation.warnings.some((row) => row.code === 'external-import-needs-preflight'));
assert.ok(refValidation.warnings.some((row) => row.code === 'unregistered-optional-profile'));

const health = buildLevelEditorAssetHealth(profiledPack, ALL_MANIFESTS, { editorReady: true, editorOpen: false });
assert.equal(health.ok, true);
assert.equal(health.editorReady, true);
assert.ok(health.handoff.checklist.some((item) => item.includes('scale')));
assert.ok(health.warningDisposition.every((row) => row.blocksRuntime === false));
assert.ok(health.previews.some((row) => row.id === 'weapon.rifle'));
assert.ok(health.previews.some((row) => row.id === 'animation.mixamo.humanoid'));
assert.ok(health.previews.some((row) => row.id === 'asset.meshy.cover-crate'));

const missingStrictPack = normalizeCustomMapPack({
  title: 'Missing Strict Profile',
  maps: [{
    title: 'Missing',
    objects: [normalizePlacedObject({
      prefabId: 'cover.half_crate',
      weaponProfileId: 'weapon.does-not-exist'
    })]
  }]
});
const missingStrict = buildLevelEditorAssetHealth(missingStrictPack, ALL_MANIFESTS, { editorReady: true });
assert.equal(missingStrict.ok, false);
assert.ok(missingStrict.errors.some((row) => row.code === 'missing-required-profile'));

const riflePreview = buildEditorAssetPreview(WEAPON_MANIFEST['weapon.rifle']);
assert.equal(riflePreview.ok, true);
assert.equal(riflePreview.editor.validationRequiredForBoot, false);
assert.ok(riflePreview.sockets.required.includes('muzzle'));
assert.ok(riflePreview.importChecklist.some((stage) => stage.id === 'runtimeLoad' && stage.ok));

const mixamoPreview = buildEditorAssetPreview(ANIMATION_MANIFEST['animation.mixamo.humanoid']);
assert.equal(mixamoPreview.ok, true);
assert.equal(mixamoPreview.animation.missingSemantic.length, 0);
assert.ok(mixamoPreview.animation.previewStates.some((row) => row.state === 'death' && row.available));

const found = findManifestEntry(ALL_MANIFESTS, 'character.soldier');
assert.equal(found.bucket, 'characters');
assert.equal(found.entry.id, 'character.soldier');
assert.ok(ASSET_IMPORT_STAGES.some((stage) => stage.id === 'editorAvailability'));
const handoff = buildImportHandoffGuide();
assert.ok(handoff.templates.weaponViewmodel.requiredSockets.includes('muzzle'));
assert.ok(handoff.templates.mixamoAnimationSet.clips.includes('fireAdditive'));
assert.ok(handoff.guardedRuntimeFlags.includes('importedAnimationEnabled'));

console.log(JSON.stringify({
  ok: true,
  legacy: {
    ok: legacyHealth.ok,
    refs: legacyHealth.summary.refs
  },
  profiled: {
    ok: health.ok,
    warnings: health.warnings.length,
    previews: health.previews.length
  },
  missingStrict: {
    ok: missingStrict.ok,
    errors: missingStrict.errors.length
  }
}, null, 2));
