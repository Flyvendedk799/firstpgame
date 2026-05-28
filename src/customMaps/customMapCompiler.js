import { DEFAULT_CUSTOM_MAP_BOUNDS, DEFAULT_CUSTOM_ZONE_BOUNDS, normalizeCustomMap, normalizeDoorAccess } from './schema.js';

const COLLISION_WALLS = new Set(['wall_aabb', 'cover_aabb', 'transparent_window_aabb']);
const LEVEL_ONE_WALL_HEIGHT = 4.25;
const KIT_AUTHORED_WALL_HEIGHT = 3.3;
const FLOOR_EDGE_PAD = 0.85;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function prefabMap(kitManifest) {
  return new Map((kitManifest && Array.isArray(kitManifest.prefabs) ? kitManifest.prefabs : []).map((p) => [p.id, p]));
}

function rotateXZ(x, z, yaw) {
  const c = Math.cos(yaw || 0);
  const s = Math.sin(yaw || 0);
  return { x: x * c - z * s, z: x * s + z * c };
}

function expandedBounds(bounds, pad = FLOOR_EDGE_PAD) {
  const b = Object.assign({}, DEFAULT_CUSTOM_MAP_BOUNDS, bounds || {});
  return {
    x0: (Number(b.x0) || 0) - pad,
    x1: (Number(b.x1) || 0) + pad,
    z0: (Number(b.z0) || 0) - pad,
    z1: (Number(b.z1) || 0) + pad,
  };
}

function isDoorPrefab(prefab) {
  if (!prefab) return false;
  if (prefab.category === 'doors') return true;
  if (String(prefab.id || '').startsWith('door.')) return true;
  return Array.isArray(prefab.tags) && prefab.tags.includes('door');
}

function isWindowPrefab(prefab) {
  if (!prefab) return false;
  if (prefab.category === 'windows') return true;
  if (String(prefab.id || '').startsWith('window.')) return true;
  return Array.isArray(prefab.tags) && prefab.tags.includes('window');
}

function isAperturePrefab(prefab) {
  return isDoorPrefab(prefab) || isWindowPrefab(prefab);
}

function doorAccessForObject(object, prefab) {
  if (!isDoorPrefab(prefab)) return null;
  return normalizeDoorAccess(object && object.doorAccess, 'player') || 'player';
}

function doorCanOpen(access, actor) {
  const mode = normalizeDoorAccess(access, 'player');
  if (mode === 'both') return true;
  if (mode === 'player') return actor === 'player';
  if (mode === 'enemies') return actor === 'enemy' || actor === 'enemies';
  return false;
}

function prefabLocalBounds(prefab) {
  const out = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const part of (prefab && prefab.parts) || []) {
    if (!part || part.kind !== 'box') continue;
    const size = part.size || [];
    const off = part.offset || [];
    const sx = Math.abs(Number(size[0]) || 0);
    const sz = Math.abs(Number(size[2]) || 0);
    const ox = Number(off[0]) || 0;
    const oz = Number(off[2]) || 0;
    out.minX = Math.min(out.minX, ox - sx / 2);
    out.maxX = Math.max(out.maxX, ox + sx / 2);
    out.minZ = Math.min(out.minZ, oz - sz / 2);
    out.maxZ = Math.max(out.maxZ, oz + sz / 2);
  }
  if (!Number.isFinite(out.minX)) return { minX: -1.6, maxX: 1.6, minZ: -0.2, maxZ: 0.2 };
  return out;
}

function isStructurePrefab(prefab) {
  return !!prefab && (prefab.category === 'walls' || prefab.category === 'modules');
}

function isWallLikePart(part, prefab) {
  if (!part || part.kind !== 'box' || !isStructurePrefab(prefab)) return false;
  if (!['wall_aabb', 'cover_aabb', 'transparent_window_aabb', 'decorative_only'].includes(part.collision)) return false;
  const size = part.size || [];
  const sx = Math.abs(Number(size[0]) || 0);
  const sz = Math.abs(Number(size[2]) || 0);
  return Math.max(sx, sz) >= 1.05 && Math.min(sx, sz) <= 1.1;
}

function unionBoxes(boxes) {
  const clean = (boxes || []).filter(Boolean);
  if (!clean.length) return null;
  return clean.reduce((acc, box) => ({
    x0: Math.min(acc.x0, box.x0),
    x1: Math.max(acc.x1, box.x1),
    z0: Math.min(acc.z0, box.z0),
    z1: Math.max(acc.z1, box.z1),
    y0: Math.min(acc.y0, box.y0),
    y1: Math.max(acc.y1, box.y1),
  }), { ...clean[0] });
}

function apertureCutoutsForObject(obj, prefab, floorY) {
  if (!obj || !prefab || !isAperturePrefab(prefab)) return [];
  const boxParts = (prefab.parts || []).filter((part) => part && part.kind === 'box');
  if (!boxParts.length) return [];
  if (isDoorPrefab(prefab)) {
    const box = unionBoxes(boxParts.map((part) => partWorldAabb(part, obj, floorY, prefab)));
    if (!box) return [];
    const baseY = (Number(floorY) || 0) + (Number(obj.y) || 0);
    box.y0 = Math.min(box.y0, baseY);
    return [{ objectId: obj.id, prefabId: obj.prefabId, kind: 'door', box }];
  }
  const glassParts = boxParts.filter((part) => part.collision === 'transparent_window_aabb' || part.glassPane);
  const cutters = glassParts.length ? glassParts : boxParts.filter((part) => COLLISION_WALLS.has(part.collision));
  return cutters.map((part) => ({
    objectId: obj.id,
    prefabId: obj.prefabId,
    kind: 'window',
    box: partWorldAabb(part, obj, floorY, prefab),
  }));
}

function boxesOverlap(a, b, minY = 0.06, minLong = 0.08, minThick = 0.02) {
  if (!a || !b) return false;
  const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const iz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return iy > minY && Math.max(ix, iz) > minLong && Math.min(ix, iz) > minThick;
}

function validSegmentBox(box) {
  if (!box) return false;
  return (box.x1 - box.x0) > 0.035 && (box.z1 - box.z0) > 0.035 && (box.y1 - box.y0) > 0.035;
}

