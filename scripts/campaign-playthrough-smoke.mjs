/**
 * Automated 12-building campaign progression smoke.
 * Deploys each building, force-clears combat/doors, advances silently,
 * and asserts exit unlock + final clear bookkeeping.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const EXPECTED_LENGTH = 12;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const consoleEvents = [];
const failedRequests = [];
page.on('console', (msg) => {
  consoleEvents.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', (err) => {
  consoleEvents.push({ type: 'pageerror', text: err.message, stack: err.stack });
});
page.on('requestfailed', (req) => {
  failedRequests.push({ url: req.url(), failure: req.failure() });
});

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(1500);
await page.waitForFunction(() => window.__game && window.__game.debug && window.__game.debug.debugStartBuilding, null, {
  timeout: 20000,
});

const length = await page.evaluate(() => window.__game.debug.campaignLength());
if (length !== EXPECTED_LENGTH) {
  throw new Error(`Expected campaignLength ${EXPECTED_LENGTH}, got ${length}`);
}

const campaignIds = await page.evaluate(() => window.__game.debug.campaignIds());
if (!Array.isArray(campaignIds) || campaignIds.length !== EXPECTED_LENGTH) {
  throw new Error(`Expected ${EXPECTED_LENGTH} campaign ids, got ${campaignIds?.length}`);
}

const results = [];

for (let bn = 1; bn <= EXPECTED_LENGTH; bn++) {
  const expected = campaignIds[bn - 1];
  await page.evaluate(async (building) => {
    await window.__game.debug.debugStartBuilding(building);
  }, bn);

  await page.waitForFunction(
    (building) => {
      const snap = window.__game?.debug?.snapshot?.();
      return snap?.building === building && snap?.campaign?.id;
    },
    bn,
    { timeout: 90000 },
  );

  // Let megaplex / lighting / director settle one frame tick.
  await page.waitForTimeout(400);

  const pre = await page.evaluate((building) => {
    const snap = window.__game.debug.snapshot();
    const zone = window.__game.debug.zoneDoorState?.() || null;
    const setpiece = window.__game.debug.setpieceDef?.(building) || null;
    const objective = window.__game.debug.objectiveDef?.(building) || null;
    return {
      building: snap.building,
      campaignId: snap.campaign?.id || null,
      cornerEdgesCount: snap.cornerEdgesCount,
      coverSlotsCount: snap.coverSlotsCount,
      masteryId: snap.mastery?.id || null,
      zoneClears: snap.zoneClears || zone?.zoneClears || null,
      setpieceType: setpiece?.type || null,
      objectiveKind: objective?.kind || null,
      isMegaplex: !!(snap.visualRuntime?.visualStats?.rooms > 0 && building === 1),
    };
  }, bn);

  if (pre.building !== bn) throw new Error(`B${bn}: building mismatch ${pre.building}`);
  if (pre.campaignId !== expected.id) {
    throw new Error(`B${bn}: expected campaign ${expected.id}, got ${pre.campaignId}`);
  }
  if (typeof pre.cornerEdgesCount !== 'number' || pre.cornerEdgesCount < 4) {
    throw new Error(`B${bn}: weak cornerEdgesCount ${pre.cornerEdgesCount}`);
  }
  if (typeof pre.coverSlotsCount !== 'number' || pre.coverSlotsCount < 4) {
    throw new Error(`B${bn}: weak coverSlotsCount ${pre.coverSlotsCount}`);
  }
  if (expected.setpiece && !pre.setpieceType) {
    throw new Error(`B${bn}: missing SETPIECE_DEFS for setpiece ${expected.setpiece}`);
  }

  // B02–B12 room-flow gates need a hold-E alarm panel mesh in solids.
  if (bn >= 2) {
    const panels = await page.evaluate(() => window.__game.debug.alarmPanelMeshes());
    if (!panels || (panels.count | 0) < 1) {
      throw new Error(`B${bn}: expected alarm_panel mesh, got ${JSON.stringify(panels)}`);
    }
    pre.alarmPanelCount = panels.count;

    // Prove Hold-E completes disable_alarm_panel without force-clear (real softlock path).
    const held = await page.evaluate(() => window.__game.debug.debugHoldAlarmPanel({ frames: 48, dt: 1 / 20 }));
    if (!held || !held.ok || !held.completed) {
      throw new Error(`B${bn}: Hold-E alarm panel failed ${JSON.stringify(held)}`);
    }
    pre.alarmHoldOk = true;
  }

  const cleared = await page.evaluate(() => window.__game.debug.debugForceClearBuilding());
  if (!cleared.ok || !cleared.exitUnlocked) {
    throw new Error(`B${bn}: force clear failed ${JSON.stringify(cleared)}`);
  }
  if (!cleared.zoneClears || cleared.zoneClears.filter(Boolean).length < 3) {
    throw new Error(`B${bn}: zone clears incomplete ${JSON.stringify(cleared.zoneClears)}`);
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `campaign-playthrough-b${String(bn).padStart(2, '0')}.png`),
    fullPage: false,
  });

  const advanced = await page.evaluate(async () => window.__game.debug.debugAdvanceSilent());
  if (!advanced.ok) throw new Error(`B${bn}: advance failed ${JSON.stringify(advanced)}`);

  if (bn < EXPECTED_LENGTH) {
    if (advanced.ending) throw new Error(`B${bn}: advance reported ending too early`);
    if (advanced.to !== bn + 1) throw new Error(`B${bn}: expected next ${bn + 1}, got ${advanced.to}`);
    if ((advanced.maxCleared | 0) < bn) {
      throw new Error(`B${bn}: maxCleared not updated (${advanced.maxCleared})`);
    }
  } else {
    if (!advanced.ending) throw new Error(`B12: expected ending:true after final advance`);
    if (!advanced.finalKill) throw new Error('B12: PROGRESS._finalKill not set');
    if ((advanced.maxCleared | 0) < EXPECTED_LENGTH) {
      throw new Error(`B12: maxCleared ${advanced.maxCleared} < ${EXPECTED_LENGTH}`);
    }
  }

  results.push({
    building: bn,
    campaignId: pre.campaignId,
    setpieceType: pre.setpieceType,
    objectiveKind: pre.objectiveKind,
    masteryId: pre.masteryId,
    exitUnlocked: cleared.exitUnlocked,
    maxCleared: advanced.maxCleared,
    ending: !!advanced.ending,
  });
}

const hardErrors = consoleEvents.filter((e) => e.type === 'error' || e.type === 'pageerror');
// Filter known benign noise if any; fail on real pageerrors.
const pageErrors = hardErrors.filter((e) => e.type === 'pageerror');
if (pageErrors.length) {
  console.log(JSON.stringify({ pageErrors, failedRequests }, null, 2));
  throw new Error(`Playthrough smoke pageerrors=${pageErrors.length}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      length: EXPECTED_LENGTH,
      results,
      consoleErrors: hardErrors.length,
      failedRequests: failedRequests.length,
    },
    null,
    2,
  ),
);

await browser.close();
process.exit(0);
