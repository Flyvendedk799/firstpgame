import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(8000);

// Force-start
await page.evaluate(() => {
  const dbg = window.__game?.debug;
  document.getElementById('overlay')?.classList.add('hidden');
  if (dbg.G && dbg.G()) dbg.G().started = true;
});
await page.waitForTimeout(800);

// Slot 1 = USP-T after M4 removal
await page.evaluate(() => window.__game.debug.switchWeapon(1));
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/cmp-01-usp.png' });

await page.evaluate(() => window.__game.debug.switchWeapon(2));
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/cmp-02-knife.png' });

await page.evaluate(() => window.__game.debug.switchWeapon(3));
await page.waitForTimeout(1000);
await page.screenshot({ path: 'screenshots/cmp-03-shotgun.png' });

// Inspect what's visible inside gunGrp
const sceneInfo = await page.evaluate(() => {
  const dbg = window.__game.debug;
  const gunGrp = dbg.gunGrp();
  const out = { gunGrpVisible: gunGrp?.visible, children: [] };
  gunGrp.traverse(o => {
    if (o === gunGrp) return;
    if (o.isMesh || o.isSkinnedMesh) {
      out.children.push({
        name: o.name || '(unnamed)',
        type: o.type,
        visible: o.visible,
        ancestorVisible: (() => { let p = o; while (p && p !== gunGrp) { if (!p.visible) return false; p = p.parent; } return true; })(),
        materialName: o.material?.name || o.material?.constructor?.name,
        materialColor: o.material?.color?.getHexString?.(),
        materialOpacity: o.material?.opacity,
        materialTransparent: o.material?.transparent,
        materialVisible: o.material?.visible,
      });
    }
  });
  return out;
});
console.log('GUNGRP CONTENTS:', JSON.stringify(sceneInfo, null, 2).slice(0, 4000));

await ctx.close();
await browser.close();
