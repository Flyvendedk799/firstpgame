// Phase AC — extracted cover-graph helpers (pure functions).
// Most helpers here are pure with respect to runtime state: their inputs
// fully determine their outputs. navAStar keeps reusable scratch buffers on
// the nav grid to avoid per-agent typed-array churn on large authored maps.
//
// Functions intentionally NOT extracted (depend on module-level RW/RD/RH
// in main.js): _buildNavGrid, _bakeCornerEdges, _bakeCoverSlots.

// ─── Wall-AABB LOS raycast ────────────────────────────────────────────────
// Walks ax,az → bx,bz with STEP=0.18m sampling. Returns false on the first
// non-window wall whose padded AABB contains a sample. isWindow walls are
// skipped (glass passes vision + bullets per Phase B design).
export function losClear(ax, az, bx, bz, walls) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < .001) return true;
  const STEP = 0.18, PAD = 0.02;
  const steps = Math.max(2, Math.ceil(dist / STEP));
  const inv = 1 / steps;
  for (let i = 1; i < steps; i++) {
    const t = i * inv, cx = ax + dx * t, cz = az + dz * t;
    for (let wi = 0, wn = walls.length; wi < wn; wi++) {
      const w = walls[wi];
      if (w.broken) continue;
      if (w.isWindow) continue;
      if (cx >= w.x0 - PAD && cx <= w.x1 + PAD && cz >= w.z0 - PAD && cz <= w.z1 + PAD) return false;
    }
  }
  return true;
}

// ─── Floor-Y lookup ───────────────────────────────────────────────────────
// Returns the floor Y at the given XZ. Default 0; pit regions return
// negative Y; catwalks/mezzanines positive Y. When regions overlap, highest
// wins so the player stands on top of stacked platforms.
export function floorYAt(x, z, regions) {
  if (!regions || !regions.length) return 0;
  let best = 0, have = false;
  for (let i = 0, n = regions.length; i < n; i++) {
    const r = regions[i];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      if (!have || r.floorY > best) { best = r.floorY; have = true; }
    }
  }
  return have ? best : 0;
}

// ─── NavGrid cell open lookup ─────────────────────────────────────────────
export function navCellOpen(ng, x, z) {
  if (!ng) return true;
  const ix = Math.floor((x - ng.xMin) / ng.cs), iz = Math.floor((z - ng.zMin) / ng.cs);
  if (ix < 0 || iz < 0 || ix >= ng.nx || iz >= ng.nz) return false;
  return !ng.blocked[ix + iz * ng.nx];
}

// ─── _isPosClearForEnemy — XZ AABB clearance for enemy capsule (R=0.36) ──
// `broken` walls are skipped (shattered windows / degraded covers).
export function isPosClearForEnemy(x, z, walls, R) {
  for (const w of walls) {
    if (w.broken) continue;
    if (x + R > w.x0 && w.x1 > x - R && z + R > w.z0 && w.z1 > z - R) return false;
  }
  return true;
}

// ─── _navSnapOpen — find nearest open cell if start is blocked ───────────
export function navSnapOpen(ng, ix, iz) {
  const id = ix + iz * ng.nx;
  if (!ng.blocked[id]) return [ix, iz];
  const q = [[ix, iz]];
  const seen = new Uint8Array(ng.nx * ng.nz);
  seen[id] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const [cx, cz] = q[qi];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cz + dz;
      if (nx < 0 || ny < 0 || nx >= ng.nx || ny >= ng.nz) continue;
      const nid = nx + ny * ng.nx;
      if (seen[nid]) continue;
      seen[nid] = 1;
      if (!ng.blocked[nid]) return [nx, ny];
      q.push([nx, ny]);
    }
  }
  return [ix, iz];
}

// ─── _navAStar — A* on the baked grid ────────────────────────────────────
function _navAStarScratch(ng, nn) {
  let s = ng._astarScratch;
  if (!s || s.nn !== nn) {
    s = {
      nn,
      stamp: 1,
      g: new Float32Array(nn),
      came: new Int32Array(nn),
      seen: new Int32Array(nn),
      closed: new Int32Array(nn),
      heap: [],
    };
    ng._astarScratch = s;
  }
  s.stamp++;
  if (s.stamp > 0x3fffffff) {
    s.stamp = 1;
    s.seen.fill(0);
    s.closed.fill(0);
  }
  s.heap.length = 0;
  return s;
}

function _navGridLineOpen(ng, sx, sz, gx, gz) {
  const dx = gx - sx;
  const dz = gz - sz;
  const steps = Math.ceil(Math.abs(dx) + Math.abs(dz));
  if (steps <= 1) return true;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const ix = Math.round(sx + dx * t);
    const iz = Math.round(sz + dz * t);
    if (ix < 0 || iz < 0 || ix >= ng.nx || iz >= ng.nz) return false;
    if (ng.blocked[ix + iz * ng.nx]) return false;
  }
  return true;
}

