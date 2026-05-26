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
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(BASE_URL + '?perf=1', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(800);
await page.waitForFunction(() => window.__game?.debug?.forcePostState, null, { timeout: 45000 });

const result = await page.evaluate(async () => {
  const dbg = window.__game.debug;
  const ld = dbg.buildLevel(1);
  const G = dbg.G();
  const P = dbg.P();
  G.levelData = ld;
  G.building = 1;
  G.started = true;
  G.menuOpen = false;
  P.dead = false;
  P.hp = 100;
  P.pos.set(0, 0.2, 18);
  P.grounded = true;
  P.running = true;
  P.sprintLatched = true;
  P.slideAmt = 0.5;
  P.crouchAmt = 0.2;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const m0 = dbg.movementAnimState();
  const a0 = dbg.playerAnimation();
  P.running = false;
  P.sprintLatched = false;
  P.slideAmt = 0;
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const m1 = dbg.movementAnimState();
  function clearAt(px, pz, r = 0.35) {
    return !ld.walls.some((w) => !w.broken && px + r > w.x0 && w.x1 > px - r && pz + r > w.z0 && w.z1 > pz - r);
  }
  function wallJumpSpot() {
    const r = 0.35;
    for (const w of ld.walls) {
      if (!w || w.broken) continue;
      const x0 = Math.min(w.x0, w.x1);
      const x1 = Math.max(w.x0, w.x1);
      const z0 = Math.min(w.z0, w.z1);
      const z1 = Math.max(w.z0, w.z1);
      const width = x1 - x0;
      const depth = z1 - z0;
      if (!Number.isFinite(width) || !Number.isFinite(depth) || width < 0.08 || depth < 0.08) continue;
      const cx = (x0 + x1) * 0.5;
      const cz = (z0 + z1) * 0.5;
      const candidates = width >= depth
        ? [
            { x: cx, z: z0 - r - 0.04, nx: 0, nz: -1 },
            { x: cx, z: z1 + r + 0.04, nx: 0, nz: 1 }
          ]
        : [
            { x: x0 - r - 0.04, z: cz, nx: -1, nz: 0 },
            { x: x1 + r + 0.04, z: cz, nx: 1, nz: 0 }
          ];
      const hit = candidates.find((c) =>
        clearAt(c.x, c.z, r) &&
        clearAt(c.x + c.nx * 0.75, c.z + c.nz * 0.75, r) &&
        clearAt(c.x + c.nx * 1.30, c.z + c.nz * 1.30, r)
      );
      if (hit) return hit;
    }
    return null;
  }
  const spot = wallJumpSpot();
  let wallJump = { ok: false, error: 'no wall jump spot' };
  if (spot) {
    P.pos.set(spot.x, 0.2, spot.z);
    P.jumpH = 1.05;
    P.grounded = false;
    P.vy = -1.1;
    P.yaw = Math.atan2(spot.nx, spot.nz);
    P.vaulting = false;
    P.nearVault = null;
    P.wallJumpTimer = 0;
    P.wallJumpVx = 0;
    P.wallJumpVz = 0;
    P.wallJumpSide = 0;
    P.wallContact = null;
    P._lastWallJumpT = 0;
    P._wallJumpLockWall = null;
    const before = { x: P.pos.x, z: P.pos.z, jumpH: P.jumpH };
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    const immediate = {
      vy: P.vy,
      timer: P.wallJumpTimer,
      vx: P.wallJumpVx,
      vz: P.wallJumpVz,
      contact: P.wallContact,
      state: dbg.wallJumpState?.()
    };
    let peakJumpH = P.jumpH;
    let earlyAnim = null;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      peakJumpH = Math.max(peakJumpH, P.jumpH);
      if (i === 1) earlyAnim = JSON.parse(JSON.stringify(dbg.playerAnimation()));
    }
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
    const aw = earlyAnim || dbg.playerAnimation();
    const travel = {
      horizontal: Math.hypot(P.pos.x - before.x, P.pos.z - before.z),
      vertical: peakJumpH - before.jumpH,
      finalVertical: P.jumpH - before.jumpH,
      outward: immediate.contact ? immediate.vx * immediate.contact.nx + immediate.vz * immediate.contact.nz : 0
    };
    wallJump = {
      ok: true,
      spot,
      immediate,
      travel,
      state: dbg.wallJumpState?.(),
      movement: dbg.movementAnimState(),
      anim: {
        input: aw.inputs.wallJump,
        side: aw.inputs.wallJumpSide,
        locomotion: aw.layerWeights.locomotion.wallJump,
        cameraRoll: aw.resolved.camera.wallKickRoll,
        cameraAirFloat: aw.resolved.camera.airFloat,
        viewmodelZ: aw.resolved.viewmodel.wallKickZ,
        viewmodelAirLift: aw.resolved.viewmodel.airLift,
        viewmodelFallDrop: aw.resolved.viewmodel.fallDrop,
        viewmodelApexFloat: aw.resolved.viewmodel.apexFloat,
        viewmodelRunStepX: aw.resolved.viewmodel.runStepX,
        proxyJumpPose: aw.resolved.proxy.jumpPose,
        proxyArmSwing: aw.resolved.proxy.armSwing,
        notifies: (aw.recentNotifies || []).map((n) => n.name)
      }
    };
  }
  let dropkick = { ok: false, error: 'debug hook missing' };
  let targetedDropkick = { ok: false, error: 'debug hook missing' };
  if (dbg.dropkickState && dbg.viewmodelPose && dbg.spawnAt) {
    if (G.enemyMgr) G.enemyMgr.clear();
    P.pos.set(0, 0.2, 18);
    P.jumpH = 1.0;
    P.grounded = false;
    P.vy = -0.45;
    P.yaw = 0;
    P.pitch = 0;
    P.vaulting = false;
    P.nearVault = null;
    P.wallJumpTimer = 0;
    P.wallJumpVx = 0;
    P.wallJumpVz = 0;
    P.dropkickActive = false;
    P.dropkickCooldown = 0;
    P.dropkickLandTimer = 0;
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      document.dispatchEvent(new KeyboardEvent('keyup', { code, key: '', bubbles: true }));
    }
    dbg.spawnAt('soldier', 0, 16.7);
    const enemy = G.enemyMgr?._list?.[0] || null;
    const beforeHp = enemy?.hp ?? 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    const immediate = dbg.dropkickState();
    let feetSeen = false;
    let earlyAnim = null;
    let hpMin = beforeHp;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const pose = dbg.viewmodelPose();
      feetSeen = feetSeen || !!pose.dropkickFeet?.visible;
      if (enemy) hpMin = Math.min(hpMin, enemy.hp || 0);
      if (i === 2) earlyAnim = JSON.parse(JSON.stringify(dbg.playerAnimation()));
    }
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    const aw = earlyAnim || dbg.playerAnimation();
    const finalState = dbg.dropkickState();
    dropkick = {
      ok: true,
      immediate,
      finalState,
      feetSeen,
      beforeHp,
      afterHp: enemy?.hp ?? 0,
      killed: !!enemy?.dead,
      hpDelta: beforeHp - hpMin,
      anim: {
        input: aw.inputs.dropkick,
        phase: aw.inputs.dropkickPhase,
        land: aw.inputs.dropkickLand,
        locomotion: aw.layerWeights.locomotion.dropkick,
        cameraPitch: aw.resolved.camera.dropkickPitch,
        viewmodelTuck: aw.resolved.viewmodel.dropkickTuck,
        viewmodelKick: aw.resolved.viewmodel.dropkickKick,
        proxyDropkick: aw.resolved.proxy.dropkickPose,
        notifies: (aw.recentNotifies || []).map((n) => n.name)
      }
    };
    if (G.enemyMgr) G.enemyMgr.clear();
    P.pos.set(0, 0.2, 18);
    P.jumpH = 1.2;
    P.grounded = false;
    P.vy = -0.10;
    P.yaw = 0;
    P.pitch = -0.55;
    P.vaulting = false;
    P.nearVault = null;
    P.wallJumpTimer = 0;
    P.wallJumpVx = 0;
    P.wallJumpVz = 0;
    P.dropkickActive = false;
    P.dropkickCooldown = 0;
    P.dropkickLandTimer = 0;
    P.dropkickTargeted = false;
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      document.dispatchEvent(new KeyboardEvent('keyup', { code, key: '', bubbles: true }));
    }
    dbg.spawnAt('soldier', 0, 14.7);
    await new Promise((r) => requestAnimationFrame(r));
    const targetEnemy = G.enemyMgr?._list?.[0] || null;
    const targetBeforeHp = targetEnemy?.hp ?? 0;
    const targetStart = { x: P.pos.x, z: P.pos.z };
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    const targetImmediate = dbg.dropkickState();
    let targetHpMin = targetBeforeHp;
    let targetFeetSeen = false;
    let targetMaxTravel = 0;
    for (let i = 0; i < 28; i++) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      targetFeetSeen = targetFeetSeen || !!dbg.viewmodelPose().dropkickFeet?.visible;
      targetMaxTravel = Math.max(targetMaxTravel, Math.hypot(P.pos.x - targetStart.x, P.pos.z - targetStart.z));
      if (targetEnemy) targetHpMin = Math.min(targetHpMin, targetEnemy.hp || 0);
    }
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    targetedDropkick = {
      ok: true,
      immediate: targetImmediate,
      finalState: dbg.dropkickState(),
      feetSeen: targetFeetSeen,
      travel: targetMaxTravel,
      beforeHp: targetBeforeHp,
      afterHp: targetEnemy?.hp ?? 0,
      killed: !!targetEnemy?.dead,
      hpDelta: targetBeforeHp - targetHpMin
    };
  }
  return { m0, m1, a0, wallJump, dropkick, targetedDropkick, finiteM0: Number.isFinite(m0.footPhase) && Number.isFinite(m0.velLX) };
});

