/**
 * Campaign encounter runtime: floorplan room, active encounter, objectives,
 * reinforcement queue, zone-door policy, debug snapshot.
 */
import * as THREE from 'three';
import { collectAlarmReinforcementSpecs, getHoldInteractObjectives, getTraverseRoomObjectives } from './campaignObjectives.js';

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
    this.encounterDef = null;
    this.building = null;
    this.encountersCatalog = null;
    this.currentRoomId = null;
    this.previousRoomId = null;
    this.activeEncounterId = null;
    this.roomVisitCounts = Object.create(null);
    this.roomFirstEnteredAt = Object.create(null);
    this._lastTransitionAt = null;
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
    this.encountersCatalog = def && Array.isArray(def.encounters) ? def.encounters : null;
    this.building = building;
    this.currentRoomId = null;
    this.previousRoomId = null;
    this.activeEncounterId = null;
    this.roomVisitCounts = Object.create(null);
    this.roomFirstEnteredAt = Object.create(null);
    this._lastTransitionAt = null;
    this.roomTransitionLog = [];
    this._reinforcementQueue = [];
    this.reinforcementsFired = Object.create(null);
    this.completedEncounterIds = Object.create(null);
    this.objectiveState = {
      alarmPanelDisabled: false,
      alarmPanelHold: 0,
      secondsInRelayRoom: 0,
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
      if (!this._encounterSpawned[enc.id]) continue;
      let alive = 0;
      for (const e of enemyMgr._list) {
        if (!e || e.dead) continue;
        if (e.encounterId === enc.id) alive++;
      }
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
    if (!this.floorplan || !player || !player.pos) return;
    const x = player.pos.x;
    const z = player.pos.z;
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
    this._tickReinforcementTimers(dt, opts);
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
      if (this.currentRoomId !== spec.roomId && effectiveRoom !== spec.roomId) {
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
        if (!e || e.dead) continue;
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
}
