export const GUNPLAY_POLISH_VERSION = 'gunplay-polish.v6';
export const STORY_GUNPLAY_ASSIST_VERSION = 'story-gunplay-assist.v2';
export const CLEAN_GUNPLAY_FEEL_VERSION = 'clean-gunplay-feel.v1';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * Math.max(0, dt || 0));
}

const DECAY = Object.freeze({
  _shotQualityPulse: 8.4,
  _perfectShotPulse: 5.9,
  _badShotPulse: 8.8,
  _recenterCuePulse: 7.2,
  _tempoWindowPulse: 6.5,
  _nearMissDisciplinePulse: 6.0,
  _impactConfirmMicroPulse: 9.2,
  _suppressionControlPulse: 7.8,
  _traversalShotPulse: 8.8,
  _weaponDisciplinePulse: 6.8,
  _recoilStabilityPulse: 7.1,
  _triggerPrepPulse: 7.8,
  _triggerBreakPulse: 13.2,
  _triggerCommitPulse: 6.2,
  _followThroughPulse: 5.7,
  _sightRecoveryPulse: 6.8,
  _recenterConfidencePulse: 6.4,
  _cadenceMistimePulse: 8.6,
  _storyGunplayAssistPulse: 5.9,
  _precisionChainPulse: 5.4,
  _storyBreathSettlePulse: 6.6,
  _sustainedFirePulse: 5.2,
  _burstDisciplinePulse: 5.9,
  _targetTransitionPulse: 7.4,
  _hitConfirmSettlePulse: 8.2,
  _targetSwitchRecenterPulse: 6.8,
  _targetTransferWindowPulse: 5.8,
  _cleanGunplayFlowPulse: 6.4,
  _cleanGunplaySettlePulse: 7.0,
  _cleanGunplayNoisePulse: 8.4,
  _cleanTargetFlowPulse: 6.2,
  _attackBreakPulse: 6.4,
  _weaponBreakPulse: 5.8,
  _coverBreakPulse: 5.4
});

const PROFILES = Object.freeze({
  default: Object.freeze({
    adsWeight: 0.44,
    stabilityWeight: 0.28,
    cadenceWeight: 0.13,
    hipFloor: 0.08,
    spreadForgiveness: 1.16,
    perfect: 0.82,
    poor: 0.34,
    marker: 0.12,
    recoil: 0.15
  }),
  1: Object.freeze({
    adsWeight: 0.52,
    stabilityWeight: 0.30,
    cadenceWeight: 0.12,
    hipFloor: 0.06,
    spreadForgiveness: 1.05,
    perfect: 0.84,
    poor: 0.36,
    marker: 0.15,
    recoil: 0.18
  }),
  3: Object.freeze({
    adsWeight: 0.26,
    stabilityWeight: 0.18,
    cadenceWeight: 0.10,
    hipFloor: 0.28,
    spreadForgiveness: 1.55,
    perfect: 0.72,
    poor: 0.30,
    marker: 0.08,
    recoil: 0.10
  }),
  4: Object.freeze({
    adsWeight: 0.34,
    stabilityWeight: 0.22,
    cadenceWeight: 0.18,
    hipFloor: 0.18,
    spreadForgiveness: 1.30,
    perfect: 0.76,
    poor: 0.31,
    marker: 0.09,
    recoil: 0.11
  }),
  5: Object.freeze({
    adsWeight: 0.50,
    stabilityWeight: 0.33,
    cadenceWeight: 0.11,
    hipFloor: 0.05,
    spreadForgiveness: 1.02,
    perfect: 0.86,
    poor: 0.37,
    marker: 0.16,
    recoil: 0.20
  }),
  7: Object.freeze({
    adsWeight: 0.56,
    stabilityWeight: 0.36,
    cadenceWeight: 0.08,
    hipFloor: 0.03,
    spreadForgiveness: 0.92,
    perfect: 0.88,
    poor: 0.40,
    marker: 0.18,
    recoil: 0.12
  })
});

function profileFor(weaponIdx) {
  return PROFILES[weaponIdx | 0] || PROFILES.default;
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function pulseMax(player, key, value) {
  player[key] = Math.max(Number.isFinite(player[key]) ? player[key] : 0, clamp01(value));
}

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function traversalAgeScale(player, opts = {}) {
  const now = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  const at = Number.isFinite(opts.traversalAt)
    ? opts.traversalAt
    : (player && Number.isFinite(player._traversalFeelSnapshotAt) ? player._traversalFeelSnapshotAt : 0);
  if (!at) return 0.24;
  return clamp01(1 - Math.max(0, now - at) / 1150);
}

function resolveTraversalPressure(player, opts = {}) {
  const traversal = opts.traversal || (player && player._traversalFeelSnapshot) || {};
  const ageScale = traversalAgeScale(player, opts);
  const eventPressure = (
    finite(traversal.bodyJolt) * 0.34 +
    finite(traversal.locomotionSurge) * 0.18 +
    finite(traversal.severity) * 0.42 +
    finite(traversal.hard) * 0.20 +
    finite(traversal.flow) * 0.14 +
    finite(traversal.power) * 0.11
  ) * ageScale;
  const activePressure =
    finite(player && player._bodyJolt) * 0.18 +
    finite(player && player._locomotionSurge) * 0.16 +
    finite(player && player._moveContactStall) * 0.30 +
    finite(player && player._landingSlidePulse) * 0.16 +
    finite(player && player._slideBlockedPulse) * 0.26 +
    finite(player && player._jumpInputPulse) * 0.10;
  const explicit = Number.isFinite(opts.traversalPressure) ? opts.traversalPressure : 0;
  return clamp01(explicit + eventPressure + activePressure);
}

function resolveDamageInterference(player, shot = {}, opts = {}) {
  return clamp01(Math.max(
    clamp01(player && player._damageShock || 0),
    clamp01(player && player._damageWeaponDropPulse || 0) * 0.78,
    clamp01(player && player._damageTunnelPulse || 0) * 0.58,
    clamp01(player && player._damageMovementStagger || 0) * 0.68,
    clamp01(shot && shot.damageInterference || 0),
    clamp01(opts.damageInterference || 0),
    clamp01(opts.damageShock || 0)
  ));
}

export function buildStoryGunplayAssistSnapshot(player, opts = {}) {
  if (!player) return { version: STORY_GUNPLAY_ASSIST_VERSION, active: false };
  const shot = opts.shot || player._gunplayShotQualitySnapshot || {};
  const aim = opts.aim || player._aimFeelSnapshot || {};
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player.adsVis || player.ads || shot.ads || 0));
  const readiness = clamp01(Number.isFinite(opts.readiness) ? opts.readiness : (aim.readiness || shot.readiness || ads));
  const stability = clamp01(Number.isFinite(opts.stability) ? opts.stability : (aim.stability || shot.stability || readiness * 0.72));
  const reticleConfidence = clamp01(aim.reticleConfidence || shot.reticleConfidence || readiness);
  const lensFocus = clamp01(aim.lensFocus || shot.lensFocus || stability);
  const followPulse = clamp01(player._followThroughPulse || 0);
  const sightPulse = clamp01(player._sightRecoveryPulse || 0);
  const triggerPrepPulse = clamp01(player._triggerPrepPulse || 0);
  const objectiveAssist = clamp01(Math.max(
    clamp01(player._objectiveStabilizePulse || 0),
    clamp01(player._objectivePayoffAnticipationPulse || 0) * 0.82,
    clamp01(player._objectivePromptPulse || 0) * 0.34
  ));
  const objectivePressure = clamp01(Math.max(
    clamp01(player._objectivePressurePulse || 0),
    clamp01(player._objectiveFailPressurePulse || 0),
    clamp01(player._objectiveBracePulse || 0) * 0.52
  ));
  const surfaceInterference = clamp01(Math.max(
    clamp01(player._surfaceImpactHardnessPulse || 0),
    clamp01(player._surfaceImpactReadPulse || 0) * 0.72
  ));
  const reload = player._reloadFeelSnapshot || {};
  const reloadConfidence = clamp01(Math.max(
    clamp01(player._reloadHandLockPulse || 0),
    clamp01(player._reloadEmergencyShieldPulse || 0),
    clamp01(reload.insertConfidence || 0),
    clamp01(reload.chamberSettle || 0)
  ));
  const reloadStartle = clamp01(Math.max(
    clamp01(player._reloadFumblePulse || 0),
    clamp01(reload.surfaceInterference || 0)
  ));
  const storyAim = clamp01(Math.max(
    clamp01(player._storyAimChainPulse || 0),
    clamp01(player._storyChainRewardPulse || 0) * 0.58,
    clamp01(player._storyRoomClearPulse || 0) * 0.42,
    clamp01(player._storyObjectivePayoffPulse || 0) * 0.36,
    clamp01(player._storyRoomEntryPulse || 0) * 0.30,
    clamp01(player._storyReloadAssistPulse || 0) * 0.22,
    objectiveAssist * 0.54,
    reloadConfidence * 0.30,
    clamp01(player._storyTargetSwapPulse || 0) * 0.44,
    clamp01(player._storyRecoveryBreatherPulse || 0) * 0.30
  ));
  const combatFlow = clamp01(player._combatFlow || 0);
  const hitFlow = clamp01(player._hitFlowPulse || 0);
  const killFlow = clamp01(player._killFlowPulse || 0);
  const focus = clamp01(Math.max(player._focusVis || 0, player._focusCameraKick || 0) * 0.72);
  const cadenceMistime = clamp01(Math.max(
    shot.cadenceMistime || 0,
    opts.cadenceMistime || 0,
    clamp01(player._cadenceMistimePulse || 0) * 0.72
  ));
  const traversalPressure = Number.isFinite(opts.traversalPressure)
    ? clamp01(opts.traversalPressure)
    : resolveTraversalPressure(player, opts);
  const damageInterference = resolveDamageInterference(player, shot, opts);
  const movingFast = (player.running ? 0.26 : 0) + ((player.sliding || player.slideAmt > 0.45) ? 0.32 : 0);
  const sightDiscipline = clamp01(
    readiness * 0.25 +
    stability * 0.23 +
    reticleConfidence * 0.16 +
    lensFocus * 0.12 +
    followPulse * 0.12 +
    sightPulse * 0.08 +
    triggerPrepPulse * 0.04
  );
  const storySignal = clamp01(
    storyAim * 0.58 +
    combatFlow * 0.18 +
    killFlow * 0.14 +
    hitFlow * 0.08 +
    focus * 0.07 +
    sightDiscipline * 0.13 +
    objectiveAssist * 0.16 +
    reloadConfidence * 0.08
  );
  const interference = clamp01(
    traversalPressure * 0.55 +
    damageInterference * 0.70 +
    cadenceMistime * 0.42 +
    objectivePressure * 0.22 +
    surfaceInterference * 0.20 +
    reloadStartle * 0.16 -
    objectiveAssist * 0.08 -
    reloadConfidence * 0.06 +
    movingFast * (ads > 0.50 ? 0.42 : 0.62) +
    (shot.poor ? 0.24 : 0)
  );
  const assist = clamp01(storySignal * (0.38 + sightDiscipline * 0.72) * (1 - interference * 0.78));
  const active = assist > 0.055;
  const breathSettle = clamp(assist * 0.54 + storyAim * 0.12 + sightDiscipline * 0.05 - interference * 0.10, 0, 0.68);
  const followThroughAssist = clamp(assist * 0.34 + followPulse * 0.05 + sightPulse * 0.04 - interference * 0.05, 0, 0.40);
  const stabilityAssist = clamp(assist * 0.28 + sightDiscipline * 0.06 - interference * 0.045, 0, 0.34);
  const cadenceForgiveness = clamp(assist * 0.25 + storyAim * 0.04 - interference * 0.06, 0, 0.30);
  return {
    version: STORY_GUNPLAY_ASSIST_VERSION,
    active,
    assist,
    storyAim,
    combatFlow,
    hitFlow,
    killFlow,
    focus,
    objectiveAssist,
    objectivePressure,
    surfaceInterference,
    reloadConfidence,
    reloadStartle,
    sightDiscipline,
    interference,
    traversalPressure,
    damageInterference,
    cadenceMistime,
    breathSettle,
    stabilityAssist,
    followThroughAssist,
    cadenceForgiveness,
    spreadMul: clamp(1 - stabilityAssist * 0.36 - breathSettle * 0.06 + interference * 0.035, 0.84, 1.08),
    viewKickMul: clamp(1 - followThroughAssist * 0.28 - breathSettle * 0.05 + interference * 0.045, 0.86, 1.08),
    recoilReturnMul: clamp(1 + stabilityAssist * 0.32 + followThroughAssist * 0.24 + breathSettle * 0.10 - interference * 0.07, 0.86, 1.34),
    label: !active ? 'inactive' : (surfaceInterference > 0.40 ? 'surface-contested' : (objectiveAssist > 0.42 && interference < 0.42 ? 'objective-settled' : (interference > 0.45 ? 'contested' : (storyAim > 0.48 ? 'story-settled' : 'held'))))
  };
}

