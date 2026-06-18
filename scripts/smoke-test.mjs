import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
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

try {
  console.log(`navigating ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__game?.debug?.snapshot, null, { timeout: 45000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-main-menu.png'), fullPage: false });
  const gameDebug = await page.evaluate(() => window.__game.debug.snapshot());
  const errors = consoleEvents.filter(e => e.type === 'error' || e.type === 'pageerror');
  const warnings = consoleEvents.filter(e => e.type === 'warning' || e.type === 'warn');
  const logs = consoleEvents.filter(e => e.type === 'log');

  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(`  [${e.type}] ${e.text}${e.stack ? '\n    ' + e.stack.split('\n').slice(0, 3).join('\n    ') : ''}`));
  console.log('\n=== WARNINGS ===');
  warnings.forEach(e => console.log(`  [${e.type}] ${e.text}`));
  console.log('\n=== LOGS (last 20) ===');
  logs.slice(-20).forEach(e => console.log(`  ${e.text}`));
  console.log('\n=== FAILED REQUESTS ===');
  failedRequests.forEach(r => console.log(`  ${r.status || ''} ${r.url} ${r.failure ? r.failure.errorText : ''}`));
  console.log('\n=== GAME DEBUG ===');
  console.log(JSON.stringify(gameDebug, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(`errors: ${errors.length}, warnings: ${warnings.length}, failed_requests: ${failedRequests.length}`);
  console.log(`screenshot: ${path.join(SCREENSHOTS_DIR, '01-main-menu.png')}`);

  if (errors.length || failedRequests.length) {
    throw new Error(`smoke failed: errors=${errors.length} failedRequests=${failedRequests.length}`);
  }
} finally {
  await context.close();
  await browser.close();
}
