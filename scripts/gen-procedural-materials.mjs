#!/usr/bin/env node
/**
 * Deterministic tileable procedural PBR textures (no keys, no hosted API).
 * Writes public/assets/materials/<name>/<name>-{albedo,normal,...}.png
 *
 *   node scripts/gen-procedural-materials.mjs
 *   node scripts/gen-procedural-materials.mjs --only=paintedMetal,metal
 *   FORCE=1 node scripts/gen-procedural-materials.mjs
 *   TEX_SIZE=1024 node scripts/gen-procedural-materials.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MAT_ROOT = path.join(ROOT, 'public', 'assets', 'materials');
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';
const SIZE = Number(process.env.TEX_SIZE) || 512;

const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    )
  : null;

function fract(x) {
  return x - Math.floor(x);
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / Math.max(1e-9, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function seedFrom(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h || 17;
}

function hash2(ix, iy, seed) {
  const n =
    Math.sin(ix * 127.0634 + iy * 311.6728 + seed * 14.7839) *
    43758.5453123;
  return fract(Math.abs(n));
}

function noise2Periodic(u, v, period, seed) {
  const x = fract(u) * period;
  const y = fract(v) * period;
  const x0 = Math.floor(x + period * 256) % period;
  const y0 = Math.floor(y + period * 256) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const fx = smoothstep(0, 1, fract(x));
  const fy = smoothstep(0, 1, fract(y));
  const aa = hash2(x0, y0, seed);
  const ab = hash2(x1, y0, seed);
  const ac = hash2(x0, y1, seed);
  const ad = hash2(x1, y1, seed);
  return (aa * (1 - fx) + ab * fx) * (1 - fy) + (ac * (1 - fx) + ad * fx) * fy;
}

function fbm(u, v, period, seed, octaves = 5) {
  let sum = 0;
  let amp = 1;
  let maxA = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum +=
      amp *
      noise2Periodic(
        u * f,
        v * f,
        Math.max(2, Math.floor(period * f) || 4),
        seed + i * 101
      );
    maxA += amp;
    amp *= 0.54;
    f *= 2.03;
  }
  return sum / maxA;
}

function scratchField(u, v, seed) {
  const g1 = noise2Periodic(u * 140, v * 140, 13, seed);
  const g2 = noise2Periodic(u * 220, v * 20, 17, seed + 3);
  return smoothstep(0.92, 0.98, g1 * 0.5 + g2 * 0.5);
}

function gridLines(u, v, cells, wedge) {
  const gx = fract(u * cells - 1e-4);
  const gz = fract(v * cells - 1e-4);
  const d = Math.min(Math.min(gx, 1 - gx), Math.min(gz, 1 - gz));
  return smoothstep(wedge * 2, wedge, d);
}

/** Tileable presets: height + roughness + metalness in 0–1 space */
const presets = {
  // Industrial cast slab — optimised for dock/subway/outdoor floors
  concrete: S => ({
    seed: S,
    r: [0.56, 0.57, 0.565],
    aoStrength: 0.50,
    height: (u, v) => {
      const joint = gridLines(u, v, 3, 0.012);
      const pit = fbm(u, v, 10, S) * 0.07;
      const wear = scratchField(u * 0.9, v * 1.6, S + 55) * 0.10;
      return (1 - joint) * 0.18 + pit + wear;
    },
    rough: (u, v, _h, sc) =>
      clamp(
        0.78 + sc * 0.12 + fbm(u * 6, v * 6, 13, S) * 0.12,
        0.62,
        0.96
      ),
    metal: () => 0,
    scratch: S + 777
  }),
  paintedMetal: S => ({
    seed: S,
    r: [0.19, 0.2, 0.23],
    aoStrength: 0.52,
    height: (u, v) => {
      const corrug =
        Math.sin(u * Math.PI * 2 * 20) * 0.11 +
        Math.sin(u * Math.PI * 2 * 40 + v * 12) * 0.038;
      const n = fbm(u, v, 11, S);
      const sc = scratchField(u, v, S + 900);
      const drip = noise2Periodic(u * 4, v * 20, 5, S + 3) * 0.045;
      return corrug + n * 0.48 + sc * 0.38 + drip;
    },
    rough(u, v, _h, sc) {
      return clamp(
        0.42 + sc * 0.35 + fbm(u, v, 9, S + 2) * 0.22,
        0.15,
        0.98
      );
    },
    metal(u, v, _h, sc) {
      return clamp(
        0.05 + sc * 0.62 + fbm(u, v, 8, S + 1) * 0.12,
        0,
        1
      );
    },
    scratch: S + 900
  }),
  metal: S => ({
    seed: S,
    r: [0.44, 0.46, 0.49],
    aoStrength: 0.34,
    height: (u, v) => {
      const brush = fract(u * 90 + fbm(u, v, 13, S) * 0.18) * 2 - 1;
      const g = fbm(u, v, 12, S + 5) * 0.28;
      return brush * 0.14 + g;
    },
    rough: (u, v) =>
      clamp(0.22 + fbm(u, v, 10, S) * 0.28, 0.12, 0.75),
    metal: (u, v) =>
      clamp(0.74 + fbm(u, v, 11, S + 3) * 0.08, 0.55, 0.93),
    scratch: S + 901
  }),
  tile: S => ({
    seed: S,
    r: [0.85, 0.87, 0.86],
    aoStrength: 0.72,
    height: (u, v) => {
      const g = gridLines(u, v, 6, 0.018);
      const speck = fbm(u, v, 24, S) * 0.05;
      return (1 - g) * 0.22 + speck;
    },
    rough: (u, v, h) =>
      clamp(0.35 + (1 - clamp(h / 1.8, 0, 1)) * 0.25 + fbm(u, v, 16, S) * 0.12, 0.2, 0.9),
    metal: () => 0,
    scratch: S + 902
  }),
  wood: S => ({
    seed: S,
    r: [0.38, 0.25, 0.12],
    aoStrength: 0.43,
    height: (u, v) => {
      const plank = Math.floor(fract(v * 3.2) * 12.7 + u * 0.3);
      const grain = fbm(u * 2 + plank * 0.11, v * 40, 18, S) * 0.45;
      const ring = Math.sin(v * Math.PI * 2 * 11 + fbm(u, v, 8, S) * 3) * 0.08;
      return grain + ring;
    },
    rough: (u, v) => clamp(0.48 + fbm(u, v, 9, S) * 0.35, 0.25, 0.95),
    metal: () => 0,
    scratch: S + 903
  }),
  rubber: S => ({
    seed: S,
    r: [0.035, 0.038, 0.046],
    aoStrength: 0.38,
    height: (u, v) => fbm(u, v, 19, S) * 0.72 + scratchField(u, v, S) * 0.12,
    rough: (u, v) =>
      clamp(0.87 + noise2Periodic(u * 9, v * 9, 7, S) * 0.08, 0.75, 0.97),
    metal: () => 0,
    scratch: S + 904
  }),
  fabric: S => ({
    seed: S,
    r: [0.145, 0.155, 0.172],
    aoStrength: 0.48,
    height: (u, v) => {
      const wx = Math.sin(u * Math.PI * 2 * 180) * 0.045;
      const wy = Math.sin(v * Math.PI * 2 * 170) * 0.045;
      return wx + wy + fbm(u, v, 15, S) * 0.55;
    },
    rough: (u, v) => clamp(0.72 + fbm(u, v, 11, S) * 0.22, 0.45, 0.97),
    metal: () => 0,
    scratch: S + 905
  }),
  plastic: S => ({
    seed: S,
    r: [0.095, 0.11, 0.132],
    aoStrength: 0.24,
    height: (u, v) => {
      const speck =
        smoothstep(0.55, 0.7, fbm(u * 1.05, v * 1.05, 22, S)) * 0.18;
      return speck + fbm(u, v, 16, S + 1) * 0.08;
    },
    rough: (u, v) => clamp(0.62 + fbm(u, v, 14, S) * 0.28, 0.35, 0.93),
    metal: () => 0,
    scratch: S + 906
  }),
  armor: S => ({
    seed: S,
    r: [0.085, 0.095, 0.118],
    aoStrength: 0.62,
    height: (u, v) => {
      const honey = noise2Periodic(u * 9, v * 9, 11, S);
      return (
        gridLines(u, v, 4, 0.012) ** 3 * -0.2 +
        honey * 0.35 +
        fbm(u, v, 12, S) * 0.38
      );
    },
    rough(u, v, _h, sc) {
      return clamp(0.38 + sc * 0.25 + fbm(u, v, 13, S) * 0.2, 0.2, 0.92);
    },
    metal(u, v, _h, sc) {
      return clamp(0.25 + sc * 0.5 + fbm(u, v, 7, S) * 0.12, 0, 1);
    },
    scratch: S + 907
  }),
  marble: S => ({
    seed: S,
    r: [0.845, 0.815, 0.74],
    aoStrength: 0.42,
    height: (u, v) => {
      const w = smoothstep(
        0.45,
        0.62,
        Math.abs(
          fbm(u, v, 8, S) - fbm(u * 1.3 - v * 0.2, v * 1.1, 8, S + 1)
        )
      );
      const vg = smoothstep(0.35, 0.72, fbm(u * 15, v * 15, 7, S + 2));
      return w * 0.55 + vg * 0.06 + fbm(u, v, 10, S + 3) * 0.05;
    },
    rough(u, v) {
      const veined = scratchField(u * 0.5 + 0.1, v * 0.5, S + 444);
      return clamp(0.18 + veined * 0.45 + fbm(u, v, 9, S) * 0.12, 0.08, 0.72);
    },
    metal: () => 0,
    scratch: S + 908
  }),
  brass: S => ({
    seed: S,
    r: [0.75, 0.58, 0.275],
    aoStrength: 0.38,
    height: (u, v) => {
      const pol =
        fract(u * 60 + noise2Periodic(u * 80, v * 5, 9, S) * 0.4) - 0.5;
      return (
        pol * 0.12 +
        fbm(u, v, 13, S) * 0.35 +
        scratchField(u, v, S) * 0.25
      );
    },
    rough(u, v, _h, sc) {
      return clamp(
        0.2 + sc * 0.38 + fbm(u, v, 11, S) * 0.22,
        0.12,
        0.82
      );
    },
    metal: (u, v) =>
      clamp(0.68 + fbm(u, v, 12, S) * 0.12, 0.5, 0.94),
    scratch: S + 111
  }),
  chrome: S => ({
    seed: S,
    r: [0.655, 0.69, 0.725],
    aoStrength: 0.18,
    height: (u, v) =>
      fract(u * 120 + v * 34) * 0.045 + fbm(u, v, 18, S) * 0.065,
    rough: (u, v) =>
      clamp(0.08 + noise2Periodic(u * 6, v * 6, 9, S) * 0.08, 0.06, 0.28),
    metal: (u, v) =>
      clamp(0.9 + noise2Periodic(u * 3, v * 3, 5, S) * 0.07, 0.82, 0.98),
    scratch: S + 909
  }),
  leather: S => ({
    seed: S,
    r: [0.228, 0.135, 0.086],
    aoStrength: 0.53,
    height: (u, v) => {
      const cell = noise2Periodic(
        u * 3.2 + fbm(u, v, 5, S),
        v * 3.2 - fbm(u, v, 5, S + 9),
        7,
        S
      );
      return (
        cell * 0.48 +
        fbm(u, v, 14, S + 1) * 0.35 +
        scratchField(u * 8, v * 8, S + 222) * 0.08
      );
    },
    rough: (u, v) =>
      clamp(0.62 + fbm(u * 8, v * 8, 17, S) * 0.26, 0.35, 0.94),
    metal: () => 0,
    scratch: S + 910
  })
};

