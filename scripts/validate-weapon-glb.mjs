#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_WEAPON_SOCKETS = [
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
const REQUIRED_WEAPON_NODES = ['WeaponRoot', 'visual', 'sockets', 'mag', 'trigger', 'chargingHandle'];
const REQUIRED_WEAPON_CLIPS = ['idle', 'fire', 'reload', 'ads', 'inspect'];
const ADVANCED_WEAPON_SIGHT_SOCKETS = ['frontSight', 'rearSight', 'sightLine'];
const OPTIONAL_WEAPON_SIGHT_SOCKETS = ['opticGlass'];
const REQUIRED_HAND_NODES = [
  'ViewmodelRoot',
  'cameraRoot',
  'wrist_r',
  'palm_r',
  'wrist_l',
  'palm_l',
  'weapon_socket',
  'wristband_root',
  'wristband_screen',
  'wristband_emitter',
  'wristband_holo_mount',
  'hologram_inventory',
  'hologram_reload',
  'hologram_shop',
  'holo_ray_inventory',
  'holo_ray_reload',
  'holo_ray_idle'
];
const REQUIRED_HAND_CLIPS = [
  'idle',
  'walkSway',
  'sprint',
  'ads',
  'reloadRifle',
  'fireRifle',
  'inspect',
  'weaponSwap',
  'tacticalLean',
  'wristbandIdle',
  'holoInventoryDeploy',
  'holoReloadDeploy',
  'holoShopDeploy'
];

function usage() {
  console.error('Usage: node scripts/validate-weapon-glb.mjs <file.glb> [--type weapon|hands]');
  process.exit(2);
}

