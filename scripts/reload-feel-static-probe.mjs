import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RELOAD_FEEL_VERSION,
  buildReloadFeelSnapshot,
  recordReloadCompleteFeel,
  recordReloadInterruptFeel,
  recordReloadStartFeel,
  tickReloadFeel
} from '../src/game/reloadFeel.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const feedback = readFileSync(join(root, 'src/game/combatFeedback.js'), 'utf8');
const reloadFeelSource = readFileSync(join(root, 'src/game/reloadFeel.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(RELOAD_FEEL_VERSION === 'reload-feel.v3', 'unexpected reload feel version');
assert(main.includes("from './game/reloadFeel.js'"), 'main reload feel import missing');
assert(main.includes('recordReloadStartFeel(P'), 'P1 reload start hook missing');
assert(main.includes('recordReloadStartFeel(P2'), 'P2 reload start hook missing');
assert(main.includes('tickReloadFeel(P,dt,damp)'), 'P1 reload feel frame tick missing');
assert(main.includes('tickReloadFeel(P2,dt,damp)'), 'P2 reload feel frame tick missing');
assert(main.includes('recordReloadCompleteFeel(P'), 'P1 reload complete hook missing');
assert(main.includes('recordReloadCompleteFeel(P2'), 'P2 reload complete hook missing');
assert(main.includes('recordReloadInterruptFeel(P'), 'P1 reload interruption hook missing');
assert(main.includes('recordReloadInterruptFeel(P2'), 'P2 reload interruption hook missing');
assert(main.includes('_reloadFeelSnapshot') && main.includes('reloadFeel:{version:RELOAD_FEEL_VERSION'), 'reload feel debug state missing');
assert(main.includes('_reloadFeel.weaponX') && main.includes('_reloadFeel.cameraPitch'), 'reload feel viewmodel/camera offsets missing');
assert(main.includes('rf.fingerRelease') && main.includes('rf.supportHandX'), 'reload feel hand/finger wiring missing');
assert(main.includes('function _storyEmergencyReloadAssist') && main.includes("version:'story-emergency-reload.v1'"), 'story emergency reload assist missing');
assert(main.includes('storyReloadAssist.timeMul') && main.includes('_storyReloadAssistPulse'), 'story reload assist timing/pulse missing');
assert(main.includes('storyAssist:{version:\'story-emergency-reload.v1\'') && main.includes('_lastStoryReloadAssist'), 'story reload assist debug state missing');
assert(main.includes('_storyReloadAssistPulse*.075') && main.includes('_storyReloadAssistPulse*.0040'), 'story reload assist camera/viewmodel animation missing');
assert(main.includes('_reloadEmergencyShieldPulse') && main.includes('_reloadHandLockPulse'), 'reload v2 shield/hand-lock runtime pulses missing');
assert(main.includes('shield:P._reloadEmergencyShieldPulse') && main.includes('handLock:P._reloadHandLockPulse'), 'reload v2 debug pulse state missing');
assert(main.includes('surfaceInterference') && main.includes('insertConfidence') && main.includes('chamberSettle'), 'reload v3 presentation fields missing');
const combatDecayBlock = feedback.match(/const DECAY = Object\.freeze\(\{[\s\S]*?\n\}\);/)?.[0] || '';
for (const key of ['_reloadCommitPulse', '_reloadInsertPulse', '_reloadRackPulse', '_reloadPhasePulse', '_reloadFumblePulse', '_reloadEmergencyShieldPulse', '_reloadHandLockPulse']) {
  assert(reloadFeelSource.includes(`['${key}',`), `reload feel decay missing ${key}`);
  assert(!combatDecayBlock.includes(key), `combat feedback should not also decay ${key}`);
}

const calm = {
  weaponIdx: 0,
  reloading: true,
  reloadTimer: 0.65,
  RELOAD_TIME: 2,
  _tacticalReload: true,
  _combatFlow: 0.45
};
const pressured = {
  weaponIdx: 0,
  reloading: true,
  reloadTimer: 0.65,
  RELOAD_TIME: 2,
  _suppressionLevel: 0.92,
  _damageShock: 0.58,
  _damageWeaponDropPulse: 0.72,
  _reloadBlockedPulse: 0.35
};
const calmSnap = buildReloadFeelSnapshot(calm);
const pressuredSnap = buildReloadFeelSnapshot(pressured);
const covered = {
  weaponIdx: 0,
  reloading: true,
  reloadTimer: 0.65,
  RELOAD_TIME: 2,
  _suppressionLevel: 0.92,
  _damageShock: 0.58,
  _storyRecoveryAssist: 0.78,
  _storyReloadAssistPulse: 0.72,
  _storyBeatClutchPulse: 0.70,
  _combatFlow: 0.35
};
const coveredSnap = buildReloadFeelSnapshot(covered);
const objectiveCovered = {
  weaponIdx: 0,
  reloading: true,
  reloadTimer: 0.65,
  RELOAD_TIME: 2,
  _objectiveStabilizePulse: 0.80,
  _objectivePayoffAnticipationPulse: 0.70,
  _damageWeaponCatchPulse: 0.58,
  _traversalRecenterPulse: 0.50
};
const startled = {
  weaponIdx: 0,
  reloading: true,
  reloadTimer: 0.65,
  RELOAD_TIME: 2,
  _surfaceImpactHardnessPulse: 0.86,
  _surfaceImpactReadPulse: 0.66,
  _damageBreathKnockPulse: 0.42
};
const objectiveSnap = buildReloadFeelSnapshot(objectiveCovered);
const startledSnap = buildReloadFeelSnapshot(startled);
assert(calmSnap.active && calmSnap.tactical && calmSnap.phase !== 'idle', 'calm tactical reload snapshot invalid');
assert(pressuredSnap.pressure > calmSnap.pressure, 'pressured reload pressure not detected');
assert(pressuredSnap.fumble > calmSnap.fumble, 'pressured reload fumble not higher');
assert(pressuredSnap.handlingPenalty > calmSnap.handlingPenalty, 'pressured reload handling penalty not higher');
assert(coveredSnap.emergencyShield > 0.30, 'covered reload emergency shield too weak');
assert(coveredSnap.fumble < pressuredSnap.fumble, 'covered reload did not reduce fumble');
assert(coveredSnap.handlingPenalty < pressuredSnap.handlingPenalty, 'covered reload did not reduce handling penalty');
assert(coveredSnap.supportLock > 0.10 && coveredSnap.magGuide > 0.10, 'covered reload hand lock/guide missing');
assert(coveredSnap.label === 'covered-reload', 'covered reload label missing');
assert(objectiveSnap.objectiveAssist > 0.65 && objectiveSnap.insertConfidence > calmSnap.insertConfidence, 'objective reload assist did not improve insert confidence');
assert(objectiveSnap.handlingPenalty < pressuredSnap.handlingPenalty, 'objective-covered reload should reduce handling penalty');
assert(startledSnap.surfaceInterference > 0.8 && startledSnap.fumble > calmSnap.fumble, 'surface-interrupted reload should increase fumble');
assert(startledSnap.label === 'startled-reload', 'surface-interrupted reload label missing');
assert(Math.abs(pressuredSnap.weaponX) + Math.abs(pressuredSnap.weaponY) + Math.abs(pressuredSnap.weaponRZ) > 0.02, 'reload weapon offsets too weak');

const phases = [0.04, 0.18, 0.42, 0.79, 0.88, 0.98].map((progress) => buildReloadFeelSnapshot({ weaponIdx: 0, reloading: true, RELOAD_TIME: 1, reloadTimer: 1 - progress }, { progress }));
assert(phases.some((p) => p.phase === 'release'), 'release phase missing');
assert(phases.some((p) => p.phase === 'retrieve'), 'retrieve phase missing');
assert(phases.some((p) => p.phase === 'insert'), 'insert phase missing');
assert(phases.some((p) => p.phase === 'chamber' || p.phase === 'settle'), 'chamber/settle phase missing');

const player = { weaponIdx: 0, reloading: true, reloadTimer: 1.4, RELOAD_TIME: 2, _tacticalReload: false };
recordReloadStartFeel(player, { nowMs: 1000 });
assert(player._reloadCommitPulse > 0 && player._reloadFeelSnapshot?.version === RELOAD_FEEL_VERSION, 'record start did not pulse/store snapshot');
tickReloadFeel(player, 1 / 60, null, { progress: 0.82, active: true });
assert(player._reloadRackPulse > 0 || player._reloadInsertPulse > 0, 'reload phase transition did not pulse');
const coveredPlayer = { ...covered, reloadTimer: 0.56 };
tickReloadFeel(coveredPlayer, 1 / 60, null, { progress: 0.72, active: true });
assert(coveredPlayer._reloadEmergencyShieldPulse > 0 && coveredPlayer._reloadHandLockPulse > 0, 'reload v2 covered pulses did not fire');
recordReloadInterruptFeel(player, { progress: 0.44, reason: 'probe' });
assert(player._reloadFumblePulse > 0.5 && player._reloadFeelSnapshot.phase === 'interrupted', 'reload interruption did not fumble');
recordReloadCompleteFeel(player, { flow: 0.5 });
assert(player._reloadReadyPulse > 0.7 && player._reloadFeelSnapshot.readyWindow === 1, 'reload completion did not ready');

console.log(JSON.stringify({
  ok: true,
  version: RELOAD_FEEL_VERSION,
  calm: { phase: calmSnap.phase, pressure: Number(calmSnap.pressure.toFixed(3)), penalty: Number(calmSnap.handlingPenalty.toFixed(3)) },
  pressured: { phase: pressuredSnap.phase, pressure: Number(pressuredSnap.pressure.toFixed(3)), fumble: Number(pressuredSnap.fumble.toFixed(3)), penalty: Number(pressuredSnap.handlingPenalty.toFixed(3)) },
  covered: { phase: coveredSnap.phase, shield: Number(coveredSnap.emergencyShield.toFixed(3)), fumble: Number(coveredSnap.fumble.toFixed(3)), handLock: Number(coveredSnap.supportLock.toFixed(3)) },
  objective: { assist: Number(objectiveSnap.objectiveAssist.toFixed(3)), insertConfidence: Number(objectiveSnap.insertConfidence.toFixed(3)) },
  startled: { surface: Number(startledSnap.surfaceInterference.toFixed(3)), fumble: Number(startledSnap.fumble.toFixed(3)) }
}, null, 2));
