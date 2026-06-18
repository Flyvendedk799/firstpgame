import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLEAN_GUNPLAY_FEEL_VERSION,
  GUNPLAY_POLISH_VERSION,
  buildCleanGunplayFeelSnapshot,
  buildGunplayPolishSnapshot,
  buildShotQualitySnapshot,
  buildSustainedFireDisciplineSnapshot,
  buildStoryGunplayAssistSnapshot,
  buildTargetTransitionAssistSnapshot,
  buildWeaponDisciplineSnapshot,
  recordGunplayOutcome,
  recordGunplayShot
} from '../src/game/gunplayPolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const gunplay = readFileSync(join(root, 'src/game/gunplayPolish.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(GUNPLAY_POLISH_VERSION === 'gunplay-polish.v6', 'unexpected gunplay polish version');
assert(CLEAN_GUNPLAY_FEEL_VERSION === 'clean-gunplay-feel.v1', 'unexpected clean gunplay feel version');
assert(gunplay.includes('buildWeaponDisciplineSnapshot'), 'weapon discipline snapshot missing');
assert(gunplay.includes('traversalPressure'), 'traversal pressure missing from gunplay module');
assert(gunplay.includes('_lastTraversalShotPressure'), 'last traversal shot pressure is not stored');
assert(gunplay.includes('triggerPrep'), 'trigger prep is missing from gunplay module');
assert(gunplay.includes('triggerCommit'), 'trigger commitment is missing from gunplay module');
assert(gunplay.includes('recenterConfidence'), 'recenter confidence is missing from gunplay module');
assert(gunplay.includes('targetTransferWindow'), 'target transfer window is missing from gunplay module');
assert(gunplay.includes('followThrough'), 'follow-through is missing from gunplay module');
assert(gunplay.includes('cadenceMistime'), 'cadence mistime is missing from gunplay module');
assert(gunplay.includes('story-gunplay-assist.v2'), 'story gunplay assist version missing');
assert(gunplay.includes('objectiveAssist') && gunplay.includes('surfaceInterference') && gunplay.includes('reloadConfidence'), 'gunplay objective/surface/reload fields missing');
assert(gunplay.includes('buildStoryGunplayAssistSnapshot'), 'story gunplay assist snapshot missing');
assert(gunplay.includes('_storyGunplayAssistPulse'), 'story gunplay assist pulse missing');
assert(gunplay.includes('_precisionChainPulse'), 'precision chain pulse missing');
assert(gunplay.includes('buildSustainedFireDisciplineSnapshot'), 'sustained fire discipline snapshot missing');
assert(gunplay.includes('_sustainedFirePulse'), 'sustained fire pulse missing');
assert(gunplay.includes('_burstDisciplinePulse'), 'burst discipline pulse missing');
assert(gunplay.includes('buildTargetTransitionAssistSnapshot'), 'target transition assist snapshot missing');
assert(gunplay.includes('buildCleanGunplayFeelSnapshot'), 'clean gunplay feel snapshot missing');
assert(gunplay.includes('_cleanGunplayFlowPulse'), 'clean gunplay flow pulse missing');
assert(gunplay.includes('_cleanGunplayNoisePulse'), 'clean gunplay noise pulse missing');
assert(gunplay.includes('_targetTransitionPulse'), 'target transition pulse missing');
assert(gunplay.includes('_hitConfirmSettlePulse'), 'hit confirm settle pulse missing');
assert(gunplay.includes('_targetSwitchRecenterPulse'), 'target switch recenter pulse missing');
assert(gunplay.includes('_attackBreakPulse') && gunplay.includes('enemy-attack-break-feedback.v1'), 'enemy attack-break feedback missing');
assert(main.includes('buildWeaponDisciplineSnapshot'), 'main does not import weapon discipline');
assert(main.includes('buildStoryGunplayAssistSnapshot'), 'main does not import story gunplay assist');
assert(main.includes('buildTargetTransitionAssistSnapshot'), 'main does not import target transition assist');
assert(main.includes('buildCleanGunplayFeelSnapshot'), 'main does not import clean gunplay feel');
assert(main.includes('weaponHandlingKickMul'), 'weapon discipline does not affect recoil kick');
assert(main.includes('preCleanGunplayFeel'), 'clean gunplay feel does not affect pre-shot runtime');
assert(main.includes('cleanKickMul') && main.includes('cleanCameraNoiseMul'), 'clean gunplay feel does not affect recoil/camera');
assert(main.includes('preShotDiscipline.spreadMul'), 'weapon discipline does not affect spread');
assert(main.includes('cleanSpreadMul'), 'clean gunplay feel does not affect spread');
assert(main.includes('sustainedFireDiscipline&&sustainedFireDiscipline.spreadMul'), 'sustained fire does not affect spread');
assert(main.includes('sustainedFireDiscipline&&sustainedFireDiscipline.recoilMul'), 'sustained fire does not affect recoil');
assert(main.includes('sustainedFireDiscipline&&sustainedFireDiscipline.heatAddMul'), 'sustained fire does not affect heat');
assert(main.includes('traversalAt:pl._traversalFeelSnapshotAt'), 'shot quality does not receive traversal event age');
assert(main.includes('P._traversalFeelSnapshotAt=performance.now()'), 'traversal events are not timestamped');
assert(main.includes('weaponDisciplineReturn.recoilReturnMul'), 'recoil return does not use weapon discipline');
assert(main.includes('gunplayReturn.followThroughHold'), 'recoil recovery does not use follow-through');
assert(main.includes('gunplayReturn.triggerCommitPulse') && main.includes('gunplayReturn.recenterConfidencePulse'), 'recoil recovery does not use trigger commitment/recenter confidence');
assert(main.includes('gunplayReturn.storyGunplayAssistPulse'), 'recoil recovery does not use story gunplay assist');
assert(main.includes('gunplayReturn.targetTransition'), 'recoil recovery does not use target transition assist');
assert(main.includes('targetReturn.transferWindow') && main.includes('targetReturn.snapFollowThrough'), 'recoil recovery does not use transfer-window follow-through');
assert(main.includes('_triggerBreakPulse'), 'runtime viewmodel/camera does not consume trigger break pulse');
assert(main.includes('--shot-trigger-commit') && main.includes('shot-trigger-commit'), 'HUD does not expose trigger commitment');
assert(main.includes('--shot-recenter-confidence') && main.includes('shot-recenter-confidence'), 'HUD does not expose recenter confidence');
assert(main.includes('_storyGunplayAssistPulse'), 'runtime viewmodel/camera does not consume story gunplay assist pulse');
assert(main.includes('_targetTransitionPulse'), 'runtime viewmodel/camera does not consume target transition pulse');
assert(main.includes('--attack-break-pulse') && main.includes('attack-break-confirm'), 'HUD does not expose attack-break pulse');
assert(main.includes('enemyResponse:shotOutcomeEnemyResponse'), 'shot outcome does not pass enemy response into gunplay');
assert(main.includes('weapon-part-gunplay.v1'), 'weapon part gunplay debug payload missing');
assert(main.includes('triggerPartBreak') && main.includes('triggerPartReturn'), 'weapon parts do not consume gunplay trigger pulses');
assert(main.includes('--shot-follow-through'), 'HUD does not expose follow-through CSS variable');
assert(main.includes('--story-gunplay-assist'), 'HUD does not expose story gunplay assist CSS variable');
assert(main.includes('--sustained-fire-pressure'), 'HUD does not expose sustained fire CSS variable');
assert(main.includes('--burst-discipline'), 'HUD does not expose burst discipline CSS variable');
assert(main.includes('--target-transition-assist'), 'HUD does not expose target transition CSS variable');
assert(main.includes('--clean-gunplay-flow') && main.includes('clean-gunplay-flow'), 'HUD does not expose clean gunplay flow');
assert(main.includes('--clean-gunplay-noise') && main.includes('clean-gunplay-noise'), 'HUD does not expose clean gunplay noise');
assert(main.includes('--hit-confirm-settle'), 'HUD does not expose hit confirm settle CSS variable');
assert(main.includes('--target-switch-recenter'), 'HUD does not expose target switch recenter CSS variable');
assert(main.includes('--target-transfer-window') && main.includes('--target-snap-follow-through'), 'HUD does not expose target transfer window CSS variables');