function segment(box, collision2d, seeThrough2d = false) {
  return { box, collision2d: collision2d !== false, seeThrough2d: !!seeThrough2d };
}

function splitSegmentByCutout(seg, cutout) {
  const box = seg && seg.box;
  const cut = cutout && cutout.box;
  if (!boxesOverlap(box, cut)) return [seg];
  const longAxis = (box.x1 - box.x0) >= (box.z1 - box.z0) ? 'x' : 'z';
  const cutY0 = clamp(cut.y0, box.y0, box.y1);
  const cutY1 = clamp(cut.y1, box.y0, box.y1);
  if (cutY1 - cutY0 <= 0.08) return [seg];
  const baseCollision = seg.collision2d !== false;
  const baseSeeThrough = !!seg.seeThrough2d;
  const out = [];
  const add = (nextBox, collision2d, seeThrough2d = false) => {
    if (validSegmentBox(nextBox)) out.push(segment(nextBox, baseCollision && collision2d, baseSeeThrough || seeThrough2d));
  };
  const windowSill = cutout.kind === 'window';
  if (longAxis === 'x') {
    const cutX0 = clamp(cut.x0, box.x0, box.x1);
    const cutX1 = clamp(cut.x1, box.x0, box.x1);
    if (cutX1 - cutX0 <= 0.08) return [seg];
    add({ ...box, x1: cutX0 }, true);
    add({ ...box, x0: cutX1 }, true);
    add({ ...box, x0: cutX0, x1: cutX1, y1: cutY0 }, true, windowSill);
    add({ ...box, x0: cutX0, x1: cutX1, y0: cutY1 }, false);
  } else {
    const cutZ0 = clamp(cut.z0, box.z0, box.z1);
    const cutZ1 = clamp(cut.z1, box.z0, box.z1);
    if (cutZ1 - cutZ0 <= 0.08) return [seg];
    add({ ...box, z1: cutZ0 }, true);
    add({ ...box, z0: cutZ1 }, true);
    add({ ...box, z0: cutZ0, z1: cutZ1, y1: cutY0 }, true, windowSill);
    add({ ...box, z0: cutZ0, z1: cutZ1, y0: cutY1 }, false);
  }
  return out;
}

function splitBoxByCutouts(box, cutouts) {
  let parts = [segment(box, true)];
  let wasCut = false;
  for (const cutout of cutouts || []) {
    const next = [];
    for (const part of parts) {
      const split = splitSegmentByCutout(part, cutout);
      if (split.length !== 1 || split[0] !== part) wasCut = true;
      next.push(...split);
    }
    parts = next;
    if (!parts.length) break;
  }
  return { segments: parts, wasCut };
}

function wallHeightNormalized(part, prefab) {
  if (!part || part.kind !== 'box' || part.collision !== 'wall_aabb') return false;
  if (!prefab || !['walls', 'modules'].includes(prefab.category)) return false;
  const h = Math.abs(Number(part.size && part.size[1]) || 0);
  return h >= 2.85 && h <= 3.65;
}

function wallTopDecorRaised(part, prefab) {
  if (!part || part.kind !== 'box' || part.collision !== 'decorative_only') return false;
  if (!prefab || !['walls', 'modules'].includes(prefab.category)) return false;
  const oy = Number(part.offset && part.offset[1]) || 0;
  const sy = Math.abs(Number(part.size && part.size[1]) || 0);
  return oy > 2.65 && sy <= 0.75;
}

export function partRuntimeTransform(part, object = {}, floorY = 0, prefab = null) {
  const scale = Number.isFinite(object.scale) ? object.scale : 1;
  const sx = (part.size && part.size[0] ? part.size[0] : 0) * scale;
  let sy = (part.size && part.size[1] ? part.size[1] : 0) * scale;
  const sz = (part.size && part.size[2] ? part.size[2] : 0) * scale;
  const ox = ((part.offset && part.offset[0]) || 0) * scale;
  const oz = ((part.offset && part.offset[2]) || 0) * scale;
  let oy = ((part.offset && part.offset[1]) || 0) * scale;
  if (wallHeightNormalized(part, prefab)) {
    sy = LEVEL_ONE_WALL_HEIGHT * scale;
    oy = sy / 2;
  } else if (wallTopDecorRaised(part, prefab)) {
    oy += (LEVEL_ONE_WALL_HEIGHT - KIT_AUTHORED_WALL_HEIGHT) * scale;
  }
  return {
    sx,
    sy,
    sz,
    ox,
    oy: (Number(floorY) || 0) + (object.y || 0) + oy,
    oz,
  };
}

export function partWorldAabb(part, object, floorY = 0, prefab = null) {
  const yaw = Number.isFinite(object.yaw) ? object.yaw : 0;
  const { sx, sy, sz, ox, oy, oz } = partRuntimeTransform(part, object, floorY, prefab);
  const corners = [
    [-sx / 2, -sz / 2],
    [sx / 2, -sz / 2],
    [sx / 2, sz / 2],
    [-sx / 2, sz / 2],
  ].map(([x, z]) => {
    const local = rotateXZ(ox + x, oz + z, yaw);
    return { x: object.x + local.x, z: object.z + local.z };
  });
  return {
    x0: Math.min(...corners.map((p) => p.x)),
    x1: Math.max(...corners.map((p) => p.x)),
    z0: Math.min(...corners.map((p) => p.z)),
    z1: Math.max(...corners.map((p) => p.z)),
    y0: oy - sy / 2,
    y1: oy + sy / 2,
  };
}

function perimeterWalls(bounds, pad = 0.8, thick = 0.7) {
  const b = Object.assign({}, DEFAULT_CUSTOM_MAP_BOUNDS, bounds || {});
  return [
    { x0: b.x0 - pad, x1: b.x1 + pad, z0: b.z0 - thick - pad, z1: b.z0 - pad, perimeter: true },
    { x0: b.x0 - pad, x1: b.x1 + pad, z0: b.z1 + pad, z1: b.z1 + thick + pad, perimeter: true },
    { x0: b.x0 - thick - pad, x1: b.x0 - pad, z0: b.z0 - pad, z1: b.z1 + pad, perimeter: true },
    { x0: b.x1 + pad, x1: b.x1 + thick + pad, z0: b.z0 - pad, z1: b.z1 + pad, perimeter: true },
  ];
}

