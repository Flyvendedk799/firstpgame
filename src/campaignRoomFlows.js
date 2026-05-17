const FLOW_LAYOUT_BY_BN = Object.freeze([0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0]);

export const ROOM_FLOW_COMBAT_KINDS = Object.freeze([
  'peek_room',
  'objective_room',
  'flank_room',
  'signature_room',
]);

const ROOM_BOXES = Object.freeze({
  entry_vestibule: { x0: -4.4, x1: 4.4, z0: 16.6, z1: 23.6 },
  intake_peek: { x0: -7.8, x1: 7.8, z0: 8.65, z1: 16.9 },
  service_hall: { x0: 2.2, x1: 8.8, z0: 2.4, z1: 9.1 },
  relay_approach: { x0: -7.4, x1: 7.4, z0: -2.4, z1: 4.8 },
  alarm_relay: { x0: -18.0, x1: -7.4, z0: -6.2, z1: 5.2 },
  drum_flank: { x0: -7.4, x1: 18.0, z0: -6.4, z1: 4.8 },
  cage_vestibule: { x0: -7.4, x1: 0.8, z0: -13.2, z1: -5.8 },
  relay_cage: { x0: -9.2, x1: 18.0, z0: -25.4, z1: -12.8 },
  exit_door: { x0: -2.8, x1: 2.8, z0: -29.5, z1: -24.4 },
});

const ROOM_BASE = Object.freeze({
  entry_vestibule: {
    kind: 'entry_room',
    parentZone: 0,
    visibilityBudgetM: 7,
    pacingTag: 'safe_orientation',
    waypoint: { x: 0, z: 16.9 },
  },
  intake_peek: {
    kind: 'peek_room',
    parentZone: 0,
    encounterSuffix: 'intake_peek_clear',
    visibilityBudgetM: 8,
    pacingTag: 'first_contact',
    waypoint: { x: 5, z: 9.1 },
  },
  service_hall: {
    kind: 'connector_hall',
    parentZone: 0,
    visibilityBudgetM: 6,
    pacingTag: 'recovery_connector',
    waypoint: { x: 5.2, z: 5.7 },
  },
  relay_approach: {
    kind: 'threshold_room',
    parentZone: 1,
    encounterSuffix: 'relay_approach_clear',
    visibilityBudgetM: 9,
    pacingTag: 'tension_build',
    waypoint: { x: 0.4, z: 1.4 },
  },
  alarm_relay: {
    kind: 'objective_room',
    parentZone: 1,
    encounterSuffix: 'alarm_relay',
    objectiveId: 'disable_alarm_panel',
    visibilityBudgetM: 7,
    pacingTag: 'objective_pressure',
    waypoint: { x: -14, z: 1.2 },
  },
  drum_flank: {
    kind: 'flank_room',
    parentZone: 1,
    encounterSuffix: 'drum_flank_clear',
    sideLoop: true,
    visibilityBudgetM: 7,
    pacingTag: 'flank_complication',
    waypoint: { x: 14.2, z: -2.0 },
  },
  cage_vestibule: {
    kind: 'threshold_room',
    parentZone: 2,
    visibilityBudgetM: 6,
    pacingTag: 'anticipation',
    waypoint: { x: -4.8, z: -10.8 },
  },
  relay_cage: {
    kind: 'signature_room',
    parentZone: 2,
    encounterSuffix: 'relay_cage_clear',
    visibilityBudgetM: 10,
    pacingTag: 'signature_escalation',
    scenarioType: 'multi_angle_cage_with_reachable_overlook',
    hallwayType: 'wide_signature_room_plus_side_overlook',
    subAreas: ['threshold cage', 'central relay cover', 'east foreman overlook', 'back-lit exit lane'],
    waypoint: { x: 0, z: -18.6 },
  },
  exit_door: {
    kind: 'exit_room',
    parentZone: 2,
    visibilityBudgetM: 5,
    pacingTag: 'exit_release',
    scenarioType: 'post_combat_release',
    hallwayType: 'short_exit_throat',
    waypoint: { x: 0, z: -27.2 },
  },
});

