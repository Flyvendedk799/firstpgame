import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const consoleEvents = [];
page.on('console', msg => {
  consoleEvents.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', err => {
  consoleEvents.push({ type: 'pageerror', text: err.message });
});

try {
  console.log(`navigating ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__game?.debug?.snapshot, null, { timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-menu.png') });

  console.log('clicking deploy...');
  await page.evaluate(() => {
    const deploy = [...document.querySelectorAll('button, .menu-cta, .menu-cta-go')]
      .find(b => /deploy/i.test(b.textContent || ''));
    if (!deploy) throw new Error('Deploy button not found');
    deploy.click();
  });

  await page.waitForTimeout(1500);
  console.log('skipping intro...');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.mouse.click(640, 400);
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-after-intro-skip.png') });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-gameplay.png') });

  console.log('spawning soldier for inspection...');
  const spawnResult = await page.evaluate(() => {
    const dbg = window.__game?.debug;
    if (!dbg?.spawnAt || !dbg?.G) throw new Error('debug spawn helpers missing');
    const before = dbg.G().enemyMgr?._list?.length || 0;
    const enemy = dbg.spawnAt('soldier', 0, 12);
    const after = dbg.G().enemyMgr?._list?.length || 0;
    return { ok: !!enemy || after > before, before, after };
  });
  console.log('spawn result:', JSON.stringify(spawnResult));
  if (!spawnResult.ok) throw new Error(`spawn failed: ${JSON.stringify(spawnResult)}`);

  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-after-spawn.png') });

  console.log('switching to first playable weapon...');
  await page.evaluate(() => {
    const dbg = window.__game.debug;
    const slot = dbg.playableWeaponIndices?.()[0] ?? 1;
    dbg.switchWeapon(slot, true);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-weapon.png') });

  const errors = consoleEvents.filter(e => e.type === 'error' || e.type === 'pageerror');
  const warnings = consoleEvents.filter(e => e.type === 'warning' || e.type === 'warn');
  const logs = consoleEvents.filter(e => e.type === 'log');
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(`  ${e.type}: ${e.text}`));
  console.log('\n=== INTERESTING LOGS ===');
  logs.filter(l => /soldier|rig|anim|glb|gltf|skeleton|G keys/i.test(l.text)).forEach(l => console.log('  ' + l.text));

  const debugSnap = await page.evaluate(() => window.__game.debug.snapshot());
  console.log('\n=== GAME STATE ===');
  console.log(JSON.stringify(debugSnap, null, 2));
  console.log('\nerrors:', errors.length, '/ warnings:', warnings.length);
  if (errors.length) throw new Error(`browser errors: ${JSON.stringify(errors)}`);
} finally {
  await context.close();
  await browser.close();
}
