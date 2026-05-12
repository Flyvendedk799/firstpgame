/**
 * Live cross-check: our cm/360 (mouseSensGames.js) vs GamingSmart displayed Cm/360°.
 *
 * Requires network + Playwright browser install (`npx playwright install chromium`).
 * Usage: node scripts/sens-gamingsmart-crosscheck.mjs
 */

import { chromium } from 'playwright';
import {
  GAME_SENS_PRESETS,
  clearanceCm360,
  matchingClearanceSens,
  sourceCm360
} from '../src/mouseSensGames.js';

function ourCm360ForPreset(gameId, sens, dpi) {
  const row = GAME_SENS_PRESETS.find((g) => g.id === gameId);
  if (!row) throw new Error(`unknown preset ${gameId}`);
  return row.toCm360(sens, dpi);
}

async function readSiteCm360(page, { fromGameValue, sens, dpi }) {
  await page.goto('https://gamingsmart.com/mouse-sensitivity-converter/', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000
  });
  await page.waitForSelector('#gs-fromGame');
  await page.selectOption('#gs-fromGame', fromGameValue);
  await page.selectOption('#gs-toGame', 'cs2'); // arbitrary target; cm/360 is From-game physical measure
  await page.fill('#gs-fromSens', String(sens));
  await page.fill('#gs-fromDPI', String(dpi));
  await page.fill('#gs-toDPI', String(dpi));
  await page.waitForTimeout(600);
  const raw = await page.evaluate(() => {
    const el = document.getElementById('gs-resultCm');
    if (!el) return '';
    const v = el instanceof HTMLInputElement ? el.value : el.textContent;
    return (v || '').trim().replace(',', '');
  });
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) throw new Error(`could not parse site Cm/360 from "${raw}"`);
  return n;
}

const CASES = [
  { label: 'CS2 sens 1 @ 800 DPI', presetId: 'cs2', gsValue: 'cs2', sens: 1, dpi: 800 },
  { label: 'Valorant sens 0.452 @ 1200 DPI', presetId: 'valorant', gsValue: 'valorant', sens: 0.452, dpi: 1200 },
  { label: 'Marvel Rivals sens 2.15 @ 400 DPI', presetId: 'marvel_rivals', gsValue: 'marvel-rivals', sens: 2.15, dpi: 400 },
  {
    label: 'Warzone horiz sens 48 @ 800 DPI',
    presetId: 'cod_mw_wz',
    gsValue: 'call-of-duty-warzone',
    sens: 48,
    dpi: 800
  }
];

const EPS_CM = 0.05;

async function main() {
  console.log('[sens-crosscheck] Comparing engine cm/360 ↔ GamingSmart Cm/360° (same sens + DPI)\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let failed = false;

  for (const c of CASES) {
    let siteCm;
    try {
      siteCm = await readSiteCm360(page, {
        fromGameValue: c.gsValue,
        sens: c.sens,
        dpi: c.dpi
      });
    } catch (e) {
      console.error(`  FAIL ${c.label}: site scrape error: ${e.message}`);
      failed = true;
      continue;
    }

    const oursCm = ourCm360ForPreset(c.presetId, c.sens, c.dpi);
    const delta = Math.abs(oursCm - siteCm);

    const clearanceSens = matchingClearanceSens(c.presetId, c.sens, c.dpi);
    const loopCm = clearanceCm360(clearanceSens, c.dpi);

    const ok = delta <= EPS_CM;

    console.log(`${ok ? '  OK ' : '  ⚠ '} ${c.label}`);
    console.log(`       GamingSmart cm/360: ${siteCm.toFixed(3)}`);
    console.log(`       Our preset cm/360:  ${oursCm.toFixed(3)} (Δ ${delta.toFixed(3)} cm)`);
    console.log(`       CLEARANCE sens match: ${clearanceSens?.toFixed(5)} → loopback cm/360 ${loopCm.toFixed(3)}`);

    const csEquiv = sourceCm360(1, c.dpi);
    console.log(`       (sanity CS2×1 cm/360 @ ${c.dpi} DPI = ${csEquiv.toFixed(3)})`);

    if (!ok) failed = true;

    console.log('');
  }

  await browser.close();

  if (failed) {
    console.error('[sens-crosscheck] Some checks exceeded ±' + EPS_CM + ' cm — inspect ratios or site DOM.');
    process.exitCode = 1;
  } else {
    console.log('[sens-crosscheck] All cases within ±' + EPS_CM + ' cm vs GamingSmart.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
