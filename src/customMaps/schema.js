export const CUSTOM_MAP_SCHEMA_VERSION = 1;
export const CUSTOM_MAP_PACK_STORE = 'clearance_custom_map_packs_v1';
export const CUSTOM_MAP_AUTOSAVE_KEY = 'clearance_custom_map_editor_autosave_v1';
export const DEFAULT_KIT_ID = 'level-kit.b01-megaplex';
export const DEFAULT_LEVEL_KIT_URL = '/assets/level-kit/b01-megaplex/manifest.json';
export const BUILTIN_CUSTOM_MAP_INDEX_URL = '/custom-maps/builtin/index.json';
export const DEV_CUSTOM_MAP_INDEX_URL = '/custom-maps/dev/index.json';

export const DEFAULT_CUSTOM_MAP_BOUNDS = { x0: -18, x1: 18, z0: -54, z1: 54 };
export const DEFAULT_CUSTOM_ZONE_BOUNDS = { halfWidth: 18, halfDepth: 54, zSplit: 18 };

export const ENEMY_TYPES = ['soldier', 'scout', 'heavy', 'pistolero', 'riot', 'marksman', 'sniper', 'shielded', 'demolitions'];
export const ENEMY_ROLES = ['anchor', 'lookout', 'flanker', 'breacher', 'patrol', 'marksman', 'reinforcement'];
export const ENEMY_BEHAVIORS = ['hold_angle', 'peek_from_cover', 'ambush_on_crossing', 'push_after_contact', 'patrol_route', 'reposition'];
export const DOOR_ACCESS_MODES = ['player', 'enemies', 'both', 'locked'];

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
  const out = Object.assign(base, cloneJson(markers));
  out.playerSpawn = Object.assign(base.playerSpawn, markers.playerSpawn || {});
  for (const key of ['exits', 'zoneDoors', 'enemySpawns', 'peekAngles', 'holdPositions', 'patrolRoutes', 'pickups', 'triggerVolumes']) {
    out[key] = Array.isArray(markers[key]) ? markers[key].map((x) => Object.assign({}, x)) : base[key];
  }
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
  const doorAccess = normalizeDoorAccess(obj.doorAccess ?? obj.openBy ?? obj.doorOpenMode, null);
  if (doorAccess) out.doorAccess = doorAccess;
  return out;
}

export function createPlacedObject(prefabId, x = 0, z = 0, options = {}) {
  return normalizePlacedObject(Object.assign({ prefabId, x, z }, options));
}

export function createEnemySpawn(x = 0, z = 0, options = {}) {
  return Object.assign({
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
    coverHintId: null,
    peekAngleId: null,
    patrolRouteId: null,
    activation: 'zone_start',
  }, options);
}

export function createPeekAngle(x = 0, z = 0, options = {}) {
  return Object.assign({ id: customId('peek'), x, z, yaw: 0, arcDegrees: 70, range: 11, label: 'PEEK' }, options);
}

export function createHoldPosition(x = 0, z = 0, options = {}) {
  return Object.assign({ id: customId('hold'), x, z, yaw: 0, radius: 1.2, label: 'HOLD' }, options);
}
