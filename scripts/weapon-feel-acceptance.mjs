import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots/weapon-feel');
fs.mkdirSync(OUT_DIR, { recursive: true });

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function safeName(name) {
  return String(name || 'weapon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pngStats(buffer) {
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let lit = 0;
  let centerLit = 0;
  let centerCount = 0;
  const cx0 = Math.floor(png.width * 0.44);
  const cx1 = Math.ceil(png.width * 0.56);
  const cy0 = Math.floor(png.height * 0.40);
  const cy1 = Math.ceil(png.height * 0.60);
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const luma = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      min = Math.min(min, luma);
      max = Math.max(max, luma);
      if (luma > 8) lit++;
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        centerCount++;
        if (luma > 8) centerLit++;
      }
    }
  }
  return {
    width: png.width,
    height: png.height,
    min,
    max,
    litRatio: lit / (png.width * png.height),
    centerLitRatio: centerCount ? centerLit / centerCount : 0
  };
}

function finitePose(pose) {
  return !!pose && Object.values(pose).every((v) => Number.isFinite(Number(v)));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push({ type: 'pageerror', text: e.message }));
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
  await page.waitForFunction(() => window.__game?.debug?.weaponVisualStatus && window.__game?.debug?.povState, null, { timeout: 45000 });

  await page.evaluate(() => {
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
    P.dropkickActive = false;
    P.vaulting = false;
  });

  const weaponIndices = await page.evaluate(() => {
    const playable = window.__game.debug.playableWeaponIndices?.() || [];
    return playable.filter((idx) => idx !== 2);
  });
  assert(weaponIndices.length > 0, 'no playable firearms exposed through debug API');

  const report = {
    ok: true,
    baseUrl: url.toString(),
    skippedReferenceWeapons: [],
    weapons: []
  };
  const hasM4 = await page.evaluate(() => (window.__game.debug.playableWeaponIndices?.() || []).includes(0));
  if (!hasM4) report.skippedReferenceWeapons.push({ weaponIdx: 0, reason: 'M4 reference is removed from playable loadout' });

  async function sample(weaponIdx, weaponName, phase, action, waitMs = 280) {
    await page.evaluate(action, { weaponIdx });
    await page.waitForTimeout(waitMs);
    const status = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
    const pov = await page.evaluate(() => window.__game.debug.povState());
    const fileName = `${String(weaponIdx).padStart(2, '0')}-${safeName(weaponName)}-${phase}.png`;
    const screenshot = await page.screenshot({ path: path.join(OUT_DIR, fileName) });
    const stats = pngStats(screenshot);
    const visibleMeshCount =
      (status.visibleProceduralMeshes || 0) +
      (status.visibleGlbMeshes || 0) +
      (status.authoredM4VisibleMeshes || 0);
    const sightMode = status.weaponFeelProfile?.sight?.mode || null;
    const iron = pov.ironSight || {};
    const scopedOpticPresentation = !!pov.optic && Number(pov.scoped || 0) > 0.65 && ['ads', 'fire', 'slide-ads', 'lean-ads', 'guard-ads'].includes(phase);
    const sightCheck = {
      required: phase === 'ads' && ['iron', 'bead'].includes(sightMode),
      active: !!iron.active,
      residual: Number.isFinite(Number(iron.residual)) ? Number(iron.residual) : null,
      tolerance: Number.isFinite(Number(iron.tolerance)) ? Number(iron.tolerance) : null,
      withinTolerance: iron.withinTolerance == null ? null : !!iron.withinTolerance
    };
    if (sightCheck.required) {
      assert(sightCheck.active, `${weaponName} ADS sight solver was not active`);
      assert(sightCheck.residual != null && sightCheck.tolerance != null, `${weaponName} ADS sight residual missing`);
      assert(sightCheck.residual <= sightCheck.tolerance + 0.0005, `${weaponName} ADS residual ${sightCheck.residual} exceeds ${sightCheck.tolerance}`);
    }
    assert(stats.litRatio > 0.035 && stats.max - stats.min > 10, `${weaponName} ${phase} screenshot is blank-ish: ${JSON.stringify(stats)}`);
    assert(visibleMeshCount > 0 || scopedOpticPresentation, `${weaponName} ${phase} has no visible weapon mesh source`);
    assert(finitePose(status.animation?.pose), `${weaponName} ${phase} animation pose is not finite`);
    assert(finitePose(pov.gun), `${weaponName} ${phase} gun transform is not finite`);
    assert(!Object.hasOwn(status.animation || {}, 'damage'), `${weaponName} animation debug owns gameplay damage`);
    assert(!Object.hasOwn(status.animation || {}, 'ammo'), `${weaponName} animation debug owns gameplay ammo`);
    return {
      phase,
      screenshot: path.join(OUT_DIR, fileName),
      stats,
      status: {
        weaponIdx: status.weaponIdx,
        name: status.name,
        activeManifestId: status.activeManifestId,
        visibleProceduralMeshes: status.visibleProceduralMeshes,
        visibleGlbMeshes: status.visibleGlbMeshes,
        authoredM4VisibleMeshes: status.authoredM4VisibleMeshes,
        glbDeagleVisible: status.glbDeagleVisible,
        animation: status.animation,
        handGrip: status.handGrip,
        weaponFeelProfile: status.weaponFeelProfile
      },
      pov: {
        fov: pov.fov,
        targetFov: pov.targetFov,
        ads: pov.ads,
        adsVis: pov.adsVis,
        scoped: pov.scoped,
        optic: pov.optic,
        gun: pov.gun,
        ironSight: iron
      },
      sightCheck
    };
  }

  for (const weaponIdx of weaponIndices) {
    await page.evaluate(({ weaponIdx }) => {
      const dbg = window.__game.debug;
      const G = dbg.G();
      const P = dbg.P();
      G.started = true;
      G.menuOpen = false;
      G.invOpen = false;
      G.shopOpen = false;
      G.paused = false;
      P.dead = false;
      P.reloading = false;
      P.vaulting = false;
      P.dropkickActive = false;
      P.guardBehindHeld = false;
      P.guardBehindActive = false;
      P.guardBehindAmt = 0;
      P.guardPeekSide = 0;
      P.lean = 0;
      P.sliding = false;
      P.slideAmt = 0;
      P.slideTarget = 0;
      dbg.switchWeapon(weaponIdx);
      dbg.setAds(0);
    }, { weaponIdx });
    await page.waitForTimeout(320);
    const setup = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
    const weaponName = setup.name || `weapon-${weaponIdx}`;
    const phases = [];
    phases.push(await sample(weaponIdx, weaponName, 'hip', ({ weaponIdx }) => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.reloading = false;
      P.lastShot = 0;
      P.ammo = Math.max(P.ammo || 0, 2);
      dbg.switchWeapon(weaponIdx);
      dbg.setAds(0);
    }, 300));
    phases.push(await sample(weaponIdx, weaponName, 'ads', () => {
      window.__game.debug.setAds(1);
    }, 520));
    phases.push(await sample(weaponIdx, weaponName, 'fire', () => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.lastShot = 0;
      P.ammo = Math.max(P.ammo || 0, 2);
      dbg.fireCurrentWeapon();
    }, 160));
    phases.push(await sample(weaponIdx, weaponName, 'reload', () => {
      const dbg = window.__game.debug;
      dbg.setAds(0);
      dbg.startReloadCurrentWeapon();
    }, 360));
    phases.push(await sample(weaponIdx, weaponName, 'inspect', () => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.reloading = false;
      dbg.setAds(0);
      dbg.startInspectCurrentWeapon();
    }, 360));
    phases.push(await sample(weaponIdx, weaponName, 'empty-click', () => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.reloading = false;
      dbg.setAds(0);
      dbg.dryFireCurrentWeapon(false);
    }, 220));
    phases.push(await sample(weaponIdx, weaponName, 'slide-ads', () => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.reloading = false;
      P.sliding = true;
      P.slideTarget = 1;
      P.slideAmt = 1;
      P.slideTimer = 0.16;
      P.slideLocalR = 0.5;
      P.slideLocalF = 0.8;
      dbg.setAds(1);
    }, 300));
    phases.push(await sample(weaponIdx, weaponName, 'lean-ads', () => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.sliding = false;
      P.slideAmt = 0;
      P.lean = 0.75;
      dbg.setAds(1);
    }, 300));
    phases.push(await sample(weaponIdx, weaponName, 'guard-ads', () => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.lean = 0;
      P.guardMode = 'wall';
      P._guardVisualMode = 'wall';
      P.guardBehindHeld = true;
      P.guardBehindActive = true;
      P.guardBehindAmt = 1;
      P.guardPeekSide = 1;
      dbg.setAds(1);
    }, 300));
    await page.evaluate(() => {
      const dbg = window.__game.debug;
      const P = dbg.P();
      P.guardBehindHeld = false;
      P.guardBehindActive = false;
      P.guardBehindAmt = 0;
      P.guardPeekSide = 0;
      P.guardMode = 'none';
      P._guardVisualMode = 'none';
      P.lean = 0;
      P.sliding = false;
      P.slideAmt = 0;
      P.slideTarget = 0;
      dbg.setAds(0);
      dbg.endInspectCurrentWeapon?.();
    });
    report.weapons.push({
      weaponIdx,
      name: weaponName,
      manifestId: setup.activeManifestId,
      profileId: setup.weaponFeelProfile?.id || null,
      sightMode: setup.weaponFeelProfile?.sight?.mode || null,
      phases
    });
  }

  if (errors.length) report.browserErrors = errors;
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: true,
    weapons: report.weapons.map((w) => ({
      weaponIdx: w.weaponIdx,
      name: w.name,
      profileId: w.profileId,
      sightMode: w.sightMode,
      phases: w.phases.length,
      adsResidual: w.phases.find((p) => p.phase === 'ads')?.sightCheck || null
    })),
    skippedReferenceWeapons: report.skippedReferenceWeapons,
    outDir: OUT_DIR
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
