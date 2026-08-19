import * as THREE from 'three';
import {
  cloneJson,
  createBreachPoint,
  createCombatZone,
  createCoverHint,
  createDefaultCustomMap,
  createDefaultCustomMapPack,
  createEnemySpawn,
  createFlankRoute,
  createHoldPosition,
  createPatrolRoute,
  createPeekAngle,
  createPlacedObject,
  createSniperPerch,
  createTriggerVolume,
  ENEMY_BEHAVIORS,
  ENEMY_LINK_FIELDS,
  ENEMY_ROLES,
  ENEMY_TYPES,
  normalizeDoorAccess,
  normalizeCustomMapPack,
  normalizeBehaviorTuning,
} from './schema.js';
import {
  EDITOR_TOOL_HINTS,
  ENEMY_BEHAVIOR_SEQUENCES,
  applyBehaviorSequenceToSpawn,
  behaviorMeta,
  workflowProgress,
} from './editorGuide.js';
import { collectCustomMapGeometry, partRuntimeTransform, partWorldAabb } from './customMapCompiler.js';
import {
  buildEditorAssetPreview,
  buildLevelEditorAssetHealth,
  findManifestEntry
} from '../animation/assetPipeline.js';
import {
  ALL_MANIFESTS,
  ANIMATION_MANIFEST,
  CHARACTER_MANIFEST,
  ENVIRONMENT_MANIFEST,
  WEAPON_MANIFEST
} from '../assetManifest.js';