function zoneForZ(z, zoneBounds) {
  const zb = Object.assign({}, DEFAULT_CUSTOM_ZONE_BOUNDS, zoneBounds || {});
  if (z > zb.zSplit) return 0;
  if (z >= -zb.zSplit) return 1;
  return 2;
}

function pointToAabbDist2(px, pz, box) {
  const cx = Math.max(box.x0, Math.min(box.x1, px));
  const cz = Math.max(box.z0, Math.min(box.z1, pz));
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

function playerSpawnClear(px, pz, walls, radius = 0.42) {
  for (const wall of walls || []) {
    if (!wall || wall.broken || wall.isWindow) continue;
    if (pointToAabbDist2(px, pz, wall) < radius * radius) return false;
  }
  return true;
}

function lineHitsWall(a, b, wall, pad = 0.08) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const tests = [
    [-dx, a.x - (wall.x0 - pad)],
    [dx, (wall.x1 + pad) - a.x],
    [-dz, a.z - (wall.z0 - pad)],
    [dz, (wall.z1 + pad) - a.z],
  ];
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-6) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

function viewClearDistance(x, z, yaw, walls, maxDist = 5.5) {
  const dir = { x: Math.sin(yaw || 0), z: Math.cos(yaw || 0) };
  for (let d = 0.45; d <= maxDist; d += 0.35) {
    const end = { x: x + dir.x * d, z: z + dir.z * d };
    for (const wall of walls || []) {
      if (!wall || wall.broken || wall.isWindow || wall.perimeter) continue;
      if (lineHitsWall({ x, z }, end, wall, 0.05)) return d;
    }
  }
  return maxDist;
}

function repairPlayerSpawn(rawSpawn, map, walls, exitZone, warnings) {
  const b = Object.assign({}, DEFAULT_CUSTOM_MAP_BOUNDS, map.bounds || {});
  const inset = 1.15;
  const desired = {
    x: Number.isFinite(Number(rawSpawn && rawSpawn.x)) ? Number(rawSpawn.x) : 0,
    z: Number.isFinite(Number(rawSpawn && rawSpawn.z)) ? Number(rawSpawn.z) : 0,
    yaw: Number.isFinite(Number(rawSpawn && rawSpawn.yaw)) ? Number(rawSpawn.yaw) : Math.PI,
  };
  let x = clamp(desired.x, b.x0 + inset, b.x1 - inset);
  let z = clamp(desired.z, b.z0 + inset, b.z1 - inset);
  if (x !== desired.x || z !== desired.z) warnings.push('player_spawn_clamped_to_bounds');
  if (!playerSpawnClear(x, z, walls)) {
    const seed = ((desired.x * 12.9898 + desired.z * 78.233) % 1 + 1) % 1;
    let found = null;
    const rings = [0.75, 1.15, 1.65, 2.25, 3.0, 4.0, 5.25, 6.75, 8.5, 10.5];
    for (const radius of rings) {
      const steps = radius < 2 ? 16 : 28;
      for (let i = 0; i < steps; i++) {
        const a = seed * Math.PI * 2 + (i / steps) * Math.PI * 2;
        const tx = clamp(x + Math.cos(a) * radius, b.x0 + inset, b.x1 - inset);
        const tz = clamp(z + Math.sin(a) * radius, b.z0 + inset, b.z1 - inset);
        if (playerSpawnClear(tx, tz, walls)) {
          found = { x: tx, z: tz };
          break;
        }
      }
      if (found) break;
    }
    if (found) {
      x = found.x;
      z = found.z;
      warnings.push('player_spawn_repaired_from_collision');
    }
  }
  let yaw = desired.yaw;
  if (viewClearDistance(x, z, yaw, walls) < 0.9) {
    const exitCenter = exitZone ? { x: (exitZone.x0 + exitZone.x1) / 2, z: (exitZone.z0 + exitZone.z1) / 2 } : { x: 0, z: 0 };
    const candidates = [
      Math.atan2(exitCenter.x - x, exitCenter.z - z),
      0,
      Math.PI / 2,
      Math.PI,
      -Math.PI / 2,
      Math.PI / 4,
      -Math.PI / 4,
      (Math.PI * 3) / 4,
      (-Math.PI * 3) / 4,
    ];
    yaw = candidates
      .map((candidate) => ({ yaw: candidate, dist: viewClearDistance(x, z, candidate, walls) }))
      .sort((a, b2) => b2.dist - a.dist)[0].yaw;
    warnings.push('player_spawn_yaw_repaired_from_wall');
  }
  const floorY = Number.isFinite(Number(rawSpawn && rawSpawn.floorY)) ? Number(rawSpawn.floorY) : map.floorY;
  return { x, y: floorY, z, yaw, floorY: map.floorY };
}

function clonePoint2(point) {
  return {
    x: Number(point && point.x) || 0,
    z: Number(point && point.z) || 0,
    yaw: Number.isFinite(Number(point && point.yaw)) ? Number(point.yaw) : null,
    pauseSeconds: Number.isFinite(Number(point && point.pauseSeconds)) ? Math.max(0, Number(point.pauseSeconds)) : null,
  };
}

function rectCenter(rect) {
  if (!rect) return null;
  return {
    x: ((Number(rect.x0) || 0) + (Number(rect.x1) || 0)) / 2,
    z: ((Number(rect.z0) || 0) + (Number(rect.z1) || 0)) / 2,
  };
}

function byId(rows) {
  return Object.fromEntries((rows || []).filter((row) => row && row.id).map((row) => [row.id, row]));
}

function routeAssignedTo(route, enemyId) {
  return !!(route && enemyId && Array.isArray(route.assignedEnemyIds) && route.assignedEnemyIds.includes(enemyId));
}

