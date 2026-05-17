import { CAMPAIGN_CELL_REGIONS } from './levelSequences.js';
import { NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE } from './campaign/nativeEncounterNarrative.js';
import { applyCampaignRouteFloorplanCompletion, mergeNativeEncounterTactics } from './campaign/nativeEncounterTactics.js';

/**
 * Phase 1 encounter data model (authoring + future director).
 * Runtime still uses authoredSpawns + zone pipeline; objectives/lockdown/reinforcements are spec-only until later phases.
 */

/** @see CAMPAIGN_LEVELS_REWORK_PLAN.md — enemy roles */
export const ENCOUNTER_ROLES = Object.freeze([
  'lookout',
  'anchor',
  'flanker',
  'breacher',
  'sniper',
  'shield',
  'demolitions',
  'drone',
  'boss_guard',
  'civilian_guard',
  'runner',
  'patrol',
]);

/** @see CAMPAIGN_LEVELS_REWORK_PLAN.md — behavior strings */
export const ENCOUNTER_BEHAVIORS = Object.freeze([
  'patrol_then_alarm',
  'hold_angle',
  'peek_from_cover',
  'flank_after_contact',
  'suppress_lane',
  'rush_when_player_reloads',
  'guard_objective',
  'retreat_to_next_room',
  'escort_target',
  'ambush_on_crossing',
  'sniper_relocate',
  'riot_screen_push',
  'grenade_flush_cover',
  'patrol_lane',
  'overwatch_catwalk',
]);