export function buildSustainedFireDisciplineSnapshot(player, opts = {}) {
  if (!player) return { version: GUNPLAY_POLISH_VERSION, active: false };
  const shotIndex = Math.max(0, Number.isFinite(opts.shotIndex) ? opts.shotIndex : (player._gunplayShotIndex || 0));
  const heat = clamp01(Number.isFinite(opts.heat) ? opts.heat : (opts.hState && opts.hState.heat) || 0);
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player.adsVis || player.ads || 0));
  const aim = opts.aim || player._aimFeelSnapshot || {};
  const readiness = clamp01(aim.readiness || ads);
  const stability = clamp01(aim.stability || readiness * 0.72);
  const cadence = clamp01(opts.cadenceScore || 0);
  const fireRate = Math.max(0.03, Number.isFinite(opts.fireRate) ? opts.fireRate : 0.16);
  const storyAssist = opts.storyAssist || buildStoryGunplayAssistSnapshot(player, opts);
  const traversalPressure = Number.isFinite(opts.traversalPressure) ? clamp01(opts.traversalPressure) : resolveTraversalPressure(player, opts);
  const damageInterference = resolveDamageInterference(player, opts.shot || {}, opts);
  const surfaceInterference = clamp01(Math.max(player._surfaceImpactHardnessPulse || 0, (player._surfaceImpactReadPulse || 0) * 0.72, storyAssist.surfaceInterference || 0));
  const shotPressure = clamp01(
    heat * 0.46 +
    Math.max(0, shotIndex - 1) * 0.070 +
    (fireRate < 0.12 ? 0.10 : 0) +
    traversalPressure * 0.20 +
    damageInterference * 0.22 +
    surfaceInterference * 0.14 +
    clamp01(player._cadenceMistimePulse || 0) * 0.18
  );
  const burstControl = clamp01(
    ads * 0.24 +
    readiness * 0.24 +
    stability * 0.24 +
    cadence * 0.12 +
    clamp01(player._followThroughPulse || 0) * 0.10 +
    clamp01(player._sightRecoveryPulse || 0) * 0.06 +
    (storyAssist.active ? storyAssist.assist * 0.12 : 0) -
    traversalPressure * 0.16 -
    damageInterference * 0.18 -
    surfaceInterference * 0.10
  );
  const pressureAfterControl = clamp01(shotPressure - burstControl * 0.46 - (storyAssist.active ? storyAssist.breathSettle * 0.10 : 0));
  const recoilMul = clamp(1 + pressureAfterControl * 0.34 + heat * 0.10 - burstControl * 0.14, 0.82, 1.42);
  const spreadMul = clamp(1 + pressureAfterControl * 0.24 + Math.max(0, shotIndex - 2) * 0.018 - burstControl * 0.10 - (storyAssist.active ? storyAssist.stabilityAssist * 0.08 : 0), 0.84, 1.38);
  const heatAddMul = clamp(1 + pressureAfterControl * 0.18 - burstControl * 0.16 - (storyAssist.active ? storyAssist.breathSettle * 0.08 : 0), 0.72, 1.32);
  const returnMul = clamp(1 + burstControl * 0.18 + (storyAssist.active ? storyAssist.followThroughAssist * 0.16 : 0) - pressureAfterControl * 0.20, 0.74, 1.24);
  const cooldownMul = clamp(1 + burstControl * 0.18 - heat * 0.12 - pressureAfterControl * 0.10, 0.80, 1.24);
  return {
    version: GUNPLAY_POLISH_VERSION,
    active: heat > 0.08 || shotIndex > 1 || pressureAfterControl > 0.10,
    shotIndex,
    heat,
    ads,
    readiness,
    stability,
    cadence,
    storyAssist,
    traversalPressure,
    damageInterference,
    surfaceInterference,
    shotPressure,
    burstControl,
    pressureAfterControl,
    recoilMul,
    spreadMul,
    heatAddMul,
    returnMul,
    cooldownMul,
    label: pressureAfterControl > 0.52 ? 'overheated' : (burstControl > 0.58 ? 'disciplined' : (shotIndex > 2 ? 'spray' : 'neutral')),
    finite: true
  };
}

export function buildTargetTransitionAssistSnapshot(player, opts = {}) {
  if (!player) return { version: GUNPLAY_POLISH_VERSION, active: false };
  const shot = opts.shot || player._gunplayShotQualitySnapshot || {};
  const quality = clamp01(Number.isFinite(opts.quality) ? opts.quality : (shot.quality || player._gunplayLastShotQuality || 0));
  const control = clamp01(Number.isFinite(opts.control) ? opts.control : (shot.control || player._gunplayLastControl || 0));
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player.adsVis || player.ads || shot.ads || 0));
  const outcome = String(opts.outcome || player._gunplayPolishOutcome || '');
  const hit = outcome === 'hit' || outcome === 'head' || outcome === 'kill' || !!opts.hit;
  const killed = outcome === 'kill' || !!opts.killed;
  const headshot = outcome === 'head' || !!opts.headshot;
  const targetTransitionPulse = clamp01(player._targetTransitionPulse || 0);
  const hitConfirmSettlePulse = clamp01(player._hitConfirmSettlePulse || 0);
  const targetSwitchRecenterPulse = clamp01(player._targetSwitchRecenterPulse || 0);
  const targetTransferWindowPulse = clamp01(player._targetTransferWindowPulse || 0);
  const sustained = opts.sustainedFire || player._lastSustainedFireDiscipline || {};
  const sustainedPressure = clamp01(Math.max(sustained.pressureAfterControl || 0, player._sustainedFirePulse || 0, player._shotHeatPressure || 0));
  const cadenceMistime = clamp01(Math.max(shot.cadenceMistime || 0, player._cadenceMistimePulse || 0));
  const damageInterference = resolveDamageInterference(player, shot, opts);
  const traversalPressure = Number.isFinite(opts.traversalPressure) ? clamp01(opts.traversalPressure) : resolveTraversalPressure(player, opts);
  const storyAssist = opts.storyAssist || shot.storyAssist || buildStoryGunplayAssistSnapshot(player, { ...opts, shot });
  const surfaceInterference = clamp01(Math.max(player._surfaceImpactHardnessPulse || 0, (player._surfaceImpactReadPulse || 0) * 0.72, storyAssist.surfaceInterference || 0));
  const objectiveAssist = clamp01(storyAssist.objectiveAssist || 0);
  const hitSignal = clamp01(
    targetTransitionPulse * 0.46 +
    hitConfirmSettlePulse * 0.32 +
    targetSwitchRecenterPulse * 0.22 +
    (hit ? 0.16 : 0) +
    (killed ? 0.22 : 0) +
    (headshot ? 0.16 : 0)
  );
  const disciplineGate = clamp01(
    quality * 0.32 +
    control * 0.24 +
    ads * 0.12 +
    clamp01(player._followThroughPulse || 0) * 0.15 +
    clamp01(player._sightRecoveryPulse || 0) * 0.11 +
    (storyAssist.active ? storyAssist.assist * 0.10 : 0) -
    surfaceInterference * 0.18 +
    objectiveAssist * 0.08 -
    sustainedPressure * 0.32 -
    cadenceMistime * 0.24 -
    traversalPressure * 0.16 -
    damageInterference * 0.14
  );
  const transferWindow = clamp01(
    targetTransferWindowPulse * 0.36 +
    hitSignal * 0.22 +
    disciplineGate * 0.20 +
    quality * 0.12 +
    control * 0.10 +
    (storyAssist.active ? storyAssist.assist * 0.08 : 0) -
    sustainedPressure * 0.20 -
    cadenceMistime * 0.12 -
    traversalPressure * 0.08
  );
  const snapFollowThrough = clamp01(
    transferWindow * 0.34 +
    clamp01(shot.followThrough || 0) * 0.26 +
    clamp01(shot.recenterConfidence || 0) * 0.18 +
    hitConfirmSettlePulse * 0.12 +
    (killed ? 0.07 : 0) +
    (headshot ? 0.05 : 0)
  );
  const assist = clamp01(hitSignal * (0.34 + disciplineGate * 0.82) + transferWindow * 0.18);
  const settle = clamp01(assist * 0.54 + hitConfirmSettlePulse * 0.22 + snapFollowThrough * 0.10 + (storyAssist.active ? storyAssist.breathSettle * 0.10 : 0));
  const recenter = clamp01(assist * 0.40 + targetSwitchRecenterPulse * 0.38 + transferWindow * 0.16 + (killed ? 0.08 : 0) - sustainedPressure * 0.18);
  return {
    version: GUNPLAY_POLISH_VERSION,
    active: assist > 0.04,
    outcome,
    hit,
    killed,
    headshot,
    quality,
    control,
    ads,
    hitSignal,
    disciplineGate,
    transferWindow,
    snapFollowThrough,
    sustainedPressure,
    cadenceMistime,
    traversalPressure,
    damageInterference,
    surfaceInterference,
    objectiveAssist,
    assist,
    settle,
    recenter,
    recoilReturnMul: clamp(1 + settle * 0.24 + recenter * 0.16 + snapFollowThrough * 0.10 - sustainedPressure * 0.10, 0.82, 1.38),
    spreadMul: clamp(1 - recenter * 0.12 - settle * 0.06 - transferWindow * 0.035 + sustainedPressure * 0.08, 0.84, 1.16),
    viewKickMul: clamp(1 - settle * 0.14 - snapFollowThrough * 0.055 + sustainedPressure * 0.06, 0.86, 1.14),
    xhairTighten: clamp(recenter * 0.030 + settle * 0.016 + transferWindow * 0.012 - sustainedPressure * 0.014, 0, 0.068),
    label: !hit ? 'inactive' : (surfaceInterference > 0.46 ? 'surface-contested-transfer' : (objectiveAssist > 0.42 ? 'objective-transfer' : (sustainedPressure > 0.48 ? 'contested-transfer' : (killed ? 'kill-transfer' : (headshot ? 'head-transfer' : 'hit-confirm'))))),
    finite: true
  };
}

