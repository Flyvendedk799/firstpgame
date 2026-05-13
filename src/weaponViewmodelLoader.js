export const REQUIRED_WEAPON_SOCKETS = [
  'muzzle',
  'muzzleFlash',
  'gripRight',
  'gripLeft',
  'magazine',
  'ejectionPort',
  'optic',
  'scopeCamera',
  'attachmentMuzzle',
  'attachmentMag',
  'attachmentForegrip',
  'attachmentLaser'
];

export const REQUIRED_WEAPON_CLIPS = ['idle', 'fire', 'reload', 'ads', 'inspect'];

export const REQUIRED_HAND_NODES = [
  'ViewmodelRoot',
  'cameraRoot',
  'wrist_r',
  'palm_r',
  'wrist_l',
  'palm_l',
  'weapon_socket'
];

export const REQUIRED_HAND_CLIPS = [
  'idle',
  'walkSway',
  'sprint',
  'ads',
  'reloadRifle',
  'fireRifle',
  'inspect',
  'weaponSwap',
  'tacticalLean'
];

export function resolvePublicAssetUrl(src, baseUrl) {
  if (!src) return null;
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) return src;
  const base = baseUrl ?? (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL != null
    ? String(import.meta.env.BASE_URL)
    : '/');
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${String(src).replace(/^\/+/, '')}`;
}

export function loadGltfAsset(gltfLoader, src, baseUrl) {
  const url = resolvePublicAssetUrl(src, baseUrl);
  return new Promise((resolve, reject) => {
    if (!gltfLoader || !url) {
      reject(new Error(!gltfLoader ? 'missing GLTFLoader' : 'missing asset URL'));
      return;
    }
    gltfLoader.load(url, resolve, undefined, reject);
  });
}

export function collectNamedNodes(root) {
  const nodes = new Map();
  if (root && typeof root.traverse === 'function') {
    root.traverse(obj => {
      if (obj && obj.name && !nodes.has(obj.name)) nodes.set(obj.name, obj);
    });
  }
  return nodes;
}

export function cloneGltfScene(THREE, SkeletonUtils, scene) {
  if (!scene) return null;
  if (SkeletonUtils && typeof SkeletonUtils.clone === 'function') return SkeletonUtils.clone(scene);
  if (THREE && THREE.SkeletonUtils && typeof THREE.SkeletonUtils.clone === 'function') return THREE.SkeletonUtils.clone(scene);
  return scene.clone(true);
}

export function collectViewmodelStats(root) {
  const materialSet = new Set();
  const textureSet = new Set();
  const textureSizes = [];
  let meshes = 0;
  let triangles = 0;
  let objects = 0;
  if (!root || typeof root.traverse !== 'function') {
    return { objects, meshes, materials: 0, textures: 0, textureSizes, triangles };
  }
  root.traverse(obj => {
    objects++;
    if (!obj.isMesh) return;
    meshes++;
    const geom = obj.geometry;
    if (geom) {
      if (geom.index) triangles += Math.floor(geom.index.count / 3);
      else if (geom.attributes && geom.attributes.position) triangles += Math.floor(geom.attributes.position.count / 3);
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      materialSet.add(mat);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
        const tex = mat[key];
        if (!tex || textureSet.has(tex)) continue;
        textureSet.add(tex);
        const img = tex.image || {};
        textureSizes.push({
          name: tex.name || mat.name || key,
          width: img.naturalWidth || img.videoWidth || img.width || 0,
          height: img.naturalHeight || img.videoHeight || img.height || 0
        });
      }
    }
  });
  return {
    objects,
    meshes,
    materials: materialSet.size,
    textures: textureSet.size,
    textureSizes,
    triangles
  };
}

export function validateWeaponViewmodel(gltf, entry = {}, options = {}) {
  const nodes = collectNamedNodes(gltf && gltf.scene);
  const clips = new Set((gltf && gltf.animations || []).map(clip => clip.name));
  const requiredSockets = options.requiredSockets || entry.sockets || REQUIRED_WEAPON_SOCKETS;
  const requiredClips = options.requiredClips || entry.clips || REQUIRED_WEAPON_CLIPS;
  const requiredNodes = ['WeaponRoot', 'visual', 'sockets', 'mag', 'trigger', 'chargingHandle'];
  const errors = [];
  const warnings = [];
  for (const name of requiredNodes) if (!nodes.has(name)) errors.push(`missing node:${name}`);
  for (const name of requiredSockets) if (!nodes.has(name)) errors.push(`missing socket:${name}`);
  for (const name of requiredClips) if (!clips.has(name)) errors.push(`missing clip:${name}`);
  const stats = collectViewmodelStats(gltf && gltf.scene);
  const triangleBudget = options.triangleBudget || entry.triangleBudget || 12000;
  const materialBudget = options.materialBudget || 8;
  if (stats.triangles > triangleBudget) warnings.push(`triangles over budget:${stats.triangles}/${triangleBudget}`);
  if (stats.materials > materialBudget) warnings.push(`materials over budget:${stats.materials}/${materialBudget}`);
  for (const tex of stats.textureSizes) {
    const maxDim = Math.max(tex.width || 0, tex.height || 0);
    if (maxDim > 2304) warnings.push(`texture over 2k budget:${tex.name}:${tex.width}x${tex.height}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    nodes,
    clips: Array.from(clips),
    stats
  };
}

