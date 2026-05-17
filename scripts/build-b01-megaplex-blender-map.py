import json
import math
import os
import random
from mathutils import Vector

import bpy


ROOT = "/Users/tobiasmastek/Desktop/firstpgame"
BLEND_OUT = os.path.join(ROOT, "art_src/levels/b01_loading_dock_megaplex.blend")
GLB_OUT = os.path.join(ROOT, "public/assets/levels/b01_loading_dock_megaplex.glb")
LAYOUT_OUT = os.path.join(ROOT, "art_src/levels/b01_loading_dock_megaplex.layout.json")
TOPDOWN_OUT = os.path.join(ROOT, "art_src/levels/b01_loading_dock_megaplex_topdown.png")
BEAUTY_OUT = os.path.join(ROOT, "art_src/levels/b01_loading_dock_megaplex_beauty.png")

WT = 0.4
RH = 6.2
ROOM_W = 38.0
ROOM_D = 44.0
COLS = [-38.0, 0.0, 38.0]
ROWS = [88.0, 44.0, 0.0, -44.0, -88.0]
X_MIN = COLS[0] - ROOM_W / 2
X_MAX = COLS[-1] + ROOM_W / 2
Z_MAX = ROWS[0] + ROOM_D / 2
Z_MIN = ROWS[-1] - ROOM_D / 2
RANDOM_SEED = 1701


ROOMS = [
    {"id": "receiving_yard", "name": "Receiving Yard", "row": 0, "col": 0, "zone": 0, "mood": "cold rain sodium", "encounter": "patrol_forklift_ambush"},
    {"id": "customs_entry", "name": "Customs Entry Hall", "row": 0, "col": 1, "zone": 0, "mood": "warm security threshold", "encounter": "lookout_peek_tutorial"},
    {"id": "container_gate", "name": "Container Gate", "row": 0, "col": 2, "zone": 0, "mood": "blue exterior slit", "encounter": "crossfire_container_rows"},
    {"id": "forklift_repair", "name": "Forklift Repair Bay", "row": 1, "col": 0, "zone": 0, "mood": "dirty worklight", "encounter": "breacher_rollup_door"},
    {"id": "intake_court", "name": "Intake Court", "row": 1, "col": 1, "zone": 0, "mood": "open dock court", "encounter": "multi_angle_first_room"},
    {"id": "security_screening", "name": "Security Screening", "row": 1, "col": 2, "zone": 0, "mood": "cyan scan glass", "encounter": "window_overwatch"},
    {"id": "manifest_office", "name": "Manifest Office", "row": 2, "col": 0, "zone": 1, "mood": "paper amber", "encounter": "alarm_hold_manifest"},
    {"id": "warehouse_spine", "name": "Warehouse Spine", "row": 2, "col": 1, "zone": 1, "mood": "long rack lane", "encounter": "suppression_lane"},
    {"id": "hazmat_barrels", "name": "Hazmat Barrel Room", "row": 2, "col": 2, "zone": 1, "mood": "red hazard pool", "encounter": "barrel_flush_trap"},
    {"id": "cold_storage", "name": "Cold Storage", "row": 3, "col": 0, "zone": 1, "mood": "icy low visibility", "encounter": "thermal_stealth_patrol"},
    {"id": "alarm_relay", "name": "Alarm Relay Control", "row": 3, "col": 1, "zone": 1, "mood": "amber relay storm", "encounter": "objective_hold_reinforce"},
    {"id": "boiler_pump", "name": "Boiler Pump Room", "row": 3, "col": 2, "zone": 1, "mood": "steam orange pressure", "encounter": "demolition_pipe_pressure"},
    {"id": "loading_cage", "name": "Loading Cage", "row": 4, "col": 0, "zone": 2, "mood": "cage shadows", "encounter": "shield_push_cage"},
    {"id": "sortation_hall", "name": "Sortation Hall", "row": 4, "col": 1, "zone": 2, "mood": "moving conveyor amber", "encounter": "final_multiwave_sorter"},
    {"id": "foreman_catwalk", "name": "Foreman Catwalk Office", "row": 4, "col": 2, "zone": 2, "mood": "high glass overwatch", "encounter": "sniper_catwalk_relocate"},
]

ROLE_COLORS = {
    "lookout": "marker_yellow",
    "anchor": "marker_red",
    "flanker": "marker_green",
    "breacher": "marker_orange",
    "sniper": "marker_blue",
    "demolitions": "marker_red",
    "shield": "marker_white",
    "drone": "marker_cyan",
    "runner": "marker_green",
    "patrol": "marker_yellow",
}

MATS = {}
COLLECTIONS = {}
MANIFEST = {"rooms": [], "connections": [], "encounterTypes": [], "markers": [], "hazards": [], "features": []}


def clear_scene():
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def mat(name, color, metallic=0.0, roughness=0.65, alpha=1.0, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        def set_input(names, value):
            for key in names:
                if key in bsdf.inputs:
                    bsdf.inputs[key].default_value = value
                    return
        set_input(("Base Color",), color)
        set_input(("Metallic",), metallic)
        set_input(("Roughness",), roughness)
        set_input(("Alpha",), alpha)
        if emission:
            set_input(("Emission Color", "Emission"), emission[0])
            set_input(("Emission Strength",), emission[1])
    if alpha < 1.0:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = True
        material.diffuse_color = color
    return material


def setup_materials():
    MATS.update({
        "floor": mat("B01 megaplex worn polished concrete", (0.38, 0.42, 0.42, 1), roughness=0.48, metallic=0.02),
        "floor_dark": mat("B01 megaplex wet dark concrete", (0.13, 0.16, 0.17, 1), roughness=0.36, metallic=0.04),
        "wall": mat("B01 megaplex painted concrete panels", (0.50, 0.57, 0.58, 1), roughness=0.82),
        "wall_dark": mat("B01 megaplex soot concrete", (0.18, 0.21, 0.22, 1), roughness=0.9),
        "steel": mat("B01 megaplex blue black steel", (0.055, 0.075, 0.095, 1), metallic=0.55, roughness=0.42),
        "steel_edge": mat("B01 megaplex scuffed bright edge", (0.34, 0.38, 0.38, 1), metallic=0.72, roughness=0.32),
        "hazard": mat("B01 megaplex hazard amber paint", (1.0, 0.57, 0.08, 1), roughness=0.38, emission=((1.0, 0.32, 0.03, 1), 0.55)),
        "cyan": mat("B01 megaplex relay cyan", (0.04, 0.22, 0.22, 1), roughness=0.34, emission=((0.08, 1.0, 0.78, 1), 0.9)),
        "red": mat("B01 megaplex emergency red", (0.75, 0.08, 0.035, 1), roughness=0.55, emission=((1.0, 0.03, 0.015, 1), 0.35)),
        "barrel": mat("B01 megaplex explosive barrel red", (0.72, 0.11, 0.04, 1), roughness=0.54, metallic=0.18, emission=((1.0, 0.05, 0.02, 1), 0.18)),
        "wood": mat("B01 megaplex wet pallet wood", (0.36, 0.23, 0.12, 1), roughness=0.75),
        "rubber": mat("B01 megaplex forklift rubber", (0.015, 0.014, 0.013, 1), roughness=0.9),
        "oil": mat("B01 megaplex layered oil stains", (0.015, 0.018, 0.016, 0.58), roughness=0.18, metallic=0.05, alpha=0.58),
        "water": mat("B01 megaplex shallow rain puddles", (0.08, 0.16, 0.19, 0.42), roughness=0.08, metallic=0.02, alpha=0.42, emission=((0.02, 0.08, 0.10, 1), 0.06)),
        "paint_white": mat("B01 megaplex worn white lane paint", (0.78, 0.75, 0.63, 1), roughness=0.72),
        "paint_cyan": mat("B01 megaplex worn cyan route paint", (0.03, 0.55, 0.62, 1), roughness=0.58, emission=((0.0, 0.45, 0.62, 1), 0.16)),
        "paper": mat("B01 megaplex stained paperwork labels", (0.86, 0.76, 0.55, 1), roughness=0.82),
        "steam": mat("B01 megaplex translucent steam sheets", (0.55, 0.70, 0.76, 0.20), roughness=0.35, metallic=0.0, alpha=0.20, emission=((0.16, 0.27, 0.32, 1), 0.08)),
        "rain": mat("B01 megaplex exterior rain shimmer", (0.30, 0.60, 0.78, 0.18), roughness=0.12, metallic=0.0, alpha=0.18, emission=((0.08, 0.24, 0.35, 1), 0.08)),
        "monitor": mat("B01 megaplex small monitor glow", (0.02, 0.10, 0.12, 1), roughness=0.24, metallic=0.05, emission=((0.0, 0.95, 0.72, 1), 1.2)),
        "glass": mat("B01 megaplex tactical glass blue", (0.55, 0.86, 1.0, 0.34), roughness=0.06, metallic=0.05, alpha=0.34, emission=((0.08, 0.38, 0.55, 1), 0.12)),
        "glass_warm": mat("B01 megaplex office glass amber", (1.0, 0.78, 0.45, 0.28), roughness=0.08, metallic=0.04, alpha=0.28, emission=((1.0, 0.42, 0.08, 1), 0.10)),
        "cold": mat("B01 megaplex cold storage blue", (0.42, 0.78, 0.96, 1), roughness=0.4, emission=((0.20, 0.62, 1.0, 1), 0.22)),
        "white": mat("B01 megaplex marker white", (0.9, 0.92, 0.86, 1), roughness=0.45),
        "black": mat("B01 megaplex matte black", (0.01, 0.012, 0.014, 1), roughness=0.86),
        "marker_yellow": mat("marker yellow", (1.0, 0.78, 0.12, 1), roughness=0.35, emission=((1.0, 0.64, 0.05, 1), 0.35)),
        "marker_red": mat("marker red", (1.0, 0.1, 0.05, 1), roughness=0.4, emission=((1.0, 0.05, 0.02, 1), 0.35)),
        "marker_green": mat("marker green", (0.1, 1.0, 0.45, 1), roughness=0.4, emission=((0.04, 1.0, 0.25, 1), 0.35)),
        "marker_orange": mat("marker orange", (1.0, 0.42, 0.05, 1), roughness=0.4, emission=((1.0, 0.25, 0.02, 1), 0.35)),
        "marker_blue": mat("marker blue", (0.25, 0.58, 1.0, 1), roughness=0.4, emission=((0.04, 0.3, 1.0, 1), 0.35)),
        "marker_cyan": mat("marker cyan", (0.0, 0.92, 1.0, 1), roughness=0.4, emission=((0.0, 0.85, 1.0, 1), 0.35)),
        "marker_white": mat("marker white", (0.95, 0.96, 0.9, 1), roughness=0.32, emission=((0.85, 0.9, 0.72, 1), 0.28)),
    })


def collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col:
        COLLECTIONS[name] = col
        return col
    col = bpy.data.collections.new(name)
    if parent:
        parent.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)
    COLLECTIONS[name] = col
    return col


