// Phase H — per-building perf snapshot.
// Iterates B01..B12, rebuilds each level, samples geometry + render counters.
// Used to spot regressions when adding new elements/decoration to a building.
//
// Run with the dev server already on http://127.0.0.1:5173 (or set BASE_URL).
// Output: JSON to stdout + screenshots/perf-summary.txt.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', text: m.text() }); });

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);
await page.locator('#start-btn').click();
await page.waitForFunction(
  () => window.__game?.debug?.perfSnapshotForBuilding,
  null,
  { timeout: 45000 }
);

const rows = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const out = [];
  for (let bn = 1; bn <= 12; bn++) {
    out.push(dbg.perfSnapshotForBuilding(bn));
  }
  return out;
});

const lines = [];
const fmt = (v, w) => String(v).padStart(w);
lines.push('  bn  walls  vaults  floors  corners  slots  win  navCells  navBlk  drawCalls  tris       memGeo  memTex');
for (const r of rows) {
  lines.push(`  ${fmt(r.bn,2)}  ${fmt(r.walls,5)}  ${fmt(r.vaultables,6)}  ${fmt(r.floorRegions,6)}  ${fmt(r.cornerEdges,7)}  ${fmt(r.coverSlots,5)}  ${fmt(r.windows,3)}  ${fmt(r.navCells,8)}  ${fmt(r.navBlocked,6)}  ${fmt(r.renderCalls,9)}  ${fmt(r.renderTris,9)}  ${fmt(r.memGeo,6)}  ${fmt(r.memTex,6)}`);
}
const summary = lines.join('\n');
console.log(summary);
fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'perf-summary.txt'), summary + '\n');

if (errors.length) {
  console.error('Console errors:', errors);
  process.exit(1);
}
console.log('\nperf snapshot ok');

await context.close();
await browser.close();
