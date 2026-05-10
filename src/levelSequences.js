// ─── LEVEL SEQUENCES ────────────────────────────────────────────────────────
// Layered on top of the existing buildLevel() pipeline. Each of the 8 deploy
// buildings is partitioned into 8 named sub-areas ("sequences") that subdivide
// the room into a hand-crafted single-player flow:
//
//      front zone (player spawn)            FW · FC · FE
//      middle zone (transit / brawl)        MW · ME
//      back zone   (boss approach + arena)  BW · BE · BC
//
// Wall fragments along the long axis create three lateral lanes per zone.
// Doorway gaps are sized for player + AI traversal. Spawn doors and zone
// doors are unaffected because partitions sit inside the side cells.
//
// Per-building "decorate" tables fill each cell with themed cover, props,
// hazards, and lighting. The skeleton (partition geometry + accent palette)
// is shared across buildings; everything readable as place-identity comes from
// the element data tables below. Sequence count per building: 8. Element count
// per cell: 5–8. Each element resolves to one or more meshes that are pushed
// onto the existing ob[] / wl[] / vl[] arrays so the host's nav-grid bake,
// collider list, and cleanup() pick them up automatically.

export function applySequenceLayout(ctx) {
  const { THREE, scene, ob, wl, vl, helpers, dims, materials, accent, bn, layout } = ctx;
  const def = SEQUENCE_DEFS[bn];
  if (!def) return;

  // Build the cell skeleton — partition walls + door frames around the doorway gaps.
  buildCellSkeleton(ctx);

  // Decorate each cell.
  for (const cellKey of Object.keys(def.cells)) {
    const cell = def.cells[cellKey];
    const region = CELL_REGIONS[cellKey];
    if (!region) continue;
    const seqCtx = {
      ...ctx,
      cellKey,
      cellName: cell.name,
      region,
      themeAccent: def.accent,
      themeAccentSoft: def.accentSoft,
    };
    if (cell.signage !== false) addSequencePlacard(seqCtx);
    for (const el of cell.elements) {
      const builder = ELEMENT_BUILDERS[el.t];
      if (builder) builder(seqCtx, el);
    }
  }

  // Per-building extra accent lights tuned to the theme.
  if (def.lights) for (const L of def.lights) {
    const pl = new THREE.PointLight(L.col || def.accent, L.int || 1.4, L.r || 11, 1.6);
    pl.position.set(L.x || 0, L.y != null ? L.y : (dims.RH - 0.5), L.z || 0);
    scene.add(pl); ob.push(pl);
    if (L.flicker) { pl.userData.flicker = true; pl.userData.flickerPhase = Math.random()*10; }
  }
}

// ── CELL REGIONS ───────────────────────────────────────────────────────────
// Approximate playable bounding regions for each cell. Used for placard
// placement and as a sanity reference when authoring elements.
const CELL_REGIONS = {
  FW: { x0:-18, x1:-7.5, z0: 11.0, z1: 25.5, midX:-12.5, midZ:18 },
  FC: { x0:-7.5, x1: 7.5, z0:  7.5, z1: 25.5, midX:  0,   midZ:18 },
  FE: { x0:  7.5, x1:18,  z0: 11.0, z1: 25.5, midX: 12.5, midZ:18 },
  MW: { x0:-18, x1:-11.5, z0:-7.0,  z1: 7.0,  midX:-14.5, midZ: 0 },
  ME: { x0: 11.5, x1:18,  z0:-7.0,  z1: 7.0,  midX: 14.5, midZ: 0 },
  BW: { x0:-18, x1:-8.0,  z0:-25.5, z1:-10.0, midX:-13,   midZ:-17.5 },
  BE: { x0:  8.0, x1:18,  z0:-25.5, z1:-10.0, midX: 13,   midZ:-17.5 },
  BC: { x0:-8.0, x1: 8.0, z0:-25.5, z1: -7.5, midX:  0,   midZ:-17 },
};

// ── PARTITION SKELETON ─────────────────────────────────────────────────────
function buildCellSkeleton(ctx) {
  const { THREE, scene, ob, wl, materials, dims, helpers } = ctx;
  const { RH, WT, hw } = dims;
  const dM = materials.dM;
  const postM = materials.postM;
  const trimM = materials.baseTrimM;

  // Partition walls (segments around doorway gaps).
  // FRONT lateral walls — at x=±7.5 from z=11 to z=23, doorway gap z=18..20.5
  partitionAlongZ(ctx, -7.5, 11.0, 23.0, 18.0, 20.5);
  partitionAlongZ(ctx,  7.5, 11.0, 23.0, 18.0, 20.5);
  // MIDDLE lateral walls — at x=±11.5 from z=-6 to z=6, doorway gap z=-1..1.5
  partitionAlongZ(ctx, -11.5, -6.0, 6.0, -1.5, 1.5);
  partitionAlongZ(ctx,  11.5, -6.0, 6.0, -1.5, 1.5);
  // BACK lateral walls — at x=±8 from z=-22 to z=-10, doorway gap z=-16..-13.5
  partitionAlongZ(ctx, -8.0, -22.0, -10.0, -16.0, -13.5);
  partitionAlongZ(ctx,  8.0, -22.0, -10.0, -16.0, -13.5);

  // Boss-arena "lip" — short solid fragments between BW/BE and BC at z=-22.5.
  // No doorway: visual framing for the boss arena's rear; player still has
  // open access to BC from the z=-zSplit zone door on the central spine.
  addWallSegmentX(ctx, -22.5, -8.0, -4.0, 0.55, ctx.materials.dM);
  addWallSegmentX(ctx, -22.5,  4.0,  8.0, 0.55, ctx.materials.dM);
}

// Wall along the Z axis at a given x.
function partitionAlongZ(ctx, x, z0, z1, gap0, gap1) {
  const { THREE, scene, ob, wl, materials, dims } = ctx;
  const { RH, WT } = dims;
  const dM = materials.dM, postM = materials.postM;
  const t = 0.55;
  // Segment A: z0 → gap0
  if (gap0 - z0 > 0.4) addWallSegmentZ(ctx, x, z0, gap0, t, dM);
  // Segment B: gap1 → z1
  if (z1 - gap1 > 0.4) addWallSegmentZ(ctx, x, gap1, z1, t, dM);
  // Doorway frame — two posts at gap edges + lintel
  doorwayFrameZ(ctx, x, gap0, gap1);
}
function partitionAlongX(ctx, z, x0, x1, gap0, gap1) {
  const { THREE, scene, ob, wl, materials, dims } = ctx;
  const { RH, WT } = dims;
  const dM = materials.dM;
  const t = 0.55;
  if (gap0 - x0 > 0.4) addWallSegmentX(ctx, z, x0, gap0, t, dM);
  if (x1 - gap1 > 0.4) addWallSegmentX(ctx, z, gap1, x1, t, dM);
  doorwayFrameX(ctx, z, gap0, gap1);
}
function addWallSegmentZ(ctx, x, z0, z1, t, mat) {
  const { THREE, scene, ob, wl, dims, materials } = ctx;
  const { RH, WT } = dims;
  const cz = (z0 + z1) * 0.5;
  const len = z1 - z0;
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, RH, len), mat);
  m.position.set(x, RH/2 + WT/2, cz);
  scene.add(m); ob.push(m);
  wl.push({ x0: x - t/2, x1: x + t/2, z0, z1 });
  // Top trim line
  const tm = new THREE.Mesh(new THREE.BoxGeometry(t*0.95, 0.05, len*0.96), materials.trimM);
  tm.position.set(x, RH + WT - 0.045, cz);
  scene.add(tm); ob.push(tm);
}
function addWallSegmentX(ctx, z, x0, x1, t, mat) {
  const { THREE, scene, ob, wl, dims, materials } = ctx;
  const { RH, WT } = dims;
  const cx = (x0 + x1) * 0.5;
  const len = x1 - x0;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, RH, t), mat);
  m.position.set(cx, RH/2 + WT/2, z);
  scene.add(m); ob.push(m);
  wl.push({ x0, x1, z0: z - t/2, z1: z + t/2 });
  const tm = new THREE.Mesh(new THREE.BoxGeometry(len*0.96, 0.05, t*0.95), materials.trimM);
  tm.position.set(cx, RH + WT - 0.045, z);
  scene.add(tm); ob.push(tm);
}
function doorwayFrameZ(ctx, x, gap0, gap1) {
  const { THREE, scene, ob, materials, dims } = ctx;
  const { RH, WT } = dims;
  const postM = materials.postM;
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.18, RH, 0.18), postM);
  a.position.set(x, RH/2, gap0); scene.add(a); ob.push(a);
  const b = a.clone(); b.position.z = gap1; scene.add(b); ob.push(b);
  const lin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, gap1 - gap0 + 0.18), postM);
  lin.position.set(x, RH - 0.18, (gap0+gap1)/2); scene.add(lin); ob.push(lin);
  const thr = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, gap1 - gap0), materials.trimM);
  thr.position.set(x, WT + 0.012, (gap0+gap1)/2); scene.add(thr); ob.push(thr);
}
function doorwayFrameX(ctx, z, gap0, gap1) {
  const { THREE, scene, ob, materials, dims } = ctx;
  const { RH, WT } = dims;
  const postM = materials.postM;
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.18, RH, 0.18), postM);
  a.position.set(gap0, RH/2, z); scene.add(a); ob.push(a);
  const b = a.clone(); b.position.x = gap1; scene.add(b); ob.push(b);
  const lin = new THREE.Mesh(new THREE.BoxGeometry(gap1 - gap0 + 0.18, 0.16, 0.18), postM);
  lin.position.set((gap0+gap1)/2, RH - 0.18, z); scene.add(lin); ob.push(lin);
  const thr = new THREE.Mesh(new THREE.BoxGeometry(gap1 - gap0, 0.04, 0.18), materials.trimM);
  thr.position.set((gap0+gap1)/2, WT + 0.012, z); scene.add(thr); ob.push(thr);
}

// ── PLACARD ────────────────────────────────────────────────────────────────
function addSequencePlacard(ctx) {
  const { THREE, scene, ob, region, cellName, themeAccent, dims } = ctx;
  const { WT } = dims;
  // Floor plate placard near the cell's mid — small, glowing, low.
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.04, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x101216, emissive: themeAccent || 0xffd060, emissiveIntensity: 0.55 })
  );
  plate.position.set(region.midX, WT + 0.022, region.midZ);
  plate.userData.noBlock = true;
  scene.add(plate); ob.push(plate);
  // Tiny accent strip above plate (same color, more saturated)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.03, 0.06),
    new THREE.MeshBasicMaterial({ color: themeAccent || 0xffd060 })
  );
  stripe.position.set(region.midX, WT + 0.046, region.midZ);
  stripe.userData.noBlock = true;
  scene.add(stripe); ob.push(stripe);
}