const FLOW_PACKETS = Object.freeze({
  1: {
    label: 'B01 Loading Dock',
    identity: 'service vestibule -> intake peek -> relay office -> cage',
    names: {
      entry_vestibule: 'Spawn vestibule',
      intake_peek: 'Intake peek room',
      service_hall: 'West service hall / east flank preview',
      relay_approach: 'Relay approach',
      alarm_relay: 'Alarm relay office',
      drum_flank: 'Drum flank pressure',
      cage_vestibule: 'Cage vestibule',
      relay_cage: 'Relay cage signature room',
      exit_door: 'Exit cage door',
    },
    cues: {
      entry_vestibule: 'One warm dock-threshold light and hazard stripe pull the player off spawn.',
      intake_peek: 'A lookout silhouette is visible through a partial intake angle, with safe cover one step left.',
      service_hall: 'Cool service strip compresses movement and previews the relay glow through glass.',
      relay_approach: 'Amber desk light and the alarm-panel glow dominate the next threshold.',
      alarm_relay: 'The relay console is readable before entry but only safe after the desk anchor drops.',
      drum_flank: 'Red drums and a return-loop shadow mark the flanker route back toward the relay.',
      cage_vestibule: 'Rails and glass show the heavy in fragments before full commitment.',
      relay_cage: 'The cage landmark opens into a wider fight with catwalk pressure and a centered exit read.',
      exit_door: 'The final door sits in the cage back-light after the signature room is solved.',
    },
    purposes: {
      entry_vestibule: 'Orient safely and teach the single primary threshold.',
      intake_peek: 'Deliver the first deliberate peek contact without exposing the rest of the level.',
      service_hall: 'Provide a short recovery dogleg and controlled side preview.',
      relay_approach: 'Build tension at the office threshold with one held angle.',
      alarm_relay: 'Force the player to clear the desk before holding the alarm relay.',
      drum_flank: 'Wake a side-loop flanker after the relay beat so the room reconnects under pressure.',
      cage_vestibule: 'Create a quiet pre-read of the final cage.',
      relay_cage: 'Escalate into the multi-angle final fight.',
      exit_door: 'Release the player only after the authored final room is clear.',
    },
    signatureRule: 'Heavy is glimpsed through cage rails before the catwalk overwatch joins the commitment.',
  },
  2: {
    label: 'B02 Continental Lobby',
    identity: 'lobby vestibule -> coat check -> concierge/security -> manager suite',
    names: {
      entry_vestibule: 'Lobby vestibule',
      intake_peek: 'Coat-check peek',
      service_hall: 'Salon service hall',
      relay_approach: 'Concierge approach',
      alarm_relay: 'Security relay desk',
      drum_flank: 'Salon flank pocket',
      cage_vestibule: 'Manager-suite threshold',
      relay_cage: 'Manager suite',
      exit_door: 'Service elevator exit',
    },
    signatureRule: 'Manager bodyguard holds a velvet suite while a mezzanine silhouette previews the last angle.',
  },
  3: {
    label: 'B03 Nightclub',
    identity: 'queue -> bar/coat check -> dance pit -> VIP/DJ -> mirrored lounge',
    names: {
      entry_vestibule: 'Queue vestibule',
      intake_peek: 'Coat-check peek',
      service_hall: 'Bar service hall',
      relay_approach: 'Dance-pit approach',
      alarm_relay: 'DJ relay booth',
      drum_flank: 'VIP flank pocket',
      cage_vestibule: 'Mirror-lounge threshold',
      relay_cage: 'Mirrored lounge',
      exit_door: 'Backstage exit',
    },
    signatureRule: 'Mirror reads multiply the target silhouette while VIP pressure enters through a short side loop.',
  },
  4: {
    label: 'B04 Penthouse',
    identity: 'elevator foyer -> reception -> gallery/office -> wine/study -> suite',
    names: {
      entry_vestibule: 'Elevator foyer',
      intake_peek: 'Reception peek',
      service_hall: 'Gallery service hall',
      relay_approach: 'Office approach',
      alarm_relay: 'Gallery relay console',
      drum_flank: 'Wine-study flank',
      cage_vestibule: 'Suite threshold',
      relay_cage: 'Master suite',
      exit_door: 'Facade stair exit',
    },
    signatureRule: 'Glass crown previews the underboss before the suite widens around gold cover.',
  },
  5: {
    label: 'B05 Sterling Medical',
    identity: 'triage -> pharmacy/patient hall -> nurse relay -> surgery theater',
    names: {
      entry_vestibule: 'Triage vestibule',
      intake_peek: 'Pharmacy peek',
      service_hall: 'Patient connector hall',
      relay_approach: 'Nurse-station approach',
      alarm_relay: 'Nurse relay',
      drum_flank: 'Patient curtain flank',
      cage_vestibule: 'Surgery scrub threshold',
      relay_cage: 'Surgery theater',
      exit_door: 'Sterile exit',
    },
    signatureRule: 'Observation glass previews the theater anchor while curtains hide the reconnecting flank.',
  },
  6: {
    label: 'B06 Subway Line 7',
    identity: 'turnstile -> platform tunnel -> power closet -> switch chamber',
    names: {
      entry_vestibule: 'Turnstile vestibule',
      intake_peek: 'Platform peek',
      service_hall: 'Track service hall',
      relay_approach: 'Power-closet approach',
      alarm_relay: 'Power relay closet',
      drum_flank: 'Locker flank pocket',
      cage_vestibule: 'Switch-chamber threshold',
      relay_cage: 'Switch chamber',
      exit_door: 'Tunnel exit',
    },
    signatureRule: 'Switch chamber opens under red rail glow while dispatch glass reveals the overwatch.',
  },
  7: {
    label: 'B07 Azure Yacht',
    identity: 'aft deck -> salon cabin -> galley/stateroom -> bridge/owner suite',
    names: {
      entry_vestibule: 'Aft-deck vestibule',
      intake_peek: 'Salon-cabin peek',
      service_hall: 'Galley connector',
      relay_approach: 'Nav-relay approach',
      alarm_relay: 'Navigation relay',
      drum_flank: 'Stateroom flank',
      cage_vestibule: 'Owner-suite threshold',
      relay_cage: 'Bridge owner suite',
      exit_door: 'Bridge wing exit',
    },
    signatureRule: 'Bridge glass previews the owner suite while the narrow deck makes the last push decisive.',
  },
  8: {
    label: 'B08 Server Farm Delta',
    identity: 'mantrap -> cold aisle -> patch crawl -> ops relay -> core vault',
    names: {
      entry_vestibule: 'Mantrap vestibule',
      intake_peek: 'Cold-aisle peek',
      service_hall: 'Patch crawl hall',
      relay_approach: 'Ops approach',
      alarm_relay: 'Ops relay',
      drum_flank: 'Hot-aisle flank',
      cage_vestibule: 'Core-vault threshold',
      relay_cage: 'Core vault',
      exit_door: 'Data-core exit',
    },
    signatureRule: 'Core vault glass reveals the final guard while server aisles constrain every angle.',
  },
  9: {
    label: 'B09 Border Crossing',
    identity: 'inspection booth -> customs gate -> vehicle search -> tower/customs',
    names: {
      entry_vestibule: 'Inspection vestibule',
      intake_peek: 'Customs-gate peek',
      service_hall: 'Vehicle-search hall',
      relay_approach: 'Border-office approach',
      alarm_relay: 'Customs relay office',
      drum_flank: 'Truck-bay flank',
      cage_vestibule: 'Tower threshold',
      relay_cage: 'Tower customs room',
      exit_door: 'Barrier exit',
    },
    signatureRule: 'Watchtower pressure appears through the gate before the customs office opens.',
  },
  10: {
    label: 'B10 Cathedral of San Marco',
    identity: 'narthex/transept -> nave -> confessionals -> sacristy -> altar',
    names: {
      entry_vestibule: 'Narthex vestibule',
      intake_peek: 'Transept peek',
      service_hall: 'Nave connector',
      relay_approach: 'Sacristy approach',
      alarm_relay: 'Sacristy relay',
      drum_flank: 'Confessional flank',
      cage_vestibule: 'Altar threshold',
      relay_cage: 'High altar',
      exit_door: 'Bell stair exit',
    },
    signatureRule: 'Stained-glass previews the altar duel while confessional slits hide the last flank.',
  },
  11: {
    label: 'B11 Karelia Freighter',
    identity: 'cargo row -> companionway -> engine relay -> bridge approach',
    names: {
      entry_vestibule: 'Cargo-row vestibule',
      intake_peek: 'Container peek',
      service_hall: 'Companionway hall',
      relay_approach: 'Engine approach',
      alarm_relay: 'Engine relay',
      drum_flank: 'Crew companionway flank',
      cage_vestibule: 'Bridge-approach threshold',
      relay_cage: 'Bridge approach',
      exit_door: 'Bridge wing exit',
    },
    signatureRule: 'Bridge-window overwatch turns on as the cargo row funnels into the final companionway.',
  },
  12: {
    label: 'B12 The Spire',
    identity: 'glass lobby -> boardroom/vault -> maintenance spine -> helipad',
    names: {
      entry_vestibule: 'Glass-lobby vestibule',
      intake_peek: 'Reception peek',
      service_hall: 'Boardroom connector',
      relay_approach: 'Vault approach',
      alarm_relay: 'Board relay',
      drum_flank: 'Maintenance-spine flank',
      cage_vestibule: 'Helipad threshold',
      relay_cage: 'Helipad apex',
      exit_door: 'Helipad exit',
    },
    signatureRule: 'The helicopter is visible behind glass before the final apex room unlocks.',
  },
});

