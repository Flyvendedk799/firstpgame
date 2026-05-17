// ─── LEVEL SEQUENCES ────────────────────────────────────────────────────────
// Layered on top of the existing buildLevel() pipeline. Each of the 12 campaign
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

function pushFakeAccent(ctx, x, y, z, color, baseIntensity, extra) {
  if (!ctx.fakeCeilingLamps) return;
  const { THREE } = ctx;
  ctx.fakeCeilingLamps.push({
    position: new THREE.Vector3(x, y, z),
    color: new THREE.Color(color),
    userData: Object.assign({ baseIntensity: baseIntensity != null ? baseIntensity : 1 }, extra || {})
  });
}

function _tagFloorplanMesh(mesh, e) {
  if (!mesh || !mesh.userData || !e) return;
  if (e.roomId) mesh.userData.roomId = e.roomId;
  if (e.floorplanRole) mesh.userData.floorplanRole = e.floorplanRole;
  if (e.sightlineId) mesh.userData.sightlineId = e.sightlineId;
  if (e.geometryId) mesh.userData.geometryId = e.geometryId;
  if (e.objectiveId) mesh.userData.objectiveId = e.objectiveId;
}

function addAccentGlowOrb(ctx, x, y, z, color, radius = 0.12) {
  const { THREE, scene, ob } = ctx;
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), m);
  mesh.position.set(x, y, z);
  mesh.userData.noBlock = true;
  scene.add(mesh);
  ob.push(mesh);
}

export function applySequenceLayout(ctx) {
  const { THREE, scene, ob, wl, vl, helpers, dims, materials, accent, bn, layout } = ctx;
  const def = SEQUENCE_DEFS[bn];
  if (!def) return;

  if (bn === 1) {
    applyB01DesignedDockLevel(ctx);
    return;
  }

  // Build the cell skeleton — partition walls + door frames around the doorway gaps.
  buildCellSkeleton(ctx);

  const skeletonPost = BUILDING_SKELETON_POST[bn];
  if (typeof skeletonPost === 'function') skeletonPost(ctx);

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

  addSequenceIdentityLayer(ctx, def);

  // ── Sub-room dividers + tactical glass windows + density pass ─────────
  // Authored per building in EXTRA_ELEMENTS (below). Windows are see-/shoot-/
  // vault-through (isWindow flag). Dividers create interior sub-rooms with
  // optional doorways. Extra decoration elements deepen each cell.
  const extras = EXTRA_ELEMENTS[bn] || [];
  for (const el of extras) {
    const builder = ELEMENT_BUILDERS[el.t];
    if (builder) builder(ctx, el);
  }

  // End-to-end map completion pass: non-wave halls, side pockets, preview
  // thresholds, return loops, and signature gates that make the shared shell
  // read as twelve guided tactical buildings rather than twelve large boxes.
  const routeExtras = ROUTE_COMPLETION_ELEMENTS_BY_BN[bn] || [];
  for (const el of routeExtras) {
    const builder = ELEMENT_BUILDERS[el.t];
    if (builder) builder(ctx, el);
  }

  // Per-building extra accent lights tuned to the theme (fake pool + glow — no scene PointLights).
  if (def.lights) for (const L of def.lights) {
    const baseIntensity = (L.int || 1.4) * 0.72;
    const x = L.x || 0;
    const y = L.y != null ? L.y : (dims.RH - 0.5);
    const z = L.z || 0;
    const col = L.col || def.accent;
    const flick = L.flicker ? { flicker: true, flickerPhase: Math.random() * 10, sequenceDefLight: true } : { sequenceDefLight: true };
    pushFakeAccent(ctx, x, y, z, col, baseIntensity, flick);
    addAccentGlowOrb(ctx, x, y, z, col, 0.14);
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

function _cellRegionArea(b) {
  if (!b || !Number.isFinite(b.x0)) return Infinity;
  return (b.x1 - b.x0) * (b.z1 - b.z0);
}

/**
 * Map world XZ to coarse sequence cell (FW..BC). Smallest AABB wins on overlaps.
 * @param {number} x
 * @param {number} z
 * @param {typeof CELL_REGIONS} [cellRegions]
 * @returns {keyof typeof CELL_REGIONS|null}
 */
export function pickSequenceCellId(x, z, cellRegions = CELL_REGIONS) {
  if (!cellRegions || typeof cellRegions !== 'object') return null;
  const ids = Object.keys(cellRegions).sort(
    (a, c) => _cellRegionArea(cellRegions[a]) - _cellRegionArea(cellRegions[c])
  );
  for (const id of ids) {
    const b = cellRegions[id];
    if (!b || !Number.isFinite(b.x0)) continue;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return id;
  }
  return null;
}

const SEQUENCE_IDENTITY = {
  1: { routeX:-11.5, heroX:-12, heroZ:19, bossCol:0xff9d40, railZ:7.2 },
  2: { routeX: 11.5, heroX:  0, heroZ:19, bossCol:0xd4b06a, railZ:5.6 },
  3: { routeX:-10.8, heroX:  0, heroZ:18, bossCol:0xff40c8, railZ:-1.0 },
  4: { routeX: 10.8, heroX: 13, heroZ: 2, bossCol:0xffd060, railZ:-4.8 },
  5: { routeX:-12.0, heroX: -4, heroZ: 0, bossCol:0x40ff80, railZ:-5.4 },
  6: { routeX: 12.0, heroX:  0, heroZ:17, bossCol:0xff5040, railZ:0.0 },
  7: { routeX:-11.2, heroX: 13, heroZ:18, bossCol:0xa0c8ff, railZ:-2.5 },
  8: { routeX: 11.2, heroX:  0, heroZ:-16, bossCol:0x40e0ff, railZ:-8.0 },
  // ── ACT III — The Apparatus ─────────────────────────────────────────────
  9: { routeX:-12.5, heroX:-10, heroZ:19, bossCol:0xffb060, railZ: 6.8 },     // Border crossing — long sand axis
  10: { routeX: 0,    heroX:  0, heroZ:20, bossCol:0xffe8b0, railZ:-2.0 },    // Cathedral — central nave axis
  11: { routeX:-9.0,  heroX:  0, heroZ:17, bossCol:0x6890b8, railZ: 0.5 },    // Karelia — central deck spine
  12: { routeX: 12.0, heroX:  0, heroZ:-15,bossCol:0xc8e0ff, railZ:-7.4 },    // The Spire — boss arena at back
};

/**
 * Macro interior shell per campaign building (must match `buildLevel` in main.js).
 * `0` = dock-style (B01-classic thresholds and zone-door columns).
 * `1` = lobby-style (mirrored interior walls + opposite zone-door handedness; spawn sets flip in main).
 * Sequence identity paint below mirrors on `1` so the floor read matches door geometry.
 */
export const CAMPAIGN_LAYOUT_BY_BN = Object.freeze([0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0]);

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
function addWallSegmentZ(ctx, x, z0, z1, t, mat, tag) {
  const { THREE, scene, ob, wl, dims, materials } = ctx;
  const { RH, WT } = dims;
  const cz = (z0 + z1) * 0.5;
  const len = z1 - z0;
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, RH, len), mat);
  m.position.set(x, RH/2 + WT/2, cz);
  if (tag && typeof tag === 'object') {
    m.userData = m.userData || {};
    if (tag.geometryId) m.userData.geometryId = tag.geometryId;
    if (tag.roomId) m.userData.roomId = tag.roomId;
    if (tag.floorplanRole) m.userData.floorplanRole = tag.floorplanRole;
  }
  scene.add(m); ob.push(m);
  wl.push({ x0: x - t/2, x1: x + t/2, z0, z1 });
  // Top trim line
  const tm = new THREE.Mesh(new THREE.BoxGeometry(t*0.95, 0.05, len*0.96), materials.trimM);
  tm.position.set(x, RH + WT - 0.045, cz);
  tm.userData = tm.userData || {}; tm.userData.noBlock = true;
  scene.add(tm); ob.push(tm);
}
function addWallSegmentX(ctx, z, x0, x1, t, mat, tag) {
  const { THREE, scene, ob, wl, dims, materials } = ctx;
  const { RH, WT } = dims;
  const cx = (x0 + x1) * 0.5;
  const len = x1 - x0;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, RH, t), mat);
  m.position.set(cx, RH/2 + WT/2, z);
  if (tag && typeof tag === 'object') {
    m.userData = m.userData || {};
    if (tag.geometryId) m.userData.geometryId = tag.geometryId;
    if (tag.roomId) m.userData.roomId = tag.roomId;
    if (tag.floorplanRole) m.userData.floorplanRole = tag.floorplanRole;
  }
  scene.add(m); ob.push(m);
  wl.push({ x0, x1, z0: z - t/2, z1: z + t/2 });
  const tm = new THREE.Mesh(new THREE.BoxGeometry(len*0.96, 0.05, t*0.95), materials.trimM);
  tm.position.set(cx, RH + WT - 0.045, z);
  tm.userData = tm.userData || {}; tm.userData.noBlock = true;
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

function tagB01Object(mesh, tag) {
  if (!mesh || !tag) return mesh;
  mesh.userData = mesh.userData || {};
  if (tag.geometryId) mesh.userData.geometryId = tag.geometryId;
  if (tag.roomId) mesh.userData.roomId = tag.roomId;
  if (tag.floorplanRole) mesh.userData.floorplanRole = tag.floorplanRole;
  if (tag.sightlineId) mesh.userData.sightlineId = tag.sightlineId;
  if (tag.objectiveId) mesh.userData.objectiveId = tag.objectiveId;
  return mesh;
}

function addB01BlockingBox(ctx, x, y, z, w, h, d, mat, tag, blocking = true) {
  const m = ctx.helpers._addBox(x, y, z, w, h, d, mat, blocking);
  if (!blocking) {
    m.userData = m.userData || {};
    m.userData.noBlock = true;
  }
  return tagB01Object(m, tag);
}

function addB01FloorPad(ctx, x, z, w, d, color, tag) {
  const { THREE, dims } = ctx;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 });
  return addB01BlockingBox(ctx, x, dims.WT + 0.024, z, w, 0.028, d, mat, tag, false);
}

function addB01Glass(ctx, x, z, w, h, rotY, tag) {
  const { THREE, scene, ob, wl, dims } = ctx;
  const { WT } = dims;
  const mat = ctx.aaPhysicalGlass
    ? ctx.aaPhysicalGlass({ color: 0x9fc7d8, transparent: true, opacity: 0.36, shininess: 160, specular: 0xffffff }, { transmission: 0.45, roughness: 0.18, thickness: 0.06, opacity: 0.72 })
    : new THREE.MeshPhongMaterial({ color: 0x9fc7d8, transparent: true, opacity: 0.36, shininess: 160, specular: 0xffffff });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), mat);
  pane.position.set(x, WT + 1.15, z);
  pane.rotation.y = rotY || 0;
  pane.userData.glassPane = true;
  pane.userData.breakable = true;
  pane.userData.breakSound = 'glass';
  tagB01Object(pane, tag);
  scene.add(pane); ob.push(pane);
  const c = Math.cos(rotY || 0), s = Math.sin(rotY || 0);
  const ax = Math.abs(c) * w * 0.5 + Math.abs(s) * 0.08;
  const az = Math.abs(s) * w * 0.5 + Math.abs(c) * 0.08;
  const aabb = { x0: x - ax, x1: x + ax, z0: z - az, z1: z + az, isWindow: true, sillH: WT + 0.85 };
  wl.push(aabb);
  pane.userData.linkedAABB = aabb;
  const frameMat = ctx.materials.postM || ctx.materials.dM;
  addB01BlockingBox(ctx, x, WT + 2.25, z, w + 0.12, 0.10, 0.12, frameMat, tag, false).rotation.y = rotY || 0;
  addB01BlockingBox(ctx, x, WT + 0.78, z, w + 0.12, 0.12, 0.16, frameMat, tag, false).rotation.y = rotY || 0;
  return pane;
}