export function buildWeaponDisciplineSnapshot(player, opts = {}) {
  if (!player) return { version: GUNPLAY_POLISH_VERSION };
  const shot = opts.shot || player._gunplayShotQualitySnapshot || {};
  const quality = clamp01(Number.isFinite(opts.quality) ? opts.quality : (shot.quality || player._gunplayLastShotQuality || 0));
  const discipline = clamp01(Number.isFinite(opts.discipline) ? opts.discipline : (shot.discipline || player._gunplayLastShotDiscipline || 0));
  const control = clamp01(Number.isFinite(opts.control) ? opts.control : (shot.control || player._gunplayLastControl || 0));
  const cadence = clamp01(Number.isFinite(opts.cadenceScore) ? opts.cadenceScore : (shot.cadence || 0));
  const triggerReadiness = clamp01(
    clamp01(shot.triggerPrep || 0) * 0.34 +
    clamp01(shot.triggerWall || 0) * 0.22 +
    clamp01(shot.triggerBreak || 0) * 0.16 +
    clamp01(player._triggerPrepPulse || 0) * 0.16 +
    clamp01(player._triggerBreakPulse || 0) * 0.06 +
    discipline * 0.06
  );
  const triggerCommitment = clamp01(
    clamp01(shot.triggerCommit || 0) * 0.44 +
    triggerReadiness * 0.22 +
    clamp01(shot.followThrough || 0) * 0.16 +
    clamp01(player._triggerCommitPulse || 0) * 0.12 +
    discipline * 0.06
  );
  const recenterConfidence = clamp01(
    clamp01(shot.recenterConfidence || 0) * 0.44 +
    clamp01(shot.sightReturn || 0) * 0.20 +
    clamp01(player._recenterConfidencePulse || 0) * 0.16 +
    triggerCommitment * 0.12 +
    control * 0.08
  );
  const cadenceMistime = clamp01(Math.max(
    shot.cadenceMistime || 0,
    clamp01(player._cadenceMistimePulse || 0) * 0.86
  ));
  const traversalPressure = resolveTraversalPressure(player, opts);
  const damageInterference = resolveDamageInterference(player, shot, opts);
  const surfaceInterference = clamp01(Math.max(player._surfaceImpactHardnessPulse || 0, (player._surfaceImpactReadPulse || 0) * 0.72));
  const storyAssist = buildStoryGunplayAssistSnapshot(player, {
    ...opts,
    shot,
    traversalPressure,
    damageInterference,
    cadenceMistime
  });
  const pressure = clamp01(
    traversalPressure * 0.55 +
    clamp01(shot.pressure || 0) * 0.24 +
    clamp01(player._badShotPulse || 0) * 0.30 +
    clamp01(player._recenterCuePulse || 0) * 0.18 +
    clamp01(player._gunplayMissBloom || 0) * 0.25 +
    clamp01(player._shotHeatPressure || 0) * 0.15 +
    clamp01(player._damageShock || 0) * 0.12 +
    damageInterference * 0.18 +
    surfaceInterference * 0.16 +
    cadence * 0.18 +
    cadenceMistime * 0.20 +
    (1 - triggerReadiness) * 0.10 +
    (shot.poor ? 0.18 : 0) -
    storyAssist.cadenceForgiveness * 0.18 -
    storyAssist.breathSettle * 0.06
  );
  const stabilityReserve = clamp01(
    control * 0.42 +
    discipline * 0.25 +
    quality * 0.22 +
    clamp01(player._perfectShotPulse || 0) * 0.14 +
    clamp01(player._suppressionControlPulse || 0) * 0.08 +
    clamp01(player._followThroughPulse || 0) * 0.08 +
    clamp01(player._sightRecoveryPulse || 0) * 0.05 -
    cadenceMistime * 0.10 +
    storyAssist.stabilityAssist +
    triggerCommitment * 0.06 +
    recenterConfidence * 0.05
  );
  const followThroughReserve = clamp01(
    clamp01(shot.followThrough || 0) * 0.42 +
    clamp01(player._followThroughPulse || 0) * 0.26 +
    stabilityReserve * 0.24 +
    control * 0.10 -
    pressure * 0.12 -
    traversalPressure * 0.08 +
    storyAssist.followThroughAssist +
    triggerCommitment * 0.06 +
    recenterConfidence * 0.04
  );
  const sightRecoveryReserve = clamp01(
    clamp01(shot.sightReturn || 0) * 0.44 +
    clamp01(player._sightRecoveryPulse || 0) * 0.24 +
    followThroughReserve * 0.18 +
    stabilityReserve * 0.14 -
    cadenceMistime * 0.10 +
    storyAssist.breathSettle * 0.16 +
    recenterConfidence * 0.08
  );
  const readinessPenalty = clamp01(pressure * 0.44 + traversalPressure * 0.20 - stabilityReserve * 0.16 - storyAssist.breathSettle * 0.09);
  const triggerPressPenalty = clamp01((1 - triggerReadiness) * 0.18 + cadenceMistime * 0.22 + traversalPressure * 0.10 + damageInterference * 0.08 - followThroughReserve * 0.08 - storyAssist.cadenceForgiveness * 0.12);
  const weaponRaiseLag = clamp01(traversalPressure * 0.48 + pressure * 0.18 + triggerPressPenalty * 0.20 - stabilityReserve * 0.12 - sightRecoveryReserve * 0.06 - storyAssist.breathSettle * 0.11);
  return {
    version: GUNPLAY_POLISH_VERSION,
    traversalPressure,
    damageInterference,
    surfaceInterference,
    handlingPressure: pressure,
    stabilityReserve,
    triggerReadiness,
    triggerCommitment,
    recenterConfidence,
    followThroughReserve,
    sightRecoveryReserve,
    cadenceMistime,
    triggerPressPenalty,
    readinessPenalty,
    weaponRaiseLag,
    storyAssist,
    spreadMul: clamp((1 + traversalPressure * 0.20 + pressure * 0.15 + damageInterference * 0.10 + cadenceMistime * 0.07 + triggerPressPenalty * 0.06 - stabilityReserve * 0.07 - followThroughReserve * 0.04 - recenterConfidence * 0.035) * storyAssist.spreadMul, 0.72, 1.64),
    viewKickMul: clamp((1 + traversalPressure * 0.22 + pressure * 0.25 + damageInterference * 0.12 + triggerPressPenalty * 0.10 - stabilityReserve * 0.12 - followThroughReserve * 0.05 - triggerCommitment * 0.045) * storyAssist.viewKickMul, 0.76, 1.60),
    recoilReturnMul: clamp((1 + stabilityReserve * 0.30 + followThroughReserve * 0.18 + sightRecoveryReserve * 0.12 + recenterConfidence * 0.10 + triggerCommitment * 0.05 - traversalPressure * 0.30 - pressure * 0.12 - damageInterference * 0.10 - cadenceMistime * 0.12) * storyAssist.recoilReturnMul, 0.54, 1.56),
    recenterDelayMul: clamp(1 + pressure * 0.34 + cadenceMistime * 0.16 - stabilityReserve * 0.18 - sightRecoveryReserve * 0.08 - recenterConfidence * 0.08, 0.64, 1.62),
    controlled: stabilityReserve > 0.46 && followThroughReserve > 0.38 && pressure < 0.42,
    label: damageInterference > 0.58 ? 'wounded' : (surfaceInterference > 0.48 ? 'surface-startled' : (cadenceMistime > 0.54 ? 'rushed' : (storyAssist.active && pressure < 0.52 ? storyAssist.label : (pressure > 0.58 ? 'strained' : (stabilityReserve > 0.58 ? 'settled' : 'active')))))
  };
}

