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
    let rds = null;
    if (pistolIds.includes(1) && typeof dbg.equipPistolScope === 'function') {
      dbg.equipPistolScope(2);
      dbg.setAds(1);
      await wait(1100);
      const pov = dbg.povState();
      const pose = dbg.viewmodelPose();
      rds = {
        weaponIdx: P.weaponIdx,
        optic: pov.optic || null,
        alignment: pov.ironSight || null,
        gunY: Number((pov.gun?.y || 0).toFixed(5)),
        gunZ: Number((pov.gun?.z || 0).toFixed(5)),
        gunPitch: Number((pov.gun?.rx || 0).toFixed(5)),
        gunScale: Number((pose.gunGrp?.s?.[0] || 0).toFixed(4))
      };
    }
    return { playable, rows, rds };
  });

  assert(result.rows.length > 0, `no pistol weapons available: ${result.playable.join(',')}`);
  for (const row of result.rows) {
    assert(row.adsVis > 0.96, `${row.name} did not reach settled ADS: ${JSON.stringify(row)}`);
    assert(row.ironSight?.active, `${row.name} iron sight solver inactive: ${JSON.stringify(row.ironSight)}`);
    assert(row.ironSight?.withinTolerance, `${row.name} iron sight residual outside tolerance: ${JSON.stringify(row.ironSight)}`);
    assert(row.ironSight?.targetNdcY <= -0.024 && row.ironSight?.targetNdcY >= -0.045, `${row.name} iron sight should leave fire-center visible above the post: ${JSON.stringify(row.ironSight)}`);
    assert(row.ironSight?.ndcY <= -0.020 && row.ironSight?.ndcY >= -0.052, `${row.name} front sight settled too close to center fire point: ${JSON.stringify(row.ironSight)}`);
    assert(row.ironSight?.lineTargetY <= 0.006, `${row.name} iron sight line target pitches the post too high: ${JSON.stringify(row.ironSight)}`);
    assert(row.gunPitch <= 0.012, `${row.name} iron ADS points down too far: pitch=${row.gunPitch}`);
    assert(row.gunPitch >= -0.070, `${row.name} iron ADS over-corrected nose-up: pitch=${row.gunPitch}`);
  }
  assert(result.rds, `pistol RDS scenario missing: ${JSON.stringify(result.playable)}`);
  assert(result.rds.optic, `pistol RDS optic profile missing: ${JSON.stringify(result.rds)}`);
  assert(result.rds.alignment?.mode === 'pistol-rds', `pistol RDS alignment did not run: ${JSON.stringify(result.rds)}`);
  assert(result.rds.alignment?.withinTolerance, `pistol RDS dot should settle on fire center after correction: ${JSON.stringify(result.rds)}`);
  // The viewmodel renders through its own fixed-FOV camera now: no scale hack, and the
  // RDS sits at arm's length in viewmodel space.
  assert(result.rds.gunScale <= 1.02 && result.rds.gunScale >= 0.98, `pistol RDS view scale must stay 1 (viewmodel camera owns the FOV): ${JSON.stringify(result.rds)}`);
  assert(result.rds.gunZ <= -0.22 && result.rds.gunZ >= -0.40, `pistol RDS depth should sit at arm's length: ${JSON.stringify(result.rds)}`);
  assert(Math.abs(result.rds.gunPitch) < 0.19, `pistol RDS pitch should stay readable: ${JSON.stringify(result.rds)}`);

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
