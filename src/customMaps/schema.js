export const CUSTOM_MAP_SCHEMA_VERSION = 2;
export const CUSTOM_MAP_PACK_STORE = 'clearance_custom_map_packs_v1';
export const CUSTOM_MAP_AUTOSAVE_KEY = 'clearance_custom_map_editor_autosave_v1';
export const DEFAULT_KIT_ID = 'level-kit.b01-megaplex';
export const DEFAULT_LEVEL_KIT_URL = '/assets/level-kit/b01-megaplex/manifest.json';
export const BUILTIN_CUSTOM_MAP_INDEX_URL = '/custom-maps/builtin/index.json';
export const DEV_CUSTOM_MAP_INDEX_URL = '/custom-maps/dev/index.json';

export const DEFAULT_CUSTOM_MAP_BOUNDS = { x0: -18, x1: 18, z0: -54, z1: 54 };
export const DEFAULT_CUSTOM_ZONE_BOUNDS = { halfWidth: 18, halfDepth: 54, zSplit: 18 };

export const ENEMY_TYPES = ['soldier', 'scout', 'heavy', 'pistolero', 'riot', 'marksman', 'sniper', 'shielded', 'demolitions'];
export const ENEMY_ROLES = ['anchor', 'lookout', 'flanker', 'breacher', 'patrol', 'marksman', 'sniper', 'reinforcement'];
export const ENEMY_BEHAVIORS = [
  'hold_angle',
  'peek_from_cover',
  'ambush_on_crossing',
  'push_after_contact',
  'patrol_route',
  'patrol_then_alarm',
  'flank_after_contact',
  'suppress_lane',
  'guard_objective',
  'reposition',
  'rush_when_player_reloads',
];

export function normalizeBehaviorTuning(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  };
  const delay = Number(src.reactDelay);
  return {
    aggressiveness: num(src.aggressiveness, 0.5),
    peekBias: num(src.peekBias, 0.5),
    holdBias: num(src.holdBias, 0.5),
    reactDelay: Number.isFinite(delay) ? Math.max(0, Math.min(8, delay)) : 0,
  };
}
export const DOOR_ACCESS_MODES = ['player', 'enemies', 'both', 'locked'];
export const ENEMY_LINK_FIELDS = [
  'peekAngleId',
  'holdPositionId',
  'coverHintId',
  'patrolRouteId',
  'flankRouteId',
  'triggerVolumeId',
  'combatZoneId',
];

export function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function isoNow() {
  return new Date().toISOString();
}

export function customId(prefix = 'custom') {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

export function slugify(value, fallback = 'custom-map') {
  const out = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return out || fallback;
}

export function normalizeDoorAccess(value, fallback = null) {
  if (value && typeof value === 'object') {
    const player = !!(value.player || value.players || value.playerCanOpen);
    const enemies = !!(value.enemy || value.enemies || value.enemyCanOpen);
    if (player && enemies) return 'both';
    if (player) return 'player';
    if (enemies) return 'enemies';
    return 'locked';
  }
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'enemy') return 'enemies';
  if (mode === 'players') return 'player';
  if (mode === 'all') return 'both';
  if (DOOR_ACCESS_MODES.includes(mode)) return mode;
  return fallback;
}

export function defaultMarkers() {
  return {
    playerSpawn: { id: 'player_spawn', x: 0, z: 48, yaw: Math.PI, floorY: 0.4 },
    exits: [{ id: 'exit_main', x0: -4, x1: 4, z0: -53.5, z1: -50.5, label: 'EXTRACT' }],
    zoneDoors: [
      { id: 'zone_gate_front_mid', zoneId: 0, x: 0, z: 18, width: 5.4, depth: 0.62, yaw: 0 },
      { id: 'zone_gate_mid_back', zoneId: 1, x: 0, z: -18, width: 5.4, depth: 0.62, yaw: 0 },
    ],
    enemySpawns: [],
    peekAngles: [],
    holdPositions: [],
    patrolRoutes: [],
    pickups: [],
    triggerVolumes: [],
    combatZones: [],
    flankRoutes: [],
    coverHints: [],
    breachPoints: [],
    sniperPerches: [],
  };
}

