import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const main = readFileSync(join(process.cwd(), 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(main.includes('function ensureRetryCheckpoint'), 'missing ensureRetryCheckpoint');
assert(main.includes("grade==='-'"), 'death grade branch missing');
assert(main.includes('ensureRetryCheckpoint()'), 'death path must call ensureRetryCheckpoint');
assert(main.includes('function restartGame'), 'missing restartGame');
assert(main.includes('RETRY BUILDING'), 'defeat screen should label retry building');
assert(/function restartGame\(\)[\s\S]*?PROGRESS\.runSave/.test(main), 'restartGame must prefer PROGRESS.runSave');
assert(!/function restartGame\(\)\{[^}]*G\.building=1/.test(main), 'restartGame must not hard-reset to building 1');
assert(main.includes('setMoodScale'), 'lighting mood scale missing');
assert(main.includes("_pendingMidDoor"), 'survival mid-door gate missing');
assert(main.includes('function applyLieutenantBehavior'), 'lieutenant behavior applicator missing');
assert(main.includes('applyLieutenantBehavior(lt,G.building)'), 'lieutenant spawn must apply behavior');
assert(main.includes('fogD:.030'), 'B11 fog should be softened for STABLE readability');
assert(main.includes('BLACKOUT setpiece dims further') || main.includes('ambInt:1.45'), 'hospital base lighting readability bump missing');

console.log('steam-ready-retry-static-probe: OK');
