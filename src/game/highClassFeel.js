export const HIGH_CLASS_FEEL_VERSION = 'high-class-feel.v1';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * Math.max(0, dt || 0));
}

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function shapeHighClassFeel(core) {
  const composure = clamp01(core.composure);
  const pressureRaw = clamp01(core.pressure);
  const pressure = pressureRaw < 0.20 ? pressureRaw * 0.24 : pressureRaw;
  const flow = clamp01(core.flow);
  const settle = clamp01(core.settle);
  const noiseRaw = clamp01(core.noise);
  const noise = noiseRaw < 0.18 ? noiseRaw * 0.32 : noiseRaw;
  const targetFlow = clamp01(core.targetFlow);
  const confirm = clamp01(core.confirm);
  const rhythm = clamp01(core.rhythm);
  const readability = clamp01(core.readability);
  const weight = clamp01(core.weight);
  const handlingGrade = clamp01(composure * 0.52 + settle * 0.20 + flow * 0.16 + rhythm * 0.12 - pressure * 0.16 - noise * 0.12);
  const polish = clamp01(readability * 0.30 + handlingGrade * 0.32 + targetFlow * 0.18 + confirm * 0.12 + flow * 0.08);
  const active = composure > 0.05 || pressure > 0.06 || flow > 0.05 || noise > 0.05 || confirm > 0.05;
  const calmBias = clamp01(composure * 0.46 + settle * 0.26 + targetFlow * 0.18 + rhythm * 0.10);
  const stressBias = clamp01(pressure * 0.56 + noise * 0.30 + weight * 0.16);
  return {
    version: HIGH_CLASS_FEEL_VERSION,
    active,
    composure,
    pressure,
    flow,
    settle,
    noise,
    targetFlow,
    confirm,
    rhythm,
    readability,
    weight,
    pressureRaw,
    noiseRaw,
    handlingGrade,
    polish,
    cameraKickMul: clamp(1 - calmBias * 0.105 - confirm * 0.026 + stressBias * 0.075, 0.82, 1.14),
    cameraNoiseMul: clamp(1 - calmBias * 0.155 - targetFlow * 0.040 + stressBias * 0.150, 0.74, 1.20),
    shotImpulseMul: clamp(1 - handlingGrade * 0.070 - confirm * 0.028 + pressure * 0.036 + noise * 0.052, 0.86, 1.10),
    heatAddMul: clamp(1 - handlingGrade * 0.055 - rhythm * 0.035 + pressure * 0.042 + noise * 0.042, 0.86, 1.12),
    recoilReturnMul: clamp(1 + calmBias * 0.215 + targetFlow * 0.085 + confirm * 0.045 - pressure * 0.115 - noise * 0.105, 0.78, 1.34),
    crosshairScaleMul: clamp(1 - calmBias * 0.100 - targetFlow * 0.045 - confirm * 0.026 + stressBias * 0.080, 0.76, 1.14),
    crosshairTighten: clamp(calmBias * 0.048 + targetFlow * 0.026 + confirm * 0.018 - stressBias * 0.020, 0, 0.13),
    crosshairDampLambda: clamp(17.5 + polish * 8.5 - pressure * 3.0 + noise * 2.4, 13, 27),
    hudAlphaMul: clamp(0.82 + readability * 0.20 + confirm * 0.095 - stressBias * 0.115, 0.68, 1.18),
    centerDotAlphaMul: clamp(0.88 + composure * 0.18 + settle * 0.12 - pressure * 0.10 - noise * 0.08, 0.62, 1.18),
    fovOffset: clamp(pressure * 1.25 + noise * 0.52 - composure * 0.62 - settle * 0.32 - targetFlow * 0.20 - confirm * 0.12, -1.15, 1.85),
    cameraSettlePitch: clamp((settle * 0.0046 + targetFlow * 0.0034 + confirm * 0.0028) - (pressure * 0.0022 + noise * 0.0026), -0.0045, 0.011),
    cameraSettleRoll: clamp((noise * 0.0048 + pressure * 0.0032) - (settle * 0.0036 + targetFlow * 0.0024 + confirm * 0.0018), -0.008, 0.009),
    viewmodelSettleZ: clamp(-(settle * 0.014 + targetFlow * 0.012 + confirm * 0.006) + noise * 0.010 + pressure * 0.006, -0.034, 0.026),
    viewmodelSettlePitch: clamp(-(settle * 0.030 + targetFlow * 0.026 + confirm * 0.012) + noise * 0.034 + pressure * 0.018, -0.074, 0.064),
    label: pressure > 0.58 ? 'pressured' : (noise > 0.44 ? 'rough' : (targetFlow > 0.30 ? 'transfer' : (composure > 0.62 ? 'composed' : (flow > 0.24 ? 'flow' : 'neutral')))),
    finite: true
  };
}