export const CAMPAIGN_ENCOUNTERS = {
  1: {
    id: 'dock7',
    building: 1,
    label: 'B01 Loading Dock',
    shellTieIn:
      'Dock macro shell (layout 0): classic cargo-axis zone doors and interior wall cuts match encounter spawns, sequence route paint, and alarm-relay hinge. Gold reference for the shared skeleton.',

    /** Macro beat order (stable floorplan space ids). */
    flow: [
      'dock_intake',
      'west_service_connector',
      'east_flank_connector',
      'mid_lane_center',
      'mid_lane_west',
      'alarm_relay_room',
      'drum_lane',
      'relay_cage',
      'foreman_cage',
    ],

    /**
     * Authoring rooms keyed to floorplan space ids.
     * `zone` aligns with legacy three-band progression (0 front / 1 mid / 2 back).
     */
    rooms: {
      dock_intake: {
        label: 'Dock intake court',
        cells: ['FW', 'FC', 'FE'],
        zone: 0,
        intent: 'read_and_pick_route',
        physicalIntent:
          'Three-lane dock read: west service, center court, east flank; threshold and apron frame the breach.',
        entry: { x: 0, z: 18 },
        exits: ['west_service_connector', 'east_flank_connector', 'mid_lane_center', 'alarm_relay_room'],
        primaryCover: ['container_stack', 'dock_threshold', 'intake_apron', 'west_service_bulkhead'],
        flankLanes: ['FW_to_west_service', 'FE_to_east_flank'],
        sightlines: ['office_to_mid_floor', 'center_to_relay_door'],
        hazards: ['open_center_axis'],
        lightingMood: 'cold_dock_warm_alarm',
      },
      west_service_connector: {
        label: 'West service lane',
        cells: ['FW'],
        zone: 0,
        intent: 'flank_or_delay',
        physicalIntent: 'Compressed strip along the west bulkhead; offset from the center breach.',
        entry: { x: -16.5, z: 17 },
        exits: ['dock_intake', 'mid_lane_west'],
        primaryCover: ['service_pallets', 'partition_kink'],
        flankLanes: ['FW_into_MW_door'],
        sightlines: ['forklift_lane_peek'],
        hazards: ['narrow_return'],
        lightingMood: 'service_strip_cool',
      },
      east_flank_connector: {
        label: 'East compression approach',
        cells: ['FE'],
        zone: 0,
        intent: 'flank_pressure',
        physicalIntent: 'East-side approach compressed before the mid zone door; flank route into drum lane.',
        entry: { x: 14.5, z: 17 },
        exits: ['dock_intake', 'drum_lane'],
        primaryCover: ['fe_stack', 'east_threshold'],
        flankLanes: ['FE_into_ME'],
        sightlines: ['fe_to_me_door_preview'],
        hazards: ['exposed_corner'],
        lightingMood: 'amber_sodium_edge',
      },
      mid_lane_center: {
        label: 'Center spine',
        cells: ['FC'],
        zone: 1,
        intent: 'commit_or_rotate',
        physicalIntent: 'Center plate between zone doors; connects dock intake to relay cage and side rooms.',
        entry: { x: 0, z: 0 },
        exits: ['dock_intake', 'relay_cage', 'alarm_relay_room', 'drum_lane'],
        primaryCover: ['spine_pinch', 'door_jambs'],
        flankLanes: ['FC_to_MW_wedge', 'FC_to_ME'],
        sightlines: ['center_to_relay_door'],
        hazards: ['crossfire_lane'],
        lightingMood: 'neutral_factory',
      },
      mid_lane_west: {
        label: 'Relay door wedge',
        cells: ['MW'],
        zone: 1,
        intent: 'threshold_fight',
        physicalIntent: 'Narrow wedge between partition and relay cell; shared boundary before alarm room.',
        entry: { x: -9.5, z: 0 },
        exits: ['alarm_relay_room', 'mid_lane_center'],
        primaryCover: ['partition_edge'],
        flankLanes: ['wedge_into_relay'],
        sightlines: [],
        hazards: ['pinch'],
        lightingMood: 'cool_fill',
      },
      alarm_relay_room: {
        label: 'Alarm relay floor',
        cells: ['MW'],
        zone: 1,
        intent: 'objective_and_hold',
        physicalIntent: 'Relay desk + panel anchor; offset internal door breaks center-axis entry.',
        entry: { x: -14, z: 0 },
        exits: ['mid_lane_west', 'drum_lane'],
        primaryCover: ['relay_desk', 'manifest_bay', 'partition_crease'],
        flankLanes: ['MW_to_ME'],
        sightlines: ['office_to_mid_floor', 'relay_peek_me'],
        hazards: ['alarm_panel'],
        lightingMood: 'alarm_amber_pulse',
      },
      drum_lane: {
        label: 'East mid drum lane',
        cells: ['ME'],
        zone: 1,
        intent: 'flank_enfilade',
        physicalIntent: 'East mid cache lane; drum cover and lateral pressure on relay.',
        entry: { x: 14.5, z: 0 },
        exits: ['east_flank_connector', 'alarm_relay_room', 'mid_lane_center'],
        primaryCover: ['drum_spool', 'cache_crates'],
        flankLanes: ['ME_to_FC'],
        sightlines: [],
        hazards: ['long_lateral'],
        lightingMood: 'shadow_strip',
      },
      relay_cage: {
        label: 'Loading cage',
        cells: ['BC'],
        zone: 2,
        intent: 'signature_arena',
        physicalIntent: 'Signature relay cage arena; framed by arch, vestibule, and catwalk read.',
        entry: { x: 0, z: -16 },
        exits: ['foreman_cage', 'mid_lane_center'],
        primaryCover: ['cage_pillars', 'hazard_pad', 'vestibule_stack'],
        flankLanes: ['BC_lateral_shuffle'],
        sightlines: ['catwalk_over_bc', 'foreman_to_relay_cage'],
        hazards: ['elevated_overwatch'],
        lightingMood: 'high_contrast_cage',
      },
      foreman_cage: {
        label: 'Foreman catwalk',
        cells: ['BE'],
        zone: 2,
        intent: 'overwatch_pick',
        physicalIntent: 'Raised catwalk office cage; glass reads down into relay cage.',
        entry: { x: 14, z: -16 },
        exits: ['relay_cage', 'catwalk_stairs'],
        primaryCover: ['desk_rail', 'glass_mullion'],
        flankLanes: ['BE_drop_read'],
        sightlines: ['foreman_to_relay_cage', 'catwalk_over_bc'],
        hazards: ['glass_exposure'],
        lightingMood: 'office_warm_top',
      },
    },

    floorplan: {
      cellRegions: CAMPAIGN_CELL_REGIONS,
      spaces: {
        west_service_connector: {
          kind: 'service_hall',
          cells: ['FW'],
          bounds: { x0: -18, x1: -14.7, z0: 11, z1: 23 },
          physicalIntent: 'Compressed strip along the west bulkhead; offset from the center breach.',
          requiredGeometry: ['west_service_run'],
          sightlines: ['forklift_lane_peek'],
          exits: ['dock_intake', 'mid_lane_west'],
          primaryRoutes: ['dock_intake', 'mid_lane_west', 'alarm_relay_room'],
          connectorWidth: 1.35,
        },
        east_flank_connector: {
          kind: 'connector',
          cells: ['FE'],
          bounds: { x0: 11.5, x1: 18, z0: 11.5, z1: 23 },
          physicalIntent: 'East-side approach compressed before the mid zone door; flank route.',
          requiredGeometry: ['east_compression_corridor'],
          sightlines: ['fe_to_me_door_preview'],
          exits: ['dock_intake', 'drum_lane'],
          primaryRoutes: ['dock_intake', 'drum_lane', 'mid_lane_center'],
          connectorWidth: 1.5,
        },
        dock_intake: {
          kind: 'entry_room',
          cells: ['FW', 'FC', 'FE'],
          bounds: { x0: -18, x1: 18, z0: 7.5, z1: 25.5 },
          physicalIntent: 'Three-lane dock read: west service, center court, east flank; threshold strip frames room change.',
          requiredGeometry: ['dock_threshold_strip', 'intake_apron_divider'],
          sightlines: ['office_to_mid_floor', 'center_to_relay_door'],
          exits: ['west_service_connector', 'east_flank_connector', 'mid_lane_center', 'alarm_relay_room'],
          primaryRoutes: ['mid_lane_center', 'relay_cage'],
        },
        alarm_relay_room: {
          kind: 'objective_room',
          cells: ['MW'],
          bounds: { x0: -18, x1: -11.4, z0: -7, z1: 7 },
          physicalIntent: 'Relay desk + panel anchor; offset internal door breaks center-axis entry.',
          requiredGeometry: [
            'relay_partition_north',
            'relay_partition_west',
            'relay_offset_door',
            'manifest_office_window',
            'relay_panel_anchor',
            'relay_side_slit',
            'alarm_interact_lane',
          ],
          sightlines: ['office_to_mid_floor'],
          exits: ['mid_lane_west', 'drum_lane'],
          primaryRoutes: ['mid_lane_west', 'drum_lane', 'mid_lane_center'],
        },
        foreman_cage: {
          kind: 'office_catwalk',
          cells: ['BE'],
          bounds: { x0: 10.5, x1: 18, z0: -22.5, z1: -10 },
          physicalIntent: 'Raised catwalk office cage; glass reads down into relay cage.',
          requiredGeometry: ['foreman_cage_wall', 'foreman_cage_return', 'foreman_glass', 'catwalk_to_cage_window'],
          sightlines: ['foreman_to_relay_cage', 'catwalk_over_bc'],
          exits: ['relay_cage'],
          primaryRoutes: ['relay_cage', 'mid_lane_center'],
        },
        relay_cage: {
          kind: 'boss_approach',
          cells: ['BC'],
          bounds: { x0: -8, x1: 8, z0: -25.5, z1: -7.5 },
          physicalIntent: 'Signature relay cage arena; framed by arch and hazards.',
          requiredGeometry: ['cage_vestibule'],
          sightlines: ['catwalk_over_bc', 'foreman_to_relay_cage'],
          exits: ['foreman_cage', 'mid_lane_center'],
          primaryRoutes: ['mid_lane_center', 'foreman_cage'],
        },
        mid_lane_center: {
          kind: 'transit_spine',
          cells: ['FC'],
          bounds: { x0: -7.5, x1: 7.5, z0: -7, z1: 7 },
          physicalIntent: 'Center plate between zone doors; connects dock intake to back zones.',
          requiredGeometry: ['mid_spine_pinch'],
          sightlines: ['center_to_relay_door'],
          exits: ['dock_intake', 'relay_cage', 'alarm_relay_room', 'drum_lane'],
          primaryRoutes: ['dock_intake', 'relay_cage'],
        },
        drum_lane: {
          kind: 'flank_room',
          cells: ['ME'],
          bounds: { x0: 11.4, x1: 18, z0: -7, z1: 7 },
          physicalIntent: 'East mid cache lane; drum cover and hazard pad pressure.',
          requiredGeometry: [],
          sightlines: [],
          exits: ['east_flank_connector', 'alarm_relay_room', 'mid_lane_center'],
          primaryRoutes: ['mid_lane_center', 'alarm_relay_room'],
        },
        mid_lane_west: {
          kind: 'transit_wedge',
          cells: ['MW'],
          bounds: { x0: -11.5, x1: -7.5, z0: -7, z1: 7 },
          physicalIntent: 'Narrow wedge between partition and relay cell (shared boundary).',
          requiredGeometry: [],
          sightlines: [],
          exits: ['alarm_relay_room', 'mid_lane_center'],
          primaryRoutes: ['alarm_relay_room', 'mid_lane_center'],
          connectorWidth: 1.4,
        },
      },
      transitions: {
        dock_to_mid_center: {
          from: 'dock_intake',
          to: 'mid_lane_center',
          kind: 'zone_door',
          door: 'zone0',
          lock: 'none',
          opensOn: 'zone0_clear',
          note:
            'Interior zone door at +Z split opens when the FRONT zone (zone 0) is kill-cleared. Alarm panel in mid governs authored reinforcements / mastery, not this door.',
          previewSightline: true,
        },
        dock_to_relay_west: {
          from: 'west_service_connector',
          to: 'alarm_relay_room',
          kind: 'doorway',
          door: 'partition_w_mw',
          lock: 'soft_while_alarm_live',
          opensOn: 'traverse_or_room_clear',
          threshold: { x: -11.5, z: 0 },
          previewSightline: true,
        },
        dock_to_flank_mid: {
          from: 'east_flank_connector',
          to: 'drum_lane',
          kind: 'doorway',
          threshold: { x: 11.5, z: 0 },
          previewSightline: false,
        },
        relay_to_foreman_read: {
          from: 'alarm_relay_room',
          to: 'foreman_cage',
          kind: 'line_of_sight',
          sightlineId: 'office_to_mid_floor',
        },
        foreman_to_cage: {
          from: 'foreman_cage',
          to: 'relay_cage',
          kind: 'drop_read',
          sightlineId: 'foreman_to_relay_cage',
        },
      },
    },

    /**
     * Director catalog: authored room-flow encounters.
     * Flow ids mirror CAMPAIGN_ROOM_FLOWS so enemies, gates, and waypoints all
     * resolve to the same tactical room instead of the legacy front/mid/back bands.
     */
    encounters: [
      {
        id: 'b01_intake_peek_clear',
        room: 'b01_intake_peek',
        label: 'Intake peek lookout',
        trigger: { type: 'enter_flow_room', room: 'b01_intake_peek' },
        objective: { type: 'eliminate_hostiles', target: null },
        lockdown: { doors: [], soft: false },
        enemies: [
          {
            id: 'b01_scout_fe_lane',
            type: 'scout',
            roomId: 'b01_intake_peek',
            role: 'lookout',
            spawn: { cell: 'FC', x: -2.55, z: 12.15 },
            facing: Math.PI,
            behavior: 'peek_from_cover',
            patrol: 'intake_center_beat',
            cover: 'intake_apron',
            alertLink: ['b01_fc_doorline'],
          },
        ],
        reinforcements: [],
        completion: { type: 'room_clear' },
        rewards: {},
      },
      {
        id: 'b01_relay_approach_clear',
        room: 'b01_relay_approach',
        label: 'Relay approach threshold',
        trigger: { type: 'enter_flow_room', room: 'b01_relay_approach' },
        objective: { type: 'eliminate_hostiles', target: null },
        lockdown: { doors: [], soft: false },
        enemies: [
          {
            id: 'b01_fc_doorline',
            type: 'soldier',
            roomId: 'b01_relay_approach',
            role: 'anchor',
            spawn: { cell: 'FC', x: 1.6, z: 1.8 },
            facing: Math.PI,
            behavior: 'hold_angle',
            coverHint: 'relay-east-hold',
            alertLink: [],
          },
        ],
        reinforcements: [],
        completion: { type: 'room_clear' },
        rewards: {},
      },
      {
        id: 'b01_alarm_relay',
        room: 'b01_alarm_relay',
        label: 'Relay floor hold',
        trigger: { type: 'enter_flow_room', room: 'b01_alarm_relay' },
        objective: { type: 'clear_or_disable', target: 'alarm_panel' },
        lockdown: { doors: ['b01_alarm_to_drum'], soft: true },
        enemies: [
          {
            id: 'b01_mw_desk',
            type: 'soldier',
            roomId: 'b01_alarm_relay',
            role: 'anchor',
            spawn: { cell: 'MW', x: -13.8, z: 1.1 },
            facing: 0,
            behavior: 'guard_objective',
            preferredState: 'HOLD_CORNER',
            cover: 'relay_desk',
            alertLink: [],
          },
        ],
        reinforcements: [
          {
            trigger: { type: 'alarm_active_for', seconds: 8 },
            squad: 'b01_alarm_pair',
            entry: 'spawnDoor_FE',
          },
        ],
        completion: { type: 'objective_and_room_safe' },
        rewards: { shortcutHint: false },
      },
      {
        id: 'b01_drum_flank_clear',
        room: 'b01_drum_flank',
        label: 'Drum lane flanker',
        trigger: { type: 'enter_flow_room', room: 'b01_drum_flank' },
        objective: { type: 'eliminate_hostiles', target: null },
        lockdown: { doors: [], soft: false },
        enemies: [
          {
            id: 'b01_me_lane',
            type: 'scout',
            roomId: 'b01_drum_flank',
            role: 'flanker',
            spawn: { cell: 'ME', x: 14.2, z: -2.4 },
            facing: Math.PI,
            behavior: 'flank_after_contact',
            patrol: 'drum_lateral',
            cover: 'drum_spool',
            alertLink: ['b01_mw_desk'],
          },
        ],
        reinforcements: [],
        completion: { type: 'room_clear' },
        rewards: {},
      },
      {
        id: 'b01_relay_cage_clear',
        room: 'b01_relay_cage',
        label: 'Loading cage',
        trigger: { type: 'enter_flow_room', room: 'b01_relay_cage' },
        objective: { type: 'eliminate_hostiles', target: null },
        lockdown: { doors: [], soft: false },
        enemies: [
          {
            id: 'b01_bw_hold',
            type: 'soldier',
            roomId: 'b01_relay_cage',
            role: 'patrol',
            spawn: { cell: 'BC', x: -4.8, z: -16.2 },
            facing: Math.PI / 2,
            behavior: 'suppress_lane',
            patrol: 'cage_left_arc',
            cover: 'cage_pillar_west',
            alertLink: ['b01_bc_heavy', 'b01_bc_rifle'],
          },
          {
            id: 'b01_bc_heavy',
            type: 'heavy',
            roomId: 'b01_relay_cage',
            role: 'anchor',
            spawn: { cell: 'BC', x: -2, z: -17 },
            facing: 0,
            behavior: 'hold_angle',
            preferredState: 'HOLD_CORNER',
            cover: 'cage_center_low',
            alertLink: [],
          },
          {
            id: 'b01_bc_rifle',
            type: 'soldier',
            roomId: 'b01_relay_cage',
            role: 'patrol',
            spawn: { cell: 'BC', x: 3, z: -14 },
            facing: -Math.PI / 3,
            behavior: 'peek_from_cover',
            patrol: 'cage_right_shuffle',
            cover: 'vestibule_face',
            alertLink: [],
          },
          {
            id: 'b01_be_scout',
            type: 'scout',
            roomId: 'b01_relay_cage',
            role: 'sniper',
            spawn: { cell: 'BE', x: 13.5, z: -17 },
            facing: -Math.PI / 2,
            behavior: 'overwatch_catwalk',
            patrol: 'catwalk_window_beat',
            cover: 'desk_rail',
            alertLink: [],
          },
        ],
        reinforcements: [],
        completion: { type: 'room_clear' },
        rewards: {},
      },
    ],

    /** Director wiring hints + runtime objectives / door policy. */
    director: {
      version: 1,
      entryRoom: 'b01_entry_vestibule',
      flowRef: 'CAMPAIGN_ROOM_FLOWS',
      triggerDefault: 'enter_flow_room',
      completionFallback: 'room_flow_then_zone_clear_legacy',
      /** Meso gates: zone N combat clear + these encounters complete before `openZoneDoor(N)`. */
      zoneDoorRequires: {
        0: { encounterIds: ['b01_intake_peek_clear'], alsoRequireZoneClear: true },
        1: {
          encounterIds: ['b01_relay_approach_clear', 'b01_alarm_relay', 'b01_drum_flank_clear'],
          alsoRequireZoneClear: true,
        },
      },
      objectives: [
        {
          id: 'reach_mid_spine',
          type: 'traverse_room',
          roomId: 'b01_relay_approach',
        },
        {
          id: 'disable_alarm_panel',
          type: 'hold_interact',
          meshObjectiveId: 'alarm_panel',
          holdSec: 1.15,
          interactRadius: 1.42,
          requireAlarmSystem: true,
          completeEncounterId: 'b01_alarm_relay',
          clearReinforcementSquads: ['b01_alarm_pair'],
          relayEvent: 'alarm_disabled',
        },
      ],
    },

    /** Zone 0 / 1 / 2 — any band can fall back to spawnByZone when list empty / flag off. */
    authoredSpawns: {
      frontZone: [
        { id: 'b01_scout_fe_lane', type: 'scout', roomId: 'b01_intake_peek', role: 'lookout', x: -2.55, z: 12.15 },
      ],
      middleZone: [
        { id: 'b01_fc_doorline', type: 'soldier', roomId: 'b01_relay_approach', role: 'anchor', x: 1.6, z: 1.8 },
        { id: 'b01_mw_desk', type: 'soldier', roomId: 'b01_alarm_relay', role: 'anchor', x: -13.8, z: 1.1 },
        { id: 'b01_me_lane', type: 'scout', roomId: 'b01_drum_flank', role: 'flanker', x: 14.2, z: -2.4 },
      ],
      backZone: [
        { id: 'b01_bw_hold', type: 'soldier', roomId: 'b01_relay_cage', role: 'patrol', x: -4.8, z: -16.2 },
        { id: 'b01_bc_heavy', type: 'heavy', roomId: 'b01_relay_cage', role: 'anchor', x: -2, z: -17 },
        { id: 'b01_bc_rifle', type: 'soldier', roomId: 'b01_relay_cage', role: 'patrol', x: 3, z: -14 },
        { id: 'b01_be_scout', type: 'scout', roomId: 'b01_relay_cage', role: 'sniper', x: 13.5, z: -17 },
      ],
    },
  },
};

