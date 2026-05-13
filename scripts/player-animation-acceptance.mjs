import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve('./screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE_URL + '?perf=1', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(800);
await page.waitForFunction(() => window.__game?.debug?.forcePostState, null, { timeout: 45000 });

const ok = await page.evaluate(() => {
  function matOk(m) {
    if (!m || !m.elements) return true;
    for (let i = 0; i < m.elements.length; i++) {
      if (!Number.isFinite(m.elements[i])) return false;
    }
    return true;
  }
  const dbg = window.__game.debug;
  const ld = dbg.buildLevel(1);
  const G = dbg.G();
  const P = dbg.P();
  G.levelData = ld;
  G.building = 1;
  G.started = true;
  G.menuOpen = false;
  P.dead = false;
  dbg.switchWeapon(0);
  for (let i = 0; i < 8; i++) {
    window.dispatchEvent(new Event('resize'));
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      const cam = dbg.camera();
      const gun = dbg.gunGrp();
      const camOk = matOk(cam && cam.matrixWorld);
      const gunOk = matOk(gun && gun.matrixWorld);
      const wv = dbg.weaponVisualStatus();
      const pr = dbg.playerProxy();
      resolve({
        camOk,
        gunOk,
        hasWeaponStatus: !!wv,
        hasProxy: !!pr,
        grip: wv && wv.gripPose
      });
    }, 800);
  });
});

if (errors.length) throw new Error(errors.join('\n'));
if (!ok.camOk || !ok.gunOk) throw new Error(`matrix check failed ${JSON.stringify(ok)}`);
if (!ok.hasWeaponStatus) throw new Error('weaponVisualStatus missing');
if (!ok.hasProxy) throw new Error('playerProxy missing');

fs.writeFileSync(path.join(OUT_DIR, 'player-animation-acceptance.json'), JSON.stringify({ ok: true, ok }, null, 2));
console.log(JSON.stringify({ ok: true, summary: 'screenshots/player-animation-acceptance.json' }));

await context.close();
await browser.close();
