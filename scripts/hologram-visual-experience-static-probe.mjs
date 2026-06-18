import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOLOGRAM_DEPTH_FX_VERSION,
  HOLOGRAM_VISUAL_EXPERIENCE_VERSION,
} from '../src/game/hologramVisuals.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const visuals = readFileSync(join(root, 'src/game/hologramVisuals.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(HOLOGRAM_VISUAL_EXPERIENCE_VERSION === 'hologram-visual-experience.v1', 'visual experience version missing');
assert(HOLOGRAM_DEPTH_FX_VERSION === 'hologram-depth-fx.v1', 'depth fx version missing');
assert(main.includes("from './game/hologramVisuals.js'"), 'hologram visuals import missing');
assert(visuals.includes('export function drawHoloProjectionLayer'), 'projection layer renderer missing');
assert(visuals.includes('export function createHoloDepthFrame') && visuals.includes('export function syncHoloDepthFrame'), 'depth frame helpers missing');
assert(main.includes('drawHoloProjectionLayer as _drawHoloProjectionLayer') && main.includes('createHoloDepthFrame as _createHoloDepthFrameCore'), 'main visual helper bridge missing');
for (const key of ['_wristLayerCanvas', '_shopLayerCanvas', '_reloadLayerCanvas']) {
  assert(main.includes(key), `${key} missing`);
}
for (const key of ['wristLayerM', 'shopLayerM', 'reloadLayerM']) {
  assert(main.includes(`${key}=new THREE.MeshBasicMaterial`) || main.includes(`const ${key}=new THREE.MeshBasicMaterial`), `${key} material missing`);
  assert(main.includes(`${key}.opacity=THREE.MathUtils.clamp`), `${key} runtime opacity missing`);
}
assert(main.includes('wristGrp.add(wristGlow,wristGhost,wristPanel,wristLayer,wristDepthFrame'), 'wrist depth frame not attached');
assert(main.includes('shopGrp.add(shopGlow,shopGhost,shopPanel,shopLayer,shopDepthFrame'), 'shop depth frame not attached');
assert(main.includes('reloadHoloGrp.add(reloadGlow,reloadGhost,reloadHolo,reloadLayer,reloadDepthFrame'), 'reload depth frame not attached');
assert(main.includes('_drawHoloProjectionLayer(_wristLayerCanvas,_wristLayerTex'), 'wrist projection redraw missing');
assert(main.includes('_drawHoloProjectionLayer(_shopLayerCanvas,_shopLayerTex'), 'shop projection redraw missing');
assert(main.includes('_drawHoloProjectionLayer(_reloadLayerCanvas,_reloadLayerTex'), 'reload projection redraw missing');
assert(main.includes('_syncHoloDepthFrame(wristDepthFrame,wristDeployed') && main.includes('_syncHoloDepthFrame(shopDepthFrame,shopDeployed') && main.includes('_syncHoloDepthFrame(reloadDepthFrame,reloadHoloDeployed'), 'depth frame runtime sync missing');
assert(main.includes('reloadLayerM.opacity=0'), 'reload authored fallback layer hide missing');
assert(main.includes('visualExperienceVersion:HOLOGRAM_VISUAL_EXPERIENCE_VERSION'), 'visual experience debug status missing');
assert(main.includes('depthFxVersion:HOLOGRAM_DEPTH_FX_VERSION'), 'depth fx debug status missing');
assert(main.includes('layerOpacity:Number((wristLayerM.opacity||0).toFixed(3))'), 'wrist layer debug opacity missing');
assert(main.includes('layerOpacity:Number((shopLayerM.opacity||0).toFixed(3))'), 'shop layer debug opacity missing');
assert(main.includes('layerOpacity:Number((reloadLayerM.opacity||0).toFixed(3))'), 'reload layer debug opacity missing');
assert(main.includes('depthVisible:!!wristDepthFrame.visible') && main.includes('depthVisible:!!shopDepthFrame.visible') && main.includes('depthVisible:!!reloadDepthFrame.visible'), 'depth visibility debug missing');
assert(main.includes('hologramVisualExperienceVersion=HOLOGRAM_VISUAL_EXPERIENCE_VERSION'), 'authored node visual version tag missing');

console.log(JSON.stringify({
  ok: true,
  version: HOLOGRAM_VISUAL_EXPERIENCE_VERSION,
  depthFx: HOLOGRAM_DEPTH_FX_VERSION,
  layers: ['wrist', 'shop', 'reload'],
  runtime: {
    redraws: 3,
    opacityDebug: true,
    authoredHide: true
  }
}, null, 2));