export function createDefaultCustomMap(options = {}) {
  const now = isoNow();
  return {
    schemaVersion: CUSTOM_MAP_SCHEMA_VERSION,
    id: options.id || customId('map'),
    title: options.title || 'Untitled Custom Map',
    theme: options.theme || 'b01-megaplex',
    kitId: options.kitId || DEFAULT_KIT_ID,
    environmentBuilding: options.environmentBuilding || 1,
    createdAt: now,
    updatedAt: now,
    bounds: cloneJson(options.bounds || DEFAULT_CUSTOM_MAP_BOUNDS),
    floorY: Number.isFinite(options.floorY) ? options.floorY : 0.4,
    zoneBounds: cloneJson(options.zoneBounds || DEFAULT_CUSTOM_ZONE_BOUNDS),
    objects: cloneJson(options.objects || []),
    markers: normalizeMarkers(options.markers || defaultMarkers()),
    briefing: Object.assign({
      callsign: 'CUSTOM MAP',
      target: 'HOSTILE CELL',
      time: 'CUSTOM RUN',
      introText: 'Clear the authored route.',
      endText: 'Custom operation complete.',
    }, options.briefing || {}),
    validation: options.validation || { ok: false, errors: ['not_validated'], warnings: [], at: null },
  };
}

export function createDefaultCustomMapPack(options = {}) {
  const now = isoNow();
  const map = createDefaultCustomMap(options.map || { title: options.title || 'Untitled Custom Map' });
  return {
    schemaVersion: CUSTOM_MAP_SCHEMA_VERSION,
    id: options.id || customId('pack'),
    title: options.title || map.title || 'Untitled Custom Map',
    author: options.author || 'LOCAL',
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
    source: options.source || 'local',
    startIndex: Number.isFinite(options.startIndex) ? Math.max(0, options.startIndex | 0) : 0,
    thumbnail: options.thumbnail || null,
    difficultyDefault: options.difficultyDefault || 'normal',
    completion: Object.assign({ bestGrade: null, bestTimeMs: null, completions: 0, attempts: 0 }, options.completion || {}),
    maps: (options.maps && options.maps.length ? options.maps : [map]).map((m) => normalizeCustomMap(m)),
  };
}

export function normalizeMarkers(markers = {}) {
  const base = defaultMarkers();
  const defaults = defaultMarkers();
  const out = Object.assign(base, cloneJson(markers));
  out.playerSpawn = Object.assign({}, defaults.playerSpawn, markers.playerSpawn || {});
  for (const key of ['exits', 'zoneDoors', 'pickups']) out[key] = Array.isArray(markers[key]) ? markers[key].map((x) => Object.assign({}, x)) : base[key];
  out.enemySpawns = Array.isArray(markers.enemySpawns) ? markers.enemySpawns.map(normalizeEnemySpawn) : base.enemySpawns;
  out.peekAngles = Array.isArray(markers.peekAngles) ? markers.peekAngles.map(normalizePeekAngle) : base.peekAngles;
  out.holdPositions = Array.isArray(markers.holdPositions) ? markers.holdPositions.map(normalizeHoldPosition) : base.holdPositions;
  out.patrolRoutes = Array.isArray(markers.patrolRoutes) ? markers.patrolRoutes.map(normalizePatrolRoute) : base.patrolRoutes;
  out.triggerVolumes = Array.isArray(markers.triggerVolumes) ? markers.triggerVolumes.map(normalizeTriggerVolume) : base.triggerVolumes;
  out.combatZones = Array.isArray(markers.combatZones) ? markers.combatZones.map(normalizeCombatZone) : base.combatZones;
  out.flankRoutes = Array.isArray(markers.flankRoutes) ? markers.flankRoutes.map(normalizeFlankRoute) : base.flankRoutes;
  out.coverHints = Array.isArray(markers.coverHints) ? markers.coverHints.map(normalizeCoverHint) : base.coverHints;
  out.breachPoints = Array.isArray(markers.breachPoints) ? markers.breachPoints.map(normalizeBreachPoint) : base.breachPoints;
  out.sniperPerches = Array.isArray(markers.sniperPerches) ? markers.sniperPerches.map(normalizeSniperPerch) : base.sniperPerches;
  return out;
}

