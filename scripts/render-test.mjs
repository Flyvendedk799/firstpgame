import { chromium } from 'playwright';
import path from 'path';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const events = [];
page.on('console', m => events.push(m.text()));
page.on('pageerror', e => events.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(8000);  // assets

// Force-start by hiding menu overlay AND setting G.started=true so the render
// loop renders the world (not the early-out branch).
await page.evaluate(() => {
  const dbg = window.__game?.debug;
  // Hide menu overlay
  const ov = document.getElementById('overlay');
  if (ov) ov.classList.add('hidden');
  // Force game-started
  if (dbg && dbg.G) {
    const G = dbg.G();
    if (G) G.started = true;
  }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/render-01-game-started.png' });

// Switch to Deagle
await page.evaluate(() => window.__game?.debug?.switchWeapon?.(1));
await page.waitForTimeout(1200);
await page.screenshot({ path: 'screenshots/render-02-deagle-active.png' });

// Probe deagle world bbox
const probe = await page.evaluate(() => {
  const dbg = window.__game?.debug;
  const r = dbg?.deagleGlbRig();
  if (!r) return null;
  const bb = new window.THREE.Box3().setFromObject(r);
  const cam = dbg.camera();
  return {
    visible: r.visible,
    rigWorldPos: (() => { const v = new window.THREE.Vector3(); r.getWorldPosition(v); return v.toArray().map(x=>+x.toFixed(3)); })(),
    cameraPos: cam.position.toArray().map(x=>+x.toFixed(3)),
    bbox: { min: bb.min.toArray().map(x=>+x.toFixed(3)), max: bb.max.toArray().map(x=>+x.toFixed(3)) },
    P_weaponIdx: dbg.P()?.weaponIdx,
  };
});
console.log('PROBE:', JSON.stringify(probe, null, 2));

// Move the camera to verify the deagle stays attached (this is the test for
// whether the no-rebind fix works — old bug was the gun would slide as the
// camera moved)
await page.evaluate(() => {
  const dbg = window.__game?.debug;
  const P = dbg.P();
  if (P && P.pos) { P.pos.x += 4; P.pos.z += 4; }
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/render-03-after-camera-move.png' });

const probe2 = await page.evaluate(() => {
  const dbg = window.__game?.debug;
  const r = dbg?.deagleGlbRig();
  if (!r) return null;
  const cam = dbg.camera();
  const v = new window.THREE.Vector3(); r.getWorldPosition(v);
  return {
    rigWorldPos: v.toArray().map(x=>+x.toFixed(3)),
    cameraPos: cam.position.toArray().map(x=>+x.toFixed(3)),
    rigOffsetFromCam: v.clone().sub(cam.position).toArray().map(x=>+x.toFixed(3)),
  };
});
console.log('AFTER MOVE:', JSON.stringify(probe2, null, 2));

console.log('errors:', events.filter(e=>e.startsWith('PAGEERROR')).length);

await ctx.close();
await browser.close();
