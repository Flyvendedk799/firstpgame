#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import * as gltfValidator from 'gltf-validator';
import {
  HUMANOID_SEMANTIC_ANIMATION_CLIPS,
  WEAPON_SOCKETS
} from '../src/assetManifest.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TEXTURE_BUDGETS = {
  weapon: 2048,
  viewmodel: 2048,
  character: 2048,
  animation: 1024,
  environment: 2048,
  generic: 2048
};
const WEAPON_REQUIRED_SOCKETS = ['muzzle', 'gripRight', 'gripLeft', 'magazine', 'ejectionPort'];

function usage() {
  console.error('Usage: node scripts/asset-preflight.mjs <file.glb|file.gltf> [--type weapon|viewmodel|character|animation|environment|generic] [--strict] [--summary]');
  process.exit(2);
}

function parseArgs(argv) {
  const file = argv[2];
  if (!file) usage();
  let type = 'generic';
  let strict = false;
  let summary = false;
  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type') type = argv[++i] || type;
    else if (arg === '--strict') strict = true;
    else if (arg === '--summary') summary = true;
    else usage();
  }
  if (!['weapon', 'viewmodel', 'character', 'animation', 'environment', 'generic'].includes(type)) usage();
  return { file: path.resolve(ROOT, file), type, strict, summary };
}

function issue(code, message, detail = {}) {
  return { code, message, ...detail };
}

function isDefaultTransform(node = {}) {
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  return t.every(v => Math.abs(v) < 1e-5)
    && Math.abs(r[0]) < 1e-5 && Math.abs(r[1]) < 1e-5 && Math.abs(r[2]) < 1e-5 && Math.abs((r[3] ?? 1) - 1) < 1e-5
    && s.every(v => Math.abs(v - 1) < 1e-5);
}

function scaleIsApplied(node = {}) {
  const s = node.scale || [1, 1, 1];
  return s.every(v => Math.abs(v - 1) < 1e-5);
}

function readGlbChunks(buf) {
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

function readSource(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  if (ext === '.glb') return { ext, bytes: buf, ...readGlbChunks(buf) };
  if (ext === '.gltf') return { ext, text: buf.toString('utf8'), json: JSON.parse(buf.toString('utf8')), bin: null };
  throw new Error('expected .glb or .gltf');
}

function externalResource(file, uri) {
  if (!uri || uri.startsWith('data:')) return Promise.resolve(null);
  const clean = decodeURIComponent(uri.split('#')[0]);
  return fs.promises.readFile(path.resolve(path.dirname(file), clean));
}

async function validateWithKhronos(file, source) {
  const options = {
    uri: path.basename(file),
    externalResourceFunction: uri => externalResource(file, uri)
  };
  if (source.ext === '.glb') return gltfValidator.validateBytes(new Uint8Array(source.bytes), options);
  return gltfValidator.validateString(source.text, options);
}

function accessorTriangles(json, primitive) {
  if (primitive.mode != null && primitive.mode !== 4) return 0;
  if (primitive.indices != null) return Math.floor((json.accessors?.[primitive.indices]?.count || 0) / 3);
  const pos = primitive.attributes?.POSITION;
  return pos == null ? 0 : Math.floor((json.accessors?.[pos]?.count || 0) / 3);
}

function countTriangles(json) {
  let triangles = 0;
  for (const mesh of json.meshes || []) for (const prim of mesh.primitives || []) triangles += accessorTriangles(json, prim);
  return triangles;
}

function pngSize(buf) {
  if (buf.length >= 24 && buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: 'png' };
  return null;
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const len = buf.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5), format: 'jpeg' };
    offset += 2 + len;
  }
  return null;
}

