import json
import math
import os
import random
import shutil
import tempfile
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
DESIGNER_OVERLAY_COLLECTION = "10_designer_overlay_manual_edits"
DESIGNER_KIT_COLLECTION = "11_designer_overlay_kit_templates"


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

SIDE_WEAVE_CONNECTORS = {
    # These are deliberate same-row lane weaves: enter a side room through one
    # cut, clear a short off-axis corner, then re-enter the main spine before
    # the next phase threshold.
    ("intake_court", "east"): {"sideRoom": "security_screening", "doorOffsets": (17.0, -8.0), "mid": 1.5},
    ("warehouse_spine", "west"): {"sideRoom": "manifest_office", "doorOffsets": (19.0, -8.0), "mid": 2.0},
    ("alarm_relay", "east"): {"sideRoom": "boiler_pump", "doorOffsets": (9.0, -11.0), "mid": -1.0},
    ("sortation_hall", "west"): {"sideRoom": "loading_cage", "doorOffsets": (10.0, -10.0), "mid": 0.0},
}

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
        if parent and parent.children.get(name) is None:
            parent.children.link(col)
        elif parent is None and bpy.context.scene.collection.children.get(name) is None:
            bpy.context.scene.collection.children.link(col)
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


def wall_z_multi(col, name, x, z0, z1, room_id, geometry_id, doors, mat_key="wall", role="room_shell"):
    cuts = sorted((center - width / 2, center + width / 2) for center, width in doors)
    segments = []
    cursor = z0
    for lo, hi in cuts:
        lo = max(z0, lo)
        hi = min(z1, hi)
        if lo - cursor > 0.35:
            segments.append((cursor, lo))
        cursor = max(cursor, hi)
    if z1 - cursor > 0.35:
        segments.append((cursor, z1))
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


def append_existing_designer_overlay(root):
    overlay_col = None
    if os.path.exists(BLEND_OUT):
        temp_blend = None
        try:
            # Read from a throwaway copy so Blender does not mark the output
            # .blend as an active library and then refuse to overwrite it.
            with tempfile.NamedTemporaryFile(prefix="b01_overlay_source_", suffix=".blend", delete=False) as tmp:
                temp_blend = tmp.name
            shutil.copy2(BLEND_OUT, temp_blend)
            with bpy.data.libraries.load(temp_blend, link=False) as (data_from, data_to):
                if DESIGNER_OVERLAY_COLLECTION in data_from.collections:
                    data_to.collections = [DESIGNER_OVERLAY_COLLECTION]
            loaded_collections = [col for col in data_to.collections if col]
            overlay_col = loaded_collections[0] if loaded_collections else None
        except Exception as exc:
            print(f"[designer overlay skipped] could not load existing overlay: {exc}")
        finally:
            if temp_blend and os.path.exists(temp_blend):
                try:
                    os.remove(temp_blend)
                except OSError:
                    pass

    if overlay_col is None:
        overlay_col = collection(DESIGNER_OVERLAY_COLLECTION, root)
    else:
        overlay_col.name = DESIGNER_OVERLAY_COLLECTION
        if root.children.get(overlay_col.name) is None:
            root.children.link(overlay_col)
        COLLECTIONS[DESIGNER_OVERLAY_COLLECTION] = overlay_col

    normalize_designer_overlay(overlay_col)
    return overlay_col


def collection_objects_recursive(col):
    if not col:
        return []
    out = []
    seen = set()

    def visit(c):
        for obj in c.objects:
            key = obj.as_pointer()
            if key not in seen:
                seen.add(key)
                out.append(obj)
        for child in c.children:
            visit(child)

    visit(col)
    return out


def normalize_designer_overlay(overlay_col):
    if not overlay_col:
        return
    for obj in collection_objects_recursive(overlay_col):
        was_template = bool(obj.get("designerTemplate"))
        if was_template:
            obj["designerTemplate"] = False
        obj["layoutPass"] = "designer_overlay"
        obj["designerOverlay"] = True
        if not obj.get("roomId"):
            obj["roomId"] = "designer_overlay"
        if was_template or not obj.get("geometryId") or str(obj.get("geometryId")).startswith("designer_template_"):
            obj["geometryId"] = obj.name
        if obj.type == "MESH" and not obj.get("collision") and not obj.get("markerType"):
            obj["collision"] = "decorative_only"
        if obj.get("collision") in ("wall_aabb", "cover_aabb") and not obj.get("floorplanRole"):
            obj["floorplanRole"] = "designer_overlay_wall" if obj.get("collision") == "wall_aabb" else "designer_overlay_cover"


def register_designer_overlay_manifest(overlay_col):
    if not overlay_col:
        return
    features = 0
    enemy_markers = 0
    for obj in collection_objects_recursive(overlay_col):
        collision = obj.get("collision")
        marker_type = obj.get("markerType")
        if collision in ("wall_aabb", "cover_aabb"):
            features += 1
            MANIFEST["features"].append({
                "type": obj.get("floorplanRole") or "designer_overlay_geometry",
                "room": obj.get("roomId") or "designer_overlay",
                "x": float(obj.location.x),
                "z": float(obj.location.z),
                "source": "designer_overlay",
            })
        if marker_type == "enemy_spawn":
            enemy_markers += 1
            z = float(obj.location.z)
            zone = 0 if z > 22.0 else 1 if z >= -22.0 else 2
            MANIFEST["markers"].append({
                "type": "enemy_spawn",
                "room": obj.get("roomId") or "designer_overlay",
                "zone": zone,
                "role": obj.get("enemyRole") or "lookout",
                "enemyType": obj.get("enemyType") or "scout",
                "behavior": obj.get("encounterBehavior") or "peek_from_cover",
                "x": float(obj.location.x),
                "z": z,
                "wave": obj.get("spawnWave") or "designer_overlay",
            })
    MANIFEST["features"].append({
        "type": "designer_overlay_manual_edits",
        "geometryObjects": features,
        "enemyMarkers": enemy_markers,
        "summary": "Hand-authored Blender overlay collection preserved across generator rebuilds and exported when runtime collision/marker props are present.",
    })


def designer_template_props(kind, collision, role, module=None, part=None, extra=None):
    props = {
        "designerTemplate": True,
        "designerKitType": kind,
        "collision": collision,
        "roomId": "designer_overlay",
        "geometryId": f"designer_template_{kind}",
        "floorplanRole": role,
        "layoutPass": "designer_overlay_kit",
    }
    if module:
        props["designerKitModule"] = module
    if part:
        props["designerKitPart"] = part
    if extra:
        props.update(extra)
    return props


def clear_child_collections(col):
    if not col:
        return
    for child in list(col.children):
        clear_child_collections(child)
        col.children.unlink(child)
        if child.users == 0:
            bpy.data.collections.remove(child)


