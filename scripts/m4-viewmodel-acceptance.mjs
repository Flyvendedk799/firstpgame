import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots/m4-viewmodel');
fs.mkdirSync(OUT_DIR, { recursive: true });

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function nonBlankPng(buffer) {
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let lit = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const luma = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    min = Math.min(min, luma);
    max = Math.max(max, luma);
    if (luma > 8) lit++;
  }
  return { min, max, litRatio: lit / (png.width * png.height) };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
});

const url = new URL(BASE_URL);
url.searchParams.set('perf', '1');
url.searchParams.set('renderer', 'webgl');
await page.goto(url.toString(), { waitUntil: 'load', timeout: 30000 });
await page.addStyleTag({
  content: `
    #overlay,
    #story-card,
    #dossier-card,
    #briefing-card,
    #deploy-loading,
    #pause-menu,
    #onboard-card,
    #attach-toast,
    #tutorial-toast {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `
});
console.log('[m4] page loaded');
await page.waitForFunction(() => window.__game?.debug?.weaponVisualStatus, null, { timeout: 45000 });
console.log('[m4] debug ready');
const playableWeapons = await page.evaluate(() => window.__game.debug.playableWeaponIndices?.() || []);
if (!playableWeapons.includes(0)) {
  const summary = { ok: true, skipped: true, reason: 'M4 removed from playable loadout' };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  await context.close();
  await browser.close();
  process.exit(0);
}
await page.waitForFunction(() => {
  const st = window.__game.debug.weaponVisualStatus();
  return st.authoredWeaponSource !== 'pending' && st.authoredHandSource !== 'pending';
}, null, { timeout: 30000 });
console.log('[m4] authored assets resolved');

await page.evaluate(() => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  const P = dbg.P();
  G.started = true;
  G.menuOpen = false;
  G.invOpen = false;
  G.shopOpen = false;
  G.paused = false;
  G.splitScreenActive = false;
  P.dead = false;
  P.pos.set(0, 0.2, 18);
  P.yaw = Math.PI;
  P.pitch = 0;
  P.weaponIdx = 1;
  dbg.switchWeapon(0);
  dbg.setAds(0);
});
await page.waitForTimeout(250);
const setup = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
console.log('[m4] setup checked');

assert(setup.authoredWeaponSource === 'authored', `M4 did not load authored source: ${JSON.stringify(setup)}`);
assert(setup.authoredM4Active === true, `M4 authored viewmodel inactive: ${JSON.stringify(setup)}`);
assert(setup.authoredM4VisibleMeshes > 0, `M4 authored mesh not visible: ${JSON.stringify(setup)}`);
assert(['baked-weapon', 'authored', 'fallback-procedural'].includes(setup.authoredHandSource), `M4 hands did not resolve: ${JSON.stringify(setup)}`);
if (setup.authoredHandSource === 'authored') {
  assert(setup.authoredHandVisibleMeshes > 0, `authored hand meshes not visible: ${JSON.stringify(setup)}`);
  assert(setup.authoredWristband?.configured, `authored wristband not configured: ${JSON.stringify(setup.authoredWristband)}`);
  assert(!setup.authoredWristband?.rootVisible, `authored wristband should be hidden during clean M4 hold: ${JSON.stringify(setup.authoredWristband)}`);
  assert(!setup.authoredWristband?.screenVisible, `authored wristband screen should be hidden during clean M4 hold: ${JSON.stringify(setup.authoredWristband)}`);
  assert(!setup.authoredWristband?.idleRayVisible, `authored wristband idle ray should be hidden during clean M4 hold: ${JSON.stringify(setup.authoredWristband)}`);
} else if (setup.authoredHandSource === 'baked-weapon') {
  assert(setup.m4BakedHandVisibleMeshes > 0, `baked M4 rifle-hold hands not visible: ${JSON.stringify(setup)}`);
  assert(setup.authoredHandVisibleMeshes === 0, `shared hand rig should be hidden while baked M4 hands are active: ${JSON.stringify(setup)}`);
} else {
  assert(setup.leftHandVisible && setup.rightHandVisible, `procedural hands fallback not visible: ${JSON.stringify(setup)}`);
}
assert(setup.authoredM4SocketValidation?.ok, `M4 socket validation failed: ${JSON.stringify(setup.authoredM4SocketValidation)}`);
assert(setup.authoredM4HandValidation?.ok, `hand validation failed: ${JSON.stringify(setup.authoredM4HandValidation)}`);