const now = 10000;
const aim = {
  readiness: 0.88,
  stability: 0.82,
  reticleConfidence: 0.82,
  lensFocus: 0.76,
  scopeShadow: 0.10,
  scopeEyeBoxPressure: 0.08
};
const basePlayer = {
  weaponIdx: 0,
  ads: 0.82,
  adsVis: 0.82,
  _suppressionLevel: 0,
  _damageShock: 0,
  _gunplayMissBloom: 0,
  _shotHeatPressure: 0
};
const stableShot = buildShotQualitySnapshot(basePlayer, {
  nowMs: now,
  weaponIdx: 0,
  ads: 0.82,
  aim,
  spread: 0.0022,
  baseSpread: 0.002,
  firstShot: true,
  settled: true,
  shotIndex: 0,
  cadenceScore: 0.35
});

const pressuredPlayer = {
  ...basePlayer,
  _traversalFeelSnapshot: {
    kind: 'slideContact',
    severity: 0.96,
    bodyJolt: 0.54,
    locomotionSurge: 0.72
  },
  _traversalFeelSnapshotAt: now - 90,
  _moveContactStall: 0.72,
  _slideBlockedPulse: 0.82,
  _bodyJolt: 0.42,
  _locomotionSurge: 0.30,
  _gunplayMissBloom: 0.22,
  _shotHeatPressure: 0.18
};
const discipline = buildWeaponDisciplineSnapshot(pressuredPlayer, {
  nowMs: now,
  traversal: pressuredPlayer._traversalFeelSnapshot,
  traversalAt: pressuredPlayer._traversalFeelSnapshotAt,
  cadenceScore: 0.08
});
const pressuredShot = buildShotQualitySnapshot(pressuredPlayer, {
  nowMs: now,
  weaponIdx: 0,
  ads: 0.82,
  aim,
  spread: 0.0022,
  baseSpread: 0.002,
  firstShot: true,
  settled: true,
  shotIndex: 2,
  cadenceScore: 0.08,
  traversal: pressuredPlayer._traversalFeelSnapshot,
  traversalAt: pressuredPlayer._traversalFeelSnapshotAt
});