def link_object_only_to_collection(obj, target_col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    target_col.objects.link(obj)
    return obj


def add_kit_label(col, text, x, z, size=0.58):
    label = add_floor_label(text, x, z, size)
    label = link_object_only_to_collection(label, col)
    label["designerTemplate"] = True
    label["collision"] = "decorative_only"
    label["layoutPass"] = "designer_overlay_kit"
    label["floorplanRole"] = "designer_kit_label"
    return label


def kit_subcollection(parent, name):
    return collection(name, parent)


def add_kit_box(col, name, x, z, sx, sy, sz, mat_key, kind, collision, role, y=None, module=None, part=None, extra=None, bevel_width=0.016):
    obj = add_box(
        name,
        x,
        WT + sy / 2 if y is None else y,
        z,
        sx,
        sy,
        sz,
        MATS[mat_key],
        col,
        designer_template_props(kind, collision, role, module=module, part=part, extra=extra),
        bevel_width,
    )
    return obj


def add_kit_wall(col, name, x, z, sx, sz, module, part, mat_key="wall_dark", role="designer_overlay_wall"):
    return add_kit_box(col, name, x, z, sx, RH, sz, mat_key, part, "wall_aabb", role, module=module, part=part, bevel_width=0.018)


def add_kit_cover(col, name, x, z, sx, sz, module, part, height=0.96, mat_key="steel", role="designer_overlay_cover"):
    return add_kit_box(col, name, x, z, sx, height, sz, mat_key, part, "cover_aabb", role, module=module, part=part, bevel_width=0.02)


def add_kit_floor_mark(col, name, x, z, sx, sz, module, part, mat_key="paint_cyan", role="designer_overlay_route_read"):
    return add_kit_box(col, name, x, z, sx, 0.035, sz, mat_key, part, "decorative_only", role, y=WT + 0.052, module=module, part=part, bevel_width=0.002)


def add_kit_glass(col, name, x, z, sx, sz, module, part, orientation="X", warm=False):
    if orientation == "X":
        dims = (sx, 1.65, 0.08)
    else:
        dims = (0.08, 1.65, sz)
    return add_kit_box(
        col,
        name,
        x,
        z,
        dims[0],
        dims[1],
        dims[2],
        "glass_warm" if warm else "glass",
        part,
        "transparent_window_aabb",
        "designer_overlay_breakable_window",
        y=WT + 1.55,
        module=module,
        part=part,
        extra={"glassPane": True, "breakable": True, "breakSound": "glass"},
        bevel_width=0.004,
    )


def add_kit_enemy_marker(col, name, x, z, module, part, role, enemy_type, behavior, mat_key):
    props = designer_template_props(
        part,
        "decorative_only",
        "designer_overlay_enemy_marker",
        module=module,
        part=part,
        extra={
            "markerType": "enemy_spawn",
            "zoneId": 0,
            "encounterId": "designer_overlay",
            "encounterType": "designer_overlay",
            "enemyRole": role,
            "enemyType": enemy_type,
            "encounterBehavior": behavior,
            "spawnWave": "designer_overlay",
            "markerVisual": role,
        },
    )
    return add_cylinder(name, x, WT + 0.05, z, 0.55, 0.05, MATS[mat_key], col, props, axis="Y", vertices=20)


def add_kit_direction_arrow(col, name, x, z, module, yaw_degrees=0.0, mat_key="hazard"):
    base = add_kit_floor_mark(col, name + "_shaft", x, z, 0.42, 3.8, module, "route_arrow_shaft", mat_key=mat_key)
    head = add_kit_floor_mark(col, name + "_head", x, z - 2.1, 1.35, 0.85, module, "route_arrow_head", mat_key=mat_key)
    for obj in (base, head):
        obj.rotation_euler[1] = math.radians(yaw_degrees)
    return base


def add_designer_module_kit(kit_col):
    module_specs = [
        ("KIT_MOD_01_STRAIGHT_HALLWAY_CLEAR", "01 STRAIGHT HALL", 0.0, 0.0),
        ("KIT_MOD_02_L_CORNER_SLICE", "02 L CORNER", 22.0, 0.0),
        ("KIT_MOD_03_T_JUNCTION_CHECK", "03 T JUNCTION", 44.0, 0.0),
        ("KIT_MOD_04_SIDE_ROOM_LOOP", "04 SIDE ROOM LOOP", 66.0, 0.0),
        ("KIT_MOD_05_AIRLOCK_DOUBLE_DOOR", "05 AIRLOCK", 0.0, -26.0),
        ("KIT_MOD_06_OFFICE_WINDOW_CLEAR", "06 OFFICE WINDOW", 22.0, -26.0),
        ("KIT_MOD_07_RISKY_CROSSING", "07 RISKY CROSS", 44.0, -26.0),
        ("KIT_MOD_08_FINAL_COMMIT_GATE", "08 COMMIT GATE", 66.0, -26.0),
        ("KIT_MOD_09_COVER_CLUSTER", "09 COVER CLUSTER", 0.0, -52.0),
        ("KIT_MOD_10_LOCKED_DECO_GATE", "10 LOCKED GATE", 22.0, -52.0),
        ("KIT_MOD_11_NESTED_SMALL_ROOM", "11 NESTED ROOM", 44.0, -52.0),
        ("KIT_MOD_12_SPLIT_SIGHTLINE", "12 SPLIT SIGHT", 66.0, -52.0),
    ]
    origin_x = X_MAX + 34.0
    origin_z = Z_MAX - 18.0

    def abs_pos(dx, dz):
        return origin_x + dx, origin_z + dz

    for collection_name, label, dx, dz in module_specs:
        x, z = abs_pos(dx, dz)
        add_kit_label(kit_col, label, x, z + 9.2, 0.48)

    # 01: straight hallway with one answer cover and a fair far-corner peek.
    col = kit_subcollection(kit_col, "KIT_MOD_01_STRAIGHT_HALLWAY_CLEAR")
    x, z = abs_pos(0.0, 0.0)
    add_kit_wall(col, "KIT_MOD_01_left_long_wall", x - 2.4, z, 0.52, 14.0, "straight_hallway_clear", "left_long_wall")
    add_kit_wall(col, "KIT_MOD_01_right_long_wall", x + 2.4, z, 0.52, 14.0, "straight_hallway_clear", "right_long_wall")
    add_kit_cover(col, "KIT_MOD_01_player_answer_cover", x - 0.9, z + 2.2, 1.8, 0.9, "straight_hallway_clear", "player_answer_cover", mat_key="wood")
    add_kit_floor_mark(col, "KIT_MOD_01_center_route_strip", x, z, 0.34, 10.8, "straight_hallway_clear", "center_route_strip", mat_key="hazard")
    add_kit_enemy_marker(col, "KIT_MOD_01_far_corner_peek_marker", x + 1.4, z - 5.6, "straight_hallway_clear", "far_corner_peek_marker", "lookout", "scout", "peek_from_cover", "marker_yellow")

    # 02: compact L-corner for slice-the-pie room entries.
    col = kit_subcollection(kit_col, "KIT_MOD_02_L_CORNER_SLICE")
    x, z = abs_pos(22.0, 0.0)
    add_kit_wall(col, "KIT_MOD_02_north_entry_wall", x - 2.2, z + 2.0, 0.52, 10.5, "l_corner_slice", "north_entry_wall")
    add_kit_wall(col, "KIT_MOD_02_turn_backstop", x + 1.9, z - 3.0, 8.2, 0.52, "l_corner_slice", "turn_backstop")
    add_kit_wall(col, "KIT_MOD_02_short_blind_cheek", x + 4.9, z + 1.3, 0.52, 5.8, "l_corner_slice", "short_blind_cheek")
    add_kit_cover(col, "KIT_MOD_02_after_turn_answer_cover", x + 1.4, z - 5.2, 2.2, 0.9, "l_corner_slice", "after_turn_answer_cover", mat_key="steel")
    add_kit_floor_mark(col, "KIT_MOD_02_turn_route_hash", x + 0.2, z - 1.6, 4.6, 0.30, "l_corner_slice", "turn_route_hash", mat_key="paint_cyan")
    add_kit_enemy_marker(col, "KIT_MOD_02_blind_corner_hold_marker", x + 4.0, z - 4.9, "l_corner_slice", "blind_corner_hold_marker", "anchor", "soldier", "hold_angle", "marker_red")

    # 03: T-junction forcing left/right checks before the player commits.
    col = kit_subcollection(kit_col, "KIT_MOD_03_T_JUNCTION_CHECK")
    x, z = abs_pos(44.0, 0.0)
    add_kit_wall(col, "KIT_MOD_03_main_left_wall", x - 2.5, z + 1.0, 0.52, 10.0, "t_junction_check", "main_left_wall")
    add_kit_wall(col, "KIT_MOD_03_main_right_wall", x + 2.5, z + 1.0, 0.52, 10.0, "t_junction_check", "main_right_wall")
    add_kit_wall(col, "KIT_MOD_03_cross_north_block_left", x - 6.0, z - 4.1, 5.6, 0.52, "t_junction_check", "cross_left_block")
    add_kit_wall(col, "KIT_MOD_03_cross_north_block_right", x + 6.0, z - 4.1, 5.6, 0.52, "t_junction_check", "cross_right_block")
    add_kit_cover(col, "KIT_MOD_03_center_answer_crate", x, z - 1.8, 1.2, 1.2, "t_junction_check", "center_answer_crate", mat_key="wood")
    add_kit_enemy_marker(col, "KIT_MOD_03_left_cross_peek_marker", x - 7.8, z - 5.0, "t_junction_check", "left_cross_peek_marker", "lookout", "scout", "peek_from_cover", "marker_yellow")
    add_kit_enemy_marker(col, "KIT_MOD_03_right_cross_ambush_marker", x + 7.8, z - 5.0, "t_junction_check", "right_cross_ambush_marker", "flanker", "pistolero", "ambush_on_crossing", "marker_green")

    # 04: side-room loop with two doors, so lane switching feels intentional.
    col = kit_subcollection(kit_col, "KIT_MOD_04_SIDE_ROOM_LOOP")
    x, z = abs_pos(66.0, 0.0)
    add_kit_wall(col, "KIT_MOD_04_main_lane_shutter", x, z, 13.8, 0.56, "side_room_loop", "main_lane_shutter")
    add_kit_wall(col, "KIT_MOD_04_connector_wall_north", x + 5.2, z + 4.8, 0.52, 5.2, "side_room_loop", "connector_wall_north")
    add_kit_wall(col, "KIT_MOD_04_connector_wall_south", x + 5.2, z - 4.8, 0.52, 5.2, "side_room_loop", "connector_wall_south")
    add_kit_wall(col, "KIT_MOD_04_side_room_back_wall", x + 11.0, z, 0.52, 13.0, "side_room_loop", "side_room_back_wall")
    add_kit_wall(col, "KIT_MOD_04_side_room_inner_lip", x + 8.2, z + 1.6, 5.0, 0.52, "side_room_loop", "side_room_inner_lip")
    add_kit_floor_mark(col, "KIT_MOD_04_entry_route_paint", x + 3.4, z + 6.2, 0.34, 3.5, "side_room_loop", "entry_route_paint", mat_key="paint_cyan")
    add_kit_floor_mark(col, "KIT_MOD_04_return_route_paint", x + 3.4, z - 6.2, 0.34, 3.5, "side_room_loop", "return_route_paint", mat_key="hazard")
    add_kit_cover(col, "KIT_MOD_04_side_room_answer_cover", x + 8.4, z - 2.8, 2.3, 0.9, "side_room_loop", "side_room_answer_cover", mat_key="steel")
    add_kit_enemy_marker(col, "KIT_MOD_04_deep_side_room_hold_marker", x + 9.8, z + 4.8, "side_room_loop", "deep_side_room_hold_marker", "anchor", "soldier", "hold_angle", "marker_red")
    add_kit_enemy_marker(col, "KIT_MOD_04_return_swing_marker", x + 5.6, z - 6.0, "side_room_loop", "return_swing_marker", "flanker", "pistolero", "ambush_on_crossing", "marker_green")

    # 05: double threshold/airlock for pacing between phases.
    col = kit_subcollection(kit_col, "KIT_MOD_05_AIRLOCK_DOUBLE_DOOR")
    x, z = abs_pos(0.0, -26.0)
    for dz in (4.4, -4.4):
        add_kit_wall(col, f"KIT_MOD_05_threshold_left_jamb_{dz:+.1f}", x - 3.3, z + dz, 1.8, 0.56, "airlock_double_door", "threshold_left_jamb")
        add_kit_wall(col, f"KIT_MOD_05_threshold_right_jamb_{dz:+.1f}", x + 3.3, z + dz, 1.8, 0.56, "airlock_double_door", "threshold_right_jamb")
    add_kit_wall(col, "KIT_MOD_05_airlock_west_wall", x - 4.2, z, 0.52, 9.8, "airlock_double_door", "airlock_west_wall")
    add_kit_wall(col, "KIT_MOD_05_airlock_east_wall", x + 4.2, z, 0.52, 9.8, "airlock_double_door", "airlock_east_wall")
    add_kit_cover(col, "KIT_MOD_05_mid_threshold_answer_cover", x - 1.2, z, 1.8, 0.85, "airlock_double_door", "mid_threshold_answer_cover", mat_key="wood")
    add_kit_enemy_marker(col, "KIT_MOD_05_second_door_peek_marker", x + 2.2, z - 5.8, "airlock_double_door", "second_door_peek_marker", "lookout", "scout", "peek_from_cover", "marker_yellow")

    # 06: office/window clear with a fair visible tell before entry.
    col = kit_subcollection(kit_col, "KIT_MOD_06_OFFICE_WINDOW_CLEAR")
    x, z = abs_pos(22.0, -26.0)
    add_kit_wall(col, "KIT_MOD_06_office_back_wall", x, z - 6.0, 12.0, 0.52, "office_window_clear", "office_back_wall")
    add_kit_wall(col, "KIT_MOD_06_office_left_wall", x - 6.0, z, 0.52, 12.0, "office_window_clear", "office_left_wall")
    add_kit_wall(col, "KIT_MOD_06_office_right_wall", x + 6.0, z, 0.52, 12.0, "office_window_clear", "office_right_wall")
    add_kit_glass(col, "KIT_MOD_06_tactical_window_glass", x, z + 5.8, 6.8, 0.08, "office_window_clear", "tactical_window_glass", orientation="X", warm=True)
    add_kit_cover(col, "KIT_MOD_06_window_sill_cover", x, z + 5.8, 7.1, 0.32, "office_window_clear", "window_sill_cover", height=0.62, mat_key="steel", role="designer_overlay_window_sill")
    add_kit_cover(col, "KIT_MOD_06_office_desk_answer", x - 1.8, z - 1.8, 3.0, 1.0, "office_window_clear", "office_desk_answer", mat_key="wood")
    add_kit_enemy_marker(col, "KIT_MOD_06_desk_counterpeek_marker", x + 2.6, z - 3.0, "office_window_clear", "desk_counterpeek_marker", "anchor", "soldier", "hold_angle", "marker_red")

    # 07: risky crossing angle with staggered sight blockers.
    col = kit_subcollection(kit_col, "KIT_MOD_07_RISKY_CROSSING")
    x, z = abs_pos(44.0, -26.0)
    add_kit_wall(col, "KIT_MOD_07_left_near_blind", x - 4.8, z + 2.5, 0.52, 8.2, "risky_crossing", "left_near_blind")
    add_kit_wall(col, "KIT_MOD_07_right_far_blind", x + 4.8, z - 2.5, 0.52, 8.2, "risky_crossing", "right_far_blind")
    add_kit_wall(col, "KIT_MOD_07_cross_backstop", x, z - 7.0, 11.4, 0.52, "risky_crossing", "cross_backstop")
    add_kit_cover(col, "KIT_MOD_07_crossing_low_cover_a", x - 1.8, z + 0.8, 2.1, 0.9, "risky_crossing", "crossing_low_cover_a", mat_key="steel")
    add_kit_cover(col, "KIT_MOD_07_crossing_low_cover_b", x + 2.0, z - 3.0, 2.1, 0.9, "risky_crossing", "crossing_low_cover_b", mat_key="wood")
    add_kit_enemy_marker(col, "KIT_MOD_07_far_hold_marker", x + 4.0, z - 6.0, "risky_crossing", "far_hold_marker", "anchor", "heavy", "hold_angle", "marker_red")
    add_kit_enemy_marker(col, "KIT_MOD_07_near_swing_marker", x - 4.0, z + 5.8, "risky_crossing", "near_swing_marker", "flanker", "pistolero", "ambush_on_crossing", "marker_green")

    # 08: final commit gate for last-room pressure.
    col = kit_subcollection(kit_col, "KIT_MOD_08_FINAL_COMMIT_GATE")
    x, z = abs_pos(66.0, -26.0)
    add_kit_wall(col, "KIT_MOD_08_gate_west_jamb", x - 3.8, z + 3.8, 2.6, 0.62, "final_commit_gate", "gate_west_jamb")
    add_kit_wall(col, "KIT_MOD_08_gate_east_jamb", x + 3.8, z + 3.8, 2.6, 0.62, "final_commit_gate", "gate_east_jamb")
    add_kit_wall(col, "KIT_MOD_08_exit_sight_break", x - 1.8, z - 5.0, 5.8, 0.52, "final_commit_gate", "exit_sight_break")
    add_kit_cover(col, "KIT_MOD_08_last_answer_belt", x + 2.4, z - 2.6, 2.8, 0.9, "final_commit_gate", "last_answer_belt", mat_key="steel")
    add_kit_floor_mark(col, "KIT_MOD_08_commit_route_mark", x, z + 0.4, 5.8, 0.34, "final_commit_gate", "commit_route_mark", mat_key="hazard")
    add_kit_enemy_marker(col, "KIT_MOD_08_final_anchor_marker", x + 5.2, z - 6.0, "final_commit_gate", "final_anchor_marker", "anchor", "heavy", "hold_angle", "marker_red")

    # 09: cover cluster pieces that create jiggle-peek fights without closing a path.
    col = kit_subcollection(kit_col, "KIT_MOD_09_COVER_CLUSTER")
    x, z = abs_pos(0.0, -52.0)
    add_kit_cover(col, "KIT_MOD_09_crate_stack_low", x - 3.2, z + 2.0, 2.4, 1.4, "cover_cluster", "crate_stack_low", height=0.86, mat_key="wood")
    add_kit_cover(col, "KIT_MOD_09_crate_stack_high", x + 0.4, z - 0.2, 1.5, 1.6, "cover_cluster", "crate_stack_high", height=1.42, mat_key="wood")
    add_kit_cover(col, "KIT_MOD_09_steel_half_wall", x + 3.6, z + 2.4, 3.2, 0.85, "cover_cluster", "steel_half_wall", height=1.08, mat_key="steel")
    add_kit_cover(col, "KIT_MOD_09_machine_blocker", x + 2.7, z - 3.0, 2.8, 2.0, "cover_cluster", "machine_blocker", height=1.35, mat_key="black")
    add_kit_enemy_marker(col, "KIT_MOD_09_cover_jiggle_marker", x + 5.4, z + 0.2, "cover_cluster", "cover_jiggle_marker", "lookout", "scout", "peek_from_cover", "marker_yellow")

    # 10: locked decorative gate to close non-route openings cleanly.
    col = kit_subcollection(kit_col, "KIT_MOD_10_LOCKED_DECO_GATE")
    x, z = abs_pos(22.0, -52.0)
    add_kit_wall(col, "KIT_MOD_10_locked_door_slab_collision", x, z, 5.4, 0.58, "locked_deco_gate", "locked_door_slab", mat_key="steel", role="designer_overlay_locked_door")
    add_kit_box(col, "KIT_MOD_10_locked_red_stripe_left", x - 1.9, z - 0.04, 0.18, 2.2, 0.05, "red", "locked_red_stripe", "decorative_only", "designer_overlay_locked_door_stripe", module="locked_deco_gate", part="locked_red_stripe_left", y=WT + 1.55, bevel_width=0.004)
    add_kit_box(col, "KIT_MOD_10_locked_red_stripe_right", x + 1.9, z - 0.04, 0.18, 2.2, 0.05, "red", "locked_red_stripe", "decorative_only", "designer_overlay_locked_door_stripe", module="locked_deco_gate", part="locked_red_stripe_right", y=WT + 1.55, bevel_width=0.004)
    add_kit_floor_mark(col, "KIT_MOD_10_blocked_route_warning", x, z + 1.5, 4.2, 0.30, "locked_deco_gate", "blocked_route_warning", mat_key="red", role="designer_overlay_locked_route_read")

    # 11: nested small room that makes a side pocket feel like part of the maze.
    col = kit_subcollection(kit_col, "KIT_MOD_11_NESTED_SMALL_ROOM")
    x, z = abs_pos(44.0, -52.0)
    add_kit_wall(col, "KIT_MOD_11_outer_back_wall", x, z - 6.2, 11.5, 0.52, "nested_small_room", "outer_back_wall")
    add_kit_wall(col, "KIT_MOD_11_outer_left_wall", x - 5.8, z, 0.52, 12.4, "nested_small_room", "outer_left_wall")
    add_kit_wall(col, "KIT_MOD_11_outer_right_wall", x + 5.8, z, 0.52, 12.4, "nested_small_room", "outer_right_wall")
    add_kit_wall(col, "KIT_MOD_11_inner_partition", x - 1.4, z + 0.9, 0.52, 8.5, "nested_small_room", "inner_partition")
    add_kit_wall(col, "KIT_MOD_11_inner_back_lip", x + 2.6, z - 1.8, 5.8, 0.52, "nested_small_room", "inner_back_lip")
    add_kit_cover(col, "KIT_MOD_11_inner_answer_cover", x + 2.8, z - 4.0, 2.4, 0.9, "nested_small_room", "inner_answer_cover", mat_key="wood")
    add_kit_floor_mark(col, "KIT_MOD_11_nested_route_read", x - 2.5, z + 3.8, 0.32, 4.2, "nested_small_room", "nested_route_read", mat_key="paint_cyan")
    add_kit_enemy_marker(col, "KIT_MOD_11_inner_room_peek_marker", x + 3.8, z - 3.6, "nested_small_room", "inner_room_peek_marker", "lookout", "scout", "peek_from_cover", "marker_yellow")

    # 12: split sightline with a window tell and a separate blind angle.
    col = kit_subcollection(kit_col, "KIT_MOD_12_SPLIT_SIGHTLINE")
    x, z = abs_pos(66.0, -52.0)
    add_kit_wall(col, "KIT_MOD_12_left_lane_wall", x - 4.2, z, 0.52, 12.5, "split_sightline", "left_lane_wall")
    add_kit_wall(col, "KIT_MOD_12_right_lane_wall", x + 4.2, z, 0.52, 12.5, "split_sightline", "right_lane_wall")
    add_kit_glass(col, "KIT_MOD_12_preview_window", x, z + 2.6, 5.8, 0.08, "split_sightline", "preview_window", orientation="X")
    add_kit_wall(col, "KIT_MOD_12_blind_angle_cheek", x + 1.8, z - 4.5, 5.0, 0.52, "split_sightline", "blind_angle_cheek")
    add_kit_cover(col, "KIT_MOD_12_player_answer_cover", x - 1.6, z - 1.6, 2.4, 0.9, "split_sightline", "player_answer_cover", mat_key="steel")
    add_kit_enemy_marker(col, "KIT_MOD_12_window_tell_marker", x + 2.8, z + 3.6, "split_sightline", "window_tell_marker", "lookout", "scout", "peek_from_cover", "marker_yellow")
    add_kit_enemy_marker(col, "KIT_MOD_12_blind_angle_marker", x + 4.8, z - 5.8, "split_sightline", "blind_angle_marker", "anchor", "soldier", "hold_angle", "marker_red")


def add_designer_overlay_kit(root):
    kit_col = collection(DESIGNER_KIT_COLLECTION, root)
    clear_child_collections(kit_col)
    x = X_MAX + 13.0
    z = Z_MAX - 8.0
    add_box(
        "KIT_DUPLICATE_THESE_INTO_10_DESIGNER_OVERLAY",
        x + 2.5,
        WT + 0.035,
        z + 6.0,
        18.0,
        0.05,
        2.0,
        MATS["paint_cyan"],
        kit_col,
        {"designerTemplate": True, "collision": "decorative_only", "floorplanRole": "designer_kit_label", "layoutPass": "designer_overlay_kit"},
        0.004,
    )
    label = add_floor_label("DUPLICATE KIT PIECES INTO 10_DESIGNER_OVERLAY", x + 2.5, z + 8.0, 0.7)
    for c in list(label.users_collection):
        c.objects.unlink(label)
    kit_col.objects.link(label)
    label["designerTemplate"] = True
    label["collision"] = "decorative_only"
    label["layoutPass"] = "designer_overlay_kit"

    add_box("KIT_wall_full_collision", x, WT + RH / 2, z - 3.0, 0.62, RH, 6.0, MATS["wall_dark"], kit_col,
            designer_template_props("wall_full", "wall_aabb", "designer_overlay_wall"), 0.016)
    add_box("KIT_wall_short_peek_cheek", x + 4.0, WT + RH / 2, z - 3.0, 0.52, RH, 3.2, MATS["wall_dark"], kit_col,
            designer_template_props("peek_cheek", "wall_aabb", "designer_overlay_peek_wall"), 0.016)
    add_box("KIT_doorway_blocker_collision", x + 8.5, WT + RH / 2, z - 3.0, 5.2, RH, 0.58, MATS["steel"], kit_col,
            designer_template_props("doorway_blocker", "wall_aabb", "designer_overlay_door_blocker"), 0.016)
    add_box("KIT_half_cover_collision", x, WT + 0.52, z - 10.0, 3.0, 1.04, 0.9, MATS["steel"], kit_col,
            designer_template_props("half_cover", "cover_aabb", "designer_overlay_cover"), 0.018)
    add_box("KIT_low_crate_cover_collision", x + 4.5, WT + 0.46, z - 10.0, 2.5, 0.92, 1.2, MATS["wood"], kit_col,
            designer_template_props("low_crate_cover", "cover_aabb", "designer_overlay_cover"), 0.018)
    add_box("KIT_route_paint_nonblocking", x + 8.5, WT + 0.06, z - 10.0, 4.5, 0.035, 0.34, MATS["paint_cyan"], kit_col,
            designer_template_props("route_paint", "decorative_only", "designer_overlay_route_read"), 0.002)
    add_box("KIT_tall_machine_cover_collision", x + 13.5, WT + 0.82, z - 10.0, 2.4, 1.64, 1.8, MATS["black"], kit_col,
            designer_template_props("tall_machine_cover", "cover_aabb", "designer_overlay_tall_cover"), 0.018)
    add_box("KIT_breakable_window_collision", x + 13.5, WT + 1.55, z - 3.0, 4.8, 1.65, 0.08, MATS["glass"], kit_col,
            designer_template_props("breakable_window", "transparent_window_aabb", "designer_overlay_breakable_window", extra={"glassPane": True, "breakable": True, "breakSound": "glass"}), 0.004)
    add_box("KIT_route_arrow_shaft_nonblocking", x + 12.7, WT + 0.06, z - 15.5, 0.34, 0.035, 2.8, MATS["hazard"], kit_col,
            designer_template_props("route_arrow_shaft", "decorative_only", "designer_overlay_route_read"), 0.002)
    add_box("KIT_route_arrow_head_nonblocking", x + 12.7, WT + 0.061, z - 17.1, 1.2, 0.035, 0.75, MATS["hazard"], kit_col,
            designer_template_props("route_arrow_head", "decorative_only", "designer_overlay_route_read"), 0.002)

    marker_props = {
        "designerTemplate": True,
        "designerKitType": "enemy_peek_marker",
        "markerType": "enemy_spawn",
        "roomId": "designer_overlay",
        "zoneId": 0,
        "encounterId": "designer_overlay",
        "encounterType": "designer_overlay",
        "enemyRole": "lookout",
        "enemyType": "scout",
        "encounterBehavior": "peek_from_cover",
        "spawnWave": "designer_overlay",
        "collision": "decorative_only",
        "markerVisual": "lookout",
        "layoutPass": "designer_overlay_kit",
    }
    add_cylinder("KIT_enemy_peek_marker_duplicate", x, WT + 0.05, z - 15.5, 0.55, 0.05, MATS["marker_yellow"], kit_col, marker_props, axis="Y", vertices=20)
    marker_props = dict(marker_props)
    marker_props.update({"designerKitType": "enemy_ambush_marker", "enemyRole": "flanker", "enemyType": "pistolero", "encounterBehavior": "ambush_on_crossing", "markerVisual": "flanker"})
    add_cylinder("KIT_enemy_ambush_marker_duplicate", x + 3.0, WT + 0.05, z - 15.5, 0.55, 0.05, MATS["marker_green"], kit_col, marker_props, axis="Y", vertices=20)
    marker_props = dict(marker_props)
    marker_props.update({"designerKitType": "enemy_hold_marker", "enemyRole": "anchor", "enemyType": "soldier", "encounterBehavior": "hold_angle", "markerVisual": "anchor"})
    add_cylinder("KIT_enemy_hold_marker_duplicate", x + 6.0, WT + 0.05, z - 15.5, 0.55, 0.05, MATS["marker_red"], kit_col, marker_props, axis="Y", vertices=20)
    marker_props = dict(marker_props)
    marker_props.update({"designerKitType": "enemy_breacher_marker", "enemyRole": "breacher", "enemyType": "heavy", "encounterBehavior": "push_after_contact", "markerVisual": "breacher"})
    add_cylinder("KIT_enemy_breacher_marker_duplicate", x + 9.0, WT + 0.05, z - 15.5, 0.55, 0.05, MATS["marker_orange"], kit_col, marker_props, axis="Y", vertices=20)

    add_designer_module_kit(kit_col)

    MANIFEST["features"].append({
        "type": "designer_overlay_kit_templates",
        "collection": DESIGNER_KIT_COLLECTION,
        "modules": 12,
        "summary": "Runtime-ready wall, cover, route paint, window, enemy marker, and 12 composite encounter-module templates. Duplicate pieces or full module collections into the manual overlay collection; the kit collection itself is excluded from GLB export.",
    })
    return kit_col


def unlink_collection_for_export(parent_col, child_col):
    if not parent_col or not child_col:
        return False
    try:
        if parent_col.children.get(child_col.name) is not None:
            parent_col.children.unlink(child_col)
            return True
    except Exception:
        pass
    return False


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
    def parent_keep_world(obj, parent):
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
        return obj

    hub = add_cylinder(f"fan_hub_{room['id']}_{x:.1f}_{z:.1f}", x, RH + WT - 0.45, z, 0.22, 0.16, MATS["steel"], col,
                       {"collision": "decorative_only", "roomId": room["id"]}, axis="Y", vertices=20)
    parent_keep_world(hub, rotor)
    for i in range(4):
        blade = add_box(f"fan_blade_{room['id']}_{i}_{x:.1f}_{z:.1f}", x + math.cos(i * math.pi / 2) * 0.72, RH + WT - 0.45, z + math.sin(i * math.pi / 2) * 0.72,
                        1.42 if i % 2 == 0 else 0.22, 0.035, 0.22 if i % 2 == 0 else 1.42, MATS["steel_edge"], col,
                        {"collision": "decorative_only", "roomId": room["id"]}, 0.006)
        parent_keep_world(blade, rotor)
    rotor.rotation_euler[1] = 0
    rotor.keyframe_insert(data_path="rotation_euler", frame=1)
    rotor.rotation_euler[1] = math.tau
    rotor.keyframe_insert(data_path="rotation_euler", frame=120)
    MANIFEST["features"].append({"type": "animated_ceiling_fan", "room": room["id"], "x": x, "z": z})


def advanced_col():
    return COLLECTIONS["09_advanced_linear_tactical_layout"]


def room_pos(room, dx, dz):
    b = room_bounds(room)
    return b["cx"] + dx, b["cz"] + dz


def add_advanced_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="advanced_partition_wall", height=None):
    x, z = room_pos(room, dx, dz)
    h = RH if height is None else height
    obj = add_box(
        f"advanced_{room['id']}_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        advanced_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"advanced_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "advanced_linear_tactical",
        },
        0.018,
    )
    add_box(
        f"advanced_{room['id']}_{name}_top_trim",
        x,
        WT + h - 0.05,
        z,
        sx + (0.08 if sx < sz else 0.0),
        0.06,
        sz + (0.08 if sz <= sx else 0.0),
        MATS["steel_edge"],
        advanced_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "advanced_partition_trim"},
        0.006,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_advanced_cover(room, name, dx, dz, sx, sz, height=0.96, mat_key="steel", role="advanced_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"advanced_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        advanced_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"advanced_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "advanced_linear_tactical",
        },
        0.02,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_advanced_route_pad(room, name, dx, dz, sx, sz, mat_key="hazard", role="advanced_route_language"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"advanced_{room['id']}_{name}",
        x,
        WT + 0.031,
        z,
        sx,
        0.032,
        sz,
        MATS[mat_key],
        advanced_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"advanced_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "advanced_linear_tactical",
        },
        0.003,
    )


