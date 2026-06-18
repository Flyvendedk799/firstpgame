import fs from 'fs';
import path from 'path';
import {
  CORE_VISUAL_PATCH_VERSION,
  CORE_VISUAL_PATCH_SEQUENCES,
  summarizeCoreVisualPatchSequences
} from '../src/assetManifest.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const root = process.cwd();
const mainSrc = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const acceptanceRunner = fs.existsSync(path.join(root, 'scripts/run-acceptance.mjs'))
  ? fs.readFileSync(path.join(root, 'scripts/run-acceptance.mjs'), 'utf8')
  : '';
const sequenceSummary = summarizeCoreVisualPatchSequences(CORE_VISUAL_PATCH_SEQUENCES);

assert(CORE_VISUAL_PATCH_VERSION === 'core-visual-polish-v1', `unexpected patch version: ${CORE_VISUAL_PATCH_VERSION}`);
assert(sequenceSummary.complete, `core visual sequences are not complete: ${JSON.stringify(sequenceSummary.statuses)}`);
assert(sequenceSummary.total === 9, `expected 9 core visual sequences including 8.5, got ${sequenceSummary.total}`);

const scripts = packageJson.scripts || {};
assert(scripts['capture:core-visual-baseline'], 'missing capture:core-visual-baseline script');
assert(scripts['test:core-visual-finalization'], 'missing test:core-visual-finalization script');
assert(
  (scripts['test:acceptance'] || '').includes('test:core-visual-finalization') ||
  acceptanceRunner.includes("'test:core-visual-finalization'") ||
  acceptanceRunner.includes('"test:core-visual-finalization"'),
  'test:acceptance does not include core visual finalization'
);

const requiredMainHooks = [
  'CORE_VISUAL_MATERIAL_POLISH_VERSION',
  '_CORE_VISUAL_ATMOSPHERE_POLISH_PROFILES',
  '_CORE_VISUAL_COMBAT_VFX_POLISH_VERSION',
  '_CORE_VISUAL_VIEWMODEL_POLISH_VERSION',
  '_CORE_VISUAL_ENV_COHESION_VERSION',
  '_CORE_VISUAL_POST_CAMERA_VERSION',
  '_CORE_VISUAL_FINALIZATION_VERSION',
  '_CORE_VISUAL_FINAL_TEST_VERSION',
  '_coreVisualPatchRuntimeStatus',
  'coreVisualPatchStatus',
  'coreVisualPatchPlan',
  'postCameraPolish',
  'visualBudgetHeadroom'
];

const missingHooks = requiredMainHooks.filter((hook) => !mainSrc.includes(hook));
assert(missingHooks.length === 0, `missing finalization hooks: ${missingHooks.join(', ')}`);

const outDir = path.join(root, 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'core-visual-finalization.json');
const report = {
  ok: true,
  createdAt: new Date().toISOString(),
  version: CORE_VISUAL_PATCH_VERSION,
  sequenceSummary,
  requiredMainHooks
};

fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, version: CORE_VISUAL_PATCH_VERSION, report: outPath }, null, 2));
