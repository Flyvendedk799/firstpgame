/**
 * Campaign encounter runtime: floorplan room, active encounter, objectives,
 * reinforcement queue, zone-door policy, debug snapshot.
 */
import * as THREE from 'three';
import { collectAlarmReinforcementSpecs, getHoldInteractObjectives, getTraverseRoomObjectives } from './campaignObjectives.js';
import { getCampaignRoomFlow, pickCampaignFlowRoomId } from './campaignRoomFlows.js';

function _boundsArea(b) {
  if (!b || !Number.isFinite(b.x0)) return Infinity;
  return (b.x1 - b.x0) * (b.z1 - b.z0);
}

/** Smallest matching bounds win so nested sub-spaces beat parent volumes. */
export function pickFloorplanSpaceId(x, z, floorplan) {
  const sp = floorplan && floorplan.spaces;
  if (!sp) return null;
  const ids = Object.keys(sp).sort(
    (a, c) => _boundsArea(sp[a].bounds) - _boundsArea(sp[c].bounds)
  );
  for (const id of ids) {
    const b = sp[id].bounds;
    if (!b || !Number.isFinite(b.x0)) continue;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return id;
  }
  return null;
}

function _parentRoomId(roomId, floorplan) {
  if (!roomId || !floorplan || !floorplan.spaces) return roomId || null;
  const meta = floorplan.spaces[roomId];
  return (meta && typeof meta.parentRoom === 'string' && meta.parentRoom) ? meta.parentRoom : roomId;
}

const _ROOM_LOG_MAX = 12;

export class EncounterDirector {
  constructor() {
    this.floorplan = null;
    this.roomFlow = null;
    this.encounterDef = null;
    this.building = null;
    this.encountersCatalog = null;
    this.currentRoomId = null;
    this.previousRoomId = null;
    this.currentFlowRoomId = null;
    this.previousFlowRoomId = null;
    this.activeRoomGateId = null;
    this.activeEncounterId = null;
    this.roomVisitCounts = Object.create(null);
    this.roomFirstEnteredAt = Object.create(null);
    this.flowRoomVisitCounts = Object.create(null);
    this.flowRoomFirstEnteredAt = Object.create(null);
    this.flowRoomVisitOrder = [];
    this.completedFlowRooms = Object.create(null);
    this.roomGateState = Object.create(null);
    this._roomGateBlockReason = Object.create(null);
    this._lastTransitionAt = null;
    this._lastFlowTransitionAt = null;
    /** @type {{ from: string|null, to: string|null, t: number }[]} */
    this.roomTransitionLog = [];
    /** @type {string[]} */
    this._reinforcementQueue = [];
    this.reinforcementsFired = Object.create(null);
    this.completedEncounterIds = Object.create(null);
    this.objectiveState = {
      alarmPanelDisabled: false,
      alarmPanelHold: 0,
      secondsInRelayRoom: 0,
      feel: null,
      completedObjectiveIds: /** @type {Record<string, boolean>} */ ({}),
    };
    this.lastTrigger = null;
    this.lockedDoors = { zone0: false, zone1: false, zone2: false };
    /** @type {ReturnType<collectAlarmReinforcementSpecs>} */
    this._reinforcementTimerSpecs = [];
    /** @type {Record<string, number>} */
    this._reinforceTimers = Object.create(null);
    /** @type {object[]} */
    this._holdObjectiveSpecs = [];
    /** @type {object[]} */
    this._traverseObjectiveSpecs = [];
    /** @type {Record<string, boolean>} */
    this._doorOpenedOnce = Object.create(null);
    /** @type {Record<string, boolean>} */
    this._zoneClearHandled = Object.create(null);
    /** Debug / tooling */
    this.activeEncounterIdForced = null;
    /** Encounter ids that had at least one authored enemy spawned (for room_clear gating). */
    this._encounterSpawned = Object.create(null);
    /** Last computed zone-door block reason for debug HUD (zoneIndex -> string). */
    this._zoneDoorBlockReason = Object.create(null);
  }

  /** Call after buildLevel when levelData.encounterDef may define a floorplan. */
  startBuilding(levelData, building) {
    const def = levelData && levelData.encounterDef;
    this.encounterDef = def || null;
    this.floorplan = def && def.floorplan ? def.floorplan : null;
    this.roomFlow = (levelData && levelData.roomFlow) || getCampaignRoomFlow(building);
    this.encountersCatalog = def && Array.isArray(def.encounters) ? def.encounters : null;
    this.building = building;
    this.currentRoomId = null;
    this.previousRoomId = null;
    this.currentFlowRoomId = null;
    this.previousFlowRoomId = null;
    this.activeRoomGateId = null;
    this.activeEncounterId = null;
    this.roomVisitCounts = Object.create(null);
    this.roomFirstEnteredAt = Object.create(null);
    this.flowRoomVisitCounts = Object.create(null);
    this.flowRoomFirstEnteredAt = Object.create(null);
    this.flowRoomVisitOrder = [];
    this.completedFlowRooms = Object.create(null);
    this.roomGateState = Object.create(null);
    this._roomGateBlockReason = Object.create(null);
    this._lastTransitionAt = null;
    this._lastFlowTransitionAt = null;
    this.roomTransitionLog = [];
    this._reinforcementQueue = [];
    this.reinforcementsFired = Object.create(null);
    this.completedEncounterIds = Object.create(null);
    this.objectiveState = {
      alarmPanelDisabled: false,
      alarmPanelHold: 0,
      secondsInRelayRoom: 0,
      feel: null,
      completedObjectiveIds: {},
    };
    this.lastTrigger = null;
    this.lockedDoors = { zone0: false, zone1: false, zone2: false };
    this._reinforcementTimerSpecs = collectAlarmReinforcementSpecs(this.encountersCatalog);
    this._reinforceTimers = Object.create(null);
    this._holdObjectiveSpecs = getHoldInteractObjectives(def && def.director);
    this._traverseObjectiveSpecs = getTraverseRoomObjectives(def && def.director);
    this._doorOpenedOnce = Object.create(null);
    this._zoneClearHandled = Object.create(null);
    this.activeEncounterIdForced = null;
    this._encounterSpawned = Object.create(null);
    this._zoneDoorBlockReason = Object.create(null);
    if (this.roomFlow && this.roomFlow.gates) {
      for (const [gid, gate] of Object.entries(this.roomFlow.gates)) {
        const runtimeGate = levelData && levelData.roomGatesById && levelData.roomGatesById[gid];
        this.roomGateState[gid] = {
          opened: runtimeGate ? !!runtimeGate.opened : gate.startsLocked === false,
          blockedReason: gate.startsLocked === false ? null : 'locked',
        };
      }
    }
  }