def add_advanced_door_cue(room, name, dx, dz, axis="X", width=4.0, mat_key="hazard", role="advanced_doorway_cue"):
    x, z = room_pos(room, dx, dz)
    sx, sz = (width, 0.12) if axis == "X" else (0.12, width)
    add_box(
        f"advanced_{room['id']}_{name}_header",
        x,
        WT + 2.72,
        z,
        sx,
        0.18,
        sz,
        MATS[mat_key],
        advanced_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": role},
        0.006,
    )


def add_advanced_window(room, name, dx, dz, length, orientation, sightline, warm=False, sill=0.88, head=2.25):
    x, z = room_pos(room, dx, dz)
    return add_window(f"advanced_{room['id']}_{name}", x, z, length, orientation, room["id"], sightline, warm=warm, sill=sill, head=head)


def add_advanced_enemy(room, name, dx, dz, role, enemy_type, behavior, wave="advanced"):
    x, z = room_pos(room, dx, dz)
    encounter_id = f"mega_{room['id']}_{room['encounter']}"
    marker_name = f"ENEMY_ADV_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
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
        "layoutPass": "advanced_linear_tactical",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.027,
        z,
        0.52,
        0.035,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=20,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": wave})


def add_advanced_linear_tactical_pass():
    by_id = {room["id"]: room for room in ROOMS}

    room = by_id["customs_entry"]
    add_advanced_wall(room, "west_interview_booth_north", -12.8, 8.4, 10.0, 0.48, role="nested_side_room_wall")
    add_advanced_wall(room, "west_interview_booth_return", -7.65, 0.8, 0.48, 15.2, role="nested_side_room_wall")
    add_advanced_window(room, "interview_room_glass", -7.38, 3.2, 6.4, "Z", "customs_left_booth_peek", warm=True)
    add_advanced_cover(room, "queue_knee_wall", 6.1, -0.8, 1.65, 4.4, height=1.02, mat_key="steel", role="queue_lane_cover")
    add_advanced_cover(room, "south_scan_apron", -3.2, -11.8, 3.0, 1.0, height=0.88, mat_key="cyan", role="player_recovery_cover")
    add_advanced_door_cue(room, "booth_exit", -9.8, -7.6, axis="X", width=4.2, mat_key="cyan")
    add_advanced_route_pad(room, "first_clear_arrow", 0.0, -15.4, 2.2, 5.0, mat_key="hazard")
    add_advanced_enemy(room, "booth_left_angle", -14.2, 4.8, "lookout", "scout", "peek_from_cover")
    add_advanced_enemy(room, "scanner_cross_angle", 8.8, -9.2, "anchor", "soldier", "hold_angle")

    room = by_id["receiving_yard"]
    add_advanced_wall(room, "container_alley_blind_l", -1.8, 8.8, 0.5, 14.0, role="exterior_alley_occluder")
    add_advanced_wall(room, "forklift_service_alcove", 10.4, -1.0, 0.5, 16.5, role="side_alcove_wall")
    add_advanced_cover(room, "dock_apron_low_stack", -9.0, -6.8, 5.2, 1.3, height=1.05, mat_key="wood", role="player_cover")
    add_advanced_route_pad(room, "cold_route_pull", 12.8, -16.0, 2.0, 4.0, mat_key="paint_cyan")
    add_advanced_enemy(room, "container_left_peek", -5.6, 12.8, "lookout", "scout", "peek_from_cover")
    add_advanced_enemy(room, "forklift_right_ambush", 13.2, -5.8, "flanker", "pistolero", "flank_after_contact")

    room = by_id["container_gate"]
    add_advanced_wall(room, "east_container_chicane_a", -5.0, 8.0, 0.5, 18.0, role="container_chicane_wall")
    add_advanced_wall(room, "east_container_chicane_b", 6.5, -5.0, 0.5, 17.5, role="container_chicane_wall")
    add_advanced_cover(room, "blue_gate_headglitch", 0.0, -14.2, 4.4, 1.0, height=0.95, mat_key="steel", role="enemy_headglitch_cover")
    add_advanced_window(room, "container_slit_read", -10.6, -2.0, 6.8, "Z", "container_side_slit", warm=False, sill=1.05, head=2.05)
    add_advanced_enemy(room, "far_container_slit", -12.0, -0.8, "sniper", "marksman", "peek_from_cover")
    add_advanced_enemy(room, "gate_cross_anchor", 6.4, -13.2, "anchor", "soldier", "suppress_lane")

    room = by_id["forklift_repair"]
    add_advanced_wall(room, "repair_office_back", -11.5, 9.6, 11.5, 0.5, role="nested_side_room_wall")
    add_advanced_wall(room, "repair_office_return", -5.6, 2.4, 0.5, 14.0, role="nested_side_room_wall")
    add_advanced_cover(room, "toolbench_partial_cover", -11.2, -5.2, 4.8, 1.2, height=1.05, mat_key="wood", role="toolbench_cover")
    add_advanced_cover(room, "rollup_corner_crates", 9.5, 10.5, 3.8, 1.4, height=1.1, mat_key="wood", role="enemy_peek_cover")
    add_advanced_window(room, "repair_office_glass", -5.32, 5.8, 6.2, "Z", "repair_office_to_bay", warm=True)
    add_advanced_enemy(room, "office_door_breacher", -13.8, 5.4, "breacher", "heavy", "ambush_on_crossing")
    add_advanced_enemy(room, "rollup_right_hold", 11.8, 11.5, "anchor", "soldier", "hold_angle")

    room = by_id["intake_court"]
    add_advanced_wall(room, "intake_s_bend_left", -9.2, 6.6, 0.5, 13.5, role="main_path_s_bend")
    add_advanced_wall(room, "intake_s_bend_right", 9.4, -5.8, 0.5, 12.5, role="main_path_s_bend")
    add_advanced_cover(room, "middle_answer_stack", 0.0, -2.0, 3.6, 1.25, height=0.98, mat_key="wood", role="player_answer_cover")
    add_advanced_cover(room, "left_corner_peek_box", -12.8, -10.5, 2.8, 1.2, height=1.15, mat_key="steel", role="enemy_peek_cover")
    add_advanced_route_pad(room, "dogleg_floor_pull", 2.6, -14.8, 1.6, 4.8, mat_key="hazard")
    add_advanced_enemy(room, "left_blind_corner", -12.0, -9.6, "lookout", "scout", "peek_from_cover")
    add_advanced_enemy(room, "right_reveal_cross", 10.0, 5.8, "flanker", "pistolero", "flank_after_contact")

    room = by_id["security_screening"]
    add_advanced_wall(room, "xray_partition_north", -4.5, 8.2, 0.5, 14.4, role="scanner_partition_wall")
    add_advanced_wall(room, "xray_partition_south", 5.4, -7.0, 0.5, 16.0, role="scanner_partition_wall")
    add_advanced_cover(room, "turnstile_left_answer", -10.2, -11.5, 3.4, 1.1, height=1.0, mat_key="steel", role="player_cover")
    add_advanced_window(room, "security_side_glass", 9.8, 2.0, 8.8, "Z", "security_right_overwatch", warm=False)
    add_advanced_enemy(room, "glass_overwatch", 11.2, 5.4, "sniper", "marksman", "peek_from_cover")
    add_advanced_enemy(room, "xray_cross_hold", -7.8, -12.0, "anchor", "soldier", "hold_angle")

    room = by_id["manifest_office"]
    add_advanced_wall(room, "file_room_back", -12.0, 9.0, 11.8, 0.5, role="file_room_wall")
    add_advanced_wall(room, "file_room_return", -5.8, 2.0, 0.5, 13.2, role="file_room_wall")
    add_advanced_wall(room, "manifest_counter_return", 6.8, -7.5, 0.5, 12.0, role="counter_blind_angle")
    add_advanced_cover(room, "manifest_counter", 3.8, -2.4, 5.0, 1.2, height=1.02, mat_key="wood", role="objective_cover")
    add_advanced_window(room, "file_room_slit", -5.52, 5.0, 5.6, "Z", "file_room_slit", warm=True)
    add_advanced_enemy(room, "file_room_peek", -14.2, 5.2, "lookout", "scout", "peek_from_cover")
    add_advanced_enemy(room, "counter_anchor", 7.4, -5.8, "anchor", "soldier", "guard_objective")

    room = by_id["warehouse_spine"]
    add_advanced_wall(room, "rack_maze_left_spine", -9.4, 6.6, 0.5, 16.0, role="warehouse_rack_maze_wall")
    add_advanced_wall(room, "rack_maze_right_spine", 9.6, -8.0, 0.5, 15.5, role="warehouse_rack_maze_wall")
    add_advanced_cover(room, "fork_crossing_answer", 0.0, 12.8, 4.6, 1.1, height=1.0, mat_key="steel", role="player_answer_cover")
    add_advanced_cover(room, "southern_rack_headglitch", -11.0, -15.0, 3.6, 1.0, height=0.92, mat_key="wood", role="enemy_headglitch_cover")
    add_advanced_route_pad(room, "rack_lane_arrow", 4.0, -17.2, 1.5, 5.6, mat_key="paint_cyan")
    add_advanced_enemy(room, "left_rack_suppression", -12.8, -11.0, "anchor", "heavy", "suppress_lane")
    add_advanced_enemy(room, "right_rack_flank", 12.4, 11.8, "flanker", "pistolero", "flank_after_contact")

    room = by_id["hazmat_barrels"]
    add_advanced_wall(room, "hazmat_cage_north", -2.2, 8.4, 14.5, 0.5, mat_key="wall_dark", role="hazmat_pen_wall")
    add_advanced_wall(room, "hazmat_cage_return", -9.8, 0.8, 0.5, 15.2, mat_key="wall_dark", role="hazmat_pen_wall")
    add_advanced_wall(room, "hazmat_flush_return", 8.8, -7.5, 0.5, 12.0, mat_key="wall_dark", role="blind_flush_angle")
    add_advanced_cover(room, "spill_answer_cover", 2.2, -13.8, 4.0, 1.2, height=0.95, mat_key="red", role="player_answer_cover")
    add_advanced_window(room, "hazmat_warning_slit", -9.52, 5.2, 5.8, "Z", "hazmat_pen_preview", warm=False)
    add_advanced_enemy(room, "pen_demolitions_peek", -12.2, 5.6, "demolitions", "demolitions", "grenade_flush_cover")
    add_advanced_enemy(room, "flush_right_corner", 10.8, -10.5, "flanker", "pistolero", "ambush_on_crossing")

    room = by_id["cold_storage"]
    add_advanced_wall(room, "freezer_lane_left", -5.0, 7.5, 0.5, 23.0, mat_key="wall_dark", role="freezer_lane_partition")
    add_advanced_wall(room, "freezer_lane_right", 6.0, -8.5, 0.5, 22.0, mat_key="wall_dark", role="freezer_lane_partition")
    add_advanced_cover(room, "cold_mist_low_cover", -12.4, -12.0, 3.6, 1.2, height=1.0, mat_key="steel", role="enemy_peek_cover")
    add_advanced_window(room, "cold_storage_slatted_glass", 6.28, 7.2, 7.2, "Z", "cold_mist_preview", warm=False, sill=0.95, head=2.0)
    add_advanced_enemy(room, "mist_left_peek", -12.8, -12.8, "sniper", "marksman", "peek_from_cover")
    add_advanced_enemy(room, "freezer_right_flank", 10.0, 11.2, "flanker", "pistolero", "flank_after_contact")

    room = by_id["alarm_relay"]
    add_advanced_wall(room, "relay_outer_office_n", -2.8, 9.0, 12.5, 0.5, mat_key="wall_dark", role="objective_room_wall")
    add_advanced_wall(room, "relay_outer_office_w", -9.2, 1.0, 0.5, 16.0, mat_key="wall_dark", role="objective_room_wall")
    add_advanced_wall(room, "relay_side_closet_return", 9.2, -8.5, 0.5, 12.0, mat_key="wall_dark", role="side_closet_blind")
    add_advanced_cover(room, "relay_console_answer", 1.6, -2.8, 4.6, 1.25, height=1.0, mat_key="cyan", role="objective_answer_cover")
    add_advanced_window(room, "relay_office_preview", -9.0, 5.4, 6.4, "Z", "relay_nested_office_preview", warm=True)
    add_advanced_route_pad(room, "relay_disable_pad", 0.0, 4.8, 2.2, 3.2, mat_key="cyan", role="objective_lane")
    add_advanced_enemy(room, "relay_office_guard", -12.2, 5.0, "anchor", "heavy", "guard_objective")
    add_advanced_enemy(room, "closet_ambush", 11.2, -10.8, "breacher", "heavy", "ambush_on_crossing")

    room = by_id["boiler_pump"]
    add_advanced_wall(room, "pipe_room_blind_a", -1.8, 8.0, 0.5, 14.2, mat_key="wall_dark", role="pipe_room_blind")
    add_advanced_wall(room, "pipe_room_blind_b", 6.4, -6.5, 0.5, 18.0, mat_key="wall_dark", role="pipe_room_blind")
    add_advanced_cover(room, "pump_crossing_answer", -0.5, -13.0, 4.2, 1.2, height=1.02, mat_key="steel", role="player_answer_cover")
    add_advanced_cover(room, "boiler_valve_peek", 11.8, 8.5, 2.8, 1.1, height=1.05, mat_key="red", role="enemy_peek_cover")
    add_advanced_enemy(room, "valve_corner", 12.0, 8.8, "demolitions", "demolitions", "grenade_flush_cover")
    add_advanced_enemy(room, "pipe_flank", -11.5, -11.5, "flanker", "pistolero", "flank_after_contact")

    room = by_id["loading_cage"]
    add_advanced_wall(room, "cage_entry_blind_w", -6.4, 8.2, 0.5, 15.5, mat_key="wall_dark", role="cage_entry_blind")
    add_advanced_wall(room, "cage_entry_blind_e", -2.2, -5.0, 0.5, 13.8, mat_key="wall_dark", role="cage_entry_blind")
    add_advanced_cover(room, "cage_low_answer", -1.4, 2.2, 4.2, 1.2, height=0.96, mat_key="steel", role="player_answer_cover")
    add_advanced_cover(room, "cage_west_peek_cover", -12.5, -11.2, 3.2, 1.2, height=1.08, mat_key="steel", role="enemy_peek_cover")
    add_advanced_enemy(room, "west_cage_shield", -12.4, -10.2, "shield", "shielded", "riot_screen_push")
    add_advanced_enemy(room, "east_cage_cross", 10.8, 8.8, "anchor", "heavy", "hold_angle")

    room = by_id["sortation_hall"]
    add_advanced_wall(room, "sorter_s_bend_north", -6.8, 10.8, 13.0, 0.5, mat_key="wall_dark", role="final_s_bend_partition")
    add_advanced_wall(room, "sorter_s_bend_south", 6.8, -12.0, 13.0, 0.5, mat_key="wall_dark", role="final_s_bend_partition")
    add_advanced_cover(room, "conveyor_center_answer", 0.0, -1.5, 4.8, 1.2, height=0.98, mat_key="steel", role="player_answer_cover")
    add_advanced_cover(room, "exit_cross_headglitch", -10.8, -16.0, 3.6, 1.0, height=0.95, mat_key="wood", role="enemy_headglitch_cover")
    add_advanced_route_pad(room, "exit_commit_pull", 0.0, -18.0, 2.4, 5.5, mat_key="hazard", role="exit_reveal")
    add_advanced_enemy(room, "conveyor_suppressor", -12.0, -15.0, "anchor", "heavy", "suppress_lane")
    add_advanced_enemy(room, "sorter_breacher", 10.5, 13.2, "breacher", "heavy", "rush_when_player_reloads")

    room = by_id["foreman_catwalk"]
    add_advanced_wall(room, "catwalk_office_back", -7.5, 8.0, 12.0, 0.5, mat_key="wall_dark", role="catwalk_office_partition")
    add_advanced_wall(room, "catwalk_office_return", -1.2, 0.6, 0.5, 14.0, mat_key="wall_dark", role="catwalk_office_partition")
    add_advanced_cover(room, "foreman_inner_desk_cover", -7.2, -5.4, 4.6, 1.2, height=1.0, mat_key="wood", role="sniper_overlook_cover")
    add_advanced_cover(room, "catwalk_east_railing_peek", 11.5, 9.6, 2.6, 1.1, height=1.05, mat_key="steel", role="enemy_peek_cover")
    add_advanced_window(room, "catwalk_inner_glass", -1.0, 4.2, 7.0, "Z", "catwalk_nested_office_preview", warm=True, sill=3.65, head=5.2)
    add_advanced_enemy(room, "inner_office_marksman", -8.8, -4.0, "sniper", "marksman", "sniper_relocate")
    add_advanced_enemy(room, "east_rail_flanker", 11.8, 9.2, "flanker", "pistolero", "flank_after_contact")

    MANIFEST["features"].append({
        "type": "advanced_linear_tactical_pass",
        "rooms": len(ROOMS),
        "summary": "Nested sub-rooms, dogleg corridors, peek cover, blind angles, and progressive enemy markers inside the original B01 megaplex footprint.",
    })


def progression_col():
    return COLLECTIONS["10_progression_room_clear_layer"]


def add_progression_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="progression_occluder", height=None):
    x, z = room_pos(room, dx, dz)
    h = RH if height is None else height
    obj = add_box(
        f"progression_{room['id']}_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        progression_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"progression_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "progression_room_clear_layer",
        },
        0.016,
    )
    add_box(
        f"progression_{room['id']}_{name}_base",
        x,
        WT + 0.12,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.13,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel"],
        progression_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "progression_base_trim"},
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_progression_halfwall(room, name, dx, dz, sx, sz, height=1.55, mat_key="steel", role="progression_halfwall"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"progression_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        progression_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"progression_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "progression_room_clear_layer",
        },
        0.018,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_progression_door_leaf(room, name, dx, dz, sx, sz, mat_key="steel", role="half_open_door_leaf"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"progression_{room['id']}_{name}",
        x,
        WT + 1.35,
        z,
        sx,
        2.7,
        sz,
        MATS[mat_key],
        progression_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"progression_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "progression_room_clear_layer",
        },
        0.012,
    )


def add_progression_route(room, name, dx, dz, sx, sz, mat_key="hazard", role="progression_route_read"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"progression_{room['id']}_{name}",
        x,
        WT + 0.034,
        z,
        sx,
        0.03,
        sz,
        MATS[mat_key],
        progression_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"progression_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "progression_room_clear_layer",
        },
        0.002,
    )


def add_progression_light_card(room, name, dx, dz, sx, sz, mat_key="hazard", role="progression_landmark_light"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"progression_{room['id']}_{name}",
        x,
        WT + 2.86,
        z,
        sx,
        0.12,
        sz,
        MATS[mat_key],
        progression_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"progression_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "progression_room_clear_layer",
        },
        0.005,
    )


def add_progression_enemy(room, name, dx, dz, role, enemy_type, behavior, wave="progression"):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_PROG_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": wave,
        "layoutPass": "progression_room_clear_layer",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.029,
        z,
        0.43,
        0.033,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": wave})


