import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const failedRequests = [];
page.on('requestfailed', r => failedRequests.push({ url: r.url(), reason: r.failure()?.errorText }));
page.on('response', async r => {
  if (r.url().includes('/assets/materials/') && r.status() !== 200) {
    failedRequests.push({ url: r.url(), status: r.status() });
  }
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const u = new URL(BASE_URL);
u.searchParams.set('perf', '1');
await page.goto(u.toString(), { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__game?.debug?.materialStats, null, { timeout: 30000 });

const result = await page.evaluate(async () => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  const P = dbg.P();
  Object.assign(dbg.settings(), {
    quality: 'high', textureQuality: 'high', postEnabled: true,
    aoQuality: 'high', bloomQuality: 'high', shadowQuality: 'medium',
    smaa: true, colorGrade: true
  });
  // Build the level directly (skip the menu / intro / story flow which would
  // otherwise leave us looking at the typewriter narration).
  const ld = dbg.buildLevel(1);
  G.levelData = ld;
  G.building = 1;
  G.started = true;
  G.menuOpen = false;
  G.exitUnlocked = false;
  if (G.intro) G.intro.active = false;
  if (G._introLockedInput !== undefined) G._introLockedInput = false;
  // Find the biggest concrete mesh and aim the camera at it so the authored
  // material is the dominant pixel source in the screenshot.
  const scene = dbg.scene();
  const cam = dbg.camera();
  let bestConcrete = null;
  let bestSize = 0;
  scene.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const isConcrete = mats.some(m => m?.userData?.aaMaterial === 'concrete');
    if (!isConcrete) return;
    o.geometry?.computeBoundingBox?.();
    const bb = o.geometry?.boundingBox;
    if (!bb) return;
    const size = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) * (bb.max.z - bb.min.z);
    if (size > bestSize) {
      const c = new (o.position.constructor)(); // THREE.Vector3
      bb.getCenter(c);
      const wp = o.localToWorld(c.clone());
      bestSize = size;
      bestConcrete = { wp: [wp.x, wp.y, wp.z], size, name: o.name, userData: o.userData };
    }
  });
  P.dead = false;
  P.hp = P.maxHp || 100;
  if (bestConcrete) {
    const [tx, ty, tz] = bestConcrete.wp;
    // Stand ~3m back from the slab and pitch down ~35° so the floor texture
    // dominates the lower 2/3 of the frame while the dock walls stay visible.
    P.pos.set(tx, ty + 1.65, tz + 3.2);
    P.yaw = Math.PI;
    P.pitch = -0.55;
  } else {
    P.pos.set(0, 1.6, 18);
    P.yaw = Math.PI;
    P.pitch = 0;
  }
  window.__probeConcreteTarget = bestConcrete;
  // Hide every DOM overlay that could occlude the WebGL canvas so the
  // screenshot captures the actual rendered frame.
  for (const sel of ['#start-menu', '.menu', '#overlay', '.overlay', '#story-card', '#briefing', '#hud', '#mission-card', '#end-screen', '#focus-cue', '.briefing-card']) {
    document.querySelectorAll(sel).forEach(e => { e.style.display = 'none'; });
  }
  // Bump the test exposure + add a temporary fill light so the authored
  // concrete albedo is readable in a headless screenshot (the dock is
  // intentionally moody in normal gameplay).
  dbg.setToneMappingExposure?.(1.6);
  const THREE = window.THREE;
  if (THREE) {
    const fill = new THREE.AmbientLight(0xffffff, 0.6);
    fill.userData.aaProbeFill = true;
    scene.add(fill);
    const key = new THREE.PointLight(0xffeecc, 1.4, 24, 1.2);
    key.position.set(P.pos.x, P.pos.y + 1.0, P.pos.z - 1.5);
    key.userData.aaProbeFill = true;
    scene.add(key);
  }
  window.dispatchEvent(new Event('resize'));
  for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));

  const stats = dbg.materialStats();
  let sampleConcreteMat = null;
  let totalConcreteMeshes = 0;
  let authoredConcreteMeshes = 0;
  const traverseRoot = window.__game?.scene;
  const root = traverseRoot || dbg.G().scene || null;
  function walk(obj) {
    if (!obj) return;
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.userData?.aaMaterial === 'concrete') {
          totalConcreteMeshes++;
          if (m.userData?.aaAuthoredMaps) authoredConcreteMeshes++;
          if (!sampleConcreteMat) {
            sampleConcreteMat = {
              hasMap: !!m.map,
              hasNormalMap: !!m.normalMap,
              hasRoughnessMap: !!m.roughnessMap,
              hasMetalnessMap: !!m.metalnessMap,
              hasAoMap: !!m.aoMap,
              mapSrc: m.map?.source?.data?.src || m.map?.image?.src || null,
              normalSrc: m.normalMap?.source?.data?.src || m.normalMap?.image?.src || null,
              roughness: m.roughness,
              metalness: m.metalness,
              normalScale: m.normalScale ? [m.normalScale.x, m.normalScale.y] : null,
              authored: !!m.userData?.aaAuthoredMaps,
              quality: m.userData?.aaMaterialQualityName,
              color: m.color ? '#' + m.color.getHexString() : null
            };
          }
        }
      }
    }
    if (obj.children) for (const c of obj.children) walk(c);
  }
  walk(root);

  return {
    sceneStats: {
      meshes: stats.scene.meshes,
      pbr: stats.scene.pbr,
      aa: stats.scene.aa,
      maps: stats.scene.maps,
      authored: stats.scene.authored || 0,
      byFamily: stats.scene.byFamily
    },
    concreteSample: sampleConcreteMat,
    concreteMeshes: { total: totalConcreteMeshes, authored: authoredConcreteMeshes },
    settings: { textureQuality: dbg.settings().textureQuality || 'high', quality: dbg.settings().quality || 'high' },
    concreteTarget: window.__probeConcreteTarget,
    playerPos: [P.pos.x, P.pos.y, P.pos.z],
    cameraInfo: { fov: cam.fov, near: cam.near, far: cam.far }
  };
});

console.log('---failedRequests:', JSON.stringify(failedRequests, null, 2));
console.log('---consoleErrors:', JSON.stringify(errors.slice(0, 10), null, 2));
console.log('---result:', JSON.stringify(result, null, 2));

await page.screenshot({ path: 'screenshots/concrete-probe.png', fullPage: false });
console.log('---screenshot saved to screenshots/concrete-probe.png');

await ctx.close();
await browser.close();
