import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const SHOTS = path.resolve('./screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const events = [];
page.on('console', m => events.push({ t: m.type(), x: m.text() }));
page.on('pageerror', e => events.push({ t: 'pageerror', x: e.message }));

try {
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__game?.debug?.snapshot, null, { timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, .menu-cta, .menu-cta-go')]
      .find(el => /deploy/i.test(el.textContent || ''));
    if (!b) throw new Error('Deploy button not found');
    b.click();
  });
  await page.waitForTimeout(1500);

  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Space');
    await page.mouse.click(640, 400);
    await page.waitForTimeout(80);
  }

  await page.screenshot({ path: path.join(SHOTS, '02-after-skip.png') });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOTS, '03-gameplay.png') });

  const probe = await page.evaluate(() => {
    const dbg = window.__game?.debug;
    if (!dbg) throw new Error('window.__game.debug missing');
    return {
      snapshot: dbg.snapshot(),
      renderer: dbg.rendererInfo?.() || null,
      weapon: dbg.weaponVisualStatus?.() || null,
      playableWeapons: dbg.playableWeaponIndices?.() || null,
    };
  });
  console.log('PROBE:', JSON.stringify(probe, null, 2));

  const spawnRes = await page.evaluate(() => {
    const dbg = window.__game?.debug;
    if (!dbg?.spawnAt || !dbg?.G) throw new Error('debug spawn helpers missing');
    const before = dbg.G().enemyMgr?._list?.length || 0;
    const enemy = dbg.spawnAt('soldier', 2, 14);
    const after = dbg.G().enemyMgr?._list?.length || 0;
    return { ok: !!enemy || after > before, before, after };
  });
  console.log('SPAWN:', JSON.stringify(spawnRes, null, 2));
  if (!spawnRes.ok) throw new Error(`soldier spawn probe failed: ${JSON.stringify(spawnRes)}`);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOTS, '04-with-soldier.png') });

  await page.evaluate(() => {
    const dbg = window.__game.debug;
    const slot = dbg.playableWeaponIndices?.()[0] ?? 1;
    dbg.switchWeapon(slot, true);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOTS, '05-weapon.png') });

  const probe2 = await page.evaluate(() => ({
    snapshot: window.__game.debug.snapshot(),
    weapon: window.__game.debug.weaponVisualStatus?.() || null,
  }));
  console.log('PROBE2:', JSON.stringify(probe2, null, 2));

  const errors = events.filter(e => e.t === 'error' || e.t === 'pageerror');
  console.log('\nERRORS:', errors.length);
  errors.forEach(e => console.log(' -', e.x.slice(0, 200)));
  if (errors.length) throw new Error(`browser errors: ${JSON.stringify(errors)}`);
} finally {
  await context.close();
  await browser.close();
}