export function buildCustomMapTacticalGraph(inputMap) {
  const map = normalizeCustomMap(inputMap);
  const markers = map.markers || {};
  const patrolRoutesById = byId(markers.patrolRoutes);
  const flankRoutesById = byId(markers.flankRoutes);
  const coverHintsById = byId(markers.coverHints);
  const peekAnglesById = byId(markers.peekAngles);
  const holdPositionsById = byId(markers.holdPositions);
  const triggerVolumesById = byId(markers.triggerVolumes);
  const combatZonesById = byId(markers.combatZones);
  const breachPointsById = byId(markers.breachPoints);
  const sniperPerchesById = byId(markers.sniperPerches);
  const enemyTactics = {};

  for (const spawn of markers.enemySpawns || []) {
    if (!spawn || !spawn.id) continue;
    const links = Object.assign({}, spawn.links || {});
    if (!links.patrolRouteId) {
      const assigned = (markers.patrolRoutes || []).find((route) => routeAssignedTo(route, spawn.id));
      if (assigned) links.patrolRouteId = assigned.id;
    }
    if (!links.flankRouteId) {
      const assigned = (markers.flankRoutes || []).find((route) => routeAssignedTo(route, spawn.id));
      if (assigned) links.flankRouteId = assigned.id;
    }
    const patrolRoute = links.patrolRouteId ? patrolRoutesById[links.patrolRouteId] : null;
    const flankRoute = links.flankRouteId ? flankRoutesById[links.flankRouteId] : null;
    const coverHint = links.coverHintId ? (coverHintsById[links.coverHintId] || holdPositionsById[links.coverHintId]) : null;
    const peekAngle = links.peekAngleId ? peekAnglesById[links.peekAngleId] : null;
    const holdPosition = links.holdPositionId ? holdPositionsById[links.holdPositionId] : null;
    const triggerVolume = links.triggerVolumeId ? triggerVolumesById[links.triggerVolumeId] : null;
    const combatZone = links.combatZoneId ? combatZonesById[links.combatZoneId] : null;
    enemyTactics[spawn.id] = {
      links,
      patrolRoute,
      flankRoute,
      coverHint,
      peekAngle,
      holdPosition,
      triggerVolume,
      combatZone,
      patrolPoints: patrolRoute ? (patrolRoute.points || []).map(clonePoint2) : [],
      flankPoints: flankRoute ? (flankRoute.points || []).map(clonePoint2) : [],
      coverHintPoint: coverHint ? { x: Number(coverHint.x) || 0, z: Number(coverHint.z) || 0 } : null,
      peekPoint: peekAngle ? { x: Number(peekAngle.x) || 0, z: Number(peekAngle.z) || 0, yaw: Number(peekAngle.yaw) || 0 } : null,
      holdPoint: holdPosition ? { x: Number(holdPosition.x) || 0, z: Number(holdPosition.z) || 0, radius: Number(holdPosition.radius) || 1.2 } : null,
      triggerCenter: rectCenter(triggerVolume),
      combatZoneCenter: rectCenter(combatZone),
    };
  }

  return {
    patrolRoutesById,
    flankRoutesById,
    coverHintsById,
    peekAnglesById,
    holdPositionsById,
    triggerVolumesById,
    combatZonesById,
    breachPointsById,
    sniperPerchesById,
    enemyTactics,
    counts: {
      patrolRoutes: (markers.patrolRoutes || []).length,
      flankRoutes: (markers.flankRoutes || []).length,
      combatZones: (markers.combatZones || []).length,
      triggerVolumes: (markers.triggerVolumes || []).length,
      coverHints: (markers.coverHints || []).length,
      breachPoints: (markers.breachPoints || []).length,
      sniperPerches: (markers.sniperPerches || []).length,
    },
  };
}