function imageBytes(file, json, bin, image) {
  if (image.uri && !image.uri.startsWith('data:')) {
    const imagePath = path.resolve(path.dirname(file), image.uri);
    return fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
  }
  if (image.uri && image.uri.startsWith('data:')) {
    const b64 = image.uri.slice(image.uri.indexOf(',') + 1);
    return Buffer.from(b64, 'base64');
  }
  if (image.bufferView == null || !bin) return null;
  const bv = json.bufferViews?.[image.bufferView];
  if (!bv) return null;
  const start = bv.byteOffset || 0;
  return bin.subarray(start, start + bv.byteLength);
}

function textureReport(file, source, warnings, type) {
  const budget = TEXTURE_BUDGETS[type] || TEXTURE_BUDGETS.generic;
  const out = [];
  for (const [index, image] of (source.json.images || []).entries()) {
    const bytes = imageBytes(file, source.json, source.bin, image);
    const size = bytes ? (pngSize(bytes) || jpegSize(bytes)) : null;
    const row = { index, name: image.name || image.uri || `image_${index}` };
    if (size) Object.assign(row, size);
    else row.unreadable = true;
    out.push(row);
    if (!size) warnings.push(issue('texture-size-unreadable', `Could not read texture dimensions for ${row.name}`, { image: row.name }));
    else if (Math.max(size.width, size.height) > budget) warnings.push(issue('texture-over-budget', `${row.name} is ${size.width}x${size.height}; budget is ${budget}`, { image: row.name, width: size.width, height: size.height, budget }));
  }
  return out;
}

function nodeNames(json) {
  return new Set((json.nodes || []).map(n => n.name).filter(Boolean));
}

function sceneRootNodes(json) {
  const scene = json.scenes?.[json.scene || 0];
  return (scene?.nodes || []).map(i => json.nodes?.[i]).filter(Boolean);
}

function minMaxBounds(json) {
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const pos = prim.attributes?.POSITION;
      const acc = pos == null ? null : json.accessors?.[pos];
      if (!acc?.min || !acc?.max) continue;
      for (let i = 0; i < 3; i++) {
        mins[i] = Math.min(mins[i], acc.min[i]);
        maxs[i] = Math.max(maxs[i], acc.max[i]);
      }
      found = true;
    }
  }
  if (!found) return null;
  const size = maxs.map((v, i) => v - mins[i]);
  return { min: mins, max: maxs, size };
}

function validateContract(source, type, strict) {
  const json = source.json;
  const errors = [];
  const warnings = [];
  const names = nodeNames(json);
  const clips = new Set((json.animations || []).map(a => a.name).filter(Boolean));
  const roots = sceneRootNodes(json);
  const hasSkin = (json.skins || []).length > 0;
  const boneNames = new Set();
  for (const skin of json.skins || []) {
    for (const joint of skin.joints || []) {
      const name = json.nodes?.[joint]?.name;
      if (name) boneNames.add(name);
    }
  }

  for (const root of roots) {
    if (!isDefaultTransform(root)) warnings.push(issue('root-transform-not-applied', `Scene root "${root.name || 'unnamed'}" has non-default transform`, { node: root.name || null }));
  }
  for (const node of json.nodes || []) {
    if (!scaleIsApplied(node) && (hasSkin || /armature|root|skeleton/i.test(node.name || ''))) {
      warnings.push(issue('meshy-scaled-armature-risk', `Node "${node.name || 'unnamed'}" has unapplied scale; normalize in Blender/glTF Transform before runtime`, { node: node.name || null, scale: node.scale }));
    }
  }
  if (type === 'weapon') {
    const missing = WEAPON_REQUIRED_SOCKETS.filter(s => !names.has(s));
    const missingOptional = WEAPON_SOCKETS.filter(s => !names.has(s));
    for (const socket of missing) (strict ? errors : warnings).push(issue('missing-required-weapon-socket', `Missing weapon socket "${socket}"`, { socket }));
    for (const socket of missingOptional) if (!missing.includes(socket)) warnings.push(issue('missing-optional-weapon-socket', `Missing optional weapon socket "${socket}"`, { socket }));
    for (const part of ['trigger', 'mag', 'chargingHandle']) if (!names.has(part)) warnings.push(issue('missing-moving-part-node', `Missing moving part node "${part}"`, { part }));
  }
  if (type === 'character') {
    if (!hasSkin) (strict ? errors : warnings).push(issue('character-without-skin', 'Character asset has no skin/skeleton'));
    for (const bone of ['root', 'pelvis', 'spine_01', 'chest', 'head']) {
      if (!boneNames.has(bone) && !names.has(bone)) warnings.push(issue('missing-canonical-humanoid-bone', `Missing canonical humanoid bone "${bone}"`, { bone }));
    }
  }
  if (type === 'animation') {
    const semantic = new Set(HUMANOID_SEMANTIC_ANIMATION_CLIPS);
    const matched = [...clips].filter(c => semantic.has(c));
    if (!matched.length) warnings.push(issue('no-semantic-animation-clip-names', 'Animation asset has no project semantic clip names; add manifest mapping or retarget offline'));
  }
  if ((json.animations || []).length && !hasSkin && type !== 'weapon') {
    warnings.push(issue('animated-asset-without-skin', 'Asset has animation clips but no skin; verify this is intended'));
  }

  return { errors, warnings, clips: [...clips], boneCount: boneNames.size };
}