def assign_props(obj, props):
    if not props:
        return obj
    for key, value in props.items():
        obj[key] = value
    return obj


def bevel(obj, amount=0.025, segments=1):
    if amount <= 0:
        return obj
    mod = obj.modifiers.new("small_softened_edges", "BEVEL")
    mod.width = amount
    mod.segments = segments
    mod.affect = "EDGES"
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def add_box(name, x, y, z, sx, sy, sz, material, col, props=None, bevel_width=0.015):
    mesh = bpy.data.meshes.new(name + "_mesh")
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    verts = [
        (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
        (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (x, y, z)
    obj.data.materials.append(material)
    assign_props(obj, props)
    col.objects.link(obj)
    bevel(obj, bevel_width, 1)
    return obj


def add_cylinder(name, x, y, z, radius, depth, material, col, props=None, axis="Y", vertices=24):
    rot = (0, 0, 0)
    if axis == "Y":
        rot = (math.radians(90), 0, 0)
    elif axis == "X":
        rot = (0, math.radians(90), 0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(x, y, z), rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.data.materials.append(material)
    assign_props(obj, props)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    bevel(obj, 0.01, 1)
    return obj


def add_torus(name, x, y, z, major_radius, minor_radius, material, col, props=None, axis="Y"):
    rot = (0, 0, 0)
    if axis == "Y":
        rot = (math.radians(90), 0, 0)
    elif axis == "X":
        rot = (0, math.radians(90), 0)
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=24, minor_segments=6, location=(x, y, z), rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.data.materials.append(material)
    assign_props(obj, props)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def room_bounds(room):
    cx = COLS[room["col"]]
    cz = ROWS[room["row"]]
    return {
        "x0": cx - ROOM_W / 2,
        "x1": cx + ROOM_W / 2,
        "z0": cz - ROOM_D / 2,
        "z1": cz + ROOM_D / 2,
        "cx": cx,
        "cz": cz,
    }


def split_segments(a0, a1, center, width):
    lo = center - width / 2
    hi = center + width / 2
    out = []
    if lo - a0 > 0.35:
        out.append((a0, lo))
    if a1 - hi > 0.35:
        out.append((hi, a1))
    return out


def wall_x(col, name, z, x0, x1, room_id, geometry_id, door=None, mat_key="wall", role="room_shell"):
    segments = split_segments(x0, x1, door[0], door[1]) if door else [(x0, x1)]
    for idx, (a, b) in enumerate(segments):
        add_box(
            f"{name}_{idx}", (a + b) * 0.5, RH / 2 + WT / 2, z, b - a, RH, 0.54, MATS[mat_key], col,
            {"collision": "wall_aabb", "roomId": room_id, "geometryId": geometry_id, "floorplanRole": role},
            0.018,
        )
        add_box(f"{name}_{idx}_top_trim", (a + b) * 0.5, RH + WT - 0.05, z, b - a, 0.06, 0.10, MATS["steel_edge"], col,
                {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "top_trim"}, 0.008)
        add_box(f"{name}_{idx}_base_trim", (a + b) * 0.5, WT + 0.11, z, b - a, 0.12, 0.08, MATS["steel"], col,
                {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "base_trim"}, 0.008)


def wall_z(col, name, x, z0, z1, room_id, geometry_id, door=None, mat_key="wall", role="room_shell"):
    segments = split_segments(z0, z1, door[0], door[1]) if door else [(z0, z1)]
    for idx, (a, b) in enumerate(segments):
        add_box(
            f"{name}_{idx}", x, RH / 2 + WT / 2, (a + b) * 0.5, 0.54, RH, b - a, MATS[mat_key], col,
            {"collision": "wall_aabb", "roomId": room_id, "geometryId": geometry_id, "floorplanRole": role},
            0.018,
        )
        add_box(f"{name}_{idx}_top_trim", x, RH + WT - 0.05, (a + b) * 0.5, 0.10, 0.06, b - a, MATS["steel_edge"], col,
                {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "top_trim"}, 0.008)
        add_box(f"{name}_{idx}_base_trim", x, WT + 0.11, (a + b) * 0.5, 0.08, 0.12, b - a, MATS["steel"], col,
                {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "base_trim"}, 0.008)


def add_window(name, x, z, length, orientation, room_id, sightline, warm=False, sill=0.9, head=2.25):
    col = COLLECTIONS["03_windows_and_breakables"]
    pane_h = max(0.4, head - sill)
    y = WT + sill + pane_h / 2
    if orientation == "X":
        glass = add_box(name + "_pane", x, y, z, length, pane_h, 0.07, MATS["glass_warm" if warm else "glass"], col, {
            "collision": "transparent_window_aabb",
            "glassPane": True,
            "breakable": True,
            "breakSound": "glass",
            "roomId": room_id,
            "sightlineId": sightline,
            "geometryId": name,
            "floorplanRole": "tactical_window",
        }, 0.004)
        for dx in [-length / 2, length / 2]:
            add_box(name + f"_side_frame_{dx:+.1f}", x + dx, WT + (sill + head) / 2, z, 0.10, pane_h + 0.42, 0.16, MATS["steel"], col,
                    {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "window_frame"}, 0.008)
        add_box(name + "_top_frame", x, WT + head + 0.08, z, length + 0.25, 0.14, 0.16, MATS["steel"], col,
                {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "window_frame"}, 0.008)
        add_box(name + "_sill", x, WT + sill - 0.08, z, length + 0.25, 0.14, 0.18, MATS["steel"], col,
                {"collision": "cover_aabb", "roomId": room_id, "geometryId": name + "_sill", "floorplanRole": "window_sill"}, 0.01)
    else:
        glass = add_box(name + "_pane", x, y, z, 0.07, pane_h, length, MATS["glass_warm" if warm else "glass"], col, {
            "collision": "transparent_window_aabb",
            "glassPane": True,
            "breakable": True,
            "breakSound": "glass",
            "roomId": room_id,
            "sightlineId": sightline,
            "geometryId": name,
            "floorplanRole": "tactical_window",
        }, 0.004)
        for dz in [-length / 2, length / 2]:
            add_box(name + f"_side_frame_{dz:+.1f}", x, WT + (sill + head) / 2, z + dz, 0.16, pane_h + 0.42, 0.10, MATS["steel"], col,
                    {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "window_frame"}, 0.008)
        add_box(name + "_top_frame", x, WT + head + 0.08, z, 0.16, 0.14, length + 0.25, MATS["steel"], col,
                {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "window_frame"}, 0.008)
        add_box(name + "_sill", x, WT + sill - 0.08, z, 0.18, 0.14, length + 0.25, MATS["steel"], col,
                {"collision": "cover_aabb", "roomId": room_id, "geometryId": name + "_sill", "floorplanRole": "window_sill"}, 0.01)
    MANIFEST["features"].append({"type": "window", "id": name, "room": room_id, "sightline": sightline})
    return glass


def add_floor_label(text, x, z, size=1.2):
    col = COLLECTIONS["07_labels_and_route_language"]
    curve = bpy.data.curves.new("label_" + text.replace(" ", "_"), "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    obj = bpy.data.objects.new("LABEL_" + text.replace(" ", "_"), curve)
    obj.location = (x, WT + 0.075, z)
    obj.rotation_euler[0] = math.radians(90)
    obj.data.materials.append(MATS["hazard"])
    assign_props(obj, {"collision": "decorative_only", "floorplanRole": "designer_floor_label"})
    col.objects.link(obj)
    return obj


def marker_empty(name, x, z, props, y=WT + 0.08):
    col = COLLECTIONS["04_encounter_markers"]
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "CONE"
    obj.empty_display_size = 1.4
    obj.location = (x, y, z)
    assign_props(obj, props)
    col.objects.link(obj)
    return obj


def enemy_marker(room, role, dx, dz, enemy_type, behavior, wave="initial"):
    b = room_bounds(room)
    x = b["cx"] + dx
    z = b["cz"] + dz
    encounter_id = f"mega_{room['id']}_{room['encounter']}"
    name = f"ENEMY_{room['id']}_{role}_{wave}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": encounter_id,
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": wave,
    }
    marker_empty(name, x, z, props)
    add_cylinder(name + "_disc", x, WT + 0.025, z, 0.48, 0.035, MATS[ROLE_COLORS.get(role, "marker_yellow")],
                 COLLECTIONS["04_encounter_markers"], {"collision": "decorative_only", "markerVisual": role}, axis="Y", vertices=20)
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z})


def player_spawn_marker():
    marker_empty("PLAYER_SPAWN_B01_MEGAPLEX", 0, Z_MAX - 5.5, {
        "markerType": "player_spawn",
        "spawnYaw": 0.0,
        "roomId": "customs_entry",
        "floorY": WT,
    }, y=WT + 0.12)
    add_floor_label("PLAYER INSERT", 0, Z_MAX - 8.0, 1.0)


def exit_marker():
    marker_empty("EXIT_B01_MEGAPLEX_SORTATION_ROLLUP", 0, Z_MIN + 4.5, {
        "markerType": "exit_zone",
        "roomId": "sortation_hall",
        "x0": -6.0,
        "x1": 6.0,
        "z0": Z_MIN + 1.0,
        "z1": Z_MIN + 8.0,
    }, y=WT + 0.12)
    add_floor_label("EXIT ROLLUP", 0, Z_MIN + 8.0, 1.15)


def add_pallet_stack(room, x, z, rows=3, cols=2, cover=True):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    for r in range(rows):
        for c in range(cols):
            px = x + (c - (cols - 1) / 2) * 1.05
            py = WT + 0.16 + r * 0.28
            pz = z
            add_box(f"pallet_{room['id']}_{x:.1f}_{z:.1f}_{r}_{c}", px, py, pz, 0.92, 0.16, 1.12, MATS["wood"], col,
                    {"collision": "cover_aabb" if cover and r == rows - 1 else "decorative_only", "roomId": room["id"], "floorplanRole": "pallet_cover"}, 0.01)


def add_container(room, x, z, sx=5.6, sz=2.45, color_key="steel", high=False):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    h = 2.55 if not high else 4.8
    add_box(f"container_{room['id']}_{x:.1f}_{z:.1f}", x, WT + h / 2, z, sx, h, sz, MATS[color_key], col,
            {"collision": "cover_aabb", "roomId": room["id"], "geometryId": f"container_{room['id']}_{x:.1f}_{z:.1f}", "floorplanRole": "large_cover"}, 0.025)
    for k in [-0.42, 0.0, 0.42]:
        add_box(f"container_rib_{room['id']}_{x:.1f}_{z:.1f}_{k}", x + k * sx, WT + h / 2, z - sz / 2 - 0.035, 0.08, h * 0.95, 0.05, MATS["steel_edge"], col,
                {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "container_rib"}, 0.004)


def add_barrel(room, x, z, explosive=True):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    name = f"barrel_{room['id']}_{x:.1f}_{z:.1f}"
    props = {
        "collision": "cover_aabb",
        "roomId": room["id"],
        "geometryId": name,
        "floorplanRole": "explosive_barrel" if explosive else "industrial_barrel",
        "explosive": bool(explosive),
        "coverHP": 2,
    }
    add_cylinder(name, x, WT + 0.62, z, 0.45, 1.24, MATS["barrel" if explosive else "steel"], col, props, axis="Y", vertices=28)
    add_torus(name + "_top_ring", x, WT + 1.22, z, 0.45, 0.035, MATS["steel_edge"], col, {"collision": "decorative_only", "roomId": room["id"]}, axis="Y")
    add_torus(name + "_bottom_ring", x, WT + 0.03, z, 0.45, 0.035, MATS["steel_edge"], col, {"collision": "decorative_only", "roomId": room["id"]}, axis="Y")
    if explosive:
        MANIFEST["hazards"].append({"type": "explosive_barrel", "room": room["id"], "x": x, "z": z})


def add_forklift(room, x, z, yaw=0.0):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    base = f"forklift_{room['id']}_{x:.1f}_{z:.1f}"
    # Axis-aligned chunky forklift. Good enough as tactical cover and landmark.
    add_box(base + "_body", x, WT + 0.52, z, 2.2, 1.0, 1.35, MATS["hazard"], col,
            {"collision": "cover_aabb", "roomId": room["id"], "geometryId": base, "floorplanRole": "forklift_cover"}, 0.035)
    add_box(base + "_cab", x - 0.35, WT + 1.42, z, 1.05, 1.55, 1.12, MATS["steel"], col,
            {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "forklift_cab"}, 0.025)
    add_box(base + "_mast_l", x + 1.2, WT + 1.4, z - 0.42, 0.16, 2.15, 0.12, MATS["black"], col,
            {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "forklift_mast"}, 0.01)
    add_box(base + "_mast_r", x + 1.2, WT + 1.4, z + 0.42, 0.16, 2.15, 0.12, MATS["black"], col,
            {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "forklift_mast"}, 0.01)
    add_box(base + "_fork_a", x + 2.35, WT + 0.23, z - 0.34, 1.9, 0.09, 0.12, MATS["steel_edge"], col,
            {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "forklift_fork"}, 0.008)
    add_box(base + "_fork_b", x + 2.35, WT + 0.23, z + 0.34, 1.9, 0.09, 0.12, MATS["steel_edge"], col,
            {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "forklift_fork"}, 0.008)
    for wx in [-0.85, 0.75]:
        for wz in [-0.72, 0.72]:
            add_cylinder(base + f"_wheel_{wx}_{wz}", x + wx, WT + 0.25, z + wz, 0.27, 0.22, MATS["rubber"], col,
                         {"collision": "decorative_only", "roomId": room["id"]}, axis="Z", vertices=18)
    MANIFEST["features"].append({"type": "forklift_cover", "room": room["id"], "x": x, "z": z})


def add_rack(room, x, z, length=10.0, axis="Z"):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    if axis == "Z":
        add_box(f"rack_{room['id']}_{x:.1f}_{z:.1f}_back", x, WT + 1.45, z, 0.45, 2.9, length, MATS["steel"], col,
                {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "warehouse_rack"}, 0.015)
        for oz in [-length * 0.36, 0, length * 0.36]:
            add_pallet_stack(room, x + 0.8, z + oz, rows=3, cols=1)
    else:
        add_box(f"rack_{room['id']}_{x:.1f}_{z:.1f}_back", x, WT + 1.45, z, length, 2.9, 0.45, MATS["steel"], col,
                {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "warehouse_rack"}, 0.015)
        for ox in [-length * 0.36, 0, length * 0.36]:
            add_pallet_stack(room, x + ox, z + 0.8, rows=3, cols=1)


def add_conveyor(room, x, z, length=16.0, axis="X", animated=True):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    if axis == "X":
        add_box(f"conveyor_{room['id']}_{x:.1f}_{z:.1f}_belt", x, WT + 0.75, z, length, 0.32, 1.35, MATS["black"], col,
                {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "moving_conveyor", "animationType": "belt_loop"}, 0.02)
        for i in range(7):
            ox = x - length / 2 + 1.2 + i * (length - 2.4) / 6
            roller = add_cylinder(f"conveyor_{room['id']}_roller_{i}", ox, WT + 0.95, z, 0.18, 1.55, MATS["steel_edge"], col,
                                  {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "animated_roller"}, axis="Z", vertices=18)
            if animated:
                roller.rotation_euler[2] = 0
                roller.keyframe_insert(data_path="rotation_euler", frame=1)
                roller.rotation_euler[2] = math.tau
                roller.keyframe_insert(data_path="rotation_euler", frame=90)
    else:
        add_box(f"conveyor_{room['id']}_{x:.1f}_{z:.1f}_belt", x, WT + 0.75, z, 1.35, 0.32, length, MATS["black"], col,
                {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "moving_conveyor", "animationType": "belt_loop"}, 0.02)
        for i in range(7):
            oz = z - length / 2 + 1.2 + i * (length - 2.4) / 6
            roller = add_cylinder(f"conveyor_{room['id']}_roller_{i}", x, WT + 0.95, oz, 0.18, 1.55, MATS["steel_edge"], col,
                                  {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "animated_roller"}, axis="X", vertices=18)
            if animated:
                roller.rotation_euler[0] = 0
                roller.keyframe_insert(data_path="rotation_euler", frame=1)
                roller.rotation_euler[0] = math.tau
                roller.keyframe_insert(data_path="rotation_euler", frame=90)
    MANIFEST["features"].append({"type": "animated_conveyor", "room": room["id"], "x": x, "z": z})


def add_pipe_run(room, x, z, length=12.0, axis="X", arcing=False):
    col = COLLECTIONS["05_props_barrels_crates_machinery"]
    y = WT + 2.35
    props = {"collision": "cover_aabb", "roomId": room["id"], "floorplanRole": "industrial_pipe", "arcing": bool(arcing)}
    if axis == "X":
        add_cylinder(f"pipe_{room['id']}_{x:.1f}_{z:.1f}", x, y, z, 0.16, length, MATS["steel_edge"], col, props, axis="X", vertices=18)
    else:
        add_cylinder(f"pipe_{room['id']}_{x:.1f}_{z:.1f}", x, y, z, 0.16, length, MATS["steel_edge"], col, props, axis="Z", vertices=18)
    if arcing:
        MANIFEST["hazards"].append({"type": "electrical_arc_pipe", "room": room["id"], "x": x, "z": z})


def detail_col():
    return COLLECTIONS["06_AAA_visual_detail"]


def detail_props(room, role, collision="decorative_only", extra=None):
    props = {"collision": collision, "roomId": room["id"], "floorplanRole": role}
    if extra:
        props.update(extra)
    return props


def add_floor_patch(room, name, x, z, sx, sz, mat_key, yaw=0.0, role="floor_wear", collision="decorative_only", y=WT + 0.052):
    obj = add_box(
        f"detail_{room['id']}_{name}",
        x,
        y,
        z,
        sx,
        0.026,
        sz,
        MATS[mat_key],
        detail_col(),
        detail_props(room, role, collision),
        0.002,
    )
    obj.rotation_euler[1] = math.radians(yaw)
    return obj


def add_wall_panel(room, name, side, offset, base, length, height, mat_key, role="wall_graphic", collision="decorative_only"):
    b = room_bounds(room)
    inset = 0.33
    y = WT + base + height * 0.5
    if side == "N":
        x, z, sx, sz = b["cx"] + offset, b["z1"] - inset, length, 0.055
    elif side == "S":
        x, z, sx, sz = b["cx"] + offset, b["z0"] + inset, length, 0.055
    elif side == "E":
        x, z, sx, sz = b["x1"] - inset, b["cz"] + offset, 0.055, length
    else:
        x, z, sx, sz = b["x0"] + inset, b["cz"] + offset, 0.055, length
    return add_box(
        f"detail_{room['id']}_{name}",
        x,
        y,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        detail_col(),
        detail_props(room, role, collision),
        0.004,
    )


def add_detail_label(room, text, name, x, z, size=0.72, mat_key="paper", yaw=0.0):
    curve = bpy.data.curves.new(f"detail_label_curve_{room['id']}_{name}", "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    obj = bpy.data.objects.new(f"detail_label_{room['id']}_{name}", curve)
    obj.location = (x, WT + 0.083, z)
    obj.rotation_euler[0] = math.radians(90)
    obj.rotation_euler[1] = math.radians(yaw)
    obj.data.materials.append(MATS[mat_key])
    assign_props(obj, detail_props(room, "floor_graphic_label"))
    detail_col().objects.link(obj)
    return obj


def add_overhead_cable_tray(room, name, x, z, length=20.0, axis="X"):
    col = detail_col()
    y = RH + WT - 0.74
    if axis == "X":
        add_box(f"detail_{room['id']}_{name}_tray", x, y, z, length, 0.08, 0.32, MATS["black"], col, detail_props(room, "overhead_cable_tray"), 0.004)
        add_box(f"detail_{room['id']}_{name}_rail_a", x, y + 0.10, z - 0.21, length, 0.08, 0.05, MATS["steel_edge"], col, detail_props(room, "overhead_cable_tray"), 0.003)
        add_box(f"detail_{room['id']}_{name}_rail_b", x, y + 0.10, z + 0.21, length, 0.08, 0.05, MATS["steel_edge"], col, detail_props(room, "overhead_cable_tray"), 0.003)
        add_cylinder(f"detail_{room['id']}_{name}_loom_a", x, y - 0.10, z - 0.06, 0.045, length * 0.92, MATS["rubber"], col, detail_props(room, "overhead_cable_loom"), axis="X", vertices=10)
        add_cylinder(f"detail_{room['id']}_{name}_loom_b", x, y - 0.12, z + 0.08, 0.035, length * 0.74, MATS["rubber"], col, detail_props(room, "overhead_cable_loom"), axis="X", vertices=10)
    else:
        add_box(f"detail_{room['id']}_{name}_tray", x, y, z, 0.32, 0.08, length, MATS["black"], col, detail_props(room, "overhead_cable_tray"), 0.004)
        add_box(f"detail_{room['id']}_{name}_rail_a", x - 0.21, y + 0.10, z, 0.05, 0.08, length, MATS["steel_edge"], col, detail_props(room, "overhead_cable_tray"), 0.003)
        add_box(f"detail_{room['id']}_{name}_rail_b", x + 0.21, y + 0.10, z, 0.05, 0.08, length, MATS["steel_edge"], col, detail_props(room, "overhead_cable_tray"), 0.003)
        add_cylinder(f"detail_{room['id']}_{name}_loom_a", x - 0.06, y - 0.10, z, 0.045, length * 0.92, MATS["rubber"], col, detail_props(room, "overhead_cable_loom"), axis="Z", vertices=10)
        add_cylinder(f"detail_{room['id']}_{name}_loom_b", x + 0.08, y - 0.12, z, 0.035, length * 0.74, MATS["rubber"], col, detail_props(room, "overhead_cable_loom"), axis="Z", vertices=10)
    MANIFEST["features"].append({"type": "overhead_cable_tray", "room": room["id"], "x": x, "z": z})


def add_monitor_bank(room, name, side="N", offset=0.0, count=3):
    add_wall_panel(room, f"{name}_backplate", side, offset, 1.28, 4.8, 1.5, "steel", "monitor_bank_backplate")
    spacing = 1.08
    start = -(count - 1) * spacing * 0.5
    for i in range(count):
        add_wall_panel(room, f"{name}_screen_{i}", side, offset + start + i * spacing, 1.58, 0.74, 0.48, "monitor", "monitor_bank_glow")
    MANIFEST["features"].append({"type": "monitor_bank", "room": room["id"], "side": side})


def add_chain_curtain(room, name, x, z, width=4.5, axis="X", count=8):
    col = detail_col()
    for i in range(count):
        t = 0 if count == 1 else i / (count - 1)
        off = (t - 0.5) * width
        cx = x + off if axis == "X" else x
        cz = z if axis == "X" else z + off
        add_cylinder(
            f"detail_{room['id']}_{name}_chain_{i}",
            cx,
            WT + 3.55,
            cz,
            0.032,
            2.7,
            MATS["steel_edge"],
            col,
            detail_props(room, "hanging_chain_curtain"),
            axis="Y",
            vertices=8,
        )
    MANIFEST["features"].append({"type": "chain_curtain", "room": room["id"], "x": x, "z": z})


def add_package_cluster(room, name, x, z, count=5, spread=2.8, mat_key="paper"):
    rng = random.Random(RANDOM_SEED + len(room["id"]) * 17 + len(name) * 31)
    for i in range(count):
        px = x + rng.uniform(-spread, spread)
        pz = z + rng.uniform(-spread * 0.55, spread * 0.55)
        sx = rng.uniform(0.42, 0.92)
        sz = rng.uniform(0.34, 0.74)
        h = rng.uniform(0.08, 0.18)
        obj = add_box(
            f"detail_{room['id']}_{name}_parcel_{i}",
            px,
            WT + 0.08 + h * 0.5,
            pz,
            sx,
            h,
            sz,
            MATS[mat_key],
            detail_col(),
            detail_props(room, "loose_parcel_detail"),
            0.004,
        )
        obj.rotation_euler[1] = rng.uniform(-0.3, 0.3)


def add_room_detail_pass():
    random.seed(RANDOM_SEED + 404)
    for idx, room in enumerate(ROOMS):
        b = room_bounds(room)
        rid = room["id"]

        add_floor_patch(room, "lane_scrape_a", b["cx"] - 8.8, b["cz"] + 3.5, 4.6, 0.26, "paint_white", yaw=random.uniform(-7, 7), role="worn_lane_marking")
        add_floor_patch(room, "lane_scrape_b", b["cx"] + 8.5, b["cz"] - 5.8, 3.6, 0.22, "paint_cyan", yaw=random.uniform(-8, 8), role="worn_route_marking")
        stain_mat = "water" if room["row"] in (0, 3) else "oil"
        add_floor_patch(room, "irregular_floor_stain_a", b["cx"] + random.uniform(-9, 9), b["cz"] + random.uniform(-11, 11), random.uniform(2.0, 4.8), random.uniform(1.1, 2.6), stain_mat, yaw=random.uniform(-18, 18), role="wet_floor_detail", collision="nonblocking_visual")
        add_floor_patch(room, "irregular_floor_stain_b", b["cx"] + random.uniform(-11, 11), b["cz"] + random.uniform(-12, 12), random.uniform(1.5, 3.4), random.uniform(0.65, 1.6), "oil", yaw=random.uniform(-25, 25), role="oil_wear_detail", collision="nonblocking_visual")

        tray_axis = "X" if idx % 2 == 0 else "Z"
        add_overhead_cable_tray(room, "primary", b["cx"] + (-6 if tray_axis == "Z" else 0), b["cz"] + (7 if tray_axis == "X" else 0), length=24.0, axis=tray_axis)
        add_wall_panel(room, "service_plate_n", "N", -8.0, 1.05, 4.2, 0.82, "wall_dark", "painted_service_plate")
        add_wall_panel(room, "route_strip_s", "S", 7.5, 2.65, 5.4, 0.16, "hazard" if room["zone"] != 1 else "cyan", "overhead_route_strip")

        if rid in ("customs_entry", "security_screening", "alarm_relay", "foreman_catwalk"):
            add_monitor_bank(room, "ops_bank", side="N", offset=0.0, count=4 if rid == "alarm_relay" else 3)
        if rid in ("manifest_office", "foreman_catwalk"):
            add_package_cluster(room, "desk_papers", b["cx"] - 5.0, b["cz"] - 0.5, count=7, spread=5.0, mat_key="paper")
        if rid in ("warehouse_spine", "sortation_hall", "receiving_yard", "container_gate"):
            add_package_cluster(room, "labels_and_wrap", b["cx"] + 3.0, b["cz"] + 4.0, count=6, spread=7.5, mat_key="paper")
        if rid in ("loading_cage", "forklift_repair"):
            add_chain_curtain(room, "service_gate", b["cx"], b["cz"] + 13.5, width=8.5, axis="X", count=11)

        if rid in ("receiving_yard", "container_gate"):
            add_floor_patch(room, "wide_rain_puddle", b["cx"] + 5.5, b["cz"] - 12.5, 7.5, 2.4, "water", yaw=8, role="exterior_rain_puddle", collision="nonblocking_visual")
            for n, off in enumerate([-7.5, 0.0, 7.5]):
                add_wall_panel(room, f"rain_slash_{n}", "N", off, 0.55, 0.12, 4.8, "rain", "exterior_rain_sheet", collision="nonblocking_visual")
            add_detail_label(room, "DOCK 7", "dock7_floor", b["cx"] - 9.0, b["cz"] + 14.0, size=1.0, mat_key="paint_white", yaw=-3)
        elif rid == "customs_entry":
            for x in [-6.0, 0.0, 6.0]:
                add_floor_patch(room, f"queue_tick_{x}", b["cx"] + x, b["cz"] - 10.2, 2.2, 0.18, "paint_white", role="queue_floor_tick")
            add_detail_label(room, "SCAN", "scan_floor", b["cx"], b["cz"] - 13.0, size=0.88, mat_key="paint_cyan")
        elif rid == "forklift_repair":
            add_floor_patch(room, "grease_lane", b["cx"] + 1.0, b["cz"] - 8.0, 10.5, 2.2, "oil", yaw=-4, role="repair_grease_lane", collision="nonblocking_visual")
            for off in [-9.0, 9.0]:
                add_wall_panel(room, f"tool_shadow_{off}", "W", off, 1.0, 3.6, 1.3, "black", "tool_shadow_board")
        elif rid == "intake_court":
            add_chain_curtain(room, "high_dock_slats", b["cx"] - 12.0, b["cz"] + 11.0, width=6.5, axis="Z", count=9)
            add_detail_label(room, "PUSH UP", "push_up", b["cx"] - 10.0, b["cz"] + 15.4, size=0.74, mat_key="hazard", yaw=90)
        elif rid == "security_screening":
            for z in [-10.0, 0.0, 10.0]:
                add_floor_patch(room, f"scanner_glow_{z}", b["cx"] - 1.8, b["cz"] + z, 0.34, 3.8, "paint_cyan", role="scanner_floor_glow")
            add_wall_panel(room, "xray_notice", "E", -8.0, 1.15, 3.0, 0.82, "paper", "security_notice_board")
        elif rid == "manifest_office":
            add_wall_panel(room, "amber_case_board", "W", 0.0, 1.05, 12.0, 1.4, "hazard", "manifest_case_board")
            add_detail_label(room, "HOLD", "hold_floor", b["cx"] + 8.8, b["cz"] + 12.0, size=0.82, mat_key="paint_white", yaw=90)
        elif rid == "warehouse_spine":
            for x in [-10.0, 0.0, 10.0]:
                add_wall_panel(room, f"rack_barcode_{x}", "N", x, 1.15, 2.0, 0.58, "paper", "rack_barcode_panels")
                add_floor_patch(room, f"picker_light_{x}", b["cx"] + x, b["cz"] + 15.0, 1.35, 0.22, "paint_cyan", role="warehouse_picker_light")
        elif rid == "hazmat_barrels":
            add_floor_patch(room, "containment_ring_north", b["cx"], b["cz"] - 4.0, 20.0, 0.24, "red", role="hazmat_containment_paint")
            add_floor_patch(room, "containment_ring_south", b["cx"], b["cz"] + 4.0, 20.0, 0.24, "red", role="hazmat_containment_paint")
            add_wall_panel(room, "hazmat_warning_wall", "E", 0.0, 1.18, 9.0, 1.0, "red", "hazmat_warning_graphic")
            add_detail_label(room, "HAZ", "haz_floor", b["cx"] - 12.0, b["cz"] + 14.0, size=1.05, mat_key="red", yaw=90)
        elif rid == "cold_storage":
            for z in [-13.0, 0.0, 13.0]:
                add_wall_panel(room, f"frost_veil_{z}", "E", z, 0.55, 6.8, 3.2, "steam", "cold_frost_veil", collision="nonblocking_visual")
                add_floor_patch(room, f"ice_sheen_{z}", b["cx"] - 8.0, b["cz"] + z, 4.8, 1.4, "water", yaw=-5, role="cold_ice_sheen", collision="nonblocking_visual")
        elif rid == "alarm_relay":
            for x in [-5.4, 0.0, 5.4]:
                add_wall_panel(room, f"relay_stack_{x}", "S", x, 1.0, 2.4, 2.3, "monitor", "relay_screen_stack")
            add_floor_patch(room, "objective_cable_spill", b["cx"], b["cz"] + 2.0, 8.8, 0.34, "paint_cyan", role="objective_cable_floor_graphic")
        elif rid == "boiler_pump":
            for z in [-10.0, 4.0, 14.0]:
                add_wall_panel(room, f"steam_plume_{z}", "W", z, 0.42, 5.2, 3.6, "steam", "boiler_steam_plume", collision="nonblocking_visual")
            add_floor_patch(room, "rust_runoff", b["cx"] + 8.0, b["cz"] - 2.0, 4.0, 12.0, "oil", yaw=2, role="boiler_rust_runoff", collision="nonblocking_visual")
        elif rid == "loading_cage":
            for x in [-12.0, -4.0, 4.0, 12.0]:
                add_floor_patch(room, f"bar_shadow_{x}", b["cx"] + x, b["cz"] - 2.0, 0.18, 30.0, "black", role="cage_cast_shadow")
            add_detail_label(room, "CAGE", "cage_floor", b["cx"] - 10.5, b["cz"] + 15.5, size=1.0, mat_key="paint_white")
        elif rid == "sortation_hall":
            add_package_cluster(room, "moving_sorter_parcels", b["cx"], b["cz"] + 6.0, count=9, spread=11.0, mat_key="paper")
            for x in [-12.0, 0.0, 12.0]:
                add_wall_panel(room, f"sorter_status_{x}", "N", x, 1.35, 2.7, 0.72, "monitor", "sorter_status_panel")
        elif rid == "foreman_catwalk":
            for x in [-12.0, -4.0, 4.0, 12.0]:
                add_floor_patch(room, f"catwalk_safety_hash_{x}", b["cx"] + x, b["cz"] - 17.0, 1.0, 0.2, "hazard", yaw=22, role="catwalk_safety_hash")
            add_wall_panel(room, "foreman_shift_board", "E", -6.0, 3.45, 6.0, 1.0, "paper", "foreman_shift_board")

    MANIFEST["features"].append({"type": "aaa_visual_detail_pass", "rooms": len(ROOMS)})


def add_fan(room, x, z):
    col = COLLECTIONS["06_lighting_animation"]
    rotor = bpy.data.objects.new(f"fan_rotor_{room['id']}_{x:.1f}_{z:.1f}", None)
    rotor.empty_display_type = "ARROWS"
    rotor.empty_display_size = 1.0
    rotor.location = (x, RH + WT - 0.45, z)
    rotor["animationType"] = "ceiling_fan_loop"
    rotor["roomId"] = room["id"]
    col.objects.link(rotor)
    add_cylinder(f"fan_hub_{room['id']}_{x:.1f}_{z:.1f}", x, RH + WT - 0.45, z, 0.22, 0.16, MATS["steel"], col,
                 {"collision": "decorative_only", "roomId": room["id"]}, axis="Y", vertices=20).parent = rotor
    for i in range(4):
        blade = add_box(f"fan_blade_{room['id']}_{i}_{x:.1f}_{z:.1f}", x + math.cos(i * math.pi / 2) * 0.72, RH + WT - 0.45, z + math.sin(i * math.pi / 2) * 0.72,
                        1.42 if i % 2 == 0 else 0.22, 0.035, 0.22 if i % 2 == 0 else 1.42, MATS["steel_edge"], col,
                        {"collision": "decorative_only", "roomId": room["id"]}, 0.006)
        blade.parent = rotor
    rotor.rotation_euler[1] = 0
    rotor.keyframe_insert(data_path="rotation_euler", frame=1)
    rotor.rotation_euler[1] = math.tau
    rotor.keyframe_insert(data_path="rotation_euler", frame=120)
    MANIFEST["features"].append({"type": "animated_ceiling_fan", "room": room["id"], "x": x, "z": z})


def add_room_shells():
    floor_col = COLLECTIONS["01_floor_and_room_shells"]
    wall_col = COLLECTIONS["02_collision_and_cover"]
    for room in ROOMS:
        b = room_bounds(room)
        floor_mat = MATS["floor_dark"] if room["id"] in ("hazmat_barrels", "boiler_pump", "cold_storage") else MATS["floor"]
        add_box(f"floor_{room['id']}", b["cx"], WT / 2, b["cz"], ROOM_W, WT, ROOM_D, floor_mat, floor_col, {
            "collision": "floor_aabb",
            "floorRegion": True,
            "floorY": WT,
            "roomId": room["id"],
            "geometryId": f"floor_{room['id']}",
            "floorplanRole": "runtime_floor",
        }, 0.0)
        add_box(f"ceiling_grid_{room['id']}", b["cx"], RH + WT + 0.04, b["cz"], ROOM_W - 1.0, 0.08, ROOM_D - 1.0, MATS["steel"], floor_col,
                {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "ceiling_grid"}, 0.006)
        for off in [-14, 0, 14]:
            add_box(f"overhead_beam_{room['id']}_{off}", b["cx"], RH + WT - 0.32, b["cz"] + off, ROOM_W - 2.0, 0.18, 0.18, MATS["steel_edge"], floor_col,
                    {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "ceiling_beam"}, 0.006)
        marker_empty(f"ROOM_ANCHOR_{room['id']}", b["cx"], b["cz"], {
            "markerType": "room_anchor",
            "roomId": room["id"],
            "roomName": room["name"],
            "zoneId": int(room["zone"]),
            "encounterType": room["encounter"],
            "mood": room["mood"],
            "bounds": json.dumps({"x0": b["x0"], "x1": b["x1"], "z0": b["z0"], "z1": b["z1"]}),
        })
        add_floor_label(room["name"].upper(), b["cx"], b["cz"] + ROOM_D * 0.34, 0.95)
        MANIFEST["rooms"].append({**room, "bounds": {k: b[k] for k in ("x0", "x1", "z0", "z1")}})
        if room["encounter"] not in MANIFEST["encounterTypes"]:
            MANIFEST["encounterTypes"].append(room["encounter"])

    # Grid walls with intentional oversized door cuts.
    for z in [Z_MAX, Z_MIN]:
        wall_x(wall_col, f"outer_wall_z_{z:.1f}", z, X_MIN, X_MAX, "perimeter", f"outer_wall_z_{z:.1f}", door=(0, 11.0 if z == Z_MAX else 9.0), mat_key="wall_dark" if z == Z_MIN else "wall")
    for x in [X_MIN, X_MAX]:
        wall_z(wall_col, f"outer_wall_x_{x:.1f}", x, Z_MIN, Z_MAX, "perimeter", f"outer_wall_x_{x:.1f}", door=(-44, 9.0), mat_key="wall")
    for x in [-19.0, 19.0]:
        for row, zc in enumerate(ROWS):
            wall_z(wall_col, f"internal_x_{x:.1f}_row_{row}", x, zc - ROOM_D / 2, zc + ROOM_D / 2, f"row_{row}", f"internal_x_{x:.1f}_row_{row}", door=(zc, 8.2), role="room_connector_wall")
            add_box(f"door_frame_x_{x:.1f}_row_{row}", x, WT + 2.85, zc, 0.22, 0.18, 8.7, MATS["hazard"], wall_col,
                    {"collision": "decorative_only", "floorplanRole": "door_header", "gateId": f"x_{x}_{row}"}, 0.006)
    for z in [66.0, 22.0, -22.0, -66.0]:
        for col_idx, xc in enumerate(COLS):
            wall_x(wall_col, f"internal_z_{z:.1f}_col_{col_idx}", z, xc - ROOM_W / 2, xc + ROOM_W / 2, f"col_{col_idx}", f"internal_z_{z:.1f}_col_{col_idx}", door=(xc, 8.5), role="zone_threshold_wall")
            add_box(f"rollup_header_z_{z:.1f}_col_{col_idx}", xc, WT + 3.0, z, 8.8, 0.18, 0.22, MATS["hazard"], wall_col,
                    {"collision": "decorative_only", "floorplanRole": "rollup_gate_header", "gateId": f"z_{z}_{col_idx}"}, 0.006)
            if z in (22.0, -22.0):
                zone_door_index = 0 if z > 0 else 1
                gate_id = f"mega_zone_gate_{z}_{col_idx}"
                gate_z = z + (0.36 if z > 0 else -0.36)
                add_box(
                    f"heavy_gate_slab_z_{z:.1f}_col_{col_idx}",
                    xc,
                    WT + 1.65,
                    gate_z,
                    9.6,
                    2.45,
                    0.22,
                    MATS["steel"],
                    wall_col,
                    {
                        "collision": "wall_aabb",
                        "floorplanRole": "closed_zone_gate",
                        "gateId": gate_id,
                        "zoneDoorIndex": zone_door_index,
                        "roomId": f"clearance_gate_{zone_door_index}",
                    },
                    0.018,
                )
                for sx in [-0.33, 0.33]:
                    add_box(
                        f"heavy_gate_warning_stripe_z_{z:.1f}_col_{col_idx}_{sx:+.2f}",
                        xc + sx * 9.6,
                        WT + 1.65,
                        gate_z + (0.015 if z > 0 else -0.015),
                        0.18,
                        2.12,
                        0.05,
                        MATS["red"],
                        wall_col,
                        {
                            "collision": "decorative_only",
                            "floorplanRole": "closed_zone_gate_stripe",
                            "gateId": gate_id,
                            "zoneDoorIndex": zone_door_index,
                            "roomId": f"clearance_gate_{zone_door_index}",
                        },
                        0.006,
                    )
                add_box(
                    f"heavy_gate_clearance_header_z_{z:.1f}_col_{col_idx}",
                    xc,
                    WT + 2.98,
                    gate_z + (0.02 if z > 0 else -0.02),
                    8.4,
                    0.20,
                    0.06,
                    MATS["hazard"],
                    wall_col,
                    {
                        "collision": "decorative_only",
                        "floorplanRole": "closed_zone_gate_header",
                        "gateId": gate_id,
                        "zoneDoorIndex": zone_door_index,
                        "roomId": f"clearance_gate_{zone_door_index}",
                    },
                    0.006,
                )


def populate_rooms():
    random.seed(RANDOM_SEED)
    for room in ROOMS:
        b = room_bounds(room)
        rid = room["id"]
        if rid == "receiving_yard":
            for z in [b["cz"] - 10, b["cz"] + 5, b["cz"] + 14]:
                add_container(room, b["cx"] - 7, z, high=z > b["cz"])
            add_forklift(room, b["cx"] + 7, b["cz"] - 7)
            add_pallet_stack(room, b["cx"] + 7, b["cz"] + 8, rows=4, cols=3)
        elif rid == "customs_entry":
            add_box("customs_security_desk", b["cx"], WT + 0.55, b["cz"] + 4, 8.5, 1.1, 1.35, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                    {"collision": "cover_aabb", "roomId": rid, "geometryId": "customs_security_desk", "floorplanRole": "entry_cover"}, 0.025)
            for x in [-5, 5]:
                add_box(f"customs_scanner_arch_{x}", b["cx"] + x, WT + 1.55, b["cz"] - 8, 1.1, 2.8, 0.35, MATS["cyan"], COLLECTIONS["05_props_barrels_crates_machinery"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "scanner_arch", "arcing": True}, 0.025)
            add_window("customs_office_glass", b["cx"] - 12.0, b["cz"] + 1.0, 8.0, "Z", rid, "entry_to_manifest_preview", warm=True)
        elif rid == "container_gate":
            for x in [b["cx"] - 7, b["cx"] + 7]:
                for z in [b["cz"] - 12, b["cz"], b["cz"] + 12]:
                    add_container(room, x, z, sx=4.4, sz=2.2, color_key="steel" if x < b["cx"] else "wall_dark", high=z == b["cz"])
        elif rid == "forklift_repair":
            add_forklift(room, b["cx"] - 6, b["cz"] + 6)
            add_forklift(room, b["cx"] + 6, b["cz"] - 8)
            add_pipe_run(room, b["cx"], b["cz"] - 14, length=24, axis="X", arcing=True)
            for x in [b["cx"] - 12, b["cx"], b["cx"] + 12]:
                add_pallet_stack(room, x, b["cz"] + 14, rows=2, cols=2)
        elif rid == "intake_court":
            for x in [-10, 10]:
                add_box(f"intake_low_cover_{x}", b["cx"] + x, WT + 0.48, b["cz"] - 3, 6.0, 0.96, 1.25, MATS["wood"], COLLECTIONS["02_collision_and_cover"],
                        {"collision": "cover_aabb", "roomId": rid, "geometryId": f"intake_low_cover_{x}", "floorplanRole": "player_cover"}, 0.02)
            add_window("intake_high_window_w", b["cx"] - 18.7, b["cz"] + 7, 8.0, "Z", rid, "west_to_intake_crossview")
            add_window("intake_high_window_e", b["cx"] + 18.7, b["cz"] - 7, 8.0, "Z", rid, "east_to_intake_crossview")
        elif rid == "security_screening":
            add_conveyor(room, b["cx"], b["cz"], length=20, axis="Z")
            add_window("security_glass_wall", b["cx"] - 10, b["cz"] + 14, 10.0, "X", rid, "screening_overwatch", warm=False)
            for z in [b["cz"] - 10, b["cz"], b["cz"] + 10]:
                add_box(f"security_turnstile_{z}", b["cx"] + 8, WT + 0.7, z, 1.0, 1.4, 1.8, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "turnstile_cover"}, 0.02)
        elif rid == "manifest_office":
            add_window("manifest_long_glass", b["cx"] + 17.8, b["cz"], 18.0, "Z", rid, "office_to_warehouse", warm=True)
            for z in [b["cz"] - 11, b["cz"], b["cz"] + 11]:
                add_box(f"manifest_desk_{z}", b["cx"] - 5, WT + 0.55, z, 5.5, 1.1, 1.3, MATS["wood"], COLLECTIONS["02_collision_and_cover"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "desk_cover"}, 0.02)
        elif rid == "warehouse_spine":
            for x in [b["cx"] - 10, b["cx"], b["cx"] + 10]:
                add_rack(room, x, b["cz"], length=29, axis="Z")
            add_conveyor(room, b["cx"], b["cz"] - 15, length=26, axis="X")
        elif rid == "hazmat_barrels":
            for x in [-10, -5, 0, 5, 10]:
                for z in [-12, -6, 2, 10]:
                    if random.random() < 0.72:
                        add_barrel(room, b["cx"] + x + random.uniform(-0.5, 0.5), b["cz"] + z + random.uniform(-0.5, 0.5), explosive=True)
            add_box("hazmat_spill_pool", b["cx"], WT + 0.025, b["cz"] - 4, 18, 0.03, 10, MATS["red"], COLLECTIONS["05_props_barrels_crates_machinery"],
                    {"collision": "decorative_only", "roomId": rid, "floorplanRole": "hazard_spill"}, 0.01)
        elif rid == "cold_storage":
            for x in [b["cx"] - 10, b["cx"], b["cx"] + 10]:
                add_rack(room, x, b["cz"], length=30, axis="Z")
            for z in [b["cz"] - 12, b["cz"], b["cz"] + 12]:
                add_box(f"cold_vapor_sheet_{z}", b["cx"] + 17.2, WT + 1.7, z, 0.08, 2.5, 8.0, MATS["glass"], COLLECTIONS["05_props_barrels_crates_machinery"],
                        {"collision": "nonblocking_visual", "roomId": rid, "floorplanRole": "cold_vapor_sheet"}, 0.004)
        elif rid == "alarm_relay":
            add_box("alarm_relay_console", b["cx"], WT + 0.82, b["cz"] + 3.0, 7.0, 1.64, 2.1, MATS["cyan"], COLLECTIONS["02_collision_and_cover"],
                    {"collision": "cover_aabb", "roomId": rid, "geometryId": "alarm_panel", "floorplanRole": "objective_console", "arcing": True}, 0.03)
            add_window("alarm_control_glass_n", b["cx"], b["cz"] + 17.8, 14.0, "X", rid, "relay_north_preview", warm=True)
            add_window("alarm_control_glass_e", b["cx"] + 17.8, b["cz"], 18.0, "Z", rid, "relay_to_boiler_preview", warm=True)
        elif rid == "boiler_pump":
            for z in [b["cz"] - 14, b["cz"] - 5, b["cz"] + 5, b["cz"] + 14]:
                add_pipe_run(room, b["cx"], z, length=30, axis="X", arcing=z == b["cz"] - 5)
            for x in [b["cx"] - 9, b["cx"] + 9]:
                add_cylinder(f"boiler_tank_{x}", x, WT + 1.35, b["cz"], 1.0, 4.5, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                             {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "boiler_tank"}, axis="Y", vertices=28)
            add_fan(room, b["cx"] + 13, b["cz"] + 13)
        elif rid == "loading_cage":
            for x in [b["cx"] - 12, b["cx"] - 4, b["cx"] + 4, b["cx"] + 12]:
                add_box(f"cage_vertical_bar_{x}", x, WT + 2.2, b["cz"], 0.16, 3.6, ROOM_D - 8, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "cage_bar"}, 0.008)
            for z in [b["cz"] - 12, b["cz"], b["cz"] + 12]:
                add_box(f"cage_center_cover_{z}", b["cx"], WT + 0.72, z, 8.0, 1.44, 1.4, MATS["steel"], COLLECTIONS["02_collision_and_cover"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "cage_center_cover"}, 0.025)
        elif rid == "sortation_hall":
            add_conveyor(room, b["cx"], b["cz"] + 6, length=30, axis="X")
            add_conveyor(room, b["cx"], b["cz"] - 8, length=30, axis="X")
            for x in [b["cx"] - 12, b["cx"], b["cx"] + 12]:
                add_pallet_stack(room, x, b["cz"] + 15, rows=3, cols=2)
        elif rid == "foreman_catwalk":
            # Elevated office/catwalk region. Runtime patch can read floorRegion/floorY.
            add_box("foreman_catwalk_floor", b["cx"], WT + 3.22, b["cz"], ROOM_W - 4, 0.18, ROOM_D - 10, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                    {"collision": "floor_aabb", "floorRegion": True, "floorY": 3.32, "roomId": rid, "floorplanRole": "catwalk_floor"}, 0.015)
            add_window("foreman_office_glass_w", b["cx"] - 17.8, b["cz"], 24.0, "Z", rid, "catwalk_to_sortation", warm=True, sill=3.65, head=5.3)
            add_window("foreman_office_glass_s", b["cx"], b["cz"] - 17.6, 18.0, "X", rid, "catwalk_to_exit", warm=True, sill=3.65, head=5.3)
            add_box("foreman_desk_overlook", b["cx"] - 4, WT + 3.95, b["cz"] - 8, 6.0, 1.1, 1.4, MATS["wood"], COLLECTIONS["02_collision_and_cover"],
                    {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "sniper_overlook_cover"}, 0.025)
            add_fan(room, b["cx"] + 10, b["cz"] + 10)


def add_lighting_and_animation():
    col = COLLECTIONS["06_lighting_animation"]
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.015, 0.018, 0.025)
    sun_data = bpy.data.lights.new("B01_megaplex_soft_moon_key", "SUN")
    sun_data.energy = 1.2
    sun = bpy.data.objects.new("B01_megaplex_soft_moon_key", sun_data)
    sun.rotation_euler = (math.radians(45), 0, math.radians(-25))
    col.objects.link(sun)
    for room in ROOMS:
        b = room_bounds(room)
        color = (1.0, 0.62, 0.24)
        energy = 250
        if "cold" in room["mood"] or room["id"] == "cold_storage":
            color, energy = (0.35, 0.70, 1.0), 300
        if "cyan" in room["mood"] or room["id"] in ("alarm_relay", "security_screening"):
            color, energy = (0.08, 0.92, 0.78), 320
        if "red" in room["mood"] or room["id"] == "hazmat_barrels":
            color, energy = (1.0, 0.08, 0.03), 260
        light_data = bpy.data.lights.new(f"light_{room['id']}", "POINT")
        light_data.color = color
        light_data.energy = energy
        light_data.shadow_soft_size = 7.0
        obj = bpy.data.objects.new(f"light_{room['id']}", light_data)
        obj.location = (b["cx"], RH + WT - 1.0, b["cz"])
        obj["roomId"] = room["id"]
        obj["lightingMood"] = room["mood"]
        col.objects.link(obj)
        # Animated alarm beacon in high-pressure rooms.
        if room["id"] in ("hazmat_barrels", "alarm_relay", "boiler_pump", "sortation_hall"):
            beacon = add_cylinder(f"alarm_beacon_{room['id']}", b["cx"] + 13, WT + 2.5, b["cz"] - 13, 0.38, 0.32, MATS["red"], col,
                                  {"collision": "decorative_only", "roomId": room["id"], "animationType": "alarm_beacon_spin"}, axis="Y", vertices=24)
            beacon.rotation_euler[1] = 0
            beacon.keyframe_insert(data_path="rotation_euler", frame=1)
            beacon.rotation_euler[1] = math.tau
            beacon.keyframe_insert(data_path="rotation_euler", frame=80)


