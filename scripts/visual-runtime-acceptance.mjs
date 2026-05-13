import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const modes = (process.env.VISUAL_MODES || 'auto')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// CI-quick mode (default) walks the four visually-distinct buildings × the
// post states that exercise unique grade/overlay paths. Set VISUAL_FULL=1 to
// run the full 12 × 9 matrix locally before a release.
const FULL = process.env.VISUAL_FULL === '1';
const buildings = FULL
  ? Array.from({ length: 12 }, (_, i) => i + 1)
  : [1, 3, 6, 8, 11];
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
const allResults = [];

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
  await page.waitForFunction(() => window.__game?.debug?.forcePostState, null, { timeout: 45000 });

  const result = await page.evaluate(async ({ buildings, postStates }) => {
    const dbg = window.__game.debug;
    const settings = dbg.settings();
    Object.assign(settings, {
      postEnabled: true,
      colorGrade: true,
      filmGrain: true,
      chromaticAberration: true,
      sharpen: true,
      vignette: true,
      smaa: true,
      gradeIntensity: 1,
      aoQuality: 'high',
      bloomQuality: 'high',
      shadowQuality: 'medium',
      atmosphereQuality: 'high',
      textureQuality: 'high',
      characterQuality: 'high',
      weaponQuality: 'high',
      scopePipEnabled: true,
      scopePipResolution: 512
    });

    function canvasStats() {
      const src = document.getElementById('c');
      const w = 64;
      const h = 36;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(src, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h).data;
      let min = 255;
      let max = 0;
      let sum = 0;
      let nonBlack = 0;
      const buckets = new Set();
      for (let i = 0; i < data.length; i += 4) {
        const l = Math.round(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722);
        min = Math.min(min, l);
        max = Math.max(max, l);
        sum += l;
        if (l > 3) nonBlack++;
        buckets.add((data[i] >> 5) + '-' + (data[i + 1] >> 5) + '-' + (data[i + 2] >> 5));
      }
      return {
        width: src.width,
        height: src.height,
        lumaMin: min,
        lumaMax: max,
        lumaRange: max - min,
        avgLuma: Number((sum / (w * h)).toFixed(2)),
        nonBlackRatio: Number((nonBlack / (w * h)).toFixed(3)),
        colorBuckets: buckets.size,
        dataUrlLength: src.toDataURL('image/png').length
      };
    }

    const rows = [];
    for (const bn of buildings) {
      const ld = dbg.buildLevel(bn);
      const G = dbg.G();
      const P = dbg.P();
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
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      for (const state of postStates) {
        const forced = dbg.forcePostState(state);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const shot = dbg.captureScreenshot(`B${String(bn).padStart(2, '0')}-${state}`);
        const profile = dbg.visualProfile();
        const renderer = dbg.rendererInfo();
        const screenPost = dbg.screenPost();
        const materials = dbg.materialStats();
        const runtime = dbg.visualRuntime();
        rows.push({
          bn,
          state,
          forced,
          profile,
          renderer,
          screenPost,
          materials,
          runtime,
          canvas: canvasStats(),
          screenshot: { width: shot.width, height: shot.height, bytes: shot.dataUrl.length }
        });
      }
    }
    return {
      renderer: dbg.rendererInfo(),
      materialLibrary: dbg.materialLibrary(),
      rows
    };
  }, { buildings, postStates });

  assert(errors.length === 0, `${mode}: browser errors: ${JSON.stringify(errors)}`);
  assert(result.renderer.backend === 'webgl' || result.renderer.backend === 'webgpu', `${mode}: invalid renderer backend`);
  assert(result.materialLibrary.generatedMapCount > 0, `${mode}: generated PBR maps were not created`);
  assert(result.rows.length === buildings.length * postStates.length, `${mode}: visual row count mismatch`);

  for (const row of result.rows) {
    assert(row.profile?.id, `${mode} B${row.bn} ${row.state}: missing visual profile`);
    assert(row.renderer.profile === row.profile.id, `${mode} B${row.bn} ${row.state}: renderer profile mismatch`);
    if (row.screenPost?.stable) {
      assert(row.screenPost && row.screenPost.enabled === false && row.screenPost.stable, `${mode} B${row.bn} ${row.state}: stable screen-post metadata missing`);
    } else {
      assert(row.screenPost?.enabled, `${mode} B${row.bn} ${row.state}: screen post disabled`);
      assert(row.screenPost.visual === row.profile.id, `${mode} B${row.bn} ${row.state}: screen post visual mismatch`);
    }
    if (row.screenPost?.stable) {
      assert(row.forced?.active === 'stable-direct', `${mode} B${row.bn}: stable post state did not activate (${row.forced?.active})`);
    } else {
      assert(row.forced?.active?.includes(row.state === 'normal' ? 'normal' : row.state), `${mode} B${row.bn}: post state ${row.state} did not activate (${row.forced?.active})`);
    }
    assert(row.materials.scene.pbr > 0 && row.materials.scene.aa > 0, `${mode} B${row.bn}: scene PBR/AA materials missing`);
    assert(row.materials.scene.maps.normal > 0, `${mode} B${row.bn}: normal maps missing at high texture quality`);
    assert(row.materials.scene.maps.roughness > 0, `${mode} B${row.bn}: roughness maps missing at high texture quality`);
    assert(row.runtime.shadowCasters >= 1, `${mode} B${row.bn}: shadow caster budget missing`);
    assert(row.runtime.visualStats?.dressingObjects > 0, `${mode} B${row.bn}: procedural dressing metadata missing`);
    assert(row.runtime.visualStats?.contactShadows > 0, `${mode} B${row.bn}: fake contact shadows missing`);
    assert(row.runtime.visualStats?.grimeDecals > 0, `${mode} B${row.bn}: grime/decal dressing missing`);
    assert(row.canvas.width > 0 && row.canvas.height > 0, `${mode} B${row.bn}: zero-size canvas`);
    assert(row.canvas.dataUrlLength > 6000 && row.screenshot.bytes > 6000, `${mode} B${row.bn} ${row.state}: screenshot too small`);
    // Some post states are intentionally near-black (death/menu/blackout) —
    // for those we only verify the underlying scene still has PBR coverage,
    // not that the canvas surface is bright.
    const intentionallyDark = row.state === 'death' || row.state === 'menu' || row.state === 'blackout';
    if (!intentionallyDark) {
      assert(row.canvas.nonBlackRatio > 0.08, `${mode} B${row.bn} ${row.state}: frame is near blank`);
      assert(row.canvas.colorBuckets >= 4 && row.canvas.lumaRange >= 8, `${mode} B${row.bn} ${row.state}: frame lacks visual variation`);
    }
  }

  allResults.push({ mode, renderer: result.renderer, materialLibrary: result.materialLibrary, rows: result.rows });
  await context.close();
}

await browser.close();

const outPath = path.join(OUT_DIR, 'visual-runtime-acceptance.json');
fs.writeFileSync(outPath, JSON.stringify({ ok: true, modes, buildings, postStates, results: allResults }, null, 2));
console.log(JSON.stringify({ ok: true, modes, buildings: buildings.length, postStates: postStates.length, summary: outPath }, null, 2));
