import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hologramVisualVersionBundle } from '../src/game/hologramVisuals.js';

const root = process.cwd();
const mainPath = join(root, 'src/main.js');
const visualsPath = join(root, 'src/game/hologramVisuals.js');
const main = readFileSync(mainPath, 'utf8');
const visuals = readFileSync(visualsPath, 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const versions = hologramVisualVersionBundle();
assert(existsSync(visualsPath), 'hologram visuals module missing');
assert(versions.polish === 'hologram-polish.v1', 'polish version not exported from visuals');
assert(versions.visualExperience === 'hologram-visual-experience.v1', 'visual experience version not exported from visuals');
assert(versions.depthFx === 'hologram-depth-fx.v1', 'depth fx version not exported from visuals');
assert(versions.atmosphere === 'hologram-atmosphere.v1', 'atmosphere version not exported from visuals');
assert(versions.parallaxGhost === 'hologram-parallax-ghost.v1', 'parallax ghost version not exported from visuals');

assert(main.includes("from './game/hologramVisuals.js'"), 'main does not import categorized hologram visuals');
assert(!main.includes('function _drawHoloBackplate'), 'canvas backplate helper still lives in main');
assert(!main.includes('function _drawHoloMetricBar'), 'canvas metric helper still lives in main');
assert(!main.includes('function _drawHoloSparkline'), 'canvas sparkline helper still lives in main');
assert(!main.includes('function _drawHoloGlitchBands'), 'glitch helper still lives in main');
assert(!main.includes('function _drawHoloSignalFooter'), 'unused signal footer helper still lives in main');
assert(!main.includes("HOLOGRAM_POLISH_VERSION='"), 'visual version constant still redeclared in main');
assert(!main.includes('pts.userData.hologramAtmosphereVersion=HOLOGRAM_ATMOSPHERE_VERSION'), 'mote implementation still lives in main');

for (const name of [
  'configureHologramTexture',
  'holoCanvasPhase',
  'holoText',
  'drawHoloBackplate',
  'drawHoloMetricBar',
  'drawHoloSparkline',
  'drawHoloGlitchBands',
  'drawHoloStatusPill',
  'drawHoloProjectionLayer',
  'createHoloDepthFrame',
  'syncHoloDepthFrame',
  'createHoloMoteField',
  'syncHoloMoteField',
  'createHoloRippleRing',
  'syncHoloRippleRing',
  'syncHoloGhostPlane'
]) {
  assert(visuals.includes(`export function ${name}`), `${name} export missing from visuals`);
}

assert(main.includes('return _configureHologramTextureCore(THREE,tex);'), 'texture adapter missing THREE dependency handoff');
assert(main.includes('return _createHoloMoteFieldCore(THREE,_softRadialTex,w,h,count,color,order);'), 'mote adapter missing soft radial texture handoff');
assert(main.includes('return _syncHoloGhostPlaneCore(THREE,mesh,mat,vis,now,signal,tone);'), 'ghost sync adapter missing THREE dependency handoff');

console.log(JSON.stringify({
  ok: true,
  module: 'src/game/hologramVisuals.js',
  removedDeadCode: ['_drawHoloSignalFooter'],
  adapterCount: 8,
  versions
}, null, 2));
