/**
 * Per-building machine patches for native campaign encounters (cloned from B01).
 * Merged after narrative overlay in `campaignEncounters.js` — spawns, director keys, cover anchors.
 */

/** Optional extra cover-hint world anchors keyed by encounter `cover` / `coverHint` string. */
export const COVER_HINT_ANCHOR_PATCH_BY_BN = {
  2: {
    spine_pinch: [0.35, 2.25],
    relay_desk: [-13.9, 2.45],
    drum_spool: [14.35, 0.12],
  },
  3: {
    spine_pinch: [-0.2, 2.1],
    intake_apron: [0.15, 12.9],
    cage_pillar_west: [-12.7, -15.8],
  },
  4: {
    relay_desk: [-14.1, 2.35],
    vestibule_face: [3.1, -13.85],
  },
  5: {
    drum_spool: [14.55, -0.08],
    desk_rail: [13.45, -16.9],
  },
  6: {
    spine_pinch: [0.5, 1.95],
    fe_stack: [12.85, 12.1],
  },
  7: {
    west_lane_fork: [-11.85, 15.2],
    east_stack: [14.05, 15.1],
  },
  8: {
    rack_face: [14, 0],
    cold_row: [0, 18],
  },
  9: {
    customs_lane: [0, 17],
    sand_berm: [-14, -18],
  },
  10: {
    spine_pinch: [-0.25, 2.05],
    relay_desk: [-14.05, 2.42],
    drum_spool: [14.4, -0.05],
  },
  11: {
    deck_lane: [0, 19],
    port_row: [-12, 20],
  },
  12: {
    atrium_glass: [-13, 19],
    helipad_rail: [14, -18],
  },
};

