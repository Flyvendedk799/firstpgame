#!/usr/bin/env python3
"""Export the Clearance B01 level kit.

Run from the repo with:

  blender --background --python scripts/export-level-kit.py

When Blender is not available this script validates that the generated game
manifest exists and delegates deterministic GLB/thumbnail generation to the
Node-based asset builder. The Blender path is intentionally source-first: the
single `.blend` kit remains the DCC source, while the game consumes per-prefab
GLBs plus manifest metadata.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_BLEND = ROOT / "art_src" / "level-kit" / "clearance_b01_level_kit.blend"
OUT_DIR = ROOT / "public" / "assets" / "level-kit" / "b01-megaplex"
NODE_BUILDER = ROOT / "scripts" / "generate-level-kit-assets.mjs"


def run_node_builder() -> None:
    subprocess.check_call(["node", str(NODE_BUILDER)], cwd=str(ROOT))


def validate_generated_manifest() -> dict:
    manifest_path = OUT_DIR / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"missing generated manifest: {manifest_path}")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    missing = []
    for prefab in data.get("prefabs", []):
        for key in ("src", "thumbnail"):
            rel = prefab.get(key)
            if rel and not (OUT_DIR / rel).exists():
                missing.append(f"{prefab.get('id')}:{rel}")
    if missing:
        raise SystemExit("missing generated level-kit assets:\n" + "\n".join(missing))
    return data


def blender_export() -> None:
    import bpy  # type: ignore

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if SOURCE_BLEND.exists():
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    else:
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))

    # The authored Blender source can be richer than the deterministic fallback,
    # but the runtime contract is the JSON manifest. Build those assets now.
    run_node_builder()


def main() -> None:
    try:
        import bpy  # noqa: F401
    except Exception:
        run_node_builder()
    else:
        blender_export()
    data = validate_generated_manifest()
    print(f"export-level-kit: OK ({len(data.get('prefabs', []))} prefabs)")


if __name__ == "__main__":
    main()

