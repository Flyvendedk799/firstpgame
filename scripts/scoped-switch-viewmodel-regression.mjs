import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots/scoped-switch-viewmodel');
fs.mkdirSync(OUT_DIR, { recursive: true });

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function finiteList(values) {
  return values.every((v) => Number.isFinite(Number(v)));
}

function maxAbs(values) {
  return values.reduce((m, v) => Math.max(m, Math.abs(Number(v) || 0)), 0);
}

function poseJump(a, b, key) {
  const av = a?.pose?.[key];
  const bv = b?.pose?.[key];
  if (!av || !bv) return 0;
  return Math.max(
    Math.abs((av.p?.[0] || 0) - (bv.p?.[0] || 0)),
    Math.abs((av.p?.[1] || 0) - (bv.p?.[1] || 0)),
    Math.abs((av.p?.[2] || 0) - (bv.p?.[2] || 0)),
    Math.abs((av.r?.[0] || 0) - (bv.r?.[0] || 0)),
    Math.abs((av.r?.[1] || 0) - (bv.r?.[1] || 0)),
    Math.abs((av.r?.[2] || 0) - (bv.r?.[2] || 0))
  );
}

function maxStableJump(samples, key, startMs) {
  let maxJump = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i].t || 0) < startMs) continue;
    maxJump = Math.max(maxJump, poseJump(samples[i - 1], samples[i], key));
  }
  return maxJump;
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
    () => window.__game?.debug?.switchWeapon && window.__game?.debug?.setAds && window.__game?.debug?.viewmodelPose,
    null,
    { timeout: 45000 }
  );

  const setup = await page.evaluate(() => {
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
    P._handPlacementHealth = null;
    const playable = dbg.playableWeaponIndices?.() || [];
    const scopedIdx = playable.includes(7) ? 7 : (playable.includes(5) ? 5 : null);
    const awayIdx = playable.includes(1) ? 1 : playable.find((idx) => idx !== scopedIdx && idx !== 2);
    return { playable, scopedIdx, awayIdx };
  });

  assert(setup.scopedIdx != null, `no scoped weapon available: ${setup.playable.join(',')}`);
  assert(setup.awayIdx != null, `no away weapon available: ${setup.playable.join(',')}`);

  async function sample(label) {
    return page.evaluate((sampleLabel) => {
      const dbg = window.__game.debug;
      const pov = dbg.povState();
      const pose = dbg.viewmodelPose();
      const visual = dbg.weaponVisualStatus();
      const grip = dbg.handGripStatus();
      return {
        label: sampleLabel,
        at: performance.now(),
        pov,
        pose,
        visual: {
          weaponIdx: visual.weaponIdx,
          name: visual.name,
          equipSanity: visual.equipSanity,
          equipCleanup: visual.equipCleanup,
          rootGuard: visual.rootGuard,
          animation: visual.animation,
          handGrip: visual.handGrip
        },
        grip
      };
    }, label);
  }

  async function collect(label, durationMs = 900, intervalMs = 45) {
    const start = Date.now();
    const samples = [];
    while (Date.now() - start <= durationMs) {
      const s = await sample(label);
      s.t = Date.now() - start;
      samples.push(s);
      await page.waitForTimeout(intervalMs);
    }
    return samples;
  }

  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.evaluate(({ scopedIdx }) => {
    const dbg = window.__game.debug;
    dbg.switchWeapon(scopedIdx);
    dbg.setAds(1);
  }, setup);
  await page.waitForTimeout(640);
  const scopedBefore = await sample('scoped-before-switch');
  assert(scopedBefore.pov.adsVis > 0.65, `scoped ADS did not engage before switch: ${JSON.stringify(scopedBefore.pov)}`);
  assert(scopedBefore.pov.optic, `scoped weapon missing optic profile before switch: ${JSON.stringify(scopedBefore.pov.optic)}`);

  await page.evaluate(({ awayIdx }) => window.__game.debug.switchWeapon(awayIdx), setup);
  await page.waitForTimeout(260);
  const away = await sample('away-weapon-held-ads');
  assert(away.visual.equipCleanup?.opticSensitive, `switching away from scope did not mark optic-sensitive cleanup: ${JSON.stringify(away.visual.equipCleanup)}`);
  assert(Math.abs(away.pov.scopeEyeX || 0) < 0.0001 && Math.abs(away.pov.scopeEyeY || 0) < 0.0001, `scope eye offset survived switch away: ${JSON.stringify(away.pov)}`);

  await page.evaluate(({ scopedIdx }) => window.__game.debug.switchWeapon(scopedIdx), setup);
  await page.waitForTimeout(35);
  const switchBackImmediate = await sample('switch-back-immediate');
  assert(switchBackImmediate.visual.equipCleanup?.opticSensitive, `switch back cleanup did not mark optic-sensitive: ${JSON.stringify(switchBackImmediate.visual.equipCleanup)}`);
  assert((switchBackImmediate.pov.adsVis || 0) <= 0.08, `ADS visual should be reset immediately on scoped switch-back: ${JSON.stringify(switchBackImmediate.pov)}`);
  assert((switchBackImmediate.pov.scopeSettle || 0) <= 0.08, `scope settle should be reset immediately on scoped switch-back: ${JSON.stringify(switchBackImmediate.pov)}`);
  assert(Math.abs(switchBackImmediate.pov.scopeEyeX || 0) < 0.0001 && Math.abs(switchBackImmediate.pov.scopeEyeY || 0) < 0.0001, `scope eye offset survived switch back: ${JSON.stringify(switchBackImmediate.pov)}`);

  const samples = await collect('switch-back-reacquire', 1050, 42);
  const stable = samples[samples.length - 1];
  assert(stable.pov.adsVis > 0.46, `held ADS did not reacquire after cleanup: ${JSON.stringify(stable.pov)}`);
  assert(stable.pov.optic, `scoped weapon missing optic after reacquire: ${JSON.stringify(stable.pov.optic)}`);

  const poseKeys = ['gunGrp', 'rGrp', 'lGrp'];
  for (const s of [scopedBefore, away, switchBackImmediate, stable, ...samples]) {
    for (const key of poseKeys) {
      const p = s.pose?.[key];
      const rot = Array.isArray(p?.r) ? p.r.slice(0, 3) : [];
      assert(p && finiteList([...(p.p || []), ...rot, ...(p.s || [])]), `${s.label} ${key} has non-finite transform: ${JSON.stringify(p)}`);
      assert(maxAbs(p.p || []) < 1.4, `${s.label} ${key} position out of sane bounds: ${JSON.stringify(p)}`);
      assert(maxAbs(rot) < 3.2, `${s.label} ${key} rotation out of sane bounds: ${JSON.stringify(p)}`);
    }
  }

  const handHealth = stable.pose.handPlacement || {};
  const gripPlacement = stable.grip?.placement || {};
  assert((handHealth.nonFiniteEvents || 0) === 0, `hand placement reported non-finite events: ${JSON.stringify(handHealth)}`);
  assert((gripPlacement.nonFiniteEvents || 0) === 0, `hand grip reported non-finite events: ${JSON.stringify(gripPlacement)}`);

  const maxGunJump = maxStableJump(samples, 'gunGrp', 260);
  const maxRightJump = maxStableJump(samples, 'rGrp', 260);
  const maxLeftJump = maxStableJump(samples, 'lGrp', 260);
  assert(maxGunJump < 0.42, `gun viewmodel jumped during scoped switch-back reacquire: ${maxGunJump.toFixed(4)}`);
  assert(maxRightJump < 0.42, `right arm jumped during scoped switch-back reacquire: ${maxRightJump.toFixed(4)}`);
  assert(maxLeftJump < 0.50, `left arm jumped during scoped switch-back reacquire: ${maxLeftJump.toFixed(4)}`);

  const result = {
    ok: true,
    baseUrl: url.toString(),
    setup,
    scopedBefore: {
      adsVis: scopedBefore.pov.adsVis,
      optic: scopedBefore.pov.optic,
      weaponIdx: scopedBefore.visual.weaponIdx
    },
    switchBackImmediate: {
      ads: switchBackImmediate.pov.ads,
      adsVis: switchBackImmediate.pov.adsVis,
      scopeSettle: switchBackImmediate.pov.scopeSettle,
      cleanup: switchBackImmediate.visual.equipCleanup,
      rootGuard: switchBackImmediate.visual.rootGuard
    },
    stable: {
      adsVis: stable.pov.adsVis,
      scopeSettle: stable.pov.scopeSettle,
      optic: stable.pov.optic,
      weaponIdx: stable.visual.weaponIdx,
      handPlacement: stable.pose.handPlacement,
      gripPlacement: stable.grip?.placement
    },
    maxJumps: {
      gun: Number(maxGunJump.toFixed(5)),
      rightArm: Number(maxRightJump.toFixed(5)),
      leftArm: Number(maxLeftJump.toFixed(5))
    }
  };

  fs.writeFileSync(path.join(OUT_DIR, 'scoped-switch-viewmodel-regression.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log('scoped switch viewmodel regression ok');
  console.log(JSON.stringify(result, null, 2));

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
} finally {
  await page.keyboard.up('KeyW').catch(() => {});
  await page.keyboard.up('KeyD').catch(() => {});
  await context.close();
  await browser.close();
}