export function buildCleanGunplayFeelSnapshot(player, opts = {}) {
  if (!player) return { version: CLEAN_GUNPLAY_FEEL_VERSION, active: false, finite: true };
  const shot = opts.shot || player._gunplayShotQualitySnapshot || {};
  const aim = opts.aim || player._aimFeelSnapshot || {};
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player.adsVis || player.ads || shot.ads || 0));
  const weaponDiscipline = opts.weaponDiscipline || opts.disciplineSnap || (opts.discipline && typeof opts.discipline === 'object' ? opts.discipline : null) || buildWeaponDisciplineSnapshot(player, { ...opts, shot });
  const storyAssist = opts.storyAssist || shot.storyAssist || weaponDiscipline.storyAssist || player._lastStoryGunplayAssist || buildStoryGunplayAssistSnapshot(player, { ...opts, shot, ads });
  const sustainedFire = opts.sustainedFire || player._lastSustainedFireDiscipline || buildSustainedFireDisciplineSnapshot(player, { ...opts, shot, storyAssist, ads });
  const targetTransition = opts.targetTransition || player._gunplayTargetTransition || buildTargetTransitionAssistSnapshot(player, { ...opts, shot, storyAssist, sustainedFire, ads });
  const quality = clamp01(Number.isFinite(opts.quality) ? opts.quality : (shot.quality || player._gunplayLastShotQuality || weaponDiscipline.stabilityReserve || 0));
  const discipline = clamp01(Number.isFinite(opts.discipline) ? opts.discipline : (shot.discipline || player._gunplayLastShotDiscipline || weaponDiscipline.stabilityReserve || 0));
  const control = clamp01(Number.isFinite(opts.control) ? opts.control : (shot.control || player._gunplayLastControl || weaponDiscipline.stabilityReserve || 0));
  const readiness = clamp01(Number.isFinite(aim.readiness) ? aim.readiness : (shot.readiness || ads));
  const stability = clamp01(Number.isFinite(aim.stability) ? aim.stability : (shot.stability || readiness * 0.72));
  const reticleConfidence = clamp01(Number.isFinite(aim.reticleConfidence) ? aim.reticleConfidence : (shot.reticleConfidence || readiness));
  const lensFocus = clamp01(Number.isFinite(aim.lensFocus) ? aim.lensFocus : (shot.lensFocus || stability));
  const scopeShadow = clamp01(Number.isFinite(aim.scopeShadow) ? aim.scopeShadow : (shot.scopeShadow || 0));
  const scopeEyeBoxPressure = clamp01(Number.isFinite(aim.scopeEyeBoxPressure) ? aim.scopeEyeBoxPressure : (shot.scopeEyeBoxPressure || 0));
  const snapShotRisk = clamp01(Number.isFinite(aim.snapShotRisk) ? aim.snapShotRisk : (shot.snapShotRisk || 0));
  const triggerCommit = clamp01(
    (shot.triggerCommit || 0) * 0.52 +
    (weaponDiscipline.triggerCommitment || 0) * 0.24 +
    clamp01(player._triggerCommitPulse || 0) * 0.16 +
    clamp01(player._triggerBreakPulse || 0) * 0.08
  );
  const followThrough = clamp01(
    (shot.followThrough || 0) * 0.48 +
    (weaponDiscipline.followThroughReserve || 0) * 0.22 +
    clamp01(player._followThroughPulse || 0) * 0.20 +
    clamp01(player._sightRecoveryPulse || 0) * 0.10
  );
  const sightReturn = clamp01(
    (shot.sightReturn || 0) * 0.42 +
    (weaponDiscipline.sightRecoveryReserve || 0) * 0.26 +
    clamp01(player._sightRecoveryPulse || 0) * 0.20 +
    clamp01(player._recenterConfidencePulse || 0) * 0.12
  );
  const recenterConfidence = clamp01(
    (shot.recenterConfidence || 0) * 0.44 +
    (weaponDiscipline.recenterConfidence || 0) * 0.26 +
    clamp01(player._recenterConfidencePulse || 0) * 0.18 +
    sightReturn * 0.12
  );
  const hitConfirm = clamp01(Math.max(
    clamp01(player._impactConfirmMicroPulse || 0),
    clamp01(player._hitConfirmSettlePulse || 0),
    clamp01(targetTransition.settle || 0) * 0.92,
    clamp01(player._killFlowPulse || 0) * 0.72,
    clamp01(player._hitFlowPulse || 0) * 0.62
  ));
  const targetFlow = clamp01(
    clamp01(targetTransition.assist || 0) * 0.36 +
    clamp01(targetTransition.settle || 0) * 0.25 +
    clamp01(targetTransition.recenter || 0) * 0.20 +
    clamp01(targetTransition.transferWindow || 0) * 0.14 +
    clamp01(targetTransition.snapFollowThrough || 0) * 0.10 +
    clamp01(player._targetTransferWindowPulse || 0) * 0.06
  );
  const burstControl = clamp01(sustainedFire.burstControl || player._burstDisciplinePulse || 0);
  const sustainedPressure = clamp01(Math.max(sustainedFire.pressureAfterControl || 0, player._sustainedFirePulse || 0, player._shotHeatPressure || 0));
  const traversalPressure = clamp01(Math.max(
    shot.traversalPressure || 0,
    weaponDiscipline.traversalPressure || 0,
    sustainedFire.traversalPressure || 0,
    targetTransition.traversalPressure || 0,
    resolveTraversalPressure(player, opts)
  ));
  const handlingPressure = clamp01(Math.max(
    weaponDiscipline.handlingPressure || 0,
    shot.pressure || 0,
    player._weaponDisciplinePulse || 0
  ));
  const damageInterference = clamp01(Math.max(
    shot.damageInterference || 0,
    weaponDiscipline.damageInterference || 0,
    sustainedFire.damageInterference || 0,
    targetTransition.damageInterference || 0,
    resolveDamageInterference(player, shot, opts)
  ));
  const surfaceInterference = clamp01(Math.max(
    shot.surfaceInterference || 0,
    weaponDiscipline.surfaceInterference || 0,
    sustainedFire.surfaceInterference || 0,
    targetTransition.surfaceInterference || 0,
    storyAssist.surfaceInterference || 0,
    player._surfaceImpactHardnessPulse || 0
  ));
  const cadenceMistime = clamp01(Math.max(
    shot.cadenceMistime || 0,
    weaponDiscipline.cadenceMistime || 0,
    targetTransition.cadenceMistime || 0,
    player._cadenceMistimePulse || 0
  ));
  const badShot = clamp01(Math.max(
    player._badShotPulse || 0,
    shot.poor ? 0.72 : 0,
    quality < 0.34 ? 0.44 : 0,
    player._gunplayMissBloom || 0
  ));
  const storySettle = storyAssist.active ? clamp01(storyAssist.assist * 0.46 + storyAssist.breathSettle * 0.48 + storyAssist.followThroughAssist * 0.26) : 0;
  const pressure = clamp01(
    traversalPressure * 0.30 +
    handlingPressure * 0.22 +
    sustainedPressure * 0.24 +
    damageInterference * 0.24 +
    surfaceInterference * 0.16 +
    cadenceMistime * 0.24 +
    scopeShadow * 0.16 +
    scopeEyeBoxPressure * 0.10 +
    snapShotRisk * 0.13 +
    badShot * 0.30
  );
  const flow = clamp01(
    quality * 0.18 +
    discipline * 0.10 +
    control * 0.16 +
    readiness * 0.06 +
    stability * 0.08 +
    reticleConfidence * 0.07 +
    triggerCommit * 0.12 +
    followThrough * 0.13 +
    recenterConfidence * 0.11 +
    sightReturn * 0.06 +
    storySettle * 0.12 +
    targetFlow * 0.14 +
    burstControl * 0.07 +
    hitConfirm * 0.09 -
    pressure * 0.24
  );
  const cleanliness = clamp01(
    flow * 0.56 +
    control * 0.11 +
    reticleConfidence * 0.09 +
    lensFocus * 0.07 +
    followThrough * 0.08 +
    sightReturn * 0.06 +
    storySettle * 0.09 +
    targetFlow * 0.08 -
    pressure * 0.16 -
    badShot * 0.12
  );
  const noise = clamp01(
    pressure * 0.70 +
    sustainedPressure * 0.16 +
    handlingPressure * 0.11 +
    cadenceMistime * 0.14 +
    badShot * 0.19 -
    cleanliness * 0.26 -
    storySettle * 0.06 -
    burstControl * 0.05
  );
  const settle = clamp01(
    cleanliness * 0.42 +
    followThrough * 0.18 +
    recenterConfidence * 0.16 +
    sightReturn * 0.12 +
    targetFlow * 0.12 +
    storySettle * 0.10 -
    noise * 0.18
  );
  const confidence = clamp01(
    cleanliness * 0.54 +
    quality * 0.16 +
    targetFlow * 0.12 +
    hitConfirm * 0.10 +
    burstControl * 0.06 -
    noise * 0.14
  );
  const hudCalm = clamp01(cleanliness * 0.54 + settle * 0.25 + targetFlow * 0.13 + hitConfirm * 0.08 - noise * 0.22);
  const crosshairCalm = clamp01(cleanliness * 0.48 + recenterConfidence * 0.18 + targetFlow * 0.13 + sightReturn * 0.10 - noise * 0.18);
  const inputSettle = clamp01(settle * 0.50 + triggerCommit * 0.14 + followThrough * 0.12 + storySettle * 0.10 - cadenceMistime * 0.12 - sustainedPressure * 0.10);
  return {
    version: CLEAN_GUNPLAY_FEEL_VERSION,
    active: cleanliness > 0.07 || noise > 0.07 || targetFlow > 0.04 || hitConfirm > 0.05,
    ads,
    quality,
    discipline,
    control,
    readiness,
    stability,
    reticleConfidence,
    lensFocus,
    triggerCommit,
    followThrough,
    sightReturn,
    recenterConfidence,
    hitConfirm,
    targetFlow,
    burstControl,
    storySettle,
    pressure,
    sustainedPressure,
    traversalPressure,
    handlingPressure,
    damageInterference,
    surfaceInterference,
    cadenceMistime,
    badShot,
    scopeShadow,
    scopeEyeBoxPressure,
    snapShotRisk,
    flow,
    cleanliness,
    noise,
    settle,
    confidence,
    hudCalm,
    crosshairCalm,
    inputSettle,
    spreadMul: clamp(1 - cleanliness * 0.060 - targetFlow * 0.040 - storySettle * 0.030 - burstControl * 0.024 + noise * 0.070 + sustainedPressure * 0.025, 0.78, 1.16),
    viewKickMul: clamp(1 - cleanliness * 0.090 - followThrough * 0.036 - targetFlow * 0.034 + noise * 0.085 + cadenceMistime * 0.025, 0.78, 1.18),
    cameraNoiseMul: clamp(1 - cleanliness * 0.14 - targetFlow * 0.06 + noise * 0.20 + cadenceMistime * 0.04, 0.72, 1.22),
    recoilReturnMul: clamp(1 + settle * 0.24 + followThrough * 0.10 + targetFlow * 0.15 + storySettle * 0.12 - noise * 0.13, 0.72, 1.44),
    crosshairScaleMul: clamp(1 + noise * 0.085 - cleanliness * 0.090 - targetFlow * 0.045 - hudCalm * 0.020, 0.76, 1.12),
    xhairTighten: clamp(cleanliness * 0.044 + targetFlow * 0.032 + settle * 0.020 + hitConfirm * 0.014 - noise * 0.034, 0, 0.12),
    hudAlphaMul: clamp(0.82 + hudCalm * 0.24 + hitConfirm * 0.10 - noise * 0.10, 0.68, 1.18),
    heatAddMul: clamp(1 - burstControl * 0.075 - cleanliness * 0.045 + noise * 0.060 + sustainedPressure * 0.030, 0.82, 1.14),
    shotImpulseMul: clamp(1 - cleanliness * 0.048 - targetFlow * 0.030 + noise * 0.055, 0.86, 1.12),
    label: noise > 0.48 ? 'noisy' : (targetFlow > 0.28 ? 'transfer-clean' : (cleanliness > 0.58 ? 'clean' : (settle > 0.34 ? 'settled' : (flow > 0.24 ? 'flow' : 'neutral')))),
    finite: true
  };
}

