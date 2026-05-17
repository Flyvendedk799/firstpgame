import math
import os

import bpy


ROOT = "/Users/tobiasmastek/Desktop/firstpgame"
BLEND_OUT = os.path.join(ROOT, "art_src/levels/b01_loading_dock_designed.blend")
GLB_OUT = os.path.join(ROOT, "public/assets/levels/b01_loading_dock_designed.glb")

WT = 0.4
RH = 4.25
RW = 44.0
RD = 64.0


def clear_scene():
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.ops.object.mode_set.poll() else None
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def mat(name, color, metallic=0.0, roughness=0.65, alpha=1.0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Alpha"].default_value = alpha
        if emission:
            bsdf.inputs["Emission Color"].default_value = emission[0]
            bsdf.inputs["Emission Strength"].default_value = emission[1]
    if alpha < 1.0:
        m.blend_method = "BLEND"
        m.use_screen_refraction = True
        m.show_transparent_back = True
    return m


MATS = {}


def setup_materials():
    MATS.update({
        "floor": mat("B01 polished stained concrete", (0.45, 0.48, 0.48, 1), roughness=0.42),
        "wall": mat("B01 painted concrete wall", (0.64, 0.70, 0.72, 1), roughness=0.82),
        "trim": mat("B01 amber route trim", (1.0, 0.49, 0.12, 1), roughness=0.4, emission=((1.0, 0.34, 0.07, 1), 0.35)),
        "steel": mat("B01 blue-black steel", (0.08, 0.12, 0.16, 1), metallic=0.45, roughness=0.48),
        "crate": mat("B01 cargo crate wood", (0.42, 0.28, 0.16, 1), roughness=0.72),
        "hazard": mat("B01 hazard amber", (1.0, 0.62, 0.12, 1), roughness=0.38, emission=((1.0, 0.42, 0.08, 1), 0.45)),
        "relay": mat("B01 relay cyan", (0.03, 0.18, 0.17, 1), roughness=0.36, emission=((0.1, 1.0, 0.78, 1), 0.75)),
        "red": mat("B01 drum red", (0.65, 0.12, 0.06, 1), roughness=0.6, emission=((0.8, 0.08, 0.02, 1), 0.25)),
        "glass": mat("B01 tactical glass", (0.55, 0.82, 0.95, 0.36), roughness=0.08, alpha=0.36),
    })


def collection(name):
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def add_cube(name, x, y, z, sx, sy, sz, material, col, props=None):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    obj.location = (x, y, z)
    hx = sx * 0.5
    hy = sy * 0.5
    hz = sz * 0.5
    mesh.from_pydata(
        [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
         (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)],
        [],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
    )
    mesh.update()
    obj.data.materials.append(material)
    if props:
        for key, value in props.items():
            obj[key] = value
    return obj


def wall_x(col, name, z, x0, x1, geometry_id, room_id, role="authored_wall"):
    obj = add_cube(name, (x0 + x1) * 0.5, RH / 2 + WT / 2, z, x1 - x0, RH, 0.48, MATS["wall"], col, {
        "geometryId": geometry_id,
        "roomId": room_id,
        "floorplanRole": role,
        "collision": "wall_aabb",
    })
    add_cube(name + "_trim", (x0 + x1) * 0.5, RH + WT - 0.05, z, x1 - x0, 0.05, 0.07, MATS["trim"], col, {
        "roomId": room_id,
        "floorplanRole": "route_trim",
    })
    return obj


def wall_z(col, name, x, z0, z1, geometry_id, room_id, role="authored_wall"):
    obj = add_cube(name, x, RH / 2 + WT / 2, (z0 + z1) * 0.5, 0.48, RH, z1 - z0, MATS["wall"], col, {
        "geometryId": geometry_id,
        "roomId": room_id,
        "floorplanRole": role,
        "collision": "wall_aabb",
    })
    add_cube(name + "_trim", x, RH + WT - 0.05, (z0 + z1) * 0.5, 0.07, 0.05, z1 - z0, MATS["trim"], col, {
        "roomId": room_id,
        "floorplanRole": "route_trim",
    })
    return obj


def glass(col, name, x, z, sx, sz, rot_y, geometry_id, room_id, sightline):
    obj = add_cube(name, x, WT + 1.15, z, sx, 1.15, 0.06, MATS["glass"], col, {
        "geometryId": geometry_id,
        "roomId": room_id,
        "sightlineId": sightline,
        "floorplanRole": "preview_glass",
        "collision": "transparent_window_aabb",
    })
    obj.rotation_euler[1] = rot_y
    return obj


def cover(col, name, x, z, sx, sy, sz, material_key, geometry_id, room_id, role):
    return add_cube(name, x, WT + sy / 2, z, sx, sy, sz, MATS[material_key], col, {
        "geometryId": geometry_id,
        "roomId": room_id,
        "floorplanRole": role,
        "collision": "cover_aabb",
    })


def floor_pad(col, name, x, z, sx, sz, material_key, geometry_id, room_id, role):
    return add_cube(name, x, WT + 0.018, z, sx, 0.025, sz, MATS[material_key], col, {
        "geometryId": geometry_id,
        "roomId": room_id,
        "floorplanRole": role,
    })


def label(col, text, x, z, size=0.55):
    curve = bpy.data.curves.new("label_" + text, "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    obj = bpy.data.objects.new("LABEL_" + text, curve)
    obj.location = (x, WT + 0.06, z)
    obj.rotation_euler[0] = math.radians(90)
    obj.data.materials.append(MATS["hazard"])
    obj["floorplanRole"] = "designer_annotation"
    col.objects.link(obj)
    return obj


def build():
    clear_scene()
    setup_materials()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 48

    root = collection("B01_LOADING_DOCK_DESIGNED_MAP")
    walls = collection("01_authored_walls_collision")
    cover_col = collection("02_cover_and_landmarks")
    reads = collection("03_route_readability_and_previews")
    lights = collection("04_lights_and_camera")

    add_cube("B01_floor_runtime_footprint", 0, WT / 2, 0, RW, WT, RD, MATS["floor"], root, {
        "floorplanRole": "runtime_floor",
    })

    # Room shells and thresholds mirror src/levelSequences.js applyB01DesignedDockLevel.
    wall_x(walls, "entry_back_bulkhead", 23.6, -4.4, 4.4, "b01_entry_back_bulkhead", "b01_entry_vestibule", "room_shell")
    wall_z(walls, "entry_left_bulkhead", -4.4, 16.6, 23.6, "b01_entry_left_bulkhead", "b01_entry_vestibule", "room_shell")
    wall_z(walls, "entry_right_bulkhead", 4.4, 16.6, 23.6, "b01_entry_right_bulkhead", "b01_entry_vestibule", "room_shell")
    wall_x(walls, "entry_threshold_w", 16.6, -4.4, -1.35, "dock_threshold_strip", "dock_intake", "threshold")
    wall_x(walls, "entry_threshold_e", 16.6, 1.35, 4.4, "b01_entry_threshold_return", "b01_entry_vestibule", "threshold")

    wall_x(walls, "intake_north_w", 16.9, -7.8, -1.35, "b01_intake_north_west", "b01_intake_peek", "room_shell")
    wall_x(walls, "intake_north_e", 16.9, 1.35, 7.8, "b01_intake_north_east", "b01_intake_peek", "room_shell")
    wall_z(walls, "intake_west_shell", -7.8, 8.65, 16.9, "b01_intake_west_shell", "b01_intake_peek", "room_shell")
    wall_z(walls, "intake_east_shell", 7.8, 8.65, 16.9, "b01_intake_east_shell", "b01_intake_peek", "room_shell")
    wall_x(walls, "intake_apron_w", 8.65, -7.8, 3.92, "intake_apron_divider", "dock_intake", "threshold")
    wall_x(walls, "intake_apron_e", 8.65, 6.08, 7.8, "b01_intake_service_gate_return", "b01_intake_peek", "threshold")
    # Split around the lookout slit: the runtime collision wall is carved here
    # too, so the Blender source matches the playable first-contact sightline.
    wall_z(walls, "first_peek_blind_south", -1.35, 10.2, 13.32, "b01_first_peek_blind", "b01_intake_peek", "peek_blind")
    wall_z(walls, "first_peek_blind_north", -1.35, 14.78, 15.2, "b01_first_peek_blind", "b01_intake_peek", "peek_blind")
    glass(reads, "first_lookout_slit", -1.35, 14.05, 1.25, 0.06, math.radians(90), "b01_first_lookout_slit", "b01_intake_peek", "first_lookout_slit")

    wall_z(walls, "service_west_wall", 2.25, 2.4, 9.1, "west_service_run", "west_service_connector", "connector_wall")
    wall_z(walls, "service_east_wall", 8.8, 2.4, 9.1, "b01_service_east_wall", "b01_service_hall", "connector_wall")
    wall_x(walls, "service_north_w", 9.1, 2.25, 3.95, "b01_service_north_west_return", "b01_service_hall", "connector_wall")
    wall_x(walls, "service_north_e", 9.1, 6.05, 8.8, "b01_service_north_east_return", "b01_service_hall", "connector_wall")
    wall_x(walls, "service_to_relay_w", 2.4, 2.25, 3.95, "b01_service_to_relay_return_w", "b01_service_hall", "threshold")
    wall_x(walls, "service_to_relay_e", 2.4, 6.05, 8.8, "b01_service_to_relay_return_e", "b01_service_hall", "threshold")
    wall_z(walls, "service_s_bend_occluder", 5.9, 4.4, 8.0, "b01_service_s_bend_occluder", "b01_service_hall", "sightline_blocker")

    wall_x(walls, "relay_north_w", 4.8, -7.4, 3.95, "b01_relay_north_west", "b01_relay_approach", "room_shell")
    wall_x(walls, "relay_north_e", 4.8, 6.05, 7.4, "b01_relay_north_east", "b01_relay_approach", "room_shell")
    wall_x(walls, "relay_south", -2.4, -7.4, 7.4, "b01_relay_south_wall", "b01_relay_approach", "room_shell")
    wall_z(walls, "relay_alarm_return_s", -7.4, -2.4, -1.35, "b01_relay_alarm_gate_return_s", "b01_relay_approach", "threshold")
    wall_z(walls, "relay_alarm_return_n", -7.4, 1.35, 4.8, "b01_relay_alarm_gate_return_n", "b01_relay_approach", "threshold")
    wall_z(walls, "relay_drum_return_s", 7.4, -2.4, -1.35, "b01_relay_drum_gate_return_s", "b01_relay_approach", "threshold")
    wall_z(walls, "relay_drum_return_n", 7.4, 1.35, 4.8, "b01_relay_drum_gate_return_n", "b01_relay_approach", "threshold")
    wall_z(walls, "mid_spine_pinch", -2.2, -1.5, 2.7, "mid_spine_pinch", "mid_lane_center", "connector")

    wall_x(walls, "alarm_north", 5.2, -18.0, -7.4, "relay_partition_north", "alarm_relay_room", "room_shell")
    wall_x(walls, "alarm_south", -6.2, -18.0, -7.4, "b01_alarm_south_wall", "alarm_relay_room", "room_shell")
    wall_z(walls, "alarm_west", -18.0, -6.2, 5.2, "relay_partition_west", "alarm_relay_room", "room_shell")
    wall_z(walls, "alarm_door_s", -7.4, -6.2, -1.35, "relay_offset_door", "alarm_relay_room", "threshold")
    wall_z(walls, "alarm_door_n", -7.4, 1.35, 5.2, "b01_alarm_east_return", "alarm_relay_room", "threshold")
    glass(reads, "manifest_window", -10.1, 5.2, 2.7, 0.06, 0, "manifest_office_window", "alarm_relay_room", "office_to_mid_floor")
    glass(reads, "relay_side_slit", -7.4, 2.9, 1.45, 0.06, math.radians(90), "relay_side_slit", "alarm_relay_room", "relay_peek_me")

    wall_z(walls, "drum_east_bulkhead", 18.0, -6.4, 4.8, "b01_drum_east_bulkhead", "b01_drum_flank", "room_shell")
    wall_x(walls, "drum_north_wall", 4.8, 7.4, 18.0, "b01_drum_north_wall", "b01_drum_flank", "room_shell")
    wall_x(walls, "drum_to_cage_w", -6.4, -7.4, -6.05, "b01_drum_to_cage_return_w", "b01_drum_flank", "threshold")
    wall_x(walls, "drum_to_cage_e", -6.4, -3.95, 18.0, "b01_drum_to_cage_return_e", "b01_drum_flank", "threshold")
    wall_z(walls, "east_compression_corridor", 10.5, -5.5, 2.8, "east_compression_corridor", "east_flank_connector", "connector")
    wall_z(walls, "east_return_loop", 13.4, -4.7, 3.2, "b01_east_return_loop", "b01_drum_flank", "return_loop")
    glass(reads, "relay_preread_glass", 7.4, -3.7, 1.9, 0.06, math.radians(90), "b01_relay_preread_glass", "b01_drum_flank", "relay_pre_read")

    wall_z(walls, "cage_vest_west", -7.4, -13.2, -6.4, "b01_cage_vest_west_wall", "b01_cage_vestibule", "room_shell")
    wall_z(walls, "cage_vest_east", 0.8, -13.2, -6.4, "b01_cage_vest_east_wall", "b01_cage_vestibule", "room_shell")
    wall_x(walls, "cage_vest_threshold_w", -13.2, -7.4, -1.1, "cage_vestibule", "relay_cage", "threshold")
    wall_x(walls, "cage_vest_threshold_e", -13.2, 1.1, 0.8, "b01_cage_vestibule_return", "b01_cage_vestibule", "threshold")
    glass(reads, "cage_signature_gate", -2.4, -13.2, 2.3, 0.06, 0, "b01_cage_signature_gate", "relay_cage", "cage_signature_preview")

    wall_x(walls, "cage_north_w", -13.0, -9.2, -1.1, "b01_cage_north_west", "b01_relay_cage", "room_shell")
    wall_x(walls, "cage_north_e", -13.0, 1.1, 9.2, "b01_cage_north_east", "b01_relay_cage", "room_shell")
    wall_z(walls, "cage_west_wall", -9.2, -25.4, -13.0, "b01_cage_west_wall", "b01_relay_cage", "room_shell")
    wall_z(walls, "cage_east_wall_south", 9.2, -25.4, -19.05, "b01_cage_east_wall_south", "b01_relay_cage", "room_shell")
    wall_z(walls, "cage_east_wall_north", 9.2, -15.95, -13.0, "b01_cage_east_wall_north", "b01_relay_cage", "room_shell")
    wall_x(walls, "cage_back_w", -25.4, -9.2, -1.35, "b01_cage_back_west", "b01_relay_cage", "room_shell")
    wall_x(walls, "cage_back_e", -25.4, 1.35, 9.2, "b01_cage_back_east", "b01_relay_cage", "room_shell")

    wall_x(walls, "foreman_wall", -12.8, 11.4, 17.8, "foreman_cage_wall", "foreman_cage", "threshold")
    wall_z(walls, "foreman_return_south", 11.4, -22.0, -19.05, "foreman_cage_return_south", "foreman_cage", "overlook_return")
    wall_z(walls, "foreman_return_north", 11.4, -15.95, -12.8, "foreman_cage_return_north", "foreman_cage", "overlook_return")
    glass(reads, "foreman_glass", 12.2, -12.8, 2.6, 0.06, 0, "foreman_glass", "foreman_cage", "foreman_to_relay_cage")
    glass(reads, "catwalk_window", 15.5, -15.7, 3.0, 0.06, math.radians(90), "catwalk_to_cage_window", "foreman_cage", "catwalk_over_bc")

    # Gameplay cover and landmarks.
    cover(cover_col, "intake_player_cover", -4.2, 14.6, 1.45, 0.88, 0.72, "crate", "b01_intake_player_cover", "b01_intake_peek", "player_cover")
    cover(cover_col, "intake_enemy_edge", -3.2, 11.0, 0.72, 2.1, 0.58, "steel", "b01_intake_enemy_edge", "b01_intake_peek", "enemy_peek_edge")
    cover(cover_col, "service_cover", 3.4, 5.6, 1.25, 0.84, 0.72, "steel", "b01_service_hall_cover", "b01_service_hall", "recovery_cover")
    cover(cover_col, "relay_player_cover", -0.6, 2.1, 1.35, 0.96, 0.76, "crate", "b01_relay_player_answer_cover", "b01_relay_approach", "player_cover")
    cover(cover_col, "relay_panel_anchor", -14.2, 0.9, 2.4, 1.1, 0.86, "relay", "relay_panel_anchor", "alarm_relay_room", "objective_anchor")
    cover(cover_col, "alarm_player_cover", -12.3, -2.2, 1.45, 0.96, 0.82, "steel", "b01_alarm_player_cover", "alarm_relay_room", "player_cover")
    cover(cover_col, "drum_spool_cover", 14.1, -2.5, 1.1, 0.9, 1.1, "red", "b01_drum_spool_cover", "b01_drum_flank", "enemy_cover")
    cover(cover_col, "drum_player_cover", 11.6, 1.7, 1.3, 0.88, 0.78, "crate", "b01_drum_player_cover", "b01_drum_flank", "player_cover")
    cover(cover_col, "cage_pillar_west", -3.6, -17.0, 1.4, 1.04, 0.82, "steel", "b01_cage_pillar_west", "b01_relay_cage", "cover_landmark")
    cover(cover_col, "cage_pillar_east", 3.6, -17.0, 1.4, 1.04, 0.82, "steel", "b01_cage_pillar_east", "b01_relay_cage", "cover_landmark")
    cover(cover_col, "cage_center_low", 0, -20.4, 2.1, 1.0, 0.92, "relay", "b01_cage_center_low", "b01_relay_cage", "boss_cover")
    cover(cover_col, "foreman_overlook_east_rail", 17.8, -17.4, 0.42, 1.24, 9.2, "steel", "b01_foreman_overlook_east_rail", "b01_relay_cage", "overlook_boundary")
    cover(cover_col, "foreman_overlook_south_rail", 14.6, -22.0, 6.4, 1.24, 0.42, "steel", "b01_foreman_overlook_south_rail", "b01_relay_cage", "overlook_boundary")
    cover(cover_col, "foreman_desk_rail", 13.6, -17.2, 1.6, 0.96, 0.75, "steel", "b01_foreman_desk_rail", "b01_relay_cage", "overwatch_cover")

    # First-person readability pass: authored panels that make the opening
    # sightline feel like a designed dock, not a blank procedural wall.
    for name, x, y, z, sx, sy, sz, mat_key, geometry_id, room_id, role in [
        ("entry_overhead_bay_warning", 0, WT + 3.05, 16.34, 3.1, 0.34, 0.08, "hazard", "b01_entry_overhead_bay_warning", "b01_entry_vestibule", "first_read_signage"),
        ("entry_left_service_riser", -3.95, WT + 1.7, 19.8, 0.08, 2.1, 4.6, "steel", "b01_entry_left_service_riser", "b01_entry_vestibule", "world_detail"),
        ("entry_right_service_riser", 3.95, WT + 1.7, 19.8, 0.08, 2.1, 4.6, "steel", "b01_entry_right_service_riser", "b01_entry_vestibule", "world_detail"),
        ("first_peek_blind_kickplate", -1.08, WT + 1.65, 12.6, 0.08, 2.05, 4.25, "steel", "b01_first_peek_blind_kickplate", "b01_intake_peek", "readable_occluder_face"),
        ("first_peek_hazard_caption", -1.02, WT + 2.58, 12.5, 0.055, 0.16, 2.6, "hazard", "b01_first_peek_hazard_caption", "b01_intake_peek", "first_contact_language"),
    ]:
        add_cube(name, x, y, z, sx, sy, sz, MATS[mat_key], reads, {
            "geometryId": geometry_id,
            "roomId": room_id,
            "floorplanRole": role,
        })

    for idx, x in enumerate([-5.6, -4.7, 4.6, 6.1]):
        add_cube(f"intake_hanging_chain_{idx}", x, RH + WT - 0.72, 13.4, 0.055, 1.0, 0.055, MATS["steel"], reads, {
            "geometryId": f"b01_intake_hanging_chain_{idx}",
            "roomId": "b01_intake_peek",
            "floorplanRole": "ceiling_detail",
        })

    for spec in [
        ("entry_route", 0, 18.0, 1.2, 3.2, "hazard", "b01_entry_route_stripe", "b01_entry_vestibule", "route_language"),
        ("service_route", 5.0, 5.4, 0.7, 4.5, "steel", "b01_service_route_strip", "b01_service_hall", "route_language"),
        ("alarm_lane", -14.2, 1.0, 2.0, 1.25, "relay", "alarm_interact_lane", "alarm_relay_room", "objective_lane"),
        ("cage_route", -5.0, -9.6, 0.72, 4.2, "hazard", "b01_cage_route_stripe", "b01_cage_vestibule", "route_language"),
        ("foreman_overlook_access", 10.3, -17.5, 1.6, 2.75, "hazard", "b01_foreman_overlook_access_strip", "b01_relay_cage", "overlook_connector"),
        ("foreman_overlook_floor", 14.2, -17.3, 3.4, 2.8, "steel", "b01_foreman_overlook_floor_zone", "b01_relay_cage", "overlook_combat_pocket"),
        ("exit_read", 0, -23.2, 4.4, 1.2, "hazard", "b01_exit_read_pad", "b01_relay_cage", "exit_reveal"),
    ]:
        floor_pad(reads, *spec)

    for name, x, z, sx, sy, sz, mat_key, geometry_id, room_id, role in [
        ("entry_electrical_box", 2.0, 21.5, 0.7, 1.1, 0.54, "steel", "b01_entry_electrical_box", "b01_entry_vestibule", "world_detail"),
        ("intake_container_landmark", 5.7, 14.0, 2.6, 1.44, 0.82, "steel", "b01_intake_container_landmark", "b01_intake_peek", "landmark_cover"),
        ("alarm_server_rack", -17.55, 2.4, 0.08, 2.0, 2.2, "steel", "b01_alarm_server_rack_west", "alarm_relay_room", "world_detail"),
        ("drum_stack_a", 16.6, -4.1, 0.6, 0.76, 0.6, "red", "b01_drum_stack_a", "b01_drum_flank", "world_detail"),
        ("drum_stack_b", 16.6, -2.5, 0.6, 0.76, 0.6, "red", "b01_drum_stack_b", "b01_drum_flank", "world_detail"),
        ("drum_stack_c", 16.6, -0.9, 0.6, 0.76, 0.6, "red", "b01_drum_stack_c", "b01_drum_flank", "world_detail"),
    ]:
        cover(cover_col, name, x, z, sx, sy, sz, mat_key, geometry_id, room_id, role)

    for idx, (x, z) in enumerate([(-6.6, -12.98), (-4.8, -12.98), (-3.0, -12.98), (-1.2, -12.98)]):
        add_cube(f"cage_preview_bar_{idx}", x, WT + 1.45, z, 0.08, 2.1, 0.08, MATS["steel"], reads, {
            "geometryId": f"b01_cage_preview_bar_{idx}",
            "roomId": "b01_cage_vestibule",
            "floorplanRole": "preview_bars",
        })

    for idx, x in enumerate([-8.75, 8.75]):
        rail_zs = [-23.2, -21.0, -14.4] if x > 0 else [-23.2, -21.0, -18.8, -16.6, -14.4]
        for j, z in enumerate(rail_zs):
            add_cube(f"relay_cage_side_bar_{idx}_{j}", x, WT + 1.85, z, 0.08, 2.9, 0.08, MATS["steel"], reads, {
                "geometryId": f"b01_cage_rail_{idx}_{j}",
                "roomId": "b01_relay_cage",
                "floorplanRole": "cage_bars",
            })

    for idx, z in enumerate([18.2, 12.8, 5.8, 0.8, -3.2, -10.0, -18.6, -23.4]):
        add_cube(f"overhead_beam_{idx}", 0, RH + WT - 0.16, z, 5.8, 0.10, 0.12, MATS["steel"], reads, {
            "geometryId": f"b01_overhead_beam_{idx}",
            "roomId": "b01_loading_dock",
            "floorplanRole": "ceiling_structure",
        })

    for text, x, z in [
        ("01 ENTRY", 0, 20.8),
        ("02 PEEK", -4.6, 12.5),
        ("03 SERVICE", 5.8, 5.8),
        ("04 RELAY", 0, 1.2),
        ("05 ALARM", -14.2, 2.8),
        ("06 FLANK", 14.3, -0.8),
        ("07 VEST", -5.0, -10.4),
        ("08 CAGE", 0, -18.6),
        ("09 OVERLOOK", 14.4, -17.4),
        ("EXIT", 0, -27.0),
    ]:
        label(reads, text, x, z)

    for name, loc, color, energy in [
        ("entry_warm_route", (0, 3.7, 18.2), (1.0, 0.54, 0.16), 240),
        ("relay_cyan_objective", (-14.2, 3.2, 1.0), (0.1, 1.0, 0.78), 280),
        ("drum_red_pressure", (13.6, 3.2, -2.2), (1.0, 0.18, 0.08), 220),
        ("cage_amber_final", (0, 3.5, -20.4), (1.0, 0.45, 0.08), 320),
    ]:
        light_data = bpy.data.lights.new(name, "POINT")
        light_data.color = color
        light_data.energy = energy
        light_data.shadow_soft_size = 5.0
        obj = bpy.data.objects.new(name, light_data)
        obj.location = loc
        lights.objects.link(obj)

    cam_data = bpy.data.cameras.new("B01_topdown_design_camera")
    cam = bpy.data.objects.new("B01_topdown_design_camera", cam_data)
    cam.location = (0, 64, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 70
    lights.objects.link(cam)
    bpy.context.scene.camera = cam

    os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    bpy.ops.export_scene.gltf(filepath=GLB_OUT, export_format="GLB", use_selection=False)
    return {
        "blend": BLEND_OUT,
        "glb": GLB_OUT,
        "objects": len(bpy.context.scene.objects),
        "collections": [c.name for c in bpy.data.collections if c.name.startswith("B01") or c.name[:2].isdigit()],
    }


result = build()