  /**
   * @param {string|null} roomId
   */
  enterRoom(roomId) {
    if (this.activeEncounterIdForced) return;
    this.activeEncounterId = null;
    if (!roomId || !this.encountersCatalog) return;
    const parentRoom = _parentRoomId(roomId, this.floorplan);
    const hit = this.encountersCatalog.find((e) => e && (e.room === roomId || e.room === parentRoom));
    if (hit && hit.id) {
      this.activeEncounterId = hit.id;
      this.lastTrigger = { type: 'enter_room', room: roomId, parentRoom, encounterId: hit.id, t: performance.now() * 0.001 };
    }
  }

  startEncounter(encounterId) {
    if (!encounterId || !this.encountersCatalog) return;
    const hit = this.encountersCatalog.find((e) => e && e.id === encounterId);
    if (hit) {
      this.activeEncounterId = encounterId;
      this.lastTrigger = { type: 'start_encounter', encounterId, t: performance.now() * 0.001 };
    }
  }

  /**
   * @param {string|null} roomId
   */
  enterFlowRoom(roomId) {
    if (this.activeEncounterIdForced) return;
    if (!roomId || !this.roomFlow || !this.roomFlow.rooms) return;
    const room = this.roomFlow.rooms[roomId];
    if (!room) return;
    if (room.encounterId) {
      this.startEncounter(room.encounterId);
      this.lastTrigger = {
        type: 'enter_flow_room',
        room: roomId,
        encounterId: room.encounterId,
        t: performance.now() * 0.001,
      };
    } else {
      this.lastTrigger = {
        type: 'enter_flow_room',
        room: roomId,
        encounterId: null,
        t: performance.now() * 0.001,
      };
    }
  }

  completeEncounter(encounterId) {
    if (!encounterId) return;
    this.completedEncounterIds[encounterId] = true;
    this.lastTrigger = { type: 'complete_encounter', encounterId, t: performance.now() * 0.001 };
  }

  /** Called when an enemy is spawned with catalog `encounterId` (room_clear bookkeeping). */
  markEncounterSpawned(encounterId) {
    if (!encounterId) return;
    this._encounterSpawned[encounterId] = true;
  }

  /**
   * Complete catalog encounters when all their `encounterId` hostiles are dead.
   * Handles `room_clear` and `objective_and_room_safe` (relay guard dead without panel hold).
   * @param {{ _list?: unknown[] }|null} enemyMgr
   */
  checkRoomClearEncounters(enemyMgr) {
    if (!this.encountersCatalog || !enemyMgr || !Array.isArray(enemyMgr._list)) return;
    for (const enc of this.encountersCatalog) {
      if (!enc || !enc.id || this.completedEncounterIds[enc.id]) continue;
      const ct = enc.completion && enc.completion.type;
      if (ct !== 'room_clear' && ct !== 'objective_and_room_safe') continue;
      if (!Array.isArray(enc.enemies) || enc.enemies.length === 0) continue;
      let alive = 0;
      let tagged = 0;
      for (const e of enemyMgr._list) {
        if (!e || e.encounterId !== enc.id) continue;
        tagged++;
        if (!e.dead) alive++;
      }
      const spawned = !!this._encounterSpawned[enc.id];
      if (!spawned && tagged === 0 && !this._isEncounterClearGateReachable(enc.id)) continue;
      if (alive === 0) this.completeEncounter(enc.id);
    }
  }