function applyB01DesignedDockLevel(ctx) {
  const { THREE, materials, dims } = ctx;
  const { WT } = dims;
  const wall = materials.dM;
  const trim = materials.trimM;
  const post = materials.postM || materials.dM;
  const crate = materials.crM;
  const amber = new THREE.MeshLambertMaterial({ color: 0x5a3d22, emissive: 0x1a0900 });
  const blueSteel = new THREE.MeshPhongMaterial({ color: 0x263340, shininess: 80, specular: 0x52606a });
  const darkSteel = new THREE.MeshPhongMaterial({ color: 0x12161c, shininess: 95, specular: 0x46505a });
  const hazard = new THREE.MeshBasicMaterial({ color: 0xffaa30 });
  const red = new THREE.MeshLambertMaterial({ color: 0xb84020, emissive: 0x300804 });
  const black = new THREE.MeshLambertMaterial({ color: 0x080a0c, emissive: 0x010203 });
  const paintWhite = new THREE.MeshBasicMaterial({ color: 0xd8e0df, transparent: true, opacity: 0.8 });
  const panelAmber = new THREE.MeshBasicMaterial({ color: 0xff9d2e, transparent: true, opacity: 0.88 });
  const cyanPaint = new THREE.MeshBasicMaterial({ color: 0x5fe0ff, transparent: true, opacity: 0.58 });
  const soot = new THREE.MeshBasicMaterial({ color: 0x060606, transparent: true, opacity: 0.24, depthWrite: false });

  const wx = (z, x0, x1, id, roomId, role) =>
    addWallSegmentX(ctx, z, x0, x1, 0.48, wall, { geometryId: id, roomId, floorplanRole: role || 'authored_wall' });
  const wz = (x, z0, z1, id, roomId, role) =>
    addWallSegmentZ(ctx, x, z0, z1, 0.48, wall, { geometryId: id, roomId, floorplanRole: role || 'authored_wall' });

  // 01. Safe spawn vestibule: closed back, single readable throat.
  wx(23.6, -4.4, 4.4, 'b01_entry_back_bulkhead', 'b01_entry_vestibule', 'room_shell');
  wz(-4.4, 16.6, 23.6, 'b01_entry_left_bulkhead', 'b01_entry_vestibule', 'room_shell');
  wz(4.4, 16.6, 23.6, 'b01_entry_right_bulkhead', 'b01_entry_vestibule', 'room_shell');
  wx(16.6, -4.4, -1.35, 'dock_threshold_strip', 'dock_intake', 'threshold');
  wx(16.6, 1.35, 4.4, 'b01_entry_threshold_return', 'b01_entry_vestibule', 'threshold');
  doorwayFrameX(ctx, 16.6, -1.35, 1.35);
  addB01FloorPad(ctx, 0, 18.0, 1.2, 3.2, 0xffaa30, { geometryId: 'b01_entry_route_stripe', roomId: 'b01_entry_vestibule', floorplanRole: 'route_language' });
  addB01BlockingBox(ctx, -1.9, WT + 1.05, 23.32, 0.9, 1.3, 0.08, black, { geometryId: 'b01_story_manifest_clipboard', roomId: 'b01_entry_vestibule', floorplanRole: 'storytelling' }, false);
  addB01BlockingBox(ctx, 0, WT + 2.75, 23.28, 2.5, 0.34, 0.06, hazard, { geometryId: 'b01_story_bay3_sign', roomId: 'b01_entry_vestibule', floorplanRole: 'storytelling' }, false);
  addB01BlockingBox(ctx, 2.0, WT + 0.55, 21.5, 0.7, 1.1, 0.54, blueSteel, { geometryId: 'b01_entry_electrical_box', roomId: 'b01_entry_vestibule', floorplanRole: 'world_detail' });
  addB01BlockingBox(ctx, 0, WT + 3.05, 16.34, 3.1, 0.34, 0.08, panelAmber, { geometryId: 'b01_entry_overhead_bay_warning', roomId: 'b01_entry_vestibule', floorplanRole: 'first_read_signage' }, false);
  addB01BlockingBox(ctx, -3.95, WT + 1.7, 19.8, 0.08, 2.1, 4.6, darkSteel, { geometryId: 'b01_entry_left_service_riser', roomId: 'b01_entry_vestibule', floorplanRole: 'world_detail' }, false);
  addB01BlockingBox(ctx, 3.95, WT + 1.7, 19.8, 0.08, 2.1, 4.6, darkSteel, { geometryId: 'b01_entry_right_service_riser', roomId: 'b01_entry_vestibule', floorplanRole: 'world_detail' }, false);
  addB01BlockingBox(ctx, -2.75, WT + 0.12, 17.25, 1.45, 0.055, 0.28, cyanPaint, { geometryId: 'b01_spawn_left_floor_chip', roomId: 'b01_entry_vestibule', floorplanRole: 'floor_wear' }, false);
  addB01BlockingBox(ctx, 2.9, WT + 0.12, 17.7, 1.2, 0.055, 0.24, cyanPaint, { geometryId: 'b01_spawn_right_floor_chip', roomId: 'b01_entry_vestibule', floorplanRole: 'floor_wear' }, false);

  // 02. Intake peek: a deliberate first contact, not an open court.
  wx(16.9, -7.8, -1.35, 'b01_intake_north_west', 'b01_intake_peek', 'room_shell');
  wx(16.9, 1.35, 7.8, 'b01_intake_north_east', 'b01_intake_peek', 'room_shell');
  wz(-7.8, 8.65, 16.9, 'b01_intake_west_shell', 'b01_intake_peek', 'room_shell');
  wz(7.8, 8.65, 16.9, 'b01_intake_east_shell', 'b01_intake_peek', 'room_shell');
  wx(8.65, -7.8, 3.92, 'intake_apron_divider', 'dock_intake', 'threshold');
  wx(8.65, 6.08, 7.8, 'b01_intake_service_gate_return', 'b01_intake_peek', 'threshold');
  doorwayFrameX(ctx, 8.65, 3.92, 6.08);
  // Split around the lookout slit so the first contact is an actual sightline,
  // not glass painted over an opaque collision wall.
  wz(-1.35, 10.2, 13.32, 'b01_first_peek_blind', 'b01_intake_peek', 'peek_blind');
  wz(-1.35, 14.78, 15.2, 'b01_first_peek_blind', 'b01_intake_peek', 'peek_blind');
  addB01Glass(ctx, -1.35, 14.05, 1.25, 1.05, Math.PI / 2, { geometryId: 'b01_first_lookout_slit', roomId: 'b01_intake_peek', sightlineId: 'first_lookout_slit', floorplanRole: 'first_contact_preview' });
  addB01BlockingBox(ctx, -1.08, WT + 1.65, 12.6, 0.08, 2.05, 4.25, darkSteel, { geometryId: 'b01_first_peek_blind_kickplate', roomId: 'b01_intake_peek', floorplanRole: 'readable_occluder_face' }, false);
  addB01BlockingBox(ctx, -1.02, WT + 2.58, 12.5, 0.055, 0.16, 2.6, panelAmber, { geometryId: 'b01_first_peek_hazard_caption', roomId: 'b01_intake_peek', floorplanRole: 'first_contact_language' }, false);
  addB01BlockingBox(ctx, -0.98, WT + 0.92, 11.7, 0.055, 0.95, 0.45, cyanPaint, { geometryId: 'b01_first_peek_old_route_paint', roomId: 'b01_intake_peek', floorplanRole: 'painted_history' }, false);
  for (const x of [-5.6, -4.7, 4.6, 6.1]) {
    addB01BlockingBox(ctx, x, dims.RH + WT - 0.72, 13.4, 0.055, 1.0, 0.055, black, { geometryId: `b01_intake_hanging_chain_${x}`, roomId: 'b01_intake_peek', floorplanRole: 'ceiling_detail' }, false);
  }
  addB01BlockingBox(ctx, -4.2, WT + 0.44, 14.6, 1.45, 0.88, 0.72, crate, { geometryId: 'b01_intake_player_cover', roomId: 'b01_intake_peek', floorplanRole: 'player_cover' });
  addB01BlockingBox(ctx, -3.2, WT + 1.05, 11.0, 0.72, 2.1, 0.58, darkSteel, { geometryId: 'b01_intake_enemy_edge', roomId: 'b01_intake_peek', floorplanRole: 'enemy_peek_edge' });
  addB01BlockingBox(ctx, 5.7, WT + 0.72, 14.0, 2.6, 1.44, 0.82, blueSteel, { geometryId: 'b01_intake_container_landmark', roomId: 'b01_intake_peek', floorplanRole: 'landmark_cover' });
  for (const sx of [-1, 1]) {
    addB01BlockingBox(ctx, sx * 6.9, WT + 2.15, 12.6, 0.07, 1.8, 0.9, soot, { geometryId: `b01_intake_grime_${sx}`, roomId: 'b01_intake_peek', floorplanRole: 'grime_story' }, false);
  }

  // 03. Service hall: short compression after first contact, with no equal-looking detours.
  wz(2.25, 2.4, 9.1, 'west_service_run', 'west_service_connector', 'connector_wall');
  wz(8.8, 2.4, 9.1, 'b01_service_east_wall', 'b01_service_hall', 'connector_wall');
  wx(9.1, 2.25, 3.95, 'b01_service_north_west_return', 'b01_service_hall', 'connector_wall');
  wx(9.1, 6.05, 8.8, 'b01_service_north_east_return', 'b01_service_hall', 'connector_wall');
  wx(2.4, 2.25, 3.95, 'b01_service_to_relay_return_w', 'b01_service_hall', 'threshold');
  wx(2.4, 6.05, 8.8, 'b01_service_to_relay_return_e', 'b01_service_hall', 'threshold');
  doorwayFrameX(ctx, 2.4, 3.95, 6.05);
  wz(5.9, 4.4, 8.0, 'b01_service_s_bend_occluder', 'b01_service_hall', 'sightline_blocker');
  addB01BlockingBox(ctx, 3.4, WT + 0.42, 5.6, 1.25, 0.84, 0.72, blueSteel, { geometryId: 'b01_service_hall_cover', roomId: 'b01_service_hall', floorplanRole: 'recovery_cover' });
  addB01FloorPad(ctx, 5.0, 5.4, 0.7, 4.5, 0x30485a, { geometryId: 'b01_service_route_strip', roomId: 'b01_service_hall', floorplanRole: 'route_language' });
  for (const z of [3.2, 5.4, 7.6]) {
    addB01BlockingBox(ctx, 8.52, WT + 2.2, z, 0.06, 0.08, 1.6, hazard, { geometryId: `b01_service_pipe_label_${z}`, roomId: 'b01_service_hall', floorplanRole: 'route_language' }, false);
  }
  addB01BlockingBox(ctx, 2.54, WT + 2.75, 5.8, 0.08, 0.16, 4.8, darkSteel, { geometryId: 'b01_service_overhead_cable_tray', roomId: 'b01_service_hall', floorplanRole: 'world_detail' }, false);

  // 04. Relay approach: central threshold with west objective read and east flank door.
  wx(4.8, -7.4, 3.95, 'b01_relay_north_west', 'b01_relay_approach', 'room_shell');
  wx(4.8, 6.05, 7.4, 'b01_relay_north_east', 'b01_relay_approach', 'room_shell');
  wx(-2.4, -7.4, 7.4, 'b01_relay_south_wall', 'b01_relay_approach', 'room_shell');
  wz(-7.4, -2.4, -1.35, 'b01_relay_alarm_gate_return_s', 'b01_relay_approach', 'threshold');
  wz(-7.4, 1.35, 4.8, 'b01_relay_alarm_gate_return_n', 'b01_relay_approach', 'threshold');
  wz(7.4, -2.4, -1.35, 'b01_relay_drum_gate_return_s', 'b01_relay_approach', 'threshold');
  wz(7.4, 1.35, 4.8, 'b01_relay_drum_gate_return_n', 'b01_relay_approach', 'threshold');
  doorwayFrameZ(ctx, -7.4, -1.35, 1.35);
  doorwayFrameZ(ctx, 7.4, -1.35, 1.35);
  wz(-2.2, -1.5, 2.7, 'mid_spine_pinch', 'mid_lane_center', 'connector');
  addB01BlockingBox(ctx, -0.6, WT + 0.48, 2.1, 1.35, 0.96, 0.76, crate, { geometryId: 'b01_relay_player_answer_cover', roomId: 'b01_relay_approach', floorplanRole: 'player_cover' });
  addB01BlockingBox(ctx, 2.6, WT + 0.05, 1.1, 2.8, 0.035, 0.38, paintWhite, { geometryId: 'b01_relay_floor_arrow', roomId: 'b01_relay_approach', floorplanRole: 'route_language' }, false);
  addB01BlockingBox(ctx, -4.8, WT + 2.45, 4.52, 1.8, 0.34, 0.06, hazard, { geometryId: 'b01_relay_warning_sign', roomId: 'b01_relay_approach', floorplanRole: 'storytelling' }, false);

  // 05. Alarm relay office: objective room with an offset entry and desk anchor.
  wx(5.2, -18.0, -7.4, 'relay_partition_north', 'alarm_relay_room', 'room_shell');
  wx(-6.2, -18.0, -7.4, 'b01_alarm_south_wall', 'alarm_relay_room', 'room_shell');
  wz(-18.0, -6.2, 5.2, 'relay_partition_west', 'alarm_relay_room', 'room_shell');
  wz(-7.4, -6.2, -1.35, 'relay_offset_door', 'alarm_relay_room', 'threshold');
  wz(-7.4, 1.35, 5.2, 'b01_alarm_east_return', 'alarm_relay_room', 'threshold');
  addB01Glass(ctx, -10.1, 5.2, 2.7, 1.05, 0, { geometryId: 'manifest_office_window', roomId: 'alarm_relay_room', sightlineId: 'office_to_mid_floor', floorplanRole: 'objective_preview' });
  addB01Glass(ctx, -7.4, 2.9, 1.45, 0.85, Math.PI / 2, { geometryId: 'relay_side_slit', roomId: 'alarm_relay_room', sightlineId: 'relay_peek_me', floorplanRole: 'side_slit' });
  addB01BlockingBox(ctx, -14.2, WT + 0.55, 0.9, 2.4, 1.1, 0.86, amber, { geometryId: 'relay_panel_anchor', roomId: 'alarm_relay_room', objectiveId: 'alarm_panel', floorplanRole: 'objective_anchor' });
  addB01BlockingBox(ctx, -12.3, WT + 0.48, -2.2, 1.45, 0.96, 0.82, blueSteel, { geometryId: 'b01_alarm_player_cover', roomId: 'alarm_relay_room', floorplanRole: 'player_cover' });
  addB01FloorPad(ctx, -14.2, 1.0, 2.0, 1.25, 0x40ffc8, { geometryId: 'alarm_interact_lane', roomId: 'alarm_relay_room', objectiveId: 'alarm_panel', floorplanRole: 'objective_lane' });
  addB01FloorPad(ctx, -10.0, -0.1, 2.4, 0.35, 0xffaa30, { geometryId: 'b01_alarm_exit_read', roomId: 'alarm_relay_room', floorplanRole: 'exit_reveal' });
  addB01BlockingBox(ctx, -17.55, WT + 2.25, 2.4, 0.08, 1.0, 2.2, black, { geometryId: 'b01_alarm_server_rack_west', roomId: 'alarm_relay_room', floorplanRole: 'world_detail' });
  addB01BlockingBox(ctx, -15.2, WT + 1.9, 5.0, 2.4, 0.12, 0.12, hazard, { geometryId: 'b01_alarm_cable_over_console', roomId: 'alarm_relay_room', floorplanRole: 'objective_language' }, false);

  // 06. Drum flank: pressure room opens after the relay; it reconnects to the final threshold.
  wz(18.0, -6.4, 4.8, 'b01_drum_east_bulkhead', 'b01_drum_flank', 'room_shell');
  wx(4.8, 7.4, 18.0, 'b01_drum_north_wall', 'b01_drum_flank', 'room_shell');
  wx(-6.4, -7.4, -6.05, 'b01_drum_to_cage_return_w', 'b01_drum_flank', 'threshold');
  wx(-6.4, -3.95, 18.0, 'b01_drum_to_cage_return_e', 'b01_drum_flank', 'threshold');
  doorwayFrameX(ctx, -6.4, -6.05, -3.95);
  wz(10.5, -5.5, 2.8, 'east_compression_corridor', 'east_flank_connector', 'connector');
  wz(13.4, -4.7, 3.2, 'b01_east_return_loop', 'b01_drum_flank', 'return_loop');
  addB01BlockingBox(ctx, 14.1, WT + 0.45, -2.5, 1.1, 0.9, 1.1, red, { geometryId: 'b01_drum_spool_cover', roomId: 'b01_drum_flank', floorplanRole: 'enemy_cover' });
  addB01BlockingBox(ctx, 11.6, WT + 0.44, 1.7, 1.3, 0.88, 0.78, crate, { geometryId: 'b01_drum_player_cover', roomId: 'b01_drum_flank', floorplanRole: 'player_cover' });
  addB01Glass(ctx, 7.4, -3.7, 1.9, 0.9, Math.PI / 2, { geometryId: 'b01_relay_preread_glass', roomId: 'b01_drum_flank', sightlineId: 'relay_pre_read', floorplanRole: 'final_preview' });
  for (const z of [-4.1, -2.5, -0.9]) {
    addB01BlockingBox(ctx, 16.6, WT + 0.38, z, 0.6, 0.76, 0.6, red, { geometryId: `b01_drum_stack_${z}`, roomId: 'b01_drum_flank', floorplanRole: 'world_detail' });
  }
  addB01BlockingBox(ctx, 17.65, WT + 2.2, 0.2, 0.08, 1.8, 4.4, soot, { geometryId: 'b01_drum_burn_shadow', roomId: 'b01_drum_flank', floorplanRole: 'storytelling' }, false);

  // 07. Cage vestibule: quiet anticipation before the signature room.
  wz(-7.4, -13.2, -6.4, 'b01_cage_vest_west_wall', 'b01_cage_vestibule', 'room_shell');
  wz(0.8, -13.2, -6.4, 'b01_cage_vest_east_wall', 'b01_cage_vestibule', 'room_shell');
  wx(-13.2, -7.4, -1.1, 'cage_vestibule', 'relay_cage', 'threshold');
  wx(-13.2, 1.1, 0.8, 'b01_cage_vestibule_return', 'b01_cage_vestibule', 'threshold');
  addB01Glass(ctx, -2.4, -13.2, 2.3, 0.95, 0, { geometryId: 'b01_cage_signature_gate', roomId: 'relay_cage', sightlineId: 'cage_signature_preview', floorplanRole: 'signature_gate' });
  addB01FloorPad(ctx, -5.0, -9.6, 0.72, 4.2, 0xffaa30, { geometryId: 'b01_cage_route_stripe', roomId: 'b01_cage_vestibule', floorplanRole: 'route_language' });
  for (const x of [-6.6, -4.8, -3.0, -1.2]) {
    addB01BlockingBox(ctx, x, WT + 1.45, -12.98, 0.08, 2.1, 0.08, darkSteel, { geometryId: `b01_cage_preview_bar_${x}`, roomId: 'b01_cage_vestibule', floorplanRole: 'preview_bars' }, false);
  }

  // 08. Relay cage: wider final fight with rails, center landmark, and a back-lit exit.
  wx(-13.0, -9.2, -1.1, 'b01_cage_north_west', 'b01_relay_cage', 'room_shell');
  wx(-13.0, 1.1, 9.2, 'b01_cage_north_east', 'b01_relay_cage', 'room_shell');
  wz(-9.2, -25.4, -13.0, 'b01_cage_west_wall', 'b01_relay_cage', 'room_shell');
  wz(9.2, -25.4, -19.05, 'b01_cage_east_wall_south', 'b01_relay_cage', 'room_shell');
  wz(9.2, -15.95, -13.0, 'b01_cage_east_wall_north', 'b01_relay_cage', 'room_shell');
  doorwayFrameZ(ctx, 9.2, -19.05, -15.95);
  wx(-25.4, -9.2, -1.35, 'b01_cage_back_west', 'b01_relay_cage', 'room_shell');
  wx(-25.4, 1.35, 9.2, 'b01_cage_back_east', 'b01_relay_cage', 'room_shell');
  doorwayFrameX(ctx, -25.4, -1.35, 1.35);
  addB01BlockingBox(ctx, -3.6, WT + 0.52, -17.0, 1.4, 1.04, 0.82, darkSteel, { geometryId: 'b01_cage_pillar_west', roomId: 'b01_relay_cage', floorplanRole: 'cover_landmark' });
  addB01BlockingBox(ctx, 3.6, WT + 0.52, -17.0, 1.4, 1.04, 0.82, darkSteel, { geometryId: 'b01_cage_pillar_east', roomId: 'b01_relay_cage', floorplanRole: 'cover_landmark' });
  addB01BlockingBox(ctx, 0, WT + 0.50, -20.4, 2.1, 1.0, 0.92, amber, { geometryId: 'b01_cage_center_low', roomId: 'b01_relay_cage', floorplanRole: 'boss_cover' });
  addB01FloorPad(ctx, 0, -23.2, 4.4, 1.2, 0xff7a30, { geometryId: 'b01_exit_read_pad', roomId: 'b01_relay_cage', floorplanRole: 'exit_reveal' });
  for (const x of [-8.75, 8.75]) {
    const railZs = x > 0 ? [-23.2, -21.0, -14.4] : [-23.2, -21.0, -18.8, -16.6, -14.4];
    for (const z of railZs) {
      addB01BlockingBox(ctx, x, WT + 1.85, z, 0.08, 2.9, 0.08, darkSteel, { geometryId: `b01_cage_rail_${x}_${z}`, roomId: 'b01_relay_cage', floorplanRole: 'cage_bars' }, false);
    }
  }
  addB01BlockingBox(ctx, 0, WT + 2.9, -25.15, 2.2, 0.34, 0.06, hazard, { geometryId: 'b01_exit_overhead_sign', roomId: 'b01_relay_cage', floorplanRole: 'exit_reveal' }, false);

  // 09. Foreman/catwalk overlook: reachable side perch for the final-room sniper.
  wx(-12.8, 11.4, 17.8, 'foreman_cage_wall', 'foreman_cage', 'threshold');
  wz(11.4, -22.0, -19.05, 'foreman_cage_return_south', 'foreman_cage', 'overlook_return');
  wz(11.4, -15.95, -12.8, 'foreman_cage_return_north', 'foreman_cage', 'overlook_return');
  doorwayFrameZ(ctx, 11.4, -19.05, -15.95);
  addB01BlockingBox(ctx, 17.8, WT + 0.62, -17.4, 0.42, 1.24, 9.2, darkSteel, { geometryId: 'b01_foreman_overlook_east_rail', roomId: 'b01_relay_cage', floorplanRole: 'overlook_boundary' });
  addB01BlockingBox(ctx, 14.6, WT + 0.62, -22.0, 6.4, 1.24, 0.42, darkSteel, { geometryId: 'b01_foreman_overlook_south_rail', roomId: 'b01_relay_cage', floorplanRole: 'overlook_boundary' });
  addB01FloorPad(ctx, 10.3, -17.5, 1.6, 2.75, 0xffaa30, { geometryId: 'b01_foreman_overlook_access_strip', roomId: 'b01_relay_cage', floorplanRole: 'overlook_connector' });
  addB01FloorPad(ctx, 14.2, -17.3, 3.4, 2.8, 0x30485a, { geometryId: 'b01_foreman_overlook_floor_zone', roomId: 'b01_relay_cage', floorplanRole: 'overlook_combat_pocket' });
  addB01Glass(ctx, 12.2, -12.8, 2.6, 1.1, 0, { geometryId: 'foreman_glass', roomId: 'foreman_cage', sightlineId: 'foreman_to_relay_cage', floorplanRole: 'sightline' });
  addB01Glass(ctx, 15.5, -15.7, 3.0, 1.0, Math.PI / 2, { geometryId: 'catwalk_to_cage_window', roomId: 'foreman_cage', sightlineId: 'catwalk_over_bc', floorplanRole: 'overwatch_window' });
  addB01BlockingBox(ctx, 13.6, WT + 0.48, -17.2, 1.6, 0.96, 0.75, blueSteel, { geometryId: 'b01_foreman_desk_rail', roomId: 'b01_relay_cage', floorplanRole: 'overwatch_cover' });
  addB01BlockingBox(ctx, 17.55, WT + 2.7, -17.5, 0.08, 0.34, 2.6, hazard, { geometryId: 'b01_foreman_office_sign', roomId: 'foreman_cage', floorplanRole: 'storytelling' }, false);

  // Door hierarchy and route language: primary route is amber, side reads are blue.
  for (const [x, z, w, d] of [
    [0, 16.4, 2.4, 0.18],
    [5, 8.4, 2.2, 0.18],
    [5, 2.15, 2.2, 0.18],
    [-7.55, 0, 0.18, 2.5],
    [7.55, 0, 0.18, 2.5],
    [-5, -6.65, 2.2, 0.18],
    [0, -13.05, 2.2, 0.18],
    [10.3, -17.5, 0.18, 2.75],
    [0, -25.15, 2.5, 0.18],
  ]) {
    addB01BlockingBox(ctx, x, WT + 0.08, z, w, 0.06, d, hazard, { roomId: 'b01_route_language', floorplanRole: 'threshold_hierarchy' }, false);
  }

  pushFakeAccent(ctx, 0, 3.7, 18.2, 0xffaa30, 1.5, { b01Designed: true, room: 'entry' });
  pushFakeAccent(ctx, -14.2, 3.2, 1.0, 0x40ffc8, 1.65, { b01Designed: true, room: 'alarm' });
  pushFakeAccent(ctx, 13.6, 3.2, -2.2, 0xff5040, 1.35, { b01Designed: true, room: 'drum' });
  pushFakeAccent(ctx, 0, 3.5, -20.4, 0xff7a30, 1.85, { b01Designed: true, room: 'cage' });
  for (const z of [18.2, 12.8, 5.8, 0.8, -3.2, -10.0, -18.6, -23.4]) {
    addB01BlockingBox(ctx, 0, dims.RH + WT - 0.16, z, 5.8, 0.10, 0.12, darkSteel, { geometryId: `b01_overhead_beam_${z}`, roomId: 'b01_loading_dock', floorplanRole: 'ceiling_structure' }, false);
  }
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

function addSequenceIdentityLayer(ctx, def) {
  const { THREE, scene, ob, dims, bn, layout } = ctx;
  const { WT, RH } = dims;
  const id = SEQUENCE_IDENTITY[bn] || SEQUENCE_IDENTITY[1];
  const mx = (layout | 0) === 1 ? -1 : 1;
  const routeX = id.routeX * mx;
  const heroX = id.heroX * mx;
  const accent = id.bossCol || def.accent || 0xffd060;
  const floorM = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.26, depthWrite: false });
  const route = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 34), floorM);
  route.rotation.x = -Math.PI / 2;
  route.position.set(routeX, WT + 0.018, 1.5);
  route.userData.noBlock = true;
  scene.add(route); ob.push(route);

  const sightM = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.34 });
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 24), sightM);
  sight.position.set(-routeX * 0.52, WT + 0.05, -3.5);
  sight.rotation.y = 0.13 * Math.sign(routeX || 1);
  sight.userData.noBlock = true;
  scene.add(sight); ob.push(sight);

  const railM = new THREE.MeshLambertMaterial({ color: 0x11151c, emissive: accent, emissiveIntensity: 0.25 });
  for (const x of [-4.8, 4.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.08, 0.16), railM);
    rail.position.set(x, WT + RH - 0.70, id.railZ);
    rail.userData.noBlock = true;
    scene.add(rail); ob.push(rail);
  }

  const beaconM = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.48 });
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 0.22), beaconM);
  beacon.position.set(0, WT + 0.07, -8.15);
  beacon.userData.noBlock = true;
  scene.add(beacon); ob.push(beacon);

  const heroM = new THREE.MeshLambertMaterial({ color: 0x0f1218, emissive: accent, emissiveIntensity: 0.55 });
  const hero = new THREE.Mesh(new THREE.BoxGeometry(0.58, 2.2, 0.58), heroM);
  hero.position.set(heroX, WT + 1.1, id.heroZ);
  hero.userData.noBlock = true;
  scene.add(hero); ob.push(hero);
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
      // Phase M: every drum is now an explosive barrel. Bullet impact
      // detonates with chain-radius — clusters of drums make satisfying
      // chain reactions. Opt-out via `e.inert:true`.
      if (!e.inert) m.userData.explosive = true;
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
    _tagFloorplanMesh(m, e);
    scene.add(m); ob.push(m);
    // Tilted screen
    const scM = new THREE.MeshLambertMaterial({ color: 0x101418, emissive: e.glow || 0x40c8ff, emissiveIntensity: 0.95 });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(w*0.7, 0.42), scM);
    sc.rotation.x = -Math.PI*0.18;
    sc.position.set(e.x, WT + h + 0.10, e.z + (e.rotY ? 0 : 0));
    if (e.rotY) sc.rotation.y = e.rotY;
    _tagFloorplanMesh(sc, e);
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
      const lx = e.x, ly = RH + WT - 0.85, lz = e.z;
      pushFakeAccent(ctx, lx, ly, lz, col, e.int || 1.6, { sequenceAccent: 'pend' });
      addAccentGlowOrb(ctx, lx, ly, lz, col, 0.085);
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
    _tagFloorplanMesh(m, e);
    scene.add(m); ob.push(m);
    if (e.glow) {
      const gM = new THREE.MeshBasicMaterial({ color: e.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w*0.85, d*0.85), gM);
      g.rotation.x = -Math.PI/2;
      g.position.set(e.x, WT + 0.018, e.z);
      g.userData.noBlock = true;
      _tagFloorplanMesh(g, e);
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
    let q = 'high';
    try { q = (ctx.settings && ctx.settings.quality) || q; } catch (_) {}
    const usePhys = (q === 'high' || q === 'ultra') && typeof ctx.aaPhysicalGlass === 'function';
    const m = usePhys
      ? ctx.aaPhysicalGlass(
          { color: e.col || 0xa8c8e0, shininess: 200, specular: 0xffffff, transparent: true, opacity: 0.30 },
          { transmission: 0.42, thickness: 0.11, roughness: 0.14 }
        )
      : new THREE.MeshPhongMaterial({ color: 0xa8c8e0, transparent: true, opacity: 0.30, shininess: 200, specular: 0xffffff });
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
      const lc = e.col || 0xffd070;
      const lx = e.x, ly = WT + 1.4, lz = e.z;
      pushFakeAccent(ctx, lx, ly, lz, lc, 1.3, { sequenceAccent: 'lamp' });
      addAccentGlowOrb(ctx, lx, ly, lz, lc, 0.10);
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
    const aabb = { x0: e.x - w/2, x1: e.x + w/2, z0: e.z - d/2, z1: e.z + d/2 };
    const vaultE = { x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1, height: WT + h };
    wl.push(aabb);
    vl.push(vaultE);
    // Phase P: wooden crates degrade after ~5 hits → mid-fight cover read shifts.
    a.userData.coverHP = e.coverHP != null ? e.coverHP : 5;
    a.userData.breakSound = 'wood';
    a.userData.linkedAABB = aabb;
    a.userData.linkedVault = vaultE;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w*0.92, h*0.9, d*0.92), m);
    b.position.set(e.x + 0.1, WT + h*1.45, e.z - 0.05); scene.add(b); ob.push(b);
    b.userData.coverHP = e.coverHP != null ? e.coverHP : 4;
    b.userData.breakSound = 'wood';
    b.userData.linkedSibling = a;  // top breaks → bottom still cover
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
    pushFakeAccent(ctx, e.x, WT + 2.0, e.z, 0xffffff, 2.2, { sequenceAccent: 'optable' });
    addAccentGlowOrb(ctx, e.x, WT + 2.06, e.z, 0xe0f0ff, 0.22);
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

  // ── Window — see-through, shoot-through, vault-through tactical glass ──
  // Visual: glass pane (transparent, not in solids → bullets/LOS pass through)
  // Frame: solid trim on top + sill (in solids → blocks bullets at frame)
  // Walls: AABB tagged `isWindow:true` blocks player movement but skipped by
  //   canSee/_losClear so AI vision treats it as transparent.
  // Vaultables: sill-height entry lets the existing vault prompt kick in.
  // Params: { x, z, len, rotY, sill=0.85, head=2.0, col?, frameCol? }
  window(ctx, e) {
    const { THREE, scene, ob, wl, vl, dims } = ctx;
    const { WT } = dims;
    const len = e.len || 3.0;
    const sill = (e.sill == null) ? 0.85 : e.sill;       // bottom of glass
    const head = (e.head == null) ? 2.0 : e.head;        // top of glass
    const paneH = Math.max(0.1, head - sill);
    const paneT = 0.06;                                  // pane thickness (along normal)
    // Glass pane — transparent + depthWrite false → auto-excluded from solids
    // (so player & enemy bullets pass through cleanly).
    const glassM = new THREE.MeshPhongMaterial({
      color: e.col || 0xa8c8e0, transparent: true, opacity: 0.22,
      shininess: 220, specular: 0xffffff, depthWrite: false,
    });
    const pane = new THREE.Mesh(new THREE.BoxGeometry(len, paneH, paneT), glassM);
    pane.position.set(e.x, WT + sill + paneH/2, e.z);
    if (e.rotY) pane.rotation.y = e.rotY;
    // Phase B: glass IS shootable + breakable. Tagged glassPane so the solids
    // filter keeps it in despite transparency; on bullet hit _shatterMesh
    // removes it and clears isWindow on the linked wall AABB.
    pane.userData.glassPane = true;
    pane.userData.breakable = true;
    pane.userData.breakSound = 'glass';
    _tagFloorplanMesh(pane, e);
    scene.add(pane); ob.push(pane);
    // Subtle highlight band across the glass (animated reflection feel)
    const hi = new THREE.Mesh(
      new THREE.BoxGeometry(len * 0.85, 0.04, paneT + 0.005),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
    );
    hi.position.set(e.x, WT + sill + paneH * 0.66, e.z);
    if (e.rotY) hi.rotation.y = e.rotY;
    hi.userData.noBlock = true;
    scene.add(hi); ob.push(hi);
    // Frame: top, bottom (sill cap), and two vertical mullions
    const frM = new THREE.MeshPhongMaterial({ color: e.frameCol || 0x202428, shininess: 90, specular: 0x808890 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(len + 0.10, 0.10, 0.16), frM);
    topFrame.position.set(e.x, WT + head + 0.05, e.z);
    if (e.rotY) topFrame.rotation.y = e.rotY;
    scene.add(topFrame); ob.push(topFrame);
    const sillFrame = new THREE.Mesh(new THREE.BoxGeometry(len + 0.10, 0.10, 0.20), frM);
    sillFrame.position.set(e.x, WT + sill - 0.05, e.z);
    if (e.rotY) sillFrame.rotation.y = e.rotY;
    scene.add(sillFrame); ob.push(sillFrame);
    // Vertical mullions at each end
    for (const mx of [-len/2, len/2]) {
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.10, paneH + 0.20, 0.16), frM);
      const lx = Math.cos(e.rotY || 0) * mx;
      const lz = -Math.sin(e.rotY || 0) * mx;
      mull.position.set(e.x + lx, WT + sill + paneH/2, e.z + lz);
      if (e.rotY) mull.rotation.y = e.rotY;
      scene.add(mull); ob.push(mull);
    }
    // Mid mullion (optional, on wide windows)
    if (len >= 2.4) {
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.07, paneH, 0.14), frM);
      mid.position.set(e.x, WT + sill + paneH/2, e.z);
      if (e.rotY) mid.rotation.y = e.rotY;
      scene.add(mid); ob.push(mid);
    }
    // Wall AABB: full window plane footprint, tagged isWindow.
    const s = Math.sin(e.rotY || 0), c = Math.cos(e.rotY || 0);
    const ax = Math.abs(c) * len/2 + Math.abs(s) * (paneT + 0.04) * 0.5;
    const az = Math.abs(s) * len/2 + Math.abs(c) * (paneT + 0.04) * 0.5;
    const aabb = {
      x0: e.x - ax, x1: e.x + ax, z0: e.z - az, z1: e.z + az,
      isWindow: true,                                      // canSee/_losClear skip this
      sillH: WT + sill,                                    // for vault-through (chest height)
    };
    wl.push(aabb);
    // Vaultable entry — vault prompt + animation kicks in when the player
    // walks up to the sill from the open side.
    const vaultEntry = { x0: aabb.x0, x1: aabb.x1, z0: aabb.z0, z1: aabb.z1, height: aabb.sillH, isWindow: true };
    vl.push(vaultEntry);
    // Phase B: link the pane mesh to its AABB + vault entry so when it
    // shatters we can clear isWindow (allowing AI to path through). Also
    // store a reference to the highlight strip so it gets removed too.
    pane.userData.linkedAABB = aabb;
    pane.userData.linkedVault = vaultEntry;
    pane.userData.linkedSibling = hi;
  },

  // ── Divider — full-height interior sub-room wall with optional doorway
  // Params: { x, z, len, rotY, gap=0 (door width), gapPos=0 (door offset along len) }
  // Creates a wall segment (or two segments with a gap) splitting the cell.
  // Always full-height, opaque to LOS, bullets, and movement.
  divider(ctx, e) {
    const { THREE, scene, ob, wl, dims, materials } = ctx;
    const { RH, WT } = dims;
    const len = e.len || 4.0;
    const t = 0.40;                                       // wall thickness
    const gap = Math.max(0, Math.min(len * 0.9, e.gap || 0));
    const gapPos = e.gapPos || 0;                         // -len/2..len/2 along the wall
    const mat = e.mat || materials.dM;
    const rotY = e.rotY || 0;
    function placeSeg(localX0, localX1) {
      const segLen = localX1 - localX0;
      if (segLen < 0.2) return;
      const localCx = (localX0 + localX1) * 0.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(segLen, RH, t), mat);
      // Local space: x axis along the wall length, z along thickness.
      const cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      const worldX = e.x + cosR * localCx;
      const worldZ = e.z - sinR * localCx;
      m.position.set(worldX, RH/2 + WT/2, worldZ);
      m.rotation.y = rotY;
      _tagFloorplanMesh(m, e);
      scene.add(m); ob.push(m);
      // AABB conservative: bound by oriented box endpoints
      const ax = Math.abs(cosR) * segLen/2 + Math.abs(sinR) * t/2;
      const az = Math.abs(sinR) * segLen/2 + Math.abs(cosR) * t/2;
      wl.push({ x0: worldX - ax, x1: worldX + ax, z0: worldZ - az, z1: worldZ + az });
      // Top trim — matches existing partition style
      if (materials.trimM) {
        const tm = new THREE.Mesh(new THREE.BoxGeometry(segLen*0.95, 0.05, t*0.9), materials.trimM);
        tm.position.set(worldX, RH + WT - 0.045, worldZ);
        tm.rotation.y = rotY;
        scene.add(tm); ob.push(tm);
      }
    }
    if (gap > 0) {
      // Two segments either side of the doorway
      const half = len / 2;
      const g0 = gapPos - gap/2, g1 = gapPos + gap/2;
      placeSeg(-half, g0);
      placeSeg(g1, half);
      // Door posts + lintel
      const postM = materials.postM || materials.dM;
      const cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      for (const px of [g0, g1]) {
        const wx = e.x + cosR * px, wz = e.z - sinR * px;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, RH, 0.14), postM);
        post.position.set(wx, RH/2 + WT/2, wz);
        post.rotation.y = rotY;
        _tagFloorplanMesh(post, e);
        scene.add(post); ob.push(post);
      }
      const lintWX = e.x + cosR * gapPos;
      const lintWZ = e.z - sinR * gapPos;
      const lint = new THREE.Mesh(new THREE.BoxGeometry(gap + 0.28, 0.14, 0.14), postM);
      lint.position.set(lintWX, RH - 0.18, lintWZ);
      lint.rotation.y = rotY;
      _tagFloorplanMesh(lint, e);
      scene.add(lint); ob.push(lint);
    } else {
      placeSeg(-len/2, len/2);
    }
  },

  /** Parallel walls + shared doorway gap (clearance vs PR — see levelAuthoringValidate.AUTHORING_PLAYER_R). */
  corridor(ctx, e) {
    const len = e.len || 5;
    const rotY = e.rotY || 0;
    const halfW = ((e.width != null ? e.width : 1.35) * 0.5) - 0.2;
    const perp = rotY + Math.PI / 2;
    const px = Math.cos(perp) * halfW;
    const pz = -Math.sin(perp) * halfW;
    const g = e.gap != null ? e.gap : 1.35;
    const gp = e.gapPos != null ? e.gapPos : 0;
    ELEMENT_BUILDERS.divider(ctx, { ...e, x: e.x + px, z: e.z + pz, len, rotY, gap: g, gapPos: gp });
    ELEMENT_BUILDERS.divider(ctx, { ...e, x: e.x - px, z: e.z - pz, len, rotY, gap: g, gapPos: gp });
  },

  /** Two short dividers with aligned doorway math (vestibule / airlock read). */
  vestibule(ctx, e) {
    const w = e.w || 2.2;
    ELEMENT_BUILDERS.divider(ctx, {
      ...e,
      x: e.x,
      z: e.z,
      len: w,
      rotY: e.rotY || 0,
      gap: e.gap || 1.2,
      gapPos: e.gapPos || 0,
    });
    ELEMENT_BUILDERS.divider(ctx, {
      ...e,
      x: e.x + (e.dx || 0),
      z: e.z + (e.dz || -1.35),
      len: e.len2 || 2.5,
      rotY: e.rotY2 != null ? e.rotY2 : Math.PI / 2,
      gap: e.gap2 || 0,
      gapPos: e.gapPos2 || 0,
      geometryId: e.geometryId2,
    });
  },

  /** Two-segment threshold with independent gaps (avoids hand-tuned pair drift). */
  dogleg(ctx, e) {
    ELEMENT_BUILDERS.divider(ctx, {
      ...e,
      x: e.x,
      z: e.z,
      len: e.len1 || 3.0,
      rotY: e.rotY1 || 0,
      gap: e.gap1 || 1.1,
      gapPos: e.gapPos1 || 0,
      geometryId: e.geometryId && `${e.geometryId}_a`,
    });
    ELEMENT_BUILDERS.divider(ctx, {
      ...e,
      x: e.x2 != null ? e.x2 : e.x,
      z: e.z2 != null ? e.z2 : e.z,
      len: e.len2 || 2.8,
      rotY: e.rotY2 != null ? e.rotY2 : Math.PI / 2,
      gap: e.gap2 || 1.1,
      gapPos: e.gapPos2 || 0,
      geometryId: e.geometryId && `${e.geometryId}_b`,
    });
  },

  /**
   * Guided tunnel kit: short, readable hallway made from corridor walls plus
   * a chest/full cover pair. Width defaults stay above player/AI clearance.
   */
  guidedTunnel(ctx, e) {
    const rotY = e.rotY || 0;
    const len = e.len || 5.2;
    const width = Math.max(1.18, e.width || 1.32);
    const role = e.floorplanRole || 'guided_tunnel';
    ELEMENT_BUILDERS.corridor(ctx, {
      ...e,
      len,
      width,
      gap: e.gap != null ? e.gap : 1.28,
      gapPos: e.gapPos || 0,
      floorplanRole: role,
      geometryId: e.geometryId && `${e.geometryId}_walls`,
    });
    const side = e.side != null ? e.side : 1;
    const ox = Math.cos(rotY) * (len * 0.22);
    const oz = -Math.sin(rotY) * (len * 0.22);
    const px = Math.cos(rotY + Math.PI / 2) * side * (width * 0.52);
    const pz = -Math.sin(rotY + Math.PI / 2) * side * (width * 0.52);
    ELEMENT_BUILDERS.cov(ctx, {
      x: e.x - ox + px,
      z: e.z - oz + pz,
      w: 1.15,
      h: 0.84,
      d: 0.68,
      rotY,
      col: e.coverCol || e.col || 0x343840,
      top: e.top,
      cover: 'chest',
      roomId: e.roomId,
      floorplanRole: 'route_cover',
      geometryId: e.geometryId && `${e.geometryId}_chest_cover`,
    });
    ELEMENT_BUILDERS.tall(ctx, {
      x: e.x + ox - px * 0.45,
      z: e.z + oz - pz * 0.45,
      w: 0.72,
      h: 1.72,
      d: 0.58,
      rotY,
      col: e.fullCol || e.col || 0x20242a,
      cover: 'full',
      roomId: e.roomId,
      floorplanRole: 'peek_corner',
      geometryId: e.geometryId && `${e.geometryId}_full_cover`,
    });
  },

  /** Service hall kit: tighter connector with an offset door read and full-height service cover. */
  serviceHall(ctx, e) {
    ELEMENT_BUILDERS.guidedTunnel(ctx, {
      ...e,
      width: e.width || 1.2,
      len: e.len || 4.8,
      gap: e.gap || 1.2,
      floorplanRole: e.floorplanRole || 'service_hall',
    });
    ELEMENT_BUILDERS.glassPreview(ctx, {
      ...e,
      x: e.wx != null ? e.wx : e.x,
      z: e.wz != null ? e.wz : e.z,
      len: e.windowLen || 1.7,
      sill: e.sill != null ? e.sill : 1.05,
      head: e.head != null ? e.head : 1.95,
      geometryId: e.geometryId && `${e.geometryId}_preview`,
    });
  },

  /** Side pocket kit: small believable non-wave room with a readable door gap. */
  sidePocket(ctx, e) {
    const rotY = e.rotY || 0;
    const w = e.w || 3.2;
    const d = e.d || 2.8;
    const door = e.gap || 1.18;
    const cosR = Math.cos(rotY), sinR = Math.sin(rotY);
    const local = (lx, lz) => ({ x: e.x + cosR * lx + sinR * lz, z: e.z - sinR * lx + cosR * lz });
    const back = local(0, -d * 0.5);
    const left = local(-w * 0.5, 0);
    const right = local(w * 0.5, 0);
    ELEMENT_BUILDERS.divider(ctx, { ...e, x: back.x, z: back.z, len: w, rotY, gap: 0, floorplanRole: 'side_pocket_wall', geometryId: e.geometryId && `${e.geometryId}_back` });
    ELEMENT_BUILDERS.divider(ctx, { ...e, x: left.x, z: left.z, len: d, rotY: rotY + Math.PI / 2, gap: door, gapPos: e.gapPos || 0.35, floorplanRole: 'side_pocket_door', geometryId: e.geometryId && `${e.geometryId}_left` });
    ELEMENT_BUILDERS.divider(ctx, { ...e, x: right.x, z: right.z, len: d, rotY: rotY + Math.PI / 2, gap: 0, floorplanRole: 'side_pocket_return', geometryId: e.geometryId && `${e.geometryId}_right` });
    ELEMENT_BUILDERS.cov(ctx, {
      x: e.x,
      z: e.z,
      w: 1.25,
      h: 0.84,
      d: 0.72,
      rotY,
      col: e.coverCol || e.col || 0x34343a,
      top: e.top,
      cover: 'chest',
      roomId: e.roomId,
      floorplanRole: 'side_pocket_cover',
      geometryId: e.geometryId && `${e.geometryId}_cover`,
    });
  },

  /** Offset room kit: dogleg threshold plus a pocket, good for objective/office reads. */
  offsetRoom(ctx, e) {
    ELEMENT_BUILDERS.dogleg(ctx, {
      ...e,
      len1: e.len1 || 3.4,
      len2: e.len2 || 3.0,
      gap1: e.gap1 || 1.25,
      gap2: e.gap2 || 1.15,
      floorplanRole: e.floorplanRole || 'offset_room_threshold',
      geometryId: e.geometryId && `${e.geometryId}_dogleg`,
    });
    ELEMENT_BUILDERS.sidePocket(ctx, {
      ...e,
      x: e.pocketX != null ? e.pocketX : e.x,
      z: e.pocketZ != null ? e.pocketZ : e.z,
      w: e.pocketW || 2.9,
      d: e.pocketD || 2.5,
      geometryId: e.geometryId && `${e.geometryId}_pocket`,
    });
  },

  /** Glass preview kit: a tactical pre-read plus low sill cover. */
  glassPreview(ctx, e) {
    ELEMENT_BUILDERS.window(ctx, {
      ...e,
      len: e.len || 2.4,
      sill: e.sill != null ? e.sill : 0.9,
      head: e.head != null ? e.head : 2.05,
      floorplanRole: e.floorplanRole || 'preview_threshold',
    });
    if (e.sillCover !== false) {
      const rotY = e.rotY || 0;
      const nx = Math.sin(rotY) * 0.34;
      const nz = Math.cos(rotY) * 0.34;
      ELEMENT_BUILDERS.cov(ctx, {
        x: e.x + nx,
        z: e.z + nz,
        w: Math.min(1.6, (e.len || 2.4) * 0.55),
        h: 0.58,
        d: 0.42,
        rotY,
        col: e.coverCol || e.frameCol || 0x202428,
        cover: 'knee',
        roomId: e.roomId,
        floorplanRole: 'preview_sill_cover',
        geometryId: e.geometryId && `${e.geometryId}_sill_cover`,
      });
    }
  },

  /** Vestibule threshold kit: two-stage doorway plus optional preview glass. */
  vestibuleThreshold(ctx, e) {
    ELEMENT_BUILDERS.vestibule(ctx, {
      ...e,
      w: e.w || 3.2,
      gap: e.gap || 1.25,
      len2: e.len2 || 3.0,
      floorplanRole: e.floorplanRole || 'vestibule_threshold',
    });
    if (e.preview !== false) {
      ELEMENT_BUILDERS.glassPreview(ctx, {
        ...e,
        x: e.previewX != null ? e.previewX : e.x,
        z: e.previewZ != null ? e.previewZ : e.z,
        len: e.previewLen || 1.8,
        geometryId: e.geometryId && `${e.geometryId}_preview`,
      });
    }
  },

  /** Return loop kit: a small side detour that reconnects quickly to the primary route. */
  returnLoop(ctx, e) {
    const rotY = e.rotY || 0;
    const spread = e.spread || 2.6;
    const px = Math.cos(rotY + Math.PI / 2) * spread * 0.5;
    const pz = -Math.sin(rotY + Math.PI / 2) * spread * 0.5;
    ELEMENT_BUILDERS.guidedTunnel(ctx, {
      ...e,
      x: e.x + px,
      z: e.z + pz,
      len: e.len || 4.4,
      width: e.width || 1.16,
      rotY,
      floorplanRole: 'return_loop_in',
      geometryId: e.geometryId && `${e.geometryId}_in`,
    });
    ELEMENT_BUILDERS.guidedTunnel(ctx, {
      ...e,
      x: e.x - px,
      z: e.z - pz,
      len: e.len2 || e.len || 4.4,
      width: e.width || 1.16,
      rotY,
      side: -1,
      floorplanRole: 'return_loop_out',
      geometryId: e.geometryId && `${e.geometryId}_out`,
    });
    ELEMENT_BUILDERS.divider(ctx, {
      ...e,
      x: e.x,
      z: e.z + (e.bridgeZ || 0),
      len: spread + 1.0,
      rotY: rotY + Math.PI / 2,
      gap: e.gap || 1.2,
      gapPos: 0,
      floorplanRole: 'return_loop_cross',
      geometryId: e.geometryId && `${e.geometryId}_cross`,
    });
  },

  /** Signature gate kit: final threshold framing before a map's hero room. */
  signatureGate(ctx, e) {
    ELEMENT_BUILDERS.divider(ctx, {
      ...e,
      len: e.len || 5.2,
      gap: e.gap || 1.6,
      gapPos: e.gapPos || 0,
      floorplanRole: e.floorplanRole || 'signature_gate',
      geometryId: e.geometryId && `${e.geometryId}_gate`,
    });
    const rotY = e.rotY || 0;
    const half = (e.gap || 1.6) * 0.5 + 0.55;
    for (const side of [-1, 1]) {
      const lx = side * half;
      const wx = e.x + Math.cos(rotY) * lx;
      const wz = e.z - Math.sin(rotY) * lx;
      ELEMENT_BUILDERS.tall(ctx, {
        x: wx,
        z: wz,
        w: 0.46,
        h: 1.9,
        d: 0.46,
        rotY,
        col: e.pillarCol || e.col || 0x262a30,
        stripes: e.stripes || 2,
        stripe: e.stripe || e.glow || e.top || 0x80c8ff,
        cover: 'full',
        roomId: e.roomId,
        floorplanRole: 'signature_gate_post',
        geometryId: e.geometryId && `${e.geometryId}_post_${side < 0 ? 'l' : 'r'}`,
      });
    }
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
      FW: { name: 'West Service Lane', elements: [
        { t: 'container', x: -14, z: 21, w: 4.2, d: 1.9, col: 0x8a3a2a },
        { t: 'container', x: -10, z: 14.5, w: 4.2, d: 1.9, col: 0x335066, rotY: Math.PI/2 },
        { t: 'forklift', x: -13, z: 17, rotY: -0.6 },
        { t: 'cov', x: -16, z: 19, w: 1.4, h: 0.85, d: 0.8, col: 0x4a4a52, top: 0xfff0c8 },
        { t: 'cov', x: -17.2, z: 13.5, w: 1.2, h: 0.88, d: 0.75, col: 0x3a3c44, top: 0xfff0c8 },
        { t: 'pend', x: -12.5, z: 18, col: 0xff7a30, int: 1.6, r: 7.5 },
        { t: 'haz', x: -11, z: 20.5, w: 2.2, d: 1.4, col: 0x101010, alpha: 0.85 },
      ]},
      FC: { name: 'Intake Court', elements: [
        { t: 'cov', x: -3, z: 22, w: 2.0, h: 0.9, d: 0.9, col: 0x42342a, top: 0xfff0d0 },
        { t: 'cov', x: 3, z: 22, w: 2.0, h: 0.9, d: 0.9, col: 0x42342a, top: 0xfff0d0 },
        { t: 'cov', x: -5.5, z: 10.5, w: 1.6, h: 0.88, d: 0.85, col: 0x4a4238, top: 0xfff0d0 },
        { t: 'cov', x: 5.5, z: 10.5, w: 1.6, h: 0.88, d: 0.85, col: 0x4a4238, top: 0xfff0d0 },
        { t: 'drum', x: -2, z: 16, n: 3, col: 0xc04830, stripe: 0xfff0d0 },
        { t: 'drum', x: 3, z: 13, n: 3, col: 0xc04830, stripe: 0xfff0d0 },
        { t: 'cov', x: 0, z: 11.5, w: 1.5, h: 0.88, d: 0.82, col: 0x3a3c44, top: 0xfff0c8, geometryId: 'b01_fc_spine_chip' },
        { t: 'cov', x: -6.5, z: 14.2, w: 1.35, h: 0.86, d: 0.78, col: 0x42342a, top: 0xfff0d0, rotY: 0.22 },
        { t: 'cov', x: 6.5, z: 14.2, w: 1.35, h: 0.86, d: 0.78, col: 0x42342a, top: 0xfff0d0, rotY: -0.22 },
        { t: 'pend', x: 0, z: 17, col: 0xff7a30, int: 1.6, r: 8 },
        { t: 'pipes', x: 0, z: 23.5, len: 7 },
      ]},
      FE: { name: 'East Flank Bay', elements: [
        { t: 'forklift', x: 12, z: 17.5, rotY: 0.4 },
        { t: 'cart', x: 14.5, z: 19, col: 0xc83020 },
        { t: 'cart', x: 10, z: 21, col: 0xc8a020, rotY: 0.5 },
        { t: 'stack', x: 13.5, z: 14, w: 2.6, d: 1.4, h: 1.2, cols: [0x6a4830, 0x6a4830, 0x6a4830] },
        { t: 'cov', x: 11.2, z: 11.8, w: 1.5, h: 0.85, d: 0.82, col: 0x4a4036, top: 0xfff0c8 },
        { t: 'pend', x: 12.5, z: 18, col: 0xff7a30 },
        { t: 'hotaisle', x: 14, z: 22 },
      ]},
      MW: { name: 'Alarm Relay Office', elements: [
        { t: 'desk', x: -14, z: 0, lx: 1.55, lz: 1.20 },
        { t: 'tall', x: -16, z: -4, w: 0.85, h: 2.0, d: 0.55, col: 0x14161a, stripes: 3, stripe: 0xc8a040 },
        { t: 'tall', x: -16, z: 4, w: 0.85, h: 2.0, d: 0.55, col: 0x14161a, stripes: 3, stripe: 0xc8a040 },
        { t: 'cov', x: -12.2, z: -3.8, w: 1.5, h: 0.9, d: 0.82, col: 0x3a3e48, top: 0xfff0c8 },
        { t: 'console', x: -14, z: 4.5, w: 1.6, h: 0.95, d: 0.7, col: 0x14161a, glow: 0x40c8ff,
          geometryId: 'relay_panel_anchor', roomId: 'alarm_relay_room', floorplanRole: 'objective_anchor',
          objectiveId: 'alarm_panel' },
        { t: 'pend', x: -14, z: 0, col: 0xa8c8ff, int: 1.4, r: 6 },
      ]},
      ME: { name: 'East Drum Lane', elements: [
        { t: 'drum', x: 14, z: -2, n: 4, col: 0xb84020, stripe: 0xfff0d0 },
        { t: 'drum', x: 16, z: 3, n: 3, col: 0xb84020, stripe: 0xfff0d0 },
        { t: 'cov', x: 13, z: 4, w: 2.2, h: 0.85, d: 0.8, col: 0x6a5e3a, top: 0xfff0c8 },
        { t: 'cov', x: 12.4, z: -4.2, w: 1.5, h: 0.85, d: 0.78, col: 0x5a5240, top: 0xfff0c8 },
        { t: 'haz', x: 14.5, z: 0, w: 2.0, d: 1.4, col: 0x14140a, alpha: 0.85, glow: 0xff5040 },
        { t: 'pend', x: 14.5, z: 1, col: 0xff5040, int: 1.5 },
      ]},
      BW: { name: 'Vent Loop', elements: [
        { t: 'tall', x: -16, z: -14, w: 0.85, h: 2.4, d: 0.4, col: 0x202428 },
        { t: 'tall', x: -16, z: -19, w: 0.85, h: 2.4, d: 0.4, col: 0x202428 },
        { t: 'pipes', x: -13, z: -17, len: 7 },
        { t: 'cov', x: -13, z: -20, w: 2.0, h: 0.85, d: 0.8, col: 0x42342a, top: 0xfff0d0 },
        { t: 'cov', x: -10.5, z: -17, w: 1.5, h: 0.88, d: 0.8, col: 0x383c42, top: 0xfff0d0 },
        { t: 'pend', x: -13, z: -16, col: 0x80f0c8, int: 1.4 },
      ]},
      BE: { name: 'Catwalk Spine', elements: [
        { t: 'plat', x: 14, z: -18, w: 4.0, d: 2.4, h: 0.85, col: 0x2a2c30, top: 0x60686e, rim: 0xff7a30 },
        { t: 'rail', x: 14, z: -16.7, len: 4.0, col: 0xa0a8b0 },
        { t: 'catwalk', x: 13, z: -22, len: 8, rotY: Math.PI/2 },
        { t: 'crate2', x: 16, z: -14, col: 0x6a4830 },
        { t: 'crate2', x: 11.2, z: -20.5, col: 0x5a4838 },
        { t: 'pend', x: 13.5, z: -14, col: 0xff7a30 },
      ]},
      BC: { name: 'Relay Cage', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.2, h: 2.6, col: 0x14161a, accent: 0xff7a30 },
        { t: 'tall', x: -3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x202428, stripes: 4, stripe: 0xff7a30 },
        { t: 'tall', x: 3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x202428, stripes: 4, stripe: 0xff7a30 },
        { t: 'cov', x: -4, z: -14, w: 1.8, h: 0.9, d: 0.9, col: 0x6c5e3a, top: 0xfff0c8 },
        { t: 'cov', x: 4, z: -14, w: 1.8, h: 0.9, d: 0.9, col: 0x6c5e3a, top: 0xfff0c8 },
        { t: 'stack', x: -5.5, z: -11.5, w: 2.0, d: 1.2, h: 1.0, cols: [0x5a4838, 0x5a4838, 0x4a3828] },
        { t: 'stack', x: 5.5, z: -11.5, w: 2.0, d: 1.2, h: 1.0, cols: [0x5a4838, 0x5a4838, 0x4a3828] },
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
        { t: 'cov', x: -11.2, z: 15.5, w: 1.45, h: 0.88, d: 0.82, col: 0x4a4034, top: 0xffe8c8, rotY: Math.PI / 2 },
        { t: 'cov', x: -15, z: 18.5, w: 1.2, h: 0.86, d: 0.75, col: 0x3a3428, top: 0xffe8c8 },
        { t: 'lamp', x: -16, z: 14, col: 0xffd070 },
        { t: 'pend', x: -13, z: 18, col: 0xffd070, int: 1.8 },
      ]},
      FC: { name: 'Concierge Court', elements: [
        { t: 'desk', x: -2, z: 22, lx: 1.55, lz: 1.20 },
        { t: 'rope', x: -3, z: 14, x2: 3, z2: 14, col: 0x802020 },
        { t: 'cov', x: -5.5, z: 16.5, w: 1.4, h: 0.88, d: 0.8, col: 0x4a4034, top: 0xffe8c8 },
        { t: 'cov', x: 5.5, z: 16.5, w: 1.4, h: 0.88, d: 0.8, col: 0x4a4034, top: 0xffe8c8 },
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
        { t: 'cov', x: 12.4, z: 15.5, w: 1.3, h: 0.85, d: 0.76, col: 0x4a4034, top: 0xffe8c8 },
        { t: 'cov', x: 15.2, z: 17, w: 1.22, h: 0.82, d: 0.72, col: 0x4a4034, top: 0xffd070 },
        { t: 'drum', x: 14, z: 12, n: 2, col: 0x6a4838, stripe: 0xffe8c8 },
        { t: 'pend', x: 13, z: 18, col: 0xffd070 },
      ]},
      MW: { name: 'Library Wing', elements: [
        { t: 'shelfrow', x: -14, z: 0, col: 0x3a2412 },
        { t: 'bench', x: -16, z: -4, w: 1.8, d: 0.5, h: 0.5, col: 0x4a2a1c, back: true, rotY: Math.PI/2 },
        { t: 'cov', x: -12.5, z: -3.2, w: 1.5, h: 0.9, d: 0.82, col: 0x3a3428, top: 0xffe8c8 },
        { t: 'cov', x: -12.5, z: 3.2, w: 1.5, h: 0.9, d: 0.82, col: 0x3a3428, top: 0xffe8c8 },
        { t: 'drum', x: -15.2, z: 0, n: 2, col: 0x8a6040, stripe: 0xffd070 },
        { t: 'lamp', x: -14, z: 4 },
        { t: 'pend', x: -14, z: 0, col: 0xffe0a0, int: 1.6 },
      ]},
      ME: { name: 'Gallery Spine', elements: [
        { t: 'plinthrow', x: 14.5, z: 0 },
        { t: 'banner', x: 17.8, z: -3, w: 0.9, h: 2.6, col: 0x6a1212, trim: 0xc8a040, rotY: -Math.PI/2 },
        { t: 'banner', x: 17.8, z: 3, w: 0.9, h: 2.6, col: 0x6a1212, trim: 0xc8a040, rotY: -Math.PI/2 },
        { t: 'cov', x: 13.2, z: -2.5, w: 1.45, h: 0.88, d: 0.8, col: 0x4a4034, top: 0xffe8c8 },
        { t: 'cov', x: 13.2, z: 2.5, w: 1.45, h: 0.88, d: 0.8, col: 0x4a4034, top: 0xffe8c8 },
        { t: 'pend', x: 14.5, z: -4, col: 0xffd070 },
        { t: 'pend', x: 14.5, z: 4, col: 0xffd070 },
      ]},
      BW: { name: 'Service Pantry', elements: [
        { t: 'bar', x: -14, z: -16, w: 4.0, d: 0.7, h: 1.05, col: 0x282018, top: 0xc8a040, glow: 0xffd070 },
        { t: 'vend', x: -16, z: -20, col: 0x282018 },
        { t: 'tall', x: -10, z: -20, w: 1.0, h: 2.0, d: 0.6, col: 0x282018, stripes: 4, stripe: 0xc8a040 },
        { t: 'cart', x: -13, z: -19, col: 0xc8a040 },
        { t: 'cov', x: -11.5, z: -18, w: 1.3, h: 0.86, d: 0.78, col: 0x4a4034, top: 0xffe8c8 },
        { t: 'cov', x: -15.5, z: -14, w: 1.22, h: 0.82, d: 0.72, col: 0x4a4034, top: 0xffd070 },
        { t: 'pipes', x: -14, z: -22, len: 5 },
        { t: 'pend', x: -13, z: -16, col: 0xffd070 },
      ]},
      BE: { name: 'Grand Stair Landing', elements: [
        { t: 'plat', x: 13, z: -18, w: 5.0, d: 3.0, h: 0.6, col: 0x2c2418, top: 0xc8a040, rim: 0xffd070 },
        { t: 'rail', x: 13, z: -16.4, len: 5.0, col: 0xc8a040 },
        { t: 'plinth', x: 16, z: -14 },
        { t: 'plinth', x: 16, z: -22 },
        { t: 'cov', x: 11.5, z: -16.5, w: 1.3, h: 0.85, d: 0.76, col: 0x4a4034, top: 0xffe8c8 },
        { t: 'cov', x: 14.5, z: -20, w: 1.25, h: 0.82, d: 0.74, col: 0x4a4034, top: 0xffd070 },
        { t: 'crate2', x: 15.2, z: -18, col: 0x5a4838 },
        { t: 'haz', x: 13, z: -12, w: 2.0, d: 1.0, col: 0x141008, alpha: 0.42, glow: 0xffd070 },
        { t: 'pend', x: 13, z: -18, col: 0xffd070, int: 2.0 },
      ]},
      BC: { name: 'Manager Suite', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.7, col: 0x282018, accent: 0xffd070 },
        { t: 'desk', x: -2, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'bench', x: 4, z: -19, w: 2.6, d: 0.55, h: 0.55, col: 0x4a2a1c, back: true },
        { t: 'cov', x: -5.5, z: -14.5, w: 1.6, h: 0.9, d: 0.85, col: 0x3a3428, top: 0xffe8c8 },
        { t: 'cov', x: 5.5, z: -14.5, w: 1.6, h: 0.9, d: 0.85, col: 0x3a3428, top: 0xffe8c8 },
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
        { t: 'cov', x: -14, z: 20, w: 1.32, h: 0.82, d: 0.76, col: 0x201020, top: 0xff60c8 },
        { t: 'cov', x: -10.5, z: 16, w: 1.25, h: 0.8, d: 0.72, col: 0x201020, top: 0x40e0ff },
        { t: 'stack', x: -12, z: 22, w: 2.0, d: 1.35, h: 1.15, cols: [0x301028, 0x401838, 0x201018] },
        { t: 'tall', x: -16.5, z: 16, w: 0.65, h: 2.0, d: 0.48, col: 0x100016, stripes: 5, stripe: 0xff40c8 },
        { t: 'haz', x: -12, z: 14, w: 2.0, d: 1.0, col: 0x100818, alpha: 0.48, glow: 0xff40c8 },
        { t: 'pend', x: -13, z: 18, col: 0xff40c8, int: 2.0 },
      ]},
      FC: { name: 'Coat Check Pit', elements: [
        { t: 'bar', x: 0, z: 22, w: 5.0, d: 0.7, h: 1.05, col: 0x100016, top: 0x202028, glow: 0x40e0ff },
        { t: 'speaker', x: -5, z: 13, col: 0x40e0ff },
        { t: 'speaker', x: 5, z: 13, col: 0x40e0ff },
        { t: 'rope', x: -3, z: 16, x2: 3, z2: 16, col: 0xa040ff },
        { t: 'cov', x: -5, z: 14.5, w: 1.34, h: 0.84, d: 0.77, col: 0x181020, top: 0xff40c8 },
        { t: 'cov', x: 5, z: 14.5, w: 1.34, h: 0.84, d: 0.77, col: 0x181020, top: 0x40e0ff },
        { t: 'tall', x: -7, z: 23, w: 0.62, h: 2.0, d: 0.48, col: 0x100016, stripes: 4, stripe: 0x40e0ff },
        { t: 'tall', x: 7, z: 23, w: 0.62, h: 2.0, d: 0.48, col: 0x100016, stripes: 4, stripe: 0xff40c8 },
        { t: 'drum', x: 0, z: 11.5, n: 2, col: 0x5a1838, stripe: 0xff80c8 },
        { t: 'pend', x: 0, z: 18, col: 0xff40c8, int: 2.4, r: 11 },
      ]},
      FE: { name: 'West Bar', elements: [
        { t: 'bar', x: 14, z: 18, w: 5.6, d: 0.7, h: 1.05, col: 0x100016, top: 0x202028, glow: 0xff40c8, rotY: 0 },
        { t: 'tall', x: 16.5, z: 14, w: 0.7, h: 2.2, d: 0.5, col: 0x100016, stripes: 6, stripe: 0xff40c8 },
        { t: 'tall', x: 16.5, z: 22, w: 0.7, h: 2.2, d: 0.5, col: 0x100016, stripes: 6, stripe: 0x40e0ff },
        { t: 'mirror', x: 16.5, z: 18, w: 1.6, h: 2.2, rotY: Math.PI/2, col: 0xff80c8 },
        { t: 'cov', x: 12.5, z: 21, w: 1.28, h: 0.82, d: 0.75, col: 0x181020, top: 0xff60c8 },
        { t: 'cov', x: 11.5, z: 15, w: 1.22, h: 0.8, d: 0.72, col: 0x181020, top: 0x40e0ff },
        { t: 'drum', x: 14, z: 12.5, n: 2, col: 0x4a1838, stripe: 0x40e0ff },
        { t: 'pend', x: 14, z: 18, col: 0x40e0ff, int: 2.0 },
      ]},
      MW: { name: 'Dance Floor Pit', elements: [
        { t: 'dancefloor', x: -14, z: 0, w: 5.0, d: 8.0 },
        { t: 'speaker', x: -16.5, z: -3, col: 0xff40c8 },
        { t: 'speaker', x: -16.5, z: 3, col: 0x40e0ff },
        { t: 'cov', x: -11.5, z: -2.8, w: 1.35, h: 0.82, d: 0.78, col: 0x1a1020, top: 0xff60c8, rotY: 0.15 },
        { t: 'cov', x: -11.5, z: 2.8, w: 1.35, h: 0.82, d: 0.78, col: 0x1a1020, top: 0x40e0ff, rotY: -0.15 },
        { t: 'cov', x: -13.5, z: 0, w: 1.2, h: 0.8, d: 0.72, col: 0x201028, top: 0xff80e8 },
        { t: 'drum', x: -13.2, z: -4.2, n: 2, col: 0x5a2048, stripe: 0xff40c8 },
        { t: 'pend', x: -14, z: 0, col: 0xff40c8, int: 2.6, r: 9 },
      ]},
      ME: { name: 'DJ Booth Tier', elements: [
        { t: 'plat', x: 14, z: 0, w: 4.5, d: 4.5, h: 0.85, col: 0x100018, top: 0x202028, rim: 0xff40c8 },
        { t: 'console', x: 14, z: 0.5, w: 2.4, h: 0.95, d: 0.7, col: 0x100018, glow: 0xff40c8 },
        { t: 'rail', x: 14, z: -1.7, len: 4.0, col: 0xff40c8 },
        { t: 'cov', x: 12.8, z: -3.2, w: 1.3, h: 0.82, d: 0.76, col: 0x181020, top: 0x40e0ff },
        { t: 'cov', x: 12.8, z: 3.2, w: 1.3, h: 0.82, d: 0.76, col: 0x181020, top: 0xff40c8 },
        { t: 'speaker', x: 16, z: 4, col: 0x40e0ff },
        { t: 'pend', x: 14, z: 0, col: 0xff40c8, int: 2.6, r: 8 },
      ]},
      BW: { name: 'VIP Spine', elements: [
        { t: 'booth', x: -14, z: -14, col: 0x6a1838 },
        { t: 'booth', x: -14, z: -19, col: 0x6a1838 },
        { t: 'rope', x: -10, z: -16, x2: -10, z2: -22, col: 0xa040ff },
        { t: 'cov', x: -12, z: -17, w: 1.3, h: 0.82, d: 0.76, col: 0x201020, top: 0xff60c8 },
        { t: 'cov', x: -15.5, z: -20, w: 1.25, h: 0.8, d: 0.72, col: 0x201020, top: 0x40e0ff },
        { t: 'tall', x: -16.5, z: -16, w: 0.65, h: 2.1, d: 0.48, col: 0x100016, stripes: 5, stripe: 0xa040ff },
        { t: 'stack', x: -11, z: -22, w: 1.8, d: 1.2, h: 1.0, cols: [0x401030, 0x301828, 0x201020] },
        { t: 'mirror', x: -17.8, z: -18, w: 2.0, h: 2.4, rotY: -Math.PI/2, col: 0x40e0ff },
        { t: 'pend', x: -13, z: -16, col: 0xa040ff, int: 1.8 },
      ]},
      BE: { name: 'Mezzanine Lounge', elements: [
        { t: 'plat', x: 13, z: -18, w: 5.0, d: 3.4, h: 0.85, col: 0x100018, top: 0x202028, rim: 0xff40c8 },
        { t: 'rail', x: 13, z: -16.3, len: 5.0, col: 0xff40c8 },
        { t: 'booth', x: 13, z: -19, col: 0x281030 },
        { t: 'speaker', x: 16.5, z: -22, col: 0xff40c8 },
        { t: 'cov', x: 11.5, z: -17, w: 1.28, h: 0.82, d: 0.75, col: 0x181020, top: 0xff40c8 },
        { t: 'cov', x: 14.5, z: -21, w: 1.22, h: 0.8, d: 0.72, col: 0x181020, top: 0x40e0ff },
        { t: 'tall', x: 16.5, z: -14, w: 0.7, h: 2.0, d: 0.5, col: 0x100016, stripes: 5, stripe: 0x40e0ff },
        { t: 'pend', x: 13, z: -19, col: 0x40e0ff, int: 2.0 },
      ]},
      BC: { name: 'Mirrored Lounge', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.7, col: 0x100018, accent: 0xff40c8 },
        { t: 'mirrorwall', x: 0, z: -23.5, col: 0xff80c8 },
        { t: 'speaker', x: -5, z: -14, col: 0xff40c8 },
        { t: 'speaker', x: 5, z: -14, col: 0x40e0ff },
        { t: 'booth', x: 0, z: -19, col: 0x6a1838 },
        { t: 'cov', x: -4.2, z: -16.2, w: 1.4, h: 0.84, d: 0.78, col: 0x201020, top: 0xff60c8 },
        { t: 'cov', x: 4.2, z: -16.2, w: 1.4, h: 0.84, d: 0.78, col: 0x201020, top: 0x40e0ff },
        { t: 'pend', x: 0, z: -16, col: 0xff40c8, int: 3.0, r: 14 },
        { t: 'haz', x: 0, z: -21, w: 5.0, d: 1.4, col: 0x10041a, alpha: 0.7, glow: 0xff40c8 },
      ]},
    },
    lights: [
      { x: -14, y: 3.4, z: 0, col: 0xff40c8, int: 1.4, r: 10 },
      { x:  14, y: 3.4, z: 0, col: 0x40e0ff, int: 1.6, r: 10 },
      { x: 0, y: 3.2, z: 0, col: 0xff80d8, int: 1.1, r: 9 },
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
        { t: 'cov', x: -15.2, z: 18.5, w: 1.35, h: 0.88, d: 0.8, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: -12, z: 14.5, w: 1.28, h: 0.85, d: 0.76, col: 0x2a2c38, top: 0xa0c8ff },
        { t: 'tall', x: -16.5, z: 20, w: 0.75, h: 2.1, d: 0.52, col: 0x1a1a24, stripes: 4, stripe: 0xffd060 },
        { t: 'cart', x: -10, z: 16, col: 0x806040 },
        { t: 'lamp', x: -16, z: 14, col: 0xffd060 },
        { t: 'pend', x: -13, z: 19, col: 0xffd060, int: 1.8 },
      ]},
      FC: { name: 'Reception Bar', elements: [
        { t: 'bar', x: 0, z: 22, w: 5.0, d: 0.7, h: 1.05, col: 0x080812, top: 0xc8a040, glow: 0xffd060 },
        { t: 'rope', x: -3, z: 14, x2: 3, z2: 14, col: 0xc8a040 },
        { t: 'plinth', x: -5, z: 18 },
        { t: 'plinth', x: 5, z: 18 },
        { t: 'cov', x: -6, z: 16.2, w: 1.32, h: 0.86, d: 0.78, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: 6, z: 16.2, w: 1.32, h: 0.86, d: 0.78, col: 0x2a2c38, top: 0xa0c8ff },
        { t: 'bench', x: -2, z: 11.8, w: 2.2, d: 0.55, h: 0.52, col: 0x202028, back: true, rotY: 0 },
        { t: 'pend', x: 0, z: 19, col: 0xffd060, int: 2.4, r: 12 },
      ]},
      FE: { name: 'Conversation Pit', elements: [
        { t: 'bench', x: 14, z: 19, w: 4.0, d: 0.7, h: 0.55, col: 0x202028, back: true },
        { t: 'bench', x: 12, z: 22, w: 0.7, d: 2.4, h: 0.55, col: 0x202028, back: true, rotY: Math.PI/2 },
        { t: 'bench', x: 16, z: 22, w: 0.7, d: 2.4, h: 0.55, col: 0x202028, back: true, rotY: Math.PI/2 },
        { t: 'plinth', x: 14, z: 22 },
        { t: 'cov', x: 12.5, z: 16, w: 1.3, h: 0.85, d: 0.76, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: 15.5, z: 14.5, w: 1.25, h: 0.84, d: 0.74, col: 0x2a2c38, top: 0xa0c8ff },
        { t: 'lamp', x: 11, z: 18, col: 0xffd060 },
        { t: 'pend', x: 14, z: 20, col: 0xffd060 },
      ]},
      MW: { name: 'Art Gallery Wall', elements: [
        { t: 'plinthrow', x: -14.5, z: 0 },
        { t: 'banner', x: -17.8, z: -3, w: 1.0, h: 2.6, col: 0x081830, trim: 0xc8a040, rotY: Math.PI/2 },
        { t: 'banner', x: -17.8, z: 3, w: 1.0, h: 2.6, col: 0x081830, trim: 0xc8a040, rotY: Math.PI/2 },
        { t: 'cov', x: -12.8, z: -2.5, w: 1.45, h: 0.88, d: 0.82, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: -12.8, z: 2.5, w: 1.45, h: 0.88, d: 0.82, col: 0x2a2c38, top: 0xa0c8ff },
        { t: 'pend', x: -14, z: 0, col: 0xffd060 },
      ]},
      ME: { name: 'Glass Office Annex', elements: [
        { t: 'glass', x: 14, z: -3, len: 4.0, rotY: Math.PI/2 },
        { t: 'glass', x: 14, z: 3, len: 4.0, rotY: Math.PI/2 },
        { t: 'console', x: 16, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x080812, glow: 0xa0c8ff },
        { t: 'bench', x: 13, z: 0, w: 2.0, d: 0.55, h: 0.55, col: 0x202028, back: true },
        { t: 'cov', x: 12.6, z: -4.5, w: 1.28, h: 0.84, d: 0.75, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: 12.6, z: 4.5, w: 1.28, h: 0.84, d: 0.75, col: 0x2a2c38, top: 0xa0c8ff },
        { t: 'drum', x: 15, z: -5.5, n: 2, col: 0x4a3a28, stripe: 0xffd060 },
        { t: 'pend', x: 14, z: 0, col: 0xa0c8ff, int: 1.6 },
      ]},
      BW: { name: 'Wine Vault', elements: [
        { t: 'shelfrow', x: -14, z: -16, col: 0x14101a },
        { t: 'shelfrow', x: -14, z: -20, col: 0x14101a },
        { t: 'cov', x: -12, z: -18, w: 1.35, h: 0.86, d: 0.78, col: 0x2a2c38, top: 0xc8a040 },
        { t: 'cov', x: -15.5, z: -14, w: 1.28, h: 0.84, d: 0.75, col: 0x2a2c38, top: 0xffd060 },
        { t: 'pipes', x: -10, z: -18, len: 5 },
        { t: 'tall', x: -16.5, z: -22, w: 0.7, h: 2.2, d: 0.5, col: 0x14101a, stripes: 4, stripe: 0x802020 },
        { t: 'cart', x: -11, z: -22, col: 0x806040 },
        { t: 'pend', x: -14, z: -18, col: 0x802020, int: 1.4 },
      ]},
      BE: { name: 'Master Study Approach', elements: [
        { t: 'desk', x: 13, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'shelf', x: 17, z: -19, w: 2.0, h: 2.6, d: 0.45, col: 0x14101a, rotY: Math.PI/2 },
        { t: 'plat', x: 13, z: -22, w: 4.5, d: 2.6, h: 0.6, col: 0x14101a, top: 0xc8a040, rim: 0xffd060 },
        { t: 'cov', x: 11.8, z: -18, w: 1.28, h: 0.84, d: 0.75, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: 15.2, z: -21, w: 1.25, h: 0.82, d: 0.73, col: 0x2a2c38, top: 0xa0c8ff },
        { t: 'crate2', x: 16, z: -14, col: 0x202028 },
        { t: 'lamp', x: 13, z: -16, col: 0xffd060 },
        { t: 'pend', x: 13, z: -19, col: 0xffd060 },
      ]},
      BC: { name: 'Master Suite', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.8, col: 0x080812, accent: 0xc8a040 },
        { t: 'statue', x: -5, z: -22 },
        { t: 'statue', x: 5, z: -22 },
        { t: 'glass', x: 0, z: -25, len: 5.0 },
        { t: 'desk', x: -2, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'cov', x: 3.5, z: -14.2, w: 1.5, h: 0.9, d: 0.84, col: 0x2a2c38, top: 0xffd060 },
        { t: 'cov', x: -4.5, z: -18.5, w: 1.45, h: 0.88, d: 0.8, col: 0x2a2c38, top: 0xa0c8ff },
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
        { t: 'cov', x: -11.5, z: 21, w: 1.25, h: 0.84, d: 0.74, col: 0x3a4248, top: 0x40ff80 },
        { t: 'cov', x: -15.2, z: 15.5, w: 1.22, h: 0.82, d: 0.72, col: 0x3a4248, top: 0x40c8e0 },
        { t: 'pipes', x: -13, z: 14, len: 5 },
        { t: 'lamp', x: -10, z: 14, col: 0xc8d0d8 },
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
        { t: 'cov', x: 13, z: 16.8, w: 1.3, h: 0.85, d: 0.76, col: 0x3a4248, top: 0xc8e0e8 },
        { t: 'cov', x: 15, z: 21.5, w: 1.25, h: 0.84, d: 0.74, col: 0x3a4248, top: 0x40ff80 },
        { t: 'cart', x: 11.5, z: 22, col: 0xa0a8b0 },
        { t: 'pend', x: 14, z: 22, col: 0x40c8e0, int: 1.0 },
      ]},
      MW: { name: 'Patient Bay B', elements: [
        { t: 'bed', x: -14, z: -3, rotY: 0 },
        { t: 'bed', x: -14, z: 2, rotY: 0 },
        { t: 'curtain', x: -16, z: 0, w: 1.4, h: 2.0, rotY: Math.PI/2, col: 0xc8d0d8 },
        { t: 'cart', x: -17, z: -4, col: 0xb83020 },
        { t: 'cov', x: -12.5, z: -2.5, w: 1.4, h: 0.88, d: 0.8, col: 0x3a4248, top: 0xc8e0e8 },
        { t: 'cov', x: -12.5, z: 2.5, w: 1.4, h: 0.88, d: 0.8, col: 0x3a4248, top: 0x40c8e0 },
        { t: 'pend', x: -14, z: 0, col: 0xc8d0d8, int: 1.0, flicker: true },
      ]},
      ME: { name: 'Nurse Station Ring', elements: [
        { t: 'bar', x: 14, z: 0, w: 0.7, d: 4.0, h: 1.05, col: 0x282c34, top: 0xc8d0d8, glow: 0x40c8e0, rotY: 0 },
        { t: 'console', x: 13, z: -2, w: 1.6, h: 0.95, d: 0.7, col: 0x282c34, glow: 0x40c8e0 },
        { t: 'console', x: 13, z: 2, w: 1.6, h: 0.95, d: 0.7, col: 0x282c34, glow: 0x40c8e0 },
        { t: 'cart', x: 16, z: -3, col: 0xa0a8b0 },
        { t: 'cov', x: 12.8, z: -0.5, w: 1.35, h: 0.88, d: 0.78, col: 0x3a4248, top: 0xc8e0e8 },
        { t: 'cov', x: 15.2, z: 3.5, w: 1.2, h: 0.85, d: 0.75, col: 0x3a4248, top: 0x40ff80 },
        { t: 'pend', x: 14, z: 0, col: 0x40c8e0, int: 1.4 },
      ]},
      BW: { name: 'MRI Lab', elements: [
        { t: 'plat', x: -14, z: -17, w: 4.5, d: 3.0, h: 0.5, col: 0x14181c, top: 0xc8d0d8, rim: 0x40c8e0 },
        { t: 'tall', x: -16, z: -22, w: 1.4, h: 2.4, d: 0.6, col: 0xc8d0d8, stripes: 4, stripe: 0x40c8e0 },
        { t: 'tall', x: -10, z: -22, w: 1.4, h: 2.4, d: 0.6, col: 0xc8d0d8, stripes: 4, stripe: 0x40c8e0 },
        { t: 'console', x: -14, z: -22, w: 1.6, h: 0.95, d: 0.7, col: 0x282c34, glow: 0x40c8e0 },
        { t: 'cov', x: -11.5, z: -20, w: 1.3, h: 0.85, d: 0.78, col: 0x3a4248, top: 0x40c8e0 },
        { t: 'cov', x: -16.5, z: -15, w: 1.22, h: 0.82, d: 0.72, col: 0x3a4248, top: 0xff5040 },
        { t: 'crate2', x: -10, z: -14, col: 0x282c34 },
        { t: 'pend', x: -14, z: -18, col: 0x40c8e0, int: 2.0 },
      ]},
      BE: { name: 'Surgical Prep', elements: [
        { t: 'curtainrow', x: 12, z: -16, rotY: 0 },
        { t: 'curtainrow', x: 16, z: -16, rotY: 0 },
        { t: 'cart', x: 14, z: -22, col: 0xa0a8b0 },
        { t: 'tall', x: 16.5, z: -19, w: 0.9, h: 2.0, d: 0.55, col: 0x282c34, stripes: 4, stripe: 0xff5040 },
        { t: 'cov', x: 14.5, z: -21, w: 1.28, h: 0.84, d: 0.75, col: 0x3a4248, top: 0x40c8e0 },
        { t: 'cov', x: 11.8, z: -18.5, w: 1.22, h: 0.82, d: 0.72, col: 0x3a4248, top: 0x40ff80 },
        { t: 'bench', x: 14, z: -14, w: 2.0, d: 0.55, h: 0.55, col: 0x3a4248, back: true },
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
        { t: 'cov', x: -11, z: 21, w: 1.3, h: 0.86, d: 0.78, col: 0x383c44, top: 0xfff060 },
        { t: 'cov', x: -15.5, z: 17, w: 1.25, h: 0.84, d: 0.74, col: 0x383c44, top: 0xff5040 },
        { t: 'cart', x: -16, z: 20, col: 0xa0a8b0 },
        { t: 'pend', x: -13, z: 18, col: 0xfff060, int: 1.4, flicker: true },
      ]},
      FC: { name: 'Mezzanine Hall', elements: [
        { t: 'turnstiles', x: -3, z: 22 },
        { t: 'turnstiles', x: 3, z: 22 },
        { t: 'benchrow', x: -3, z: 16 },
        { t: 'benchrow', x: 3, z: 16 },
        { t: 'cov', x: -5.5, z: 19, w: 1.3, h: 0.86, d: 0.78, col: 0x383c44, top: 0xfff060 },
        { t: 'cov', x: 5.5, z: 19, w: 1.3, h: 0.86, d: 0.78, col: 0x383c44, top: 0xff5040 },
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
        { t: 'cov', x: -12.8, z: -2.5, w: 1.4, h: 0.88, d: 0.8, col: 0x3a3c44, top: 0xfff060 },
        { t: 'cov', x: -12.8, z: 2.5, w: 1.4, h: 0.88, d: 0.8, col: 0x3a3c44, top: 0xff5040 },
        { t: 'crate2', x: -16, z: -4, col: 0x383c44 },
        { t: 'pend', x: -14, z: 0, col: 0xff5040, int: 1.6 },
      ]},
      ME: { name: 'Power Panel Annex', elements: [
        { t: 'tall', x: 17, z: -3, w: 0.9, h: 2.4, d: 0.5, col: 0x14161c, stripes: 4, stripe: 0xff5040, rotY: Math.PI/2 },
        { t: 'tall', x: 17, z: 3, w: 0.9, h: 2.4, d: 0.5, col: 0x14161c, stripes: 4, stripe: 0xff5040, rotY: Math.PI/2 },
        { t: 'console', x: 14, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xff5040 },
        { t: 'cov', x: 12.8, z: -2.4, w: 1.3, h: 0.86, d: 0.78, col: 0x383c44, top: 0xfff060 },
        { t: 'cov', x: 12.8, z: 2.4, w: 1.3, h: 0.86, d: 0.78, col: 0x383c44, top: 0xff5040 },
        { t: 'haz', x: 14, z: -4, w: 2.0, d: 1.4, col: 0x14140a, alpha: 0.85, glow: 0xff5040 },
        { t: 'pend', x: 14, z: 0, col: 0xff5040, int: 1.6, flicker: true },
      ]},
      BW: { name: 'Tunnel Junction', elements: [
        { t: 'track', x: -14, z: -16, len: 12, rotY: Math.PI/2, live: false },
        { t: 'pipes', x: -14, z: -22, len: 7 },
        { t: 'cart', x: -16, z: -19, col: 0xa0a8b0 },
        { t: 'cov', x: -12, z: -18, w: 1.35, h: 0.86, d: 0.78, col: 0x383c44, top: 0xfff060 },
        { t: 'cov', x: -15.5, z: -14.5, w: 1.28, h: 0.84, d: 0.75, col: 0x383c44, top: 0xff5040 },
        { t: 'tall', x: -10.5, z: -20, w: 0.85, h: 2.0, d: 0.52, col: 0x14161c, stripes: 4, stripe: 0xfff060 },
        { t: 'pend', x: -14, z: -16, col: 0xfff060, int: 1.2, flicker: true },
      ]},
      BE: { name: 'Dispatch Office', elements: [
        { t: 'desk', x: 13, z: -16, lx: 1.55, lz: 1.20 },
        { t: 'console', x: 16, z: -19, w: 1.6, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xfff060 },
        { t: 'tall', x: 12, z: -22, w: 0.9, h: 2.0, d: 0.55, col: 0x14161c, stripes: 3, stripe: 0xfff060 },
        { t: 'cov', x: 14.5, z: -14, w: 1.28, h: 0.84, d: 0.75, col: 0x383c44, top: 0xfff060 },
        { t: 'cov', x: 11.8, z: -20, w: 1.22, h: 0.82, d: 0.72, col: 0x383c44, top: 0xff5040 },
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
        { t: 'cov', x: -12.5, z: 21, w: 1.28, h: 0.84, d: 0.75, col: 0x3a3428, top: 0xa0c8ff },
        { t: 'cov', x: -15, z: 16.5, w: 1.22, h: 0.82, d: 0.73, col: 0x3a3428, top: 0xffe0a0 },
        { t: 'tall', x: -16.5, z: 14, w: 0.7, h: 2.0, d: 0.5, col: 0x282028, stripes: 3, stripe: 0xa0c8ff },
        { t: 'pipes', x: -12, z: 14, len: 4 },
        { t: 'pend', x: -13, z: 19, col: 0xffe0a0, int: 1.6 },
      ]},
      FC: { name: 'Salon Cabin', elements: [
        { t: 'bar', x: 0, z: 22, w: 5.0, d: 0.7, h: 1.05, col: 0x202028, top: 0xc8a070, glow: 0xa0c8ff },
        { t: 'bench', x: -3, z: 16, w: 2.4, d: 0.7, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'bench', x: 3, z: 16, w: 2.4, d: 0.7, h: 0.55, col: 0x4a3a20, back: true },
        { t: 'cov', x: -5.5, z: 19, w: 1.35, h: 0.86, d: 0.78, col: 0x3a3428, top: 0xffe0a0 },
        { t: 'cov', x: 5.5, z: 19, w: 1.35, h: 0.86, d: 0.78, col: 0x3a3428, top: 0xa0c8ff },
        { t: 'lamp', x: -5, z: 19, col: 0xffe0a0 },
        { t: 'lamp', x: 5, z: 19, col: 0xffe0a0 },
        { t: 'pend', x: 0, z: 18, col: 0xffe0a0, int: 2.0 },
      ]},
      FE: { name: 'Galley Pass', elements: [
        { t: 'bar', x: 14, z: 19, w: 0.7, d: 4.0, h: 1.05, col: 0x202028, top: 0xc8a070, glow: 0xa0c8ff, rotY: 0 },
        { t: 'vend', x: 16, z: 14, col: 0x282028 },
        { t: 'vend', x: 16, z: 22, col: 0x282028 },
        { t: 'cart', x: 12, z: 22, col: 0xa0a8b0 },
        { t: 'cov', x: 13.5, z: 21.5, w: 1.28, h: 0.84, d: 0.75, col: 0x3a3428, top: 0xffe0a0 },
        { t: 'cov', x: 11.8, z: 16.5, w: 1.22, h: 0.82, d: 0.72, col: 0x3a3428, top: 0xa0c8ff },
        { t: 'crate2', x: 12, z: 17, col: 0x4a3a20 },
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
        { t: 'cov', x: 13.5, z: -2.8, w: 1.3, h: 0.85, d: 0.76, col: 0x3a3428, top: 0xffe0a0 },
        { t: 'cov', x: 13.5, z: 2.8, w: 1.3, h: 0.85, d: 0.76, col: 0x3a3428, top: 0xa0c8ff },
        { t: 'lamp', x: 13, z: -5, col: 0xffe0a0 },
        { t: 'lamp', x: 13, z: 5, col: 0xffe0a0 },
        { t: 'pend', x: 14, z: 0, col: 0xffe0a0 },
      ]},
      BW: { name: 'Engine Room Pass', elements: [
        { t: 'tall', x: -14, z: -16, w: 1.4, h: 2.2, d: 0.6, col: 0x282028, stripes: 4, stripe: 0xff5040 },
        { t: 'tall', x: -14, z: -20, w: 1.4, h: 2.2, d: 0.6, col: 0x282028, stripes: 4, stripe: 0xff5040 },
        { t: 'pipes', x: -14, z: -18, len: 6 },
        { t: 'haz', x: -14, z: -22, w: 2.6, d: 1.4, col: 0x101010, alpha: 0.85, glow: 0xff5040 },
        { t: 'cov', x: -11.5, z: -18, w: 1.3, h: 0.84, d: 0.76, col: 0x3a3428, top: 0xa0c8ff },
        { t: 'cov', x: -16.5, z: -14, w: 1.22, h: 0.82, d: 0.72, col: 0x3a3428, top: 0xffe0a0 },
        { t: 'pend', x: -14, z: -18, col: 0xff5040, int: 1.4, flicker: true },
      ]},
      BE: { name: 'Bridge Approach', elements: [
        { t: 'console', x: 13, z: -16, w: 2.0, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xa0c8ff },
        { t: 'console', x: 13, z: -22, w: 2.0, h: 0.95, d: 0.7, col: 0x14161c, glow: 0xa0c8ff },
        { t: 'plat', x: 16, z: -19, w: 2.4, d: 4.5, h: 0.5, col: 0x282028, top: 0xc8a070, rim: 0xa0c8ff },
        { t: 'rail', x: 14.5, z: -19, len: 4.5, col: 0xa0c8ff, rotY: Math.PI/2 },
        { t: 'cov', x: 11.5, z: -17, w: 1.28, h: 0.84, d: 0.75, col: 0x3a3428, top: 0xffe0a0 },
        { t: 'cov', x: 14.5, z: -21, w: 1.25, h: 0.82, d: 0.73, col: 0x3a3428, top: 0xa0c8ff },
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
        { t: 'cov', x: -15.5, z: 20.5, w: 1.26, h: 0.83, d: 0.74, col: 0x101820, top: 0x40e0ff },
        { t: 'cov', x: -11, z: 15.5, w: 1.24, h: 0.82, d: 0.72, col: 0x101820, top: 0x60a0ff },
        { t: 'pipes', x: -16, z: 14, len: 4 },
        { t: 'pend', x: -13, z: 18, col: 0x40e0ff, int: 1.6 },
      ]},
      FC: { name: 'Cold Aisle North', elements: [
        { t: 'rackaisle', x: -3, z: 18, accent: 0x40e0ff },
        { t: 'rackaisle', x: 3, z: 18, accent: 0x60a0ff },
        { t: 'cov', x: 0, z: 15.5, w: 1.4, h: 0.88, d: 0.8, col: 0x101820, top: 0x40e0ff },
        { t: 'cov', x: -5, z: 20, w: 1.25, h: 0.85, d: 0.75, col: 0x101820, top: 0x60a0ff },
        { t: 'cov', x: 5, z: 20, w: 1.25, h: 0.85, d: 0.75, col: 0x101820, top: 0x40e0ff },
        { t: 'pend', x: 0, z: 22, col: 0x40e0ff, int: 1.6 },
      ]},
      FE: { name: 'Cold Aisle South', elements: [
        { t: 'rackaisle', x: 13, z: 18, accent: 0x60a0ff },
        { t: 'ac', x: 16, z: 22 },
        { t: 'cov', x: 14, z: 15.5, w: 1.3, h: 0.86, d: 0.78, col: 0x101820, top: 0x40e0ff },
        { t: 'cov', x: 12.5, z: 20.5, w: 1.2, h: 0.84, d: 0.74, col: 0x101820, top: 0xff5040 },
        { t: 'pipes', x: 11, z: 14, len: 5 },
        { t: 'tall', x: 16, z: 15, w: 0.75, h: 2.2, d: 0.45, col: 0x080a14, stripes: 5, stripe: 0xff5040 },
        { t: 'pend', x: 14, z: 18, col: 0x40e0ff, int: 1.4 },
      ]},
      MW: { name: 'Patch Panel Crawl', elements: [
        { t: 'tall', x: -16, z: -3, w: 0.9, h: 2.4, d: 0.45, col: 0x080a14, stripes: 5, stripe: 0x60a0ff, rotY: Math.PI/2 },
        { t: 'tall', x: -16, z: 3, w: 0.9, h: 2.4, d: 0.45, col: 0x080a14, stripes: 5, stripe: 0x60a0ff, rotY: Math.PI/2 },
        { t: 'console', x: -13, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x080a14, glow: 0x40e0ff },
        { t: 'pipes', x: -13, z: 4, len: 5, col: 0x282830 },
        { t: 'cov', x: -12.5, z: -5, w: 1.26, h: 0.83, d: 0.74, col: 0x101820, top: 0x60a0ff },
        { t: 'cov', x: -12.5, z: 5, w: 1.26, h: 0.83, d: 0.74, col: 0x101820, top: 0x40e0ff },
        { t: 'pend', x: -14, z: 0, col: 0x40e0ff, int: 1.4 },
      ]},
      ME: { name: 'Hot Aisle Spine', elements: [
        { t: 'rackaisle', x: 14, z: 0, accent: 0xff5040 },
        { t: 'hotaisle', x: 16, z: -2 },
        { t: 'cov', x: 12.8, z: 3.5, w: 1.28, h: 0.84, d: 0.75, col: 0x101820, top: 0x40e0ff },
        { t: 'cov', x: 15.2, z: -4, w: 1.25, h: 0.82, d: 0.73, col: 0x101820, top: 0xff5040 },
        { t: 'tall', x: 16.5, z: 4, w: 0.85, h: 2.2, d: 0.48, col: 0x080a14, stripes: 5, stripe: 0xff5040 },
        { t: 'pipes', x: 13, z: 1, len: 4 },
        { t: 'pend', x: 14, z: 0, col: 0xff5040, int: 1.4 },
      ]},
      BW: { name: 'Battery Backup Bay', elements: [
        { t: 'battery', x: -16, z: -14 },
        { t: 'battery', x: -13, z: -14 },
        { t: 'battery', x: -16, z: -18 },
        { t: 'battery', x: -13, z: -18 },
        { t: 'battery', x: -16, z: -22 },
        { t: 'battery', x: -13, z: -22 },
        { t: 'cov', x: -11.2, z: -18.5, w: 1.4, h: 0.88, d: 0.8, col: 0x101820, top: 0x40e0ff },
        { t: 'cov', x: -15.8, z: -21, w: 1.3, h: 0.86, d: 0.78, col: 0x101820, top: 0x60a0ff },
        { t: 'crate2', x: -11, z: -22, col: 0x202830 },
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
        { t: 'cov', x: -3.5, z: -13.8, w: 1.35, h: 0.86, d: 0.78, col: 0x101820, top: 0x60a0ff },
        { t: 'cov', x: 3.5, z: -13.8, w: 1.35, h: 0.86, d: 0.78, col: 0x101820, top: 0xff5040 },
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

  // ── 9: BORDER CROSSING — desert customs, sandstone watchtower ─────────
  9: {
    accent: 0xffb060, accentSoft: 0xffd090,
    cells: {
      FW: { name: 'Inspection Lane', elements: [
        { t: 'container', x: -14, z: 21, w: 4.6, d: 1.9, col: 0x8a6028 },
        { t: 'cart', x: -10, z: 18, col: 0x806040 },
        { t: 'drum', x: -12, z: 14, n: 3, col: 0xb8783c, stripe: 0xffd090 },
        { t: 'cov', x: -16, z: 17, w: 1.4, h: 0.85, d: 0.8, col: 0x4a3820, top: 0xffd090 },
        { t: 'cov', x: -11.5, z: 21.5, w: 1.25, h: 0.83, d: 0.74, col: 0x4a3820, top: 0xffb060 },
        { t: 'stack', x: -15, z: 14, w: 1.8, d: 1.2, h: 1.0, cols: [0x6a4828, 0x6a4828, 0x6a4828] },
        { t: 'lamp', x: -10, z: 22, col: 0xffd090 },
        { t: 'pend', x: -13, z: 19, col: 0xffb060, int: 1.7, r: 8 },
      ]},
      FC: { name: 'Customs Gate', elements: [
        { t: 'cov', x: -3, z: 22, w: 2.4, h: 0.9, d: 0.9, col: 0x6a4830, top: 0xffd090 },
        { t: 'cov', x: 3, z: 22, w: 2.4, h: 0.9, d: 0.9, col: 0x6a4830, top: 0xffd090 },
        { t: 'arch', x: 0, z: 19, w: 4.6, h: 2.8, col: 0x282018, accent: 0xffb060 },
        { t: 'pipes', x: 0, z: 23.5, len: 7 },
        { t: 'cov', x: -6, z: 16, w: 1.3, h: 0.86, d: 0.78, col: 0x4a3820, top: 0xffb060 },
        { t: 'cov', x: 6, z: 16, w: 1.3, h: 0.86, d: 0.78, col: 0x4a3820, top: 0xffd090 },
        { t: 'cart', x: 0, z: 14, col: 0x806040 },
        { t: 'pend', x: 0, z: 17, col: 0xffd090, int: 1.8, r: 9 },
      ]},
      FE: { name: 'Truck Bay', elements: [
        { t: 'container', x: 14, z: 21, w: 4.6, d: 1.9, col: 0x583820, rotY: Math.PI/2 },
        { t: 'forklift', x: 12, z: 17, rotY: -0.4 },
        { t: 'stack', x: 15, z: 15, w: 2.4, d: 1.4, h: 1.2, cols: [0x6a4828, 0x6a4828, 0x6a4828] },
        { t: 'cov', x: 11.5, z: 21, w: 1.28, h: 0.84, d: 0.75, col: 0x4a3420, top: 0xffd090 },
        { t: 'cov', x: 15.5, z: 16.5, w: 1.22, h: 0.82, d: 0.72, col: 0x4a3420, top: 0xffb060 },
        { t: 'pend', x: 13, z: 18, col: 0xffb060, int: 1.5, r: 7 },
        { t: 'haz', x: 14, z: 22, w: 2.0, d: 1.4, col: 0x141008, alpha: 0.8, glow: 0xff7030 },
      ]},
      MW: { name: 'Border Office', elements: [
        { t: 'desk', x: -14, z: 0, lx: 1.55, lz: 1.20 },
        { t: 'tall', x: -16, z: -4, w: 0.85, h: 2.0, d: 0.55, col: 0x282018, stripes: 3, stripe: 0xffb060 },
        { t: 'console', x: -14, z: 4.5, w: 1.6, h: 0.95, d: 0.7, col: 0x14100a, glow: 0xffd090 },
        { t: 'bench', x: -16, z: 2, w: 0.6, d: 2.0, h: 0.55, col: 0x4a3820, rotY: Math.PI/2 },
        { t: 'cov', x: -12.5, z: -2.2, w: 1.4, h: 0.88, d: 0.8, col: 0x4a3820, top: 0xffd090 },
        { t: 'cov', x: -12.5, z: 2.2, w: 1.4, h: 0.88, d: 0.8, col: 0x4a3820, top: 0xffb060 },
        { t: 'pend', x: -14, z: 0, col: 0xffd090, int: 1.4, r: 6 },
      ]},
      ME: { name: 'Vehicle Search', elements: [
        { t: 'cart', x: 14, z: -2, col: 0x8a4020 },
        { t: 'cart', x: 16, z: 3, col: 0x806020, rotY: 0.3 },
        { t: 'drum', x: 14, z: 4, n: 4, col: 0xb8783c, stripe: 0xffd090 },
        { t: 'cov', x: 13, z: -4, w: 2.2, h: 0.85, d: 0.8, col: 0x4a3420, top: 0xffd090 },
        { t: 'cov', x: 12.5, z: 3, w: 1.35, h: 0.86, d: 0.78, col: 0x4a3420, top: 0xffb060 },
        { t: 'console', x: 16, z: -4, w: 1.5, h: 0.95, d: 0.7, col: 0x14100a, glow: 0xffb060 },
        { t: 'pipes', x: 13, z: 0, len: 5 },
        { t: 'pend', x: 14.5, z: 1, col: 0xffb060, int: 1.5 },
      ]},
      BW: { name: 'Watchtower Base', elements: [
        { t: 'tall', x: -16, z: -14, w: 1.2, h: 2.6, d: 0.7, col: 0x282018, stripes: 4, stripe: 0xffb060 },
        { t: 'tall', x: -14, z: -19, w: 1.0, h: 2.4, d: 0.5, col: 0x202018 },
        { t: 'plat', x: -14, z: -17, w: 3.6, d: 2.0, h: 0.85, col: 0x3a2818, top: 0x6a4830, rim: 0xffb060 },
        { t: 'rail', x: -14, z: -16.0, len: 3.6, col: 0xa0a8b0 },
        { t: 'cov', x: -11.5, z: -18, w: 1.35, h: 0.86, d: 0.78, col: 0x4a3820, top: 0xffd090 },
        { t: 'cov', x: -16.5, z: -21, w: 1.25, h: 0.82, d: 0.73, col: 0x4a3820, top: 0xffb060 },
        { t: 'crate2', x: -11, z: -22, col: 0x6a4828 },
        { t: 'pend', x: -14, z: -14, col: 0xffb060, int: 1.4 },
      ]},
      BE: { name: 'Sand Vent Bypass', elements: [
        { t: 'pipes', x: 14, z: -17, len: 8 },
        { t: 'cov', x: 14, z: -20, w: 2.0, h: 0.85, d: 0.8, col: 0x4a3420, top: 0xffd090 },
        { t: 'crate2', x: 16, z: -14, col: 0x6a4828 },
        { t: 'tall', x: 12, z: -19, w: 0.85, h: 2.2, d: 0.5, col: 0x282018, stripes: 3, stripe: 0xffb060 },
        { t: 'cov', x: 11.8, z: -16.5, w: 1.22, h: 0.82, d: 0.72, col: 0x4a3420, top: 0xffb060 },
        { t: 'pend', x: 13.5, z: -14, col: 0xffd090 },
      ]},
      BC: { name: 'Customs Office', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.6, h: 2.8, col: 0x14100a, accent: 0xffb060 },
        { t: 'tall', x: -3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x282018, stripes: 4, stripe: 0xffb060 },
        { t: 'tall', x: 3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x282018, stripes: 4, stripe: 0xffb060 },
        { t: 'desk', x: 0, z: -16, lx: 1.6, lz: 1.2 },
        { t: 'console', x: -4, z: -14, w: 1.6, h: 0.95, d: 0.7, col: 0x140a06, glow: 0xffd090 },
        { t: 'cov', x: -5.5, z: -14.2, w: 1.35, h: 0.86, d: 0.78, col: 0x4a3420, top: 0xffd090 },
        { t: 'cov', x: 5.5, z: -14.2, w: 1.35, h: 0.86, d: 0.78, col: 0x4a3420, top: 0xffb060 },
        { t: 'drum', x: 0, z: -21, n: 2, col: 0xb8783c, stripe: 0xffd090 },
        { t: 'pipes', x: -14, z: -18, len: 5 },
        { t: 'pend', x: 0, z: -17, col: 0xffb060, int: 2.4, r: 12 },
      ]},
    },
    lights: [
      { x: -14.5, y: 3.6, z: 18, col: 0xffb060, int: 1.4, r: 12, flicker: true },
      { x:  14.5, y: 3.6, z: 18, col: 0xffd090, int: 1.2, r: 12 },
      { x: -14, y: 3.6, z: -18, col: 0xffb060, int: 1.8, r: 14 },
      { x:  14, y: 3.6, z: -18, col: 0x8090c0, int: 0.9, r: 11 },
    ],
  },

  // ── 10: CATHEDRAL OF SAN MARCO — gothic vault, candles, marble ─────────
  10: {
    accent: 0xffe8b0, accentSoft: 0xfff0d0,
    cells: {
      FW: { name: 'North Transept', elements: [
        { t: 'plinth', x: -14, z: 22 },
        { t: 'lamp', x: -16, z: 18, col: 0xffe8b0 },
        { t: 'bench', x: -13, z: 17, w: 3.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'bench', x: -13, z: 21, w: 3.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'cov', x: -15.2, z: 19, w: 1.25, h: 0.86, d: 0.76, col: 0x281810, top: 0xffe8b0 },
        { t: 'pend', x: -13, z: 19, col: 0xffe8b0, int: 1.6 },
      ]},
      FC: { name: 'Nave', elements: [
        { t: 'bench', x: -3, z: 22, w: 2.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'bench', x: 3, z: 22, w: 2.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'bench', x: -3, z: 17, w: 2.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'bench', x: 3, z: 17, w: 2.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'lamp', x: -5, z: 19, col: 0xffe8b0 },
        { t: 'lamp', x: 5, z: 19, col: 0xffe8b0 },
        { t: 'pend', x: 0, z: 20, col: 0xffe8b0, int: 2.0, r: 11 },
      ]},
      FE: { name: 'South Transept', elements: [
        { t: 'plinth', x: 14, z: 22 },
        { t: 'lamp', x: 16, z: 18, col: 0xffe8b0 },
        { t: 'bench', x: 13, z: 17, w: 3.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'bench', x: 13, z: 21, w: 3.0, d: 0.55, h: 0.55, col: 0x281810 },
        { t: 'cov', x: 15.2, z: 19, w: 1.25, h: 0.86, d: 0.76, col: 0x281810, top: 0xffe8b0 },
        { t: 'pend', x: 13, z: 19, col: 0xffe8b0, int: 1.6 },
      ]},
      MW: { name: 'Confessionals', elements: [
        { t: 'tall', x: -15, z: -2, w: 1.6, h: 2.4, d: 1.2, col: 0x281810, stripes: 2, stripe: 0xffe8b0 },
        { t: 'tall', x: -15, z: 3, w: 1.6, h: 2.4, d: 1.2, col: 0x281810, stripes: 2, stripe: 0xffe8b0 },
        { t: 'lamp', x: -13, z: 0, col: 0xffe8b0 },
        { t: 'cov', x: -12, z: 4, w: 1.6, h: 0.9, d: 0.7, col: 0x281810, top: 0xffe8b0 },
        { t: 'cov', x: -12, z: -4, w: 1.5, h: 0.88, d: 0.72, col: 0x281810, top: 0xffd090 },
        { t: 'bench', x: -16.5, z: 0, w: 0.65, d: 2.2, h: 0.55, col: 0x281810, rotY: Math.PI/2 },
        { t: 'pend', x: -13, z: -2, col: 0xffe8b0, int: 1.4 },
      ]},
      ME: { name: 'Choir Loft Stair', elements: [
        { t: 'plat', x: 14, z: 2, w: 3.6, d: 2.0, h: 0.85, col: 0x281810, top: 0x6a4830, rim: 0xffe8b0 },
        { t: 'rail', x: 14, z: 3.0, len: 3.6, col: 0xa08c60 },
        { t: 'tall', x: 16, z: -2, w: 1.0, h: 2.4, d: 0.6, col: 0x281810, stripes: 4, stripe: 0xffe8b0 },
        { t: 'lamp', x: 14, z: -2, col: 0xffe8b0 },
        { t: 'cov', x: 12.5, z: -4.5, w: 1.28, h: 0.84, d: 0.75, col: 0x281810, top: 0xffe8b0 },
        { t: 'cov', x: 12.5, z: 4.2, w: 1.25, h: 0.82, d: 0.73, col: 0x281810, top: 0xffd090 },
        { t: 'crate2', x: 13, z: 5, col: 0x382418 },
        { t: 'pend', x: 14, z: 1, col: 0xffe8b0, int: 1.6 },
      ]},
      BW: { name: 'Reliquary Vault', elements: [
        { t: 'plinth', x: -14, z: -18 },
        { t: 'plinth', x: -12, z: -14 },
        { t: 'tall', x: -16, z: -16, w: 1.0, h: 2.4, d: 0.6, col: 0x281810, stripes: 4, stripe: 0xffd090 },
        { t: 'lamp', x: -14, z: -20, col: 0xffe8b0 },
        { t: 'cov', x: -11.5, z: -18, w: 1.35, h: 0.86, d: 0.78, col: 0x281810, top: 0xffe8b0 },
        { t: 'cov', x: -15.5, z: -21, w: 1.28, h: 0.84, d: 0.75, col: 0x281810, top: 0xffd090 },
        { t: 'bench', x: -13, z: -22, w: 2.4, d: 0.55, h: 0.55, col: 0x281810, back: true },
        { t: 'pend', x: -13, z: -16, col: 0xffd090, int: 1.4 },
      ]},
      BE: { name: 'Bell Stair', elements: [
        { t: 'plat', x: 14, z: -18, w: 4.0, d: 2.4, h: 0.85, col: 0x281810, top: 0x6a4830, rim: 0xffe8b0 },
        { t: 'rail', x: 14, z: -16.7, len: 4.0, col: 0xa08c60 },
        { t: 'tall', x: 16, z: -14, w: 1.0, h: 2.6, d: 0.6, col: 0x281810, stripes: 5, stripe: 0xffd090 },
        { t: 'lamp', x: 14, z: -14, col: 0xffe8b0 },
        { t: 'cov', x: 12.5, z: -17, w: 1.28, h: 0.84, d: 0.75, col: 0x281810, top: 0xffe8b0 },
        { t: 'cov', x: 15.2, z: -20.5, w: 1.22, h: 0.82, d: 0.72, col: 0x281810, top: 0xffd090 },
        { t: 'pend', x: 13.5, z: -14, col: 0xffe8b0 },
      ]},
      BC: { name: 'High Altar', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.8, h: 3.0, col: 0x14100a, accent: 0xffd090 },
        { t: 'plinth', x: 0, z: -17 },
        { t: 'tall', x: -3, z: -19, w: 1.0, h: 2.6, d: 0.6, col: 0x281810, stripes: 5, stripe: 0xffd090 },
        { t: 'tall', x: 3, z: -19, w: 1.0, h: 2.6, d: 0.6, col: 0x281810, stripes: 5, stripe: 0xffd090 },
        { t: 'lamp', x: -4, z: -14, col: 0xffe8b0 },
        { t: 'lamp', x: 4, z: -14, col: 0xffe8b0 },
        { t: 'cov', x: -4.5, z: -15.5, w: 1.4, h: 0.88, d: 0.8, col: 0x281810, top: 0xffe8b0 },
        { t: 'cov', x: 4.5, z: -15.5, w: 1.4, h: 0.88, d: 0.8, col: 0x281810, top: 0xffd090 },
        { t: 'pend', x: 0, z: -17, col: 0xffe8b0, int: 2.8, r: 14 },
      ]},
    },
    lights: [
      { x: -14, y: 4.0, z: 18, col: 0xffe8b0, int: 1.4, r: 12 },
      { x:  14, y: 4.0, z: 18, col: 0xffd090, int: 1.4, r: 12 },
      { x: -14, y: 4.0, z: -18, col: 0xffd090, int: 1.6, r: 13, flicker: true },
      { x:  14, y: 4.0, z: -18, col: 0xffe8b0, int: 1.6, r: 13 },
    ],
  },

  // ── 11: KARELIA FREIGHTER — open ocean cargo deck ─────────────────────
  11: {
    accent: 0x80b0d0, accentSoft: 0xa0c0e0,
    cells: {
      FW: { name: 'Port Container Row', elements: [
        { t: 'container', x: -13, z: 22, w: 4.6, d: 1.9, col: 0x405060 },
        { t: 'container', x: -10, z: 18, w: 4.0, d: 1.8, col: 0x6a4830, rotY: Math.PI/2 },
        { t: 'cov', x: -16, z: 19, w: 1.4, h: 0.85, d: 0.8, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: -11.5, z: 21, w: 1.25, h: 0.83, d: 0.74, col: 0x2a323a, top: 0xff8040 },
        { t: 'cart', x: -15, z: 14, col: 0x6a4830 },
        { t: 'pend', x: -12, z: 20, col: 0x80b0d0, int: 1.4 },
        { t: 'pipes', x: -16, z: 14, len: 6 },
      ]},
      FC: { name: 'Cargo Spine', elements: [
        { t: 'container', x: -3, z: 22, w: 4.0, d: 1.8, col: 0x405060, rotY: Math.PI/2 },
        { t: 'container', x: 3, z: 22, w: 4.0, d: 1.8, col: 0x6a4830, rotY: Math.PI/2 },
        { t: 'drum', x: 0, z: 16, n: 3, col: 0xb8783c, stripe: 0x80b0d0 },
        { t: 'cov', x: -5.5, z: 18.5, w: 1.35, h: 0.86, d: 0.78, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: 5.5, z: 18.5, w: 1.35, h: 0.86, d: 0.78, col: 0x2a323a, top: 0xa0c0e0 },
        { t: 'pend', x: 0, z: 19, col: 0xa0c0e0, int: 1.8, r: 9 },
        { t: 'pipes', x: 0, z: 23.5, len: 7 },
      ]},
      FE: { name: 'Starboard Container Row', elements: [
        { t: 'container', x: 13, z: 22, w: 4.6, d: 1.9, col: 0x483a28 },
        { t: 'container', x: 10, z: 18, w: 4.0, d: 1.8, col: 0x405060, rotY: Math.PI/2 },
        { t: 'cart', x: 14, z: 14, col: 0x6a4830 },
        { t: 'cov', x: 12.5, z: 17, w: 1.3, h: 0.85, d: 0.76, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: 15.5, z: 19.5, w: 1.25, h: 0.83, d: 0.74, col: 0x2a323a, top: 0xff8040 },
        { t: 'drum', x: 11.5, z: 21, n: 2, col: 0x6a5030, stripe: 0xa0c0e0 },
        { t: 'pend', x: 12.5, z: 20, col: 0x80b0d0, int: 1.4 },
      ]},
      MW: { name: 'Engine Companionway', elements: [
        { t: 'tall', x: -16, z: -2, w: 0.85, h: 2.4, d: 0.4, col: 0x1a2028, stripes: 3, stripe: 0xff8040 },
        { t: 'pipes', x: -13, z: 0, len: 7 },
        { t: 'cov', x: -13, z: 4, w: 2.0, h: 0.85, d: 0.8, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: -12.5, z: -4.5, w: 1.28, h: 0.84, d: 0.75, col: 0x2a323a, top: 0xff8040 },
        { t: 'console', x: -14, z: -4, w: 1.6, h: 0.95, d: 0.7, col: 0x10141c, glow: 0xff8040 },
        { t: 'pend', x: -14, z: -2, col: 0xff8040, int: 1.6 },
      ]},
      ME: { name: 'Deck Lift', elements: [
        { t: 'plat', x: 14, z: -2, w: 3.6, d: 2.4, h: 0.85, col: 0x2a323a, top: 0x405060, rim: 0x80b0d0 },
        { t: 'rail', x: 14, z: -0.8, len: 3.6, col: 0xa0a8b0 },
        { t: 'drum', x: 16, z: 4, n: 3, col: 0xb8783c, stripe: 0x80b0d0 },
        { t: 'cov', x: 12.8, z: -3.2, w: 1.3, h: 0.84, d: 0.76, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: 12.8, z: 3.2, w: 1.3, h: 0.84, d: 0.76, col: 0x2a323a, top: 0xff8040 },
        { t: 'pend', x: 14.5, z: 1, col: 0x80b0d0 },
      ]},
      BW: { name: 'Aft Engine Hood', elements: [
        { t: 'tall', x: -16, z: -14, w: 1.2, h: 2.6, d: 0.7, col: 0x1a2028, stripes: 4, stripe: 0xff8040 },
        { t: 'tall', x: -16, z: -19, w: 1.0, h: 2.4, d: 0.5, col: 0x1a2028 },
        { t: 'haz', x: -14, z: -17, w: 2.4, d: 1.6, col: 0x14080a, alpha: 0.85, glow: 0xff5040 },
        { t: 'pipes', x: -13, z: -20, len: 7 },
        { t: 'cov', x: -11.5, z: -18, w: 1.35, h: 0.86, d: 0.78, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: -15.5, z: -21, w: 1.25, h: 0.82, d: 0.73, col: 0x2a323a, top: 0xff8040 },
        { t: 'pend', x: -13, z: -14, col: 0xff8040, int: 1.6 },
      ]},
      BE: { name: 'Crew Companionway', elements: [
        { t: 'plat', x: 14, z: -18, w: 3.6, d: 2.4, h: 0.85, col: 0x2a323a, top: 0x60686e, rim: 0x80b0d0 },
        { t: 'rail', x: 14, z: -16.7, len: 3.6, col: 0xa0a8b0 },
        { t: 'tall', x: 16, z: -14, w: 1.0, h: 2.4, d: 0.6, col: 0x1a2028, stripes: 4, stripe: 0x80b0d0 },
        { t: 'cov', x: 12.5, z: -17, w: 1.28, h: 0.84, d: 0.75, col: 0x2a323a, top: 0x80b0d0 },
        { t: 'cov', x: 15.2, z: -20.5, w: 1.22, h: 0.82, d: 0.72, col: 0x2a323a, top: 0xff8040 },
        { t: 'cart', x: 12, z: -22, col: 0x6a4830 },
        { t: 'pend', x: 13.5, z: -14, col: 0x80b0d0 },
      ]},
      BC: { name: 'Bridge Approach', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 4.2, h: 2.8, col: 0x10141c, accent: 0x80b0d0 },
        { t: 'tall', x: -3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x1a2028, stripes: 4, stripe: 0x80b0d0 },
        { t: 'tall', x: 3, z: -19, w: 1.0, h: 2.4, d: 0.6, col: 0x1a2028, stripes: 4, stripe: 0x80b0d0 },
        { t: 'console', x: 0, z: -16, w: 1.8, h: 1.0, d: 0.8, col: 0x080c14, glow: 0x80b0d0 },
        { t: 'pend', x: 0, z: -17, col: 0x80b0d0, int: 2.2, r: 12 },
        { t: 'haz', x: 0, z: -22, w: 4.0, d: 1.6, col: 0x06080a, alpha: 0.9, glow: 0xff8040 },
      ]},
    },
    lights: [
      { x: -14, y: 3.6, z: 18, col: 0x80b0d0, int: 1.3, r: 12 },
      { x:  14, y: 3.6, z: 18, col: 0xa0c0e0, int: 1.1, r: 12 },
      { x: -14, y: 3.6, z: -18, col: 0xff8040, int: 1.6, r: 13, flicker: true },
      { x:  14, y: 3.6, z: -18, col: 0x80b0d0, int: 1.4, r: 12 },
    ],
  },

  // ── 12: THE SPIRE — apex executive tower + helipad ─────────────────────
  12: {
    accent: 0xc8e0ff, accentSoft: 0xe0eaff,
    cells: {
      FW: { name: 'Glass Atrium West', elements: [
        { t: 'plinth', x: -14, z: 22 },
        { t: 'bench', x: -13, z: 17, w: 3.0, d: 0.7, h: 0.55, col: 0x10141c, back: true },
        { t: 'lamp', x: -16, z: 19, col: 0xc8e0ff },
        { t: 'cov', x: -15.5, z: 16.5, w: 1.3, h: 0.84, d: 0.76, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: -11.5, z: 21, w: 1.25, h: 0.82, d: 0.74, col: 0x10141c, top: 0xffd060 },
        { t: 'tall', x: -16.5, z: 14, w: 0.7, h: 2.0, d: 0.5, col: 0x06070a, stripes: 4, stripe: 0xc8e0ff },
        { t: 'pipes', x: -12, z: 14, len: 5 },
        { t: 'pend', x: -13, z: 19, col: 0xc8e0ff, int: 1.6, r: 9 },
      ]},
      FC: { name: 'Reception Court', elements: [
        { t: 'desk', x: 0, z: 22, lx: 1.8, lz: 1.4 },
        { t: 'plinth', x: -5, z: 18 },
        { t: 'plinth', x: 5, z: 18 },
        { t: 'cov', x: -4.5, z: 15.5, w: 1.35, h: 0.88, d: 0.78, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: 4.5, z: 15.5, w: 1.35, h: 0.88, d: 0.78, col: 0x10141c, top: 0xffd060 },
        { t: 'lamp', x: -4, z: 14, col: 0xc8e0ff },
        { t: 'lamp', x: 4, z: 14, col: 0xc8e0ff },
        { t: 'pend', x: 0, z: 17, col: 0xc8e0ff, int: 2.4, r: 12 },
      ]},
      FE: { name: 'Glass Atrium East', elements: [
        { t: 'plinth', x: 14, z: 22 },
        { t: 'bench', x: 13, z: 17, w: 3.0, d: 0.7, h: 0.55, col: 0x10141c, back: true },
        { t: 'lamp', x: 16, z: 19, col: 0xc8e0ff },
        { t: 'cov', x: 15.5, z: 16.5, w: 1.3, h: 0.84, d: 0.76, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: 11.5, z: 21, w: 1.25, h: 0.82, d: 0.74, col: 0x10141c, top: 0xffd060 },
        { t: 'tall', x: 16.5, z: 14, w: 0.7, h: 2.0, d: 0.5, col: 0x06070a, stripes: 4, stripe: 0xffd060 },
        { t: 'cart', x: 12, z: 14, col: 0x303840 },
        { t: 'pend', x: 13, z: 19, col: 0xc8e0ff, int: 1.6, r: 9 },
      ]},
      MW: { name: 'Boardroom', elements: [
        { t: 'desk', x: -14, z: 0, lx: 1.6, lz: 4.0 },
        { t: 'bench', x: -16, z: -3, w: 0.7, d: 2.4, h: 0.55, col: 0x10141c, back: true, rotY: Math.PI/2 },
        { t: 'bench', x: -16, z: 3, w: 0.7, d: 2.4, h: 0.55, col: 0x10141c, back: true, rotY: Math.PI/2 },
        { t: 'console', x: -12, z: 0, w: 1.6, h: 0.95, d: 0.7, col: 0x06070a, glow: 0xffd060 },
        { t: 'cov', x: -12.8, z: -2.5, w: 1.25, h: 0.85, d: 0.74, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: -12.8, z: 2.5, w: 1.25, h: 0.85, d: 0.74, col: 0x10141c, top: 0xffd060 },
        { t: 'pend', x: -14, z: 0, col: 0xffd060, int: 1.8, r: 9 },
      ]},
      ME: { name: 'Executive Vault', elements: [
        { t: 'tall', x: 16, z: -3, w: 1.4, h: 2.4, d: 0.8, col: 0x06070a, stripes: 3, stripe: 0xffd060 },
        { t: 'tall', x: 16, z: 3, w: 1.4, h: 2.4, d: 0.8, col: 0x06070a, stripes: 3, stripe: 0xffd060 },
        { t: 'console', x: 14, z: 0, w: 1.8, h: 1.0, d: 0.8, col: 0x06070a, glow: 0xffd060 },
        { t: 'haz', x: 14.5, z: 4, w: 2.2, d: 1.4, col: 0x040608, alpha: 0.85, glow: 0xffd060 },
        { t: 'cov', x: 12.8, z: -4.5, w: 1.28, h: 0.84, d: 0.75, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: 12.8, z: 4.5, w: 1.25, h: 0.82, d: 0.73, col: 0x10141c, top: 0xffd060 },
        { t: 'pend', x: 14, z: 0, col: 0xffd060, int: 1.6, r: 9 },
      ]},
      BW: { name: 'Maintenance Spine', elements: [
        { t: 'tall', x: -16, z: -14, w: 1.0, h: 2.6, d: 0.6, col: 0x06070a, stripes: 4, stripe: 0xc8e0ff },
        { t: 'pipes', x: -13, z: -17, len: 7 },
        { t: 'cov', x: -13, z: -20, w: 2.0, h: 0.85, d: 0.8, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: -15.5, z: -16, w: 1.28, h: 0.83, d: 0.75, col: 0x10141c, top: 0xffd060 },
        { t: 'crate2', x: -11, z: -18, col: 0x202830 },
        { t: 'pend', x: -13, z: -16, col: 0xc8e0ff, int: 1.4 },
      ]},
      BE: { name: 'Helipad Stair', elements: [
        { t: 'plat', x: 14, z: -18, w: 4.2, d: 2.4, h: 0.85, col: 0x06070a, top: 0x202a38, rim: 0xc8e0ff },
        { t: 'rail', x: 14, z: -16.7, len: 4.2, col: 0xa0c0e0 },
        { t: 'catwalk', x: 13, z: -22, len: 8, rotY: Math.PI/2 },
        { t: 'crate2', x: 16, z: -14, col: 0x10141c },
        { t: 'cov', x: 12.5, z: -16.5, w: 1.28, h: 0.84, d: 0.75, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: 15.2, z: -20.5, w: 1.22, h: 0.82, d: 0.72, col: 0x10141c, top: 0xffd060 },
        { t: 'pend', x: 13.5, z: -14, col: 0xc8e0ff },
      ]},
      BC: { name: 'Helipad Apex', elements: [
        { t: 'arch', x: 0, z: -10.5, w: 5.0, h: 3.2, col: 0x06070a, accent: 0xc8e0ff },
        { t: 'tall', x: -3, z: -19, w: 1.2, h: 2.6, d: 0.6, col: 0x06070a, stripes: 5, stripe: 0xc8e0ff },
        { t: 'tall', x: 3, z: -19, w: 1.2, h: 2.6, d: 0.6, col: 0x06070a, stripes: 5, stripe: 0xc8e0ff },
        { t: 'console', x: -4, z: -15, w: 1.6, h: 0.95, d: 0.7, col: 0x040608, glow: 0xc8e0ff },
        { t: 'console', x: 4, z: -15, w: 1.6, h: 0.95, d: 0.7, col: 0x040608, glow: 0xffd060 },
        { t: 'cov', x: -4.5, z: -17.2, w: 1.35, h: 0.88, d: 0.8, col: 0x10141c, top: 0xc8e0ff },
        { t: 'cov', x: 4.5, z: -17.2, w: 1.35, h: 0.88, d: 0.8, col: 0x10141c, top: 0xffd060 },
        { t: 'pend', x: 0, z: -17, col: 0xc8e0ff, int: 3.0, r: 14 },
        { t: 'haz', x: 0, z: -22, w: 4.6, d: 1.8, col: 0x06080c, alpha: 0.92, glow: 0xc8e0ff },
      ]},
    },
    lights: [
      { x: -14, y: 4.4, z: 18, col: 0xc8e0ff, int: 1.6, r: 12 },
      { x:  14, y: 4.4, z: 18, col: 0xc8e0ff, int: 1.6, r: 12 },
      { x: -14, y: 4.4, z: -18, col: 0xffd060, int: 1.4, r: 11 },
      { x:  14, y: 4.4, z: -18, col: 0xc8e0ff, int: 1.8, r: 14, flicker: true },
    ],
  },
};