/** Campaign ids + labels for native B02–B12 defs (shared skeleton; narrative + ids per building). */
const _NATIVE_BUILDING_META = {
  2: { id: 'continental_lobby', label: 'B02 Continental Lobby' },
  3: { id: 'club_obsidian', label: 'B03 Nightclub — Obsidian Floor' },
  4: { id: 'vasari_suite', label: 'B04 Penthouse Ascent' },
  5: { id: 'sterling_medical', label: 'B05 Sterling Medical Ward' },
  6: { id: 'line7_subway', label: 'B06 Subway Line 7' },
  7: { id: 'azure_yacht', label: 'B07 Azure Yacht Deck' },
  8: { id: 'server_farm_delta', label: 'B08 Server Farm Delta — Command Lock' },
  9: { id: 'border_crossing', label: 'B09 Border Crossing' },
  10: { id: 'san_marco_cathedral', label: 'B10 Cathedral of San Marco' },
  11: { id: 'karelia_mv11', label: 'B11 Karelia Freighter' },
  12: { id: 'apex_spire', label: 'B12 The Spire — Helipad Run' },
};

function _remapB01IdsDeep(obj, bn) {
  const px = `b${String(bn).padStart(2, '0')}`;
  if (typeof obj === 'string') {
    return obj.startsWith('b01_') ? px + obj.slice(3) : obj;
  }
  if (Array.isArray(obj)) return obj.map((x) => _remapB01IdsDeep(x, bn));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = _remapB01IdsDeep(v, bn);
    }
    return out;
  }
  return obj;
}

