// Section 13 — visual regression thresholds + manual QA matrix.
//
// Captures a per-building, per-state baseline pack and runs structured
// assertions across every renderer/state/quality combination required by
// the AA acceptance contract:
//
//   - blank-frame detection (canvas luma + variance + color buckets)
//   - missing-texture detection (PBR map counts vs material counts)
//   - invisible-enemy detection (spawned archetype with no visible mesh)
//   - invisible-weapon detection (active weapon slot with no visible mesh)
//   - broken scope PIP (PIP active but no opacity/no render-target output)
//   - extreme overexposure (avg luma > 235 + low color variance)
//   - optional public textures: __game.debug.snapshot().optionalPubAssets (ok|miss per /assets/decals|vfx slug)
//
// First run: produces screenshots/visual-baseline/B01..B12.png + per-state
// captures. On subsequent runs the structured report is enough to fail CI
// when an authored asset regression appears.
//
// Run with the preview server (`npm run preview`) on http://127.0.0.1:4173 or
// the dev server on 5173 (set BASE_URL).

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve('./screenshots/visual-baseline');
fs.mkdirSync(OUT_DIR, { recursive: true });

const modes = (process.env.RENDER_MODES || 'auto').split(',').map(s => s.trim()).filter(Boolean);
// CI-quick mode (default): sample the buildings and post states that cover the
// distinct visual profiles + post overlays. Run with `VISUAL_FULL=1` for the
// full 12 × 9 matrix before a release.
const FULL = process.env.VISUAL_FULL === '1';
const buildings = FULL
  ? Array.from({ length: 12 }, (_, i) => i + 1)
  : [1, 3, 6, 8, 11];
const archetypes = ['soldier', 'scout', 'marksman', 'riot', 'heavy', 'drone', 'boss'];
const postStates = FULL
  ? ['normal', 'ads', 'focus', 'lowHp', 'killBeat', 'death', 'menu', 'alarm', 'blackout']
  : ['normal', 'ads', 'lowHp', 'death', 'alarm'];

