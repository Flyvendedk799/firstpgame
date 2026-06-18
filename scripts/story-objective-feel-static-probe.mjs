import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STORY_OBJECTIVE_FEEL_VERSION,
  buildStoryObjectiveFeelSnapshot
} from '../src/game/storyObjectiveFeel.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const director = readFileSync(join(root, 'src/encounterDirector.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(STORY_OBJECTIVE_FEEL_VERSION === 'story-objective-feel.v2', 'unexpected story objective feel version');
assert(main.includes("from './game/storyObjectiveFeel.js'"), 'main objective feel import missing');
assert(main.includes('function _activeStoryObjectiveRuntime'), 'active objective runtime bridge missing');
assert(main.includes('function _updateEncounterObjectiveFeel'), 'encounter objective feel update missing');
assert(main.includes('G._storyObjectiveFeel'), 'global story objective feel state missing');
assert(main.includes('P._objectiveHoldPulse'), 'player objective hold pulse missing');
assert(main.includes('function _updateStoryObjectiveActionRig') && main.includes("version:'story-objective-action-rig.v2'"), 'story objective action rig missing');
assert(main.includes('_objectiveBracePulse') && main.includes('_objectiveReachPulse') && main.includes('_objectiveProgressBeat'), 'story objective action pulses missing');
assert(main.includes('_objectiveStabilizePulse') && main.includes('_objectivePromptPulse') && main.includes('_objectivePayoffAnticipationPulse') && main.includes('_objectiveFailPressurePulse'), 'story objective v2 action pulses missing');
assert(main.includes("_updateStoryObjectiveActionRig(o.feel,dt,{source:'building-objective'}") && main.includes("_updateStoryObjectiveActionRig(feel,dt,{source:'encounter-objective'}"), 'story objective action rig not wired to objective updates');
assert(main.includes('function applyStoryObjectiveLivePressure') && main.includes("version:'story-objective-live-pressure.v1'"), 'story objective live pressure helper missing');
assert(main.includes("_storyObjectiveTensionPulse") && main.includes("storyObjectiveLivePressure"), 'story objective enemy tension/debug missing');
assert(main.includes('objective-ticker-fill'), 'objective progress bar missing');
assert(main.includes('dataset.feelVersion=STORY_OBJECTIVE_FEEL_VERSION'), 'objective HUD feel version marker missing');
assert(main.includes('_findClearEnemySpawn(want,walls,.46,peers,opts)'), 'stealth objective reinforcement safe spawn missing');
assert(main.includes('function applyStoryAlarmRaisedCinematic') && main.includes("version:'story-alarm-cinematic.v1'"), 'story alarm cinematic helper missing');
assert(main.includes("applyStoryAlarmRaisedCinematic(e,{source:'stealth-objective'") && main.includes('_storyAlarmWakePulse'), 'story alarm cinematic not wired to stealth alarm/reinforcements');
assert(main.includes('_storyAlarmPulse') && main.includes('storyAlarmCinematic'), 'story alarm player presentation/debug missing');
assert(main.includes('function applyStoryObjectivePayoff') && main.includes("version:'story-objective-payoff.v1'"), 'story objective payoff helper missing');
assert(main.includes("applyStoryObjectivePayoff('station-step'") && main.includes("applyStoryObjectivePayoff('complete'") && main.includes("applyStoryObjectivePayoff('alarm-disabled'"), 'story objective payoff not wired to station/completion/relay events');
assert(main.includes('_storyObjectivePayoffEnemyPulse') && main.includes('storyObjectivePayoff'), 'story objective payoff enemy animation/debug missing');
assert(main.includes('_storyObjectivePayoffPulse') && main.includes('_storyObjectivePayoffSide'), 'story objective payoff player presentation missing');
assert(main.includes('playerZone()===2'), 'timer objective reach completion missing');
assert(main.includes('storyObjective:{version:STORY_OBJECTIVE_FEEL_VERSION') && main.includes('rig:P._storyObjectiveActionRig||null'), 'debug story objective feel missing action rig');
assert(director.includes('feel: null'), 'encounter director objective feel slot missing');

const station = buildStoryObjectiveFeelSnapshot({
  kind: 'stations',
  def: { kind: 'stations', total: 3, radius: 2 },
  total: 3,
  visited: 1,
  _stationHoldProgress: 0.5,
  completed: false,
  failed: false
}, { near: true, holding: true, closeEnemyCount: 2, enemiesAlive: 4 });

const timer = buildStoryObjectiveFeelSnapshot({
  kind: 'timer',
  def: { kind: 'timer', timerS: 90 },
  remainingS: 8,
  completed: false,
  failed: false
}, { enemiesAlive: 1 });

const stealth = buildStoryObjectiveFeelSnapshot({
  kind: 'stealth',
  def: { kind: 'stealth' },
  alarmed: true,
  completed: false,
  failed: false
}, { roomsCleared: 1, roomsTotal: 3, enemiesAlive: 5 });

assert(station.progress > 0.45 && station.holding && station.contested > 0.3, 'station hold feel should expose progress and contest');
assert(station.holdStrain > 0.45 && station.interactionLead > 0.45 && station.objectiveCadence > 0.30, 'station objective v2 feel should expose hold/rhythm channels');
assert(timer.urgency > 0.45 && timer.timerProgress > 0.85 && timer.timerCritical > 0.55, 'timer objective should become urgent near timeout');
assert(timer.failPressure > 0.30 && timer.cameraTension > 0.20, 'timer objective v2 tension fields missing');
assert(stealth.alarmed && stealth.enemyPressureMul > 1.05, 'stealth alarm should increase pressure');
assert(stealth.stealthTension > 0.65 && stealth.enemyTelegraphMul > 1.0, 'stealth objective v2 tension fields missing');
assert(station.finite && timer.finite && stealth.finite, 'objective feel snapshots should be finite');

console.log(JSON.stringify({
  ok: true,
  version: STORY_OBJECTIVE_FEEL_VERSION,
  station: { progress: Number(station.progress.toFixed(3)), contest: Number(station.contested.toFixed(3)), cadence: Number(station.objectiveCadence.toFixed(3)) },
  timer: { urgency: Number(timer.urgency.toFixed(3)), progress: Number(timer.timerProgress.toFixed(3)), critical: Number(timer.timerCritical.toFixed(3)) },
  stealth: { pressure: Number(stealth.enemyPressureMul.toFixed(3)), tension: Number(stealth.stealthTension.toFixed(3)), label: stealth.label }
}, null, 2));
