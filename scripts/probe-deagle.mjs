import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const events = [];
page.on('console', m => events.push(m.text()));
page.on('pageerror', e => events.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(8000);

const probe = await page.evaluate(() => {
  const dbg = window.__game?.debug;
  if (!dbg) return { err: 'no __game.debug' };
  const out = {
    soldier_loaded: dbg.soldier_loaded(),
    deagle_loaded: dbg.deagleGlb_loaded(),
    deagleGlbRig_present: !!dbg.deagleGlbRig(),
    P_weaponIdx: dbg.P()?.weaponIdx,
    G_started: dbg.G()?.started,
  };
  const r = dbg.deagleGlbRig();
  if (r) {
    out.deagleGlbRig = {
      visible: r.visible,
      scale: r.scale.toArray().map(x=>Number(x.toFixed(4))),
      position: r.position.toArray().map(x=>Number(x.toFixed(4))),
      rotation_y: Number(r.rotation.y.toFixed(3)),
      parent_name: r.parent ? (r.parent.name || r.parent.constructor.name) : 'no parent',
      ancestry: (() => {
        const chain = [];
        let p = r.parent;
        while (p) { chain.push(p.name || p.constructor.name); p = p.parent; }
        return chain;
      })(),
      childrenCount: r.children.length,
    };
    const meshes = [];
    r.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) {
        meshes.push({
          name: o.name,
          type: o.type,
          visible: o.visible,
          ancestorVisible: (() => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; })(),
          materialName: o.material?.name,
          materialOpacity: o.material?.opacity,
          materialTransparent: o.material?.transparent,
          geomCount: o.geometry?.attributes?.position?.count,
        });
      }
    });
    out.deagleGlbRig.meshes = meshes;
    const bb = new window.THREE.Box3().setFromObject(r);
    out.deagleGlbRig.worldBbox = {
      min: bb.min.toArray().map(x=>Number(x.toFixed(3))),
      max: bb.max.toArray().map(x=>Number(x.toFixed(3))),
      empty: bb.isEmpty(),
    };
  }
  return out;
});
console.log('PROBE PRE-SWITCH:', JSON.stringify(probe, null, 2));

// Force-start the game so render loop runs, then switch weapon
await page.evaluate(() => {
  const dbg = window.__game?.debug;
  if (dbg.G && dbg.G()) dbg.G().started = true;
  if (dbg && dbg.switchWeapon) dbg.switchWeapon(1);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/probe-deagle-active.png' });

const probe2 = await page.evaluate(() => {
  const dbg = window.__game?.debug;
  const r = dbg?.deagleGlbRig();
  if (!r) return { absent: true };
  const bb = new window.THREE.Box3().setFromObject(r);
  return {
    visible: r.visible,
    P_weaponIdx: dbg.P()?.weaponIdx,
    worldBbox: { min: bb.min.toArray().map(x=>Number(x.toFixed(3))), max: bb.max.toArray().map(x=>Number(x.toFixed(3))) },
  };
});
console.log('\nPROBE POST-SWITCH:', JSON.stringify(probe2, null, 2));

console.log('\n=== console events ===');
events.slice(-20).forEach(e => console.log('  ' + e));

await ctx.close();
await browser.close();
