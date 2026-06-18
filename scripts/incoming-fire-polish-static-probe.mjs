import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  INCOMING_FIRE_POLISH_VERSION,
  applyIncomingFireHitChance,
  buildEnemyShotReadabilitySnapshot,
  buildIncomingFirePolishSnapshot,
  buildIncomingFireThreatResponse,
  recordEnemyShotReadabilityPolish,
  recordIncomingEnemyShot,
  tickEnemyShotReadabilityPolish,
  tickIncomingFirePolish
} from '../src/game/incomingFirePolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(INCOMING_FIRE_POLISH_VERSION === 'incoming-fire-polish.v3', 'unexpected incoming fire version');
assert(main.includes("from './game/incomingFirePolish.js'"), 'incoming fire import missing');
assert(main.includes('applyIncomingFireHitChance(hitPRaw'), 'incoming hit chance shaping missing');
assert(main.includes('recordIncomingEnemyShot(targetPl'), 'incoming shot record hook missing');
assert(main.includes('recordEnemyShotReadabilityPolish(s.src'), 'enemy shot readability hook missing');
assert(main.includes('tickIncomingFirePolish(P'), 'incoming fire tick missing');
assert(main.includes('tickEnemyShotReadabilityPolish(this'), 'enemy shot readability tick missing');
assert(main.includes('_incomingScopeKick'), 'incoming scope kick missing');
assert(main.includes('_incomingLane*.130'), 'incoming viewmodel lane roll missing');
assert(main.includes('_incomingFireTunnelPulse'), 'incoming threat FOV missing');
assert(main.includes('_incomingRecenter*.0014'), 'incoming scope recenter missing');
assert(main.includes('_incomingAdsBrace') && main.includes('_incomingLaneRead') && main.includes('_incomingBreathCatch'), 'incoming v3 ADS/lane/breath runtime missing');
assert(main.includes('--incoming-ads-brace') && main.includes('incoming-ads-brace'), 'incoming v3 HUD variables/classes missing');
assert(main.includes('incoming-fire-threat'), 'incoming HUD threat class missing');
assert(main.includes('setIncomingFirePolishProbe'), 'incoming debug probe missing');

const player = {};
const close = recordIncomingEnemyShot(player, {
  hit: false,
  closeMiss: true,
  missSeverity: 0.12,
  hitChance: 0.72,
  distance: 8,
  side: -1,
  sourceType: 'sniper',
  nowMs: 1000
});
assert(close.pressure > 0.4 && close.crack > 0.5 && close.lane > 0.4, 'close miss did not create pressure/crack/lane');
assert(close.threat > 0.45 && close.nearMissSeverity > 0.5 && close.recenterNeed > 0.35, 'incoming threat response missing');
assert(close.adsBrace > 0.25 && close.laneRead > 0.40 && close.breathCatch > 0.40 && close.threatClock > 0.35, 'incoming v3 threat readability missing');
assert(close.suppressionAdd > 0.08 && player._suppressionLevel >= close.suppressionAdd, 'incoming suppression response missing');
assert(player._nearMissPulse > 0.45 && player._enemyShotPressure > 0.55, 'incoming player pulses missing');
assert(close.side === -1 && close.kind === 'closeMiss', 'incoming shot side/kind missing');
const shaped = applyIncomingFireHitChance(0.82, player, { distance: 8, sourceType: 'sniper' });
assert(shaped < 0.82 && shaped > 0.025, 'incoming mercy did not shape hit chance');
tickIncomingFirePolish(player, 1 / 60);
const decayed = buildIncomingFirePolishSnapshot(player);
assert(decayed.pressure < close.pressure && decayed.threat <= close.threat && decayed.finite, 'incoming fire did not decay');

const threat = buildIncomingFireThreatResponse({
  hit: false,
  closeMiss: true,
  missSeverity: 0.08,
  hitChance: 0.78,
  distance: 6,
  pressure: 0.82,
  crack: 0.92,
  lane: 0.78,
  scope: 0.66,
  impact: 0,
  sourceThreat: 1.1
});
assert(threat.label.includes('near-miss') && threat.suppressionAdd > 0.12 && threat.weaponFlinch > 0.4, 'threat response shaping invalid');
assert(threat.adsBrace > 0.25 && threat.laneRead > 0.45 && threat.breathCatch > 0.45, 'threat v3 shaping invalid');

const enemy = { group: { userData: {} } };
const shot = recordEnemyShotReadabilityPolish(enemy, {
  hit: true,
  closeMiss: false,
  hitChance: 0.78,
  aimReady: 0.86,
  distance: 12,
  nowMs: 1000
});
assert(shot.confidence > 0.5 && shot.discipline > 0.5 && shot.muzzleScale > 1, 'enemy shot readability invalid');
assert(shot.preFireTell > 0.5 && shot.muzzleIntent > 0.5 && shot.triggerCommit > 0.5 && shot.readableWindowMs > 250, 'enemy shot readability v3 invalid');
tickEnemyShotReadabilityPolish(enemy, 1 / 60);
const enemySnap = buildEnemyShotReadabilitySnapshot(enemy);
assert(enemySnap.pulse < shot.pulse && enemySnap.finite, 'enemy shot readability did not decay');

console.log(JSON.stringify({
  ok: true,
  version: INCOMING_FIRE_POLISH_VERSION,
  incoming: {
    pressure: Number(close.pressure.toFixed(3)),
    crack: Number(close.crack.toFixed(3)),
    lane: Number(close.lane.toFixed(3)),
    threat: Number(close.threat.toFixed(3)),
    adsBrace: Number(close.adsBrace.toFixed(3)),
    laneRead: Number(close.laneRead.toFixed(3)),
    breathCatch: Number(close.breathCatch.toFixed(3)),
    suppressionAdd: Number(close.suppressionAdd.toFixed(3)),
    shaped: Number(shaped.toFixed(3))
  },
  enemy: {
    confidence: Number(shot.confidence.toFixed(3)),
    discipline: Number(shot.discipline.toFixed(3)),
    preFireTell: Number(shot.preFireTell.toFixed(3)),
    muzzleIntent: Number(shot.muzzleIntent.toFixed(3))
  }
}, null, 2));
