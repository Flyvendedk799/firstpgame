/**
 * Headless nav + zone-door + doorway clearance checks for buildings 1–12.
 *
 *   npm run build && npm run preview &
 *   BASE_URL=http://127.0.0.1:4173/ npm run validate:geometry
 *
 * Set GEOMETRY_VERBOSE=1 to print every authoring warning (otherwise summarized).
 * Mandatory floorplan space ids are checked in npm run validate:campaign (see MANDATORY_FLOORPLAN_SPACE_IDS_BY_BN).
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[page]', msg.text());
});

await page.goto(`${BASE_URL}?perf=1`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__game && window.__game.debug && window.__game.debug.runAuthoringValidation, null, {
  timeout: 120000,
});

const allErrors = [];
const allWarn = [];
for (let bn = 1; bn <= 12; bn++) {
  const r = await page.evaluate((b) => window.__game.debug.runAuthoringValidation(b), bn);
  const label = `B${String(bn).padStart(2, '0')}`;
  if (r && r.warnings && r.warnings.length) {
    for (const w of r.warnings) allWarn.push(`${label}: ${w}`);
  }
  if (!r || !r.ok) {
    const errs = (r && r.errors) || ['no_result'];
    for (const e of errs) allErrors.push(`${label}: ${e}`);
  }
}

if (allWarn.length && process.env.GEOMETRY_VERBOSE === '1') {
  for (const w of allWarn) console.warn(w);
} else if (allWarn.length) {
  console.warn(`validate-level-geometry: ${allWarn.length} authoring warning(s) (GEOMETRY_VERBOSE=1 for full list)`);
}

await browser.close();

if (allErrors.length) {
  console.error(allErrors.join('\n'));
  process.exit(1);
}
console.log('validate-level-geometry: OK (12 buildings, nav + zone prisms + transition warnings)');
