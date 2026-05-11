// Diagnose the visual bugs the user reported in level 1 (giant white wedge,
// flickering, too dark). Walks every mesh near the player, classifies it by
// material/brightness/coplanarity, and reports candidates for each bug class.

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(BASE_URL + '?perf=1', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__game?.debug?.materialStats, null, { timeout: 30000 });

// Hide all overlay UI so the canvas is visible
await page.addStyleTag({ content: `
  body > div:not(#app):not(#root) { display: none !important; }
  #menu, #intro, #brief, #briefing, #pause, #pause-menu, #loadout-viewer, #level-select, .menu, .modal, .overlay {
    display: none !important; visibility: hidden !important; opacity: 0 !important;
  }
`});

const VIEW = process.env.VIEW || 'front';
const report = await page.evaluate(async (view) => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  const P = dbg.P();
  const ld = dbg.buildLevel(1);
  G.levelData = ld; G.building = 1; G.started = true; G.menuOpen = false;
  if (G.intro) G.intro.active = false;
  P.dead = false; P.hp = P.maxHp || 100;
  // Reproduce the user's vantage. The screenshot HUD shows ROOMS 0/3 and
  // DOCK 7. Player likely near the entrance facing into the dock.
  if (view === 'front') { P.pos.set(0, 1.7, 18); P.yaw = Math.PI; P.pitch = -0.05; }
  else if (view === 'side') { P.pos.set(-4, 1.7, 0); P.yaw = Math.PI * 0.65; P.pitch = -0.05; }
  else if (view === 'corner') { P.pos.set(6, 1.7, 14); P.yaw = Math.PI * 1.15; P.pitch = 0; }
  else if (view === 'user') { P.pos.set(2, 1.7, 8); P.yaw = Math.PI * 1.35; P.pitch = -0.08; }
  else { P.pos.set(0, 1.7, 18); P.yaw = Math.PI; P.pitch = -0.05; }
  // Force-hide any DOM overlays for screenshot purposes
  for (const id of ['menu','intro','brief','briefing','pause','pause-menu','loadout-viewer','level-select','death-overlay','death-screen']) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.remove('show'); }
  }
  window.dispatchEvent(new Event('resize'));
  for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));

  const THREE = window.THREE;
  const scene = dbg.scene();
  const cam = dbg.camera();

  // Compute average screen-space brightness contribution of each material
  // by sampling its uniform color + emissive + map flag. Reports the top
  // bright meshes within view of the camera, sorted by approx coverage.
  const frustum = new THREE.Frustum();
  const projView = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projView);

  const flagged = [];
  scene.traverse(o => {
    if (!o.isMesh || !o.material || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.geometry?.computeBoundingBox?.();
    o.geometry?.computeBoundingSphere?.();
    const bs = o.geometry?.boundingSphere;
    if (!bs) return;
    const wpos = new THREE.Vector3();
    o.getWorldPosition(wpos);
    const worldSphere = new THREE.Sphere(wpos.clone(), bs.radius * Math.max(o.scale.x, o.scale.y, o.scale.z));
    if (!frustum.intersectsSphere(worldSphere)) return;
    const dist = wpos.distanceTo(P.pos);
    if (dist > 35) return;

    for (const m of mats) {
      if (!m) continue;
      const colorHex = m.color ? '#' + m.color.getHexString() : 'no-color';
      const colorLuma = m.color ? Math.round(m.color.r * 76 + m.color.g * 150 + m.color.b * 29) : 0;
      const emissiveHex = m.emissive ? '#' + m.emissive.getHexString() : 'no-emissive';
      const emissiveLuma = m.emissive ? Math.round(m.emissive.r * 76 + m.emissive.g * 150 + m.emissive.b * 29) : 0;
      const family = m.userData?.aaMaterial || null;
      const tags = [];
      if (colorLuma > 180) tags.push('bright-color');
      if (emissiveLuma > 80 && (m.emissiveIntensity ?? 1) > 0.5) tags.push('strong-emissive');
      if (m.depthWrite === false && !m.transparent) tags.push('depth-write-off-not-transparent');
      if (m.polygonOffset === false && (m.userData?.aaDecal || m.userData?.isDecal)) tags.push('decal-without-polyoffset');
      if (m.transparent && m.opacity > 0.95) tags.push('transparent-but-opaque');
      if (!tags.length) continue;
      const bbWorld = bs.radius * 2;
      flagged.push({
        name: o.name || (o.userData?.aaMaterial || o.geometry?.type || 'mesh'),
        family, colorHex, colorLuma, emissiveHex, emissiveLuma, emissiveIntensity: m.emissiveIntensity ?? 1,
        opacity: m.opacity, transparent: !!m.transparent, depthWrite: m.depthWrite,
        toneMapped: m.toneMapped !== false,
        worldPos: [wpos.x.toFixed(2), wpos.y.toFixed(2), wpos.z.toFixed(2)],
        dist: dist.toFixed(2),
        radius: bbWorld.toFixed(2),
        scale: [o.scale.x, o.scale.y, o.scale.z],
        userKeys: Object.keys(o.userData || {}),
        tags,
        type: o.geometry?.type,
        matType: m.type
      });
    }
  });

  flagged.sort((a, b) => (b.colorLuma + b.emissiveLuma * 2) - (a.colorLuma + a.emissiveLuma * 2));

  // Detect potential z-fighting: meshes whose center is within 0.02m of each
  // other along the same axis-aligned plane.
  const slabs = [];
  scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.visible) return;
    const bb = o.geometry?.boundingBox;
    if (!bb) return;
    const wpos = new THREE.Vector3();
    o.getWorldPosition(wpos);
    const w = (bb.max.x - bb.min.x) * o.scale.x;
    const h = (bb.max.y - bb.min.y) * o.scale.y;
    const d = (bb.max.z - bb.min.z) * o.scale.z;
    // Flat plates: one dimension < 0.1m
    if (w < 0.1 || h < 0.1 || d < 0.1) {
      const axis = (w < 0.1) ? 'x' : (h < 0.1) ? 'y' : 'z';
      slabs.push({ name: o.name || o.geometry.type, pos: [wpos.x, wpos.y, wpos.z], axis, w, h, d, family: o.material?.userData?.aaMaterial });
    }
  });
  const coplanar = [];
  for (let i = 0; i < slabs.length; i++) {
    for (let j = i + 1; j < slabs.length; j++) {
      const a = slabs[i], b = slabs[j];
      if (a.axis !== b.axis) continue;
      const ai = a.axis === 'x' ? a.pos[0] : a.axis === 'y' ? a.pos[1] : a.pos[2];
      const bi = b.axis === 'x' ? b.pos[0] : b.axis === 'y' ? b.pos[1] : b.pos[2];
      if (Math.abs(ai - bi) > 0.04) continue;
      const dx = a.pos[0] - b.pos[0], dy = a.pos[1] - b.pos[1], dz = a.pos[2] - b.pos[2];
      const planeDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (planeDist > 4) continue;
      coplanar.push({
        aName: a.name, bName: b.name, aPos: a.pos, bPos: b.pos, axis: a.axis,
        gap: Math.abs(ai - bi),
        planarSep: planeDist,
        aFamily: a.family, bFamily: b.family
      });
    }
  }
  coplanar.sort((a, b) => a.gap - b.gap);

  // Inspect lighting profile and renderer settings
  const lightingProfile = dbg.lightingProfile?.(1);
  const renderer = dbg.renderer();
  const rendererInfo = { toneMapping: renderer.toneMapping, toneMappingExposure: renderer.toneMappingExposure, outputColorSpace: renderer.outputColorSpace };
  let lightCount = 0;
  scene.traverse(o => { if (o.isLight) lightCount++; });

  return {
    flagged: flagged.slice(0, 20),
    coplanarCount: coplanar.length,
    coplanarSample: coplanar.slice(0, 10),
    lightingProfile,
    rendererInfo,
    lightCount,
    playerPos: [P.pos.x, P.pos.y, P.pos.z]
  };
}, VIEW);

const out = process.env.OUT || 'screenshots/level1-diagnose.png';
await page.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify(report, null, 2));
await ctx.close();
await browser.close();
