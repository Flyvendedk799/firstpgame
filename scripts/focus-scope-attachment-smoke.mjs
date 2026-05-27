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
    () => window.__game?.debug?.equipPistolScope && window.__game?.debug?.setFocusActive && window.__game?.debug?.meleeFeelProbe,
    null,
    { timeout: 45000 }
  );

  const result = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const dbg = window.__game.debug;
    const G = dbg.G();
    const P = dbg.P();

    function pageAssert(cond, message) {
      if (!cond) throw new Error(message);
    }

    function pipSummary(pip) {
      return {
        enabled: !!pip.enabled,
        visible: !!pip.visible,
        rendered: !!pip.rendered,
        screenOverlay: !!pip.screenOverlay,
        opacity: Number(pip.opacity || 0),
        fov: Number(pip.fov || 0),
        vignetteOpacity: Number(pip.vignetteOpacity || 0),
        attachment: pip.attachment || null,
        weapon: pip.weapon || null,
        target: pip.target ? { width: pip.target.width || 0, height: pip.target.height || 0 } : null
      };
    }

    function prepRuntime() {
      G.started = true;
      G.menuOpen = false;
      G.invOpen = false;
      G.shopOpen = false;
      G.paused = false;
      G.splitScreenActive = false;
      P.dead = false;
      P.reloading = false;
      P.vaulting = false;
      P.dropkickActive = false;
      P._spawnPerfGraceUntil = 0;
      P._spawnVisualGraceUntil = 0;
    }

    async function waitForScope(predicate, label, timeoutMs = 3500) {
      const end = performance.now() + timeoutMs;
      let last = null;
      while (performance.now() < end) {
        last = dbg.scopePip();
        if (predicate(last)) return last;
        await wait(50);
      }
      throw new Error(`${label}: scope state did not settle: ${JSON.stringify(last)}`);
    }

    prepRuntime();
    const playable = dbg.playableWeaponIndices();
    const slots = dbg.weaponSlots();
    pageAssert(!playable.includes(2), `removed knife index is still playable: ${playable.join(',')}`);
    pageAssert(slots.length === 6, `expected six playable slots after knife removal, got ${slots.length}`);
    pageAssert(slots[0].idx === 1 && slots[1].idx === 3, `slot order did not close over removed knife: ${JSON.stringify(slots)}`);

    P.focus = 1;
    dbg.setFocusActive(true);
    await wait(360);
    const focusOn = dbg.gameplayFeelState().focus;
    pageAssert(focusOn.active, 'focus did not activate');
    pageAssert(focusOn.animationScale < 0.72, `focus animation scale did not slow: ${JSON.stringify(focusOn)}`);
    pageAssert(focusOn.slideScale < focusOn.animationScale, `slide animation should be the slowest focus channel: ${JSON.stringify(focusOn)}`);
    pageAssert(focusOn.aimScale === 1, `focus should not slow aim channel: ${JSON.stringify(focusOn)}`);
    dbg.setFocusActive(false);

    prepRuntime();
    dbg.buildLevel(1);
    dbg.equipPistolScope(3);
    dbg.setAds(1);
    await wait(420);
    const pistolPip = await waitForScope((pip) => pip.enabled && pip.visible && pip.opacity > 0.15 && !pip.screenOverlay, 'pistol RDS');
    const pistolPov = dbg.povState();
    const pistolVisual = dbg.weaponVisualStatus();
    pageAssert(pistolPov.optic && /RDS|HOLO|PRISM/i.test(pistolPov.optic.name), `pistol optic profile missing: ${JSON.stringify(pistolPov.optic)}`);
    pageAssert((pistolPov.targetFov || 75) < 61, `pistol optic did not tighten FOV: ${JSON.stringify(pistolPov)}`);
    pageAssert(pistolVisual.pistolOpticVisible && pistolVisual.pistolOpticMeshes >= 8, `pistol optic mesh not visible: ${JSON.stringify(pistolVisual)}`);

    prepRuntime();
    dbg.switchWeapon(7, true);
    dbg.setAds(1);
    await wait(480);
    const awmPip = await waitForScope((pip) => pip.enabled && pip.screenOverlay && pip.vignetteOpacity > 0.45, 'AWM screen scope');
    const awmPov = dbg.povState();
    pageAssert(awmPov.optic && awmPov.optic.name === 'AWM SCOPE', `AWM optic profile missing: ${JSON.stringify(awmPov.optic)}`);
    pageAssert((awmPov.targetFov || 75) <= 22, `AWM scope FOV is not sniper-tight: ${JSON.stringify(awmPov)}`);

    const melee = dbg.meleeFeelProbe(26, 1 / 60);
    pageAssert(melee.finite, `melee generated non-finite pose values: ${JSON.stringify(melee)}`);
    pageAssert(melee.impactFrame >= 0, `melee impact frame was not reached: ${JSON.stringify(melee)}`);
    pageAssert(melee.blocksFire, `melee should block firing during active swing: ${JSON.stringify(melee)}`);

    prepRuntime();
    await dbg.debugStartBuilding(1);
    const pickupStatus = dbg.attachmentPickupStatus();
    const b1Optics = pickupStatus.scopePickups.filter((pk) => String(pk.tag || '').startsWith('b1-pistol-'));
    pageAssert(b1Optics.length >= 2, `B1 pistol optics did not spawn: ${JSON.stringify(pickupStatus)}`);
    pageAssert(b1Optics.every((pk) => pk.pistolSuggested), `B1 optics missing pistol compatibility metadata: ${JSON.stringify(b1Optics)}`);

    return {
      slots,
      focusOn,
      pistol: { pip: pipSummary(pistolPip), optic: pistolPov.optic, meshes: pistolVisual.pistolOpticMeshes },
      awm: { pip: pipSummary(awmPip), optic: awmPov.optic, targetFov: awmPov.targetFov },
      melee,
      b1Optics
    };
  });

  fs.writeFileSync(path.join(OUT_DIR, 'focus-scope-attachment-smoke.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log('focus/scope/attachment smoke ok');
  console.log(JSON.stringify(result, null, 2));

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
} finally {
  await context.close();
  await browser.close();
}
