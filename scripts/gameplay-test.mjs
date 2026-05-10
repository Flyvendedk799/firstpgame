import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();

const consoleEvents = [];
page.on('console', msg => {
  consoleEvents.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', err => {
  consoleEvents.push({ type: 'pageerror', text: err.message });
});

console.log('navigating...');
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });

// Wait for assets to finish loading
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-menu.png') });

// Click the DEPLOY button to start. Pointer-lock will be requested but we ignore
// it; the game's main loop runs anyway.
console.log('clicking deploy...');
await page.evaluate(() => {
  // Find the DEPLOY button by text and click it
  const btns = [...document.querySelectorAll('button, .menu-cta, .menu-cta-go')];
  const deploy = btns.find(b => /deploy/i.test(b.textContent || ''));
  if (deploy) deploy.click();
});

await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-intro.png') });

// Skip intro: click + press Space + Escape repeatedly
console.log('skipping intro...');
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(800);
}
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-after-intro-skip.png') });

// Wait for actual gameplay frames
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-gameplay.png') });

// Spawn an enemy directly for visual inspection
console.log('spawning soldier for inspection...');
const spawnResult = await page.evaluate(() => {
  try {
    if (typeof Enemy !== 'undefined' && window.scene && window.G && window.G.enemyMgr) {
      const e = new Enemy(window.scene, new (window.THREE.Vector3)(0, 0.2, 12), 1, 'soldier');
      window.G.enemyMgr._list = window.G.enemyMgr._list || [];
      window.G.enemyMgr._list.push(e);
      return 'spawned';
    }
    return 'unable: classes not on window';
  } catch (err) {
    return 'error: ' + err.message;
  }
});
console.log('spawn result:', spawnResult);
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-after-spawn.png') });

// Switch to Deagle (key 2)
console.log('pressing 2 for Deagle...');
await page.keyboard.press('Digit2');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-deagle.png') });

// Summary
const errors = consoleEvents.filter(e => e.type === 'error' || e.type === 'pageerror');
const warnings = consoleEvents.filter(e => e.type === 'warning' || e.type === 'warn');
const logs = consoleEvents.filter(e => e.type === 'log');

console.log('\n=== ERRORS ===');
errors.forEach(e => console.log(`  ${e.type}: ${e.text}`));
console.log('\n=== INTERESTING LOGS ===');
logs.filter(l => /soldier|deagle|rig|anim|glb|gltf|skeleton|G keys/i.test(l.text)).forEach(l => console.log('  ' + l.text));

const debugSnap = await page.evaluate(() => {
  return window.__game?.debug?.snapshot?.() || null;
});
console.log('\n=== GAME STATE ===');
console.log(JSON.stringify(debugSnap, null, 2));

console.log('\nerrors:', errors.length, '/ warnings:', warnings.length);

await context.close();
await browser.close();