def add_encounters():
    role_sets = {
        "patrol_forklift_ambush": [("patrol", -10, 8, "scout", "patrol_lane"), ("anchor", 7, -7, "soldier", "hold_angle"), ("flanker", 11, 9, "pistolero", "flank_after_contact"), ("breacher", -4, -12, "heavy", "rush_when_player_reloads")],
        "lookout_peek_tutorial": [("lookout", -7, -8, "scout", "peek_from_cover"), ("anchor", 0, 4, "soldier", "hold_angle"), ("flanker", 9, -12, "pistolero", "flank_after_contact"), ("runner", -10, 12, "scout", "retreat_to_next_room")],
        "crossfire_container_rows": [("lookout", -9, 10, "scout", "peek_from_cover"), ("anchor", 9, -7, "soldier", "suppress_lane"), ("sniper", 5, 13, "sniper", "overwatch_catwalk"), ("flanker", -11, -13, "pistolero", "flank_after_contact")],
        "breacher_rollup_door": [("breacher", -11, -12, "heavy", "ambush_on_crossing"), ("anchor", 8, 10, "soldier", "hold_angle"), ("flanker", 11, -2, "pistolero", "flank_after_contact"), ("demolitions", -1, 13, "demolitions", "grenade_flush_cover")],
        "multi_angle_first_room": [("lookout", -12, 10, "scout", "peek_from_cover"), ("anchor", 0, -5, "soldier", "hold_angle"), ("flanker", 12, 9, "pistolero", "flank_after_contact"), ("shield", -9, -13, "shielded", "riot_screen_push")],
        "window_overwatch": [("anchor", 0, -8, "soldier", "hold_angle"), ("sniper", -12, 12, "marksman", "sniper_relocate"), ("drone", 9, 10, "drone", "overwatch_catwalk"), ("flanker", 10, -12, "pistolero", "flank_after_contact")],
        "alarm_hold_manifest": [("anchor", -6, 3, "soldier", "guard_objective"), ("lookout", 9, 10, "scout", "peek_from_cover"), ("breacher", 8, -13, "heavy", "ambush_on_crossing"), ("runner", -11, -10, "pistolero", "retreat_to_next_room")],
        "suppression_lane": [("anchor", -10, 0, "heavy", "suppress_lane"), ("anchor", 10, -8, "soldier", "hold_angle"), ("flanker", 12, 12, "pistolero", "flank_after_contact"), ("demolitions", -11, -13, "demolitions", "grenade_flush_cover")],
        "barrel_flush_trap": [("demolitions", -7, -10, "demolitions", "grenade_flush_cover"), ("anchor", 8, 8, "soldier", "hold_angle"), ("flanker", 11, -12, "pistolero", "flank_after_contact"), ("lookout", -10, 12, "scout", "peek_from_cover")],
        "thermal_stealth_patrol": [("patrol", -8, 11, "scout", "patrol_lane"), ("anchor", 8, 0, "soldier", "hold_angle"), ("flanker", 10, -11, "pistolero", "flank_after_contact"), ("sniper", -11, -10, "marksman", "sniper_relocate")],
        "objective_hold_reinforce": [("anchor", 0, 4, "heavy", "guard_objective"), ("demolitions", -9, -10, "demolitions", "grenade_flush_cover"), ("shield", 10, 9, "shielded", "riot_screen_push"), ("drone", 11, -12, "drone", "overwatch_catwalk")],
        "demolition_pipe_pressure": [("demolitions", -10, 12, "demolitions", "grenade_flush_cover"), ("anchor", 8, -8, "heavy", "hold_angle"), ("flanker", -12, -10, "pistolero", "flank_after_contact"), ("drone", 10, 10, "drone", "overwatch_catwalk")],
        "shield_push_cage": [("shield", -9, 6, "shielded", "riot_screen_push"), ("anchor", 8, -7, "heavy", "hold_angle"), ("flanker", 11, 11, "pistolero", "flank_after_contact"), ("sniper", -12, -12, "marksman", "overwatch_catwalk")],
        "final_multiwave_sorter": [("anchor", 0, -6, "heavy", "suppress_lane"), ("demolitions", -12, 11, "demolitions", "grenade_flush_cover"), ("drone", 12, 12, "drone", "overwatch_catwalk"), ("breacher", 10, -12, "heavy", "rush_when_player_reloads"), ("flanker", -10, -13, "pistolero", "flank_after_contact")],
        "sniper_catwalk_relocate": [("sniper", -8, 6, "marksman", "sniper_relocate"), ("anchor", 5, -7, "soldier", "hold_angle"), ("drone", 11, 9, "drone", "overwatch_catwalk"), ("flanker", -11, -12, "pistolero", "flank_after_contact")],
    }
    for room in ROOMS:
        for spec in role_sets[room["encounter"]]:
            enemy_marker(room, *spec)
        # A second wave marker for high-intensity spaces.
        if room["zone"] >= 1:
            enemy_marker(room, "breacher", -4, 15, "heavy", "ambush_on_crossing", wave="reinforce")
    # Spawn doors for reinforcement reads.
    for idx, (x, z, zone, label) in enumerate([
        (-58, 44, 0, "west_rollup"), (58, 44, 0, "east_rollup"), (-58, -44, 1, "cold_service"), (58, -44, 1, "boiler_service"), (0, -109, 2, "final_exit_reversal")
    ]):
        marker_empty(f"SPAWN_DOOR_{label}", x, z, {"markerType": "spawn_door", "zoneId": zone, "doorId": label, "entry": label}, y=WT + 0.2)