def add_elite_progression_pass():
    by_id = {room["id"]: room for room in ROOMS}

    # Front zone: teach the language. Clean one- and two-angle decisions.
    room = by_id["customs_entry"]
    add_progression_wall(room, "entry_right_baffle", 11.8, -3.6, 0.46, 9.4, role="early_check_right_baffle")
    add_progression_halfwall(room, "passport_knee_line", -2.2, 7.7, 6.8, 0.82, height=1.22, mat_key="wood", role="early_player_answer_cover")
    add_progression_door_leaf(room, "interview_half_open_leaf", -6.0, -4.9, 0.34, 2.5, mat_key="steel")
    add_progression_route(room, "section_one_route_ticks", 2.4, -15.8, 0.42, 5.2, mat_key="hazard", role="section_one_route_ticks")
    add_progression_light_card(room, "customs_first_threshold_light", 0.0, -17.9, 5.2, 0.10, mat_key="hazard")
    add_progression_enemy(room, "passport_low_left", -5.8, 8.2, "lookout", "scout", "peek_from_cover")

    room = by_id["receiving_yard"]
    add_progression_wall(room, "dock_south_sight_cut", 4.2, -13.0, 9.4, 0.46, role="early_sightline_cut")
    add_progression_halfwall(room, "rain_apron_answer", 2.4, 3.2, 5.4, 0.9, height=1.18, mat_key="steel", role="player_answer_cover")
    add_progression_door_leaf(room, "yard_service_door_leaf", 15.5, 6.8, 0.34, 3.2, mat_key="steel")
    add_progression_enemy(room, "rain_apron_right", 9.0, 5.2, "anchor", "soldier", "hold_angle")

    room = by_id["container_gate"]
    add_progression_wall(room, "container_short_left_block", -12.4, 12.0, 8.2, 0.46, role="early_container_reveal_cut")
    add_progression_wall(room, "container_short_right_block", 12.4, -10.8, 8.2, 0.46, role="early_container_reveal_cut")
    add_progression_halfwall(room, "gate_crossing_answer", -1.0, 4.0, 5.4, 0.9, height=1.18, mat_key="steel", role="crossing_answer_cover")
    add_progression_route(room, "blue_gate_turn_read", 8.8, -16.2, 0.42, 4.4, mat_key="paint_cyan", role="side_path_route_read")
    add_progression_enemy(room, "container_backstop_cross", 12.8, -12.4, "flanker", "pistolero", "flank_after_contact")

    room = by_id["forklift_repair"]
    add_progression_wall(room, "repair_locker_row", 3.0, 12.4, 11.8, 0.46, role="locker_room_cut")
    add_progression_wall(room, "repair_compressor_blind", 13.8, -1.0, 0.46, 9.8, role="compressor_blind_angle")
    add_progression_halfwall(room, "repair_middle_answer", -1.5, -9.5, 5.6, 0.9, height=1.2, mat_key="wood", role="player_answer_cover")
    add_progression_enemy(room, "compressor_right_peek", 14.8, -5.4, "breacher", "heavy", "ambush_on_crossing")

    room = by_id["intake_court"]
    add_progression_wall(room, "intake_reveal_backstop", -11.0, 14.0, 9.4, 0.46, role="intake_backstop_occluder")
    add_progression_wall(room, "intake_crossing_screen", 13.8, -13.4, 4.8, 0.46, role="intake_crossing_screen")
    add_progression_halfwall(room, "intake_center_split_cover", 0.0, 8.6, 5.2, 0.9, height=1.18, mat_key="wood", role="center_lane_cover")
    add_progression_light_card(room, "intake_amber_next_threshold", 0.0, -18.2, 7.2, 0.10, mat_key="hazard")
    add_progression_enemy(room, "intake_backstop_anchor", -12.4, 13.2, "anchor", "soldier", "hold_angle")

    room = by_id["security_screening"]
    add_progression_wall(room, "screening_bag_check_nook", -13.8, 9.8, 0.46, 10.4, role="bag_check_nook_wall")
    add_progression_wall(room, "screening_exit_sight_cut", 4.0, -14.5, 10.4, 0.46, role="screening_exit_sight_cut")
    add_progression_halfwall(room, "screening_scanner_answer", 1.8, 4.0, 5.0, 0.9, height=1.18, mat_key="cyan", role="scanner_answer_cover")
    add_progression_enemy(room, "bag_check_left", -14.5, 7.2, "lookout", "scout", "peek_from_cover")

    # Middle zone: more nested and hostile. Every room has a crossing or delayed reveal.
    room = by_id["manifest_office"]
    add_progression_wall(room, "records_room_inner_return", -13.7, -6.0, 0.46, 10.0, role="records_room_inner_return")
    add_progression_wall(room, "manifest_exit_cut", 11.0, 12.5, 9.6, 0.46, role="manifest_exit_cut")
    add_progression_halfwall(room, "records_low_files", -10.2, 1.0, 5.2, 0.9, height=1.2, mat_key="wood", role="records_room_cover")
    add_progression_route(room, "manifest_objective_floor_ticks", 5.0, -10.6, 0.42, 5.8, mat_key="hazard", role="objective_exit_route")
    add_progression_enemy(room, "records_deep_peek", -13.8, -4.2, "lookout", "scout", "peek_from_cover")

    room = by_id["warehouse_spine"]
    add_progression_wall(room, "warehouse_lateral_gate_north", -13.8, 2.0, 0.46, 14.0, role="warehouse_lateral_gate")
    add_progression_wall(room, "warehouse_lateral_gate_south", 13.8, -3.0, 0.46, 14.0, role="warehouse_lateral_gate")
    add_progression_halfwall(room, "warehouse_split_answer", 0.0, -1.0, 6.0, 0.9, height=1.2, mat_key="steel", role="warehouse_player_answer")
    add_progression_light_card(room, "warehouse_cyan_picker_landmark", 0.0, -18.4, 8.0, 0.12, mat_key="cyan")
    add_progression_enemy(room, "warehouse_deep_crossfire", 13.2, -7.8, "anchor", "heavy", "suppress_lane")

    room = by_id["hazmat_barrels"]
    add_progression_wall(room, "hazmat_quarantine_choke", 0.8, 14.0, 12.0, 0.46, role="hazmat_quarantine_choke")
    add_progression_wall(room, "hazmat_side_lab_return", 14.0, 2.0, 0.46, 10.5, role="hazmat_side_lab_return")
    add_progression_halfwall(room, "hazmat_mid_answer", -4.6, -8.8, 4.8, 0.92, height=1.18, mat_key="red", role="hazmat_answer_cover")
    add_progression_route(room, "red_pressure_path", 7.8, -16.4, 0.42, 4.6, mat_key="red", role="pressure_route_read")
    add_progression_enemy(room, "side_lab_flush", 14.5, 2.6, "demolitions", "demolitions", "grenade_flush_cover")

    room = by_id["cold_storage"]
    add_progression_wall(room, "cold_freezer_threshold", 0.0, 13.8, 10.8, 0.46, role="cold_freezer_threshold")
    add_progression_wall(room, "cold_side_blind_return", -13.7, -2.0, 0.46, 11.0, role="cold_side_blind_return")
    add_progression_halfwall(room, "cold_low_freezer_box", 4.8, -10.6, 5.0, 0.9, height=1.18, mat_key="steel", role="cold_answer_cover")
    add_progression_enemy(room, "cold_threshold_hold", -12.8, -2.8, "anchor", "soldier", "hold_angle")

    room = by_id["alarm_relay"]
    add_progression_wall(room, "relay_double_clear_inner", 15.0, 13.0, 0.46, 4.2, role="relay_double_clear_inner")
    add_progression_wall(room, "relay_exit_baffle", -2.0, -14.5, 10.0, 0.46, role="relay_exit_baffle")
    add_progression_halfwall(room, "relay_hold_answer", -4.2, -5.8, 5.6, 0.9, height=1.18, mat_key="cyan", role="objective_hold_cover")
    add_progression_light_card(room, "relay_objective_light_bar", 0.0, 10.6, 7.6, 0.12, mat_key="cyan")
    add_progression_enemy(room, "relay_inner_closet_guard", 15.8, 11.0, "anchor", "heavy", "guard_objective")

    room = by_id["boiler_pump"]
    add_progression_wall(room, "boiler_control_room", 11.4, 8.2, 0.46, 11.5, role="boiler_control_room_wall")
    add_progression_wall(room, "boiler_pipe_cut", 4.4, -14.2, 10.2, 0.46, role="boiler_pipe_cut")
    add_progression_halfwall(room, "boiler_pump_answer", 4.0, 4.8, 5.4, 0.9, height=1.18, mat_key="steel", role="boiler_answer_cover")
    add_progression_enemy(room, "control_room_peek", 12.4, 8.0, "lookout", "scout", "peek_from_cover")

    # Final zone: layered final commitment, side threat, then exit reveal.
    room = by_id["loading_cage"]
    add_progression_wall(room, "cage_precommit_screen", 0.0, 13.8, 12.0, 0.46, role="cage_precommit_screen")
    add_progression_wall(room, "cage_left_reconnect_return", -13.6, 1.4, 0.46, 11.0, role="cage_left_reconnect_return")
    add_progression_halfwall(room, "cage_center_answer_two", 3.2, -6.4, 5.6, 0.9, height=1.18, mat_key="steel", role="cage_player_answer")
    add_progression_enemy(room, "left_reconnect_peek", -14.2, 0.5, "shield", "shielded", "riot_screen_push")

    room = by_id["sortation_hall"]
    add_progression_wall(room, "sorter_exit_antechamber_w", -13.2, -8.0, 0.46, 13.0, role="exit_antechamber_wall")
    add_progression_wall(room, "sorter_exit_antechamber_e", 13.2, 5.8, 0.46, 13.0, role="exit_antechamber_wall")
    add_progression_wall(room, "sorter_exit_final_cut_w", -8.4, -17.2, 4.6, 0.46, role="exit_final_sight_cut")
    add_progression_wall(room, "sorter_exit_final_cut_e", 8.4, -17.2, 4.6, 0.46, role="exit_final_sight_cut")
    add_progression_halfwall(room, "sorter_final_answer", -1.0, 9.8, 5.6, 0.9, height=1.18, mat_key="steel", role="final_player_answer")
    add_progression_light_card(room, "sorter_exit_landmark_light", 0.0, -20.0, 9.0, 0.12, mat_key="hazard")
    add_progression_enemy(room, "exit_antechamber_heavy", 12.6, 5.8, "anchor", "heavy", "hold_angle")

    room = by_id["foreman_catwalk"]
    add_progression_wall(room, "foreman_private_office_return", 13.4, -1.0, 0.46, 12.0, role="foreman_private_office_return")
    add_progression_wall(room, "foreman_catwalk_backstop", 0.0, 14.5, 12.0, 0.46, role="foreman_catwalk_backstop")
    add_progression_halfwall(room, "foreman_overlook_answer", 3.6, -9.8, 5.2, 0.9, height=1.18, mat_key="wood", role="overlook_answer_cover")
    add_progression_route(room, "foreman_exit_hash", -8.0, -16.0, 0.42, 5.8, mat_key="hazard", role="final_route_hash")
    add_progression_enemy(room, "private_office_relocate", 14.0, -2.0, "sniper", "marksman", "sniper_relocate")

    MANIFEST["features"].append({
        "type": "elite_progression_room_clear_pass",
        "rooms": len(ROOMS),
        "summary": "Second-pass breach thresholds, half-open door leaves, off-axis reveals, and extra progression enemy markers for a more deliberate Level 1 clear.",
    })


def guided_col():
    return COLLECTIONS["11_guided_maze_corridor_shell"]


def add_guided_wall_abs(name, x, z, sx, sz, room_id, mat_key="wall_dark", role="guided_maze_wall", height=None):
    h = RH if height is None else height
    obj = add_box(
        f"guided_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        guided_col(),
        {
            "collision": "wall_aabb",
            "roomId": room_id,
            "geometryId": f"guided_{name}",
            "floorplanRole": role,
            "layoutPass": "guided_maze_corridor_shell",
        },
        0.016,
    )
    add_box(
        f"guided_{name}_base_trim",
        x,
        WT + 0.13,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.14,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel"],
        guided_col(),
        {
            "collision": "decorative_only",
            "roomId": room_id,
            "floorplanRole": "guided_maze_base_trim",
            "layoutPass": "guided_maze_corridor_shell",
        },
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room_id, "x": x, "z": z})
    return obj


def add_guided_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="guided_maze_wall", height=None):
    x, z = room_pos(room, dx, dz)
    return add_guided_wall_abs(f"{room['id']}_{name}", x, z, sx, sz, room["id"], mat_key, role, height)


def add_guided_route_mark(room, name, dx, dz, sx, sz, mat_key="paint_cyan", role="guided_main_route_mark"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"guided_{room['id']}_{name}",
        x,
        WT + 0.037,
        z,
        sx,
        0.032,
        sz,
        MATS[mat_key],
        guided_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"guided_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "guided_maze_corridor_shell",
        },
        0.002,
    )


def shrink_side_room_connector(x, z, room_id, name, keep_width=6.2, original_width=8.2):
    plug_len = (original_width - keep_width) / 2
    if plug_len <= 0:
        return
    offset = keep_width / 2 + plug_len / 2
    add_guided_wall_abs(f"{name}_north_jamb", x, z + offset, 0.68, plug_len, room_id, "wall", "side_room_door_jamb")
    add_guided_wall_abs(f"{name}_south_jamb", x, z - offset, 0.68, plug_len, room_id, "wall", "side_room_door_jamb")
    add_box(
        f"guided_{name}_door_header",
        x,
        WT + 2.94,
        z,
        0.22,
        0.20,
        keep_width + 0.45,
        MATS["hazard"],
        guided_col(),
        {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "guided_side_room_header"},
        0.005,
    )


def shrink_main_threshold(x, z, room_id, name, keep_width=6.8, original_width=8.5):
    plug_len = (original_width - keep_width) / 2
    if plug_len <= 0:
        return
    offset = keep_width / 2 + plug_len / 2
    add_guided_wall_abs(f"{name}_west_jamb", x - offset, z, plug_len, 0.68, room_id, "wall", "main_spine_threshold_jamb")
    add_guided_wall_abs(f"{name}_east_jamb", x + offset, z, plug_len, 0.68, room_id, "wall", "main_spine_threshold_jamb")
    add_box(
        f"guided_{name}_threshold_header",
        x,
        WT + 3.02,
        z,
        keep_width + 0.55,
        0.20,
        0.22,
        MATS["hazard"],
        guided_col(),
        {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "guided_main_threshold_header"},
        0.005,
    )


def add_guided_maze_corridor_pass():
    by_id = {room["id"]: room for room in ROOMS}
    mandatory_weave_rooms = {cfg["sideRoom"] for cfg in SIDE_WEAVE_CONNECTORS.values()}

    # Close alternate north/south highways in the side columns. Side rooms are
    # now cleared from the center spine and cannot become bypass corridors.
    for z in [66.0, 22.0, -22.0, -66.0]:
        for col_idx, x in [(0, -38.0), (2, 38.0)]:
            add_guided_wall_abs(
                f"sealed_side_column_threshold_col{col_idx}_z{z:+.0f}",
                x,
                z,
                9.1,
                0.72,
                f"guided_side_column_seal_{col_idx}_{z:+.0f}",
                "wall_dark",
                "sealed_side_column_threshold",
            )

    # The center route remains open, but its oversized rollup gaps read as real
    # doorways instead of broad-open room cuts.
    for z, room_id in [(66.0, "customs_entry"), (22.0, "warehouse_spine"), (-22.0, "alarm_relay"), (-66.0, "sortation_hall")]:
        shrink_main_threshold(0.0, z, room_id, f"main_spine_threshold_z{z:+.0f}")

    # Shrink all center-to-side connectors so every side room has a readable
    # breach point rather than a wall-length opening.
    center_by_row = {room["row"]: room for room in ROOMS if room["col"] == 1}
    for row_idx, z in enumerate(ROWS):
        center_room = center_by_row[row_idx]
        shrink_side_room_connector(-19.0, z, center_room["id"], f"row{row_idx}_west_side_room_breach")
        shrink_side_room_connector(19.0, z, center_room["id"], f"row{row_idx}_east_side_room_breach")

    # Close the side connector opposite each mandatory weave. This removes the
    # accidental "choose either annex" feel and makes the lane switches read as
    # authored progression beats: east, west, east, west.
    for (center_id, side), cfg in SIDE_WEAVE_CONNECTORS.items():
        center_room = by_id[center_id]
        row_z = ROWS[center_room["row"]]
        if side == "east":
            add_guided_wall_abs(f"{center_id}_west_bypass_sealed", -19.0, row_z, 0.76, 8.9, center_id, "wall_dark", "non_route_side_breach_seal")
        else:
            add_guided_wall_abs(f"{center_id}_east_bypass_sealed", 19.0, row_z, 0.76, 8.9, center_id, "wall_dark", "non_route_side_breach_seal")

    # The opening row starts as a controlled center insertion, not a lateral
    # choice. These bay doors remain readable as side rooms but are not route
    # exits until later map variants explicitly use them.
    add_guided_wall_abs("customs_entry_west_start_bay_sealed", -19.0, ROWS[0], 0.76, 8.9, "customs_entry", "wall_dark", "non_route_side_breach_seal")
    add_guided_wall_abs("customs_entry_east_start_bay_sealed", 19.0, ROWS[0], 0.76, 8.9, "customs_entry", "wall_dark", "non_route_side_breach_seal")

    # Close exterior service cuts that previously made the side rooms feel like
    # alternate exits. They remain visually present as locked industrial doors.
    add_guided_wall_abs("locked_west_service_outer_door", X_MIN, -44.0, 0.72, 9.4, "cold_storage", "steel", "locked_service_door")
    add_guided_wall_abs("locked_east_service_outer_door", X_MAX, -44.0, 0.72, 9.4, "boiler_pump", "steel", "locked_service_door")

    # Main spine: repeated alternating baffles create a legible room-clearing
    # rhythm from north spawn to south exit.
    spine_baffles = {
        "customs_entry": [
            ("spawn_west_guide", -10.4, 99.0, 0.56, 18.0),
            ("first_check_left_cut", -4.0, 95.5, 12.0, 0.56),
            ("second_check_right_cut", 4.0, 82.5, 12.0, 0.56),
            ("south_east_guide", 10.4, 75.0, 0.56, 18.0),
        ],
        "intake_court": [
            ("north_right_cut", 5.4, 57.0, 12.8, 0.56),
            ("mid_left_cut", -5.4, 44.0, 12.8, 0.56),
            ("south_right_cut", 5.4, 31.0, 12.8, 0.56),
            ("left_lane_backstop", -12.2, 38.0, 0.56, 18.0),
        ],
        "warehouse_spine": [
            ("north_left_cut", -5.5, 15.2, 13.0, 0.56),
            ("middle_right_lane_keeper", -5.5, 4.2, 13.0, 0.56),
            ("middle_left_cut", -5.5, -7.4, 13.0, 0.56),
            ("south_right_cut", 5.5, -16.4, 13.0, 0.56),
        ],
        "alarm_relay": [
            ("relay_north_right_cut", 5.4, -30.5, 12.8, 0.56),
            ("relay_mid_left_cut", -5.4, -42.0, 12.8, 0.56),
            ("relay_south_right_cut", 5.4, -55.0, 12.8, 0.56),
            ("relay_objective_west_guide", -12.3, -49.0, 0.56, 18.0),
        ],
        "sortation_hall": [
            ("sorter_entry_left_cut", -5.4, -75.0, 12.8, 0.56),
            ("sorter_middle_right_cut", 5.4, -88.0, 12.8, 0.56),
            ("sorter_exit_left_cut", -5.4, -101.0, 12.8, 0.56),
            ("sorter_exit_east_guide", 12.3, -96.0, 0.56, 18.0),
        ],
    }
    for room_id, walls in spine_baffles.items():
        room = by_id[room_id]
        for name, dx, dz_world, sx, sz in walls:
            add_guided_wall(room, name, dx, dz_world - ROWS[room["row"]], sx, sz, "wall_dark", "main_spine_maze_baffle")
        add_guided_route_mark(room, "main_spine_floor_ticks", 0.0, 0.0, 1.05, 30.0, "paint_cyan")

    # Side rooms receive consistent L-shaped entry pockets. This turns each
    # branch into a small clear instead of a random open annex.
    left_side_rooms = ["receiving_yard", "forklift_repair", "manifest_office", "cold_storage", "loading_cage"]
    right_side_rooms = ["container_gate", "security_screening", "hazmat_barrels", "boiler_pump", "foreman_catwalk"]
    for room_id in left_side_rooms:
        room = by_id[room_id]
        if room_id not in mandatory_weave_rooms:
            add_guided_wall(room, "side_entry_return", 11.2, 5.8, 0.56, 15.0, "wall_dark", "side_room_entry_return")
            add_guided_wall(room, "deep_clear_backstop", -1.4, -12.6, 17.0, 0.56, "wall_dark", "side_room_deep_clear_backstop")
        add_guided_route_mark(room, "side_room_return_hash", 14.6, 0.0, 0.42, 4.8, "hazard", "side_room_route_hash")
    for room_id in right_side_rooms:
        room = by_id[room_id]
        if room_id not in mandatory_weave_rooms:
            add_guided_wall(room, "side_entry_return", -11.2, -5.8, 0.56, 15.0, "wall_dark", "side_room_entry_return")
            add_guided_wall(room, "deep_clear_backstop", 1.4, 12.6, 17.0, 0.56, "wall_dark", "side_room_deep_clear_backstop")
        add_guided_route_mark(room, "side_room_return_hash", -14.6, 0.0, 0.42, 4.8, "hazard", "side_room_route_hash")

    MANIFEST["features"].append({
        "type": "guided_maze_corridor_pass",
        "rooms": len(ROOMS),
        "mainRoute": ["customs_entry", "intake_court", "warehouse_spine", "alarm_relay", "sortation_hall"],
        "summary": "Topdown-authored corridor shell: center-spine progression, sealed side-column bypasses, narrowed doorways, and L-shaped side-room clears.",
    })


