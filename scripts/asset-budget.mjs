// Asset / runtime budget acceptance.
//
// Section 12 of AA_VISUAL_COMPLETION_REMAINING — defines runtime budgets
// for characters, weapons, environment, VFX, and scene-wide draw cost
// and fails when the running build exceeds them. The procedural fallback
// path is what's running today; this script proves the budgets are within
// reach BEFORE authored assets land, so an authored GLB that breaks them
// is caught loudly when added.
//
// Behaviour:
//   1. Launch the game on building 8 (the densest setup).
//   2. Trigger a worst-case perf stress (max enemies + scope PIP + VFX).
//   3. Compare the live snapshot against ASSET_BUDGETS.
//   4. Fail with a structured report listing each over-budget category.
//
// Run: `node scripts/asset-budget.mjs` (assumes vite preview is running on
//       BASE_URL or default http://127.0.0.1:5173/).

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });
const modes = (process.env.RENDER_MODES || 'auto').split(',').map(s => s.trim()).filter(Boolean);

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
const allReports = [];

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
  await page.waitForFunction(() => window.__game?.debug?.assetBudgets, null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const dbg = window.__game?.debug;
    if (!dbg?.rendererHealthMonitor) return false;
    const mon = dbg.rendererHealthMonitor();
    return mon && mon.bootSelfTest && typeof mon.bootSelfTest.ok === 'boolean';
  }, null, { timeout: 25000 });

  const report = await page.evaluate(async () => {
    const dbg = window.__game.debug;
    const settings = dbg.settings();
    Object.assign(settings, {
      quality: 'high',
      postEnabled: true,
      shadowQuality: 'medium',
      textureQuality: 'high',
      characterQuality: 'high',
      weaponQuality: 'high',
      vfxQuality: 'high',
      decalQuality: 'high',
      atmosphereQuality: 'high',
      scopePipEnabled: true,
      scopePipResolution: 1024
    });

    const budgets = dbg.assetBudgets();
    const manifests = dbg.assetManifests();
    const preflight = dbg.assetPreflight();
    const G = dbg.G();
    const P = dbg.P();

    // Worst-case scene: server farm (densest dressing), maximum enemy count,
    // scope PIP active, VFX stress.
    dbg.perfStressForBuilding(8, 12, 0);
    G.started = true;
    G.menuOpen = false;
    G.exitUnlocked = false;
    P.dead = false;
    P.pos.set(0, 0.2, 18);
    dbg.equipScope(4);
    dbg.setAds(1);
    dbg.vfxStress(220);
    // Settle several frames so renderer.info reflects post + scope passes.
    for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));

    const stats = dbg.visualRuntime();
    const rendererBudget = dbg.rendererBudget();
    const rendererInfo = dbg.rendererInfo();
    const characterStatus = dbg.characterVisualStatus();
    const materialStats = dbg.materialStats();
    const vfxBudget = dbg.vfxBudget();

    // Compare current counts vs. budget caps.
    const breaches = [];
    function check(label, value, cap) {
      if (Number.isFinite(cap) && value > cap) breaches.push({ label, value, cap });
    }
    const vfxQ = settings.vfxQuality || 'high';
    const decalQ = settings.decalQuality || vfxQ;
    check('vfx.particles', stats.particles, budgets.vfx.activeParticles[vfxQ]);
    check('vfx.decals', stats.decals, budgets.vfx.activeDecals[decalQ]);
    check('scene.drawCalls', rendererBudget.drawCalls, budgets.scene.drawCalls);
    check('scene.triangles', rendererBudget.triangles, budgets.scene.triangles);
    check('scene.geometries', rendererBudget.geometries, budgets.scene.geometries);
    check('scene.textures', rendererBudget.textures, budgets.scene.textures);
    if (Number.isFinite(stats.shadowCasters)) check('scene.shadowCasters', stats.shadowCasters, budgets.environment.shadowCasters);

    return {
      preflight,
      manifests,
      stats,
      rendererBudget,
      rendererInfo,
      characterStatus,
      materialStats,
      vfxBudget,
      breaches,
      budgets,
      counts: {
        drawCalls: rendererBudget.drawCalls,
        triangles: rendererBudget.triangles,
        geometries: rendererBudget.geometries,
        textures: rendererBudget.textures,
        particles: stats.particles,
        decals: stats.decals,
        shadowCasters: stats.shadowCasters
      }
    };
  });

  assert(errors.length === 0, `${mode}: browser errors: ${JSON.stringify(errors)}`);
  assert(report.preflight && report.preflight.summary, `${mode}: asset preflight missing`);
  assert(report.preflight.validation.errors === 0, `${mode}: manifest validation errors: ${JSON.stringify(report.preflight.validation)}`);
  // The procedural fallback owns every entry today; failing on warnings only
  // would block the build until authored assets arrive. We accept warnings
  // but log them.
  if (report.preflight.validation.warnings > 0) {
    console.warn(`${mode}: ${report.preflight.validation.warnings} manifest warnings (expected while authored assets are missing)`);
  }
  // No breach is allowed — that's the whole point of the budget acceptance.
  if (report.breaches.length > 0) {
    console.error('counts:', JSON.stringify(report.counts, null, 2));
  }
  assert(report.breaches.length === 0, `${mode}: budget breaches: ${JSON.stringify(report.breaches, null, 2)}`);

  allReports.push({ mode, report });
  await context.close();
}

await browser.close();

const outPath = path.join(OUT_DIR, 'asset-budget-report.json');
fs.writeFileSync(outPath, JSON.stringify({ ok: true, modes, reports: allReports }, null, 2));
console.log(JSON.stringify({ ok: true, modes, report: outPath }, null, 2));
