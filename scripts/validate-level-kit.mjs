#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_DIR = path.join(ROOT, 'public', 'assets', 'level-kit', 'b01-megaplex');
const manifestPath = path.join(KIT_DIR, 'manifest.json');

const errors = [];
const warnings = [];

function exists(rel) {
  return fs.existsSync(path.join(KIT_DIR, rel));
}

if (!fs.existsSync(manifestPath)) {
  errors.push('missing_manifest');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1) errors.push('bad_schema_version');
  if (!manifest.id) errors.push('missing_kit_id');
  if (!manifest.runtimeTransform || manifest.runtimeTransform.units !== 'meters') errors.push('runtime_units_must_be_meters');
  const ids = new Set();
  for (const prefab of manifest.prefabs || []) {
    if (!prefab.id) errors.push('prefab_missing_id');
    if (ids.has(prefab.id)) errors.push(`prefab_duplicate_id:${prefab.id}`);
    ids.add(prefab.id);
    if (!prefab.category) errors.push(`prefab_missing_category:${prefab.id}`);
    if (!Array.isArray(prefab.footprint) || prefab.footprint.length !== 2) errors.push(`prefab_bad_footprint:${prefab.id}`);
    if (!Array.isArray(prefab.parts) || !prefab.parts.length) errors.push(`prefab_missing_parts:${prefab.id}`);
    if (prefab.src && !exists(prefab.src)) errors.push(`prefab_missing_glb:${prefab.id}:${prefab.src}`);
    if (prefab.thumbnail && !exists(prefab.thumbnail)) errors.push(`prefab_missing_thumbnail:${prefab.id}:${prefab.thumbnail}`);
    for (const part of prefab.parts || []) {
      if (!part.name) errors.push(`part_missing_name:${prefab.id}`);
      if (part.kind !== 'box') warnings.push(`part_kind_not_box:${prefab.id}:${part.name}`);
      if (!Array.isArray(part.size) || part.size.length !== 3 || part.size.some((n) => !Number.isFinite(Number(n)) || Number(n) <= 0)) errors.push(`part_bad_size:${prefab.id}:${part.name}`);
      if (!Array.isArray(part.offset) || part.offset.length !== 3 || part.offset.some((n) => !Number.isFinite(Number(n)))) errors.push(`part_bad_offset:${prefab.id}:${part.name}`);
      if (!part.material || !manifest.materials || !manifest.materials[part.material]) errors.push(`part_missing_material:${prefab.id}:${part.name}:${part.material}`);
      if (!part.collision) errors.push(`part_missing_collision:${prefab.id}:${part.name}`);
      if (part.collision === 'cover_aabb') {
        const h = Number(part.size && part.size[1]);
        if (h < 0.38 || h > 1.8) warnings.push(`cover_height_outside_band:${prefab.id}:${part.name}:${h}`);
      }
      if (part.collision === 'transparent_window_aabb' && !part.glassPane) warnings.push(`window_without_glassPane:${prefab.id}:${part.name}`);
    }
    const budget = prefab.budgets || {};
    if ((budget.triangles || 0) > 5000) warnings.push(`prefab_triangle_budget_high:${prefab.id}:${budget.triangles}`);
    if ((budget.dynamicLights || 0) > 0) warnings.push(`prefab_dynamic_lights:${prefab.id}:${budget.dynamicLights}`);
    if ((budget.transparentSurfaces || 0) > 4) warnings.push(`prefab_transparency_high:${prefab.id}:${budget.transparentSurfaces}`);
  }
  const required = ['door.security_gate', 'cover.half_crate', 'window.breakable_5m', 'marker.enemy_spawn', 'module.straight_hallway_clear', 'module.split_sightline'];
  for (const id of required) if (!ids.has(id)) errors.push(`missing_required_prefab:${id}`);
}

const result = { ok: errors.length === 0, errors, warnings };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