// ── ELEMENT BUILDERS ───────────────────────────────────────────────────────
const ELEMENT_BUILDERS = {

  // Generic cover: low solid block (vault-able).
  cov(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 1.4, h = e.h || 0.85, d = e.d || 0.8;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshPhongMaterial({ color: e.col || 0x4a4a52, shininess: 30, specular: 0x202428 })
    );
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    const aabb = { x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
    if (e.top) {
      const tt = new THREE.Mesh(
        new THREE.BoxGeometry(w*1.02, 0.05, d*1.02),
        new THREE.MeshLambertMaterial({ color: e.top, emissive: e.topGlow || 0x000000, emissiveIntensity: e.topGlow ? 0.4 : 0 })
      );
      tt.position.set(e.x, WT + h - 0.02, e.z);
      if (e.rotY) tt.rotation.y = e.rotY;
      scene.add(tt); ob.push(tt);
    }
  },

  // Tall cover/prop (lockers, racks, fridges, server racks). Blocking.
  tall(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 1.0, h = e.h || 2.1, d = e.d || 0.6;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshPhongMaterial({ color: e.col || 0x222428, shininess: e.shine || 60, specular: 0x303838 })
    );
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    wl.push({ x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az });
    // Optional accent stripes (shelf lines, vent slits).
    if (e.stripes) {
      const sm = new THREE.MeshLambertMaterial({ color: e.stripe || 0x60a8ff, emissive: e.stripe || 0x60a8ff, emissiveIntensity: 0.55 });
      const n = e.stripes;
      for (let i = 0; i < n; i++) {
        const fy = WT + 0.25 + i * (h - 0.4) / Math.max(1, n - 1);
        const sb = new THREE.Mesh(new THREE.BoxGeometry(w*0.85, 0.04, 0.02), sm);
        sb.position.set(e.x, fy, e.z + d*0.5 + 0.005);
        if (e.rotY) {
          const rx = Math.cos(e.rotY)*0 + Math.sin(e.rotY)*(d*0.5+0.005);
          const rz = -Math.sin(e.rotY)*0 + Math.cos(e.rotY)*(d*0.5+0.005);
          sb.position.set(e.x + rx, fy, e.z + rz); sb.rotation.y = e.rotY;
        }
        scene.add(sb); ob.push(sb);
      }
    }
  },

  // Stacked container/crates pile (3 stacked blocks, each blocking).
  stack(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const cols = e.cols || [0x6a3528, 0x335066, 0x4a4a52];
    const w = e.w || 2.4, d = e.d || 1.6, h = e.h || 1.6;
    for (let i = 0; i < 3; i++) {
      const ww = w * (1 - i*0.05), dd = d * (1 - i*0.05);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(ww, h, dd),
        new THREE.MeshPhongMaterial({ color: cols[i % cols.length], shininess: 18, specular: 0x101418 })
      );
      const ox = (i % 2 ? 0.2 : -0.15);
      m.position.set(e.x + ox, WT + h/2 + i*h, e.z);
      if (e.rotY) m.rotation.y = e.rotY;
      scene.add(m); ob.push(m);
      // Only the bottom block contributes to wall colliders so AI/player can pass through gaps above.
      if (i === 0) wl.push({ x0: e.x + ox - ww/2, x1: e.x + ox + ww/2, z0: e.z - dd/2, z1: e.z + dd/2 });
    }
    // Top accent lid — thin colored rim
    if (e.top) {
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(w*0.85, 0.05, d*0.85),
        new THREE.MeshLambertMaterial({ color: e.top, emissive: e.top, emissiveIntensity: 0.5 })
      );
      lid.position.set(e.x, WT + 3*h - 0.02, e.z);
      scene.add(lid); ob.push(lid);
    }
  },

  // Long counter/bar — a thin elongated cover line. Vault-able.
  bar(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 4.5, h = e.h || 0.95, d = e.d || 0.6;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshPhongMaterial({ color: e.col || 0x1c1c20, shininess: e.shine || 70, specular: 0x303838 })
    );
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    // Top countertop
    const tc = new THREE.Mesh(
      new THREE.BoxGeometry(w*1.04, 0.05, d*1.18),
      new THREE.MeshPhongMaterial({ color: e.top || 0x2a2a30, shininess: 120, specular: 0x808890 })
    );
    tc.position.set(e.x, WT + h, e.z);
    if (e.rotY) tc.rotation.y = e.rotY;
    scene.add(tc); ob.push(tc);
    // Accent under-glow
    if (e.glow) {
      const gM = new THREE.MeshBasicMaterial({ color: e.glow });
      const g = new THREE.Mesh(new THREE.BoxGeometry(w*0.92, 0.03, 0.04), gM);
      g.position.set(e.x, WT + 0.06, e.z + d*0.5 + 0.01);
      if (e.rotY) g.rotation.y = e.rotY;
      scene.add(g); ob.push(g);
    }
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    const aabb = { x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
  },

  // Raised platform — walkable surface + step.
  // Platform itself is at height h (0.55–0.85); player vaults onto it.
  // A short step block at h*0.5 leans against one edge as a stair-up.
  plat(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 3.0, d = e.d || 2.0, h = e.h || 0.8;
    const baseM = new THREE.MeshPhongMaterial({ color: e.col || 0x2c2e34, shininess: 50, specular: 0x303838 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseM);
    m.position.set(e.x, WT + h/2, e.z);
    scene.add(m); ob.push(m);
    const aabb = { x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
    // Top deck
    const dk = new THREE.Mesh(
      new THREE.BoxGeometry(w*1.02, 0.05, d*1.02),
      new THREE.MeshPhongMaterial({ color: e.top || 0x484a50, shininess: 70, specular: 0x4a5258 })
    );
    dk.position.set(e.x, WT + h, e.z);
    scene.add(dk); ob.push(dk);
    // Accent rim
    const rimM = new THREE.MeshBasicMaterial({ color: e.rim || 0xffd040 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w*1.04, 0.04, 0.05), rimM);
    rim.position.set(e.x, WT + h - 0.02, e.z + d*0.5 + 0.01);
    scene.add(rim); ob.push(rim);
    const rim2 = rim.clone(); rim2.position.z = e.z - d*0.5 - 0.01; scene.add(rim2); ob.push(rim2);
    // Step (vaultable as well) — sits on the side facing -z (toward exit) by default.
    if (e.step !== false) {
      const sw = e.sw || (w*0.55), sh = h*0.5, sd = 0.7;
      const sx = e.x + (e.stepX || 0);
      const sz = e.z + ((e.stepZ != null ? e.stepZ : -d*0.5 - sd*0.5 - 0.05));
      const sb = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), baseM);
      sb.position.set(sx, WT + sh/2, sz);
      scene.add(sb); ob.push(sb);
      const sa = { x0: sx - sw/2, x1: sx + sw/2, z0: sz - sd/2, z1: sz + sd/2, height: WT + sh };
      vl.push(sa); wl.push({ x0: sa.x0, x1: sa.x1, z0: sa.z0, z1: sa.z1 });
    }
  },

  // Single decorative pillar within a cell (extra vertical break).
  pil(ctx, e) {
    const { THREE, scene, ob, wl, materials, dims } = ctx;
    const { RH, WT } = dims;
    const r = e.r || 0.32;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(r*2, RH, r*2),
      new THREE.MeshPhongMaterial({ color: e.col || materials.pM.color.getHex(), shininess: 90, specular: 0x404858 })
    );
    m.position.set(e.x, RH/2 + WT/2, e.z); scene.add(m); ob.push(m);
    wl.push({ x0: e.x - r, x1: e.x + r, z0: e.z - r, z1: e.z + r });
    // Trim caps
    const tM = materials.trimM;
    const tb = new THREE.Mesh(new THREE.BoxGeometry(r*2.3, 0.06, r*2.3), tM);
    tb.position.set(e.x, WT + 0.03, e.z); scene.add(tb); ob.push(tb);
    const tt = tb.clone(); tt.position.y = RH + WT - 0.04; scene.add(tt); ob.push(tt);
  },

  // Barrel cluster.
  drum(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const cx = e.x, cz = e.z;
    const cnt = e.n || 3;
    const col = e.col || 0xb04020;
    const stripe = e.stripe || 0xfff0d0;
    const offsets = [[0,0],[0.65,0.15],[0.35,-0.6],[-0.5,0.4],[-0.45,-0.5]];
    for (let i = 0; i < cnt; i++) {
      const [ox, oz] = offsets[i % offsets.length];
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, 0.92, 12),
        new THREE.MeshPhongMaterial({ color: col, shininess: 30, specular: 0x202428 })
      );
      m.position.set(cx + ox, WT + 0.46, cz + oz);
      scene.add(m); ob.push(m);
      const sM = new THREE.MeshLambertMaterial({ color: stripe });
      const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.04, 12), sM);
      s1.position.set(cx + ox, WT + 0.30, cz + oz); scene.add(s1); ob.push(s1);
      const s2 = s1.clone(); s2.position.y = WT + 0.62; scene.add(s2); ob.push(s2);
      wl.push({ x0: cx + ox - 0.32, x1: cx + ox + 0.32, z0: cz + oz - 0.32, z1: cz + oz + 0.32 });
    }
  },

  // Bench / pew / couch — long low cover.
  bench(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 2.4, h = e.h || 0.55, d = e.d || 0.55;
    const seatM = new THREE.MeshPhongMaterial({ color: e.col || 0x4a2a1c, shininess: 40, specular: 0x202020 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), seatM);
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    if (e.back) {
      const bM = new THREE.MeshPhongMaterial({ color: e.col || 0x4a2a1c, shininess: 40 });
      const bk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.10), bM);
      const bx = e.x, bz = e.z - d*0.5 + 0.05;
      bk.position.set(bx, WT + h + 0.35, bz);
      if (e.rotY) { bk.rotation.y = e.rotY; }
      scene.add(bk); ob.push(bk);
    }
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    const aabb = { x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
  },

  // Console / desk with glowing screen — vault-able.
  console(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 1.6, h = e.h || 0.95, d = e.d || 0.7;
    const baseM = new THREE.MeshPhongMaterial({ color: e.col || 0x16181c, shininess: 80, specular: 0x303838 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseM);
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    // Tilted screen
    const scM = new THREE.MeshLambertMaterial({ color: 0x101418, emissive: e.glow || 0x40c8ff, emissiveIntensity: 0.95 });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(w*0.7, 0.42), scM);
    sc.rotation.x = -Math.PI*0.18;
    sc.position.set(e.x, WT + h + 0.10, e.z + (e.rotY ? 0 : 0));
    if (e.rotY) sc.rotation.y = e.rotY;
    scene.add(sc); ob.push(sc);
    const aabb = { x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
  },

  // Hanging emissive pendant — pure decor, doesn't block.
  pend(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { RH, WT } = dims;
    const col = e.col || 0xffd060;
    const cordM = new THREE.MeshLambertMaterial({ color: 0x101216 });
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5), cordM);
    cord.position.set(e.x, RH + WT - 0.30, e.z); scene.add(cord); ob.push(cord);
    const shadeM = new THREE.MeshPhongMaterial({ color: 0x1c1c22, shininess: 40, specular: 0x303838, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.30, 14, 1, true), shadeM);
    shade.position.set(e.x, RH + WT - 0.62, e.z); scene.add(shade); ob.push(shade);
    const bulbM = new THREE.MeshBasicMaterial({ color: col });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), bulbM);
    bulb.userData.noBlock = true;
    bulb.position.set(e.x, RH + WT - 0.78, e.z); scene.add(bulb); ob.push(bulb);
    if (e.light !== false) {
      const pl = new THREE.PointLight(col, e.int || 1.6, e.r || 7.5, 1.6);
      pl.position.set(e.x, RH + WT - 0.85, e.z); scene.add(pl); ob.push(pl);
    }
  },

  // Hazard pad — flat decal on the floor (visual only, won't block).
  haz(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 1.6, d = e.d || 1.2;
    const col = e.col || 0x202428;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: e.alpha != null ? e.alpha : 0.78, depthWrite: false })
    );
    m.rotation.x = -Math.PI/2;
    m.position.set(e.x, WT + 0.012, e.z);
    m.userData.noBlock = true;
    scene.add(m); ob.push(m);
    if (e.glow) {
      const gM = new THREE.MeshBasicMaterial({ color: e.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w*0.85, d*0.85), gM);
      g.rotation.x = -Math.PI/2;
      g.position.set(e.x, WT + 0.018, e.z);
      g.userData.noBlock = true;
      scene.add(g); ob.push(g);
    }
  },

  // Themed archway gate — visual frame defining a sub-region (non-blocking).
  arch(ctx, e) {
    const { THREE, scene, ob, materials, dims } = ctx;
    const { RH, WT } = dims;
    const w = e.w || 3.2, h = e.h || 2.4;
    const t = 0.18;
    const col = e.col || 0x1a1a22, accent = e.accent || 0xffd060;
    const m = new THREE.MeshPhongMaterial({ color: col, shininess: 90, specular: 0x303838 });
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), m);
    post1.position.set(e.x - w/2, WT + h/2, e.z); scene.add(post1); ob.push(post1);
    const post2 = post1.clone(); post2.position.x = e.x + w/2; scene.add(post2); ob.push(post2);
    const lin = new THREE.Mesh(new THREE.BoxGeometry(w + t, t, t), m);
    lin.position.set(e.x, WT + h - t/2, e.z); scene.add(lin); ob.push(lin);
    const accentM = new THREE.MeshBasicMaterial({ color: accent });
    const ac = new THREE.Mesh(new THREE.BoxGeometry(w*0.9, 0.04, t*0.6), accentM);
    ac.position.set(e.x, WT + h - 0.07, e.z); scene.add(ac); ob.push(ac);
    if (e.rotY) {
      // Rotate whole arch as a group: simpler — re-rotate each piece.
      [post1, post2, lin, ac].forEach(p => p.rotation.y = e.rotY);
    }
  },

  // Velvet rope post pair — for queue and high-class lobbies.
  rope(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0xc8a040, shininess: 200, specular: 0xffe080 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 10), m);
    post.position.set(e.x, WT + 0.475, e.z); scene.add(post); ob.push(post);
    if (e.x2 != null) {
      const post2 = post.clone(); post2.position.x = e.x2; post2.position.z = (e.z2 != null ? e.z2 : e.z); scene.add(post2); ob.push(post2);
      const dx = (e.x2 - e.x), dz = ((e.z2 != null ? e.z2 : e.z) - e.z);
      const len = Math.hypot(dx, dz);
      const ropeM = new THREE.MeshLambertMaterial({ color: e.col || 0x802020 });
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), ropeM);
      rope.position.set((e.x + e.x2)/2, WT + 0.78, (e.z + (e.z2 != null ? e.z2 : e.z))/2);
      rope.rotation.z = Math.PI/2; rope.rotation.y = -Math.atan2(dz, dx);
      scene.add(rope); ob.push(rope);
    }
  },

  // Long railing line (catwalk lip, hospital corridor rail, mezzanine).
  rail(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const len = e.len || 4.0;
    const col = e.col || 0x707880;
    const m = new THREE.MeshPhongMaterial({ color: col, shininess: 120, specular: 0x808890 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), m);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), m);
    top.position.set(e.x, WT + 1.05, e.z);
    mid.position.set(e.x, WT + 0.65, e.z);
    if (e.rotY) { top.rotation.y = e.rotY; mid.rotation.y = e.rotY; }
    scene.add(top); ob.push(top); scene.add(mid); ob.push(mid);
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 0; i <= n; i++) {
      const t = -len/2 + i*(len/n);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.05), m);
      let px = e.x + t, pz = e.z;
      if (e.rotY) { px = e.x + Math.cos(e.rotY)*t; pz = e.z + Math.sin(e.rotY)*t; }
      post.position.set(px, WT + 0.55, pz);
      scene.add(post); ob.push(post);
    }
  },

  // Curtain — soft fabric divider (visual, non-blocking, partial alpha).
  curtain(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { RH, WT } = dims;
    const w = e.w || 1.4, h = e.h || 2.2;
    const col = e.col || 0xb0a89c;
    const m = new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    const cu = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 4, 4), m);
    cu.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) cu.rotation.y = e.rotY;
    cu.userData.noBlock = true;
    scene.add(cu); ob.push(cu);
    // Rod
    const rodM = new THREE.MeshPhongMaterial({ color: 0x808890, shininess: 140 });
    const rod = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.05, 0.05), rodM);
    rod.position.set(e.x, WT + h + 0.05, e.z);
    if (e.rotY) rod.rotation.y = e.rotY;
    scene.add(rod); ob.push(rod);
  },

  // Bookshelf — tall, blocking, visually bookish. Vault-able? No, too tall. Blocks.
  shelf(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 1.6, h = e.h || 2.6, d = e.d || 0.45;
    const baseM = new THREE.MeshPhongMaterial({ color: e.col || 0x3a2412, shininess: 28, specular: 0x202020 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseM);
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    // Book strip — colorful spines on the front face
    const bookCols = [0x8a3030, 0x305c8a, 0x6a5030, 0x305a30, 0x6a3060, 0x282828, 0x9a8030];
    for (let row = 0; row < 4; row++) {
      const stripM = new THREE.MeshLambertMaterial({ color: bookCols[(row*3) % bookCols.length] });
      const fy = WT + 0.35 + row * (h - 0.7) / 3;
      const sb = new THREE.Mesh(new THREE.BoxGeometry(w*0.92, 0.36, 0.05), stripM);
      sb.position.set(e.x, fy, e.z + d*0.5 + 0.025);
      if (e.rotY) sb.rotation.y = e.rotY;
      scene.add(sb); ob.push(sb);
    }
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    wl.push({ x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az });
  },

  // Server rack (B8) — tall, blocking, with running LED rows.
  rack(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 0.85, h = e.h || 2.6, d = e.d || 1.05;
    const base = new THREE.MeshPhongMaterial({ color: 0x0c0e14, shininess: 50, specular: 0x202830 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), base);
    m.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) m.rotation.y = e.rotY;
    scene.add(m); ob.push(m);
    // LED strip rows on the front
    const accent = e.accent || 0x40e0ff;
    for (let r = 0; r < 6; r++) {
      const ledM = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 + Math.random()*0.35 });
      const fy = WT + 0.30 + r * (h - 0.6) / 5;
      const sb = new THREE.Mesh(new THREE.BoxGeometry(w*0.8, 0.04, 0.02), ledM);
      sb.position.set(e.x, fy, e.z + d*0.5 + 0.012);
      if (e.rotY) sb.rotation.y = e.rotY;
      scene.add(sb); ob.push(sb);
    }
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    wl.push({ x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az });
  },

  // Patient bed (B5) — a low frame with a pillow strip, vault-able.
  bed(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = 1.0, d = 2.1, h = 0.75;
    const fr = new THREE.MeshPhongMaterial({ color: 0xb8bcc4, shininess: 120, specular: 0x808890 });
    const mat = new THREE.MeshLambertMaterial({ color: 0xe8eaee });
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fr);
    base.position.set(e.x, WT + h/2, e.z); scene.add(base); ob.push(base);
    if (e.rotY) base.rotation.y = e.rotY;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w*0.92, 0.15, d*0.96), mat);
    top.position.set(e.x, WT + h + 0.05, e.z); scene.add(top); ob.push(top);
    if (e.rotY) top.rotation.y = e.rotY;
    const head = new THREE.Mesh(new THREE.BoxGeometry(w*0.92, 0.32, 0.32), mat);
    head.position.set(e.x, WT + h + 0.20, e.z + d*0.5 - 0.20);
    if (e.rotY) { head.rotation.y = e.rotY; }
    scene.add(head); ob.push(head);
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    const aabb = { x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
  },

  // Pipe bundle along ceiling (B6, B1) — pure decoration, non-blocking.
  pipes(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { RH, WT } = dims;
    const len = e.len || 6.0;
    const col = e.col || 0x6a6e74;
    const pM = new THREE.MeshPhongMaterial({ color: col, shininess: 80, specular: 0x808890 });
    for (let i = 0; i < 3; i++) {
      const r = 0.10 + i*0.02;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), pM);
      p.rotation.z = Math.PI/2;
      p.position.set(e.x + (i-1)*0.32, RH + WT - 0.30 - i*0.10, e.z);
      if (e.rotY) p.rotation.y = e.rotY;
      p.userData.noBlock = true;
      scene.add(p); ob.push(p);
    }
  },

  // Thin vertical mirror panel (B3, B4) — additive shimmer, non-blocking.
  mirror(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 1.6, h = e.h || 2.4;
    const m = new THREE.MeshBasicMaterial({ color: e.col || 0xa8c8e0, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    pl.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) pl.rotation.y = e.rotY;
    pl.userData.noBlock = true;
    scene.add(pl); ob.push(pl);
    // Frame
    const fr = new THREE.MeshPhongMaterial({ color: 0x282830, shininess: 120, specular: 0x808890 });
    const fT = 0.06;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(w + fT*2, fT, fT), fr);
    t1.position.set(e.x, WT + h, e.z); if (e.rotY) t1.rotation.y = e.rotY; scene.add(t1); ob.push(t1);
    const t2 = t1.clone(); t2.position.y = WT; scene.add(t2); ob.push(t2);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(fT, h + fT*2, fT), fr);
    s1.position.set(e.x - w/2, WT + h/2, e.z); if (e.rotY) s1.rotation.y = e.rotY; scene.add(s1); ob.push(s1);
    const s2 = s1.clone(); s2.position.x = e.x + w/2; scene.add(s2); ob.push(s2);
  },

  // Plinth + bust (B2, B4, B11 stylized)
  plinth(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: e.col || 0xc8b88a, shininess: 90, specular: 0xffe0a0 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.05, 0.65), m);
    base.position.set(e.x, WT + 0.525, e.z); scene.add(base); ob.push(base);
    const bust = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), m);
    bust.position.set(e.x, WT + 1.30, e.z); scene.add(bust); ob.push(bust);
    wl.push({ x0: e.x - 0.34, x1: e.x + 0.34, z0: e.z - 0.34, z1: e.z + 0.34 });
  },

  // Glass partition (B4 office, B5 ICU window) — blocks (full height) but reads thin.
  glass(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { RH, WT } = dims;
    const len = e.len || 3.0;
    const m = new THREE.MeshPhysicalMaterial ?
      new THREE.MeshPhongMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.30, shininess: 200, specular: 0xffffff }) :
      new THREE.MeshPhongMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.30, shininess: 200, specular: 0xffffff });
    const pane = new THREE.Mesh(new THREE.BoxGeometry(len, RH - 0.4, 0.06), m);
    pane.position.set(e.x, RH/2 + WT/2, e.z);
    if (e.rotY) pane.rotation.y = e.rotY;
    scene.add(pane); ob.push(pane);
    const frM = new THREE.MeshPhongMaterial({ color: 0x282830, shininess: 90, specular: 0x808890 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.10, 0.10), frM);
    top.position.set(e.x, RH + WT - 0.20, e.z);
    if (e.rotY) top.rotation.y = e.rotY;
    scene.add(top); ob.push(top);
    const bot = top.clone(); bot.position.y = WT + 0.10; scene.add(bot); ob.push(bot);
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*len/2 + Math.abs(s)*0.04;
    const az = Math.abs(s)*len/2 + Math.abs(c)*0.04;
    wl.push({ x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az });
  },

  // Speaker stack (B3) — tall thin rectangles with a glow strip.
  speaker(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = 0.85, d = 0.85, h = 2.4;
    const m = new THREE.MeshPhongMaterial({ color: 0x14141a, shininess: 60 });
    for (let i = 0; i < 2; i++) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.5 - 0.05, d), m);
      cab.position.set(e.x, WT + (h*0.25) + i * (h*0.5), e.z);
      scene.add(cab); ob.push(cab);
      // Cone face
      const cMa = new THREE.MeshLambertMaterial({ color: 0x0a0a0c });
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.30, 16), cMa);
      cone.rotation.y = Math.PI/2;
      cone.position.set(e.x + d*0.5 + 0.005, WT + (h*0.25) + i * (h*0.5), e.z);
      cone.userData.noBlock = true;
      scene.add(cone); ob.push(cone);
    }
    // Glow strip up the side
    const gM = new THREE.MeshBasicMaterial({ color: e.col || 0xff40c8 });
    const gs = new THREE.Mesh(new THREE.BoxGeometry(0.03, h*0.95, 0.03), gM);
    gs.position.set(e.x - w*0.5 - 0.015, WT + h/2, e.z); scene.add(gs); ob.push(gs);
    wl.push({ x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2 });
  },

  // Container (shipping container, B1).
  container(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 4.2, h = 2.5, d = e.d || 1.9;
    const col = e.col || 0x8a3a2a;
    const m = new THREE.MeshPhongMaterial({ color: col, shininess: 14, specular: 0x101418 });
    const m2 = new THREE.MeshPhongMaterial({ color: 0x14161a, shininess: 30 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    body.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) body.rotation.y = e.rotY;
    scene.add(body); ob.push(body);
    // Doors (rear)
    const dr = new THREE.Mesh(new THREE.BoxGeometry(w*0.96, h*0.94, 0.04), m2);
    dr.position.set(e.x, WT + h/2, e.z + d*0.5 + 0.025);
    if (e.rotY) dr.rotation.y = e.rotY;
    scene.add(dr); ob.push(dr);
    // Corrugated rib stripes
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, h*0.94, d*1.02),
        new THREE.MeshPhongMaterial({ color: col, shininess: 18 }));
      rib.position.set(e.x - w*0.4 + i*(w*0.16), WT + h/2, e.z);
      if (e.rotY) rib.rotation.y = e.rotY;
      scene.add(rib); ob.push(rib);
    }
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*w/2 + Math.abs(s)*d/2;
    const az = Math.abs(s)*w/2 + Math.abs(c)*d/2;
    wl.push({ x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az });
  },

  // Forklift wreck (B1) — irregular silhouette, blocking.
  forklift(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0xbb7a18, shininess: 28, specular: 0x202020 });
    const m2 = new THREE.MeshPhongMaterial({ color: 0x161616, shininess: 80 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.05, 1.9), m);
    body.position.set(e.x, WT + 0.55, e.z);
    if (e.rotY) body.rotation.y = e.rotY;
    scene.add(body); ob.push(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 1.0), m);
    cab.position.set(e.x, WT + 1.65, e.z - 0.25);
    if (e.rotY) cab.rotation.y = e.rotY;
    scene.add(cab); ob.push(cab);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.9), m2);
    fork.position.set(e.x, WT + 0.10, e.z + 1.2);
    if (e.rotY) fork.rotation.y = e.rotY;
    scene.add(fork); ob.push(fork);
    const s = Math.sin(e.rotY||0), c = Math.cos(e.rotY||0);
    const ax = Math.abs(c)*1.4/2 + Math.abs(s)*2.0/2;
    const az = Math.abs(s)*1.4/2 + Math.abs(c)*2.0/2;
    wl.push({ x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az });
  },

  // Floor lamp / standing light (B2, B7 cabin) — accent + slight glow.
  lamp(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const stand = new THREE.MeshPhongMaterial({ color: 0x141416, shininess: 80 });
    const shade = new THREE.MeshPhongMaterial({ color: 0xffe0a0, emissive: 0x6a4810, emissiveIntensity: 0.45, shininess: 30 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 8), stand);
    pole.position.set(e.x, WT + 0.85, e.z); scene.add(pole); ob.push(pole);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.36, 14, 1, true), shade);
    cap.position.set(e.x, WT + 1.78, e.z); scene.add(cap); ob.push(cap);
    if (e.light !== false) {
      const pl = new THREE.PointLight(e.col || 0xffd070, 1.3, 6.2);
      pl.position.set(e.x, WT + 1.4, e.z); scene.add(pl); ob.push(pl);
    }
  },

  // Ticket gate (B6) — turnstile silhouette, blocks center.
  gate(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0x808890, shininess: 200, specular: 0xa0a8b0 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.10, 0.55), m);
    post.position.set(e.x, WT + 0.55, e.z); scene.add(post); ob.push(post);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.45), m);
      arm.rotation.z = i * (Math.PI*2/3);
      arm.position.set(e.x, WT + 0.85, e.z + 0.30);
      scene.add(arm); ob.push(arm);
    }
    wl.push({ x0: e.x - 0.20, x1: e.x + 0.20, z0: e.z - 0.30, z1: e.z + 0.30 });
  },

  // Banner / hanging cloth (B11/B2 ceremonial) — large vertical drop.
  banner(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { RH, WT } = dims;
    const m = new THREE.MeshLambertMaterial({ color: e.col || 0x6a1212, side: THREE.DoubleSide });
    const w = e.w || 0.85, h = e.h || 2.6;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    b.position.set(e.x, RH + WT - 0.5 - h/2, e.z);
    if (e.rotY) b.rotation.y = e.rotY;
    b.userData.noBlock = true;
    scene.add(b); ob.push(b);
    // Trim strips on edges
    const trM = new THREE.MeshLambertMaterial({ color: e.trim || 0xc8a040 });
    const tt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.05, 0.04), trM);
    tt.position.set(e.x, RH + WT - 0.5, e.z); if (e.rotY) tt.rotation.y = e.rotY; scene.add(tt); ob.push(tt);
  },

  // Toolbox / wheeled cart (B1, B5, B10) — small low cover.
  cart(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = 0.95, d = 0.55, h = 0.9;
    const m = new THREE.MeshPhongMaterial({ color: e.col || 0xc83020, shininess: 60, specular: 0x303838 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    body.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) body.rotation.y = e.rotY;
    scene.add(body); ob.push(body);
    // Top tray
    const tr = new THREE.Mesh(new THREE.BoxGeometry(w*1.05, 0.05, d*1.05),
      new THREE.MeshPhongMaterial({ color: 0x14161a, shininess: 90 }));
    tr.position.set(e.x, WT + h + 0.025, e.z);
    if (e.rotY) tr.rotation.y = e.rotY;
    scene.add(tr); ob.push(tr);
    const aabb = { x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2, height: WT + h };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
  },

  // Vending machine / fridge / minibar (B2, B5, B6) — tall slim cover.
  vend(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = 0.90, h = 2.0, d = 0.75;
    const baseM = new THREE.MeshPhongMaterial({ color: e.col || 0x8a2020, shininess: 60, specular: 0x303838 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseM);
    body.position.set(e.x, WT + h/2, e.z);
    if (e.rotY) body.rotation.y = e.rotY;
    scene.add(body); ob.push(body);
    // Display window
    const winM = new THREE.MeshLambertMaterial({ color: 0x0a0a0e, emissive: 0x60a0d0, emissiveIntensity: 0.55 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w*0.7, h*0.55), winM);
    win.position.set(e.x, WT + h*0.55, e.z + d*0.5 + 0.005);
    if (e.rotY) win.rotation.y = e.rotY;
    scene.add(win); ob.push(win);
    wl.push({ x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2 });
  },

  // Helm / control wheel (B7) — small focal prop.
  helm(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0x6a4818, shininess: 90, specular: 0xffe0a0 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.05, 10), m);
    post.position.set(e.x, WT + 0.525, e.z); scene.add(post); ob.push(post);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.04, 8, 16), m);
    wheel.position.set(e.x, WT + 1.10, e.z);
    wheel.rotation.y = Math.PI/2;
    scene.add(wheel); ob.push(wheel);
    wl.push({ x0: e.x - 0.4, x1: e.x + 0.4, z0: e.z - 0.18, z1: e.z + 0.18 });
  },

  // Crate column (B7, B1) — single tall crate stack of 2.
  crate2(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const w = 1.0, d = 1.0, h = 1.0;
    const m = new THREE.MeshPhongMaterial({ color: e.col || 0x6a4830, shininess: 24, specular: 0x202020 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    a.position.set(e.x, WT + h/2, e.z); scene.add(a); ob.push(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w*0.92, h*0.9, d*0.92), m);
    b.position.set(e.x + 0.1, WT + h*1.45, e.z - 0.05); scene.add(b); ob.push(b);
    wl.push({ x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2 });
    vl.push({ x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2, height: WT + h });
  },

  // Cooling unit (B8) — wide, short, blocking with vent fan visual.
  ac(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const w = 2.4, h = 1.5, d = 1.1;
    const baseM = new THREE.MeshPhongMaterial({ color: 0x202428, shininess: 80, specular: 0x404858 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseM);
    body.position.set(e.x, WT + h/2, e.z); scene.add(body); ob.push(body);
    // Fan grille
    const grM = new THREE.MeshPhongMaterial({ color: 0x14161a, shininess: 100 });
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), grM);
    fan.rotation.x = -Math.PI/2;
    fan.position.set(e.x, WT + h + 0.005, e.z);
    fan.userData.noBlock = true;
    scene.add(fan); ob.push(fan);
    wl.push({ x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2 });
  },

  // Operating-table centerpiece (B5 boss arena).
  optable(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0xb8c0c8, shininess: 180, specular: 0xffffff });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.10, 2.0), m);
    top.position.set(e.x, WT + 0.85, e.z); scene.add(top); ob.push(top);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 0.85, 8), m);
    stem.position.set(e.x, WT + 0.425, e.z); scene.add(stem); ob.push(stem);
    // Surgical light fixture
    const lM = new THREE.MeshPhongMaterial({ color: 0xe8e8e8, emissive: 0xe0f0ff, emissiveIntensity: 0.85, shininess: 200 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), lM);
    dome.position.set(e.x, WT + 2.6, e.z);
    dome.userData.noBlock = true;
    scene.add(dome); ob.push(dome);
    const pl = new THREE.PointLight(0xffffff, 2.2, 8.0, 1.6);
    pl.position.set(e.x, WT + 2.0, e.z); scene.add(pl); ob.push(pl);
    const aabb = { x0: e.x - 0.45, x1: e.x + 0.45, z0: e.z - 1.0, z1: e.z + 1.0, height: WT + 0.95 };
    vl.push(aabb); wl.push({ x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1 });
  },

  // Gazebo / pavilion centerpiece (B7 boss/lounge).
  pavilion(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0x6a4818, shininess: 90, specular: 0xffe0a0 });
    const r = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI/2 + Math.PI/4;
      const px = e.x + Math.cos(a)*r, pz = e.z + Math.sin(a)*r;
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), m);
      pole.position.set(px, WT + 1.3, pz); scene.add(pole); ob.push(pole);
      wl.push({ x0: px - 0.10, x1: px + 0.10, z0: pz - 0.10, z1: pz + 0.10 });
    }
    // Canopy
    const can = new THREE.Mesh(new THREE.ConeGeometry(2.4, 0.7, 4),
      new THREE.MeshLambertMaterial({ color: 0xc0a070 }));
    can.position.set(e.x, WT + 2.95, e.z);
    can.rotation.y = Math.PI/4;
    can.userData.noBlock = true;
    scene.add(can); ob.push(can);
  },

  // Catwalk segment (B1) — overhead beams (decor only, non-blocking).
  catwalk(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { RH, WT } = dims;
    const len = e.len || 8.0;
    const m = new THREE.MeshPhongMaterial({ color: 0x404448, shininess: 60, specular: 0x202428 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.20, 1.2), m);
    beam.position.set(e.x, RH + WT - 0.55, e.z);
    if (e.rotY) beam.rotation.y = e.rotY;
    beam.userData.noBlock = true;
    scene.add(beam); ob.push(beam);
    // Mesh underside
    const um = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    um.rotation.x = Math.PI/2;
    um.position.set(e.x, RH + WT - 0.65, e.z);
    if (e.rotY) um.rotation.y = e.rotY;
    um.userData.noBlock = true;
    scene.add(um); ob.push(um);
    // Side rails (visual)
    const rl = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), m);
    rl.position.set(e.x, RH + WT - 0.20, e.z + 0.55);
    if (e.rotY) rl.rotation.y = e.rotY;
    rl.userData.noBlock = true;
    scene.add(rl); ob.push(rl);
    const rl2 = rl.clone(); rl2.position.z = e.z - 0.55; scene.add(rl2); ob.push(rl2);
  },

  // Track segment (B6) — visual rail line on the floor.
  track(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const len = e.len || 8.0;
    const railM = new THREE.MeshPhongMaterial({ color: 0xa8a8b0, shininess: 220, specular: 0xffffff });
    const tieM = new THREE.MeshLambertMaterial({ color: 0x4a3618 });
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.10), railM);
    r1.position.set(e.x, WT + 0.04, e.z + 0.55);
    if (e.rotY) r1.rotation.y = e.rotY;
    r1.userData.noBlock = true;
    scene.add(r1); ob.push(r1);
    const r2 = r1.clone(); r2.position.z = e.z - 0.55; scene.add(r2); ob.push(r2);
    const n = Math.round(len / 0.6);
    for (let i = 0; i < n; i++) {
      const t = -len/2 + (i + 0.5)*(len/n);
      const ti = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 1.4), tieM);
      let tx = e.x + t, tz = e.z;
      if (e.rotY) { tx = e.x + Math.cos(e.rotY)*t; tz = e.z + Math.sin(e.rotY)*t; }
      ti.position.set(tx, WT + 0.025, tz);
      if (e.rotY) ti.rotation.y = e.rotY;
      ti.userData.noBlock = true;
      scene.add(ti); ob.push(ti);
    }
    // Third rail glow strip
    if (e.live) {
      const tM = new THREE.MeshBasicMaterial({ color: 0xff5040 });
      const t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), tM);
      t.position.set(e.x, WT + 0.10, e.z + 0.85);
      if (e.rotY) t.rotation.y = e.rotY;
      t.userData.noBlock = true;
      scene.add(t); ob.push(t);
    }
  },

  // Reception desk wraparound (B2, B7) — L-shape via two bars.
  desk(ctx, e) {
    ELEMENT_BUILDERS.bar(ctx, { ...e, w: 3.4, d: 0.7, h: 1.05, top: 0xc8a040, glow: e.glow });
    ELEMENT_BUILDERS.bar(ctx, { ...e, x: e.x + (e.lx || 1.55), z: e.z + (e.lz || 1.20), w: 0.7, d: 1.8, h: 1.05, rotY: 0, top: 0xc8a040, glow: e.glow });
  },

  // Two-tile dance floor (B3) — emissive floor decals (non-blocking).
  dancefloor(ctx, e) {
    const { THREE, scene, ob, dims } = ctx;
    const { WT } = dims;
    const w = e.w || 5.0, d = e.d || 5.0;
    const cols = [0xff40c8, 0x40c8ff, 0xa040ff, 0x40e0a0];
    const cell = 1.0;
    const nx = Math.floor(w / cell), nz = Math.floor(d / cell);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = e.x - w/2 + (i + 0.5)*cell;
        const cz = e.z - d/2 + (j + 0.5)*cell;
        const c = cols[(i + j*2) % cols.length];
        const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8 + Math.random()*0.15, depthWrite: false, blending: THREE.AdditiveBlending });
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(cell*0.92, cell*0.92), m);
        tile.rotation.x = -Math.PI/2;
        tile.position.set(cx, WT + 0.014 + (i+j)*0.0008, cz);
        tile.userData.noBlock = true;
        scene.add(tile); ob.push(tile);
      }
    }
  },

  // Wreathed columns / file spine (B9-style stacked record bins) — used as MW/ME divider when desired.
  // Adds two short columns flanking a passage.
  spine(ctx, e) {
    ELEMENT_BUILDERS.shelf(ctx, { x: e.x - 0.95, z: e.z, w: 1.6, h: 2.6, d: 0.45, col: e.col });
    ELEMENT_BUILDERS.shelf(ctx, { x: e.x + 0.95, z: e.z, w: 1.6, h: 2.6, d: 0.45, col: e.col });
  },

  // Subway turnstile pair via two `gate` calls.
  turnstiles(ctx, e) {
    ELEMENT_BUILDERS.gate(ctx, { x: e.x - 0.9, z: e.z });
    ELEMENT_BUILDERS.gate(ctx, { x: e.x + 0.9, z: e.z });
  },

  // Battery cabinet rows (B8) — heavy banks in the back wing.
  battery(ctx, e) {
    ELEMENT_BUILDERS.tall(ctx, { ...e, w: 1.3, h: 1.7, d: 1.0, col: 0x14161a, stripes: 3, stripe: 0x40e0ff });
  },

  // Server farm hot-aisle gantry (B8) — overhead pipes painted.
  hotaisle(ctx, e) {
    ELEMENT_BUILDERS.pipes(ctx, { ...e, col: 0x4a3018, len: 7 });
  },

  // Privacy curtain row (B5) — three curtains in a line.
  curtainrow(ctx, e) {
    for (let i = 0; i < 3; i++) {
      ELEMENT_BUILDERS.curtain(ctx, { x: e.x, z: e.z + (i - 1)*1.8, w: 1.5, h: 2.0, col: 0xc8d0d8, rotY: e.rotY });
    }
  },

  // Bookshelf row (B2 library wing).
  shelfrow(ctx, e) {
    for (let i = 0; i < 3; i++) {
      ELEMENT_BUILDERS.shelf(ctx, { x: e.x + (i - 1)*1.9, z: e.z, w: 1.6, h: 2.6, d: 0.45, col: e.col });
    }
  },

  // Aisle of server racks (B8) — long row of `rack` prims forming a corridor wall.
  rackaisle(ctx, e) {
    for (let i = 0; i < 5; i++) {
      ELEMENT_BUILDERS.rack(ctx, { x: e.x, z: e.z - 4 + i*2, accent: e.accent });
    }
  },

  // Subway bench row (B6).
  benchrow(ctx, e) {
    for (let i = 0; i < 3; i++) {
      ELEMENT_BUILDERS.bench(ctx, { x: e.x, z: e.z + (i - 1)*2.4, w: 1.6, d: 0.5, h: 0.5, col: 0x4a3a20, back: true });
    }
  },

  // Container row (B1) — three large containers in line.
  containerrow(ctx, e) {
    const cols = e.cols || [0x8a3a2a, 0x335066, 0x4a4630];
    for (let i = 0; i < 3; i++) {
      ELEMENT_BUILDERS.container(ctx, { x: e.x + (i - 1)*4.6, z: e.z, col: cols[i], w: 4.2, d: 1.9 });
    }
  },

  // Mirror wall (B3) — three vertical mirror panels.
  mirrorwall(ctx, e) {
    for (let i = 0; i < 3; i++) {
      ELEMENT_BUILDERS.mirror(ctx, { x: e.x + (i - 1)*1.65, z: e.z, w: 1.5, h: 2.6, rotY: e.rotY, col: e.col || 0xff80c8 });
    }
  },

  // Plinth row (B4 art gallery).
  plinthrow(ctx, e) {
    for (let i = 0; i < 3; i++) {
      ELEMENT_BUILDERS.plinth(ctx, { x: e.x + (i - 1)*1.8, z: e.z });
    }
  },

  // Booth — cushioned table (B3 VIP).
  booth(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    // Curved bench (3 segments)
    const m = new THREE.MeshPhongMaterial({ color: e.col || 0x6a1838, shininess: 30, specular: 0x202020 });
    const seg = (sx, sz, w, d) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), m);
      b.position.set(sx, WT + 0.275, sz); scene.add(b); ob.push(b);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, 0.10), m);
      bk.position.set(sx, WT + 0.825, sz - d*0.5);
      scene.add(bk); ob.push(bk);
      vl.push({ x0: sx - w/2, x1: sx + w/2, z0: sz - d/2, z1: sz + d/2, height: WT + 0.55 });
      wl.push({ x0: sx - w/2, x1: sx + w/2, z0: sz - d/2, z1: sz + d/2 });
    };
    seg(e.x, e.z, 2.2, 0.6);
    seg(e.x - 1.0, e.z + 0.6, 0.6, 0.8);
    seg(e.x + 1.0, e.z + 0.6, 0.6, 0.8);
    // Round table center
    const tab = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14),
      new THREE.MeshPhongMaterial({ color: 0x141416, shininess: 120, specular: 0x808890 }));
    tab.position.set(e.x, WT + 0.78, e.z + 0.85); scene.add(tab); ob.push(tab);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.78, 8),
      new THREE.MeshPhongMaterial({ color: 0x14161a, shininess: 200 }));
    stem.position.set(e.x, WT + 0.39, e.z + 0.85); scene.add(stem); ob.push(stem);
  },

  // Statue / centerpiece (B11 Skycourt — recycled for boss arena flair on B4/B2).
  statue(ctx, e) {
    const { THREE, scene, ob, wl, dims } = ctx;
    const { WT } = dims;
    const m = new THREE.MeshPhongMaterial({ color: 0xc8b88a, shininess: 90, specular: 0xffe0a0 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.0), m);
    base.position.set(e.x, WT + 0.30, e.z); scene.add(base); ob.push(base);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.05, 0.45), m);
    torso.position.set(e.x, WT + 1.13, e.z); scene.add(torso); ob.push(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), m);
    head.position.set(e.x, WT + 1.93, e.z); scene.add(head); ob.push(head);
    wl.push({ x0: e.x - 0.55, x1: e.x + 0.55, z0: e.z - 0.55, z1: e.z + 0.55 });
  },
};

