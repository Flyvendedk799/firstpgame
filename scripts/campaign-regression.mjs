import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const consoleEvents = [];
const failedRequests = [];

page.on('console', msg => {
  consoleEvents.push({ type: msg.type(), text: msg.text(), location: msg.location() });
});
page.on('pageerror', err => {
  consoleEvents.push({ type: 'pageerror', text: err.message, stack: err.stack });
});
page.on('requestfailed', req => {
  failedRequests.push({ url: req.url(), failure: req.failure() });
});
page.on('response', res => {
  if (res.status() >= 400) failedRequests.push({ url: res.url(), status: res.status() });
});

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);

const mainMenuVisible = await page.locator('#overlay:not(.hidden)').count();
if (!mainMenuVisible) throw new Error('Main menu overlay did not render.');

await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'campaign-regression-menu.png'), fullPage: false });

await page.locator('#start-btn').click();
await page.waitForFunction(() => window.__game && window.__game.debug && window.__game.debug.snapshot, null, { timeout: 10000 });
await page.waitForFunction(() => {
  const snap = window.__game?.debug?.snapshot?.();
  return snap?.campaign?.id === 'B01_LOADING_DOCK';
}, null, { timeout: 45000 });

const snapshot = await page.evaluate(() => window.__game.debug.snapshot());
await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'campaign-regression-gameplay.png'), fullPage: false });

if (!snapshot) throw new Error('Missing debug snapshot after deploy.');
if (snapshot.building !== 1) throw new Error(`Expected building 1 after deploy, got ${snapshot.building}.`);
if (snapshot.ammoSlots !== 8 || snapshot.reserveSlots !== 8) {
  throw new Error(`Expected 8 ammo slots, got ammo=${snapshot.ammoSlots} reserve=${snapshot.reserveSlots}.`);
}
if (!snapshot.campaign || snapshot.campaign.id !== 'B01_LOADING_DOCK') {
  throw new Error(`Expected first campaign level in debug snapshot, got ${JSON.stringify(snapshot.campaign)}.`);
}

// Phase 7 — assert the Phase 1/2 cover-graph bake produced corners + slots.
if (typeof snapshot.cornerEdgesCount !== 'number' || snapshot.cornerEdgesCount < 8) {
  throw new Error(`Expected cornerEdgesCount >= 8 after B01 build, got ${snapshot.cornerEdgesCount}.`);
}
if (typeof snapshot.coverSlotsCount !== 'number' || snapshot.coverSlotsCount < 16) {
  throw new Error(`Expected coverSlotsCount >= 16 after B01 build, got ${snapshot.coverSlotsCount}.`);
}
// Phase 6 — assert telemetry shape exists.
if (!snapshot.peek || typeof snapshot.peek.totalPeeks !== 'number') {
  throw new Error(`Expected peek telemetry block, got ${JSON.stringify(snapshot.peek)}.`);
}

const errors = consoleEvents.filter(e => e.type === 'error' || e.type === 'pageerror');
if (errors.length || failedRequests.length) {
  console.log(JSON.stringify({ errors, failedRequests, snapshot }, null, 2));
  throw new Error(`Console/errors failed regression: errors=${errors.length} failedRequests=${failedRequests.length}`);
}

console.log(JSON.stringify({
  ok: true,
  snapshot,
  screenshots: [
    path.join(SCREENSHOTS_DIR, 'campaign-regression-menu.png'),
    path.join(SCREENSHOTS_DIR, 'campaign-regression-gameplay.png')
  ]
}, null, 2));

await context.close();
await browser.close();