export function normalizeCustomMap(map = {}) {
  const now = isoNow();
  const out = Object.assign(createDefaultCustomMap({ title: map.title || 'Untitled Custom Map' }), cloneJson(map));
  out.schemaVersion = CUSTOM_MAP_SCHEMA_VERSION;
  out.id = out.id || customId('map');
  out.createdAt = out.createdAt || now;
  out.updatedAt = out.updatedAt || now;
  out.bounds = Object.assign({}, DEFAULT_CUSTOM_MAP_BOUNDS, out.bounds || {});
  out.zoneBounds = Object.assign({}, DEFAULT_CUSTOM_ZONE_BOUNDS, out.zoneBounds || {});
  out.floorY = Number.isFinite(Number(out.floorY)) ? Number(out.floorY) : 0.4;
  out.objects = Array.isArray(out.objects) ? out.objects.map(normalizePlacedObject) : [];
  out.markers = normalizeMarkers(out.markers);
  out.briefing = Object.assign(createDefaultCustomMap().briefing, out.briefing || {});
  out.validation = out.validation || { ok: false, errors: ['not_validated'], warnings: [], at: null };
  return out;
}

export function normalizeCustomMapPack(pack = {}) {
  const now = isoNow();
  const out = Object.assign(createDefaultCustomMapPack({ title: pack.title || 'Untitled Custom Map' }), cloneJson(pack));
  out.schemaVersion = CUSTOM_MAP_SCHEMA_VERSION;
  out.id = out.id || customId('pack');
  out.createdAt = out.createdAt || now;
  out.updatedAt = out.updatedAt || now;
  out.source = out.source || 'local';
  out.startIndex = Number.isFinite(Number(out.startIndex)) ? Math.max(0, Number(out.startIndex) | 0) : 0;
  out.maps = Array.isArray(out.maps) && out.maps.length ? out.maps.map(normalizeCustomMap) : [createDefaultCustomMap({ title: out.title })];
  if (out.startIndex >= out.maps.length) out.startIndex = 0;
  out.completion = Object.assign({ bestGrade: null, bestTimeMs: null, completions: 0, attempts: 0 }, out.completion || {});
  return out;
}

export function normalizePlacedObject(obj = {}) {
  const out = {
    id: obj.id || customId('obj'),
    prefabId: obj.prefabId || 'cover.half_crate',
    x: Number.isFinite(Number(obj.x)) ? Number(obj.x) : 0,
    z: Number.isFinite(Number(obj.z)) ? Number(obj.z) : 0,
    y: Number.isFinite(Number(obj.y)) ? Number(obj.y) : 0,
    yaw: Number.isFinite(Number(obj.yaw)) ? Number(obj.yaw) : 0,
    scale: Number.isFinite(Number(obj.scale)) ? Math.max(0.25, Math.min(4, Number(obj.scale))) : 1,
    variant: obj.variant || null,
    locked: !!obj.locked,
    layer: obj.layer || 'geometry',
    label: obj.label || '',
  };
  for (const key of [
    'weaponProfileId',
    'visualProfileId',
    'modelProfileId',
    'animationProfileId',
    'importedAssetId',
    'fallbackProfileId'
  ]) {
    if (obj[key] != null && String(obj[key]).trim()) out[key] = String(obj[key]).trim();
  }
  const doorAccess = normalizeDoorAccess(obj.doorAccess ?? obj.openBy ?? obj.doorOpenMode, null);
  if (doorAccess) out.doorAccess = doorAccess;
  return out;
}

export function createPlacedObject(prefabId, x = 0, z = 0, options = {}) {
  return normalizePlacedObject(Object.assign({ prefabId, x, z }, options));
}

export function createEnemySpawn(x = 0, z = 0, options = {}) {
  return normalizeEnemySpawn(Object.assign({
    id: customId('enemy'),
    x,
    z,
    yaw: 0,
    zoneId: null,
    enemyType: 'soldier',
    role: 'anchor',
    behavior: 'hold_angle',
    roomId: 'custom_room',
    spawnWave: 'initial',
    facingTarget: null,
    links: {},
    activation: 'zone_start',
  }, options));
}

export function normalizeEnemyLinks(spawn = {}) {
  const raw = spawn.links && typeof spawn.links === 'object' ? spawn.links : {};
  const out = {};
  for (const key of ENEMY_LINK_FIELDS) {
    const value = spawn[key] ?? raw[key];
    out[key] = value == null || String(value).trim() === '' ? null : String(value).trim();
  }
  return out;
}

