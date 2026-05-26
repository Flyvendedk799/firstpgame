const materials = {
  floor_concrete: { color: '#31363b', roughness: 0.86, metalness: 0.04 },
  floor_wet: { color: '#252c31', roughness: 0.48, metalness: 0.08 },
  wall_dark: { color: '#161b22', roughness: 0.78, metalness: 0.08 },
  wall_trim: { color: '#2e3944', roughness: 0.62, metalness: 0.18 },
  steel: { color: '#59636b', roughness: 0.44, metalness: 0.52 },
  hazard: { color: '#d3a22e', roughness: 0.52, metalness: 0.12 },
  warning_red: { color: '#b8382e', roughness: 0.54, metalness: 0.08 },
  glass: { color: '#8fd5ff', roughness: 0.1, metalness: 0.02, opacity: 0.36 },
  paint_cyan: { color: '#34c8d8', roughness: 0.58, metalness: 0.04 },
  marker_red: { color: '#ff5048', roughness: 0.45, metalness: 0.02 },
  marker_yellow: { color: '#ffd060', roughness: 0.45, metalness: 0.02 },
  marker_green: { color: '#5fcb52', roughness: 0.45, metalness: 0.02 },
  marker_blue: { color: '#6bb6ff', roughness: 0.45, metalness: 0.02 },
  concrete_light: { color: '#4b545c', roughness: 0.84, metalness: 0.03 },
  wood: { color: '#5a3a20', roughness: 0.72, metalness: 0.03 },
  rubber: { color: '#171717', roughness: 0.9, metalness: 0.01 },
  black: { color: '#080b0f', roughness: 0.66, metalness: 0.18 },
};

function part(name, size, offset, material, collision = 'decorative_only', extra = {}) {
  return { name, kind: 'box', size, offset, material, collision, ...extra };
}

function anchor(id, position, facing = 0, accepts = ['module', 'wall', 'door']) {
  return { id, position, facing, accepts };
}

function prefab(id, category, label, footprint, parts, options = {}) {
  return {
    id,
    label,
    category,
    src: `prefabs/${id}.glb`,
    thumbnail: `thumbs/${id}.png`,
    footprint,
    bounds: options.bounds || { x: [-footprint[0] / 2, footprint[0] / 2], z: [-footprint[1] / 2, footprint[1] / 2], y: [0, options.height || 3.2] },
    grid: options.grid || 0.5,
    rotation: options.rotation || { stepDegrees: 90, allowedDegrees: [0, 90, 180, 270] },
    tags: options.tags || [],
    sockets: options.sockets || [],
    budgets: options.budgets || { triangles: Math.max(12, parts.length * 48), drawCalls: Math.max(1, Math.ceil(parts.length / 6)), dynamicLights: 0, transparentSurfaces: parts.filter((p) => p.material === 'glass').length },
    gameplay: options.gameplay || {},
    parts,
  };
}

const floorPanel = prefab('floor.loading_bay_12x12', 'floors', 'Loading Bay Floor 12m', [12, 12], [
  part('floor_slab', [12, 0.08, 12], [0, 0.02, 0], 'floor_concrete', 'floor_aabb'),
  part('wet_reflective_center', [8.4, 0.012, 5.6], [0, 0.075, 0], 'floor_wet', 'decorative_only'),
  part('route_stripe_a', [0.28, 0.014, 10.8], [-2.8, 0.09, 0], 'paint_cyan', 'decorative_only'),
  part('route_stripe_b', [0.28, 0.014, 10.8], [2.8, 0.09, 0], 'hazard', 'decorative_only'),
], { tags: ['floor', 'industrial', 'b01'] });

const wallFull = prefab('wall.full_6m', 'walls', 'Full Wall 6m', [0.65, 6], [
  part('wall_collision', [0.62, 3.3, 6], [0, 1.65, 0], 'wall_dark', 'wall_aabb', { floorplanRole: 'wall' }),
  part('top_trim', [0.7, 0.18, 6.12], [0, 3.38, 0], 'wall_trim', 'decorative_only'),
  part('base_trim', [0.72, 0.16, 6.12], [0, 0.12, 0], 'steel', 'decorative_only'),
], { tags: ['wall', 'collision'], sockets: [anchor('front', [0, 0, 3]), anchor('back', [0, 0, -3], 180)] });

const wallShort = prefab('wall.peek_cheek_3m', 'walls', 'Peek Cheek Wall', [0.55, 3.2], [
  part('peek_wall_collision', [0.52, 3.3, 3.2], [0, 1.65, 0], 'wall_dark', 'wall_aabb', { floorplanRole: 'peek_wall' }),
  part('warning_lip', [0.58, 0.1, 2.2], [0.02, 1.54, 0], 'hazard', 'decorative_only'),
], { tags: ['wall', 'peek', 'collision'] });

const wallHalf = prefab('wall.half_3m', 'walls', 'Half Wall 3m', [0.65, 3], [
  part('wall_collision', [0.62, 3.3, 3], [0, 1.65, 0], 'wall_dark', 'wall_aabb', { floorplanRole: 'wall' }),
  part('top_trim', [0.7, 0.18, 3.12], [0, 3.38, 0], 'wall_trim', 'decorative_only'),
  part('base_trim', [0.72, 0.16, 3.12], [0, 0.12, 0], 'steel', 'decorative_only'),
], { tags: ['wall', 'short', 'collision'], sockets: [anchor('front', [0, 0, 1.5]), anchor('back', [0, 0, -1.5], 180)] });

const doorwayFrame = prefab('wall.doorway_frame_6m', 'walls', 'Clear Doorway Frame', [0.75, 6], [
  part('left_jamb', [0.62, 3.3, 1.24], [0, 1.65, -2.38], 'wall_dark', 'wall_aabb', { floorplanRole: 'door_jamb' }),
  part('right_jamb', [0.62, 3.3, 1.24], [0, 1.65, 2.38], 'wall_dark', 'wall_aabb', { floorplanRole: 'door_jamb' }),
  part('header', [0.7, 0.36, 3.7], [0, 3.12, 0], 'steel', 'decorative_only'),
  part('threshold_paint', [0.78, 0.025, 3.35], [0, 0.09, 0], 'hazard', 'decorative_only'),
], { tags: ['wall', 'doorway', 'clearance'], sockets: [anchor('front', [0, 0, 3]), anchor('back', [0, 0, -3], 180)] });

const windowWall = prefab('wall.windowed_6m', 'walls', 'Windowed Wall 6m', [0.7, 6], [
  part('lower_wall', [0.62, 0.92, 6], [0, 0.46, 0], 'wall_dark', 'wall_aabb', { floorplanRole: 'low_wall' }),
  part('glass_band', [0.12, 1.45, 5.35], [0, 1.72, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true, breakSound: 'glass' }),
  part('top_wall', [0.62, 0.62, 6], [0, 2.96, 0], 'wall_dark', 'wall_aabb', { floorplanRole: 'window_header' }),
  part('frame_a', [0.18, 1.8, 0.16], [0, 1.72, -2.72], 'steel', 'decorative_only'),
  part('frame_b', [0.18, 1.8, 0.16], [0, 1.72, 2.72], 'steel', 'decorative_only'),
], { tags: ['wall', 'window', 'sightline'], budgets: { triangles: 288, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 1 } });

const cornerL = prefab('wall.l_corner', 'walls', 'L Corner Slice', [4, 4], [
  part('corner_leg_a', [0.58, 3.3, 4], [-1.7, 1.65, 0], 'wall_dark', 'wall_aabb'),
  part('corner_leg_b', [4, 3.3, 0.58], [0, 1.65, -1.7], 'wall_dark', 'wall_aabb'),
  part('corner_trim_a', [0.68, 0.14, 4.1], [-1.7, 3.36, 0], 'steel', 'decorative_only'),
  part('corner_trim_b', [4.1, 0.14, 0.68], [0, 3.36, -1.7], 'steel', 'decorative_only'),
], { tags: ['wall', 'corner', 'collision'], sockets: [anchor('north', [-1.7, 0, 2]), anchor('east', [2, 0, -1.7], 90)] });

const securityGate = prefab('door.security_gate', 'doors', 'Security Gate', [5.4, 0.72], [
  part('gate_collision', [5.4, 3.1, 0.62], [0, 1.55, 0], 'steel', 'wall_aabb', { floorplanRole: 'closed_zone_gate' }),
  part('amber_header', [5.8, 0.22, 0.72], [0, 3.24, 0], 'hazard', 'decorative_only'),
  part('floor_warn', [5.8, 0.02, 1.25], [0, 0.08, 0.62], 'hazard', 'decorative_only'),
], { tags: ['door', 'zoneDoor', 'collision'], gameplay: { zoneDoor: true } });

const rollupDoor = prefab('door.rollup_half_open', 'doors', 'Half-Open Rollup Door', [5.8, 0.85], [
  part('left_post', [0.36, 3.25, 0.72], [-2.7, 1.62, 0], 'steel', 'wall_aabb', { floorplanRole: 'door_post' }),
  part('right_post', [0.36, 3.25, 0.72], [2.7, 1.62, 0], 'steel', 'wall_aabb', { floorplanRole: 'door_post' }),
  part('rollup_header', [5.8, 0.62, 0.7], [0, 2.94, 0], 'steel', 'decorative_only'),
  part('yellow_sill', [5.4, 0.03, 1.3], [0, 0.08, 0], 'hazard', 'decorative_only'),
], { tags: ['door', 'clearance', 'industrial'] });

const halfCover = prefab('cover.half_crate', 'cover', 'Half Cover Crate', [3, 1.1], [
  part('crate_cover', [3, 1.04, 1.1], [0, 0.52, 0], 'wood', 'cover_aabb', { floorplanRole: 'cover' }),
  part('steel_band_a', [3.15, 0.08, 0.08], [0, 1.08, -0.48], 'steel', 'decorative_only'),
  part('steel_band_b', [3.15, 0.08, 0.08], [0, 1.08, 0.48], 'steel', 'decorative_only'),
], { tags: ['cover', 'vaultable'], gameplay: { coverHeight: 1.04 } });

const lowBarrier = prefab('cover.low_barrier', 'cover', 'Low Concrete Barrier', [4, 0.8], [
  part('barrier_cover', [4, 0.72, 0.78], [0, 0.36, 0], 'concrete_light', 'cover_aabb', { floorplanRole: 'low_cover' }),
  part('black_base', [3.75, 0.08, 0.9], [0, 0.08, 0], 'rubber', 'decorative_only'),
  part('hazard_face', [3.5, 0.05, 0.05], [0, 0.56, 0.42], 'hazard', 'decorative_only'),
], { tags: ['cover', 'low', 'vaultable'], gameplay: { coverHeight: 0.72 } });

const tallMachine = prefab('cover.tall_machine', 'cover', 'Tall Machine Cover', [2.5, 1.8], [
  part('machine_cover', [2.5, 1.68, 1.8], [0, 0.84, 0], 'black', 'cover_aabb', { floorplanRole: 'tall_cover' }),
  part('control_glow', [1.6, 0.42, 0.06], [0, 1.18, 0.93], 'paint_cyan', 'decorative_only'),
  part('warning_bar', [2.2, 0.08, 0.08], [0, 1.72, -0.88], 'hazard', 'decorative_only'),
], { tags: ['cover', 'machine'], gameplay: { coverHeight: 1.68 } });

const palletStack = prefab('cover.pallet_stack', 'cover', 'Pallet Stack Cover', [2.8, 1.6], [
  part('pallets_cover', [2.8, 1.16, 1.55], [0, 0.58, 0], 'wood', 'cover_aabb', { floorplanRole: 'stack_cover' }),
  part('top_wrap', [2.55, 0.12, 1.35], [0, 1.22, 0], 'steel', 'decorative_only'),
  part('red_label', [1.4, 0.08, 0.06], [0, 0.88, 0.81], 'warning_red', 'decorative_only'),
], { tags: ['cover', 'warehouse', 'vaultable'], gameplay: { coverHeight: 1.16 } });

const forkliftCover = prefab('cover.forklift', 'cover', 'Forklift Cover', [3.8, 2.2], [
  part('forklift_body', [2.2, 1.2, 1.45], [-0.35, 0.6, 0], 'hazard', 'cover_aabb', { floorplanRole: 'vehicle_cover' }),
  part('forklift_mast', [0.28, 2.35, 0.24], [1.0, 1.18, 0], 'black', 'decorative_only'),
  part('left_fork', [1.9, 0.08, 0.16], [1.65, 0.14, -0.55], 'steel', 'decorative_only'),
  part('right_fork', [1.9, 0.08, 0.16], [1.65, 0.14, 0.55], 'steel', 'decorative_only'),
  part('wheel_a', [0.42, 0.42, 0.42], [-1.12, 0.18, -0.88], 'rubber', 'decorative_only'),
  part('wheel_b', [0.42, 0.42, 0.42], [-1.12, 0.18, 0.88], 'rubber', 'decorative_only'),
], { tags: ['cover', 'vehicle', 'industrial'], gameplay: { coverHeight: 1.2 } });