// ── PER-BUILDING SEQUENCE TABLES ───────────────────────────────────────────
// Each entry maps a cell (FW…BC) to:
//   - name: sequence name (drives placard text in future iterations)
//   - elements: array of { t: <builder key>, ...args }
// Authored to express building identity through shape, prop choice, accent.

const SEQUENCE_DEFS = {

  // ── 1: LOADING DOCK — Industrial decay, container yard, oily concrete ──
  1: {
    accent: 0xff7a30, accentSoft: 0xff9a40,
    cells: {
      FW: { name: 'Receiving Bay', elements: [
        { t: 'container', x: -14, z: 21, w: 4.2, d: 1.9, col: 0x8a3a2a },
        { t: 'container', x: -10, z: 14.5, w: 4.2, d: 1.9, col: 0x335066, rotY: Math.PI/2 },
        { t: 'forklift', x: -13, z: 17, rotY: -0.6 },
        { t: 'cov', x: -16, z: 19, w: 1.4, h: 0.85, d: 0.8, col: 0x4a4a52, top: 0xfff0c8 },
        { t: 'pend', x: -12.5, z: 18, col: 0xff7a30, int: 1.6, r: 7.5 },
        { t: 'haz', x: -11, z: 20.5, w: 2.2, d: 1.4, col: 0x101010, alpha: 0.85 },
      ]},
      FC: { name: 'Gate Court', elements: [
        { t: 'cov', x: -3, z: 22, w: 2.0, h: 0.9, d: 0.9, col: 0x42342a, top: 0xfff0d0 },
        { t: 'cov', x: 3, z: 22, w: 2.0, h: 0.9, d: 0.9, col: 0x42342a, top: 0xfff0d0 },
        { t: 'drum', x: -2, z: 16, n: 3, col: 0xc04830, stripe: 0xfff0d0 },
        { t: 'drum', x: 3, z: 13, n: 3, col: 0xc04830, stripe: 0xfff0d0 },
        { t: 'pend', x: 0, z: 17, col: 0xff7a30, int: 1.6, r: 8 },
        { t: 'pipes', x: 0, z: 23.5, len: 7 },
      ]},
      FE: { name: 'Forklift Garage', elements: [
        { t: 'forklift', x: 12, z: 17.5, rotY: 0.4 },
        { t: 'cart', x: 14.5, z: 19, col: 0xc83020 },
        { t: 'cart', x: 10, z: 21, col: 0xc8a020, rotY: 0.5 },
        { t: 'stack', x: 13.5, z: 14, w: 2.6, d: 1.4, h: 1.2, cols: [0x6a4830, 0x6a4830, 0x6a4830] },
        { t: 'pend', x: 12.5, z: 18, col: 0xff7a30 },
        { t: 'hotaisle', x: 14, z: 22 },
      ]},
      MW: { name: 'Manifest Office', elements: [
        { t: 'desk', x: -14, z: 0, lx: 1.55, lz: 1.20 },
        { t: 'tall', x: -16, z: -4, w: 0.85, h: 2.0, d: 0.55, col: 0x14161a, stripes: 3, stripe: 0xc8a040 },
        { t: 'tall', x: -16, z: 4, w: 0.85, h: 2.0, d: 0.55, col: 0x14161a, stripes: 3, stripe: 0xc8a040 },
        { t: 'console', x: -14, z: 4.5, w: 1.6, h: 0.95, d: 0.7, col: 0x14161a, glow: 0x40c8ff },
        { t: 'pend', x: -14, z: 0, col: 0xa8c8ff, int: 1.4, r: 6 },
      ]},
      ME: { name: 'Drum Cache', elements: [
        { t: 'drum', x: 14, z: -2, n: 4, col: 0xb84020, stripe: 0xfff0d0 },
        { t: 'drum', x: 16, z: 3, n: 3, col: 0xb84020, stripe: 0xfff0d0 },
        { t: 'cov', x: 13, z: 4, w: 2.2, h: 0.85, d: 0.8, col: 0x6a5e3a, top: 0xfff0c8 },
        { t: 'haz', x: 14.5, z: 0, w: 2.0, d: 1.4, col: 0x14140a, alpha: 0.85, glow: 0xff5040 },
        { t: 'pend', x: 14.5, z: 1, col: 0xff5040, int: 1.5 },
      ]},
      BW: { name: 'Service Vent Loop', elements: [
        { t: 'tall', x: -16, z: -14, w: 0.85, h: 2.4, d: 0.4, col: 0x202428 },
        { t: 'tall', x: -16, z: -19, w: 0.85, h: 2.4, d: 0.4, col: 0x202428 },
        { t: 'pipes', x: -13, z: -17, len: 7 },
        { t: 'cov', x: -13, z: -20, w: 2.0, h: 0.85, d: 0.8, col: 0x42342a, top: 0xfff0d0 },
        { t: 'pend', x: -13, z: -16, col: 0x80f0c8, int: 1.4 },
      ]},
      BE: { name: 'Catwalk Spine', elements: [
        { t: 'plat', x: 14, z: -18, w: 4.0, d: 2.4, h: 0.85, col: 0x2a2c30, top: 0x60686e, rim: 0xff7a30 },
        { t: 'rail', x: 14, z: -16.7, len: 4.0, col: 0xa0a8b0 },
        { t: 'catwalk', x: 13, z: -22, len: 8, rotY: Math.PI/2 },
        { t: 'crate2', x: 16, z: -14, col: 0x6a4830 },
        { t: 'pend', x: 13.5, z: -14, col: 0xff7a30 },
      ]},
      BC: { name: 'Relay Cage', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.2, h: 2.6, col: 0x14161a, accent: 0xff7a30 },
        { t: 'tall', x: -3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x202428, stripes: 4, stripe: 0xff7a30 },
        { t: 'tall', x: 3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x202428, stripes: 4, stripe: 0xff7a30 },
        { t: 'cov', x: -4, z: -14, w: 1.8, h: 0.9, d: 0.9, col: 0x6c5e3a, top: 0xfff0c8 },
        { t: 'cov', x: 4, z: -14, w: 1.8, h: 0.9, d: 0.9, col: 0x6c5e3a, top: 0xfff0c8 },
        { t: 'pend', x: 0, z: -17, col: 0xff7a30, int: 2.4, r: 12 },
        { t: 'haz', x: 0, z: -22, w: 4.0, d: 1.6, col: 0x06060a, alpha: 0.9, glow: 0xff7a30 },
      ]},
    },
    lights: [
      { x: -14.5, y: 3.6, z: 18, col: 0xff9a40, int: 1.4, r: 12, flicker: true },
      { x:  14.5, y: 3.6, z: 18, col: 0xffaa50, int: 1.2, r: 12 },
      { x: -14, y: 3.6, z: -18, col: 0x80c0ff, int: 1.0, r: 12 },
      { x:  14, y: 3.6, z: -18, col: 0xff7a30, int: 1.6, r: 14, flicker: true },
    ],
  },

  // ── 2: CONTINENTAL LOBBY — Marble, brass, hospitality ─────────────────
  2: {
    accent: 0xffd070, accentSoft: 0xffe0a0,
    cells: {
      FW: { name: 'Coat Check Wing', elements: [
        { t: 'tall', x: -16, z: 22, w: 1.0, h: 2.0, d: 0.6, col: 0x282018, stripes: 5, stripe: 0xc8a040 },
        { t: 'bar', x: -13, z: 22, w: 4.2, d: 0.7, h: 1.05, col: 0x402818, top: 0xc8a040, glow: 0xffd070 },
        { t: 'bench', x: -10, z: 19, w: 2.4, d: 0.55, h: 0.55, col: 0x4a2a1c, back: true, rotY: 0 },
        { t: 'lamp', x: -16, z: 14, col: 0xffd070 },
        { t: 'pend', x: -13, z: 18, col: 0xffd070, int: 1.8 },
      ]},
      FC: { name: 'Concierge Court', elements: [
        { t: 'desk', x: -2, z: 22, lx: 1.55, lz: 1.20 },
        { t: 'rope', x: -3, z: 14, x2: 3, z2: 14, col: 0x802020 },
        { t: 'lamp', x: -5, z: 17 },
        { t: 'lamp', x: 5, z: 17 },
        { t: 'plinth', x: 0, z: 19 },
        { t: 'pend', x: 0, z: 22, col: 0xffd070, int: 2.0, r: 10 },
      ]},
      FE: { name: 'Salon Lounge', elements: [
        { t: 'bench', x: 13, z: 18, w: 3.4, d: 0.7, h: 0.55, col: 0x4a2a1c, back: true },
        { t: 'bench', x: 16, z: 22, w: 0.7, d: 2.4, h: 0.55, col: 0x4a2a1c, back: true, rotY: Math.PI/2 },
        { t: 'lamp', x: 13, z: 14 },
        { t: 'plinth', x: 11, z: 22 },
        { t: 'pend', x: 13, z: 18, col: 0xffd070 },
      ]},
      MW: { name: 'Library Wing', elements: [
        { t: 'shelfrow', x: -14, z: 0, col: 0x3a2412 },
        { t: 'bench', x: -16, z: -4, w: 1.8, d: 0.5, h: 0.5, col: 0x4a2a1c, back: true, rotY: Math.PI/2 },
        { t: 'lamp', x: -14, z: 4 },
        { t: 'pend', x: -14, z: 0, col: 0xffe0a0, int: 1.6 },
      ]},
      ME: { name: 'Gallery Spine', elements: [
        { t: 'plinthrow', x: 14.5, z: 0 },
        { t: 'banner', x: 17.8, z: -3, w: 0.9, h: 2.6, col: 0x6a1212, trim: 0xc8a040, rotY: -Math.PI/2 },
        { t: 'banner', x: 17.8, z: 3, w: 0.9, h: 2.6, col: 0x6a1212, trim: 0xc8a040, rotY: -Math.PI/2 },
        { t: 'pend', x: 14.5, z: -4, col: 0xffd070 },
        { t: 'pend', x: 14.5, z: 4, col: 0xffd070 },
      ]},
      BW: { name: 'Service Pantry', elements: [
        { t: 'bar', x: -14, z: -16, w: 4.0, d: 0.7, h: 1.05, col: 0x282018, top: 0xc8a040, glow: 0xffd070 },
        { t: 'vend', x: -16, z: -20, col: 0x282018 },
        { t: 'tall', x: -10, z: -20, w: 1.0, h: 2.0, d: 0.6, col: 0x282018, stripes: 4, stripe: 0xc8a040 },
        { t: 'cart', x: -13, z: -19, col: 0xc8a040 },
        { t: 'pend', x: -13, z: -16, col: 0xffd070 },
      ]},
      BE: { name: 'Grand Stair Landing', elements: [
        { t: 'plat', x: 13, z: -18, w: 5.0, d: 3.0, h: 0.6, col: 0x2c2418, top: 0xc8a040, rim: 0xffd070 },
        { t: 'rail', x: 13, z: -16.4, len: 5.0, col: 0xc8a040 },
        { t: 'plinth', x: 16, z: -14 },
        { t: 'plinth', x: 16, z: -22 },
        { t: 'pend', x: 13, z: -18, col: 0xffd070, int: 2.0 },
      ]},
      BC: { name: 'Manager Suite', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.7, col: 0x282018, accent: 0xffd070 },
        { t: 'desk', x: -2, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'bench', x: 4, z: -19, w: 2.6, d: 0.55, h: 0.55, col: 0x4a2a1c, back: true },
        { t: 'shelf', x: -5, z: -22, w: 2.0, h: 2.6, d: 0.45, col: 0x3a2412 },
        { t: 'shelf', x: 5, z: -22, w: 2.0, h: 2.6, d: 0.45, col: 0x3a2412 },
        { t: 'plinth', x: 0, z: -22 },
        { t: 'pend', x: 0, z: -17, col: 0xffd070, int: 2.4, r: 11 },
      ]},
    },
    lights: [
      { x: -14, y: 3.4, z: 18, col: 0xffd070, int: 1.5, r: 11 },
      { x:  14, y: 3.4, z: 18, col: 0xffe0a0, int: 1.3, r: 11 },
      { x: -14, y: 3.4, z: -16, col: 0xffd070, int: 1.2, r: 10 },
      { x:  14, y: 3.4, z: -16, col: 0xffd070, int: 1.4, r: 10 },
    ],
  },

  // ── 3: NIGHTCLUB — neon, dance floor, VIP ─────────────────────────────
  3: {
    accent: 0xff40c8, accentSoft: 0x40e0ff,
    cells: {
      FW: { name: 'Queue Plaza', elements: [
        { t: 'rope', x: -16, z: 22, x2: -10, z2: 22, col: 0x202020 },
        { t: 'rope', x: -16, z: 18, x2: -10, z2: 18, col: 0x202020 },
        { t: 'rope', x: -16, z: 14, x2: -10, z2: 14, col: 0x202020 },
        { t: 'speaker', x: -15, z: 12, col: 0xff40c8 },
        { t: 'pend', x: -13, z: 18, col: 0xff40c8, int: 2.0 },
      ]},
      FC: { name: 'Coat Check Pit', elements: [
        { t: 'bar', x: 0, z: 22, w: 5.0, d: 0.7, h: 1.05, col: 0x100016, top: 0x202028, glow: 0x40e0ff },
        { t: 'speaker', x: -5, z: 13, col: 0x40e0ff },
        { t: 'speaker', x: 5, z: 13, col: 0x40e0ff },
        { t: 'rope', x: -3, z: 16, x2: 3, z2: 16, col: 0xa040ff },
        { t: 'pend', x: 0, z: 18, col: 0xff40c8, int: 2.4, r: 11 },
      ]},
      FE: { name: 'West Bar', elements: [
        { t: 'bar', x: 14, z: 18, w: 5.6, d: 0.7, h: 1.05, col: 0x100016, top: 0x202028, glow: 0xff40c8, rotY: 0 },
        { t: 'tall', x: 16.5, z: 14, w: 0.7, h: 2.2, d: 0.5, col: 0x100016, stripes: 6, stripe: 0xff40c8 },
        { t: 'tall', x: 16.5, z: 22, w: 0.7, h: 2.2, d: 0.5, col: 0x100016, stripes: 6, stripe: 0x40e0ff },
        { t: 'mirror', x: 16.5, z: 18, w: 1.6, h: 2.2, rotY: Math.PI/2, col: 0xff80c8 },
        { t: 'pend', x: 14, z: 18, col: 0x40e0ff, int: 2.0 },
      ]},
      MW: { name: 'Dance Floor Pit', elements: [
        { t: 'dancefloor', x: -14, z: 0, w: 5.0, d: 8.0 },
        { t: 'speaker', x: -16.5, z: -3, col: 0xff40c8 },
        { t: 'speaker', x: -16.5, z: 3, col: 0x40e0ff },
        { t: 'pend', x: -14, z: 0, col: 0xff40c8, int: 2.6, r: 9 },
      ]},
      ME: { name: 'DJ Booth Tier', elements: [
        { t: 'plat', x: 14, z: 0, w: 4.5, d: 4.5, h: 0.85, col: 0x100018, top: 0x202028, rim: 0xff40c8 },
        { t: 'console', x: 14, z: 0.5, w: 2.4, h: 0.95, d: 0.7, col: 0x100018, glow: 0xff40c8 },
        { t: 'rail', x: 14, z: -1.7, len: 4.0, col: 0xff40c8 },
        { t: 'speaker', x: 16, z: 4, col: 0x40e0ff },
        { t: 'pend', x: 14, z: 0, col: 0xff40c8, int: 2.6, r: 8 },
      ]},
      BW: { name: 'VIP Spine', elements: [
        { t: 'booth', x: -14, z: -14, col: 0x6a1838 },
        { t: 'booth', x: -14, z: -19, col: 0x6a1838 },
        { t: 'rope', x: -10, z: -16, x2: -10, z2: -22, col: 0xa040ff },
        { t: 'pend', x: -13, z: -16, col: 0xa040ff, int: 1.8 },
        { t: 'mirror', x: -17.8, z: -18, w: 2.0, h: 2.4, rotY: -Math.PI/2, col: 0x40e0ff },
      ]},
      BE: { name: 'Mezzanine Lounge', elements: [
        { t: 'plat', x: 13, z: -18, w: 5.0, d: 3.4, h: 0.85, col: 0x100018, top: 0x202028, rim: 0xff40c8 },
        { t: 'rail', x: 13, z: -16.3, len: 5.0, col: 0xff40c8 },
        { t: 'booth', x: 13, z: -19, col: 0x281030 },
        { t: 'speaker', x: 16.5, z: -22, col: 0xff40c8 },
        { t: 'pend', x: 13, z: -19, col: 0x40e0ff, int: 2.0 },
      ]},
      BC: { name: 'Mirrored Lounge', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.7, col: 0x100018, accent: 0xff40c8 },
        { t: 'mirrorwall', x: 0, z: -23.5, col: 0xff80c8 },
        { t: 'speaker', x: -5, z: -14, col: 0xff40c8 },
        { t: 'speaker', x: 5, z: -14, col: 0x40e0ff },
        { t: 'booth', x: 0, z: -19, col: 0x6a1838 },
        { t: 'pend', x: 0, z: -16, col: 0xff40c8, int: 3.0, r: 14 },
        { t: 'haz', x: 0, z: -21, w: 5.0, d: 1.4, col: 0x10041a, alpha: 0.7, glow: 0xff40c8 },
      ]},
    },
    lights: [
      { x: -14, y: 3.4, z: 0, col: 0xff40c8, int: 1.4, r: 10 },
      { x:  14, y: 3.4, z: 0, col: 0x40e0ff, int: 1.6, r: 10 },
      { x: -14, y: 3.4, z: -18, col: 0xa040ff, int: 1.6, r: 10 },
      { x:  14, y: 3.4, z: -18, col: 0xff40c8, int: 1.4, r: 10 },
    ],
  },

  // ── 4: PENTHOUSE — black & gold marble luxury ─────────────────────────
  4: {
    accent: 0xffd060, accentSoft: 0xa0c8ff,
    cells: {
      FW: { name: 'Elevator Foyer', elements: [
        { t: 'plinth', x: -14, z: 22 },
        { t: 'plinth', x: -10, z: 22 },
        { t: 'glass', x: -13, z: 17, len: 3.6 },
        { t: 'lamp', x: -16, z: 14, col: 0xffd060 },
        { t: 'pend', x: -13, z: 19, col: 0xffd060, int: 1.8 },
      ]},
      FC: { name: 'Reception Bar', elements: [
        { t: 'bar', x: 0, z: 22, w: 5.0, d: 0.7, h: 1.05, col: 0x080812, top: 0xc8a040, glow: 0xffd060 },
        { t: 'rope', x: -3, z: 14, x2: 3, z2: 14, col: 0xc8a040 },
        { t: 'plinth', x: -5, z: 18 },
        { t: 'plinth', x: 5, z: 18 },
        { t: 'pend', x: 0, z: 19, col: 0xffd060, int: 2.4, r: 12 },
      ]},
      FE: { name: 'Conversation Pit', elements: [
        { t: 'bench', x: 14, z: 19, w: 4.0, d: 0.7, h: 0.55, col: 0x202028, back: true },
        { t: 'bench', x: 12, z: 22, w: 0.7, d: 2.4, h: 0.55, col: 0x202028, back: true, rotY: Math.PI/2 },
        { t: 'bench', x: 16, z: 22, w: 0.7, d: 2.4, h: 0.55, col: 0x202028, back: true, rotY: Math.PI/2 },
        { t: 'plinth', x: 14, z: 22 },
        { t: 'pend', x: 14, z: 20, col: 0xffd060 },
      ]},
      MW: { name: 'Art Gallery Wall', elements: [
        { t: 'plinthrow', x: -14.5, z: 0 },
        { t: 'banner', x: -17.8, z: -3, w: 1.0, h: 2.6, col: 0x081830, trim: 0xc8a040, rotY: Math.PI/2 },
        { t: 'banner', x: -17.8, z: 3, w: 1.0, h: 2.6, col: 0x081830, trim: 0xc8a040, rotY: Math.PI/2 },
        { t: 'pend', x: -14, z: 0, col: 0xffd060 },
      ]},
      ME: { name: 'Glass Office Annex', elements: [
        { t: 'glass', x: 14, z: -3, len: 4.0, rotY: Math.PI/2 },
        { t: 'glass', x: 14, z: 3, len: 4.0, rotY: Math.PI/2 },
        { t: 'console', x: 16, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x080812, glow: 0xa0c8ff },
        { t: 'bench', x: 13, z: 0, w: 2.0, d: 0.55, h: 0.55, col: 0x202028, back: true },
        { t: 'pend', x: 14, z: 0, col: 0xa0c8ff, int: 1.6 },
      ]},
      BW: { name: 'Wine Vault', elements: [
        { t: 'shelfrow', x: -14, z: -16, col: 0x14101a },
        { t: 'shelfrow', x: -14, z: -20, col: 0x14101a },
        { t: 'pend', x: -14, z: -18, col: 0x802020, int: 1.4 },
      ]},
      BE: { name: 'Master Study Approach', elements: [
        { t: 'desk', x: 13, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'shelf', x: 17, z: -19, w: 2.0, h: 2.6, d: 0.45, col: 0x14101a, rotY: Math.PI/2 },
        { t: 'plat', x: 13, z: -22, w: 4.5, d: 2.6, h: 0.6, col: 0x14101a, top: 0xc8a040, rim: 0xffd060 },
        { t: 'lamp', x: 13, z: -16, col: 0xffd060 },
        { t: 'pend', x: 13, z: -19, col: 0xffd060 },
      ]},
      BC: { name: 'Master Suite', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.8, col: 0x080812, accent: 0xc8a040 },
        { t: 'statue', x: -5, z: -22 },
        { t: 'statue', x: 5, z: -22 },
        { t: 'glass', x: 0, z: -25, len: 5.0 },
        { t: 'desk', x: -2, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'pend', x: 0, z: -18, col: 0xffd060, int: 3.0, r: 14 },
        { t: 'plinth', x: 0, z: -19 },
      ]},
    },
    lights: [
      { x: -14, y: 3.6, z: 18, col: 0xffd060, int: 1.4, r: 11 },
      { x:  14, y: 3.6, z: 18, col: 0xffd060, int: 1.4, r: 11 },
      { x: -14, y: 3.6, z: -18, col: 0xa0c8ff, int: 1.0, r: 11 },
      { x:  14, y: 3.6, z: -18, col: 0xffd060, int: 1.6, r: 11 },
    ],
  },

  // ── 5: STERLING MEDICAL — abandoned hospital, fluorescent failure ─────
  5: {
    accent: 0x40c8e0, accentSoft: 0xc8e0e8,
    cells: {
      FW: { name: 'Triage Intake', elements: [
        { t: 'bar', x: -14, z: 22, w: 4.5, d: 0.7, h: 1.05, col: 0x282c34, top: 0xc8d0d8, glow: 0x40c8e0 },
        { t: 'bench', x: -10, z: 18, w: 2.4, d: 0.55, h: 0.55, col: 0x3a4248, back: true },
        { t: 'cart', x: -16, z: 16, col: 0xb83020 },
        { t: 'tall', x: -16, z: 22, w: 0.85, h: 2.0, d: 0.55, col: 0x282c34, stripes: 3, stripe: 0xff5040 },
        { t: 'pend', x: -13, z: 19, col: 0xffe0c0, int: 1.0, flicker: true },
      ]},
      FC: { name: 'Pharmacy Cabinet Row', elements: [
        { t: 'tall', x: -3, z: 23, w: 1.0, h: 2.0, d: 0.55, col: 0x282c34, stripes: 4, stripe: 0x40c8e0 },
        { t: 'tall', x: 0, z: 23, w: 1.0, h: 2.0, d: 0.55, col: 0x282c34, stripes: 4, stripe: 0x40c8e0 },
        { t: 'tall', x: 3, z: 23, w: 1.0, h: 2.0, d: 0.55, col: 0x282c34, stripes: 4, stripe: 0x40c8e0 },
        { t: 'cart', x: -3, z: 17, col: 0xc83020 },
        { t: 'cart', x: 3, z: 17, col: 0xa0a8b0 },
        { t: 'pend', x: 0, z: 19, col: 0xc8d0d8, int: 1.1, flicker: true },
      ]},
      FE: { name: 'Patient Bay A', elements: [
        { t: 'bed', x: 12, z: 14, rotY: 0 },
        { t: 'bed', x: 16, z: 14, rotY: 0 },
        { t: 'bed', x: 12, z: 19, rotY: 0 },
        { t: 'bed', x: 16, z: 19, rotY: 0 },
        { t: 'curtainrow', x: 14, z: 16.5, rotY: Math.PI/2 },
        { t: 'pend', x: 14, z: 22, col: 0x40c8e0, int: 1.0 },
      ]},
      MW: { name: 'Patient Bay B', elements: [
        { t: 'bed', x: -14, z: -3, rotY: 0 },
        { t: 'bed', x: -14, z: 2, rotY: 0 },
        { t: 'curtain', x: -16, z: 0, w: 1.4, h: 2.0, rotY: Math.PI/2, col: 0xc8d0d8 },
        { t: 'cart', x: -17, z: -4, col: 0xb83020 },
        { t: 'pend', x: -14, z: 0, col: 0xc8d0d8, int: 1.0, flicker: true },
      ]},
      ME: { name: 'Nurse Station Ring', elements: [
        { t: 'bar', x: 14, z: 0, w: 0.7, d: 4.0, h: 1.05, col: 0x282c34, top: 0xc8d0d8, glow: 0x40c8e0, rotY: 0 },
        { t: 'console', x: 13, z: -2, w: 1.6, h: 0.95, d: 0.7, col: 0x282c34, glow: 0x40c8e0 },
        { t: 'console', x: 13, z: 2, w: 1.6, h: 0.95, d: 0.7, col: 0x282c34, glow: 0x40c8e0 },
        { t: 'cart', x: 16, z: -3, col: 0xa0a8b0 },
        { t: 'pend', x: 14, z: 0, col: 0x40c8e0, int: 1.4 },
      ]},
      BW: { name: 'MRI Lab', elements: [
        { t: 'plat', x: -14, z: -17, w: 4.5, d: 3.0, h: 0.5, col: 0x14181c, top: 0xc8d0d8, rim: 0x40c8e0 },
        { t: 'tall', x: -16, z: -22, w: 1.4, h: 2.4, d: 0.6, col: 0xc8d0d8, stripes: 4, stripe: 0x40c8e0 },
        { t: 'tall', x: -10, z: -22, w: 1.4, h: 2.4, d: 0.6, col: 0xc8d0d8, stripes: 4, stripe: 0x40c8e0 },
        { t: 'console', x: -14, z: -22, w: 1.6, h: 0.95, d: 0.7, col: 0x282c34, glow: 0x40c8e0 },
        { t: 'pend', x: -14, z: -18, col: 0x40c8e0, int: 2.0 },
      ]},
      BE: { name: 'Surgical Prep', elements: [
        { t: 'curtainrow', x: 12, z: -16, rotY: 0 },
        { t: 'curtainrow', x: 16, z: -16, rotY: 0 },
        { t: 'cart', x: 14, z: -22, col: 0xa0a8b0 },
        { t: 'tall', x: 16.5, z: -19, w: 0.9, h: 2.0, d: 0.55, col: 0x282c34, stripes: 4, stripe: 0xff5040 },
        { t: 'pend', x: 14, z: -19, col: 0xc8d0d8, int: 1.0, flicker: true },
      ]},
      BC: { name: 'Operating Theater', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.6, col: 0x282c34, accent: 0x40c8e0 },
        { t: 'optable', x: 0, z: -18 },
        { t: 'cart', x: -3, z: -22, col: 0xa0a8b0 },
        { t: 'cart', x: 3, z: -22, col: 0xc83020 },
        { t: 'curtain', x: -5, z: -22, w: 1.6, h: 2.0, rotY: 0, col: 0xc8d0d8 },
        { t: 'curtain', x: 5, z: -22, w: 1.6, h: 2.0, rotY: 0, col: 0xc8d0d8 },
        { t: 'pend', x: 0, z: -14, col: 0xc8d0d8, int: 1.4, flicker: true },
      ]},
    },
    lights: [
      { x: -14, y: 3.4, z: 18, col: 0xc8d0d8, int: 0.85, r: 10, flicker: true },
      { x:  14, y: 3.4, z: 18, col: 0x40c8e0, int: 1.0, r: 10 },
      { x: -14, y: 3.4, z: -18, col: 0xc8d0d8, int: 0.85, r: 10, flicker: true },
      { x:  14, y: 3.4, z: -18, col: 0xff5040, int: 0.5, r: 8, flicker: true },
    ],
  },

  // ── 6: SUBWAY LINE 7 — concrete tunnel, third rail ─────────────────────
  6: {
    accent: 0xfff060, accentSoft: 0xff5040,
    cells: {
      FW: { name: 'Service Entrance', elements: [
        { t: 'turnstiles', x: -13, z: 22 },
        { t: 'tall', x: -16, z: 18, w: 0.9, h: 2.0, d: 0.55, col: 0x282830, stripes: 3, stripe: 0xfff060 },
        { t: 'pipes', x: -13, z: 16, len: 7 },
        { t: 'haz', x: -13, z: 14, w: 2.4, d: 1.4, col: 0x14140a, alpha: 0.85, glow: 0xfff060 },
        { t: 'pend', x: -13, z: 18, col: 0xfff060, int: 1.4, flicker: true },
      ]},
      FC: { name: 'Mezzanine Hall', elements: [
        { t: 'turnstiles', x: -3, z: 22 },
        { t: 'turnstiles', x: 3, z: 22 },
        { t: 'benchrow', x: -3, z: 16 },
        { t: 'benchrow', x: 3, z: 16 },
        { t: 'pend', x: 0, z: 18, col: 0xfff060, int: 1.6 },
      ]},
      FE: { name: 'Maintenance Locker Bay', elements: [
        { t: 'tall', x: 12, z: 22, w: 1.0, h: 2.2, d: 0.55, col: 0x14161c, stripes: 5, stripe: 0xff5040 },
        { t: 'tall', x: 14, z: 22, w: 1.0, h: 2.2, d: 0.55, col: 0x14161c, stripes: 5, stripe: 0xff5040 },
        { t: 'tall', x: 16, z: 22, w: 1.0, h: 2.2, d: 0.55, col: 0x14161c, stripes: 5, stripe: 0xff5040 },
        { t: 'cart', x: 14, z: 18, col: 0xc83020 },
        { t: 'pipes', x: 14, z: 16, len: 6 },
        { t: 'pend', x: 14, z: 18, col: 0xff5040, int: 1.4, flicker: true },
      ]},
      MW: { name: 'Track Bed Bypass', elements: [
        { t: 'track', x: -14, z: 0, len: 12, rotY: Math.PI/2, live: true },
        { t: 'pipes', x: -14, z: -5, len: 7 },
        { t: 'pend', x: -14, z: 0, col: 0xff5040, int: 1.6 },
      ]},
      ME: { name: 'Power Panel Annex', elements: [
        { t: 'tall', x: 17, z: -3, w: 0.9, h: 2.4, d: 0.5, col: 0x14161c, stripes: 4, stripe: 0xff5040, rotY: Math.PI/2 },
        { t: 'tall', x: 17, z: 3, w: 0.9, h: 2.4, d: 0.5, col: 0x14161c, stripes: 4, stripe: 0xff5040, rotY: Math.PI/2 },
        { t: 'console', x: 14, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xff5040 },
        { t: 'haz', x: 14, z: -4, w: 2.0, d: 1.4, col: 0x14140a, alpha: 0.85, glow: 0xff5040 },
        { t: 'pend', x: 14, z: 0, col: 0xff5040, int: 1.6, flicker: true },
      ]},
      BW: { name: 'Tunnel Junction', elements: [
        { t: 'track', x: -14, z: -16, len: 12, rotY: Math.PI/2, live: false },
        { t: 'pipes', x: -14, z: -22, len: 7 },
        { t: 'cart', x: -16, z: -19, col: 0xa0a8b0 },
        { t: 'pend', x: -14, z: -16, col: 0xfff060, int: 1.2, flicker: true },
      ]},
      BE: { name: 'Dispatch Office', elements: [
        { t: 'desk', x: 13, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'console', x: 16, z: -19, w: 1.6, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xfff060 },
        { t: 'tall', x: 12, z: -22, w: 0.9, h: 2.0, d: 0.55, col: 0x14161c, stripes: 3, stripe: 0xfff060 },
        { t: 'pend', x: 13, z: -18, col: 0xfff060 },
      ]},
      BC: { name: 'Switch Chamber', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.6, col: 0x14161c, accent: 0xff5040 },
        { t: 'pil', x: -3, z: -16, r: 0.36, col: 0x282830 },
        { t: 'pil', x: 3, z: -16, r: 0.36, col: 0x282830 },
        { t: 'console', x: -3, z: -22, w: 1.6, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xff5040 },
        { t: 'console', x: 3, z: -22, w: 1.6, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xfff060 },
        { t: 'haz', x: 0, z: -19, w: 4.0, d: 2.0, col: 0x14140a, alpha: 0.9, glow: 0xff5040 },
        { t: 'pend', x: 0, z: -16, col: 0xff5040, int: 2.6, r: 13, flicker: true },
      ]},
    },
    lights: [
      { x: -14, y: 3.6, z: 18, col: 0xfff060, int: 1.4, r: 10, flicker: true },
      { x:  14, y: 3.6, z: 18, col: 0xff5040, int: 1.0, r: 10 },
      { x: -14, y: 3.6, z: -18, col: 0xff5040, int: 1.2, r: 10, flicker: true },
      { x:  14, y: 3.6, z: -18, col: 0xfff060, int: 1.4, r: 10 },
    ],
  },

  // ── 7: AZURE YACHT — luxury vessel, teak + chrome ─────────────────────
  7: {
    accent: 0xa0c8ff, accentSoft: 0xffe0a0,
    cells: {
      FW: { name: 'Aft Deck Lounge', elements: [
        { t: 'bench', x: -14, z: 22, w: 3.4, d: 0.7, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'bench', x: -16, z: 18, w: 0.7, d: 2.6, h: 0.55, col: 0x4a3a20, back: true, rotY: Math.PI/2 },
        { t: 'plinth', x: -10, z: 22 },
        { t: 'lamp', x: -10, z: 14 },
        { t: 'pend', x: -13, z: 19, col: 0xffe0a0, int: 1.6 },
      ]},
      FC: { name: 'Salon Cabin', elements: [
        { t: 'bar', x: 0, z: 22, w: 5.0, d: 0.7, h: 1.05, col: 0x202028, top: 0xc8a070, glow: 0xa0c8ff },
        { t: 'bench', x: -3, z: 16, w: 2.4, d: 0.7, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'bench', x: 3, z: 16, w: 2.4, d: 0.7, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'lamp', x: -5, z: 19, col: 0xffe0a0 },
        { t: 'lamp', x: 5, z: 19, col: 0xffe0a0 },
        { t: 'pend', x: 0, z: 18, col: 0xffe0a0, int: 2.0 },
      ]},
      FE: { name: 'Galley Pass', elements: [
        { t: 'bar', x: 14, z: 19, w: 0.7, d: 4.0, h: 1.05, col: 0x202028, top: 0xc8a070, glow: 0xa0c8ff, rotY: 0 },
        { t: 'vend', x: 16, z: 14, col: 0x282028 },
        { t: 'vend', x: 16, z: 22, col: 0x282028 },
        { t: 'cart', x: 12, z: 22, col: 0xa0a8b0 },
        { t: 'pend', x: 14, z: 18, col: 0xffe0a0, int: 1.6 },
      ]},
      MW: { name: 'Crew Hatch Bypass', elements: [
        { t: 'tall', x: -16, z: -3, w: 0.9, h: 2.0, d: 0.55, col: 0x282028, stripes: 4, stripe: 0xa0c8ff },
        { t: 'tall', x: -16, z: 3, w: 0.9, h: 2.0, d: 0.55, col: 0x282028, stripes: 4, stripe: 0xa0c8ff },
        { t: 'crate2', x: -13, z: -4, col: 0x4a3a20 },
        { t: 'crate2', x: -13, z: 4, col: 0x4a3a20 },
        { t: 'pipes', x: -14, z: 0, len: 5 },
        { t: 'pend', x: -14, z: 0, col: 0xa0c8ff, int: 1.0 },
      ]},
      ME: { name: 'Stateroom Hallway', elements: [
        { t: 'bench', x: 13, z: 0, w: 3.4, d: 0.55, h: 0.55, col: 0x4a3a20, back: true, rotY: Math.PI/2 },
        { t: 'plinth', x: 16, z: -3 },
        { t: 'plinth', x: 16, z: 3 },
        { t: 'lamp', x: 13, z: -5, col: 0xffe0a0 },
        { t: 'lamp', x: 13, z: 5, col: 0xffe0a0 },
        { t: 'pend', x: 14, z: 0, col: 0xffe0a0 },
      ]},
      BW: { name: 'Engine Room Pass', elements: [
        { t: 'tall', x: -14, z: -16, w: 1.4, h: 2.2, d: 0.6, col: 0x282028, stripes: 4, stripe: 0xff5040 },
        { t: 'tall', x: -14, z: -20, w: 1.4, h: 2.2, d: 0.6, col: 0x282028, stripes: 4, stripe: 0xff5040 },
        { t: 'pipes', x: -14, z: -18, len: 6 },
        { t: 'haz', x: -14, z: -22, w: 2.6, d: 1.4, col: 0x101010, alpha: 0.85, glow: 0xff5040 },
        { t: 'pend', x: -14, z: -18, col: 0xff5040, int: 1.4, flicker: true },
      ]},
      BE: { name: 'Bridge Approach', elements: [
        { t: 'console', x: 13, z: -16, w: 2.0, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xa0c8ff },
        { t: 'console', x: 13, z: -22, w: 2.0, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xa0c8ff },
        { t: 'plat', x: 16, z: -19, w: 2.4, d: 4.5, h: 0.5, col: 0x282028, top: 0xc8a070, rim: 0xa0c8ff },
        { t: 'rail', x: 14.5, z: -19, len: 4.5, col: 0xa0c8ff, rotY: Math.PI/2 },
        { t: 'pend', x: 13, z: -19, col: 0xa0c8ff, int: 1.6 },
      ]},
      BC: { name: 'Owner’s Suite', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.7, col: 0x282028, accent: 0xc8a070 },
        { t: 'pavilion', x: 0, z: -18 },
        { t: 'helm', x: 0, z: -22 },
        { t: 'bench', x: -5, z: -16, w: 2.6, d: 0.55, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'bench', x: 5, z: -16, w: 2.6, d: 0.55, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'pend', x: 0, z: -15, col: 0xffe0a0, int: 2.0, r: 10 },
        { t: 'plinth', x: -5, z: -22 },
        { t: 'plinth', x: 5, z: -22 },
      ]},
    },
    lights: [
      { x: -14, y: 3.6, z: 18, col: 0xffe0a0, int: 1.4, r: 10 },
      { x:  14, y: 3.6, z: 18, col: 0xffe0a0, int: 1.4, r: 10 },
      { x: -14, y: 3.6, z: -18, col: 0xff5040, int: 0.8, r: 8, flicker: true },
      { x:  14, y: 3.6, z: -18, col: 0xa0c8ff, int: 1.4, r: 10 },
    ],
  },

  // ── 8: SERVER FARM Δ — data center, rack rows, cooling banks ──────────
  8: {
    accent: 0x40e0ff, accentSoft: 0x60a0ff,
    cells: {
      FW: { name: 'Mantrap Vestibule', elements: [
        { t: 'glass', x: -13, z: 22, len: 4.0 },
        { t: 'glass', x: -13, z: 14, len: 4.0 },
        { t: 'console', x: -16, z: 18, w: 1.6, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x40e0ff },
        { t: 'tall', x: -10, z: 18, w: 0.85, h: 2.4, d: 0.45, col: 0x080a14, stripes: 6, stripe: 0x40e0ff },
        { t: 'pend', x: -13, z: 18, col: 0x40e0ff, int: 1.6 },
      ]},
      FC: { name: 'Cold Aisle North', elements: [
        { t: 'rackaisle', x: -3, z: 18, accent: 0x40e0ff },
        { t: 'rackaisle', x: 3, z: 18, accent: 0x60a0ff },
        { t: 'pend', x: 0, z: 22, col: 0x40e0ff, int: 1.6 },
      ]},
      FE: { name: 'Cold Aisle South', elements: [
        { t: 'rackaisle', x: 13, z: 18, accent: 0x60a0ff },
        { t: 'ac', x: 16, z: 22 },
        { t: 'pend', x: 14, z: 18, col: 0x40e0ff, int: 1.4 },
      ]},
      MW: { name: 'Patch Panel Crawl', elements: [
        { t: 'tall', x: -16, z: -3, w: 0.9, h: 2.4, d: 0.45, col: 0x080a14, stripes: 5, stripe: 0x60a0ff, rotY: Math.PI/2 },
        { t: 'tall', x: -16, z: 3, w: 0.9, h: 2.4, d: 0.45, col: 0x080a14, stripes: 5, stripe: 0x60a0ff, rotY: Math.PI/2 },
        { t: 'console', x: -13, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x40e0ff },
        { t: 'pipes', x: -13, z: 4, len: 5, col: 0x282830 },
        { t: 'pend', x: -14, z: 0, col: 0x40e0ff, int: 1.4 },
      ]},
      ME: { name: 'Hot Aisle Spine', elements: [
        { t: 'rackaisle', x: 14, z: 0, accent: 0xff5040 },
        { t: 'hotaisle', x: 16, z: -2 },
        { t: 'pend', x: 14, z: 0, col: 0xff5040, int: 1.4 },
      ]},
      BW: { name: 'Battery Backup Bay', elements: [
        { t: 'battery', x: -16, z: -14 },
        { t: 'battery', x: -13, z: -14 },
        { t: 'battery', x: -16, z: -18 },
        { t: 'battery', x: -13, z: -18 },
        { t: 'battery', x: -16, z: -22 },
        { t: 'battery', x: -13, z: -22 },
        { t: 'pend', x: -14, z: -18, col: 0x40e0ff, int: 1.4 },
      ]},
      BE: { name: 'Network Operations Office', elements: [
        { t: 'desk', x: 13, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'console', x: 16, z: -16, w: 1.6, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x40e0ff },
        { t: 'console', x: 16, z: -19, w: 1.6, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x60a0ff },
        { t: 'console', x: 16, z: -22, w: 1.6, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x40e0ff },
        { t: 'glass', x: 10.5, z: -19, len: 5.0, rotY: Math.PI/2 },
        { t: 'pend', x: 13, z: -19, col: 0x40e0ff, int: 1.6 },
      ]},
      BC: { name: 'Core Vault', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.7, col: 0x080a14, accent: 0x40e0ff },
        { t: 'rack', x: -5, z: -22, accent: 0x40e0ff, rotY: 0 },
        { t: 'rack', x: -3, z: -22, accent: 0x40e0ff, rotY: 0 },
        { t: 'rack', x: 3, z: -22, accent: 0x40e0ff, rotY: 0 },
        { t: 'rack', x: 5, z: -22, accent: 0x40e0ff, rotY: 0 },
        { t: 'plat', x: 0, z: -16, w: 4.5, d: 2.4, h: 0.5, col: 0x080a14, top: 0x202830, rim: 0x40e0ff },
        { t: 'console', x: 0, z: -16.5, w: 2.0, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x40e0ff },
        { t: 'pend', x: 0, z: -18, col: 0x40e0ff, int: 3.0, r: 14 },
        { t: 'haz', x: 0, z: -25, w: 5.0, d: 1.6, col: 0x040810, alpha: 0.85, glow: 0x40e0ff },
      ]},
    },
    lights: [
      { x: -14, y: 3.6, z: 18, col: 0x40e0ff, int: 1.6, r: 11 },
      { x:  14, y: 3.6, z: 18, col: 0x60a0ff, int: 1.4, r: 11 },
      { x: -14, y: 3.6, z: -18, col: 0x40e0ff, int: 1.6, r: 11 },
      { x:  14, y: 3.6, z: -18, col: 0xff5040, int: 1.0, r: 9 },
    ],
  },
};


const DEFAULT_ZONE_ROLES = [
  { tag: 'read', verb: 'push', reinforce: 'scout' },
  { tag: 'brawl', verb: 'flank', reinforce: 'riot' },
  { tag: 'boss', verb: 'clear', reinforce: 'heavy' },
];

const BUILDING_ZONE_ROLES = {
  1: [
    { tag: 'read', verb: 'push', reinforce: 'scout' },
    { tag: 'brawl', verb: 'flank', reinforce: 'demolitions' },
    { tag: 'boss', verb: 'clear', reinforce: 'heavy' },
  ],
  2: [
    { tag: 'read', verb: 'hold', reinforce: 'marksman' },
    { tag: 'hold', verb: 'hold', reinforce: 'riot' },
    { tag: 'boss', verb: 'defend', reinforce: 'heavy' },
  ],
  3: [
    { tag: 'read', verb: 'push', reinforce: 'scout' },
    { tag: 'brawl', verb: 'flank', reinforce: 'demolitions' },
    { tag: 'boss', verb: 'clear', reinforce: 'riot' },
  ],
};

export function getSequenceGameplayProfile(bn){
  return { zoneRoles: BUILDING_ZONE_ROLES[bn] || DEFAULT_ZONE_ROLES };
}