assert(discipline.traversalPressure > 0.62, 'discipline did not detect traversal pressure');
assert(discipline.spreadMul > 1.08, 'discipline does not increase spread under traversal pressure');
assert(discipline.viewKickMul > 1.10, 'discipline does not increase view kick under traversal pressure');
assert(discipline.recoilReturnMul < 1, 'discipline does not slow recoil return under traversal pressure');
assert(pressuredShot.quality < stableShot.quality, 'traversal pressure did not lower shot quality');
assert(pressuredShot.recoilSettleBoost < stableShot.recoilSettleBoost, 'traversal pressure did not reduce recoil settle boost');
assert(stableShot.triggerPrep > pressuredShot.triggerPrep, 'trigger prep should be better on stable shot');
assert(stableShot.triggerCommit > pressuredShot.triggerCommit, 'trigger commitment should be better on stable shot');
assert(stableShot.followThrough > pressuredShot.followThrough, 'follow-through should be better on stable shot');
assert(stableShot.recenterConfidence > pressuredShot.recenterConfidence, 'recenter confidence should be better on stable shot');
assert(pressuredShot.cadenceMistime > stableShot.cadenceMistime, 'pressured shot should have higher cadence mistime');

const stableCleanFeel = buildCleanGunplayFeelSnapshot(basePlayer, {
  nowMs: now,
  shot: stableShot,
  aim,
  ads: 0.82,
  weaponDiscipline: buildWeaponDisciplineSnapshot(basePlayer, {
    nowMs: now,
    aim,
    cadenceScore: 0.35
  }),
  sustainedFire: buildSustainedFireDisciplineSnapshot(basePlayer, {
    nowMs: now,
    heat: 0.06,
    shotIndex: 0,
    fireRate: 0.16,
    ads: 0.82,
    aim,
    cadenceScore: 0.35
  })
});
const pressuredCleanFeel = buildCleanGunplayFeelSnapshot(pressuredPlayer, {
  nowMs: now,
  shot: pressuredShot,
  aim,
  ads: 0.82,
  weaponDiscipline: discipline,
  sustainedFire: buildSustainedFireDisciplineSnapshot(pressuredPlayer, {
    nowMs: now,
    heat: 0.42,
    shotIndex: 3,
    fireRate: 0.11,
    ads: 0.82,
    aim,
    cadenceScore: 0.08,
    traversal: pressuredPlayer._traversalFeelSnapshot,
    traversalAt: pressuredPlayer._traversalFeelSnapshotAt
  }),
  traversal: pressuredPlayer._traversalFeelSnapshot,
  traversalAt: pressuredPlayer._traversalFeelSnapshotAt
});
assert(stableCleanFeel.active && pressuredCleanFeel.active, 'clean gunplay feel should resolve active stable and pressured shots');
assert(stableCleanFeel.cleanliness > pressuredCleanFeel.cleanliness, 'stable shot should have cleaner gunplay feel');
assert(pressuredCleanFeel.noise > stableCleanFeel.noise, 'pressured shot should have noisier gunplay feel');
assert(stableCleanFeel.viewKickMul < pressuredCleanFeel.viewKickMul, 'clean feel should reduce stable view kick compared with pressured shot');
assert(stableCleanFeel.recoilReturnMul > pressuredCleanFeel.recoilReturnMul, 'clean feel should improve stable recoil return');
assert(stableCleanFeel.crosshairScaleMul < pressuredCleanFeel.crosshairScaleMul, 'clean feel should tighten stable crosshair scale');
assert(stableCleanFeel.spreadMul < pressuredCleanFeel.spreadMul, 'clean feel should tighten stable spread');