/**
 * Per-building skeleton geometry ids — must match `BUILDING_SKELETON_POST` in levelSequences.js
 * (`_skBcSlice`, `_skMlRipple`, `_skDkStub`).
 */
const SKELETON_GEOMETRY_APPEND_BY_BN = {
  2: {
    relay_cage: ['skel_b02_bc_slice'],
    mid_lane_center: ['skel_b02_ml_ripple'],
    dock_intake: ['skel_b02_dk_stub'],
  },
  3: {
    relay_cage: ['skel_b03_bc_slice'],
    mid_lane_center: ['skel_b03_ml_ripple'],
    dock_intake: ['skel_b03_dk_stub'],
  },
  4: {
    relay_cage: ['skel_b04_bc_slice'],
    mid_lane_center: ['skel_b04_ml_ripple'],
    dock_intake: ['skel_b04_dk_stub'],
  },
  5: {
    relay_cage: ['skel_b05_bc_slice'],
    mid_lane_center: ['skel_b05_ml_ripple'],
    dock_intake: ['skel_b05_dk_stub'],
  },
  6: {
    relay_cage: ['skel_b06_bc_slice'],
    mid_lane_center: ['skel_b06_ml_ripple'],
    dock_intake: ['skel_b06_dk_stub'],
  },
  7: {
    relay_cage: ['skel_b07_bc_slice'],
    mid_lane_center: ['skel_b07_ml_ripple'],
    dock_intake: ['skel_b07_dk_stub'],
  },
  8: {
    relay_cage: ['skel_b08_bc_slice'],
    mid_lane_center: ['skel_b08_ml_ripple'],
    dock_intake: ['skel_b08_dk_stub'],
  },
  9: {
    relay_cage: ['skel_b09_bc_slice'],
    mid_lane_center: ['skel_b09_ml_ripple'],
    dock_intake: ['skel_b09_dk_stub'],
  },
  10: {
    relay_cage: ['skel_b10_bc_slice'],
    mid_lane_center: ['skel_b10_ml_ripple'],
    dock_intake: ['skel_b10_dk_stub'],
  },
  11: {
    relay_cage: ['skel_b11_bc_slice'],
    mid_lane_center: ['skel_b11_ml_ripple'],
    dock_intake: ['skel_b11_dk_stub'],
  },
  12: {
    relay_cage: ['skel_b12_bc_slice'],
    mid_lane_center: ['skel_b12_ml_ripple'],
    dock_intake: ['skel_b12_dk_stub'],
  },
};