  /**
   * `director.zoneDoorRequires[zoneIndex]` = { encounterIds: string[], alsoRequireZoneClear?: boolean }.
   * When absent, returns true (legacy zone-only clear).
   * @param {number} zoneId 0 = front→mid door, 1 = mid→back door
   */
  encountersSatisfiedForZoneDoorOpen(zoneId) {
    const zi = Number(zoneId) | 0;
    const raw =
      this.encounterDef && this.encounterDef.director && this.encounterDef.director.zoneDoorRequires;
    if (!raw || typeof raw !== 'object') {
      this._zoneDoorBlockReason[`z${zi}`] = null;
      return true;
    }
    const req = raw[zi] !== undefined ? raw[zi] : raw[String(zi)];
    if (!req || !Array.isArray(req.encounterIds) || req.encounterIds.length === 0) {
      this._zoneDoorBlockReason[`z${zi}`] = null;
      return true;
    }
    const miss = [];
    for (const id of req.encounterIds) {
      if (!id || !this.completedEncounterIds[id]) miss.push(id);
    }
    if (miss.length) {
      this._zoneDoorBlockReason[`z${zi}`] = `encounters:${miss.join(',')}`;
      return false;
    }
    this._zoneDoorBlockReason[`z${zi}`] = null;
    return true;
  }

  /** Debug: mark all zoneDoorRequires encounters for `zoneId` complete (dev only). */
  debugForceCompleteZoneDoorEncounters(zoneId) {
    const raw =
      this.encounterDef && this.encounterDef.director && this.encounterDef.director.zoneDoorRequires;
    if (!raw || typeof raw !== 'object') return;
    const zi = Number(zoneId) | 0;
    const req = raw[zi] !== undefined ? raw[zi] : raw[String(zi)];
    if (!req || !Array.isArray(req.encounterIds)) return;
    for (const id of req.encounterIds) this.completeEncounter(id);
    this._zoneDoorBlockReason[`z${zi}`] = null;
  }

  /**
   * Zone doors: default open front/mid when those zones clear (legacy).
   * `director.zoneDoorOnClear` can override per zone index.
   */
  shouldOpenZoneDoorOnClear(zoneId) {
    const zi = Number(zoneId) | 0;
    if (zi !== 0 && zi !== 1) return false;
    const raw = this.encounterDef && this.encounterDef.director && this.encounterDef.director.zoneDoorOnClear;
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return true;
    const keyOwn =
      Object.prototype.hasOwnProperty.call(raw, zi) ||
      Object.prototype.hasOwnProperty.call(raw, String(zi));
    if (!keyOwn) return true;
    const v = raw[zi] !== undefined ? raw[zi] : raw[String(zi)];
    // Only an explicit boolean false blocks the physical zone door.
    if (v === false) return false;
    return true;
  }

  /** Idempotent zone-clear bookkeeping (avoids duplicate side effects if triggers stack). */
  isZoneClearHandled(zoneId) {
    return !!this._zoneClearHandled[`z${zoneId}`];
  }

  markZoneClearHandled(zoneId) {
    this._zoneClearHandled[`z${zoneId}`] = true;
  }

  /**
   * Open a zone door from objective completion (once per objective+zone).
   * @param {object|null} levelData
   * @param {string} objectiveId
   */
  tryOpenZoneDoorForObjective(levelData, objectiveId) {
    const map =
      this.encounterDef &&
      this.encounterDef.director &&
      this.encounterDef.director.objectiveOpensZoneDoor;
    if (!map || levelData == null || typeof levelData.openZoneDoor !== 'function') return;
    const z = map[objectiveId];
    if (z == null || !Number.isFinite(z)) return;
    const zi = z | 0;
    const key = `obj:${objectiveId}:z${zi}`;
    if (this._doorOpenedOnce[key]) return;
    this._doorOpenedOnce[key] = true;
    levelData.openZoneDoor(zi);
    this.lastTrigger = {
      type: 'objective_opens_zone_door',
      objectiveId,
      zoneId: zi,
      t: performance.now() * 0.001,
    };
  }

  /**
   * @param {number} dt
   * @param {{ pos: { x: number; z: number } }} player
   * @param {{ alarmSystem?: boolean, levelData?: object }} [opts]
   */
  tick(dt, player, opts) {
    if ((!this.floorplan && !this.roomFlow) || !player || !player.pos) return;
    const x = player.pos.x;
    const z = player.pos.z;
    if (this.floorplan) {
      const id = pickFloorplanSpaceId(x, z, this.floorplan);
      if (id !== this.currentRoomId) {
        const from = this.currentRoomId;
        this.previousRoomId = this.currentRoomId;
        this.currentRoomId = id;
        this._lastTransitionAt = performance.now() * 0.001;
        this.roomTransitionLog.push({ from, to: id, t: this._lastTransitionAt });
        if (this.roomTransitionLog.length > _ROOM_LOG_MAX) {
          this.roomTransitionLog.splice(0, this.roomTransitionLog.length - _ROOM_LOG_MAX);
        }
        this.enterRoom(id);
        if (id) {
          this.roomVisitCounts[id] = (this.roomVisitCounts[id] || 0) + 1;
          if (this.roomFirstEnteredAt[id] == null) {
            this.roomFirstEnteredAt[id] = this._lastTransitionAt;
          }
          this._checkTraverseObjectives(id, opts && opts.levelData);
          const parentRoom = _parentRoomId(id, this.floorplan);
          if (parentRoom && parentRoom !== id) this._checkTraverseObjectives(parentRoom, opts && opts.levelData);
        }
      }
    }
    if (this.roomFlow) {
      const flowId = pickCampaignFlowRoomId(this.building, x, z) || this.roomFlow.startRoom || null;
      if (flowId !== this.currentFlowRoomId) {
        const from = this.currentFlowRoomId;
        this.previousFlowRoomId = this.currentFlowRoomId;
        this.currentFlowRoomId = flowId;
        this._lastFlowTransitionAt = performance.now() * 0.001;
        if (flowId) {
          this._markFlowRoomVisited(flowId);
          this._checkTraverseObjectives(flowId, opts && opts.levelData);
        }
        this.roomTransitionLog.push({ from, to: flowId, t: this._lastFlowTransitionAt, flow: true });
        if (this.roomTransitionLog.length > _ROOM_LOG_MAX) {
          this.roomTransitionLog.splice(0, this.roomTransitionLog.length - _ROOM_LOG_MAX);
        }
        this.enterFlowRoom(flowId);
      } else if (flowId && !this.flowRoomVisitCounts[flowId]) {
        this._markFlowRoomVisited(flowId);
        this._checkTraverseObjectives(flowId, opts && opts.levelData);
      }
      this._syncCompletedFlowRooms();
      this._updateRoomGates(opts && opts.levelData);
      this.activeRoomGateId = this.getActiveRoomGateId();
    }
    this._tickReinforcementTimers(dt, opts);
  }