function _prefix(building) {
  return `b${String(building).padStart(2, '0')}`;
}

function _id(building, suffix) {
  return `${_prefix(building)}_${suffix}`;
}

function _encounterId(building, roomSuffix) {
  const base = ROOM_BASE[roomSuffix];
  return base && base.encounterSuffix ? _id(building, base.encounterSuffix) : null;
}

function _makeChoreography(packet, roomSuffix) {
  const name = packet.names[roomSuffix] || roomSuffix;
  if (roomSuffix === 'intake_peek') {
    return {
      firstContact: 'Lookout appears at the partial doorway read before the player can see deeper rooms.',
      firstShotAngle: 'Door-slit angle from the intake threshold.',
      playerCover: 'Spawn-side jamb or low apron immediately left of the threshold.',
      enemyCover: 'Full-height intake edge with a short retreat lane.',
      enemyReaction: 'Peek from cover, then alarm only the adjacent approach.',
      clearChange: 'The first locked room gate opens and the service connector becomes the only strong route.',
      exitReveal: 'Hazard stripe and gate light pull toward the connector.',
    };
  }
  if (roomSuffix === 'relay_approach') {
    return {
      firstContact: `${name} anchor catches the player at the office threshold.`,
      firstShotAngle: 'Narrow mid-spine doorline.',
      playerCover: 'Threshold wall edge before crossing the open lane.',
      enemyCover: 'Desk-side hard cover pointed at the doorway.',
      enemyReaction: 'Hold angle, then short peek bursts.',
      clearChange: 'Objective-room gate unlocks.',
      exitReveal: 'Relay light becomes the dominant forward read.',
    };
  }
  if (roomSuffix === 'alarm_relay') {
    return {
      firstContact: 'Objective anchor guards the interact lane.',
      firstShotAngle: 'Desk-to-door line across the relay console.',
      playerCover: 'Offset partition edge and objective desk.',
      enemyCover: 'Relay desk or console hard corner.',
      enemyReaction: 'Guard objective until cleared.',
      clearChange: 'Holding the relay opens the flank-pressure room.',
      exitReveal: 'Side-loop marker and changed relay light point to the flank room.',
    };
  }
  if (roomSuffix === 'drum_flank') {
    return {
      firstContact: 'Flanker crosses the side pocket after relay contact.',
      firstShotAngle: 'Lateral side-loop angle, not an open-floor sprint.',
      playerCover: 'Drum stack / service-jamb cover.',
      enemyCover: 'Return-loop cover facing back toward the relay.',
      enemyReaction: 'Flank after contact and try to reconnect behind glass.',
      clearChange: 'Back-room threshold gate opens.',
      exitReveal: 'Final threshold light becomes visible through the connector.',
    };
  }
  return {
    firstContact: 'Signature heavy is previewed before the player commits through the final threshold.',
    firstShotAngle: 'Gate-to-center arena angle with one side overwatch.',
    playerCover: 'Threshold face and first interior pillar.',
    enemyCover: 'Central landmark cover plus elevated or glass-side read.',
    enemyReaction: packet.signatureRule,
    clearChange: 'Exit door opens only when the signature encounter is clear.',
    exitReveal: 'Back-lit exit threshold is exposed behind the final room.',
  };
}