const breakableWindow = prefab('window.breakable_5m', 'windows', 'Breakable Window', [5, 0.2], [
  part('glass_collision', [5, 1.65, 0.08], [0, 1.5, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true, breakSound: 'glass' }),
  part('frame_top', [5.3, 0.16, 0.18], [0, 2.38, 0], 'steel', 'decorative_only'),
  part('frame_bottom', [5.3, 0.16, 0.18], [0, 0.62, 0], 'steel', 'decorative_only'),
], { tags: ['window', 'breakable', 'sightline'], budgets: { triangles: 144, drawCalls: 2, dynamicLights: 0, transparentSurfaces: 1 } });

const slitWindow = prefab('window.observation_slit_3m', 'windows', 'Observation Slit', [3, 0.18], [
  part('slit_glass', [3, 0.72, 0.08], [0, 1.58, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true, breakSound: 'glass' }),
  part('slit_top', [3.25, 0.16, 0.18], [0, 2.02, 0], 'steel', 'decorative_only'),
  part('slit_bottom', [3.25, 0.16, 0.18], [0, 1.12, 0], 'steel', 'decorative_only'),
], { tags: ['window', 'peek', 'sightline'], budgets: { triangles: 128, drawCalls: 2, dynamicLights: 0, transparentSurfaces: 1 } });

const routeArrow = prefab('route.arrow_forward', 'route', 'Route Arrow', [1.8, 3.6], [
  part('route_arrow_shaft', [0.34, 0.025, 2.4], [0, 0.08, -0.35], 'paint_cyan', 'decorative_only'),
  part('route_arrow_head', [1.3, 0.026, 0.85], [0, 0.081, 1.1], 'hazard', 'decorative_only'),
], { tags: ['route', 'nonblocking'] });

const routeTurnLeft = prefab('route.turn_left', 'route', 'Route Turn Left', [3.8, 3.8], [
  part('route_leg_forward', [0.32, 0.025, 2.55], [0.85, 0.08, -0.45], 'paint_cyan', 'decorative_only'),
  part('route_leg_left', [2.55, 0.025, 0.32], [-0.25, 0.08, 0.72], 'paint_cyan', 'decorative_only'),
  part('route_arrow_head', [1.1, 0.026, 0.8], [-1.45, 0.081, 0.72], 'hazard', 'decorative_only'),
], { tags: ['route', 'turn', 'nonblocking'] });

const routeBreachLine = prefab('route.breach_line', 'route', 'Breach Line Paint', [5.4, 1], [
  part('breach_line', [5.4, 0.026, 0.28], [0, 0.08, 0], 'hazard', 'decorative_only'),
  part('red_tick_a', [0.18, 0.027, 0.82], [-1.8, 0.082, 0], 'warning_red', 'decorative_only'),
  part('red_tick_b', [0.18, 0.027, 0.82], [0, 0.082, 0], 'warning_red', 'decorative_only'),
  part('red_tick_c', [0.18, 0.027, 0.82], [1.8, 0.082, 0], 'warning_red', 'decorative_only'),
], { tags: ['route', 'breach', 'nonblocking'] });

const markerSpawn = prefab('marker.enemy_spawn', 'markers', 'Enemy Spawn Marker', [1, 1], [
  part('spawn_disc', [1, 0.04, 1], [0, 0.08, 0], 'marker_red', 'decorative_only'),
  part('facing_tick', [0.18, 0.045, 0.9], [0, 0.11, 0.46], 'marker_yellow', 'decorative_only'),
], { tags: ['marker', 'enemy'], gameplay: { markerType: 'enemy_spawn' } });

const markerPeek = prefab('marker.peek_angle', 'markers', 'Peek Angle Marker', [1.2, 1.2], [
  part('peek_disc', [1.1, 0.04, 1.1], [0, 0.08, 0], 'marker_yellow', 'decorative_only'),
  part('peek_cone', [1.6, 0.035, 0.28], [0, 0.1, 0.72], 'marker_blue', 'decorative_only'),
], { tags: ['marker', 'peek'], gameplay: { markerType: 'peek_angle' } });

const markerHold = prefab('marker.hold_position', 'markers', 'Hold Position Marker', [1.2, 1.2], [
  part('hold_disc', [1.1, 0.04, 1.1], [0, 0.08, 0], 'marker_green', 'decorative_only'),
  part('hold_cross_a', [1.25, 0.045, 0.12], [0, 0.11, 0], 'marker_yellow', 'decorative_only'),
  part('hold_cross_b', [0.12, 0.045, 1.25], [0, 0.11, 0], 'marker_yellow', 'decorative_only'),
], { tags: ['marker', 'hold'], gameplay: { markerType: 'hold_position' } });

const markerExit = prefab('marker.exit_zone', 'markers', 'Exit Zone Marker', [4, 3], [
  part('exit_floor', [4, 0.035, 3], [0, 0.08, 0], 'marker_green', 'decorative_only'),
  part('exit_bar_a', [4, 0.045, 0.16], [0, 0.11, -1.35], 'hazard', 'decorative_only'),
  part('exit_bar_b', [4, 0.045, 0.16], [0, 0.11, 1.35], 'hazard', 'decorative_only'),
], { tags: ['marker', 'exit'], gameplay: { markerType: 'exit_zone' } });

const pickupAmmo = prefab('pickup.ammo_cache', 'pickups', 'Ammo Cache', [1.2, 1], [
  part('ammo_case', [1.2, 0.55, 0.8], [0, 0.28, 0], 'steel', 'decorative_only'),
  part('ammo_stripe', [1.0, 0.04, 0.08], [0, 0.58, 0.42], 'hazard', 'decorative_only'),
], { tags: ['pickup', 'ammo'] });

const pickupMed = prefab('pickup.med_case', 'pickups', 'Med Case', [1.1, 0.9], [
  part('med_case', [1.1, 0.46, 0.72], [0, 0.24, 0], 'concrete_light', 'decorative_only'),
  part('med_cross_a', [0.58, 0.05, 0.08], [0, 0.5, 0.38], 'marker_green', 'decorative_only'),
  part('med_cross_b', [0.08, 0.05, 0.5], [0, 0.51, 0.38], 'marker_green', 'decorative_only'),
], { tags: ['pickup', 'medical'] });

const propConeCluster = prefab('prop.cone_cluster', 'props', 'Cone Cluster', [1.8, 1.4], [
  part('cone_a', [0.42, 0.72, 0.42], [-0.45, 0.36, 0], 'hazard', 'decorative_only'),
  part('cone_b', [0.38, 0.64, 0.38], [0.35, 0.32, -0.32], 'warning_red', 'decorative_only'),
  part('cone_c', [0.35, 0.58, 0.35], [0.42, 0.29, 0.38], 'hazard', 'decorative_only'),
], { tags: ['prop', 'decal', 'nonblocking'] });

const propCableSpool = prefab('prop.cable_spool', 'props', 'Cable Spool', [1.6, 1.6], [
  part('spool_core', [1.0, 1.05, 1.0], [0, 0.52, 0], 'wood', 'cover_aabb', { floorplanRole: 'round_cover' }),
  part('left_rim', [1.35, 0.12, 1.35], [0, 0.2, 0], 'steel', 'decorative_only'),
  part('right_rim', [1.35, 0.12, 1.35], [0, 0.88, 0], 'steel', 'decorative_only'),
], { tags: ['prop', 'cover', 'industrial'], gameplay: { coverHeight: 1.05 } });

const propServerRack = prefab('prop.server_rack', 'props', 'Server Rack', [1.4, 1.0], [
  part('rack_body', [1.4, 2.4, 1.0], [0, 1.2, 0], 'black', 'wall_aabb', { floorplanRole: 'server_rack' }),
  part('rack_lights_a', [0.08, 0.52, 0.04], [-0.52, 1.44, 0.52], 'paint_cyan', 'decorative_only'),
  part('rack_lights_b', [0.08, 0.52, 0.04], [0.52, 0.96, 0.52], 'marker_green', 'decorative_only'),
], { tags: ['prop', 'cover', 'tech'], gameplay: { coverHeight: 2.4 } });

const propWarningSign = prefab('prop.warning_sign', 'props', 'Warning Sign', [1.4, 0.6], [
  part('sign_post', [0.12, 1.25, 0.12], [0, 0.62, 0], 'steel', 'decorative_only'),
  part('sign_face', [1.4, 0.62, 0.08], [0, 1.28, 0], 'hazard', 'decorative_only'),
  part('sign_red_bar', [1.0, 0.08, 0.09], [0, 1.28, 0.06], 'warning_red', 'decorative_only'),
], { tags: ['prop', 'sign', 'nonblocking'] });

function modulePrefab(id, label, parts, options = {}) {
  return prefab(id, 'modules', label, options.footprint || [12, 12], parts, { tags: ['module', 'encounter', 'b01'].concat(options.tags || []), sockets: options.sockets || [anchor('north', [0, 0, 6]), anchor('south', [0, 0, -6], 180)], height: 3.4, budgets: options.budgets || { triangles: Math.max(160, parts.length * 64), drawCalls: Math.ceil(parts.length / 5), dynamicLights: 0, transparentSurfaces: parts.filter((p) => p.material === 'glass').length } });
}