export function navAStar(ng, x0, z0, x1, z1) {
  if (!ng || !ng.blocked) return null;
  const { nx, nz, cs, xMin, zMin, blocked } = ng;
  const NN = nx * nz;
  let ix0 = Math.floor((x0 - xMin) / cs) | 0, iz0 = Math.floor((z0 - zMin) / cs) | 0;
  let ix1 = Math.floor((x1 - xMin) / cs) | 0, iz1 = Math.floor((z1 - zMin) / cs) | 0;
  ix0 = Math.max(0, Math.min(nx - 1, ix0)); iz0 = Math.max(0, Math.min(nz - 1, iz0));
  ix1 = Math.max(0, Math.min(nx - 1, ix1)); iz1 = Math.max(0, Math.min(nz - 1, iz1));
  let [sx, sz] = navSnapOpen(ng, ix0, iz0);
  let [gx, gz] = navSnapOpen(ng, ix1, iz1);
  const sid = sx + sz * nx, gid = gx + gz * nx;
  if (blocked[sid] || blocked[gid]) return null;
  if (sid === gid) return [{ x: x0, z: z0 }, { x: x1, z: z1 }];
  if (_navGridLineOpen(ng, sx, sz, gx, gz)) return [{ x: x0, z: z0 }, { x: x1, z: z1 }];
  const scratch = _navAStarScratch(ng, NN);
  const stamp = scratch.stamp;
  const gScr = scratch.g;
  const came = scratch.came;
  const seen = scratch.seen;
  const closed = scratch.closed;
  const heap = scratch.heap;
  const mh = (ix, iz) => (Math.abs(ix - gx) + Math.abs(iz - gz)) * cs;
  const fScore = (id) => {
    const ix = id % nx, iz = (id / nx) | 0;
    return gScr[id] + mh(ix, iz);
  };
  const heapPush = (id) => {
    let i = heap.length;
    heap.push(id);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore(heap[p]) <= fScore(id)) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = id;
  };
  const heapPop = () => {
    const out = heap[0];
    const last = heap.pop();
    if (heap.length && last !== undefined) {
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        if (l >= heap.length) break;
        let child = l;
        if (r < heap.length && fScore(heap[r]) < fScore(heap[l])) child = r;
        if (fScore(last) <= fScore(heap[child])) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return out;
  };
  seen[sid] = stamp;
  gScr[sid] = 0;
  came[sid] = -1;
  heapPush(sid);
  while (heap.length) {
    const cid = heapPop();
    if (closed[cid] === stamp) continue;
    closed[cid] = stamp;
    if (cid === gid) break;
    const cix = cid % nx, ciz = (cid / nx) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nix = cix + dx, niz = ciz + dz;
      if (nix < 0 || niz < 0 || nix >= nx || niz >= nz) continue;
      const nid = nix + niz * nx;
      if (blocked[nid] || closed[nid] === stamp) continue;
      const tentative = gScr[cid] + cs;
      if (seen[nid] !== stamp || tentative < gScr[nid]) {
        seen[nid] = stamp;
        came[nid] = cid;
        gScr[nid] = tentative;
        heapPush(nid);
      }
    }
  }
  if (seen[gid] !== stamp || gScr[gid] > 1e8) return null;
  const path = [];
  let cur = gid;
  while (cur >= 0) {
    const cix = cur % nx, ciz = (cur / nx) | 0;
    path.push({ x: xMin + (cix + .5) * cs, z: zMin + (ciz + .5) * cs });
    if (cur === sid) break;
    cur = came[cur];
  }
  path.reverse();
  if (path.length >= 3) {
    const simp = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const a = simp[simp.length - 1], b = path[i], c = path[i + 1];
      const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
      if (cross > cs * cs * 0.04) simp.push(b);
    }
    simp.push(path[path.length - 1]);
    return simp;
  }
  return path;
}

// ─── Cover-slot risk + best-peek-slot — used by AI tactical layer ───────
export function coverSlotRisk(slot, threatPos, walls) {
  const sx = slot.x, sz = slot.z;
  const clear = losClear(sx, sz, threatPos.x, threatPos.z, walls);
  if (!clear) return 0.05;
  const tx = threatPos.x - sx, tz = threatPos.z - sz;
  const tLen = Math.max(0.001, Math.sqrt(tx * tx + tz * tz));
  const fx = slot.faceX, fz = slot.faceZ;
  const dot = (tx * fx + tz * fz) / tLen;
  return 0.55 + 0.45 * Math.max(-1, Math.min(1, dot));
}

export function getBestPeekSlot(coverSlots, agentX, agentZ, threatPos, walls, maxDist) {
  if (!coverSlots || !coverSlots.length) return null;
  const mx2 = (maxDist || 14) * (maxDist || 14);
  let best = null, bestScore = Infinity;
  for (const s of coverSlots) {
    const ddx = s.x - agentX, ddz = s.z - agentZ;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 > mx2) continue;
    if (s.claimedBy && s.claimedBy !== agentX) continue;
    const peekX = s.x + s.peekDx, peekZ = s.z + s.peekDz;
    const peekSee = losClear(peekX, peekZ, threatPos.x, threatPos.z, walls);
    if (!peekSee) continue;
    const safeSee = losClear(s.x, s.z, threatPos.x, threatPos.z, walls);
    if (safeSee) continue;
    const tx = threatPos.x - peekX, tz = threatPos.z - peekZ;
    const tLen = Math.max(0.001, Math.sqrt(tx * tx + tz * tz));
    const fx = s.faceX, fz = s.faceZ;
    const dot = (tx * fx + tz * fz) / tLen;
    const score = Math.sqrt(d2) - dot * 3.0;
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}
