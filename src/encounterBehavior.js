/**
 * Phase 5 — thin encounter behavior layer on top of existing Enemy AI fields.
 */
import { pickFloorplanSpaceId } from './encounterDirector.js';
import { COVER_HINT_ANCHOR_PATCH_BY_BN } from './campaign/nativeEncounterTactics.js';

/**
 * @param {object|null} encounterDef
 * @param {string|null} specId
 * @returns {{ encounterId: string, spec: object }|null}
 */
export function resolveEncounterEnemySpec(encounterDef, specId) {
  if (!encounterDef || !specId || !Array.isArray(encounterDef.encounters)) return null;
  for (const enc of encounterDef.encounters) {
    if (!enc || !Array.isArray(enc.enemies)) continue;
    const row = enc.enemies.find((u) => u && u.id === specId);
    if (row) return { encounterId: enc.id, spec: row };
  }
  return null;
}

/**
 * Role nudges for authored / spec-driven enemies (Slice E).
 * @param {object} enemy
 * @param {string|null|undefined} role
 */
export function applyEncounterRole(enemy, role) {
  if (!enemy || !role) return;
  enemy.encounterRole = role;
  if (role === 'lookout') {
    enemy._encLookout = true;
    enemy.peekRate = (enemy.peekRate || 1) * 1.08;
    if (enemy.personality) enemy.personality.speedMul = (enemy.personality.speedMul || 1) * 1.05;
  } else if (role === 'anchor') {
    enemy.holdRiskCap = Math.min(0.95, (enemy.holdRiskCap || 0.55) + 0.1);
    enemy.peekRate = (enemy.peekRate || 1) * 0.9;
    if (!enemy.encounterPreferredState) enemy.encounterPreferredState = 'HOLD_CORNER';
  } else if (role === 'flanker') {
    enemy._encFlankNudge = true;
    enemy.peekRate = (enemy.peekRate || 1) * 1.05;
    if (enemy.personality) enemy.personality.speedMul = (enemy.personality.speedMul || 1) * 1.06;
  }
}

/**
 * @param {object} enemy
 * @param {{ encounterId: string, spec: object }} hit
 */
export function applyEncounterEnemySpec(enemy, hit) {
  if (!enemy || !hit || !hit.spec) return;
  const s = hit.spec;
  enemy.encounterId = hit.encounterId;
  enemy.encounterBehavior = s.behavior || null;
  enemy.encounterPreferredState = s.preferredState || null;
  if (Array.isArray(s.alertLink)) enemy.encounterAlertLink = s.alertLink.slice();
  if (s.patrol) enemy.encounterPatrolTag = s.patrol;
  if (s.cover) enemy.encounterCoverTag = s.cover;
  if (s.coverHint) enemy.encounterCoverHint = s.coverHint;
  else if (s.cover) enemy.encounterCoverHint = s.cover;
  if (s.role) applyEncounterRole(enemy, s.role);
  const b = s.behavior;
  if (b === 'peek_from_cover' || b === 'patrol_then_alarm') {
    enemy.peekRate = (enemy.peekRate || 1) * 1.12;
  }
  if (b === 'guard_objective' || b === 'hold_angle') {
    enemy.holdRiskCap = Math.min(0.95, (enemy.holdRiskCap || 0.55) + 0.12);
    enemy.peekRate = (enemy.peekRate || 1) * 0.88;
  }
  if (b === 'suppress_lane') {
    enemy.useSuppress = true;
  }
  if (b === 'flank_after_contact') {
    enemy._encFlankAfterContact = true;
  }
  if (b === 'patrol_then_alarm') {
    enemy._encPatrolAlarm = true;
  }
  if (b === 'rush_when_player_reloads') {
    enemy._encRushReload = true;
  }
}

/** Optional world anchors to bias cover-slot choice toward encounter `cover` / `coverHint` tags. */
const COVER_HINT_ANCHORS = {
  east_stack: [14, 15],
  fe_stack: [13, 12],
  west_lane_fork: [-12, 15],
  intake_apron: [0, 12],
  relay_desk: [-14, 2.5],
  drum_spool: [14.5, 0],
  cage_pillar_west: [-13, -16],
  cage_center_low: [-2, -17],
  vestibule_face: [3, -14],
  desk_rail: [13.5, -17],
  spine_pinch: [0, 2],
  default: null,
};

function _resolveCoverAnchor(hint, building) {
  const bn = Number(building) | 0;
  const patch = bn > 0 ? COVER_HINT_ANCHOR_PATCH_BY_BN[bn] : null;
  if (patch && patch[hint]) return patch[hint];
  return COVER_HINT_ANCHORS[hint] || COVER_HINT_ANCHORS.default;
}

/**
 * Re-pick nearest cover slot in-zone using hint anchor bias (Phase 10).
 * @param {object} enemy
 * @param {object[]} slotPool
 * @param {{ zSplit: number, halfDepth: number }} zb
 * @param {number} [building] campaign building index (cover anchor patches per BN)
 */