function resolveHighClassCore(player, opts = {}) {
  const aim = opts.aim || player._aimFeelSnapshot || {};
  const gunplay = opts.gunplay || player._gunplayPolishSnapshot || {};
  const clean = opts.cleanFeel || gunplay.cleanFeel || player._lastCleanGunplayFeel || {};
  const feedback = opts.feedback || player._combatFeedbackSnapshot || {};
  const incoming = opts.incoming || player._incomingFirePolishSnapshot || {};
  const reload = opts.reload || player._reloadFeelSnapshot || {};
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player.adsVis || player.ads || 0));
  const aimReady = clamp01(aim.readiness || 0);
  const aimStable = clamp01(aim.stability || 0);
  const reticle = clamp01(aim.reticleConfidence || 0);
  const lens = clamp01(aim.lensFocus || 0);
  const cleanFlow = clamp01(clean.flow || gunplay.cleanFlow || player._cleanGunplayFlowPulse || 0);
  const cleanSettle = clamp01(clean.settle || gunplay.cleanSettle || player._cleanGunplaySettlePulse || 0);
  const cleanNoise = clamp01(clean.noise || gunplay.cleanNoise || player._cleanGunplayNoisePulse || 0);
  const targetFlow = clamp01(clean.targetFlow || gunplay.cleanTargetFlow || player._cleanTargetFlowPulse || 0);
  const followThrough = clamp01(gunplay.followThroughHold || gunplay.followThrough || player._followThroughPulse || 0);
  const sightReturn = clamp01(gunplay.sightReturnBoost || gunplay.sightReturn || player._sightRecoveryPulse || 0);
  const triggerCommit = clamp01(gunplay.triggerCommit || player._triggerCommitPulse || 0);
  const targetTransition = gunplay.targetTransition || {};
  const hitConfirm = clamp01(Math.max(
    feedback.hitConfirmPulse || 0,
    feedback.killConfirmPulse || 0,
    gunplay.impactConfirmPulse || 0,
    gunplay.hitConfirmSettlePulse || 0,
    targetTransition.settle || 0
  ));
  const pressure = clamp01(Math.max(
    incoming.threat || 0,
    incoming.tunnelVision || 0,
    incoming.nearMissSeverity || 0,
    feedback.pressurePulse || 0,
    player._enemyShotPressure || 0,
    player._suppressionLevel || 0,
    player._damageShock || 0,
    cleanNoise * 0.82,
    gunplay.cadenceMistimePulse || 0,
    reload.surfaceInterference || 0
  ));
  const motion = clamp01(
    (player.running ? 0.24 : 0) +
    ((player.sliding || player.slideAmt > 0.35) ? 0.26 : 0) +
    (player._moveContactStall || 0) * 0.30 +
    (player._landingKneeAbsorbPulse || 0) * 0.12 +
    (player._slideScrapePulse || 0) * 0.16
  );
  const handling = clamp01(
    aimReady * 0.20 +
    aimStable * 0.18 +
    reticle * 0.14 +
    lens * 0.09 +
    cleanFlow * 0.13 +
    cleanSettle * 0.11 +
    followThrough * 0.07 +
    sightReturn * 0.06 +
    triggerCommit * 0.05 +
    targetFlow * 0.07 -
    pressure * 0.22 -
    motion * 0.14 -
    cleanNoise * 0.18
  );
  const flow = clamp01(
    cleanFlow * 0.34 +
    targetFlow * 0.24 +
    clamp01(player._gunplayRhythm || 0) * 0.14 +
    clamp01(player._combatFlow || 0) * 0.12 +
    hitConfirm * 0.10 +
    clamp01(gunplay.storyGunplayAssistPulse || 0) * 0.06
  );
  const settle = clamp01(
    cleanSettle * 0.30 +
    followThrough * 0.18 +
    sightReturn * 0.16 +
    triggerCommit * 0.12 +
    aimStable * 0.10 +
    reticle * 0.08 +
    targetFlow * 0.08 -
    cleanNoise * 0.13 -
    pressure * 0.10
  );
  const composure = clamp01(
    handling * 0.42 +
    settle * 0.24 +
    flow * 0.14 +
    feedback.confidence * 0.06 +
    ads * 0.05 +
    clamp01(player._counterStrafePulse || 0) * 0.05 +
    clamp01(player._storyRecoveryBreatherPulse || 0) * 0.04
  );
  const readability = clamp01(
    reticle * 0.25 +
    lens * 0.20 +
    aimReady * 0.14 +
    clamp01(feedback.ringOpacity || 0) * 0.08 +
    hitConfirm * 0.12 +
    targetFlow * 0.10 +
    settle * 0.08 -
    pressure * 0.12 -
    cleanNoise * 0.10
  );
  const rhythm = clamp01(
    clamp01(player._gunplayRhythm || 0) * 0.32 +
    clamp01(gunplay.tempoWindowPulse || 0) * 0.18 +
    clamp01(gunplay.burstDisciplinePulse || 0) * 0.14 +
    clamp01(clean.inputSettle || 0) * 0.18 +
    followThrough * 0.10 +
    sightReturn * 0.08 -
    clamp01(gunplay.cadenceMistimePulse || 0) * 0.18
  );
  const shotWeight = clamp01(
    finite(player._shotImpulse) * 0.30 +
    finite(player._shotHeatPressure) * 0.22 +
    finite(gunplay.sustainedFirePulse) * 0.16 +
    motion * 0.16 +
    pressure * 0.16
  );
  return {
    composure,
    pressure,
    flow,
    settle,
    noise: clamp01(cleanNoise * 0.62 + pressure * 0.20 + motion * 0.12 + clamp01(gunplay.badShotPulse || 0) * 0.18),
    targetFlow,
    confirm: hitConfirm,
    rhythm,
    readability,
    weight: shotWeight
  };
}

