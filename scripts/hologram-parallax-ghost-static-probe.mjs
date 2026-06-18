import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOLOGRAM_PARALLAX_GHOST_VERSION } from '../src/game/hologramVisuals.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const visuals = readFileSync(join(root, 'src/game/hologramVisuals.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(HOLOGRAM_PARALLAX_GHOST_VERSION === 'hologram-parallax-ghost.v1', 'parallax ghost version missing');
assert(main.includes("from './game/hologramVisuals.js'"), 'hologram visuals import missing');
assert(visuals.includes('export function syncHoloGhostPlane'), 'ghost sync helper missing');
assert(main.includes('syncHoloGhostPlane as _syncHoloGhostPlaneCore') && main.includes('function _syncHoloGhostPlane'), 'main ghost helper bridge missing');
for (const key of ['wristGhost', 'shopGhost', 'reloadGhost', 'wristGhostM', 'shopGhostM', 'reloadGhostM']) {
  assert(main.includes(key), `${key} missing`);
}
assert(main.includes('wristGrp.add(wristGlow,wristGhost,wristPanel'), 'wrist ghost not attached behind panel');
assert(main.includes('shopGrp.add(shopGlow,shopGhost,shopPanel'), 'shop ghost not attached behind panel');
assert(main.includes('reloadHoloGrp.add(reloadGlow,reloadGhost,reloadHolo'), 'reload ghost not attached behind panel');
assert(main.includes('_syncHoloGhostPlane(wristGhost,wristGhostM,wristDeployed'), 'wrist ghost runtime missing');
assert(main.includes('_syncHoloGhostPlane(shopGhost,shopGhostM,shopDeployed'), 'shop ghost runtime missing');
assert(main.includes('_syncHoloGhostPlane(reloadGhost,reloadGhostM,reloadHoloDeployed'), 'reload ghost runtime missing');
assert(main.includes('reloadGhostM.opacity=0') && main.includes('_syncHoloGhostPlane(reloadGhost,reloadGhostM,0'), 'reload ghost authored hide missing');
assert(main.includes('parallaxGhostVersion:HOLOGRAM_PARALLAX_GHOST_VERSION'), 'parallax ghost debug version missing');
assert(main.includes('ghostOpacity:Number((wristGhostM.opacity||0).toFixed(3))'), 'wrist ghost opacity debug missing');
assert(main.includes('ghostOpacity:Number((shopGhostM.opacity||0).toFixed(3))'), 'shop ghost opacity debug missing');
assert(main.includes('ghostOpacity:Number((reloadGhostM.opacity||0).toFixed(3))'), 'reload ghost opacity debug missing');

console.log(JSON.stringify({
  ok: true,
  version: HOLOGRAM_PARALLAX_GHOST_VERSION,
  ghosts: ['wrist', 'shop', 'reload']
}, null, 2));