export function collectCustomMapGeometry(inputMap, kitManifest) {
  const map = normalizeCustomMap(inputMap);
  const tacticalGraph = buildCustomMapTacticalGraph(map);
  const kit = prefabMap(kitManifest);
  const walls = [];
  const vaultables = [];
  const floorRegions = [{ ...expandedBounds(map.bounds), floorY: map.floorY }];
  const placedParts = [];
  const errors = [];
  const warnings = [];
  const apertureCutouts = [];

  for (const obj of map.objects || []) {
    const prefab = kit.get(obj.prefabId);
    if (!prefab) continue;
    apertureCutouts.push(...apertureCutoutsForObject(obj, prefab, map.floorY));
  }

  for (const obj of map.objects || []) {
    const prefab = kit.get(obj.prefabId);
    if (!prefab) {
      errors.push(`missing_prefab:${obj.prefabId}`);
      continue;
    }
    const doorAccess = doorAccessForObject(obj, prefab);
    for (const part of prefab.parts || []) {
      const box = partWorldAabb(part, obj, map.floorY, prefab);
      const matchingCutouts = isWallLikePart(part, prefab)
        ? apertureCutouts.filter((cutout) => cutout.objectId !== obj.id && boxesOverlap(box, cutout.box))
        : [];
      const split = matchingCutouts.length ? splitBoxByCutouts(box, matchingCutouts) : { segments: [segment(box, true)], wasCut: false };
      if (part.collision === 'floor_aabb') {
        floorRegions.push({ x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1, floorY: map.floorY });
      }
      split.segments.forEach((seg, segmentIndex) => {
        const segmentBox = seg.box;
        const placed = {
          object: obj,
          prefab,
          part,
          box: segmentBox,
          sourceBox: box,
          runtimeBox: split.wasCut ? segmentBox : null,
          cutSegment: split.wasCut,
          cutSegmentIndex: split.wasCut ? segmentIndex : null,
          collision2d: seg.collision2d !== false,
          doorAccess,
        };
        placedParts.push(placed);
        if (!COLLISION_WALLS.has(part.collision) || seg.collision2d === false) return;
        const entry = {
          x0: segmentBox.x0,
          x1: segmentBox.x1,
          z0: segmentBox.z0,
          z1: segmentBox.z1,
          roomId: obj.roomId || null,
          geometryId: `${obj.id}:${part.name}${split.wasCut ? `:cut${segmentIndex}` : ''}`,
          objectId: obj.id,
          prefabId: obj.prefabId,
          partName: part.name || null,
          floorplanRole: part.floorplanRole || null,
          isWindow: part.collision === 'transparent_window_aabb' || !!part.glassPane || !!seg.seeThrough2d,
          openableDoor: !!doorAccess,
          doorAccess: doorAccess || null,
        };
        placed.wallEntry = entry;
        walls.push(entry);
        const height = Math.max(0, segmentBox.y1 - map.floorY);
        const width = Math.abs(segmentBox.x1 - segmentBox.x0);
        const depth = Math.abs(segmentBox.z1 - segmentBox.z0);
        if (part.collision === 'cover_aabb' && height >= 0.38 && height <= 1.75 && width >= 0.18 && depth >= 0.18) {
          vaultables.push({ ...entry, height: segmentBox.y1, objectHeight: height, vaultCandidate: true });
        }
      });
    }
  }

  const zoneDoors = [];
  for (const marker of map.markers.zoneDoors || []) {
    const obj = {
      id: marker.id,
      x: Number(marker.x) || 0,
      z: Number(marker.z) || 0,
      y: 0,
      yaw: Number(marker.yaw) || 0,
      scale: 1,
    };
    const doorPart = { size: [Number(marker.width) || 5.4, 3.1, Number(marker.depth) || 0.62], offset: [0, 1.55, 0] };
    const box = partWorldAabb(doorPart, obj, map.floorY);
    const entry = {
      x0: box.x0,
      x1: box.x1,
      z0: box.z0,
      z1: box.z1,
      zoneDoorId: Number(marker.zoneId) || 0,
      gateId: marker.id,
      geometryId: marker.id,
      floorplanRole: 'closed_zone_gate',
    };
    walls.push(entry);
    zoneDoors.push({
      id: marker.id,
      zoneId: Number(marker.zoneId) || 0,
      marker,
      wallEntry: entry,
      x: obj.x,
      z: obj.z,
      width: Number(marker.width) || 5.4,
      depth: Number(marker.depth) || 0.62,
      yaw: obj.yaw,
    });
  }

  walls.push(...perimeterWalls(map.bounds));

  const zoneSpawns = [[], [], []];
  const zoneEnemyTypes = [[], [], []];
  const zoneSpawnMeta = [[], [], []];
  for (const spawn of map.markers.enemySpawns || []) {
    const z = Number.isFinite(Number(spawn.zoneId)) ? Number(spawn.zoneId) | 0 : zoneForZ(Number(spawn.z) || 0, map.zoneBounds);
    if (z < 0 || z > 2) {
      warnings.push(`enemy_spawn_bad_zone:${spawn.id}`);
      continue;
    }
    const tactics = tacticalGraph.enemyTactics[spawn.id] || {};
    const links = Object.assign({}, spawn.links || {}, tactics.links || {});
    const patrolRoute = tactics.patrolRoute || null;
    const flankRoute = tactics.flankRoute || null;
    zoneSpawns[z].push({ x: Number(spawn.x) || 0, y: map.floorY, z: Number(spawn.z) || 0, yaw: Number(spawn.yaw) || 0 });
    zoneEnemyTypes[z].push(spawn.enemyType || 'soldier');
    zoneSpawnMeta[z].push({
      id: spawn.id,
      roomId: spawn.roomId || `custom_zone_${z}`,
      encounterId: spawn.encounterId || `custom_${map.id}_z${z}`,
      encounterType: spawn.activation || 'zone_start',
      role: spawn.role || 'anchor',
      behavior: spawn.behavior || 'hold_angle',
      behaviorTuning: spawn.behaviorTuning || null,
      wave: spawn.spawnWave || 'initial',
      yaw: Number(spawn.yaw) || 0,
      links,
      coverHintId: links.coverHintId || null,
      peekAngleId: links.peekAngleId || null,
      holdPositionId: links.holdPositionId || null,
      patrolRouteId: links.patrolRouteId || null,
      flankRouteId: links.flankRouteId || null,
      triggerVolumeId: links.triggerVolumeId || null,
      combatZoneId: links.combatZoneId || null,
      patrolPoints: tactics.patrolPoints || [],
      patrolLoop: patrolRoute ? patrolRoute.loop !== false : true,
      patrolPauseSeconds: patrolRoute ? Number(patrolRoute.pauseSeconds) || 0.55 : 0,
      patrolSpeed: patrolRoute ? Number(patrolRoute.speed) || 1 : 1,
      patrolAlertBehavior: patrolRoute ? patrolRoute.alertBehavior || 'patrol_then_alarm' : null,
      flankPoints: tactics.flankPoints || [],
      flankSpeed: flankRoute ? Number(flankRoute.speed) || 1.2 : 1.2,
      coverHintPoint: tactics.coverHintPoint || null,
      peekPoint: tactics.peekPoint || null,
      holdPoint: tactics.holdPoint || null,
      triggerCenter: tactics.triggerCenter || null,
      combatZoneCenter: tactics.combatZoneCenter || null,
    });
  }

  const exits = map.markers.exits && map.markers.exits.length ? map.markers.exits : [{ x0: -4, x1: 4, z0: map.bounds.z0, z1: map.bounds.z0 + 3 }];
  const exitZone = { x0: Number(exits[0].x0), x1: Number(exits[0].x1), z0: Number(exits[0].z0), z1: Number(exits[0].z1) };
  const pickupSpawns = (map.markers.pickups || []).map((p) => ({ x: Number(p.x) || 0, y: map.floorY, z: Number(p.z) || 0, type: p.type || 'ammo' }));
  const zoneEnemyCounts = zoneSpawns.map((arr) => arr.length);
  const dims = {
    RW: Math.max(8, Math.abs((map.bounds.x1 || 0) - (map.bounds.x0 || 0))),
    RD: Math.max(8, Math.abs((map.bounds.z1 || 0) - (map.bounds.z0 || 0))),
    RH: LEVEL_ONE_WALL_HEIGHT,
  };

  const playerSpawn = repairPlayerSpawn(map.markers.playerSpawn, map, walls, exitZone, warnings);

  return {
    map,
    walls,
    vaultables,
    floorRegions,
    placedParts,
    zoneDoors,
    zoneSpawns,
    zoneEnemyTypes,
    zoneSpawnMeta,
    zoneEnemyCounts,
    pickupSpawns,
    exitZone,
    playerSpawn,
    zoneBounds: Object.assign({}, DEFAULT_CUSTOM_ZONE_BOUNDS, map.zoneBounds || {}),
    alertDoorways: zoneDoors.map((d) => ({ x: d.x, z: d.z })),
    dims,
    errors,
    warnings,
    tacticalGraph,
  };
}