const ROUTE_FLOORPLAN_PATCH_BY_BN = {
  1: {
    spaces: {
      b01_west_service_nonwave: { kind: 'service_hall', parentRoom: 'west_service_connector', bounds: { x0: -18, x1: -14.1, z0: 11.2, z1: 16.4 }, exits: ['west_service_connector', 'dock_intake'], routeRole: 'non_wave_connector' },
      b01_east_return_loop: { kind: 'return_loop', parentRoom: 'east_flank_connector', bounds: { x0: 10.9, x1: 16.7, z0: 10.9, z1: 16.4 }, exits: ['east_flank_connector', 'dock_intake'], routeRole: 'flank_reconnect' },
      b01_relay_preread_glass: { kind: 'preview_threshold', parentRoom: 'alarm_relay_room', bounds: { x0: -12.4, x1: -8.7, z0: 0.6, z1: 3.7 }, exits: ['alarm_relay_room', 'mid_lane_center'], routeRole: 'objective_preview' },
      b01_cage_signature_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.8, x1: 3.8, z0: -15.0, z1: -11.4 }, exits: ['relay_cage', 'mid_lane_center'], routeRole: 'final_threshold' },
    },
  },
  2: {
    spaces: {
      b02_coat_check_pocket: { kind: 'side_pocket', parentRoom: 'west_service_connector', bounds: { x0: -16.2, x1: -11.8, z0: 15.2, z1: 19.2 }, exits: ['west_service_connector', 'dock_intake'], routeRole: 'non_wave_room' },
      b02_salon_service_tunnel: { kind: 'service_hall', parentRoom: 'east_flank_connector', bounds: { x0: 11.0, x1: 15.9, z0: 10.0, z1: 15.6 }, exits: ['east_flank_connector', 'drum_lane'], routeRole: 'flank_connector' },
      b02_concierge_preview: { kind: 'preview_threshold', parentRoom: 'alarm_relay_room', bounds: { x0: -8.4, x1: -5.9, z0: -2.8, z1: 0.8 }, exits: ['alarm_relay_room', 'mid_lane_center'], routeRole: 'objective_preview' },
      b02_manager_suite_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.7, x1: 3.7, z0: -15.2, z1: -11.7 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  3: {
    spaces: {
      b03_queue_vestibule: { kind: 'vestibule', parentRoom: 'dock_intake', bounds: { x0: -2.8, x1: 3.0, z0: 15.6, z1: 20.6 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'arrival_compression' },
      b03_bar_side_pocket: { kind: 'side_pocket', parentRoom: 'east_flank_connector', bounds: { x0: 9.8, x1: 14.2, z0: 11.2, z1: 15.8 }, exits: ['east_flank_connector', 'dock_intake'], routeRole: 'non_wave_room' },
      b03_vip_return_loop: { kind: 'return_loop', parentRoom: 'alarm_relay_room', bounds: { x0: -16.2, x1: -10.9, z0: -4.4, z1: 2.8 }, exits: ['alarm_relay_room', 'mid_lane_center'], routeRole: 'flank_reconnect' },
      b03_mirrored_lounge_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.8, x1: 3.8, z0: -14.5, z1: -10.8 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  4: {
    spaces: {
      b04_gallery_service_tunnel: { kind: 'service_hall', parentRoom: 'west_service_connector', bounds: { x0: -15.8, x1: -10.6, z0: 11.8, z1: 16.8 }, exits: ['west_service_connector', 'dock_intake'], routeRole: 'gallery_pull' },
      b04_glass_office_pocket: { kind: 'side_pocket', parentRoom: 'drum_lane', bounds: { x0: 11.2, x1: 15.8, z0: -0.5, z1: 4.6 }, exits: ['drum_lane', 'mid_lane_center'], routeRole: 'non_wave_room' },
      b04_wine_suite_preview: { kind: 'preview_threshold', parentRoom: 'relay_cage', bounds: { x0: -10.0, x1: -6.8, z0: -14.5, z1: -11.4 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_preview' },
      b04_master_suite_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.8, x1: 3.8, z0: -16.0, z1: -12.2 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  5: {
    spaces: {
      b05_triage_service_hall: { kind: 'service_hall', parentRoom: 'dock_intake', bounds: { x0: -3.6, x1: 3.8, z0: 13.5, z1: 17.2 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'arrival_connector' },
      b05_patient_curtain_pocket: { kind: 'side_pocket', parentRoom: 'alarm_relay_room', bounds: { x0: -16.3, x1: -11.7, z0: -3.2, z1: 1.7 }, exits: ['alarm_relay_room', 'mid_lane_west'], routeRole: 'non_wave_room' },
      b05_nurse_return_loop: { kind: 'return_loop', parentRoom: 'drum_lane', bounds: { x0: 10.7, x1: 16.2, z0: -4.2, z1: 2.4 }, exits: ['drum_lane', 'alarm_relay_room'], routeRole: 'flank_reconnect' },
      b05_operating_theater_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.8, x1: 3.8, z0: -15.8, z1: -12.1 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  6: {
    spaces: {
      b06_turnstile_tunnel: { kind: 'guided_tunnel', parentRoom: 'dock_intake', bounds: { x0: -3.8, x1: 3.8, z0: 14.7, z1: 19.8 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'linear_pull' },
      b06_locker_pocket: { kind: 'side_pocket', parentRoom: 'drum_lane', bounds: { x0: 11.7, x1: 16.0, z0: 0.8, z1: 5.1 }, exits: ['drum_lane', 'east_flank_connector'], routeRole: 'non_wave_room' },
      b06_track_bypass_hall: { kind: 'service_hall', parentRoom: 'west_service_connector', bounds: { x0: -16.4, x1: -11.5, z0: -17.2, z1: -11.3 }, exits: ['west_service_connector', 'relay_cage'], routeRole: 'flank_connector' },
      b06_switch_chamber_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.8, x1: 3.8, z0: -18.0, z1: -14.2 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  7: {
    spaces: {
      b07_crew_hatch_tunnel: { kind: 'guided_tunnel', parentRoom: 'west_service_connector', bounds: { x0: -15.8, x1: -10.6, z0: 11.8, z1: 16.8 }, exits: ['west_service_connector', 'dock_intake'], routeRole: 'crew_connector' },
      b07_stateroom_pocket: { kind: 'side_pocket', parentRoom: 'drum_lane', bounds: { x0: 11.5, x1: 15.8, z0: -0.4, z1: 4.2 }, exits: ['drum_lane', 'east_flank_connector'], routeRole: 'non_wave_room' },
      b07_engine_return_loop: { kind: 'return_loop', parentRoom: 'west_service_connector', bounds: { x0: -15.7, x1: -10.6, z0: -18.6, z1: -12.0 }, exits: ['west_service_connector', 'relay_cage'], routeRole: 'engine_flank' },
      b07_owner_suite_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.8, x1: 3.8, z0: -15.6, z1: -11.9 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  8: {
    spaces: {
      b08_cold_aisle_tunnel_n: { kind: 'guided_tunnel', parentRoom: 'dock_intake', bounds: { x0: -8.4, x1: -3.6, z0: 14.0, z1: 19.0 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'aisle_connector' },
      b08_cold_aisle_tunnel_s: { kind: 'guided_tunnel', parentRoom: 'east_flank_connector', bounds: { x0: 3.5, x1: 8.4, z0: 10.8, z1: 16.1 }, exits: ['east_flank_connector', 'drum_lane'], routeRole: 'aisle_flank' },
      b08_patch_crawl_pocket: { kind: 'side_pocket', parentRoom: 'alarm_relay_room', bounds: { x0: -16.0, x1: -11.7, z0: -4.2, z1: 0.5 }, exits: ['alarm_relay_room', 'mid_lane_west'], routeRole: 'non_wave_room' },
      b08_core_vault_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.9, x1: 3.9, z0: -16.7, z1: -12.8 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  9: {
    spaces: {
      b09_inspection_lane_tunnel: { kind: 'guided_tunnel', parentRoom: 'dock_intake', bounds: { x0: -3.5, x1: 3.5, z0: 14.0, z1: 20.2 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'long_lane' },
      b09_vehicle_search_pocket: { kind: 'side_pocket', parentRoom: 'drum_lane', bounds: { x0: 11.5, x1: 16.2, z0: 2.4, z1: 7.2 }, exits: ['drum_lane', 'east_flank_connector'], routeRole: 'non_wave_room' },
      b09_watchtower_base_hall: { kind: 'service_hall', parentRoom: 'west_service_connector', bounds: { x0: -16.4, x1: -11.6, z0: -19.5, z1: -13.8 }, exits: ['west_service_connector', 'relay_cage'], routeRole: 'overwatch_route' },
      b09_customs_office_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -4.0, x1: 4.0, z0: -15.5, z1: -11.8 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  10: {
    spaces: {
      b10_nave_procession_tunnel: { kind: 'guided_tunnel', parentRoom: 'dock_intake', bounds: { x0: -3.6, x1: 3.6, z0: 13.2, z1: 19.0 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'procession' },
      b10_confessional_side_room: { kind: 'side_pocket', parentRoom: 'alarm_relay_room', bounds: { x0: -16.2, x1: -11.6, z0: -3.9, z1: 1.0 }, exits: ['alarm_relay_room', 'mid_lane_west'], routeRole: 'non_wave_room' },
      b10_bell_stair_hall: { kind: 'service_hall', parentRoom: 'drum_lane', bounds: { x0: 10.6, x1: 15.2, z0: -10.8, z1: -5.3 }, exits: ['drum_lane', 'foreman_cage'], routeRole: 'overwatch_route' },
      b10_high_altar_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -4.1, x1: 4.1, z0: -15.2, z1: -11.6 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  11: {
    spaces: {
      b11_cargo_spine_tunnel: { kind: 'guided_tunnel', parentRoom: 'dock_intake', bounds: { x0: -3.7, x1: 3.7, z0: 14.1, z1: 19.6 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'deck_pull' },
      b11_engine_companionway_hall: { kind: 'service_hall', parentRoom: 'alarm_relay_room', bounds: { x0: -16.0, x1: -11.5, z0: -4.1, z1: 2.2 }, exits: ['alarm_relay_room', 'mid_lane_west'], routeRole: 'engine_connector' },
      b11_crew_companionway_loop: { kind: 'return_loop', parentRoom: 'drum_lane', bounds: { x0: 10.8, x1: 16.1, z0: -10.3, z1: -3.7 }, exits: ['drum_lane', 'foreman_cage'], routeRole: 'crew_flank' },
      b11_bridge_approach_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -3.9, x1: 3.9, z0: -16.5, z1: -12.6 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
  12: {
    spaces: {
      b12_reception_glass_tunnel: { kind: 'guided_tunnel', parentRoom: 'dock_intake', bounds: { x0: -3.7, x1: 3.7, z0: 13.8, z1: 19.4 }, exits: ['dock_intake', 'mid_lane_center'], routeRole: 'final_pull' },
      b12_boardroom_side_pocket: { kind: 'side_pocket', parentRoom: 'alarm_relay_room', bounds: { x0: -16.0, x1: -11.5, z0: -3.1, z1: 1.9 }, exits: ['alarm_relay_room', 'mid_lane_west'], routeRole: 'non_wave_room' },
      b12_maintenance_spine_hall: { kind: 'service_hall', parentRoom: 'drum_lane', bounds: { x0: 10.9, x1: 15.9, z0: -8.7, z1: -2.8 }, exits: ['drum_lane', 'foreman_cage'], routeRole: 'final_flank' },
      b12_helipad_apex_gate: { kind: 'signature_gate', parentRoom: 'relay_cage', bounds: { x0: -4.2, x1: 4.2, z0: -17.6, z1: -13.8 }, exits: ['relay_cage', 'foreman_cage'], routeRole: 'final_threshold' },
    },
  },
};

function _boundsCenter(b) {
  return b ? [(b.x0 + b.x1) * 0.5, (b.z0 + b.z1) * 0.5] : null;
}

function _findRouteAnchor(spaces, predicate) {
  for (const spec of Object.values(spaces || {})) {
    if (spec && predicate(spec)) return _boundsCenter(spec.bounds);
  }
  return null;
}

for (const [bnRaw, patch] of Object.entries(ROUTE_FLOORPLAN_PATCH_BY_BN)) {
  const bn = Number(bnRaw) | 0;
  const spaces = patch && patch.spaces;
  if (!bn || !spaces) continue;
  const arrival = _findRouteAnchor(spaces, (s) => /arrival|linear|procession|deck|final_pull|long_lane/.test(String(s.routeRole)));
  const side = _findRouteAnchor(spaces, (s) => /non_wave|crew|gallery|coat|side/.test(String(s.routeRole)));
  const flank = _findRouteAnchor(spaces, (s) => /flank|return|connector|aisle/.test(String(s.routeRole)));
  const objective = _findRouteAnchor(spaces, (s) => /objective|anchor|board|engine|ops/.test(String(s.routeRole))) || side;
  const signature = _findRouteAnchor(spaces, (s) => /final|signature/.test(String(s.routeRole)));
  COVER_HINT_ANCHOR_PATCH_BY_BN[bn] = {
    ...(COVER_HINT_ANCHOR_PATCH_BY_BN[bn] || {}),
    intake_apron: arrival || [0, 15],
    west_lane_fork: side || [-13, 15],
    east_stack: flank || [13, 13],
    fe_stack: flank || [13, 13],
    drum_spool: flank || [14, 0],
    spine_pinch: objective || [0, 2],
    relay_desk: objective || [-14, 2],
    cage_pillar_west: signature || [-12, -16],
    cage_center_low: signature || [0, -16],
    vestibule_face: signature || [3, -14],
    desk_rail: signature || [13, -16],
  };
}

function _routePatrolTag(bn, kind) {
  return `b${String(bn).padStart(2, '0')}_${kind}_route`;
}

const ROOM_PATROL_KIND = {
  dock_intake: 'arrival',
  west_service_connector: 'side',
  east_flank_connector: 'flank',
  mid_lane_center: 'mid',
  mid_lane_west: 'mid',
  alarm_relay_room: 'objective',
  drum_lane: 'flank',
  relay_cage: 'signature',
  foreman_cage: 'overwatch',
};

export function applyCampaignRouteFloorplanCompletion(raw, bn) {
  const patch = ROUTE_FLOORPLAN_PATCH_BY_BN[bn];
  if (!raw || !patch || !raw.floorplan || !raw.floorplan.spaces) return;
  const spaces = raw.floorplan.spaces;
  for (const [id, spec] of Object.entries(patch.spaces || {})) {
    if (!spec || !spec.bounds) continue;
    spaces[id] = {
      kind: spec.kind || 'connector',
      parentRoom: spec.parentRoom || null,
      bounds: { ...spec.bounds },
      physicalIntent: spec.physicalIntent || `${spec.routeRole || 'route'} sub-space for guided campaign flow.`,
      requiredGeometry: [id],
      exits: Array.isArray(spec.exits) ? spec.exits.slice() : [],
      primaryRoutes: spec.parentRoom ? [spec.parentRoom] : [],
      connectorWidth: spec.connectorWidth || 1.2,
      routeRole: spec.routeRole || null,
    };
  }
  if (!raw.floorplan.transitions) raw.floorplan.transitions = {};
  for (const [id, spec] of Object.entries(patch.spaces || {})) {
    if (!spec || !Array.isArray(spec.exits)) continue;
    for (const ex of spec.exits) {
      if (!ex || !spaces[ex]) continue;
      const tid = `${id}_to_${ex}`;
      if (!raw.floorplan.transitions[tid]) {
        const b = spec.bounds;
        raw.floorplan.transitions[tid] = {
          from: id,
          to: ex,
          kind: 'connector',
          threshold: { x: (b.x0 + b.x1) * 0.5, z: (b.z0 + b.z1) * 0.5 },
        };
      }
    }
  }
}

function _nudgeCoord(v, delta, maxAbs) {
  const x = Number(v);
  if (!Number.isFinite(x)) return v;
  const d = Number(delta) || 0;
  const nx = x + d;
  if (Number.isFinite(maxAbs) && Math.abs(nx) > maxAbs) return x;
  return nx;
}

/**
 * Deterministic micro-shifts so B02–B12 authored coordinates are not bitwise-identical to B01.
 * @param {object} raw encounter def (mutated)
 * @param {number} bn
 */
export function mergeNativeEncounterTactics(raw, bn) {
  if (!raw || bn < 2 || bn > 12) return;
  const seed = bn * 17;
  const dx = (((seed * 3) % 11) - 5) * 0.22;
  const dz = (((seed * 5) % 13) - 6) * 0.2;
  const zones = raw.authoredSpawns;
  if (zones && typeof zones === 'object') {
    for (const key of ['frontZone', 'middleZone', 'backZone']) {
      const arr = zones[key];
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        if (Number.isFinite(row.x)) row.x = _nudgeCoord(row.x, dx, 18);
        if (Number.isFinite(row.z)) row.z = _nudgeCoord(row.z, dz, 24);
      }
    }
  }
  const enc = raw.encounters;
  if (Array.isArray(enc)) {
    for (const e of enc) {
      if (!e || !Array.isArray(e.enemies)) continue;
      for (const u of e.enemies) {
        if (!u || !u.spawn || typeof u.spawn !== 'object') continue;
        const sp = u.spawn;
        if (Number.isFinite(sp.x)) sp.x = _nudgeCoord(sp.x, dx * 0.85, 18);
        if (Number.isFinite(sp.z)) sp.z = _nudgeCoord(sp.z, dz * 0.85, 24);
        const kind = ROOM_PATROL_KIND[e.room] || null;
        if (kind && u.role !== 'anchor') {
          u.patrol = _routePatrolTag(bn, kind);
        }
        if (kind === 'objective' && u.role === 'anchor') {
          u.coverHint = u.coverHint || 'relay_desk';
        } else if (kind === 'signature') {
          u.coverHint = u.coverHint || 'vestibule_face';
        } else if (kind === 'flank') {
          u.coverHint = u.coverHint || 'drum_spool';
        }
      }
    }
  }
  /** Alternate FE / FW ingress so alarm pairs do not always stack the same door per building. */
  const entryAlt = bn % 2 === 0 ? 'spawnDoor_FE' : 'spawnDoor_FW';
  for (const e of enc || []) {
    if (!e || !e.id || !/_alarm_relay$/.test(e.id)) continue;
    if (!Array.isArray(e.reinforcements)) continue;
    for (const r of e.reinforcements) {
      const tr = r && r.trigger;
      if (!tr || tr.type !== 'alarm_active_for' || !r.squad) continue;
      r.entry = entryAlt;
    }
  }
}