  _syncCompletedFlowRooms() {
    if (!this.roomFlow || !this.roomFlow.rooms) return;
    for (const [rid, room] of Object.entries(this.roomFlow.rooms)) {
      if (this.completedFlowRooms[rid]) continue;
      const visited = !!this.flowRoomVisitCounts[rid];
      let complete = false;
      if (room.objectiveId) complete = !!this.objectiveState.completedObjectiveIds[room.objectiveId];
      else if (room.encounterId) complete = !!this.completedEncounterIds[room.encounterId];
      else complete = visited;
      if (complete) this.completedFlowRooms[rid] = true;
    }
  }

  _gateConditionSatisfied(gate) {
    const cond = gate && gate.opensOn;
    if (!cond || !cond.type) return false;
    if (cond.type === 'immediate') return true;
    if (cond.type === 'room_enter') return !!this.flowRoomVisitCounts[cond.roomId] || this.currentFlowRoomId === cond.roomId;
    if (cond.type === 'room_clear') return !!this.completedFlowRooms[cond.roomId];
    if (cond.type === 'encounter_clear') return !!this.completedEncounterIds[cond.encounterId];
    if (cond.type === 'objective_complete') return !!this.objectiveState.completedObjectiveIds[cond.objectiveId];
    return false;
  }

  _markFlowRoomVisited(flowId) {
    if (!flowId) return;
    this.flowRoomVisitCounts[flowId] = (this.flowRoomVisitCounts[flowId] || 0) + 1;
    if (this.flowRoomFirstEnteredAt[flowId] == null) {
      this.flowRoomFirstEnteredAt[flowId] = this._lastFlowTransitionAt || performance.now() * 0.001;
      this.flowRoomVisitOrder.push(flowId);
    }
  }

  _describeGateBlock(gate) {
    const cond = gate && gate.opensOn;
    if (!cond || !cond.type) return 'missing_condition';
    if (cond.type === 'room_enter') return `enter:${cond.roomId}`;
    if (cond.type === 'room_clear') return `clear_room:${cond.roomId}`;
    if (cond.type === 'encounter_clear') return `clear_encounter:${cond.encounterId}`;
    if (cond.type === 'objective_complete') return `objective:${cond.objectiveId}`;
    return cond.type;
  }

  _updateRoomGates(levelData) {
    if (!this.roomFlow || !this.roomFlow.gates) return;
    const byId = levelData && levelData.roomGatesById;
    for (const [gid, gate] of Object.entries(this.roomFlow.gates)) {
      const runtimeGate = byId && byId[gid];
      const alreadyOpen = runtimeGate ? !!runtimeGate.opened : !!(this.roomGateState[gid] && this.roomGateState[gid].opened);
      const canOpen = gate.startsLocked === false || this._gateConditionSatisfied(gate);
      if (canOpen && !alreadyOpen && levelData && typeof levelData.openRoomGate === 'function') {
        levelData.openRoomGate(gid);
      }
      const opened = runtimeGate ? !!runtimeGate.opened : canOpen || alreadyOpen;
      this.roomGateState[gid] = {
        opened,
        blockedReason: opened ? null : this._describeGateBlock(gate),
      };
      this._roomGateBlockReason[gid] = this.roomGateState[gid].blockedReason;
    }
  }

  _isEncounterClearGateReachable(encounterId) {
    if (!encounterId || !this.roomFlow || !this.roomFlow.gates) return false;
    const activeRooms = this.getActiveFlowRoomIds();
    for (const gate of Object.values(this.roomFlow.gates)) {
      if (!gate || !gate.opensOn || gate.opensOn.type !== 'encounter_clear') continue;
      if (gate.opensOn.encounterId !== encounterId) continue;
      if (activeRooms.has(gate.from) || this.flowRoomVisitCounts[gate.from]) return true;
    }
    return false;
  }

  _findLiveEncounterEnemy(enemyMgr, encounterId) {
    if (!encounterId || !enemyMgr || !Array.isArray(enemyMgr._list)) return null;
    for (const e of enemyMgr._list) {
      if (!e || e.dead || e._roomFlowDormant || !e.group || !e.group.position) continue;
      if (e.encounterId === encounterId) return e;
    }
    return null;
  }