def add_route_language():
    col = COLLECTIONS["07_labels_and_route_language"]
    for z in [96, 72, 48, 24, 0, -24, -48, -72, -96]:
        add_box(f"center_route_stripe_{z}", 0, WT + 0.025, z, 3.2, 0.03, 8.5, MATS["hazard"], col,
                {"collision": "decorative_only", "floorplanRole": "route_language"}, 0.004)
    for x in [-38, 38]:
        add_box(f"side_route_stripe_{x}", x, WT + 0.026, -10, 2.3, 0.03, 130, MATS["cyan"], col,
                {"collision": "decorative_only", "floorplanRole": "side_route_language"}, 0.004)
    add_floor_label("ZONE 0 RECEIVING / SCREENING", 0, 102, 1.2)
    add_floor_label("ZONE 1 MANIFEST / HAZMAT / RELAY", 0, 10, 1.2)
    add_floor_label("ZONE 2 CAGE / SORTATION / CATWALK", 0, -100, 1.2)


def add_connections_to_manifest():
    # Grid adjacency. Integrators can turn this into room gates later.
    by_id = {r["id"]: r for r in ROOMS}
    for a in ROOMS:
        for b in ROOMS:
            if a["id"] >= b["id"]:
                continue
            same_row = a["row"] == b["row"] and abs(a["col"] - b["col"]) == 1
            same_col = a["col"] == b["col"] and abs(a["row"] - b["row"]) == 1
            if same_row or same_col:
                MANIFEST["connections"].append({"from": a["id"], "to": b["id"], "type": "door" if same_row else "rollup_threshold"})
    assert by_id["customs_entry"]["zone"] == 0