async function run() {
  const { file, type, strict, summary } = parseArgs(process.argv);
  if (!fs.existsSync(file)) throw new Error(`asset not found:${file}`);
  const source = readSource(file);
  let documentOk = true;
  let documentError = null;
  try {
    await new NodeIO().read(file);
  } catch (err) {
    documentOk = false;
    documentError = String(err && err.message || err);
  }
  const validation = await validateWithKhronos(file, source);
  const contract = validateContract(source, type, strict);
  const validatorErrors = (validation.issues?.messages || []).filter(m => m.severity === 0);
  const validatorWarnings = (validation.issues?.messages || []).filter(m => m.severity > 0);
  const textureWarnings = [];
  const textures = textureReport(file, source, textureWarnings, type);
  const bounds = minMaxBounds(source.json);
  const errors = contract.errors.slice();
  const warnings = contract.warnings.concat(textureWarnings);
  if (!documentOk) errors.push(issue('gltf-transform-read-failed', documentError || 'glTF Transform could not read asset'));
  for (const msg of validatorErrors) errors.push(issue('gltf-validator-error', msg.message, { pointer: msg.pointer || null }));
  for (const msg of validatorWarnings) warnings.push(issue('gltf-validator-warning', msg.message, { pointer: msg.pointer || null }));
  const report = {
    ok: errors.length === 0,
    file: path.relative(ROOT, file),
    type,
    strict,
    stats: {
      nodes: (source.json.nodes || []).length,
      meshes: (source.json.meshes || []).length,
      materials: (source.json.materials || []).length,
      textures: (source.json.textures || []).length,
      images: (source.json.images || []).length,
      animations: (source.json.animations || []).length,
      skins: (source.json.skins || []).length,
      triangles: countTriangles(source.json),
      bones: contract.boneCount,
      bounds
    },
    clips: contract.clips,
    textures,
    tools: {
      gltfValidator: {
        version: validation.info?.version || null,
        errors: validatorErrors.length,
        warnings: validatorWarnings.length
      },
      gltfTransform: {
        readOk: documentOk,
        error: documentError
      }
    },
    errors,
    warnings,
    recommendations: [
      'Normalize units to meters and apply root/armature scale before committing.',
      'Store stable profile IDs in level/editor metadata, not direct runtime object references.',
      'For Mixamo, retarget/map clips offline and use semantic names in the manifest.'
    ]
  };
  const output = summary ? {
    ...report,
    warningCount: report.warnings.length,
    errorCount: report.errors.length,
    warnings: report.warnings.slice(0, 8),
    warningsTruncated: Math.max(0, report.warnings.length - 8)
  } : report;
  console.log(JSON.stringify(output, null, 2));
  if (!report.ok) process.exit(1);
}

run().catch(err => {
  console.error(String(err && err.stack || err));
  process.exit(1);
});