export function rescoreCoverSlotForEncounterHint(enemy, slotPool, zb, building) {
  if (!enemy || enemy.peekRate <= 0 || !slotPool || !slotPool.length || !zb) return;
  const hint = enemy.encounterCoverHint;
  if (!hint) return;
  const anchor = _resolveCoverAnchor(hint, building);
  if (!anchor) return;
  let zLo;
  let zHi;
  if (enemy.zoneId === 0) {
    zLo = zb.zSplit;
    zHi = zb.halfDepth;
  } else if (enemy.zoneId === 1) {
    zLo = -zb.zSplit;
    zHi = zb.zSplit;
  } else {
    zLo = -zb.halfDepth;
    zHi = -zb.zSplit;
  }
  const ax = anchor[0];
  const az = anchor[1];
  const px = enemy.group.position.x;
  const pz = enemy.group.position.z;
  let best = null;
  let bestScore = Infinity;
  for (const s of slotPool) {
    if (s.z < zLo || s.z > zHi) continue;
    if (s.claimedBy && s.claimedBy !== enemy) continue;
    const dx = s.x - px;
    const dz = s.z - pz;
    const hx = s.x - ax;
    const hz = s.z - az;
    const score = dx * dx + dz * dz + (hx * hx + hz * hz) * 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) return;
  if (enemy.coverSlot && enemy.coverSlot !== best && enemy.coverSlot.claimedBy === enemy) {
    enemy.coverSlot.claimedBy = null;
  }
  best.claimedBy = enemy;
  enemy.coverSlot = best;
  enemy.coverPoint = { x: best.x, z: best.z };
}

/**
 * Per-frame intent nudges — keep minimal to avoid fighting the core FSM.
 * AI state constants match main.js (PATROL=0, CHASE=2, ATTACK=3, SEARCH=4).
 * @param {object} enemy
 * @param {number} dt
 * @param {{ x: number, z: number }} playerPos
 * @param {{ reloading?: boolean }} player
 * @param {object|null} [floorplan] encounterDef.floorplan — biases hold/peek in narrow authored connectors
 */
export function tickEncounterEnemyIntent(enemy, dt, playerPos, player, floorplan) {
  if (!enemy || enemy.dead) {
    return;
  }
  let boost = 0;
  if (floorplan && floorplan.spaces && enemy.group) {
    const sid = pickFloorplanSpaceId(enemy.group.position.x, enemy.group.position.z, floorplan);
    const meta = sid && floorplan.spaces[sid];
    const k = meta && meta.kind;
    if (
      k === 'connector' ||
      k === 'service_hall' ||
      k === 'guided_tunnel' ||
      k === 'return_loop' ||
      k === 'side_pocket' ||
      k === 'vestibule' ||
      k === 'preview_threshold' ||
      k === 'signature_gate' ||
      k === 'transit_wedge'
    ) {
      boost = 0.12;
    }
    if (k === 'signature_gate' || k === 'preview_threshold') boost = Math.max(boost, 0.16);
  }
  enemy._fpHoldBoost = boost;
  let mul = 1;
  if (
    enemy.encounterBehavior === 'rush_when_player_reloads' &&
    enemy._encRushReload &&
    player &&
    player.reloading
  ) {
    const dx = playerPos.x - enemy.group.position.x;
    const dz = playerPos.z - enemy.group.position.z;
    if (dx * dx + dz * dz < 24 * 24 && (enemy.state === 2 || enemy.state === 3)) {
      mul = 1.16;
    }
  }
  enemy._encSpeedMul = mul;
  const b = enemy.encounterBehavior;
  if (!b) return;
  if (b === 'flank_after_contact' && enemy._encFlankAfterContact) {
    if (enemy.state === 0 || enemy.state === 4) {
      const aware = enemy.lastKnownPos != null;
      if (aware && enemy.state === 0) {
        enemy.state = 4;
        enemy.searchTimer = Math.max(enemy.searchTimer || 0, 2.4);
      }
    }
  }
  if (enemy._encFlankNudge && (enemy.state === 2 || enemy.state === 3)) {
    enemy.flankTimer = Math.max(enemy.flankTimer || 0, 0.15);
  }
  if (b === 'suppress_lane' && enemy.useSuppress && enemy.state === 3) {
    const dx = playerPos.x - enemy.group.position.x;
    const dz = playerPos.z - enemy.group.position.z;
    const ar = enemy.attackRange || 12;
    if (dx * dx + dz * dz > ar * ar * 0.64) {
      const nowMs = performance.now();
      if (!enemy.suppressUntil || nowMs > enemy.suppressUntil) {
        enemy.suppressUntil = nowMs + 1800;
        enemy.suppressBurstsLeft = Math.max(2, enemy.burstMax | 0);
      }
    }
  }
}