/** Exported for `scripts/sequence-def-density-audit.mjs` and tooling. */
export { SEQUENCE_DEFS };


const ENCOUNTER_BEATS = {
  read: { label: 'READ', intent: 'Let the player parse route, cover, and first threat.' },
  brawl: { label: 'BRAWL', intent: 'Fast crossfire with flank pressure.' },
  hold: { label: 'HOLD', intent: 'Territory pressure and delayed reinforcements.' },
  snipe: { label: 'SNIPE', intent: 'Long lane control and precision tells.' },
  stealth_or_loud: { label: 'QUIET/LOUD', intent: 'Suppressed entry can stay calm, loud entry escalates.' },
  boss: { label: 'BOSS', intent: 'Back-zone lieutenant or final target threshold.' },
};

const DEFAULT_ZONE_ROLES = [
  { tag: 'read', verb: 'push', reinforce: 'scout', telegraph: 'door-light' },
  { tag: 'brawl', verb: 'flank', reinforce: 'riot', telegraph: 'rumble' },
  { tag: 'boss', verb: 'clear', reinforce: 'heavy', telegraph: 'target-banner' },
];

const BUILDING_ZONE_ROLES = {
  1: [
    { tag: 'read', verb: 'breach', reinforce: 'scout', telegraph: 'forklift strobes' },
    { tag: 'brawl', verb: 'silence', reinforce: 'demolitions', telegraph: 'alarm relay' },
    { tag: 'boss', verb: 'finish', reinforce: 'heavy', telegraph: 'loading cage' },
  ],
  2: [
    { tag: 'read', verb: 'restrain', reinforce: 'pistolero', telegraph: 'hostage line' },
    { tag: 'hold', verb: 'protect', reinforce: 'riot', telegraph: 'lobby breach' },
    { tag: 'boss', verb: 'extract', reinforce: 'heavy', telegraph: 'concierge gate' },
  ],
  3: [
    { tag: 'read', verb: 'enter', reinforce: 'scout', telegraph: 'dance-floor pulse' },
    { tag: 'brawl', verb: 'collapse', reinforce: 'demolitions', telegraph: 'VIP doors' },
    { tag: 'boss', verb: 'corner', reinforce: 'riot', telegraph: 'mirror lounge' },
  ],
  4: [
    { tag: 'snipe', verb: 'ascend', reinforce: 'marksman', telegraph: 'glass glint' },
    { tag: 'brawl', verb: 'cross', reinforce: 'heavy', telegraph: 'skyline rail' },
    { tag: 'boss', verb: 'execute', reinforce: 'marksman', telegraph: 'suite arch' },
  ],
  5: [
    { tag: 'stealth_or_loud', verb: 'triage', reinforce: 'drone', telegraph: 'blackout flicker' },
    { tag: 'hold', verb: 'restore', reinforce: 'riot', telegraph: 'ICU doors' },
    { tag: 'boss', verb: 'expose', reinforce: 'marksman', telegraph: 'surgical pit' },
  ],
  6: [
    { tag: 'read', verb: 'enter', reinforce: 'scout', telegraph: 'platform signs' },
    { tag: 'hold', verb: 'survive', reinforce: 'demolitions', telegraph: 'train rumble' },
    { tag: 'boss', verb: 'route', reinforce: 'riot', telegraph: 'switch chamber' },
  ],
  7: [
    { tag: 'stealth_or_loud', verb: 'board', reinforce: 'marksman', telegraph: 'deck lights' },
    { tag: 'brawl', verb: 'repel', reinforce: 'demolitions', telegraph: 'crew hatch' },
    { tag: 'boss', verb: 'claim', reinforce: 'heavy', telegraph: 'bridge suite' },
  ],
  8: [
    { tag: 'snipe', verb: 'pierce', reinforce: 'marksman', telegraph: 'cold aisle beams' },
    { tag: 'brawl', verb: 'lockdown', reinforce: 'drone', telegraph: 'battery bay' },
    { tag: 'boss', verb: 'end', reinforce: 'riot', telegraph: 'core protocol' },
  ],
  // ── ACT III — The Apparatus ───────────────────────────────────────────
  9: [
    { tag: 'snipe', verb: 'enter', reinforce: 'marksman', telegraph: 'watchtower beam' },
    { tag: 'brawl', verb: 'intercept', reinforce: 'soldier', telegraph: 'customs crush' },
    { tag: 'boss', verb: 'hold', reinforce: 'demolitions', telegraph: 'border office shutter' },
  ],
  10: [
    { tag: 'stealth_or_loud', verb: 'enter', reinforce: 'pistolero', telegraph: 'votive bells' },
    { tag: 'brawl', verb: 'ascend', reinforce: 'riot', telegraph: 'choir loft echo' },
    { tag: 'boss', verb: 'unseal', reinforce: 'heavy', telegraph: 'bell-tower toll' },
  ],
  11: [
    { tag: 'hold', verb: 'board', reinforce: 'heavy', telegraph: 'horn cycle' },
    { tag: 'brawl', verb: 'cross', reinforce: 'drone', telegraph: 'engine rumble' },
    { tag: 'boss', verb: 'pilot', reinforce: 'marksman', telegraph: 'bridge spotlight' },
  ],
  12: [
    { tag: 'snipe', verb: 'ascend', reinforce: 'marksman', telegraph: 'glass glint' },
    { tag: 'brawl', verb: 'crown', reinforce: 'drone', telegraph: 'vault siren' },
    { tag: 'boss', verb: 'apex', reinforce: 'lieutenant', telegraph: 'helipad rotor' },
  ],
};