def setpiece_col():
    return COLLECTIONS["12_setpiece_room_clear_overhaul"]


def add_setpiece_wall_abs(name, x, z, sx, sz, room_id, mat_key="wall_dark", role="setpiece_wall", height=None):
    h = RH if height is None else height
    obj = add_box(
        f"setpiece_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        setpiece_col(),
        {
            "collision": "wall_aabb",
            "roomId": room_id,
            "geometryId": f"setpiece_{name}",
            "floorplanRole": role,
            "layoutPass": "setpiece_room_clear_overhaul",
        },
        0.016,
    )
    add_box(
        f"setpiece_{name}_kick_trim",
        x,
        WT + 0.14,
        z,
        sx + (0.06 if sx < sz else 0.0),
        0.15,
        sz + (0.06 if sz <= sx else 0.0),
        MATS["steel_edge"],
        setpiece_col(),
        {
            "collision": "decorative_only",
            "roomId": room_id,
            "floorplanRole": "setpiece_wall_trim",
            "layoutPass": "setpiece_room_clear_overhaul",
        },
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room_id, "x": x, "z": z})
    return obj


def add_setpiece_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="setpiece_wall", height=None):
    x, z = room_pos(room, dx, dz)
    return add_setpiece_wall_abs(f"{room['id']}_{name}", x, z, sx, sz, room["id"], mat_key, role, height)


def add_setpiece_cover(room, name, dx, dz, sx, sz, height=1.12, mat_key="steel", role="setpiece_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"setpiece_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        setpiece_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"setpiece_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "setpiece_room_clear_overhaul",
        },
        0.02,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_setpiece_floor_mark(room, name, dx, dz, sx, sz, mat_key="hazard", role="setpiece_route_mark"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"setpiece_{room['id']}_{name}",
        x,
        WT + 0.039,
        z,
        sx,
        0.034,
        sz,
        MATS[mat_key],
        setpiece_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"setpiece_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "setpiece_room_clear_overhaul",
        },
        0.002,
    )


def add_setpiece_light_bar(room, name, dx, dz, sx, sz, mat_key="hazard", role="setpiece_landmark_light"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"setpiece_{room['id']}_{name}",
        x,
        WT + 3.18,
        z,
        sx,
        0.14,
        sz,
        MATS[mat_key],
        setpiece_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"setpiece_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "setpiece_room_clear_overhaul",
        },
        0.005,
    )


def add_setpiece_door_frame(room, name, dx, dz, axis="X", width=4.2, mat_key="hazard", role="setpiece_breach_frame"):
    x, z = room_pos(room, dx, dz)
    sx, sz = (width, 0.20) if axis == "X" else (0.20, width)
    add_box(
        f"setpiece_{room['id']}_{name}_header",
        x,
        WT + 3.05,
        z,
        sx,
        0.22,
        sz,
        MATS[mat_key],
        setpiece_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": role, "layoutPass": "setpiece_room_clear_overhaul"},
        0.005,
    )
    if axis == "X":
        for ox in [-width / 2, width / 2]:
            add_setpiece_wall(room, f"{name}_jamb_{ox:+.1f}", dx + ox, dz, 0.22, 0.34, mat_key="steel", role="setpiece_breach_jamb", height=2.8)
    else:
        for oz in [-width / 2, width / 2]:
            add_setpiece_wall(room, f"{name}_jamb_{oz:+.1f}", dx, dz + oz, 0.34, 0.22, mat_key="steel", role="setpiece_breach_jamb", height=2.8)


def add_setpiece_enemy(room, name, dx, dz, role, enemy_type, behavior, wave="setpiece"):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_SET_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": wave,
        "layoutPass": "setpiece_room_clear_overhaul",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.031,
        z,
        0.46,
        0.033,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": wave})


def add_setpiece_room_clear_overhaul_pass():
    by_id = {room["id"]: room for room in ROOMS}

    # Main route act beats. These are deliberately named and repeated so the
    # topdown reads as authored setpieces, not a scatter of props.
    room = by_id["customs_entry"]
    add_setpiece_wall(room, "sally_port_left_locker", -7.6, 15.2, 0.52, 8.4, role="act1_sally_port_wall")
    add_setpiece_wall(room, "sally_port_right_locker", 7.6, 9.0, 0.52, 8.8, role="act1_sally_port_wall")
    add_setpiece_wall(room, "passport_backstop_left", -9.2, -3.0, 7.0, 0.52, role="act1_passport_backstop")
    add_setpiece_wall(room, "passport_backstop_right", 9.2, -9.2, 7.0, 0.52, role="act1_passport_backstop")
    add_setpiece_cover(room, "passport_answer_counter", -2.7, 1.8, 3.0, 0.95, height=1.02, mat_key="wood", role="act1_player_answer_cover")
    add_setpiece_door_frame(room, "sally_exit_frame", 0.0, -15.7, axis="X", width=4.1, mat_key="hazard", role="act1_exit_breach_frame")
    add_setpiece_light_bar(room, "act1_gold_threshold", 0.0, -16.8, 5.4, 0.14, mat_key="hazard")
    add_setpiece_enemy(room, "passport_hidden_right", 10.8, -6.6, "lookout", "scout", "peek_from_cover")

    room = by_id["intake_court"]
    add_setpiece_wall(room, "intake_entry_airlock_w", -8.2, 17.4, 0.52, 7.2, role="act2_airlock_wall")
    add_setpiece_wall(room, "intake_entry_airlock_e", 8.2, 11.8, 0.52, 7.2, role="act2_airlock_wall")
    add_setpiece_wall(room, "branch_choice_west_shutter", -16.2, 1.8, 0.52, 6.4, role="act2_branch_choice_wall")
    add_setpiece_wall(room, "branch_choice_east_shutter", 16.2, -6.0, 0.52, 6.4, role="act2_branch_choice_wall")
    add_setpiece_cover(room, "central_crash_barrier", 0.0, -0.8, 5.6, 1.05, height=1.0, mat_key="steel", role="act2_crossing_answer_cover")
    add_setpiece_floor_mark(room, "west_clear_return_chevron", -16.2, -10.0, 0.44, 5.2, mat_key="cyan", role="branch_return_chevron")
    add_setpiece_floor_mark(room, "east_clear_return_chevron", 16.2, 10.0, 0.44, 5.2, mat_key="cyan", role="branch_return_chevron")
    add_setpiece_enemy(room, "branch_choice_crossfire", 14.0, 7.8, "flanker", "pistolero", "flank_after_contact")

    room = by_id["warehouse_spine"]
    add_setpiece_wall(room, "rack_lock_left_a", -11.8, 13.6, 0.52, 11.5, role="act3_rack_maze_lock_wall")
    add_setpiece_wall(room, "rack_lock_right_a", 11.8, 5.0, 0.52, 12.0, role="act3_rack_maze_lock_wall")
    add_setpiece_wall(room, "rack_lock_left_b", -11.8, -6.8, 0.52, 12.0, role="act3_rack_maze_lock_wall")
    add_setpiece_wall(room, "rack_lock_right_b", 11.8, -15.0, 0.52, 9.5, role="act3_rack_maze_lock_wall")
    add_setpiece_wall(room, "rack_cross_cut_north", -2.8, 10.8, 9.0, 0.52, role="act3_rack_cross_cut")
    add_setpiece_wall(room, "rack_cross_cut_south", 2.8, -11.0, 9.0, 0.52, role="act3_rack_cross_cut")
    add_setpiece_cover(room, "forklift_collision_cover", 0.0, 2.0, 4.8, 1.15, height=1.06, mat_key="wood", role="act3_mid_maze_cover")
    add_setpiece_light_bar(room, "act3_cyan_picker_light", 0.0, -18.0, 6.2, 0.14, mat_key="cyan")
    add_setpiece_enemy(room, "rack_deep_left_hold", -13.0, -13.8, "anchor", "heavy", "suppress_lane")

    room = by_id["alarm_relay"]
    add_setpiece_wall(room, "objective_booth_north_west_leaf", -5.9, 13.4, 1.2, 0.52, mat_key="wall_dark", role="act4_objective_booth_shell")
    add_setpiece_wall(room, "objective_booth_north_east_leaf", 2.9, 13.4, 7.2, 0.52, mat_key="wall_dark", role="act4_objective_booth_shell")
    add_setpiece_wall(room, "objective_booth_west", -8.4, 2.6, 0.52, 14.5, mat_key="wall_dark", role="act4_objective_booth_shell")
    add_setpiece_wall(room, "objective_booth_east", 8.4, -6.2, 0.52, 14.5, mat_key="wall_dark", role="act4_objective_booth_shell")
    add_setpiece_cover(room, "relay_breach_answer_left", -3.6, -12.0, 4.6, 1.05, height=1.0, mat_key="cyan", role="act4_objective_answer_cover")
    add_setpiece_cover(room, "relay_breach_answer_right", 4.1, 7.0, 1.35, 0.9, height=1.0, mat_key="cyan", role="act4_objective_answer_cover")
    add_setpiece_door_frame(room, "objective_booth_south_frame", 0.0, -16.2, axis="X", width=4.0, mat_key="cyan", role="act4_objective_exit_frame")
    add_setpiece_light_bar(room, "act4_cyan_objective_bar", 0.0, 12.2, 7.6, 0.14, mat_key="cyan")
    add_setpiece_enemy(room, "objective_booth_close_right", 9.8, -3.8, "breacher", "heavy", "ambush_on_crossing")

    room = by_id["sortation_hall"]
    add_setpiece_wall(room, "sorter_commit_west_rail", -8.0, 15.0, 0.52, 9.0, role="act5_sorter_commit_wall")
    add_setpiece_wall(room, "sorter_commit_east_rail", 8.0, 5.2, 0.52, 10.0, role="act5_sorter_commit_wall")
    add_setpiece_wall(room, "sorter_mid_gate_left", -4.2, -3.8, 8.5, 0.52, role="act5_sorter_gate_wall")
    add_setpiece_wall(room, "sorter_mid_gate_right", 4.2, -13.8, 8.5, 0.52, role="act5_sorter_gate_wall")
    add_setpiece_wall(room, "exit_squeeze_west", -10.4, -18.0, 3.1, 0.52, role="act5_exit_squeeze_wall")
    add_setpiece_wall(room, "exit_squeeze_east", 10.4, -18.0, 3.1, 0.52, role="act5_exit_squeeze_wall")
    add_setpiece_cover(room, "sorter_final_player_answer", 0.0, -5.0, 5.0, 1.1, height=1.05, mat_key="steel", role="act5_final_answer_cover")
    add_setpiece_light_bar(room, "act5_exit_gold_bar", 0.0, -19.2, 7.8, 0.14, mat_key="hazard")
    add_setpiece_enemy(room, "exit_close_heavy_left", -12.6, -11.8, "anchor", "heavy", "hold_angle")

    # Branch rooms: every optional clear gets a nested pocket and a return read.
    left_branches = ["receiving_yard", "forklift_repair", "manifest_office", "cold_storage", "loading_cage"]
    right_branches = ["container_gate", "security_screening", "hazmat_barrels", "boiler_pump", "foreman_catwalk"]
    for idx, room_id in enumerate(left_branches):
        room = by_id[room_id]
        mat_key = "cold" if room_id == "cold_storage" else ("red" if room_id in ("manifest_office", "loading_cage") else "hazard")
        add_setpiece_wall(room, "branch_nested_room_back", -12.0, 11.8, 10.0, 0.52, role="branch_nested_room_back_wall")
        add_setpiece_wall(room, "branch_nested_room_return", -6.6, 4.8, 0.52, 13.0, role="branch_nested_room_return_wall")
        add_setpiece_cover(room, "branch_return_answer_cover", 8.4, -9.4, 4.2, 1.05, height=1.0, mat_key="wood", role="branch_return_answer_cover")
        add_setpiece_floor_mark(room, "branch_done_hash", 14.2, -15.2, 0.46, 4.6, mat_key=mat_key, role="branch_done_hash")
        if idx in (0, 2, 4):
            add_setpiece_enemy(room, "nested_branch_close_left", -13.2, 6.8, "lookout", "scout", "peek_from_cover")
    for idx, room_id in enumerate(right_branches):
        room = by_id[room_id]
        mat_key = "red" if room_id in ("hazmat_barrels", "boiler_pump") else ("cyan" if room_id in ("security_screening", "foreman_catwalk") else "hazard")
        add_setpiece_wall(room, "branch_nested_room_back", 12.0, -11.8, 10.0, 0.52, role="branch_nested_room_back_wall")
        add_setpiece_wall(room, "branch_nested_room_return", 6.6, -4.8, 0.52, 13.0, role="branch_nested_room_return_wall")
        add_setpiece_cover(room, "branch_return_answer_cover", -8.4, 9.4, 4.2, 1.05, height=1.0, mat_key="steel", role="branch_return_answer_cover")
        add_setpiece_floor_mark(room, "branch_done_hash", -14.2, 15.2, 0.46, 4.6, mat_key=mat_key, role="branch_done_hash")
        if idx in (1, 2, 4):
            add_setpiece_enemy(room, "nested_branch_close_right", 13.2, -6.8, "lookout", "scout", "peek_from_cover")

    MANIFEST["features"].append({
        "type": "setpiece_room_clear_overhaul_pass",
        "rooms": len(ROOMS),
        "mainRoute": ["customs_entry", "intake_court", "warehouse_spine", "alarm_relay", "sortation_hall"],
        "summary": "Fourth-pass flagship B01 treatment: named act setpieces, objective booth, final sorter squeeze, nested branch clears, and stronger return-to-spine readability.",
    })


def closure_col():
    return COLLECTIONS["13_linear_spine_closure"]


def add_closure_wall_abs(name, x, z, sx, sz, room_id, mat_key="wall_dark", role="linear_spine_closure_wall", height=None):
    h = RH if height is None else height
    obj = add_box(
        f"closure_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        closure_col(),
        {
            "collision": "wall_aabb",
            "roomId": room_id,
            "geometryId": f"closure_{name}",
            "floorplanRole": role,
            "layoutPass": "linear_spine_closure",
        },
        0.014,
    )
    add_box(
        f"closure_{name}_base_trim",
        x,
        WT + 0.13,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.14,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel"],
        closure_col(),
        {"collision": "decorative_only", "roomId": room_id, "floorplanRole": "closure_base_trim", "layoutPass": "linear_spine_closure"},
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room_id, "x": x, "z": z})
    return obj


def add_closure_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="linear_spine_closure_wall", height=None):
    x, z = room_pos(room, dx, dz)
    return add_closure_wall_abs(f"{room['id']}_{name}", x, z, sx, sz, room["id"], mat_key, role, height)


def add_closure_cover(room, name, dx, dz, sx, sz, height=1.08, mat_key="steel", role="linear_answer_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"closure_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        closure_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"closure_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "linear_spine_closure",
        },
        0.018,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_closure_floor_mark(room, name, dx, dz, sx, sz, mat_key="hazard", role="linear_floor_language"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"closure_{room['id']}_{name}",
        x,
        WT + 0.041,
        z,
        sx,
        0.034,
        sz,
        MATS[mat_key],
        closure_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"closure_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "linear_spine_closure",
        },
        0.002,
    )


def add_closure_enemy(room, name, dx, dz, role, enemy_type, behavior, wave="linear"):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_LIN_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": wave,
        "layoutPass": "linear_spine_closure",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.033,
        z,
        0.42,
        0.032,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": wave})


def add_spine_rail(room, side_dx, name, gap_centers=(0.0,), gap_width=10.6, z0=-15.2, z1=19.4):
    cuts = []
    for center in gap_centers:
        cuts.append((center - gap_width / 2, center + gap_width / 2))
    cuts.sort()
    cursor = z0
    seg_idx = 0
    for lo, hi in cuts:
        if lo - cursor > 1.1:
            mid = (cursor + lo) / 2
            add_closure_wall(room, f"{name}_{seg_idx}", side_dx, mid, 0.54, lo - cursor, role="continuous_spine_side_rail")
            seg_idx += 1
        cursor = max(cursor, hi)
    if z1 - cursor > 1.1:
        mid = (cursor + z1) / 2
        add_closure_wall(room, f"{name}_{seg_idx}", side_dx, mid, 0.54, z1 - cursor, role="continuous_spine_side_rail")


def add_spine_crosswall(room, name, dz, gap_dx, gap_width=8.8, x0=-9.25, x1=9.25):
    lo = gap_dx - gap_width / 2
    hi = gap_dx + gap_width / 2
    if lo - x0 > 0.8:
        add_closure_wall(room, f"{name}_west_leaf", (x0 + lo) / 2, dz, lo - x0, 0.54, role="alternating_spine_door_wall")
    if x1 - hi > 0.8:
        add_closure_wall(room, f"{name}_east_leaf", (hi + x1) / 2, dz, x1 - hi, 0.54, role="alternating_spine_door_wall")
    add_box(
        f"closure_{room['id']}_{name}_door_header",
        room_pos(room, gap_dx, dz)[0],
        WT + 3.08,
        room_pos(room, gap_dx, dz)[1],
        gap_width + 0.28,
        0.18,
        0.18,
        MATS["hazard"],
        closure_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "alternating_spine_door_header", "layoutPass": "linear_spine_closure"},
        0.004,
    )


def add_closure_main_threshold(x, z, room_id, name, keep_width=5.6, previous_width=4.0):
    plug_len = (previous_width - keep_width) / 2
    if plug_len <= 0:
        return
    offset = keep_width / 2 + plug_len / 2
    add_closure_wall_abs(f"{name}_west_final_jamb", x - offset, z, plug_len, 0.72, room_id, "wall", "final_main_threshold_jamb")
    add_closure_wall_abs(f"{name}_east_final_jamb", x + offset, z, plug_len, 0.72, room_id, "wall", "final_main_threshold_jamb")


