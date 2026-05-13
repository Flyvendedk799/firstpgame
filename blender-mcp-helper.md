# Blender MCP Helper

Project-specific guidance for Codex using Blender MCP on this game. The goal is to use Blender as a precise asset inspection and fitting tool, not to burn time rediscovering known coordinate, socket, and runtime issues.

## Use Blender MCP For

- Inspecting `.blend` hierarchy, transforms, parent relationships, and material counts.
- Checking whether the live Blender window is showing the file you think it is.
- Rendering quick asset-fit previews without launching the game.
- Building unsaved preview scenes that combine weapon + hands + sockets.
- Verifying wristband and hologram orientation from a player-like camera.
- Checking animation clips and NLA/action names.
- Inspecting authored source files before editing the generator script.

Use static Node checks for manifest/GLB contracts. Use browser/Playwright only for final runtime visual passes, not for every Blender-side fit tweak.

## First Step Every Time

Start by asking Blender what is actually open:

```python
result = {
    "file": bpy.data.filepath,
    "scene": bpy.context.scene.name,
    "objects": len(bpy.context.scene.objects),
}
```

The live Blender window can be stale. During the M4/hand work, Blender still had an old `operative_hands.blend` open after the GLB had been rebuilt. That made visual debugging lie.

If you need the saved source file, reload it explicitly:

```python
bpy.ops.wm.open_mainfile(filepath="/Users/tobiasmastek/Desktop/firstpgame/art_src/viewmodels/operative_hands.blend")
```

Do this before trusting object transforms.

## Do Not Use Destructive Resets In MCP

Avoid blocked/destructive operators such as:

```python
bpy.ops.wm.read_factory_settings(use_empty=True)
```

For temporary preview scenes, clear the current scene explicitly:

```python
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for block_list in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.actions, bpy.data.collections):
    for datablock in list(block_list):
        if datablock.users == 0:
            block_list.remove(datablock)
```

Do not save this preview scene over source files. Source edits should come from the repo script or deliberate `.blend` edits.

## Prefer Scripted Source Generation

For this repo, reproducibility matters more than ad hoc viewport edits.

Preferred workflow:

1. Edit [scripts/build-m4-viewmodel-assets.py](scripts/build-m4-viewmodel-assets.py) or another deterministic generator.
2. Run Blender CLI:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-m4-viewmodel-assets.py
```

3. Inspect the resulting `.blend` and `.glb`.
4. Run static validators.

Use Blender MCP to inspect and preview. Use the generator script for durable asset changes.

## Know The Coordinate Mapping

Project convention:

- Blender source weapon forward is `+Y`.
- Exported glTF/game forward is `-Z`.
- Source-to-game position mapping is effectively:

```text
Blender source: (x, y, z)
Game local:     (x, z, -y)
```

When converting runtime offsets back into Blender preview space:

```text
Game local extra:      (x, y, z)
Blender source extra:  (x, -z, y)
```

This matters for socket preview. Do not eyeball an offset without mapping axes.

## Known Viewmodel Runtime Fit

The runtime scales authored M4 to a first-person length and aligns the muzzle. For Blender-side preview, approximate the current M4 runtime placement with:

```python
m4_root.scale = (0.1702, 0.1702, 0.1702)
m4_root.location = (0.006, 0.163, -0.051)
```

Then retarget hands to sockets:

```python
right extra, game local: (0.030, -0.050, 0.020)
left extra, game local:  (-0.050, -0.020, 0.004)
```

Convert those extras to Blender source space before adding to socket positions.

## Hand/Wristband Gotchas

The major hand bug was not a missing mesh. It was bad hierarchy math:

- `palm_r` and `palm_l` were parented under wrists.
- They had world-sized offsets instead of wrist-local offsets.
- Runtime retargeting snapped the palm to sockets and dragged the whole wrist/forearm away.

Correct shape:

```text
wrist_r
  palm_r   # short local offset

wrist_l
  palm_l   # short local offset
  wristband_root
```

Use Blender MCP to check:

```python
for name in ["wrist_r", "palm_r", "wrist_l", "palm_l", "wristband_root"]:
    o = bpy.data.objects.get(name)
    print(name, o.location[:], o.parent.name if o and o.parent else None)