  _lockedGateWaypoint(gateId, flow, labelOverride) {
    const gate = gateId && flow && flow.gates ? flow.gates[gateId] : null;
    if (!gate) return null;
    const c = {
      x: (gate.blockingAabb.x0 + gate.blockingAabb.x1) * 0.5,
      z: (gate.blockingAabb.z0 + gate.blockingAabb.z1) * 0.5,
    };
    return {
      type: gate.to === flow.exitRoom ? 'exit_gate' : 'room_gate',
      label: labelOverride || (gate.to === flow.exitRoom ? 'EXIT DOOR' : 'NEXT DOOR'),
      roomId: gate.to,
      gateId,
      x: c.x,
      z: c.z,
    };
  }

  _getLocalLockedGateId(roomId) {
    if (!roomId || !this.roomFlow || !this.roomFlow.rooms || !this.roomFlow.gates) return null;
    const room = this.roomFlow.rooms[roomId];
    const local = room && Array.isArray(room.gatesOut) ? room.gatesOut : [];
    for (const gid of local) {
      const st = this.roomGateState[gid];
      const gate = this.roomFlow.gates[gid];
      if (gate && gate.startsLocked !== false && !(st && st.opened)) return gid;
    }
    return null;
  }

  _isGateRelevantForWaypoint(gate, currentId) {
    if (!gate || !currentId || !this.roomFlow || !this.roomFlow.rooms) return false;
    if (gate.from === currentId || this.flowRoomVisitCounts[gate.from]) return true;
    const current = this.roomFlow.rooms[currentId];
    return !!(current && Array.isArray(current.next) && current.next.includes(gate.from));
  }

  getActiveRoomGateId() {
    if (!this.roomFlow || !this.roomFlow.gates) return null;
    const current = this.currentFlowRoomId || this.roomFlow.startRoom;
    const rooms = this.roomFlow.rooms || {};
    const order = this.roomFlow.roomOrder || Object.keys(rooms);
    const frontier = new Set([current, ...Object.keys(this.flowRoomVisitCounts || {})].filter(Boolean));
    const orderedFrontier = order.filter((rid) => frontier.has(rid));
    for (const rid of orderedFrontier) {
      const room = rooms[rid];
      if (!room || !Array.isArray(room.gatesOut)) continue;
      for (const gid of room.gatesOut) {
        const st = this.roomGateState[gid];
        const gate = this.roomFlow.gates[gid];
        if (gate && gate.startsLocked !== false && !(st && st.opened)) return gid;
      }
    }
    if (!orderedFrontier.includes(current)) {
      const room = rooms[current];
      if (room && Array.isArray(room.gatesOut)) {
        for (const gid of room.gatesOut) {
          const st = this.roomGateState[gid];
          const gate = this.roomFlow.gates[gid];
          if (gate && gate.startsLocked !== false && !(st && st.opened)) return gid;
        }
      }
    }
    return null;
  }

  getRoomProgress() {
    const flow = this.roomFlow;
    if (!flow || !Array.isArray(flow.progressRoomOrder)) return null;
    const total = flow.progressRoomOrder.length;
    let idx = flow.progressRoomOrder.indexOf(this.currentFlowRoomId);
    if (idx < 0 && this.currentFlowRoomId === flow.exitRoom) idx = total - 1;
    if (idx < 0) idx = 0;
    return {
      current: Math.min(total, idx + 1),
      total,
      roomId: this.currentFlowRoomId || flow.startRoom,
    };
  }

  _objectiveWaypointForRoom(roomId, room) {
    if (!room || !room.objectiveId || this.objectiveState.completedObjectiveIds[room.objectiveId]) return null;
    return {
      type: 'objective',
      label: room.objectiveId === 'disable_alarm_panel' ? 'HOLD E: CUT ALARM' : 'OBJECTIVE',
      roomId,
      objectiveId: room.objectiveId,
      x: room.waypoint.x,
      z: room.waypoint.z,
    };
  }

  _firstLiveEnemyInRoom(enemyMgr, roomId) {
    if (!roomId || !enemyMgr || !Array.isArray(enemyMgr._list)) return null;
    for (const e of enemyMgr._list) {
      if (!e || e.dead || e._roomFlowDormant || !e.group || !e.group.position) continue;
      if (e.roomId === roomId) return e;
    }
    return null;
  }

  _nextRoomWaypoint(currentId, current) {
    if (!current || !Array.isArray(current.next) || !current.next.length || !this.roomFlow || !this.roomFlow.rooms) return null;
    const nextId = current.next[0];
    const next = this.roomFlow.rooms[nextId];
    if (!next || !next.waypoint) return null;
    return {
      type: next.kind === 'exit_room' ? 'exit' : 'room_waypoint',
      label: next.kind === 'exit_room' ? 'EXIT' : 'NEXT ROOM',
      roomId: nextId,
      fromRoomId: currentId,
      x: next.waypoint.x,
      z: next.waypoint.z,
    };
  }