def add_closure_side_threshold(x, z, room_id, name, keep_width=4.8, previous_width=3.7):
    plug_len = (previous_width - keep_width) / 2
    if plug_len <= 0:
        return
    offset = keep_width / 2 + plug_len / 2
    add_closure_wall_abs(f"{name}_north_final_jamb", x, z + offset, 0.72, plug_len, room_id, "wall", "final_side_room_jamb")
    add_closure_wall_abs(f"{name}_south_final_jamb", x, z - offset, 0.72, plug_len, room_id, "wall", "final_side_room_jamb")


def add_linear_spine_closure_pass():
    by_id = {room["id"]: room for room in ROOMS}
    main_rooms = ["customs_entry", "intake_court", "warehouse_spine", "alarm_relay", "sortation_hall"]
    mandatory_weave_rooms = {cfg["sideRoom"] for cfg in SIDE_WEAVE_CONNECTORS.values()}

    # Make the main route a real corridor. Side rails contain the player in the
    # center column; small rail gaps still allow deliberate side-room clears.
    for room_id in main_rooms:
        room = by_id[room_id]
        west_gaps = [0.0]
        east_gaps = [0.0]
        if (room_id, "west") in SIDE_WEAVE_CONNECTORS:
            west_gaps.extend(SIDE_WEAVE_CONNECTORS[(room_id, "west")]["doorOffsets"])
        if (room_id, "east") in SIDE_WEAVE_CONNECTORS:
            east_gaps.extend(SIDE_WEAVE_CONNECTORS[(room_id, "east")]["doorOffsets"])
        add_spine_rail(room, -9.1, "west_spine_rail", gap_centers=tuple(west_gaps))
        add_spine_rail(room, 9.1, "east_spine_rail", gap_centers=tuple(east_gaps))
        add_closure_floor_mark(room, "single_file_route_line", 0.0, 0.0, 0.62, 36.0, "hazard", "single_file_route_line")

    # Door-gap crosswalls alternate left/right/center to create an explicit
    # check-left, pass-door, check-right cadence.
    crossplan = {
        "customs_entry": [(13.8, -1.8), (0.0, 1.8), (-8.0, -1.8), (-17.0, 0.0)],
        "intake_court": [(15.0, 1.8), (4.2, -1.8), (-7.2, 1.8), (-17.0, 0.0)],
        "warehouse_spine": [(14.5, 1.8), (5.2, 1.8), (-4.8, 1.8), (-15.6, -1.8)],
        "alarm_relay": [(14.2, -3.2), (4.0, 4.6), (-7.8, 1.8), (-17.0, 0.0)],
        "sortation_hall": [(14.0, 4.6), (4.4, 1.8), (-6.8, -1.8), (-16.0, 0.0)],
    }
    for room_id, cuts in crossplan.items():
        room = by_id[room_id]
        for idx, (dz, gap_dx) in enumerate(cuts):
            add_spine_crosswall(room, f"spine_lock_{idx}", dz, gap_dx)

    # Tighten the row-to-row openings after the earlier jamb pass. This keeps
    # the main spine readable as doors, not wide rollup voids.
    for z, room_id in [(66.0, "customs_entry"), (22.0, "warehouse_spine"), (-22.0, "alarm_relay"), (-66.0, "sortation_hall")]:
        add_closure_main_threshold(0.0, z, room_id, f"main_threshold_z{z:+.0f}")

    # Tighten side-room breach mouths and add vestibule lips so branches feel
    # like intentional room clears rather than open lateral lanes.
    center_by_row = {room["row"]: room for room in ROOMS if room["col"] == 1}
    for row_idx, z in enumerate(ROWS):
        center_room = center_by_row[row_idx]
        add_closure_side_threshold(-19.0, z, center_room["id"], f"row{row_idx}_west_breach")
        add_closure_side_threshold(19.0, z, center_room["id"], f"row{row_idx}_east_breach")

    for room_id in ["receiving_yard", "forklift_repair", "manifest_office", "cold_storage", "loading_cage"]:
        room = by_id[room_id]
        if room_id not in mandatory_weave_rooms:
            add_closure_wall(room, "branch_mouth_north_lip", 14.8, 6.8, 7.2, 0.54, role="side_branch_mouth_lip")
            add_closure_wall(room, "branch_mouth_south_lip", 14.8, -6.8, 7.2, 0.54, role="side_branch_mouth_lip")
            add_closure_cover(room, "branch_exit_answer_box", 8.4, 0.0, 3.2, 1.0, height=1.0, mat_key="steel", role="side_branch_exit_answer_cover")

    for room_id in ["container_gate", "security_screening", "hazmat_barrels", "boiler_pump", "foreman_catwalk"]:
        room = by_id[room_id]
        if room_id not in mandatory_weave_rooms:
            add_closure_wall(room, "branch_mouth_north_lip", -14.8, 6.8, 7.2, 0.54, role="side_branch_mouth_lip")
            add_closure_wall(room, "branch_mouth_south_lip", -14.8, -6.8, 7.2, 0.54, role="side_branch_mouth_lip")
            add_closure_cover(room, "branch_exit_answer_box", -8.4, 0.0, 3.2, 1.0, height=1.0, mat_key="steel", role="side_branch_exit_answer_cover")

    # A few extra enemies are tied to the new doorway rhythm, not just placed
    # in rooms. These reinforce the guided clear without becoming unfair.
    add_closure_enemy(by_id["customs_entry"], "first_door_left_check", -6.0, 11.0, "lookout", "scout", "peek_from_cover")
    add_closure_enemy(by_id["intake_court"], "airlock_right_check", 6.0, 7.4, "anchor", "soldier", "hold_angle")
    add_closure_enemy(by_id["warehouse_spine"], "rack_spine_door_hold", -6.0, -2.0, "anchor", "heavy", "suppress_lane")
    add_closure_enemy(by_id["alarm_relay"], "objective_door_left_check", -6.0, -9.5, "breacher", "heavy", "ambush_on_crossing")
    add_closure_enemy(by_id["sortation_hall"], "final_door_cross", 6.0, -10.8, "anchor", "heavy", "hold_angle")

    MANIFEST["features"].append({
        "type": "linear_spine_closure_pass",
        "rooms": len(ROOMS),
        "mainRoute": main_rooms,
        "summary": "Fifth-pass closure: continuous center-spine corridor rails, alternating door-gap crosswalls, smaller thresholds, and tightened side-room breach mouths for stronger guided linear play.",
    })


def weave_col():
    return COLLECTIONS["14_side_room_weave_integration"]


def add_weave_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="side_room_weave_wall", height=None):
    x, z = room_pos(room, dx, dz)
    h = RH if height is None else height
    obj = add_box(
        f"weave_{room['id']}_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        weave_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"weave_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "side_room_weave_integration",
        },
        0.014,
    )
    add_box(
        f"weave_{room['id']}_{name}_base_trim",
        x,
        WT + 0.13,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.14,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel"],
        weave_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "weave_base_trim", "layoutPass": "side_room_weave_integration"},
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_weave_cover(room, name, dx, dz, sx, sz, height=1.04, mat_key="steel", role="side_room_weave_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"weave_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        weave_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"weave_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "side_room_weave_integration",
        },
        0.018,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_weave_floor_mark(room, name, dx, dz, sx, sz, mat_key="cyan", role="side_room_weave_route_mark"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"weave_{room['id']}_{name}",
        x,
        WT + 0.045,
        z,
        sx,
        0.034,
        sz,
        MATS[mat_key],
        weave_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"weave_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "side_room_weave_integration",
        },
        0.002,
    )


def add_weave_enemy(room, name, dx, dz, role, enemy_type, behavior):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_WEAVE_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": "side_room_weave",
        "layoutPass": "side_room_weave_integration",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.036,
        z,
        0.44,
        0.032,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": "side_room_weave"})


def add_side_room_weave_pass():
    by_id = {room["id"]: room for room in ROOMS}

    for (center_id, side), cfg in SIDE_WEAVE_CONNECTORS.items():
        center = by_id[center_id]
        side_room = by_id[cfg["sideRoom"]]
        sign = -1 if side == "west" else 1
        door_a, door_b = cfg["doorOffsets"]
        north = max(door_a, door_b)
        south = min(door_a, door_b)
        mid = cfg["mid"]

        # This is the key gameplay change: the center spine is intentionally
        # interrupted, so the correct route briefly becomes the side room.
        add_weave_wall(center, f"{side}_forced_lane_weave_shutter", 0.0, mid, 37.2, 0.62, role="forced_side_room_weave_shutter")
        add_weave_wall(center, f"{side}_entry_corner_cheek", sign * 6.6, (north + mid) / 2, 0.46, max(2.0, abs(north - mid) - 5.6), role="side_room_weave_entry_cheek")
        add_weave_wall(center, f"{side}_reentry_corner_cheek", sign * 6.6, (south + mid) / 2, 0.46, max(2.0, abs(south - mid) - 5.6), role="side_room_weave_reentry_cheek")
        add_weave_floor_mark(center, f"{side}_entry_route_hash", sign * 8.35, north, 0.42, 4.6, "cyan")
        add_weave_floor_mark(center, f"{side}_return_route_hash", sign * 8.35, south, 0.42, 4.6, "hazard")

        # In the side room, a near-wall baffle prevents the in/out doors from
        # reading as a shortcut. The player has to step inside, clear a corner,
        # and then re-enter the spine.
        internal_dx = -sign * 11.0
        deep_dx = internal_dx + sign * 6.9
        add_weave_wall(side_room, f"{center_id}_inside_near_wall_baffle", internal_dx, mid, 0.48, max(4.2, abs(north - south) - 13.6), role="side_room_inside_lane_baffle")
        add_weave_wall(side_room, f"{center_id}_deep_turn_backstop", deep_dx + sign * 1.8, mid, 3.6, 0.48, role="side_room_deep_turn_backstop")
        add_weave_cover(side_room, f"{center_id}_entry_answer_stack", deep_dx + sign * 0.6, north - 3.0, 2.55, 0.95, height=1.02, mat_key="steel", role="side_room_entry_answer_cover")
        add_weave_cover(side_room, f"{center_id}_reentry_answer_stack", deep_dx - sign * 1.0, south + 2.8, 2.65, 0.95, height=1.02, mat_key="wood", role="side_room_reentry_answer_cover")
        add_weave_floor_mark(side_room, f"{center_id}_inside_route_pull", deep_dx, mid, 4.8, 0.46, "cyan")

        # Enemy markers are tied to the new corners: one catches the entry,
        # one contests the deep turn, and one holds the re-entry doorway.
        add_weave_enemy(center, f"{side}_entry_pixel_fight", sign * 10.0, north - 1.6, "lookout", "scout", "peek_from_cover")
        add_weave_enemy(side_room, f"{center_id}_deep_turn_anchor", deep_dx - sign * 2.1, mid + (1.8 if door_a > door_b else -1.8), "anchor", "soldier", "hold_angle")
        add_weave_enemy(side_room, f"{center_id}_reentry_crossfire", internal_dx + sign * 4.4, south + 1.4, "flanker", "pistolero", "ambush_on_crossing")

    MANIFEST["features"].append({
        "type": "side_room_weave_integration_pass",
        "weaves": len(SIDE_WEAVE_CONNECTORS),
        "summary": "Sixth-pass integration: side rooms become mandatory lane-weave clear spaces with paired in/out cuts, center-lane shutters, deeper turn baffles, and corner-anchored enemy peek markers.",
    })


def hardening_col():
    return COLLECTIONS["15_route_hardening_peek_duels"]


def add_hardening_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="route_hardening_wall", height=None):
    x, z = room_pos(room, dx, dz)
    h = RH if height is None else height
    obj = add_box(
        f"hardening_{room['id']}_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        hardening_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"hardening_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "route_hardening_peek_duels",
        },
        0.014,
    )
    add_box(
        f"hardening_{room['id']}_{name}_cap",
        x,
        WT + h - 0.05,
        z,
        sx + (0.04 if sx < sz else 0.0),
        0.06,
        sz + (0.04 if sz <= sx else 0.0),
        MATS["steel_edge"],
        hardening_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "route_hardening_wall_cap"},
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_hardening_cover(room, name, dx, dz, sx, sz, height=1.0, mat_key="steel", role="route_hardening_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"hardening_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        hardening_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"hardening_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "route_hardening_peek_duels",
        },
        0.018,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_hardening_floor_mark(room, name, dx, dz, sx, sz, mat_key="hazard", role="route_hardening_floor_mark"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"hardening_{room['id']}_{name}",
        x,
        WT + 0.052,
        z,
        sx,
        0.034,
        sz,
        MATS[mat_key],
        hardening_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"hardening_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "route_hardening_peek_duels",
        },
        0.002,
    )


def add_hardening_enemy(room, name, dx, dz, role, enemy_type, behavior):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_HARDEN_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": "designer_peek_duel",
        "layoutPass": "route_hardening_peek_duels",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.039,
        z,
        0.46,
        0.034,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": "designer_peek_duel"})


def add_route_hardening_peek_duel_pass():
    by_id = {room["id"]: room for room in ROOMS}

    for (center_id, side), cfg in SIDE_WEAVE_CONNECTORS.items():
        center = by_id[center_id]
        side_room = by_id[cfg["sideRoom"]]
        sign = -1 if side == "west" else 1
        door_a, door_b = cfg["doorOffsets"]
        north = max(door_a, door_b)
        south = min(door_a, door_b)
        mid = cfg["mid"]

        # The full shutter forces the lane change; these shoulders make the
        # transition read like a designed phase breach instead of a raw wall.
        add_hardening_cover(center, f"{side}_pre_breach_answer_stack", -sign * 10.2, north - 2.8, 2.15, 0.9, height=0.92, mat_key="wood", role="pre_breach_player_answer_cover")
        add_hardening_cover(center, f"{side}_post_return_answer_stack", sign * 10.4, south + 2.8, 2.15, 0.9, height=0.92, mat_key="steel", role="post_return_player_answer_cover")
        add_hardening_floor_mark(center, f"{side}_phase_lane_ticks", sign * 8.9, mid, 0.28, 11.2, "paint_cyan", role="phase_lane_readability_ticks")

        # Side room shaping: tighten the far edge and add nested wall fins
        # without sealing the room. These create a readable clear: entry bite,
        # deep pie-off, late re-entry angle.
        shared_dx = -sign * 17.3
        inner_dx = -sign * 7.8
        outer_dx = sign * 12.6
        mid_outer_dx = sign * 8.2
        north_span = max(3.2, abs(north - mid) - 8.0)
        south_span = max(3.2, abs(south - mid) - 7.8)

        add_hardening_wall(side_room, f"{center_id}_outer_lane_closer_north", outer_dx, (north + mid) / 2, 0.52, north_span, role="side_room_outer_lane_closer")
        add_hardening_wall(side_room, f"{center_id}_outer_lane_closer_south", outer_dx, (south + mid) / 2, 0.52, south_span, role="side_room_outer_lane_closer")
        add_hardening_wall(side_room, f"{center_id}_nested_slice_fin_entry", inner_dx, north - 5.9, 0.44, 1.55, role="side_room_nested_slice_fin")
        add_hardening_wall(side_room, f"{center_id}_nested_slice_fin_exit", inner_dx + sign * 4.4, south + 5.5, 0.44, 1.55, role="side_room_nested_slice_fin")

        add_hardening_cover(side_room, f"{center_id}_outer_lane_headglitch", mid_outer_dx, north - 6.0, 2.25, 0.9, height=0.94, mat_key="steel", role="enemy_headglitch_cover")
        add_hardening_cover(side_room, f"{center_id}_late_reentry_headglitch", shared_dx + sign * 8.4, south + 3.7, 2.05, 0.85, height=0.94, mat_key="wood", role="enemy_headglitch_cover")
        add_hardening_cover(side_room, f"{center_id}_player_deep_answer", mid_outer_dx - sign * 3.2, mid - 1.6, 2.7, 0.9, height=0.92, mat_key="steel", role="player_deep_answer_cover")

        add_hardening_floor_mark(side_room, f"{center_id}_clear_left_right_ticks", mid_outer_dx - sign * 2.6, mid, 6.5, 0.34, "hazard", role="clear_sequence_floor_ticks")
        add_hardening_floor_mark(side_room, f"{center_id}_return_commit_ticks", shared_dx + sign * 2.4, south + 0.8, 5.2, 0.3, "paint_cyan", role="return_commit_floor_ticks")

        # New duel markers sit exactly where the geometry creates an angle:
        # a deep headglitch, a late re-entry swing, and an opposite-side punish
        # if the player fails to slice the room before crossing.
        add_hardening_enemy(side_room, f"{center_id}_outer_headglitch_duel", mid_outer_dx + sign * 1.6, north - 6.8, "anchor", "soldier", "peek_from_cover")
        add_hardening_enemy(side_room, f"{center_id}_late_reentry_swing", shared_dx + sign * 9.8, south + 4.6, "flanker", "pistolero", "ambush_on_crossing")
        add_hardening_enemy(center, f"{side}_return_cross_punish", -sign * 10.4, south - 1.5, "lookout", "scout", "hold_angle")

    MANIFEST["features"].append({
        "type": "route_hardening_peek_duel_pass",
        "weaves": len(SIDE_WEAVE_CONNECTORS),
        "summary": "Seventh-pass designer hardening: every mandatory side-room weave receives nested slice fins, outer-lane closures, player answer cover, headglitch cover, floor language, and additional fair peek-duel enemy markers.",
    })


def final_guidance_col():
    return COLLECTIONS["16_final_guidance_lane_lock"]


def add_final_guidance_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="final_guidance_wall", height=None):
    x, z = room_pos(room, dx, dz)
    h = RH if height is None else height
    obj = add_box(
        f"final_guidance_{room['id']}_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        final_guidance_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"final_guidance_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "final_guidance_lane_lock",
        },
        0.014,
    )
    add_box(
        f"final_guidance_{room['id']}_{name}_base_trim",
        x,
        WT + 0.13,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.14,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel_edge"],
        final_guidance_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "floorplanRole": "final_guidance_base_trim",
            "layoutPass": "final_guidance_lane_lock",
        },
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_final_guidance_cover(room, name, dx, dz, sx, sz, height=0.98, mat_key="steel", role="final_guidance_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"final_guidance_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        final_guidance_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"final_guidance_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "final_guidance_lane_lock",
        },
        0.018,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_final_guidance_mark(room, name, dx, dz, sx, sz, mat_key="cyan", role="final_guidance_route_mark"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"final_guidance_{room['id']}_{name}",
        x,
        WT + 0.058,
        z,
        sx,
        0.034,
        sz,
        MATS[mat_key],
        final_guidance_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"final_guidance_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "final_guidance_lane_lock",
        },
        0.002,
    )


def add_final_guidance_enemy(room, name, dx, dz, role, enemy_type, behavior):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_FINAL_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": "final_guidance_peek_duel",
        "layoutPass": "final_guidance_lane_lock",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.043,
        z,
        0.45,
        0.034,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": "final_guidance_peek_duel"})