export function buildShotQualitySnapshot(player, opts = {}) {
  if (!player) return { version: GUNPLAY_POLISH_VERSION };
  const weaponIdx = Number.isFinite(opts.weaponIdx) ? opts.weaponIdx | 0 : (player.weaponIdx | 0);
  const profile = profileFor(weaponIdx);
  const aim = opts.aim || player._aimFeelSnapshot || {};
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player.adsVis || player.ads || 0));
  const readiness = clamp01(Number.isFinite(aim.readiness) ? aim.readiness : ads);
  const stability = clamp01(Number.isFinite(aim.stability) ? aim.stability : readiness * 0.72);
  const motionPenalty = clamp01(Number.isFinite(aim.motionPenalty) ? aim.motionPenalty : 0);
  const reticleConfidence = clamp01(Number.isFinite(aim.reticleConfidence) ? aim.reticleConfidence : readiness);
  const scopeEyeBoxPressure = clamp01(Number.isFinite(aim.scopeEyeBoxPressure) ? aim.scopeEyeBoxPressure : 0);
  const scopeShadow = clamp01(Number.isFinite(aim.scopeShadow) ? aim.scopeShadow : 0);
  const lensFocus = clamp01(Number.isFinite(aim.lensFocus) ? aim.lensFocus : stability);
  const sightAcquisition = clamp01(Number.isFinite(aim.sightAcquisition) ? aim.sightAcquisition : (readiness * 0.55 + stability * 0.35 + reticleConfidence * 0.10));
  const snapShotRisk = clamp01(Number.isFinite(aim.snapShotRisk) ? aim.snapShotRisk : 0);
  const spread = Math.max(0, Number.isFinite(opts.spread) ? opts.spread : 0);
  const baseSpread = Math.max(0.0001, Number.isFinite(opts.baseSpread) ? opts.baseSpread : spread || 0.0001);
  const spreadRatio = clamp(spread / baseSpread, 0, 5);
  const spreadPenalty = clamp01(Math.max(0, spreadRatio - profile.spreadForgiveness) * 0.32);
  const moving = !!opts.moving || !!player.running;
  const running = !!opts.running || !!player.running;
  const sliding = !!opts.sliding || !!(player.sliding || player.slideAmt > 0.45);
  const crouching = !!opts.crouching || !!player.crouching;
  const precision = !!opts.precision;
  const settled = !!opts.settled || precision || !!aim.settled;
  const firstShot = opts.firstShot !== false;
  const shotIndex = Math.max(0, Number.isFinite(opts.shotIndex) ? opts.shotIndex | 0 : 0);
  const cadence = clamp01(opts.cadenceScore || 0);
  const suppression = clamp01(opts.suppression || player._suppressionLevel || 0);
  const damage = resolveDamageInterference(player, { damageInterference: aim.damageInterference || 0 }, opts);
  const surfaceInterference = clamp01(Math.max(player._surfaceImpactHardnessPulse || 0, (player._surfaceImpactReadPulse || 0) * 0.72));
  const lowAmmo = clamp01(opts.lowAmmo || 0);
  const traversalPressure = resolveTraversalPressure(player, opts);
  const earlyStoryAssist = buildStoryGunplayAssistSnapshot(player, {
    ...opts,
    shot: opts.shot || player._gunplayShotQualitySnapshot || {},
    aim,
    ads,
    readiness,
    stability,
    traversalPressure,
    damageInterference: damage,
    surfaceInterference
  });
  const posture = (crouching ? 0.07 : 0) + (settled ? 0.10 : 0) + (firstShot ? 0.045 : 0);
  const hipDiscipline = profile.hipFloor * (1 - ads);
  const motionCost = (moving ? 0.10 : 0) + (running ? 0.18 : 0) + (sliding ? 0.26 : 0) + motionPenalty * 0.26;
  const pressureCost = suppression * 0.08 + damage * 0.24 + surfaceInterference * 0.07;
  const traversalCost = traversalPressure * (ads > 0.55 ? 0.18 : 0.12);
  const sightPicturePenalty = scopeEyeBoxPressure * 0.13 + scopeShadow * 0.12 + snapShotRisk * (ads > 0.55 ? 0.12 : 0.06);
  const sightPictureBoost = reticleConfidence * 0.09 + lensFocus * 0.06 + sightAcquisition * 0.045;
  const raw =
    readiness * profile.adsWeight +
    stability * profile.stabilityWeight +
    cadence * profile.cadenceWeight +
    sightPictureBoost +
    posture +
    hipDiscipline -
    motionCost -
    pressureCost -
    traversalCost -
    spreadPenalty -
    sightPicturePenalty +
    (precision ? 0.34 : 0) +
    earlyStoryAssist.stabilityAssist * 0.32 +
    earlyStoryAssist.breathSettle * 0.055;
  const discipline = clamp01(raw);
  const quality = clamp01(discipline * 0.88 + (precision ? 0.12 : 0) + (spreadRatio <= 0.8 ? 0.06 : 0));
  const poor = quality < profile.poor || spreadRatio > 2.65 || (sliding && ads < 0.55) || (scopeShadow > 0.68 && ads > 0.45) || (snapShotRisk > 0.72 && ads > 0.55) || (damage > 0.74 && ads > 0.42);
  const perfect = precision || (quality >= profile.perfect && readiness > 0.72 && reticleConfidence > 0.64 && scopeShadow < 0.38);
  const control = clamp01(quality * 0.58 + stability * 0.16 + cadence * 0.10 + reticleConfidence * 0.12 + lensFocus * 0.08 + sightAcquisition * 0.06 - suppression * 0.10 - scopeShadow * 0.10 - snapShotRisk * 0.12);
  const storyAssist = buildStoryGunplayAssistSnapshot(player, {
    ...opts,
    shot: { quality, discipline, control, poor, perfect, damageInterference: damage },
    aim,
    ads,
    readiness,
    stability,
    traversalPressure,
    damageInterference: damage,
    surfaceInterference
  });
  const cadenceMistime = clamp01(
    (shotIndex > 0 ? (1 - cadence) * 0.42 : 0) +
    (running ? 0.12 : 0) +
    (sliding ? 0.18 : 0) +
    traversalPressure * 0.20 +
    damage * 0.16 +
    scopeShadow * 0.08 +
    snapShotRisk * 0.12 -
    (settled ? 0.10 : 0) -
    reticleConfidence * 0.06 -
    storyAssist.cadenceForgiveness
  );
  const triggerPrep = clamp01(
    readiness * 0.32 +
    stability * 0.24 +
    reticleConfidence * 0.17 +
    sightAcquisition * 0.12 +
    cadence * 0.10 +
    (firstShot ? 0.06 : 0) +
    (crouching ? 0.04 : 0) -
    motionCost * 0.30 -
    damage * 0.16 -
    traversalPressure * 0.12 -
    snapShotRisk * 0.12 -
    scopeShadow * 0.09 -
    cadenceMistime * 0.10 +
    storyAssist.breathSettle * 0.10
  );
  const triggerWall = clamp01(
    readiness * 0.38 +
    stability * 0.26 +
    lensFocus * 0.14 +
    reticleConfidence * 0.12 +
    (settled ? 0.06 : 0) -
    scopeEyeBoxPressure * 0.20 -
    motionPenalty * 0.18 -
    damage * 0.14 -
    traversalPressure * 0.10 -
    cadenceMistime * 0.08 +
    storyAssist.stabilityAssist * 0.10
  );
  const triggerBreak = clamp01(triggerPrep * 0.42 + triggerWall * 0.34 + control * 0.20 + (perfect ? 0.08 : 0) - (poor ? 0.10 : 0) - cadenceMistime * 0.10);
  const followThrough = clamp01(
    control * 0.42 +
    stability * 0.19 +
    reticleConfidence * 0.14 +
    lensFocus * 0.10 +
    cadence * 0.08 +
    (settled ? 0.06 : 0) +
    (perfect ? 0.06 : 0) -
    traversalPressure * 0.16 -
    damage * 0.12 -
    scopeShadow * 0.10 -
    snapShotRisk * 0.08 -
    (running ? 0.08 : 0) -
    cadenceMistime * 0.12 +
    storyAssist.followThroughAssist * 0.18 +
    storyAssist.breathSettle * 0.06
  );
  const sightReturn = clamp01(
    followThrough * 0.44 +
    control * 0.26 +
    sightPictureBoost * 0.52 +
    reticleConfidence * 0.10 -
    recenterPenalty(spreadRatio, scopeShadow, traversalPressure, damage, cadenceMistime) +
    storyAssist.followThroughAssist * 0.12
  );
  const triggerCommit = clamp01(
    triggerBreak * 0.38 +
    triggerPrep * 0.18 +
    triggerWall * 0.16 +
    followThrough * 0.16 +
    quality * 0.10 +
    (perfect ? 0.07 : 0) -
    (poor ? 0.10 : 0) -
    cadenceMistime * 0.12 -
    damage * 0.06
  );
  const recenterConfidence = clamp01(
    sightReturn * 0.38 +
    followThrough * 0.22 +
    reticleConfidence * 0.16 +
    lensFocus * 0.10 +
    storyAssist.followThroughAssist * 0.08 +
    storyAssist.breathSettle * 0.06 -
    traversalPressure * 0.10 -
    damage * 0.08 -
    scopeShadow * 0.08 -
    cadenceMistime * 0.08
  );
  const sightDisciplineIndex = clamp01(
    triggerCommit * 0.26 +
    recenterConfidence * 0.24 +
    followThrough * 0.20 +
    triggerPrep * 0.14 +
    control * 0.10 +
    storyAssist.stabilityAssist * 0.06 -
    snapShotRisk * 0.06
  );
  return {
    version: GUNPLAY_POLISH_VERSION,
    weaponIdx,
    quality,
    discipline,
    control,
    readiness,
    stability,
    ads,
    spread,
    baseSpread,
    spreadRatio,
    cadence,
    cadenceMistime,
    triggerPrep,
    triggerWall,
    triggerBreak,
    triggerCommit,
    followThrough,
    sightReturn,
    recenterConfidence,
    sightDisciplineIndex,
    pressure: clamp01(suppression + damage * 0.82),
    damageInterference: damage,
    surfaceInterference,
    traversalPressure,
    reticleConfidence,
    scopeEyeBoxPressure,
    scopeShadow,
    lensFocus,
    sightAcquisition,
    snapShotRisk,
    sightPicture: clamp01(reticleConfidence * 0.56 + lensFocus * 0.34 - scopeShadow * 0.24),
    lowAmmo,
    moving,
    running,
    sliding,
    crouching,
    precision,
    settled,
    firstShot,
    perfect,
    poor,
    qualityLabel: perfect ? 'perfect' : (poor ? 'rough' : (quality > 0.62 ? 'controlled' : 'neutral')),
    markerBoost: clamp(1 + quality * profile.marker + (perfect ? 0.08 : 0), 1, 1.32),
    storyAssist,
    recoilSettleBoost: clamp(quality * profile.recoil + reticleConfidence * 0.05 + recenterConfidence * 0.055 + triggerCommit * 0.025 + (perfect ? 0.10 : 0) - (poor ? 0.05 : 0) - scopeShadow * 0.04 - traversalPressure * 0.08 - damage * 0.04 + storyAssist.stabilityAssist * 0.11 + storyAssist.breathSettle * 0.035, 0, 0.46),
    xhairTighten: clamp(quality * 0.070 + recenterConfidence * 0.024 + triggerCommit * 0.012 + (perfect ? 0.050 : 0) - (poor ? 0.030 : 0) - traversalPressure * 0.025 - damage * 0.018 + storyAssist.breathSettle * 0.020, 0, 0.20)
  };
}

