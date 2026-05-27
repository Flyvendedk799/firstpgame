import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
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
  url.searchParams.set('perf', '1');
  url.searchParams.set('renderer', 'webgl');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 30000 });
  await page.addStyleTag({
    content: `
      #overlay,
      #story-card,
      #dossier-card,
      #briefing-card,
      #deploy-loading,
      #pause-menu,
      #onboard-card,
      #attach-toast,
      #tutorial-toast,
      #tooltip,
      #radial,
      #inventory,
      #shop,
      #endscreen,
      #ending-overlay {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
  });
  await page.waitForFunction(
    () => window.__game?.debug?.gameplayFeelState && window.__game?.debug?.pressPrimaryJumpOrVault,
    null,
    { timeout: 45000 }
  );

  await page.evaluate(() => {
    window.__game.debug.buildLevel(1);
  });

  const result = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const dbg = window.__game.debug;
    const G = dbg.G();
    const P = dbg.P();

    function pageAssert(cond, message) {
      if (!cond) throw new Error(message);
    }

    function press(code) {
      const key = code === 'Space' ? ' ' : code === 'ControlLeft' ? 'Control' : code;
      document.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true, repeat: false }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true, cancelable: true, repeat: false }));
    }

    async function waitForState(predicate, timeoutMs, label) {
      const deadline = performance.now() + timeoutMs;
      let last = null;
      while (performance.now() < deadline) {
        last = dbg.gameplayFeelState();
        if (predicate(last)) return last;
        await wait(16);
      }
      throw new Error(`${label}: ${JSON.stringify(last)}`);
    }

    function prepPlayer() {
      G.started = true;
      G.menuOpen = false;
      G.invOpen = false;
      G.shopOpen = false;
      G.paused = false;
      G.splitScreenActive = false;
      G.playMode = 'solo';
      G.exitUnlocked = false;
      if (G.enemyMgr && typeof G.enemyMgr.clear === 'function') G.enemyMgr.clear();
      P.dead = false;
      P.hp = Math.max(P.hp || 0, 100);
      P.reloading = false;
      P.vaulting = false;
      P.dropkickActive = false;
      P.dropkickCooldown = 1;
      P.dropkickTargetEnemy = null;
      P.guardBehindHeld = false;
      P.guardBehindActive = false;
      P.guardBehindAmt = 0;
      P.sliding = false;
      P.slideAmt = 0;
      P.slideTarget = 0;
      P.nearVault = null;
      P.wallContact = null;
      P.wallJumpTimer = 0;
      P.wallJumpVx = 0;
      P.wallJumpVz = 0;
      P.wallJumpHardenTimer = 0;
      P._wallJumpLockWall = null;
      P._canDoubleJump = false;
      P._didDoubleJump = true;
      P._coyoteJumpConsumed = false;
      P._jumpBufferedUntil = 0;
      P._vaultIntentUntil = 0;
      P._slideIntentUntil = 0;
      P._landingSlideWindowUntil = 0;
      P.pos.set(500, 0.2, 500);
      P.yaw = Math.PI;
      P.pitch = 0;
      P.grounded = true;
      P.jumpH = 0;
      P.vy = 0;
      if (dbg.setAds) dbg.setAds(0);
    }

    prepPlayer();
    await wait(120);
    const configured = dbg.gameplayFeelState().configured;
    pageAssert(configured.jumpCoyoteMs === 145, `expected coyote 145ms, got ${configured.jumpCoyoteMs}`);
    pageAssert(configured.jumpBufferMs === 190, `expected jump buffer 190ms, got ${configured.jumpBufferMs}`);
    pageAssert(configured.slideBufferMs === 250, `expected slide buffer 250ms, got ${configured.slideBufferMs}`);
    pageAssert(configured.landingSlideWindowMs === 220, `expected landing slide window 220ms, got ${configured.landingSlideWindowMs}`);

    prepPlayer();
    P.grounded = false;
    P.jumpH = 0.3;
    P.vy = -3;
    P._lastGroundedT = performance.now() - 500;
    P._coyoteJumpConsumed = true;
    press('Space');
    const buffered = dbg.gameplayFeelState();
    pageAssert(buffered.jumpBufferMsLeft > 80, `air jump buffer was not stored: ${buffered.jumpBufferMsLeft}`);
    const consumed = await waitForState(
      () => !P.grounded && P.vy > 0.1 && (dbg.gameplayFeelState().jumpBufferMsLeft === 0),
      650,
      'buffered jump did not launch on landing'
    );
    const consumedVy = P.vy;
    pageAssert(consumed.jumpBufferMsLeft === 0, `jump buffer was not consumed: ${consumed.jumpBufferMsLeft}`);

    prepPlayer();
    P.grounded = false;
    P.jumpH = 0.12;
    P.vy = 0;
    P._lastGroundedT = performance.now();
    P._coyoteJumpConsumed = false;
    press('Space');
    const coyoteVy = P.vy;
    pageAssert(!P.grounded && coyoteVy > 5, `coyote jump did not launch: grounded=${P.grounded}, vy=${coyoteVy}`);

    prepPlayer();
    press('Space');
    const keyboardVault = dbg.gameplayFeelState();
    pageAssert(keyboardVault.vaultBufferMsLeft > 0, `Space did not set vault buffer: ${keyboardVault.vaultBufferMsLeft}`);

    prepPlayer();
    P.grounded = false;
    P.jumpH = 1;
    P.vy = 0;
    P._lastGroundedT = performance.now() - 500;
    P._coyoteJumpConsumed = true;
    dbg.pressPrimaryJumpOrVault();
    const gamepadEquivalentVault = dbg.gameplayFeelState();
    pageAssert(gamepadEquivalentVault.vaultBufferMsLeft > 0, `gamepad-equivalent path did not set vault buffer: ${gamepadEquivalentVault.vaultBufferMsLeft}`);

    prepPlayer();
    press('ControlLeft');
    const slideIntent = dbg.gameplayFeelState();
    pageAssert(slideIntent.slideBufferMsLeft > 100, `slide intent buffer was too short: ${slideIntent.slideBufferMsLeft}`);
    await wait(80);
    const slideLate = dbg.gameplayFeelState();
    pageAssert(slideLate.slideBufferMsLeft > 25, `slide intent buffer did not survive a short timing miss: ${slideLate.slideBufferMsLeft}`);

    prepPlayer();
    dbg.switchWeapon(1);
    P.reloading = false;
    P.ammo = 2;
    P.ammoRes = 10;
    P.lastShot = performance.now() / 1000;
    const beforeAmmo = P.ammo;
    dbg.forceCadenceBuffer();
    await wait(60);
    const triggerQueued = dbg.gameplayFeelState();
    pageAssert(triggerQueued.triggerBufferMsLeft > 0, `trigger buffer was not queued: ${triggerQueued.triggerBufferMsLeft}`);
    pageAssert(P.ammo === beforeAmmo, `cadence-blocked shot fired too early: before=${beforeAmmo}, after=${P.ammo}`);
    await wait(430);
    pageAssert(P.ammo === beforeAmmo - 1, `trigger buffer did not fire after cadence: before=${beforeAmmo}, after=${P.ammo}`);

    prepPlayer();
    const hudBefore = dbg.gameplayFeelState().hudCache;
    await wait(240);
    const hudAfter = dbg.gameplayFeelState().hudCache;
    pageAssert(hudAfter.skips > hudBefore.skips, `HUD cache did not record skipped writes: before=${hudBefore.skips}, after=${hudAfter.skips}`);

    return {
      configured,
      bufferedJump: { storedMs: Number(buffered.jumpBufferMsLeft.toFixed(1)), consumedVy: Number(consumedVy.toFixed(3)) },
      coyote: true,
      vaultBuffer: {
        keyboardMs: Number(keyboardVault.vaultBufferMsLeft.toFixed(1)),
        gamepadEquivalentMs: Number(gamepadEquivalentVault.vaultBufferMsLeft.toFixed(1))
      },
      slideBufferMs: Number(slideLate.slideBufferMsLeft.toFixed(1)),
      triggerBufferFired: true,
      hudCache: hudAfter
    };
  });

  fs.writeFileSync(path.join(OUT_DIR, 'gameplay-qol-smoke.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log('gameplay QoL smoke ok');
  console.log(JSON.stringify(result, null, 2));

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
} finally {
  await context.close();
  await browser.close();
}
