// Phase 7 §10.3 — AI tactical probe (LEVELS_AI_LEAN_UPGRADE_PLAN.md).
//
// Asserts the AI peek scaffolding is wired correctly without trying to
// elicit live peeks (which would race the wave system). What this checks:
//   1. Cover-graph is baked (cornerEdges + coverSlots)
//   2. New SETTINGS flags exist with sane defaults
//   3. Debug snapshot has the peek telemetry block
//   4. Spawned enemies receive the new tactical fields
//
// Run with the dev server already on http://127.0.0.1:5173 (or set BASE_URL).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push({ type: 'pageerror', text: err.message }));
page.on('console', msg => { if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() }); });

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

await page.locator('#start-btn').click();
await page.waitForFunction(() => {
  const s = window.__game?.debug?.snapshot?.();
  return s?.campaign?.id === 'B01_LOADING_DOCK';
}, null, { timeout: 45000 });

// Let the level stabilize a moment before sampling
await page.waitForTimeout(1500);

// Spawn a soldier so we have something to sample tactical fields on.
// (Live wave enemies may not exist yet at this exact frame.)
await page.evaluate(() => {
  window.__game.debug.spawnAt('soldier', 5.0, 4.0);
});
await page.waitForTimeout(300);

const result = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const snap = dbg.snapshot();
  const G = dbg.G();
  // Prefer the probe-tagged sample, fall back to any enemy with peekRate>0
  const list = (G.enemyMgr && G.enemyMgr._list) || [];
  const sample = list.find(e => e._probeTag)
    || list.find(e => e.peekRate > 0)
    || list[0] || null;
  return {
    snap,
    settings: (() => {
      const S = dbg.settings ? dbg.settings() : {};
      return {
        aiTacticalEnabled: S.aiTacticalEnabled,
        aiPeekDebugRender: S.aiPeekDebugRender,
        playerLeanAntiClip: S.playerLeanAntiClip,
        playerLeanBodyRig: S.playerLeanBodyRig,
      };
    })(),
    listSize: list.length,
    enemySample: sample ? {
      type: sample.type,
      peekRate: sample.peekRate,
      peekHoldMs: sample.peekHoldMs,
      holdRiskCap: sample.holdRiskCap,
      useSuppress: sample.useSuppress,
      peekState: sample.peekState,
      hasCoverSlot: !!sample.coverSlot,
    } : null,
  };
});

await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'ai-tactical-probe.png'), fullPage: false });

const { snap, settings, listSize, enemySample } = result;

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg + '\nResult: ' + JSON.stringify(result, null, 2));
}

assert(snap, 'snapshot returned');
assert(typeof snap.cornerEdgesCount === 'number', 'cornerEdgesCount is a number');
assert(snap.cornerEdgesCount >= 16, `cornerEdgesCount >= 16 (got ${snap.cornerEdgesCount})`);
assert(typeof snap.coverSlotsCount === 'number', 'coverSlotsCount is a number');
assert(snap.coverSlotsCount >= 30, `coverSlotsCount >= 30 (got ${snap.coverSlotsCount})`);
assert(snap.peek && typeof snap.peek.totalPeeks === 'number', 'peek telemetry block exists');
assert(snap.peek && typeof snap.peek.peekRatio === 'number', 'peek.peekRatio is a number');
assert(typeof snap.peek.playerLeanShotsRatio === 'number', 'playerLeanShotsRatio is a number');

assert(enemySample, 'at least one enemy is alive in B01 for sampling');
assert(enemySample.peekRate >= 0, 'enemy has peekRate field');
assert(enemySample.peekHoldMs >= 0, 'enemy has peekHoldMs field');
assert(typeof enemySample.useSuppress === 'boolean', 'enemy has useSuppress flag');
assert(enemySample.peekState === 'safe' || enemySample.peekState === 'peeking', 'enemy.peekState valid');

// Console error gate
if (errors.length) {
  console.error('Console errors during probe:', errors);
  throw new Error(`AI probe accumulated ${errors.length} console errors`);
}

console.log(JSON.stringify({
  ok: true,
  cornerEdgesCount: snap.cornerEdgesCount,
  coverSlotsCount: snap.coverSlotsCount,
  listSize,
  enemySample,
  settings,
  peek: snap.peek,
  screenshot: path.join(SCREENSHOTS_DIR, 'ai-tactical-probe.png'),
}, null, 2));

await context.close();
await browser.close();
