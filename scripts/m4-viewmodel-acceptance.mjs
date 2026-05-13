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
console.log('[m4] page loaded');
await page.waitForFunction(() => window.__game?.debug?.weaponVisualStatus, null, { timeout: 45000 });
console.log('[m4] debug ready');
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
assert(setup.authoredHandSource === 'authored', `authored hands did not load: ${JSON.stringify(setup)}`);
assert(setup.authoredM4SocketValidation?.ok, `M4 socket validation failed: ${JSON.stringify(setup.authoredM4SocketValidation)}`);
assert(setup.authoredM4HandValidation?.ok, `hand validation failed: ${JSON.stringify(setup.authoredM4HandValidation)}`);

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
assert(ads.weapon.scopeVisible, 'scope attachment not visible during ADS');
assert(ads.pip.enabled, `scope PIP not enabled: ${JSON.stringify(ads.pip)}`);
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
await page.screenshot({ path: path.join(OUT_DIR, 'm4-reload.png') });
console.log('[m4] reload captured');
await page.waitForTimeout(3000);
const reload = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  return {
    weapon: dbg.weaponVisualStatus(),
    droppedMags: G.trails.filter(t => t && t.isDroppedMag).length
  };
});
console.log('[m4] reload checked');
assert(reload.droppedMags > 0, `dropped mag did not spawn: ${JSON.stringify(reload)}`);

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

const report = { ok: true, setup, ads, fire, reload, inspect, fallback, screenshots: OUT_DIR };
fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, report: path.join(OUT_DIR, 'report.json') }, null, 2));

await context.close();
await browser.close();