const LAYERS = ['geometry', 'gameplay', 'enemies', 'flow', 'lighting', 'template'];
const VIEW_MODES = ['tactical', 'top', 'preview'];
const COMBAT_STAMPS = [
  { id: 'breach', label: 'BREACH' },
  { id: 'crossfire', label: 'CROSSFIRE' },
  { id: 'push', label: 'PUSH' },
  { id: 'sniper', label: 'SNIPER' },
  { id: 'final', label: 'FINAL' },
];
const SINGLE_TACTICAL_TOOLS = ['enemy', 'peek', 'hold', 'cover', 'breach', 'sniper', 'spawn', 'exit', 'door', 'pickup'];
const DRAW_TACTICAL_TOOLS = ['patrol', 'flank', 'zone', 'trigger'];
const PLACEMENT_TOOLS = [...SINGLE_TACTICAL_TOOLS, ...DRAW_TACTICAL_TOOLS];
const TOOL_LABELS = {
  select: 'SELECT',
  pan: 'PAN',
  place: 'PLACE',
  enemy: 'ENEMY',
  peek: 'PEEK',
  hold: 'HOLD',
  cover: 'COVER HINT',
  breach: 'BREACH',
  sniper: 'SNIPER',
  patrol: 'PATROL',
  flank: 'FLANK',
  zone: 'ZONE',
  trigger: 'TRIGGER',
  spawn: 'SPAWN',
  exit: 'EXIT',
  door: 'DOOR',
  pickup: 'PICKUP',
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function fmt(n) {
  return Number(n || 0).toFixed(1);
}

function snap(v) {
  return Math.round(v / 0.5) * 0.5;
}

function rotateXZ(x, z, yaw) {
  const c = Math.cos(yaw || 0);
  const s = Math.sin(yaw || 0);
  return { x: x * c - z * s, z: x * s + z * c };
}

function yawToward(x, z, targetX = 0, targetZ = 0) {
  return Math.atan2(targetX - x, targetZ - z);
}

function colorToInt(color, fallback = 0xffffff) {
  if (!color) return fallback;
  try {
    return new THREE.Color(color).getHex();
  } catch (_) {
    return fallback;
  }
}

function customMarkerId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function profileSelectHtml(id, label, manifest, current = '', emptyLabel = 'DEFAULT') {
  const ids = Object.keys(manifest || {}).sort();
  const value = String(current || '');
  if (value && !ids.includes(value)) ids.unshift(value);
  return `<label>${label}<select id="${id}">
    <option value="">${emptyLabel}</option>
    ${ids.map((profileId) => `<option value="${escapeHtml(profileId)}"${profileId === value ? ' selected' : ''}>${escapeHtml(profileId)}</option>`).join('')}
  </select></label>`;
}

function optionalTextInputHtml(id, label, current = '', placeholder = '') {
  return `<label>${label}<input id="${id}" value="${escapeHtml(current || '')}" placeholder="${escapeHtml(placeholder)}"></label>`;
}

function setOptionalProfileId(target, key, value) {
  if (!target) return;
  const next = String(value || '').trim();
  if (next) target[key] = next;
  else delete target[key];
}

function assetProfileRefsForEntity(type, ent) {
  if (!ent) return [];
  const refs = [];
  const add = (field, id, label) => {
    if (id) refs.push({ field, id: String(id), label });
  };
  if (type === 'object') {
    add('modelProfileId', ent.modelProfileId, 'MODEL');
    add('visualProfileId', ent.visualProfileId, 'VISUAL');
    add('animationProfileId', ent.animationProfileId, 'ANIMATION');
    add('weaponProfileId', ent.weaponProfileId, 'WEAPON');
    add('importedAssetId', ent.importedAssetId, 'IMPORT');
  } else if (type === 'enemy') {
    add('enemyAnimationProfileId', ent.enemyAnimationProfileId, 'ENEMY VISUAL');
    add('enemyModelProfileId', ent.enemyModelProfileId, 'ENEMY MODEL');
    add('visualProfileId', ent.visualProfileId, 'VISUAL');
    add('animationProfileId', ent.animationProfileId, 'ANIMATION');
    add('weaponProfileId', ent.weaponProfileId, 'WEAPON');
    add('importedAssetId', ent.importedAssetId, 'IMPORT');
  }
  return refs;
}

function previewForAssetRef(ref) {
  const resolved = findManifestEntry(ALL_MANIFESTS, ref.id);
  if (resolved.entry) {
    return Object.assign(buildEditorAssetPreview(resolved.entry), {
      refField: ref.field,
      refLabel: ref.label,
      resolved: true,
      manifestBucket: resolved.bucket
    });
  }
  const source = ref.field === 'importedAssetId' || ref.id.startsWith('asset.')
    ? ref.id
    : 'editor-unregistered-profile';
  return Object.assign(buildEditorAssetPreview({
    id: ref.id,
    kind: ref.field === 'importedAssetId' ? 'external-import' : 'external-profile',
    source,
    fallback: 'runtime.safe-default'
  }), {
    refField: ref.field,
    refLabel: ref.label,
    resolved: false,
    manifestBucket: null
  });
}

function assetPreviewsForEntity(type, ent) {
  return assetProfileRefsForEntity(type, ent).map(previewForAssetRef);
}

function assetPreviewPanelHtml(type, ent) {
  const previews = assetPreviewsForEntity(type, ent);
  if (!previews.length) {
    return `<div class="ce-asset-preview"><div class="ce-asset-preview-head"><b>ASSET PREVIEW</b><span>DEFAULTS</span></div><div class="ce-ins-hint">No custom profile IDs set. Runtime/editor defaults remain authoritative.</div></div>`;
  }
  const cards = previews.map((preview) => {
    const issueCodes = preview.issues.concat(preview.warnings).map((row) => row.code).slice(0, 3);
    const socketReady = preview.sockets ? Math.max(0, preview.sockets.required.length - preview.sockets.missingRequired.length) : 0;
    const socketTotal = preview.sockets ? (preview.sockets.required.length || preview.sockets.available.length || 0) : 0;
    const socketCount = `${socketReady}/${socketTotal}`;
    const clipCount = preview.animation ? `${preview.animation.availablePreviewStates}/${preview.animation.previewStates.length}` : '0/0';
    const status = preview.ok && preview.resolved ? 'ok' : 'warn';
    return `<div class="ce-asset-card ${status}">
      <div><b>${escapeHtml(preview.refLabel || preview.kind)}</b><span>${escapeHtml(preview.id || '')}</span></div>
      <small>${escapeHtml(preview.kind || 'asset')} / ${escapeHtml(preview.sourceKind || 'manifest')} / ${escapeHtml(preview.runtimeStatus || 'fallback')}</small>
      <em>SOCKETS ${escapeHtml(socketCount)} / CLIPS ${escapeHtml(clipCount)}</em>
      ${issueCodes.length ? `<i>${issueCodes.map(escapeHtml).join(' / ')}</i>` : '<i>READY FOR EDITOR PREVIEW</i>'}
    </div>`;
  }).join('');
  return `<div class="ce-asset-preview"><div class="ce-asset-preview-head"><b>ASSET PREVIEW</b><span>${previews.length} REF${previews.length === 1 ? '' : 'S'}</span></div>${cards}</div>`;
}

function isDoorPrefab(pf) {
  if (!pf) return false;
  if (pf.category === 'doors') return true;
  if (String(pf.id || '').startsWith('door.')) return true;
  return Array.isArray(pf.tags) && pf.tags.includes('door');
}

function isWindowPrefab(pf) {
  if (!pf) return false;
  if (pf.category === 'windows') return true;
  if (String(pf.id || '').startsWith('window.')) return true;
  return Array.isArray(pf.tags) && pf.tags.includes('window');
}

function isEditorMapEmpty(m) {
  if (!m) return true;
  const markers = m.markers || {};
  const tactical = (markers.enemySpawns?.length || 0)
    + (markers.peekAngles?.length || 0)
    + (markers.holdPositions?.length || 0)
    + (markers.patrolRoutes?.length || 0)
    + (markers.flankRoutes?.length || 0)
    + (markers.combatZones?.length || 0)
    + (markers.triggerVolumes?.length || 0)
    + (markers.coverHints?.length || 0)
    + (markers.breachPoints?.length || 0)
    + (markers.sniperPerches?.length || 0)
    + (markers.pickups?.length || 0);
  return (m.objects?.length || 0) === 0 && tactical === 0;
}

export function createLevelEditorController(options = {}) {
  const store = options.store;
  const kitRegistry = options.kitRegistry;
  const validator = options.validator;
  const onPlaytest = options.onPlaytest || (() => {});
  const onBack = options.onBack || (() => {});
  const root = document.getElementById('custom-editor');
  const canvas = document.getElementById('ce-canvas');
  const palette = document.getElementById('ce-palette');
  const tabs = document.getElementById('ce-tabs');
  const inspector = document.getElementById('ce-inspector');
  const status = document.getElementById('ce-status');
  const title = document.getElementById('ce-title-input');
  const importInput = document.getElementById('ce-import-file');
  const hud = document.getElementById('ce-hud');
  const emptyBanner = document.getElementById('ce-empty-banner');
  const guidePanel = document.getElementById('ce-guide-panel');
  const behaviorPanel = document.getElementById('ce-behavior-panel');
  const toolHint = document.getElementById('ce-tool-hint');
  const searchInput = document.getElementById('ce-search');
  const analysisPanel = document.getElementById('ce-analysis-panel');
  const gridSelect = document.getElementById('ce-grid-size');
  const socketSnapInput = document.getElementById('ce-socket-snap');

  let pack = null;
  let mapIndex = 0;
  let map = null;
  let selected = null;
  let activeCategory = 'modules';
  let activeTool = 'select';
  let activePrefabId = null;
  let activeDraw = null;
  let drag = null;
  let hoverWorld = null;
  let viewMode = 'tactical';
  let view = { targetX: 0, targetZ: 0, zoom: 1 };
  let placementYaw = 0;
  let placementPickupType = 'ammo';
  let lastSnapHint = 'GRID';
  let gridSize = 0.5;
  let socketSnapEnabled = true;
  let paletteQuery = '';
  let analysis = { enabled: false, result: null, at: 0 };
  let clipboard = null;
  let layers = Object.fromEntries(LAYERS.map((l) => [l, true]));
  let history = [];
  let redo = [];
  let autosaveTimer = 0;
  let activeWorkflowStepId = 'layout';
  let pendingBehaviorSequenceId = 'hold_defend';
  let lastValidationOk = false;

  let renderer = null;
  let scene = null;
  let camera = null;
  let editorRoot = null;
  let raycaster = null;
  let floorPlane = null;
  let hitMeshes = [];
  let matCache = new Map();
  let animationId = 0;

  function setStatus(text, tone = '') {
    if (!status) return;
    status.textContent = text || '';
    status.dataset.tone = tone || '';
  }

  function kit() {
    return kitRegistry && kitRegistry.manifest;
  }

  function prefab(id) {
    return kitRegistry && kitRegistry.getPrefab ? kitRegistry.getPrefab(id) : null;
  }

  function materialDef(key) {
    return (kit() && kit().materials && kit().materials[key]) || {};
  }

  function snapGrid(v) {
    const size = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 0.5;
    return Math.round(v / size) * size;
  }

  function zoneForZ(z) {
    const split = map && map.zoneBounds && Number.isFinite(Number(map.zoneBounds.zSplit)) ? Number(map.zoneBounds.zSplit) : 18;
    if (z > split) return 0;
    if (z >= -split) return 1;
    return 2;
  }

  function clampToPlayableBounds(x, z, margin = 1.15) {
    const b = map && map.bounds ? map.bounds : { x0: -18, x1: 18, z0: -54, z1: 54 };
    const x0 = Number.isFinite(Number(b.x0)) ? Number(b.x0) : -18;
    const x1 = Number.isFinite(Number(b.x1)) ? Number(b.x1) : 18;
    const z0 = Number.isFinite(Number(b.z0)) ? Number(b.z0) : -54;
    const z1 = Number.isFinite(Number(b.z1)) ? Number(b.z1) : 54;
    return {
      x: clamp(x, x0 + margin, x1 - margin),
      z: clamp(z, z0 + margin, z1 - margin),
    };
  }

  function isDrawTool(tool = activeTool) {
    return DRAW_TACTICAL_TOOLS.includes(tool);
  }

  function isPlacementTool(tool = activeTool) {
    return PLACEMENT_TOOLS.includes(tool);
  }

  function ensureMarkerArrays() {
    if (!map) return;
    map.markers = map.markers || {};
    for (const key of [
      'enemySpawns',
      'peekAngles',
      'holdPositions',
      'patrolRoutes',
      'pickups',
      'triggerVolumes',
      'combatZones',
      'flankRoutes',
      'coverHints',
      'breachPoints',
      'sniperPerches',
      'zoneDoors',
      'exits',
    ]) {
      if (!Array.isArray(map.markers[key])) map.markers[key] = [];
    }
  }

  function markerArrayForType(type) {
    ensureMarkerArrays();
    if (!map || !map.markers) return [];
    if (type === 'enemy') return map.markers.enemySpawns;
    if (type === 'peek') return map.markers.peekAngles;
    if (type === 'hold') return map.markers.holdPositions;
    if (type === 'patrol') return map.markers.patrolRoutes;
    if (type === 'flank') return map.markers.flankRoutes;
    if (type === 'cover') return map.markers.coverHints;
    if (type === 'breach') return map.markers.breachPoints;
    if (type === 'sniper') return map.markers.sniperPerches;
    if (type === 'trigger') return map.markers.triggerVolumes;
    if (type === 'zone') return map.markers.combatZones;
    if (type === 'pickup') return map.markers.pickups;
    if (type === 'door') return map.markers.zoneDoors;
    if (type === 'exit') return map.markers.exits;
    return [];
  }

  function pointToAabbDist2(px, pz, box) {
    const cx = Math.max(box.x0, Math.min(box.x1, px));
    const cz = Math.max(box.z0, Math.min(box.z1, pz));
    const dx = px - cx;
    const dz = pz - cz;
    return dx * dx + dz * dz;
  }

  function placementQuality(pos, radius = 0.46) {
    if (!pos || !map || !kit()) return { tone: 'ok', color: '#7cff86', reason: 'READY' };
    const b = map.bounds || { x0: -18, x1: 18, z0: -54, z1: 54 };
    if (pos.x < b.x0 || pos.x > b.x1 || pos.z < b.z0 || pos.z > b.z1) {
      return { tone: 'bad', color: '#ff5048', reason: 'OUT OF BOUNDS' };
    }
    const geo = collectCustomMapGeometry(map, kit());
    for (const wall of geo.walls || []) {
      if (!wall || wall.broken || wall.isWindow) continue;
      if (pointToAabbDist2(pos.x, pos.z, wall) < radius * radius) return { tone: 'bad', color: '#ff5048', reason: 'COLLISION' };
    }
    return { tone: 'ok', color: '#7cff86', reason: 'VALID' };
  }

  function snapTacticalPlacement(tool, world) {
    const base = snapPlacement(null, world);
    if (!base) return base;
    if (['spawn', 'enemy', 'peek', 'hold', 'cover', 'breach', 'sniper', 'patrol', 'flank', 'zone', 'trigger'].includes(tool)) {
      const bounded = clampToPlayableBounds(base.x, base.z, tool === 'zone' || tool === 'trigger' ? 0.1 : 0.55);
      return Object.assign({}, base, bounded);
    }
    return base;
  }

  function entityPosition(type, ent) {
    if (!ent) return { x: 0, z: 0 };
    if (type === 'patrol' || type === 'flank') {
      const pts = Array.isArray(ent.points) ? ent.points : [];
      if (!pts.length) return { x: 0, z: 0 };
      return {
        x: pts.reduce((sum, p) => sum + (Number(p.x) || 0), 0) / pts.length,
        z: pts.reduce((sum, p) => sum + (Number(p.z) || 0), 0) / pts.length,
      };
    }
    if (type === 'trigger' || type === 'zone') {
      return {
        x: ((Number(ent.x0) || 0) + (Number(ent.x1) || 0)) / 2,
        z: ((Number(ent.z0) || 0) + (Number(ent.z1) || 0)) / 2,
      };
    }
    if (type === 'exit') {
      return {
        x: ((Number(ent.x0) || 0) + (Number(ent.x1) || 0)) / 2,
        z: ((Number(ent.z0) || 0) + (Number(ent.z1) || 0)) / 2,
      };
    }
    return { x: Number(ent.x) || 0, z: Number(ent.z) || 0 };
  }

  function setEntityPosition(type, ent, x, z) {
    if (!ent) return;
    if (type === 'patrol' || type === 'flank') {
      const current = entityPosition(type, ent);
      const dx = x - current.x;
      const dz = z - current.z;
      ent.points = (ent.points || []).map((point) => ({ ...point, x: snapGrid((Number(point.x) || 0) + dx), z: snapGrid((Number(point.z) || 0) + dz) }));
      return;
    }
    if (type === 'trigger' || type === 'zone') {
      const current = entityPosition(type, ent);
      const dx = x - current.x;
      const dz = z - current.z;
      ent.x0 = snapGrid((Number(ent.x0) || 0) + dx);
      ent.x1 = snapGrid((Number(ent.x1) || 0) + dx);
      ent.z0 = snapGrid((Number(ent.z0) || 0) + dz);
      ent.z1 = snapGrid((Number(ent.z1) || 0) + dz);
      return;
    }
    if (type === 'spawn') {
      const bounded = clampToPlayableBounds(x, z);
      ent.x = bounded.x;
      ent.z = bounded.z;
      ent.floorY = map && Number.isFinite(Number(map.floorY)) ? Number(map.floorY) : 0.4;
      return;
    }
    if (type === 'exit') {
      const width = Math.max(1, Math.abs((Number(ent.x1) || 0) - (Number(ent.x0) || 0)) || 4);
      const depth = Math.max(1, Math.abs((Number(ent.z1) || 0) - (Number(ent.z0) || 0)) || 3);
      ent.x0 = x - width / 2;
      ent.x1 = x + width / 2;
      ent.z0 = z - depth / 2;
      ent.z1 = z + depth / 2;
      return;
    }
    ent.x = x;
    ent.z = z;
  }

  function entityYaw(type, ent) {
    if (!ent) return 0;
    if (type === 'exit') return Number(ent.yaw) || 0;
    return Number(ent.yaw) || 0;
  }

  function setEntityYaw(type, ent, yaw) {
    if (!ent || type === 'exit' || type === 'patrol' || type === 'flank' || type === 'trigger' || type === 'zone') return;
    ent.yaw = yaw;
  }

  function prefabSockets(pf) {
    if (!pf) return [];
    if (Array.isArray(pf.sockets) && pf.sockets.length) return pf.sockets;
    const isWall = pf.category === 'walls' || (Array.isArray(pf.tags) && pf.tags.includes('wall'));
    if (!isWall || !Array.isArray(pf.parts)) return [];
    const sockets = [];
    for (const part of pf.parts) {
      if (!part || part.kind !== 'box' || part.collision !== 'wall_aabb') continue;
      const size = part.size || [];
      const offset = part.offset || [0, 0, 0];
      const sx = Math.abs(Number(size[0]) || 0);
      const sz = Math.abs(Number(size[2]) || 0);
      const longAxis = Math.max(sx, sz);
      if (longAxis < 0.9) continue;
      const ox = Number(offset[0]) || 0;
      const oz = Number(offset[2]) || 0;
      const id = part.name || 'wall';
      if (sx >= sz) {
        sockets.push({ id: `${id}_west`, position: [ox - sx / 2, 0, oz], facing: 270, derived: true });
        sockets.push({ id: `${id}_east`, position: [ox + sx / 2, 0, oz], facing: 90, derived: true });
      } else {
        sockets.push({ id: `${id}_back`, position: [ox, 0, oz - sz / 2], facing: 180, derived: true });
        sockets.push({ id: `${id}_front`, position: [ox, 0, oz + sz / 2], facing: 0, derived: true });
      }
    }
    return sockets;
  }

  function worldSocketsFor(obj, pf) {
    const sockets = [];
    if (!obj || !pf) return sockets;
    const yaw = Number(obj.yaw) || 0;
    for (const socket of prefabSockets(pf)) {
      const pos = socket.position || [0, 0, 0];
      const off = rotateXZ(Number(pos[0]) || 0, Number(pos[2]) || 0, yaw);
      sockets.push({
        id: socket.id,
        x: (Number(obj.x) || 0) + off.x,
        z: (Number(obj.z) || 0) + off.z,
      });
    }
    return sockets;
  }

  function wallInsertSnap(prefabId, base, options = {}) {
    const pf = prefabId ? prefab(prefabId) : null;
    if (!socketSnapEnabled || !pf || (!isDoorPrefab(pf) && !isWindowPrefab(pf)) || !map || !map.objects || !map.objects.length) return null;
    let best = null;
    for (const obj of map.objects) {
      if (!obj || obj.id === options.excludeId) continue;
      const otherPf = prefab(obj.prefabId);
      if (!otherPf || !['walls', 'modules'].includes(otherPf.category)) continue;
      const yaw = Number(obj.yaw) || 0;
      const scale = Number.isFinite(obj.scale) ? obj.scale : 1;
      for (const part of otherPf.parts || []) {
        if (!part || part.kind !== 'box' || part.collision !== 'wall_aabb') continue;
        const size = part.size || [];
        const sx = Math.abs(Number(size[0]) || 0) * scale;
        const sz = Math.abs(Number(size[2]) || 0) * scale;
        const length = Math.max(sx, sz);
        const thickness = Math.min(sx, sz);
        if (length < 1.2 || thickness > 1.15) continue;
        const tx = partRuntimeTransform(part, obj, Number.isFinite(map.floorY) ? map.floorY : 0.4, otherPf);
        const off = rotateXZ(tx.ox, tx.oz, yaw);
        const center = { x: (Number(obj.x) || 0) + off.x, z: (Number(obj.z) || 0) + off.z };
        const long = sx >= sz ? rotateXZ(1, 0, yaw) : rotateXZ(0, 1, yaw);
        const longLen = Math.hypot(long.x, long.z) || 1;
        long.x /= longLen;
        long.z /= longLen;
        const normal = { x: -long.z, z: long.x };
        const dx = base.x - center.x;
        const dz = base.z - center.z;
        const along = dx * long.x + dz * long.z;
        const side = dx * normal.x + dz * normal.z;
        if (Math.abs(side) > 1.2 || Math.abs(along) > length / 2 + 0.9) continue;
        const snappedAlong = clamp(along, -length / 2, length / 2);
        const x = center.x + long.x * snappedAlong;
        const z = center.z + long.z * snappedAlong;
        const dist = Math.hypot(x - base.x, z - base.z);
        if (dist > 1.35) continue;
        if (!best || dist < best.dist) best = { dist, x, z, yaw: Math.atan2(long.z, long.x), target: obj };
      }
    }
    if (!best) return null;
    lastSnapHint = 'WALL INSERT';
    return { x: best.x, z: best.z, yaw: best.yaw };
  }

  function snapPlacement(prefabId, world, options = {}) {
    const base = { x: snapGrid(world.x), z: snapGrid(world.z) };
    lastSnapHint = 'GRID';
    const pf = prefabId ? prefab(prefabId) : null;
    const insertSnap = wallInsertSnap(prefabId, base, options);
    if (insertSnap) return insertSnap;
    if (!socketSnapEnabled || !pf || !prefabSockets(pf).length || !map || !map.objects || !map.objects.length) return base;
    const candidate = {
      id: options.excludeId || '__placement',
      prefabId,
      x: base.x,
      z: base.z,
      yaw: Number.isFinite(options.yaw) ? options.yaw : placementYaw,
      scale: 1,
    };
    let best = null;
    for (const socket of worldSocketsFor(candidate, pf)) {
      for (const obj of map.objects) {
        if (obj.id === options.excludeId) continue;
        const otherPf = prefab(obj.prefabId);
        for (const target of worldSocketsFor(obj, otherPf)) {
          const dx = target.x - socket.x;
          const dz = target.z - socket.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 1.05) continue;
          if (!best || dist < best.dist) best = { dist, x: base.x + dx, z: base.z + dz, target };
        }
      }
    }
    if (best) {
      lastSnapHint = `SOCKET ${best.target.id || ''}`.trim();
      return { x: best.x, z: best.z };
    }
    return base;
  }

  function material(key, options = {}) {
    const cacheKey = `${key || 'default'}:${options.kind || 'standard'}:${options.opacity ?? 'solid'}:${options.color || ''}:${options.emissive || ''}`;
    if (matCache.has(cacheKey)) return matCache.get(cacheKey);
    const def = materialDef(key);
    let mat;
    if (options.kind === 'basic') {
      mat = new THREE.MeshBasicMaterial({
        color: colorToInt(options.color || def.color, 0xffffff),
        transparent: options.opacity != null && options.opacity < 1,
        opacity: options.opacity ?? 1,
        depthWrite: options.depthWrite ?? true,
        side: options.side || THREE.DoubleSide,
      });
    } else if (options.kind === 'line') {
      mat = new THREE.LineBasicMaterial({
        color: colorToInt(options.color || def.color, 0xffffff),
        transparent: options.opacity != null && options.opacity < 1,
        opacity: options.opacity ?? 1,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: colorToInt(options.color || def.color, 0xffffff),
        roughness: def.roughness ?? 0.74,
        metalness: def.metalness ?? 0.04,
        emissive: colorToInt(options.emissive, 0x000000),
        emissiveIntensity: options.emissive ? 0.28 : 0,
        transparent: (options.opacity != null && options.opacity < 1) || (def.opacity != null && def.opacity < 1),
        opacity: options.opacity ?? def.opacity ?? 1,
        depthWrite: options.depthWrite ?? !(options.opacity != null && options.opacity < 1),
        side: options.side || THREE.FrontSide,
      });
    }
    mat.name = cacheKey;
    matCache.set(cacheKey, mat);
    return mat;
  }

  function disposeGroup(group) {
    if (!group) return;
    group.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
    });
    if (group.parent) group.parent.remove(group);
  }

  function initViewport() {
    if (renderer || !canvas) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x05070a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070a, 70, 150);
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 260);
    raycaster = new THREE.Raycaster();
    floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4);

    const hemi = new THREE.HemisphereLight(0xb9d6ff, 0x161008, 1.1);
    hemi.name = 'editor-hemi';
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffd49a, 2.4);
    key.name = 'editor-key';
    key.position.set(-34, 60, 42);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x66ccff, 0.42);
    fill.position.set(40, 30, -30);
    scene.add(fill);
  }

  function resizeViewport() {
    if (!renderer || !canvas || !camera) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    const base = viewMode === 'top' ? 56 : viewMode === 'preview' ? 34 : 46;
    const halfH = base / clamp(view.zoom, 0.45, 3.5);
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    if (!camera || !map) return;
    const y = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const target = new THREE.Vector3(view.targetX, y, view.targetZ);
    if (viewMode === 'top') {
      camera.position.set(target.x, y + 95, target.z + 0.001);
      camera.up.set(0, 0, -1);
    } else if (viewMode === 'preview') {
      camera.position.set(target.x + 18, y + 14, target.z + 26);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.set(target.x + 36, y + 56, target.z + 46);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function screenToWorld(clientX, clientY) {
    initViewport();
    if (!canvas || !camera || !raycaster || !floorPlane) return null;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
    );
    raycaster.setFromCamera(ndc, camera);
    floorPlane.constant = -(Number.isFinite(map && map.floorY) ? map.floorY : 0.4);
    const out = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlane, out)) return null;
    return { x: out.x, z: out.z };
  }

  function pickEntity(clientX, clientY) {
    initViewport();
    if (canvas && camera && raycaster && hitMeshes.length) {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(hitMeshes, true);
      for (const hit of hits) {
        let obj = hit.object;
        while (obj) {
          if (obj.userData && obj.userData.editorPick) return obj.userData.editorPick;
          obj = obj.parent;
        }
      }
    }
    const world = screenToWorld(clientX, clientY);
    return world ? hitTest(world) : null;
  }

  function saveHistory() {
    if (!map) return;
    history.push(JSON.stringify(map));
    if (history.length > 80) history.shift();
    redo = [];
  }

  function restoreFrom(serialized) {
    if (!serialized) return;
    map = JSON.parse(serialized);
    if (pack && pack.maps) pack.maps[mapIndex] = map;
    selected = null;
    scheduleAutosave();
    renderAll();
  }

  function undo() {
    if (!history.length || !map) return;
    redo.push(JSON.stringify(map));
    restoreFrom(history.pop());
  }

  function redoEdit() {
    if (!redo.length || !map) return;
    history.push(JSON.stringify(map));
    restoreFrom(redo.pop());
  }

  function scheduleAutosave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      try { localStorage.setItem('clearance_custom_map_editor_autosave_v1', JSON.stringify({ pack, mapIndex })); } catch (_) {}
    }, 350);
  }

  function addLine(group, points, color, opacity = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    const line = new THREE.Line(geometry, material(`line:${color}`, { kind: 'line', color, opacity }));
    group.add(line);
    return line;
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

  function exitCenter(exit) {
    if (!exit) return null;
    return {
      x: ((Number(exit.x0) || 0) + (Number(exit.x1) || 0)) / 2,
      z: ((Number(exit.z0) || 0) + (Number(exit.z1) || 0)) / 2,
    };
  }

  function lineBlocked(a, b, geo) {
    if (!geo || !Array.isArray(geo.walls)) return false;
    for (const wall of geo.walls) {
      if (wall.perimeter) continue;
      if (segmentIntersectsBox(a, b, wall, 0.08)) return true;
    }
    return false;
  }

  function mapStats() {
    const geo = map && kit() ? collectCustomMapGeometry(map, kit()) : null;
    const assetDoors = map?.objects?.filter((obj) => isDoorPrefab(prefab(obj.prefabId))).length || 0;
    return {
      objects: map?.objects?.length || 0,
      enemies: map?.markers?.enemySpawns?.length || 0,
      covers: geo?.vaultables?.length || 0,
      walls: geo?.walls?.filter((w) => !w.perimeter).length || 0,
      doors: (map?.markers?.zoneDoors?.length || 0) + assetDoors,
      patrols: map?.markers?.patrolRoutes?.length || 0,
      flanks: map?.markers?.flankRoutes?.length || 0,
      zones: map?.markers?.combatZones?.length || 0,
      triggers: map?.markers?.triggerVolumes?.length || 0,
      exits: map?.markers?.exits?.length || 0,
      navCells: geo?.navGrid?.cells || 0,
      geo,
    };
  }

  function renderAnalysisPanel() {
    if (!analysisPanel || !map) return;
    const stats = mapStats();
    const result = analysis.result || map.validation || { ok: false, errors: [], warnings: [] };
    const issues = (result.errors || []).concat(result.warnings || []).slice(0, 5);
    const selectedEnt = selectedEntity();
    let tactical = '';
    if (selected && selectedEnt) {
      const pos = entityPosition(selected.type, selectedEnt);
      const spawn = map.markers.playerSpawn || { x: 0, z: 0 };
      tactical = `<div class="ce-analysis-row"><span>SELECT DIST</span><b>${fmt(Math.hypot(pos.x - spawn.x, pos.z - spawn.z))}M</b></div>
        <div class="ce-analysis-row"><span>ZONE</span><b>${zoneForZ(pos.z) + 1}</b></div>`;
    }
    analysisPanel.innerHTML = `
      <div class="ce-analysis-head">
        <span>TACTICAL ANALYSIS</span>
        <b class="${result.ok ? 'ok' : 'bad'}">${result.ok ? 'CLEAN' : `${(result.errors || []).length} ERR`}</b>
      </div>
      <div class="ce-analysis-grid">
        <div><b>${stats.objects}</b><span>OBJECTS</span></div>
        <div><b>${stats.enemies}</b><span>ENEMIES</span></div>
        <div><b>${stats.covers}</b><span>COVER</span></div>
        <div><b>${stats.doors}</b><span>DOORS</span></div>
        <div><b>${stats.patrols}</b><span>PATROLS</span></div>
        <div><b>${stats.flanks}</b><span>FLANKS</span></div>
      </div>
      ${tactical}
      <div class="ce-analysis-row"><span>OVERLAY</span><b>${analysis.enabled ? 'ON' : 'OFF'}</b></div>
      <div class="ce-analysis-issues">${issues.length ? issues.map((x) => `<div>${x}</div>`).join('') : '<div>NO CURRENT ISSUES</div>'}</div>
    `;
  }

  function addAnalysisOverlay(group) {
    if (!analysis.enabled || !map || !kit()) return;
    const geo = collectCustomMapGeometry(map, kit());
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const spawn = map.markers.playerSpawn ? { x: Number(map.markers.playerSpawn.x) || 0, z: Number(map.markers.playerSpawn.z) || 0 } : null;
    const exit = exitCenter((map.markers.exits || [])[0]);
    if (spawn && exit) {
      addLine(group, [
        { x: spawn.x, y: floorY + 0.22, z: spawn.z },
        { x: exit.x, y: floorY + 0.22, z: exit.z },
      ], lineBlocked(spawn, exit, geo) ? '#ff5048' : '#5fcb52', 0.88);
    }
    const selectedPos = selectedEntity() && selected ? entityPosition(selected.type, selectedEntity()) : null;
    for (const enemy of map.markers.enemySpawns || []) {
      const start = { x: Number(enemy.x) || 0, z: Number(enemy.z) || 0 };
      const target = selectedPos || spawn || exit;
      if (!target) continue;
      const blocked = lineBlocked(start, target, geo);
      addLine(group, [
        { x: start.x, y: floorY + 0.32, z: start.z },
        { x: target.x, y: floorY + 0.32, z: target.z },
      ], blocked ? '#777f88' : '#ff5048', blocked ? 0.22 : 0.52);
    }
    for (const cover of geo.vaultables || []) {
      const cx = (cover.x0 + cover.x1) / 2;
      const cz = (cover.z0 + cover.z1) / 2;
      addLine(group, [
        { x: cover.x0, y: floorY + 0.16, z: cover.z0 },
        { x: cover.x1, y: floorY + 0.16, z: cover.z0 },
        { x: cover.x1, y: floorY + 0.16, z: cover.z1 },
        { x: cover.x0, y: floorY + 0.16, z: cover.z1 },
        { x: cover.x0, y: floorY + 0.16, z: cover.z0 },
      ], '#5fcb52', 0.24);
      if (selectedPos && Math.hypot(cx - selectedPos.x, cz - selectedPos.z) < 5) {
        addLine(group, [
          { x: cx, y: floorY + 0.18, z: cz },
          { x: selectedPos.x, y: floorY + 0.18, z: selectedPos.z },
        ], '#ffd060', 0.26);
      }
    }
  }

  function addGrid(group) {
    if (!map) return;
    const bounds = map.bounds;
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const centerX = (bounds.x0 + bounds.x1) / 2;
    const centerZ = (bounds.z0 + bounds.z1) / 2;
    const width = Math.max(1, bounds.x1 - bounds.x0);
    const depth = Math.max(1, bounds.z1 - bounds.z0);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      material('editor-floor', { kind: 'basic', color: '#171b20', opacity: 0.94, depthWrite: true, side: THREE.DoubleSide }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, floorY - 0.012, centerZ);
    group.add(floor);

    const borderY = floorY + 0.018;
    addLine(group, [
      { x: bounds.x0, y: borderY, z: bounds.z0 },
      { x: bounds.x1, y: borderY, z: bounds.z0 },
      { x: bounds.x1, y: borderY, z: bounds.z1 },
      { x: bounds.x0, y: borderY, z: bounds.z1 },
      { x: bounds.x0, y: borderY, z: bounds.z0 },
    ], '#ffd060', 0.56);

    const positions = [];
    const step = 2;
    for (let x = Math.ceil(bounds.x0 / step) * step; x <= bounds.x1; x += step) {
      positions.push(x, borderY, bounds.z0, x, borderY, bounds.z1);
    }
    for (let z = Math.ceil(bounds.z0 / step) * step; z <= bounds.z1; z += step) {
      positions.push(bounds.x0, borderY, z, bounds.x1, borderY, z);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const grid = new THREE.LineSegments(gridGeo, material('grid-lines', { kind: 'line', color: '#ffffff', opacity: 0.105 }));
    group.add(grid);

    if (layers.flow) {
      const zb = map.zoneBounds || { zSplit: 18 };
      const colors = ['#315cff', '#ffd060', '#5fcb52'];
      const zones = [
        { z0: zb.zSplit, z1: bounds.z1, c: colors[0] },
        { z0: -zb.zSplit, z1: zb.zSplit, c: colors[1] },
        { z0: bounds.z0, z1: -zb.zSplit, c: colors[2] },
      ];
      for (const zone of zones) {
        const zc = (zone.z0 + zone.z1) / 2;
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(width, Math.max(0.1, zone.z1 - zone.z0)),
          material(`zone:${zone.c}`, { kind: 'basic', color: zone.c, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }),
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(centerX, floorY + 0.004, zc);
        group.add(plane);
      }
      for (const z of [zb.zSplit, -zb.zSplit]) {
        addLine(group, [
          { x: bounds.x0, y: floorY + 0.035, z },
          { x: bounds.x1, y: floorY + 0.035, z },
        ], '#5fcb52', 0.68);
      }
    }
  }

  function addPartMesh(group, obj, pf, part, options = {}) {
    if (!part || part.kind !== 'box') return null;
    const floorY = map && Number.isFinite(Number(map.floorY)) ? Number(map.floorY) : 0;
    const runtimeBox = options.runtimeBox || null;
    const tx = runtimeBox ? null : partRuntimeTransform(part, obj, floorY, pf);
    const sx = runtimeBox ? Math.max(0.04, runtimeBox.x1 - runtimeBox.x0) : Math.max(0.04, tx.sx || 0.1);
    const sy = runtimeBox ? Math.max(0.04, runtimeBox.y1 - runtimeBox.y0) : Math.max(0.04, tx.sy || 0.1);
    const sz = runtimeBox ? Math.max(0.04, runtimeBox.z1 - runtimeBox.z0) : Math.max(0.04, tx.sz || 0.1);
    const yaw = Number.isFinite(obj.yaw) ? obj.yaw : 0;
    const opacity = options.ghost ? 0.38 : (part.collision === 'transparent_window_aabb' ? 0.46 : 1);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      material(part.material || 'wall_dark', {
        opacity,
        color: options.ghost ? '#ffd060' : null,
        emissive: options.selected ? '#ffd060' : null,
        side: part.collision === 'transparent_window_aabb' ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !options.ghost && part.collision !== 'transparent_window_aabb',
      }),
    );
    if (runtimeBox) {
      mesh.position.set((runtimeBox.x0 + runtimeBox.x1) / 2, (runtimeBox.y0 + runtimeBox.y1) / 2, (runtimeBox.z0 + runtimeBox.z1) / 2);
      mesh.rotation.y = 0;
    } else {
      const off = rotateXZ(tx.ox, tx.oz, yaw);
      mesh.position.set(obj.x + off.x, tx.oy, obj.z + off.z);
      mesh.rotation.y = yaw;
    }
    mesh.name = `${pf.id}:${part.name || 'part'}`;
    if (!options.ghost) {
      mesh.userData.editorPick = { type: 'object', id: obj.id };
      hitMeshes.push(mesh);
    }
    group.add(mesh);
    if (options.selected || options.ghost) {
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        material(options.ghost ? 'ghost-edge' : 'selected-edge', { kind: 'line', color: options.ghost ? '#ffd060' : '#ffffff', opacity: options.ghost ? 0.82 : 0.95 }),
      );
      edge.position.copy(mesh.position);
      edge.rotation.copy(mesh.rotation);
      group.add(edge);
    }
    return mesh;
  }

  function addSelectionCross(group, obj) {
    if (!obj || !map) return;
    const y = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    addLine(group, [
      { x: obj.x - 0.55, y: y + 0.08, z: obj.z },
      { x: obj.x + 0.55, y: y + 0.08, z: obj.z },
    ], '#ffffff', 0.9);
    addLine(group, [
      { x: obj.x, y: y + 0.08, z: obj.z - 0.55 },
      { x: obj.x, y: y + 0.08, z: obj.z + 0.55 },
    ], '#ffffff', 0.9);
  }

  function addAssetSocketPreview(group, ent, type) {
    if (!ent || !map || !layers.gameplay) return;
    const previews = assetPreviewsForEntity(type, ent)
      .filter((preview) => preview.sockets && preview.sockets.markers.length)
      .slice(0, 3);
    if (!previews.length) return;
    const pos = entityPosition(type, ent);
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const markers = [];
    for (const preview of previews) {
      for (const socket of preview.sockets.markers) {
        if (markers.length >= 16) break;
        markers.push({ id: socket.id, required: socket.required, available: socket.available, source: preview.id });
      }
    }
    const radius = type === 'enemy' ? 1.35 : 1.05;
    markers.forEach((socket, index) => {
      const a = (Math.PI * 2 * index) / Math.max(1, markers.length);
      const x = pos.x + Math.sin(a) * radius;
      const z = pos.z + Math.cos(a) * radius;
      const y = floorY + 0.42 + (socket.required ? 0.08 : 0);
      const color = socket.available ? (socket.required ? '#7cff86' : '#ffd060') : '#ff8060';
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(socket.required ? 0.085 : 0.065, 8, 8),
        material(`asset-socket:${color}`, { kind: 'basic', color, opacity: socket.required ? 0.96 : 0.72, depthWrite: false }),
      );
      dot.position.set(x, y, z);
      group.add(dot);
      addLine(group, [
        { x: pos.x, y: floorY + 0.28, z: pos.z },
        { x, y, z },
      ], color, socket.required ? 0.45 : 0.24);
    });
  }

  function partLayerVisible(part) {
    if (!part) return false;
    if (!layers.geometry && part.collision !== 'decorative_only') return false;
    if (!layers.gameplay && (part.collision === 'decorative_only' || part.collision === 'nonblocking_visual')) return false;
    return true;
  }

  function addObject(group, obj, options = {}) {
    const pf = prefab(obj.prefabId);
    if (!pf) return;
    const objectSelected = selected && selected.type === 'object' && selected.id === obj.id;
    for (const part of pf.parts || []) {
      if (!partLayerVisible(part)) continue;
      addPartMesh(group, obj, pf, part, { selected: objectSelected, ghost: options.ghost });
    }
    if (!options.ghost && objectSelected) {
      addSelectionCross(group, obj);
      addAssetSocketPreview(group, obj, 'object');
    }
  }

  function addCompiledObjects(group) {
    const geo = kit() ? collectCustomMapGeometry(map, kit()) : null;
    if (!geo) {
      for (const obj of map.objects || []) addObject(group, obj);
      return;
    }
    for (const entry of geo.placedParts || []) {
      if (!entry || !entry.object || !entry.prefab || !partLayerVisible(entry.part)) continue;
      const objectSelected = selected && selected.type === 'object' && selected.id === entry.object.id;
      addPartMesh(group, entry.object, entry.prefab, entry.part, {
        selected: objectSelected,
        runtimeBox: entry.runtimeBox || null,
      });
    }
    if (selected && selected.type === 'object') {
      const obj = (map.objects || []).find((candidate) => candidate.id === selected.id);
      if (obj) {
        addSelectionCross(group, obj);
        addAssetSocketPreview(group, obj, 'object');
      }
    }
  }

  function addGroundTriangle(group, marker, range, halfAngle, color, opacity = 0.28) {
    const yaw = marker.yaw || 0;
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const pts = [
      new THREE.Vector3(marker.x, floorY + 0.075, marker.z),
      new THREE.Vector3(marker.x + Math.sin(yaw - halfAngle) * range, floorY + 0.075, marker.z + Math.cos(yaw - halfAngle) * range),
      new THREE.Vector3(marker.x + Math.sin(yaw + halfAngle) * range, floorY + 0.075, marker.z + Math.cos(yaw + halfAngle) * range),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setIndex([0, 1, 2]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material(`cone:${color}`, { kind: 'basic', color, opacity, side: THREE.DoubleSide, depthWrite: false }));
    group.add(mesh);
    addLine(group, [
      { x: pts[1].x, y: pts[1].y + 0.01, z: pts[1].z },
      { x: marker.x, y: pts[1].y + 0.01, z: marker.z },
      { x: pts[2].x, y: pts[2].y + 0.01, z: pts[2].z },
    ], color, opacity + 0.22);
  }

  function addMarkerDisc(group, marker, color, type, radius = 0.55, options = {}) {
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const selectedMarker = selected && selected.type === type && selected.id === marker.id;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.08, 32),
      material(`marker:${color}:${options.ghost ? 'ghost' : 'solid'}`, { color, opacity: options.ghost ? 0.38 : selectedMarker ? 0.98 : 0.82, emissive: selectedMarker ? color : null, depthWrite: !options.ghost }),
    );
    disc.position.set(marker.x, floorY + 0.09, marker.z);
    if (!options.ghost) disc.userData.editorPick = { type, id: marker.id };
    group.add(disc);
    if (!options.ghost) hitMeshes.push(disc);

    const yaw = marker.yaw || 0;
    addLine(group, [
      { x: marker.x, y: floorY + 0.18, z: marker.z },
      { x: marker.x + Math.sin(yaw) * 1.8, y: floorY + 0.18, z: marker.z + Math.cos(yaw) * 1.8 },
    ], selectedMarker ? '#ffffff' : color, 0.92);

    if (selectedMarker && !options.ghost) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius + 0.12, 0.025, 8, 48),
        material('marker-selected-ring', { kind: 'basic', color: '#ffffff', opacity: 0.95 }),
      );
      ring.position.set(marker.x, floorY + 0.15, marker.z);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  }

  function addArc(group, marker, radius, halfAngle, color) {
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const pts = [];
    const yaw = marker.yaw || 0;
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = -halfAngle + (halfAngle * 2 * i) / steps;
      pts.push({
        x: marker.x + Math.sin(yaw + t) * radius,
        y: floorY + 0.11,
        z: marker.z + Math.cos(yaw + t) * radius,
      });
    }
    addLine(group, pts, color, 0.68);
  }

  function addRectOverlay(group, rect, color, type, options = {}) {
    if (!rect || !map) return;
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const x0 = Number(rect.x0) || 0;
    const x1 = Number(rect.x1) || 0;
    const z0 = Number(rect.z0) || 0;
    const z1 = Number(rect.z1) || 0;
    const w = Math.max(0.2, Math.abs(x1 - x0));
    const d = Math.max(0.2, Math.abs(z1 - z0));
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const selectedRect = selected && selected.type === type && selected.id === rect.id;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      material(`rect:${type}:${color}:${options.ghost ? 'ghost' : selectedRect ? 'selected' : 'idle'}`, {
        kind: 'basic',
        color,
        opacity: options.ghost ? 0.16 : selectedRect ? 0.28 : 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, floorY + (options.ghost ? 0.095 : 0.07), cz);
    if (!options.ghost) {
      mesh.userData.editorPick = { type, id: rect.id };
      hitMeshes.push(mesh);
    }
    group.add(mesh);
    addLine(group, [
      { x: x0, y: floorY + 0.14, z: z0 },
      { x: x1, y: floorY + 0.14, z: z0 },
      { x: x1, y: floorY + 0.14, z: z1 },
      { x: x0, y: floorY + 0.14, z: z1 },
      { x: x0, y: floorY + 0.14, z: z0 },
    ], selectedRect ? '#ffffff' : color, selectedRect ? 0.92 : 0.62);
  }

  function addRouteOverlay(group, route, color, type, options = {}) {
    if (!route || !map) return;
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const pts = (route.points || []).map((p) => ({ x: Number(p.x) || 0, y: floorY + 0.14, z: Number(p.z) || 0 }));
    if (pts.length > 1) {
      const drawPts = route.loop !== false && pts.length > 2 ? pts.concat([pts[0]]) : pts;
      addLine(group, drawPts, color, options.ghost ? 0.52 : 0.82);
      for (let i = 1; i < drawPts.length; i++) {
        const a = drawPts[i - 1];
        const b = drawPts[i];
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        addLine(group, [
          { x: mx, y: floorY + 0.2, z: mz },
          { x: mx + Math.sin(yaw) * 0.55, y: floorY + 0.2, z: mz + Math.cos(yaw) * 0.55 },
        ], color, options.ghost ? 0.42 : 0.66);
      }
    }
    pts.forEach((p, index) => {
      const selectedRoute = selected && selected.type === type && selected.id === route.id;
      const dot = new THREE.Mesh(
        new THREE.CylinderGeometry(selectedRoute ? 0.33 : 0.26, selectedRoute ? 0.33 : 0.26, 0.08, 20),
        material(`route-dot:${type}:${color}:${selectedRoute ? 'selected' : 'idle'}`, {
          color: selectedRoute ? '#ffffff' : color,
          opacity: options.ghost ? 0.42 : 0.9,
          emissive: selectedRoute ? color : null,
          depthWrite: !options.ghost,
        }),
      );
      dot.position.set(p.x, floorY + 0.1, p.z);
      if (!options.ghost) {
        dot.userData.editorPick = { type, id: route.id };
        hitMeshes.push(dot);
      }
      group.add(dot);
      if (index > 0) {
        const prev = pts[index - 1];
        const blocked = kit() && collectCustomMapGeometry(map, kit()).walls.some((wall) => {
          if (!wall || wall.broken || wall.isWindow || wall.perimeter) return false;
          return segmentIntersectsBox({ x: prev.x, z: prev.z }, { x: p.x, z: p.z }, wall, 0.08);
        });
        if (blocked) addLine(group, [prev, p], '#ff5048', 0.86);
      }
    });
  }

  function markerByTypeAndId(type, id) {
    if (!id) return null;
    return markerArrayForType(type).find((row) => row && row.id === id) || null;
  }

  function addEnemyLinks(group) {
    if (!map || !layers.flow) return;
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const linkMap = [
      ['peekAngleId', 'peek', '#ffd060'],
      ['holdPositionId', 'hold', '#5fcb52'],
      ['coverHintId', 'cover', '#40e0ff'],
      ['patrolRouteId', 'patrol', '#66ccff'],
      ['flankRouteId', 'flank', '#ff8f40'],
      ['triggerVolumeId', 'trigger', '#d58cff'],
      ['combatZoneId', 'zone', '#8da0ff'],
    ];
    for (const enemy of map.markers.enemySpawns || []) {
      const links = enemy.links || {};
      for (const [field, type, color] of linkMap) {
        const id = links[field] || enemy[field];
        const target = markerByTypeAndId(type, id);
        if (!target) continue;
        const targetPos = entityPosition(type, target);
        addLine(group, [
          { x: enemy.x, y: floorY + 0.24, z: enemy.z },
          { x: targetPos.x, y: floorY + 0.24, z: targetPos.z },
        ], color, selected && selected.id === enemy.id ? 0.62 : 0.28);
      }
    }
  }

  function addMarkers(group) {
    if (!map || !layers.enemies && !layers.flow && !layers.gameplay) return;
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    if (layers.enemies) {
      for (const e of map.markers.enemySpawns || []) {
        addMarkerDisc(group, e, '#ff5048', 'enemy', 0.58);
        addGroundTriangle(group, e, 4.2, 0.38, '#ff5048', 0.22);
        if (selected && selected.type === 'enemy' && selected.id === e.id) addAssetSocketPreview(group, e, 'enemy');
      }
    }
    if (layers.flow) {
      for (const p of map.markers.peekAngles || []) {
        addMarkerDisc(group, p, '#ffd060', 'peek', 0.48);
        addGroundTriangle(group, p, p.range || 8, ((p.arcDegrees || 70) * Math.PI / 180) / 2, '#ffd060', 0.16);
        addArc(group, p, p.range || 8, ((p.arcDegrees || 70) * Math.PI / 180) / 2, '#ffd060');
      }
      for (const h of map.markers.holdPositions || []) {
        addMarkerDisc(group, h, '#5fcb52', 'hold', h.radius || 0.7);
      }
      for (const route of map.markers.patrolRoutes || []) {
        addRouteOverlay(group, route, '#66ccff', 'patrol');
      }
      for (const route of map.markers.flankRoutes || []) {
        addRouteOverlay(group, route, '#ff8f40', 'flank');
      }
      for (const c of map.markers.coverHints || []) {
        addMarkerDisc(group, c, '#40e0ff', 'cover', c.radius || 0.6);
      }
      for (const b of map.markers.breachPoints || []) {
        addMarkerDisc(group, b, '#ffb050', 'breach', b.radius || 0.62);
      }
      for (const s of map.markers.sniperPerches || []) {
        addMarkerDisc(group, s, '#a0c8ff', 'sniper', 0.62);
        addGroundTriangle(group, s, s.range || 18, ((s.arcDegrees || 42) * Math.PI / 180) / 2, '#a0c8ff', 0.14);
        addArc(group, s, s.range || 18, ((s.arcDegrees || 42) * Math.PI / 180) / 2, '#a0c8ff');
      }
      for (const zone of map.markers.combatZones || []) {
        addRectOverlay(group, zone, '#8da0ff', 'zone');
      }
      for (const trigger of map.markers.triggerVolumes || []) {
        addRectOverlay(group, trigger, '#d58cff', 'trigger');
      }
    }
    if (layers.gameplay) {
      const sp = map.markers.playerSpawn;
      if (sp) {
        addMarkerDisc(group, sp, '#5ab4ff', 'spawn', 0.64);
        addGroundTriangle(group, sp, 3.6, 0.34, '#5ab4ff', 0.2);
      }
      for (const p of map.markers.pickups || []) {
        addMarkerDisc(group, p, p.type === 'med' ? '#5fcb52' : '#6bb6ff', 'pickup', 0.45);
      }
      for (const ex of map.markers.exits || []) {
        const w = Math.max(0.2, (Number(ex.x1) || 0) - (Number(ex.x0) || 0));
        const d = Math.max(0.2, (Number(ex.z1) || 0) - (Number(ex.z0) || 0));
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w, d),
          material('exit-plane', { kind: 'basic', color: '#32ff7a', opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(((Number(ex.x0) || 0) + (Number(ex.x1) || 0)) / 2, floorY + 0.065, ((Number(ex.z0) || 0) + (Number(ex.z1) || 0)) / 2);
        mesh.userData.editorPick = { type: 'exit', id: ex.id || 'exit_main' };
        group.add(mesh);
        hitMeshes.push(mesh);
        if (selected && selected.type === 'exit' && selected.id === (ex.id || 'exit_main')) {
          addLine(group, [
            { x: Number(ex.x0) || 0, y: floorY + 0.13, z: Number(ex.z0) || 0 },
            { x: Number(ex.x1) || 0, y: floorY + 0.13, z: Number(ex.z0) || 0 },
            { x: Number(ex.x1) || 0, y: floorY + 0.13, z: Number(ex.z1) || 0 },
            { x: Number(ex.x0) || 0, y: floorY + 0.13, z: Number(ex.z1) || 0 },
            { x: Number(ex.x0) || 0, y: floorY + 0.13, z: Number(ex.z0) || 0 },
          ], '#ffffff', 0.9);
        }
      }
      for (const d of map.markers.zoneDoors || []) {
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(Number(d.width) || 5.4, 3.0, Number(d.depth) || 0.62),
          material(`zone-door-marker:${selected && selected.type === 'door' && selected.id === d.id ? 'selected' : 'idle'}`, { color: '#ffd060', opacity: selected && selected.type === 'door' && selected.id === d.id ? 0.36 : 0.22, emissive: '#ffd060', depthWrite: false }),
        );
        door.position.set(Number(d.x) || 0, floorY + 1.5, Number(d.z) || 0);
        door.rotation.y = Number(d.yaw) || 0;
        door.userData.editorPick = { type: 'door', id: d.id };
        group.add(door);
        hitMeshes.push(door);
      }
    }
    addEnemyLinks(group);
  }

  function addCursorReticle(group, pos, color = '#ffd060') {
    if (!pos || !map) return;
    const y = (Number.isFinite(map.floorY) ? map.floorY : 0.4) + 0.12;
    addLine(group, [{ x: pos.x - 0.55, y, z: pos.z }, { x: pos.x + 0.55, y, z: pos.z }], color, 0.82);
    addLine(group, [{ x: pos.x, y, z: pos.z - 0.55 }, { x: pos.x, y, z: pos.z + 0.55 }], color, 0.82);
  }

  function addExitGhost(group, pos) {
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      material('ghost-exit', { kind: 'basic', color: '#32ff7a', opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, floorY + 0.075, pos.z);
    group.add(mesh);
  }

  function addDoorGhost(group, pos) {
    const floorY = Number.isFinite(map.floorY) ? map.floorY : 0.4;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 3, 0.62),
      material('ghost-door', { color: '#ffd060', opacity: 0.28, emissive: '#ffd060', depthWrite: false }),
    );
    mesh.position.set(pos.x, floorY + 1.5, pos.z);
    mesh.rotation.y = placementYaw;
    group.add(mesh);
  }

  function addGhost(group) {
    if (!hoverWorld || activeTool === 'select' || activeTool === 'pan') return;
    if (activeDraw) {
      const pos = snapTacticalPlacement(activeDraw.type, hoverWorld);
      if (activeDraw.type === 'patrol' || activeDraw.type === 'flank') {
        const route = {
          id: '__draw',
          points: (activeDraw.points || []).concat(pos ? [{ x: pos.x, z: pos.z }] : []),
          loop: activeDraw.type === 'patrol',
        };
        addRouteOverlay(group, route, activeDraw.type === 'patrol' ? '#66ccff' : '#ff8f40', activeDraw.type, { ghost: true });
      } else if ((activeDraw.type === 'zone' || activeDraw.type === 'trigger') && activeDraw.start && pos) {
        const rect = {
          id: '__draw_rect',
          x0: Math.min(activeDraw.start.x, pos.x),
          x1: Math.max(activeDraw.start.x, pos.x),
          z0: Math.min(activeDraw.start.z, pos.z),
          z1: Math.max(activeDraw.start.z, pos.z),
        };
        addRectOverlay(group, rect, activeDraw.type === 'zone' ? '#8da0ff' : '#d58cff', activeDraw.type, { ghost: true });
      }
      if (pos) addCursorReticle(group, pos, '#ffffff');
      return;
    }
    if (activePrefabId) {
      const pos = snapPlacement(activePrefabId, hoverWorld, { yaw: placementYaw });
      const yaw = Number.isFinite(pos.yaw) ? pos.yaw : placementYaw;
      const ghost = createPlacedObject(activePrefabId, pos.x, pos.z, { yaw });
      addObject(group, ghost, { ghost: true });
      addCursorReticle(group, pos);
      return;
    }
    const pos = snapTacticalPlacement(activeTool, hoverWorld);
    const quality = placementQuality(pos, activeTool === 'spawn' ? 0.35 : 0.46);
    const ghostColor = quality.color || '#ffd060';
    if (activeTool === 'enemy') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'enemy', 0.58, { ghost: true });
      addGroundTriangle(group, { x: pos.x, z: pos.z, yaw: placementYaw }, 4.2, 0.38, ghostColor, 0.14);
    } else if (activeTool === 'peek') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw, range: 8, arcDegrees: 70 }, ghostColor, 'peek', 0.48, { ghost: true });
      addArc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, 8, (70 * Math.PI / 180) / 2, ghostColor);
    } else if (activeTool === 'hold') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'hold', 0.7, { ghost: true });
    } else if (activeTool === 'cover') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'cover', 0.65, { ghost: true });
    } else if (activeTool === 'breach') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'breach', 0.65, { ghost: true });
    } else if (activeTool === 'sniper') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'sniper', 0.65, { ghost: true });
      addGroundTriangle(group, { x: pos.x, z: pos.z, yaw: placementYaw }, 18, (42 * Math.PI / 180) / 2, ghostColor, 0.12);
    } else if (activeTool === 'spawn') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'spawn', 0.64, { ghost: true });
    } else if (activeTool === 'exit') {
      addExitGhost(group, pos);
    } else if (activeTool === 'door') {
      addDoorGhost(group, pos);
    } else if (activeTool === 'pickup') {
      addMarkerDisc(group, { x: pos.x, z: pos.z, yaw: placementYaw }, ghostColor, 'pickup', 0.45, { ghost: true });
    }
    addCursorReticle(group, pos, ghostColor);
  }

  function renderViewport() {
    if (!map || !canvas) return;
    initViewport();
    resizeViewport();
    updateCamera();
    disposeGroup(editorRoot);
    editorRoot = new THREE.Group();
    editorRoot.name = 'custom-map-editor-scene';
    scene.add(editorRoot);
    hitMeshes = [];
    addGrid(editorRoot);
    addCompiledObjects(editorRoot);
    addMarkers(editorRoot);
    addAnalysisOverlay(editorRoot);
    addGhost(editorRoot);
    renderer.render(scene, camera);
    updateHud();
  }

  function startLoop() {
    if (animationId) return;
    const frame = () => {
      animationId = window.requestAnimationFrame(frame);
      if (root && root.classList.contains('show') && renderer && scene && camera) {
        resizeViewport();
        updateCamera();
        renderer.render(scene, camera);
      }
    };
    animationId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (!animationId) return;
    window.cancelAnimationFrame(animationId);
    animationId = 0;
  }

  function renderTabs() {
    if (!tabs) return;
    const cats = kitRegistry ? kitRegistry.listCategories() : [];
    tabs.innerHTML = cats.map((cat) => `<button class="ce-tab ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">${cat}<small>${kitRegistry.listPrefabs(cat).length}</small></button>`).join('');
    tabs.querySelectorAll('.ce-tab').forEach((button) => button.addEventListener('click', () => {
      activeCategory = button.dataset.cat;
      activeTool = 'place';
      renderPalette();
      renderTabs();
      renderToolbar();
    }));
  }

  function toolForPalettePrefab(pf) {
    const markerType = pf && pf.gameplay && pf.gameplay.markerType;
    if (markerType === 'enemy_spawn') return 'enemy';
    if (markerType === 'peek_angle') return 'peek';
    if (markerType === 'hold_position') return 'hold';
    if (markerType === 'cover_hint') return 'cover';
    if (markerType === 'patrol_node') return 'patrol';
    if (markerType === 'trigger_volume') return 'trigger';
    if (markerType === 'sniper_perch') return 'sniper';
    if (markerType === 'breach_point') return 'breach';
    if (markerType === 'exit_zone') return 'exit';
    if (pf && pf.category === 'pickups') return 'pickup';
    return null;
  }

  function renderPalette() {
    if (!palette) return;
    const query = paletteQuery.trim().toLowerCase();
    let prefabs = kitRegistry ? kitRegistry.listPrefabs(query ? null : activeCategory) : [];
    if (query) {
      prefabs = prefabs.filter((pf) => {
        const haystack = `${pf.id} ${pf.label} ${pf.category} ${(pf.tags || []).join(' ')}`.toLowerCase();
        return haystack.includes(query);
      });
    }
    palette.innerHTML = '';
    if (!prefabs.length) {
      palette.innerHTML = '<div class="ce-empty-palette">NO MATCHING ASSETS</div>';
      return;
    }
    for (const pf of prefabs) {
      const button = document.createElement('button');
      const paletteTool = toolForPalettePrefab(pf);
      button.className = `ce-prefab ${pf.id === activePrefabId || (paletteTool && paletteTool === activeTool) ? 'active' : ''}`;
      button.draggable = true;
      const thumb = kitRegistry.resolveAssetUrl(pf.thumbnail);
      button.title = `${pf.label} - ${(pf.tags || []).join(', ')}`;
      const badge = (pf.tags || []).find((t) => ['cover', 'doorway', 'window', 'vehicle', 'route', 'pickup', 'module', 'wall'].includes(t)) || pf.category;
      button.innerHTML = `<img alt="" src="${thumb}"><span>${pf.label}</span><small>${pf.footprint[0]} x ${pf.footprint[1]}m</small><em>${badge}</em>`;
      button.addEventListener('click', () => {
        activeDraw = null;
        const tool = toolForPalettePrefab(pf);
        if (tool) {
          activeTool = tool;
          activePrefabId = null;
          if (pf.category === 'pickups') placementPickupType = pf.id.includes('med') ? 'med' : 'ammo';
        } else {
          activePrefabId = pf.id;
          activeTool = 'place';
        }
        renderToolbar();
        renderPalette();
        renderViewport();
      });
      button.addEventListener('dragstart', (e) => {
        activeDraw = null;
        const tool = toolForPalettePrefab(pf);
        if (tool) {
          e.dataTransfer.setData('application/x-clearance-editor-tool', tool);
          e.dataTransfer.setData('application/x-clearance-pickup-type', pf.id.includes('med') ? 'med' : 'ammo');
          activeTool = tool;
          activePrefabId = null;
        } else {
          e.dataTransfer.setData('text/plain', pf.id);
          activePrefabId = pf.id;
          activeTool = 'place';
        }
      });
      palette.appendChild(button);
    }
  }

  function selectedEntity() {
    if (!selected || !map) return null;
    if (selected.type === 'object') return map.objects.find((o) => o.id === selected.id) || null;
    if (selected.type === 'enemy') return map.markers.enemySpawns.find((o) => o.id === selected.id) || null;
    if (selected.type === 'peek') return map.markers.peekAngles.find((o) => o.id === selected.id) || null;
    if (selected.type === 'hold') return map.markers.holdPositions.find((o) => o.id === selected.id) || null;
    if (selected.type === 'patrol') return (map.markers.patrolRoutes || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'flank') return (map.markers.flankRoutes || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'cover') return (map.markers.coverHints || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'breach') return (map.markers.breachPoints || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'sniper') return (map.markers.sniperPerches || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'trigger') return (map.markers.triggerVolumes || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'zone') return (map.markers.combatZones || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'pickup') return (map.markers.pickups || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'door') return (map.markers.zoneDoors || []).find((o) => o.id === selected.id) || null;
    if (selected.type === 'exit') return (map.markers.exits || []).find((o) => (o.id || 'exit_main') === selected.id) || null;
    if (selected.type === 'spawn') return map.markers.playerSpawn;
    return null;
  }

  function optionsHtml(options, current = '') {
    const value = String(current || '');
    return options.map((option) => {
      const pair = Array.isArray(option) ? option : [option, option];
      return `<option value="${escapeHtml(pair[0])}"${String(pair[0]) === value ? ' selected' : ''}>${escapeHtml(pair[1])}</option>`;
    }).join('');
  }

  function markerSelectHtml(id, label, type, current = '', emptyLabel = 'NONE') {
    const rows = markerArrayForType(type);
    const value = String(current || '');
    return `<label>${label}<select id="${id}">
      <option value="">${emptyLabel}</option>
      ${rows.map((row) => `<option value="${escapeHtml(row.id)}"${row.id === value ? ' selected' : ''}>${escapeHtml(row.label || row.id)}</option>`).join('')}
    </select></label>`;
  }

  function setEnemyLink(ent, key, value) {
    if (!ent || !ENEMY_LINK_FIELDS.includes(key)) return;
    ent.links = ent.links || {};
    const next = String(value || '').trim();
    ent.links[key] = next || null;
    ent[key] = next || null;
  }

  function renderInspector() {
    if (!inspector || !map) return;
    const ent = selectedEntity();
    if (!ent) {
      inspector.innerHTML = `<div class="ce-ins-title">MAP</div>
        <label>TITLE<input id="ce-map-title" value="${map.title}"></label>
        <label>CALLSIGN<input id="ce-map-call" value="${map.briefing.callsign || ''}"></label>
        <label>TIME<input id="ce-map-time" value="${map.briefing.time || ''}"></label>
        <div class="ce-ins-hint">Use 3D, Top, or Preview camera modes to place kit prefabs and tactical markers.</div>`;
      inspector.querySelector('#ce-map-title')?.addEventListener('input', (e) => { map.title = e.target.value; if (title) title.value = map.title; scheduleAutosave(); });
      inspector.querySelector('#ce-map-call')?.addEventListener('input', (e) => { map.briefing.callsign = e.target.value; scheduleAutosave(); });
      inspector.querySelector('#ce-map-time')?.addEventListener('input', (e) => { map.briefing.time = e.target.value; scheduleAutosave(); });
      return;
    }
    const isEnemy = selected.type === 'enemy';
    const isRoute = selected.type === 'patrol' || selected.type === 'flank';
    const isRect = selected.type === 'trigger' || selected.type === 'zone';
    const isTacticalPoint = ['peek', 'hold', 'cover', 'breach', 'sniper'].includes(selected.type);
    const selectedPrefab = selected.type === 'object' ? prefab(ent.prefabId) : null;
    const isOpenableDoor = selected.type === 'object' && isDoorPrefab(selectedPrefab);
    const doorAccess = normalizeDoorAccess(ent.doorAccess, 'player') || 'player';
    const pos = entityPosition(selected.type, ent);
    const yawDeg = Math.round((entityYaw(selected.type, ent) * 180) / Math.PI);
    const yawDisabled = selected.type === 'exit' || isRoute || isRect;
    const objectAssetControls = selected.type === 'object' ? `
      <div class="ce-ins-title">ASSET</div>
      ${profileSelectHtml('ce-object-model-profile', 'MODEL PROFILE', ENVIRONMENT_MANIFEST, ent.modelProfileId)}
      ${profileSelectHtml('ce-object-animation-profile', 'ANIMATION SET', ANIMATION_MANIFEST, ent.animationProfileId)}
      ${profileSelectHtml('ce-object-weapon-profile', 'WEAPON VISUAL', WEAPON_MANIFEST, ent.weaponProfileId)}
      ${optionalTextInputHtml('ce-object-imported-asset', 'IMPORTED ASSET', ent.importedAssetId, 'asset.meshy.example')}
      ${assetPreviewPanelHtml(selected.type, ent)}
    ` : '';
    const enemyAssetControls = isEnemy ? `
      <div class="ce-ins-title">ASSET</div>
      ${profileSelectHtml('ce-enemy-visual-profile', 'ENEMY VISUAL', CHARACTER_MANIFEST, ent.enemyAnimationProfileId)}
      ${profileSelectHtml('ce-enemy-model-profile', 'ENEMY MODEL', CHARACTER_MANIFEST, ent.enemyModelProfileId)}
      ${profileSelectHtml('ce-enemy-animation-profile', 'ANIMATION SET', ANIMATION_MANIFEST, ent.animationProfileId)}
      ${profileSelectHtml('ce-enemy-weapon-profile', 'WEAPON VISUAL', WEAPON_MANIFEST, ent.weaponProfileId)}
      ${optionalTextInputHtml('ce-enemy-imported-asset', 'IMPORTED ASSET', ent.importedAssetId, 'asset.mixamo.or.meshy')}
      ${assetPreviewPanelHtml(selected.type, ent)}
    ` : '';
    const enemyLinks = isEnemy ? `
      <div class="ce-ins-title">TACTICAL LINKS</div>
      ${markerSelectHtml('ce-link-peek', 'PEEK ANGLE', 'peek', ent.links?.peekAngleId || ent.peekAngleId)}
      ${markerSelectHtml('ce-link-hold', 'HOLD POINT', 'hold', ent.links?.holdPositionId || ent.holdPositionId)}
      ${markerSelectHtml('ce-link-cover', 'COVER HINT', 'cover', ent.links?.coverHintId || ent.coverHintId)}
      ${markerSelectHtml('ce-link-patrol', 'PATROL ROUTE', 'patrol', ent.links?.patrolRouteId || ent.patrolRouteId)}
      ${markerSelectHtml('ce-link-flank', 'FLANK ROUTE', 'flank', ent.links?.flankRouteId || ent.flankRouteId)}
      ${markerSelectHtml('ce-link-trigger', 'TRIGGER', 'trigger', ent.links?.triggerVolumeId || ent.triggerVolumeId)}
      ${markerSelectHtml('ce-link-zone', 'COMBAT ZONE', 'zone', ent.links?.combatZoneId || ent.combatZoneId)}
    ` : '';
    const routeControls = isRoute ? `
      <div class="ce-ins-title">${selected.type === 'patrol' ? 'PATROL ROUTE' : 'FLANK ROUTE'}</div>
      <label>LABEL<input id="ce-route-label" value="${escapeHtml(ent.label || '')}"></label>
      <label>POINTS<input value="${(ent.points || []).length}" disabled></label>
      ${selected.type === 'patrol' ? `<label>LOOP<select id="ce-route-loop">${optionsHtml([['true', 'LOOP'], ['false', 'OPEN / PING-PONG']], String(ent.loop !== false))}</select></label>` : ''}
      ${selected.type === 'patrol' ? `<label>PAUSE SEC<input id="ce-route-pause" type="number" min="0" step="0.1" value="${Number(ent.pauseSeconds || 0).toFixed(1)}"></label>` : ''}
      <label>SPEED<input id="ce-route-speed" type="number" min="0.25" max="3" step="0.05" value="${Number(ent.speed || 1).toFixed(2)}"></label>
      ${selected.type === 'patrol' ? `<label>ALERT<select id="ce-route-alert">${optionsHtml(['patrol_then_alarm', 'peek_from_cover', 'hold_angle', 'push_after_contact'], ent.alertBehavior || 'patrol_then_alarm')}</select></label>` : `<label>ACTIVATION<select id="ce-route-activation">${optionsHtml(['after_contact', 'zone_start', 'on_trigger'], ent.activation || 'after_contact')}</select></label>`}
      <label>ASSIGNED IDS<input id="ce-route-assigned" value="${escapeHtml((ent.assignedEnemyIds || []).join(', '))}" placeholder="enemy_1, enemy_2"></label>
    ` : '';
    const rectControls = isRect ? `
      <div class="ce-ins-title">${selected.type === 'zone' ? 'COMBAT ZONE' : 'TRIGGER'}</div>
      <label>LABEL<input id="ce-rect-label" value="${escapeHtml(ent.label || '')}"></label>
      <label>WIDTH<input id="ce-rect-width" type="number" step="0.5" value="${fmt(Math.abs((Number(ent.x1) || 0) - (Number(ent.x0) || 0)))}"></label>
      <label>DEPTH<input id="ce-rect-depth" type="number" step="0.5" value="${fmt(Math.abs((Number(ent.z1) || 0) - (Number(ent.z0) || 0)))}"></label>
      ${selected.type === 'zone' ? `<label>INTENSITY<select id="ce-zone-intensity">${optionsHtml(['balanced', 'hold', 'push', 'flank', 'sniper'], ent.intensity || 'balanced')}</select></label>` : `<label>TARGET IDS<input id="ce-trigger-targets" value="${escapeHtml((ent.targetIds || []).join(', '))}" placeholder="enemy_1, patrol_1"></label>`}
      <label>ACTIVATION<select id="ce-rect-activation">${optionsHtml(selected.type === 'zone' ? ['zone_start', 'on_trigger', 'on_enter'] : ['on_enter', 'on_clear', 'on_interact'], ent.activation || (selected.type === 'zone' ? 'zone_start' : 'on_enter'))}</select></label>
    ` : '';
    const tacticalPointControls = isTacticalPoint ? `
      <label>LABEL<input id="ce-point-label" value="${escapeHtml(ent.label || '')}"></label>
      ${selected.type === 'peek' || selected.type === 'sniper' ? `<label>RANGE<input id="ce-point-range" type="number" min="1" step="0.5" value="${fmt(ent.range || (selected.type === 'sniper' ? 22 : 11))}"></label>` : ''}
      ${selected.type === 'peek' || selected.type === 'sniper' ? `<label>ARC DEG<input id="ce-point-arc" type="number" min="8" max="160" step="1" value="${Math.round(ent.arcDegrees || (selected.type === 'sniper' ? 42 : 70))}"></label>` : ''}
      ${selected.type === 'hold' || selected.type === 'cover' || selected.type === 'breach' ? `<label>RADIUS<input id="ce-point-radius" type="number" min="0.25" step="0.1" value="${Number(ent.radius || 1.2).toFixed(1)}"></label>` : ''}
    ` : '';
    inspector.innerHTML = `<div class="ce-ins-title">${selected.type.toUpperCase()}</div>
      <label>ID<input id="ce-ent-id" value="${ent.id || ''}" disabled></label>
      <label>X<input id="ce-ent-x" type="number" step="0.5" value="${fmt(pos.x)}"></label>
      <label>Z<input id="ce-ent-z" type="number" step="0.5" value="${fmt(pos.z)}"></label>
      <label>YAW<input id="ce-ent-yaw" type="number" step="15" value="${yawDeg}"${yawDisabled ? ' disabled' : ''}></label>
      ${selected.type === 'object' ? `<label>PREFAB<input value="${ent.prefabId}" disabled></label>` : ''}
      ${selected.type === 'object' ? `<label>SCALE<input id="ce-ent-scale" type="number" min="0.25" max="4" step="0.05" value="${Number(ent.scale || 1).toFixed(2)}"></label>` : ''}
      ${isOpenableDoor ? `<label>OPENED BY<select id="ce-door-access">${[
        ['player', 'PLAYER'],
        ['enemies', 'ENEMIES'],
        ['both', 'PLAYER + ENEMIES'],
        ['locked', 'LOCKED'],
      ].map(([value, label]) => `<option value="${value}"${doorAccess === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}
      ${selected.type === 'door' ? `
        <label>ZONE<select id="ce-door-zone">${[0,1,2].map((x) => `<option value="${x}"${Number(ent.zoneId) === x ? ' selected' : ''}>ZONE ${x + 1}</option>`).join('')}</select></label>
        <label>WIDTH<input id="ce-door-width" type="number" step="0.5" value="${fmt(ent.width || 5.4)}"></label>
        <label>DEPTH<input id="ce-door-depth" type="number" step="0.1" value="${fmt(ent.depth || 0.62)}"></label>
      ` : ''}
      ${selected.type === 'exit' ? `
        <label>WIDTH<input id="ce-exit-width" type="number" step="0.5" value="${fmt(Math.abs((Number(ent.x1) || 0) - (Number(ent.x0) || 0)) || 4)}"></label>
        <label>DEPTH<input id="ce-exit-depth" type="number" step="0.5" value="${fmt(Math.abs((Number(ent.z1) || 0) - (Number(ent.z0) || 0)) || 3)}"></label>
      ` : ''}
      ${selected.type === 'pickup' ? `
        <label>TYPE<select id="ce-pickup-type">${['ammo','med'].map((x) => `<option value="${x}"${ent.type === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      ` : ''}
      ${isEnemy ? `
        <label>TYPE<select id="ce-enemy-type">${optionsHtml(ENEMY_TYPES, ent.enemyType)}</select></label>
        <label>ROLE<select id="ce-enemy-role">${optionsHtml(ENEMY_ROLES, ent.role)}</select></label>
        <label>BEHAVIOR<select id="ce-enemy-behavior">${optionsHtml(ENEMY_BEHAVIORS, ent.behavior)}</select></label>
        <label>WAVE<input id="ce-enemy-wave" value="${escapeHtml(ent.spawnWave || 'initial')}"></label>
        <label>ACTIVATION<select id="ce-enemy-activation">${optionsHtml(['zone_start', 'on_trigger', 'reinforcement', 'manual'], ent.activation || 'zone_start')}</select></label>
        ${behaviorTuningPanelHtml(ent)}
      ` : ''}
      ${tacticalPointControls}
      ${routeControls}
      ${rectControls}
      ${enemyLinks}
      ${objectAssetControls}
      ${enemyAssetControls}
      ${selected.type !== 'spawn' ? '<button class="menu-cta ce-small" id="ce-duplicate">DUPLICATE</button><button class="menu-cta ce-small ce-danger" id="ce-delete">DELETE</button>' : '<div class="ce-ins-hint">Move the spawn marker instead of deleting it.</div>'}`;
    const commit = (changedEl = null) => {
      saveHistory();
      const nextX = snapGrid(Number(inspector.querySelector('#ce-ent-x').value) || 0);
      const nextZ = snapGrid(Number(inspector.querySelector('#ce-ent-z').value) || 0);
      setEntityPosition(selected.type, ent, nextX, nextZ);
      setEntityYaw(selected.type, ent, ((Number(inspector.querySelector('#ce-ent-yaw').value) || 0) * Math.PI) / 180);
      if (selected.type === 'object') ent.scale = clamp(Number(inspector.querySelector('#ce-ent-scale').value) || 1, 0.25, 4);
      if (selected.type === 'object') {
        setOptionalProfileId(ent, 'modelProfileId', inspector.querySelector('#ce-object-model-profile')?.value);
        setOptionalProfileId(ent, 'animationProfileId', inspector.querySelector('#ce-object-animation-profile')?.value);
        setOptionalProfileId(ent, 'weaponProfileId', inspector.querySelector('#ce-object-weapon-profile')?.value);
        setOptionalProfileId(ent, 'importedAssetId', inspector.querySelector('#ce-object-imported-asset')?.value);
      }
      if (isOpenableDoor) ent.doorAccess = normalizeDoorAccess(inspector.querySelector('#ce-door-access').value, 'player') || 'player';
      if (isEnemy) {
        ent.enemyType = inspector.querySelector('#ce-enemy-type').value;
        ent.role = inspector.querySelector('#ce-enemy-role').value;
        ent.behavior = inspector.querySelector('#ce-enemy-behavior').value;
        ent.spawnWave = inspector.querySelector('#ce-enemy-wave')?.value || 'initial';
        ent.activation = inspector.querySelector('#ce-enemy-activation')?.value || 'zone_start';
        ent.behaviorTuning = normalizeBehaviorTuning({
          aggressiveness: (Number(inspector.querySelector('#ce-tune-agg')?.value) || 50) / 100,
          peekBias: (Number(inspector.querySelector('#ce-tune-peek')?.value) || 50) / 100,
          holdBias: (Number(inspector.querySelector('#ce-tune-hold')?.value) || 50) / 100,
          reactDelay: (Number(inspector.querySelector('#ce-tune-delay')?.value) || 0) / 10,
        });
        setEnemyLink(ent, 'peekAngleId', inspector.querySelector('#ce-link-peek')?.value);
        setEnemyLink(ent, 'holdPositionId', inspector.querySelector('#ce-link-hold')?.value);
        setEnemyLink(ent, 'coverHintId', inspector.querySelector('#ce-link-cover')?.value);
        setEnemyLink(ent, 'patrolRouteId', inspector.querySelector('#ce-link-patrol')?.value);
        setEnemyLink(ent, 'flankRouteId', inspector.querySelector('#ce-link-flank')?.value);
        setEnemyLink(ent, 'triggerVolumeId', inspector.querySelector('#ce-link-trigger')?.value);
        setEnemyLink(ent, 'combatZoneId', inspector.querySelector('#ce-link-zone')?.value);
        setOptionalProfileId(ent, 'enemyAnimationProfileId', inspector.querySelector('#ce-enemy-visual-profile')?.value);
        setOptionalProfileId(ent, 'enemyModelProfileId', inspector.querySelector('#ce-enemy-model-profile')?.value);
        setOptionalProfileId(ent, 'animationProfileId', inspector.querySelector('#ce-enemy-animation-profile')?.value);
        setOptionalProfileId(ent, 'weaponProfileId', inspector.querySelector('#ce-enemy-weapon-profile')?.value);
        setOptionalProfileId(ent, 'importedAssetId', inspector.querySelector('#ce-enemy-imported-asset')?.value);
      }
      if (isTacticalPoint) {
        ent.label = inspector.querySelector('#ce-point-label')?.value || ent.label || selected.type.toUpperCase();
        if (inspector.querySelector('#ce-point-range')) ent.range = Math.max(1, Number(inspector.querySelector('#ce-point-range').value) || ent.range || 8);
        if (inspector.querySelector('#ce-point-arc')) ent.arcDegrees = Math.max(8, Math.min(160, Number(inspector.querySelector('#ce-point-arc').value) || ent.arcDegrees || 70));
        if (inspector.querySelector('#ce-point-radius')) ent.radius = Math.max(0.25, Number(inspector.querySelector('#ce-point-radius').value) || ent.radius || 1.2);
      }
      if (isRoute) {
        ent.label = inspector.querySelector('#ce-route-label')?.value || ent.label || selected.type.toUpperCase();
        if (selected.type === 'patrol') {
          ent.loop = inspector.querySelector('#ce-route-loop')?.value !== 'false';
          ent.pauseSeconds = Math.max(0, Number(inspector.querySelector('#ce-route-pause')?.value) || 0);
          ent.alertBehavior = inspector.querySelector('#ce-route-alert')?.value || 'patrol_then_alarm';
        } else {
          ent.activation = inspector.querySelector('#ce-route-activation')?.value || 'after_contact';
        }
        ent.speed = clamp(Number(inspector.querySelector('#ce-route-speed')?.value) || 1, 0.25, 3);
        ent.assignedEnemyIds = String(inspector.querySelector('#ce-route-assigned')?.value || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      }
      if (isRect) {
        ent.label = inspector.querySelector('#ce-rect-label')?.value || ent.label || selected.type.toUpperCase();
        const width = Math.max(0.5, Number(inspector.querySelector('#ce-rect-width')?.value) || Math.abs((Number(ent.x1) || 0) - (Number(ent.x0) || 0)) || 4);
        const depth = Math.max(0.5, Number(inspector.querySelector('#ce-rect-depth')?.value) || Math.abs((Number(ent.z1) || 0) - (Number(ent.z0) || 0)) || 4);
        const center = entityPosition(selected.type, ent);
        ent.x0 = center.x - width / 2;
        ent.x1 = center.x + width / 2;
        ent.z0 = center.z - depth / 2;
        ent.z1 = center.z + depth / 2;
        ent.activation = inspector.querySelector('#ce-rect-activation')?.value || ent.activation || 'on_enter';
        if (selected.type === 'zone') ent.intensity = inspector.querySelector('#ce-zone-intensity')?.value || 'balanced';
        if (selected.type === 'trigger') {
          ent.targetIds = String(inspector.querySelector('#ce-trigger-targets')?.value || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
        }
      }
      if (selected.type === 'door') {
        ent.zoneId = Number(inspector.querySelector('#ce-door-zone').value) || 0;
        ent.width = Math.max(1, Number(inspector.querySelector('#ce-door-width').value) || 5.4);
        ent.depth = Math.max(0.2, Number(inspector.querySelector('#ce-door-depth').value) || 0.62);
      }
      if (selected.type === 'exit') {
        const width = Math.max(1, Number(inspector.querySelector('#ce-exit-width').value) || 4);
        const depth = Math.max(1, Number(inspector.querySelector('#ce-exit-depth').value) || 3);
        const center = entityPosition('exit', ent);
        ent.x0 = center.x - width / 2;
        ent.x1 = center.x + width / 2;
        ent.z0 = center.z - depth / 2;
        ent.z1 = center.z + depth / 2;
      }
      if (selected.type === 'pickup') ent.type = inspector.querySelector('#ce-pickup-type').value;
      scheduleAutosave();
      renderViewport();
      if (changedEl && /profile|asset/i.test(changedEl.id || '')) renderInspector();
    };
    inspector.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', () => commit(el)));
    if (isEnemy) {
      wireBehaviorTuningInputs(ent, () => commit());
      inspector.querySelector('#ce-enemy-behavior')?.addEventListener('change', () => {
        const meta = behaviorMeta(inspector.querySelector('#ce-enemy-behavior').value);
        ent.role = meta.role || ent.role;
        ent.behaviorTuning = normalizeBehaviorTuning(meta.tuning);
        renderInspector();
        commit();
      });
    }
    inspector.querySelector('#ce-delete')?.addEventListener('click', deleteSelected);
    inspector.querySelector('#ce-duplicate')?.addEventListener('click', duplicateSelected);
  }

  function focusWorkflowStep(stepId) {
    const step = workflowProgress(map, { validationOk: lastValidationOk }).find((s) => s.id === stepId);
    if (!step) return;
    activeWorkflowStepId = stepId;
    const tool = step.tools && step.tools[0];
    if (tool) {
      activeTool = tool;
      if (tool !== 'place') activePrefabId = null;
    }
    renderAll();
    setStatus(step.short, 'ok');
  }

  function renderGuidePanel() {
    if (!guidePanel) return;
    const steps = workflowProgress(map, { validationOk: lastValidationOk });
    guidePanel.innerHTML = `
      <div class="ce-guide-head">WORKFLOW</div>
      <div class="ce-guide-steps">
        ${steps.map((step) => `
          <button type="button" class="ce-guide-step ${step.id === activeWorkflowStepId ? 'active' : ''} ${step.complete ? 'done' : ''}" data-step="${step.id}">
            <span class="ce-guide-step-num">${step.complete ? '✓' : step.title.split('·')[0].trim()}</span>
            <span class="ce-guide-step-body">
              <span class="ce-guide-step-title">${escapeHtml(step.title)}</span>
              <span class="ce-guide-step-short">${escapeHtml(step.short)}</span>
            </span>
            <span class="ce-guide-step-state">${step.complete ? 'DONE' : 'NEXT'}</span>
          </button>
        `).join('')}
      </div>
    `;
    guidePanel.querySelectorAll('.ce-guide-step').forEach((button) => {
      button.addEventListener('click', () => focusWorkflowStep(button.dataset.step || 'layout'));
    });
  }

  function renderBehaviorPanel() {
    if (!behaviorPanel) return;
    behaviorPanel.innerHTML = `
      <div class="ce-behavior-head">ENEMY BEHAVIOR SEQUENCES</div>
      <div class="ce-behavior-grid">
        ${ENEMY_BEHAVIOR_SEQUENCES.map((seq) => `
          <button type="button" class="ce-behavior-seq ${pendingBehaviorSequenceId === seq.id ? 'active' : ''}" data-seq="${seq.id}" title="${escapeHtml(seq.summary)}">
            <b>${escapeHtml(seq.label)}</b>
            <small>${escapeHtml(seq.summary)}</small>
          </button>
        `).join('')}
      </div>
    `;
    behaviorPanel.querySelectorAll('.ce-behavior-seq').forEach((button) => {
      button.addEventListener('click', () => {
        const seqId = button.dataset.seq;
        pendingBehaviorSequenceId = seqId;
        activeTool = 'enemy';
        activePrefabId = null;
        activeWorkflowStepId = 'enemies';
        const ent = selected && selected.type === 'enemy' ? selectedEntity() : null;
        if (ent) {
          saveHistory();
          applyBehaviorSequenceToSpawn(ent, map, seqId);
          scheduleAutosave();
          renderInspector();
          renderViewport();
          setStatus(`Applied “${ENEMY_BEHAVIOR_SEQUENCES.find((s) => s.id === seqId)?.label || seqId}” to selected enemy.`, 'ok');
        } else {
          setStatus(`Armed “${ENEMY_BEHAVIOR_SEQUENCES.find((s) => s.id === seqId)?.label || seqId}” — click the canvas to place enemies.`, 'ok');
        }
        renderBehaviorPanel();
        renderToolbar();
        renderToolHint();
      });
    });
  }

  function renderToolHint() {
    if (!toolHint) return;
    const hint = EDITOR_TOOL_HINTS[activeTool] || 'Select a tool to see what it does.';
    const seq = ENEMY_BEHAVIOR_SEQUENCES.find((s) => s.id === pendingBehaviorSequenceId);
    const armed = activeTool === 'enemy' && seq
      ? `<br><span style="color:rgba(255,208,96,.9)">ARMED: ${escapeHtml(seq.label)}</span>`
      : '';
    toolHint.innerHTML = `<b>${escapeHtml((TOOL_LABELS[activeTool] || activeTool).toUpperCase())}</b> — ${escapeHtml(hint)}${armed}`;
  }

  function behaviorTuningPanelHtml(ent) {
    const tuning = normalizeBehaviorTuning(ent.behaviorTuning);
    const meta = behaviorMeta(ent.behavior);
    return `
      <div class="ce-ins-title">BEHAVIOR TUNING</div>
      <div class="ce-behavior-desc">${escapeHtml(meta.summary)}</div>
      <div class="ce-tuning-grid">
        <label>AGGRESSIVENESS <span class="ce-tuning-val" id="ce-tune-agg-val">${Math.round(tuning.aggressiveness * 100)}%</span>
          <input id="ce-tune-agg" type="range" min="0" max="100" step="5" value="${Math.round(tuning.aggressiveness * 100)}">
        </label>
        <label>PEEK BIAS <span class="ce-tuning-val" id="ce-tune-peek-val">${Math.round(tuning.peekBias * 100)}%</span>
          <input id="ce-tune-peek" type="range" min="0" max="100" step="5" value="${Math.round(tuning.peekBias * 100)}">
        </label>
        <label>HOLD BIAS <span class="ce-tuning-val" id="ce-tune-hold-val">${Math.round(tuning.holdBias * 100)}%</span>
          <input id="ce-tune-hold" type="range" min="0" max="100" step="5" value="${Math.round(tuning.holdBias * 100)}">
        </label>
        <label>REACT DELAY <span class="ce-tuning-val" id="ce-tune-delay-val">${tuning.reactDelay.toFixed(1)}s</span>
          <input id="ce-tune-delay" type="range" min="0" max="80" step="5" value="${Math.round(tuning.reactDelay * 10)}">
        </label>
      </div>
      <div class="ce-wave-presets">
        ${['initial', 'zone_2', 'reinforcement', 'boss'].map((wave) => `
          <button type="button" class="ce-wave-chip ${(ent.spawnWave || 'initial') === wave ? 'active' : ''}" data-wave="${wave}">${wave.replace('_', ' ')}</button>
        `).join('')}
      </div>
    `;
  }

  function wireBehaviorTuningInputs(ent, commit) {
    const sync = () => {
      const agg = document.getElementById('ce-tune-agg-val');
      const peek = document.getElementById('ce-tune-peek-val');
      const hold = document.getElementById('ce-tune-hold-val');
      const delay = document.getElementById('ce-tune-delay-val');
      if (agg) agg.textContent = `${document.getElementById('ce-tune-agg')?.value || 50}%`;
      if (peek) peek.textContent = `${document.getElementById('ce-tune-peek')?.value || 50}%`;
      if (hold) hold.textContent = `${document.getElementById('ce-tune-hold')?.value || 50}%`;
      if (delay) delay.textContent = `${((Number(document.getElementById('ce-tune-delay')?.value) || 0) / 10).toFixed(1)}s`;
    };
    ['ce-tune-agg', 'ce-tune-peek', 'ce-tune-hold', 'ce-tune-delay'].forEach((id) => {
      inspector.querySelector(`#${id}`)?.addEventListener('input', sync);
    });
    inspector.querySelectorAll('.ce-wave-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        ent.spawnWave = chip.dataset.wave || 'initial';
        inspector.querySelector('#ce-enemy-wave').value = ent.spawnWave;
        inspector.querySelectorAll('.ce-wave-chip').forEach((c) => c.classList.toggle('active', c.dataset.wave === ent.spawnWave));
        commit();
      });
    });
  }

  function renderToolbar() {
    document.querySelectorAll('.ce-tool').forEach((button) => {
      button.classList.toggle('active', button.dataset.tool === activeTool);
    });
    document.querySelectorAll('.ce-view').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === viewMode);
    });
    document.getElementById('ce-analyze')?.classList.toggle('active', analysis.enabled);
    if (canvas) canvas.dataset.tool = activeTool;
  }

  function updateEmptyBanner() {
    if (!emptyBanner) return;
    const show = !!(root && root.classList.contains('show') && isEditorMapEmpty(map));
    emptyBanner.hidden = !show;
  }

  function frameMapOverview() {
    if (!map) return;
    const spawn = map.markers?.playerSpawn;
    if (spawn) {
      view.targetX = Number(spawn.x) || 0;
      view.targetZ = Number(spawn.z) || 0;
      view.zoom = 1.15;
      return;
    }
    view.targetX = ((Number(map.bounds.x0) || 0) + (Number(map.bounds.x1) || 0)) / 2;
    view.targetZ = ((Number(map.bounds.z0) || 0) + (Number(map.bounds.z1) || 0)) / 2;
    view.zoom = 1;
  }

  function clearMap() {
    if (!pack || !map) return;
    if (!window.confirm('Clear all placed geometry and gameplay markers? Spawn and exits reset to defaults.')) return;
    saveHistory();
    const nextTitle = (title && title.value.trim()) || map.title || pack.title || 'New Custom Map';
    map = createDefaultCustomMap({ title: nextTitle });
    pack.maps[mapIndex] = map;
    pack.title = nextTitle;
    selected = null;
    activeDraw = null;
    clipboard = null;
    placementYaw = 0;
    analysis = { enabled: false, result: map.validation || null, at: 0 };
    frameMapOverview();
    scheduleAutosave();
    setStatus('Map cleared.', 'ok');
    renderAll();
  }

  function updateHud() {
    if (!hud || !map) return;
    const pos = hoverWorld ? (activePrefabId && activeTool !== 'select' && activeTool !== 'pan'
      ? snapPlacement(activePrefabId, hoverWorld, { yaw: placementYaw })
      : isPlacementTool(activeTool) ? snapTacticalPlacement(activeTool, hoverWorld) : snapPlacement(null, hoverWorld, { yaw: placementYaw })) : null;
    const ent = selectedEntity();
    const selectedLabel = selected && ent ? selected.type.toUpperCase() : 'NONE';
    const prefabLabel = activeDraw ? `${TOOL_LABELS[activeDraw.type] || activeDraw.type} ${(activeDraw.points || []).length || ''}`.trim() : activePrefabId ? (prefab(activePrefabId)?.label || activePrefabId) : (TOOL_LABELS[activeTool] || activeTool.toUpperCase());
    hud.innerHTML = `
      <span>TOOL <b>${prefabLabel}</b></span>
      <span>VIEW <b>${viewMode.toUpperCase()}</b></span>
      <span>SNAP <b>${lastSnapHint}</b></span>
      <span>POS <b>${pos ? `${fmt(pos.x)}, ${fmt(pos.z)}` : '--'}</b></span>
      <span>SELECTED <b>${selectedLabel}</b></span>
    `;
  }

  function renderAll() {
    renderToolbar();
    renderTabs();
    renderPalette();
    renderGuidePanel();
    renderBehaviorPanel();
    renderToolHint();
    renderInspector();
    renderAnalysisPanel();
    renderViewport();
    updateHud();
    updateEmptyBanner();
  }

  function hitTest(world) {
    if (!map || !world) return null;
    if (layers.enemies) {
      for (const e of map.markers.enemySpawns || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.9) return { type: 'enemy', id: e.id };
    }
    if (layers.flow) {
      for (const e of map.markers.peekAngles || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.9) return { type: 'peek', id: e.id };
      for (const e of map.markers.holdPositions || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.9) return { type: 'hold', id: e.id };
      for (const e of map.markers.coverHints || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.9) return { type: 'cover', id: e.id };
      for (const e of map.markers.breachPoints || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.9) return { type: 'breach', id: e.id };
      for (const e of map.markers.sniperPerches || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.9) return { type: 'sniper', id: e.id };
      for (const route of map.markers.patrolRoutes || []) {
        for (const point of route.points || []) if (Math.hypot((Number(point.x) || 0) - world.x, (Number(point.z) || 0) - world.z) < 0.75) return { type: 'patrol', id: route.id };
      }
      for (const route of map.markers.flankRoutes || []) {
        for (const point of route.points || []) if (Math.hypot((Number(point.x) || 0) - world.x, (Number(point.z) || 0) - world.z) < 0.75) return { type: 'flank', id: route.id };
      }
      for (const zone of map.markers.combatZones || []) {
        if (world.x >= zone.x0 && world.x <= zone.x1 && world.z >= zone.z0 && world.z <= zone.z1) return { type: 'zone', id: zone.id };
      }
      for (const trigger of map.markers.triggerVolumes || []) {
        if (world.x >= trigger.x0 && world.x <= trigger.x1 && world.z >= trigger.z0 && world.z <= trigger.z1) return { type: 'trigger', id: trigger.id };
      }
    }
    if (layers.gameplay && map.markers.playerSpawn && Math.hypot(map.markers.playerSpawn.x - world.x, map.markers.playerSpawn.z - world.z) < 0.9) {
      return { type: 'spawn', id: map.markers.playerSpawn.id };
    }
    if (layers.gameplay) {
      for (const e of map.markers.pickups || []) if (Math.hypot(e.x - world.x, e.z - world.z) < 0.75) return { type: 'pickup', id: e.id };
      for (const d of map.markers.zoneDoors || []) {
        const box = { x0: d.x - (d.width || 5.4) / 2, x1: d.x + (d.width || 5.4) / 2, z0: d.z - (d.depth || 0.62) / 2, z1: d.z + (d.depth || 0.62) / 2 };
        if (world.x >= box.x0 && world.x <= box.x1 && world.z >= box.z0 && world.z <= box.z1) return { type: 'door', id: d.id };
      }
      for (const ex of map.markers.exits || []) {
        if (world.x >= ex.x0 && world.x <= ex.x1 && world.z >= ex.z0 && world.z <= ex.z1) return { type: 'exit', id: ex.id || 'exit_main' };
      }
    }
    if (!layers.geometry) return null;
    for (let i = map.objects.length - 1; i >= 0; i--) {
      const obj = map.objects[i];
      const pf = prefab(obj.prefabId);
      if (!pf) continue;
      for (const part of pf.parts || []) {
        const box = partWorldAabb(part, obj, map.floorY, pf);
        if (world.x >= box.x0 && world.x <= box.x1 && world.z >= box.z0 && world.z <= box.z1) return { type: 'object', id: obj.id };
      }
    }
    return null;
  }

  function normalizeYawForKey(yaw) {
    const twoPi = Math.PI * 2;
    return (((Number(yaw) || 0) % twoPi) + twoPi) % twoPi;
  }

  function placementKey(kind, id, pos, yaw) {
    if (!pos) return '';
    return [
      kind || 'place',
      id || '',
      Math.round((Number(pos.x) || 0) * 1000),
      Math.round((Number(pos.z) || 0) * 1000),
      Math.round(normalizeYawForKey(yaw) * 1000),
    ].join(':');
  }

  function hasExistingObjectStamp(prefabId, pos, yaw) {
    if (!prefabId || !pos || !map) return false;
    const key = placementKey('object', prefabId, pos, yaw);
    return (map.objects || []).some((obj) => obj && obj.prefabId === prefabId && placementKey('object', obj.prefabId, obj, obj.yaw || 0) === key);
  }

  function placeAt(world, options = {}) {
    if (!world || !map) return;
    if (!SINGLE_TACTICAL_TOOLS.includes(activeTool) && !activePrefabId) return;
    ensureMarkerArrays();
    const pos = activePrefabId ? snapPlacement(activePrefabId || null, world, { yaw: placementYaw }) : snapTacticalPlacement(activeTool, world);
    const yaw = Number.isFinite(pos.yaw) ? pos.yaw : placementYaw;
    const kind = activePrefabId ? 'object' : activeTool;
    const key = placementKey(kind, activePrefabId || activeTool, pos, yaw);
    if (options.skipKeys && options.skipKeys.has(key)) return null;
    if (options.skipExisting && activePrefabId && hasExistingObjectStamp(activePrefabId, pos, yaw)) return null;
    if (options.saveHistory !== false) saveHistory();
    let placed = null;
    if (activeTool === 'enemy') {
      const marker = createEnemySpawn(pos.x, pos.z, { yaw, zoneId: zoneForZ(pos.z) });
      if (pendingBehaviorSequenceId) {
        applyBehaviorSequenceToSpawn(marker, map, pendingBehaviorSequenceId);
      }
      map.markers.enemySpawns.push(marker);
      selected = { type: 'enemy', id: marker.id };
      placed = selected;
      activeWorkflowStepId = 'enemies';
    } else if (activeTool === 'peek') {
      const marker = createPeekAngle(pos.x, pos.z, { yaw });
      map.markers.peekAngles.push(marker);
      selected = { type: 'peek', id: marker.id };
      placed = selected;
    } else if (activeTool === 'hold') {
      const marker = createHoldPosition(pos.x, pos.z, { yaw });
      map.markers.holdPositions.push(marker);
      selected = { type: 'hold', id: marker.id };
      placed = selected;
    } else if (activeTool === 'cover') {
      const marker = createCoverHint(pos.x, pos.z, { yaw });
      map.markers.coverHints.push(marker);
      selected = { type: 'cover', id: marker.id };
      placed = selected;
    } else if (activeTool === 'breach') {
      const marker = createBreachPoint(pos.x, pos.z, { yaw });
      map.markers.breachPoints.push(marker);
      selected = { type: 'breach', id: marker.id };
      placed = selected;
    } else if (activeTool === 'sniper') {
      const marker = createSniperPerch(pos.x, pos.z, { yaw });
      map.markers.sniperPerches.push(marker);
      selected = { type: 'sniper', id: marker.id };
      placed = selected;
    } else if (activeTool === 'spawn') {
      const bounded = clampToPlayableBounds(pos.x, pos.z);
      map.markers.playerSpawn = Object.assign({}, map.markers.playerSpawn || {}, { id: 'player_spawn', x: bounded.x, z: bounded.z, yaw, floorY: map.floorY });
      selected = { type: 'spawn', id: 'player_spawn' };
      placed = selected;
    } else if (activeTool === 'exit') {
      const marker = { id: customMarkerId('exit'), x0: pos.x - 2, x1: pos.x + 2, z0: pos.z - 1.5, z1: pos.z + 1.5, label: 'EXTRACT' };
      map.markers.exits = map.markers.exits || [];
      map.markers.exits.push(marker);
      selected = { type: 'exit', id: marker.id };
      placed = selected;
    } else if (activeTool === 'door') {
      const marker = { id: customMarkerId('zone_gate'), zoneId: zoneForZ(pos.z), x: pos.x, z: pos.z, width: 5.4, depth: 0.62, yaw };
      map.markers.zoneDoors = map.markers.zoneDoors || [];
      map.markers.zoneDoors.push(marker);
      selected = { type: 'door', id: marker.id };
      placed = selected;
    } else if (activeTool === 'pickup') {
      const marker = { id: customMarkerId('pickup'), x: pos.x, z: pos.z, yaw, type: placementPickupType || 'ammo' };
      map.markers.pickups = map.markers.pickups || [];
      map.markers.pickups.push(marker);
      selected = { type: 'pickup', id: marker.id };
      placed = selected;
    } else if (activePrefabId) {
      const obj = createPlacedObject(activePrefabId, pos.x, pos.z, { yaw });
      map.objects.push(obj);
      selected = { type: 'object', id: obj.id };
      placed = selected;
    }
    scheduleAutosave();
    if (options.render === 'paint') {
      renderViewport();
      renderInspector();
      renderAnalysisPanel();
      updateHud();
    } else {
      renderAll();
    }
    return placed ? { ...placed, key, x: pos.x, z: pos.z, yaw } : null;
  }

  function rectFromPoints(a, b) {
    return {
      x0: Math.min(a.x, b.x),
      x1: Math.max(a.x, b.x),
      z0: Math.min(a.z, b.z),
      z1: Math.max(a.z, b.z),
    };
  }

  function finishActiveDraw() {
    if (!activeDraw || !map) return false;
    ensureMarkerArrays();
    const draw = activeDraw;
    activeDraw = null;
    let marker = null;
    if (draw.type === 'patrol') {
      if ((draw.points || []).length < 2) {
        setStatus('Patrol needs at least two waypoints.', 'bad');
        renderViewport();
        return false;
      }
      marker = createPatrolRoute(draw.points, { label: 'PATROL' });
      map.markers.patrolRoutes.push(marker);
      selected = { type: 'patrol', id: marker.id };
    } else if (draw.type === 'flank') {
      if ((draw.points || []).length < 2) {
        setStatus('Flank route needs at least two waypoints.', 'bad');
        renderViewport();
        return false;
      }
      marker = createFlankRoute(draw.points, { label: 'FLANK' });
      map.markers.flankRoutes.push(marker);
      selected = { type: 'flank', id: marker.id };
    } else if (draw.type === 'zone') {
      if (!draw.rect) return false;
      marker = createCombatZone(draw.rect.x0, draw.rect.z0, draw.rect.x1, draw.rect.z1, { label: 'COMBAT ZONE', zoneId: zoneForZ((draw.rect.z0 + draw.rect.z1) / 2) });
      map.markers.combatZones.push(marker);
      selected = { type: 'zone', id: marker.id };
    } else if (draw.type === 'trigger') {
      if (!draw.rect) return false;
      marker = createTriggerVolume(draw.rect.x0, draw.rect.z0, draw.rect.x1, draw.rect.z1, { label: 'TRIGGER' });
      map.markers.triggerVolumes.push(marker);
      selected = { type: 'trigger', id: marker.id };
    }
    if (!marker) return false;
    scheduleAutosave();
    renderAll();
    setStatus(`${TOOL_LABELS[draw.type] || draw.type} created.`, 'ok');
    return true;
  }

  function cancelActiveDraw() {
    if (!activeDraw) return false;
    activeDraw = null;
    setStatus('Placement cancelled.', '');
    renderViewport();
    return true;
  }

  function handleDrawClick(world) {
    if (!world || !isDrawTool(activeTool)) return false;
    const pos = snapTacticalPlacement(activeTool, world);
    if (!activeDraw || activeDraw.type !== activeTool) {
      saveHistory();
      activeDraw = { type: activeTool, points: [], start: null, rect: null };
    }
    if (activeTool === 'patrol' || activeTool === 'flank') {
      activeDraw.points.push({ x: pos.x, z: pos.z });
      setStatus(`${TOOL_LABELS[activeTool]} waypoint ${activeDraw.points.length}. Enter/double-click to finish.`, 'ok');
      renderViewport();
      return true;
    }
    if (!activeDraw.start) {
      activeDraw.start = { x: pos.x, z: pos.z };
      setStatus(`${TOOL_LABELS[activeTool]} start set. Click opposite corner.`, 'ok');
      renderViewport();
      return true;
    }
    activeDraw.rect = rectFromPoints(activeDraw.start, pos);
    finishActiveDraw();
    return true;
  }

  function canPaintObjects() {
    return activeTool === 'place' && !!activePrefabId;
  }

  function moveSelected(world) {
    const ent = selectedEntity();
    if (!ent || ent.locked || !world) return;
    const pos = selected && selected.type === 'object'
      ? snapPlacement(ent.prefabId, world, { excludeId: ent.id, yaw: ent.yaw || 0 })
      : snapPlacement(null, world);
    setEntityPosition(selected.type, ent, pos.x, pos.z);
    if (selected && selected.type === 'object' && Number.isFinite(pos.yaw)) ent.yaw = pos.yaw;
    scheduleAutosave();
    renderViewport();
    renderInspector();
    renderAnalysisPanel();
  }

  function deleteSelected() {
    if (!selected || !map) return;
    saveHistory();
    if (selected.type === 'object') map.objects = map.objects.filter((o) => o.id !== selected.id);
    if (selected.type === 'enemy') map.markers.enemySpawns = map.markers.enemySpawns.filter((o) => o.id !== selected.id);
    if (selected.type === 'peek') map.markers.peekAngles = map.markers.peekAngles.filter((o) => o.id !== selected.id);
    if (selected.type === 'hold') map.markers.holdPositions = map.markers.holdPositions.filter((o) => o.id !== selected.id);
    if (selected.type === 'patrol') map.markers.patrolRoutes = (map.markers.patrolRoutes || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'flank') map.markers.flankRoutes = (map.markers.flankRoutes || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'cover') map.markers.coverHints = (map.markers.coverHints || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'breach') map.markers.breachPoints = (map.markers.breachPoints || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'sniper') map.markers.sniperPerches = (map.markers.sniperPerches || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'trigger') map.markers.triggerVolumes = (map.markers.triggerVolumes || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'zone') map.markers.combatZones = (map.markers.combatZones || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'pickup') map.markers.pickups = (map.markers.pickups || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'door') map.markers.zoneDoors = (map.markers.zoneDoors || []).filter((o) => o.id !== selected.id);
    if (selected.type === 'exit') map.markers.exits = (map.markers.exits || []).filter((o) => (o.id || 'exit_main') !== selected.id);
    selected = null;
    scheduleAutosave();
    renderAll();
  }

  function duplicateSelected() {
    const ent = selectedEntity();
    if (!ent || !selected) return;
    saveHistory();
    const copy = cloneJson(ent);
    copy.id = `${ent.id}_copy_${Date.now().toString(36)}`;
    if (selected.type === 'exit') {
      copy.x0 += 1;
      copy.x1 += 1;
      copy.z0 += 1;
      copy.z1 += 1;
    } else if (selected.type === 'trigger' || selected.type === 'zone') {
      copy.x0 += 1;
      copy.x1 += 1;
      copy.z0 += 1;
      copy.z1 += 1;
    } else if (selected.type === 'patrol' || selected.type === 'flank') {
      copy.points = (copy.points || []).map((p) => ({ ...p, x: (Number(p.x) || 0) + 1, z: (Number(p.z) || 0) + 1 }));
    } else {
      copy.x += 1;
      copy.z += 1;
    }
    if (selected.type === 'object') map.objects.push(copy);
    if (selected.type === 'enemy') map.markers.enemySpawns.push(copy);
    if (selected.type === 'peek') map.markers.peekAngles.push(copy);
    if (selected.type === 'hold') map.markers.holdPositions.push(copy);
    if (selected.type === 'patrol') map.markers.patrolRoutes.push(copy);
    if (selected.type === 'flank') map.markers.flankRoutes.push(copy);
    if (selected.type === 'cover') map.markers.coverHints.push(copy);
    if (selected.type === 'breach') map.markers.breachPoints.push(copy);
    if (selected.type === 'sniper') map.markers.sniperPerches.push(copy);
    if (selected.type === 'trigger') map.markers.triggerVolumes.push(copy);
    if (selected.type === 'zone') map.markers.combatZones.push(copy);
    if (selected.type === 'pickup') {
      map.markers.pickups = map.markers.pickups || [];
      map.markers.pickups.push(copy);
    }
    if (selected.type === 'door') {
      map.markers.zoneDoors = map.markers.zoneDoors || [];
      map.markers.zoneDoors.push(copy);
    }
    if (selected.type === 'exit') {
      map.markers.exits = map.markers.exits || [];
      map.markers.exits.push(copy);
    }
    selected = { type: selected.type, id: copy.id };
    scheduleAutosave();
    renderAll();
  }

  function copySelected() {
    const ent = selectedEntity();
    if (!ent || !selected || selected.type === 'spawn') return;
    clipboard = { type: selected.type, entity: cloneJson(ent) };
    setStatus(`Copied ${selected.type}.`, 'ok');
  }

  function pasteClipboard() {
    if (!clipboard || !map) return;
    saveHistory();
    const copy = cloneJson(clipboard.entity);
    copy.id = `${copy.id || clipboard.type}_paste_${Date.now().toString(36)}`;
    if (clipboard.type === 'exit') {
      copy.x0 += gridSize;
      copy.x1 += gridSize;
      copy.z0 += gridSize;
      copy.z1 += gridSize;
    } else if (clipboard.type === 'trigger' || clipboard.type === 'zone') {
      copy.x0 += gridSize;
      copy.x1 += gridSize;
      copy.z0 += gridSize;
      copy.z1 += gridSize;
    } else if (clipboard.type === 'patrol' || clipboard.type === 'flank') {
      copy.points = (copy.points || []).map((p) => ({ ...p, x: snapGrid((Number(p.x) || 0) + gridSize), z: snapGrid((Number(p.z) || 0) + gridSize) }));
    } else {
      copy.x = snapGrid((Number(copy.x) || 0) + gridSize);
      copy.z = snapGrid((Number(copy.z) || 0) + gridSize);
    }
    if (clipboard.type === 'object') map.objects.push(copy);
    if (clipboard.type === 'enemy') map.markers.enemySpawns.push(copy);
    if (clipboard.type === 'peek') map.markers.peekAngles.push(copy);
    if (clipboard.type === 'hold') map.markers.holdPositions.push(copy);
    if (clipboard.type === 'patrol') map.markers.patrolRoutes.push(copy);
    if (clipboard.type === 'flank') map.markers.flankRoutes.push(copy);
    if (clipboard.type === 'cover') map.markers.coverHints.push(copy);
    if (clipboard.type === 'breach') map.markers.breachPoints.push(copy);
    if (clipboard.type === 'sniper') map.markers.sniperPerches.push(copy);
    if (clipboard.type === 'trigger') map.markers.triggerVolumes.push(copy);
    if (clipboard.type === 'zone') map.markers.combatZones.push(copy);
    if (clipboard.type === 'pickup') {
      map.markers.pickups = map.markers.pickups || [];
      map.markers.pickups.push(copy);
    }
    if (clipboard.type === 'door') {
      map.markers.zoneDoors = map.markers.zoneDoors || [];
      map.markers.zoneDoors.push(copy);
    }
    if (clipboard.type === 'exit') {
      map.markers.exits = map.markers.exits || [];
      map.markers.exits.push(copy);
    }
    selected = { type: clipboard.type, id: copy.id };
    scheduleAutosave();
    renderAll();
  }

  function nudgeSelected(dx, dz) {
    const ent = selectedEntity();
    if (!ent || !selected || ent.locked) return false;
    saveHistory();
    const pos = entityPosition(selected.type, ent);
    setEntityPosition(selected.type, ent, snapGrid(pos.x + dx), snapGrid(pos.z + dz));
    scheduleAutosave();
    renderAll();
    return true;
  }

  function existingPrefabId(candidates) {
    for (const id of candidates) {
      if (prefab(id)) return id;
    }
    return candidates[0];
  }

  function pushObject(prefabId, x, z, options = {}) {
    const id = existingPrefabId([prefabId, options.fallback || 'cover.half_crate']);
    if (!prefab(id)) return null;
    const obj = createPlacedObject(id, snapGrid(x), snapGrid(z), Object.assign({
      yaw: Number.isFinite(options.yaw) ? options.yaw : 0,
      layer: options.layer || 'geometry',
      label: options.label || '',
      locked: !!options.locked,
    }, options.object || {}));
    map.objects.push(obj);
    return obj;
  }

  function pushEnemy(id, x, z, options = {}) {
    const marker = createEnemySpawn(snapGrid(x), snapGrid(z), Object.assign({
      id: id || customMarkerId('enemy'),
      yaw: yawToward(x, z, 0, map?.markers?.playerSpawn?.z ?? 48),
      zoneId: zoneForZ(z),
      roomId: `zone_${zoneForZ(z) + 1}`,
    }, options));
    map.markers.enemySpawns.push(marker);
    return marker;
  }

  function pushPeek(id, x, z, options = {}) {
    const marker = createPeekAngle(snapGrid(x), snapGrid(z), Object.assign({
      id: id || customMarkerId('peek'),
      yaw: yawToward(x, z, 0, map?.markers?.playerSpawn?.z ?? 48),
    }, options));
    map.markers.peekAngles.push(marker);
    return marker;
  }

  function pushHold(id, x, z, options = {}) {
    const marker = createHoldPosition(snapGrid(x), snapGrid(z), Object.assign({
      id: id || customMarkerId('hold'),
      yaw: yawToward(x, z, 0, map?.markers?.playerSpawn?.z ?? 48),
    }, options));
    map.markers.holdPositions.push(marker);
    return marker;
  }

  function pushPickup(id, x, z, type = 'ammo') {
    const marker = { id: id || customMarkerId('pickup'), x: snapGrid(x), z: snapGrid(z), yaw: 0, type };
    map.markers.pickups = map.markers.pickups || [];
    map.markers.pickups.push(marker);
    return marker;
  }

  function defaultFloorObjects() {
    const out = [];
    let n = 0;
    const zRows = [42, 30, 18, 6, -6, -18, -30, -42];
    for (const z of zRows) {
      for (const x of [-6, 6]) {
        const useKillhouse = Math.abs(z) === 18 || z === -6;
        out.push(createPlacedObject(existingPrefabId([useKillhouse ? 'floor.killhouse_tile_8x8' : 'floor.loading_bay_12x12', 'floor.loading_bay_12x12']), x, z, {
          id: `smart_floor_${String(++n).padStart(2, '0')}`,
          yaw: 0,
          scale: useKillhouse ? 1.5 : 1,
          layer: 'geometry',
        }));
      }
    }
    return out;
  }

  function resetCoreMarkers() {
    map.markers = Object.assign({}, map.markers || {}, {
      playerSpawn: { id: 'player_spawn', x: 0, z: 49, yaw: Math.PI, floorY: map.floorY },
      exits: [{ id: 'exit_main', x0: -4.5, x1: 4.5, z0: -53.5, z1: -50.5, label: 'EXTRACT' }],
      zoneDoors: [
        { id: 'zone_gate_front_mid', zoneId: 0, x: 0, z: 18, width: 5.8, depth: 0.62, yaw: 0 },
        { id: 'zone_gate_mid_back', zoneId: 1, x: 0, z: -18, width: 5.8, depth: 0.62, yaw: 0 },
      ],
    });
    for (const key of ['enemySpawns', 'peekAngles', 'holdPositions', 'patrolRoutes', 'pickups', 'triggerVolumes', 'combatZones', 'flankRoutes', 'coverHints', 'breachPoints', 'sniperPerches']) {
      if (!Array.isArray(map.markers[key])) map.markers[key] = [];
    }
  }

  function seedSmartObjects() {
    map.objects = defaultFloorObjects();
    const routeYaw = Math.PI;
    [
      ['module.breach_room_two_cover', 0, 36, 0, 'breach_room'],
      ['module.ambush_crossfire', 0, 12, 0, 'front_crossfire'],
      ['module.cover_to_cover_push', 0, -5, 0, 'mid_push'],
      ['module.long_angle_sniper_lane', 0, -27, 0, 'rear_lane'],
      ['module.final_commit_gate', 0, -44, 0, 'final_gate'],
      ['module.control_room_final', 9, -40, 0, 'side_control_room'],
      ['module.overwatch_balcony_ground', -9, -31, 0, 'left_overwatch'],
      ['cover.ballistic_shield_wall', -8, 42, 0.15, 'spawn_shield'],
      ['cover.sandbag_corner', 8, 37, -0.2, 'front_sandbags'],
      ['cover.riot_barrier_pair', -8.5, 20, 0.1, 'front_gate_barrier'],
      ['cover.armored_server_bank', 8.5, 4, -0.25, 'mid_server_bank'],
      ['cover.breaching_cart', -7.5, -10, 0.25, 'mid_breach_cart'],
      ['cover.generator_block', 7.5, -22, -0.2, 'rear_generator'],
      ['cover.security_kiosk', -9, -43, 0.2, 'final_kiosk'],
      ['window.long_observation_8m', -12.2, -24, Math.PI / 2, 'rear_observation'],
      ['door.armored_checkpoint', -12, 18.2, 0, 'front_side_checkpoint'],
      ['door.blast_door_partial', 12, -18.2, 0, 'rear_side_checkpoint'],
      ['prop.tripod_light', -10.5, 33, 0.4, 'front_light'],
      ['prop.alarm_console', 9.8, -34, -0.4, 'alarm_console'],
      ['prop.evidence_table', -8, -36, 0.3, 'evidence_table'],
      ['route.stack_left', -2.2, 45, routeYaw, 'spawn_stack_left'],
      ['route.stack_right', 2.2, 45, routeYaw, 'spawn_stack_right'],
      ['route.danger_cross', 0, 18.5, routeYaw, 'front_danger_cross'],
      ['route.clear_room', 0, 35, routeYaw, 'breach_route_paint'],
      ['route.funnel_warning', 0, -18.5, routeYaw, 'rear_funnel_warning'],
      ['route.fallback_arrow', -2, -35, 0, 'fallback_route'],
    ].forEach(([prefabId, x, z, yaw, id]) => pushObject(prefabId, x, z, { yaw, layer: prefabId.startsWith('route.') ? 'gameplay' : 'geometry', object: { id: `smart_${id}` } }));
  }

  function applyTacticalRecipe() {
    resetCoreMarkers();
    map.markers.enemySpawns = [];
    map.markers.peekAngles = [];
    map.markers.holdPositions = [];
    map.markers.patrolRoutes = [];
    map.markers.pickups = [];
    map.markers.flankRoutes = [];
    map.markers.combatZones = [];
    map.markers.triggerVolumes = [];
    map.markers.coverHints = [];
    map.markers.breachPoints = [];
    map.markers.sniperPerches = [];
    pushHold('front_hold_left', -7.5, 37, { yaw: 2.9, radius: 1.3, label: 'FRONT HOLD L' });
    pushHold('front_hold_right', 7.5, 32, { yaw: 3.25, radius: 1.3, label: 'FRONT HOLD R' });
    pushHold('mid_hold_left', -7, -7, { yaw: 2.85, radius: 1.4, label: 'MID HOLD L' });
    pushHold('mid_hold_right', 7, 2, { yaw: 3.3, radius: 1.4, label: 'MID HOLD R' });
    pushHold('rear_hold_left', -8, -32, { yaw: 2.7, radius: 1.5, label: 'REAR HOLD L' });
    pushHold('rear_hold_right', 8, -38, { yaw: 3.4, radius: 1.5, label: 'REAR HOLD R' });
    pushPeek('front_breach_peek', -5.5, 35, { yaw: 2.9, range: 12, label: 'BREACH PEEK' });
    pushPeek('front_cross_peek', 5.7, 25, { yaw: 3.35, range: 12, label: 'CROSSFIRE PEEK' });
    pushPeek('mid_push_peek', -7.5, -6, { yaw: 2.95, range: 11, label: 'PUSH PEEK' });
    pushPeek('rear_sniper_lane', 8.5, -29, { yaw: 3.2, range: 16, arcDegrees: 45, label: 'SNIPER LANE' });
    pushPeek('final_gate_peek', -8.5, -43, { yaw: 2.75, range: 11, label: 'FINAL PEEK' });
    [
      ['front_lookout_01', -6.7, 39, 'scout', 'lookout', 'peek_from_cover', 0, 2.9, 'front_breach_peek'],
      ['front_anchor_02', 6.8, 33, 'soldier', 'anchor', 'hold_angle', 0, 3.2, null],
      ['front_flanker_03', 10.5, 24, 'pistolero', 'flanker', 'ambush_on_crossing', 0, 3.45, 'front_cross_peek'],
      ['front_heavy_04', -9.5, 23, 'riot', 'breacher', 'push_after_contact', 0, 2.8, null],
      ['mid_anchor_01', -7, 5, 'soldier', 'anchor', 'hold_angle', 1, 2.95, null],
      ['mid_flanker_02', 8.5, 6, 'pistolero', 'flanker', 'ambush_on_crossing', 1, 3.35, null],
      ['mid_push_03', 2, -12.5, 'heavy', 'breacher', 'push_after_contact', 1, Math.PI, 'mid_push_peek'],
      ['mid_lookout_04', -10.5, -12, 'scout', 'lookout', 'peek_from_cover', 1, 2.85, 'mid_push_peek'],
      ['mid_anchor_05', 8.5, -13, 'soldier', 'anchor', 'hold_angle', 1, 3.15, null],
      ['rear_marksman_01', 8.5, -29, 'marksman', 'marksman', 'hold_angle', 2, 3.25, 'rear_sniper_lane'],
      ['rear_anchor_02', -7.5, -31, 'soldier', 'anchor', 'hold_angle', 2, 2.9, null],
      ['rear_breacher_03', 0, -36, 'heavy', 'breacher', 'push_after_contact', 2, Math.PI, null],
      ['rear_flanker_04', 10.5, -43, 'pistolero', 'flanker', 'ambush_on_crossing', 2, 2.8, null],
      ['rear_lookout_05', -12, -43, 'scout', 'lookout', 'peek_from_cover', 2, 3.35, 'final_gate_peek'],
      ['rear_demo_06', 3.5, -47, 'demolitions', 'reinforcement', 'reposition', 2, Math.PI, null],
    ].forEach(([id, x, z, enemyType, role, behavior, zoneId, yaw, peekAngleId]) => {
      pushEnemy(id, x, z, {
        enemyType,
        role,
        behavior,
        zoneId,
        yaw,
        roomId: zoneId === 0 ? 'front_breach' : zoneId === 1 ? 'mid_push' : 'rear_control',
        spawnWave: behavior === 'reposition' ? 'reinforcement' : 'initial',
        peekAngleId,
      });
    });
    map.markers.patrolRoutes.push({
      id: 'mid_sweep_patrol',
      label: 'MID SWEEP PATROL',
      points: [{ x: -8, z: 7 }, { x: 8, z: 5 }, { x: 7, z: -8 }, { x: -7, z: -10 }],
      loop: true,
      pauseSeconds: 0.6,
      speed: 1,
      alertBehavior: 'patrol_then_alarm',
      assignedEnemyIds: ['mid_flanker_02'],
    });
    map.markers.flankRoutes.push({
      id: 'rear_wide_flank',
      label: 'REAR WIDE FLANK',
      points: [{ x: 10.5, z: -43 }, { x: 13, z: -38 }, { x: 8, z: -31 }],
      activation: 'after_contact',
      speed: 1.2,
      assignedEnemyIds: ['rear_flanker_04'],
    });
    map.markers.coverHints.push(createCoverHint(-7.5, -6, { id: 'mid_push_cover_hint', label: 'MID PUSH COVER' }));
    const midPush = map.markers.enemySpawns.find((enemy) => enemy.id === 'mid_push_03');
    if (midPush) setEnemyLink(midPush, 'coverHintId', 'mid_push_cover_hint');
    pushPickup('ammo_front', 0, 24, 'ammo');
    pushPickup('med_mid', -2.5, -11, 'med');
    pushPickup('ammo_rear', 3, -34, 'ammo');
  }

  async function generateCombatMap() {
    if (!map || !kit()) return;
    saveHistory();
    map.title = map.title && !/^untitled|new custom map$/i.test(map.title) ? map.title : 'AI Ready Combat Map';
    if (title) title.value = map.title;
    if (pack) pack.title = map.title;
    map.briefing = Object.assign({}, map.briefing || {}, {
      callsign: 'AI READY',
      target: 'MEGAPLEX CELL',
      time: 'CUSTOM RUN',
      introText: 'Clear the three-zone combat route.',
      endText: 'Custom operation complete.',
    });
    seedSmartObjects();
    applyTacticalRecipe();
    selected = null;
    activeTool = 'select';
    activePrefabId = null;
    analysis.enabled = true;
    view = { targetX: 0, targetZ: 0, zoom: 0.92 };
    scheduleAutosave();
    renderAll();
    const result = await validateCurrent();
    setStatus(result.ok ? 'Generated a validated three-zone combat map.' : `Generated map needs review: ${result.errors[0]}`, result.ok ? 'ok' : 'bad');
  }

  async function autoTactics() {
    if (!map || !kit()) return;
    saveHistory();
    applyTacticalRecipe();
    analysis.enabled = true;
    selected = null;
    scheduleAutosave();
    renderAll();
    const result = await validateCurrent();
    setStatus(result.ok ? 'Auto tactics rebuilt enemies, angles, doors, exits, and pickups.' : `Auto tactics found: ${result.errors[0]}`, result.ok ? 'ok' : 'bad');
  }

  async function qualityFix() {
    if (!map || !kit()) return;
    saveHistory();
    resetCoreMarkers();
    if (!map.markers.enemySpawns || map.markers.enemySpawns.length < 3) applyTacticalRecipe();
    const result = await validateCurrent();
    if (!result.ok && result.errors.some((err) => /zone_\d_has_no_enemy_spawns|missing_player_spawn|missing_exit|spawn_to_exit_unreachable/.test(err))) {
      seedSmartObjects();
      applyTacticalRecipe();
    }
    analysis.enabled = true;
    selected = null;
    scheduleAutosave();
    renderAll();
    const finalResult = await validateCurrent();
    setStatus(finalResult.ok ? 'Quality pass resolved required flow checks.' : `Quality pass still flags: ${finalResult.errors[0]}`, finalResult.ok ? 'ok' : 'bad');
  }

  async function applyCombatStamp(kind) {
    if (!map || !kit()) return;
    const stamp = COMBAT_STAMPS.find((x) => x.id === kind);
    if (!stamp) return;
    saveHistory();
    const origin = snapPlacement(null, hoverWorld || { x: view.targetX, z: view.targetZ });
    const ox = origin.x;
    const oz = origin.z;
    const baseYaw = placementYaw || 0;
    const add = (prefabId, dx, dz, yaw = 0, layer = 'geometry') => {
      const p = rotateXZ(dx, dz, baseYaw);
      return pushObject(prefabId, ox + p.x, oz + p.z, { yaw: baseYaw + yaw, layer, object: { id: `${kind}_${prefabId.replace(/[^a-z0-9]+/gi, '_')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 4)}` } });
    };
    const enemy = (dx, dz, options = {}) => {
      const p = rotateXZ(dx, dz, baseYaw);
      return pushEnemy(null, ox + p.x, oz + p.z, Object.assign({
        yaw: yawToward(ox + p.x, oz + p.z, ox, oz + 8),
        zoneId: zoneForZ(oz + p.z),
      }, options));
    };
    const peek = (dx, dz, options = {}) => {
      const p = rotateXZ(dx, dz, baseYaw);
      return pushPeek(null, ox + p.x, oz + p.z, Object.assign({
        yaw: yawToward(ox + p.x, oz + p.z, ox, oz + 8),
      }, options));
    };
    const hold = (dx, dz, options = {}) => {
      const p = rotateXZ(dx, dz, baseYaw);
      return pushHold(null, ox + p.x, oz + p.z, Object.assign({
        yaw: yawToward(ox + p.x, oz + p.z, ox, oz + 8),
      }, options));
    };
    if (kind === 'breach') {
      add('module.breach_room_two_cover', 0, 0);
      add('door.breachable_wood', 0, 5.8, 0);
      add('route.stack_left', -2.3, 6.8, Math.PI, 'gameplay');
      add('route.stack_right', 2.3, 6.8, Math.PI, 'gameplay');
      hold(-2.4, 0.7, { label: 'BREACH HOLD' });
      peek(2.6, -2.5, { label: 'BREACH FAR PEEK', range: 10 });
      enemy(-3.5, -2.5, { enemyType: 'soldier', role: 'anchor', behavior: 'hold_angle' });
      enemy(3.5, -1.2, { enemyType: 'pistolero', role: 'flanker', behavior: 'ambush_on_crossing' });
    } else if (kind === 'crossfire') {
      add('module.ambush_crossfire', 0, 0);
      add('cover.sandbag_corner', -4.5, -3.2, 0.2);
      add('cover.riot_barrier_pair', 4.5, 3.2, -0.2);
      peek(-4.4, -3.2, { label: 'LEFT CROSSFIRE', range: 12 });
      peek(4.4, 3.2, { label: 'RIGHT CROSSFIRE', range: 12 });
      enemy(-5, -3.5, { enemyType: 'scout', role: 'lookout', behavior: 'peek_from_cover' });
      enemy(5, 3.5, { enemyType: 'soldier', role: 'anchor', behavior: 'hold_angle' });
      enemy(0, -5, { enemyType: 'riot', role: 'breacher', behavior: 'push_after_contact' });
    } else if (kind === 'push') {
      add('module.cover_to_cover_push', 0, 0);
      add('route.danger_cross', 0, 0, Math.PI, 'gameplay');
      hold(-2.5, 3.1, { label: 'PUSH COVER A' });
      hold(2.3, 0.2, { label: 'PUSH COVER B' });
      hold(-1.7, -3.2, { label: 'PUSH COVER C' });
      enemy(-4.2, -2.5, { enemyType: 'heavy', role: 'breacher', behavior: 'push_after_contact' });
      enemy(4.4, 2.8, { enemyType: 'soldier', role: 'anchor', behavior: 'hold_angle' });
      pushPickup(null, ox, oz - 5.8, 'ammo');
    } else if (kind === 'sniper') {
      add('module.long_angle_sniper_lane', 0, 0);
      add('marker.sniper_perch', 4.8, -4.2, 0, 'gameplay');
      add('window.long_observation_8m', 5.2, -4.2, Math.PI / 2);
      peek(4.6, -4.2, { label: 'SNIPER ARC', range: 16, arcDegrees: 42 });
      enemy(4.1, -4.6, { enemyType: 'sniper', role: 'marksman', behavior: 'hold_angle' });
      enemy(-2.5, 1.5, { enemyType: 'soldier', role: 'anchor', behavior: 'peek_from_cover' });
    } else if (kind === 'final') {
      add('module.final_commit_gate', 0, 0);
      add('cover.security_kiosk', -5.5, -1.8, 0.25);
      add('cover.armored_server_bank', 5.5, -2.4, -0.25);
      add('prop.alarm_console', 0, -4.8, 0, 'gameplay');
      peek(-5, -2.5, { label: 'FINAL LEFT', range: 11 });
      peek(5, -2.5, { label: 'FINAL RIGHT', range: 11 });
      enemy(-6.5, -3, { enemyType: 'scout', role: 'lookout', behavior: 'peek_from_cover' });
      enemy(6.5, -3.4, { enemyType: 'soldier', role: 'anchor', behavior: 'hold_angle' });
      enemy(0, -4.8, { enemyType: 'demolitions', role: 'reinforcement', behavior: 'reposition', spawnWave: 'reinforcement' });
    }
    selected = null;
    analysis.enabled = true;
    scheduleAutosave();
    renderAll();
    const result = await validateCurrent();
    setStatus(result.ok ? `${stamp.label} encounter stamp added.` : `${stamp.label} added with review notes: ${result.errors[0]}`, result.ok ? 'ok' : 'bad');
  }

  function isPlacementModeActive() {
    return !!activePrefabId || isPlacementTool(activeTool);
  }

  function placementYawDegrees() {
    return ((Math.round((placementYaw * 180) / Math.PI) % 360) + 360) % 360;
  }

  function rotatePlacement(deg = 90) {
    placementYaw += (deg * Math.PI) / 180;
    setStatus(`Placement rotation ${placementYawDegrees()} deg.`, 'ok');
    renderViewport();
    updateHud();
  }

  function rotateSelected(deg = 90) {
    if (isPlacementModeActive()) {
      rotatePlacement(deg);
      return;
    }
    const ent = selectedEntity();
    if (!ent) {
      rotatePlacement(deg);
      return;
    }
    if (selected && selected.type === 'exit') return;
    saveHistory();
    ent.yaw = (ent.yaw || 0) + (deg * Math.PI) / 180;
    placementYaw = ent.yaw;
    scheduleAutosave();
    renderAll();
  }

  async function validateCurrent() {
    if (!validator || !kit()) return { ok: false, errors: ['validator_not_ready'], warnings: [] };
    const result = validator(pack, kit());
    analysis.result = result;
    analysis.at = Date.now();
    map.validation = { ok: result.ok, errors: result.errors, warnings: result.warnings, at: new Date().toISOString() };
    lastValidationOk = !!result.ok;
    if (result.ok) activeWorkflowStepId = 'validate';
    setStatus(result.ok ? 'Validation passed.' : `Validation blocked: ${result.errors[0]}`, result.ok ? 'ok' : 'bad');
    renderAnalysisPanel();
    renderViewport();
    return result;
  }

  async function toggleAnalysis() {
    analysis.enabled = !analysis.enabled;
    if (analysis.enabled) await validateCurrent();
    setStatus(analysis.enabled ? 'Tactical analysis overlay on.' : 'Tactical analysis overlay off.', analysis.enabled ? 'ok' : '');
    renderToolbar();
    renderAnalysisPanel();
    renderViewport();
  }

  async function saveCurrent(copy = false) {
    if (!pack || !map) return null;
    const out = normalizeCustomMapPack(pack);
    out.maps[mapIndex] = map;
    out.title = map.title || out.title;
    out.updatedAt = new Date().toISOString();
    if (copy) {
      out.id = `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      out.title = `${out.title} Copy`;
      out.createdAt = out.updatedAt;
    }
    pack = await store.savePack(out);
    map = pack.maps[mapIndex] || pack.maps[0];
    setStatus(copy ? 'Saved copy.' : 'Saved custom map.', 'ok');
    return pack;
  }

  function exportCurrent() {
    if (!pack) return;
    const blob = new Blob([store.exportPackJson(pack)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(pack.title || 'custom-map').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    setStatus('Exported JSON.', 'ok');
  }

  async function openPack(packId = null, nextMapIndex = 0) {
    await kitRegistry.load();
    const loaded = packId ? await store.getPack(packId) : null;
    pack = normalizeCustomMapPack(loaded || createDefaultCustomMapPack({ title: 'New Custom Map' }));
    if (pack.source === 'builtin') pack = await store.copyPack(pack);
    mapIndex = clamp(nextMapIndex | 0, 0, pack.maps.length - 1);
    map = pack.maps[mapIndex];
    history = [];
    redo = [];
    selected = null;
    activeDraw = null;
    hoverWorld = null;
    placementYaw = 0;
    analysis = { enabled: false, result: map.validation || null, at: 0 };
    paletteQuery = '';
    if (searchInput) searchInput.value = '';
    if (gridSelect) gridSelect.value = String(gridSize);
    if (socketSnapInput) socketSnapInput.checked = socketSnapEnabled;
    activeTool = 'select';
    activePrefabId = null;
    activeWorkflowStepId = 'layout';
    pendingBehaviorSequenceId = 'hold_defend';
    lastValidationOk = false;
    viewMode = 'tactical';
    frameMapOverview();
    if (title) title.value = map.title;
    root.classList.add('show');
    initViewport();
    renderAll();
    startLoop();
    const blank = isEditorMapEmpty(map);
    setStatus(blank ? 'Blank map ready — place assets from the palette or use GENERATE MAP.' : '3D editor ready.', 'ok');
  }

  function hide() {
    root.classList.remove('show');
    stopLoop();
    onBack();
  }

  function frameSelection() {
    const ent = selectedEntity();
    if (ent && selected) {
      const pos = entityPosition(selected.type, ent);
      view.targetX = pos.x;
      view.targetZ = pos.z;
      view.zoom = Math.max(view.zoom, 1.45);
    } else if (map) {
      view.targetX = ((Number(map.bounds.x0) || 0) + (Number(map.bounds.x1) || 0)) / 2;
      view.targetZ = ((Number(map.bounds.z0) || 0) + (Number(map.bounds.z1) || 0)) / 2;
      view.zoom = 1;
    }
    renderViewport();
  }

  function getAssetHealth() {
    return Object.assign(buildLevelEditorAssetHealth(pack || map, ALL_MANIFESTS, {
      editorReady: true,
      editorOpen: !!(root && root.classList.contains('show'))
    }), {
      mapId: map && map.id || null,
      packId: pack && pack.id || null
    });
  }

  canvas?.addEventListener('mousedown', (e) => {
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    if (e.button === 1 || e.button === 2 || e.altKey || activeTool === 'pan') {
      drag = { kind: 'pan', startWorld: world, originX: view.targetX, originZ: view.targetZ };
      return;
    }
    if (e.button === 0 && canPaintObjects()) {
      saveHistory();
      const painted = placeAt(world, { saveHistory: false, render: 'paint', skipExisting: true });
      const keys = new Set();
      if (painted && painted.key) keys.add(painted.key);
      drag = { kind: 'paint', keys, count: painted ? 1 : 0 };
      return;
    }
    if (e.button === 0 && isDrawTool(activeTool)) {
      handleDrawClick(world);
      return;
    }
    if (activeTool !== 'select' && activeTool !== 'pan') {
      placeAt(world);
      return;
    }
    const hit = pickEntity(e.clientX, e.clientY);
    selected = hit;
    const ent = selectedEntity();
    if (ent) placementYaw = entityYaw(selected.type, ent);
    if (hit) {
      saveHistory();
      drag = { kind: 'move', hit };
    } else {
      drag = null;
    }
    renderAll();
  });

  canvas?.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas?.addEventListener('dblclick', (e) => {
    if (!root || !root.classList.contains('show')) return;
    if (!activeDraw || (activeDraw.type !== 'patrol' && activeDraw.type !== 'flank')) return;
    e.preventDefault();
    finishActiveDraw();
  });

  window.addEventListener('mousemove', (e) => {
    if (!root || !root.classList.contains('show')) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (world) hoverWorld = world;
    if (!drag) {
      if (activeTool !== 'select' && activeTool !== 'pan') renderViewport();
      return;
    }
    if (drag.kind === 'pan') {
      if (!world || !drag.startWorld) return;
      view.targetX = drag.originX + (drag.startWorld.x - world.x);
      view.targetZ = drag.originZ + (drag.startWorld.z - world.z);
      renderViewport();
      return;
    }
    if (drag.kind === 'paint') {
      const painted = placeAt(world, { saveHistory: false, render: 'paint', skipKeys: drag.keys, skipExisting: true });
      if (painted && painted.key) {
        drag.keys.add(painted.key);
        drag.count += 1;
      }
      return;
    }
    if (drag.kind === 'move') moveSelected(world);
  });

  window.addEventListener('mouseup', () => {
    if (drag && drag.kind === 'paint' && drag.count > 1) {
      setStatus(`Painted ${drag.count} objects.`, 'ok');
    }
    drag = null;
  });

  canvas?.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.zoom = clamp(view.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.45, 3.5);
    renderViewport();
  }, { passive: false });

  canvas?.addEventListener('dragover', (e) => {
    e.preventDefault();
    hoverWorld = screenToWorld(e.clientX, e.clientY);
    renderViewport();
  });

  canvas?.addEventListener('drop', (e) => {
    e.preventDefault();
    const tool = e.dataTransfer.getData('application/x-clearance-editor-tool');
    if (tool) {
      activeTool = tool;
      activePrefabId = null;
      placementPickupType = e.dataTransfer.getData('application/x-clearance-pickup-type') || placementPickupType;
    } else {
      activePrefabId = e.dataTransfer.getData('text/plain') || activePrefabId;
      activeTool = 'place';
    }
    hoverWorld = screenToWorld(e.clientX, e.clientY);
    if (isDrawTool(activeTool)) handleDrawClick(hoverWorld);
    else placeAt(hoverWorld);
  });

  document.querySelectorAll('.ce-tool').forEach((button) => button.addEventListener('click', () => {
    if (activeDraw) activeDraw = null;
    activeTool = button.dataset.tool || 'select';
    if (activeTool !== 'place') activePrefabId = null;
    if (['place', 'pan', 'select'].includes(activeTool)) activeWorkflowStepId = 'layout';
    else if (['spawn', 'exit', 'door'].includes(activeTool)) activeWorkflowStepId = 'flow';
    else if (['enemy', 'peek', 'hold', 'cover', 'patrol', 'flank', 'zone', 'trigger', 'breach', 'sniper'].includes(activeTool)) {
      activeWorkflowStepId = 'enemies';
    }
    renderToolbar();
    renderPalette();
    renderGuidePanel();
    renderToolHint();
    renderViewport();
  }));

  document.querySelectorAll('.ce-view').forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.view || 'tactical';
    viewMode = VIEW_MODES.includes(next) ? next : 'tactical';
    renderToolbar();
    renderViewport();
  }));

  document.getElementById('ce-undo')?.addEventListener('click', undo);
  document.getElementById('ce-redo')?.addEventListener('click', redoEdit);
  document.getElementById('ce-copy')?.addEventListener('click', copySelected);
  document.getElementById('ce-paste')?.addEventListener('click', pasteClipboard);
  document.getElementById('ce-rotate')?.addEventListener('click', () => rotateSelected(90));
  document.getElementById('ce-delete-btn')?.addEventListener('click', deleteSelected);
  document.getElementById('ce-clear')?.addEventListener('click', clearMap);
  document.getElementById('ce-save')?.addEventListener('click', () => saveCurrent(false));
  document.getElementById('ce-save-copy')?.addEventListener('click', () => saveCurrent(true));
  document.getElementById('ce-export')?.addEventListener('click', exportCurrent);
  document.getElementById('ce-validate')?.addEventListener('click', validateCurrent);
  document.getElementById('ce-analyze')?.addEventListener('click', toggleAnalysis);
  document.getElementById('ce-generate-map')?.addEventListener('click', generateCombatMap);
  document.getElementById('ce-auto-tactics')?.addEventListener('click', autoTactics);
  document.getElementById('ce-quality-fix')?.addEventListener('click', qualityFix);
  document.querySelectorAll('.ce-stamp').forEach((button) => button.addEventListener('click', () => applyCombatStamp(button.dataset.stamp)));
  document.getElementById('ce-playtest')?.addEventListener('click', async () => {
    await validateCurrent();
    await saveCurrent(false);
    root.classList.remove('show');
    stopLoop();
    onPlaytest(pack, mapIndex, { returnToEditor: true });
  });
  document.getElementById('ce-back')?.addEventListener('click', hide);
  title?.addEventListener('input', () => { if (map) { map.title = title.value; pack.title = title.value; scheduleAutosave(); renderInspector(); } });
  searchInput?.addEventListener('input', () => {
    paletteQuery = searchInput.value || '';
    renderPalette();
  });
  gridSelect?.addEventListener('change', () => {
    gridSize = Number(gridSelect.value) || 0.5;
    setStatus(`Grid snap ${gridSize}m.`, 'ok');
    renderViewport();
  });
  socketSnapInput?.addEventListener('change', () => {
    socketSnapEnabled = !!socketSnapInput.checked;
    setStatus(socketSnapEnabled ? 'Socket snapping on.' : 'Socket snapping off.', socketSnapEnabled ? 'ok' : '');
    renderViewport();
  });
  document.querySelectorAll('.ce-layer').forEach((input) => input.addEventListener('change', () => {
    layers[input.dataset.layer] = !!input.checked;
    renderViewport();
  }));
  document.getElementById('ce-import')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const next = await store.importPackJson(await file.text(), { copyId: true });
      await openPack(next.id, next.startIndex || 0);
      setStatus('Imported pack into editor.', 'ok');
    } catch (err) {
      setStatus(err.message || 'Import failed.', 'bad');
    } finally {
      importInput.value = '';
    }
  });
  window.addEventListener('resize', () => { if (root && root.classList.contains('show')) renderViewport(); });
  window.addEventListener('keydown', (e) => {
    if (!root || !root.classList.contains('show')) return;
    const tag = (e.target && e.target.tagName || '').toUpperCase();
    const editingText = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.metaKey || e.ctrlKey) {
      if (e.code === 'KeyZ') { e.preventDefault(); undo(); }
      if (e.code === 'KeyY') { e.preventDefault(); redoEdit(); }
      if (e.code === 'KeyS') { e.preventDefault(); saveCurrent(false); }
      if (e.code === 'KeyC') { e.preventDefault(); copySelected(); }
      if (e.code === 'KeyV') { e.preventDefault(); pasteClipboard(); }
      return;
    }
    if (editingText) {
      if (e.code === 'Escape') { e.preventDefault(); canvas?.focus?.(); }
      return;
    }
    if (activeDraw && e.code === 'Enter') {
      e.preventDefault();
      finishActiveDraw();
      return;
    }
    if (activeDraw && e.code === 'Escape') {
      e.preventDefault();
      cancelActiveDraw();
      return;
    }
    if (e.code === 'Digit1') { e.preventDefault(); viewMode = 'tactical'; renderAll(); }
    if (e.code === 'Digit2') { e.preventDefault(); viewMode = 'top'; renderAll(); }
    if (e.code === 'Digit3') { e.preventDefault(); viewMode = 'preview'; renderAll(); }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
      const step = (e.shiftKey ? gridSize * 4 : gridSize) || 0.5;
      const moved = nudgeSelected(
        e.code === 'ArrowLeft' ? -step : e.code === 'ArrowRight' ? step : 0,
        e.code === 'ArrowUp' ? -step : e.code === 'ArrowDown' ? step : 0,
      );
      if (!moved) {
        if (e.code === 'ArrowLeft') view.targetX -= step;
        if (e.code === 'ArrowRight') view.targetX += step;
        if (e.code === 'ArrowUp') view.targetZ -= step;
        if (e.code === 'ArrowDown') view.targetZ += step;
        renderViewport();
      }
    }
    if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
      e.preventDefault();
      const step = (e.shiftKey ? 5 : 2) / clamp(view.zoom, 0.5, 3);
      if (e.code === 'KeyW') view.targetZ -= step;
      if (e.code === 'KeyS') view.targetZ += step;
      if (e.code === 'KeyA') view.targetX -= step;
      if (e.code === 'KeyD') view.targetX += step;
      renderViewport();
    }
    if (e.code === 'KeyF') { e.preventDefault(); frameSelection(); }
    if (e.code === 'KeyL') { e.preventDefault(); toggleAnalysis(); }
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); deleteSelected(); }
    if (e.code === 'KeyR') { e.preventDefault(); rotateSelected(e.shiftKey ? -90 : 90); }
    if (e.code === 'KeyQ') { e.preventDefault(); rotateSelected(-90); }
    if (e.code === 'KeyE') { e.preventDefault(); rotateSelected(90); }
    if (e.code === 'Escape') { e.preventDefault(); hide(); }
  });

  return {
    openPack,
    hide,
    isOpen: () => !!(root && root.classList.contains('show')),
    getState: () => ({ pack, mapIndex }),
    getAssetHealth,
    restoreAfterPlaytest: () => {
      root.classList.add('show');
      initViewport();
      renderAll();
      startLoop();
      setStatus('Returned from playtest.', 'ok');
    },
    collectGeometry: () => collectCustomMapGeometry(map, kit()),
  };
}
