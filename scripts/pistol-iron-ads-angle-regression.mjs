import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots/pistol-iron-ads-angle');
fs.mkdirSync(OUT_DIR, { recursive: true });

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (err) => errors.push({ type: 'pageerror', text: err.message }));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
});

try {
  const url = new URL(BASE_URL);
  url.searchParams.set('renderer', 'webgl');
  url.searchParams.set('perf', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 30000 });
  await page.addStyleTag({
    content: `
      #overlay,#story-card,#dossier-card,#briefing-card,#deploy-loading,#pause-menu,
      #onboard-card,#attach-toast,#tutorial-toast,#tooltip,#radial,#inventory,#shop,
      #endscreen,#ending-overlay { display:none!important; opacity:0!important; pointer-events:none!important; }
    `
  });
  await page.waitForFunction(
    () => window.__game?.debug?.switchWeapon && window.__game?.debug?.setAds && window.__game?.debug?.povState,
    null,
    { timeout: 45000 }
  );

  const result = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    P.hp = Math.max(P.hp || 0, 100);
    P.pos.set(0, 0.2, 18);
    P.yaw = Math.PI;
    P.pitch = 0;
    P.reloading = false;
    P.vaulting = false;
    P.dropkickActive = false;
    P.guardBehindHeld = false;
    P.guardBehindActive = false;
    P.guardBehindAmt = 0;
    P.sliding = false;
    P.slideAmt = 0;
    P.slideTarget = 0;
    const playable = dbg.playableWeaponIndices?.() || [];
    const pistolIds = [1, 6].filter((idx) => playable.includes(idx));
    const rows = [];
    for (const weaponIdx of pistolIds) {
      dbg.switchWeapon(weaponIdx);
      dbg.setAds(0);
      await wait(320);
      dbg.setAds(1);
      await wait(900);
      const pov = dbg.povState();
      const visual = dbg.weaponVisualStatus();
      rows.push({
        weaponIdx,
        name: visual.name,
        gunPitch: Number((pov.gun?.rx || 0).toFixed(5)),
        gunRoll: Number((pov.gun?.rz || 0).toFixed(5)),
        ads: Number((pov.ads || 0).toFixed(3)),
        adsVis: Number((pov.adsVis || 0).toFixed(3)),
        ironSight: pov.ironSight,
        viewFit: visual.weaponFeelProfile?.ads?.viewFit || null
      });
    }
    return { playable, rows };
  });

  assert(result.rows.length > 0, `no pistol weapons available: ${result.playable.join(',')}`);
  for (const row of result.rows) {
    assert(row.adsVis > 0.96, `${row.name} did not reach settled ADS: ${JSON.stringify(row)}`);
    assert(row.ironSight?.active, `${row.name} iron sight solver inactive: ${JSON.stringify(row.ironSight)}`);
    assert(row.ironSight?.withinTolerance, `${row.name} iron sight residual outside tolerance: ${JSON.stringify(row.ironSight)}`);
    assert(row.gunPitch <= 0.012, `${row.name} iron ADS points down too far: pitch=${row.gunPitch}`);
    assert(row.gunPitch >= -0.055, `${row.name} iron ADS over-corrected nose-up: pitch=${row.gunPitch}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'pistol-iron-ads-angle-regression.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log('pistol iron ADS angle regression ok');
  console.log(JSON.stringify(result, null, 2));

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
} finally {
  await context.close();
  await browser.close();
}