const storyPlayer = {
  ...basePlayer,
  _storyAimChainPulse: 0.82,
  _storyChainRewardPulse: 0.42,
  _combatFlow: 0.64,
  _hitFlowPulse: 0.34,
  _killFlowPulse: 0.18,
  _followThroughPulse: 0.40,
  _sightRecoveryPulse: 0.36,
  _triggerPrepPulse: 0.30
};
const storyAssist = buildStoryGunplayAssistSnapshot(storyPlayer, {
  nowMs: now,
  ads: 0.88,
  aim,
  traversalPressure: 0.02,
  damageInterference: 0.02
});
const storyDiscipline = buildWeaponDisciplineSnapshot(storyPlayer, {
  nowMs: now,
  aim,
  cadenceScore: 0.46
});
const storyShot = buildShotQualitySnapshot(storyPlayer, {
  nowMs: now,
  weaponIdx: 0,
  ads: 0.88,
  aim,
  spread: 0.002,
  baseSpread: 0.002,
  firstShot: true,
  settled: true,
  shotIndex: 0,
  cadenceScore: 0.46
});
const rushedStoryPlayer = {
  ...storyPlayer,
  running: true,
  _traversalFeelSnapshot: pressuredPlayer._traversalFeelSnapshot,
  _traversalFeelSnapshotAt: now - 70,
  _slideBlockedPulse: 0.7,
  _damageShock: 0.42,
  _cadenceMistimePulse: 0.72
};
const rushedAssist = buildStoryGunplayAssistSnapshot(rushedStoryPlayer, {
  nowMs: now,
  ads: 0.88,
  aim,
  traversal: rushedStoryPlayer._traversalFeelSnapshot,
  traversalAt: rushedStoryPlayer._traversalFeelSnapshotAt,
  damageInterference: 0.42,
  cadenceMistime: 0.72
});
const objectivePlayer = {
  ...storyPlayer,
  _objectiveStabilizePulse: 0.78,
  _objectivePayoffAnticipationPulse: 0.64,
  _reloadHandLockPulse: 0.48,
  _reloadFeelSnapshot: { insertConfidence: 0.66, chamberSettle: 0.58 }
};
const surfacePlayer = {
  ...storyPlayer,
  _surfaceImpactHardnessPulse: 0.84,
  _surfaceImpactReadPulse: 0.62,
  _reloadFumblePulse: 0.42
};
const objectiveAssist = buildStoryGunplayAssistSnapshot(objectivePlayer, {
  nowMs: now,
  ads: 0.88,
  aim,
  traversalPressure: 0.02,
  damageInterference: 0.02
});
const surfaceDiscipline = buildWeaponDisciplineSnapshot(surfacePlayer, {
  nowMs: now,
  aim,
  cadenceScore: 0.46
});

assert(storyAssist.active, 'story gunplay assist should activate for settled story chain');
assert(storyAssist.spreadMul < 1, 'story gunplay assist should tighten spread');
assert(storyAssist.recoilReturnMul > 1, 'story gunplay assist should improve recoil return');
assert(objectiveAssist.objectiveAssist > 0.7 && objectiveAssist.reloadConfidence > 0.6, 'gunplay objective/reload assist fields missing');
assert(objectiveAssist.assist >= storyAssist.assist * 0.9, 'objective assist should preserve composed story assist');
assert(surfaceDiscipline.surfaceInterference > 0.8 && surfaceDiscipline.label === 'surface-startled', 'gunplay surface interference missing');
assert(storyDiscipline.storyAssist && storyDiscipline.storyAssist.active, 'discipline snapshot lost story assist');
assert(storyDiscipline.spreadMul < 1.02, 'story discipline should avoid unnecessary bloom');
assert(storyShot.storyAssist && storyShot.storyAssist.active, 'shot quality snapshot lost story assist');
assert(storyShot.followThrough > stableShot.followThrough * 0.92, 'story assist should preserve follow-through');
assert(rushedAssist.assist < storyAssist.assist * 0.65, 'rushed traversal should suppress story gunplay assist');

