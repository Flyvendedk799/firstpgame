// Per-building HDR IBL (Sequence 1). Sources are three.js example HDRIs (MIT)
// mirrored under /assets/environments — see README in that folder.
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/** One equirect HDR per campaign building (bn 1..12), served from `public/`. */
export const LEVEL_HDR_URLS = [
  '/assets/environments/b01_dock.hdr',
  '/assets/environments/b02_continental.hdr',
  '/assets/environments/b03_nightclub.hdr',
  '/assets/environments/b04_penthouse.hdr',
  '/assets/environments/b05_hospital.hdr',
  '/assets/environments/b06_subway.hdr',
  '/assets/environments/b07_yacht.hdr',
  '/assets/environments/b08_server.hdr',
  '/assets/environments/b09_border.hdr',
  '/assets/environments/b10_cathedral.hdr',
  '/assets/environments/b11_freighter.hdr',
  '/assets/environments/b12_spire.hdr'
];

let _pmrem = null;
let _rgbLoader = null;
let _fallbackEnv = null;
/** @type {Map<number, import('three').Texture>} */
const _envByBn = new Map();
/** @type {Map<number, Promise<import('three').Texture|null>>} */
const _envLoadsByBn = new Map();
/** Cached equirectangular HDR textures (same load as PMREM source; retained for skylines/sky sphere). */
const _equirectByBn = new Map();

export function registerFallbackEnvironmentTexture(tex) {
  _fallbackEnv = tex || null;
}

function _ensurePipeline(THREE, renderer) {
  if (!_pmrem) _pmrem = new THREE.PMREMGenerator(renderer);
  if (!_rgbLoader) _rgbLoader = new RGBELoader();
}

/**
 * @returns {Promise<import('three').Texture|null>}
 */
export async function loadBuildingEnvironment(THREE, renderer, bn) {
  const idx = THREE.MathUtils.clamp((bn | 0) - 1, 0, LEVEL_HDR_URLS.length - 1);
  const url = LEVEL_HDR_URLS[idx];
  if (_envByBn.has(bn)) return _envByBn.get(bn);
  if (_envLoadsByBn.has(bn)) return _envLoadsByBn.get(bn);
  _ensurePipeline(THREE, renderer);
  const job = (async () => {
    const hdr = await new Promise((resolve, reject) => {
      _rgbLoader.load(url, resolve, undefined, reject);
    });
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    _equirectByBn.set(bn, hdr);
    const { texture } = _pmrem.fromEquirectangular(hdr);
    _envByBn.set(bn, texture);
    return texture;
  })();
  _envLoadsByBn.set(bn, job);
  try {
    return await job;
  } catch (err) {
    console.warn('[environmentMaps] HDR load failed bn=', bn, url, err);
    return null;
  } finally {
    _envLoadsByBn.delete(bn);
  }
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function preloadAllBuildingEnvironments(THREE, renderer, options = {}) {
  _ensurePipeline(THREE, renderer);
  const exclude = new Set(options.exclude || []);
  const delayMs = Math.max(0, options.delayMs ?? 240);
  for (let b = 1; b <= LEVEL_HDR_URLS.length; b++) {
    if (exclude.has(b) || _envByBn.has(b)) continue;
    await loadBuildingEnvironment(THREE, renderer, b);
    if (delayMs) await _sleep(delayMs);
  }
}

/**
 * Applies cached HDR env for `bn`, or falls back to RoomEnvironment cube.
 * @param {import('three').Scene} scene
 * @param {number} envRotationY optional radians (uses scene.environmentRotation.y)
 */
/** @returns {import('three').Texture|null} */
export function getBuildingEquirectTexture(bn) {
  return _equirectByBn.get((bn | 0)) || null;
}

/**
 * @param {import('three').Scene} scene
 */
export function applySkyBackgroundFromEquirect(scene, THREE, tex, intensity = 1, blurriness = 0) {
  if (!scene || !tex) return false;
  scene.background = tex;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  if ('backgroundIntensity' in scene && scene.backgroundIntensity !== undefined)
    scene.backgroundIntensity = intensity;
  if ('backgroundBlurriness' in scene) scene.backgroundBlurriness = Math.max(0, blurriness || 0);
  return true;
}

export function applyEnvironmentForBuilding(scene, THREE, bn, envRotationY = 0) {
  const tex = _envByBn.get(bn);
  if (tex && scene) {
    scene.environment = tex;
    if ('environmentRotation' in scene && scene.environmentRotation) {
      scene.environmentRotation.y = envRotationY;
    }
    return true;
  }
  if (_fallbackEnv && scene) {
    scene.environment = _fallbackEnv;
    if ('environmentRotation' in scene && scene.environmentRotation) {
      scene.environmentRotation.y = 0;
    }
    return false;
  }
  return false;
}

export function disposeHdrPipeline() {
  try {
    for (const t of _envByBn.values()) {
      t?.dispose?.();
    }
  } catch (_) {}
  _envByBn.clear();
  _envLoadsByBn.clear();
  try {
    for (const e of _equirectByBn.values()) {
      e?.dispose?.();
    }
  } catch (_) {}
  _equirectByBn.clear();
  try {
    _pmrem?.dispose?.();
  } catch (_) {}
  _pmrem = null;
  _rgbLoader = null;
}