function _makeRoom(building, roomSuffix, packet, nextSuffixes) {
  const base = ROOM_BASE[roomSuffix];
  const combat = ROOM_FLOW_COMBAT_KINDS.includes(base.kind);
  return {
    id: _id(building, roomSuffix),
    building,
    label: packet.names[roomSuffix] || roomSuffix,
    parentZone: base.parentZone,
    kind: base.kind,
    bounds: { ...ROOM_BOXES[roomSuffix] },
    next: nextSuffixes.map((s) => _id(building, s)),
    gatesOut: [],
    encounterId: _encounterId(building, roomSuffix),
    objectiveId: base.objectiveId || null,
    waypoint: { ...base.waypoint },
    visibilityBudgetM: base.visibilityBudgetM,
    scenarioType: base.scenarioType || `${base.kind}_${base.pacingTag}`,
    hallwayType: base.hallwayType || (base.kind.includes('hall') ? base.kind : null),
    subAreas: Array.isArray(base.subAreas) ? base.subAreas.slice() : [],
    purpose:
      (packet.purposes && packet.purposes[roomSuffix]) ||
      `${packet.names[roomSuffix] || roomSuffix} advances ${packet.identity}.`,
    readabilityCue:
      (packet.cues && packet.cues[roomSuffix]) ||
      `${packet.names[roomSuffix] || roomSuffix} uses lighting, threshold scale, and prop orientation to confirm the next room.`,
    pacingTag: base.pacingTag,
    sideLoop: !!base.sideLoop,
    previewRead: /peek|vestibule|relay|cage|threshold|glass|suite|vault|altar|helipad/i.test(
      `${packet.names[roomSuffix] || ''} ${(packet.cues && packet.cues[roomSuffix]) || ''}`,
    ),
    choreography: combat ? _makeChoreography(packet, roomSuffix) : null,
  };
}