def configure_animation_curves():
    for action in bpy.data.actions:
        for curve in getattr(action, "fcurves", []) or []:
            for kp in curve.keyframe_points:
                kp.interpolation = "LINEAR"


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(camera_name, path, resolution=(1600, 1100)):
    bpy.context.scene.camera = bpy.data.objects[camera_name]
    bpy.context.scene.render.filepath = path
    bpy.context.scene.render.resolution_x = resolution[0]
    bpy.context.scene.render.resolution_y = resolution[1]
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as exc:
        print(f"[preview render skipped] {path}: {exc}")


def render_topdown_preview(path):
    hidden = []
    for obj in bpy.context.scene.objects:
        role = obj.get("floorplanRole", "")
        if "ceiling" in str(role):
            hidden.append((obj, obj.hide_render))
            obj.hide_render = True
    render_preview("B01_megaplex_topdown_camera", path, (1800, 1200))
    for obj, was_hidden in hidden:
        obj.hide_render = was_hidden


def add_cameras():
    col = COLLECTIONS["08_cameras_preview"]
    top_data = bpy.data.cameras.new("B01_megaplex_topdown_camera")
    top = bpy.data.objects.new("B01_megaplex_topdown_camera", top_data)
    top.location = (0, 260, 0)
    look_at(top, (0, 0, 0))
    top.data.type = "ORTHO"
    top.data.ortho_scale = 235
    top.data.clip_end = 600
    col.objects.link(top)
    beauty_data = bpy.data.cameras.new("B01_megaplex_entry_beauty_camera")
    beauty = bpy.data.objects.new("B01_megaplex_entry_beauty_camera", beauty_data)
    beauty.location = (0, WT + 2.1, Z_MAX - 8)
    beauty.data.lens = 20
    beauty.data.clip_end = 500
    look_at(beauty, (0, WT + 1.7, 45))
    col.objects.link(beauty)
    bpy.context.scene.camera = beauty