export function normalizeEnemySpawn(spawn = {}) {
  const links = normalizeEnemyLinks(spawn);
  const out = {
    id: spawn.id || customId('enemy'),
    x: Number.isFinite(Number(spawn.x)) ? Number(spawn.x) : 0,
    z: Number.isFinite(Number(spawn.z)) ? Number(spawn.z) : 0,
    yaw: Number.isFinite(Number(spawn.yaw)) ? Number(spawn.yaw) : 0,
    zoneId: Number.isFinite(Number(spawn.zoneId)) ? Number(spawn.zoneId) : null,
    enemyType: ENEMY_TYPES.includes(spawn.enemyType) ? spawn.enemyType : 'soldier',
    role: ENEMY_ROLES.includes(spawn.role) ? spawn.role : 'anchor',
    behavior: ENEMY_BEHAVIORS.includes(spawn.behavior) ? spawn.behavior : 'hold_angle',
    roomId: spawn.roomId || 'custom_room',
    spawnWave: spawn.spawnWave || 'initial',
    facingTarget: spawn.facingTarget || null,
    links,
    coverHintId: links.coverHintId,
    peekAngleId: links.peekAngleId,
    holdPositionId: links.holdPositionId,
    patrolRouteId: links.patrolRouteId,
    flankRouteId: links.flankRouteId,
    triggerVolumeId: links.triggerVolumeId,
    combatZoneId: links.combatZoneId,
    activation: spawn.activation || 'zone_start',
    behaviorTuning: normalizeBehaviorTuning(spawn.behaviorTuning),
  };
  for (const key of [
    'enemyAnimationProfileId',
    'enemyModelProfileId',
    'animationProfileId',
    'weaponProfileId',
    'visualProfileId',
    'importedAssetId',
    'fallbackProfileId'
  ]) {
    if (spawn[key] != null && String(spawn[key]).trim()) out[key] = String(spawn[key]).trim();
  }
  return out;
}

export function createPeekAngle(x = 0, z = 0, options = {}) {
  return normalizePeekAngle(Object.assign({ id: customId('peek'), x, z, yaw: 0, arcDegrees: 70, range: 11, label: 'PEEK' }, options));
}

