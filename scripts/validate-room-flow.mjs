import { CAMPAIGN_ROOM_FLOWS, ROOM_FLOW_COMBAT_KINDS } from '../src/campaignRoomFlows.js';
import { CAMPAIGN_ENCOUNTERS } from '../src/campaignEncounters.js';

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function label(building) {
  return `B${String(building).padStart(2, '0')}`;
}

function centerOfAabb(aabb) {
  return {
    x: (aabb.x0 + aabb.x1) * 0.5,
    z: (aabb.z0 + aabb.z1) * 0.5,
  };
}

function dist2d(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function isFiniteBounds(b) {
  return b && [b.x0, b.x1, b.z0, b.z1].every((n) => Number.isFinite(n)) && b.x1 > b.x0 && b.z1 > b.z0;
}

function validateGateOpenCondition(lab, gate, encounterIds, roomIds) {
  const cond = gate.opensOn;
  if (!cond || typeof cond !== 'object' || !cond.type) {
    fail(`${lab} gate ${gate.id}: opensOn must be an object with type`);
    return;
  }
  if (cond.type === 'encounter_clear') {
    if (!cond.encounterId || !encounterIds.has(cond.encounterId)) {
      fail(`${lab} gate ${gate.id}: encounter_clear references unknown encounter ${JSON.stringify(cond.encounterId)}`);
    }
  } else if (cond.type === 'objective_complete') {
    if (!cond.objectiveId) fail(`${lab} gate ${gate.id}: objective_complete missing objectiveId`);
  } else if (cond.type === 'room_enter' || cond.type === 'room_clear') {
    if (!cond.roomId || !roomIds.has(cond.roomId)) {
      fail(`${lab} gate ${gate.id}: ${cond.type} references unknown room ${JSON.stringify(cond.roomId)}`);
    }
  } else if (cond.type !== 'immediate') {
    fail(`${lab} gate ${gate.id}: unsupported opensOn.type ${JSON.stringify(cond.type)}`);
  }
}

function validateFlow(building) {
  const lab = label(building);
  const flow = CAMPAIGN_ROOM_FLOWS[building];
  const encDef = CAMPAIGN_ENCOUNTERS[building];
  if (!flow) {
    fail(`${lab}: missing CAMPAIGN_ROOM_FLOWS entry`);
    return;
  }
  if (!encDef) {
    fail(`${lab}: missing CAMPAIGN_ENCOUNTERS entry`);
    return;
  }

  const rooms = flow.rooms || {};
  const gates = flow.gates || {};
  const roomIds = new Set(Object.keys(rooms));
  const gateIds = new Set(Object.keys(gates));
  const encounters = Array.isArray(encDef.encounters) ? encDef.encounters : [];
  const encounterIds = new Set(encounters.map((e) => e && e.id).filter(Boolean));

  if (!flow.startRoom || !roomIds.has(flow.startRoom)) fail(`${lab}: startRoom missing or unknown`);
  if (!flow.exitRoom || !roomIds.has(flow.exitRoom)) fail(`${lab}: exitRoom missing or unknown`);
  if (!Array.isArray(flow.roomOrder) || flow.roomOrder.length < 6) fail(`${lab}: roomOrder must include at least 6 rooms`);
  if (roomIds.size < 6) fail(`${lab}: needs at least 6 authored room nodes`);
  if (gateIds.size < 4) fail(`${lab}: needs at least 4 physical room gates or thresholds`);

  let connectorCount = 0;
  let previewCount = 0;
  let sideLoopCount = 0;
  let signatureCount = 0;
  const pacingTags = new Set();

  for (const [id, room] of Object.entries(rooms)) {
    if (!room || typeof room !== 'object') {
      fail(`${lab} room ${id}: invalid room object`);
      continue;
    }
    if (room.id !== id) fail(`${lab} room ${id}: id field must match key`);
    if (room.building !== building) fail(`${lab} room ${id}: building field must be ${building}`);
    if (!isFiniteBounds(room.bounds)) fail(`${lab} room ${id}: invalid bounds`);
    if (!room.kind) fail(`${lab} room ${id}: missing kind`);
    if (!room.purpose || String(room.purpose).trim().length < 12) fail(`${lab} room ${id}: missing gameplay purpose`);
    if (!room.readabilityCue || String(room.readabilityCue).trim().length < 12) fail(`${lab} room ${id}: missing readabilityCue`);
    if (!room.pacingTag) fail(`${lab} room ${id}: missing pacingTag`);
    if (room.pacingTag) pacingTags.add(room.pacingTag);
    if (!room.waypoint || !Number.isFinite(room.waypoint.x) || !Number.isFinite(room.waypoint.z)) {
      fail(`${lab} room ${id}: missing finite waypoint`);
    }
    if (!Number.isFinite(room.visibilityBudgetM) || room.visibilityBudgetM <= 0) {
      fail(`${lab} room ${id}: visibilityBudgetM must be positive`);
    }
    if (!Array.isArray(room.next)) {
      fail(`${lab} room ${id}: next must be an array`);
    } else {
      for (const nextId of room.next) {
        if (!roomIds.has(nextId)) fail(`${lab} room ${id}: next references unknown room ${nextId}`);
      }
    }
    if (!Array.isArray(room.gatesOut)) {
      fail(`${lab} room ${id}: gatesOut must be an array`);
    } else {
      for (const gateId of room.gatesOut) {
        if (!gateIds.has(gateId)) fail(`${lab} room ${id}: gatesOut references unknown gate ${gateId}`);
      }
    }
    if (room.encounterId && !encounterIds.has(room.encounterId)) {
      fail(`${lab} room ${id}: encounterId ${room.encounterId} does not resolve`);
    }
    if (ROOM_FLOW_COMBAT_KINDS.includes(room.kind) && !room.choreography) {
      fail(`${lab} room ${id}: combat room missing choreography`);
    }
    if (room.choreography) {
      for (const key of ['firstContact', 'firstShotAngle', 'playerCover', 'enemyCover', 'enemyReaction', 'clearChange', 'exitReveal']) {
        if (!room.choreography[key]) fail(`${lab} room ${id}: choreography missing ${key}`);
      }
    }
    if (room.kind === 'connector_hall' || /connector|hall|threshold/i.test(room.kind)) connectorCount++;
    if (room.previewRead || /peek|preview|glass|slit|threshold|vestibule/i.test(`${room.kind} ${room.readabilityCue}`)) previewCount++;
    if (room.sideLoop || /flank|loop/i.test(`${room.kind} ${room.purpose}`)) sideLoopCount++;
    if (room.kind === 'signature_room') signatureCount++;
  }

  if (connectorCount < 2) fail(`${lab}: needs at least 2 connector hallways/read connectors`);
  if (previewCount < 2) fail(`${lab}: needs at least 2 glass/partial pre-reads`);
  if (sideLoopCount < 1) fail(`${lab}: needs at least 1 quick reconnecting side loop`);
  if (signatureCount < 1) fail(`${lab}: needs 1 signature final room`);

  for (const [id, gate] of Object.entries(gates)) {
    if (!gate || typeof gate !== 'object') {
      fail(`${lab} gate ${id}: invalid gate object`);
      continue;
    }
    if (gate.id !== id) fail(`${lab} gate ${id}: id field must match key`);
    if (!roomIds.has(gate.from)) fail(`${lab} gate ${id}: unknown from room ${gate.from}`);
    if (!roomIds.has(gate.to)) fail(`${lab} gate ${id}: unknown to room ${gate.to}`);
    if (!gate.meshId) fail(`${lab} gate ${id}: missing meshId`);
    if (!gate.label) fail(`${lab} gate ${id}: missing label`);
    if (!isFiniteBounds(gate.blockingAabb)) fail(`${lab} gate ${id}: invalid blockingAabb`);
    validateGateOpenCondition(lab, gate, encounterIds, roomIds);
  }

  for (const enc of encounters) {
    if (!enc || !enc.id) continue;
    if (enc.room && !roomIds.has(enc.room)) {
      fail(`${lab}: encounter ${enc.id} room ${enc.room} is not a flow room`);
    }
    for (const enemy of enc.enemies || []) {
      if (!enemy || !enemy.id) continue;
      if (!enemy.roomId || !roomIds.has(enemy.roomId)) fail(`${lab}: enemy ${enemy.id} missing/unknown flow roomId`);
      if (!enemy.role) fail(`${lab}: enemy ${enemy.id} missing role`);
      if (!enemy.behavior) fail(`${lab}: enemy ${enemy.id} missing behavior`);
      if (!enemy.cover && !enemy.coverHint) fail(`${lab}: enemy ${enemy.id} missing cover/coverHint`);
    }
  }

  const spawnGroups = encDef.authoredSpawns || {};
  for (const [groupName, rows] of Object.entries(spawnGroups)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || !row.id) continue;
      if (!row.roomId || !roomIds.has(row.roomId)) fail(`${lab}: authoredSpawns.${groupName} ${row.id} missing/unknown flow roomId`);
      if (!row.role) fail(`${lab}: authoredSpawns.${groupName} ${row.id} missing role`);
    }
  }

  if (building === 1) {
    const firstGate = gates.b01_intake_to_service;
    if (!firstGate) {
      fail('B01: missing b01_intake_to_service first internal gate');
    } else {
      const d = dist2d({ x: 0, z: 18 }, centerOfAabb(firstGate.blockingAabb));
      if (d < 8 || d > 12) fail(`B01: first internal gate must be 8-12m from deploy, got ${d.toFixed(2)}m`);
    }
    const startAllowed = new Set(['b01_entry_vestibule', 'b01_intake_peek']);
    const frontRows = spawnGroups.frontZone || [];
    for (const row of frontRows) {
      if (!startAllowed.has(row.roomId)) fail(`B01: active front enemy ${row.id} starts outside the first controlled rooms (${row.roomId})`);
    }
    if (!pacingTags.has('safe_orientation')) fail('B01: missing safe_orientation pacing tag');
    if (!pacingTags.has('first_contact')) fail('B01: missing first_contact pacing tag');
    if (!pacingTags.has('recovery_connector')) fail('B01: missing recovery_connector pacing tag');
    if (!pacingTags.has('objective_pressure')) fail('B01: missing objective_pressure pacing tag');
    if (!pacingTags.has('flank_complication')) fail('B01: missing flank_complication pacing tag');
    if (!pacingTags.has('anticipation')) fail('B01: missing anticipation pacing tag');
    if (!pacingTags.has('signature_escalation')) fail('B01: missing signature_escalation pacing tag');
  }

  if (!flow.signatureRule || String(flow.signatureRule).trim().length < 24) {
    warn(`${lab}: signatureRule is short; make sure the final room rule is distinct`);
  }
}

for (let building = 1; building <= 12; building++) validateFlow(building);

for (const w of warnings) console.warn(w);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('validate-room-flow: OK (12 authored room graphs, gates, encounters, B01 acceptance constraints)');