def set_render_engine():
    engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    if "BLENDER_EEVEE_NEXT" in engines:
        bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    elif "BLENDER_EEVEE" in engines:
        bpy.context.scene.render.engine = "BLENDER_EEVEE"
    else:
        bpy.context.scene.render.engine = "CYCLES"
        bpy.context.scene.cycles.samples = 32
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 180


def build():
    clear_scene()
    setup_materials()
    bpy.context.scene.name = "B01_MEGAPLEX_LEVEL_ONE_SCENE"
    bpy.context.scene.unit_settings.system = "METRIC"
    set_render_engine()

    root = collection("B01_MEGAPLEX_LEVEL_ONE_MAP")
    for name in [
        "01_floor_and_room_shells",
        "02_collision_and_cover",
        "03_windows_and_breakables",
        "04_encounter_markers",
        "05_props_barrels_crates_machinery",
        "06_AAA_visual_detail",
        "06_lighting_animation",
        "07_labels_and_route_language",
        "08_cameras_preview",
    ]:
        collection(name, root)

    add_room_shells()
    populate_rooms()
    add_room_detail_pass()
    add_lighting_and_animation()
    add_route_language()
    add_encounters()
    player_spawn_marker()
    exit_marker()
    add_connections_to_manifest()
    add_cameras()
    configure_animation_curves()

    os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
    with open(LAYOUT_OUT, "w", encoding="utf-8") as fh:
        json.dump(MANIFEST, fh, indent=2)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUT,
        export_format="GLB",
        use_selection=False,
        export_extras=True,
        export_lights=True,
        export_animations=True,
        export_apply=True,
    )

    # Render two quick proofs from Blender itself. If this fails in a headless
    # build, the .blend and .glb are still the primary deliverables.
    render_topdown_preview(TOPDOWN_OUT)
    render_preview("B01_megaplex_entry_beauty_camera", BEAUTY_OUT, (1400, 900))

    mesh_count = sum(1 for obj in bpy.context.scene.objects if obj.type == "MESH")
    empty_count = sum(1 for obj in bpy.context.scene.objects if obj.type == "EMPTY")
    return {
        "blend": BLEND_OUT,
        "glb": GLB_OUT,
        "layout": LAYOUT_OUT,
        "topdown": TOPDOWN_OUT,
        "beauty": BEAUTY_OUT,
        "mesh_count": mesh_count,
        "empty_count": empty_count,
        "room_count": len(ROOMS),
        "bounds": {"x0": X_MIN, "x1": X_MAX, "z0": Z_MIN, "z1": Z_MAX},
        "encounter_types": MANIFEST["encounterTypes"],
        "enemy_markers": len([m for m in MANIFEST["markers"] if m["type"] == "enemy_spawn"]),
        "hazards": len(MANIFEST["hazards"]),
        "features": len(MANIFEST["features"]),
    }


result = build()