function getPresetFn(id) {
  const maker = presets[id];
  if (!maker) throw new Error(`unknown material "${id}"`);
  return maker(seedFrom(id));
}

function hIx(buf, ix, iy) {
  const x = (ix % SIZE + SIZE) % SIZE;
  const y = (iy % SIZE + SIZE) % SIZE;
  return buf[y * SIZE + x];
}

function deriveNormal(ix, iy, buf, strength = 5.25) {
  const hl = hIx(buf, ix - 1, iy);
  const hr = hIx(buf, ix + 1, iy);
  const hu = hIx(buf, ix, iy - 1);
  const hv = hIx(buf, ix, iy + 1);
  const dhdx = (hr - hl) * 0.5 * SIZE * strength / 255;
  const dhdy = (hv - hu) * 0.5 * SIZE * strength / 255;
  let nx = -dhdx;
  let ny = -dhdy;
  let nz = 1;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  return {
    rr: clamp(Math.floor((nx * 0.5 + 0.5) * 255), 0, 255),
    gg: clamp(Math.floor((ny * 0.5 + 0.5) * 255), 0, 255),
    bb: clamp(Math.floor((nz * 0.5 + 0.5) * 255), 0, 255)
  };
}

function laplacian(buf, ix, iy) {
  const c = hIx(buf, ix, iy);
  const hl = hIx(buf, ix - 1, iy);
  const hr = hIx(buf, ix + 1, iy);
  const hu = hIx(buf, ix, iy - 1);
  const hv = hIx(buf, ix, iy + 1);
  return Math.abs(hl + hr + hu + hv - 4 * c);
}

