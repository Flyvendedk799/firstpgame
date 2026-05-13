#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ALL_MANIFESTS,
  validateAllManifests
} from '../src/assetManifest.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const validator = path.join(ROOT, 'scripts', 'validate-weapon-glb.mjs');

function publicPath(src) {
  return path.join(ROOT, 'public', String(src).replace(/^\/+/, ''));
}

function typeForEntry(entry) {
  if (entry.kind === 'weapon') return 'weapon';
  if (entry.kind === 'viewmodel') return 'hands';
  return null;
}

function runGlbValidator(file, type) {
  const res = spawnSync(process.execPath, [validator, file, '--type', type], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  let report = null;
  try {
    report = JSON.parse(res.stdout || '{}');
  } catch (_) {
    report = { ok: false, errors: ['validator produced non-json output'], stdout: res.stdout, stderr: res.stderr };
  }
  return {
    ok: res.status === 0 && !!report.ok,
    status: res.status,
    report,
    stderr: res.stderr.trim()
  };
}

const manifestValidation = validateAllManifests();
const authored = [];
const skipped = [];
const failures = [];

for (const [kind, manifest] of Object.entries(ALL_MANIFESTS)) {
  for (const entry of Object.values(manifest)) {
    if (!entry.src) continue;
    const type = typeForEntry(entry);
    const file = publicPath(entry.src);
    if (!type) {
      skipped.push({ id: entry.id, kind, src: entry.src, reason: 'no static GLB validator for kind' });
      continue;
    }
    if (!fs.existsSync(file)) {
      const row = { id: entry.id, kind, src: entry.src, file, ok: false, errors: ['missing authored file'] };
      authored.push(row);
      failures.push(row);
      continue;
    }
    const out = runGlbValidator(file, type);
    const row = {
      id: entry.id,
      kind,
      src: entry.src,
      file: path.relative(ROOT, file),
      type,
      ok: out.ok,
      triangles: out.report.triangles,
      materials: out.report.materials,
      textures: out.report.textures,
      clips: out.report.clips,
      errors: out.report.errors || [],
      warnings: out.report.warnings || []
    };
    authored.push(row);
    if (!row.ok) failures.push(row);
  }
}

const legacyQuarantine = {
  id: 'legacy.weapon.pistol.usp',
  manifestId: 'weapon.pistol',
  file: 'public/assets/weapons/usp_viewmodel.glb',
  acceptedAsManifestAsset: false,
  reason: 'missing standard weapon hierarchy/sockets; keep legacy runtime path until reauthored or adapter-normalized'
};

const result = {
  ok: manifestValidation.ok && failures.length === 0,
  manifestValidation: {
    ok: manifestValidation.ok,
    errors: manifestValidation.errors,
    warnings: manifestValidation.warnings
  },
  authored,
  skipped,
  legacyQuarantine,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