function recenterPenalty(spreadRatio, scopeShadow, traversalPressure, damage, cadenceMistime) {
  return clamp01(
    Math.max(0, spreadRatio - 1.0) * 0.08 +
    scopeShadow * 0.14 +
    traversalPressure * 0.12 +
    damage * 0.10 +
    cadenceMistime * 0.16
  );
}

export function tickGunplayPolish(player, dt, dampFn = expDamp) {
  if (!player) return null;
  for (const [key, lambda] of Object.entries(DECAY)) {
    player[key] = dampFn(Number.isFinite(player[key]) ? player[key] : 0, 0, lambda, dt);
  }
  return buildGunplayPolishSnapshot(player);
}

export function recordGunplayShot(player, opts = {}) {
  if (!player) return null;
  const snap = buildShotQualitySnapshot(player, opts);
  const now = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  player._gunplayLastShotQuality = snap.quality;
  player._gunplayLastShotDiscipline = snap.discipline;
  player._gunplayLastControl = snap.control;
  player._gunplayLastTriggerPrep = snap.triggerPrep;
  player._gunplayLastFollowThrough = snap.followThrough;
  player._gunplayLastTriggerCommit = snap.triggerCommit;
  player._gunplayLastRecenterConfidence = snap.recenterConfidence;
  player._gunplayLastStoryAssist = snap.storyAssist || null;
  player._lastTraversalShotPressure = snap.traversalPressure;
  player._gunplayLastShotAt = now;
  player._gunplayLastShotLabel = snap.qualityLabel;
  player._gunplayShotQualitySnapshot = snap;

  pulseMax(player, '_shotQualityPulse', clamp(0.22 + snap.quality * 0.58 + snap.cadence * 0.10, 0.12, 0.92));
  pulseMax(player, '_triggerPrepPulse', clamp(0.16 + snap.triggerPrep * 0.56 + snap.readiness * 0.10, 0.10, 0.92));
  pulseMax(player, '_triggerBreakPulse', clamp(0.20 + snap.triggerBreak * 0.46 + (snap.perfect ? 0.14 : 0) - (snap.poor ? 0.06 : 0), 0.12, 0.94));
  pulseMax(player, '_triggerCommitPulse', clamp(0.12 + snap.triggerCommit * 0.58 + snap.sightDisciplineIndex * 0.14, 0.08, 0.88));
  pulseMax(player, '_followThroughPulse', clamp(0.14 + snap.followThrough * 0.54 + snap.control * 0.12 + (snap.perfect ? 0.08 : 0), 0.10, 0.90));
  if (snap.recenterConfidence > 0.12) pulseMax(player, '_recenterConfidencePulse', clamp(0.10 + snap.recenterConfidence * 0.58 + snap.sightReturn * 0.08, 0.08, 0.82));
  if (snap.sightReturn > 0.18) pulseMax(player, '_sightRecoveryPulse', clamp(0.12 + snap.sightReturn * 0.52 + snap.control * 0.08, 0.10, 0.82));
  if (snap.cadenceMistime > 0.26) pulseMax(player, '_cadenceMistimePulse', clamp(0.16 + snap.cadenceMistime * 0.58 + (snap.poor ? 0.10 : 0), 0.14, 0.92));
  if (snap.perfect) pulseMax(player, '_perfectShotPulse', clamp(0.58 + snap.quality * 0.36, 0.54, 1.0));
  if (snap.poor) {
    pulseMax(player, '_badShotPulse', clamp(0.30 + (1 - snap.quality) * 0.44 + snap.pressure * 0.16 + snap.traversalPressure * 0.10, 0.24, 0.96));
    pulseMax(player, '_recenterCuePulse', clamp(0.20 + (snap.spreadRatio - 1) * 0.10 + snap.scopeShadow * 0.18 + snap.traversalPressure * 0.20, 0.16, 0.86));
  }
  if (snap.traversalPressure > 0.14) {
    pulseMax(player, '_traversalShotPulse', clamp(0.16 + snap.traversalPressure * 0.58, 0.14, 0.92));
    pulseMax(player, '_weaponDisciplinePulse', clamp(0.12 + snap.traversalPressure * 0.34 + (1 - snap.quality) * 0.16, 0.10, 0.78));
    pulseMax(player, '_recenterCuePulse', clamp(0.10 + snap.traversalPressure * 0.28 + (snap.poor ? 0.10 : 0), 0.10, 0.68));
    if (snap.control > 0.50) pulseMax(player, '_recoilStabilityPulse', clamp(0.12 + snap.control * 0.28 + snap.traversalPressure * 0.12, 0.10, 0.68));
  }
  if (snap.scopeShadow > 0.22) pulseMax(player, '_recenterCuePulse', clamp(0.16 + snap.scopeShadow * 0.36, 0.14, 0.72));
  if (snap.sightPicture > 0.66 && !snap.poor) pulseMax(player, '_nearMissDisciplinePulse', clamp(0.14 + snap.sightPicture * 0.24, 0.12, 0.58));
  if (snap.cadence > 0.34) pulseMax(player, '_tempoWindowPulse', clamp(0.22 + snap.cadence * 0.44, 0.18, 0.82));
  if (snap.pressure > 0.18 && snap.quality > 0.56) pulseMax(player, '_suppressionControlPulse', clamp(0.18 + snap.quality * 0.36, 0.14, 0.78));
  const storyAssist = snap.storyAssist || buildStoryGunplayAssistSnapshot(player, { ...opts, shot: snap });
  if (storyAssist.active) {
    player._lastStoryGunplayAssist = storyAssist;
    pulseMax(player, '_storyGunplayAssistPulse', clamp(0.14 + storyAssist.assist * 0.74 + storyAssist.breathSettle * 0.16, 0.10, 0.94));
    pulseMax(player, '_precisionChainPulse', clamp(0.10 + storyAssist.stabilityAssist * 1.15 + storyAssist.followThroughAssist * 0.78 + storyAssist.storyAim * 0.16, 0.08, 0.86));
    if (storyAssist.breathSettle > 0.08) pulseMax(player, '_storyBreathSettlePulse', clamp(0.10 + storyAssist.breathSettle * 0.90, 0.08, 0.82));
    player._recoilSettleBoostUntil = Math.max(player._recoilSettleBoostUntil || 0, now + 80 + storyAssist.recoilReturnMul * 90 + storyAssist.breathSettle * 360);
  }
  const sustainedFire = opts.sustainedFire || buildSustainedFireDisciplineSnapshot(player, { ...opts, shot: snap, storyAssist });
  player._lastSustainedFireDiscipline = sustainedFire;
  if (sustainedFire.active) {
    pulseMax(player, '_sustainedFirePulse', clamp(0.10 + sustainedFire.pressureAfterControl * 0.72 + sustainedFire.heat * 0.18, 0.08, 0.94));
    if (sustainedFire.burstControl > 0.32) pulseMax(player, '_burstDisciplinePulse', clamp(0.10 + sustainedFire.burstControl * 0.58 + (sustainedFire.label === 'disciplined' ? 0.08 : 0), 0.08, 0.78));
  }
  const cleanFeel = buildCleanGunplayFeelSnapshot(player, {
    ...opts,
    shot: snap,
    storyAssist,
    sustainedFire,
    weaponDiscipline: opts.weaponDiscipline || opts.disciplineSnap || null
  });
  snap.cleanFeel = cleanFeel;
  player._lastCleanGunplayFeel = cleanFeel;
  if (cleanFeel.active) {
    if (cleanFeel.flow > 0.10) pulseMax(player, '_cleanGunplayFlowPulse', clamp(0.08 + cleanFeel.flow * 0.62 + cleanFeel.hitConfirm * 0.08, 0.06, 0.90));
    if (cleanFeel.settle > 0.12) pulseMax(player, '_cleanGunplaySettlePulse', clamp(0.08 + cleanFeel.settle * 0.66 + cleanFeel.storySettle * 0.08, 0.06, 0.88));
    if (cleanFeel.targetFlow > 0.06) pulseMax(player, '_cleanTargetFlowPulse', clamp(0.06 + cleanFeel.targetFlow * 0.72 + cleanFeel.hitConfirm * 0.10, 0.05, 0.86));
    if (cleanFeel.noise > 0.18) pulseMax(player, '_cleanGunplayNoisePulse', clamp(0.08 + cleanFeel.noise * 0.72 + cleanFeel.badShot * 0.08, 0.07, 0.94));
    if (cleanFeel.cleanliness > 0.22 && cleanFeel.noise < 0.62) {
      player._gunplayConfidence = Math.max(player._gunplayConfidence || 0, clamp(0.12 + cleanFeel.cleanliness * 0.36 + cleanFeel.targetFlow * 0.14 + cleanFeel.hitConfirm * 0.08, 0.10, 0.74));
      player._gunplayRhythm = Math.max(player._gunplayRhythm || 0, clamp(0.06 + cleanFeel.inputSettle * 0.30 + cleanFeel.flow * 0.12 + cleanFeel.targetFlow * 0.08, 0.05, 0.52));
    }
    if (cleanFeel.noise > 0.42) {
      player._gunplayMissBloom = Math.max(player._gunplayMissBloom || 0, clamp((cleanFeel.noise - 0.30) * 0.22 + cleanFeel.badShot * 0.08, 0.04, 0.28));
      player._gunplayConfidence = (player._gunplayConfidence || 0) * clamp(1 - cleanFeel.noise * 0.18, 0.72, 0.96);
    }
    if (cleanFeel.settle > 0.20) {
      player._recoilSettleBoostUntil = Math.max(player._recoilSettleBoostUntil || 0, now + 70 + cleanFeel.settle * 390 + cleanFeel.targetFlow * 260);
    }
  }
  if (snap.recoilSettleBoost > 0.08) {
    player._recoilSettleBoostUntil = Math.max(player._recoilSettleBoostUntil || 0, now + 100 + snap.recoilSettleBoost * 620);
  }
  return snap;
}

