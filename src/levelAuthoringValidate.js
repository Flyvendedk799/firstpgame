/**
 * Level authoring checks that operate on baked levelData fields (walls, navGrid, …).
 * Shared by __game.debug and headless scripts via page.evaluate.
 */

/** Player capsule radius in XZ (matches main.js PR). */
export const AUTHORING_PLAYER_R = 0.35;
/** Nav bake clearance for agents (matches _buildNavGrid enemy R). */
export const AUTHORING_NAV_AGENT_R = 0.36;

function _clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function _pointToAabbDist2(px, pz, w) {
  const cx = _clamp(px, w.x0, w.x1);
  const cz = _clamp(pz, w.z0, w.z1);
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

export function circleClearOfWalls(px, pz, walls, R, skipWindow) {
  if (!walls || !Number.isFinite(R)) return true;
  for (const w of walls) {
    if (!w || w.broken) continue;
    if (skipWindow && w.isWindow) continue;
    if (_pointToAabbDist2(px, pz, w) < R * R) return false;
  }
  return true;
}

function _worldToNav(ng, x, z) {
  const ix = Math.floor((x - ng.xMin) / ng.cs) | 0;
  const iz = Math.floor((z - ng.zMin) / ng.cs) | 0;
  return { ix, iz };
}

function _navOpen(ng, ix, iz) {
  if (ix < 0 || iz < 0 || ix >= ng.nx || iz >= ng.nz) return false;
  return ng.blocked[ix + iz * ng.nx] === 0;
}

/** BFS on 4-neighbor nav grid; goal is any cell whose center lies inside goalBox. */
export function navReachabilityFromTo(ng, sx, sz, goalBox) {
  if (!ng || !goalBox) return { ok: false, reason: 'bad_args' };
  let { ix: six, iz: siz } = _worldToNav(ng, sx, sz);
  if (!_navOpen(ng, six, siz)) {
    let found = false;
    outer: for (let r = 1; r < 24 && !found; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const ix = six + dx;
          const iz = siz + dz;
          if (_navOpen(ng, ix, iz)) {
            six = ix;
            siz = iz;
            found = true;
            break outer;
          }
        }
      }
    }
    if (!found) return { ok: false, reason: 'no_start_cell' };
  }
  const key = (ix, iz) => ix + iz * ng.nx;
  const visited = new Uint8Array(ng.nx * ng.nz);
  const qx = new Int32Array(ng.nx * ng.nz);
  const qz = new Int32Array(ng.nx * ng.nz);
  let qh = 0;
  let qt = 0;
  qx[qt] = six;
  qz[qt] = siz;
  qt++;
  visited[key(six, siz)] = 1;
  const cs = ng.cs;
  const xMin = ng.xMin;
  const zMin = ng.zMin;
  const { x0, x1, z0, z1 } = goalBox;
  while (qh < qt) {
    const cx = qx[qh];
    const cz = qz[qh];
    qh++;
    const wx = xMin + (cx + 0.5) * cs;
    const wz = zMin + (cz + 0.5) * cs;
    if (wx >= x0 && wx <= x1 && wz >= z0 && wz <= z1) return { ok: true, cellsVisited: qh };
    const nbs = [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ];
    for (const [nx, nz] of nbs) {
      if (!_navOpen(ng, nx, nz)) continue;
      const k = key(nx, nz);
      if (visited[k]) continue;
      visited[k] = 1;
      qx[qt] = nx;
      qz[qt] = nz;
      qt++;
    }
  }
  return { ok: false, reason: 'disconnected', cellsVisited: qh };
}

export function aabbOverlap2d(a, b) {
  return a.x1 > b.x0 && a.x0 < b.x1 && a.z1 > b.z0 && a.z0 < b.z1;
}

/**
 * Zone-door approach prisms: one per door, extending from door slab toward the "front" (+spawn) side.
 * Mirrors scripts/b01-doorway-screenshot.mjs heuristics, generalized for both layout variants.
 */
export function zoneDoorApproachOverlaps(ld) {
  const out = [];
  const walls = ld.walls || [];
  const zd = ld.zoneDoors;
  if (!zd || !zd.length) return out;
  for (let i = 0; i < zd.length; i++) {
    const door = zd[i];
    const we = door && door.wallEntry;
    if (!we) continue;
    const mx = door.mesh ? door.mesh.position.x : (we.x0 + we.x1) * 0.5;
    const mz = door.mesh ? door.mesh.position.z : (we.z0 + we.z1) * 0.5;
    // Slice on the cleared side of the door slab: +Z doors open toward the front (+z);
    // −Z split doors are approached from mid zone (z greater than the door plane).
    const corridor =
      mz > 0
        ? { x0: mx - 1.8, x1: mx + 1.8, z0: mz + 0.28, z1: mz + 5.9 }
        : { x0: mx - 1.8, x1: mx + 1.8, z0: mz + 0.28, z1: mz + 6.2 };
    const overlaps = [];
    for (const w of walls) {
      if (!w || w === we || w.broken || w.isWindow) continue;
      if (aabbOverlap2d(w, corridor)) overlaps.push({ x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1 });
    }
    if (overlaps.length) out.push({ doorIndex: i, mx, mz, corridor, overlaps });
  }
  return out;
}

/**
 * Sample doorway / connector segments between space bounds centroids; require clearance discs along polyline.
 */
export function transitionCorridorSamples(ld, fp, playerR) {
  const issues = [];
  if (!fp || !fp.transitions || !fp.spaces) return issues;
  const walls = ld.walls || [];
  const R = Number.isFinite(playerR) ? playerR : AUTHORING_PLAYER_R;
  for (const [tid, tr] of Object.entries(fp.transitions)) {
    if (!tr || (tr.kind !== 'doorway' && tr.kind !== 'connector')) continue;
    if (!tr.threshold || !Number.isFinite(tr.threshold.x) || !Number.isFinite(tr.threshold.z)) continue;
    const a = fp.spaces[tr.from];
    const b = fp.spaces[tr.to];
    if (!a || !b || !a.bounds || !b.bounds) continue;
    const ax = (a.bounds.x0 + a.bounds.x1) * 0.5;
    const az = (a.bounds.z0 + a.bounds.z1) * 0.5;
    const tx = tr.threshold.x;
    const tz = tr.threshold.z;
    const bx = (b.bounds.x0 + b.bounds.x1) * 0.5;
    const bz = (b.bounds.z0 + b.bounds.z1) * 0.5;
    const steps = 10;
    const segments = [
      [ax, az, tx, tz],
      [tx, tz, bx, bz],
    ];
    let blockedAt = null;
    outer: for (const [x0, z0, x1, z1] of segments) {
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = x0 + (x1 - x0) * t;
        const pz = z0 + (z1 - z0) * t;
        if (!circleClearOfWalls(px, pz, walls, R, true)) {
          blockedAt = { px, pz, t };
          break outer;
        }
      }
    }
    if (blockedAt) issues.push({ tid, kind: tr.kind, ...blockedAt });
  }
  return issues;
}
