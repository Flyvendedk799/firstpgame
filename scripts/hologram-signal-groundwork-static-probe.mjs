import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOLOGRAM_SIGNAL_VERSION,
  createHologramSignalState,
  hologramSignalSnapshot,
  tickHologramSignals,
} from '../src/game/hologramSignals.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const visuals = readFileSync(join(root, 'src/game/hologramVisuals.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(HOLOGRAM_SIGNAL_VERSION === 'hologram-signal.v1', 'unexpected hologram signal version');
assert(main.includes("from './game/hologramSignals.js'"), 'main hologram signal import missing');
assert(main.includes('const _HOLOGRAM_SIGNAL_STATE=createHologramSignalState()'), 'main hologram signal state missing');
assert(main.includes('tickHologramSignals(_HOLOGRAM_SIGNAL_STATE,P'), 'main hologram signal tick missing');
assert(main.includes('hologramSignalSnapshot(_HOLOGRAM_SIGNAL_STATE)'), 'main hologram signal debug snapshot missing');
assert(visuals.includes('export function drawHoloGlitchBands') && visuals.includes('export function drawHoloStatusPill'), 'hologram signal render helpers missing');
assert(main.includes('drawHoloBackplate as _drawHoloBackplate') && main.includes('drawHoloStatusPill as _drawHoloStatusPill'), 'hologram signal render bridge missing');
assert(main.includes('signalVersion:HOLOGRAM_SIGNAL_VERSION'), 'hologram signal version debug missing');
assert(main.includes('sigNoise=THREE.MathUtils.clamp(sig.signalNoise') && main.includes('sigWarn=THREE.MathUtils.clamp'), 'authored wrist signal feed missing');

const state = createHologramSignalState();
const weapon = { mag: 30 };
const player = {
  hp: 100,
  ammo: 30,
  ammoRes: 90,
  money: 200,
  healPacks: 1,
  grenades: 1,
  weaponIdx: 0,
  reloading: false
};

tickHologramSignals(state, player, { dt: 1 / 60, weapon, reloadPhase: 'idle', nowMs: 1000 });
player.hp = 68;
tickHologramSignals(state, player, { dt: 1 / 60, weapon, reloadPhase: 'idle', nowMs: 1040 });
assert(state.damagePulse > 0.7 && state.warningPulse > 0.3, 'damage signal did not pulse');

player.ammo = 2;
tickHologramSignals(state, player, { dt: 1 / 60, weapon, reloadPhase: 'idle', nowMs: 1080 });
assert(state.lowAmmo && state.criticalAmmo && state.criticalAmmoPulse > 0.7, 'critical ammo signal did not resolve');

player.reloading = true;
tickHologramSignals(state, player, { dt: 1 / 60, weapon, reloadPhase: 'release', nowMs: 1120 });
tickHologramSignals(state, player, { dt: 1 / 60, weapon, reloadPhase: 'insert', nowMs: 1160 });
assert(state.reloadPulse > 0.6 && state.reloadPhasePulse > 0.6, 'reload phase signal did not pulse');

player.money = 125;
player.grenades = 2;
tickHologramSignals(state, player, { dt: 1 / 60, weapon, reloadPhase: 'insert', nowMs: 1200 });
assert(state.purchasePulse > 0.4 && state.resourcePulse > 0.4, 'economy/resource signals did not pulse');

player.weaponIdx = 4;
tickHologramSignals(state, player, { dt: 1 / 60, weapon: { mag: 32 }, reloadPhase: 'idle', nowMs: 1240 });
assert(state.weaponSwapPulse > 0.7, 'weapon swap signal did not pulse');

const snap = hologramSignalSnapshot(state);
assert(snap.version === HOLOGRAM_SIGNAL_VERSION && snap.noise > 0 && snap.integrity < 1, 'signal snapshot invalid');

console.log(JSON.stringify({
  ok: true,
  version: HOLOGRAM_SIGNAL_VERSION,
  snapshot: snap
}, null, 2));