def add_final_guidance_lane_lock_pass():
    by_id = {room["id"]: room for room in ROOMS}

    for (center_id, side), cfg in SIDE_WEAVE_CONNECTORS.items():
        center = by_id[center_id]
        side_room = by_id[cfg["sideRoom"]]
        sign = -1 if side == "west" else 1
        door_a, door_b = cfg["doorOffsets"]
        north = max(door_a, door_b)
        south = min(door_a, door_b)
        door_mid = (north + south) / 2
        door_span = abs(north - south)

        # Final route-design pass: block the connector-hugging shortcut inside
        # each mandatory side room while preserving generous north/south exits.
        # This makes the player step deeper into the room, clear an angle, then
        # return to the main lane instead of sliding down the wall.
        connector_lane_dx = -sign * (15.0 if door_span <= 20.5 else 17.0)
        connector_lock_len = max(9.2, door_span - 10.6)
        deep_lane_dx = -sign * 6.6
        far_answer_dx = -sign * 0.6

        add_final_guidance_wall(
            side_room,
            f"{center_id}_connector_lane_lock",
            connector_lane_dx,
            door_mid,
            0.50,
            connector_lock_len,
            role="mandatory_side_room_connector_lane_lock",
        )
        add_final_guidance_wall(
            side_room,
            f"{center_id}_entry_dogleg_lip",
            deep_lane_dx,
            north - 7.2,
            5.3,
            0.48,
            role="mandatory_side_room_entry_dogleg_lip",
        )
        add_final_guidance_wall(
            side_room,
            f"{center_id}_return_dogleg_lip",
            deep_lane_dx + sign * 2.2,
            south + 7.0,
            5.0,
            0.48,
            role="mandatory_side_room_return_dogleg_lip",
        )
        add_final_guidance_cover(
            side_room,
            f"{center_id}_deep_slice_answer",
            far_answer_dx,
            door_mid - 1.0,
            2.75,
            0.92,
            height=0.94,
            mat_key="wood" if side == "west" else "steel",
            role="mandatory_side_room_deep_slice_answer_cover",
        )
        add_final_guidance_cover(
            center,
            f"{side}_reentry_player_anchor",
            -sign * 6.8,
            south + 1.8,
            2.45,
            0.86,
            height=0.92,
            mat_key="steel",
            role="center_reentry_player_anchor_cover",
        )
        add_final_guidance_mark(side_room, f"{center_id}_forced_deep_lane_paint", deep_lane_dx + sign * 1.8, door_mid, 5.8, 0.30, "paint_cyan", "forced_deep_lane_read")
        add_final_guidance_mark(side_room, f"{center_id}_no_shortcut_hash", connector_lane_dx, door_mid, 0.32, connector_lock_len + 1.2, "hazard", "connector_lane_lock_hash")

        # Enemy markers sit at the new authored angles: one at the entry lip,
        # one deep answer duel, and one return swing as the player re-enters.
        add_final_guidance_enemy(side_room, f"{center_id}_entry_lip_duel", connector_lane_dx + sign * 2.3, north - 5.4, "lookout", "scout", "peek_from_cover")
        add_final_guidance_enemy(side_room, f"{center_id}_deep_answer_duel", far_answer_dx + sign * 1.9, door_mid - 2.6, "anchor", "soldier", "hold_angle")
        add_final_guidance_enemy(center, f"{side}_reentry_corner_swing", sign * 7.6, south + 0.2, "flanker", "pistolero", "ambush_on_crossing")

    # Two main-spine proofing touches: these do not change the footprint, but
    # they make the start and final commitment read as authored room-clearing
    # beats rather than a visible straight center aisle.
    add_final_guidance_wall(by_id["customs_entry"], "entry_sightline_break_left", -2.9, 13.8, 6.4, 0.48, role="entry_sightline_break")
    add_final_guidance_wall(by_id["customs_entry"], "entry_sightline_break_right", 3.2, 6.6, 6.0, 0.48, role="entry_sightline_break")
    add_final_guidance_cover(by_id["customs_entry"], "first_slice_answer_bin", -6.8, 7.4, 2.4, 0.9, height=0.92, mat_key="wood", role="first_slice_answer_cover")
    add_final_guidance_enemy(by_id["customs_entry"], "first_slice_corner_hold", 7.6, 3.4, "lookout", "scout", "peek_from_cover")

    add_final_guidance_wall(by_id["sortation_hall"], "exit_commit_left_occluder", -2.8, -15.2, 5.6, 0.48, role="final_exit_commit_occluder")
    add_final_guidance_wall(by_id["sortation_hall"], "exit_commit_right_occluder", 3.1, -20.2, 5.2, 0.48, role="final_exit_commit_occluder")
    add_final_guidance_cover(by_id["sortation_hall"], "last_cross_answer_stack", -7.2, -18.0, 2.4, 0.9, height=0.92, mat_key="steel", role="last_cross_answer_cover")
    add_final_guidance_enemy(by_id["sortation_hall"], "last_cross_corner_hold", 7.6, -17.6, "anchor", "heavy", "hold_angle")

    MANIFEST["features"].append({
        "type": "final_guidance_lane_lock_pass",
        "weaves": len(SIDE_WEAVE_CONNECTORS),
        "summary": "Eighth-pass senior level-design lock: mandatory side rooms get connector-lane blockers, deeper doglegs, answer cover, route paint, and final peek-duel markers so the route reads intentional and cannot devolve into wall-hugging shortcuts.",
    })


def clean_col():
    return COLLECTIONS["09_authored_critical_path_layout"]


def add_clean_wall_abs(name, x, z, sx, sz, room_id, mat_key="wall_dark", role="critical_path_wall", height=None):
    h = RH if height is None else height
    obj = add_box(
        f"cleanpath_{name}",
        x,
        WT + h / 2,
        z,
        sx,
        h,
        sz,
        MATS[mat_key],
        clean_col(),
        {
            "collision": "wall_aabb",
            "roomId": room_id,
            "geometryId": f"cleanpath_{name}",
            "floorplanRole": role,
            "layoutPass": "authored_critical_path_layout",
        },
        0.016,
    )
    add_box(
        f"cleanpath_{name}_base_trim",
        x,
        WT + 0.13,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.14,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel_edge"],
        clean_col(),
        {
            "collision": "decorative_only",
            "roomId": room_id,
            "floorplanRole": "critical_path_base_trim",
            "layoutPass": "authored_critical_path_layout",
        },
        0.004,
    )
    MANIFEST["features"].append({"type": role, "room": room_id, "x": x, "z": z})
    return obj


def add_clean_wall(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="critical_path_wall", height=None):
    x, z = room_pos(room, dx, dz)
    return add_clean_wall_abs(f"{room['id']}_{name}", x, z, sx, sz, room["id"], mat_key, role, height)


def add_clean_cover(room, name, dx, dz, sx, sz, height=0.96, mat_key="steel", role="critical_path_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"cleanpath_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        clean_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"cleanpath_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "authored_critical_path_layout",
        },
        0.018,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_clean_floor_mark(room, name, dx, dz, sx, sz, mat_key="paint_cyan", role="critical_path_route_mark"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"cleanpath_{room['id']}_{name}",
        x,
        WT + 0.058,
        z,
        sx,
        0.034,
        sz,
        MATS[mat_key],
        clean_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"cleanpath_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "authored_critical_path_layout",
        },
        0.002,
    )


def add_clean_header_abs(name, x, z, sx, sz, room_id, mat_key="hazard", role="critical_path_door_header"):
    return add_box(
        f"cleanpath_{name}",
        x,
        WT + 3.02,
        z,
        sx,
        0.20,
        sz,
        MATS[mat_key],
        clean_col(),
        {
            "collision": "decorative_only",
            "roomId": room_id,
            "geometryId": f"cleanpath_{name}",
            "floorplanRole": role,
            "layoutPass": "authored_critical_path_layout",
        },
        0.004,
    )


def add_clean_enemy(room, name, dx, dz, role, enemy_type, behavior, wave="critical_path"):
    x, z = room_pos(room, dx, dz)
    marker_name = f"ENEMY_CLEAN_{room['id']}_{name}_{len(MANIFEST['markers']):03d}"
    props = {
        "markerType": "enemy_spawn",
        "roomId": room["id"],
        "zoneId": int(room["zone"]),
        "encounterId": f"mega_{room['id']}_{room['encounter']}",
        "encounterType": room["encounter"],
        "enemyRole": role,
        "enemyType": enemy_type,
        "encounterBehavior": behavior,
        "spawnWave": wave,
        "layoutPass": "authored_critical_path_layout",
    }
    marker_empty(marker_name, x, z, props)
    add_cylinder(
        marker_name + "_disc",
        x,
        WT + 0.043,
        z,
        0.46,
        0.034,
        MATS[ROLE_COLORS.get(role, "marker_yellow")],
        COLLECTIONS["04_encounter_markers"],
        {"collision": "decorative_only", "markerVisual": role, "roomId": room["id"]},
        axis="Y",
        vertices=18,
    )
    MANIFEST["markers"].append({"type": "enemy_spawn", "room": room["id"], "zone": room["zone"], "role": role, "enemyType": enemy_type, "behavior": behavior, "x": x, "z": z, "wave": wave})


def add_authored_critical_path_layout_pass():
    by_id = {room["id"]: room for room in ROOMS}

    # Seal every non-route macro opening. The final route intentionally uses:
    # customs -> intake -> security loop -> warehouse -> manifest loop ->
    # alarm -> boiler loop -> loading cage loop -> sortation exit.
    for z in [66.0, 22.0, -22.0, -66.0]:
        for x, col_id in [(-38.0, "west"), (38.0, "east")]:
            add_clean_wall_abs(f"sealed_{col_id}_zone_threshold_{z:+.0f}", x, z, 10.2, 0.76, f"sealed_{col_id}_threshold", "wall_dark", "locked_non_route_zone_threshold")
    for row_idx, z in enumerate(ROWS):
        seals = []
        if row_idx == 0:
            seals = [(-19.0, "west_start"), (19.0, "east_start")]
        elif row_idx == 1:
            seals = [(-19.0, "intake_west_locked")]
        elif row_idx == 2:
            seals = [(19.0, "warehouse_east_locked")]
        elif row_idx == 3:
            seals = [(-19.0, "relay_west_locked")]
        elif row_idx == 4:
            seals = [(19.0, "sorter_east_locked")]
        for x, label in seals:
            add_clean_wall_abs(f"{label}_side_connector_seal", x, z, 0.76, 9.8, f"row_{row_idx}", "steel", "locked_non_route_side_connector")
            add_clean_header_abs(f"{label}_locked_door_header", x, z, 0.22, 8.4, f"row_{row_idx}", "red", "locked_door_header")

    # Narrow the visible center thresholds into readable doors instead of broad
    # room-spanning cuts.
    for z, rid in [(66.0, "customs_entry"), (22.0, "warehouse_spine"), (-22.0, "alarm_relay"), (-66.0, "sortation_hall")]:
        for side, x in [("west", -3.85), ("east", 3.85)]:
            add_clean_wall_abs(f"center_threshold_{z:+.0f}_{side}_plug", x, z, 1.7, 0.72, rid, "wall_dark", "narrow_center_threshold_plug")
        add_clean_header_abs(f"center_threshold_{z:+.0f}_header", 0.0, z, 6.6, 0.20, rid, "hazard", "critical_path_threshold_header")

    # Act 1: clean orientation and first check-left/check-right beats.
    room = by_id["customs_entry"]
    add_clean_wall(room, "entry_left_long_blind", -8.2, 10.6, 0.52, 13.5, role="entry_sally_port_wall")
    add_clean_wall(room, "entry_right_return", 5.9, 4.1, 0.52, 12.0, role="entry_sally_port_wall")
    add_clean_wall(room, "passport_backstop", -2.6, -8.8, 10.0, 0.52, role="entry_backstop_wall")
    add_clean_cover(room, "first_player_answer_counter", -2.6, 0.4, 3.2, 0.95, mat_key="wood", role="first_player_answer_cover")
    add_clean_floor_mark(room, "entry_route_strip_a", 0.0, 13.0, 0.46, 7.0, "hazard")
    add_clean_floor_mark(room, "entry_route_strip_b", 3.4, -4.2, 0.46, 7.2, "paint_cyan")
    add_clean_enemy(room, "first_left_door_hold", -10.4, -5.0, "lookout", "scout", "peek_from_cover")
    add_clean_enemy(room, "passport_right_swing", 8.8, -9.8, "flanker", "pistolero", "ambush_on_crossing")

    # Act 2: Intake forces a deliberate east-lane clear through Security.
    center = by_id["intake_court"]
    side_room = by_id["security_screening"]
    add_clean_wall(center, "east_loop_force_shutter", 0.0, 1.5, 38.4, 0.62, role="forced_side_room_loop_shutter")
    add_clean_wall(center, "east_entry_cheek", 7.1, 9.0, 0.50, 9.5, role="side_loop_entry_cheek")
    add_clean_wall(center, "east_return_cheek", 7.1, -7.0, 0.50, 8.5, role="side_loop_return_cheek")
    add_clean_cover(center, "pre_security_answer", -7.6, 11.6, 2.5, 0.9, mat_key="steel", role="pre_breach_answer_cover")
    add_clean_floor_mark(center, "east_breach_paint", 9.8, 17.0, 0.42, 4.8, "paint_cyan")
    add_clean_floor_mark(center, "east_return_paint", 9.8, -8.0, 0.42, 4.8, "hazard")
    add_clean_wall(side_room, "security_connector_lane_lock", -16.8, 4.5, 0.50, 14.2, role="side_room_connector_lane_lock")
    add_clean_wall(side_room, "security_deep_turn_lip", -7.2, 2.0, 6.6, 0.50, role="side_room_deep_turn_lip")
    add_clean_wall(side_room, "security_reentry_lip", -10.2, -8.8, 5.2, 0.50, role="side_room_reentry_lip")
    add_clean_cover(side_room, "xray_deep_answer", -3.8, -0.8, 2.7, 0.92, mat_key="steel", role="side_room_answer_cover")
    add_clean_floor_mark(side_room, "security_deep_lane_read", -8.6, 3.4, 6.0, 0.32, "paint_cyan")
    add_clean_enemy(center, "security_entry_pixel", 10.8, 14.8, "lookout", "scout", "peek_from_cover")
    add_clean_enemy(side_room, "xray_deep_anchor", -3.0, -2.6, "anchor", "soldier", "hold_angle")
    add_clean_enemy(side_room, "return_swing", -13.2, -6.8, "flanker", "pistolero", "ambush_on_crossing")

    # Act 3: Warehouse is a west-side paperwork loop, then a straight phase read.
    center = by_id["warehouse_spine"]
    side_room = by_id["manifest_office"]
    add_clean_wall(center, "west_loop_force_shutter", 0.0, 2.0, 38.4, 0.62, role="forced_side_room_loop_shutter")
    add_clean_wall(center, "rack_north_blind", -6.4, 13.0, 9.0, 0.52, role="warehouse_slice_wall")
    add_clean_wall(center, "rack_south_blind", 6.4, -14.0, 9.0, 0.52, role="warehouse_slice_wall")
    add_clean_cover(center, "warehouse_mid_answer", 2.0, -5.0, 3.2, 0.9, mat_key="wood", role="warehouse_answer_cover")
    add_clean_floor_mark(center, "west_breach_paint", -9.8, 19.0, 0.42, 4.8, "paint_cyan")
    add_clean_floor_mark(center, "west_return_paint", -9.8, -8.0, 0.42, 4.8, "hazard")
    add_clean_wall(side_room, "manifest_connector_lane_lock", 16.8, 5.0, 0.50, 15.0, role="side_room_connector_lane_lock")
    add_clean_wall(side_room, "manifest_deep_office_lip", 6.2, 4.2, 6.8, 0.50, role="side_room_deep_turn_lip")
    add_clean_wall(side_room, "manifest_return_lip", 9.8, -8.2, 5.8, 0.50, role="side_room_reentry_lip")
    add_clean_cover(side_room, "manifest_deep_answer", 1.4, 0.0, 2.9, 0.92, mat_key="wood", role="side_room_answer_cover")
    add_clean_enemy(center, "rack_door_hold", -9.4, 12.4, "anchor", "heavy", "hold_angle")
    add_clean_enemy(side_room, "manifest_office_peek", 2.4, 3.2, "lookout", "scout", "peek_from_cover")
    add_clean_enemy(side_room, "manifest_return_cross", 12.6, -5.8, "flanker", "pistolero", "ambush_on_crossing")

    # Act 4: Alarm relay sends the player into a compact boiler utility loop.
    center = by_id["alarm_relay"]
    side_room = by_id["boiler_pump"]
    add_clean_wall(center, "east_boiler_force_shutter", 0.0, -1.0, 38.4, 0.62, role="forced_side_room_loop_shutter")
    add_clean_wall(center, "objective_booth_west", -8.2, 5.0, 0.52, 14.0, mat_key="wall_dark", role="objective_booth_wall")
    add_clean_wall(center, "objective_booth_east", 8.2, -8.0, 0.52, 13.0, mat_key="wall_dark", role="objective_booth_wall")
    add_clean_cover(center, "relay_objective_answer", -2.4, -12.0, 3.2, 0.92, mat_key="cyan", role="objective_answer_cover")
    add_clean_floor_mark(center, "boiler_breach_paint", 9.8, 9.0, 0.42, 4.6, "paint_cyan")
    add_clean_floor_mark(center, "boiler_return_paint", 9.8, -11.0, 0.42, 4.6, "hazard")
    add_clean_wall(side_room, "boiler_connector_lane_lock", -14.9, -1.0, 0.50, 9.2, role="side_room_connector_lane_lock")
    add_clean_wall(side_room, "boiler_pressure_lip", -6.6, 2.6, 5.6, 0.50, role="side_room_deep_turn_lip")
    add_clean_cover(side_room, "boiler_answer", -2.0, -2.2, 2.7, 0.92, mat_key="steel", role="side_room_answer_cover")
    add_clean_enemy(center, "relay_booth_close", 7.2, -6.4, "breacher", "heavy", "ambush_on_crossing")
    add_clean_enemy(side_room, "boiler_pipe_peek", -3.2, 2.2, "anchor", "soldier", "peek_from_cover")
    add_clean_enemy(side_room, "boiler_return_swing", -12.2, -8.4, "flanker", "pistolero", "ambush_on_crossing")

    # Act 5: Final west cage loop and short sortation commitment to exit.
    center = by_id["sortation_hall"]
    side_room = by_id["loading_cage"]
    add_clean_wall(center, "west_cage_force_shutter", 0.0, 0.0, 38.4, 0.62, role="forced_side_room_loop_shutter")
    add_clean_wall(center, "sorter_commit_west", -7.0, 11.0, 0.52, 11.0, role="final_commit_wall")
    add_clean_wall(center, "sorter_commit_east", 7.0, -8.0, 0.52, 11.0, role="final_commit_wall")
    add_clean_wall(center, "exit_sight_break", -2.2, -17.0, 6.2, 0.50, role="final_exit_sight_break")
    add_clean_cover(center, "last_cross_answer", 3.8, -13.2, 2.7, 0.92, mat_key="steel", role="last_cross_answer_cover")
    add_clean_floor_mark(center, "cage_breach_paint", -9.8, 10.0, 0.42, 4.6, "paint_cyan")
    add_clean_floor_mark(center, "exit_commit_paint", 0.0, -18.5, 5.8, 0.32, "hazard")
    add_clean_wall(side_room, "cage_connector_lane_lock", 14.9, 0.0, 0.50, 9.2, role="side_room_connector_lane_lock")
    add_clean_wall(side_room, "cage_deep_lip", 6.4, 3.2, 5.8, 0.50, role="side_room_deep_turn_lip")
    add_clean_cover(side_room, "cage_answer", 1.8, -2.8, 2.8, 0.92, mat_key="steel", role="side_room_answer_cover")
    add_clean_enemy(side_room, "cage_bars_hold", 2.6, 3.4, "anchor", "heavy", "hold_angle")
    add_clean_enemy(side_room, "cage_return_swing", 12.2, -7.4, "flanker", "pistolero", "ambush_on_crossing")
    add_clean_enemy(center, "final_exit_hold", 8.8, -16.4, "anchor", "heavy", "hold_angle")

    for x, z, zone, label in [
        (-58, 44, 0, "west_locked_rollup"),
        (58, 44, 0, "east_locked_rollup"),
        (-58, -44, 1, "cold_locked_service"),
        (58, -44, 1, "boiler_locked_service"),
        (0, -109, 2, "final_exit_reversal"),
    ]:
        marker_empty(f"SPAWN_DOOR_CLEAN_{label}", x, z, {"markerType": "spawn_door", "zoneId": zone, "doorId": label, "entry": label}, y=WT + 0.2)

    MANIFEST["features"].append({
        "type": "authored_critical_path_layout_pass",
        "mainRoute": [
            "customs_entry",
            "intake_court",
            "security_screening",
            "warehouse_spine",
            "manifest_office",
            "alarm_relay",
            "boiler_pump",
            "loading_cage",
            "sortation_hall",
        ],
        "summary": "Single-pass Level 1 redesign: one readable beginning-to-end route, locked non-route connectors, mandatory side-room loops, explicit doglegs, and corner-authored enemy placements.",
    })