/** Per-building bone pass after shared `buildCellSkeleton`. Adds tagged arena slices so nav + `requiredGeometry` audits diverge per deploy. */
function _skBcSlice(ctx, z, x0, x1, geometryId) {
  addWallSegmentX(ctx, z, x0, x1, 0.52, ctx.materials.dM, {
    geometryId,
    roomId: 'relay_cage',
    floorplanRole: 'skeleton_return_slice',
  });
}
/** Short Z-run in `mid_lane_center` (stays clear of the mid_spine_pinch band near z≈+5.5). */
function _skMlRipple(ctx, x, z0, z1, geometryId) {
  addWallSegmentZ(ctx, x, z0, z1, 0.52, ctx.materials.dM, {
    geometryId,
    roomId: 'mid_lane_center',
    floorplanRole: 'skeleton_spine_ripple',
  });
}
/** Shallow dock bulkhead stub — side-biased so the center breach column stays open. */
function _skDkStub(ctx, z, x0, x1, geometryId) {
  addWallSegmentX(ctx, z, x0, x1, 0.48, ctx.materials.dM, {
    geometryId,
    roomId: 'dock_intake',
    floorplanRole: 'skeleton_intake_stub',
  });
}
function _skPost02(ctx) {
  _skBcSlice(ctx, -13.1, 4.05, 7.38, 'skel_b02_bc_slice');
  _skMlRipple(ctx, -5.85, -5.4, -0.55, 'skel_b02_ml_ripple');
  _skDkStub(ctx, 15.1, -6.95, -3.95, 'skel_b02_dk_stub');
}
function _skPost03(ctx) {
  _skBcSlice(ctx, -14.2, -7.38, -4.05, 'skel_b03_bc_slice');
  _skMlRipple(ctx, 5.35, -5.1, 0.65, 'skel_b03_ml_ripple');
  _skDkStub(ctx, 15.3, 4.15, 6.98, 'skel_b03_dk_stub');
}
function _skPost04(ctx) {
  _skBcSlice(ctx, -12.4, 4.0, 7.35, 'skel_b04_bc_slice');
  _skMlRipple(ctx, -5.55, -4.2, 1.1, 'skel_b04_ml_ripple');
  _skDkStub(ctx, 14.85, -7.05, -3.88, 'skel_b04_dk_stub');
}
function _skPost05(ctx) {
  _skBcSlice(ctx, -15.0, -7.35, -4.1, 'skel_b05_bc_slice');
  _skMlRipple(ctx, 5.55, -5.8, -0.4, 'skel_b05_ml_ripple');
  _skDkStub(ctx, 15.5, 3.92, 6.92, 'skel_b05_dk_stub');
}
function _skPost06(ctx) {
  _skBcSlice(ctx, -11.6, 4.08, 7.32, 'skel_b06_bc_slice');
  _skMlRipple(ctx, -5.25, -3.8, 2.0, 'skel_b06_ml_ripple');
  _skDkStub(ctx, 14.7, -6.82, -4.05, 'skel_b06_dk_stub');
}
function _skPost07(ctx) {
  _skBcSlice(ctx, -13.6, -7.34, -4.12, 'skel_b07_bc_slice');
  _skMlRipple(ctx, 5.15, -4.5, 1.35, 'skel_b07_ml_ripple');
  _skDkStub(ctx, 15.0, 4.02, 7.02, 'skel_b07_dk_stub');
}
function _skPost08(ctx) {
  _skBcSlice(ctx, -14.4, 4.02, 7.36, 'skel_b08_bc_slice');
  _skMlRipple(ctx, -5.95, -5.6, -0.2, 'skel_b08_ml_ripple');
  _skDkStub(ctx, 15.35, -6.98, -3.82, 'skel_b08_dk_stub');
}
function _skPost09(ctx) {
  _skBcSlice(ctx, -12.7, -7.36, -4.02, 'skel_b09_bc_slice');
  _skMlRipple(ctx, 5.45, -3.2, 2.45, 'skel_b09_ml_ripple');
  _skDkStub(ctx, 14.9, 4.08, 6.9, 'skel_b09_dk_stub');
}
function _skPost10(ctx) {
  _skBcSlice(ctx, -15.2, 4.06, 7.34, 'skel_b10_bc_slice');
  _skMlRipple(ctx, -5.4, -4.9, 0.9, 'skel_b10_ml_ripple');
  _skDkStub(ctx, 15.25, -6.92, -3.92, 'skel_b10_dk_stub');
}
function _skPost11(ctx) {
  _skBcSlice(ctx, -11.2, -7.3, -4.15, 'skel_b11_bc_slice');
  _skMlRipple(ctx, 5.25, -5.3, 0.15, 'skel_b11_ml_ripple');
  _skDkStub(ctx, 15.15, 3.88, 6.88, 'skel_b11_dk_stub');
}
function _skPost12(ctx) {
  _skBcSlice(ctx, -16.1, 4.1, 7.3, 'skel_b12_bc_slice');
  _skMlRipple(ctx, -5.7, -4.4, 1.8, 'skel_b12_ml_ripple');
  _skDkStub(ctx, 14.95, -6.88, -4.02, 'skel_b12_dk_stub');
}

