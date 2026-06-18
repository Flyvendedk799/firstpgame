import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SURFACE_IMPACT_FEEL_VERSION,
  buildSurfaceImpactFeelSnapshot,
  resolveSurfaceImpactKey
} from '../src/game/surfaceImpactFeel.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(SURFACE_IMPACT_FEEL_VERSION === 'surface-impact-feel.v2', 'unexpected surface impact feel version');
assert(main.includes("from './game/surfaceImpactFeel.js'"), 'main import missing');
assert(main.includes('buildSurfaceImpactFeelSnapshot'), 'surface feel builder not wired');
assert(main.includes('function addImpact(pos,normal,opts={})'), 'addImpact does not accept feel opts');
assert(main.includes('function spawnSurfaceImpact(hitPt,normal,opts={})'), 'spawnSurfaceImpact does not accept feel opts');
assert(main.includes('function _maybeRicochet(hitPt,dir,normal,opts={})'), 'ricochet does not accept feel opts');
assert(main.includes('surfaceImpact:{version:SURFACE_IMPACT_FEEL_VERSION'), 'debug surface impact state missing');
assert(main.includes('_lastSurfaceImpactFeel'), 'last surface impact feel missing');
assert(main.includes('shotSurfaceHit'), 'surface hit miss feedback missing');
assert(main.includes('ricochetChance'), 'ricochet chance not driven by feel');
assert(main.includes('playerReadPulse') && main.includes('_surfaceImpactReadPulse') && main.includes('_surfaceImpactHardnessPulse'), 'surface impact v2 player feedback missing');
assert(main.includes('microShardCount') && main.includes('sparkStretchMul') && main.includes('audioPitch') && main.includes('coverDamageMul'), 'surface impact v2 runtime fields missing');

const metalObj = { name: 'steel_server_rack', userData: { aaMaterial: 'paintedMetal' }, material: { name: 'metal_panel' } };
const woodObj = { name: 'teak_door', userData: { surface: 'wood' }, material: { name: 'wood' } };
assert(resolveSurfaceImpactKey({ object: metalObj, building: 1 }) === 'metal', 'metal object not classified');
assert(resolveSurfaceImpactKey({ object: woodObj, building: 8 }) === 'wood', 'wood object not classified');

const metalGlance = buildSurfaceImpactFeelSnapshot({
  object: metalObj,
  building: 8,
  weaponIdx: 7,
  incidence: 0.10,
  distance: 18,
  shotQuality: 0.7
});
const woodSquare = buildSurfaceImpactFeelSnapshot({
  object: woodObj,
  building: 7,
  weaponIdx: 3,
  incidence: 0.92,
  distance: 4,
  shotQuality: 0.35
});
const suppressedConcrete = buildSurfaceImpactFeelSnapshot({
  building: 1,
  weaponIdx: 4,
  incidence: 0.55,
  suppressed: true,
  distance: 16
});

assert(metalGlance.key === 'metal' && metalGlance.glancing > 0.6, 'metal glance snapshot invalid');
assert(metalGlance.ricochetChance > woodSquare.ricochetChance, 'metal glance should ricochet more than wood square hit');
assert(woodSquare.dustMul > metalGlance.dustMul, 'wood/shotgun square hit should produce more dust than metal glance');
assert(suppressedConcrete.flashMul < buildSurfaceImpactFeelSnapshot({ building: 1, weaponIdx: 4, incidence: 0.55, suppressed: false }).flashMul, 'suppressed impact should reduce flash');
assert(metalGlance.hardSnap > 0.2 && metalGlance.sparkStretchMul > 1.0, 'metal glance should expose hard snap and stretched sparks');
assert(woodSquare.microShardCount >= metalGlance.microShardCount && woodSquare.knifeStickGrip > metalGlance.knifeStickGrip, 'wood square hit should expose readable shards/stick grip');
assert(suppressedConcrete.audioGain < buildSurfaceImpactFeelSnapshot({ building: 1, weaponIdx: 4, incidence: 0.55, suppressed: false }).audioGain, 'suppressed impact should reduce audio gain');
assert(metalGlance.finite && woodSquare.finite && suppressedConcrete.finite, 'snapshots must be finite');

console.log(JSON.stringify({
  ok: true,
  version: SURFACE_IMPACT_FEEL_VERSION,
  metalGlance: {
    key: metalGlance.key,
    sparks: Number(metalGlance.sparkMul.toFixed(3)),
    ricochet: Number(metalGlance.ricochetChance.toFixed(3)),
    hardSnap: Number(metalGlance.hardSnap.toFixed(3))
  },
  woodSquare: {
    key: woodSquare.key,
    dust: Number(woodSquare.dustMul.toFixed(3)),
    decal: Number(woodSquare.decalScale.toFixed(3)),
    shards: woodSquare.microShardCount
  },
  suppressedConcrete: {
    flash: Number(suppressedConcrete.flashMul.toFixed(3)),
    dust: Number(suppressedConcrete.dustMul.toFixed(3)),
    audio: Number(suppressedConcrete.audioGain.toFixed(3))
  }
}, null, 2));