if (errors.length) throw new Error(errors.join('\n'));
if (!result.finiteM0) throw new Error('movementAnimState not finite');
if (!(result.m0.footPhase >= 0)) throw new Error('bad footPhase');
if (!result.wallJump?.ok) throw new Error(`wall jump setup failed: ${result.wallJump?.error || 'unknown'}`);
if (!(result.wallJump.immediate.vy > 7.0)) throw new Error(`wall jump did not launch upward: ${JSON.stringify(result.wallJump.immediate)}`);
if (!(result.wallJump.immediate.timer > 0)) throw new Error(`wall jump timer did not start: ${JSON.stringify(result.wallJump.immediate)}`);
if (!(result.wallJump.travel?.outward > 9.5)) throw new Error(`wall jump did not spring off wall: ${JSON.stringify(result.wallJump.travel)}`);
if (!(result.wallJump.travel?.horizontal > 0.70)) throw new Error(`wall jump did not travel far enough: ${JSON.stringify(result.wallJump.travel)}`);
if (!(result.wallJump.travel?.vertical > 0.35)) throw new Error(`wall jump did not gain enough air: ${JSON.stringify(result.wallJump.travel)}`);
if (!(result.wallJump.anim.input > 0 || result.wallJump.anim.locomotion > 0)) throw new Error(`wall jump animation did not activate: ${JSON.stringify(result.wallJump.anim)}`);
for (const [key, value] of Object.entries(result.wallJump.anim)) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`animation channel ${key} not finite: ${JSON.stringify(result.wallJump.anim)}`);
}
if (!(Math.abs(result.wallJump.anim.viewmodelZ) > 0.02)) throw new Error(`wall jump viewmodel kick too weak: ${JSON.stringify(result.wallJump.anim)}`);
if (!(Math.abs(result.wallJump.anim.proxyJumpPose) > 0.05 || Math.abs(result.wallJump.anim.proxyArmSwing) > 0.01)) throw new Error(`proxy movement animation too weak: ${JSON.stringify(result.wallJump.anim)}`);
if (!result.wallJump.anim.notifies.includes('wallJump')) throw new Error(`wallJump notify missing: ${JSON.stringify(result.wallJump.anim.notifies)}`);
if (!result.dropkick?.ok) throw new Error(`dropkick setup failed: ${result.dropkick?.error || 'unknown'}`);
if (!result.dropkick.immediate?.active) throw new Error(`dropkick did not activate in air: ${JSON.stringify(result.dropkick)}`);
if (!(result.dropkick.feetSeen && result.dropkick.finalState?.feetMeshes >= 2)) throw new Error(`dropkick feet did not render: ${JSON.stringify(result.dropkick)}`);
if (!(result.dropkick.hpDelta > 50 || result.dropkick.killed)) throw new Error(`dropkick did not damage enemy: ${JSON.stringify(result.dropkick)}`);
if (!(result.dropkick.anim.input || result.dropkick.anim.locomotion > 0.05)) throw new Error(`dropkick animation did not activate: ${JSON.stringify(result.dropkick.anim)}`);
if (!(result.dropkick.anim.viewmodelKick > 0.05 && result.dropkick.anim.proxyDropkick > 0.05)) throw new Error(`dropkick pose channels too weak: ${JSON.stringify(result.dropkick.anim)}`);
if (!result.dropkick.anim.notifies.includes('dropkickStart')) throw new Error(`dropkickStart notify missing: ${JSON.stringify(result.dropkick.anim.notifies)}`);
if (!result.targetedDropkick?.ok) throw new Error(`targeted dropkick setup failed: ${result.targetedDropkick?.error || 'unknown'}`);
if (!result.targetedDropkick.immediate?.targeted) throw new Error(`crosshair-targeted dropkick did not acquire target: ${JSON.stringify(result.targetedDropkick)}`);
if (!(result.targetedDropkick.travel > 2.4)) throw new Error(`targeted dropkick did not lunge far enough: ${JSON.stringify(result.targetedDropkick)}`);
if (!(result.targetedDropkick.hpDelta > 50 || result.targetedDropkick.killed)) throw new Error(`targeted dropkick did not damage enemy: ${JSON.stringify(result.targetedDropkick)}`);
fs.writeFileSync(path.join(OUT_DIR, 'player-animation-movement-probe.json'), JSON.stringify({ ok: true, result }, null, 2));
console.log(JSON.stringify({ ok: true, out: 'screenshots/player-animation-movement-probe.json' }));

await context.close();
await browser.close();
