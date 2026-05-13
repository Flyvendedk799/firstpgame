"""Build the first production weapon/viewmodel GLBs.

Run with Blender:

    /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-m4-viewmodel-assets.py

This intentionally creates simple authored assets from primitives. The point of
this first pass is the contract: hierarchy, sockets, animation clip names,
scale/orientation, and reproducibility. Future art passes can replace geometry
without changing the runtime standard.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import bpy


REPO = Path(__file__).resolve().parents[1]
WEAPON_SRC = REPO / "art_src/weapons/m4/m4_viewmodel.blend"
WEAPON_GLB = REPO / "public/assets/weapons/m4/m4_viewmodel.glb"
WEAPON_TEX = REPO / "public/assets/weapons/m4/textures/m4_albedo_2k.png"
HANDS_SRC = REPO / "art_src/viewmodels/operative_hands.blend"
HANDS_GLB = REPO / "public/assets/viewmodels/operative_hands.glb"


def ensure_dirs() -> None:
    for path in (WEAPON_SRC, WEAPON_GLB, WEAPON_TEX, HANDS_SRC, HANDS_GLB):
        path.parent.mkdir(parents=True, exist_ok=True)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablock in list(bpy.data.meshes):
        if datablock.users == 0:
            bpy.data.meshes.remove(datablock)
    for datablock in list(bpy.data.materials):
        if datablock.users == 0:
            bpy.data.materials.remove(datablock)
    for datablock in list(bpy.data.images):
        if datablock.users == 0:
            bpy.data.images.remove(datablock)


def active_obj():
    return bpy.context.view_layer.objects.active


def material(name: str, color, roughness=0.7, metallic=0.0, image: Path | None = None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if image and image.exists():
            tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(str(image), check_existing=True)
            mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def collection(name: str):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def move_to_collection(obj, col) -> None:
    if obj.name not in col.objects.keys():
        col.objects.link(obj)
    for current in list(obj.users_collection):
        if current != col:
            current.objects.unlink(obj)


def empty(name: str, loc, col, parent=None, size=0.05, display="PLAIN_AXES"):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = size
    obj.empty_display_type = display
    obj.location = loc
    obj.parent = parent
    col.objects.link(obj)
    return obj


def cube(name: str, loc, scale, mat, col, parent=None, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = active_obj()
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("contract_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    obj.parent = parent
    move_to_collection(obj, col)
    return obj


def cylinder(name: str, loc, radius, depth, mat, col, parent=None, axis="Y", verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    obj = active_obj()
    obj.name = name
    if axis == "Y":
        obj.rotation_euler[0] = math.radians(90)
    elif axis == "X":
        obj.rotation_euler[1] = math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    obj.parent = parent
    move_to_collection(obj, col)
    return obj


def key(obj, frame: int, loc=None, rot=None, scale=None) -> None:
    bpy.context.scene.frame_set(frame)
    if loc is not None:
        obj.location = loc
    if rot is not None:
        obj.rotation_euler = rot
    if scale is not None:
        obj.scale = scale
    obj.keyframe_insert(data_path="location", frame=frame)
    obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    obj.keyframe_insert(data_path="scale", frame=frame)


def clear_active_actions(objects) -> None:
    """Start a fresh action while preserving already-pushed NLA clip tracks."""
    for obj in objects:
        if obj and obj.animation_data:
            obj.animation_data.action = None


def push_clip(objects, clip_name: str, start: int, end: int) -> None:
    for obj in objects:
        if not obj or not obj.animation_data or not obj.animation_data.action:
            continue
        action = obj.animation_data.action
        action.name = f"{clip_name}_{obj.name}"
        track = obj.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, start, action)
        strip.name = clip_name
        strip.frame_start = start
        strip.frame_end = end
        obj.animation_data.action = None


def export_selected_glb(path: Path, col) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in col.objects:
        if obj.type not in {"CAMERA", "LIGHT"}:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_merge_animation="NLA_TRACK",
        export_yup=True,
    )


def build_m4() -> None:
    reset_scene()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 96
    col = collection("M4_VIEWMODEL_ASSET")
    root = empty("WeaponRoot", (0, 0, 0), col, None, 0.12, "ARROWS")
    visual = empty("visual", (0, 0, 0), col, root, 0.05)
    sockets = empty("sockets", (0, 0, 0), col, root, 0.05)

    atlas = material("M4_2K_atlas_material", (0.08, 0.08, 0.075, 1), 0.68, 0.35, WEAPON_TEX)
    metal = material("M4_dark_metal", (0.025, 0.026, 0.028, 1), 0.55, 0.75)
    polymer = material("M4_black_polymer", (0.008, 0.009, 0.010, 1), 0.86, 0.02)
    wear = material("M4_worn_edges", (0.45, 0.42, 0.34, 1), 0.52, 0.45)
    tan = material("M4_muted_tan", (0.46, 0.38, 0.25, 1), 0.78, 0)

    # Author +Y forward in Blender. glTF export maps that to game-forward -Z.
    cube("body", (0, 0.00, 0.26), (0.28, 1.25, 0.28), atlas, col, visual, bevel=0.02)
    cube("upperReceiver", (0, -0.06, 0.47), (0.26, 1.05, 0.20), atlas, col, visual, bevel=0.02)
    cube("lowerReceiver", (0, -0.10, 0.23), (0.29, 0.62, 0.30), metal, col, visual, bevel=0.02)
    cube("handguard", (0, 0.73, 0.45), (0.34, 0.88, 0.25), atlas, col, visual, bevel=0.02)
    cube("topRail", (0, 0.28, 0.64), (0.30, 1.85, 0.06), metal, col, visual, bevel=0.005)
    for i in range(15):
        cube(f"railTooth_{i:02d}", (0, -0.48 + i * 0.13, 0.71), (0.35, 0.055, 0.075), metal if i % 4 else wear, col, visual, bevel=0.003)
    for i in range(7):
        y = 0.35 + i * 0.12
        cube(f"handguardRib_L_{i:02d}", (-0.205, y, 0.45), (0.035, 0.050, 0.22), polymer, col, visual, bevel=0.003)
        cube(f"handguardRib_R_{i:02d}", (0.205, y, 0.45), (0.035, 0.050, 0.22), polymer, col, visual, bevel=0.003)

    cylinder("barrel", (0, 1.38, 0.45), 0.042, 1.06, metal, col, visual, "Y", 32)
    cylinder("muzzleDevice", (0, 1.98, 0.45), 0.068, 0.20, wear, col, visual, "Y", 32)
    cube("frontSight", (0, 1.18, 0.70), (0.22, 0.10, 0.25), metal, col, visual, bevel=0.01)
    cube("rearSight", (0, -0.52, 0.72), (0.22, 0.12, 0.22), metal, col, visual, bevel=0.01)
    charging = cube("chargingHandle", (0, -0.72, 0.56), (0.36, 0.075, 0.055), metal, col, visual, bevel=0.004)
    mag = cube("mag", (0, -0.18, -0.22), (0.25, 0.34, 0.78), polymer, col, visual, rot=(math.radians(6), 0, 0), bevel=0.025)
    cube("magwell", (0, -0.18, 0.03), (0.32, 0.30, 0.36), metal, col, visual, bevel=0.015)
    cube("pistolGrip", (0, -0.52, -0.08), (0.23, 0.24, 0.65), polymer, col, visual, rot=(math.radians(-14), 0, 0), bevel=0.025)
    cube("triggerGuard", (0, -0.42, 0.07), (0.28, 0.14, 0.075), metal, col, visual, bevel=0.006)
    trigger = cube("trigger", (0, -0.48, 0.02), (0.05, 0.05, 0.17), wear, col, visual, bevel=0.004)
    cylinder("bufferTube", (0, -1.02, 0.36), 0.060, 0.62, metal, col, visual, "Y", 24)
    cube("stock", (0, -1.36, 0.28), (0.34, 0.50, 0.42), polymer, col, visual, bevel=0.03)
    cube("buttPad", (0, -1.64, 0.23), (0.37, 0.08, 0.52), tan, col, visual, bevel=0.02)
    cube("opticMountGuide", (0, -0.08, 0.76), (0.24, 0.18, 0.05), metal, col, visual, bevel=0.005)
    cube("fictionalMarkingPlate", (-0.151, -0.18, 0.29), (0.012, 0.34, 0.09), wear, col, visual, bevel=0.002)

    socket_positions = {
        "muzzle": (0, 2.10, 0.45),
        "muzzleFlash": (0, 2.18, 0.45),
        "gripRight": (0, -0.54, -0.06),
        "gripLeft": (-0.20, 0.62, 0.24),
        "magazine": (0, -0.20, -0.20),
        "ejectionPort": (-0.17, -0.18, 0.51),
        "optic": (0, -0.08, 0.78),
        "scopeCamera": (0, -0.08, 0.82),
        "attachmentMuzzle": (0, 1.98, 0.45),
        "attachmentMag": (0, -0.18, -0.28),
        "attachmentForegrip": (0, 0.72, 0.18),
        "attachmentLaser": (-0.22, 0.98, 0.48),
    }
    for name, loc in socket_positions.items():
        empty(name, loc, col, sockets, 0.045, "SPHERE")

    anim_objs = [root, mag, charging, trigger]
    clear_active_actions(anim_objs)
    key(root, 1, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(root, 40, (0, 0.005, 0.012), (math.radians(0.5), 0, math.radians(0.5)), (1, 1, 1))
    key(root, 80, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    push_clip(anim_objs, "idle", 1, 80)

    clear_active_actions(anim_objs)
    key(root, 1, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(trigger, 1, trigger.location, trigger.rotation_euler, trigger.scale)
    key(charging, 1, charging.location, charging.rotation_euler, charging.scale)
    key(root, 4, (0, -0.035, 0.025), (math.radians(-3), 0, math.radians(-2)), (1, 1, 1))
    key(trigger, 4, trigger.location, (math.radians(14), 0, 0), trigger.scale)
    key(charging, 4, (0, -0.79, 0.56), charging.rotation_euler, charging.scale)
    key(root, 13, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(trigger, 13, trigger.location, (0, 0, 0), trigger.scale)
    key(charging, 13, (0, -0.72, 0.56), charging.rotation_euler, charging.scale)
    push_clip(anim_objs, "fire", 1, 13)

    clear_active_actions(anim_objs)
    key(root, 1, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(mag, 1, (0, -0.18, -0.22), mag.rotation_euler, mag.scale)
    key(charging, 1, (0, -0.72, 0.56), charging.rotation_euler, charging.scale)
    key(root, 18, (0, -0.035, -0.025), (math.radians(4), 0, math.radians(-4)), (1, 1, 1))
    key(mag, 18, (0, -0.25, -0.80), (math.radians(18), 0, 0), mag.scale)
    key(root, 44, (0, -0.075, -0.02), (math.radians(8), 0, math.radians(5)), (1, 1, 1))
    key(mag, 44, (0, -0.42, -1.04), (math.radians(25), 0, math.radians(3)), mag.scale)
    key(root, 66, (0, -0.02, 0.0), (math.radians(3), 0, 0), (1, 1, 1))
    key(mag, 66, (0, -0.18, -0.22), mag.rotation_euler, mag.scale)
    key(charging, 66, (0, -0.95, 0.56), charging.rotation_euler, charging.scale)
    key(root, 84, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(charging, 84, (0, -0.72, 0.56), charging.rotation_euler, charging.scale)
    push_clip(anim_objs, "reload", 1, 84)

    clear_active_actions(anim_objs)
    key(root, 1, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(root, 20, (0, 0.030, 0.018), (math.radians(-1.2), 0, 0), (1, 1, 1))
    key(root, 40, (0, 0.030, 0.018), (math.radians(-1.2), 0, 0), (1, 1, 1))
    push_clip(anim_objs, "ads", 1, 40)

    clear_active_actions(anim_objs)
    key(root, 1, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    key(root, 30, (-0.18, -0.08, 0.12), (math.radians(12), math.radians(10), math.radians(-12)), (1, 1, 1))
    key(root, 64, (0.10, -0.05, 0.08), (math.radians(4), math.radians(-16), math.radians(10)), (1, 1, 1))
    key(root, 96, (0, 0, 0), (0, 0, 0), (1, 1, 1))
    push_clip(anim_objs, "inspect", 1, 96)

    bpy.ops.wm.save_as_mainfile(filepath=str(WEAPON_SRC))
    export_selected_glb(WEAPON_GLB, col)


def build_hands() -> None:
    reset_scene()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 96
    col = collection("OPERATIVE_HANDS_ASSET")
    root = empty("ViewmodelRoot", (0, 0, 0), col, None, 0.12, "ARROWS")
    camera_root = empty("cameraRoot", (0, 0, 0), col, root, 0.08)
    weapon_socket = empty("weapon_socket", (0, 0, 0), col, camera_root, 0.06)
    glove = material("VM_black_glove", (0.012, 0.014, 0.018, 1), 0.88, 0)
    fabric = material("VM_sleeve_fabric", (0.045, 0.052, 0.060, 1), 0.76, 0)
    rubber = material("VM_knuckle_rubber", (0.02, 0.022, 0.025, 1), 0.70, 0)

    nodes = {}

    def node(name, loc, parent):
        nodes[name] = empty(name, loc, col, parent, 0.035)
        return nodes[name]

    rw = node("wrist_r", (0.13, -0.42, -0.10), camera_root)
    rp = node("palm_r", (0.13, -0.48, -0.08), rw)
    lw = node("wrist_l", (-0.16, 0.34, 0.08), camera_root)
    lp = node("palm_l", (-0.18, 0.48, 0.12), lw)
    for side, palm, sx in (("r", rp, 1), ("l", lp, -1)):
        node(f"thumb_{side}_01", (0.028 * sx, -0.010, 0.008), palm)
        node(f"thumb_{side}_02", (0.044 * sx, -0.020, 0.004), nodes[f"thumb_{side}_01"])
        node(f"thumb_{side}_03", (0.056 * sx, -0.026, 0.000), nodes[f"thumb_{side}_02"])
        for fname, xo in (("index", 0.018), ("middle", 0.006), ("ring", -0.006), ("pinky", -0.018)):
            xo *= sx
            node(f"{fname}_{side}_01", (xo, -0.030, 0.004), palm)
            node(f"{fname}_{side}_02", (xo, -0.052, 0.000), nodes[f"{fname}_{side}_01"])
            node(f"{fname}_{side}_03", (xo, -0.070, -0.004), nodes[f"{fname}_{side}_02"])

    def hand_mesh(prefix, wrist, palm, sx):
        cube(f"{prefix}_sleeve", (0, 0.050, 0), (0.095, 0.18, 0.10), fabric, col, wrist, bevel=0.02)
        cube(f"{prefix}_palm_mesh", (0, 0, 0), (0.095, 0.085, 0.045), glove, col, palm, bevel=0.016)
        cube(f"{prefix}_knuckle_pad", (0, -0.036, 0.028), (0.090, 0.020, 0.014), rubber, col, palm, bevel=0.005)
        for i, x in enumerate((-0.030, -0.010, 0.010, 0.030)):
            cube(f"{prefix}_finger_{i}", (x, -0.065, 0), (0.014, 0.062, 0.018), glove, col, palm, bevel=0.006)
        cube(f"{prefix}_thumb_mesh", (0.047 * sx, -0.030, 0), (0.018, 0.052, 0.018), glove, col, palm, rot=(0, 0, math.radians(28 * sx)), bevel=0.006)

    hand_mesh("right", rw, rp, 1)
    hand_mesh("left", lw, lp, -1)

    anim_objs = [camera_root, weapon_socket, rw, rp, lw, lp]

    def hand_clip(name, frames):
        clear_active_actions(anim_objs)
        for frame, data in frames:
            for obj_name, vals in data.items():
                obj = nodes.get(obj_name) or {"cameraRoot": camera_root, "weapon_socket": weapon_socket}.get(obj_name)
                if not obj:
                    continue
                key(obj, frame, vals.get("loc", obj.location), vals.get("rot", obj.rotation_euler), vals.get("scale", obj.scale))
        push_clip(anim_objs, name, min(frame for frame, _ in frames), max(frame for frame, _ in frames))

    rest = {
        "wrist_r": {"loc": (0.13, -0.42, -0.10), "rot": (math.radians(8), 0, math.radians(-7)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.16, 0.34, 0.08), "rot": (math.radians(6), 0, math.radians(9)), "scale": (1, 1, 1)},
    }
    hand_clip("idle", [(1, rest), (40, {
        "wrist_r": {"loc": (0.13, -0.422, -0.095), "rot": (math.radians(9), 0, math.radians(-6)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.16, 0.338, 0.085), "rot": (math.radians(7), 0, math.radians(8)), "scale": (1, 1, 1)},
    }), (80, rest)])
    hand_clip("walkSway", [(1, rest), (20, {
        "wrist_r": {"loc": (0.145, -0.43, -0.10), "rot": (math.radians(10), 0, math.radians(-10)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.175, 0.35, 0.08), "rot": (math.radians(8), 0, math.radians(12)), "scale": (1, 1, 1)},
    }), (40, rest)])
    hand_clip("sprint", [(1, rest), (26, {
        "wrist_r": {"loc": (0.16, -0.30, -0.18), "rot": (math.radians(34), 0, math.radians(-18)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.18, 0.16, -0.10), "rot": (math.radians(38), 0, math.radians(16)), "scale": (1, 1, 1)},
    })])
    hand_clip("ads", [(1, rest), (20, {
        "wrist_r": {"loc": (0.085, -0.47, -0.075), "rot": (math.radians(2), 0, math.radians(-2)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.095, 0.42, 0.125), "rot": (math.radians(1), 0, math.radians(3)), "scale": (1, 1, 1)},
    })])
    hand_clip("reloadRifle", [(1, rest), (18, {
        "wrist_r": {"loc": (0.13, -0.42, -0.10), "rot": (math.radians(11), 0, math.radians(-12)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.17, 0.04, -0.28), "rot": (math.radians(42), math.radians(-6), math.radians(18)), "scale": (1, 1, 1)},
    }), (44, {
        "wrist_l": {"loc": (-0.13, -0.18, -0.42), "rot": (math.radians(55), math.radians(-8), math.radians(-18)), "scale": (1, 1, 1)}
    }), (66, {
        "wrist_r": {"loc": (0.18, -0.50, -0.08), "rot": (math.radians(-4), 0, math.radians(-18)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.13, 0.20, -0.02), "rot": (math.radians(22), math.radians(-4), math.radians(10)), "scale": (1, 1, 1)},
    }), (84, rest)])
    hand_clip("fireRifle", [(1, rest), (5, {
        "wrist_r": {"loc": (0.14, -0.45, -0.12), "rot": (math.radians(-8), 0, math.radians(-10)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.16, 0.32, 0.07), "rot": (math.radians(11), 0, math.radians(6)), "scale": (1, 1, 1)},
    }), (14, rest)])
    hand_clip("inspect", [(1, rest), (36, {
        "wrist_r": {"loc": (0.22, -0.30, 0.02), "rot": (math.radians(18), math.radians(8), math.radians(-30)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.22, 0.12, 0.22), "rot": (math.radians(18), math.radians(-10), math.radians(22)), "scale": (1, 1, 1)},
    }), (88, rest)])
    hand_clip("weaponSwap", [(1, rest), (18, {
        "wrist_r": {"loc": (0.13, -0.18, -0.34), "rot": (math.radians(45), 0, math.radians(-18)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.16, 0.10, -0.25), "rot": (math.radians(42), 0, math.radians(16)), "scale": (1, 1, 1)},
    }), (42, rest)])
    hand_clip("tacticalLean", [(1, rest), (20, {
        "cameraRoot": {"loc": (0, 0, 0), "rot": (0, 0, math.radians(-8)), "scale": (1, 1, 1)},
        "wrist_r": {"loc": (0.15, -0.42, -0.10), "rot": (math.radians(8), 0, math.radians(-13)), "scale": (1, 1, 1)},
        "wrist_l": {"loc": (-0.14, 0.34, 0.08), "rot": (math.radians(6), 0, math.radians(3)), "scale": (1, 1, 1)},
    }), (40, rest)])

    bpy.ops.wm.save_as_mainfile(filepath=str(HANDS_SRC))
    export_selected_glb(HANDS_GLB, col)


def main() -> None:
    ensure_dirs()
    if not WEAPON_TEX.exists():
        raise FileNotFoundError(f"Missing texture: {WEAPON_TEX}")
    build_m4()
    build_hands()
    print({
        "weapon_src": str(WEAPON_SRC),
        "weapon_glb": str(WEAPON_GLB),
        "hands_src": str(HANDS_SRC),
        "hands_glb": str(HANDS_GLB),
    })


if __name__ == "__main__":
    main()
