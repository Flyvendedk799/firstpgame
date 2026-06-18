import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PLAYER_DAMAGE_RESPONSE_VERSION,
  buildPlayerDamageResponseSnapshot,
  recordPlayerDamageResponse,
  tickPlayerDamageResponse
} from '../src/game/playerDamageResponse.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(PLAYER_DAMAGE_RESPONSE_VERSION === 'player-damage-response.v2', 'unexpected player damage response version');
assert(main.includes("from './game/playerDamageResponse.js'"), 'damage response import missing');
assert(main.includes('recordPlayerDamageResponse(pl'), 'takeDamage response hook missing');
assert(main.includes('tickPlayerDamageResponse(P'), 'damage response tick missing');
assert(main.includes('_damageWeaponDrop*.055'), 'viewmodel damage weapon drop missing');
assert(main.includes('_damageTunnelPulse||0)*.70+(P._damageVisionPulse||0)*.34'), 'damage tunnel/vision FOV missing');
assert(main.includes('_damagePainPulse') && main.includes('_damageBreathKnockPulse') && main.includes('_damageWeaponCatchPulse') && main.includes('_damageStepSavePulse'), 'damage v2 pulses missing');
assert(main.includes('_damageVmFade') && main.includes('weaponCatch:P._damageWeaponCatchPulse'), 'damage v2 viewmodel/debug wiring missing');
assert(main.includes('PLAYER_DAMAGE_RESPONSE_VERSION'), 'damage response debug version missing');

const light = buildPlayerDamageResponseSnapshot({ hp: 82, maxHp: 100 }, {
  amount: 12,
  hpBefore: 94,
  hpAfter: 82,
  maxHp: 100,
  criticalRatio: 0.28,
  side: -1
});
assert(light.label === 'hit' && light.weaponDrop < 0.4 && light.side === -1, 'light damage response invalid');

const critical = buildPlayerDamageResponseSnapshot({ hp: 24, maxHp: 100 }, {
  amount: 34,
  hpBefore: 58,
  hpAfter: 24,
  maxHp: 100,
  criticalRatio: 0.28,
  side: 1
});
assert(critical.crossedCritical && critical.label === 'critical-break' && critical.weaponDrop > light.weaponDrop, 'critical damage response invalid');
assert(critical.tunnel > light.tunnel && critical.recoveryWindowMs > light.recoveryWindowMs, 'critical recovery shaping invalid');
assert(critical.painSpike > light.painSpike && critical.breathKnock > light.breathKnock && critical.weaponCatch > 0.4, 'critical damage v2 cue shaping invalid');
assert(critical.visionPulse > light.visionPulse && critical.breathHoldMs > light.breathHoldMs, 'critical damage v2 vision/breath shaping invalid');

const player = { hp: 24, maxHp: 100 };
const recorded = recordPlayerDamageResponse(player, {
  amount: 34,
  hpBefore: 58,
  hpAfter: 24,
  maxHp: 100,
  criticalRatio: 0.28,
  side: 1
});
assert(player._damageShock >= recorded.shock && player._damageWeaponDropPulse > 0.5 && player._criticalHitPulse === 1, 'recorded damage pulses invalid');
assert(player._damagePainPulse > 0.5 && player._damageBreathKnockPulse > 0.4 && player._damageWeaponCatchPulse > 0.4 && player._damageVisionPulse > 0.4, 'recorded damage v2 pulses invalid');
const ticked = tickPlayerDamageResponse(player, 1 / 60);
assert(ticked.weaponDrop < recorded.weaponDrop && ticked.tunnel < recorded.tunnel && ticked.finite, 'damage pulses did not decay');
assert(ticked.painSpike < recorded.painSpike && ticked.breathKnock < recorded.breathKnock && ticked.weaponCatch < recorded.weaponCatch, 'damage v2 pulses did not decay');

console.log(JSON.stringify({
  ok: true,
  version: PLAYER_DAMAGE_RESPONSE_VERSION,
  light: {
    shock: Number(light.shock.toFixed(3)),
    weaponDrop: Number(light.weaponDrop.toFixed(3))
  },
  critical: {
    shock: Number(critical.shock.toFixed(3)),
    weaponDrop: Number(critical.weaponDrop.toFixed(3)),
    tunnel: Number(critical.tunnel.toFixed(3)),
    painSpike: Number(critical.painSpike.toFixed(3)),
    breathKnock: Number(critical.breathKnock.toFixed(3)),
    weaponCatch: Number(critical.weaponCatch.toFixed(3)),
    recoveryWindowMs: critical.recoveryWindowMs
  }
}, null, 2));
