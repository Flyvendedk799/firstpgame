#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCustomMapPack } from '../src/customMaps/customMapValidation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_PATH = path.join(ROOT, 'public', 'assets', 'level-kit', 'b01-megaplex', 'manifest.json');
const BUILTIN_INDEX = path.join(ROOT, 'public', 'custom-maps', 'builtin', 'index.json');
const DEV_DIR = path.join(ROOT, 'public', 'custom-maps', 'dev');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const kit = readJson(KIT_PATH);
const files = [];
if (fs.existsSync(BUILTIN_INDEX)) {
  const index = readJson(BUILTIN_INDEX);
  for (const item of index.packs || []) {
    if (!item.url) continue;
    files.push(path.join(ROOT, 'public', item.url.replace(/^\//, '')));
  }
}
if (fs.existsSync(DEV_DIR)) {
  for (const name of fs.readdirSync(DEV_DIR)) {
    if (name.endsWith('.json') && name !== 'index.json') files.push(path.join(DEV_DIR, name));
  }
}

const reports = [];
const errors = [];
const warnings = [];
for (const file of files) {
  const pack = readJson(file);
  const report = validateCustomMapPack(pack, kit);
  reports.push({ file: path.relative(ROOT, file), ...report });
  if (!report.ok) for (const err of report.errors) errors.push(`${path.relative(ROOT, file)}:${err}`);
  for (const warn of report.warnings) warnings.push(`${path.relative(ROOT, file)}:${warn}`);
}

const result = { ok: errors.length === 0, packs: reports.length, errors, warnings, reports };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