export function recordGunplayOutcome(player, opts = {}) {
  if (!player) return null;
  const hit = !!opts.hit;
  const killed = !!opts.killed;
  const headshot = !!opts.headshot;
  const shot = opts.shotQuality || player._gunplayShotQualitySnapshot || buildShotQualitySnapshot(player, opts);
  const quality = clamp01(Number.isFinite(shot.quality) ? shot.quality : player._gunplayLastShotQuality || 0);
  const enemyResponse = opts.enemyResponse || opts.combatResponse || {};
  const attackBreak = hit ? clamp01(Math.max(enemyResponse.shotInterrupt || 0, enemyResponse.attackInterrupt || 0)) : 0;
  const weaponBreak = hit ? clamp01(Math.max(enemyResponse.weaponRecovery || 0, enemyResponse.weaponBreak || 0)) : 0;
  const coverBreak = hit ? clamp01(Math.max(enemyResponse.coverBreak || 0, enemyResponse.coverBias ? enemyResponse.coverBias * 0.58 : 0)) : 0;
  player._gunplayLastOutcomeQuality = quality;
  player._gunplayPolishOutcome = hit ? (killed ? 'kill' : (headshot ? 'head' : 'hit')) : 'miss';

  if (hit) {
    pulseMax(player, '_impactConfirmMicroPulse', clamp(0.30 + quality * 0.38 + (headshot ? 0.16 : 0) + (killed ? 0.15 : 0), 0.26, 1.0));
    if (quality > 0.62 || headshot) pulseMax(player, '_perfectShotPulse', clamp((headshot ? 0.42 : 0.26) + quality * 0.42, 0.24, 1.0));
    if (killed) pulseMax(player, '_tempoWindowPulse', clamp(0.30 + quality * 0.38, 0.24, 0.92));
    pulseMax(player, '_targetTransitionPulse', clamp(0.18 + quality * 0.28 + (headshot ? 0.14 : 0) + (killed ? 0.22 : 0), 0.16, 0.92));
    pulseMax(player, '_hitConfirmSettlePulse', clamp(0.16 + quality * 0.30 + (headshot ? 0.10 : 0), 0.14, 0.84));
    pulseMax(player, '_targetTransferWindowPulse', clamp(0.12 + quality * 0.24 + clamp01(shot.triggerCommit || 0) * 0.18 + clamp01(shot.recenterConfidence || 0) * 0.18 + (killed ? 0.12 : 0), 0.10, 0.82));
    if (killed || headshot) pulseMax(player, '_targetSwitchRecenterPulse', clamp(0.14 + quality * 0.22 + (killed ? 0.18 : 0), 0.12, 0.78));
    if (attackBreak > 0.08 || weaponBreak > 0.08 || coverBreak > 0.10) {
      const breakQuality = clamp01(quality * 0.38 + attackBreak * 0.34 + weaponBreak * 0.22 + coverBreak * 0.12);
      pulseMax(player, '_attackBreakPulse', clamp(0.12 + attackBreak * 0.58 + quality * 0.12 + (headshot ? 0.08 : 0), 0.10, 0.98));
      pulseMax(player, '_weaponBreakPulse', clamp(0.10 + weaponBreak * 0.62 + attackBreak * 0.12, 0.08, 0.94));
      pulseMax(player, '_coverBreakPulse', clamp(0.08 + coverBreak * 0.58 + attackBreak * 0.10, 0.06, 0.86));
      pulseMax(player, '_sightRecoveryPulse', clamp(0.10 + breakQuality * 0.42, 0.08, 0.74));
      player._lastEnemyAttackBreak = {
        version: 'enemy-attack-break-feedback.v1',
        attackBreak,
        weaponBreak,
        coverBreak,
        reactionLockMs: Math.round(clamp(enemyResponse.reactionLockMs || 0, 0, 900)),
        label: weaponBreak > attackBreak ? 'weapon-break' : (coverBreak > 0.48 ? 'cover-break' : 'attack-break')
      };
    }
    if (shot.storyAssist && shot.storyAssist.active) {
      pulseMax(player, '_precisionChainPulse', clamp(0.20 + quality * 0.24 + (headshot ? 0.18 : 0) + (killed ? 0.16 : 0), 0.16, 0.92));
      pulseMax(player, '_storyGunplayAssistPulse', clamp(0.18 + shot.storyAssist.assist * 0.50 + quality * 0.12, 0.14, 0.90));
    }
  } else if (quality > 0.58 && !shot.poor) {
    pulseMax(player, '_nearMissDisciplinePulse', clamp(0.22 + quality * 0.30, 0.18, 0.74));
  } else {
    pulseMax(player, '_badShotPulse', clamp(0.22 + (1 - quality) * 0.30, 0.16, 0.78));
  }
  player._gunplayTargetTransition = buildTargetTransitionAssistSnapshot(player, { ...opts, shot, hit, killed, headshot, outcome: player._gunplayPolishOutcome });
  const cleanFeel = buildCleanGunplayFeelSnapshot(player, {
    ...opts,
    shot,
    hit,
    killed,
    headshot,
    outcome: player._gunplayPolishOutcome,
    targetTransition: player._gunplayTargetTransition,
    sustainedFire: player._lastSustainedFireDiscipline || null,
    storyAssist: shot.storyAssist || player._lastStoryGunplayAssist || null
  });
  player._lastCleanGunplayFeel = cleanFeel;
  if (hit) {
    pulseMax(player, '_cleanGunplayFlowPulse', clamp(0.14 + cleanFeel.flow * 0.58 + (killed ? 0.10 : 0) + (headshot ? 0.07 : 0), 0.12, 0.96));
    pulseMax(player, '_cleanGunplaySettlePulse', clamp(0.12 + cleanFeel.settle * 0.64 + cleanFeel.hitConfirm * 0.10, 0.10, 0.92));
    pulseMax(player, '_cleanTargetFlowPulse', clamp(0.12 + cleanFeel.targetFlow * 0.72 + (killed ? 0.10 : 0), 0.10, 0.92));
    player._gunplayConfidence = Math.max(player._gunplayConfidence || 0, clamp(0.22 + quality * 0.26 + cleanFeel.cleanliness * 0.22 + cleanFeel.targetFlow * 0.14 + (headshot ? 0.08 : 0), 0.20, 0.90));
    player._gunplayRhythm = Math.max(player._gunplayRhythm || 0, clamp(0.14 + cleanFeel.inputSettle * 0.24 + cleanFeel.targetFlow * 0.22 + (killed ? 0.08 : 0), 0.12, 0.66));
    player._gunplayMissBloom = Math.max(0, (player._gunplayMissBloom || 0) - (0.10 + cleanFeel.cleanliness * 0.10 + cleanFeel.targetFlow * 0.05));
  } else if (cleanFeel.noise > 0.16) {
    pulseMax(player, '_cleanGunplayNoisePulse', clamp(0.12 + cleanFeel.noise * 0.60, 0.10, 0.84));
    player._gunplayMissBloom = Math.max(player._gunplayMissBloom || 0, clamp((cleanFeel.noise - 0.12) * 0.16, 0.03, 0.20));
  }
  player._gunplayPolishSnapshot = buildGunplayPolishSnapshot(player);
  return player._gunplayPolishSnapshot;
}