export function createHoldPosition(x = 0, z = 0, options = {}) {
  return normalizeHoldPosition(Object.assign({ id: customId('hold'), x, z, yaw: 0, radius: 1.2, label: 'HOLD' }, options));
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizePoint(point = {}) {
  return {
    x: finiteNumber(point.x, 0),
    z: finiteNumber(point.z, 0),
    yaw: Number.isFinite(Number(point.yaw)) ? Number(point.yaw) : null,
    pauseSeconds: Number.isFinite(Number(point.pauseSeconds)) ? Math.max(0, Number(point.pauseSeconds)) : null,
  };
}

function normalizeRoutePoints(points = []) {
  return Array.isArray(points) ? points.map(normalizePoint) : [];
}

function normalizeRectMarker(marker = {}, defaults = {}) {
  const cx = finiteNumber(marker.x, finiteNumber(defaults.x, 0));
  const cz = finiteNumber(marker.z, finiteNumber(defaults.z, 0));
  const width = Math.max(0.5, finiteNumber(marker.width, finiteNumber(defaults.width, 4)));
  const depth = Math.max(0.5, finiteNumber(marker.depth, finiteNumber(defaults.depth, 4)));
  const x0 = Number.isFinite(Number(marker.x0)) ? Number(marker.x0) : cx - width / 2;
  const x1 = Number.isFinite(Number(marker.x1)) ? Number(marker.x1) : cx + width / 2;
  const z0 = Number.isFinite(Number(marker.z0)) ? Number(marker.z0) : cz - depth / 2;
  const z1 = Number.isFinite(Number(marker.z1)) ? Number(marker.z1) : cz + depth / 2;
  return {
    x0: Math.min(x0, x1),
    x1: Math.max(x0, x1),
    z0: Math.min(z0, z1),
    z1: Math.max(z0, z1),
  };
}

export function normalizePeekAngle(marker = {}) {
  return {
    id: marker.id || customId('peek'),
    x: finiteNumber(marker.x, 0),
    z: finiteNumber(marker.z, 0),
    yaw: finiteNumber(marker.yaw, 0),
    arcDegrees: Math.max(10, Math.min(160, finiteNumber(marker.arcDegrees, 70))),
    range: Math.max(1, Math.min(80, finiteNumber(marker.range, 11))),
    label: marker.label || 'PEEK',
  };
}

export function normalizeHoldPosition(marker = {}) {
  return {
    id: marker.id || customId('hold'),
    x: finiteNumber(marker.x, 0),
    z: finiteNumber(marker.z, 0),
    yaw: finiteNumber(marker.yaw, 0),
    radius: Math.max(0.25, Math.min(12, finiteNumber(marker.radius, 1.2))),
    label: marker.label || 'HOLD',
  };
}

export function createPatrolRoute(points = [], options = {}) {
  return normalizePatrolRoute(Object.assign({ points }, options));
}

export function normalizePatrolRoute(route = {}) {
  return {
    id: route.id || customId('patrol'),
    label: route.label || 'PATROL',
    points: normalizeRoutePoints(route.points),
    loop: route.loop !== false,
    pauseSeconds: Math.max(0, finiteNumber(route.pauseSeconds, 0.55)),
    speed: Math.max(0.25, Math.min(3, finiteNumber(route.speed, 1))),
    alertBehavior: route.alertBehavior || 'patrol_then_alarm',
    assignedEnemyIds: Array.isArray(route.assignedEnemyIds) ? route.assignedEnemyIds.map(String).filter(Boolean) : [],
  };
}

export function createFlankRoute(points = [], options = {}) {
  return normalizeFlankRoute(Object.assign({ points }, options));
}

export function normalizeFlankRoute(route = {}) {
  return {
    id: route.id || customId('flank'),
    label: route.label || 'FLANK',
    points: normalizeRoutePoints(route.points),
    activation: route.activation || 'after_contact',
    speed: Math.max(0.25, Math.min(3, finiteNumber(route.speed, 1.2))),
    assignedEnemyIds: Array.isArray(route.assignedEnemyIds) ? route.assignedEnemyIds.map(String).filter(Boolean) : [],
  };
}

export function createCombatZone(x0 = -2, z0 = -2, x1 = 2, z1 = 2, options = {}) {
  return normalizeCombatZone(Object.assign({ x0, z0, x1, z1 }, options));
}

export function normalizeCombatZone(zone = {}) {
  const rect = normalizeRectMarker(zone, { width: 8, depth: 8 });
  return Object.assign({
    id: zone.id || customId('zone'),
    label: zone.label || 'COMBAT ZONE',
    zoneId: Number.isFinite(Number(zone.zoneId)) ? Number(zone.zoneId) : null,
    intensity: zone.intensity || 'balanced',
    activation: zone.activation || 'zone_start',
  }, rect);
}

export function createTriggerVolume(x0 = -2, z0 = -2, x1 = 2, z1 = 2, options = {}) {
  return normalizeTriggerVolume(Object.assign({ x0, z0, x1, z1 }, options));
}

export function normalizeTriggerVolume(volume = {}) {
  const rect = normalizeRectMarker(volume, { width: 4, depth: 4 });
  return Object.assign({
    id: volume.id || customId('trigger'),
    label: volume.label || 'TRIGGER',
    activation: volume.activation || 'on_enter',
    targetIds: Array.isArray(volume.targetIds) ? volume.targetIds.map(String).filter(Boolean) : [],
  }, rect);
}

export function createCoverHint(x = 0, z = 0, options = {}) {
  return normalizeCoverHint(Object.assign({ x, z }, options));
}

export function normalizeCoverHint(marker = {}) {
  return {
    id: marker.id || customId('cover'),
    x: finiteNumber(marker.x, 0),
    z: finiteNumber(marker.z, 0),
    yaw: finiteNumber(marker.yaw, 0),
    radius: Math.max(0.25, Math.min(12, finiteNumber(marker.radius, 1.5))),
    label: marker.label || 'COVER HINT',
  };
}

export function createBreachPoint(x = 0, z = 0, options = {}) {
  return normalizeBreachPoint(Object.assign({ x, z }, options));
}

export function normalizeBreachPoint(marker = {}) {
  return {
    id: marker.id || customId('breach'),
    x: finiteNumber(marker.x, 0),
    z: finiteNumber(marker.z, 0),
    yaw: finiteNumber(marker.yaw, 0),
    radius: Math.max(0.25, Math.min(8, finiteNumber(marker.radius, 1.2))),
    label: marker.label || 'BREACH',
  };
}

export function createSniperPerch(x = 0, z = 0, options = {}) {
  return normalizeSniperPerch(Object.assign({ x, z }, options));
}

export function normalizeSniperPerch(marker = {}) {
  return {
    id: marker.id || customId('sniper'),
    x: finiteNumber(marker.x, 0),
    z: finiteNumber(marker.z, 0),
    yaw: finiteNumber(marker.yaw, 0),
    range: Math.max(4, Math.min(120, finiteNumber(marker.range, 22))),
    arcDegrees: Math.max(8, Math.min(120, finiteNumber(marker.arcDegrees, 42))),
    label: marker.label || 'SNIPER PERCH',
  };
}