def add_authored_depth_encounter_pass():
    by_id = {room["id"]: room for room in ROOMS}

    # This pass does not change the macro route. It adds nested angle beats
    # inside the already-forced path so each phase has a different clear.

    # Customs: a compact staff alcove before the first threshold.
    room = by_id["customs_entry"]
    add_clean_wall(room, "staff_alcove_north_slice", -12.4, 4.8, 6.4, 0.46, role="depth_staff_alcove_wall")
    add_clean_wall(room, "staff_alcove_inner_cheek", -9.2, -2.4, 0.46, 7.8, role="depth_staff_alcove_wall")
    add_clean_cover(room, "staff_alcove_answer_stack", -14.4, -5.8, 2.2, 0.82, mat_key="wood", role="depth_player_answer_cover")
    add_clean_floor_mark(room, "staff_alcove_slice_ticks", -8.9, -1.0, 0.30, 5.4, "hazard", role="depth_slice_floor_ticks")
    add_clean_enemy(room, "staff_alcove_late_peek", -15.0, -2.6, "lookout", "scout", "peek_from_cover", wave="depth_peek")

    # Security: make the east side room feel like a scanner corridor, not a pocket.
    room = by_id["security_screening"]
    add_clean_wall(room, "scanner_connector_edge_block", -18.4, 4.5, 0.52, 15.4, role="depth_connector_edge_block")
    add_clean_wall(room, "scanner_maze_north_bar", -9.8, 11.8, 8.9, 0.46, role="depth_scanner_corridor_wall")
    add_clean_wall(room, "scanner_maze_south_bar", -2.7, -2.6, 8.1, 0.46, role="depth_scanner_corridor_wall")
    add_clean_wall(room, "scanner_guard_booth_cheek", 7.6, 7.0, 0.46, 7.6, role="depth_guard_booth_wall")
    add_clean_cover(room, "scanner_middle_answer", 3.0, 7.6, 2.5, 0.88, mat_key="steel", role="depth_player_answer_cover")
    add_clean_floor_mark(room, "scanner_corridor_read", -1.0, 5.6, 8.2, 0.30, "paint_cyan", role="depth_route_read")
    add_clean_enemy(room, "scanner_booth_hold", 8.8, 10.2, "anchor", "soldier", "hold_angle", wave="depth_peek")

    # Intake return: a small cross-angle after re-entering the middle lane.
    room = by_id["intake_court"]
    add_clean_wall(room, "return_lane_short_blind", -3.2, -11.8, 0.46, 7.4, role="depth_return_lane_blind")
    add_clean_cover(room, "return_lane_answer_crates", 4.4, -14.2, 2.6, 0.86, mat_key="wood", role="depth_player_answer_cover")
    add_clean_enemy(room, "return_lane_corner_check", -6.6, -14.4, "flanker", "pistolero", "ambush_on_crossing", wave="depth_peek")

    # Warehouse + Manifest: paper-office loop with a deeper file-row bend.
    room = by_id["warehouse_spine"]
    add_clean_wall(room, "rack_lane_mid_lip", -3.2, 7.0, 0.46, 8.4, role="depth_rack_lane_lip")
    add_clean_wall(room, "rack_lane_south_lip", 5.4, -7.4, 0.46, 8.8, role="depth_rack_lane_lip")
    add_clean_cover(room, "rack_lane_answer_pallet", -4.2, -3.0, 2.8, 0.9, mat_key="steel", role="depth_player_answer_cover")
    add_clean_enemy(room, "rack_lane_jiggle_peek", 7.8, 2.0, "lookout", "scout", "peek_from_cover", wave="depth_peek")

    room = by_id["manifest_office"]
    add_clean_wall(room, "manifest_connector_edge_block", 18.4, 5.0, 0.52, 16.0, role="depth_connector_edge_block")
    add_clean_wall(room, "file_maze_north_bar", 9.8, 12.0, 8.9, 0.46, role="depth_file_corridor_wall")
    add_clean_wall(room, "file_maze_south_bar", 2.7, -3.0, 8.1, 0.46, role="depth_file_corridor_wall")
    add_clean_wall(room, "records_room_cheek", -7.8, 5.8, 0.46, 8.2, role="depth_records_room_wall")
    add_clean_cover(room, "records_answer_desk", -4.0, -2.6, 2.6, 0.88, mat_key="wood", role="depth_player_answer_cover")
    add_clean_floor_mark(room, "records_deep_lane_read", 0.0, 6.0, 8.4, 0.30, "paint_cyan", role="depth_route_read")
    add_clean_enemy(room, "records_room_pixel", -8.8, 8.6, "lookout", "scout", "peek_from_cover", wave="depth_peek")

    # Alarm + Boiler: objective room gets a booth pre-read, boiler gets a pipe maze.
    room = by_id["alarm_relay"]
    add_clean_wall(room, "relay_console_entry_lip", -2.2, 9.6, 8.0, 0.46, role="depth_objective_entry_lip")
    add_clean_wall(room, "relay_console_exit_lip", 2.2, -2.8, 8.0, 0.46, role="depth_objective_exit_lip")
    add_clean_cover(room, "relay_console_low_answer", -5.6, 0.8, 2.4, 0.86, mat_key="cyan", role="depth_objective_answer_cover")
    add_clean_enemy(room, "relay_console_counterpeek", -7.8, 7.4, "anchor", "soldier", "hold_angle", wave="depth_peek")

    room = by_id["boiler_pump"]
    add_clean_wall(room, "boiler_connector_edge_block", -18.4, -1.0, 0.52, 16.0, role="depth_connector_edge_block")
    add_clean_wall(room, "boiler_connector_lane_lock_extension", -14.9, -1.0, 0.52, 16.0, role="depth_side_room_connector_extension")
    add_clean_wall(room, "pipe_maze_north_bar", -10.2, 8.1, 8.8, 0.46, role="depth_pipe_corridor_wall")
    add_clean_wall(room, "pipe_maze_south_bar", -2.8, -5.8, 8.2, 0.46, role="depth_pipe_corridor_wall")
    add_clean_cover(room, "pipe_maze_answer_valves", 3.4, 1.0, 2.6, 0.9, mat_key="steel", role="depth_player_answer_cover")
    add_clean_floor_mark(room, "pipe_maze_route_read", -1.2, -0.4, 8.0, 0.30, "hazard", role="depth_route_read")
    add_clean_enemy(room, "pipe_maze_late_swing", 5.6, -4.6, "flanker", "pistolero", "ambush_on_crossing", wave="depth_peek")

    # Final phase: loading cage becomes a real holding-cell clear, then sortation
    # asks for one last cross before the exit.
    room = by_id["loading_cage"]
    add_clean_wall(room, "cage_connector_edge_block", 18.4, 0.0, 0.52, 16.0, role="depth_connector_edge_block")
    add_clean_wall(room, "cage_connector_lane_lock_extension", 14.9, 0.0, 0.52, 16.0, role="depth_side_room_connector_extension")
    add_clean_wall(room, "holding_cell_north_bar", 9.7, 7.8, 8.9, 0.46, role="depth_holding_cell_wall")
    add_clean_wall(room, "holding_cell_south_bar", 2.8, -6.2, 8.0, 0.46, role="depth_holding_cell_wall")
    add_clean_wall(room, "cage_inner_post_blind", -7.6, 1.8, 0.46, 8.8, role="depth_cage_inner_blind")
    add_clean_cover(room, "holding_cell_answer", -3.2, -2.0, 2.6, 0.9, mat_key="steel", role="depth_player_answer_cover")
    add_clean_floor_mark(room, "holding_cell_route_read", 0.8, -0.8, 8.0, 0.30, "paint_cyan", role="depth_route_read")
    add_clean_enemy(room, "holding_cell_close_hold", -8.8, 5.0, "anchor", "heavy", "hold_angle", wave="depth_peek")

    room = by_id["sortation_hall"]
    add_clean_wall(room, "sorter_final_split_lip", -2.8, 4.2, 0.46, 8.4, role="depth_final_split_lip")
    add_clean_wall(room, "sorter_exit_precheck_lip", 4.8, -14.8, 0.46, 5.8, role="depth_final_split_lip")
    add_clean_cover(room, "sorter_exit_answer_belt", -5.6, -11.8, 2.8, 0.9, mat_key="steel", role="depth_player_answer_cover")
    add_clean_enemy(room, "sorter_last_left_check", -8.8, -9.8, "lookout", "scout", "peek_from_cover", wave="depth_peek")

    MANIFEST["features"].append({
        "type": "authored_depth_encounter_pass",
        "summary": "Adds nested micro-corridors, scanner/file/pipe/cage room variations, player answer cover, and fair corner-authored peek duels without changing the macro critical path.",
    })


def guard_vault_col():
    return COLLECTIONS["17_guard_vault_feature_structures"]


def add_guard_vault_cover(room, name, dx, dz, sx, sz, height=0.94, mat_key="steel", role="guard_vault_low_cover"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"guardvault_{room['id']}_{name}",
        x,
        WT + height / 2,
        z,
        sx,
        height,
        sz,
        MATS[mat_key],
        guard_vault_col(),
        {
            "collision": "cover_aabb",
            "roomId": room["id"],
            "geometryId": f"guardvault_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "guard_vault_feature_structures",
            "vaultHint": True,
            "guardBehindHint": "low_cover",
        },
        0.022,
    )
    add_box(
        f"guardvault_{room['id']}_{name}_top_wear",
        x,
        WT + height + 0.025,
        z,
        sx + (0.06 if sx >= sz else 0.0),
        0.045,
        sz + (0.06 if sz > sx else 0.0),
        MATS["steel_edge"],
        guard_vault_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "floorplanRole": "guard_vault_readable_top_edge",
            "layoutPass": "guard_vault_feature_structures",
        },
        0.006,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z, "height": height})
    return obj


def add_guard_vault_wall_fin(room, name, dx, dz, sx, sz, mat_key="wall_dark", role="guard_wall_side_peek_fin"):
    x, z = room_pos(room, dx, dz)
    obj = add_box(
        f"guardvault_{room['id']}_{name}",
        x,
        WT + RH / 2,
        z,
        sx,
        RH,
        sz,
        MATS[mat_key],
        guard_vault_col(),
        {
            "collision": "wall_aabb",
            "roomId": room["id"],
            "geometryId": f"guardvault_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "guard_vault_feature_structures",
            "guardBehindHint": "wall_side_peek",
        },
        0.016,
    )
    add_box(
        f"guardvault_{room['id']}_{name}_base_trim",
        x,
        WT + 0.13,
        z,
        sx + (0.05 if sx < sz else 0.0),
        0.14,
        sz + (0.05 if sz <= sx else 0.0),
        MATS["steel_edge"],
        guard_vault_col(),
        {"collision": "decorative_only", "roomId": room["id"], "floorplanRole": "guard_wall_fin_trim", "layoutPass": "guard_vault_feature_structures"},
        0.005,
    )
    MANIFEST["features"].append({"type": role, "room": room["id"], "x": x, "z": z})
    return obj


def add_guard_vault_floor_cue(room, name, dx, dz, sx, sz, mat_key="paint_cyan", role="guard_vault_floor_cue"):
    x, z = room_pos(room, dx, dz)
    return add_box(
        f"guardvault_{room['id']}_{name}",
        x,
        WT + 0.063,
        z,
        sx,
        0.030,
        sz,
        MATS[mat_key],
        guard_vault_col(),
        {
            "collision": "decorative_only",
            "roomId": room["id"],
            "geometryId": f"guardvault_{room['id']}_{name}",
            "floorplanRole": role,
            "layoutPass": "guard_vault_feature_structures",
        },
        0.002,
    )


def add_guard_vault_feature_structures_pass():
    by_id = {room["id"]: room for room in ROOMS}

    # These are deliberately small, waist-high objects placed on route edges:
    # they add clear ALT-guard and SPACE-vault affordances without changing
    # the already-authored Level 1 route.
    placements = [
        ("customs_entry", "passport_low_guard_counter", -5.8, 8.4, 2.7, 0.86, 0.92, "wood", "entry_guard_vault_counter"),
        ("customs_entry", "first_threshold_crash_bin", 4.8, -1.8, 2.1, 0.82, 0.88, "steel", "entry_threshold_vault_bin"),
        ("intake_court", "east_breach_knee_barricade", 5.8, 13.6, 2.6, 0.88, 0.94, "steel", "side_breach_guard_cover"),
        ("security_screening", "xray_belt_vault_table", -6.4, 7.8, 3.3, 0.92, 0.90, "cyan", "xray_vault_table"),
        ("warehouse_spine", "rack_lane_pallet_vault", -4.8, 6.2, 2.9, 0.92, 0.96, "wood", "warehouse_vault_pallet"),
        ("manifest_office", "file_row_low_cabinet", 4.2, 6.6, 2.7, 0.86, 0.94, "wood", "file_row_guard_cabinet"),
        ("alarm_relay", "relay_low_service_console", 3.8, 2.0, 3.2, 0.92, 0.98, "cyan", "relay_guard_console"),
        ("boiler_pump", "pipe_waist_guard_barrier", 2.8, 6.2, 2.8, 0.92, 0.96, "steel", "boiler_pipe_guard_barrier"),
        ("loading_cage", "cage_floor_knee_rail", -3.6, 5.4, 3.0, 0.86, 0.92, "steel", "cage_vault_knee_rail"),
        ("sortation_hall", "sorter_belt_vault_guard", -4.8, 2.6, 3.1, 0.92, 0.94, "steel", "sorter_belt_guard_cover"),
        ("sortation_hall", "exit_last_guard_bin", 5.6, -14.8, 2.3, 0.86, 0.90, "wood", "exit_guard_vault_bin"),
    ]
    for rid, name, dx, dz, sx, sz, height, mat_key, role in placements:
        room = by_id[rid]
        add_guard_vault_cover(room, name, dx, dz, sx, sz, height=height, mat_key=mat_key, role=role)
        add_guard_vault_floor_cue(room, f"{name}_cue", dx, dz + (1.05 if sz < sx else 0.0), min(sx + 0.4, 3.8), 0.18, "paint_cyan")

    # A few tall fins are only for wall-side guard peeking. They sit at
    # existing corners and do not create new route closures.
    wall_fins = [
        ("customs_entry", "alt_guard_wall_practice_fin", -10.8, 2.6, 0.46, 4.2),
        ("warehouse_spine", "rack_side_guard_fin", 8.6, -2.8, 0.46, 4.6),
        ("alarm_relay", "objective_side_guard_fin", -7.6, -8.0, 0.46, 4.0),
        ("sortation_hall", "exit_side_guard_fin", 8.2, -9.8, 0.46, 4.2),
    ]
    for rid, name, dx, dz, sx, sz in wall_fins:
        add_guard_vault_wall_fin(by_id[rid], name, dx, dz, sx, sz)

    MANIFEST["features"].append({
        "type": "guard_vault_feature_structures_pass",
        "lowCoverObjects": len(placements),
        "wallPeekFins": len(wall_fins),
        "summary": "Adds surgical Level 1 waist-high guard/vault structures and side-peek fins for ALT guard-behind and generalized vaulting without rerouting the map.",
    })


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
            side = "west" if x < 0 else "east"
            center_room = next(r for r in ROOMS if r["row"] == row and r["col"] == 1)
            weave = SIDE_WEAVE_CONNECTORS.get((center_room["id"], side))
            if weave:
                doors = [(zc + off, 8.6) for off in weave["doorOffsets"]]
                wall_z_multi(wall_col, f"internal_x_{x:.1f}_row_{row}", x, zc - ROOM_D / 2, zc + ROOM_D / 2, f"row_{row}", f"internal_x_{x:.1f}_row_{row}", doors=doors, role="room_connector_wall")
                for idx, (door_z, door_w) in enumerate(doors):
                    add_box(f"door_frame_x_{x:.1f}_row_{row}_weave_{idx}", x, WT + 2.85, door_z, 0.22, 0.18, door_w + 0.48, MATS["hazard"], wall_col,
                            {"collision": "decorative_only", "floorplanRole": "weave_door_header", "gateId": f"x_{x}_{row}_weave_{idx}"}, 0.006)
            else:
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
            add_box("customs_security_desk", b["cx"] + 1.2, WT + 0.48, b["cz"] + 4, 5.4, 0.96, 1.1, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
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
            for x in [b["cx"] + 3.8, b["cx"] + 13.8]:
                add_cylinder(f"boiler_tank_{x}", x, WT + 1.35, b["cz"], 1.0, 4.5, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                             {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "boiler_tank"}, axis="Y", vertices=28)
            add_fan(room, b["cx"] + 13, b["cz"] + 13)
        elif rid == "loading_cage":
            for x in [b["cx"] - 16, b["cx"] - 11, b["cx"] - 6, b["cx"] + 1]:
                add_box(f"cage_vertical_bar_{x}", x, WT + 2.2, b["cz"], 0.16, 3.6, ROOM_D - 8, MATS["steel"], COLLECTIONS["05_props_barrels_crates_machinery"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "cage_bar"}, 0.008)
            for z in [b["cz"] - 12, b["cz"], b["cz"] + 12]:
                add_box(f"cage_center_cover_{z}", b["cx"] - 8.0, WT + 0.72, z, 5.2, 1.44, 1.1, MATS["steel"], COLLECTIONS["02_collision_and_cover"],
                        {"collision": "cover_aabb", "roomId": rid, "floorplanRole": "cage_center_cover"}, 0.025)
        elif rid == "sortation_hall":
            add_conveyor(room, b["cx"] - 8.5, b["cz"] + 6, length=13.0, axis="X")
            add_conveyor(room, b["cx"] + 9.4, b["cz"] + 6, length=11.2, axis="X")
            add_conveyor(room, b["cx"] - 10.0, b["cz"] - 8, length=10.0, axis="X")
            add_conveyor(room, b["cx"] + 7.9, b["cz"] - 8, length=14.2, axis="X")
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
    for row_idx, z in enumerate(ROWS):
        for side, x in [("west", -18.0), ("east", 18.0)]:
            add_box(f"side_room_branch_hash_{row_idx}_{side}", x, WT + 0.026, z, 0.42, 0.03, 4.8, MATS["cyan"], col,
                    {"collision": "decorative_only", "floorplanRole": "side_room_branch_hash"}, 0.004)
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
        "06_lighting_animation",
        "07_labels_and_route_language",
        "08_cameras_preview",
        "09_authored_critical_path_layout",
        "17_guard_vault_feature_structures",
    ]:
        collection(name, root)
    overlay_col = append_existing_designer_overlay(root)
    kit_col = add_designer_overlay_kit(root)

    add_room_shells()
    populate_rooms()
    add_authored_critical_path_layout_pass()
    add_authored_depth_encounter_pass()
    add_guard_vault_feature_structures_pass()
    add_lighting_and_animation()
    player_spawn_marker()
    exit_marker()
    add_connections_to_manifest()
    register_designer_overlay_manifest(overlay_col)
    add_cameras()
    configure_animation_curves()

    os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
    with open(LAYOUT_OUT, "w", encoding="utf-8") as fh:
        json.dump(MANIFEST, fh, indent=2)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    unlink_collection_for_export(root, kit_col)
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
