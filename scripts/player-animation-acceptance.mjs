import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE_URL + '?perf=1', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(800);
await page.waitForFunction(() => window.__game?.debug?.forcePostState, null, { timeout: 45000 });

const ok = await page.evaluate(async () => {
  function matOk(m) {
    if (!m || !m.elements) return true;
    for (let i = 0; i < m.elements.length; i++) {
      if (!Number.isFinite(m.elements[i])) return false;
    }
    return true;
  }
  const dbg = window.__game.debug;
  const ld = dbg.buildLevel(1);
  const G = dbg.G();
  const P = dbg.P();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitUntil = async (fn, timeout = 2000, step = 50) => {
    const start = performance.now();
    let value = fn();
    while (!value && performance.now() - start < timeout) {
      await sleep(step);
      value = fn();
    }
    return value || fn();
  };
  G.levelData = ld;
  G.building = 1;
  G.started = true;
  G.menuOpen = false;
  P.dead = false;
  const restartGate = await new Promise((resolve) => {
    const prev = {
      building: G.building,
      started: G.started,
      menuOpen: G.menuOpen,
      dead: P.dead,
      hp: P.hp
    };
    const endscreen = document.getElementById('endscreen');
    const ending = document.getElementById('ending-overlay');
    endscreen?.classList.remove('show');
    ending?.classList.remove('show');
    G.started = true;
    G.menuOpen = false;
    G.building = 4;
    P.dead = true;
    P.hp = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, repeat: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    setTimeout(() => {
      const after = { building: G.building, started: G.started, dead: P.dead };
      G.building = prev.building;
      G.started = prev.started;
      G.menuOpen = prev.menuOpen;
      P.dead = prev.dead;
      P.hp = prev.hp;
      resolve({
        blocked: after.building === 4 && after.started === true && after.dead === true,
        after
      });
    }, 50);
  });
  P.dead = false;
  G.started = true;
  G.menuOpen = false;
  dbg.switchWeapon(dbg.playableWeaponIndices?.()[0] ?? 1);
  const handFits = [];
  const finitePose = (pose) => !pose || Object.values(pose).every((v) => Number.isFinite(v));
  for (const wi of dbg.playableWeaponIndices?.() || [1]) {
    dbg.switchWeapon(wi);
    const st = dbg.weaponVisualStatus();
    handFits.push({
      weaponIdx: wi,
      fit: st.handFit,
      finite:
        !!st.handFit &&
        finitePose(st.handFit.rightBase) &&
        finitePose(st.handFit.leftBase) &&
        finitePose(st.handFit.rightCurrent) &&
        finitePose(st.handFit.leftCurrent),
      supportOnLongGun: ![1, 2, 6].includes(wi) ? st.handFit?.leftBase?.z < -0.12 : true
    });
  }
  let scopedPov = { present: false };
  if (dbg.equipScope && dbg.setAds && dbg.povState) {
    dbg.equipScope(4);
    dbg.setAds(1);
    await waitUntil(() => {
      const pov = dbg.povState();
      return !!(pov && pov.targetFov < pov.baseFov - 30 && pov.fov < pov.baseFov - 20);
    }, 2200);
    const pov = dbg.povState();
    scopedPov = {
      present: !!pov,
      fov: pov?.fov,
      targetFov: pov?.targetFov,
      baseFov: pov?.baseFov,
      scoped: pov?.scoped,
      scopeSettle: pov?.scopeSettle,
      adsSettle: pov?.adsSettle,
      optic: pov?.optic,
      vignette: pov?.scopeVignetteOpacity
    };
    dbg.setAds(0);
  }
  const materialDepthStats = (root) => {
    const seen = new Set();
    const stats = { total: 0, depthTestFalse: 0, depthWriteFalse: 0, maxRenderOrder: 0 };
    root?.traverse?.((o) => {
      if (!o?.isMesh) return;
      stats.maxRenderOrder = Math.max(stats.maxRenderOrder, o.renderOrder || 0);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        stats.total++;
        if (m.depthTest === false) stats.depthTestFalse++;
        if (m.depthWrite === false) stats.depthWriteFalse++;
      }
    });
    return stats;
  };
  let slideDepth = { present: false };
  let guardSideLeanDepth = { present: false };
  let pistolComposition = { present: false };
  let ironSightShot = { present: false };
  if (dbg.gunGrp && dbg.switchWeapon && dbg.setAds && dbg.fireCurrentWeapon) {
    const weaponComposition = () => {
      const s = dbg.weaponVisualStatus?.();
      return s ? {
        weaponIdx: s.weaponIdx,
        visibleProceduralMeshes: s.visibleProceduralMeshes,
        visibleGlbMeshes: s.visibleGlbMeshes,
        gunVisible: !!s.gunVisible
      } : null;
    };
    dbg.switchWeapon(1);
    dbg.setAds(1);
    P.lastShot = 0;
    P.ammo = Math.max(P.ammo || 0, 2);
    P.ammoRes = Math.max(P.ammoRes || 0, 12);
    await sleep(500);
    const baseline = materialDepthStats(dbg.gunGrp());
    P.sliding = true;
    P.slideTarget = 1;
    P.slideAmt = 1;
    P.slideTimer = 0.12;
    P.slideLocalR = 0.65;
    P.slideLocalF = 0.75;
    await sleep(220);
    const during = materialDepthStats(dbg.gunGrp());
    const slideDuringWeapon = weaponComposition();
    P.sliding = false;
    P.slideTarget = 0;
    P.slideAmt = 0;
    P.slideTimer = 0;
    P.slideExitGrace = 0;
    P.slideCarryTimer = 0;
    P._slidePresentationUntil = 0;
    P._slideLegVis = 0;
    await sleep(360);
    const restored = materialDepthStats(dbg.gunGrp());
    const slideRestoredWeapon = weaponComposition();
    slideDepth = { present: true, baseline, during, restored };
    const guardBaseline = materialDepthStats(dbg.gunGrp());
    P.guardMode = 'wall';
    P._guardVisualMode = 'wall';
    P.guardBehindHeld = true;
    P.guardBehindActive = true;
    P.guardBehindAmt = 1;
    P.guardPeekSide = 1;
    await sleep(260);
    const guardDuring = materialDepthStats(dbg.gunGrp());
    const guardDuringWeapon = weaponComposition();
    P.guardBehindHeld = false;
    P.guardBehindActive = false;
    P.guardBehindAmt = 0;
    P.guardPeekSide = 0;
    P.guardMode = 'none';
    P._guardVisualMode = 'none';
    await sleep(360);
    const guardRestored = materialDepthStats(dbg.gunGrp());
    const guardRestoredWeapon = weaponComposition();
    guardSideLeanDepth = { present: true, baseline: guardBaseline, during: guardDuring, restored: guardRestored };
    pistolComposition = {
      present: true,
      slideDuring: slideDuringWeapon,
      slideRestored: slideRestoredWeapon,
      guardDuring: guardDuringWeapon,
      guardRestored: guardRestoredWeapon
    };
    P.lastShot = 0;
    P.ammo = Math.max(P.ammo || 0, 2);
    dbg.fireCurrentWeapon();
    ironSightShot = { present: true, shot: P._lastPlayerShotAim };
    dbg.setAds(0);
  }
  for (let i = 0; i < 8; i++) {
    window.dispatchEvent(new Event('resize'));
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      const cam = dbg.camera();
      const gun = dbg.gunGrp();
      const camOk = matOk(cam && cam.matrixWorld);
      const gunOk = matOk(gun && gun.matrixWorld);
      const wv = dbg.weaponVisualStatus();
      const pr = dbg.playerProxy();
      resolve({
        camOk,
        gunOk,
        hasWeaponStatus: !!wv,
        hasProxy: !!pr,
        grip: wv && wv.gripPose,
        handFits,
        scopedPov,
        slideDepth,
        guardSideLeanDepth,
        pistolComposition,
        ironSightShot,
        restartGate
      });
    }, 800);
  });
});

