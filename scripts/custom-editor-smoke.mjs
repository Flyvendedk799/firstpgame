#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
});

await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#menu-editor-btn', { timeout: 60000 });
await page.locator('#menu-editor-btn').click();
await page.waitForSelector('#custom-editor.show', { timeout: 60000 });
await page.waitForFunction(() => {
  const canvas = document.querySelector('#ce-canvas');
  if (!canvas || !canvas.width || !canvas.height) return false;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return false;
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let lit = 0;
  for (let i = 0; i < pixels.length; i += 64) {
    if (pixels[i] > 12 || pixels[i + 1] > 12 || pixels[i + 2] > 12) lit++;
  }
  return lit > 1000 && document.querySelector('.ce-view[data-view="tactical"]')?.classList.contains('active');
}, null, { timeout: 60000 });
await page.locator('#ce-generate-map').click();
await page.waitForFunction(() => document.querySelector('#ce-status')?.textContent?.includes('Generated a validated three-zone combat map.'), null, { timeout: 30000 });
await page.locator('#ce-auto-tactics').click();
await page.waitForFunction(() => document.querySelector('#ce-status')?.textContent?.includes('Auto tactics rebuilt'), null, { timeout: 30000 });
await page.locator('#ce-quality-fix').click();
await page.waitForFunction(() => document.querySelector('#ce-status')?.textContent?.includes('Quality pass resolved'), null, { timeout: 30000 });
await page.locator('.ce-tab[data-cat="cover"]').click();
await page.locator('#ce-search').fill('ambush');
if ((await page.locator('.ce-prefab').count()) < 1) throw new Error('Asset search did not return combat prefabs.');
await page.locator('#ce-search').fill('');
await page.locator('#ce-grid-size').selectOption('1');
await page.locator('.ce-prefab').first().click();
const box = await page.locator('#ce-canvas').boundingBox();
await page.mouse.click(box.x + box.width * 0.54, box.y + box.height * 0.48);
await page.locator('#ce-copy').click();
await page.locator('#ce-paste').click();
await page.locator('#ce-analyze').click();
await page.waitForFunction(() => document.querySelector('#ce-analysis-panel')?.textContent?.includes('OVERLAY'), null, { timeout: 10000 });
await page.locator('.ce-tab[data-cat="props"]').click();
await page.waitForSelector('.ce-prefab');
await page.locator('.ce-tool[data-tool="enemy"]').click();
await page.mouse.click(box.x + box.width * 0.50, box.y + box.height * 0.33);
await page.locator('.ce-tool[data-tool="door"]').click();
await page.mouse.click(box.x + box.width * 0.48, box.y + box.height * 0.42);
await page.locator('.ce-tool[data-tool="pickup"]').click();
await page.mouse.click(box.x + box.width * 0.57, box.y + box.height * 0.40);
const hudText = await page.locator('#ce-hud').innerText();
if (!hudText.includes('TOOL') || !hudText.includes('SNAP')) throw new Error(`Editor HUD missing expected status: ${hudText}`);
await page.locator('#ce-save').click();
await page.locator('#ce-back').click();
await page.locator('#menu-custom-maps-btn').click();
await page.waitForSelector('#custom-maps-panel.show', { timeout: 60000 });
await page.locator('.cm-pack').first().click();
const startDisabled = await page.locator('#cm-start').count();
if (!startDisabled) throw new Error('Custom maps panel did not render a start action.');
const dbg = await page.evaluate(() => window.__game?.debug?.customMaps?.());
if (!dbg || !dbg.kit || dbg.kit.prefabCount < 100) throw new Error(`Custom map debug state missing: ${JSON.stringify(dbg)}`);

await browser.close();
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, debug: dbg }, null, 2));
