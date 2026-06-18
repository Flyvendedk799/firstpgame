import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';

function assertFiniteObject(obj, label, limit = 100) {
  for (const [key, value] of Object.entries(obj || {})) {
    const path = `${label}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) assertFiniteObject(value, path, limit);
    else if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), `${path} must be finite`);
      assert.ok(Math.abs(value) <= limit, `${path} exceeded ${limit}: ${value}`);
    }
  }
}

function assertPoseUseful(pose, label) {
  assert.ok(pose?.leftLeg?.r && pose?.rightLeg?.r, `${label} should expose leg rotations`);
  assert.ok(pose?.leftKnee?.r && pose?.rightKnee?.r, `${label} should expose knee rotations`);
  assert.ok(pose?.leftBoot?.r && pose?.rightBoot?.r, `${label} should expose boot rotations`);
  assertFiniteObject(pose, `${label}.pose`, 12);
  const legEnergy = Math.abs(pose.leftLeg.r[0]) + Math.abs(pose.rightLeg.r[0]);
  const kneeEnergy = Math.abs(pose.leftKnee.r[0]) + Math.abs(pose.rightKnee.r[0]);
  assert.ok(legEnergy > 0.02, `${label} should drive visible leg swing`);
  assert.ok(kneeEnergy > 0.02, `${label} should drive visible knee bend`);
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
  await page.waitForFunction(
    () => window.__game?.debug?.enemyLocomotionProbe && window.__game?.debug?.enemyLocomotionStatus,
    null,
    { timeout: 45000 }
  );

  const result = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const status = dbg.enemyLocomotionStatus();
    const walk = dbg.enemyLocomotionProbe({ type: 'soldier', state: 'patrol', mode: 'walk', speed: 1.45, frames: 56 });
    const run = dbg.enemyLocomotionProbe({ type: 'soldier', state: 'chase', mode: 'chase', speed: 3.30, frames: 64 });
    const flank = dbg.enemyLocomotionProbe({ type: 'pistolero', state: 'flank', mode: 'flank', speed: 4.60, frames: 64, yaw: 0.45, aimReady: 0.45 });
    const heavy = dbg.enemyLocomotionProbe({ type: 'heavy', state: 'reposition', mode: 'reposition', speed: 2.45, frames: 64 });
    const juke = dbg.enemyLocomotionProbe({ type: 'scout', state: 'juke', mode: 'juke', speed: 5.20, frames: 64, yaw: -0.7 });
    return { status, walk, run, flank, heavy, juke };
  });

  assert.equal(result.status.version, 'enemy-locomotion-realistic-v3');
  assert.ok(result.status.profiles.soldier.walkStride < result.status.profiles.soldier.runStride, 'soldier run stride should exceed walk stride');
  assert.ok(result.status.profiles.scout.jukeCap <= 5.3, 'scout juke cap should be bounded');

  for (const key of ['walk', 'run', 'flank', 'heavy', 'juke']) {
    const row = result[key];
    assert.equal(row.ok, true, `${key} probe should succeed`);
    assert.equal(row.finite, true, `${key} probe should report finite locomotion`);
    assert.equal(row.locomotion.version, 'enemy-locomotion-realistic-v3', `${key} should use realistic locomotion profile`);
    assert.equal(row.statusLocomotion.finite, true, `${key} status locomotion should be finite`);
    assertFiniteObject(row.locomotion, `${key}.locomotion`, 20);
    assertFiniteObject(row.statusLocomotion, `${key}.statusLocomotion`, 20);
    assertPoseUseful(row.pose, key);
    assert.ok(row.locomotion.footAnchor >= 0, `${key} should expose foot anchor`);
    assert.ok(row.locomotion.swingClearance >= 0, `${key} should expose swing clearance`);
  }

  assert.ok(result.walk.locomotion.runBlend < 0.35, 'patrol walk should stay in walk blend');
  assert.ok(result.run.locomotion.runBlend > 0.55, 'chase run should blend into running');
  assert.ok(result.flank.locomotion.runBlend > 0.80, 'flank should force athletic run blend');
  assert.ok(result.juke.locomotion.runBlend > 0.80, 'juke should force athletic run blend');
  assert.ok(result.run.locomotion.cadence > result.walk.locomotion.cadence, 'run cadence should exceed walk cadence');
  assert.ok(result.run.locomotion.strideMeters > result.walk.locomotion.strideMeters, 'run stride should exceed walk stride');
  assert.ok(result.heavy.locomotion.strideMeters < result.flank.locomotion.strideMeters, 'heavy stride should remain shorter than pistolero flank stride');
  assert.ok(result.juke.requestedSpeed <= result.juke.speedCap + 0.001, 'probe speed should respect juke cap');
  assert.ok(Math.abs(result.flank.pose.body.r[2]) > 0.001 || result.flank.locomotion.strafeBlend >= 0, 'flank should retain body attitude debug');

  assert.equal(errors.length, 0, `browser errors: ${JSON.stringify(errors)}`);
  console.log(JSON.stringify({
    ok: true,
    version: result.status.version,
    walk: result.walk.locomotion,
    run: result.run.locomotion,
    flank: result.flank.locomotion,
    heavy: result.heavy.locomotion,
    juke: result.juke.locomotion
  }, null, 2));
} finally {
  await browser.close();
}
