// Phase AD — active-map perf stress test.
// By default this covers B01..B02, the campaign maps currently being kept.
// Set PERF_STRESS_BUILDINGS=all or a comma list such as 1,2,5 to sweep more.
//
// Run with the dev server already on http://127.0.0.1:5173 (or set BASE_URL).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function parseBuildings(value) {
  if (!value || !String(value).trim()) return [1, 2];
  const raw = String(value).trim().toLowerCase();
  if (raw === 'all') return Array.from({ length: 12 }, (_, i) => i + 1);
  const buildings = raw.split(',')
    .map(part => Number.parseInt(part.trim(), 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
  return buildings.length ? Array.from(new Set(buildings)) : [1, 2];
}

const BUILDINGS = parseBuildings(process.env.PERF_STRESS_BUILDINGS);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(45000);

const errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', text: m.text() }); });

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);
await page.locator('#start-btn').click();
await page.waitForFunction(() => window.__game?.debug?.perfStressForBuilding, null, { timeout: 45000 });

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const rows = [];
for (const [i, bn] of BUILDINGS.entries()) {
  console.error(`perf stress building ${bn} (${i + 1}/${BUILDINGS.length})`);
  const row = await withTimeout(
    page.evaluate(({ building, enemies, shots }) => {
      return window.__game.debug.perfStressForBuilding(building, enemies, shots);
    }, { building: bn, enemies: 12, shots: 5 }),
    60000,
    `perfStressForBuilding(${bn})`
  );
  rows.push(row);
  await page.waitForTimeout(16);
}

const lines = [];
const fmt = (v, w) => String(v).padStart(w);
lines.push('  bn  enemies  shots  alive  drawCalls  tris       memGeo  memTex');
for (const r of rows) {
  lines.push(`  ${fmt(r.bn,2)}  ${fmt(r.enemies,7)}  ${fmt(r.shots,5)}  ${fmt(r.aliveEnemies,5)}  ${fmt(r.renderCalls,9)}  ${fmt(r.renderTris,9)}  ${fmt(r.memGeo,6)}  ${fmt(r.memTex,6)}`);
}
const summary = lines.join('\n');
console.log(summary);
fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'perf-stress-summary.txt'), summary + '\n');

if (errors.length) {
  console.error('Console errors:', errors);
  process.exit(1);
}
console.log('\nperf stress ok');

await Promise.race([
  context.close().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 2000))
]);
await Promise.race([
  browser.close().catch(() => {}),
  new Promise((resolve) => setTimeout(resolve, 2000))
]);