export function buildHighClassFeelSnapshot(player, opts = {}) {
  if (!player) {
    return shapeHighClassFeel({
      composure: 0,
      pressure: 0,
      flow: 0,
      settle: 0,
      noise: 0,
      targetFlow: 0,
      confirm: 0,
      rhythm: 0,
      readability: 0,
      weight: 0
    });
  }
  return shapeHighClassFeel(resolveHighClassCore(player, opts));
}

export function tickHighClassFeel(player, dt, opts = {}, dampFn = expDamp) {
  if (!player) return buildHighClassFeelSnapshot(null);
  const raw = buildHighClassFeelSnapshot(player, opts);
  const dts = Math.max(0, dt || 0);
  const dampMetric = (key, target, upLambda, downLambda) => {
    const prev = Number.isFinite(player[key]) ? player[key] : target;
    const lambda = target > prev ? upLambda : downLambda;
    const next = dampFn(prev, target, lambda, dts);
    player[key] = next;
    return next;
  };
  const smoothCore = {
    composure: dampMetric('_highClassComposure', raw.composure, 8.8, 5.8),
    pressure: dampMetric('_highClassPressure', raw.pressure, 13.5, 4.2),
    flow: dampMetric('_highClassFlow', raw.flow, 9.5, 6.4),
    settle: dampMetric('_highClassSettle', raw.settle, 8.4, 5.2),
    noise: dampMetric('_highClassNoise', raw.noise, 13.0, 7.0),
    targetFlow: dampMetric('_highClassTargetFlow', raw.targetFlow, 10.0, 6.2),
    confirm: dampMetric('_highClassConfirm', raw.confirm, 16.0, 8.5),
    rhythm: dampMetric('_highClassRhythm', raw.rhythm, 8.0, 5.6),
    readability: dampMetric('_highClassReadability', raw.readability, 9.0, 6.0),
    weight: dampMetric('_highClassWeight', raw.weight, 11.0, 6.8)
  };
  const snap = shapeHighClassFeel(smoothCore);
  snap.raw = {
    composure: raw.composure,
    pressure: raw.pressure,
    flow: raw.flow,
    settle: raw.settle,
    noise: raw.noise,
    targetFlow: raw.targetFlow,
    confirm: raw.confirm,
    rhythm: raw.rhythm,
    readability: raw.readability,
    weight: raw.weight,
    label: raw.label
  };
  player._highClassFeelSnapshot = snap;
  return snap;
}