export const BUILDING_SKELETON_POST = {
  2: _skPost02,
  3: _skPost03,
  4: _skPost04,
  5: _skPost05,
  6: _skPost06,
  7: _skPost07,
  8: _skPost08,
  9: _skPost09,
  10: _skPost10,
  11: _skPost11,
  12: _skPost12,
};

export const ROUTE_INTENT_BY_BN = Object.freeze({
  1: { main: 'dock_intake -> west/east service read -> alarm relay -> cage vestibule', side: 'west service + east dogleg', objective: 'alarm_relay_room', signature: 'relay_cage catwalk', ai: ['lookout:first_read', 'anchor:relay_desk', 'flanker:service_loop', 'overwatch:foreman_cage'] },
  2: { main: 'atrium -> coat check/salon -> concierge spine -> manager suite', side: 'salon and service pantry pockets', objective: 'alarm_relay_room as security desk', signature: 'manager suite under mezzanine', ai: ['lookout:atrium_glass', 'anchor:concierge', 'flanker:salon_loop', 'overwatch:stair_landing'] },
  3: { main: 'queue -> coat-check pit -> dance spine -> DJ/VIP -> mirrored lounge', side: 'bar pocket and VIP spine', objective: 'alarm_relay_room as booth relay', signature: 'mirrored lounge', ai: ['lookout:queue_neon', 'anchor:booth_relay', 'flanker:vip_loop', 'overwatch:dj_tier'] },
  4: { main: 'elevator foyer -> reception -> conversation pit -> gallery -> master suite', side: 'wine vault and office annex', objective: 'alarm_relay_room as gallery console', signature: 'master suite glass crown', ai: ['lookout:foyer', 'anchor:gallery_console', 'flanker:wine_vault', 'overwatch:study_glass'] },
  5: { main: 'triage -> pharmacy row -> patient bay -> nurse station -> operating theater', side: 'patient curtains and surgical prep', objective: 'alarm_relay_room as nurse relay', signature: 'operating theater', ai: ['lookout:triage', 'anchor:nurse_station', 'flanker:patient_loop', 'overwatch:observation_glass'] },
  6: { main: 'turnstile -> platform hall -> track bypass -> power annex -> switch chamber', side: 'locker bay and dispatch office', objective: 'alarm_relay_room as power closet', signature: 'switch chamber tunnel mouth', ai: ['lookout:turnstile', 'anchor:power_panel', 'flanker:track_bypass', 'overwatch:dispatch_window'] },
  7: { main: 'aft deck -> salon -> galley pass -> stateroom hall -> owner suite', side: 'crew hatch and engine pass', objective: 'alarm_relay_room as nav relay', signature: 'bridge/owner suite', ai: ['lookout:aft_deck', 'anchor:nav_relay', 'flanker:crew_hatch', 'overwatch:bridge_glass'] },
  8: { main: 'mantrap -> cold aisle -> patch crawl -> hot aisle -> core vault', side: 'battery bay and network ops', objective: 'alarm_relay_room as ops relay', signature: 'core vault glass', ai: ['lookout:mantrap', 'anchor:ops_console', 'flanker:patch_crawl', 'overwatch:soc_glass'] },
  9: { main: 'inspection lane -> customs gate -> vehicle search -> tower base -> customs office', side: 'truck bay and sand bypass', objective: 'alarm_relay_room as border office', signature: 'customs/tower crossfire', ai: ['lookout:gate', 'anchor:border_office', 'flanker:vehicle_search', 'overwatch:watchtower'] },
  10: { main: 'transept -> nave -> confessionals -> choir stair -> high altar', side: 'reliquary and bell stair', objective: 'alarm_relay_room as sacristy relay', signature: 'altar crossing', ai: ['lookout:narthex', 'anchor:sacristy', 'flanker:confessional_loop', 'overwatch:choir_loft'] },
  11: { main: 'container rows -> cargo spine -> engine companionway -> deck lift -> bridge approach', side: 'crew companionway and engine hood', objective: 'alarm_relay_room as engine relay', signature: 'bridge approach', ai: ['lookout:cargo_row', 'anchor:engine_console', 'flanker:companionway', 'overwatch:bridge_window'] },
  12: { main: 'glass atrium -> reception -> boardroom/vault -> maintenance spine -> helipad apex', side: 'executive vault and helipad stair', objective: 'alarm_relay_room as board relay', signature: 'helipad apex', ai: ['lookout:atrium', 'anchor:boardroom', 'flanker:maintenance_spine', 'overwatch:helipad_glass'] },
});