function materialFor(THREE, kitManifest, cache, key) {
  if (cache.has(key)) return cache.get(key);
  const def = kitManifest && kitManifest.materials && kitManifest.materials[key] ? kitManifest.materials[key] : {};
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color || '#ffffff'),
    roughness: def.roughness ?? 0.72,
    metalness: def.metalness ?? 0.04,
  });
  mat.name = key || 'custom-map-material';
  if (def.opacity != null && def.opacity < 1) {
    mat.transparent = true;
    mat.opacity = def.opacity;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
  }
  cache.set(key, mat);
  return mat;
}

function createPartMesh(THREE, kitManifest, matCache, entry, floorY = 0) {
  const { object, prefab, part } = entry;
  if (part.kind !== 'box') return null;
  const runtimeBox = entry && entry.runtimeBox;
  const tx = runtimeBox ? null : partRuntimeTransform(part, object, floorY, prefab);
  const sx = runtimeBox ? Math.max(0.04, runtimeBox.x1 - runtimeBox.x0) : tx.sx;
  const sy = runtimeBox ? Math.max(0.04, runtimeBox.y1 - runtimeBox.y0) : tx.sy;
  const sz = runtimeBox ? Math.max(0.04, runtimeBox.z1 - runtimeBox.z0) : tx.sz;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx || 0.1, sy || 0.1, sz || 0.1),
    materialFor(THREE, kitManifest, matCache, part.material || 'wall_dark'),
  );
  if (runtimeBox) {
    mesh.position.set((runtimeBox.x0 + runtimeBox.x1) / 2, (runtimeBox.y0 + runtimeBox.y1) / 2, (runtimeBox.z0 + runtimeBox.z1) / 2);
    mesh.rotation.y = 0;
  } else {
    const off = rotateXZ(tx.ox, tx.oz, object.yaw || 0);
    mesh.position.set(object.x + off.x, tx.oy, object.z + off.z);
    mesh.rotation.y = object.yaw || 0;
  }
  mesh.castShadow = part.collision !== 'floor_aabb' && part.collision !== 'decorative_only';
  mesh.receiveShadow = true;
  mesh.name = `${object.prefabId}:${part.name}${entry.cutSegment ? `:cut${entry.cutSegmentIndex}` : ''}`;
  Object.assign(mesh.userData, {
    customMapObjectId: object.id,
    prefabId: object.prefabId,
    collision: part.collision,
    floorplanRole: part.floorplanRole || null,
    glassPane: !!part.glassPane,
    breakable: !!part.breakable,
    breakSound: part.breakSound || null,
    cutSegment: !!entry.cutSegment,
  });
  return mesh;
}

function disposeRoot(root, extra = []) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry && typeof o.geometry.dispose === 'function') o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) if (mat && typeof mat.dispose === 'function') mat.dispose();
  });
  if (root.parent) root.parent.remove(root);
  for (const o of extra) {
    if (o && o.parent) o.parent.remove(o);
    if (o && o.geometry && typeof o.geometry.dispose === 'function') o.geometry.dispose();
    const mats = Array.isArray(o && o.material) ? o.material : [o && o.material];
    for (const mat of mats) if (mat && typeof mat.dispose === 'function') mat.dispose();
  }
}

