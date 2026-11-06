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

  // B05: mid door stays sealed until chart stations are visited (not force-clear).
  if (bn === 5) {
    const gatePre = await page.evaluate(() => window.__game.debug.b05StationGate());
    if (!gatePre || gatePre.kind !== 'stations') {
      throw new Error(`B05: expected stations objective, got ${JSON.stringify(gatePre)}`);
    }
    if ((gatePre.stationMeshes | 0) < 3) {
      throw new Error(`B05: expected visible station meshes, got ${JSON.stringify(gatePre)}`);
    }
    const midClear = await page.evaluate(() => {
      window.__game.debug.debugTriggerZoneClear(0);
      return window.__game.debug.debugTriggerZoneClear(1);
    });
    const gateSealed = await page.evaluate(() => window.__game.debug.b05StationGate());
    if (!gateSealed?.pendingMidDoor || gateSealed?.midDoor?.opened) {
      throw new Error(`B05: mid door should stay sealed until stations ${JSON.stringify({ midClear, gateSealed })}`);
    }
    const visited = await page.evaluate(() => window.__game.debug.debugVisitStations({ frames: 40, dt: 1 / 20 }));
    if (!visited?.ok || !visited.completed || !visited.midDoorOpened) {
      throw new Error(`B05: stations should complete and open mid door ${JSON.stringify(visited)}`);
    }
    pre.b05StationGate = { sealed: true, openedAfterVisit: true, meshes: gatePre.stationMeshes };
  }

  // B06/B11: survival hold must count up from 0 and seal mid door until complete.
  if (bn === 6 || bn === 11) {
    await page.waitForFunction(
      () => {
        const g = window.__game?.debug?.survivalMidDoorGate?.();
        return g && g.kind === 'survival' && g.active;
      },
      null,
      { timeout: 8000 },
    );
    const early = await page.evaluate(() => {
      // Prove hold is not already complete (old bug: timer started at duration).
      window.__game.debug.debugAdvanceSurvival(0.25);
      return window.__game.debug.survivalMidDoorGate();
    });
    if (!early || early.rewardGiven || early.timer >= early.duration) {
      throw new Error(`B${bn}: survival hold completed too early ${JSON.stringify(early)}`);
    }
    await page.evaluate(() => {
      window.__game.debug.debugTriggerZoneClear(0);
      window.__game.debug.debugTriggerZoneClear(1);
    });
    const sealed = await page.evaluate(() => window.__game.debug.survivalMidDoorGate());
    if (!sealed?.pendingMidDoor || sealed?.midDoor?.opened || sealed?.rewardGiven) {
      throw new Error(`B${bn}: mid door should stay sealed during survival hold ${JSON.stringify(sealed)}`);
    }
    const remain = Math.max(0.5, (sealed.duration || 30) - (sealed.timer || 0) + 0.5);
    const after = await page.evaluate((secs) => window.__game.debug.debugAdvanceSurvival(secs), remain);
    const gate = after?.gate || (await page.evaluate(() => window.__game.debug.survivalMidDoorGate()));
    if (!gate?.rewardGiven || !gate?.midDoor?.opened) {
      throw new Error(`B${bn}: survival complete should open mid door ${JSON.stringify(gate)}`);
    }
    pre.survivalMidDoorGate = { sealed: true, openedAfterHold: true, duration: gate.duration };
  }

  // Prefer combat-path clear (no force-open). Fall back to force-clear only if exit stuck.
  let cleared = await page.evaluate(() => window.__game.debug.debugCombatClearBuilding());
  if (!cleared?.ok || !cleared.exitUnlocked) {
    const forced = await page.evaluate(() => window.__game.debug.debugForceClearBuilding());
    if (!forced.ok || !forced.exitUnlocked) {
      throw new Error(`B${bn}: combat+force clear failed ${JSON.stringify({ cleared, forced })}`);
    }
    cleared = { ...forced, combatAttempt: cleared, forcedFallback: true };
  }
  if (!cleared.zoneClears || cleared.zoneClears.filter(Boolean).length < 3) {
    throw new Error(`B${bn}: zone clears incomplete ${JSON.stringify(cleared.zoneClears)}`);
  }
  pre.clearPath = cleared.forcedFallback ? 'force' : 'combat';

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
    clearPath: pre.clearPath || 'unknown',
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
