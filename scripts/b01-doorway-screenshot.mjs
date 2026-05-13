/**
 * Headless B01 doorway check: rebuild level 1, measure AABB overlap along the
 * east zone-door approach, render one frame, write PNGs to ./screenshots/.
 *
 * Requires a running static server (default: vite preview on 4173).
 *   npm run build && npm run preview &
 *   BASE_URL=http://127.0.0.1:4173/ node scripts/b01-doorway-screenshot.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[page]', msg.text());
});

await page.goto(`${BASE_URL}?perf=1`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__game && window.__game.debug && window.__game.debug.buildLevel, null, {
  timeout: 120000,
});

const report = await page.evaluate(() => {
  function aabbOverlap2d(a, b) {
    return a.x1 > b.x0 && a.x0 < b.x1 && a.z1 > b.z0 && a.z0 < b.z1;
  }
  const dbg = window.__game.debug;
  const ld = dbg.buildLevel(1);
  const G = dbg.G();
  G.started = true;
  G.building = 1;
  G.levelData = ld;
  const zs = ld.zoneBounds && ld.zoneBounds.zSplit != null ? ld.zoneBounds.zSplit : 6;
  const door = ld.zoneDoors && ld.zoneDoors[0];
  const we = door && door.wallEntry;
  // Approach prism: walk from z≈10 toward the door at x≈5 (player cannot slip east of x=5.25 if a wall blocks).
  const corridor = { x0: 3.2, x1: 6.6, z0: zs + 0.35, z1: 10.8 };
  const overlaps = [];
  if (ld.walls && we) {
    for (const w of ld.walls) {
      if (!w || w === we || w.broken || w.isWindow) continue;
      if (aabbOverlap2d(w, corridor)) {
        overlaps.push({
          x0: w.x0,
          x1: w.x1,
          z0: w.z0,
          z1: w.z1,
          isWindow: !!w.isWindow,
        });
      }
    }
  }
  const scene = dbg.scene();
  const camera = dbg.camera();
  const renderer = dbg.renderer();
  const P = dbg.P();
  if (typeof P.pos?.set === 'function') {
    P.pos.set(5, 0.2, 10.2);
    P.yaw = Math.PI;
  }
  camera.position.set(5, 1.72, 10.45);
  camera.lookAt(5, 1.55, zs);
  camera.updateProjectionMatrix();
  if (renderer.setSize) renderer.setSize(1280, 720);
  renderer.render(scene, camera);
  return { zs, corridor, overlapCount: overlaps.length, overlaps, png: document.getElementById('c')?.toDataURL('image/png') || null };
});

if (report.png) {
  const buf = Buffer.from(report.png.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUT_DIR, 'b01-doorway-approach.png'), buf);
} else {
  console.warn('No canvas PNG (missing #c or WebGL toDataURL blocked).');
}
delete report.png;

console.log(JSON.stringify(report, null, 2));
if (report.overlapCount > 0) {
  console.warn(
    `Found ${report.overlapCount} wall AABB(s) intersecting the east-door approach corridor (see overlaps in JSON).`
  );
} else {
  console.log('No wall AABBs intersect the east-door approach corridor (good).');
}

await browser.close();