  getWaypointTarget(enemyMgr) {
    const flow = this.roomFlow;
    if (!flow || !flow.rooms) return null;
    const currentId = this.currentFlowRoomId || flow.startRoom;
    const current = currentId && flow.rooms[currentId];

    const currentEnemy = this._firstLiveEnemyInRoom(enemyMgr, currentId);
    if (currentEnemy) {
      return {
        type: 'hostile',
        label: 'HOSTILE',
        roomId: currentId,
        x: currentEnemy.group.position.x,
        z: currentEnemy.group.position.z,
      };
    }

    const currentObjective = this._objectiveWaypointForRoom(currentId, current);
    if (currentObjective) return currentObjective;

    const activeRooms = this.getActiveFlowRoomIds();
    for (const rid of activeRooms) {
      if (rid === currentId) continue;
      const room = flow.rooms[rid];
      const e = this._firstLiveEnemyInRoom(enemyMgr, rid);
      if (e) {
        return {
          type: 'hostile',
          label: 'CLEAR HOSTILE',
          roomId: rid,
          x: e.group.position.x,
          z: e.group.position.z,
        };
      }
      const obj = this._objectiveWaypointForRoom(rid, room);
      if (obj) return obj;
    }

    const gateId = this.getActiveRoomGateId();
    const localGateId = this._getLocalLockedGateId(currentId);
    const requiredGateIds = Array.from(new Set([localGateId, gateId].filter(Boolean)));
    for (const gid of requiredGateIds) {
      const gate = flow.gates[gid];
      const cond = gate && gate.opensOn;
      if (!gate || !cond || cond.type !== 'encounter_clear') continue;
      if (gid !== localGateId && !this._isGateRelevantForWaypoint(gate, currentId)) continue;
      const blocker = this._findLiveEncounterEnemy(enemyMgr, cond.encounterId);
      if (!blocker) continue;
      return {
        type: 'hostile',
        label: 'CLEAR HOSTILE',
        roomId: blocker.roomId || gate.from,
        gateId: gid,
        encounterId: cond.encounterId,
        x: blocker.group.position.x,
        z: blocker.group.position.z,
      };
    }

    if (localGateId && flow.gates[localGateId]) {
      return this._lockedGateWaypoint(localGateId, flow);
    }
    if (gateId && flow.gates[gateId]) {
      const gate = flow.gates[gateId];
      if (gate.from === currentId || this.flowRoomVisitCounts[gate.from]) {
        return this._lockedGateWaypoint(gateId, flow);
      }
    }

    const completed = !!(
      current &&
      (this.completedFlowRooms[currentId] ||
        (current.objectiveId && this.objectiveState.completedObjectiveIds[current.objectiveId]) ||
        (current.encounterId && this.completedEncounterIds[current.encounterId]))
    );
    if (completed) {
      const nextWp = this._nextRoomWaypoint(currentId, current);
      if (nextWp) return nextWp;
    }
    if (current && current.waypoint) {
      return {
        type: current.kind === 'exit_room' ? 'exit' : 'room_waypoint',
        label: current.kind === 'exit_room' ? 'EXIT' : 'NEXT ROOM',
        roomId: currentId,
        x: current.waypoint.x,
        z: current.waypoint.z,
      };
    }
    return null;
  }

  getActiveFlowRoomIds() {
    const flow = this.roomFlow;
    const out = new Set();
    if (!flow || !flow.rooms) return out;
    const rooms = flow.rooms;
    const seed = this.currentFlowRoomId || flow.startRoom;
    if (seed) out.add(seed);
    for (const rid of this.flowRoomVisitOrder) out.add(rid);

    const addImmediateReachable = (rid) => {
      const room = rid && rooms[rid];
      if (!room) return;
      for (const gid of room.gatesOut || []) {
        const gate = flow.gates && flow.gates[gid];
        const st = this.roomGateState[gid];
        if (gate && (gate.startsLocked === false || (st && st.opened))) out.add(gate.to);
      }
      for (const nextId of room.next || []) {
        const gate = Object.values(flow.gates || {}).find((g) => g.from === rid && g.to === nextId);
        if (!gate || gate.startsLocked === false || (this.roomGateState[gate.id] && this.roomGateState[gate.id].opened)) {
          out.add(nextId);
        }
      }
    };

    for (const rid of Array.from(out)) addImmediateReachable(rid);
    return out;
  }

  applyRoomEnemyActivation(enemyMgr) {
    if (!this.roomFlow || !enemyMgr || !Array.isArray(enemyMgr._list)) return;
    const activeRooms = this.getActiveFlowRoomIds();
    for (const e of enemyMgr._list) {
      if (!e || e.dead || !e.roomId || !this.roomFlow.rooms[e.roomId]) continue;
      const active = activeRooms.has(e.roomId);
      e._roomFlowDormant = !active;
      if (e.group) e.group.visible = active;
      if (!active) {
        e.lastKnownPos = null;
        e.alertTimer = 0;
        e.alertFlashTimer = 0;
      }
    }
  }

  /**
   * @param {string|null} roomId
   * @param {object|null} levelData
   */
  _checkTraverseObjectives(roomId, levelData) {
    if (!roomId || !this._traverseObjectiveSpecs || !this._traverseObjectiveSpecs.length) return;
    for (const spec of this._traverseObjectiveSpecs) {
      const sid = spec && spec.id;
      if (!sid || this.objectiveState.completedObjectiveIds[sid]) continue;
      if (spec.roomId !== roomId) continue;
      this.objectiveState.completedObjectiveIds[sid] = true;
      this.lastTrigger = {
        type: 'traverse_objective',
        id: sid,
        room: roomId,
        t: performance.now() * 0.001,
      };
      this.tryOpenZoneDoorForObjective(levelData || null, sid);
    }
  }

