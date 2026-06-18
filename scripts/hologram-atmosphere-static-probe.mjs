import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOLOGRAM_ATMOSPHERE_VERSION } from '../src/game/hologramVisuals.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const visuals = readFileSync(join(root, 'src/game/hologramVisuals.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(HOLOGRAM_ATMOSPHERE_VERSION === 'hologram-atmosphere.v1', 'atmosphere version missing');
assert(main.includes("from './game/hologramVisuals.js'"), 'hologram visuals import missing');
assert(visuals.includes('export function createHoloMoteField') && visuals.includes('export function syncHoloMoteField'), 'mote field helpers missing');
assert(visuals.includes('export function createHoloRippleRing') && visuals.includes('export function syncHoloRippleRing'), 'ripple helpers missing');
assert(visuals.includes('new THREE.PointsMaterial') && visuals.includes('new THREE.Points(geo, mat)'), 'hologram mote point cloud missing');
assert(main.includes('createHoloMoteField as _createHoloMoteFieldCore') && main.includes('createHoloRippleRing as _createHoloRippleRingCore'), 'main atmosphere helper bridge missing');
for (const key of ['wristMotes', 'shopMotes', 'reloadMotes', 'wristRipple', 'shopRipple', 'reloadRipple']) {
  assert(main.includes(key), `${key} missing`);
}
assert(main.includes('wristGrp.add(wristGlow,wristGhost,wristPanel,wristLayer,wristDepthFrame,wristMotes,wristRipple)'), 'wrist atmosphere not attached');
assert(main.includes('shopGrp.add(shopGlow,shopGhost,shopPanel,shopLayer,shopDepthFrame,shopMotes,shopRipple)'), 'shop atmosphere not attached');
assert(main.includes('reloadHoloGrp.add(reloadGlow,reloadGhost,reloadHolo,reloadLayer,reloadDepthFrame,reloadMotes,reloadRipple)'), 'reload atmosphere not attached');
assert(main.includes('_syncHoloMoteField(wristMotes,wristDeployed') && main.includes('_syncHoloMoteField(shopMotes,shopDeployed') && main.includes('_syncHoloMoteField(reloadMotes,reloadHoloDeployed'), 'mote runtime sync missing');
assert(main.includes('_syncHoloRippleRing(wristRipple,wristDeployed') && main.includes('_syncHoloRippleRing(shopRipple,shopDeployed') && main.includes('_syncHoloRippleRing(reloadRipple,reloadHoloDeployed'), 'ripple runtime sync missing');
assert(main.includes('_syncHoloMoteField(reloadMotes,0') && main.includes('_syncHoloRippleRing(reloadRipple,0'), 'reload atmosphere authored hide missing');
assert(main.includes('atmosphereVersion:HOLOGRAM_ATMOSPHERE_VERSION'), 'atmosphere debug version missing');
assert(main.includes('motesVisible:!!wristMotes.visible') && main.includes('motesVisible:!!shopMotes.visible') && main.includes('motesVisible:!!reloadMotes.visible'), 'mote visibility debug missing');
assert(main.includes('rippleOpacity:Number((wristRipple.material.opacity||0).toFixed(3))'), 'wrist ripple opacity debug missing');
assert(main.includes('rippleOpacity:Number((shopRipple.material.opacity||0).toFixed(3))'), 'shop ripple opacity debug missing');
assert(main.includes('rippleOpacity:Number((reloadRipple.material.opacity||0).toFixed(3))'), 'reload ripple opacity debug missing');

console.log(JSON.stringify({
  ok: true,
  version: HOLOGRAM_ATMOSPHERE_VERSION,
  fields: ['wristMotes', 'shopMotes', 'reloadMotes'],
  ripples: ['wristRipple', 'shopRipple', 'reloadRipple']
}, null, 2));