export function compileCustomMapToLevelData(inputMap, kitManifest, env = {}) {
  const THREE = env.THREE;
  const scene = env.scene;
  if (!THREE || !scene) throw new Error('compileCustomMapToLevelData requires THREE and scene');
  const geo = collectCustomMapGeometry(inputMap, kitManifest);
  if (typeof env.setLevelDimensions === 'function') env.setLevelDimensions(geo.dims);

  const root = new THREE.Group();
  root.name = `CUSTOM_MAP_${geo.map.id}`;
  scene.add(root);
  const matCache = new Map();
  const solids = [];
  const reflectionCandidates = [];
  const shadowCasters = [];
  const localObjects = [];
  const openableDoorMap = new Map();

  const floorMat = materialFor(THREE, kitManifest, matCache, 'floor_concrete');
  const floorBounds = expandedBounds(geo.map.bounds);
  const floorWidth = Math.max(1, floorBounds.x1 - floorBounds.x0);
  const floorDepth = Math.max(1, floorBounds.z1 - floorBounds.z0);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(floorWidth, 0.08, floorDepth), floorMat);
  floor.name = 'custom-map-authoring-floor';
  floor.position.set((floorBounds.x0 + floorBounds.x1) / 2, geo.map.floorY - 0.04, (floorBounds.z0 + floorBounds.z1) / 2);
  floor.receiveShadow = true;
  floor.userData.collision = 'floor_aabb';
  root.add(floor);
  solids.push(floor);

  function ensureOpenableDoor(entry) {
    if (!entry || !entry.doorAccess || !entry.object || !entry.prefab) return null;
    let door = openableDoorMap.get(entry.object.id);
    if (door) return door;
    const obj = entry.object;
    const scale = Number.isFinite(obj.scale) ? obj.scale : 1;
    const yaw = Number.isFinite(obj.yaw) ? obj.yaw : 0;
    const local = prefabLocalBounds(entry.prefab);
    const hinge = rotateXZ(local.minX * scale, ((local.minZ + local.maxZ) / 2) * scale, yaw);
    const spanX = Math.max(0.6, (local.maxX - local.minX) * scale);
    const spanZ = Math.max(0.2, (local.maxZ - local.minZ) * scale);
    door = {
      id: obj.id,
      prefabId: obj.prefabId,
      access: entry.doorAccess,
      opened: false,
      opening: false,
      openProgress: 0,
      targetOpen: 0,
      currentAngle: 0,
      targetAngle: Math.PI / 2,
      pivot: new THREE.Vector3((Number(obj.x) || 0) + hinge.x, geo.map.floorY + (Number(obj.y) || 0), (Number(obj.z) || 0) + hinge.z),
      center: new THREE.Vector3(Number(obj.x) || 0, geo.map.floorY + (Number(obj.y) || 0), Number(obj.z) || 0),
      wallEntries: [],
      meshes: [],
      radius: Math.max(1.45, Math.min(2.3, Math.max(spanX, spanZ) * 0.45)),
      userData: { customMapObjectId: obj.id, prefabId: obj.prefabId },
    };
    openableDoorMap.set(obj.id, door);
    return door;
  }

  for (const entry of geo.placedParts) {
    const mesh = createPartMesh(THREE, kitManifest, matCache, entry, geo.map.floorY);
    if (!mesh) continue;
    root.add(mesh);
    if (entry.part.collision !== 'decorative_only' && entry.part.collision !== 'nonblocking_visual') solids.push(mesh);
    if (entry.part.material === 'glass' || entry.part.material === 'steel' || entry.part.material === 'floor_wet') reflectionCandidates.push(mesh);
    const dynamicDoor = ensureOpenableDoor(entry);
    if (dynamicDoor) {
      mesh.userData.openableDoorId = dynamicDoor.id;
      dynamicDoor.meshes.push({
        mesh,
        closedPos: mesh.position.clone(),
        closedYaw: mesh.rotation.y || 0,
        offsetX: mesh.position.x - dynamicDoor.pivot.x,
        offsetZ: mesh.position.z - dynamicDoor.pivot.z,
      });
      if (entry.wallEntry && !dynamicDoor.wallEntries.includes(entry.wallEntry)) dynamicDoor.wallEntries.push(entry.wallEntry);
    }
  }

  const doorVisuals = [];
  for (const door of geo.zoneDoors) {
    const doorGroup = new THREE.Group();
    doorGroup.name = `custom-zone-door-${door.id}`;
    const gateMat = materialFor(THREE, kitManifest, matCache, 'steel');
    const hazardMat = materialFor(THREE, kitManifest, matCache, 'hazard');
    const gate = new THREE.Mesh(new THREE.BoxGeometry(door.width, 3.1, door.depth), gateMat);
    gate.position.set(door.x, geo.map.floorY + 1.55, door.z);
    gate.rotation.y = door.yaw || 0;
    gate.castShadow = true;
    gate.receiveShadow = true;
    gate.userData.collision = 'wall_aabb';
    const header = new THREE.Mesh(new THREE.BoxGeometry(door.width + 0.4, 0.18, door.depth + 0.1), hazardMat);
    header.position.set(door.x, geo.map.floorY + 3.24, door.z);
    header.rotation.y = door.yaw || 0;
    doorGroup.add(gate, header);
    root.add(doorGroup);
    solids.push(gate);
    doorVisuals.push({ door, object: doorGroup, baseY: 0 });
  }

  const exitMat = new THREE.MeshBasicMaterial({ color: 0x32ff7a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const exitPlane = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1, geo.exitZone.x1 - geo.exitZone.x0), Math.max(1, geo.exitZone.z1 - geo.exitZone.z0)), exitMat);
  exitPlane.name = 'custom-map-exit-unlock-glow';
  exitPlane.rotation.x = -Math.PI / 2;
  exitPlane.position.set((geo.exitZone.x0 + geo.exitZone.x1) / 2, geo.map.floorY + 0.04, (geo.exitZone.z0 + geo.exitZone.z1) / 2);
  exitPlane.userData.noBlock = true;
  root.add(exitPlane);

  const hemi = new THREE.HemisphereLight(0xaac4dd, 0x17130f, 0.42);
  hemi.name = 'custom-map-hemi-fill';
  scene.add(hemi);
  localObjects.push(hemi);
  const key = new THREE.DirectionalLight(0xffd49a, 0.92);
  key.name = 'custom-map-key';
  key.position.set(-22, 26, 34);
  key.target.position.set(0, geo.map.floorY, 0);
  key.castShadow = false;
  scene.add(key, key.target);
  localObjects.push(key, key.target);
  shadowCasters.push(key);

  let levelData = null;
  function rebuildNavigation() {
    if (!levelData) return;
    levelData.navGrid = env.buildNavGrid ? env.buildNavGrid(levelData.walls, 0.5) : null;
    levelData.wallIndex = env.buildWallSpatialIndex ? env.buildWallSpatialIndex(levelData.walls, 2.0) : null;
    levelData.cornerEdges = env.bakeCornerEdges ? env.bakeCornerEdges(levelData.walls, levelData.navGrid) : [];
    levelData.coverSlots = env.bakeCoverSlots ? env.bakeCoverSlots(levelData.cornerEdges || [], levelData.vaultables || []) : [];
  }
  const openableDoors = Array.from(openableDoorMap.values()).filter((door) => door.meshes.length);
  const zoneDoors = doorVisuals.map((visual) => ({
    id: visual.door.id,
    zoneId: visual.door.zoneId,
    opened: false,
    wallEntry: visual.door.wallEntry,
    wallEntries: [visual.door.wallEntry],
    mesh: visual.object,
    parts: [{ object: visual.object, baseWorld: visual.object.position.clone() }],
    currentLift: 0,
    targetLift: 0,
  }));
  function openZoneDoor(zoneId) {
    const door = zoneDoors.find((d) => d.zoneId === (zoneId | 0));
    if (!door) return false;
    door.opened = true;
    door.targetLift = 4.2;
    for (const w of door.wallEntries) if (w) w.broken = true;
    rebuildNavigation();
    return true;
  }
  function actorPos(actorOrPos) {
    if (!actorOrPos) return null;
    if (Number.isFinite(actorOrPos.x) && Number.isFinite(actorOrPos.z)) return actorOrPos;
    if (actorOrPos.position && Number.isFinite(actorOrPos.position.x) && Number.isFinite(actorOrPos.position.z)) return actorOrPos.position;
    if (actorOrPos.group && actorOrPos.group.position) return actorOrPos.group.position;
    return null;
  }
  function findOpenableDoorFor(actor, actorOrPos, radius = null) {
    const pos = actorPos(actorOrPos);
    if (!pos) return null;
    const r = Number.isFinite(radius) ? radius : (actor === 'player' ? 1.85 : 1.25);
    const r2 = r * r;
    let best = null;
    let bestD2 = Infinity;
    for (const door of openableDoors) {
      if (!door || door.opened || door.opening) continue;
      if (!doorCanOpen(door.access, actor)) continue;
      let d2 = (pos.x - door.center.x) ** 2 + (pos.z - door.center.z) ** 2;
      for (const wall of door.wallEntries || []) d2 = Math.min(d2, pointToAabbDist2(pos.x, pos.z, wall));
      const reach = Math.max(r, door.radius || 0);
      const reach2 = reach * reach;
      if (d2 <= reach2 && d2 < bestD2) {
        best = door;
        bestD2 = d2;
      }
    }
    return best;
  }
  function openCustomDoor(doorOrId, actor = 'player') {
    const door = typeof doorOrId === 'string' ? openableDoors.find((d) => d.id === doorOrId) : doorOrId;
    if (!door || door.opened || !doorCanOpen(door.access, actor)) return false;
    door.opened = true;
    door.opening = true;
    door.targetOpen = 1;
    for (const w of door.wallEntries || []) if (w) w.broken = true;
    rebuildNavigation();
    if (typeof env.flagSsrSolidsDirty === 'function') env.flagSsrSolidsDirty();
    if (typeof env.onDoorOpen === 'function') env.onDoorOpen(door, actor);
    return true;
  }
  function tryOpenDoorFor(actor, actorOrPos, source = null) {
    const door = findOpenableDoorFor(actor, actorOrPos || source);
    return door ? openCustomDoor(door, actor) : false;
  }
  function tickOpenableDoors(dt) {
    for (const door of openableDoors) {
      if (!door || !door.meshes.length) continue;
      const delta = (door.targetOpen || 0) - (door.openProgress || 0);
      if (Math.abs(delta) < 0.002) {
        door.openProgress = door.targetOpen || 0;
        if (door.openProgress >= 0.999) door.opening = false;
      } else {
        door.openProgress += delta * Math.min(1, dt * 5.2);
      }
      const angle = door.targetAngle * Math.sin((door.openProgress || 0) * Math.PI / 2);
      if (Math.abs(angle - (door.currentAngle || 0)) < 0.0005) continue;
      door.currentAngle = angle;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      for (const part of door.meshes) {
        const x = part.offsetX * c - part.offsetZ * s;
        const z = part.offsetX * s + part.offsetZ * c;
        part.mesh.position.set(door.pivot.x + x, part.closedPos.y, door.pivot.z + z);
        part.mesh.rotation.y = part.closedYaw + angle;
      }
    }
  }
  function tickZoneDoors(dt) {
    for (const door of zoneDoors) {
      if (!door || !door.mesh) continue;
      const delta = (door.targetLift || 0) - (door.currentLift || 0);
      if (Math.abs(delta) < 0.01) continue;
      door.currentLift += delta * Math.min(1, dt * 3.2);
      door.mesh.position.y = door.currentLift;
    }
  }
  function tickDynProps(dt) {
    tickZoneDoors(dt);
    tickOpenableDoors(dt);
    const targetOpacity = env.isExitUnlocked && env.isExitUnlocked() ? 0.42 : 0;
    exitMat.opacity += (targetOpacity - exitMat.opacity) * Math.min(1, dt * 5);
  }
  function unlockExit() {
    exitMat.opacity = 0.55;
  }

  levelData = {
    isCustomMap: true,
    customMapId: geo.map.id,
    disableEncounterDirector: true,
    zoneIdByPosition: true,
    walls: geo.walls,
    vaultables: geo.vaultables,
    floorRegions: geo.floorRegions,
    exitZone: geo.exitZone,
    spawns: geo.pickupSpawns,
    zoneSpawns: geo.zoneSpawns.map((arr) => arr.map((p) => new THREE.Vector3(p.x, p.y, p.z))),
    zoneEnemyTypes: geo.zoneEnemyTypes,
    zoneSpawnMeta: geo.zoneSpawnMeta,
    tacticalGraph: geo.tacticalGraph,
    zoneEnemyCounts: geo.zoneEnemyCounts,
    playerSpawn: geo.playerSpawn,
    zoneBounds: geo.zoneBounds,
    zoneDoors,
    openableDoors,
    findOpenableDoorFor,
    openCustomDoor,
    tryOpenDoorFor,
    tickOpenableDoors,
    alertDoorways: geo.alertDoorways,
    spawnDoors: [],
    tickSpawnDoors: () => {},
    openZoneDoor,
    tickZoneDoors,
    unlockExit,
    cleanup: () => {
      disposeRoot(root, localObjects);
      if (typeof env.flagSsrSolidsDirty === 'function') env.flagSsrSolidsDirty();
    },
    solids,
    ceilingLights: localObjects.filter((o) => o && o.isLight),
    fakeCeilingLamps: [],
    shadowCasters,
    dustList: [],
    reflectionCandidates,
    reflectionProfile: null,
    lightingController: null,
    tickLighting: () => {},
    visualStats: {
      dressingObjects: solids.length,
      trimObjects: geo.placedParts.filter((p) => p.part.collision === 'decorative_only').length,
      grimeDecals: 0,
      contactShadows: 0,
      atmosphereSheets: 0,
      wetSurfaces: geo.placedParts.filter((p) => p.part.material === 'floor_wet').length,
      transparentSurfaces: geo.walls.filter((w) => w.isWindow).length,
      csmSplits: 0,
      dynamicLights: localObjects.filter((o) => o && o.isLight).length,
      enemyMarkers: geo.zoneSpawnMeta.reduce((n, z) => n + z.length, 0),
      customMapObjects: geo.map.objects.length,
    },
    roomFlow: null,
    roomGates: [],
    roomGatesById: {},
    openRoomGate: () => {},
    tickRoomGates: () => {},
    tickDynProps,
    dims: geo.dims,
    sequenceCells: null,
    encounterDef: null,
    directionKeyLight: key,
    csManager: null,
    csCascadeSplits: 0,
    floorPlanarReflector: null,
  };
  rebuildNavigation();
  if (typeof env.flagSsrSolidsDirty === 'function') env.flagSsrSolidsDirty();
  return levelData;
}