```

Expected palm offsets are small. If a palm has values like the wrist world position, it is wrong.

The wristband must be visible from the player camera. A thin cyan edge is not enough. In Blender preview, it should read as a wrist computer on the left forearm, with a screen/hologram surface facing the player.

## Hologram Gotchas

Holograms are not flat HUD overlays.

They should be authored as 3D objects:

- `hologram_inventory`
- `hologram_reload`
- `hologram_shop`
- `holo_ray_inventory`
- `holo_ray_reload`
- `holo_ray_idle`

Rules:

- Panels should tilt toward the player camera.
- Runtime canvas textures should land on existing authored planes.
- Reload hologram should still face the player during reload pose.
- If a screenshot shows a flat edge or invisible panel, adjust the Blender transform first, then verify runtime texture binding.

## Building A Blender Preview Scene

Use a temporary unsaved scene to combine assets:

```python
from mathutils import Vector

def load_objects(path, col_name, prefix=""):
    col = bpy.data.collections.new(col_name)
    bpy.context.scene.collection.children.link(col)
    with bpy.data.libraries.load(path, link=False) as (data_from, data_to):
        data_to.objects = list(data_from.objects)
    out = []
    for obj in data_to.objects:
        if obj is None:
            continue
        if prefix:
            obj.name = prefix + obj.name
        col.objects.link(obj)
        out.append(obj)
    return {o.name: o for o in out}
```

Then:

- Load M4 with prefix `m4_`.
- Load USP with prefix `usp_`.
- Load hands with no prefix.
- Clear animation data for preview objects if rest pose is needed.
- Apply approximate runtime scale/offset.
- Retarget palms to socket positions.
- Add an orthographic camera and area light.
- Render a thumbnail.

## Rendering Previews

Blender MCP thumbnail renders are quick but can be too dark if materials are PBR-dark. For inspection, it is fine to temporarily brighten materials in the preview scene only.

Useful preview adjustments:

```python
world = scene.world or bpy.data.worlds.new("World")
scene.world = world
world.color = (0.10, 0.10, 0.11)

bpy.ops.object.light_add(type="AREA", location=(0, -0.45, 0.85))
light = bpy.context.object
light.data.energy = 900
light.data.size = 3

cam.data.type = "ORTHO"
cam.data.ortho_scale = 1.65
```

Remember: inspection lighting is not game lighting. Do not save these material changes to source assets unless they are deliberate art changes.

## What To Inspect Before Editing

Before changing code or assets, inspect:

- `bpy.data.filepath`
- object names and parent chains
- local transforms for sockets and palms
- world transforms after dependency graph update
- mesh count/material count
- available animation names
- whether source file and GLB are in sync

Use structured results, not giant print dumps:

```python
result = {
    "file": bpy.data.filepath,
    "object_count": len(bpy.context.scene.objects),
    "interesting": rows,
}
```

## What Not To Waste Time On

Do not repeatedly use Playwright to debug:

- palm parenting
- wristband placement
- Blender source scale
- socket local positions
- missing node names
- missing clips
- material/texture counts

Use Blender MCP plus static validators for those.

Do not assume:

- the currently open Blender file is current
- a visible Blender model is exported correctly
- a valid GLB is routed to the correct weapon slot
- a socket exists just because the visual part exists
- a palm looks close in rest pose after runtime retargeting
- an old direct GLTF loader is harmless once a manifest asset exists

## Static Checks After Blender Work

Run these after rebuilding assets:

```bash
npm run validate:weapons
node scripts/asset-registry-probe.mjs
npm run build
```

Use Python syntax checks for Blender generator scripts:

```bash
python3 -m py_compile scripts/build-m4-viewmodel-assets.py
```

Do not run:

```bash
node --check scripts/build-m4-viewmodel-assets.py
```

Node does not syntax-check Python.

## Cleanup

Blender creates backup files such as:

```text
*.blend1
*.blend2
```

Remove them unless the user explicitly wants backup files committed.

Also remove generated Python caches:

```text
__pycache__/
```

Check before committing:

```bash
find . -name "*.blend1" -o -name "*.blend2" -o -name "__pycache__"
git status --short --branch
```

## Commit Discipline

When committing asset work:

- Include the `.blend` source.
- Include the exported `.glb`.
- Include manifest/runtime changes.
- Include validator or test updates.
- Do not include temporary preview screenshots unless requested.
- Be explicit if unrelated user work is also being committed.

## Final Visual Rule

Use Blender MCP first to make the asset physically coherent. Use in-game visual testing last to verify the runtime path. The game screenshot should be a confirmation, not the first place we discover that a palm, wristband, hologram, or slot route is wrong.
