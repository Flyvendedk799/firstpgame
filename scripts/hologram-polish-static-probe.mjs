import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOLOGRAM_POLISH_VERSION } from '../src/game/hologramVisuals.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const visuals = readFileSync(join(root, 'src/game/hologramVisuals.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(HOLOGRAM_POLISH_VERSION === 'hologram-polish.v1', 'hologram polish version missing');
assert(main.includes("from './game/hologramVisuals.js'"), 'hologram visuals import missing');
assert(/import\s*\{[^}]*reloadPhaseLabel[^}]*\}\s*from '\.\/reloadTimelines\.js'/.test(main), 'reload phase label import missing');
assert(main.includes('_configureHologramTexture(_armTex)'), 'arm hologram texture configuration missing');
assert(main.includes('_configureHologramTexture(_reloadTex)'), 'reload hologram texture configuration missing');
assert(main.includes('_configureHologramTexture(_wristTex)'), 'wrist hologram texture configuration missing');
assert(main.includes('_configureHologramTexture(_shopTex)'), 'shop hologram texture configuration missing');
assert(visuals.includes('export function drawHoloBackplate') && visuals.includes('export function drawHoloMetricBar') && visuals.includes('export function drawHoloSparkline'), 'shared hologram canvas helpers missing');
assert(main.includes('drawHoloBackplate as _drawHoloBackplate') && main.includes('drawHoloMetricBar as _drawHoloMetricBar') && main.includes('drawHoloSparkline as _drawHoloSparkline'), 'main hologram helper bridge missing');
assert(main.includes('function _drawReloadHolo(curr,mag,progress,rawProgress=progress)'), 'reload hologram raw phase signature missing');
assert(main.includes('reloadPhaseLabel(rt,P.weaponIdx).toUpperCase()'), 'reload hologram phase label missing');
assert(main.includes('_drawReloadHolo(_liveAmmo,_Wr.mag,_holoProg,_prog)'), 'reload tick does not pass raw progress');
assert(main.includes('now>_wristHoloRedrawAt') && main.includes('wristScanY=(wristScanY+18)%_wristCanvas.height'), 'wrist animated canvas redraw missing');
assert(main.includes('now>_shopHoloRedrawAt') && main.includes('_drawShopCanvas()'), 'shop animated canvas redraw missing');
assert(main.includes('now>_armHoloRedrawAt') && main.includes('_drawArmBandCanvas()'), 'arm-band timed redraw missing');
assert(main.includes('const _wristFlicker=') && main.includes('const _reloadFlicker='), 'hologram material flicker missing');
assert(main.includes('P._hologramPolishStatus={') && main.includes('hologramPolish:P._hologramPolishStatus'), 'hologram debug status missing');
assert(main.includes('o.userData.hologramPolishVersion=HOLOGRAM_POLISH_VERSION'), 'authored wristband version tagging missing');
assert(main.includes('hologramPolishVersion:HOLOGRAM_POLISH_VERSION'), 'authored wristband debug version missing');
assert(main.includes('const _authoredHoloActive=_syncAuthoredWristbandRuntime(now*1000)'), 'authored wristband runtime status hook missing');

console.log(JSON.stringify({
  ok: true,
  version: HOLOGRAM_POLISH_VERSION,
  checks: {
    textures: 4,
    animatedRedraws: 3,
    authoredRuntime: true,
    reloadPhaseAware: true
  }
}, null, 2));