async function sampleWristHologram(kind, expectedClip, visibleKey, valueKey) {
  await page.evaluate(({ kind }) => {
    const dbg = window.__game.debug;
    const P = dbg.P();
    P.reloading = false;
    dbg.setWristbandHologram('inventory', false);
    dbg.setWristbandHologram('shop', false);
    dbg.setWristbandHologram('reload', false);
    dbg.setWristbandHologram(kind, true);
  }, { kind });
  const samples = [await page.evaluate(() => window.__game.debug.weaponVisualStatus())];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(90);
    samples.push(await page.evaluate(() => window.__game.debug.weaponVisualStatus()));
  }
  const values = samples.map(s => s.authoredWristband?.deployValues?.[valueKey] ?? 0);
  const peak = Math.max(...values);
  const early = values[0];
  const late = values[values.length - 1];
  const final = samples[samples.length - 1];
  const expectedClips = Array.isArray(expectedClip) ? expectedClip : [expectedClip];
  if (expectedClips.length) {
    assert(samples.some(s => expectedClips.includes(s.activeHandClip)), `${kind} clip did not play: ${JSON.stringify(samples.map(s => s.activeHandClip))}`);
  }
  assert(peak > 0.45, `${kind} hologram did not deploy enough: ${JSON.stringify(values)}`);
  assert(late >= early, `${kind} hologram did not progress smoothly: ${JSON.stringify(values)}`);
  assert(final.authoredWristband?.rootVisible, `${kind} wristband root not visible during deploy: ${JSON.stringify(final.authoredWristband)}`);
  assert(final.authoredWristband?.[visibleKey], `${kind} hologram not visible at peak: ${JSON.stringify(final.authoredWristband)}`);
  await page.evaluate(({ kind }) => window.__game.debug.setWristbandHologram(kind, false), { kind });
  await page.waitForTimeout(800);
  const stowed = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
  assert((stowed.authoredWristband?.deployValues?.[valueKey] ?? 1) < 0.15, `${kind} hologram did not stow smoothly: ${JSON.stringify(stowed.authoredWristband)}`);
  assert(!stowed.authoredWristband?.rootVisible, `${kind} wristband root did not hide after stow: ${JSON.stringify(stowed.authoredWristband)}`);
  return { kind, values, final: final.authoredWristband, stowed: stowed.authoredWristband };
}

let wristHolograms = null;
if (setup.authoredHandSource === 'authored') {
  wristHolograms = {
    inventory: await sampleWristHologram('inventory', [], 'inventoryVisible', 'inventory'),
    reload: await sampleWristHologram('reload', [], 'reloadVisible', 'reload'),
    shop: await sampleWristHologram('shop', [], 'shopVisible', 'shop')
  };
  console.log('[m4] wrist holograms checked');
}

const hip = await page.screenshot({ path: path.join(OUT_DIR, 'm4-hipfire.png') });
console.log('[m4] hipfire captured');
const hipStats = nonBlankPng(hip);
assert(hipStats.litRatio > 0.04 && hipStats.max - hipStats.min > 12, `hipfire screenshot blank-ish: ${JSON.stringify(hipStats)}`);

await page.evaluate(() => {
  const dbg = window.__game.debug;
  dbg.equipScope(4);
  dbg.setAds(1);
});
await page.waitForTimeout(450);
const ads = await page.evaluate(() => {
  const dbg = window.__game.debug;
  return { weapon: dbg.weaponVisualStatus(), pip: dbg.scopePip() };
});
console.log('[m4] ads checked');
assert(ads.weapon.authoredM4Active, 'authored M4 deactivated during ADS');
if (!ads.weapon.authoredM4Active) {
  assert(ads.weapon.scopeVisible, 'scope attachment not visible during ADS');
}
if (ads.weapon.stableRenderingMode || ads.pip.stableRenderingMode) {
  assert(!ads.pip.enabled && !ads.pip.visible, `stable renderer should keep scope PIP disabled: ${JSON.stringify(ads.pip)}`);
} else {
  assert(ads.pip.enabled, `scope PIP not enabled: ${JSON.stringify(ads.pip)}`);
}
const adsShot = await page.screenshot({ path: path.join(OUT_DIR, 'm4-ads-scoped.png') });
console.log('[m4] ads captured');
assert(nonBlankPng(adsShot).litRatio > 0.04, 'ADS screenshot blank-ish');

await page.evaluate(() => {
  const dbg = window.__game.debug;
  dbg.fireCurrentWeapon();
});
await page.waitForTimeout(60);
const fire = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
console.log('[m4] fire checked');
assert(fire.activeWeaponClip === 'fire', `fire clip did not trigger: ${JSON.stringify(fire)}`);
assert(fire.authoredM4Active && fire.authoredM4VisibleMeshes > 0, 'M4 not visible after fire');
await page.screenshot({ path: path.join(OUT_DIR, 'm4-fire.png') });
console.log('[m4] fire captured');