  _tickReinforcementTimers(dt, opts) {
    const alarmOn = !!(opts && opts.alarmSystem);
    let relaySec = 0;
    for (const spec of this._reinforcementTimerSpecs) {
      const key = spec.fireKey;
      if (this.reinforcementsFired[key]) continue;
      if (spec.requireAlarm && !alarmOn) {
        this._reinforceTimers[key] = 0;
        continue;
      }
      if (this.objectiveState.alarmPanelDisabled && /_alarm_pair$/.test(String(key))) {
        continue;
      }
      const effectiveRoom = _parentRoomId(this.currentRoomId, this.floorplan);
      const effectiveFlowRoom = this.currentFlowRoomId;
      if (this.currentRoomId !== spec.roomId && effectiveRoom !== spec.roomId && effectiveFlowRoom !== spec.roomId) {
        this._reinforceTimers[key] = 0;
        continue;
      }
      const acc = (this._reinforceTimers[key] || 0) + dt;
      this._reinforceTimers[key] = acc;
      if (spec.roomId === 'alarm_relay_room') relaySec = Math.max(relaySec, acc);
      if (acc >= spec.afterSec) {
        this.reinforcementsFired[key] = true;
        this._reinforcementQueue.push({ squad: spec.squad, entry: spec.entry || null });
        this.lastTrigger = {
          type: 'reinforcement_queued',
          id: spec.squad,
          t: performance.now() * 0.001,
        };
      }
    }
    this.objectiveState.secondsInRelayRoom = relaySec;
  }

  /** @returns {{ squad: string, entry: string|null }|null} */
  drainReinforcementSpawnRequest() {
    return this._reinforcementQueue.length ? this._reinforcementQueue.shift() : null;
  }

  /**
   * Data-driven hold-E objectives (`director.objectives`).
   * @returns {string|null} relayEvent or 'objective_complete'
   */
  tickObjectives(dt, player, input) {
    if (!player || !player.pos || !this._holdObjectiveSpecs.length) {
      this.objectiveState.alarmPanelHold = 0;
      return null;
    }
    const solids = input && input.levelSolids;
    const alarmOn = !!(input && input.alarmSystem);
    for (const spec of this._holdObjectiveSpecs) {
      const sid = spec.id;
      if (!sid || this.objectiveState.completedObjectiveIds[sid]) continue;
      if (spec.requireAlarmSystem && !alarmOn) continue;
      const meshId = spec.meshObjectiveId || spec.objectiveMeshId;
      if (!meshId) continue;
      const holdSec = Number.isFinite(spec.holdSec) ? spec.holdSec : 1.15;
      const radius = Number.isFinite(spec.interactRadius) ? spec.interactRadius : 1.42;
      const meshes = this._collectMeshesByObjectiveId(solids, meshId);
      if (!meshes.length) {
        this._setHoldProgress(spec, 0);
        continue;
      }
      const px = player.pos.x;
      const pz = player.pos.z;
      let near = false;
      for (const m of meshes) {
        m.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        m.getWorldPosition(v);
        const dx = px - v.x;
        const dz = pz - v.z;
        if (dx * dx + dz * dz < radius * radius) {
          near = true;
          break;
        }
      }
      if (near && input && input.keyE) {
        const next = this._getHoldProgress(spec) + dt / holdSec;
        this._setHoldProgress(spec, next);
        if (next >= 1) {
          return this._completeHoldObjective(spec, solids, input && input.levelData);
        }
      } else {
        this._setHoldProgress(spec, this._getHoldProgress(spec) * Math.exp(-dt * 4));
      }
    }
    return null;
  }

  _getHoldProgress(spec) {
    if (spec.id === 'disable_alarm_panel') return this.objectiveState.alarmPanelHold || 0;
    return spec._holdProg || 0;
  }

  _setHoldProgress(spec, v) {
    if (spec.id === 'disable_alarm_panel') this.objectiveState.alarmPanelHold = v;
    spec._holdProg = v;
  }

  /**
   * @returns {string|null}
   */
  _completeHoldObjective(spec, solids, levelData) {
    const sid = spec.id;
    if (!sid || this.objectiveState.completedObjectiveIds[sid]) return null;
    this.objectiveState.completedObjectiveIds[sid] = true;
    this._setHoldProgress(spec, 1);
    if (spec.meshObjectiveId === 'alarm_panel' || sid === 'disable_alarm_panel') {
      this.objectiveState.alarmPanelDisabled = true;
      this.applyAlarmPanelDisabledVisuals(solids);
    }
    this.lastTrigger = { type: 'objective', id: sid, t: performance.now() * 0.001 };
    if (spec.completeEncounterId) this.completeEncounter(spec.completeEncounterId);
    const clear = spec.clearReinforcementSquads;
    if (Array.isArray(clear) && clear.length) {
      const drop = new Set(clear);
      this._reinforcementQueue = this._reinforcementQueue.filter((item) => {
        const sq = item && typeof item === 'object' ? item.squad : item;
        return !drop.has(sq);
      });
    }
    this.tryOpenZoneDoorForObjective(levelData || null, sid);
    if (spec.relayEvent) return spec.relayEvent;
    return 'objective_complete';
  }

  /** @returns {string|null} */
  tickAlarmPanelInteract(dt, player, input) {
    return this.tickObjectives(dt, player, input);
  }

  /**
   * @param {object[]|null|undefined} solids
   */
  _collectMeshesByObjectiveId(solids, meshObjectiveId) {
    const out = [];
    if (!meshObjectiveId || !Array.isArray(solids)) return out;
    for (const o of solids) {
      if (o && o.isMesh && o.userData && o.userData.objectiveId === meshObjectiveId) {
        out.push(o);
      }
    }
    return out;
  }

