import { collectCustomMapGeometry } from './customMapCompiler.js';
import { normalizeCustomMapPack } from './schema.js';

const PLAYER_R = 0.35;
const ENEMY_R = 0.46;

function pointToAabbDist2(px, pz, w) {
  const cx = Math.max(w.x0, Math.min(w.x1, px));
  const cz = Math.max(w.z0, Math.min(w.z1, pz));
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

function clearOfWalls(px, pz, walls, radius, skipWindow = false) {
  for (const wall of walls || []) {
    if (!wall || wall.broken) continue;
    if (skipWindow && wall.isWindow) continue;
    if (pointToAabbDist2(px, pz, wall) < radius * radius) return false;
  }
  return true;
}

function segmentIntersectsBox(a, b, box, pad = 0.06) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const tests = [
    [-dx, a.x - (box.x0 - pad)],
    [dx, (box.x1 + pad) - a.x],
    [-dz, a.z - (box.z0 - pad)],
    [dz, (box.z1 + pad) - a.z],
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

function routeSegmentBlocked(a, b, walls) {
  for (const wall of walls || []) {
    if (!wall || wall.broken || wall.isWindow || wall.perimeter) continue;
    if (segmentIntersectsBox(a, b, wall, 0.08)) return wall;
  }
  return null;
}

function idSet(rows) {
  return new Set((rows || []).map((row) => row && row.id).filter(Boolean));
}

function rectValid(rect) {
  return rect && Number.isFinite(Number(rect.x0)) && Number.isFinite(Number(rect.x1)) && Number.isFinite(Number(rect.z0)) && Number.isFinite(Number(rect.z1)) && Number(rect.x1) > Number(rect.x0) && Number(rect.z1) > Number(rect.z0);
}

function buildValidationNav(bounds, walls, cellSize = 0.5) {
  const pad = 1.0;
  const xMin = bounds.x0 - pad;
  const xMax = bounds.x1 + pad;
  const zMin = bounds.z0 - pad;
  const zMax = bounds.z1 + pad;
  const nx = Math.max(8, Math.ceil((xMax - xMin) / cellSize));
  const nz = Math.max(8, Math.ceil((zMax - zMin) / cellSize));
  const blocked = new Uint8Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + (ix + 0.5) * cellSize;
      const z = zMin + (iz + 0.5) * cellSize;
      blocked[ix + iz * nx] = clearOfWalls(x, z, walls, PLAYER_R, true) ? 0 : 1;
    }
  }
  return { xMin, zMin, nx, nz, cs: cellSize, blocked };
}

function navCell(nav, x, z) {
  return {
    ix: Math.floor((x - nav.xMin) / nav.cs) | 0,
    iz: Math.floor((z - nav.zMin) / nav.cs) | 0,
  };
}

function navOpen(nav, ix, iz) {
  return ix >= 0 && iz >= 0 && ix < nav.nx && iz < nav.nz && nav.blocked[ix + iz * nav.nx] === 0;
}

function playerCanOpenWall(wall) {
  if (!wall || !wall.openableDoor) return false;
  return !wall.doorAccess || wall.doorAccess === 'player' || wall.doorAccess === 'both';
}

function findOpenNear(nav, ix, iz) {
  if (navOpen(nav, ix, iz)) return { ix, iz };
  for (let r = 1; r < 18; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const nx = ix + dx;
        const nz = iz + dz;
        if (navOpen(nav, nx, nz)) return { ix: nx, iz: nz };
      }
    }
  }
  return null;
}

