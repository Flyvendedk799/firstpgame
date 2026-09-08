import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

try {
  const url = new URL(BASE_URL);
  url.searchParams.set('renderer', 'webgl');
  url.searchParams.set('perf', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 45000 });
  await page.addStyleTag({
    content: `#overlay,#story-card,#dossier-card,#briefing-card,#deploy-loading,#pause-menu,#onboard-card,#attach-toast,#tutorial-toast{display:none!important;opacity:0!important;pointer-events:none!important;}`
  });
  await page.waitForFunction(() => window.__game?.debug?.simulateMissionFail && window.__game?.debug?.buildLevel, null, { timeout: 60000 });

  const result = await page.evaluate(async () => {
    const dbg = window.__game.debug;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    dbg.buildLevel(9);
    await wait(250);
    const G = dbg.G();
    const P = dbg.P();
    G.started = true;
    G.playMode = 'solo';
    G.building = 9;
    P.money = 777;
    P.dead = false;
    // Entry checkpoint as if player just arrived at B09.
    dbg.ensureRetryCheckpoint();
    const beforeFail = dbg.runSave();
    const fail = dbg.simulateMissionFail();
    const afterFail = dbg.runSave();
    const restart = dbg.restartCurrentRun();
    await wait(400);
    const afterRestart = { building: dbg.G().building, money: dbg.P().money, dead: !!dbg.P().dead };
    dbg.buildLevel(5);
    await wait(200);
    const mood = dbg.lightingMoodScale();
    if (dbg.G().levelData?.lightingController?.setMoodScale) {
      dbg.G().levelData.lightingController.setMoodScale(0.28);
    }
    return { beforeFail, fail, afterFail, restart, afterRestart, mood };
  });

  assert(result.beforeFail && result.beforeFail.building === 9, 'pre-fail runSave should be B09');
  assert(result.fail.runSaveBuilding === 9, 'death must keep Continue on B09');
  assert(String(result.fail.restartLabel || '').includes('RETRY BUILDING 9'), `defeat button label: ${JSON.stringify(result.fail.restartLabel)}`);
  assert(result.afterFail && result.afterFail.building === 9, 'post-fail runSave wiped');
  assert(result.afterRestart.building === 9, `retry must stay on B09, got ${result.afterRestart.building}`);
  assert(result.afterRestart.dead === false, 'retry should clear dead');
  assert(result.mood && result.mood.hasSetMood === true, 'B05 lighting controller needs setMoodScale');
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);

  console.log(JSON.stringify({ ok: true, result }, null, 2));
} finally {
  await browser.close();
}