function _gateAabb(building, suffix) {
  const layout = FLOW_LAYOUT_BY_BN[building - 1] || 0;
  const frontX = layout === 0 ? 5.0 : -5.0;
  const backX = layout === 0 ? -5.0 : 5.0;
  const map = {
    entry_to_intake: { x0: -1.25, x1: 1.25, z0: 16.28, z1: 16.62 },
    intake_to_service: { x0: frontX - 1.05, x1: frontX + 1.05, z0: 8.62, z1: 9.08 },
    service_to_relay: { x0: frontX - 1.05, x1: frontX + 1.05, z0: 2.08, z1: 2.48 },
    relay_to_alarm: { x0: -7.72, x1: -7.28, z0: -1.35, z1: 1.35 },
    alarm_to_drum: { x0: 7.28, x1: 7.72, z0: -1.35, z1: 1.35 },
    drum_to_cage: { x0: backX - 1.05, x1: backX + 1.05, z0: -6.56, z1: -6.10 },
    cage_to_signature: { x0: -1.05, x1: 1.05, z0: -13.52, z1: -12.94 },
    signature_to_exit: { x0: -1.25, x1: 1.25, z0: -24.98, z1: -24.42 },
  };
  return { ...map[suffix] };
}

function _makeGate(building, suffix, fromSuffix, toSuffix, opensOn, startsLocked, label) {
  const id = _id(building, suffix);
  return {
    id,
    building,
    from: _id(building, fromSuffix),
    to: _id(building, toSuffix),
    meshId: `${id}_gate`,
    opensOn,
    startsLocked,
    blockingAabb: _gateAabb(building, suffix),
    label,
  };
}

