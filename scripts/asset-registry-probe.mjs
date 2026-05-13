#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  createAssetRegistry,
  WEAPON_MANIFEST,
  VIEWMODEL_MANIFEST
} from '../src/assetManifest.js';

function fakeGltf(name) {
  return {
    scene: {
      name,
      traverse(fn) {
        fn({ isMesh: true, geometry: { dispose() {} }, material: { dispose() {} } });
      }
    },
    animations: []
  };
}

const loadedUrls = [];
const registry = createAssetRegistry({
  gltfLoader: {
    load(url, onLoad) {
      loadedUrls.push(url);
      queueMicrotask(() => onLoad(fakeGltf(url)));
    }
  },
  textureLoader: {
    load(url, onLoad) {
      queueMicrotask(() => onLoad({ url, dispose() {} }));
    }
  },
  getSettings: () => ({ quality: 'high' })
});

assert.equal(registry.lookup('weapon.rifle'), WEAPON_MANIFEST['weapon.rifle']);
assert.equal(registry.lookup('viewmodel.operative.hands'), VIEWMODEL_MANIFEST['viewmodel.operative.hands']);

const rifle = await registry.load('weapon.rifle');
assert.equal(rifle.status, 'loaded');
assert.equal(rifle.source, 'authored');
assert.ok(loadedUrls.some(url => url.endsWith('/assets/weapons/m4/m4_viewmodel.glb')));

const rifleAgain = await registry.load('weapon.rifle');
assert.equal(rifleAgain, rifle, 'registry should cache loaded authored GLBs by ID');

const pistol = await registry.load('weapon.pistol');
assert.equal(pistol.status, 'fallback');
assert.equal(pistol.source, 'procedural');
assert.equal(pistol.reason, 'no-src');

const unknown = await registry.load('weapon.nope');
assert.equal(unknown.status, 'unknown');

const beforeDispose = registry.status();
assert.equal(beforeDispose.cached >= 2, true);
assert.equal(registry.dispose('weapon.rifle'), true);
assert.equal(registry.get('weapon.rifle'), null);

const afterDispose = registry.status();
assert.equal(afterDispose.loaded.some(row => row.id === 'weapon.rifle'), false);
assert.equal(afterDispose.fallback.some(row => row.id === 'weapon.pistol'), true);

console.log(JSON.stringify({
  ok: true,
  loadedUrls,
  beforeDispose,
  afterDispose
}, null, 2));
