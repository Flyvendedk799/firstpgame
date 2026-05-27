import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';

function assert(cond, msg, data = undefined) {
  if (!cond) {
    const err = new Error(msg);
    if (data !== undefined) err.data = data;
    throw err;
  }
}

function halfLuma(png, y0, y1) {
  let sum = 0;
  let count = 0;
  let min = 255;
  let max = 0;
  const stepX = Math.max(1, Math.floor(png.width / 120));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 80));
  for (let y = y0; y < y1; y += stepY) {
    for (let x = 0; x < png.width; x += stepX) {
      const i = (y * png.width + x) * 4;
      const l = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      sum += l;
      count++;
      min = Math.min(min, l);
      max = Math.max(max, l);
    }
  }
  return { avg: sum / Math.max(1, count), range: max - min };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

try {
  const url = new URL(BASE_URL);
  url.searchParams.set('perf', '1');
  await page.goto(url.toString(), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__game?.debug?.splitScreenStatus, null, { timeout: 60000 });

  const initial = await page.evaluate(() => {
    const dbg = window.__game.debug;
    dbg.startSplitScreenTest('duel');
    dbg.setSlotWeapon(0, 1);
    dbg.setSlotWeapon(1, 1);
    return dbg.splitScreenStatus();
  });
  assert(initial.layout === 'top-bottom', 'split-screen layout should be top-bottom', initial);
  assert(initial.slots[0].viewmodelLayer === 1 && initial.slots[1].viewmodelLayer === 2, 'viewmodel layers should be isolated', initial.slots);
  assert(initial.slots[0].weaponIdx === 1 && initial.slots[1].weaponIdx === 1, 'both players should support same weapon overlap', initial.slots);

  await page.waitForTimeout(250);
  const shot = PNG.sync.read(await page.screenshot({ type: 'png' }));
  const top = halfLuma(shot, 0, Math.floor(shot.height / 2));
  const bottom = halfLuma(shot, Math.floor(shot.height / 2), shot.height);
  assert(top.avg > 2 && top.range > 3, 'top split pane rendered blank', top);
  assert(bottom.avg > 2 && bottom.range > 3, 'bottom split pane rendered blank', bottom);

  const p1Fire = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const before = dbg.splitScreenStatus();
    dbg.fireSlotWeapon(0);
    const after = dbg.splitScreenStatus();
    return { before, after };
  });
  assert(p1Fire.after.slots[0].ammo === p1Fire.before.slots[0].ammo - 1, 'slot 0 fire should spend only slot 0 ammo', p1Fire);
  assert(p1Fire.after.slots[1].ammo === p1Fire.before.slots[1].ammo, 'slot 0 fire should not spend slot 1 ammo', p1Fire);
  assert((p1Fire.after.slots[0].recoil.shotIndex || 0) > (p1Fire.before.slots[0].recoil.shotIndex || 0), 'slot 0 recoil should advance', p1Fire);
  assert((p1Fire.after.slots[1].recoil.shotIndex || 0) === (p1Fire.before.slots[1].recoil.shotIndex || 0), 'slot 1 recoil should not advance on slot 0 fire', p1Fire);

  await page.waitForTimeout(420);
  const p2Fire = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const before = dbg.splitScreenStatus();
    dbg.fireSlotWeapon(1);
    const after = dbg.splitScreenStatus();
    return { before, after };
  });
  assert(p2Fire.after.slots[1].ammo === p2Fire.before.slots[1].ammo - 1, 'slot 1 fire should spend only slot 1 ammo', p2Fire);
  assert(p2Fire.after.slots[0].ammo === p2Fire.before.slots[0].ammo, 'slot 1 fire should not spend slot 0 ammo', p2Fire);
  assert((p2Fire.after.slots[1].recoil.shotIndex || 0) > (p2Fire.before.slots[1].recoil.shotIndex || 0), 'slot 1 recoil should advance', p2Fire);

  const reloadStart = await page.evaluate(() => {
    const dbg = window.__game.debug;
    dbg.startSlotReload(0);
    dbg.startSlotReload(1);
    return dbg.splitScreenStatus();
  });
  assert(reloadStart.slots[0].reloading && reloadStart.slots[1].reloading, 'both slots should reload independently', reloadStart);
  await page.waitForFunction(() => {
    const s = window.__game.debug.splitScreenStatus();
    return !s.slots[0].reloading && !s.slots[1].reloading;
  }, null, { timeout: 6000 });
  const reloadDone = await page.evaluate(() => window.__game.debug.splitScreenStatus());
  assert(reloadDone.slots[0].ammo > p1Fire.after.slots[0].ammo, 'slot 0 reload should refill ammo', reloadDone.slots[0]);
  assert(reloadDone.slots[1].ammo > p2Fire.after.slots[1].ammo, 'slot 1 reload should refill ammo', reloadDone.slots[1]);

  const ads = await page.evaluate(() => {
    const dbg = window.__game.debug;
    dbg.setSlotAds(0, 1);
    dbg.setSlotAds(1, 1);
    return {
      status: dbg.splitScreenStatus(),
      x0: document.querySelector('#split-hud .split-pane[data-slot="0"] [data-role="xhair"]')?.className || '',
      x1: document.querySelector('#split-hud .split-pane[data-slot="1"] [data-role="xhair"]')?.className || ''
    };
  });
  assert(ads.status.slots[0].adsVis === 1 && ads.status.slots[1].adsVis === 1, 'both slots should support simultaneous ADS', ads);
  assert(ads.x0.includes('ads') && ads.x1.includes('ads'), 'ADS crosshair state should stay in each pane', ads);

  const swap = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const before = dbg.playerSlotStatus(1);
    dbg.setSlotWeapon(1, 3);
    const mid = dbg.playerSlotStatus(1);
    dbg.setSlotWeapon(1, 1);
    const after = dbg.playerSlotStatus(1);
    return { before, mid, after };
  });
  assert(swap.mid.weaponIdx === 3 && swap.after.weaponIdx === 1, 'P2 should swap away and back', swap);
  assert(swap.after.ammo === swap.before.ammo, 'P2 incoming ammo should persist after swap back', swap);

  const duel = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const before = dbg.splitScreenStatus();
    const dmg = dbg.damageSlot(1, 999);
    return { before, dmg, after: dbg.splitScreenStatus() };
  });
  assert(duel.dmg.duel.scores[0] >= 1, 'duel score should credit P1 for killing P2', duel);
  await page.waitForTimeout(1250);
  const respawn = await page.evaluate(() => window.__game.debug.playerSlotStatus(1));
  assert(!respawn.dead && respawn.hp > 0, 'P2 should respawn after duel death', respawn);

  const solo = await page.evaluate(async () => {
    const dbg = window.__game.debug;
    dbg.quitToMain();
    await dbg.debugStartBuilding(1);
    return dbg.splitScreenStatus();
  });
  assert(!solo.active && solo.mode === 'solo', 'solo restart should disable split-screen', solo);
  assert(Math.abs(solo.cameraAspects.slot0 - (1280 / 720)) < 0.05, 'solo camera should return to full-screen aspect', solo.cameraAspects);

  console.log('[split-screen-acceptance] ok', {
    top,
    bottom,
    layout: initial.layout,
    soloAspect: solo.cameraAspects.slot0
  });
} finally {
  await browser.close();
}
