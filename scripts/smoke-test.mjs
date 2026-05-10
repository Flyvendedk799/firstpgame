import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('./screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();

const consoleEvents = [];
page.on('console', msg => {
  consoleEvents.push({ type: msg.type(), text: msg.text(), location: msg.location() });
});
page.on('pageerror', err => {
  consoleEvents.push({ type: 'pageerror', text: err.message, stack: err.stack });
});
const failedRequests = [];
page.on('requestfailed', req => {
  failedRequests.push({ url: req.url(), failure: req.failure() });
});
page.on('response', res => {
  if (res.status() >= 400) {
    failedRequests.push({ url: res.url(), status: res.status() });
  }
});

console.log('navigating...');
try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
} catch (err) {
  console.error('navigation error:', err.message);
}

// Wait for game to boot — assets are large so allow time
await page.waitForTimeout(8000);

await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-main-menu.png'), fullPage: false });

// Try to read the in-game debug snapshot
let gameDebug = null;
try {
  gameDebug = await page.evaluate(() => {
    if (window.__game && window.__game.debug && window.__game.debug.snapshot) {
      return window.__game.debug.snapshot();
    }
    return null;
  });
} catch (err) {
  // ignore
}

// Categorize console messages
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

await context.close();
await browser.close();