export function validateHandsViewmodel(gltf, entry = {}, options = {}) {
  const nodes = collectNamedNodes(gltf && gltf.scene);
  const clips = new Set((gltf && gltf.animations || []).map(clip => clip.name));
  const requiredNodes = options.requiredNodes || entry.requiredBones || REQUIRED_HAND_NODES;
  const requiredClips = options.requiredClips || entry.clips || REQUIRED_HAND_CLIPS;
  const errors = [];
  const warnings = [];
  for (const name of requiredNodes) if (!nodes.has(name)) errors.push(`missing node:${name}`);
  for (const name of requiredClips) if (!clips.has(name)) errors.push(`missing clip:${name}`);
  const stats = collectViewmodelStats(gltf && gltf.scene);
  if (stats.materials > (options.materialBudget || 6)) warnings.push(`materials over budget:${stats.materials}`);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    nodes,
    clips: Array.from(clips),
    stats
  };
}

export function configureViewmodelScene(THREE, root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse(obj => {
    if (obj.layers && typeof obj.layers.set === 'function') obj.layers.set(1);
    if (obj.userData) {
      obj.userData.noSsr = true;
      obj.userData.noReflect = true;
    }
    if (!obj.isMesh) return;
    obj.frustumCulled = false;
    obj.castShadow = false;
    obj.receiveShadow = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map && THREE && THREE.SRGBColorSpace) mat.map.colorSpace = THREE.SRGBColorSpace;
      if ('envMapIntensity' in mat) mat.envMapIntensity = Math.max(mat.envMapIntensity || 0, 0.72);
      mat.needsUpdate = true;
    }
  });
}

export function scaleViewmodelToLength(THREE, root, targetLength = 0.68) {
  if (!THREE || !root) return 1;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const longAxis = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longAxis) || longAxis <= 0.0001) return 1;
  const scale = targetLength / longAxis;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  return scale;
}

export function alignSocketToLocal(THREE, rig, socket, parent, target) {
  if (!THREE || !rig || !socket || !parent || !target) return false;
  parent.updateMatrixWorld(true);
  rig.updateMatrixWorld(true);
  const local = socket.getWorldPosition(new THREE.Vector3());
  parent.worldToLocal(local);
  rig.position.add(new THREE.Vector3(target.x - local.x, target.y - local.y, target.z - local.z));
  rig.updateMatrixWorld(true);
  return true;
}

export function createClipActions(THREE, mixer, clips, names) {
  const out = {};
  if (!mixer || !Array.isArray(clips)) return out;
  for (const name of names) {
    const clip = clips.find(c => c.name === name);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    const oneShot = !['idle', 'walkSway', 'sprint', 'ads', 'tacticalLean'].includes(name);
    action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = oneShot;
    out[name] = action;
  }
  return out;
}