await page.evaluate(() => {
  const dbg = window.__game.debug;
  dbg.startReloadCurrentWeapon();
});
await page.waitForTimeout(300);
const reloadEarly = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
assert(reloadEarly.activeWeaponClip === 'reload', `reload clip did not scrub: ${JSON.stringify(reloadEarly)}`);
if (reloadEarly.authoredHandSource === 'authored') {
  assert(reloadEarly.authoredWristband?.reloadVisible, `authored reload hologram did not deploy: ${JSON.stringify(reloadEarly.authoredWristband)}`);
  const reloadPanel = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const scene = dbg.scene();
    const camera = dbg.camera();
    let panel = null;
    scene.traverse(o => {
      if (o.name === 'hologram_reload_panel_mesh') panel = o;
    });
    if (!panel?.geometry?.attributes?.position) return null;
    camera.updateMatrixWorld(true);
    panel.updateMatrixWorld(true);
    const position = panel.getWorldPosition(camera.position.clone());
    const attr = panel.geometry.attributes.position;
    const points = [];
    for (let i = 0; i < attr.count; i++) {
      const p = position.clone().set(attr.getX(i), attr.getY(i), attr.getZ(i));
      panel.localToWorld(p);
      points.push(p.project(camera));
    }
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const pixelWidth = (maxX - minX) * 640;
    const pixelHeight = (maxY - minY) * 360;
    const pixelAspect = pixelWidth / Math.max(1, pixelHeight);
    return {
      pixelWidth,
      pixelHeight,
      pixelAspect,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  });
  assert(reloadPanel, 'authored reload hologram panel mesh not found');
  assert(reloadPanel.pixelWidth > 70 && reloadPanel.pixelHeight > 100, `reload hologram panel too small or edge-on: ${JSON.stringify(reloadPanel)}`);
  assert(reloadPanel.pixelAspect > 0.52 && reloadPanel.pixelAspect < 0.82, `reload hologram panel should be player-facing portrait: ${JSON.stringify(reloadPanel)}`);
  assert(Math.abs(reloadPanel.centerX) < 0.65 && Math.abs(reloadPanel.centerY) < 0.55, `reload hologram panel outside readable view: ${JSON.stringify(reloadPanel)}`);
}
await page.screenshot({ path: path.join(OUT_DIR, 'm4-reload.png') });
console.log('[m4] reload captured');
await page.waitForTimeout(650);
const reloadDrop = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  return {
    weapon: dbg.weaponVisualStatus(),
    droppedMags: G.trails.filter(t => t && t.isDroppedMag).length
  };
});
assert(reloadDrop.droppedMags > 0, `dropped mag did not spawn during reload: ${JSON.stringify(reloadDrop)}`);
await page.waitForTimeout(1700);
const reload = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  return {
    weapon: dbg.weaponVisualStatus(),
    droppedMags: G.trails.filter(t => t && t.isDroppedMag).length
  };
});
console.log('[m4] reload checked');

const inspect = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const P = dbg.P();
  P.reloading = false;
  return dbg.startInspectCurrentWeapon();
});
assert(inspect.activeWeaponClip === 'inspect', `inspect clip did not trigger: ${JSON.stringify(inspect)}`);
await page.waitForTimeout(90);
console.log('[m4] inspect checked');
await page.screenshot({ path: path.join(OUT_DIR, 'm4-inspect.png') });
console.log('[m4] inspect captured');
await page.evaluate(() => window.__game.debug.endInspectCurrentWeapon());

const fallback = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const on = dbg.forceM4AuthoredFallback(true);
  const off = dbg.forceM4AuthoredFallback(false);
  return { on, off };
});
console.log('[m4] fallback checked');
assert(fallback.on.authoredWeaponSource === 'fallback-forced', `fallback force missing: ${JSON.stringify(fallback.on)}`);
assert(fallback.on.visibleProceduralMeshes > 0, `procedural M4 fallback not visible: ${JSON.stringify(fallback.on)}`);
assert(fallback.off.authoredWeaponSource === 'authored', `authored M4 did not restore: ${JSON.stringify(fallback.off)}`);

if (errors.length) throw new Error(`browser errors: ${JSON.stringify(errors)}`);

const report = { ok: true, setup, wristHolograms, ads, fire, reload, inspect, fallback, screenshots: OUT_DIR };
fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, report: path.join(OUT_DIR, 'report.json') }, null, 2));

await context.close();
await browser.close();