if (errors.length) throw new Error(errors.join('\n'));
if (!ok.camOk || !ok.gunOk) throw new Error(`matrix check failed ${JSON.stringify(ok)}`);
if (!ok.hasWeaponStatus) throw new Error('weaponVisualStatus missing');
if (!ok.hasProxy) throw new Error('playerProxy missing');
if (!ok.handFits?.every((h) => h.finite && h.supportOnLongGun)) throw new Error(`hand fit check failed ${JSON.stringify(ok.handFits)}`);
if (!ok.restartGate?.blocked) throw new Error(`jump restart gate failed ${JSON.stringify(ok.restartGate)}`);
if (!ok.scopedPov?.present) throw new Error('povState missing');
if (!(Number.isFinite(ok.scopedPov.fov) && Number.isFinite(ok.scopedPov.targetFov) && Number.isFinite(ok.scopedPov.baseFov))) throw new Error(`scoped POV has non-finite FOV ${JSON.stringify(ok.scopedPov)}`);
if (!(ok.scopedPov.scoped > 0.9 && ok.scopedPov.scopeSettle > 0.85)) throw new Error(`scoped POV did not settle ${JSON.stringify(ok.scopedPov)}`);
if (!(ok.scopedPov.targetFov < ok.scopedPov.baseFov - 30 && ok.scopedPov.fov < ok.scopedPov.baseFov - 20)) throw new Error(`scoped FOV did not tighten ${JSON.stringify(ok.scopedPov)}`);
if (!ok.slideDepth?.present) throw new Error('slide depth restoration probe missing');
if (!(ok.slideDepth.during.depthTestFalse === ok.slideDepth.baseline.depthTestFalse && ok.slideDepth.during.depthWriteFalse === ok.slideDepth.baseline.depthWriteFalse)) throw new Error(`pistol ADS gun depth changed during slide ${JSON.stringify(ok.slideDepth)}`);
if (!(ok.slideDepth.restored.depthTestFalse === ok.slideDepth.baseline.depthTestFalse && ok.slideDepth.restored.depthWriteFalse === ok.slideDepth.baseline.depthWriteFalse)) throw new Error(`slide depth override leaked after slide ${JSON.stringify(ok.slideDepth)}`);
if (!ok.guardSideLeanDepth?.present) throw new Error('guard sidelean depth restoration probe missing');
if (!(ok.guardSideLeanDepth.during.depthTestFalse === ok.guardSideLeanDepth.baseline.depthTestFalse && ok.guardSideLeanDepth.during.depthWriteFalse === ok.guardSideLeanDepth.baseline.depthWriteFalse)) throw new Error(`pistol ADS gun depth changed during guard sidelean ${JSON.stringify(ok.guardSideLeanDepth)}`);
if (!(ok.guardSideLeanDepth.restored.depthTestFalse === ok.guardSideLeanDepth.baseline.depthTestFalse && ok.guardSideLeanDepth.restored.depthWriteFalse === ok.guardSideLeanDepth.baseline.depthWriteFalse)) throw new Error(`guard sidelean depth override leaked after guard ${JSON.stringify(ok.guardSideLeanDepth)}`);
if (!ok.pistolComposition?.present) throw new Error('pistol composition probe missing');
for (const [phase, state] of Object.entries(ok.pistolComposition)) {
  if (phase === 'present' || !state || state.weaponIdx !== 1 || !(state.visibleGlbMeshes > 0)) continue;
  if (state.visibleProceduralMeshes !== 0) throw new Error(`authored pistol was mixed with procedural meshes during ${phase}: ${JSON.stringify(ok.pistolComposition)}`);
}
if (!(ok.ironSightShot?.shot?.precision && ok.ironSightShot.shot.spread === 0)) throw new Error(`iron-sight ADS shot was not precise ${JSON.stringify(ok.ironSightShot)}`);

fs.writeFileSync(path.join(OUT_DIR, 'player-animation-acceptance.json'), JSON.stringify({ ok: true, ok }, null, 2));
console.log(JSON.stringify({ ok: true, summary: 'screenshots/player-animation-acceptance.json' }));

await context.close();
await browser.close();
