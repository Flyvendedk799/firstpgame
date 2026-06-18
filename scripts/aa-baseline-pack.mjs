import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT_DIR = path.resolve(process.env.OUT_DIR || './screenshots/aa-baseline-pack');
const VIDEO_DIR = path.join(OUT_DIR, 'videos');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const mode = process.env.RENDER_MODE || 'auto';
const buildings = Array.from({ length: 12 }, (_, i) => i + 1);
const stateShots = ['normal', 'ads', 'focus', 'lowHp', 'killBeat', 'death', 'menu', 'alarm', 'blackout'];

function urlForMode() {
  const u = new URL(BASE_URL);
  u.searchParams.set('perf', '1');
  if (mode === 'webgl' || mode === 'webgpu') u.searchParams.set('renderer', mode);
  return u.toString();
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function capture(page, name, manifest, extra = {}) {
  const file = path.join(OUT_DIR, `${slug(name)}.png`);
  await page.screenshot({ path: file, fullPage: false, timeout: 20000 });
  const entry = await page.evaluate((name) => {
    const dbg = window.__game.debug;
    return {
      name,
      renderer: dbg.rendererInfo(),
      profile: dbg.visualProfile(),
      post: dbg.postContext(),
      screenPost: dbg.screenPost(),
      runtime: dbg.visualRuntime(),
      materials: dbg.materialStats(),
      perf: dbg.capturePerf()
    };
  }, name);
  manifest.captures.push({ file, ...entry, ...extra });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } }
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
});

await page.goto(urlForMode(), { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1400);
await page.waitForFunction(() => window.__game?.debug?.forcePostState, null, { timeout: 45000 });
const weaponSlots = await page.evaluate(() => {
  const dbg = window.__game?.debug;
  const playable = dbg?.playableWeaponIndices?.();
  if (Array.isArray(playable) && playable.length) return playable;
  const slots = dbg?.weaponSlots?.();
  if (Array.isArray(slots) && slots.length) return slots.map((slot, index) => slot?.index ?? index);
  return [1, 2, 3, 4, 5, 6, 7];
});

const manifest = {
  ok: false,
  createdAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  mode,
  captures: [],
  errors
};

await page.evaluate(() => {
  const dbg = window.__game.debug;
  const settings = dbg.settings();
  Object.assign(settings, {
    postEnabled: true,
    colorGrade: true,
    filmGrain: true,
    chromaticAberration: true,
    sharpen: true,
    vignette: true,
    smaa: true,
    gradeIntensity: 1,
    aoQuality: 'high',
    bloomQuality: 'high',
    shadowQuality: 'medium',
    atmosphereQuality: 'high',
    textureQuality: 'high',
    characterQuality: 'high',
    weaponQuality: 'high',
    scopePipEnabled: true,
    scopePipResolution: 768
  });
});

for (const bn of buildings) {
  await page.evaluate(async (bn) => {
    const dbg = window.__game.debug;
    const G = dbg.G();
    const P = dbg.P();
    const ld = dbg.buildLevel(bn);
    G.levelData = ld;
    G.building = bn;
    G.started = true;
    G.menuOpen = false;
    G.exitUnlocked = false;
    P.dead = false;
    P.hp = P.maxHp || 100;
    P.pos.set(0, 0.2, 18);
    P.yaw = Math.PI;
    P.pitch = 0;
    P.ads = 0;
    dbg.forceVisualProfile(null);
    dbg.forcePostState('normal');
    window.dispatchEvent(new Event('resize'));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, bn);
  await capture(page, `building-B${String(bn).padStart(2, '0')}-normal`, manifest, { kind: 'building', building: bn, state: 'normal' });
}

await page.evaluate(() => {
  const dbg = window.__game.debug;
  const G = dbg.G();
  const P = dbg.P();
  const ld = dbg.buildLevel(8);
  G.levelData = ld;
  G.building = 8;
  G.started = true;
  G.menuOpen = false;
  P.dead = false;
  P.hp = P.maxHp || 100;
  P.pos.set(0, 0.2, 18);
  P.yaw = Math.PI;
  P.pitch = 0;
});

for (const state of stateShots) {
  await page.evaluate(async (state) => {
    const dbg = window.__game.debug;
    dbg.forcePostState(state);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, state);
  await capture(page, `state-${state}`, manifest, { kind: 'post-state', state });
}

for (const slot of weaponSlots) {
  await page.evaluate(async (slot) => {
    const dbg = window.__game.debug;
    const P = dbg.P();
    P.dead = false;
    dbg.forcePostState('normal');
    if (P.weaponIdx !== slot) dbg.switchWeapon(slot, true);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, slot);
  const weapon = await page.evaluate(() => window.__game.debug.weaponVisualStatus());
  await capture(page, `weapon-${slot + 1}-${weapon.name}`, manifest, { kind: 'weapon', weapon });
}

await page.evaluate(async () => {
  const dbg = window.__game.debug;
  const P = dbg.P();
  const playable = dbg.playableWeaponIndices?.() || [1, 2, 3, 4, 5, 6, 7];
  const scopedSlot = playable.includes(7) ? 7 : (playable.includes(5) ? 5 : playable[0]);
  dbg.forcePostState('ads');
  if (P.weaponIdx !== scopedSlot) dbg.switchWeapon(scopedSlot, true);
  dbg.equipScope(4);
  dbg.setAds(1);
  const start = performance.now();
  while (performance.now() - start < 2200) {
    const pip = dbg.scopePip();
    if (pip.visible && pip.rendered && pip.materialOpacity > 0) break;
    await new Promise(r => requestAnimationFrame(r));
  }
});
await capture(page, 'scope-pip-prism-ads', manifest, { kind: 'scope-pip', scopePip: await page.evaluate(() => window.__game.debug.scopePip()) });

manifest.final = await page.evaluate(() => ({
  renderer: window.__game.debug.rendererInfo(),
  materialLibrary: window.__game.debug.materialLibrary(),
  runtime: window.__game.debug.visualRuntime(),
  perf: window.__game.debug.capturePerf()
}));

manifest.ok = errors.length === 0;
const manifestPath = path.join(OUT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

await context.close();
await browser.close();

manifest.videos = fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.webm')).map(f => path.join(VIDEO_DIR, f));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, manifest: manifestPath }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, captures: manifest.captures.length, videos: manifest.videos.length, manifest: manifestPath }, null, 2));
