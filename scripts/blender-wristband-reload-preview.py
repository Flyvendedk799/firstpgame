import json
import math
from pathlib import Path

import bpy


OUT_DIR = Path("screenshots/blender-wristband-reload-test")
OUT_DIR.mkdir(parents=True, exist_ok=True)

ACTIVE_CLIPS = {"reloadRifle", "holoReloadDeploy", "wristbandIdle"}

for obj in bpy.data.objects:
    ad = obj.animation_data
    if not ad:
        continue
    for track in ad.nla_tracks:
        track.mute = track.name not in ACTIVE_CLIPS

bpy.ops.object.light_add(type="AREA", location=(0.0, -2.0, 2.0))
key = bpy.context.object
key.name = "preview_area_key"
key.data.energy = 500
key.data.size = 4

bpy.ops.object.camera_add(location=(0.0, -1.20, 0.18), rotation=(math.radians(82), 0, 0))
cam = bpy.context.object
cam.name = "preview_reload_camera"
bpy.context.scene.camera = cam

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.eevee.taa_render_samples = 32

frames = [1, 10, 18, 28, 40, 50, 66, 84]
tracked = ["wrist_l", "wristband_root", "wristband_screen", "hologram_reload", "holo_ray_reload"]
samples = []

for frame in frames:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    rec = {"frame": frame}
    for name in tracked:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        rec[name] = {
            "worldLoc": [round(v, 4) for v in obj.matrix_world.translation],
            "localLoc": [round(v, 4) for v in obj.location],
            "scale": [round(v, 4) for v in obj.scale],
            "visible": bool(obj.visible_get()),
        }
    bpy.context.scene.render.filepath = str(OUT_DIR / f"reload_blender_{frame:03d}.png")
    bpy.ops.render.render(write_still=True)
    samples.append(rec)

(OUT_DIR / "samples.json").write_text(json.dumps(samples, indent=2))
print(json.dumps({"ok": True, "out": str(OUT_DIR), "frames": frames}, indent=2))
