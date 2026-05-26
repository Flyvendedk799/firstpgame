import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { CORE_VISUAL_BASELINE_BUILDINGS } from '../src/assetManifest.js';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve(process.env.OUT_DIR || './screenshots/core-visual-baseline');
fs.mkdirSync(OUT_DIR, { recursive: true });

const buildings = (process.env.CORE_VISUAL_BUILDINGS || CORE_VISUAL_BASELINE_BUILDINGS.join(','))
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function slugBuilding(bn) {
  return `B${String(bn).padStart(2, '0')}`;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
});

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1200);
await page.waitForFunction(() => window.__game?.debug?.visualBudgetHeadroom && window.__game?.debug?.coreVisualPatchStatus, null, { timeout: 45000 });

await page.evaluate(() => {
  const dbg = window.__game.debug;
  const settings = dbg.settings();
  Object.assign(settings, {
    quality: 'high',
    lightingQuality: 'high',
    shadowQuality: 'high',
    atmosphereQuality: 'high',
    textureQuality: 'high',
    characterQuality: 'high',
    weaponQuality: 'high',
    vfxQuality: 'high',
    particleQuality: 'high',
    decalQuality: 'high',
    renderScale: 'auto',
    scopePipEnabled: true,
    scopePipResolution: 0
  });
});

async function collectRow(bn) {
  const row = await page.evaluate(async (building) => {
    const dbg = window.__game.debug;
    const perfSnapshot = dbg.perfSnapshotForBuilding(building);
    const G = dbg.G();
    const P = dbg.P();
    G.started = true;
    G.menuOpen = false;
    G.exitUnlocked = false;
    P.dead = false;
    P.hp = P.maxHp || 100;
    P.pos.set(0, 0.2, 18);
    P.yaw = Math.PI;
    P.pitch = 0;
    P.ads = 0;
    P.adsVis = 0;
    window.dispatchEvent(new Event('resize'));
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));

    function canvasStats() {
      const src = document.getElementById('c');
      const w = 64;
      const h = 36;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d', { willReadFrequently: true });
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
        buckets.add(`${data[i] >> 5}-${data[i + 1] >> 5}-${data[i + 2] >> 5}`);
      }
      return {
        width: src.width,
        height: src.height,
        lumaMin: min,
        lumaMax: max,
        lumaRange: max - min,
        avgLuma: Number((sum / (w * h)).toFixed(2)),
        nonBlackRatio: Number((nonBlack / (w * h)).toFixed(3)),
        colorBuckets: buckets.size
      };
    }

    const visualRuntime = dbg.visualRuntime();
    const rendererBudget = dbg.rendererBudget();
    const rendererInfo = dbg.rendererInfo();
    const patchStatus = dbg.coreVisualPatchStatus();
    const lightingStats = dbg.lightingStats();
    const materialStats = dbg.materialStats();
    const perf = window.__PERF?.snapshot?.() || null;
    return {
      bn: building,
      perfSnapshot,
      rendererInfo,
      patchStatus,
      rendererBudget,
      lightingStats,
      materialStats,
      visualRuntime,
      visualBudgetHeadroom: visualRuntime.visualBudgetHeadroom || rendererBudget.visualBudgetHeadroom || dbg.visualBudgetHeadroom(),
      perf,
      canvas: canvasStats()
    };
  }, bn);
  const screenshot = path.join(OUT_DIR, `${slugBuilding(bn)}-normal.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  row.screenshot = screenshot;
  return row;
}

const rows = [];
for (const bn of buildings) {
  console.log(`capturing ${slugBuilding(bn)}...`);
  rows.push(await collectRow(bn));
}

assert(errors.length === 0, `browser errors: ${JSON.stringify(errors)}`);
for (const row of rows) {
  assert(row.visualBudgetHeadroom?.ok, `${slugBuilding(row.bn)} budget breach: ${JSON.stringify(row.visualBudgetHeadroom?.breaches)}`);
  assert(row.patchStatus?.complete, `${slugBuilding(row.bn)} core visual patch is not complete`);
  assert(row.patchStatus?.checks?.sequencesComplete, `${slugBuilding(row.bn)} core visual sequence ledger is incomplete`);
  assert((row.materialStats?.scene?.corePolish || 0) > 0, `${slugBuilding(row.bn)} material shader polish did not apply`);
  assert(row.canvas.nonBlackRatio > 0.08, `${slugBuilding(row.bn)} baseline frame is near blank`);
  assert(row.canvas.colorBuckets >= 4 && row.canvas.lumaRange >= 8, `${slugBuilding(row.bn)} baseline frame lacks variation`);
}

const report = {
  ok: true,
  createdAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  buildings,
  rows,
  stress: null,
  locks: await page.evaluate(() => window.__game.debug.coreVisualBudgetLocks()),
  budgets: await page.evaluate(() => window.__game.debug.assetBudgets())
};

const outPath = path.join(OUT_DIR, 'core-visual-baseline.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, report: outPath, screenshots: OUT_DIR, buildings }, null, 2));

await context.close();
await browser.close();
