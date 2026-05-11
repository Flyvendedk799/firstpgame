import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

// CI-quick mode (default) only checks `auto` — the others are covered by the
// individual mode-specific assertions in the page evaluator. Set
// RENDER_MODES=auto,webgl,webgpu (or RENDER_FULL=1) to run all three modes.
const FULL = process.env.RENDER_FULL === '1';
const modes = (process.env.RENDER_MODES || (FULL ? 'auto,webgl,webgpu' : 'auto'))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

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
const results = [];

for (const mode of modes) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
  });

  await page.goto(urlForMode(mode), { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => window.__game?.debug?.rendererInfo, null, { timeout: 45000 });
  // The boot black-frame self-test runs in a microtask after _renderStack
  // is built; wait until it is resolved so the smoke run never races the
  // health monitor.
  await page.waitForFunction(() => {
    const dbg = window.__game?.debug;
    if (!dbg?.rendererHealthMonitor) return false;
    const mon = dbg.rendererHealthMonitor();
    return mon && mon.bootSelfTest && typeof mon.bootSelfTest.ok === 'boolean';
  }, null, { timeout: 25000 });

  const result = await page.evaluate(async () => {
    const dbg = window.__game.debug;
    const settings = dbg.settings();
    settings.postEnabled = true;
    settings.colorGrade = true;
    settings.filmGrain = true;
    settings.chromaticAberration = true;
    settings.sharpen = true;
    settings.vignette = true;
    settings.smaa = true;
    settings.gradeIntensity = 1;
    settings.scopePipEnabled = true;
    settings.scopePipResolution = 512;
    settings.characterQuality = 'high';
    settings.weaponQuality = 'high';
    settings.textureQuality = 'high';

    const ld = dbg.buildLevel(8);
    const G = dbg.G();
    const P = dbg.P();
    G.levelData = ld;
    G.building = 8;
    G.started = true;
    G.menuOpen = false;
    G.exitUnlocked = false;
    P.dead = false;
    P.hp = P.maxHp || 100;
    P.pos.set(0, 0.2, 18);
    P.yaw = Math.PI;
    P.pitch = 0;
    P.weaponIdx = 0;
    dbg.equipScope(4);
    dbg.setAds(1);
    // Give the engine a few frames to settle into the scope-PIP visible state
    // before we begin polling. The ADS opacity ramp takes ~300ms, render-target
    // material opacity another ~120ms; under load (after visual:runtime stress)
    // the first frame after `setAds(1)` is occasionally skipped, so we allow
    // up to 6s of polling.
    for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
    const waitForScopePip = async (timeoutMs = 6000) => {
      const start = performance.now();
      let last = dbg.scopePip();
      while (performance.now() - start < timeoutMs) {
        const pip = dbg.scopePip();
        last = pip;
        if (pip.enabled && pip.visible && pip.rendered && !pip.error && pip.materialOpacity > 0) return pip;
        // If ADS got reset for any reason, re-arm it.
        if (!pip.enabled || pip.materialOpacity === 0) {
          try { dbg.setAds(1); } catch (_) {}
        }
        await new Promise(r => requestAnimationFrame(r));
      }
      return last;
    };
    await waitForScopePip();

    const rendererInfo = dbg.rendererInfo();
    const healthMonitor = dbg.rendererHealthMonitor();
    const rerunSelfTest = await dbg.blackFrameSelfTest();
    const runtimeSample = dbg.sampleRuntimeFrame();

    const scopePhase = {
      renderer: rendererInfo,
      screenPost: dbg.screenPost(),
      scopePip: dbg.scopePip(),
      materials: dbg.materialStats(),
      runtime: dbg.visualRuntime(),
      healthMonitor,
      rerunSelfTest,
      runtimeSample
    };

    let forcedPostOff = null;
    if (rendererInfo.backend === 'webgpu') {
      forcedPostOff = dbg.forceWebgpuPostOff();
      const postRerun = await dbg.blackFrameSelfTest();
      const restored = dbg.restoreWebgpuPost();
      forcedPostOff = Object.assign({}, forcedPostOff, { postRerun, restored });
    }

    const weaponStatuses = [];
    settings.weaponQuality = 'high';
    for (let i = 0; i < 8; i++) {
      P.dead = false;
      if (P.weaponIdx !== i) dbg.switchWeapon(i);
      await new Promise(r => setTimeout(r, 80));
      weaponStatuses.push(dbg.weaponVisualStatus());
    }

    settings.textureQuality = 'low';
    dbg.buildLevel(8);
    const lowTextureMaterials = dbg.materialStats().scene;
    settings.textureQuality = 'high';
    dbg.buildLevel(8);
    const highTextureMaterials = dbg.materialStats().scene;

    settings.characterQuality = 'high';
    if (G.enemyMgr) G.enemyMgr.clear();
    P.pos.set(0, 0.2, 18);
    const archetypeTypes = ['soldier', 'scout', 'marksman', 'riot', 'heavy', 'drone', 'boss'];
    for (let i = 0; i < archetypeTypes.length; i++) {
      dbg.spawnAt(archetypeTypes[i], -6 + i * 2, -8 - (i % 2) * 2);
    }
    await new Promise(r => setTimeout(r, 900));
    const archetypePhase = dbg.characterVisualStatus();
    const vfxPhase = dbg.vfxStress(180);

    settings.characterQuality = 'low';
    dbg.perfStressForBuilding(8, 6, 0);
    G.started = true;
    G.menuOpen = false;
    G.exitUnlocked = false;
    P.dead = false;
    P.pos.set(0, 0.2, 18);
    const enemies = G.enemyMgr._list.filter(e => !e.dead && e.type !== 'drone');
    const target = enemies[0];
    if (target) {
      for (let i = 0; i < 6; i++) target.takeDamage(1, false, i % 3 === 0);
    }
    for (const e of G.enemyMgr._list.filter(e => !e.dead)) {
      e.group.position.x = 0;
      e.group.position.z = -22;
    }
    await new Promise(r => setTimeout(r, 800));

    return {
      scopePhase,
      forcedPostOff,
      weaponPhase: weaponStatuses,
      texturePhase: {
        low: lowTextureMaterials,
        high: highTextureMaterials
      },
      archetypePhase,
      vfxPhase,
      characterPhase: {
        runtime: dbg.visualRuntime(),
        materials: dbg.materialStats().characters,
        animationStates: dbg.characterAnimationStates()
      }
    };
  });

  const renderer = result.scopePhase.renderer;
  const pip = result.scopePhase.scopePip;
  const screenPost = result.scopePhase.screenPost;
  const mats = result.scopePhase.materials;
  const charRuntime = result.characterPhase.runtime;
  const healthMonitor = result.scopePhase.healthMonitor;
  const rerunSelfTest = result.scopePhase.rerunSelfTest;
  const runtimeSample = result.scopePhase.runtimeSample;

  // Capture a per-mode screenshot for visual baselining.
  const screenshotFile = path.join(OUT_DIR, `render-smoke-${mode}.png`);
  try { await page.screenshot({ path: screenshotFile, fullPage: false }); } catch (_) {}

  assert(errors.length === 0, `${mode}: browser errors: ${JSON.stringify(errors)}`);
  assert(renderer.backend === 'webgl' || renderer.backend === 'webgpu', `${mode}: invalid renderer backend ${renderer.backend}`);
  if (mode === 'webgl') assert(renderer.backend === 'webgl', 'webgl mode did not use WebGL backend');
  if (mode === 'webgpu' && renderer.webgpuSupported && renderer.backend !== 'webgpu') {
    assert(renderer.fallbackReason, 'webgpu mode fell back without recording a fallback reason');
  }
  if (mode === 'auto' && renderer.webgpuSupported && renderer.backend !== 'webgpu') {
    assert(renderer.fallbackReason, 'auto mode fell back without recording a fallback reason');
  }
  if (renderer.backend === 'webgpu') {
    if (!renderer.fallbackReason || !renderer.fallbackReason.includes('webgpu-node-post')) {
      assert(renderer.webgpuNodePost?.active, `${mode}: WebGPU node post chain inactive: ${JSON.stringify(renderer.webgpuNodePost)}`);
      assert(renderer.postPath === 'webgpu-node-post', `${mode}: WebGPU did not use node post path`);
    }
  }

  // Black-frame guard: the boot self-test must have run, must report a structured
  // result, and (when no fallback fired) the active renderer must be producing
  // non-black calibration frames.
  assert(healthMonitor && healthMonitor.bootSelfTest, `${mode}: renderer health boot self-test missing`);
  assert(typeof healthMonitor.bootSelfTest.ok === 'boolean', `${mode}: boot self-test did not return a structured result`);
  if (!healthMonitor.fallbackFired) {
    const reran = rerunSelfTest;
    assert(reran && reran.ok, `${mode}: re-run black-frame self-test failed: ${JSON.stringify(reran)}`);
    assert(reran.avgLuma > 4, `${mode}: calibration frame has near-zero luma: ${JSON.stringify(reran)}`);
    // The runtime canvas sample is an opportunistic check — a single one-off
    // sample can legitimately be black (intentional fade, menu, or the test
    // happened to grab the canvas mid-clear) so we only fail when the running
    // monitor itself counted N consecutive black frames.
    if (healthMonitor.runtimeBlackCount && healthMonitor.runtimeBlackCount >= 5) {
      assert(false, `${mode}: runtime monitor recorded ${healthMonitor.runtimeBlackCount} consecutive black frames`);
    }
  }

  // Deliberate WebGPU post kill-switch test — proves the renderer can still
  // produce a valid frame after disabling node post and that metadata reflects
  // the switch.
  if (renderer.backend === 'webgpu') {
    const fp = result.forcedPostOff;
    assert(fp && fp.ok, `${mode}: forceWebgpuPostOff did not run`);
    assert(fp.postPath === 'webgpu-direct' || fp.postPath === 'webgpu-direct-grade', `${mode}: WebGPU post-off did not switch postPath (${fp.postPath})`);
    assert(fp.nodePost && fp.nodePost.active === false, `${mode}: WebGPU node post still active after kill-switch`);
    assert(fp.postRerun && fp.postRerun.ok, `${mode}: WebGPU still produced black frames after disabling node post`);
    assert(fp.restored && fp.restored.ok, `${mode}: WebGPU node post could not be restored after kill-switch test`);
  }

  assert(screenPost && screenPost.enabled, `${mode}: screen post overlay inactive`);
  assert(pip.enabled && pip.visible && pip.rendered && !pip.error, `${mode}: scope PIP did not render: ${JSON.stringify(pip)}`);
  assert(pip.target && pip.target.width >= 512 && pip.target.height >= 512, `${mode}: scope target too small`);
  assert(pip.materialOpacity > 0, `${mode}: scope material opacity did not rise during ADS`);
  assert(mats.scene.pbr > 0 && mats.scene.aa > 0, `${mode}: scene PBR/AA materials missing`);
  assert(mats.viewmodel.aa > 0, `${mode}: viewmodel AA materials missing`);
  assert(result.characterPhase.materials.aa > 0, `${mode}: character AA materials missing`);
  assert(result.texturePhase.low.quality.low > 0, `${mode}: low texture-quality materials were not created`);
  assert(result.texturePhase.high.quality.high > 0, `${mode}: high texture-quality materials were not created`);
  assert(result.texturePhase.high.maps.normal > result.texturePhase.low.maps.normal, `${mode}: generated normal maps did not scale with texture quality`);
  assert(result.texturePhase.high.maps.roughness > result.texturePhase.low.maps.roughness, `${mode}: generated roughness maps did not scale with texture quality`);
  assert(result.weaponPhase.length === 8, `${mode}: did not visit all weapon slots`);
  for (const weapon of result.weaponPhase) {
    const visiblePrimary = weapon.visibleProceduralMeshes + weapon.visibleGlbMeshes + weapon.visibleThrowMeshes + weapon.visibleKnifeMeshes;
    assert(visiblePrimary > 0, `${mode}: ${weapon.name} has no visible primary weapon mesh`);
    assert(weapon.pbrMaterials > 0 && weapon.aaMaterials > 0, `${mode}: ${weapon.name} is missing PBR/AA material coverage`);
    if (weapon.weaponIdx === 2) {
      assert(weapon.throwingKnifeVisible && weapon.visibleThrowMeshes > 0, `${mode}: throwing knife viewmodel missing`);
    } else if (weapon.weaponIdx !== 1 || !weapon.glbDeagleVisible) {
      assert(weapon.visibleDetailParts > 0, `${mode}: ${weapon.name} AA detail parts missing at high quality`);
    }
  }
  for (const type of ['soldier', 'scout', 'marksman', 'riot', 'heavy', 'drone', 'boss']) {
    const archetype = result.archetypePhase.archetypes[type];
    assert(archetype && archetype.count >= 1, `${mode}: required character archetype ${type} was not spawned`);
    assert(archetype.hitboxAligned >= 1, `${mode}: ${type} hitbox alignment metadata missing`);
    assert(archetype.weakPoints >= 1, `${mode}: ${type} weak-point/readability marker missing`);
    if (type !== 'drone') {
      assert(archetype.humanShells >= 1, `${mode}: ${type} human visual shell missing`);
      assert(archetype.weaponMeshes >= 1, `${mode}: ${type} weapon silhouette missing`);
    }
  }
  assert(result.archetypePhase.playerProxy.parts > 0, `${mode}: player full-body proxy missing`);
  assert(result.archetypePhase.viewmodel?.skeleton?.length >= 4, `${mode}: player viewmodel profile missing skeleton data`);
  assert(result.vfxPhase.after > result.vfxPhase.before, `${mode}: VFX stress did not create effects`);
  assert(result.vfxPhase.after <= result.vfxPhase.budgets.total, `${mode}: VFX total budget was exceeded`);
  assert(result.vfxPhase.stats.decals > 0, `${mode}: VFX decals missing`);
  assert(result.vfxPhase.stats.smoke > 0, `${mode}: VFX smoke/dust missing`);
  assert(result.vfxPhase.stats.shells > 0, `${mode}: VFX shell casings missing`);
  assert(result.vfxPhase.stats.flashes > 0, `${mode}: VFX flashes/rings missing`);
  assert(charRuntime.characters >= 1, `${mode}: no characters in character phase`);
  assert(charRuntime.characterDamageOverlays >= 1, `${mode}: character damage overlays missing`);
  assert(charRuntime.characterLods.low >= 1, `${mode}: low LOD impostor state missing`);

  results.push({
    mode,
    renderer,
    pip,
    screenPost,
    healthMonitor,
    rerunSelfTest,
    runtimeSample,
    forcedPostOff: result.forcedPostOff,
    texturePhase: result.texturePhase,
    weaponPhase: result.weaponPhase,
    archetypePhase: result.archetypePhase,
    vfxPhase: result.vfxPhase,
    characterRuntime: charRuntime,
    screenshot: screenshotFile
  });
  await context.close();
}

await browser.close();

const outPath = path.join(OUT_DIR, 'render-smoke-summary.json');
fs.writeFileSync(outPath, JSON.stringify({ ok: true, results }, null, 2));
console.log(JSON.stringify({ ok: true, modes: results.map(r => r.mode), summary: outPath }, null, 2));