export const ROUTE_COMPLETION_ELEMENTS_BY_BN = {
  1: [
    { t: 'serviceHall', x: -15.9, z: 13.8, len: 5.2, rotY: Math.PI / 2, width: 1.2, wx: -14.7, wz: 13.8, windowLen: 1.45, roomId: 'west_service_connector', geometryId: 'b01_west_service_nonwave', aiUse: 'flanker_loop' },
    { t: 'returnLoop', x: 12.9, z: 13.7, len: 4.1, rotY: Math.PI / 2, spread: 2.5, roomId: 'east_flank_connector', geometryId: 'b01_east_return_loop', aiUse: 'flanker_reconnect' },
    { t: 'glassPreview', x: -11.5, z: 2.2, len: 2.1, rotY: 0, sill: 0.95, head: 2.05, roomId: 'alarm_relay_room', sightlineId: 'relay_pre_read', geometryId: 'b01_relay_preread_glass', aiUse: 'lookout_preview' },
    { t: 'signatureGate', x: 0, z: -13.2, len: 5.6, rotY: 0, gap: 1.7, roomId: 'relay_cage', geometryId: 'b01_cage_signature_gate', aiUse: 'arena_threshold' },
  ],
  2: [
    { t: 'sidePocket', x: -14.2, z: 17.2, w: 3.2, d: 2.6, rotY: 0, roomId: 'west_service_connector', geometryId: 'b02_coat_check_pocket', aiUse: 'lookout_pocket', col: 0x3a3024, top: 0xffd070 },
    { t: 'guidedTunnel', x: 13.2, z: 12.6, len: 5.0, rotY: Math.PI / 2, width: 1.24, roomId: 'east_flank_connector', geometryId: 'b02_salon_service_tunnel', aiUse: 'flanker_loop', top: 0xffe0a0 },
    { t: 'glassPreview', x: -7.2, z: -1.2, len: 2.4, rotY: 0, sill: 0.85, head: 2.15, col: 0xffe8c8, roomId: 'alarm_relay_room', sightlineId: 'concierge_to_spine', geometryId: 'b02_concierge_preview', aiUse: 'anchor_preview' },
    { t: 'signatureGate', x: 0, z: -13.6, len: 5.2, rotY: 0, gap: 1.65, roomId: 'relay_cage', geometryId: 'b02_manager_suite_gate', top: 0xffd070, aiUse: 'arena_threshold' },
  ],
  3: [
    { t: 'vestibuleThreshold', x: 0, z: 18.4, w: 4.2, rotY: 0, gap: 1.35, dx: -1.1, dz: -1.7, len2: 3.4, previewX: 1.8, previewZ: 17.0, previewLen: 1.8, roomId: 'dock_intake', geometryId: 'b03_queue_vestibule', aiUse: 'arrival_read', col: 0x251028, top: 0xff40c8 },
    { t: 'sidePocket', x: 11.8, z: 13.6, w: 3.0, d: 2.6, rotY: Math.PI / 2, roomId: 'east_flank_connector', geometryId: 'b03_bar_side_pocket', aiUse: 'flanker_pocket', col: 0x201020, top: 0x40e0ff },
    { t: 'returnLoop', x: -13.6, z: -1.2, len: 4.6, rotY: Math.PI / 2, spread: 2.4, roomId: 'alarm_relay_room', geometryId: 'b03_vip_return_loop', aiUse: 'flanker_reconnect', top: 0xff40c8 },
    { t: 'signatureGate', x: 0, z: -12.5, len: 5.8, rotY: 0, gap: 1.6, roomId: 'relay_cage', geometryId: 'b03_mirrored_lounge_gate', glow: 0xff40c8, aiUse: 'arena_threshold' },
  ],
  4: [
    { t: 'guidedTunnel', x: -12.8, z: 14.4, len: 4.8, rotY: Math.PI / 2, width: 1.22, roomId: 'west_service_connector', geometryId: 'b04_gallery_service_tunnel', aiUse: 'gallery_pull', top: 0xffd060 },
    { t: 'sidePocket', x: 13.4, z: 2.0, w: 3.0, d: 2.8, rotY: Math.PI / 2, roomId: 'drum_lane', geometryId: 'b04_glass_office_pocket', aiUse: 'anchor_office', col: 0x202430, top: 0xa0c8ff },
    { t: 'glassPreview', x: -8.6, z: -12.8, len: 2.6, rotY: 0, sill: 0.9, head: 2.1, col: 0xffd060, roomId: 'relay_cage', sightlineId: 'wine_to_suite_preview', geometryId: 'b04_wine_suite_preview', aiUse: 'lookout_preview' },
    { t: 'signatureGate', x: 0, z: -14.2, len: 5.4, rotY: 0, gap: 1.55, roomId: 'relay_cage', geometryId: 'b04_master_suite_gate', top: 0xffd060, aiUse: 'arena_threshold' },
  ],
  5: [
    { t: 'serviceHall', x: 0, z: 15.2, len: 5.2, rotY: 0, width: 1.2, wx: 1.9, wz: 15.2, windowLen: 1.8, roomId: 'dock_intake', geometryId: 'b05_triage_service_hall', aiUse: 'guided_arrival', top: 0xc8e8ff },
    { t: 'sidePocket', x: -14.2, z: -0.8, w: 3.0, d: 2.7, rotY: Math.PI / 2, roomId: 'alarm_relay_room', geometryId: 'b05_patient_curtain_pocket', aiUse: 'anchor_pocket', col: 0x384248, top: 0x40ff80 },
    { t: 'returnLoop', x: 13.4, z: -1.0, len: 4.3, rotY: Math.PI / 2, spread: 2.3, roomId: 'drum_lane', geometryId: 'b05_nurse_return_loop', aiUse: 'flanker_reconnect', top: 0xc8e8ff },
    { t: 'signatureGate', x: 0, z: -14.0, len: 5.6, rotY: 0, gap: 1.6, roomId: 'relay_cage', geometryId: 'b05_operating_theater_gate', top: 0x40ff80, aiUse: 'arena_threshold' },
  ],
  6: [
    { t: 'guidedTunnel', x: 0, z: 17.2, len: 5.8, rotY: 0, width: 1.26, roomId: 'dock_intake', geometryId: 'b06_turnstile_tunnel', aiUse: 'linear_pull', top: 0xfff060 },
    { t: 'sidePocket', x: 13.8, z: 3.0, w: 3.0, d: 2.6, rotY: Math.PI / 2, roomId: 'drum_lane', geometryId: 'b06_locker_pocket', aiUse: 'flanker_pocket', col: 0x30343a, top: 0xff5040 },
    { t: 'serviceHall', x: -13.7, z: -13.8, len: 5.4, rotY: Math.PI / 2, width: 1.18, wx: -12.4, wz: -13.8, windowLen: 1.7, roomId: 'west_service_connector', geometryId: 'b06_track_bypass_hall', aiUse: 'track_bypass', top: 0xfff060 },
    { t: 'signatureGate', x: 0, z: -16.2, len: 5.6, rotY: 0, gap: 1.55, roomId: 'relay_cage', geometryId: 'b06_switch_chamber_gate', top: 0xff5040, aiUse: 'arena_threshold' },
  ],
  7: [
    { t: 'guidedTunnel', x: -12.8, z: 14.5, len: 4.8, rotY: Math.PI / 2, width: 1.18, roomId: 'west_service_connector', geometryId: 'b07_crew_hatch_tunnel', aiUse: 'crew_flank', top: 0xa0c8ff },
    { t: 'sidePocket', x: 13.5, z: 1.8, w: 2.8, d: 2.5, rotY: Math.PI / 2, roomId: 'drum_lane', geometryId: 'b07_stateroom_pocket', aiUse: 'anchor_cabin', col: 0x281408, top: 0xffe8c8 },
    { t: 'glassPreview', x: -6.2, z: 8.2, len: 2.6, rotY: Math.PI / 2, sill: 0.55, head: 2.05, col: 0xa0c8ff, roomId: 'mid_lane_center', sightlineId: 'salon_to_bridge_preview', geometryId: 'b07_salon_bridge_preview', aiUse: 'lookout_preview' },
    { t: 'returnLoop', x: -13.0, z: -15.0, len: 4.2, rotY: Math.PI / 2, spread: 2.3, roomId: 'west_service_connector', geometryId: 'b07_engine_return_loop', aiUse: 'engine_flank', top: 0xa0c8ff },
    { t: 'signatureGate', x: 0, z: -13.8, len: 5.4, rotY: 0, gap: 1.55, roomId: 'relay_cage', geometryId: 'b07_owner_suite_gate', top: 0xa0c8ff, aiUse: 'arena_threshold' },
  ],
  8: [
    { t: 'guidedTunnel', x: -6.0, z: 16.6, len: 5.4, rotY: 0, width: 1.18, roomId: 'dock_intake', geometryId: 'b08_cold_aisle_tunnel_n', aiUse: 'aisle_pull', top: 0x40e0ff },
    { t: 'guidedTunnel', x: 6.0, z: 13.2, len: 5.4, rotY: 0, width: 1.18, side: -1, roomId: 'east_flank_connector', geometryId: 'b08_cold_aisle_tunnel_s', aiUse: 'aisle_flank', top: 0x80c8ff },
    { t: 'glassPreview', x: 0, z: 0.8, len: 3.0, rotY: 0, sill: 0.35, head: 2.25, col: 0x80c8ff, roomId: 'mid_lane_center', sightlineId: 'hot_cold_core_preview', geometryId: 'b08_hot_cold_preview', aiUse: 'aisle_preview' },
    { t: 'sidePocket', x: -13.8, z: -2.0, w: 3.0, d: 2.7, rotY: Math.PI / 2, roomId: 'alarm_relay_room', geometryId: 'b08_patch_crawl_pocket', aiUse: 'ops_anchor', col: 0x10141c, top: 0x40e0ff },
    { t: 'signatureGate', x: 0, z: -15.0, len: 5.8, rotY: 0, gap: 1.55, roomId: 'relay_cage', geometryId: 'b08_core_vault_gate', top: 0x40e0ff, aiUse: 'arena_threshold' },
  ],
  9: [
    { t: 'guidedTunnel', x: 0, z: 17.2, len: 6.2, rotY: Math.PI / 2, width: 1.32, roomId: 'dock_intake', geometryId: 'b09_inspection_lane_tunnel', aiUse: 'long_lane_pull', top: 0xffd090 },
    { t: 'sidePocket', x: 13.8, z: 5.0, w: 3.2, d: 2.8, rotY: Math.PI / 2, roomId: 'drum_lane', geometryId: 'b09_vehicle_search_pocket', aiUse: 'vehicle_flank', col: 0x4a3420, top: 0xffb060 },
    { t: 'serviceHall', x: -13.8, z: -16.8, len: 5.2, rotY: Math.PI / 2, width: 1.18, wx: -12.5, wz: -16.8, windowLen: 1.8, roomId: 'west_service_connector', geometryId: 'b09_watchtower_base_hall', aiUse: 'overwatch_route', top: 0xffb060 },
    { t: 'signatureGate', x: 0, z: -13.8, len: 5.8, rotY: 0, gap: 1.6, roomId: 'relay_cage', geometryId: 'b09_customs_office_gate', top: 0xffd090, aiUse: 'arena_threshold' },
  ],
  10: [
    { t: 'guidedTunnel', x: 0, z: 16.2, len: 6.0, rotY: 0, width: 1.36, roomId: 'dock_intake', geometryId: 'b10_nave_procession_tunnel', aiUse: 'nave_pull', top: 0xffe8b0 },
    { t: 'sidePocket', x: -14.2, z: -1.4, w: 3.1, d: 2.8, rotY: Math.PI / 2, roomId: 'alarm_relay_room', geometryId: 'b10_confessional_side_room', aiUse: 'anchor_confessional', col: 0x3a3428, top: 0xffe8b0 },
    { t: 'serviceHall', x: 13.0, z: -8.0, len: 4.8, rotY: Math.PI / 2, width: 1.18, wx: 11.8, wz: -8.0, windowLen: 1.7, roomId: 'drum_lane', geometryId: 'b10_bell_stair_hall', aiUse: 'choir_flank', top: 0xffd060 },
    { t: 'signatureGate', x: 0, z: -13.4, len: 6.0, rotY: 0, gap: 1.65, roomId: 'relay_cage', geometryId: 'b10_high_altar_gate', top: 0xffe8b0, aiUse: 'arena_threshold' },
  ],
  11: [
    { t: 'guidedTunnel', x: 0, z: 16.8, len: 5.8, rotY: 0, width: 1.24, roomId: 'dock_intake', geometryId: 'b11_cargo_spine_tunnel', aiUse: 'deck_pull', top: 0xff8040 },
    { t: 'serviceHall', x: -13.5, z: -1.2, len: 5.2, rotY: Math.PI / 2, width: 1.16, wx: -12.2, wz: -1.2, windowLen: 1.7, roomId: 'alarm_relay_room', geometryId: 'b11_engine_companionway_hall', aiUse: 'engine_anchor', top: 0xff8040 },
    { t: 'returnLoop', x: 13.2, z: -7.0, len: 4.4, rotY: Math.PI / 2, spread: 2.4, roomId: 'drum_lane', geometryId: 'b11_crew_companionway_loop', aiUse: 'crew_flank', top: 0x80b0d0 },
    { t: 'signatureGate', x: 0, z: -14.8, len: 5.6, rotY: 0, gap: 1.55, roomId: 'relay_cage', geometryId: 'b11_bridge_approach_gate', top: 0x80b0d0, aiUse: 'arena_threshold' },
  ],
  12: [
    { t: 'guidedTunnel', x: 0, z: 16.6, len: 5.8, rotY: 0, width: 1.26, roomId: 'dock_intake', geometryId: 'b12_reception_glass_tunnel', aiUse: 'final_pull', top: 0xc8e0ff },
    { t: 'sidePocket', x: -13.8, z: -0.4, w: 3.0, d: 2.8, rotY: Math.PI / 2, roomId: 'alarm_relay_room', geometryId: 'b12_boardroom_side_pocket', aiUse: 'board_anchor', col: 0x0a0c10, top: 0xc8e0ff },
    { t: 'serviceHall', x: 13.6, z: -5.8, len: 5.0, rotY: Math.PI / 2, width: 1.18, wx: 12.4, wz: -5.8, windowLen: 1.9, roomId: 'drum_lane', geometryId: 'b12_maintenance_spine_hall', aiUse: 'final_flank', top: 0xffd060 },
    { t: 'signatureGate', x: 0, z: -15.8, len: 6.0, rotY: 0, gap: 1.6, roomId: 'relay_cage', geometryId: 'b12_helipad_apex_gate', top: 0xc8e0ff, aiUse: 'arena_threshold' },
  ],
};