function reachBox(nav, start, box) {
  const s0 = navCell(nav, start.x, start.z);
  const s = findOpenNear(nav, s0.ix, s0.iz);
  if (!s) return { ok: false, reason: 'no_start_cell' };
  const visited = new Uint8Array(nav.nx * nav.nz);
  const qx = new Int32Array(nav.nx * nav.nz);
  const qz = new Int32Array(nav.nx * nav.nz);
  let qh = 0;
  let qt = 0;
  const key = (ix, iz) => ix + iz * nav.nx;
  qx[qt] = s.ix;
  qz[qt] = s.iz;
  visited[key(s.ix, s.iz)] = 1;
  qt++;
  while (qh < qt) {
    const ix = qx[qh];
    const iz = qz[qh];
    qh++;
    const wx = nav.xMin + (ix + 0.5) * nav.cs;
    const wz = nav.zMin + (iz + 0.5) * nav.cs;
    if (wx >= box.x0 && wx <= box.x1 && wz >= box.z0 && wz <= box.z1) return { ok: true, cellsVisited: qh };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx;
      const nz = iz + dz;
      if (!navOpen(nav, nx, nz)) continue;
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

export function validateCustomMap(map, kitManifest, options = {}) {
  const errors = [];
  const warnings = [];
  const geo = collectCustomMapGeometry(map, kitManifest);
  errors.push(...geo.errors);
  warnings.push(...geo.warnings);
  const kitIds = new Set((kitManifest && kitManifest.prefabs || []).map((p) => p.id));
  for (const obj of geo.map.objects || []) {
    if (!kitIds.has(obj.prefabId)) errors.push(`object_missing_prefab:${obj.id}:${obj.prefabId}`);
  }
  if (!geo.map.markers.playerSpawn) errors.push('missing_player_spawn');
  if (!geo.map.markers.exits || !geo.map.markers.exits.length) errors.push('missing_exit');
  if (!geo.map.markers.zoneDoors || geo.map.markers.zoneDoors.length < 2) warnings.push('expected_two_zone_doors');
  for (let z = 0; z < 3; z++) {
    if (!geo.zoneSpawns[z].length) errors.push(`zone_${z}_has_no_enemy_spawns`);
  }
  if (!clearOfWalls(geo.playerSpawn.x, geo.playerSpawn.z, geo.walls, PLAYER_R, true)) errors.push('player_spawn_inside_collision');
  if (!clearOfWalls((geo.exitZone.x0 + geo.exitZone.x1) / 2, (geo.exitZone.z0 + geo.exitZone.z1) / 2, geo.walls, PLAYER_R, true)) errors.push('exit_inside_collision');
  for (let z = 0; z < 3; z++) {
    for (const spawn of geo.zoneSpawns[z]) {
      if (!clearOfWalls(spawn.x, spawn.z, geo.walls, ENEMY_R, true)) errors.push(`enemy_spawn_inside_collision:${z}:${spawn.x.toFixed(1)},${spawn.z.toFixed(1)}`);
    }
  }
  const routeWalls = geo.walls.map((w) => (w && (w.zoneDoorId != null || playerCanOpenWall(w)) ? Object.assign({}, w, { broken: true }) : w));
  const nav = buildValidationNav(geo.map.bounds, routeWalls);
  const route = reachBox(nav, geo.playerSpawn, geo.exitZone);
  if (!route.ok) errors.push(`spawn_to_exit_unreachable:${route.reason}`);
  for (const door of geo.zoneDoors) {
    const approach = { x0: door.x - Math.max(1.8, door.width * 0.35), x1: door.x + Math.max(1.8, door.width * 0.35), z0: door.z - 2.6, z1: door.z + 2.6 };
    for (const wall of geo.walls) {
      if (wall === door.wallEntry || wall.perimeter || wall.isWindow) continue;
      if (wall.x1 > approach.x0 && wall.x0 < approach.x1 && wall.z1 > approach.z0 && wall.z0 < approach.z1) {
        warnings.push(`zone_door_approach_overlap:${door.id}:${wall.geometryId || 'wall'}`);
      }
    }
  }
  if (!geo.vaultables.length) warnings.push('no_vaultable_cover');
  if (geo.walls.length > (options.maxWalls || 260)) warnings.push(`wall_count_high:${geo.walls.length}`);
  const markers = geo.map.markers || {};
  const ids = {
    peekAngleId: idSet(markers.peekAngles),
    holdPositionId: idSet(markers.holdPositions),
    coverHintId: idSet(markers.coverHints),
    patrolRouteId: idSet(markers.patrolRoutes),
    flankRouteId: idSet(markers.flankRoutes),
    triggerVolumeId: idSet(markers.triggerVolumes),
    combatZoneId: idSet(markers.combatZones),
  };
  const actualCoverHintIds = new Set(ids.coverHintId);
  for (const id of ids.holdPositionId) ids.coverHintId.add(id);
  const used = Object.fromEntries(Object.keys(ids).map((key) => [key, new Set()]));
  for (const enemy of markers.enemySpawns || []) {
    const links = enemy.links || {};
    for (const [field, set] of Object.entries(ids)) {
      const value = links[field] || enemy[field];
      if (!value) continue;
      used[field].add(value);
      if (field === 'coverHintId' && ids.holdPositionId.has(value)) used.holdPositionId.add(value);
      if (!set.has(value)) errors.push(`enemy_link_missing:${enemy.id}:${field}:${value}`);
    }
  }
  for (const route of markers.patrolRoutes || []) {
    for (const enemyId of route.assignedEnemyIds || []) {
      const enemy = (markers.enemySpawns || []).find((row) => row && row.id === enemyId);
      if (!enemy) errors.push(`patrol_assigned_enemy_missing:${route.id}:${enemyId}`);
      else used.patrolRouteId.add(route.id);
    }
  }
  for (const route of markers.flankRoutes || []) {
    for (const enemyId of route.assignedEnemyIds || []) {
      const enemy = (markers.enemySpawns || []).find((row) => row && row.id === enemyId);
      if (!enemy) errors.push(`flank_assigned_enemy_missing:${route.id}:${enemyId}`);
      else used.flankRouteId.add(route.id);
    }
  }
  const validateRoute = (route, kind, isUsed) => {
    const pts = Array.isArray(route && route.points) ? route.points : [];
    if (pts.length < 2) {
      (isUsed ? errors : warnings).push(`${kind}_too_short:${route && route.id}`);
      return;
    }
    pts.forEach((pt, index) => {
      if (!clearOfWalls(Number(pt.x) || 0, Number(pt.z) || 0, geo.walls, ENEMY_R, true)) {
        warnings.push(`${kind}_point_inside_collision:${route.id}:${index}`);
      }
    });
    for (let i = 1; i < pts.length; i++) {
      const wall = routeSegmentBlocked(pts[i - 1], pts[i], geo.walls);
      if (wall) warnings.push(`${kind}_segment_blocked:${route.id}:${i - 1}-${i}:${wall.geometryId || 'wall'}`);
    }
    if (kind === 'patrol' && route.loop !== false && pts.length > 2) {
      const wall = routeSegmentBlocked(pts[pts.length - 1], pts[0], geo.walls);
      if (wall) warnings.push(`patrol_loop_segment_blocked:${route.id}:${wall.geometryId || 'wall'}`);
    }
  };
  for (const route of markers.patrolRoutes || []) validateRoute(route, 'patrol', used.patrolRouteId.has(route.id));
  for (const route of markers.flankRoutes || []) validateRoute(route, 'flank', used.flankRouteId.has(route.id));
  for (const volume of markers.triggerVolumes || []) {
    if (!rectValid(volume)) errors.push(`trigger_volume_invalid:${volume && volume.id}`);
    for (const targetId of volume.targetIds || []) {
      const known =
        ids.patrolRouteId.has(targetId) ||
        ids.flankRouteId.has(targetId) ||
        ids.combatZoneId.has(targetId) ||
        (markers.enemySpawns || []).some((enemy) => enemy && enemy.id === targetId);
      if (!known) errors.push(`trigger_target_missing:${volume.id}:${targetId}`);
    }
  }
  for (const zone of markers.combatZones || []) {
    if (!rectValid(zone)) errors.push(`combat_zone_invalid:${zone && zone.id}`);
  }
  const unusedChecks = [
    ['peekAngleId', 'peek_unused'],
    ['holdPositionId', 'hold_unused'],
    ['coverHintId', 'cover_hint_unused'],
    ['patrolRouteId', 'patrol_unused'],
    ['flankRouteId', 'flank_unused'],
    ['triggerVolumeId', 'trigger_unused'],
    ['combatZoneId', 'combat_zone_unused'],
  ];
  for (const [field, code] of unusedChecks) {
    const candidates = field === 'coverHintId' ? actualCoverHintIds : ids[field];
    for (const id of candidates) if (!used[field].has(id)) warnings.push(`${code}:${id}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      walls: geo.walls.length,
      vaultables: geo.vaultables.length,
      floorRegions: geo.floorRegions.length,
      enemySpawns: geo.zoneSpawns.reduce((n, z) => n + z.length, 0),
      zoneEnemyCounts: geo.zoneEnemyCounts,
      navCells: nav.nx * nav.nz,
    },
  };
}

export function validateCustomMapPack(pack, kitManifest, options = {}) {
  const normalized = normalizeCustomMapPack(pack);
  const errors = [];
  const warnings = [];
  const maps = [];
  if (!normalized.maps.length) errors.push('pack_has_no_maps');
  normalized.maps.forEach((map, index) => {
    const result = validateCustomMap(map, kitManifest, options);
    maps.push({ index, id: map.id, title: map.title, ...result });
    for (const err of result.errors) errors.push(`map_${index}:${err}`);
    for (const warn of result.warnings) warnings.push(`map_${index}:${warn}`);
  });
  return {
    ok: errors.length === 0,
    packId: normalized.id,
    title: normalized.title,
    errors,
    warnings,
    maps,
  };
}
