import { getReloadTimelineSpec, getReloadWeaponClass, reloadPhaseLabel } from '../reloadTimelines.js';

export const RELOAD_FEEL_VERSION = 'reload-feel.v3';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

function smooth01(v) {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

function phaseT(progress, a, b) {
  return clamp01((progress - a) / Math.max(0.001, b - a));
}

function windowPulse(progress, a, b) {
  const t = phaseT(progress, a, b);
  return Math.sin(t * Math.PI) * (progress >= a && progress <= b ? 1 : 0);
}

function edgePulse(progress, edge, width = 0.055) {
  return clamp01(1 - Math.abs(progress - edge) / Math.max(0.001, width));
}

const PROFILE = Object.freeze({
  rifle: Object.freeze({ side: 1, weight: 1.0, reach: 1.0, rack: 1.0, settle: 1.0, wrist: 1.0 }),
  pistol: Object.freeze({ side: -1, weight: 0.72, reach: 0.84, rack: 0.82, settle: 1.16, wrist: 1.22 }),
  pistolCompact: Object.freeze({ side: -1, weight: 0.62, reach: 0.76, rack: 0.76, settle: 1.22, wrist: 1.30 }),
  smg: Object.freeze({ side: 1, weight: 0.82, reach: 0.88, rack: 0.88, settle: 1.08, wrist: 1.08 }),
  shotgun: Object.freeze({ side: -1, weight: 1.18, reach: 1.12, rack: 1.18, settle: 0.94, wrist: 0.92 }),
  marksman: Object.freeze({ side: 1, weight: 1.14, reach: 1.08, rack: 1.10, settle: 0.96, wrist: 0.95 }),
  sniper: Object.freeze({ side: 1, weight: 1.34, reach: 1.14, rack: 1.30, settle: 0.88, wrist: 0.86 })
});

function profileFor(weaponIdx) {
  const klass = getReloadWeaponClass(weaponIdx);
  return PROFILE[klass] || PROFILE.rifle;
}

function rangeForPhase(phase, spec) {
  const dropAt = spec ? spec.magDropAt : 0.22;
  const hide1 = spec ? spec.magHidden[1] : 0.78;
  const chamber0 = spec ? spec.chamber[0] : 0.80;
  const chamber1 = spec ? spec.chamber[1] : 1.0;
  if (phase === 'release') return [0, 0.12];
  if (phase === 'remove') return [0.12, dropAt];
  if (phase === 'retrieve') return [dropAt, hide1];
  if (phase === 'insert') return [hide1, chamber0];
  if (phase === 'chamber') return [chamber0, chamber1];
  if (phase === 'settle') return [chamber1, 1];
  return [0, 1];
}

function playerProgress(player, opts) {
  if (Number.isFinite(opts.progress)) return opts.progress;
  if (player && player.RELOAD_TIME > 0 && Number.isFinite(player.reloadTimer)) {
    return 1 - player.reloadTimer / Math.max(0.001, player.RELOAD_TIME);
  }
  return 0;
}

function boolOpt(player, opts, key, fallback = false) {
  if (Object.prototype.hasOwnProperty.call(opts, key)) return !!opts[key];
  return !!(player && player[key] != null ? player[key] : fallback);
}

function numOpt(player, opts, key, fallback = 0) {
  if (Number.isFinite(opts[key])) return opts[key];
  return Number.isFinite(player && player[key]) ? player[key] : fallback;
}

export function buildReloadFeelSnapshot(player = null, opts = {}) {
  const weaponIdx = Number.isFinite(opts.weaponIdx) ? opts.weaponIdx | 0 : ((player && Number.isFinite(player.weaponIdx)) ? player.weaponIdx | 0 : 0);
  const active = Object.prototype.hasOwnProperty.call(opts, 'active') ? !!opts.active : !!(player && player.reloading);
  const progress = clamp01(playerProgress(player, opts));
  const spec = getReloadTimelineSpec(weaponIdx);
  const klass = getReloadWeaponClass(weaponIdx);
  const prof = profileFor(weaponIdx);
  if (!spec) {
    return {
      version: RELOAD_FEEL_VERSION,
      active: false,
      weaponIdx,
      className: klass,
      progress: 0,
      phase: 'n/a',
      phaseT: 0,
      finite: true
    };
  }

  const phase = active ? reloadPhaseLabel(progress, weaponIdx) : 'idle';
  const [pa, pb] = rangeForPhase(phase, spec);
  const pt = phaseT(progress, pa, pb);
  const release = windowPulse(progress, 0.00, 0.16);
  const remove = active ? windowPulse(progress, 0.10, Math.max(0.16, spec.magDropAt + 0.02)) : 0;
  const magDropImpact = active ? edgePulse(progress, spec.magDropAt, 0.050) : 0;
  const retrieve = active ? windowPulse(progress, Math.max(0.12, spec.magDropAt), Math.max(spec.magDropAt + 0.04, spec.magHidden[1])) : 0;
  const insert = active ? windowPulse(progress, Math.max(0.18, spec.magHidden[1] - 0.06), Math.max(spec.magHidden[1] + 0.03, spec.chamber[0])) : 0;
  const chamber = active ? windowPulse(progress, spec.chamber[0], spec.chamber[1]) : 0;
  const chamberImpact = active ? edgePulse(progress, spec.chamber[0], 0.060) : 0;
  const settle = active ? smooth01(phaseT(progress, spec.chamber[1] - 0.04, 1.0)) : 0;
  const tactical = boolOpt(player, opts, '_tacticalReload', false);
  const suppression = clamp01(Math.max(numOpt(player, opts, '_suppressionLevel'), numOpt(player, opts, '_enemyShotPressure'), numOpt(player, opts, '_incomingFireThreatPulse')));
  const damageCatch = clamp01(Math.max(numOpt(player, opts, '_damageWeaponCatchPulse'), numOpt(player, opts, '_damageStepSavePulse') * 0.72));
  const damageBreath = clamp01(Math.max(numOpt(player, opts, '_damageBreathKnockPulse'), numOpt(player, opts, '_damagePainPulse') * 0.70, numOpt(player, opts, '_damageVisionPulse') * 0.46));
  const damage = clamp01(Math.max(numOpt(player, opts, '_damageShock'), numOpt(player, opts, '_damageWeaponDropPulse'), numOpt(player, opts, '_damageMovementStagger'), damageBreath * 0.72));
  const flow = clamp01(Math.max(numOpt(player, opts, '_combatFlow'), numOpt(player, opts, '_reloadFlowPulse'), numOpt(player, opts, '_killFlowPulse') * 0.55));
  const storyRecovery = clamp01(Math.max(numOpt(player, opts, '_storyRecoveryAssist'), numOpt(player, opts, '_storyBeatClutchPulse'), numOpt(player, opts, '_storyResourceMercyPulse') * 0.58));
  const objectiveAssist = clamp01(Math.max(numOpt(player, opts, '_objectiveStabilizePulse'), numOpt(player, opts, '_objectivePayoffAnticipationPulse') * 0.82, numOpt(player, opts, '_storyObjectivePayoffPulse') * 0.58, numOpt(player, opts, '_objectivePromptPulse') * 0.34));
  const objectivePressure = clamp01(Math.max(numOpt(player, opts, '_objectivePressurePulse'), numOpt(player, opts, '_objectiveFailPressurePulse'), numOpt(player, opts, '_objectiveBracePulse') * 0.58));
  const surfaceInterference = clamp01(Math.max(numOpt(player, opts, '_surfaceImpactHardnessPulse'), numOpt(player, opts, '_surfaceImpactReadPulse') * 0.72));
  const traversalRecovery = clamp01(Math.max(numOpt(player, opts, '_traversalRecenterPulse'), numOpt(player, opts, '_landingKneeAbsorbPulse') * 0.34));
  const storyAssist = clamp01(Math.max(numOpt(player, opts, '_storyReloadAssistPulse'), storyRecovery * 0.72, numOpt(player, opts, '_storyBeatReliefPulse') * 0.50, objectiveAssist * 0.62));
  const pressure = clamp01(suppression * 0.58 + damage * 0.54 + objectivePressure * 0.20 + surfaceInterference * 0.16 + numOpt(player, opts, '_reloadBlockedPulse') * 0.22 - damageCatch * 0.10 - traversalRecovery * 0.06);
  const emergencyShield = active ? clamp01(storyAssist * 0.34 + storyRecovery * 0.30 + objectiveAssist * 0.22 + damageCatch * 0.12 + traversalRecovery * 0.08 + flow * 0.10 - pressure * 0.08) : 0;
  const calm = clamp01(1 - pressure * 0.72 + flow * 0.16 + emergencyShield * 0.18 + objectiveAssist * 0.08 + damageCatch * 0.06 + (tactical ? 0.08 : 0));
  const commit = active ? smooth01(phaseT(progress, spec.magDropAt + 0.015, spec.magHidden[1] + 0.05)) : 0;
  const readyWindow = active ? smooth01(phaseT(progress, spec.chamber[1] - 0.08, 1.0)) : 0;
  const fumble = active ? clamp01(pressure * (0.34 + retrieve * 0.18 + insert * 0.14) + damage * chamber * 0.12 + surfaceInterference * (0.10 + retrieve * 0.07) + objectivePressure * insert * 0.07 - emergencyShield * (0.18 + insert * 0.08) - damageCatch * 0.08) : 0;
  const compact = tactical ? 0.78 : 1.0;
  const side = prof.side;
  const weight = prof.weight;

  const supportReach = clamp01(release * 0.20 + remove * 0.36 + retrieve * 0.92 + insert * 0.74 + chamber * 0.24);
  const supportClamp = clamp01(insert * 0.72 + chamber * 0.52 + settle * 0.18);
  const supportLock = clamp01(insert * 0.34 + chamber * 0.22 + emergencyShield * 0.42 + calm * 0.08 + damageCatch * 0.12 + objectiveAssist * 0.10);
  const magGuide = clamp01(retrieve * 0.22 + insert * 0.64 + emergencyShield * 0.20 + objectiveAssist * 0.10 + traversalRecovery * 0.06);
  const panicGrip = clamp01(pressure * 0.42 + damage * 0.28 - emergencyShield * 0.20);
  const dominantBrace = clamp01(remove * 0.22 + insert * 0.32 + chamber * 0.80 + pressure * 0.18 + emergencyShield * 0.10 + damageCatch * 0.08);
  const wristSnap = clamp01(release * 0.38 + magDropImpact * 0.42 + chamber * 0.76 + chamberImpact * 0.44 + surfaceInterference * 0.10 - objectiveAssist * 0.04);
  const insertConfidence = clamp01(insert * 0.44 + magGuide * 0.30 + supportLock * 0.20 + objectiveAssist * 0.16 + damageCatch * 0.12 - fumble * 0.24);
  const chamberSettle = clamp01(chamber * 0.46 + settle * 0.38 + emergencyShield * 0.18 + traversalRecovery * 0.12 - surfaceInterference * 0.10);
  const bodyLean = clamp((-remove * 0.12 + retrieve * 0.16 - insert * 0.08 + pressure * 0.10 + surfaceInterference * 0.05 - objectiveAssist * 0.04) * side * weight, -0.32, 0.32);
  const weaponX = side * (remove * 0.016 + retrieve * 0.028 + insert * -0.018 + fumble * 0.018 + surfaceInterference * 0.008 - insertConfidence * 0.006) * compact * prof.reach;
  const weaponY = -(remove * 0.030 + retrieve * 0.048 + magDropImpact * 0.024) + insert * 0.020 + settle * 0.012 - fumble * 0.010 + insertConfidence * 0.006 + chamberSettle * 0.005;
  const weaponZ = retrieve * 0.040 - insert * 0.030 + chamber * 0.025 - settle * 0.018 + pressure * 0.010 - objectiveAssist * 0.006 - chamberSettle * 0.010;
  const weaponRX = release * 0.050 + remove * 0.090 - retrieve * 0.060 + insert * 0.075 + chamber * 0.150 * prof.rack - settle * 0.038 + fumble * 0.045 + surfaceInterference * 0.018 - chamberSettle * 0.024;
  const weaponRY = side * (remove * 0.045 + retrieve * 0.070 - insert * 0.050 + chamber * 0.030 + fumble * 0.030 + surfaceInterference * 0.012 - insertConfidence * 0.014);
  const weaponRZ = side * (release * 0.070 + remove * 0.145 + retrieve * -0.110 + insert * 0.080 - chamber * 0.065 + fumble * 0.070 + surfaceInterference * 0.020 - chamberSettle * 0.026) * prof.wrist;
  const cameraPitch = active ? (release * 0.003 - retrieve * 0.008 + insert * 0.006 + chamber * 0.011 - settle * 0.005 + pressure * 0.006 + surfaceInterference * 0.003 - emergencyShield * 0.003 - chamberSettle * 0.002) : 0;
  const cameraRoll = active ? side * (remove * 0.006 + retrieve * 0.014 - insert * 0.010 + chamber * 0.008 + fumble * 0.012 + surfaceInterference * 0.005 - emergencyShield * 0.004 - insertConfidence * 0.003) : 0;
  const cameraYaw = active ? side * (retrieve * 0.003 - insert * 0.002 + fumble * 0.002) : 0;
  const uiProgress = active ? clamp01(lerp(progress, smooth01(progress), 0.26 + calm * 0.10)) : progress;

  return {
    version: RELOAD_FEEL_VERSION,
    active,
    weaponIdx,
    className: klass,
    progress,
    phase,
    phaseT: pt,
    tactical,
    pressure,
    calm,
    flow,
    storyRecovery,
    storyAssist,
    objectiveAssist,
    objectivePressure,
    surfaceInterference,
    damageCatch,
    damageBreath,
    traversalRecovery,
    emergencyShield,
    commit,
    readyWindow,
    release,
    remove,
    retrieve,
    insert,
    chamber,
    settle,
    magDropImpact,
    chamberImpact,
    supportReach,
    supportClamp,
    supportLock,
    magGuide,
    panicGrip,
    dominantBrace,
    wristSnap,
    insertConfidence,
    chamberSettle,
    bodyLean,
    fumble,
    handlingPenalty: active ? clamp01((1 - readyWindow) * 0.52 + pressure * 0.28 + fumble * 0.20 + surfaceInterference * 0.06 - emergencyShield * 0.12 - insertConfidence * 0.04) : 0,
    speedScale: clamp(1 + flow * 0.08 + emergencyShield * 0.06 + objectiveAssist * 0.035 + traversalRecovery * 0.030 - pressure * 0.10 - surfaceInterference * 0.035 + (tactical ? 0.04 : 0), 0.74, 1.20),
    uiProgress,
    uiFlash: clamp01(magDropImpact * 0.44 + chamberImpact * 0.36 + readyWindow * 0.30),
    supportHandX: weaponX * 0.70 + side * (retrieve * -0.018 + insert * 0.014 + magGuide * 0.010) * prof.reach,
    supportHandY: -supportReach * 0.050 + insert * 0.035 + chamber * 0.010 - fumble * 0.018 + supportLock * 0.010,
    supportHandZ: retrieve * 0.052 - insert * 0.064 + chamber * 0.012 - magGuide * 0.012,
    supportHandRX: supportReach * 0.30 - insert * 0.18 + fumble * 0.12 - supportLock * 0.055,
    supportHandRZ: side * (-retrieve * 0.18 + insert * 0.14 + supportClamp * 0.06 - supportLock * 0.040),
    dominantHandZ: -release * 0.012 - magDropImpact * 0.014 - chamber * 0.032 * prof.rack,
    dominantHandY: -magDropImpact * 0.008 + chamber * 0.010 - fumble * 0.006,
    dominantHandRX: release * 0.055 + chamber * -0.170 * prof.rack + fumble * 0.035 - emergencyShield * 0.022,
    dominantHandRZ: side * (release * 0.080 - magDropImpact * 0.040 + chamber * 0.070 - emergencyShield * 0.025),
    fingerRelease: clamp01(release * 0.82 + remove * 0.22),
    fingerGrab: clamp01(retrieve * 0.92 + insert * 0.40),
    fingerSeat: clamp01(insert * 0.96 + chamberImpact * 0.30),
    fingerRack: clamp01(chamber * 1.0 + chamberImpact * 0.46),
    cameraPitch,
    cameraRoll,
    cameraYaw,
    weaponX,
    weaponY,
    weaponZ,
    weaponRX,
    weaponRY,
    weaponRZ,
    label: active ? (surfaceInterference > 0.48 ? 'startled-reload' : (objectiveAssist > 0.38 ? 'objective-covered-reload' : (emergencyShield > 0.28 ? 'covered-reload' : (pressure > 0.60 ? 'pressured-reload' : (tactical ? 'tactical-reload' : phase))))) : 'idle',
    finite: true
  };
}

function pulseMax(player, key, value) {
  if (!player) return;
  player[key] = Math.max(Number.isFinite(player[key]) ? player[key] : 0, clamp01(value));
}

export function recordReloadStartFeel(player, opts = {}) {
  if (!player) return null;
  const snap = buildReloadFeelSnapshot(player, { ...opts, active: true, progress: 0 });
  player._reloadFeelVersion = RELOAD_FEEL_VERSION;
  player._reloadFeelSnapshot = snap;
  player._reloadFeelPhase = snap.phase;
  player._reloadFeelStartedAt = Number.isFinite(opts.nowMs) ? opts.nowMs : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  pulseMax(player, '_reloadCommitPulse', 0.28 + (snap.tactical ? 0.08 : 0) + snap.pressure * 0.10);
  pulseMax(player, '_reloadPhasePulse', 0.42);
  return snap;
}

export function recordReloadCompleteFeel(player, opts = {}) {
  if (!player) return null;
  const snap = buildReloadFeelSnapshot(player, { ...opts, active: false, progress: 1 });
  player._reloadFeelSnapshot = { ...snap, active: false, phase: 'settle', readyWindow: 1, uiProgress: 1 };
  player._reloadFeelPhase = 'settle';
  pulseMax(player, '_reloadReadyPulse', 0.76 + clamp01(opts.flow || player._combatFlow || 0) * 0.12);
  pulseMax(player, '_reloadRackPulse', 0.34);
  pulseMax(player, '_reloadPhasePulse', 0.52);
  return player._reloadFeelSnapshot;
}

export function recordReloadInterruptFeel(player, opts = {}) {
  if (!player) return null;
  const progress = Number.isFinite(opts.progress) ? opts.progress : playerProgress(player, opts);
  const snap = buildReloadFeelSnapshot(player, { ...opts, active: false, progress });
  player._reloadFeelSnapshot = { ...snap, active: false, phase: 'interrupted', progress };
  player._reloadFeelPhase = 'interrupted';
  pulseMax(player, '_reloadFumblePulse', 0.54 + clamp01(1 - progress) * 0.20);
  pulseMax(player, '_reloadBlockedPulse', 0.40);
  return player._reloadFeelSnapshot;
}

export function tickReloadFeel(player, dt, dampFn = null, opts = {}) {
  if (!player) return null;
  const damp = typeof dampFn === 'function'
    ? dampFn
    : ((current, target, lambda, delta) => target + (current - target) * Math.exp(-lambda * Math.max(0, delta || 0)));
  for (const [key, lambda] of [
    ['_reloadCommitPulse', 7.0],
    ['_reloadInsertPulse', 9.6],
    ['_reloadRackPulse', 8.4],
    ['_reloadPhasePulse', 8.8],
    ['_reloadFumblePulse', 10.0],
    ['_reloadEmergencyShieldPulse', 7.4],
    ['_reloadHandLockPulse', 8.2]
  ]) {
    player[key] = damp(Number.isFinite(player[key]) ? player[key] : 0, 0, lambda, dt);
  }
  const snap = buildReloadFeelSnapshot(player, opts);
  const last = player._reloadFeelPhase || 'idle';
  if (snap.active && snap.phase !== last) {
    pulseMax(player, '_reloadPhasePulse', 0.30 + snap.pressure * 0.12);
    if (snap.phase === 'retrieve') pulseMax(player, '_reloadCommitPulse', 0.46);
    if (snap.phase === 'insert') pulseMax(player, '_reloadInsertPulse', 0.58 + snap.pressure * 0.10);
    if (snap.phase === 'chamber') pulseMax(player, '_reloadRackPulse', 0.64 + snap.pressure * 0.10);
  }
  if (snap.active && snap.fumble > 0.14) pulseMax(player, '_reloadFumblePulse', snap.fumble * 0.42);
  if (snap.active && snap.emergencyShield > 0.08) pulseMax(player, '_reloadEmergencyShieldPulse', snap.emergencyShield * 0.58);
  if (snap.active && (snap.supportLock > 0.10 || snap.magGuide > 0.10)) pulseMax(player, '_reloadHandLockPulse', Math.max(snap.supportLock, snap.magGuide) * 0.50);
  player._reloadFeelPhase = snap.phase;
  player._reloadFeelSnapshot = snap;
  return snap;
}