const sustainedSpray = buildSustainedFireDisciplineSnapshot(pressuredPlayer, {
  nowMs: now,
  heat: 0.76,
  shotIndex: 7,
  fireRate: 0.085,
  ads: 0.58,
  aim,
  cadenceScore: 0.05,
  traversal: pressuredPlayer._traversalFeelSnapshot,
  traversalAt: pressuredPlayer._traversalFeelSnapshotAt
});
const sustainedControlled = buildSustainedFireDisciplineSnapshot(storyPlayer, {
  nowMs: now,
  heat: 0.30,
  shotIndex: 2,
  fireRate: 0.16,
  ads: 0.88,
  aim,
  cadenceScore: 0.62,
  storyAssist
});
assert(sustainedSpray.pressureAfterControl > sustainedControlled.pressureAfterControl, 'sustained spray pressure should exceed controlled burst');
assert(sustainedSpray.recoilMul > sustainedControlled.recoilMul, 'sustained spray should increase recoil');
assert(sustainedSpray.spreadMul > sustainedControlled.spreadMul, 'sustained spray should increase spread');
assert(sustainedControlled.burstControl > sustainedSpray.burstControl, 'controlled burst should have stronger burst control');

recordGunplayShot(pressuredPlayer, {
  nowMs: now,
  weaponIdx: 0,
  ads: 0.82,
  aim,
  spread: 0.0022,
  baseSpread: 0.002,
  firstShot: true,
  settled: true,
  shotIndex: 2,
  cadenceScore: 0.08,
  traversal: pressuredPlayer._traversalFeelSnapshot,
  traversalAt: pressuredPlayer._traversalFeelSnapshotAt
});
const snapshot = buildGunplayPolishSnapshot(pressuredPlayer);
assert(snapshot.traversalPressure > 0.62, 'gunplay snapshot lost traversal pressure');
assert(snapshot.weaponDiscipline && snapshot.weaponDiscipline.handlingPressure > 0.35, 'gunplay snapshot lost weapon discipline');
assert(snapshot.traversalShotPulse > 0.2, 'traversal shot pulse did not fire');
assert(snapshot.recenterCuePulse > 0, 'recenter cue did not respond to pressured shot');
assert(snapshot.triggerBreakPulse > 0.1, 'trigger break pulse did not fire');
assert(snapshot.triggerCommitPulse > 0.1, 'trigger commit pulse did not fire');
assert(snapshot.followThroughPulse > 0.1, 'follow-through pulse did not fire');
assert(snapshot.recenterConfidencePulse > 0.1, 'recenter confidence pulse did not fire');
assert(snapshot.cadenceMistimePulse > 0.1, 'cadence mistime pulse did not fire');
assert(snapshot.cleanFeel && snapshot.cleanFeel.version === CLEAN_GUNPLAY_FEEL_VERSION, 'gunplay snapshot lost clean feel');
assert(snapshot.cleanGunplayNoisePulse > 0.1 || snapshot.cleanGunplayFlowPulse > 0.1, 'clean gunplay pulses did not fire after recorded shot');
assert(snapshot.cleanNoise >= pressuredCleanFeel.noise * 0.45, 'gunplay snapshot lost clean noise signal');

recordGunplayShot(pressuredPlayer, {
  nowMs: now + 120,
  weaponIdx: 0,
  ads: 0.58,
  aim,
  spread: 0.0034,
  baseSpread: 0.002,
  firstShot: false,
  settled: false,
  shotIndex: 7,
  cadenceScore: 0.05,
  traversal: pressuredPlayer._traversalFeelSnapshot,
  traversalAt: pressuredPlayer._traversalFeelSnapshotAt,
  sustainedFire: sustainedSpray
});
const spraySnapshot = buildGunplayPolishSnapshot(pressuredPlayer);
assert(spraySnapshot.sustainedFirePulse > 0.1, 'sustained fire pulse did not fire');
assert(spraySnapshot.sustainedFire && spraySnapshot.sustainedFire.pressureAfterControl > 0.2, 'gunplay snapshot lost sustained fire pressure');
assert(spraySnapshot.cleanGunplayNoisePulse > 0.1, 'clean gunplay noise pulse did not fire on spray');