export function buildGunplayPolishSnapshot(player) {
  if (!player) return { version: GUNPLAY_POLISH_VERSION };
  const quality = clamp01(player._gunplayLastShotQuality || 0);
  const discipline = clamp01(player._gunplayLastShotDiscipline || 0);
  const control = clamp01(player._gunplayLastControl || 0);
  const shotPulse = clamp01(player._shotQualityPulse || 0);
  const perfectPulse = clamp01(player._perfectShotPulse || 0);
  const badShotPulse = clamp01(player._badShotPulse || 0);
  const recenterCuePulse = clamp01(player._recenterCuePulse || 0);
  const tempoWindowPulse = clamp01(player._tempoWindowPulse || 0);
  const nearMissDisciplinePulse = clamp01(player._nearMissDisciplinePulse || 0);
  const impactConfirmPulse = clamp01(player._impactConfirmMicroPulse || 0);
  const suppressionControlPulse = clamp01(player._suppressionControlPulse || 0);
  const traversalShotPulse = clamp01(player._traversalShotPulse || 0);
  const weaponDisciplinePulse = clamp01(player._weaponDisciplinePulse || 0);
  const recoilStabilityPulse = clamp01(player._recoilStabilityPulse || 0);
  const triggerPrepPulse = clamp01(player._triggerPrepPulse || 0);
  const triggerBreakPulse = clamp01(player._triggerBreakPulse || 0);
  const triggerCommitPulse = clamp01(player._triggerCommitPulse || 0);
  const followThroughPulse = clamp01(player._followThroughPulse || 0);
  const sightRecoveryPulse = clamp01(player._sightRecoveryPulse || 0);
  const recenterConfidencePulse = clamp01(player._recenterConfidencePulse || 0);
  const cadenceMistimePulse = clamp01(player._cadenceMistimePulse || 0);
  const storyGunplayAssistPulse = clamp01(player._storyGunplayAssistPulse || 0);
  const precisionChainPulse = clamp01(player._precisionChainPulse || 0);
  const storyBreathSettlePulse = clamp01(player._storyBreathSettlePulse || 0);
  const sustainedFirePulse = clamp01(player._sustainedFirePulse || 0);
  const burstDisciplinePulse = clamp01(player._burstDisciplinePulse || 0);
  const targetTransitionPulse = clamp01(player._targetTransitionPulse || 0);
  const hitConfirmSettlePulse = clamp01(player._hitConfirmSettlePulse || 0);
  const targetSwitchRecenterPulse = clamp01(player._targetSwitchRecenterPulse || 0);
  const targetTransferWindowPulse = clamp01(player._targetTransferWindowPulse || 0);
  const cleanGunplayFlowPulse = clamp01(player._cleanGunplayFlowPulse || 0);
  const cleanGunplaySettlePulse = clamp01(player._cleanGunplaySettlePulse || 0);
  const cleanGunplayNoisePulse = clamp01(player._cleanGunplayNoisePulse || 0);
  const cleanTargetFlowPulse = clamp01(player._cleanTargetFlowPulse || 0);
  const attackBreakPulse = clamp01(player._attackBreakPulse || 0);
  const weaponBreakPulse = clamp01(player._weaponBreakPulse || 0);
  const coverBreakPulse = clamp01(player._coverBreakPulse || 0);
  const shot = player._gunplayShotQualitySnapshot || {};
  const disciplineSnap = buildWeaponDisciplineSnapshot(player, { shot });
  const storyAssist = shot.storyAssist || disciplineSnap.storyAssist || buildStoryGunplayAssistSnapshot(player, { shot });
  const sustainedFire = player._lastSustainedFireDiscipline || buildSustainedFireDisciplineSnapshot(player, { shot, storyAssist });
  const targetTransition = buildTargetTransitionAssistSnapshot(player, { shot, storyAssist, sustainedFire });
  const cleanFeel = buildCleanGunplayFeelSnapshot(player, { shot, storyAssist, sustainedFire, targetTransition, weaponDiscipline: disciplineSnap });
  const traversalPressure = clamp01(disciplineSnap.traversalPressure || player._lastTraversalShotPressure || 0);
  const handlingPressure = clamp01(disciplineSnap.handlingPressure || 0);
  const hudAlpha = clamp(
    shotPulse * 0.28 +
    perfectPulse * 0.28 +
    impactConfirmPulse * 0.22 +
    nearMissDisciplinePulse * 0.16 +
    tempoWindowPulse * 0.14 +
    badShotPulse * 0.16 +
    traversalShotPulse * 0.10 +
    weaponDisciplinePulse * 0.06 +
    triggerBreakPulse * 0.12 +
    triggerCommitPulse * 0.08 +
    followThroughPulse * 0.08 +
    sightRecoveryPulse * 0.06 +
    recenterConfidencePulse * 0.06 +
    cadenceMistimePulse * 0.08 +
    storyGunplayAssistPulse * 0.16 +
    precisionChainPulse * 0.10 +
    sustainedFirePulse * 0.10 +
    burstDisciplinePulse * 0.06 +
    targetTransitionPulse * 0.10 +
    hitConfirmSettlePulse * 0.08 +
    targetSwitchRecenterPulse * 0.06 +
    targetTransferWindowPulse * 0.06 +
    cleanGunplayFlowPulse * 0.10 +
    cleanGunplaySettlePulse * 0.08 +
    cleanTargetFlowPulse * 0.08 +
    cleanGunplayNoisePulse * 0.05 +
    attackBreakPulse * 0.18 +
    weaponBreakPulse * 0.12 +
    coverBreakPulse * 0.08,
    0,
    0.86
  );
  const xhairScaleMul = clamp(
    (1 + badShotPulse * 0.070 + recenterCuePulse * 0.045 + traversalPressure * 0.030 + handlingPressure * 0.026 + cadenceMistimePulse * 0.045 + sustainedFirePulse * 0.040 + cleanGunplayNoisePulse * 0.035 - perfectPulse * 0.060 - impactConfirmPulse * 0.035 - tempoWindowPulse * 0.025 - triggerCommitPulse * 0.022 - followThroughPulse * 0.030 - recenterConfidencePulse * 0.026 - storyGunplayAssistPulse * 0.034 - precisionChainPulse * 0.020 - burstDisciplinePulse * 0.018 - cleanGunplayFlowPulse * 0.024 - cleanGunplaySettlePulse * 0.026 - cleanTargetFlowPulse * 0.024 - attackBreakPulse * 0.030 - weaponBreakPulse * 0.022 - targetTransferWindowPulse * 0.020 - targetTransition.xhairTighten * 0.80) * (cleanFeel.crosshairScaleMul || 1),
    0.78,
    1.18
  );
  const recoilReturnBoost = clamp(
    quality * 0.10 +
    control * 0.10 +
    perfectPulse * 0.14 +
    suppressionControlPulse * 0.06 -
    badShotPulse * 0.04 +
    recoilStabilityPulse * 0.08 -
    handlingPressure * 0.04 +
    triggerCommitPulse * 0.05 +
    followThroughPulse * 0.08 +
    sightRecoveryPulse * 0.06 -
    recenterConfidencePulse * 0.04 -
    cadenceMistimePulse * 0.06 +
    storyGunplayAssistPulse * 0.08 +
    precisionChainPulse * 0.05 +
    targetTransition.settle * 0.07 +
    targetTransition.recenter * 0.05 +
    cleanFeel.settle * 0.08 +
    cleanFeel.targetFlow * 0.06 +
    cleanGunplayFlowPulse * 0.05 +
    cleanGunplaySettlePulse * 0.05 -
    cleanGunplayNoisePulse * 0.04 +
    attackBreakPulse * 0.08 +
    weaponBreakPulse * 0.05 +
    burstDisciplinePulse * 0.05 -
    sustainedFirePulse * 0.04,
    0,
    0.42
  );
  const triggerPress = clamp01((shot.triggerPrep || 0) * 0.32 + (shot.triggerWall || 0) * 0.20 + (shot.triggerCommit || 0) * 0.16 + triggerPrepPulse * 0.20 + triggerBreakPulse * 0.10 + triggerCommitPulse * 0.10 + storyBreathSettlePulse * 0.08 - cadenceMistimePulse * 0.08);
  const followThroughHold = clamp01((shot.followThrough || 0) * 0.34 + (shot.recenterConfidence || 0) * 0.12 + followThroughPulse * 0.30 + sightRecoveryPulse * 0.10 + recenterConfidencePulse * 0.10 + control * 0.10 + precisionChainPulse * 0.10 + storyGunplayAssistPulse * 0.06 - handlingPressure * 0.08);
  const sightReturnBoost = clamp01((shot.sightReturn || 0) * 0.36 + (shot.recenterConfidence || 0) * 0.14 + sightRecoveryPulse * 0.26 + recenterConfidencePulse * 0.12 + followThroughHold * 0.18 + storyBreathSettlePulse * 0.08 - cadenceMistimePulse * 0.12);
  return {
    version: GUNPLAY_POLISH_VERSION,
    quality,
    discipline,
    control,
    qualityLabel: player._gunplayLastShotLabel || shot.qualityLabel || 'neutral',
    lastOutcome: player._gunplayPolishOutcome || '',
    shotPulse,
    perfectPulse,
    badShotPulse,
    recenterCuePulse,
    tempoWindowPulse,
    nearMissDisciplinePulse,
    impactConfirmPulse,
    suppressionControlPulse,
    traversalShotPulse,
    weaponDisciplinePulse,
    recoilStabilityPulse,
    triggerPrepPulse,
    triggerBreakPulse,
    triggerCommitPulse,
    followThroughPulse,
    sightRecoveryPulse,
    recenterConfidencePulse,
    cadenceMistimePulse,
    storyGunplayAssistPulse,
    precisionChainPulse,
    storyBreathSettlePulse,
	    sustainedFirePulse,
	    burstDisciplinePulse,
	    targetTransitionPulse,
	    hitConfirmSettlePulse,
	    targetSwitchRecenterPulse,
	    targetTransferWindowPulse,
	    cleanGunplayFlowPulse,
	    cleanGunplaySettlePulse,
	    cleanGunplayNoisePulse,
	    cleanTargetFlowPulse,
	    attackBreakPulse,
	    weaponBreakPulse,
	    coverBreakPulse,
	    enemyAttackBreak: player._lastEnemyAttackBreak || null,
	    storyAssist,
	    sustainedFire,
	    targetTransition,
	    cleanFeel,
	    cleanFlow: cleanFeel.flow,
	    cleanSettle: cleanFeel.settle,
	    cleanNoise: cleanFeel.noise,
	    cleanTargetFlow: cleanFeel.targetFlow,
	    cleanLabel: cleanFeel.label,
	    triggerPress,
    triggerBreak: clamp01(shot.triggerBreak || triggerBreakPulse * 0.70),
    triggerCommit: clamp01(shot.triggerCommit || player._gunplayLastTriggerCommit || triggerCommitPulse * 0.70),
    triggerWall: clamp01(shot.triggerWall || 0),
    triggerPrep: clamp01(shot.triggerPrep || player._gunplayLastTriggerPrep || 0),
    followThrough: clamp01(shot.followThrough || player._gunplayLastFollowThrough || 0),
    followThroughHold,
    sightReturn: clamp01(shot.sightReturn || 0),
    recenterConfidence: clamp01(shot.recenterConfidence || player._gunplayLastRecenterConfidence || recenterConfidencePulse * 0.70),
    sightDisciplineIndex: clamp01(shot.sightDisciplineIndex || 0),
    sightReturnBoost,
    cadenceMistime: clamp01(shot.cadenceMistime || cadenceMistimePulse * 0.82),
	    cadenceLabel: cadenceMistimePulse > 0.34 ? 'rushed' : (followThroughHold > 0.58 ? 'held' : 'neutral'),
	    hudAlpha: clamp(hudAlpha * (cleanFeel.hudAlphaMul || 1), 0, 0.92),
	    xhairScaleMul,
	    xhairTighten: clamp((shot.xhairTighten || 0) + perfectPulse * 0.030 + impactConfirmPulse * 0.016 + recoilStabilityPulse * 0.012 + triggerCommitPulse * 0.012 + followThroughPulse * 0.018 + sightRecoveryPulse * 0.012 + recenterConfidencePulse * 0.014 + storyGunplayAssistPulse * 0.020 + precisionChainPulse * 0.014 + burstDisciplinePulse * 0.012 + cleanGunplayFlowPulse * 0.012 + cleanGunplaySettlePulse * 0.016 + cleanTargetFlowPulse * 0.014 + cleanFeel.xhairTighten + attackBreakPulse * 0.024 + weaponBreakPulse * 0.016 + targetTransferWindowPulse * 0.010 + targetTransition.xhairTighten - traversalPressure * 0.016 - cadenceMistimePulse * 0.014 - sustainedFirePulse * 0.010 - cleanGunplayNoisePulse * 0.014, 0, 0.26),
	    recoilReturnBoost,
	    weaponDiscipline: disciplineSnap,
	    traversalPressure,
	    damageInterference: clamp01(shot.damageInterference || disciplineSnap.damageInterference || 0),
	    handlingPressure,
	    recoilReturnMul: (disciplineSnap.recoilReturnMul || 1) * (sustainedFire.returnMul || 1) * (targetTransition.recoilReturnMul || 1) * (cleanFeel.recoilReturnMul || 1),
	    spreadMul: (disciplineSnap.spreadMul || 1) * (sustainedFire.spreadMul || 1) * (targetTransition.spreadMul || 1) * (cleanFeel.spreadMul || 1),
	    viewKickMul: (disciplineSnap.viewKickMul || 1) * (sustainedFire.recoilMul || 1) * (targetTransition.viewKickMul || 1) * (cleanFeel.viewKickMul || 1),
	    cameraNoiseMul: cleanFeel.cameraNoiseMul || 1,
	    shotImpulseMul: cleanFeel.shotImpulseMul || 1,
	    heatAddMul: cleanFeel.heatAddMul || 1,
    readinessPenalty: disciplineSnap.readinessPenalty || 0,
    markerBoost: clamp(shot.markerBoost || 1, 1, 1.32),
    perfect: !!shot.perfect || perfectPulse > 0.18,
    poor: !!shot.poor || badShotPulse > 0.18,
    controlled: quality > 0.56 || control > 0.56,
    spreadRatio: clamp(shot.spreadRatio || 0, 0, 5),
    pressure: clamp01(shot.pressure || 0),
    reticleConfidence: clamp01(shot.reticleConfidence || 0),
    scopeEyeBoxPressure: clamp01(shot.scopeEyeBoxPressure || 0),
    scopeShadow: clamp01(shot.scopeShadow || 0),
    lensFocus: clamp01(shot.lensFocus || 0),
    sightAcquisition: clamp01(shot.sightAcquisition || 0),
    snapShotRisk: clamp01(shot.snapShotRisk || 0),
    sightPicture: clamp01(shot.sightPicture || 0)
  };
}
