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

const ok = await page.evaluate(async () => {
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
  const restartGate = await new Promise((resolve) => {
    const prev = {
      building: G.building,
      started: G.started,
      menuOpen: G.menuOpen,
      dead: P.dead,
      hp: P.hp
    };
    const endscreen = document.getElementById('endscreen');
    const ending = document.getElementById('ending-overlay');
    endscreen?.classList.remove('show');
    ending?.classList.remove('show');
    G.started = true;
    G.menuOpen = false;
    G.building = 4;
    P.dead = true;
    P.hp = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, repeat: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const after = { building: G.building, started: G.started, dead: P.dead };
      G.building = prev.building;
      G.started = prev.started;
      G.menuOpen = prev.menuOpen;
      P.dead = prev.dead;
      P.hp = prev.hp;
      resolve({
        blocked: after.building === 4 && after.started === true && after.dead === true,
        after
      });
    }));
  });
  P.dead = false;
  G.started = true;
  G.menuOpen = false;
  dbg.switchWeapon(dbg.playableWeaponIndices?.()[0] ?? 1);
  const handFits = [];
  const finitePose = (pose) => !pose || Object.values(pose).every((v) => Number.isFinite(v));
  for (const wi of dbg.playableWeaponIndices?.() || [1]) {
    dbg.switchWeapon(wi);
    const st = dbg.weaponVisualStatus();
    handFits.push({
      weaponIdx: wi,
      fit: st.handFit,
      finite:
        !!st.handFit &&
        finitePose(st.handFit.rightBase) &&
        finitePose(st.handFit.leftBase) &&
        finitePose(st.handFit.rightCurrent) &&
        finitePose(st.handFit.leftCurrent),
      supportOnLongGun: ![1, 2, 6].includes(wi) ? st.handFit?.leftBase?.z < -0.12 : true
    });
  }
  let scopedPov = { present: false };
  if (dbg.equipScope && dbg.setAds && dbg.povState) {
    dbg.equipScope(4);
    dbg.setAds(1);
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const pov = dbg.povState();
    scopedPov = {
      present: !!pov,
      fov: pov?.fov,
      targetFov: pov?.targetFov,
      baseFov: pov?.baseFov,
      scoped: pov?.scoped,
      scopeSettle: pov?.scopeSettle,
      adsSettle: pov?.adsSettle,
      optic: pov?.optic,
      vignette: pov?.scopeVignetteOpacity
    };
    dbg.setAds(0);
  }
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
        grip: wv && wv.gripPose,
        handFits,
        scopedPov,
        restartGate
      });
    }, 800);
  });
});

if (errors.length) throw new Error(errors.join('\n'));
if (!ok.camOk || !ok.gunOk) throw new Error(`matrix check failed ${JSON.stringify(ok)}`);
if (!ok.hasWeaponStatus) throw new Error('weaponVisualStatus missing');
if (!ok.hasProxy) throw new Error('playerProxy missing');
if (!ok.handFits?.every((h) => h.finite && h.supportOnLongGun)) throw new Error(`hand fit check failed ${JSON.stringify(ok.handFits)}`);
if (!ok.restartGate?.blocked) throw new Error(`jump restart gate failed ${JSON.stringify(ok.restartGate)}`);
if (!ok.scopedPov?.present) throw new Error('povState missing');
if (!(Number.isFinite(ok.scopedPov.fov) && Number.isFinite(ok.scopedPov.targetFov) && Number.isFinite(ok.scopedPov.baseFov))) throw new Error(`scoped POV has non-finite FOV ${JSON.stringify(ok.scopedPov)}`);
if (!(ok.scopedPov.scoped > 0.9 && ok.scopedPov.scopeSettle > 0.85)) throw new Error(`scoped POV did not settle ${JSON.stringify(ok.scopedPov)}`);
if (!(ok.scopedPov.targetFov < ok.scopedPov.baseFov - 30 && ok.scopedPov.fov < ok.scopedPov.baseFov - 20)) throw new Error(`scoped FOV did not tighten ${JSON.stringify(ok.scopedPov)}`);

fs.writeFileSync(path.join(OUT_DIR, 'player-animation-acceptance.json'), JSON.stringify({ ok: true, ok }, null, 2));
console.log(JSON.stringify({ ok: true, summary: 'screenshots/player-animation-acceptance.json' }));

await context.close();
await browser.close();