function parseArgs(argv) {
  const file = argv[2];
  if (!file) usage();
  let type = 'weapon';
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === '--type') type = argv[++i] || type;
  }
  if (!['weapon', 'hands'].includes(type)) usage();
  return { file, type };
}

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('not a GLB file');
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB version:${version}`);
  const length = buf.readUInt32LE(8);
  if (length !== buf.length) throw new Error(`GLB length mismatch:${length}/${buf.length}`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.toString('ascii', offset + 4, offset + 8);
    const chunk = buf.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 'JSON') json = JSON.parse(chunk.toString('utf8'));
    if (chunkType === 'BIN\0') bin = chunk;
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error('missing GLB JSON chunk');
  return { json, bin };
}

function pngSize(buf) {
  if (buf.length >= 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: 'png' };
  }
  return null;
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const len = buf.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5), format: 'jpeg' };
    }
    offset += 2 + len;
  }
  return null;
}

function imageBuffer(json, bin, image) {
  if (image.bufferView == null || !bin) return null;
  const bv = json.bufferViews?.[image.bufferView];
  if (!bv) return null;
  const start = bv.byteOffset || 0;
  return bin.subarray(start, start + bv.byteLength);
}

function nodeMap(json) {
  const map = new Map();
  for (const node of json.nodes || []) {
    if (node.name && !map.has(node.name)) map.set(node.name, node);
  }
  return map;
}

function parentMap(json) {
  const out = new Map();
  for (const node of json.nodes || []) {
    for (const childIndex of node.children || []) {
      const child = json.nodes?.[childIndex];
      if (child?.name) out.set(child.name, node.name || null);
    }
  }
  return out;
}

function countTriangles(json) {
  let triangles = 0;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.mode != null && prim.mode !== 4) continue;
      if (prim.indices != null) {
        const accessor = json.accessors?.[prim.indices];
        triangles += Math.floor((accessor?.count || 0) / 3);
      } else if (prim.attributes?.POSITION != null) {
        const accessor = json.accessors?.[prim.attributes.POSITION];
        triangles += Math.floor((accessor?.count || 0) / 3);
      }
    }
  }
  return triangles;
}

function defaultTransform(node) {
  const translationOk = !node.translation || node.translation.every(v => Math.abs(v) < 1e-6);
  const rotationOk = !node.rotation || (Math.abs(node.rotation[0]) < 1e-6 && Math.abs(node.rotation[1]) < 1e-6 && Math.abs(node.rotation[2]) < 1e-6 && Math.abs((node.rotation[3] ?? 1) - 1) < 1e-6);
  const scaleOk = !node.scale || node.scale.every(v => Math.abs(v - 1) < 1e-6);
  return translationOk && rotationOk && scaleOk;
}

function vecLength(v) {
  if (!Array.isArray(v)) return 0;
  return Math.hypot(v[0] || 0, v[1] || 0, v[2] || 0);
}

function validate(file, type) {
  const { json, bin } = readGlb(file);
  const nodes = nodeMap(json);
  const parents = parentMap(json);
  const clips = new Set((json.animations || []).map(a => a.name));
  const errors = [];
  const warnings = [];
  const requiredNodes = type === 'weapon' ? REQUIRED_WEAPON_NODES.concat(REQUIRED_WEAPON_SOCKETS) : REQUIRED_HAND_NODES;
  const requiredClips = type === 'weapon' ? REQUIRED_WEAPON_CLIPS : REQUIRED_HAND_CLIPS;
  for (const name of requiredNodes) if (!nodes.has(name)) errors.push(`missing node:${name}`);
  for (const name of requiredClips) if (!clips.has(name)) errors.push(`missing clip:${name}`);

  if (type === 'weapon') {
    const root = nodes.get('WeaponRoot');
    if (root && !defaultTransform(root)) errors.push('WeaponRoot transform is not applied/default');
    for (const name of ADVANCED_WEAPON_SIGHT_SOCKETS) {
      if (!nodes.has(name)) warnings.push(`missing v2 sight socket:${name}`);
    }
    for (const name of OPTIONAL_WEAPON_SIGHT_SOCKETS) {
      if (!nodes.has(name)) warnings.push(`optional sight socket not authored:${name}`);
    }
  }

  if (type === 'hands') {
    for (const side of ['r', 'l']) {
      const palmName = `palm_${side}`;
      const wristName = `wrist_${side}`;
      const palm = nodes.get(palmName);
      if (palm && parents.get(palmName) !== wristName) errors.push(`${palmName} must be parented to ${wristName}`);
      const localSpan = vecLength(palm?.translation);
      if (localSpan > 0.16) errors.push(`${palmName} local offset too large:${localSpan.toFixed(3)}; expected wrist-local, not world-space`);
    }
  }

  const textureSizes = [];
  for (const image of json.images || []) {
    if (image.uri && !image.uri.startsWith('data:')) {
      const imagePath = path.resolve(path.dirname(file), image.uri);
      if (!fs.existsSync(imagePath)) errors.push(`missing external texture:${image.uri}`);
      else {
        const img = fs.readFileSync(imagePath);
        const size = pngSize(img) || jpegSize(img);
        if (size) textureSizes.push({ name: image.name || image.uri, ...size });
      }
      continue;
    }
    const img = imageBuffer(json, bin, image);
    const size = img ? (pngSize(img) || jpegSize(img)) : null;
    if (size) textureSizes.push({ name: image.name || `image_${textureSizes.length}`, ...size });
  }
  for (const tex of textureSizes) {
    const maxDim = Math.max(tex.width, tex.height);
    if (maxDim > 2304) warnings.push(`texture over 2k budget:${tex.name}:${tex.width}x${tex.height}`);
    if (type === 'weapon' && maxDim < 1536) warnings.push(`weapon atlas under expected 2k target:${tex.name}:${tex.width}x${tex.height}`);
  }

  const report = {
    ok: errors.length === 0,
    file,
    type,
    nodes: (json.nodes || []).length,
    meshes: (json.meshes || []).length,
    materials: (json.materials || []).length,
    textures: (json.textures || []).length,
    triangles: countTriangles(json),
    clips: Array.from(clips),
    textureSizes,
    errors,
    warnings
  };
  return report;
}

const { file, type } = parseArgs(process.argv);
try {
  const report = validate(file, type);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
} catch (err) {
  console.error(String(err && err.stack || err));
  process.exit(1);
}
