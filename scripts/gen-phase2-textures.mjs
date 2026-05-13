// Generate LUT cubes + procedural decal/VFX PNGs for Phase 2 cinematic pass.
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

function writePng(px, fname, w, h) {
  const png = new PNG({ width: w, height: h });
  png.data.set(px);
  fs.mkdirSync(path.dirname(fname), { recursive: true });
  fs.writeFileSync(fname, PNG.sync.write(png));
}

function genCubeTint(title, hueShiftRgb) {
  const size = 33;
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`, `DOMAIN_MIN 0 0 0`, `DOMAIN_MAX 1 1 1`];
  const [mr, mg, mb] = hueShiftRgb;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const rf = ((r / (size - 1)) ** 1.03) * mr;
        const gf = ((g / (size - 1)) ** 1.0) * mg;
        const bf = ((b / (size - 1)) ** 0.97) * mb;
        lines.push(`${rf.toFixed(6)} ${gf.toFixed(6)} ${bf.toFixed(6)}`);
      }
  return `${lines.join('\n')}\n`;
}

const lutsDir = path.resolve('public/assets/luts');
const specs = [
  ['b01_dock.cube', [0.93, 0.97, 1.06]],
  ['b02_continental.cube', [1.03, 0.99, 0.96]],
  ['b03_nightclub.cube', [1.12, 0.92, 1.06]],
  ['b04_penthouse.cube', [1.05, 0.98, 1.06]],
  ['b05_hospital.cube', [0.98, 1.03, 1.05]],
  ['b06_subway.cube', [1.02, 0.96, 0.94]],
  ['b07_yacht.cube', [0.95, 0.98, 1.08]],
  ['b08_server.cube', [0.92, 1.06, 1.12]],
  ['b09_border.cube', [1.06, 0.98, 0.93]],
  ['b10_cathedral.cube', [1.05, 0.97, 0.93]],
  ['b11_freighter.cube', [0.97, 0.98, 1.04]],
  ['b12_spire.cube', [0.94, 0.96, 1.1]]
];
for (const [fn, tint] of specs) {
  fs.writeFileSync(path.join(lutsDir, fn), genCubeTint(fn.replace('.cube', ''), tint), 'utf8');
}

// --- Decals (albedo)
const decals = ['bullethole', 'blood_pool', 'grime_streak', 'floor_scuff', 'scorch'];
for (const d of decals) {
  const w = 128;
  const h = d === 'grime_streak' ? 64 : 128;
  const px = Buffer.alloc(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0.12 + Math.random() * 0.04;
      let g = 0.12 + Math.random() * 0.04;
      let b = 0.12 + Math.random() * 0.04;
      const a = 255;
      if (d === 'bullethole') {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const dr = dx * dx + dy * dy;
        if (dr < 0.35) r = g = b = 0;
        else if (dr < 0.92) r = g = b = 0.08 + Math.random() * 0.06;
      } else if (d === 'blood_pool') {
        r = 0.32 + Math.random() * 0.1;
        g = 0.02;
        b = 0.02;
      } else if (d === 'grime_streak') {
        r = g = b = (x / w) * 0.12 + Math.random() * 0.04;
      } else if (d === 'floor_scuff') {
        const n = Math.sin(x * 0.2) + Math.cos(y * 0.26);
        r = g = b = Math.max(0.05, 0.09 + n * 0.02 + Math.random() * 0.02);
      } else if (d === 'scorch') {
        const dr = Math.hypot(x - cx, y - cy) / Math.min(w, h);
        r = 0.06 * (1 + dr * 8);
        g = 0.04 * (1 + dr * 6);
        b = 0.02 + dr * 0.12;
      }
      const i = (y * w + x) * 4;
      px[i] = Math.min(255, Math.floor(r * 255));
      px[i + 1] = Math.min(255, Math.floor(g * 255));
      px[i + 2] = Math.min(255, Math.floor(b * 255));
      px[i + 3] = a;
    }
  writePng(px, path.resolve(`public/assets/decals/${d}_albedo.png`), w, h);
}

// Normal maps — bullethole dent + subtle floor perturbation.
{
  const w = 128;
  const px = Buffer.alloc(w * w * 4);
  const cx = w / 2;
  const cy = w / 2;
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const ux = ((x + 0.5) / w) * 2 - 1;
      const uy = ((y + 0.5) / w) * 2 - 1;
      const rr = ux * ux + uy * uy;
      let vz = rr < 1 ? Math.sqrt(Math.max(0, 1 - rr * 9)) + 0.25 : rr * 0.9;
      let vx = -ux * rr * (rr < 0.92 ? 0.35 : 0.05);
      let vy = -uy * rr * (rr < 0.92 ? 0.35 : 0.05);
      const len = Math.hypot(vx, vy, vz) || 1;
      vx /= len;
      vy /= len;
      vz /= len;
      const i = (y * w + x) * 4;
      px[i] = Math.floor((vx * 0.5 + 0.5) * 255);
      px[i + 1] = Math.floor((vy * 0.5 + 0.5) * 255);
      px[i + 2] = Math.floor((vz * 0.5 + 0.5) * 255);
      px[i + 3] = 255;
    }
  writePng(px, path.resolve('public/assets/decals/bullethole_normal.png'), w, w);
}
{
  const w = 128;
  const px = Buffer.alloc(w * w * 4);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const n = Math.sin(x * 0.12) * 0.12 + Math.cos(y * 0.15) * 0.1;
      const i = (y * w + x) * 4;
      px[i] = Math.floor((0.52 + n) * 255);
      px[i + 1] = Math.floor((0.5 - n * 0.6) * 255);
      px[i + 2] = Math.floor(0.93 * 255);
      px[i + 3] = 255;
    }
  writePng(px, path.resolve('public/assets/decals/floor_scuff_normal.png'), w, w);
}

// --- VFX atlases (4-frame muzzle, 8-frame smoke strip, sparks)
{
  const cols = 4;
  const rows = 2;
  const fw = 64;
  const fh = 64;
  const w = fw * cols;
  const h = fh * rows;
  const px = Buffer.alloc(w * h * 4);
  const drawBlob = (ox, oy, bright) => {
    const cx = ox + fw / 2;
    const cy = oy + fh / 2;
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const d = Math.hypot(x - fw / 2, y - fh / 2) / (fw * 0.48);
        const a = Math.max(0, (1 - d) ** 2 * bright * 220);
        if (a < 2) continue;
        const gx = ox + x;
        const gy = oy + y;
        const i = (gy * w + gx) * 4;
        px[i] = 255;
        px[i + 1] = Math.min(255, Math.floor(200 + bright * 50));
        px[i + 2] = Math.min(255, Math.floor(80 + bright * 120));
        px[i + 3] = Math.floor(a);
      }
  };
  for (let f = 0; f < 8; f++) {
    const c = f % cols;
    const r = (f / cols) | 0;
    drawBlob(c * fw, r * fh, 1 - f * 0.045);
  }
  writePng(px, path.resolve('public/assets/vfx/muzzle_atlas.png'), w, h);
}
{
  const cols = 8;
  const fw = 32;
  const fh = 32;
  const w = fw * cols;
  const h = fh;
  const px = Buffer.alloc(w * h * 4);
  for (let f = 0; f < cols; f++) {
    const ox = f * fw;
    const alpha = Math.floor((0.72 - f * 0.066) * 255);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const dx = Math.abs(x - fw / 2) / fw;
        const dy = Math.abs(y - fh / 2) / fh;
        const d = dx + dy + Math.random() * 0.12;
        if (d > 0.58) continue;
        const gx = ox + x;
        const gy = y;
        const i = (gy * w + gx) * 4;
        const gry = Math.floor((0.42 + dy * 0.16) * 255);
        px[i] = gry;
        px[i + 1] = gry;
        px[i + 2] = Math.min(255, Math.floor((0.5 + dx * 0.2) * 255));
        px[i + 3] = Math.floor(alpha * (1 - d / 0.58));
      }
  }
  writePng(px, path.resolve('public/assets/vfx/smoke_atlas.png'), w, h);
}
{
  const cols = 4;
  const fw = 48;
  const fh = 16;
  const w = fw * cols;
  const h = fh;
  const px = Buffer.alloc(w * h * 4);
  for (let f = 0; f < cols; f++) {
    const ox = f * fw;
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const t = (x / fw + f * 0.18 + y * 0.05 + Math.random() * 0.05) % 1;
        const i = ((y * w + ox + x)) * 4;
        px[i] = Math.min(255, Math.floor((0.9 + Math.sin(t * 13) * 0.06) * 255));
        px[i + 1] = Math.min(255, Math.floor((0.75 + Math.cos(t * 11) * 0.1) * 255));
        px[i + 2] = Math.min(255, Math.floor((0.55 + Math.sin(t * 7 + 1)) * 100));
        const dist = Math.abs(y - fh / 2) / fh;
        px[i + 3] = Math.floor(Math.max(0, (1 - dist * 1.35) ** 3 * 235));
      }
  }
  writePng(px, path.resolve('public/assets/vfx/sparks_atlas.png'), w, h);
}

console.log('[gen-phase2-textures] wrote luts/decals/vfx assets');