function writePNG(filePath, width, height, rgbaFn) {
  const png = new PNG({ width, height, colorType: 6 });
  let i = 0;
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      const { r, g, b, a } = rgbaFn(xx, yy);
      png.data[i++] = r;
      png.data[i++] = g;
      png.data[i++] = b;
      png.data[i++] = a;
    }
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function gray(v) {
  const g = clamp(Math.round(v * 255), 0, 255);
  return { r: g, g: g, b: g, a: 255 };
}

function generateMaterial(id) {
  const p = getPresetFn(id);
  const dir = path.join(MAT_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  const aoPath = path.join(dir, `${id}-ao.png`);
  if (!FORCE && fs.existsSync(aoPath)) {
    console.log(`[skip] ${id} (exists — set FORCE=1 to overwrite)`);
    return;
  }

  console.log(`[gen] ${id} @ ${SIZE}×${SIZE}`);

  const bufH = new Float32Array(SIZE * SIZE);
  const bufRough = new Float32Array(SIZE * SIZE);
  const bufMetal = new Float32Array(SIZE * SIZE);

  let minH = 1e9;
  let maxH = -1e9;

  for (let iy = 0; iy < SIZE; iy++) {
    for (let ix = 0; ix < SIZE; ix++) {
      const u = fract((ix + 0.5) / SIZE);
      const v = fract((iy + 0.5) / SIZE);
      const hi = iy * SIZE + ix;
      const h = p.height(u, v);
      bufH[hi] = h;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;

      const sc = scratchField(u, v, p.scratch ?? p.seed + 900);
      const roughFn = typeof p.rough === 'function' ? p.rough : () => 0.52;
      const metalFn = typeof p.metal === 'function' ? p.metal : () => 0;
      bufRough[hi] =
        roughFn.length >= 4
          ? roughFn(u, v, h, sc)
          : roughFn(u, v, h);
      bufMetal[hi] =
        metalFn.length >= 4
          ? metalFn(u, v, h, sc)
          : metalFn(u, v, h);

      if (Number.isNaN(bufMetal[hi])) bufMetal[hi] = 0;
    }
  }

  const hSpan = Math.max(maxH - minH, 1e-6);

  writePNG(path.join(dir, `${id}-albedo.png`), SIZE, SIZE, (ix, iy) => {
    const u = fract((ix + 0.5) / SIZE);
    const v = fract((iy + 0.5) / SIZE);
    const hi = iy * SIZE + ix;
    const hn = (bufH[hi] - minH) / hSpan;
    const grime = scratchField(u, v, p.seed + 500) * 0.18;
    const micro = noise2Periodic(u * 120, v * 120, 13, p.seed + 21) * 0.06;
    const mod = clamp(1 - grime - micro + (hn - 0.5) * 0.14, 0.55, 1.08);
    let rr = clamp(Math.round(255 * p.r[0] * mod), 0, 255);
    let gg = clamp(Math.round(255 * p.r[1] * mod), 0, 255);
    let bb = clamp(Math.round(255 * p.r[2] * mod), 0, 255);
    return { r: rr, g: gg, b: bb, a: 255 };
  });

  writePNG(path.join(dir, `${id}-normal.png`), SIZE, SIZE, (ix, iy) => {
    const n = deriveNormal(ix, iy, bufH);
    return { r: n.rr, g: n.gg, b: n.bb, a: 255 };
  });

  writePNG(path.join(dir, `${id}-roughness.png`), SIZE, SIZE, (ix, iy) =>
    gray(bufRough[iy * SIZE + ix])
  );

  writePNG(path.join(dir, `${id}-metalness.png`), SIZE, SIZE, (ix, iy) =>
    gray(bufMetal[iy * SIZE + ix])
  );

  writePNG(path.join(dir, `${id}-ao.png`), SIZE, SIZE, (ix, iy) => {
    const lap = laplacian(bufH, ix, iy);
    const aoVal = clamp(1 - p.aoStrength * Math.min(lap * 42, 0.92), 0.04, 1);
    return gray(aoVal);
  });
}

const IDS = Object.keys(presets);
for (const id of IDS) {
  if (ONLY && !ONLY.has(id)) continue;
  generateMaterial(id);
}

console.log(
  `[done] procedural materials → ${path.relative(ROOT, MAT_ROOT)} (${IDS.length} sets)`
);
