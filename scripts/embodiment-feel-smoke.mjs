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
    () => window.__game?.debug?.setEmbodimentProbe && window.__game?.debug?.setHandPlacementFaultProbe,
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

    function finiteNumber(value, label, limit = 20) {
      pageAssert(Number.isFinite(value), `${label} must be finite, got ${value}`);
      pageAssert(Math.abs(value) <= limit, `${label} exceeded ${limit}: ${value}`);
    }

    function finiteArray(values, label, limit = 20) {
      pageAssert(Array.isArray(values), `${label} must be an array`);
      values.forEach((value, index) => {
        if (typeof value !== 'number') {
          pageAssert(index >= 3 && typeof value === 'string', `${label}[${index}] must be numeric or an Euler order string`);
          return;
        }
        finiteNumber(value, `${label}[${index}]`, limit);
      });
    }

    function finitePose(snapshot, label) {
      finiteArray(snapshot.rGrp.p, `${label}.rGrp.p`, 2);
      finiteArray(snapshot.rGrp.r, `${label}.rGrp.r`, 3);
      finiteArray(snapshot.rGrp.s, `${label}.rGrp.s`, 2);
      finiteArray(snapshot.lGrp.p, `${label}.lGrp.p`, 2);
      finiteArray(snapshot.lGrp.r, `${label}.lGrp.r`, 3);
      finiteArray(snapshot.lGrp.s, `${label}.lGrp.s`, 2);
      finiteArray(snapshot.gunGrp.p, `${label}.gunGrp.p`, 3);
      finiteArray(snapshot.gunGrp.r, `${label}.gunGrp.r`, 3);
      finiteArray(snapshot.gunGrp.s, `${label}.gunGrp.s`, 3);
      if (snapshot.bodyPresence) {
        finiteArray(snapshot.bodyPresence.p, `${label}.bodyPresence.p`, 3);
        finiteArray(snapshot.bodyPresence.r, `${label}.bodyPresence.r`, 3);
        finiteArray(snapshot.bodyPresence.s, `${label}.bodyPresence.s`, 2);
        finiteArray(snapshot.bodyPresence.left.p, `${label}.bodyPresence.left.p`, 2);
        finiteArray(snapshot.bodyPresence.left.r, `${label}.bodyPresence.left.r`, 3);
        finiteArray(snapshot.bodyPresence.right.p, `${label}.bodyPresence.right.p`, 2);
        finiteArray(snapshot.bodyPresence.right.r, `${label}.bodyPresence.right.r`, 3);
      }
    }

    function prepPlayer() {
      G.started = true;
      G.menuOpen = false;
      G.invOpen = false;
      G.shopOpen = false;
      G.paused = false;
      G.splitScreenActive = false;
      G.playMode = 'solo';
      if (G.enemyMgr && typeof G.enemyMgr.clear === 'function') G.enemyMgr.clear();
      P.dead = false;
      P.hp = Math.max(P.hp || 0, 100);
      P.reloading = false;
      P.vaulting = false;
      P.dropkickActive = false;
      P.dropkickLandTimer = 0;
      P.sliding = false;
      P.slideAmt = 0;
      P.slideTimer = 0;
      P.guardBehindHeld = false;
      P.guardBehindActive = false;
      P.guardBehindAmt = 0;
      P.pos.set(500, 0.2, 500);
      P.yaw = Math.PI;
      P.pitch = 0;
      P.grounded = true;
      P.jumpH = 0;
      P.vy = 0;
      P._bodyPresenceVis = 0;
      P._bodyPresencePhase = 0;
      if (dbg.setAds) dbg.setAds(0);
    }

    async function probe(opts, frames = 4) {
      let out = null;
      for (let i = 0; i < frames; i++) {
        out = dbg.setEmbodimentProbe(Object.assign({ phase: i * 0.85 }, opts));
        await wait(18);
      }
      return out;
    }

    prepPlayer();
    await wait(160);

    const playable = (dbg.playableWeaponIndices?.() || [0, 1, 2, 3, 4, 5, 6, 7]).filter((idx) => Number.isFinite(idx));
    const weaponRows = [];
    for (const weaponIdx of playable) {
      dbg.switchWeapon(weaponIdx);
      dbg.setAds(0);
      const hip = await probe({ speed: 2.4, sprint: 0.1, ads: 0, turn: 0.15 }, 3);
      const hipStatus = dbg.weaponVisualStatus();
      finitePose(hip.viewmodel, `weapon.${weaponIdx}.hip`);
      pageAssert(hipStatus.handPlacement, `weapon ${weaponIdx} did not expose hand placement health`);
      pageAssert(hipStatus.handPlacement.nonFiniteEvents === 0, `weapon ${weaponIdx} hand placement had non-finite events before fault probe`);
      pageAssert(hipStatus.handGrip?.placement?.nonFiniteEvents === 0, `weapon ${weaponIdx} hand grip placement had non-finite offsets`);
      pageAssert((hipStatus.handGrip?.placement?.maxOffset || 0) <= 0.25, `weapon ${weaponIdx} hand grip offset too large`);
      pageAssert((hipStatus.handGrip?.placement?.maxRotation || 0) <= 0.78, `weapon ${weaponIdx} hand grip rotation too large`);
      pageAssert(
        hipStatus.rightHandVisible || hipStatus.authoredHandVisibleMeshes > 0 || hipStatus.m4BakedHandVisibleMeshes > 0,
        `weapon ${weaponIdx} had no right/proxy/authored hand visible`
      );
      if (hipStatus.handFit?.leftBase) {
        pageAssert(
          hipStatus.leftHandVisible || hipStatus.authoredHandVisibleMeshes > 0 || hipStatus.m4BakedHandVisibleMeshes > 0,
          `weapon ${weaponIdx} expected support hand or authored hand`
        );
      }

      dbg.setAds(1);
      const ads = await probe({ speed: 0.4, sprint: 0, ads: 1, turn: -0.08 }, 3);
      finitePose(ads.viewmodel, `weapon.${weaponIdx}.ads`);
      const adsStatus = dbg.weaponVisualStatus();
      pageAssert(adsStatus.handPlacement.nonFiniteEvents === 0, `weapon ${weaponIdx} ADS introduced non-finite hand placement`);
      weaponRows.push({
        weaponIdx,
        name: hipStatus.name,
        handFit: hipStatus.handFit?.id || 'unknown',
        handOffset: Number((hipStatus.handGrip?.placement?.maxOffset || 0).toFixed(4)),
        handRotation: Number((hipStatus.handGrip?.placement?.maxRotation || 0).toFixed(4))
      });
    }

    prepPlayer();
    dbg.switchWeapon(playable.includes(0) ? 0 : playable[0]);
    const idle = await probe({ speed: 0, ads: 0 }, 5);
    const walk = await probe({ speed: 3.2, ads: 0, turn: 0.18 }, 5);
    const sprint = await probe({ speed: 8.4, sprint: 1, ads: 0, turn: -0.22 }, 5);
    const crouch = await probe({ speed: 1.2, crouch: 1, ads: 0, turn: 0.05 }, 5);
    const jump = await probe({ speed: 3.8, jump: 1, ads: 0 }, 5);
    const fall = await probe({ speed: 3.0, fall: 1, ads: 0 }, 5);
    const land = await probe({ speed: 1.4, land: 1, ads: 0 }, 5);

    for (const [label, sample] of Object.entries({ idle, walk, sprint, crouch, jump, fall, land })) {
      finitePose(sample.viewmodel, `body.${label}`);
      const bp = sample.bodyPresence;
      pageAssert(bp.parts >= 20, `${label} body presence should have a full lower-body rig`);
      pageAssert(bp.health.nonFiniteEvents === 0, `${label} body presence had non-finite events`);
      pageAssert(bp.health.maxPoseDelta <= 1.35, `${label} body presence pose delta exceeded clamp`);
      if (label !== 'idle') pageAssert(bp.visible, `${label} should show lower-body presence`);
    }
    pageAssert(['walk', 'sprint', 'crouch', 'air', 'fall', 'land'].includes(walk.bodyPresence.state.mode), `walk mode unexpected: ${walk.bodyPresence.state.mode}`);
    pageAssert(sprint.bodyPresence.state.mode === 'sprint' || sprint.bodyPresence.state.sprint > 0.8, 'sprint body mode did not engage');
    pageAssert(crouch.bodyPresence.state.mode === 'crouch' || crouch.bodyPresence.state.crouch > 0.8, 'crouch body mode did not engage');
    pageAssert(jump.bodyPresence.state.mode === 'air', `jump body mode expected air, got ${jump.bodyPresence.state.mode}`);
    pageAssert(fall.bodyPresence.state.mode === 'fall', `fall body mode expected fall, got ${fall.bodyPresence.state.mode}`);
    pageAssert(land.bodyPresence.state.mode === 'land', `land body mode expected land, got ${land.bodyPresence.state.mode}`);

    const slide = await probe({ speed: 7.4, slide: true, slideAmt: 1, slideSide: -0.55, ads: 0 }, 12);
    pageAssert(slide.viewmodel.slideLegs.visible, 'slide-specific legs should still win during slide');
    pageAssert(!slide.bodyPresence.visible || slide.bodyPresence.state.target === 0, 'general body rig should yield during slide');

    const dropkick = await probe({ speed: 8, dropkick: true, dropkickT: 0.22, dropkickImpact: 0.2, ads: 0 }, 12);
    pageAssert(dropkick.viewmodel.dropkickFeet.visible, 'dropkick feet should still win during dropkick');
    pageAssert(!dropkick.bodyPresence.visible || dropkick.bodyPresence.state.target === 0, 'general body rig should yield during dropkick');

    prepPlayer();
    if (dbg.equipScope) dbg.equipScope(1);
    const hipBody = await probe({ speed: 4, ads: 0 }, 6);
    const scopedBody = await probe({ speed: 4, ads: 1 }, 14);
    pageAssert(
      !scopedBody.bodyPresence.visible || scopedBody.bodyPresence.state.vis < hipBody.bodyPresence.state.vis,
      'scoped ADS should fade lower-body presence out of the sight picture'
    );

    prepPlayer();
    dbg.switchWeapon(playable.includes(1) ? 1 : playable[0]);
    await probe({ speed: 2, ads: 0 }, 3);
    const beforeFault = dbg.weaponVisualStatus().handPlacement;
    const largeFault = dbg.setHandPlacementFaultProbe('large');
    finitePose(largeFault.viewmodel, 'fault.large');
    const afterLarge = largeFault.weapon.handPlacement;
    pageAssert(afterLarge.clampEvents > beforeFault.clampEvents, 'large finite hand pose should be clamped');
    const nanFault = dbg.setHandPlacementFaultProbe('nan');
    finitePose(nanFault.viewmodel, 'fault.nan');
    const afterNan = nanFault.weapon.handPlacement;
    pageAssert(afterNan.nonFiniteEvents > afterLarge.nonFiniteEvents || afterNan.snapResets > afterLarge.snapResets, 'non-finite hand pose should reset or record health');

    return {
      weapons: weaponRows,
      bodyPresence: {
        idle: idle.bodyPresence.state,
        walk: walk.bodyPresence.state,
        sprint: sprint.bodyPresence.state,
        crouch: crouch.bodyPresence.state,
        jump: jump.bodyPresence.state,
        fall: fall.bodyPresence.state,
        land: land.bodyPresence.state,
        slideYield: { visible: slide.bodyPresence.visible, state: slide.bodyPresence.state },
        dropkickYield: { visible: dropkick.bodyPresence.visible, state: dropkick.bodyPresence.state },
        scopedVis: {
          hip: hipBody.bodyPresence.state.vis,
          scoped: scopedBody.bodyPresence.state.vis
        }
      },
      handRecovery: {
        beforeFault,
        afterLarge,
        afterNan
      }
    };
  });

  fs.writeFileSync(path.join(OUT_DIR, 'embodiment-feel-smoke.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log('embodiment feel smoke ok');
  console.log(JSON.stringify(result, null, 2));

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
} finally {
  await context.close();
  await browser.close();
}