recordGunplayShot(storyPlayer, {
  nowMs: now + 220,
  weaponIdx: 0,
  ads: 0.88,
  aim,
  spread: 0.002,
  baseSpread: 0.002,
  firstShot: true,
  settled: true,
  shotIndex: 0,
  cadenceScore: 0.46
});
const storySnapshot = buildGunplayPolishSnapshot(storyPlayer);
assert(storySnapshot.storyAssist && storySnapshot.storyAssist.active, 'gunplay snapshot lost story assist');
assert(storySnapshot.storyGunplayAssistPulse > 0.1, 'story gunplay assist pulse did not fire');
assert(storySnapshot.precisionChainPulse > 0.08, 'precision chain pulse did not fire');
assert(storySnapshot.xhairTighten > snapshot.xhairTighten * 0.5, 'story assist did not influence crosshair tighten');
assert(storySnapshot.cleanFeel && storySnapshot.cleanFeel.cleanliness > snapshot.cleanFeel.cleanliness * 0.75, 'story snapshot should preserve clean feel');

const transferPlayer = {
  ...basePlayer,
  ads: 0.9,
  adsVis: 0.9,
  _gunplayShotQualitySnapshot: {
    quality: 0.86,
    control: 0.78,
    ads: 0.9,
    followThrough: 0.82,
    sightReturn: 0.76,
    xhairTighten: 0.04
  },
  _gunplayLastShotQuality: 0.86,
  _gunplayLastControl: 0.78,
  _followThroughPulse: 0.62,
  _sightRecoveryPulse: 0.54,
  _lastSustainedFireDiscipline: { pressureAfterControl: 0.08 }
};
recordGunplayOutcome(transferPlayer, {
  nowMs: now + 320,
  hit: true,
  killed: true,
  headshot: true,
  damage: 120,
  weaponIdx: 0,
  enemyResponse: {
    shotInterrupt: 0.82,
    weaponRecovery: 0.66,
    coverBreak: 0.34,
    reactionLockMs: 520
  },
  shotQuality: transferPlayer._gunplayShotQualitySnapshot
});
const transferAssist = buildTargetTransitionAssistSnapshot(transferPlayer, {
  hit: true,
  killed: true,
  headshot: true,
  shot: transferPlayer._gunplayShotQualitySnapshot
});
const transferSnapshot = buildGunplayPolishSnapshot(transferPlayer);
assert(transferAssist.active, 'target transition assist should activate after clean hit');
assert(transferSnapshot.targetTransition && transferSnapshot.targetTransition.assist > 0.18, 'gunplay snapshot lost target transition assist');
assert(transferAssist.transferWindow > 0.18 && transferAssist.snapFollowThrough > 0.18, 'target transfer window did not resolve');
assert(transferSnapshot.targetTransitionPulse > 0.16, 'target transition pulse did not fire');
assert(transferSnapshot.hitConfirmSettlePulse > 0.14, 'hit confirm settle pulse did not fire');
assert(transferSnapshot.targetSwitchRecenterPulse > 0.12, 'target switch recenter pulse did not fire');
assert(transferSnapshot.targetTransferWindowPulse > 0.10, 'target transfer window pulse did not fire');
assert(transferSnapshot.attackBreakPulse > 0.30 && transferSnapshot.weaponBreakPulse > 0.20, 'enemy attack-break pulses did not fire');
assert(transferSnapshot.enemyAttackBreak?.version === 'enemy-attack-break-feedback.v1', 'enemy attack-break debug payload missing');
assert(transferSnapshot.recoilReturnMul > storySnapshot.recoilReturnMul * 0.72, 'target transition should preserve recoil return');
assert(transferSnapshot.cleanTargetFlowPulse > 0.10, 'clean target flow pulse did not fire after hit');
assert(transferSnapshot.cleanFeel && transferSnapshot.cleanFeel.targetFlow > 0.08, 'clean feel did not compose target flow');