const modules = [
  modulePrefab('module.straight_hallway_clear', 'Straight Hallway Clear', [
    part('left_lane_wall', [0.55, 3.3, 12], [-4.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_lane_wall', [0.55, 3.3, 12], [4.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('center_route', [0.28, 0.02, 10.2], [0, 0.08, 0], 'paint_cyan', 'decorative_only'),
  ]),
  modulePrefab('module.l_corner_slice', 'L Corner Slice', [
    part('outer_left_wall', [0.55, 3.3, 11], [-4.8, 1.65, 0.5], 'wall_dark', 'wall_aabb'),
    part('outer_back_wall', [9.6, 3.3, 0.55], [0, 1.65, -5.2], 'wall_dark', 'wall_aabb'),
    part('answer_cover', [2.6, 1.04, 1], [1.8, 0.52, -2.3], 'wood', 'cover_aabb'),
  ], { footprint: [10, 12], tags: ['corner'] }),
  modulePrefab('module.t_junction_check', 'T Junction Check', [
    part('center_cheek', [0.55, 3.3, 5.5], [0, 1.65, -2.7], 'wall_dark', 'wall_aabb'),
    part('left_cover', [2.4, 1.04, 1], [-2.8, 0.52, 1.8], 'steel', 'cover_aabb'),
    part('right_cover', [2.4, 1.04, 1], [2.8, 0.52, 1.8], 'steel', 'cover_aabb'),
    part('route_split', [8, 0.02, 0.28], [0, 0.08, 0.4], 'paint_cyan', 'decorative_only'),
  ], { tags: ['junction'] }),
  modulePrefab('module.side_room_loop', 'Side Room Loop', [
    part('side_left_wall', [0.55, 3.3, 10], [-5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('side_right_wall', [0.55, 3.3, 10], [5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('back_lip', [6.8, 3.3, 0.55], [1.8, 1.65, -4.8], 'wall_dark', 'wall_aabb'),
    part('low_cover', [2.6, 1.04, 1], [-1.4, 0.52, -2.4], 'wood', 'cover_aabb'),
  ], { footprint: [12, 11], tags: ['loop'] }),
  modulePrefab('module.airlock_double_door', 'Airlock Double Door', [
    part('front_gate_l', [2.4, 3.1, 0.55], [-1.6, 1.55, 3.1], 'steel', 'wall_aabb'),
    part('front_gate_r', [2.4, 3.1, 0.55], [1.6, 1.55, 3.1], 'steel', 'wall_aabb'),
    part('rear_gate_l', [2.4, 3.1, 0.55], [-1.6, 1.55, -3.1], 'steel', 'wall_aabb'),
    part('rear_gate_r', [2.4, 3.1, 0.55], [1.6, 1.55, -3.1], 'steel', 'wall_aabb'),
    part('airlock_route', [4.8, 0.02, 0.32], [0, 0.08, 0], 'hazard', 'decorative_only'),
  ], { footprint: [7, 8], tags: ['door'] }),
  modulePrefab('module.office_window_clear', 'Office Window Clear', [
    part('office_left_wall', [0.55, 3.3, 10], [-5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('office_glass', [5.8, 1.65, 0.08], [0, 1.55, 3.2], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('office_cover', [2.8, 1.04, 0.95], [2.2, 0.52, -2.5], 'wood', 'cover_aabb'),
  ], { tags: ['window'] }),
  modulePrefab('module.risky_crossing', 'Risky Crossing', [
    part('cross_left_wall', [0.55, 3.3, 7], [-5, 1.65, -1], 'wall_dark', 'wall_aabb'),
    part('cross_right_wall', [0.55, 3.3, 7], [5, 1.65, 1], 'wall_dark', 'wall_aabb'),
    part('mid_low_cover', [2.4, 1.04, 1], [0, 0.52, 0], 'steel', 'cover_aabb'),
    part('danger_floor', [8.6, 0.02, 0.32], [0, 0.08, 2.4], 'hazard', 'decorative_only'),
  ], { tags: ['crossing'] }),
  modulePrefab('module.final_commit_gate', 'Final Commit Gate', [
    part('gate_cheek_l', [0.55, 3.3, 4.5], [-3.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('gate_cheek_r', [0.55, 3.3, 4.5], [3.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('commit_header', [8.4, 0.22, 0.55], [0, 3.25, 0], 'hazard', 'decorative_only'),
    part('last_cover', [3, 1.04, 1], [0, 0.52, -2.8], 'steel', 'cover_aabb'),
  ], { tags: ['final'] }),
  modulePrefab('module.cover_cluster', 'Cover Cluster', [
    part('cluster_crate_a', [2.8, 1.04, 1], [-2.1, 0.52, -1.2], 'wood', 'cover_aabb'),
    part('cluster_crate_b', [2.4, 1.04, 1], [2.2, 0.52, 1.2], 'steel', 'cover_aabb'),
    part('cluster_machine', [1.6, 1.56, 1.4], [0.2, 0.78, -2.4], 'black', 'cover_aabb'),
  ], { footprint: [8, 7], tags: ['cover'] }),
  modulePrefab('module.locked_deco_gate', 'Locked Deco Gate', [
    part('locked_gate', [7.8, 3.2, 0.55], [0, 1.6, 0], 'steel', 'wall_aabb'),
    part('locked_label', [3.2, 0.04, 0.08], [0, 1.92, 0.31], 'marker_red', 'decorative_only'),
  ], { footprint: [8, 1], tags: ['door', 'blocked'] }),
  modulePrefab('module.nested_small_room', 'Nested Small Room', [
    part('outer_left_wall', [0.55, 3.3, 10], [-4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('outer_right_wall', [0.55, 3.3, 10], [4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('inner_partition', [0.52, 3.3, 6.5], [-1.1, 1.65, 1], 'wall_dark', 'wall_aabb'),
    part('inner_cover', [2.4, 1.04, 1], [2.2, 0.52, -2.8], 'wood', 'cover_aabb'),
  ], { footprint: [10, 11], tags: ['room'] }),
  modulePrefab('module.split_sightline', 'Split Sightline', [
    part('lane_left_wall', [0.55, 3.3, 11], [-4.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('lane_right_wall', [0.55, 3.3, 11], [4.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('preview_window', [5.8, 1.65, 0.08], [0, 1.55, 2.6], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('blind_cheek', [4.8, 3.3, 0.55], [1.6, 1.65, -4.4], 'wall_dark', 'wall_aabb'),
    part('answer_cover', [2.4, 1.04, 1], [-1.8, 0.52, -1.4], 'steel', 'cover_aabb'),
  ], { tags: ['sightline', 'window'] }),
  modulePrefab('module.loading_dock_lane', 'Loading Dock Lane', [
    part('dock_left_wall', [0.55, 3.3, 12], [-5.4, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('dock_right_guard', [0.55, 3.3, 7.5], [5.4, 1.65, -2.1], 'wall_dark', 'wall_aabb'),
    part('forklift_body', [2.1, 1.2, 1.45], [1.8, 0.6, 1.5], 'hazard', 'cover_aabb'),
    part('pallet_cover', [2.8, 1.05, 1.25], [-1.6, 0.52, -2.6], 'wood', 'cover_aabb'),
    part('lane_paint', [0.28, 0.02, 10.6], [-3.1, 0.08, 0], 'paint_cyan', 'decorative_only'),
  ], { footprint: [12, 12], tags: ['loading', 'vehicle'] }),
  modulePrefab('module.security_checkpoint', 'Security Checkpoint', [
    part('checkpoint_left', [0.55, 3.3, 5.8], [-4.8, 1.65, 2.6], 'wall_dark', 'wall_aabb'),
    part('checkpoint_right', [0.55, 3.3, 5.8], [4.8, 1.65, 2.6], 'wall_dark', 'wall_aabb'),
    part('scan_machine', [2.5, 1.7, 1.5], [-1.6, 0.85, -1.6], 'black', 'cover_aabb'),
    part('low_counter', [3.2, 1.04, 1.0], [2.1, 0.52, -2.4], 'steel', 'cover_aabb'),
    part('checkpoint_line', [7.4, 0.02, 0.32], [0, 0.08, 0.2], 'hazard', 'decorative_only'),
  ], { footprint: [11, 11], tags: ['checkpoint', 'cover'] }),
  modulePrefab('module.server_room_cover', 'Server Room Cover', [
    part('server_wall_l', [0.55, 3.3, 11], [-5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('server_wall_r', [0.55, 3.3, 11], [5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('rack_a', [1.3, 2.35, 1.0], [-2.7, 1.18, -2.0], 'black', 'wall_aabb'),
    part('rack_b', [1.3, 2.35, 1.0], [0, 1.18, 0.7], 'black', 'wall_aabb'),
    part('rack_c', [1.3, 2.35, 1.0], [2.7, 1.18, -2.0], 'black', 'wall_aabb'),
    part('coolant_line', [0.24, 0.02, 9.2], [0, 0.08, 0], 'paint_cyan', 'decorative_only'),
  ], { footprint: [11, 12], tags: ['tech', 'cover'] }),
  modulePrefab('module.windowed_office_row', 'Windowed Office Row', [
    part('office_back_wall', [10, 3.3, 0.55], [0, 1.65, -5.1], 'wall_dark', 'wall_aabb'),
    part('office_left_wall', [0.55, 3.3, 10], [-5.1, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('front_glass_a', [3.6, 1.65, 0.08], [-2.5, 1.55, 4.3], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('front_glass_b', [3.6, 1.65, 0.08], [2.5, 1.55, 4.3], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('office_desk', [2.4, 1.04, 1.2], [2.2, 0.52, -1.4], 'wood', 'cover_aabb'),
  ], { footprint: [11, 11], tags: ['office', 'window'], budgets: { triangles: 420, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 2 } }),
  modulePrefab('module.forklift_chicane', 'Forklift Chicane', [
    part('left_wall_short', [0.55, 3.3, 5.5], [-5.1, 1.65, 2.2], 'wall_dark', 'wall_aabb'),
    part('right_wall_short', [0.55, 3.3, 5.5], [5.1, 1.65, -2.2], 'wall_dark', 'wall_aabb'),
    part('forklift_one', [2.3, 1.22, 1.55], [-1.8, 0.61, 1.8], 'hazard', 'cover_aabb'),
    part('forklift_two', [2.3, 1.22, 1.55], [1.9, 0.61, -1.9], 'steel', 'cover_aabb'),
    part('chicane_paint', [8.4, 0.02, 0.32], [0, 0.08, 0], 'hazard', 'decorative_only'),
  ], { footprint: [11, 11], tags: ['chicane', 'vehicle'] }),
];

function combatCover(id, label, footprint, bodySize, material = 'steel', extraParts = [], tags = []) {
  const h = bodySize[1];
  return prefab(id, 'cover', label, footprint, [
    part('cover_collision', bodySize, [0, h / 2, 0], material, 'cover_aabb', { floorplanRole: 'combat_cover' }),
    ...extraParts,
  ], { tags: ['cover', 'combat'].concat(tags), gameplay: { coverHeight: h } });
}

function combatWall(id, label, footprint, wallSize, offset = [0, 0, 0], material = 'wall_dark', extraParts = [], tags = []) {
  return prefab(id, 'walls', label, footprint, [
    part('wall_collision', wallSize, [offset[0], 1.65 + (offset[1] || 0), offset[2]], material, 'wall_aabb', { floorplanRole: 'combat_wall' }),
    ...extraParts,
  ], { tags: ['wall', 'combat', 'collision'].concat(tags) });
}

function combatDoor(id, label, footprint, parts, tags = [], gameplay = {}) {
  return prefab(id, 'doors', label, footprint, parts, { tags: ['door', 'combat'].concat(tags), gameplay });
}

function combatProp(id, label, footprint, parts, tags = []) {
  return prefab(id, 'props', label, footprint, parts, { tags: ['prop', 'combat'].concat(tags) });
}

function combatMarker(id, label, footprint, colorMat, gameplayType, tags = []) {
  return prefab(id, 'markers', label, footprint, [
    part('marker_disc', [footprint[0], 0.04, footprint[1]], [0, 0.08, 0], colorMat, 'decorative_only'),
    part('facing_tick', [0.18, 0.045, Math.max(0.8, footprint[1] * 0.75)], [0, 0.11, footprint[1] * 0.28], 'marker_yellow', 'decorative_only'),
  ], { tags: ['marker', 'combat'].concat(tags), gameplay: { markerType: gameplayType } });
}

const combatCoverPrefabs = [
  combatCover('cover.ballistic_shield_wall', 'Ballistic Shield Wall', [3.2, 0.85], [3.2, 1.45, 0.85], 'black', [
    part('yellow_sight_strip', [2.6, 0.08, 0.06], [0, 1.18, 0.46], 'hazard', 'decorative_only'),
  ], ['ballistic', 'anchor']),
  combatCover('cover.sandbag_straight_4m', 'Sandbag Straight 4m', [4, 1.05], [4, 0.92, 1.05], 'concrete_light', [
    part('top_bag_row', [3.65, 0.24, 0.82], [0, 1.03, 0], 'wood', 'decorative_only'),
  ], ['sandbag', 'low']),
  combatCover('cover.sandbag_corner', 'Sandbag Corner', [3.2, 3.2], [3.2, 0.92, 0.95], 'concrete_light', [
    part('corner_leg', [0.95, 0.92, 3.2], [-1.12, 0.46, 1.12], 'concrete_light', 'cover_aabb', { floorplanRole: 'combat_cover' }),
    part('bag_cap_a', [3.05, 0.2, 0.7], [0, 1.02, -1.12], 'wood', 'decorative_only'),
    part('bag_cap_b', [0.7, 0.2, 3.05], [-1.12, 1.02, 0], 'wood', 'decorative_only'),
  ], ['sandbag', 'corner']),
  combatCover('cover.riot_barrier_pair', 'Riot Barrier Pair', [3.8, 1.2], [1.65, 1.28, 0.42], 'glass', [
    part('right_barrier', [1.65, 1.28, 0.42], [1.05, 0.64, 0.18], 'glass', 'cover_aabb', { floorplanRole: 'combat_cover' }),
    part('left_frame', [1.9, 0.1, 0.52], [-1.05, 1.3, -0.18], 'steel', 'decorative_only'),
    part('right_frame', [1.9, 0.1, 0.52], [1.05, 1.3, 0.18], 'steel', 'decorative_only'),
  ], ['transparent', 'mobile']),
  combatCover('cover.mobile_barricade', 'Mobile Barricade', [3.5, 1.1], [3.5, 1.32, 1.1], 'steel', [
    part('red_panel', [2.7, 0.08, 0.06], [0, 0.92, 0.59], 'warning_red', 'decorative_only'),
    part('caster_l', [0.34, 0.34, 0.34], [-1.2, 0.14, -0.52], 'rubber', 'decorative_only'),
    part('caster_r', [0.34, 0.34, 0.34], [1.2, 0.14, -0.52], 'rubber', 'decorative_only'),
  ], ['mobile']),
  combatCover('cover.armored_server_bank', 'Armored Server Bank', [3.6, 1.25], [3.6, 1.72, 1.25], 'black', [
    part('status_lights', [2.8, 0.18, 0.04], [0, 1.1, 0.65], 'paint_cyan', 'decorative_only'),
  ], ['tech', 'tall']),
  combatCover('cover.concrete_pipe_low', 'Concrete Pipe Low', [3.2, 1.25], [3.2, 0.82, 1.25], 'concrete_light', [
    part('dark_inner', [2.5, 0.48, 0.72], [0, 0.46, 0], 'black', 'decorative_only'),
  ], ['low', 'industrial']),
  combatCover('cover.weapon_crate_stack', 'Weapon Crate Stack', [2.6, 1.6], [2.6, 1.18, 1.6], 'black', [
    part('ammo_band_a', [2.3, 0.08, 0.08], [0, 0.65, 0.84], 'hazard', 'decorative_only'),
    part('ammo_band_b', [2.3, 0.08, 0.08], [0, 1.05, 0.84], 'warning_red', 'decorative_only'),
  ], ['crate', 'loot']),
  combatCover('cover.medical_gurney_cover', 'Medical Gurney Cover', [2.6, 1.0], [2.6, 0.88, 1.0], 'concrete_light', [
    part('green_cross', [0.72, 0.06, 0.05], [0, 0.82, 0.52], 'marker_green', 'decorative_only'),
    part('bed_rail', [2.8, 0.08, 0.08], [0, 1.02, -0.52], 'steel', 'decorative_only'),
  ], ['medical', 'low']),
  combatCover('cover.breaching_cart', 'Breaching Cart', [2.4, 1.4], [2.4, 1.08, 1.4], 'steel', [
    part('charge_case', [1.4, 0.32, 1.0], [0, 1.28, 0], 'warning_red', 'decorative_only'),
    part('wheel_l', [0.32, 0.32, 0.32], [-0.9, 0.16, -0.7], 'rubber', 'decorative_only'),
    part('wheel_r', [0.32, 0.32, 0.32], [0.9, 0.16, -0.7], 'rubber', 'decorative_only'),
  ], ['breach', 'mobile']),
  combatCover('cover.steel_desk_flip', 'Flipped Steel Desk', [2.8, 1.15], [2.8, 1.0, 1.15], 'steel', [
    part('desk_warning_sticker', [0.9, 0.04, 0.05], [0.7, 0.66, 0.6], 'hazard', 'decorative_only'),
  ], ['office', 'low']),
  combatCover('cover.generator_block', 'Generator Block', [2.8, 1.8], [2.8, 1.52, 1.8], 'black', [
    part('vent_grille', [1.8, 0.42, 0.05], [0, 0.98, 0.92], 'steel', 'decorative_only'),
    part('warning_lip', [2.1, 0.08, 0.08], [0, 1.56, -0.92], 'hazard', 'decorative_only'),
  ], ['machine', 'tall']),
  combatCover('cover.tire_stack', 'Tire Stack', [1.6, 1.6], [1.5, 1.28, 1.5], 'rubber', [
    part('center_shadow', [0.82, 1.0, 0.82], [0, 0.7, 0], 'black', 'decorative_only'),
  ], ['round', 'low']),
  combatCover('cover.security_kiosk', 'Security Kiosk', [2.4, 2.1], [2.4, 1.68, 2.1], 'wall_trim', [
    part('kiosk_glass', [1.85, 0.78, 0.08], [0, 1.46, 1.09], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('terminal_glow', [0.72, 0.28, 0.05], [-0.58, 0.92, 1.14], 'paint_cyan', 'decorative_only'),
  ], ['checkpoint', 'window']),
  combatCover('cover.maintenance_locker_bank', 'Maintenance Locker Bank', [3.2, 0.9], [3.2, 1.62, 0.9], 'steel', [
    part('locker_red_tag', [0.82, 0.08, 0.05], [0.6, 1.16, 0.48], 'warning_red', 'decorative_only'),
  ], ['locker', 'tall']),
];

const combatWallPrefabs = [
  combatWall('wall.blast_panel_4m', 'Blast Panel 4m', [0.8, 4], [0.72, 3.35, 4], [0, 0, 0], 'steel', [
    part('bolted_header', [0.82, 0.18, 3.8], [0, 3.42, 0], 'hazard', 'decorative_only'),
  ], ['blast']),
  combatWall('wall.bullet_scored_6m', 'Bullet-Scored Wall 6m', [0.65, 6], [0.62, 3.3, 6], [0, 0, 0], 'wall_dark', [
    part('impact_band_a', [0.64, 0.035, 2.4], [0.02, 1.62, -1.1], 'concrete_light', 'decorative_only'),
    part('impact_band_b', [0.64, 0.035, 1.6], [0.02, 2.05, 1.4], 'concrete_light', 'decorative_only'),
  ], ['damaged']),
  combatWall('wall.murder_hole_panel', 'Murder Hole Panel', [0.7, 5], [0.62, 3.3, 5], [0, 0, 0], 'wall_dark', [
    part('firing_slit', [0.08, 0.52, 2.1], [0.36, 1.72, 0], 'black', 'decorative_only'),
    part('slit_trim', [0.12, 0.68, 2.35], [0.38, 1.72, 0], 'steel', 'decorative_only'),
  ], ['ambush', 'sightline']),
  combatWall('wall.partial_concrete_2m', 'Partial Concrete Wall 2m', [0.65, 2], [0.62, 1.55, 2], [0, -0.88, 0], 'concrete_light', [
    part('rebar_top', [0.72, 0.08, 1.8], [0, 1.64, 0], 'steel', 'decorative_only'),
  ], ['partial', 'low']),
  combatWall('wall.angled_cheek_left', 'Angled Cheek Left', [3.2, 3.2], [0.58, 3.3, 3.6], [-0.7, 0, 0], 'wall_dark', [
    part('angle_warning', [0.08, 0.1, 2.1], [-0.42, 1.56, 0], 'hazard', 'decorative_only'),
  ], ['angle', 'peek']),
  combatWall('wall.angled_cheek_right', 'Angled Cheek Right', [3.2, 3.2], [0.58, 3.3, 3.6], [0.7, 0, 0], 'wall_dark', [
    part('angle_warning', [0.08, 0.1, 2.1], [0.42, 1.56, 0], 'hazard', 'decorative_only'),
  ], ['angle', 'peek']),
  combatWall('wall.reinforced_window_slot', 'Reinforced Window Slot', [0.75, 6], [0.62, 3.3, 6], [0, 0, 0], 'wall_dark', [
    part('armored_glass', [0.12, 0.88, 3.3], [0.37, 1.68, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('steel_lintel', [0.78, 0.18, 3.55], [0, 2.22, 0], 'steel', 'decorative_only'),
  ], ['window', 'reinforced']),
  combatWall('wall.short_connector_1m', 'Short Connector 1m', [0.65, 1], [0.62, 3.3, 1], [0, 0, 0], 'wall_dark', [
    part('connector_cap', [0.7, 0.16, 1.05], [0, 3.38, 0], 'wall_trim', 'decorative_only'),
  ], ['connector']),
];

const combatDoorPrefabs = [
  combatDoor('door.breachable_wood', 'Breachable Wood Door', [3.2, 0.45], [
    part('door_panel', [3.2, 2.65, 0.32], [0, 1.34, 0], 'wood', 'wall_aabb', { floorplanRole: 'breachable_door' }),
    part('kick_plate', [2.5, 0.34, 0.36], [0, 0.45, 0.02], 'steel', 'decorative_only'),
  ], ['breach', 'wood']),
  combatDoor('door.armored_checkpoint', 'Armored Checkpoint Door', [4.8, 0.7], [
    part('armored_leaf', [4.8, 3.0, 0.58], [0, 1.5, 0], 'steel', 'wall_aabb', { floorplanRole: 'armored_door' }),
    part('red_lock', [0.5, 0.28, 0.06], [1.6, 1.5, 0.33], 'warning_red', 'decorative_only'),
  ], ['locked', 'checkpoint']),
  combatDoor('door.double_swing_clear', 'Double Swing Door Frame', [5.2, 0.55], [
    part('left_jamb', [0.42, 3.05, 0.5], [-2.35, 1.52, 0], 'steel', 'wall_aabb'),
    part('right_jamb', [0.42, 3.05, 0.5], [2.35, 1.52, 0], 'steel', 'wall_aabb'),
    part('header', [5.2, 0.36, 0.55], [0, 3.0, 0], 'steel', 'decorative_only'),
    part('swing_arc_paint', [4.4, 0.025, 0.16], [0, 0.08, 0.44], 'paint_cyan', 'decorative_only'),
  ], ['clearance', 'frame']),
  combatDoor('door.shutter_locked', 'Locked Shutter', [5.6, 0.72], [
    part('shutter_collision', [5.6, 2.45, 0.55], [0, 1.23, 0], 'steel', 'wall_aabb', { floorplanRole: 'locked_shutter' }),
    part('red_lock_bar', [4.4, 0.16, 0.08], [0, 1.36, 0.33], 'warning_red', 'decorative_only'),
  ], ['locked', 'shutter']),
  combatDoor('door.keycard_airlock', 'Keycard Airlock Door', [4.6, 0.8], [
    part('airlock_collision', [4.6, 3.1, 0.62], [0, 1.55, 0], 'black', 'wall_aabb', { floorplanRole: 'keycard_door' }),
    part('keycard_panel', [0.42, 0.72, 0.06], [2.05, 1.25, 0.36], 'paint_cyan', 'decorative_only'),
    part('amber_header', [4.8, 0.18, 0.72], [0, 3.22, 0], 'hazard', 'decorative_only'),
  ], ['keycard', 'airlock']),
  combatDoor('door.blast_door_partial', 'Partial Blast Door', [5.8, 0.75], [
    part('left_blast_leaf', [2.1, 3.1, 0.62], [-1.85, 1.55, 0], 'steel', 'wall_aabb'),
    part('right_blast_leaf', [1.2, 3.1, 0.62], [2.2, 1.55, 0], 'steel', 'wall_aabb'),
    part('gap_warning', [1.2, 0.025, 1.0], [0.35, 0.08, 0.42], 'hazard', 'decorative_only'),
  ], ['partial', 'blast']),
  combatDoor('door.service_hatch_low', 'Low Service Hatch', [2.2, 0.5], [
    part('hatch_collision', [2.2, 1.35, 0.42], [0, 0.68, 0], 'steel', 'wall_aabb', { floorplanRole: 'low_hatch' }),
    part('hatch_handle', [0.58, 0.08, 0.06], [0.55, 0.82, 0.24], 'hazard', 'decorative_only'),
  ], ['low', 'service']),
];

const combatWindowPrefabs = [
  prefab('window.long_observation_8m', 'windows', 'Long Observation Window', [8, 0.22], [
    part('glass_collision', [8, 1.4, 0.08], [0, 1.55, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('top_frame', [8.25, 0.18, 0.18], [0, 2.34, 0], 'steel', 'decorative_only'),
    part('bottom_frame', [8.25, 0.18, 0.18], [0, 0.74, 0], 'steel', 'decorative_only'),
  ], { tags: ['window', 'combat', 'long'], budgets: { triangles: 180, drawCalls: 2, dynamicLights: 0, transparentSurfaces: 1 } }),
  prefab('window.corner_glass_left', 'windows', 'Corner Glass Left', [3.2, 3.2], [
    part('glass_a', [3.2, 1.35, 0.08], [0, 1.55, -1.55], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('glass_b', [0.08, 1.35, 3.2], [-1.55, 1.55, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('corner_post', [0.18, 1.75, 0.18], [-1.55, 1.55, -1.55], 'steel', 'decorative_only'),
  ], { tags: ['window', 'corner', 'combat'], budgets: { triangles: 220, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 2 } }),
  prefab('window.corner_glass_right', 'windows', 'Corner Glass Right', [3.2, 3.2], [
    part('glass_a', [3.2, 1.35, 0.08], [0, 1.55, 1.55], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('glass_b', [0.08, 1.35, 3.2], [1.55, 1.55, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('corner_post', [0.18, 1.75, 0.18], [1.55, 1.55, 1.55], 'steel', 'decorative_only'),
  ], { tags: ['window', 'corner', 'combat'], budgets: { triangles: 220, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 2 } }),
  prefab('window.high_clerestory', 'windows', 'High Clerestory Window', [4.8, 0.18], [
    part('high_glass', [4.8, 0.72, 0.08], [0, 2.42, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('lower_wall_band', [4.9, 1.64, 0.18], [0, 1.18, 0], 'wall_dark', 'wall_aabb'),
  ], { tags: ['window', 'high', 'combat'], budgets: { triangles: 160, drawCalls: 2, dynamicLights: 0, transparentSurfaces: 1 } }),
  prefab('window.cracked_cover_glass', 'windows', 'Cracked Cover Glass', [3.6, 0.35], [
    part('low_wall_cover', [3.6, 0.88, 0.35], [0, 0.44, 0], 'wall_dark', 'cover_aabb', { floorplanRole: 'low_window_cover' }),
    part('cracked_glass', [3.4, 1.08, 0.08], [0, 1.38, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('crack_stripe', [2.4, 0.035, 0.05], [0.2, 1.55, 0.08], 'marker_blue', 'decorative_only'),
  ], { tags: ['window', 'cover', 'combat'], budgets: { triangles: 196, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 1 } }),
];

const combatPropPrefabs = [
  combatProp('prop.flashbang_case', 'Flashbang Case', [1.2, 0.8], [
    part('case', [1.2, 0.42, 0.8], [0, 0.21, 0], 'steel', 'decorative_only'),
    part('flash_label', [0.84, 0.05, 0.05], [0, 0.45, 0.42], 'marker_yellow', 'decorative_only'),
  ], ['grenade', 'pickup']),
  combatProp('prop.breaching_charge_wall', 'Breaching Charge Wall Prop', [1.8, 0.35], [
    part('charge_block', [1.8, 0.48, 0.18], [0, 1.25, 0], 'warning_red', 'decorative_only'),
    part('wire_lead', [1.4, 0.04, 0.05], [0, 0.92, 0.1], 'black', 'decorative_only'),
  ], ['breach', 'charge']),
  combatProp('prop.tripod_light', 'Tripod Combat Light', [1.3, 1.3], [
    part('light_head', [0.72, 0.42, 0.28], [0, 1.72, 0], 'hazard', 'decorative_only'),
    part('tripod_center', [0.12, 1.55, 0.12], [0, 0.8, 0], 'steel', 'decorative_only'),
    part('leg_a', [0.12, 0.08, 1.2], [0, 0.22, 0.36], 'steel', 'decorative_only'),
  ], ['lighting', 'nonblocking']),
  combatProp('prop.camera_pole', 'Security Camera Pole', [0.9, 0.9], [
    part('pole', [0.12, 2.6, 0.12], [0, 1.3, 0], 'steel', 'decorative_only'),
    part('camera_head', [0.55, 0.28, 0.32], [0, 2.5, 0.28], 'black', 'decorative_only'),
  ], ['camera', 'sightline']),
  combatProp('prop.hostage_dummy', 'Hostage Dummy Marker Prop', [0.9, 0.9], [
    part('dummy_body', [0.62, 1.55, 0.42], [0, 0.78, 0], 'concrete_light', 'decorative_only'),
    part('dummy_head', [0.42, 0.42, 0.42], [0, 1.78, 0], 'hazard', 'decorative_only'),
  ], ['hostage', 'scenario']),
  combatProp('prop.evidence_table', 'Evidence Table', [2.5, 1.2], [
    part('table_top', [2.5, 0.16, 1.2], [0, 0.82, 0], 'steel', 'decorative_only'),
    part('case_a', [0.72, 0.24, 0.48], [-0.7, 1.02, 0], 'black', 'decorative_only'),
    part('case_b', [0.54, 0.2, 0.42], [0.55, 1.0, 0.18], 'warning_red', 'decorative_only'),
  ], ['objective', 'table']),
  combatProp('prop.explosive_barrel_red', 'Explosive Barrel Red', [0.9, 0.9], [
    part('barrel_collision', [0.86, 1.12, 0.86], [0, 0.56, 0], 'warning_red', 'cover_aabb', { floorplanRole: 'hazard_cover' }),
    part('hazard_band', [0.92, 0.12, 0.92], [0, 0.98, 0], 'hazard', 'decorative_only'),
  ], ['hazard', 'explosive']),
  combatProp('prop.alarm_console', 'Alarm Console', [1.4, 0.9], [
    part('console_body', [1.4, 1.08, 0.9], [0, 0.54, 0], 'black', 'cover_aabb', { floorplanRole: 'console_cover' }),
    part('screen_glow', [0.9, 0.42, 0.05], [0, 0.86, 0.48], 'warning_red', 'decorative_only'),
  ], ['alarm', 'interactive']),
  combatProp('prop.smoke_canister_cluster', 'Smoke Canister Cluster', [1.4, 1.0], [
    part('canister_a', [0.34, 0.72, 0.34], [-0.38, 0.36, 0], 'steel', 'decorative_only'),
    part('canister_b', [0.34, 0.72, 0.34], [0, 0.36, 0.18], 'steel', 'decorative_only'),
    part('canister_c', [0.34, 0.72, 0.34], [0.38, 0.36, -0.05], 'steel', 'decorative_only'),
  ], ['smoke', 'grenade']),
  combatProp('prop.range_target_silhouette', 'Range Target Silhouette', [0.9, 0.6], [
    part('target_post', [0.08, 1.5, 0.08], [0, 0.75, 0], 'steel', 'decorative_only'),
    part('target_body', [0.82, 1.05, 0.06], [0, 1.28, 0], 'marker_red', 'decorative_only'),
  ], ['target', 'training']),
];

const combatRoutePrefabs = [
  prefab('route.hold_short', 'route', 'Hold Short Paint', [3.2, 1], [
    part('hold_bar', [3.2, 0.026, 0.24], [0, 0.08, 0], 'marker_green', 'decorative_only'),
    part('hold_tick_a', [0.18, 0.027, 0.82], [-1.15, 0.081, 0], 'marker_green', 'decorative_only'),
    part('hold_tick_b', [0.18, 0.027, 0.82], [1.15, 0.081, 0], 'marker_green', 'decorative_only'),
  ], { tags: ['route', 'combat', 'hold', 'nonblocking'] }),
  prefab('route.danger_cross', 'route', 'Danger Cross Paint', [3.4, 3.4], [
    part('danger_a', [3.4, 0.026, 0.28], [0, 0.08, 0], 'warning_red', 'decorative_only'),
    part('danger_b', [0.28, 0.026, 3.4], [0, 0.081, 0], 'warning_red', 'decorative_only'),
  ], { tags: ['route', 'danger', 'combat', 'nonblocking'] }),
  prefab('route.stack_left', 'route', 'Stack Left Paint', [2.6, 3.2], [
    part('stack_line', [0.28, 0.026, 2.6], [0.45, 0.08, 0], 'paint_cyan', 'decorative_only'),
    part('stack_arrow', [1.45, 0.026, 0.5], [-0.35, 0.081, 1.2], 'hazard', 'decorative_only'),
  ], { tags: ['route', 'stack', 'left', 'combat'] }),
  prefab('route.stack_right', 'route', 'Stack Right Paint', [2.6, 3.2], [
    part('stack_line', [0.28, 0.026, 2.6], [-0.45, 0.08, 0], 'paint_cyan', 'decorative_only'),
    part('stack_arrow', [1.45, 0.026, 0.5], [0.35, 0.081, 1.2], 'hazard', 'decorative_only'),
  ], { tags: ['route', 'stack', 'right', 'combat'] }),
  prefab('route.clear_room', 'route', 'Clear Room Paint', [3.8, 2.8], [
    part('clear_arrow', [0.32, 0.026, 2.4], [0, 0.08, 0], 'paint_cyan', 'decorative_only'),
    part('clear_head', [1.4, 0.026, 0.72], [0, 0.081, 1.08], 'marker_green', 'decorative_only'),
    part('clear_bar', [3.2, 0.026, 0.2], [0, 0.082, -1.25], 'marker_green', 'decorative_only'),
  ], { tags: ['route', 'clear', 'combat'] }),
  prefab('route.funnel_warning', 'route', 'Funnel Warning Paint', [4.6, 1.2], [
    part('funnel_left', [2.2, 0.026, 0.22], [-1.0, 0.08, 0], 'hazard', 'decorative_only'),
    part('funnel_right', [2.2, 0.026, 0.22], [1.0, 0.081, 0], 'hazard', 'decorative_only'),
    part('funnel_red', [4.2, 0.026, 0.12], [0, 0.082, 0.48], 'warning_red', 'decorative_only'),
  ], { tags: ['route', 'funnel', 'combat'] }),
  prefab('route.fallback_arrow', 'route', 'Fallback Arrow Paint', [2.2, 3.4], [
    part('fallback_shaft', [0.32, 0.026, 2.0], [0, 0.08, 0.25], 'marker_blue', 'decorative_only'),
    part('fallback_head', [1.35, 0.026, 0.72], [0, 0.081, -0.95], 'marker_blue', 'decorative_only'),
  ], { tags: ['route', 'fallback', 'combat'] }),
];

const combatMarkerPrefabs = [
  combatMarker('marker.cover_hint', 'Cover Hint Marker', [1.1, 1.1], 'marker_green', 'cover_hint', ['cover']),
  combatMarker('marker.patrol_node', 'Patrol Node Marker', [1.0, 1.0], 'marker_blue', 'patrol_node', ['patrol']),
  combatMarker('marker.trigger_volume', 'Trigger Volume Marker', [1.4, 1.4], 'marker_yellow', 'trigger_volume', ['trigger']),
  combatMarker('marker.sniper_perch', 'Sniper Perch Marker', [1.2, 1.2], 'marker_red', 'sniper_perch', ['sniper']),
  combatMarker('marker.breach_point', 'Breach Point Marker', [1.3, 1.3], 'warning_red', 'breach_point', ['breach']),
];

const combatPickupPrefabs = [
  prefab('pickup.armor_plate', 'pickups', 'Armor Plate Case', [1.1, 0.9], [
    part('armor_case', [1.1, 0.42, 0.72], [0, 0.21, 0], 'black', 'decorative_only'),
    part('armor_plate', [0.72, 0.06, 0.5], [0, 0.46, 0.36], 'steel', 'decorative_only'),
  ], { tags: ['pickup', 'armor', 'combat'] }),
  prefab('pickup.flashbang_box', 'pickups', 'Flashbang Box', [1.2, 0.9], [
    part('flash_box', [1.2, 0.46, 0.82], [0, 0.23, 0], 'steel', 'decorative_only'),
    part('flash_mark', [0.72, 0.05, 0.05], [0, 0.5, 0.43], 'marker_yellow', 'decorative_only'),
  ], { tags: ['pickup', 'flashbang', 'combat'] }),
  prefab('pickup.keycard_case', 'pickups', 'Keycard Case', [0.95, 0.75], [
    part('key_case', [0.95, 0.28, 0.62], [0, 0.14, 0], 'black', 'decorative_only'),
    part('key_glow', [0.48, 0.04, 0.04], [0, 0.31, 0.33], 'paint_cyan', 'decorative_only'),
  ], { tags: ['pickup', 'keycard', 'objective'] }),
];

const combatFloorPrefabs = [
  prefab('floor.killhouse_tile_8x8', 'floors', 'Killhouse Floor 8m', [8, 8], [
    part('floor_slab', [8, 0.08, 8], [0, 0.02, 0], 'floor_concrete', 'floor_aabb'),
    part('center_cross_a', [6.8, 0.014, 0.22], [0, 0.08, 0], 'hazard', 'decorative_only'),
    part('center_cross_b', [0.22, 0.014, 6.8], [0, 0.081, 0], 'hazard', 'decorative_only'),
  ], { tags: ['floor', 'combat', 'killhouse'] }),
  prefab('floor.hazard_oil_strip', 'floors', 'Oil Hazard Strip', [6, 2], [
    part('floor_patch', [6, 0.04, 2], [0, 0.02, 0], 'floor_wet', 'floor_aabb'),
    part('hazard_edge_a', [6, 0.015, 0.12], [0, 0.07, -0.88], 'hazard', 'decorative_only'),
    part('hazard_edge_b', [6, 0.015, 0.12], [0, 0.07, 0.88], 'hazard', 'decorative_only'),
  ], { tags: ['floor', 'hazard', 'combat'] }),
  prefab('floor.metal_grate_6x6', 'floors', 'Metal Grate 6m', [6, 6], [
    part('grate_floor', [6, 0.08, 6], [0, 0.02, 0], 'steel', 'floor_aabb'),
    part('grate_line_a', [6, 0.015, 0.1], [0, 0.08, -1.8], 'black', 'decorative_only'),
    part('grate_line_b', [6, 0.015, 0.1], [0, 0.081, 1.8], 'black', 'decorative_only'),
  ], { tags: ['floor', 'grate', 'combat'] }),
  prefab('floor.breach_threshold', 'floors', 'Breach Threshold Floor', [5.4, 2.2], [
    part('threshold_floor', [5.4, 0.05, 2.2], [0, 0.02, 0], 'floor_concrete', 'floor_aabb'),
    part('breach_line', [5.2, 0.016, 0.28], [0, 0.08, 0], 'warning_red', 'decorative_only'),
  ], { tags: ['floor', 'breach', 'combat'] }),
];

const combatModulePrefabs = [
  modulePrefab('module.ambush_crossfire', 'Ambush Crossfire', [
    part('left_wall', [0.55, 3.3, 11.5], [-5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_wall', [0.55, 3.3, 11.5], [5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('left_cover', [2.7, 1.05, 1.0], [-2.8, 0.52, -2.1], 'steel', 'cover_aabb'),
    part('right_cover', [2.7, 1.05, 1.0], [2.8, 0.52, 2.1], 'wood', 'cover_aabb'),
    part('danger_cross', [8.5, 0.02, 0.3], [0, 0.08, 0], 'warning_red', 'decorative_only'),
  ], { footprint: [12, 12], tags: ['ambush', 'crossfire'] }),
  modulePrefab('module.breach_room_two_cover', 'Breach Room Two Cover', [
    part('back_wall', [9.6, 3.3, 0.55], [0, 1.65, -5.1], 'wall_dark', 'wall_aabb'),
    part('left_jamb', [0.55, 3.3, 4.6], [-4.8, 1.65, 2.6], 'wall_dark', 'wall_aabb'),
    part('right_jamb', [0.55, 3.3, 4.6], [4.8, 1.65, 2.6], 'wall_dark', 'wall_aabb'),
    part('near_cover', [2.4, 1.04, 1.0], [-2, 0.52, 0.8], 'steel', 'cover_aabb'),
    part('far_cover', [2.4, 1.04, 1.0], [2.2, 0.52, -2.3], 'wood', 'cover_aabb'),
  ], { footprint: [11, 12], tags: ['breach', 'room'] }),
  modulePrefab('module.long_angle_sniper_lane', 'Long Angle Sniper Lane', [
    part('lane_left_wall', [0.55, 3.3, 14], [-4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('lane_right_wall', [0.55, 3.3, 14], [4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('sniper_slot', [0.08, 0.72, 3.8], [4.5, 1.8, -4.2], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('advance_cover', [2.7, 1.04, 1.0], [-1.6, 0.52, 1.2], 'steel', 'cover_aabb'),
  ], { footprint: [11, 15], tags: ['sniper', 'long'] }),
  modulePrefab('module.hostage_room_split', 'Hostage Room Split', [
    part('outer_left', [0.55, 3.3, 10], [-5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('outer_right', [0.55, 3.3, 10], [5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('splitter', [5.5, 3.3, 0.55], [-1.4, 1.65, -1.4], 'wall_dark', 'wall_aabb'),
    part('hostage_marker', [0.7, 1.4, 0.45], [2.8, 0.7, -3.0], 'hazard', 'decorative_only'),
    part('low_cover', [2.4, 1.04, 1.0], [1.6, 0.52, 1.8], 'steel', 'cover_aabb'),
  ], { footprint: [11, 11], tags: ['hostage', 'split'] }),
  modulePrefab('module.control_room_final', 'Control Room Final', [
    part('control_back_wall', [10.5, 3.3, 0.55], [0, 1.65, -5.2], 'wall_dark', 'wall_aabb'),
    part('left_server', [1.4, 2.35, 1.0], [-3.2, 1.18, -2.4], 'black', 'wall_aabb'),
    part('right_server', [1.4, 2.35, 1.0], [3.2, 1.18, -2.4], 'black', 'wall_aabb'),
    part('center_console', [3.2, 1.18, 1.2], [0, 0.59, 1.1], 'steel', 'cover_aabb'),
    part('alarm_glow', [1.1, 0.28, 0.05], [0, 1.08, 1.72], 'warning_red', 'decorative_only'),
  ], { footprint: [12, 12], tags: ['final', 'control'] }),
  modulePrefab('module.close_quarters_maze', 'Close Quarters Maze', [
    part('maze_wall_a', [0.55, 3.3, 7.2], [-3.6, 1.65, 1.8], 'wall_dark', 'wall_aabb'),
    part('maze_wall_b', [0.55, 3.3, 7.2], [0.2, 1.65, -1.8], 'wall_dark', 'wall_aabb'),
    part('maze_wall_c', [5.0, 3.3, 0.55], [2.2, 1.65, 2.6], 'wall_dark', 'wall_aabb'),
    part('low_crate', [2.1, 1.04, 1.0], [3.4, 0.52, -3.0], 'wood', 'cover_aabb'),
  ], { footprint: [10, 11], tags: ['cqb', 'maze'] }),
  modulePrefab('module.cover_to_cover_push', 'Cover To Cover Push', [
    part('left_wall', [0.55, 3.3, 12], [-5.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_wall', [0.55, 3.3, 12], [5.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('cover_one', [2.5, 1.04, 1.0], [-2.5, 0.52, 3.1], 'steel', 'cover_aabb'),
    part('cover_two', [2.5, 1.04, 1.0], [2.3, 0.52, 0.2], 'wood', 'cover_aabb'),
    part('cover_three', [2.5, 1.04, 1.0], [-1.7, 0.52, -3.2], 'steel', 'cover_aabb'),
    part('push_arrow', [0.28, 0.02, 10.2], [0, 0.08, 0], 'paint_cyan', 'decorative_only'),
  ], { footprint: [11, 13], tags: ['push', 'cover'] }),
  modulePrefab('module.overwatch_balcony_ground', 'Overwatch Balcony Ground', [
    part('balcony_back_wall', [10, 3.3, 0.55], [0, 1.65, -5.1], 'wall_dark', 'wall_aabb'),
    part('balcony_rail_cover', [7, 1.18, 0.55], [0, 0.59, -1.8], 'steel', 'cover_aabb'),
    part('left_pillar', [0.8, 3.3, 0.8], [-4.4, 1.65, -1.8], 'wall_trim', 'wall_aabb'),
    part('right_pillar', [0.8, 3.3, 0.8], [4.4, 1.65, -1.8], 'wall_trim', 'wall_aabb'),
    part('ground_cover', [2.8, 1.04, 1.0], [0, 0.52, 2.7], 'wood', 'cover_aabb'),
  ], { footprint: [11, 12], tags: ['overwatch', 'vertical'] }),
];

const hallwaySubroomPrefabs = [
  combatWall('wall.subroom_partition_4m', 'Subroom Partition 4m', [0.55, 4], [0.52, 3.15, 4], [0, 0, 0], 'wall_dark', [
    part('room_number_strip', [0.56, 0.08, 1.4], [0.02, 1.48, -1.1], 'hazard', 'decorative_only'),
  ], ['subroom', 'partition']),
  combatWall('wall.subroom_partition_6m', 'Subroom Partition 6m', [0.55, 6], [0.52, 3.15, 6], [0, 0, 0], 'wall_dark', [
    part('utility_channel', [0.58, 0.12, 5.2], [0.02, 2.8, 0], 'steel', 'decorative_only'),
  ], ['subroom', 'partition']),
  combatWall('wall.subroom_door_jamb_left', 'Subroom Left Door Jamb', [0.65, 2.6], [0.52, 3.15, 2.6], [0, 0, 0], 'wall_dark', [
    part('jamb_warn_left', [0.58, 0.1, 0.9], [0.02, 1.46, 0.78], 'hazard', 'decorative_only'),
  ], ['subroom', 'doorway', 'jamb']),
  combatWall('wall.subroom_door_jamb_right', 'Subroom Right Door Jamb', [0.65, 2.6], [0.52, 3.15, 2.6], [0, 0, 0], 'wall_dark', [
    part('jamb_warn_right', [0.58, 0.1, 0.9], [0.02, 1.46, -0.78], 'hazard', 'decorative_only'),
  ], ['subroom', 'doorway', 'jamb']),
  combatWall('wall.corner_subroom_post', 'Subroom Corner Post', [1.1, 1.1], [1.1, 3.2, 1.1], [0, 0, 0], 'wall_trim', [
    part('post_cap', [1.22, 0.18, 1.22], [0, 3.32, 0], 'steel', 'decorative_only'),
  ], ['corner', 'subroom']),
  combatWall('wall.half_height_partition_4m', 'Half Height Partition 4m', [0.55, 4], [0.52, 1.55, 4], [0, -0.86, 0], 'concrete_light', [
    part('partition_top_rail', [0.62, 0.12, 4.1], [0, 1.62, 0], 'steel', 'decorative_only'),
  ], ['subroom', 'partial', 'cover']),
  combatWall('wall.slatted_cover_wall_5m', 'Slatted Cover Wall 5m', [0.65, 5], [0.55, 2.4, 5], [0, -0.35, 0], 'wall_trim', [
    part('sight_gap_a', [0.08, 0.16, 4.2], [0.35, 1.35, 0], 'black', 'decorative_only'),
    part('sight_gap_b', [0.08, 0.16, 4.2], [0.35, 1.85, 0], 'black', 'decorative_only'),
  ], ['slatted', 'sightline', 'subroom']),
  combatWall('wall.service_panel_wall', 'Service Panel Wall', [0.65, 4.5], [0.58, 3.2, 4.5], [0, 0, 0], 'wall_dark', [
    part('service_panel', [0.08, 1.1, 1.6], [0.36, 1.42, 0.5], 'steel', 'decorative_only'),
    part('panel_light', [0.09, 0.28, 0.12], [0.42, 1.84, 1.2], 'marker_red', 'decorative_only'),
  ], ['service', 'panel']),
  combatWall('wall.hallway_bulge_left', 'Hallway Bulge Left', [2.8, 4], [0.58, 3.2, 4], [-1.0, 0, 0], 'wall_dark', [
    part('bulge_return', [2.2, 3.2, 0.55], [0, 1.65, -1.72], 'wall_dark', 'wall_aabb', { floorplanRole: 'hallway_bulge' }),
  ], ['hallway', 'bulge']),
  combatWall('wall.hallway_bulge_right', 'Hallway Bulge Right', [2.8, 4], [0.58, 3.2, 4], [1.0, 0, 0], 'wall_dark', [
    part('bulge_return', [2.2, 3.2, 0.55], [0, 1.65, 1.72], 'wall_dark', 'wall_aabb', { floorplanRole: 'hallway_bulge' }),
  ], ['hallway', 'bulge']),
  combatDoor('door.subroom_swing_clear', 'Subroom Swing Clear Door', [3.4, 0.5], [
    part('left_jamb', [0.34, 3.0, 0.45], [-1.55, 1.5, 0], 'steel', 'wall_aabb'),
    part('right_jamb', [0.34, 3.0, 0.45], [1.55, 1.5, 0], 'steel', 'wall_aabb'),
    part('swing_arc', [2.7, 0.025, 0.16], [0, 0.08, 0.38], 'paint_cyan', 'decorative_only'),
  ], ['subroom', 'clearance']),
  combatDoor('door.subroom_locked_solid', 'Subroom Locked Solid Door', [3.4, 0.55], [
    part('locked_panel', [3.4, 2.75, 0.42], [0, 1.38, 0], 'wall_trim', 'wall_aabb', { floorplanRole: 'locked_subroom_door' }),
    part('room_lock_light', [0.36, 0.24, 0.05], [1.25, 1.45, 0.28], 'warning_red', 'decorative_only'),
  ], ['subroom', 'locked']),
  combatDoor('door.hallway_crash_bar', 'Hallway Crash Bar Door', [3.8, 0.55], [
    part('crash_door_panel', [3.8, 2.85, 0.38], [0, 1.43, 0], 'steel', 'wall_aabb', { floorplanRole: 'crash_bar_door' }),
    part('crash_bar', [2.5, 0.12, 0.08], [0, 1.18, 0.25], 'hazard', 'decorative_only'),
  ], ['hallway', 'locked']),
  combatDoor('door.glass_office_door', 'Glass Office Door', [3.2, 0.45], [
    part('glass_door', [3.2, 2.55, 0.08], [0, 1.35, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('door_frame', [3.4, 0.14, 0.45], [0, 2.72, 0], 'steel', 'decorative_only'),
    part('handle_bar', [0.1, 0.86, 0.08], [1.18, 1.32, 0.08], 'steel', 'decorative_only'),
  ], ['glass', 'office']),
  combatDoor('door.chainlink_gate', 'Chainlink Gate', [4.8, 0.55], [
    part('gate_collision', [4.8, 2.4, 0.12], [0, 1.25, 0], 'steel', 'wall_aabb', { floorplanRole: 'chainlink_gate' }),
    part('mesh_hint_a', [4.5, 0.06, 0.06], [0, 1.28, 0.16], 'black', 'decorative_only'),
    part('mesh_hint_b', [0.06, 2.2, 0.06], [-1.5, 1.25, 0.17], 'black', 'decorative_only'),
    part('lock_box', [0.36, 0.36, 0.1], [1.95, 1.2, 0.2], 'warning_red', 'decorative_only'),
  ], ['industrial', 'gate']),
  combatCover('cover.hallway_wall_locker', 'Hallway Wall Locker', [1.8, 0.75], [1.8, 1.72, 0.75], 'steel', [
    part('locker_tag', [0.72, 0.06, 0.05], [0.36, 1.16, 0.4], 'hazard', 'decorative_only'),
  ], ['hallway', 'locker', 'tall']),
  combatCover('cover.hallway_mail_cart', 'Hallway Mail Cart', [2.2, 1.0], [2.2, 1.04, 1.0], 'steel', [
    part('cart_handle', [1.5, 0.08, 0.08], [0, 1.12, -0.55], 'black', 'decorative_only'),
    part('caster_a', [0.28, 0.28, 0.28], [-0.75, 0.14, 0.5], 'rubber', 'decorative_only'),
    part('caster_b', [0.28, 0.28, 0.28], [0.75, 0.14, 0.5], 'rubber', 'decorative_only'),
  ], ['hallway', 'mobile']),
  combatCover('cover.subroom_desk_corner', 'Subroom Desk Corner', [2.6, 2.1], [2.6, 1.02, 0.95], 'wood', [
    part('desk_return_cover', [0.95, 1.02, 2.1], [-0.82, 0.51, 0.56], 'wood', 'cover_aabb', { floorplanRole: 'desk_return_cover' }),
    part('desk_screen', [0.72, 0.48, 0.08], [0.55, 1.28, -0.48], 'black', 'decorative_only'),
  ], ['subroom', 'office', 'corner']),
  combatCover('cover.subroom_file_cabinets', 'Subroom File Cabinets', [2.8, 0.9], [2.8, 1.28, 0.9], 'wall_trim', [
    part('drawer_band_a', [2.5, 0.06, 0.05], [0, 0.72, 0.48], 'steel', 'decorative_only'),
    part('drawer_band_b', [2.5, 0.06, 0.05], [0, 1.06, 0.48], 'steel', 'decorative_only'),
  ], ['subroom', 'office']),
  combatCover('cover.narrow_pipe_bundle', 'Narrow Pipe Bundle', [3.2, 0.7], [3.2, 0.82, 0.7], 'steel', [
    part('pipe_shadow', [2.7, 0.42, 0.38], [0, 0.54, 0], 'black', 'decorative_only'),
  ], ['hallway', 'low', 'industrial']),
  combatCover('cover.half_height_room_divider', 'Half Height Room Divider', [3.6, 0.65], [3.6, 1.22, 0.65], 'wall_trim', [
    part('divider_top_rail', [3.72, 0.12, 0.72], [0, 1.28, 0], 'steel', 'decorative_only'),
  ], ['subroom', 'divider']),
  combatCover('cover.copy_machine_bank', 'Copy Machine Bank', [2.7, 1.2], [2.7, 1.32, 1.2], 'concrete_light', [
    part('paper_tray', [1.8, 0.18, 0.2], [0, 0.82, 0.68], 'black', 'decorative_only'),
    part('cyan_status', [0.5, 0.08, 0.05], [0.92, 1.18, 0.65], 'paint_cyan', 'decorative_only'),
  ], ['office', 'subroom']),
  combatCover('cover.utility_sink_block', 'Utility Sink Block', [1.8, 1.0], [1.8, 1.02, 1.0], 'concrete_light', [
    part('sink_basin', [1.35, 0.18, 0.62], [0, 1.1, 0], 'steel', 'decorative_only'),
    part('faucet', [0.12, 0.38, 0.12], [0.38, 1.34, 0.08], 'steel', 'decorative_only'),
  ], ['utility', 'subroom']),
  prefab('window.subroom_one_way_panel', 'windows', 'Subroom One Way Panel', [4.6, 0.2], [
    part('black_glass', [4.6, 1.35, 0.08], [0, 1.58, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('dark_backer', [4.65, 0.28, 0.1], [0, 0.76, 0], 'black', 'decorative_only'),
    part('top_frame', [4.8, 0.16, 0.18], [0, 2.36, 0], 'steel', 'decorative_only'),
  ], { tags: ['window', 'subroom', 'oneway', 'combat'], budgets: { triangles: 180, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 1 } }),
  prefab('window.office_half_glass_4m', 'windows', 'Office Half Glass 4m', [4, 0.28], [
    part('low_wall_cover', [4, 0.86, 0.28], [0, 0.43, 0], 'wall_trim', 'cover_aabb', { floorplanRole: 'half_glass_cover' }),
    part('upper_glass', [3.8, 1.25, 0.08], [0, 1.55, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
  ], { tags: ['window', 'office', 'subroom', 'cover'], budgets: { triangles: 170, drawCalls: 2, dynamicLights: 0, transparentSurfaces: 1 } }),
  prefab('window.service_slot_narrow', 'windows', 'Service Slot Narrow', [2.2, 0.18], [
    part('lower_band', [2.2, 1.05, 0.18], [0, 0.52, 0], 'wall_dark', 'wall_aabb'),
    part('slot_glass', [2.0, 0.42, 0.08], [0, 1.38, 0], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('slot_tray', [2.1, 0.08, 0.42], [0, 1.08, 0.18], 'steel', 'decorative_only'),
  ], { tags: ['window', 'service', 'narrow'], budgets: { triangles: 160, drawCalls: 3, dynamicLights: 0, transparentSurfaces: 1 } }),
  combatProp('prop.door_breach_wedge', 'Door Breach Wedge', [0.8, 0.55], [
    part('wedge_body', [0.8, 0.22, 0.55], [0, 0.11, 0], 'hazard', 'decorative_only'),
    part('black_grip', [0.44, 0.08, 0.12], [0.1, 0.25, -0.15], 'black', 'decorative_only'),
  ], ['breach', 'door']),
  combatProp('prop.subroom_name_plate', 'Subroom Name Plate', [1.2, 0.18], [
    part('plate', [1.2, 0.34, 0.06], [0, 1.55, 0], 'steel', 'decorative_only'),
    part('plate_glow', [0.72, 0.06, 0.04], [0, 1.55, 0.04], 'paint_cyan', 'decorative_only'),
  ], ['subroom', 'sign']),
  combatProp('prop.wall_phone_alarm', 'Wall Phone Alarm', [0.55, 0.3], [
    part('phone_box', [0.45, 0.72, 0.22], [0, 1.28, 0], 'warning_red', 'decorative_only'),
    part('cord_hint', [0.08, 0.6, 0.06], [-0.18, 0.86, 0.04], 'black', 'decorative_only'),
  ], ['alarm', 'wall']),
  combatProp('prop.hallway_camera_corner', 'Hallway Corner Camera', [0.8, 0.8], [
    part('corner_mount', [0.55, 0.18, 0.55], [0, 2.75, 0], 'steel', 'decorative_only'),
    part('camera_body', [0.48, 0.25, 0.35], [0.22, 2.52, 0.22], 'black', 'decorative_only'),
    part('red_dot', [0.08, 0.08, 0.04], [0.22, 2.52, 0.43], 'marker_red', 'decorative_only'),
  ], ['camera', 'hallway']),
  combatProp('prop.floor_cable_ramp', 'Floor Cable Ramp', [2.6, 0.6], [
    part('ramp_body', [2.6, 0.12, 0.6], [0, 0.06, 0], 'black', 'decorative_only'),
    part('yellow_edge', [2.6, 0.025, 0.08], [0, 0.14, 0.28], 'hazard', 'decorative_only'),
  ], ['floor', 'hallway', 'nonblocking']),
  combatProp('prop.subroom_keypad_panel', 'Subroom Keypad Panel', [0.5, 0.22], [
    part('panel_body', [0.42, 0.72, 0.08], [0, 1.3, 0], 'black', 'decorative_only'),
    part('keypad_glow', [0.24, 0.24, 0.04], [0, 1.36, 0.06], 'marker_green', 'decorative_only'),
  ], ['keypad', 'subroom']),
  combatProp('prop.ransacked_drawers', 'Ransacked Drawers', [1.8, 0.9], [
    part('cabinet_body', [1.8, 0.92, 0.9], [0, 0.46, 0], 'wall_trim', 'cover_aabb', { floorplanRole: 'ransacked_cover' }),
    part('open_drawer_a', [0.72, 0.18, 0.62], [-0.42, 0.72, 0.56], 'steel', 'decorative_only'),
    part('open_drawer_b', [0.62, 0.16, 0.52], [0.52, 0.38, 0.48], 'steel', 'decorative_only'),
  ], ['office', 'subroom', 'cover']),
  combatProp('prop.map_board_wall', 'Tactical Map Board Wall', [2.4, 0.28], [
    part('board', [2.4, 1.25, 0.08], [0, 1.55, 0], 'black', 'decorative_only'),
    part('route_pin_a', [0.1, 0.1, 0.04], [-0.55, 1.65, 0.06], 'marker_red', 'decorative_only'),
    part('route_pin_b', [0.1, 0.1, 0.04], [0.62, 1.35, 0.06], 'marker_blue', 'decorative_only'),
  ], ['planning', 'wall']),
  prefab('floor.narrow_hall_6x12', 'floors', 'Narrow Hall Floor 6x12', [6, 12], [
    part('floor_slab', [6, 0.08, 12], [0, 0.02, 0], 'floor_concrete', 'floor_aabb'),
    part('center_lane', [0.22, 0.014, 10.8], [0, 0.08, 0], 'paint_cyan', 'decorative_only'),
    part('edge_warn_l', [0.14, 0.014, 11.5], [-2.75, 0.081, 0], 'hazard', 'decorative_only'),
    part('edge_warn_r', [0.14, 0.014, 11.5], [2.75, 0.081, 0], 'hazard', 'decorative_only'),
  ], { tags: ['floor', 'hallway', 'narrow', 'combat'] }),
  prefab('floor.subroom_tile_6x6', 'floors', 'Subroom Tile 6m', [6, 6], [
    part('floor_slab', [6, 0.08, 6], [0, 0.02, 0], 'floor_concrete', 'floor_aabb'),
    part('room_border_a', [5.6, 0.014, 0.12], [0, 0.08, -2.8], 'wall_trim', 'decorative_only'),
    part('room_border_b', [5.6, 0.014, 0.12], [0, 0.081, 2.8], 'wall_trim', 'decorative_only'),
  ], { tags: ['floor', 'subroom', 'combat'] }),
  prefab('floor.office_carpet_patch', 'floors', 'Office Carpet Patch', [5, 4], [
    part('carpet_floor', [5, 0.045, 4], [0, 0.02, 0], 'wall_trim', 'floor_aabb'),
    part('bloodless_scuff_a', [2.3, 0.012, 0.08], [-0.5, 0.07, 0.9], 'concrete_light', 'decorative_only'),
    part('bloodless_scuff_b', [1.7, 0.012, 0.08], [0.8, 0.071, -1.0], 'concrete_light', 'decorative_only'),
  ], { tags: ['floor', 'office', 'subroom'] }),
  prefab('route.subroom_entry_arrow', 'route', 'Subroom Entry Arrow', [2.4, 2.4], [
    part('entry_arrow_shaft', [0.26, 0.026, 1.5], [0, 0.08, -0.25], 'paint_cyan', 'decorative_only'),
    part('entry_arrow_head', [1.1, 0.026, 0.62], [0, 0.081, 0.72], 'hazard', 'decorative_only'),
  ], { tags: ['route', 'subroom', 'entry', 'combat'] }),
  prefab('route.hallway_slice_left', 'route', 'Hallway Slice Left Paint', [3.2, 2.8], [
    part('slice_curve_hint', [2.6, 0.026, 0.22], [-0.35, 0.08, 0.8], 'paint_cyan', 'decorative_only'),
    part('slice_arrow', [1.2, 0.026, 0.5], [-1.05, 0.081, 0.1], 'marker_green', 'decorative_only'),
  ], { tags: ['route', 'slice', 'left', 'hallway'] }),
  prefab('route.hallway_slice_right', 'route', 'Hallway Slice Right Paint', [3.2, 2.8], [
    part('slice_curve_hint', [2.6, 0.026, 0.22], [0.35, 0.08, 0.8], 'paint_cyan', 'decorative_only'),
    part('slice_arrow', [1.2, 0.026, 0.5], [1.05, 0.081, 0.1], 'marker_green', 'decorative_only'),
  ], { tags: ['route', 'slice', 'right', 'hallway'] }),
  prefab('route.room_number_paint', 'route', 'Room Number Paint', [1.8, 1.0], [
    part('number_bar_top', [1.3, 0.026, 0.14], [0, 0.08, -0.32], 'hazard', 'decorative_only'),
    part('number_bar_mid', [1.3, 0.026, 0.14], [0, 0.081, 0], 'hazard', 'decorative_only'),
    part('number_bar_bottom', [1.3, 0.026, 0.14], [0, 0.082, 0.32], 'hazard', 'decorative_only'),
  ], { tags: ['route', 'room', 'number', 'subroom'] }),
  modulePrefab('module.hallway_narrow_killzone', 'Narrow Hallway Killzone', [
    part('left_hall_wall', [0.55, 3.3, 14], [-3.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_hall_wall', [0.55, 3.3, 14], [3.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('mid_pipe_cover', [2.2, 0.88, 0.78], [-1.0, 0.44, -2.2], 'steel', 'cover_aabb'),
    part('far_locker_cover', [1.5, 1.6, 0.72], [1.45, 0.8, 3.6], 'steel', 'cover_aabb'),
    part('danger_lane', [0.22, 0.02, 12], [0, 0.08, 0], 'warning_red', 'decorative_only'),
  ], { footprint: [7, 15], tags: ['hallway', 'killzone', 'narrow'] }),
  modulePrefab('module.hallway_offset_cover_s', 'Offset Cover S Hallway', [
    part('left_wall', [0.55, 3.3, 13], [-4.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_wall', [0.55, 3.3, 13], [4.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('near_cover_left', [2.2, 1.04, 0.9], [-2.0, 0.52, 3.5], 'steel', 'cover_aabb'),
    part('mid_cover_right', [2.2, 1.04, 0.9], [2.0, 0.52, 0.0], 'wood', 'cover_aabb'),
    part('far_cover_left', [2.2, 1.04, 0.9], [-2.0, 0.52, -3.5], 'steel', 'cover_aabb'),
  ], { footprint: [9, 14], tags: ['hallway', 'offset', 'cover'] }),
  modulePrefab('module.hallway_side_room_left', 'Hallway Side Room Left', [
    part('right_hall_wall', [0.55, 3.3, 12], [4.6, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('left_hall_near', [0.55, 3.3, 3.4], [-4.6, 1.65, 4.1], 'wall_dark', 'wall_aabb'),
    part('left_hall_far', [0.55, 3.3, 3.4], [-4.6, 1.65, -4.1], 'wall_dark', 'wall_aabb'),
    part('subroom_back_wall', [5.4, 3.3, 0.55], [-7.0, 1.65, -3.2], 'wall_dark', 'wall_aabb'),
    part('subroom_cover', [2.2, 1.04, 0.95], [-7.1, 0.52, -1.3], 'wood', 'cover_aabb'),
  ], { footprint: [14, 12], tags: ['hallway', 'subroom', 'left'] }),
  modulePrefab('module.hallway_side_room_right', 'Hallway Side Room Right', [
    part('left_hall_wall', [0.55, 3.3, 12], [-4.6, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_hall_near', [0.55, 3.3, 3.4], [4.6, 1.65, 4.1], 'wall_dark', 'wall_aabb'),
    part('right_hall_far', [0.55, 3.3, 3.4], [4.6, 1.65, -4.1], 'wall_dark', 'wall_aabb'),
    part('subroom_back_wall', [5.4, 3.3, 0.55], [7.0, 1.65, -3.2], 'wall_dark', 'wall_aabb'),
    part('subroom_cover', [2.2, 1.04, 0.95], [7.1, 0.52, -1.3], 'steel', 'cover_aabb'),
  ], { footprint: [14, 12], tags: ['hallway', 'subroom', 'right'] }),
  modulePrefab('module.hallway_double_subroom', 'Hallway Double Subroom', [
    part('left_near_jamb', [0.55, 3.3, 3.0], [-4.8, 1.65, 4.4], 'wall_dark', 'wall_aabb'),
    part('left_far_jamb', [0.55, 3.3, 3.0], [-4.8, 1.65, -4.4], 'wall_dark', 'wall_aabb'),
    part('right_near_jamb', [0.55, 3.3, 3.0], [4.8, 1.65, 4.4], 'wall_dark', 'wall_aabb'),
    part('right_far_jamb', [0.55, 3.3, 3.0], [4.8, 1.65, -4.4], 'wall_dark', 'wall_aabb'),
    part('left_room_cover', [2.0, 1.04, 0.9], [-7.2, 0.52, -1.4], 'wood', 'cover_aabb'),
    part('right_room_cover', [2.0, 1.04, 0.9], [7.2, 0.52, 1.4], 'steel', 'cover_aabb'),
  ], { footprint: [16, 13], tags: ['hallway', 'subroom', 'double'] }),
  modulePrefab('module.hallway_crosscheck_subrooms', 'Crosscheck Subrooms', [
    part('left_room_partition', [0.55, 3.3, 8.0], [-4.8, 1.65, 1.8], 'wall_dark', 'wall_aabb'),
    part('right_room_partition', [0.55, 3.3, 8.0], [4.8, 1.65, -1.8], 'wall_dark', 'wall_aabb'),
    part('left_back_wall', [5.2, 3.3, 0.55], [-7.0, 1.65, -2.7], 'wall_dark', 'wall_aabb'),
    part('right_back_wall', [5.2, 3.3, 0.55], [7.0, 1.65, 2.7], 'wall_dark', 'wall_aabb'),
    part('cross_paint', [7.5, 0.02, 0.28], [0, 0.08, 0], 'warning_red', 'decorative_only'),
  ], { footprint: [16, 12], tags: ['hallway', 'crosscheck', 'subroom'] }),
  modulePrefab('module.hallway_staggered_partition', 'Staggered Hall Partitions', [
    part('partition_a', [0.55, 3.3, 5.2], [-2.9, 1.65, 2.7], 'wall_dark', 'wall_aabb'),
    part('partition_b', [0.55, 3.3, 5.2], [2.9, 1.65, -2.7], 'wall_dark', 'wall_aabb'),
    part('near_cover', [2.1, 1.04, 0.9], [1.2, 0.52, 3.6], 'steel', 'cover_aabb'),
    part('far_cover', [2.1, 1.04, 0.9], [-1.2, 0.52, -3.6], 'wood', 'cover_aabb'),
  ], { footprint: [8, 13], tags: ['hallway', 'staggered', 'partition'] }),
  modulePrefab('module.hallway_dead_end_ambush', 'Dead End Ambush Room', [
    part('left_wall', [0.55, 3.3, 10], [-4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_wall', [0.55, 3.3, 10], [4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('dead_end_wall', [9.6, 3.3, 0.55], [0, 1.65, -4.8], 'wall_dark', 'wall_aabb'),
    part('left_end_cover', [2.1, 1.04, 0.9], [-2.7, 0.52, -3.1], 'steel', 'cover_aabb'),
    part('right_end_cover', [2.1, 1.04, 0.9], [2.7, 0.52, -3.1], 'wood', 'cover_aabb'),
  ], { footprint: [11, 11], tags: ['hallway', 'deadend', 'ambush'] }),
  modulePrefab('module.hallway_soft_corner_peek', 'Soft Corner Peek Hallway', [
    part('left_wall_near', [0.55, 3.3, 5.5], [-4.5, 1.65, 2.8], 'wall_dark', 'wall_aabb'),
    part('left_wall_far', [5.4, 3.3, 0.55], [-2.0, 1.65, -2.0], 'wall_dark', 'wall_aabb'),
    part('right_wall', [0.55, 3.3, 11], [4.5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('peek_cover', [2.2, 1.04, 0.9], [1.5, 0.52, -2.8], 'steel', 'cover_aabb'),
  ], { footprint: [10, 12], tags: ['hallway', 'corner', 'peek'] }),
  modulePrefab('module.hallway_locked_branch', 'Locked Branch Hallway', [
    part('main_left', [0.55, 3.3, 12], [-4.8, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('main_right_near', [0.55, 3.3, 4.2], [4.8, 1.65, 3.8], 'wall_dark', 'wall_aabb'),
    part('main_right_far', [0.55, 3.3, 4.2], [4.8, 1.65, -3.8], 'wall_dark', 'wall_aabb'),
    part('locked_branch_gate', [4.8, 2.8, 0.55], [7.0, 1.4, 0], 'steel', 'wall_aabb'),
    part('lock_indicator', [0.46, 0.3, 0.06], [4.78, 1.45, 0.9], 'warning_red', 'decorative_only'),
  ], { footprint: [14, 12], tags: ['hallway', 'locked', 'branch'] }),
  modulePrefab('module.hallway_service_bypass', 'Service Bypass Hallway', [
    part('left_outer', [0.55, 3.3, 12], [-5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_outer', [0.55, 3.3, 12], [5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('service_partition', [0.55, 3.3, 7.2], [1.4, 1.65, 0.8], 'wall_dark', 'wall_aabb'),
    part('pipe_cover', [2.2, 0.84, 0.72], [-1.6, 0.42, -2.6], 'steel', 'cover_aabb'),
    part('bypass_paint', [0.22, 0.02, 9.8], [-2.9, 0.08, 0], 'paint_cyan', 'decorative_only'),
  ], { footprint: [12, 13], tags: ['hallway', 'service', 'bypass'] }),
  modulePrefab('module.room_cell_pair', 'Cell Pair Subrooms', [
    part('outer_left', [0.55, 3.3, 10], [-5.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('outer_right', [0.55, 3.3, 10], [5.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('back_wall', [10, 3.3, 0.55], [0, 1.65, -5.0], 'wall_dark', 'wall_aabb'),
    part('center_split', [0.55, 3.3, 6.2], [0, 1.65, -1.8], 'wall_dark', 'wall_aabb'),
    part('left_desk_cover', [2.1, 1.04, 0.9], [-2.7, 0.52, -3.0], 'wood', 'cover_aabb'),
    part('right_file_cover', [2.1, 1.04, 0.9], [2.7, 0.52, -3.0], 'steel', 'cover_aabb'),
  ], { footprint: [11, 11], tags: ['room', 'subroom', 'cell'] }),
  modulePrefab('module.room_three_micro_cells', 'Three Micro Cell Room', [
    part('back_wall', [11, 3.3, 0.55], [0, 1.65, -5.0], 'wall_dark', 'wall_aabb'),
    part('left_wall', [0.55, 3.3, 10], [-5.5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('right_wall', [0.55, 3.3, 10], [5.5, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('split_left', [0.55, 3.3, 5.8], [-1.8, 1.65, -2.1], 'wall_dark', 'wall_aabb'),
    part('split_right', [0.55, 3.3, 5.8], [1.8, 1.65, -2.1], 'wall_dark', 'wall_aabb'),
    part('center_low_cover', [2.0, 1.04, 0.85], [0, 0.52, 0.8], 'steel', 'cover_aabb'),
  ], { footprint: [12, 11], tags: ['room', 'subroom', 'micro'] }),
  modulePrefab('module.room_glass_admin_split', 'Glass Admin Split Room', [
    part('back_wall', [10.5, 3.3, 0.55], [0, 1.65, -5.0], 'wall_dark', 'wall_aabb'),
    part('left_glass_office', [0.08, 1.45, 5.8], [-2.1, 1.55, -1.6], 'glass', 'transparent_window_aabb', { glassPane: true, breakable: true }),
    part('right_half_wall', [0.55, 1.5, 5.8], [2.4, 0.75, -1.6], 'wall_trim', 'cover_aabb'),
    part('admin_desk', [2.4, 1.04, 1.0], [-3.5, 0.52, -3.0], 'wood', 'cover_aabb'),
    part('server_cover', [1.4, 1.65, 1.0], [3.6, 0.82, -3.0], 'black', 'cover_aabb'),
  ], { footprint: [11, 11], tags: ['room', 'glass', 'admin'], budgets: { triangles: 420, drawCalls: 4, dynamicLights: 0, transparentSurfaces: 1 } }),
  modulePrefab('module.room_storage_subroom', 'Storage Subroom Split', [
    part('outer_left', [0.55, 3.3, 10.5], [-5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('outer_right', [0.55, 3.3, 10.5], [5.2, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('storage_back', [10, 3.3, 0.55], [0, 1.65, -5.0], 'wall_dark', 'wall_aabb'),
    part('storage_partition', [5.5, 3.3, 0.55], [-1.4, 1.65, -1.2], 'wall_dark', 'wall_aabb'),
    part('pallet_cover', [2.4, 1.04, 1.2], [2.2, 0.52, -3.2], 'wood', 'cover_aabb'),
    part('locker_cover', [1.5, 1.62, 0.85], [-3.7, 0.81, -3.0], 'steel', 'cover_aabb'),
  ], { footprint: [12, 11], tags: ['room', 'storage', 'subroom'] }),
  modulePrefab('module.room_l_shaped_clear', 'L Shaped Subroom Clear', [
    part('outer_left', [0.55, 3.3, 11], [-5.0, 1.65, 0], 'wall_dark', 'wall_aabb'),
    part('outer_back', [10, 3.3, 0.55], [0, 1.65, -5.0], 'wall_dark', 'wall_aabb'),
    part('inner_l_wall_a', [0.55, 3.3, 6.0], [-0.8, 1.65, -1.6], 'wall_dark', 'wall_aabb'),
    part('inner_l_wall_b', [5.0, 3.3, 0.55], [1.4, 1.65, 1.1], 'wall_dark', 'wall_aabb'),
    part('answer_cover', [2.2, 1.04, 0.95], [3.0, 0.52, -3.2], 'steel', 'cover_aabb'),
  ], { footprint: [11, 11], tags: ['room', 'lshape', 'clear'] }),
  modulePrefab('module.room_u_shaped_counter', 'U Shaped Counter Room', [
    part('back_wall', [10.2, 3.3, 0.55], [0, 1.65, -5.0], 'wall_dark', 'wall_aabb'),
    part('left_counter', [0.85, 1.05, 5.2], [-3.3, 0.52, -1.4], 'wood', 'cover_aabb'),
    part('right_counter', [0.85, 1.05, 5.2], [3.3, 0.52, -1.4], 'wood', 'cover_aabb'),
    part('back_counter', [5.8, 1.05, 0.85], [0, 0.52, -3.6], 'wood', 'cover_aabb'),
    part('register_glow', [0.8, 0.28, 0.05], [1.2, 1.18, -3.12], 'paint_cyan', 'decorative_only'),
  ], { footprint: [11, 11], tags: ['room', 'counter', 'subroom'] }),
];

const combatScenarioPrefabs = [
  ...combatCoverPrefabs,
  ...combatWallPrefabs,
  ...combatDoorPrefabs,
  ...combatWindowPrefabs,
  ...combatPropPrefabs,
  ...combatRoutePrefabs,
  ...combatMarkerPrefabs,
  ...combatPickupPrefabs,
  ...combatFloorPrefabs,
  ...combatModulePrefabs,
  ...hallwaySubroomPrefabs,
];

export const B01_LEVEL_KIT_SOURCE = {
  schemaVersion: 1,
  id: 'level-kit.b01-megaplex',
  title: 'B01 Megaplex Editor Kit',
  source: {
    blender: 'art_src/level-kit/clearance_b01_level_kit.blend',
    generatedFrom: 'scripts/level-kit-source.mjs',
  },
  runtimeTransform: {
    units: 'meters',
    floorY: 0.4,
    rotationX: 0,
    upAxis: 'Y',
    forwardAxis: 'Z',
  },
  editor: {
    gridSize: 0.5,
    defaultBounds: { x0: -18, x1: 18, z0: -54, z1: 54 },
    categories: ['modules', 'walls', 'doors', 'cover', 'windows', 'props', 'route', 'markers', 'pickups', 'floors'],
  },
  materials,
  prefabs: [
    floorPanel,
    wallFull,
    wallShort,
    wallHalf,
    doorwayFrame,
    windowWall,
    cornerL,
    securityGate,
    rollupDoor,
    halfCover,
    lowBarrier,
    tallMachine,
    palletStack,
    forkliftCover,
    breakableWindow,
    slitWindow,
    routeArrow,
    routeTurnLeft,
    routeBreachLine,
    markerSpawn,
    markerPeek,
    markerHold,
    markerExit,
    pickupAmmo,
    pickupMed,
    propConeCluster,
    propCableSpool,
    propServerRack,
    propWarningSign,
    ...modules,
    ...combatScenarioPrefabs,
  ],
};
