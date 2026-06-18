import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push({ type: 'pageerror', text: err.message }));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
});

function assert(cond, message, detail = null) {
  if (!cond) {
    const suffix = detail ? `\n${JSON.stringify(detail, null, 2)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

function angleDelta(a, b) {
  const tau = Math.PI * 2;
  return ((((a - b + Math.PI) % tau) + tau) % tau) - Math.PI;
}

try {
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => window.__game?.debug?.buildLevel && window.__game?.debug?.spawnAt && window.__game?.debug?.takedownState,
    null,
    { timeout: 45000 }
  );

  await page.addStyleTag({
    content: `
      #menu-content,#menu-bg-fx,#menu,#radial,#inventory,#shop,#endscreen,#ending-overlay,#boot,#loading {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  });

  const setup = await page.evaluate(() => {
    const dbg = window.__game.debug;
    dbg.buildLevel(1);
    const G = dbg.G();
    const P = dbg.P();
    if (G.enemyMgr && typeof G.enemyMgr.clear === 'function') G.enemyMgr.clear();
    G.started = true;
    G.menuOpen = false;
    G.invOpen = false;
    G.shopOpen = false;
    G.paused = false;
    G.exitUnlocked = false;
    G.splitScreenActive = false;
    G.playMode = 'solo';
    P.dead = false;
    P.hp = Math.max(P.hp || 0, 100);
    P.reloading = false;
    P.vaulting = false;
    P.dropkickActive = false;
    P.nearPickup = null;
    P.nearOpenableDoor = null;
    P.smokes = 1;
    P.weaponIdx = 1;
    P.pos.set(0, 0.2, 0);
    P.yaw = 0;
    P.pitch = 0;
    dbg.spawnAt('soldier', 1.15, -1.55);
    const list = (G.enemyMgr && G.enemyMgr._list) || [];
    const enemy = list[list.length - 1];
    if (!enemy) return { ok: false, error: 'spawn failed' };
    enemy.group.position.set(1.15, 0.4, -1.55);
    enemy.group.rotation.y = Math.atan2(P.pos.x - enemy.group.position.x, P.pos.z - enemy.group.position.z);
    enemy.hp = Math.max(1, Math.round((enemy.maxHp || 100) * 0.2));
    enemy.dead = false;
    enemy.isBoss = false;
    enemy.spawnTimer = 0;
    enemy.spawnIntro = null;
    enemy._roomFlowDormant = false;
    enemy.group.visible = true;
    enemy._probeTag = true;
    window.__takedownProbeEnemy = enemy;
    return {
      ok: true,
      smokes: P.smokes,
      target: { x: enemy.group.position.x, z: enemy.group.position.z, hp: enemy.hp, maxHp: enemy.maxHp },
      player: { x: P.pos.x, z: P.pos.z, yaw: P.yaw },
    };
  });

  assert(setup.ok, 'failed to set up takedown probe enemy', setup);

  await page.evaluate(() => {
    const dbg = window.__game.debug;
    const G = dbg.G();
    const P = dbg.P();
    const enemy = window.__takedownProbeEnemy;
    G.started = true;
    G.menuOpen = false;
    G.invOpen = false;
    G.shopOpen = false;
    G.paused = false;
    P.dead = false;
    P.reloading = false;
    P.vaulting = false;
    P.smokes = 1;
    P.weaponIdx = 1;
    P.pos.set(0, 0.2, 0);
    P.yaw = 0;
    P.pitch = 0;
    if (enemy) {
      enemy.group.position.set(1.15, 0.4, -1.55);
      enemy.hp = Math.max(1, Math.round((enemy.maxHp || 100) * 0.2));
      enemy.dead = false;
      enemy.isBoss = false;
      enemy.spawnTimer = 0;
      enemy._roomFlowDormant = false;
      enemy.group.visible = true;
    }
  });

  const startState = await page.evaluate(async () => {
    const ev = (type) => document.dispatchEvent(new KeyboardEvent(type, {
      code: 'KeyT',
      key: 't',
      bubbles: true,
      cancelable: true,
      repeat: false,
    }));
    ev('keydown');
    ev('keyup');
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    const dbg = window.__game.debug;
    const P = dbg.P();
    const enemy = window.__takedownProbeEnemy;
    return {
      state: dbg.takedownState(),
      smokes: P.smokes,
      enemyDead: !!enemy?.dead,
      enemyAnim: enemy?.animationState || '',
    };
  });

  assert(startState.state.active, 'takedown should activate immediately from the KeyT bind', startState);
  assert(startState.smokes === 1, 'KeyT takedown should not consume smoke on activation', startState);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'takedown-cinematic-runtime.png'), fullPage: false });
  await page.waitForTimeout(420);

  const mid = await page.evaluate(() => {
    const dbg = window.__game.debug;
    const P = dbg.P();
    const enemy = window.__takedownProbeEnemy;
    const st = dbg.takedownState();
    const dx = 1.15;
    const dz = -1.55;
    const expectedYaw = Math.atan2(-dx, -dz);
    const forward = { x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) };
    const targetDir = { x: dx / Math.hypot(dx, dz), z: dz / Math.hypot(dx, dz) };
    return {
      state: st,
      expectedYaw,
      yaw: P.yaw,
      aimDotFromStart: forward.x * targetDir.x + forward.z * targetDir.z,
      smokes: P.smokes,
      enemyDead: !!enemy?.dead,
      enemyAnim: enemy?.animationState || '',
      victimUserData: enemy?.group?.userData?.takedownVictim || null,
    };
  });

  const yawErr = Math.abs(angleDelta(mid.yaw, mid.expectedYaw));
  assert(mid.smokes === 1, 'KeyT takedown should not consume smoke when a valid target exists', mid);
  assert(startState.state.contactRig.visible || mid.state.contactRig.visible, 'takedown contact rig should be visible during animation', { startState, mid });
  assert(mid.state.beats.grab || mid.state.beats.control, 'grab/control beat should have fired by mid animation', mid);
  assert(mid.aimDotFromStart > 0.82, 'camera should face the enemy line, not turn away first', mid);
  assert(yawErr < 0.42, `camera yaw drifted away from target line: ${yawErr.toFixed(3)} rad`, mid);
  assert(mid.enemyAnim === 'takedownVictim' || mid.enemyDead, 'enemy should be in takedown victim pose or already killed by the impact beat', mid);

  await page.waitForTimeout(520);
  const impact = await page.evaluate(() => window.__game.debug.takedownState());
  assert(impact.beats.impact, 'impact beat should fire before takedown completes', impact);

  await page.waitForTimeout(850);

  const final = await page.evaluate(() => ({
    state: window.__game.debug.takedownState(),
    enemyDead: !!window.__takedownProbeEnemy?.dead,
    smokes: window.__game.debug.P().smokes,
  }));

  assert(!final.state.active, 'takedown should complete and clear active state', final);
  assert(final.enemyDead, 'takedown should kill the low-health target', final);
  assert(final.smokes === 1, 'smoke count should remain unchanged after takedown', final);
  assert(errors.length === 0, 'browser reported console/page errors', errors);

  console.log(JSON.stringify({ ok: true, setup, mid, impact, final }, null, 2));
} finally {
  await browser.close();
}
