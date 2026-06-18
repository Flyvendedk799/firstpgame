import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots/pistol-ads-release-hip-restore');
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

function poseDelta(a, b, key) {
  const av = a?.[key];
  const bv = b?.[key];
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

function maxJump(samples, key, startMs = 0) {
  let max = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i].t || 0) < startMs) continue;
    max = Math.max(max, poseDelta(samples[i - 1], samples[i], key));
  }
  return max;
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
    () => window.__game?.debug?.switchWeapon && window.__game?.debug?.viewmodelPose && window.__game?.debug?.weaponVisualStatus,
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
    const pistols = [1, 6].filter((idx) => playable.includes(idx));
    const awayIdx = playable.includes(0) ? 0 : playable.find((idx) => !pistols.includes(idx) && idx !== 2);
    return { playable, pistols, awayIdx };
  });

  assert(setup.pistols.length > 0, `no pistol weapons available: ${setup.playable.join(',')}`);
  assert(setup.awayIdx != null, `no non-pistol away weapon available: ${setup.playable.join(',')}`);

  async function holdAds(on) {
    await page.evaluate((enabled) => {
      const P = window.__game.debug.P();
      P._debugAdsHold = !!enabled;
    }, on);
  }

  async function sample(label) {
    return page.evaluate((sampleLabel) => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      const pov = dbg.povState();
      const pose = dbg.viewmodelPose();
      const visual = dbg.weaponVisualStatus();
      const cleanPose = (p) => p ? {
        p: (p.p || []).slice(0, 3),
        r: (p.r || []).slice(0, 3),
        s: (p.s || []).slice(0, 3),
        visible: !!p.visible
      } : null;
      return {
        label: sampleLabel,
        at: performance.now(),
        weaponIdx: P.weaponIdx,
        ads: pov.ads || 0,
        adsVis: pov.adsVis || 0,
        adsTarget: pov.adsTarget || 0,
        optic: !!pov.optic,
        rGrp: cleanPose(pose.rGrp),
        lGrp: cleanPose(pose.lGrp),
        gunGrp: cleanPose(pose.gunGrp),
        pistolAdsRelease: pose.pistolAdsRelease || null,
        pistolAdsHipRestore: pose.pistolAdsHipRestore || null,
        armSightlineCrop: pose.armSightlineCrop || null,
        adsSightlineHandClearance: pose.adsSightlineHandClearance || null,
        pistolSightlineHandsHidden: !!pose.pistolSightlineHandsHidden,
        pistolSupportSightlineCropActive: !!pose.pistolSupportSightlineCropActive,
        handPlacement: visual.handPlacement || null,
        handGrip: visual.handGrip || null
      };
    }, label);
  }

  async function waitForAds(label, timeoutMs = 1800) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeoutMs) {
      last = await sample(label);
      if (last.adsVis > 0.88 && last.adsTarget > 0.5) return last;
      await page.waitForTimeout(45);
    }
    throw new Error(`${label} did not reach settled ADS: ${JSON.stringify(last)}`);
  }

  async function collectRelease(label, durationMs = 1350, intervalMs = 45) {
    await holdAds(false);
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

  function assertPoseSane(row, contextLabel) {
    for (const key of ['rGrp', 'lGrp', 'gunGrp']) {
      const pose = row[key];
      assert(pose, `${contextLabel} missing ${key}`);
      assert(finiteList([...(pose.p || []), ...(pose.r || []), ...(pose.s || [])]), `${contextLabel} ${key} has non-finite values: ${JSON.stringify(pose)}`);
      assert(maxAbs(pose.p || []) < 1.35, `${contextLabel} ${key} position out of bounds: ${JSON.stringify(pose)}`);
      assert(maxAbs(pose.r || []) < 3.1, `${contextLabel} ${key} rotation out of bounds: ${JSON.stringify(pose)}`);
      assert(maxAbs(pose.s || []) < 1.35 && Math.min(...(pose.s || [1])) > 0.45, `${contextLabel} ${key} scale out of bounds: ${JSON.stringify(pose)}`);
    }
  }

  function assertHipRestored(scenario, baseline, samples) {
    const final = samples[samples.length - 1];
    const sawTail = samples.some((s) => s.pistolAdsRelease?.active);
    const sawRestore = samples.some((s) => s.pistolAdsHipRestore?.version === 'first-person-pistol-ads-hip-restore.v1');
    assert(sawTail, `${scenario} never entered pistol ADS release tail`);
    assert(sawRestore, `${scenario} never recorded pistol ADS hip restore`);
    assert(final.ads < 0.001 && final.adsVis < 0.001 && final.adsTarget < 0.5, `${scenario} did not settle to hip ADS state: ${JSON.stringify(final)}`);
    assert(final.rGrp.visible && final.lGrp.visible && final.gunGrp.visible, `${scenario} viewmodel visibility broke after release: ${JSON.stringify(final)}`);
    assert(!final.pistolSightlineHandsHidden, `${scenario} pistol hands remained hidden after release`);
    assert(!final.pistolSupportSightlineCropActive, `${scenario} support sightline crop remained active after release`);
    assert(!final.armSightlineCrop?.rightForearm && !final.armSightlineCrop?.leftForearm && !final.armSightlineCrop?.pistolSupport, `${scenario} arm crop remained active after release: ${JSON.stringify(final.armSightlineCrop)}`);
    assert(!final.adsSightlineHandClearance?.active, `${scenario} ADS sightline clearance remained active after release: ${JSON.stringify(final.adsSightlineHandClearance)}`);
    assert((final.handPlacement?.nonFiniteEvents || 0) === 0, `${scenario} hand placement reported non-finite events: ${JSON.stringify(final.handPlacement)}`);
    assert((final.handGrip?.placement?.nonFiniteEvents || 0) === 0, `${scenario} hand grip reported non-finite events: ${JSON.stringify(final.handGrip?.placement)}`);
    assertPoseSane(final, scenario);
    assert(poseDelta(final, baseline, 'rGrp') < 0.22, `${scenario} right arm failed to return near hip baseline`);
    assert(poseDelta(final, baseline, 'lGrp') < 0.26, `${scenario} left arm failed to return near hip baseline`);
    assert(poseDelta(final, baseline, 'gunGrp') < 0.26, `${scenario} gun failed to return near hip baseline`);
    assert(maxJump(samples, 'rGrp', 220) < 0.36, `${scenario} right arm twitched after release settle`);
    assert(maxJump(samples, 'lGrp', 220) < 0.40, `${scenario} left arm twitched after release settle`);
    assert(maxJump(samples, 'gunGrp', 220) < 0.42, `${scenario} gun twitched after release settle`);
    return {
      final: {
        ads: Number(final.ads.toFixed(5)),
        adsVis: Number(final.adsVis.toFixed(5)),
        hipRestore: final.pistolAdsHipRestore,
        crop: final.armSightlineCrop,
        clearance: final.adsSightlineHandClearance
      },
      maxJumps: {
        rightArm: Number(maxJump(samples, 'rGrp', 220).toFixed(5)),
        leftArm: Number(maxJump(samples, 'lGrp', 220).toFixed(5)),
        gun: Number(maxJump(samples, 'gunGrp', 220).toFixed(5))
      }
    };
  }

  const scenarios = [];
  for (const weaponIdx of setup.pistols) {
    await page.evaluate((idx) => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.attachments.scope = null;
      dbg.switchWeapon(idx);
      dbg.setAds(0);
      P._debugAdsHold = false;
    }, weaponIdx);
    await page.waitForTimeout(520);
    const baseline = await sample(`pistol-${weaponIdx}-iron-hip-baseline`);
    await holdAds(true);
    const ads = await waitForAds(`pistol-${weaponIdx}-iron-ads`);
    const release = await collectRelease(`pistol-${weaponIdx}-iron-release`);
    scenarios.push({
      name: `pistol-${weaponIdx}-iron-release`,
      ads: { adsVis: Number(ads.adsVis.toFixed(5)), optic: ads.optic },
      ...assertHipRestored(`pistol ${weaponIdx} iron release`, baseline, release)
    });
  }

  await page.evaluate(({ awayIdx }) => {
    const dbg = window.__game.debug;
    const P = dbg.P();
    dbg.equipPistolScope(2);
    dbg.setAds(0);
    P._debugAdsHold = false;
    P.reloading = false;
    P.vaulting = false;
    P.dropkickActive = false;
    P._handPlacementHealth = null;
    dbg.switchWeapon(1, true);
    window.__pistolAdsReleaseAwayIdx = awayIdx;
  }, setup);
  await page.waitForTimeout(620);
  const scopedBaseline = await sample('pistol-scoped-hip-baseline');
  await holdAds(true);
  const scopedAds = await waitForAds('pistol-scoped-before-switch', 2200);
  assert(scopedAds.optic, `pistol scoped scenario did not expose optic state: ${JSON.stringify(scopedAds)}`);
  await page.evaluate(() => {
    const dbg = window.__game.debug;
    dbg.switchWeapon(window.__pistolAdsReleaseAwayIdx);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__game.debug.switchWeapon(1));
  await page.waitForTimeout(720);
  const scopedSwitchBack = await sample('pistol-scoped-switch-back');
  assert(scopedSwitchBack.weaponIdx === 1, `scoped switch-back did not return to pistol: ${JSON.stringify(scopedSwitchBack)}`);
  const scopedRelease = await collectRelease('pistol-scoped-switch-release', 1550, 45);
  scenarios.push({
    name: 'pistol-scoped-switch-release',
    switchBack: {
      adsVis: Number(scopedSwitchBack.adsVis.toFixed(5)),
      optic: scopedSwitchBack.optic,
      hipRestoreBeforeRelease: scopedSwitchBack.pistolAdsHipRestore || null
    },
    ...assertHipRestored('pistol scoped switch release', scopedBaseline, scopedRelease)
  });

  const result = {
    ok: true,
    baseUrl: url.toString(),
    setup,
    scenarios
  };

  fs.writeFileSync(path.join(OUT_DIR, 'pistol-ads-release-hip-restore-regression.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log('pistol ADS release hip restore regression ok');
  console.log(JSON.stringify(result, null, 2));

  if (errors.length) {
    console.error('Console errors:', errors);
    process.exit(1);
  }
} finally {
  await context.close();
  await browser.close();
}
