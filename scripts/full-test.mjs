import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SHOTS = path.resolve('./screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const events = [];
page.on('console', m => events.push({ t: m.type(), x: m.text() }));
page.on('pageerror', e => events.push({ t: 'pageerror', x: e.message }));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(7000);  // assets to load
await page.screenshot({ path: SHOTS + '/01-menu.png' });

// Click DEPLOY
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .menu-cta, .menu-cta-go')]
    .find(el => /deploy/i.test(el.textContent || ''));
  if (b) b.click();
});
await page.waitForTimeout(1500);

// Skip intro: rapidly press Space
for (let i = 0; i < 30; i++) {
  await page.keyboard.press('Space');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(250);
}

await page.screenshot({ path: SHOTS + '/02-after-skip.png' });
await page.waitForTimeout(2000);
await page.screenshot({ path: SHOTS + '/03-gameplay.png' });

// Probe state of GLB-loaded assets
const probe = await page.evaluate(() => {
  return {
    SOLDIER_GLTF_loaded: !!window.SOLDIER_GLTF || !!window.MESHY_CHAR,
    DEAGLE_GLB_loaded: !!window.DEAGLE_GLB,
    deagleGlbRig: !!window.deagleGlbRig,
    deagleGlbRig_visible: window.deagleGlbRig?.visible,
    deagleGlbRig_scale: window.deagleGlbRig?.scale ? window.deagleGlbRig.scale.toArray() : null,
    P_weaponIdx: window.P?.weaponIdx,
    G_started: window.G?.started,
    enemy_count: window.G?.enemyMgr?._list?.length,
  };
});
console.log('PROBE:', JSON.stringify(probe, null, 2));

// Try to spawn a soldier directly
const spawnRes = await page.evaluate(() => {
  try {
    const E = window.Enemy;
    if (!E) return 'Enemy class not on window';
    if (!window.scene || !window.G || !window.G.enemyMgr) return 'scene/G missing';
    const e = new E(window.scene, new window.THREE.Vector3(2, 0.2, 14), 1, 'soldier');
    window.G.enemyMgr._list ||= [];
    window.G.enemyMgr._list.push(e);
    return { ok: true, hasMixer: !!e.mixer, hasRig: !!e.meshyRig, actions: e.actions ? Object.keys(e.actions) : null };
  } catch (err) {
    return 'error: ' + err.message;
  }
});
console.log('SPAWN:', JSON.stringify(spawnRes, null, 2));

await page.waitForTimeout(2000);
await page.screenshot({ path: SHOTS + '/04-with-soldier.png' });

// Switch to weapon 2 (Deagle slot)
await page.keyboard.press('Digit2');
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOTS + '/05-deagle.png' });

// Re-probe Deagle state after switch
const probe2 = await page.evaluate(() => ({
  P_weaponIdx: window.P?.weaponIdx,
  deagleGlbRig: !!window.deagleGlbRig,
  deagleGlbRig_visible: window.deagleGlbRig?.visible,
  deagleGlbRig_scale: window.deagleGlbRig?.scale?.toArray(),
  deagleGlbRig_position: window.deagleGlbRig?.position?.toArray(),
}));
console.log('PROBE2:', JSON.stringify(probe2, null, 2));

const errors = events.filter(e => e.t === 'error' || e.t === 'pageerror');
console.log('\nERRORS:', errors.length);
errors.forEach(e => console.log(' -', e.x.slice(0, 200)));

await context.close();
await browser.close();