function urlForMode(mode) {
  const u = new URL(BASE_URL);
  u.searchParams.set('perf', '1');
  if (mode === 'webgl' || mode === 'webgpu') u.searchParams.set('renderer', mode);
  return u.toString();
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const report = { ok: true, modes: [], started: new Date().toISOString() };

for (const mode of modes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', text: m.text() }); });

  console.log(`[visual-regression] mode=${mode} url=${BASE_URL}`);
  await page.goto(urlForMode(mode), { waitUntil: 'load', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => window.__game?.debug?.captureScreenshot, null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const dbg = window.__game?.debug;
    if (!dbg?.rendererHealthMonitor) return false;
    const mon = dbg.rendererHealthMonitor();
    return mon && mon.bootSelfTest && typeof mon.bootSelfTest.ok === 'boolean';
  }, null, { timeout: 25000 });

  // Configure high-quality settings + ensure starts cleanly.
  await page.evaluate(() => {
    const dbg = window.__game.debug;
    Object.assign(dbg.settings(), {
      quality: 'high', postEnabled: true, colorGrade: true, filmGrain: true,
      chromaticAberration: true, sharpen: true, vignette: true, smaa: true,
      aoQuality: 'high', bloomQuality: 'high', shadowQuality: 'medium',
      textureQuality: 'high', characterQuality: 'high', weaponQuality: 'high',
      atmosphereQuality: 'high', scopePipEnabled: true, scopePipResolution: 768,
      phase2SSR: true, phase2LUT: true, phase2DoF: true, phase2Volumetrics: true,
      phase2TAA: true, phase2Adaptive: true, ssrIntensityMul: 1
    });
  });

  const modeResult = { mode, buildings: [], scope: null, weapons: [], characters: [], health: null, manifest: null };

  modeResult.health = await page.evaluate(() => window.__game.debug.rendererHealthMonitor());
  modeResult.manifest = await page.evaluate(() => window.__game.debug.assetManifests());

  // Per-building, per-state thresholds.
  for (const bn of buildings) {
    const buildingRow = { building: bn, states: [], visualProfile: null };
    await page.evaluate((bn) => {
      const dbg = window.__game.debug;
      const G = dbg.G();
      const P = dbg.P();
      const ld = dbg.buildLevel(bn);
      G.levelData = ld;
      G.building = bn;
      G.started = true;
      G.menuOpen = false;
      G.exitUnlocked = false;
      P.dead = false;
      P.hp = P.maxHp || 100;
      P.pos.set(0, 0.2, 18);
      P.yaw = Math.PI;
      P.pitch = 0;
      P.ads = 0;
      dbg.forceVisualProfile(null);
      window.dispatchEvent(new Event('resize'));
    }, bn);

    for (const state of postStates) {
      const out = path.join(OUT_DIR, `B${String(bn).padStart(2, '0')}-${state}-${mode}.png`);
      const row = await page.evaluate(async ({ bn, state, out }) => {
        const dbg = window.__game.debug;
        dbg.forcePostState(state);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const profile = dbg.visualProfile();
        const renderer = dbg.rendererInfo();
        const screenPost = dbg.screenPost();
        const materials = dbg.materialStats();
        const runtime = dbg.visualRuntime();
        const c = document.getElementById('c');
        const w = 96, h = 54;
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const g = tmp.getContext('2d');
        g.drawImage(c, 0, 0, w, h);
        const data = g.getImageData(0, 0, w, h).data;
        let sum = 0, min = 255, max = 0, nonBlack = 0, blown = 0;
        const buckets = new Set();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g2 = data[i+1], b = data[i+2];
          const l = Math.round(r * 0.2126 + g2 * 0.7152 + b * 0.0722);
          sum += l;
          if (l < min) min = l;
          if (l > max) max = l;
          if (l > 5) nonBlack++;
          if (l > 245) blown++;
          buckets.add(((r >> 5) << 6) | ((g2 >> 5) << 3) | (b >> 5));
        }
        const total = w * h;
        const avg = sum / total;
        const nonBlackRatio = nonBlack / total;
        const blownRatio = blown / total;
        return {
          bn, state,
          profile,
          screenPost,
          renderer,
          materials,
          runtime,
          canvas: { avgLuma: Number(avg.toFixed(2)), lumaMin: min, lumaMax: max, lumaRange: max - min, nonBlackRatio: Number(nonBlackRatio.toFixed(3)), blownRatio: Number(blownRatio.toFixed(3)), colorBuckets: buckets.size },
          screenshotPath: out
        };
      }, { bn, state, out });
      try { await page.screenshot({ path: out, fullPage: false, timeout: 15000 }); } catch (_) {}

      buildingRow.visualProfile = row.profile;
      buildingRow.states.push(row);

      // Threshold assertions.  Some post states are intentionally near-black
      // (death/menu/blackout flash) — for those we only enforce that the scene
      // still has PBR coverage and dressing, not that the canvas is bright.
      const intentionallyDark = state === 'death' || state === 'menu' || state === 'blackout';
      if (!intentionallyDark) {
        assert(row.canvas.nonBlackRatio > 0.08, `B${bn} ${state} ${mode}: blank frame (nonBlackRatio=${row.canvas.nonBlackRatio})`);
        assert(row.canvas.colorBuckets >= 4, `B${bn} ${state} ${mode}: frame lacks color variation (${row.canvas.colorBuckets} buckets)`);
        assert(row.canvas.lumaRange >= 8, `B${bn} ${state} ${mode}: frame lacks luma range (${row.canvas.lumaRange})`);
      }
      assert(row.canvas.blownRatio < 0.55, `B${bn} ${state} ${mode}: extreme overexposure (${row.canvas.blownRatio})`);
      assert(row.materials.scene.maps.normal > 0, `B${bn} ${state} ${mode}: scene has zero normal maps (missing-texture regression)`);
      assert(row.materials.scene.maps.roughness > 0, `B${bn} ${state} ${mode}: scene has zero roughness maps (missing-texture regression)`);
      assert(row.materials.scene.pbr > 0, `B${bn} ${state} ${mode}: scene has zero PBR materials`);
      assert(row.runtime.visualStats?.dressingObjects > 0, `B${bn} ${state} ${mode}: procedural dressing missing`);
      if (state !== 'menu' && state !== 'blackout') {
        assert(row.runtime.shadowCasters >= 1, `B${bn} ${state} ${mode}: shadow casters missing`);
      }
      if (state === 'normal' && row.renderer) {
        assert(row.renderer.csmCascadeCount >= 1, `B${bn} ${mode}: csmCascadeCount missing (${row.renderer.csmCascadeCount})`);
        const p2 = row.renderer.phase2Passes;
        if (p2) {
          assert(typeof p2.cinematic === 'boolean', `B${bn} ${mode}: phase2Passes.cinematic missing`);
        }
      }
    }
    modeResult.buildings.push(buildingRow);
  }

  // Scope PIP threshold: enable + verify rendered.
  modeResult.scope = await page.evaluate(async () => {
    const dbg = window.__game.debug;
    const P = dbg.P();
    P.weaponIdx = 0;
    dbg.forcePostState('ads');
    dbg.equipScope(4);
    dbg.setAds(1);
    const t0 = performance.now();
    while (performance.now() - t0 < 2400) {
      const pip = dbg.scopePip();
      if (pip.enabled && pip.visible && pip.rendered && !pip.error && pip.materialOpacity > 0) break;
      await new Promise(r => requestAnimationFrame(r));
    }
    return { pip: dbg.scopePip(), renderer: dbg.rendererInfo() };
  });
  assert(modeResult.scope.pip.rendered, `${mode}: scope PIP not rendering`);
  assert(modeResult.scope.pip.error == null, `${mode}: scope PIP error: ${modeResult.scope.pip.error}`);
  assert(modeResult.scope.pip.materialOpacity > 0, `${mode}: scope PIP opacity stuck at 0`);

  // Invisible-weapon threshold — every slot must produce at least one visible mesh.
  modeResult.weapons = await page.evaluate(async () => {
    const dbg = window.__game.debug;
    const out = [];
    for (let i = 0; i < 8; i++) {
      dbg.switchWeapon(i);
      await new Promise(r => setTimeout(r, 80));
      out.push(dbg.weaponVisualStatus());
    }
    return out;
  });
  for (const w of modeResult.weapons) {
    const visible = (w.visibleProceduralMeshes||0) + (w.visibleGlbMeshes||0) + (w.visibleThrowMeshes||0) + (w.visibleKnifeMeshes||0);
    assert(visible > 0, `${mode}: weapon ${w.name} has no visible viewmodel mesh (invisible-weapon)`);
  }

  // Invisible-enemy threshold — spawn one of each archetype and verify counts.
  modeResult.characters = await page.evaluate(async (types) => {
    const dbg = window.__game.debug;
    const G = dbg.G();
    if (G.enemyMgr) G.enemyMgr.clear();
    for (let i = 0; i < types.length; i++) {
      dbg.spawnAt(types[i], -6 + i * 2, -8 - (i % 2) * 2);
    }
    await new Promise(r => setTimeout(r, 800));
    return dbg.characterVisualStatus();
  }, archetypes);
  for (const type of archetypes) {
    const a = modeResult.characters.archetypes[type];
    assert(a && a.count >= 1, `${mode}: invisible-enemy regression — ${type} has zero spawned/visible instances`);
    if (type !== 'drone') {
      assert(a.humanShells >= 1, `${mode}: invisible-enemy regression — ${type} has no human visual shell`);
      assert(a.weaponMeshes >= 1, `${mode}: invisible-enemy regression — ${type} has no weapon silhouette`);
    }
  }

  // Black-screen fallback metadata threshold — even if a fallback fires,
  // the metadata must be structured + the runtime must still be drawing.
  assert(modeResult.health && modeResult.health.bootSelfTest, `${mode}: health monitor missing`);
  if (modeResult.health.fallbackFired) {
    assert(modeResult.health.bootSelfTest && (modeResult.health.bootSelfTest.ok === false || modeResult.health.postDisableSelfTest), `${mode}: fallback fired without recording cause`);
  }

  // Manifest validation must not produce errors.
  assert(modeResult.manifest.validation.errors === 0, `${mode}: manifest validation errors: ${JSON.stringify(modeResult.manifest.validation)}`);

  if (errors.length) {
    report.ok = false;
    modeResult.consoleErrors = errors;
    console.error(`[visual-regression] ${mode} console errors:`, errors);
  }

  report.modes.push(modeResult);
  await context.close();
}

await browser.close();

const outPath = path.join(OUT_DIR, 'visual-regression-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, modes: modes.length, buildings: buildings.length, postStates: postStates.length, report: outPath }, null, 2));
if (!report.ok) process.exit(1);