function _appendSkeletonFloorplanRefs(raw, bn) {
  const pack = SKELETON_GEOMETRY_APPEND_BY_BN[bn];
  if (!pack || !raw.floorplan?.spaces) return;
  for (const [spaceId, ids] of Object.entries(pack)) {
    if (!Array.isArray(ids) || !ids.length) continue;
    const sp = raw.floorplan.spaces[spaceId];
    if (!sp) continue;
    if (!Array.isArray(sp.requiredGeometry)) sp.requiredGeometry = [];
    for (const gid of ids) {
      if (!sp.requiredGeometry.includes(gid)) sp.requiredGeometry.push(gid);
    }
  }
}

/**
 * Deep clone B01 encounter def for building `bn`: preserves floorplan.requiredGeometry,
 * director.objectives, and alarm reinforcements; remaps b01_* ids; applies narrative overlay.
 * @param {number} bn
 * @returns {object|null}
 */
function _cloneNativeCampaignEncounterFromB01(bn) {
  const base = CAMPAIGN_ENCOUNTERS[1];
  const meta = _NATIVE_BUILDING_META[bn];
  if (!base || !meta) return null;
  const raw = JSON.parse(JSON.stringify(base));
  raw.building = bn;
  raw.id = meta.id;
  raw.label = meta.label;
  raw.encounters = _remapB01IdsDeep(raw.encounters, bn);
  raw.authoredSpawns = _remapB01IdsDeep(raw.authoredSpawns, bn);
  if (raw.director) raw.director = _remapB01IdsDeep(raw.director, bn);
  const narr = NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[bn];
  if (narr && narr.rooms && raw.rooms) {
    for (const [rk, patch] of Object.entries(narr.rooms)) {
      if (raw.rooms[rk] && patch && typeof patch === 'object') {
        Object.assign(raw.rooms[rk], patch);
      }
    }
  }
  if (narr && narr.floorplanSpaces && raw.floorplan && raw.floorplan.spaces) {
    for (const [sk, patch] of Object.entries(narr.floorplanSpaces)) {
      if (raw.floorplan.spaces[sk] && patch && typeof patch === 'object') {
        Object.assign(raw.floorplan.spaces[sk], patch);
      }
    }
  }
  if (narr && typeof narr.shellTieIn === 'string' && narr.shellTieIn.trim()) {
    raw.shellTieIn = narr.shellTieIn.trim();
  }
  _appendSkeletonFloorplanRefs(raw, bn);
  applyCampaignRouteFloorplanCompletion(raw, bn);
  mergeNativeEncounterTactics(raw, bn);
  return raw;
}

