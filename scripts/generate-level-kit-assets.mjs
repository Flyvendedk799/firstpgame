#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { PNG } from 'pngjs';
import { B01_LEVEL_KIT_SOURCE } from './level-kit-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'level-kit', 'b01-megaplex');
const PREFAB_DIR = path.join(OUT_DIR, 'prefabs');
const THUMB_DIR = path.join(OUT_DIR, 'thumbs');

globalThis.FileReader = globalThis.FileReader || class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        if (typeof this.onloadend === 'function') this.onloadend({ target: this });
      })
      .catch((err) => {
        if (typeof this.onerror === 'function') this.onerror(err);
      });
  }
};

function matFromDef(def = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color || '#ffffff'),
    roughness: def.roughness ?? 0.7,
    metalness: def.metalness ?? 0.04,
  });
  if (def.opacity != null && def.opacity < 1) {
    mat.transparent = true;
    mat.opacity = def.opacity;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
  }
  return mat;
}

function createPrefabObject(prefab, kit) {
  const root = new THREE.Group();
  root.name = prefab.id;
  const mats = new Map();
  const getMat = (id) => {
    if (!mats.has(id)) {
      const mat = matFromDef((kit.materials && kit.materials[id]) || {});
      mat.name = id;
      mats.set(id, mat);
    }
    return mats.get(id);
  };
  for (const p of prefab.parts || []) {
    if (p.kind !== 'box') continue;
    const [sx, sy, sz] = p.size;
    const [ox, oy, oz] = p.offset;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), getMat(p.material));
    mesh.name = p.name || 'part';
    mesh.position.set(ox, oy, oz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    Object.assign(mesh.userData, {
      collision: p.collision,
      floorplanRole: p.floorplanRole || null,
      glassPane: !!p.glassPane,
      breakable: !!p.breakable,
      breakSound: p.breakSound || null,
    });
    root.add(mesh);
  }
  for (const socket of prefab.sockets || []) {
    const empty = new THREE.Object3D();
    empty.name = `SOCKET_${socket.id}`;
    empty.position.set(socket.position[0], socket.position[1], socket.position[2]);
    empty.rotation.y = ((socket.facing || 0) * Math.PI) / 180;
    empty.userData.socket = socket;
    root.add(empty);
  }
  root.userData.levelKitPrefab = {
    id: prefab.id,
    category: prefab.category,
    footprint: prefab.footprint,
    tags: prefab.tags || [],
  };
  return root;
}

function parseHex(hex) {
  const n = Number.parseInt(String(hex || '#ffffff').replace('#', ''), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255, 255];
}

function putRect(png, x0, y0, x1, y1, rgba) {
  const xa = Math.max(0, Math.min(png.width - 1, Math.floor(Math.min(x0, x1))));
  const xb = Math.max(0, Math.min(png.width - 1, Math.ceil(Math.max(x0, x1))));
  const ya = Math.max(0, Math.min(png.height - 1, Math.floor(Math.min(y0, y1))));
  const yb = Math.max(0, Math.min(png.height - 1, Math.ceil(Math.max(y0, y1))));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = rgba[0];
      png.data[idx + 1] = rgba[1];
      png.data[idx + 2] = rgba[2];
      png.data[idx + 3] = rgba[3];
    }
  }
}

async function writeThumbnail(prefab, kit) {
  const png = new PNG({ width: 256, height: 256 });
  putRect(png, 0, 0, 255, 255, [8, 10, 14, 255]);
  for (let i = 0; i < 256; i += 16) {
    putRect(png, i, 0, i, 255, [35, 38, 42, 80]);
    putRect(png, 0, i, 255, i, [35, 38, 42, 80]);
  }
  const sx = prefab.footprint[0] || 1;
  const sz = prefab.footprint[1] || 1;
  const scale = Math.min(180 / Math.max(sx, 0.01), 180 / Math.max(sz, 0.01));
  const cx = 128;
  const cy = 128;
  for (const p of prefab.parts || []) {
    if (p.kind !== 'box') continue;
    const [px, , pz] = p.offset;
    const [wx, , wz] = p.size;
    const mat = kit.materials[p.material] || {};
    const rgba = parseHex(mat.color || '#777777');
    rgba[3] = p.collision && p.collision !== 'decorative_only' ? 235 : 160;
    putRect(
      png,
      cx + (px - wx / 2) * scale,
      cy + (pz - wz / 2) * scale,
      cx + (px + wx / 2) * scale,
      cy + (pz + wz / 2) * scale,
      rgba,
    );
  }
  putRect(png, 18, 18, 238, 20, [255, 208, 96, 210]);
  const file = path.join(THUMB_DIR, `${prefab.id}.png`);
  await fs.writeFile(file, PNG.sync.write(png));
}

async function writeGlb(prefab, kit) {
  const exporter = new GLTFExporter();
  const root = createPrefabObject(prefab, kit);
  const buffer = await exporter.parseAsync(root, { binary: true });
  await fs.writeFile(path.join(PREFAB_DIR, `${prefab.id}.glb`), Buffer.from(buffer));
}

async function main() {
  await fs.mkdir(PREFAB_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });
  const kit = structuredClone(B01_LEVEL_KIT_SOURCE);
  for (const prefab of kit.prefabs) {
    await writeGlb(prefab, kit);
    await writeThumbnail(prefab, kit);
  }
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(kit, null, 2));
  console.log(`level-kit: generated ${kit.prefabs.length} prefabs in ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

