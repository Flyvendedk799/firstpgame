/**
 * AAA-Presence — targeted hooks for docs/AAA-PLAN.md workstreams 1–4
 * (visual believability, human motion, physical guns, readable enemies).
 * Kept in one small module so main.js only forwards state + timings.
 */

const _muzzleSpills = [];

/**
 * Brief world-space point light at the muzzle so nearby geometry catches
 * a flash (plan §1 — muzzle briefly affecting nearby surfaces).
 */
export function spawnAaaMuzzleWorldSpill(THREE, scene, position, opts) {
  if (!THREE || !scene || !position) return;
  const sup = Math.max(0.08, Math.min(1, opts?.suppressedMul ?? 1));
  const wi = opts?.weaponIdx ?? 0;
  const col =
    wi === 3 ? 0xffaa66 : wi === 7 ? 0xffddcc : wi === 0 ? 0xffe8cc : 0xffcc88;
  const peak = (2.2 + Math.random() * 0.9) * sup * (wi === 3 ? 1.15 : 1);
  const L = new THREE.PointLight(col, peak, 3.4, 2.05);
  L.position.copy(position);
  L.layers.enable(0);
  L.userData._aaaSpill = true;
  L.userData.i0 = peak;
  L.userData.life = sup < 0.32 ? 0.055 : 0.09;
  L.userData.t = 0;
  scene.add(L);
  _muzzleSpills.push(L);
}

export function tickAaaMuzzleWorldSpills(THREE, scene, dt) {
  if (!_muzzleSpills.length) return;
  for (let i = _muzzleSpills.length - 1; i >= 0; i--) {
    const L = _muzzleSpills[i];
    if (!L || !L.parent) {
      _muzzleSpills.splice(i, 1);
      continue;
    }
    L.userData.t += dt;
    const u = L.userData.t / L.userData.life;
    if (u >= 1) {
      scene.remove(L);
      if (L.dispose) L.dispose();
      _muzzleSpills.splice(i, 1);
    } else {
      const k = (1 - u) * (1 - u);
      L.intensity = L.userData.i0 * k;
    }
  }
}

/**
 * Walk vs strafe vs sprint: different bob cadence and amplitude (plan §2).
 */
export function locomotionStrafeBobTuning(keys, isRunning, moving) {
  const a = keys?.KeyA ? 1 : 0;
  const d = keys?.KeyD ? 1 : 0;
  const w = keys?.KeyW ? 1 : 0;
  const s = keys?.KeyS ? 1 : 0;
  const strafeAxis = a + d > 0;
  const fwdAxis = w + s > 0;
  const onlyStrafe = strafeAxis && !fwdAxis;
  const strafeHeavy = strafeAxis && fwdAxis;
  let phaseMul = 1;
  let ampCapMul = 1;
  let ampBuildMul = 1;
  if (onlyStrafe) {
    phaseMul = isRunning ? 1.38 : 1.16;
    ampCapMul = isRunning ? 1.12 : 1.06;
    ampBuildMul = 1.05;
  } else if (strafeHeavy) {
    phaseMul = isRunning ? 1.16 : 1.05;
    ampCapMul = isRunning ? 1.08 : 1.04;
    ampBuildMul = isRunning ? 1.08 : 1.0;
  } else if (isRunning) {
    phaseMul = 1.06;
    ampCapMul = 1.10;
    ampBuildMul = 1.10;
  } else {
    phaseMul = 0.94;
  }
  const sign = d > a ? 1 : a > d ? -1 : 0;
  const camRollStrafe =
    moving && sign !== 0 ? sign * (isRunning ? 0.009 : 0.006) * (onlyStrafe ? 1.06 : 1) : 0;
  return { phaseMul, ampCapMul, ampBuildMul, camRollStrafe };
}

/**
 * Extra gun-group tilt during reload so the beat reads as mag out / in / rack
 * (plan §3 — reload short story, complements holo + hand keys).
 */
export function reloadStoryGunTilt01(rt01, weaponIdx) {
  if (weaponIdx === undefined || weaponIdx === null) return { x: 0, y: 0, z: 0 };
  const rt = Math.max(0, Math.min(1, rt01));
  let x = 0;
  let y = 0;
  let z = 0;
  if (weaponIdx === 0) {
    if (rt < 0.2) {
      const p = rt / 0.2;
      z = p * 0.07;
      x = -p * 0.045;
    } else if (rt < 0.55) {
      const p = (rt - 0.2) / 0.35;
      z = 0.07 - p * 0.11;
      x = -0.045 + Math.sin(p * Math.PI) * 0.055;
    } else if (rt < 0.82) {
      const p = (rt - 0.55) / 0.27;
      z = -0.04 + p * 0.05;
      x = 0.02 - p * 0.03;
      y = Math.sin(p * Math.PI) * 0.04;
    } else {
      const p = (rt - 0.82) / 0.18;
      z = 0.01 * (1 - p);
      y = 0.04 * (1 - p);
    }
  } else if (weaponIdx === 1 || weaponIdx === 6) {
    if (rt < 0.18) {
      const p = rt / 0.18;
      z = p * 0.055;
      x = -p * 0.038;
    } else if (rt < 0.52) {
      const p = (rt - 0.18) / 0.34;
      z = 0.055 - p * 0.1;
      x = -0.038 + Math.sin(p * Math.PI) * 0.048;
    } else if (rt < 0.8) {
      const p = (rt - 0.52) / 0.28;
      z = -0.045 + p * 0.06;
      y = Math.sin(p * Math.PI) * 0.038;
    } else {
      const p = (rt - 0.8) / 0.2;
      z = 0.015 * (1 - p);
      x = 0.02 * Math.sin(p * Math.PI);
    }
  } else {
    if (rt < 0.25) {
      const p = rt / 0.25;
      z = p * 0.05;
    } else if (rt < 0.72) {
      const p = (rt - 0.25) / 0.47;
      z = 0.05 - p * 0.08;
      y = Math.sin(p * Math.PI) * 0.03;
    } else {
      const p = (rt - 0.72) / 0.28;
      z = -0.03 * (1 - p);
    }
  }
  return { x, y, z };
}
