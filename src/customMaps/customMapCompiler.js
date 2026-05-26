import { DEFAULT_CUSTOM_MAP_BOUNDS, DEFAULT_CUSTOM_ZONE_BOUNDS, normalizeCustomMap } from './schema.js';

const COLLISION_WALLS = new Set(['wall_aabb', 'cover_aabb', 'transparent_window_aabb']);

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

export function partWorldAabb(part, object) {
  const scale = Number.isFinite(object.scale) ? object.scale : 1;
  const yaw = Number.isFinite(object.yaw) ? object.yaw : 0;
  const sx = (part.size && part.size[0] ? part.size[0] : 0) * scale;
  const sz = (part.size && part.size[2] ? part.size[2] : 0) * scale;
  const ox = ((part.offset && part.offset[0]) || 0) * scale;
  const oz = ((part.offset && part.offset[2]) || 0) * scale;
  const oy = ((part.offset && part.offset[1]) || 0) * scale + (object.y || 0);
  const sy = (part.size && part.size[1] ? part.size[1] : 0) * scale;
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

export function collectCustomMapGeometry(inputMap, kitManifest) {
  const map = normalizeCustomMap(inputMap);
  const kit = prefabMap(kitManifest);
  const walls = [];
  const vaultables = [];
  const floorRegions = [{ ...map.bounds, floorY: map.floorY }];
  const placedParts = [];
  const errors = [];
  const warnings = [];

  for (const obj of map.objects || []) {
    const prefab = kit.get(obj.prefabId);
    if (!prefab) {
      errors.push(`missing_prefab:${obj.prefabId}`);
      continue;
    }
    for (const part of prefab.parts || []) {
      const box = partWorldAabb(part, obj);
      placedParts.push({ object: obj, prefab, part, box });
      if (part.collision === 'floor_aabb') {
        floorRegions.push({ x0: box.x0, x1: box.x1, z0: box.z0, z1: box.z1, floorY: map.floorY });
      }
      if (!COLLISION_WALLS.has(part.collision)) continue;
      const entry = {
        x0: box.x0,
        x1: box.x1,
        z0: box.z0,
        z1: box.z1,
        roomId: obj.roomId || null,
        geometryId: `${obj.id}:${part.name}`,
        prefabId: obj.prefabId,
        floorplanRole: part.floorplanRole || null,
        isWindow: part.collision === 'transparent_window_aabb' || !!part.glassPane,
      };
      walls.push(entry);
      const height = Math.max(0, box.y1 - map.floorY);
      const width = Math.abs(box.x1 - box.x0);
      const depth = Math.abs(box.z1 - box.z0);
      if (part.collision === 'cover_aabb' && height >= 0.38 && height <= 1.75 && width >= 0.18 && depth >= 0.18) {
        vaultables.push({ ...entry, height: box.y1, objectHeight: height, vaultCandidate: true });
      }
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
    const box = partWorldAabb(doorPart, obj);
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
    zoneSpawns[z].push({ x: Number(spawn.x) || 0, y: map.floorY, z: Number(spawn.z) || 0, yaw: Number(spawn.yaw) || 0 });
    zoneEnemyTypes[z].push(spawn.enemyType || 'soldier');
    zoneSpawnMeta[z].push({
      id: spawn.id,
      roomId: spawn.roomId || `custom_zone_${z}`,
      encounterId: spawn.encounterId || `custom_${map.id}_z${z}`,
      encounterType: spawn.activation || 'zone_start',
      role: spawn.role || 'anchor',
      behavior: spawn.behavior || 'hold_angle',
      wave: spawn.spawnWave || 'initial',
      yaw: Number(spawn.yaw) || 0,
      coverHintId: spawn.coverHintId || null,
      peekAngleId: spawn.peekAngleId || null,
      patrolRouteId: spawn.patrolRouteId || null,
    });
  }

  const exits = map.markers.exits && map.markers.exits.length ? map.markers.exits : [{ x0: -4, x1: 4, z0: map.bounds.z0, z1: map.bounds.z0 + 3 }];
  const exitZone = { x0: Number(exits[0].x0), x1: Number(exits[0].x1), z0: Number(exits[0].z0), z1: Number(exits[0].z1) };
  const pickupSpawns = (map.markers.pickups || []).map((p) => ({ x: Number(p.x) || 0, y: map.floorY, z: Number(p.z) || 0, type: p.type || 'ammo' }));
  const zoneEnemyCounts = zoneSpawns.map((arr) => arr.length);
  const dims = {
    RW: Math.max(8, Math.abs((map.bounds.x1 || 0) - (map.bounds.x0 || 0))),
    RD: Math.max(8, Math.abs((map.bounds.z1 || 0) - (map.bounds.z0 || 0))),
    RH: 5.6,
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

function createPartMesh(THREE, kitManifest, matCache, entry) {
  const { object, part } = entry;
  if (part.kind !== 'box') return null;
  const scale = Number.isFinite(object.scale) ? object.scale : 1;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry((part.size[0] || 0.1) * scale, (part.size[1] || 0.1) * scale, (part.size[2] || 0.1) * scale),
    materialFor(THREE, kitManifest, matCache, part.material || 'wall_dark'),
  );
  const off = rotateXZ(((part.offset && part.offset[0]) || 0) * scale, ((part.offset && part.offset[2]) || 0) * scale, object.yaw || 0);
  mesh.position.set(object.x + off.x, (object.y || 0) + ((part.offset && part.offset[1]) || 0) * scale, object.z + off.z);
  mesh.rotation.y = object.yaw || 0;
  mesh.castShadow = part.collision !== 'floor_aabb' && part.collision !== 'decorative_only';
  mesh.receiveShadow = true;
  mesh.name = `${object.prefabId}:${part.name}`;
  Object.assign(mesh.userData, {
    customMapObjectId: object.id,
    prefabId: object.prefabId,
    collision: part.collision,
    floorplanRole: part.floorplanRole || null,
    glassPane: !!part.glassPane,
    breakable: !!part.breakable,
    breakSound: part.breakSound || null,
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

  const floorMat = materialFor(THREE, kitManifest, matCache, 'floor_concrete');
  const floor = new THREE.Mesh(new THREE.BoxGeometry(geo.dims.RW, 0.08, geo.dims.RD), floorMat);
  floor.name = 'custom-map-authoring-floor';
  floor.position.set((geo.map.bounds.x0 + geo.map.bounds.x1) / 2, geo.map.floorY - 0.04, (geo.map.bounds.z0 + geo.map.bounds.z1) / 2);
  floor.receiveShadow = true;
  floor.userData.collision = 'floor_aabb';
  root.add(floor);
  solids.push(floor);

  for (const entry of geo.placedParts) {
    const mesh = createPartMesh(THREE, kitManifest, matCache, entry);
    if (!mesh) continue;
    root.add(mesh);
    if (entry.part.collision !== 'decorative_only' && entry.part.collision !== 'nonblocking_visual') solids.push(mesh);
    if (entry.part.material === 'glass' || entry.part.material === 'steel' || entry.part.material === 'floor_wet') reflectionCandidates.push(mesh);
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
    zoneEnemyCounts: geo.zoneEnemyCounts,
    playerSpawn: geo.playerSpawn,
    zoneBounds: geo.zoneBounds,
    zoneDoors,
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