for (let _bn = 2; _bn <= 12; _bn++) {
  const native = _cloneNativeCampaignEncounterFromB01(_bn);
  if (native) CAMPAIGN_ENCOUNTERS[_bn] = native;
}

applyCampaignRouteFloorplanCompletion(CAMPAIGN_ENCOUNTERS[1], 1);

/** Every native campaign def must expose these floorplan space ids (nav / director spine). */
export const MANDATORY_FLOORPLAN_SPACE_IDS_BY_BN = Object.freeze(
  Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((bn) => [
      bn,
      Object.freeze(['dock_intake', 'mid_lane_center', 'relay_cage', 'alarm_relay_room']),
    ]),
  ),
);

/**
 * Map `transitions.*.door` authoring strings to zone indices used by openZoneDoor.
 * @param {string|number|null|undefined} door
 * @returns {number|null}
 */
export function transitionDoorToZoneId(door) {
  if (door == null || door === '') return null;
  if (typeof door === 'number' && door >= 0 && door <= 2) return door | 0;
  const s = String(door).toLowerCase().replace(/_/g, '');
  const map = {
    zone0: 0,
    z0: 0,
    front: 0,
    zone1: 1,
    z1: 1,
    mid: 1,
    middle: 1,
    zone2: 2,
    z2: 2,
    back: 2,
  };
  return Object.prototype.hasOwnProperty.call(map, s) ? map[s] : null;
}

/**
 * @param {number} building
 * @returns {typeof CAMPAIGN_ENCOUNTERS[keyof typeof CAMPAIGN_ENCOUNTERS]|null}
 */
export function getCampaignEncounterDef(building) {
  return CAMPAIGN_ENCOUNTERS[building] || null;
}

/** @returns {Array<object>|null} */
export function getAuthoredFrontZoneSpecs(_building, encounterDef) {
  if (!encounterDef || !Array.isArray(encounterDef.authoredSpawns?.frontZone)) return null;
  const list = encounterDef.authoredSpawns.frontZone;
  return list.length ? list : null;
}

/** @returns {Array<object>|null} */
export function getAuthoredMiddleZoneSpecs(_building, encounterDef) {
  if (!encounterDef || !Array.isArray(encounterDef.authoredSpawns?.middleZone)) return null;
  const list = encounterDef.authoredSpawns.middleZone;
  return list.length ? list : null;
}

/** @returns {Array<object>|null} */
export function getAuthoredBackZoneSpecs(_building, encounterDef) {
  if (!encounterDef || !Array.isArray(encounterDef.authoredSpawns?.backZone)) return null;
  const list = encounterDef.authoredSpawns.backZone;
  return list.length ? list : null;
}