console.log(JSON.stringify({
  ok: true,
  version: GUNPLAY_POLISH_VERSION,
  stable: {
    quality: Number(stableShot.quality.toFixed(3)),
    recoilSettleBoost: Number(stableShot.recoilSettleBoost.toFixed(3)),
    triggerPrep: Number(stableShot.triggerPrep.toFixed(3)),
    triggerCommit: Number(stableShot.triggerCommit.toFixed(3)),
    recenterConfidence: Number(stableShot.recenterConfidence.toFixed(3)),
    followThrough: Number(stableShot.followThrough.toFixed(3))
  },
  pressured: {
    quality: Number(pressuredShot.quality.toFixed(3)),
    traversalPressure: Number(pressuredShot.traversalPressure.toFixed(3)),
    recoilSettleBoost: Number(pressuredShot.recoilSettleBoost.toFixed(3)),
    triggerPrep: Number(pressuredShot.triggerPrep.toFixed(3)),
    triggerCommit: Number(pressuredShot.triggerCommit.toFixed(3)),
    recenterConfidence: Number(pressuredShot.recenterConfidence.toFixed(3)),
    followThrough: Number(pressuredShot.followThrough.toFixed(3)),
    cadenceMistime: Number(pressuredShot.cadenceMistime.toFixed(3)),
    spreadMul: Number(discipline.spreadMul.toFixed(3)),
    viewKickMul: Number(discipline.viewKickMul.toFixed(3)),
    recoilReturnMul: Number(discipline.recoilReturnMul.toFixed(3))
  },
  story: {
    assist: Number(storyAssist.assist.toFixed(3)),
    breathSettle: Number(storyAssist.breathSettle.toFixed(3)),
    spreadMul: Number(storyAssist.spreadMul.toFixed(3)),
    recoilReturnMul: Number(storyAssist.recoilReturnMul.toFixed(3)),
    pulse: Number(storySnapshot.storyGunplayAssistPulse.toFixed(3)),
    precisionChain: Number(storySnapshot.precisionChainPulse.toFixed(3)),
    rushedAssist: Number(rushedAssist.assist.toFixed(3))
  },
  sustained: {
    sprayPressure: Number(sustainedSpray.pressureAfterControl.toFixed(3)),
    controlledPressure: Number(sustainedControlled.pressureAfterControl.toFixed(3)),
    recoilMul: Number(sustainedSpray.recoilMul.toFixed(3)),
    spreadMul: Number(sustainedSpray.spreadMul.toFixed(3)),
    pulse: Number(spraySnapshot.sustainedFirePulse.toFixed(3))
  },
  cleanFeel: {
    version: CLEAN_GUNPLAY_FEEL_VERSION,
    stableCleanliness: Number(stableCleanFeel.cleanliness.toFixed(3)),
    stableFlow: Number(stableCleanFeel.flow.toFixed(3)),
    stableSpreadMul: Number(stableCleanFeel.spreadMul.toFixed(3)),
    stableRecoilReturnMul: Number(stableCleanFeel.recoilReturnMul.toFixed(3)),
    pressuredNoise: Number(pressuredCleanFeel.noise.toFixed(3)),
    pressuredViewKickMul: Number(pressuredCleanFeel.viewKickMul.toFixed(3)),
    snapshotNoisePulse: Number((snapshot.cleanGunplayNoisePulse || 0).toFixed(3)),
    storyCleanliness: Number((storySnapshot.cleanFeel?.cleanliness || 0).toFixed(3))
  },
  targetTransition: {
    assist: Number(transferAssist.assist.toFixed(3)),
    settle: Number(transferAssist.settle.toFixed(3)),
    recenter: Number(transferAssist.recenter.toFixed(3)),
    pulse: Number(transferSnapshot.targetTransitionPulse.toFixed(3)),
    hitConfirm: Number(transferSnapshot.hitConfirmSettlePulse.toFixed(3)),
    switchRecenter: Number(transferSnapshot.targetSwitchRecenterPulse.toFixed(3)),
    transferWindow: Number(transferAssist.transferWindow.toFixed(3)),
    snapFollowThrough: Number(transferAssist.snapFollowThrough.toFixed(3)),
    cleanTargetFlow: Number((transferSnapshot.cleanFeel?.targetFlow || 0).toFixed(3)),
    cleanTargetPulse: Number((transferSnapshot.cleanTargetFlowPulse || 0).toFixed(3)),
    attackBreak: Number(transferSnapshot.attackBreakPulse.toFixed(3)),
    weaponBreak: Number(transferSnapshot.weaponBreakPulse.toFixed(3))
  }
}, null, 2));