function _buildFlow(building) {
  const packet = FLOW_PACKETS[building];
  const orderSuffixes = [
    'entry_vestibule',
    'intake_peek',
    'service_hall',
    'relay_approach',
    'alarm_relay',
    'drum_flank',
    'cage_vestibule',
    'relay_cage',
    'exit_door',
  ];
  const rooms = {};
  for (let i = 0; i < orderSuffixes.length; i++) {
    rooms[_id(building, orderSuffixes[i])] = _makeRoom(
      building,
      orderSuffixes[i],
      packet,
      orderSuffixes[i + 1] ? [orderSuffixes[i + 1]] : [],
    );
  }
  const gates = {};
  const addGate = (gate) => {
    gates[gate.id] = gate;
    const from = rooms[gate.from];
    if (from) from.gatesOut.push(gate.id);
  };
  addGate(
    _makeGate(
      building,
      'entry_to_intake',
      'entry_vestibule',
      'intake_peek',
      { type: 'room_enter', roomId: _id(building, 'entry_vestibule') },
      false,
      'Intake threshold',
    ),
  );
  addGate(
    _makeGate(
      building,
      'intake_to_service',
      'intake_peek',
      'service_hall',
      { type: 'encounter_clear', encounterId: _id(building, 'intake_peek_clear') },
      true,
      'First internal gate',
    ),
  );
  addGate(
    _makeGate(
      building,
      'service_to_relay',
      'service_hall',
      'relay_approach',
      { type: 'room_enter', roomId: _id(building, 'service_hall') },
      false,
      'Service threshold',
    ),
  );
  addGate(
    _makeGate(
      building,
      'relay_to_alarm',
      'relay_approach',
      'alarm_relay',
      { type: 'encounter_clear', encounterId: _id(building, 'relay_approach_clear') },
      true,
      'Relay office gate',
    ),
  );
  addGate(
    _makeGate(
      building,
      'alarm_to_drum',
      'alarm_relay',
      'drum_flank',
      { type: 'objective_complete', objectiveId: 'disable_alarm_panel' },
      true,
      'Flank pressure gate',
    ),
  );
  addGate(
    _makeGate(
      building,
      'drum_to_cage',
      'drum_flank',
      'cage_vestibule',
      { type: 'encounter_clear', encounterId: _id(building, 'drum_flank_clear') },
      true,
      'Final threshold gate',
    ),
  );
  addGate(
    _makeGate(
      building,
      'cage_to_signature',
      'cage_vestibule',
      'relay_cage',
      { type: 'room_enter', roomId: _id(building, 'cage_vestibule') },
      false,
      'Cage vestibule threshold',
    ),
  );
  addGate(
    _makeGate(
      building,
      'signature_to_exit',
      'relay_cage',
      'exit_door',
      { type: 'encounter_clear', encounterId: _id(building, 'relay_cage_clear') },
      true,
      'Exit door',
    ),
  );

  return Object.freeze({
    building,
    label: packet.label,
    identity: packet.identity,
    signatureRule: packet.signatureRule,
    startRoom: _id(building, 'entry_vestibule'),
    exitRoom: _id(building, 'exit_door'),
    roomOrder: orderSuffixes.map((s) => _id(building, s)),
    progressRoomOrder: orderSuffixes.filter((s) => s !== 'exit_door').map((s) => _id(building, s)),
    rooms,
    gates,
  });
}

export const CAMPAIGN_ROOM_FLOWS = Object.freeze(
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => {
    const building = i + 1;
    return [building, _buildFlow(building)];
  })),
);

function _boundsArea(b) {
  if (!b || !Number.isFinite(b.x0)) return Infinity;
  return (b.x1 - b.x0) * (b.z1 - b.z0);
}

export function pickCampaignFlowRoomId(building, x, z) {
  const flow = CAMPAIGN_ROOM_FLOWS[building];
  if (!flow || !flow.rooms) return null;
  const ids = Object.keys(flow.rooms).sort(
    (a, b) => _boundsArea(flow.rooms[a].bounds) - _boundsArea(flow.rooms[b].bounds),
  );
  for (const id of ids) {
    const b = flow.rooms[id].bounds;
    if (!b || !Number.isFinite(b.x0)) continue;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return id;
  }
  return null;
}

export function getCampaignRoomFlow(building) {
  return CAMPAIGN_ROOM_FLOWS[building] || null;
}

export function getCampaignFlowRoomCount(building) {
  const flow = getCampaignRoomFlow(building);
  return flow && Array.isArray(flow.progressRoomOrder) ? flow.progressRoomOrder.length : 0;
}