// ── EXTRA_ELEMENTS — per-building post-pass placements ───────────────────
// Dividers create closed-off interior sub-rooms (with optional doorways).
// Windows are tactical glass — see-through, shoot-through, vault-through —
// placed where they create new peek/flank opportunities. Plus a few extra
// decoration elements to deepen each cell.
//
// Coordinate convention (matches existing SEQUENCE_DEFS): x roughly -16..16,
// z roughly -22..22, where +z is "front" (player spawn side) and -z is "back"
// (boss-arena side). rotY=0 → wall runs along X; rotY=π/2 → wall runs along Z.
const EXTRA_ELEMENTS = {
  // ── 1: LOADING DOCK — B01 floorplan: intake lanes, service run, relay cage reads
  1: [
    // Room-flow rebuild — spawn vestibule and first peek threshold.
    { t: 'divider', x: 0, z: 16.55, len: 9.2, rotY: 0, gap: 2.35, gapPos: 0,
      roomId: 'b01_entry_vestibule', floorplanRole: 'flow_entry_threshold', geometryId: 'b01_entry_vestibule_threshold' },
    { t: 'divider', x: -4.85, z: 18.6, len: 4.6, rotY: Math.PI / 2, gap: 0,
      roomId: 'b01_entry_vestibule', floorplanRole: 'spawn_occluder', geometryId: 'b01_entry_west_blind' },
    { t: 'divider', x: 4.85, z: 18.6, len: 4.6, rotY: Math.PI / 2, gap: 0,
      roomId: 'b01_entry_vestibule', floorplanRole: 'spawn_occluder', geometryId: 'b01_entry_east_blind' },
    { t: 'divider', x: 2.15, z: 12.9, len: 4.8, rotY: Math.PI / 2, gap: 0,
      roomId: 'b01_intake_peek', floorplanRole: 'peek_blind', geometryId: 'b01_intake_peek_blind' },
    { t: 'window', x: 3.1, z: 14.2, len: 1.25, rotY: Math.PI / 2, sill: 1.05, head: 2.05, frameCol: 0x1a1a20,
      roomId: 'b01_intake_peek', sightlineId: 'b01_first_lookout_slit', floorplanRole: 'first_contact_preview', geometryId: 'b01_first_lookout_slit' },
    { t: 'divider', x: 6.55, z: 11.7, len: 5.2, rotY: Math.PI / 2, gap: 1.4, gapPos: -1.55,
      roomId: 'b01_intake_peek', floorplanRole: 'route_turn', geometryId: 'b01_intake_gate_turn' },
    { t: 'divider', x: -5.2, z: 11.4, len: 4.6, rotY: Math.PI / 2, gap: 0,
      roomId: 'b01_intake_peek', floorplanRole: 'spawn_sightline_cut', geometryId: 'b01_intake_west_sightline_cut' },
    // Dock intake — readable threshold before the open court compresses
    { t: 'divider', x: 0, z: 20.2, len: 11.5, rotY: 0, gap: 2.0, gapPos: 3.8,
      roomId: 'dock_intake', floorplanRole: 'threshold', geometryId: 'dock_threshold_strip' },
    // West-side compressed service run (not the center breach lane)
    { t: 'divider', x: -15.5, z: 18, len: 10.5, rotY: Math.PI/2, gap: 1.35, gapPos: 2.0,
      roomId: 'dock_intake', floorplanRole: 'connector', geometryId: 'west_service_run' },
    // Alarm relay shell + offset internal entry
    { t: 'divider', x: -12, z: 4, len: 5.5, rotY: 0, gap: 1.4, gapPos: 1.5,
      roomId: 'alarm_relay_room', geometryId: 'relay_partition_north' },
    { t: 'divider', x: -10, z: 1, len: 5.0, rotY: Math.PI/2, gap: 0,
      roomId: 'alarm_relay_room', geometryId: 'relay_partition_west' },
    { t: 'divider', x: -14.5, z: -2.2, len: 4.2, rotY: 0, gap: 1.15, gapPos: -1.35,
      roomId: 'alarm_relay_room', floorplanRole: 'threshold', geometryId: 'relay_offset_door' },
    // Tactical glass — manifest read into mid floor
    { t: 'window', x: -8.5, z: 4, len: 2.6, rotY: 0, sill: 0.9, head: 2.0, frameCol: 0x1a1a20,
      geometryId: 'manifest_office_window', roomId: 'alarm_relay_room', sightlineId: 'office_to_mid_floor' },
    // East flank approach — narrows FE before the mid door, rewards side routing
    { t: 'divider', x: 14.2, z: 16, len: 8, rotY: Math.PI/2, gap: 1.5, gapPos: -2.0,
      roomId: 'dock_intake', floorplanRole: 'connector', geometryId: 'east_compression_corridor' },
    // Foreman / office cage — partial glass read into relay cage (BC)
    { t: 'divider', x: 14, z: -16.5, len: 3.8, rotY: 0, gap: 1.15, gapPos: 0.55,
      roomId: 'foreman_cage', floorplanRole: 'threshold', geometryId: 'foreman_cage_wall' },
    { t: 'divider', x: 11.8, z: -14.5, len: 3.0, rotY: Math.PI/2, gap: 0,
      roomId: 'foreman_cage', geometryId: 'foreman_cage_return' },
    { t: 'window', x: 12.0, z: -12.8, len: 2.2, rotY: 0, sill: 0.92, head: 2.05, frameCol: 0x222830,
      geometryId: 'foreman_glass', roomId: 'foreman_cage', sightlineId: 'foreman_to_relay_cage', floorplanRole: 'sightline' },
    // Catwalk overlook — existing read, now tagged for floorplan debug
    { t: 'window', x: 15.5, z: -12, len: 2.8, rotY: Math.PI/2, sill: 1.1, head: 2.2,
      geometryId: 'catwalk_to_cage_window', roomId: 'foreman_cage', sightlineId: 'catwalk_over_bc' },
    // Intake → zone-door apron — must leave the x≈5 breach lane clear down to z=zSplit
    // (east zone door). A 10.5m bar centered at 0 left a solid segment to x=5.25 at z≈8.85,
    // which blocked the door column for PR=0.35 (read as “door stuck in a wall”).
    { t: 'divider', x: 0, z: 8.85, len: 12.5, rotY: 0, gap: 2.2, gapPos: 5.0,
      roomId: 'dock_intake', floorplanRole: 'threshold', geometryId: 'intake_apron_divider' },
    // Mid spine pinch — short segment breaks long FC center line toward MW/ME doors
    { t: 'divider', x: -2.5, z: 5.5, len: 4.2, rotY: Math.PI/2, gap: 1.25, gapPos: 0.4,
      roomId: 'mid_lane_center', floorplanRole: 'connector', geometryId: 'mid_spine_pinch' },
    // Relay cage vestibule — shallow funnel in front of arch read
    { t: 'divider', x: 0, z: -11.9, len: 5.5, rotY: 0, gap: 2.0, gapPos: 0.35,
      roomId: 'relay_cage', floorplanRole: 'threshold', geometryId: 'cage_vestibule' },
    // Narrow service read from MW toward drum lane (tactical glass, high sill)
    { t: 'window', x: -11.35, z: -0.5, len: 1.35, rotY: 0, sill: 1.15, head: 2.15, frameCol: 0x1c2028,
      geometryId: 'relay_side_slit', roomId: 'alarm_relay_room', sightlineId: 'relay_peek_me', floorplanRole: 'sightline' },
    // Relay console approach — non-blocking cyan read for alarm interact lane
    { t: 'haz', x: -14, z: 3.15, w: 1.7, d: 1.0, col: 0x060a10, alpha: 0.38, glow: 0x40ffc8,
      roomId: 'alarm_relay_room', floorplanRole: 'objective_anchor', geometryId: 'alarm_interact_lane' },
    { t: 'crate2', x: -6, z: 6, col: 0x6a4830 },
    { t: 'drum', x: 16, z: -6, n: 2, col: 0xc04830, stripe: 0xfff0d0 },
    { t: 'dogleg', x: 4, z: 16, len1: 4.0, rotY1: Math.PI / 2, gap1: 1.25, gapPos1: 0.3, x2: 0.5, z2: 13.5, len2: 5.0, rotY2: 0, gap2: 1.4, gapPos2: 0.2, geometryId: 'b01_fe_flank_dog', roomId: 'east_flank_connector' },
    { t: 'corridor', x: -14, z: -8, len: 5.0, rotY: 0, width: 1.15, gap: 1.2, gapPos: 0, roomId: 'mid_lane_west', geometryId: 'b01_service_corridor' },
    { t: 'vestibule', x: 0, z: -14, rotY: 0, w: 4.5, gap: 1.35, gapPos: 0, dx: 0, dz: -1.4, len2: 3.8, rotY2: Math.PI / 2, gap2: 1.15, geometryId: 'b01_cage_vest', geometryId2: 'b01_cage_vest_s', roomId: 'relay_cage' },
  ],
  // ── 2: CONTINENTAL — coat check booth + lobby glass ───────────────────
  2: [
    // Coat-check booth (FW) — short walls with doorway
    { t: 'divider', x: -14, z: 14, len: 5.0, rotY: Math.PI/2, gap: 1.4, gapPos: 1.6 },
    { t: 'divider', x: -12, z: 11.5, len: 4.0, rotY: 0, gap: 0 },
    // Marble glass partition between FC and the salon (FE side)
    { t: 'window', x: 7.5, z: 14, len: 3.4, rotY: Math.PI/2, sill: 0.0, head: 2.2, col: 0xffe0a0, frameCol: 0x281810 },
    // Concierge desk window (FC) — peek view into office
    { t: 'window', x: -3, z: 18, len: 2.8, rotY: 0, sill: 0.95, head: 2.05, col: 0xffd070 },
    // Sub-room kit: ticket lane compression (corridor kit — clearance vs PR in validate:geometry)
    { t: 'corridor', x: -3.5, z: 16.8, len: 4.2, rotY: 0, width: 1.22, gap: 1.15, gapPos: -0.4 },
    // Salon partition (FE)
    { t: 'divider', x: 12, z: 14, len: 3.6, rotY: 0, gap: 1.3, gapPos: 0 },
    { t: 'plinth', x: -6, z: 8 },
    { t: 'lamp', x: 11, z: 8 },
    { t: 'vestibule', x: 12, z: -14, rotY: 0, w: 3.4, gap: 1.25, gapPos: 0.2, dx: 0.9, dz: -1.5, len2: 2.8, rotY2: Math.PI / 2, gap2: 0, geometryId: 'b02_bw_vest', geometryId2: 'b02_bw_vest_return' },
    { t: 'dogleg', x: 0, z: 5.5, len1: 4.5, rotY1: 0, gap1: 1.35, gapPos1: -0.6, x2: 2.8, z2: 3.2, len2: 3.4, rotY2: Math.PI / 2, gap2: 1.2, gapPos2: 0, geometryId: 'b02_mid_spine_dog', roomId: 'mid_lane_center', floorplanRole: 'connector' },
    { t: 'window', x: -14, z: 0, len: 2.8, rotY: Math.PI / 2, sill: 0.85, head: 2.1, col: 0xffe8c8, frameCol: 0x281810, roomId: 'alarm_relay_room', geometryId: 'b02_library_peek' },
    { t: 'corridor', x: 14, z: -4, len: 5.5, rotY: Math.PI / 2, width: 1.2, gap: 1.25, gapPos: 0.5, roomId: 'drum_lane', geometryId: 'b02_gallery_corridor' },
    { t: 'divider', x: -4, z: 20, len: 5.0, rotY: Math.PI / 2, gap: 1.4, gapPos: 0.8, roomId: 'dock_intake', geometryId: 'b02_intake_kink' },
    { t: 'plinth', x: 4, z: 22 },
    { t: 'lamp', x: -8, z: 22, col: 0xffd070 },
    { t: 'cov', x: -5.2, z: 19.2, w: 1.35, h: 0.86, d: 0.78, col: 0x3a3428, top: 0xffe8c8, roomId: 'dock_intake' },
    { t: 'cov', x: 9.4, z: 18.3, w: 1.28, h: 0.85, d: 0.75, col: 0x3a3428, top: 0xffd070, roomId: 'dock_intake' },
    { t: 'haz', x: -14.2, z: 11.7, w: 1.55, d: 0.95, col: 0x0a0806, alpha: 0.4, glow: 0xffd070, roomId: 'dock_intake' },
  ],
  // ── 3: NIGHTCLUB — VIP booths + mirror lounge glass ───────────────────
  3: [
    // VIP cordon (ME) — sub-room with a doorway
    { t: 'divider', x: 13, z: 3, len: 5.2, rotY: 0, gap: 1.6, gapPos: -1.0 },
    { t: 'divider', x: 15.5, z: 0.5, len: 4.5, rotY: Math.PI/2, gap: 0 },
    // Mirror lounge glass — players can shoot Roux through this!
    { t: 'window', x: 10, z: 3, len: 3.0, rotY: 0, sill: 0.6, head: 2.2, col: 0xff60c0, frameCol: 0x281020 },
    // DJ booth front glass (FC) — see-through into the pit
    { t: 'window', x: 0, z: 14, len: 4.0, rotY: 0, sill: 1.1, head: 1.9, col: 0xff40c8 },
    // Bottle service partition (FE)
    { t: 'divider', x: 12, z: 18, len: 3.0, rotY: Math.PI/2, gap: 1.2, gapPos: 0 },
    { t: 'speaker', x: -10, z: 22, col: 0xff40c8 },
    { t: 'dogleg', x: 0, z: 10, len1: 5.0, rotY1: 0, gap1: 1.5, gapPos1: 0.4, x2: -3.2, z2: 7.5, len2: 4.0, rotY2: Math.PI / 2, gap2: 1.25, gapPos2: 0, geometryId: 'b03_fc_pit_dog', roomId: 'dock_intake' },
    { t: 'corridor', x: -14, z: -16, len: 4.5, rotY: 0, width: 1.15, gap: 1.2, gapPos: -0.3, roomId: 'west_service_connector', geometryId: 'b03_vip_corridor' },
    { t: 'divider', x: 0, z: -8, len: 6.0, rotY: 0, gap: 1.6, gapPos: 0, roomId: 'relay_cage', geometryId: 'b03_mirror_split' },
    { t: 'window', x: -6, z: -14, len: 2.4, rotY: 0, sill: 0.7, head: 2.0, col: 0xff60d0, frameCol: 0x180818, roomId: 'relay_cage', geometryId: 'b03_side_glass' },
    { t: 'vestibule', x: -12, z: 2, rotY: Math.PI / 2, w: 2.8, gap: 1.15, gapPos: 0, dx: -1.2, dz: 0, len2: 3.2, rotY2: 0, gap2: 1.1, gapPos2: 0.2, geometryId: 'b03_mw_vest', geometryId2: 'b03_mw_vest_n' },
    { t: 'cov', x: -4.2, z: 18.5, w: 1.32, h: 0.84, d: 0.76, col: 0x201020, top: 0xff60c8, roomId: 'dock_intake' },
    { t: 'cov', x: 8.6, z: 17.8, w: 1.28, h: 0.83, d: 0.74, col: 0x201020, top: 0x40e0ff, roomId: 'dock_intake' },
    { t: 'crate2', x: 2.5, z: 12.2, col: 0x4a2048, roomId: 'mid_lane_center' },
    { t: 'haz', x: 0, z: 8.2, w: 2.2, d: 1.1, col: 0x120818, alpha: 0.35, glow: 0xff40c8, roomId: 'mid_lane_center' },
  ],
  // ── 4: PENTHOUSE — wine vault corridor + study + executive glass ──────
  4: [
    // Wine vault narrow corridor (BW) — two parallel dividers form a passage
    { t: 'divider', x: -10, z: -14, len: 5.5, rotY: Math.PI/2, gap: 1.4, gapPos: 2.0 },
    { t: 'divider', x: -14, z: -14, len: 5.5, rotY: Math.PI/2, gap: 1.4, gapPos: -2.0 },
    // Study window into the wine corridor — peek-shot opportunity
    { t: 'window', x: -8.5, z: -16, len: 2.6, rotY: 0, sill: 0.95, head: 2.0, col: 0xffd060 },
    // Executive suite glass wall (BE) — looks out at the boss arena
    { t: 'window', x: 8, z: -14, len: 4.0, rotY: Math.PI/2, sill: 0.3, head: 2.3, col: 0xa0c8ff, frameCol: 0x141420 },
    // Bedroom partition
    { t: 'divider', x: 12, z: -14, len: 4.4, rotY: 0, gap: 1.4, gapPos: 0.8 },
    { t: 'plinth', x: 5, z: 8 },
    { t: 'dogleg', x: 0, z: 6, len1: 4.2, rotY1: Math.PI / 2, gap1: 1.3, gapPos1: 0.5, x2: -3.5, z2: 3.5, len2: 4.5, rotY2: 0, gap2: 1.4, gapPos2: -0.4, geometryId: 'b04_spine_dog', roomId: 'mid_lane_center' },
    { t: 'divider', x: -6, z: 16, len: 4.0, rotY: 0, gap: 1.35, gapPos: 0.6, roomId: 'dock_intake', geometryId: 'b04_fc_bar_kink' },
    { t: 'window', x: 12, z: 8, len: 2.8, rotY: Math.PI / 2, sill: 0.4, head: 2.2, col: 0xa0c8ff, frameCol: 0x0a0814, roomId: 'east_flank_connector', geometryId: 'b04_pit_glass' },
    { t: 'corridor', x: -14, z: -6, len: 5.0, rotY: Math.PI / 2, width: 1.18, gap: 1.2, gapPos: 0, roomId: 'mid_lane_west', geometryId: 'b04_art_corridor' },
    { t: 'divider', x: 0, z: -12, len: 5.5, rotY: 0, gap: 1.5, gapPos: 0, roomId: 'relay_cage', geometryId: 'b04_suite_threshold' },
    { t: 'cov', x: -6.2, z: 17.4, w: 1.34, h: 0.86, d: 0.78, col: 0x2a2c38, top: 0xffd060, roomId: 'dock_intake' },
    { t: 'cov', x: 6.4, z: 16.9, w: 1.3, h: 0.85, d: 0.76, col: 0x2a2c38, top: 0xa0c8ff, roomId: 'dock_intake' },
    { t: 'plinth', x: 0, z: 21 },
    { t: 'haz', x: -14, z: 20, w: 1.8, d: 1.0, col: 0x0a0c12, alpha: 0.38, glow: 0xa0c8ff, roomId: 'dock_intake' },
  ],
  // ── 5: STERLING MEDICAL — ICU partition + observation glass ───────────
  5: [
    // ICU sub-room (BW)
    { t: 'divider', x: -12, z: -14, len: 5.0, rotY: 0, gap: 1.4, gapPos: -0.6 },
    { t: 'divider', x: -10, z: -16, len: 4.0, rotY: Math.PI/2, gap: 0 },
    // ICU observation glass — classic peek-through-the-window
    { t: 'window', x: -8, z: -14, len: 3.2, rotY: 0, sill: 1.0, head: 2.1, col: 0xa8e0c8, frameCol: 0x202830 },
    // Surgery suite glass (BE side)
    { t: 'window', x: 11, z: -10, len: 3.2, rotY: 0, sill: 0.85, head: 2.0, col: 0xc8e8ff },
    // Triage cubicle (FC) — soft sub-room
    { t: 'divider', x: 0, z: 14, len: 4.2, rotY: 0, gap: 1.5, gapPos: 0 },
    { t: 'console', x: 4, z: -16, w: 1.4, h: 0.95, d: 0.7, col: 0x141820, glow: 0x40ff80 },
    { t: 'corridor', x: 0, z: 0, len: 6.5, rotY: 0, width: 1.16, gap: 1.22, gapPos: 0.3, roomId: 'mid_lane_center', geometryId: 'b05_mid_clinical_corridor' },
    { t: 'dogleg', x: -14, z: 2, len1: 3.8, rotY1: 0, gap1: 1.2, gapPos1: 0, x2: -12.5, z2: -1.5, len2: 3.6, rotY2: Math.PI / 2, gap2: 1.1, gapPos2: 0.2, geometryId: 'b05_mw_dog', roomId: 'alarm_relay_room' },
    { t: 'divider', x: 12, z: 16, len: 4.5, rotY: Math.PI / 2, gap: 1.3, gapPos: -0.5, roomId: 'dock_intake', geometryId: 'b05_triage_lane' },
    { t: 'window', x: 8, z: 0, len: 3.0, rotY: 0, sill: 1.0, head: 2.05, col: 0xc8e8ff, frameCol: 0x202830, roomId: 'drum_lane', geometryId: 'b05_nurse_glass' },
    { t: 'vestibule', x: 0, z: -14, rotY: 0, w: 4.2, gap: 1.4, gapPos: 0, dx: 0, dz: -1.8, len2: 3.4, rotY2: Math.PI / 2, gap2: 1.15, gapPos2: 0, geometryId: 'b05_bc_vest', geometryId2: 'b05_bc_vest_e', roomId: 'relay_cage' },
    { t: 'cov', x: -4.8, z: 18.8, w: 1.36, h: 0.87, d: 0.79, col: 0x3a4248, top: 0xc8e8ff, roomId: 'dock_intake' },
    { t: 'cov', x: 4.9, z: 18.2, w: 1.32, h: 0.86, d: 0.77, col: 0x3a4248, top: 0x40ff80, roomId: 'dock_intake' },
    { t: 'cov', x: 0, z: 16.2, w: 1.25, h: 0.84, d: 0.74, col: 0x384248, top: 0xe8f8ff, roomId: 'dock_intake' },
  ],
  // ── 6: SUBWAY LINE 7 — ticket booth + maintenance corridor ────────────
  6: [
    // Ticket booth (FC) — small sub-room with the iconic agent window
    { t: 'divider', x: -3, z: 18, len: 4.5, rotY: 0, gap: 1.2, gapPos: -1.6 },
    { t: 'divider', x: -5, z: 16, len: 3.0, rotY: Math.PI/2, gap: 0 },
    // The ticket window — see/shoot/vault through
    { t: 'window', x: -1, z: 18, len: 2.4, rotY: 0, sill: 0.85, head: 1.7, col: 0xfff060, frameCol: 0x202020 },
    // Maintenance corridor wall (BW)
    { t: 'divider', x: -12, z: -15, len: 7.0, rotY: Math.PI/2, gap: 1.5, gapPos: 1.5 },
    // Operator booth window (BE) — overlooking switch chamber
    { t: 'window', x: 13, z: -12, len: 2.6, rotY: 0, sill: 1.0, head: 2.0, col: 0xff5040 },
    { t: 'pipes', x: 5, z: -20, len: 6 },
    { t: 'corridor', x: -13.5, z: -15, len: 5.5, rotY: Math.PI / 2, width: 1.18, gap: 1.3, gapPos: 0.2 },
    { t: 'dogleg', x: 0, z: 4, len1: 5.5, rotY1: 0, gap1: 1.45, gapPos1: -0.5, x2: 3.2, z2: 1.5, len2: 4.2, rotY2: Math.PI / 2, gap2: 1.2, gapPos2: 0, geometryId: 'b06_fc_turnstile_dog', roomId: 'mid_lane_center' },
    { t: 'divider', x: 14, z: -6, len: 5.0, rotY: 0, gap: 1.35, gapPos: 0.4, roomId: 'drum_lane', geometryId: 'b06_me_panel_row' },
    { t: 'window', x: -10, z: -8, len: 2.6, rotY: 0, sill: 0.9, head: 1.9, col: 0xfff060, frameCol: 0x202020, roomId: 'alarm_relay_room', geometryId: 'b06_tunnel_window' },
    { t: 'corridor', x: 0, z: -18, len: 6.0, rotY: Math.PI / 2, width: 1.2, gap: 1.25, gapPos: 0, roomId: 'relay_cage', geometryId: 'b06_switch_corridor' },
    { t: 'divider', x: -4, z: 20, len: 4.0, rotY: Math.PI / 2, gap: 1.25, gapPos: 0, roomId: 'dock_intake', geometryId: 'b06_vendor_kink' },
    { t: 'cov', x: -5.5, z: 19.5, w: 1.33, h: 0.86, d: 0.78, col: 0x383c44, top: 0xfff060, roomId: 'dock_intake' },
    { t: 'cov', x: 5.6, z: 19.0, w: 1.3, h: 0.85, d: 0.76, col: 0x383c44, top: 0xff5040, roomId: 'dock_intake' },
    { t: 'haz', x: 0, z: 6.5, w: 2.4, d: 1.0, col: 0x101418, alpha: 0.36, glow: 0xfff060, roomId: 'mid_lane_center' },
  ],
  // ── 7: AZURE YACHT — stateroom corridor + bridge glass ─────────────────
  7: [
    // Stateroom corridor (ME)
    { t: 'divider', x: 11, z: 0, len: 6.0, rotY: Math.PI/2, gap: 1.3, gapPos: 1.0 },
    { t: 'divider', x: 13, z: -3, len: 3.0, rotY: 0, gap: 0 },
    // Stateroom porthole-style window
    { t: 'window', x: 9.5, z: 2, len: 1.6, rotY: 0, sill: 1.05, head: 1.85, col: 0xa0c8ff, frameCol: 0x281408 },
    // Bridge wing glass — overlooking the boss arena
    { t: 'window', x: 0, z: -10, len: 4.0, rotY: 0, sill: 1.0, head: 2.2, col: 0xa0c8ff, frameCol: 0x281408 },
    // Galley partition (FW)
    { t: 'divider', x: -11, z: 14, len: 4.0, rotY: 0, gap: 1.3, gapPos: 0 },
    { t: 'dogleg', x: 0, z: 16, len1: 4.8, rotY1: 0, gap1: 1.35, gapPos1: 0.5, x2: -2.8, z2: 13.5, len2: 3.6, rotY2: Math.PI / 2, gap2: 1.15, gapPos2: 0, geometryId: 'b07_salon_dog', roomId: 'dock_intake' },
    { t: 'window', x: -6, z: 8, len: 3.2, rotY: Math.PI / 2, sill: 0.35, head: 2.1, col: 0xa0c8ff, frameCol: 0x281408, roomId: 'mid_lane_center', geometryId: 'b07_salon_bulkhead' },
    { t: 'corridor', x: 14, z: 4, len: 5.0, rotY: 0, width: 1.14, gap: 1.2, gapPos: -0.2, roomId: 'drum_lane', geometryId: 'b07_stateroom_corridor' },
    { t: 'divider', x: 0, z: -6, len: 5.0, rotY: 0, gap: 1.5, gapPos: 0, roomId: 'relay_cage', geometryId: 'b07_engine_read' },
    { t: 'vestibule', x: -12, z: -18, rotY: Math.PI / 2, w: 3.0, gap: 1.1, gapPos: 0, dx: -1.0, dz: 1.2, len2: 2.8, rotY2: 0, gap2: 1.0, geometryId: 'b07_bw_vest', geometryId2: 'b07_bw_vest_s' },
    { t: 'cov', x: -6.0, z: 18.6, w: 1.34, h: 0.86, d: 0.78, col: 0x281408, top: 0xa0c8ff, roomId: 'dock_intake' },
    { t: 'cov', x: 6.2, z: 18.1, w: 1.3, h: 0.85, d: 0.76, col: 0x281408, top: 0xffe8c8, roomId: 'dock_intake' },
    { t: 'lamp', x: 0, z: 20.5, col: 0xa0c8ff },
  ],
  // ── 8: SERVER FARM Δ — hot/cold aisle glass + control booth ──────────
  8: [
    // Hot/cold aisle separator (middle band) — long glass run
    { t: 'window', x: 0, z: 0, len: 6.0, rotY: 0, sill: 0.0, head: 2.4, col: 0x80c8ff, frameCol: 0x10141c },
    // Control booth (BE)
    { t: 'divider', x: 13, z: -14, len: 4.5, rotY: 0, gap: 1.4, gapPos: -0.3 },
    { t: 'divider', x: 15.5, z: -16, len: 3.2, rotY: Math.PI/2, gap: 0 },
    // Control booth observation window
    { t: 'window', x: 11, z: -14, len: 2.6, rotY: 0, sill: 0.9, head: 2.0, col: 0x40e0ff, frameCol: 0x10141c },
    // Cold-aisle dividers — short sub-room walls between racks
    { t: 'divider', x: -12, z: -2, len: 5.0, rotY: 0, gap: 1.6, gapPos: 1.0 },
    { t: 'corridor', x: -14, z: 4, len: 5.5, rotY: Math.PI / 2, width: 1.17, gap: 1.22, gapPos: 0.4, roomId: 'alarm_relay_room', geometryId: 'b08_cold_corridor' },
    { t: 'dogleg', x: 0, z: 0, len1: 5.0, rotY1: Math.PI / 2, gap1: 1.3, gapPos1: 0, x2: 4.0, z2: -2.5, len2: 4.5, rotY2: 0, gap2: 1.25, gapPos2: 0.3, geometryId: 'b08_spine_dog', roomId: 'mid_lane_center' },
    { t: 'divider', x: 14, z: 6, len: 4.2, rotY: Math.PI / 2, gap: 1.2, gapPos: 0.5, roomId: 'dock_intake', geometryId: 'b08_rack_kink' },
    { t: 'window', x: -14, z: -4, len: 2.4, rotY: 0, sill: 1.0, head: 2.0, col: 0x80c8ff, frameCol: 0x10141c, roomId: 'west_service_connector', geometryId: 'b08_ops_peek' },
    { t: 'vestibule', x: 0, z: -16, rotY: 0, w: 4.5, gap: 1.35, gapPos: 0, dx: 0, dz: -1.6, len2: 3.6, rotY2: Math.PI / 2, gap2: 1.1, geometryId: 'b08_core_vest', geometryId2: 'b08_core_vest_w' },
    { t: 'cov', x: -5.8, z: 18.4, w: 1.33, h: 0.86, d: 0.78, col: 0x10141c, top: 0x40e0ff, roomId: 'dock_intake' },
    { t: 'cov', x: 5.9, z: 17.9, w: 1.3, h: 0.85, d: 0.76, col: 0x10141c, top: 0x80c8ff, roomId: 'dock_intake' },
    { t: 'haz', x: -14, z: 16, w: 1.7, d: 1.0, col: 0x080a10, alpha: 0.4, glow: 0x40e0ff, roomId: 'dock_intake' },
  ],
  // ── 9: BORDER CROSSING — customs booth + watchtower windows ──────────
  9: [
    // Customs booth (BC) — sub-room with the office window
    { t: 'divider', x: 0, z: -14, len: 5.0, rotY: 0, gap: 1.5, gapPos: 0 },
    { t: 'divider', x: -3, z: -17, len: 3.0, rotY: Math.PI/2, gap: 0 },
    { t: 'divider', x: 3, z: -17, len: 3.0, rotY: Math.PI/2, gap: 0 },
    // Customs office glass — peek at the target inside
    { t: 'window', x: -4.5, z: -14, len: 2.4, rotY: 0, sill: 0.95, head: 1.95, col: 0xffd090, frameCol: 0x282018 },
    { t: 'window', x: 4.5, z: -14, len: 2.4, rotY: 0, sill: 0.95, head: 1.95, col: 0xffd090, frameCol: 0x282018 },
    // Inspection lane separator (FC) — divided lanes
    { t: 'divider', x: 0, z: 18, len: 7.0, rotY: Math.PI/2, gap: 1.4, gapPos: 0 },
    // Watchtower window (BW) — sniper hide above
    { t: 'window', x: -10, z: -19, len: 3.0, rotY: Math.PI/2, sill: 1.4, head: 2.4, col: 0xffb060 },
    // Extra cover for the long sand axis
    { t: 'drum', x: 5, z: 10, n: 3, col: 0xb8783c, stripe: 0xffd090 },
    { t: 'cov', x: -6, z: 5, w: 1.6, h: 0.85, d: 0.8, col: 0x4a3420, top: 0xffd090 },
    { t: 'cov', x: 6, z: -4, w: 1.6, h: 0.85, d: 0.8, col: 0x4a3420, top: 0xffd090 },
    { t: 'dogleg', x: -8, z: 16, len1: 4.0, rotY1: Math.PI / 2, gap1: 1.25, gapPos1: 0.3, x2: -5.5, z2: 13.0, len2: 4.2, rotY2: 0, gap2: 1.3, gapPos2: -0.4, geometryId: 'b9_inspection_dog', roomId: 'dock_intake' },
    { t: 'corridor', x: 12, z: -8, len: 5.0, rotY: Math.PI / 2, width: 1.15, gap: 1.2, gapPos: 0, roomId: 'foreman_cage', geometryId: 'b9_tower_corridor' },
    { t: 'divider', x: 0, z: 10, len: 6.0, rotY: 0, gap: 1.5, gapPos: 0, roomId: 'mid_lane_center', geometryId: 'b9_customs_spine' },
    { t: 'window', x: 14, z: -18, len: 2.8, rotY: 0, sill: 1.2, head: 2.2, col: 0xffb060, frameCol: 0x282018, roomId: 'drum_lane', geometryId: 'b9_lane_glass' },
    { t: 'cov', x: -7.2, z: 18.5, w: 1.35, h: 0.86, d: 0.78, col: 0x4a3420, top: 0xffd090, roomId: 'dock_intake' },
    { t: 'cov', x: 7.4, z: 18.0, w: 1.32, h: 0.85, d: 0.76, col: 0x4a3420, top: 0xffb060, roomId: 'dock_intake' },
    { t: 'cov', x: 0, z: 20.8, w: 1.2, h: 0.82, d: 0.72, col: 0x5a4838, top: 0xffd090, roomId: 'dock_intake' },
  ],
  // ── 10: CATHEDRAL — confessionals + stained-glass partition ──────────
  10: [
    // Sacristy sub-room (BW)
    { t: 'divider', x: -12, z: -14, len: 5.0, rotY: 0, gap: 1.4, gapPos: 0.8 },
    { t: 'divider', x: -10, z: -17, len: 3.0, rotY: Math.PI/2, gap: 0 },
    // Sacristy stained-glass — see the cardinal at his desk
    { t: 'window', x: -8.5, z: -14, len: 2.6, rotY: 0, sill: 0.9, head: 2.0, col: 0xffd060, frameCol: 0x14100a },
    // Confessional booths (MW) — two narrow sub-rooms side by side
    { t: 'divider', x: -15, z: -2, len: 4.0, rotY: 0, gap: 1.2, gapPos: 0 },
    { t: 'divider', x: -13, z: -4, len: 3.5, rotY: Math.PI/2, gap: 0 },
    { t: 'divider', x: -13, z: 0, len: 3.5, rotY: Math.PI/2, gap: 0 },
    // Confessional lattice window (lattice = stained-glass small panel)
    { t: 'window', x: -11, z: -2, len: 1.6, rotY: 0, sill: 1.1, head: 1.8, col: 0xffe8b0, frameCol: 0x281810 },
    // Bell-tower stair partition (BE)
    { t: 'divider', x: 12, z: -14, len: 4.0, rotY: 0, gap: 1.3, gapPos: 0 },
    // Altar railing window (BC) — symbolic glass between altar and nave
    { t: 'window', x: 0, z: -8, len: 4.5, rotY: 0, sill: 0.3, head: 1.3, col: 0xffe8b0, frameCol: 0x281810 },
    { t: 'lamp', x: -4, z: 4, col: 0xffe8b0 },
    { t: 'lamp', x: 4, z: 4, col: 0xffe8b0 },
    { t: 'plinth', x: -8, z: 16 },
    { t: 'plinth', x: 8, z: 16 },
    { t: 'dogleg', x: 0, z: 18, len1: 5.5, rotY1: 0, gap1: 1.4, gapPos1: 0.5, x2: -3.0, z2: 15.0, len2: 4.0, rotY2: Math.PI / 2, gap2: 1.2, gapPos2: 0, geometryId: 'b10_nave_dog', roomId: 'dock_intake' },
    { t: 'corridor', x: -14, z: 4, len: 4.8, rotY: 0, width: 1.12, gap: 1.15, gapPos: 0, roomId: 'mid_lane_west', geometryId: 'b10_transept_corridor' },
    { t: 'divider', x: 8, z: 0, len: 5.0, rotY: Math.PI / 2, gap: 1.3, gapPos: -0.4, roomId: 'drum_lane', geometryId: 'b10_choir_kink' },
    { t: 'window', x: 0, z: -14, len: 4.0, rotY: Math.PI / 2, sill: 0.5, head: 2.0, col: 0xffe8b0, frameCol: 0x281810, roomId: 'relay_cage', geometryId: 'b10_crossing_glass' },
    { t: 'cov', x: -5.5, z: 19.0, w: 1.34, h: 0.86, d: 0.78, col: 0x3a3428, top: 0xffe8b0, roomId: 'dock_intake' },
    { t: 'cov', x: 5.6, z: 18.5, w: 1.3, h: 0.85, d: 0.76, col: 0x3a3428, top: 0xffe8b0, roomId: 'dock_intake' },
    { t: 'lamp', x: 0, z: 22, col: 0xffe8b0 },
  ],
  // ── 11: KARELIA FREIGHTER — engine companionway + bridge glass ──────
  11: [
    // Engine companionway (MW) — narrow corridor with engine room sub-room
    { t: 'divider', x: -12, z: 0, len: 6.0, rotY: Math.PI/2, gap: 1.3, gapPos: 1.8 },
    { t: 'divider', x: -10, z: -3, len: 3.0, rotY: 0, gap: 0 },
    // Engine room control window — see/shoot at the engineer
    { t: 'window', x: -8.5, z: 0, len: 2.4, rotY: 0, sill: 1.0, head: 2.0, col: 0xff8040, frameCol: 0x14181c },
    // Bridge approach (BC) — captain's sub-room
    { t: 'divider', x: 0, z: -14, len: 5.5, rotY: 0, gap: 1.4, gapPos: 0 },
    { t: 'divider', x: 4, z: -16, len: 3.0, rotY: Math.PI/2, gap: 0 },
    // Bridge wing glass — vault out onto the bridge wing
    { t: 'window', x: -5, z: -14, len: 2.6, rotY: 0, sill: 0.9, head: 2.0, col: 0x80b0d0, frameCol: 0x14181c },
    { t: 'window', x: 5, z: -14, len: 2.6, rotY: 0, sill: 0.9, head: 2.0, col: 0x80b0d0, frameCol: 0x14181c },
    // Container labyrinth divider (FC) — close off the spine
    { t: 'divider', x: 0, z: 14, len: 6.0, rotY: Math.PI/2, gap: 1.3, gapPos: 1.0 },
    { t: 'divider', x: 4, z: 12, len: 3.0, rotY: 0, gap: 0 },
    // Crew quarters (BE) — small sub-room
    { t: 'divider', x: 12, z: -14, len: 4.0, rotY: 0, gap: 1.3, gapPos: -0.8 },
    { t: 'pipes', x: -14, z: -18, len: 5 },
    // Companionway dogleg — engine room threshold read (kit)
    { t: 'dogleg', x: -11.5, z: 0.5, len1: 3.2, rotY1: Math.PI / 2, gap1: 1.25, gapPos1: 0.5, x2: -12.2, z2: -2.2, len2: 2.6, rotY2: 0, gap2: 0, geometryId: 'b11_engine_dogleg' },
    { t: 'corridor', x: 0, z: 16, len: 6.0, rotY: 0, width: 1.16, gap: 1.22, gapPos: 0.3, roomId: 'mid_lane_center', geometryId: 'b11_deck_corridor' },
    { t: 'divider', x: 14, z: 14, len: 4.5, rotY: Math.PI / 2, gap: 1.25, gapPos: 0.2, roomId: 'dock_intake', geometryId: 'b11_starboard_kink' },
    { t: 'window', x: -8, z: -18, len: 2.6, rotY: 0, sill: 0.95, head: 2.0, col: 0xff8040, frameCol: 0x14181c, roomId: 'relay_cage', geometryId: 'b11_hold_peek' },
    { t: 'vestibule', x: 12, z: -6, rotY: 0, w: 3.2, gap: 1.1, gapPos: 0, dx: 0.8, dz: 1.4, len2: 3.0, rotY2: Math.PI / 2, gap2: 1.0, geometryId: 'b11_be_vest', geometryId2: 'b11_be_vest_p' },
    { t: 'cov', x: -6.4, z: 18.3, w: 1.33, h: 0.86, d: 0.78, col: 0x2a2420, top: 0xff8040, roomId: 'dock_intake' },
    { t: 'cov', x: 6.5, z: 17.7, w: 1.3, h: 0.85, d: 0.76, col: 0x2a2420, top: 0x80b0d0, roomId: 'dock_intake' },
    { t: 'crate2', x: -2.5, z: 15.5, col: 0x5a4838, roomId: 'dock_intake' },
  ],
  // ── 12: THE SPIRE — apex glass everywhere ────────────────────────────
  12: [
    // Boardroom (MW) — large sub-room walls
    { t: 'divider', x: -11, z: 0, len: 7.0, rotY: Math.PI/2, gap: 1.5, gapPos: 0 },
    { t: 'divider', x: -13, z: -3, len: 4.0, rotY: 0, gap: 0 },
    // Boardroom glass wall — view into executive meeting
    { t: 'window', x: -9, z: 0, len: 4.0, rotY: Math.PI/2, sill: 0.3, head: 2.4, col: 0xc8e0ff, frameCol: 0x06070a },
    // Executive vault sub-room (ME)
    { t: 'divider', x: 13, z: 0, len: 6.0, rotY: Math.PI/2, gap: 1.4, gapPos: -1.0 },
    { t: 'divider', x: 15, z: -3, len: 3.0, rotY: 0, gap: 0 },
    // Vault inspection window
    { t: 'window', x: 11, z: 0, len: 3.0, rotY: Math.PI/2, sill: 0.95, head: 2.05, col: 0xffd060, frameCol: 0x06070a },
    // Helipad approach (BC) — glass corridor onto the helipad
    { t: 'window', x: -6, z: -10, len: 4.0, rotY: 0, sill: 0.0, head: 2.4, col: 0xc8e0ff, frameCol: 0x06070a },
    { t: 'window', x: 6, z: -10, len: 4.0, rotY: 0, sill: 0.0, head: 2.4, col: 0xc8e0ff, frameCol: 0x06070a },
    // Reception court partition (FC)
    { t: 'divider', x: 0, z: 14, len: 5.0, rotY: 0, gap: 1.5, gapPos: 0 },
    // Helipad stair safety glass (BE)
    { t: 'window', x: 12, z: -16, len: 3.4, rotY: Math.PI/2, sill: 0.0, head: 1.1, col: 0xc8e0ff, frameCol: 0x06070a },
    { t: 'plinth', x: -8, z: 4 },
    { t: 'plinth', x: 8, z: 4 },
    { t: 'lamp', x: -6, z: -16, col: 0xc8e0ff },
    { t: 'lamp', x: 6, z: -16, col: 0xc8e0ff },
    { t: 'dogleg', x: 0, z: 8, len1: 5.0, rotY1: 0, gap1: 1.4, gapPos1: 0.6, x2: 3.5, z2: 5.0, len2: 4.5, rotY2: Math.PI / 2, gap2: 1.25, gapPos2: 0, geometryId: 'b12_skylobby_dog', roomId: 'dock_intake' },
    { t: 'corridor', x: -14, z: 0, len: 5.5, rotY: Math.PI / 2, width: 1.14, gap: 1.2, gapPos: 0, roomId: 'alarm_relay_room', geometryId: 'b12_board_corridor' },
    { t: 'divider', x: 0, z: -4, len: 6.0, rotY: Math.PI / 2, gap: 1.45, gapPos: 0, roomId: 'mid_lane_center', geometryId: 'b12_glass_spine' },
    { t: 'window', x: -4, z: 12, len: 3.0, rotY: 0, sill: 0.2, head: 2.5, col: 0xc8e0ff, frameCol: 0x06070a, roomId: 'dock_intake', geometryId: 'b12_atrium_curtain' },
    { t: 'vestibule', x: 0, z: -18, rotY: 0, w: 4.8, gap: 1.4, gapPos: 0, dx: 0, dz: -1.5, len2: 4.0, rotY2: Math.PI / 2, gap2: 1.2, geometryId: 'b12_helipad_vest', geometryId2: 'b12_helipad_vest_n', roomId: 'relay_cage' },
    { t: 'cov', x: -5.8, z: 18.6, w: 1.32, h: 0.85, d: 0.77, col: 0x0a0c10, top: 0xc8e0ff, roomId: 'dock_intake' },
    { t: 'cov', x: 5.9, z: 18.1, w: 1.3, h: 0.84, d: 0.75, col: 0x0a0c10, top: 0xffd060, roomId: 'dock_intake' },
    { t: 'haz', x: 0, z: 16.5, w: 2.0, d: 1.0, col: 0x040608, alpha: 0.33, glow: 0xc8e0ff, roomId: 'dock_intake' },
  ],
};

export function getSequenceGameplayProfile(bn){
  const zoneRoles = BUILDING_ZONE_ROLES[bn] || DEFAULT_ZONE_ROLES;
  const layout = CAMPAIGN_LAYOUT_BY_BN[Math.min(Math.max(bn | 0, 1), 12) - 1] ?? 0;
  return {
    zoneRoles,
    beats: zoneRoles.map(r => ENCOUNTER_BEATS[r.tag] || ENCOUNTER_BEATS.read),
    signature: zoneRoles.map(r => r.telegraph).join(' / '),
    layout,
    layoutMode: layout === 0 ? 'dock' : 'lobby',
  };
}

/** Cell AABBs shared with campaign floorplan / encounter authoring. */
export { CELL_REGIONS as CAMPAIGN_CELL_REGIONS };