  /** Dim panel emissive after hack. */
  applyAlarmPanelDisabledVisuals(solids) {
    const meshes = this._collectMeshesByObjectiveId(solids, 'alarm_panel');
    for (const m of meshes) {
      const mat = m.material;
      const arr = Array.isArray(mat) ? mat : [mat];
      for (const mm of arr) {
        if (mm && 'emissiveIntensity' in mm) mm.emissiveIntensity = 0.22;
      }
    }
  }

  /**
   * @param {null|{ _list?: unknown[] }} [enemyMgr]
   */
  snapshot(enemyMgr) {
    let activeEncounter = null;
    const encId = this.activeEncounterIdForced || this.activeEncounterId;
    if (encId && this.encountersCatalog) {
      const e = this.encountersCatalog.find((x) => x && x.id === encId);
      if (e) {
        activeEncounter = {
          id: e.id,
          room: e.room,
          label: e.label || null,
          objective: e.objective || null,
          completion: e.completion || null,
        };
      }
    }
    /** @type {Record<string, number>|null} */
    let aliveByRole = null;
    /** @type {Record<string, number>|null} */
    let aliveByRoom = null;
    const list = enemyMgr && enemyMgr._list;
    if (Array.isArray(list)) {
      aliveByRole = Object.create(null);
      aliveByRoom = Object.create(null);
      for (const e of list) {
        if (!e || e.dead || e._roomFlowDormant) continue;
        const role = e.encounterRole || e.type || 'unknown';
        aliveByRole[role] = (aliveByRole[role] || 0) + 1;
        let room = e.roomId;
        if (!room && this.floorplan && e.group && e.group.position) {
          room = pickFloorplanSpaceId(e.group.position.x, e.group.position.z, this.floorplan);
        }
        const rk = room || 'unassigned';
        aliveByRoom[rk] = (aliveByRoom[rk] || 0) + 1;
      }
    }
    return {
      floorplanActive: !!this.floorplan,
      currentRoom: this.currentRoomId,
      previousRoom: this.previousRoomId,
      lastRoomTransitionAt: this._lastTransitionAt,
      roomTransitionLog: this.roomTransitionLog.slice(),
      roomVisited: Object.keys(this.roomVisitCounts),
      roomVisitCounts: { ...this.roomVisitCounts },
      roomFirstEnteredAt: { ...this.roomFirstEnteredAt },
      roomFlow: this.debugRoomFlow(enemyMgr),
      activeEncounter,
      activeEncounterIdForced: this.activeEncounterIdForced,
      objectiveState: { ...this.objectiveState, completedObjectiveIds: { ...this.objectiveState.completedObjectiveIds } },
      aliveByRole,
      aliveByRoom,
      reinforcementsFired: { ...this.reinforcementsFired },
      reinforcementsQueued: this._reinforcementQueue.slice(),
      lockedDoors: { ...this.lockedDoors },
      lastTrigger: this.lastTrigger ? { ...this.lastTrigger } : null,
      completedEncounters: Object.keys(this.completedEncounterIds),
      encounterSpawned: { ...this._encounterSpawned },
      zoneDoorBlockReason: { ...this._zoneDoorBlockReason },
    };
  }

  debugRoomFlow(enemyMgr) {
    const flow = this.roomFlow;
    if (!flow) return { active: false };
    const current = this.currentFlowRoomId || flow.startRoom || null;
    const room = current && flow.rooms ? flow.rooms[current] : null;
    const gateId = this.getActiveRoomGateId();
    const gate = gateId && flow.gates ? flow.gates[gateId] : null;
    const nextRoom = gate ? gate.to : room && Array.isArray(room.next) ? room.next[0] || null : null;
    const dormantByRoom = Object.create(null);
    const activeByRoom = Object.create(null);
    const list = enemyMgr && Array.isArray(enemyMgr._list) ? enemyMgr._list : [];
    for (const e of list) {
      if (!e || e.dead) continue;
      const rid = e.roomId || 'unassigned';
      if (e._roomFlowDormant) dormantByRoom[rid] = (dormantByRoom[rid] || 0) + 1;
      else activeByRoom[rid] = (activeByRoom[rid] || 0) + 1;
    }
    return {
      active: true,
      building: this.building,
      label: flow.label,
      currentFlowRoom: current,
      previousFlowRoom: this.previousFlowRoomId,
      currentKind: room ? room.kind : null,
      activeGate: gate
        ? {
            id: gate.id,
            from: gate.from,
            to: gate.to,
            label: gate.label || null,
            opened: !!(this.roomGateState[gate.id] && this.roomGateState[gate.id].opened),
            blockedReason: this.roomGateState[gate.id] ? this.roomGateState[gate.id].blockedReason : null,
          }
        : null,
      nextRoom,
      activeEncounter: room ? room.encounterId || null : null,
      blockedReason: gate && this.roomGateState[gate.id] ? this.roomGateState[gate.id].blockedReason : null,
      completedFlowRooms: Object.keys(this.completedFlowRooms),
      roomVisitOrder: this.flowRoomVisitOrder.slice(),
      roomGateState: { ...this.roomGateState },
      roomProgress: this.getRoomProgress(),
      activeByRoom,
      dormantByRoom,
    };
  }
}
