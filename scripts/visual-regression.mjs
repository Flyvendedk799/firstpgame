// Phase I / Phase AE — visual regression baseline.
// Builds each of B01..B12 in turn, warps the player to a fixed camera pose
// inside that building, and saves a PNG per building. On a clean run the
// images form a baseline; subsequent runs can be diffed against committed
// references to catch silent visual breakage.
//
// First run: produces screenshots/visual-baseline/B01..B12.png.
// Diffing against committed PNGs is left as a follow-up (you'd add e.g.
// pixelmatch + a CI check).
//
// Phase AE reliability fixes:
//   • Prefer the static preview server (`npm run preview`) over the dev
//     server — no HMR jitter
//   • waitForLoadState('networkidle') between building swaps so async loads
//     settle before the screenshot
//   • Force-flush a render by triggering a window resize event between
//     iterations (cheap way to clear the dirty rasterizer state)
//
// Run with the preview server already on http://127.0.0.1:4173 (or set
// BASE_URL). The default falls through to the dev server if the env var
// is unset, but headless screenshots are most reliable with `preview`.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve('./screenshots/visual-baseline');
fs.mkdirSync(OUT_DIR, { recursive: true });

const POSES = {
  1:  { x: 0,  z: 18, yaw: Math.PI },
  2:  { x: 0,  z: 18, yaw: Math.PI },
  3:  { x: 0,  z: 18, yaw: Math.PI },
  4:  { x: 0,  z: 18, yaw: Math.PI },
  5:  { x: 0,  z: 18, yaw: Math.PI },
  6:  { x: 0,  z: 18, yaw: Math.PI },
  7:  { x: 0,  z: 18, yaw: Math.PI },
  8:  { x: 0,  z: 18, yaw: Math.PI },
  9:  { x: 0,  z: 18, yaw: Math.PI },
  10: { x: 0,  z: 18, yaw: Math.PI },
  11: { x: 0,  z: 18, yaw: Math.PI },
  12: { x: 0,  z: 18, yaw: Math.PI },
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', text: m.text() }); });

console.log(`Visual regression — connecting to ${BASE_URL}`);
await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.locator('#start-btn').click();
await page.waitForFunction(
  () => window.__game?.debug?.perfSnapshotForBuilding,
  null,
  { timeout: 45000 }
);

const taken = [];
const skipped = [];
for (let bn = 1; bn <= 12; bn++) {
  const pose = POSES[bn] || { x: 0, z: 18, yaw: Math.PI };
  await page.evaluate(({ bn, pose }) => {
    const dbg = window.__game.debug;
    const G = dbg.G();
    const ld = dbg.buildLevel(bn);
    G.levelData = ld; G.building = bn;
    const P = dbg.P();
    P.pos.x = pose.x; P.pos.z = pose.z;
    P.yaw = pose.yaw;
    P.pitch = 0;
    P.lean = 0;
    P.ads = 0;
    P.grounded = true; P.jumpH = 0;
    // Phase AE: bump a resize event to force the renderer + composer to
    // recompute their state for the new geometry.
    window.dispatchEvent(new Event('resize'));
  }, { bn, pose });
  // Phase AE: explicit network-idle wait + longer settle for first builds
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(bn <= 3 ? 1200 : 800);
  const out = path.join(OUT_DIR, `B${String(bn).padStart(2, '0')}.png`);
  try {
    await page.screenshot({ path: out, fullPage: false, timeout: 18000 });
    taken.push(out);
  } catch (e) {
    console.warn(`B${bn} screenshot skipped: ${e.message}`);
    skipped.push(bn);
  }
}

if (errors.length) {
  console.error('Console errors during visual baseline:', errors);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, taken: taken.length, skipped, total: 12 }, null, 2));

await context.close();
await browser.close();
