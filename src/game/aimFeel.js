export const AIM_FEEL_VERSION = 'aim-feel.v4';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);
const smoothstep = (x, e0, e1) => {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
};

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * Math.max(0, dt || 0));
}

const AIM_PROFILES = Object.freeze({
  default: Object.freeze({
    readyIn: 9.0,
    readyOut: 13.0,
    stableIn: 7.2,
    stableOut: 9.0,
    adsLook: 0.76,
    opticLook: 0.64,
    scopeLook: 0.48,
    eyeWobble: 0.78,
    quickBloom: 0.28,
    motionBloom: 0.30,
    settleTighten: 0.12,
    recoilReturn: 0.18,
    breath: 0.86
  }),
  1: Object.freeze({
    readyIn: 13.5,
    readyOut: 15.0,
    stableIn: 11.5,
    stableOut: 11.0,
    adsLook: 0.68,
    opticLook: 0.59,
    scopeLook: 0.58,
    eyeWobble: 0.48,
    quickBloom: 0.18,
    motionBloom: 0.20,
    settleTighten: 0.16,
    recoilReturn: 0.30,
    breath: 0.62
  }),
  3: Object.freeze({
    readyIn: 6.8,
    readyOut: 10.0,
    stableIn: 5.8,
    stableOut: 8.2,
    adsLook: 0.74,
    opticLook: 0.68,
    scopeLook: 0.62,
    eyeWobble: 0.92,
    quickBloom: 0.22,
    motionBloom: 0.18,
    settleTighten: 0.05,
    recoilReturn: 0.10,
    breath: 0.90
  }),
  4: Object.freeze({
    readyIn: 10.8,
    readyOut: 14.0,
    stableIn: 8.5,
    stableOut: 10.5,
    adsLook: 0.72,
    opticLook: 0.63,
    scopeLook: 0.56,
    eyeWobble: 0.72,
    quickBloom: 0.26,
    motionBloom: 0.36,
    settleTighten: 0.10,
    recoilReturn: 0.22,
    breath: 0.78
  }),
  5: Object.freeze({
    readyIn: 8.0,
    readyOut: 11.0,
    stableIn: 7.4,
    stableOut: 9.0,
    adsLook: 0.60,
    opticLook: 0.50,
    scopeLook: 0.42,
    eyeWobble: 0.36,
    quickBloom: 0.34,
    motionBloom: 0.22,
    settleTighten: 0.18,
    recoilReturn: 0.14,
    breath: 0.46
  }),
  6: Object.freeze({
    readyIn: 12.0,
    readyOut: 14.0,
    stableIn: 10.5,
    stableOut: 10.5,
    adsLook: 0.69,
    opticLook: 0.61,
    scopeLook: 0.58,
    eyeWobble: 0.52,
    quickBloom: 0.20,
    motionBloom: 0.22,
    settleTighten: 0.14,
    recoilReturn: 0.28,
    breath: 0.66
  }),
  7: Object.freeze({
    readyIn: 5.8,
    readyOut: 8.0,
    stableIn: 5.4,
    stableOut: 7.5,
    adsLook: 0.54,
    opticLook: 0.44,
    scopeLook: 0.34,
    eyeWobble: 0.24,
    quickBloom: 0.44,
    motionBloom: 0.18,
    settleTighten: 0.22,
    recoilReturn: 0.08,
    breath: 0.34
  })
});

export function getAimFeelProfile(weaponIdx) {
  return AIM_PROFILES[weaponIdx | 0] || AIM_PROFILES.default;
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function buildRawAimState(player, opts = {}) {
  const profile = getAimFeelProfile(Number.isFinite(opts.weaponIdx) ? opts.weaponIdx : player && player.weaponIdx);
  const ads = clamp01(Number.isFinite(opts.ads) ? opts.ads : (player && (player.adsVis || player.ads)) || 0);
  const adsTarget = clamp01(Number.isFinite(opts.adsTarget) ? opts.adsTarget : (player && player.adsTarget) || ads);
  const scoped = clamp01(Number.isFinite(opts.scoped) ? opts.scoped : 0);
  const pistolOptic = !!opts.pistolOptic;
  const moving = !!opts.moving;
  const running = !!opts.running;
  const sliding = !!opts.sliding;
  const crouching = !!opts.crouching;
  const guard = clamp01(opts.guard || 0);
  const blocked = !!opts.reloading;
  const suppression = clamp01(opts.suppression || (player && player._suppressionLevel) || 0);
  const damageShock = clamp01(opts.damageShock || (player && player._damageShock) || 0);
  const damageTunnel = clamp01(opts.damageTunnel || (player && player._damageTunnelPulse) || 0);
  const damageWeaponDrop = clamp01(opts.damageWeaponDrop || (player && player._damageWeaponDropPulse) || 0);
  const damageMovementStagger = clamp01(opts.damageMovementStagger || (player && player._damageMovementStagger) || 0);
  const damageVision = clamp01(opts.damageVision || (player && player._damageVisionPulse) || 0);
  const damagePain = clamp01(opts.damagePain || (player && player._damagePainPulse) || 0);
  const damageBreathKnock = clamp01(opts.damageBreathKnock || (player && player._damageBreathKnockPulse) || 0);
  const damageWeaponCatch = clamp01(opts.damageWeaponCatch || (player && player._damageWeaponCatchPulse) || 0);
  const damageStepSave = clamp01(opts.damageStepSave || (player && player._damageStepSavePulse) || 0);
  const damage = clamp01(Math.max(
    damageShock,
    damageTunnel * 0.82,
    damageWeaponDrop * 0.58,
    damageMovementStagger * 0.66,
    damageVision * 0.74,
    damagePain * 0.54,
    damageBreathKnock * 0.50
  ));
  const shot = clamp01(opts.shotImpulse || (player && player._shotImpulse) || 0);
  const traversalRecenter = clamp01(opts.traversalRecenter || (player && player._traversalRecenterPulse) || 0);
  const traversalJostle = clamp01(Math.max(
    opts.traversalJostle || 0,
    (player && player._landingKneeAbsorbPulse || 0) * 0.68,
    (player && player._slideScrapePulse || 0) * 0.82,
    (player && player._slideLegTuckPulse || 0) * 0.44,
    (player && player._vaultLegClearancePulse || 0) * 0.38
  ));
  const storyTargetSwap = clamp01(opts.storyTargetSwap || (player && player._storyTargetSwapPulse) || 0);
  const storyThreatRead = clamp01(opts.storyThreatRead || (player && player._storyThreatReadPulse) || 0);
  const storyRecoveryBreather = clamp01(opts.storyRecoveryBreather || (player && player._storyRecoveryBreatherPulse) || 0);
  const targetTransferAssist = clamp01(Math.max(
    opts.targetTransferAssist || 0,
    player && player._targetTransitionPulse || 0,
    player && player._hitConfirmSettlePulse || 0,
    player && player._targetSwitchRecenterPulse || 0,
    storyTargetSwap * 0.92
  ));
  const storyAimSettle = clamp01(Math.max(
    opts.storyAimSettle || 0,
    player && player._storyAimChainPulse || 0,
    player && player._storyBeatChainPulse || 0,
    player && player._storyBeatObjectivePulse || 0,
    player && player._storyBeatReliefPulse || 0,
    storyTargetSwap * 0.68,
    storyRecoveryBreather * 0.74
  ));
  const storyAimBrace = clamp01(Math.max(
    opts.storyAimBrace || 0,
    player && player._storyBeatClutchPulse || 0,
    player && player._storyBeatSustainPulse || 0,
    storyThreatRead * 0.42
  ));
  const breathHeld = !!opts.breathHeld;
  const scopeEyeX = clamp(Math.abs(opts.scopeEyeX || (player && player.scopeEyeX) || 0) * 280, 0, 1);
  const scopeEyeY = clamp(Math.abs(opts.scopeEyeY || (player && player.scopeEyeY) || 0) * 300, 0, 1);
  const scopeEyeDrift = clamp01(scopeEyeX * 0.58 + scopeEyeY * 0.42);
  const recoil = clamp(Math.abs(opts.recoilPitch || 0) * 10 + Math.abs(opts.recoilYaw || 0) * 12, 0, 1.2);
  const adsEase = smoothstep(ads, pistolOptic ? 0.24 : 0.32, scoped > 0 ? 0.90 : 0.94);
  const motion = clamp01(
    (moving ? 0.13 : 0) +
    (running ? 0.20 : 0) +
    (sliding ? 0.22 : 0) +
    guard * 0.09 +
    suppression * 0.20 +
    damage * 0.22 +
    damageTunnel * 0.10 +
    damageMovementStagger * 0.12 +
    damageVision * 0.11 +
    damagePain * 0.09 +
    damageBreathKnock * 0.12 -
    damageWeaponCatch * 0.070 -
    damageStepSave * 0.040 +
    traversalJostle * 0.14 -
    traversalRecenter * 0.11 +
    shot * 0.10 +
    recoil * 0.13 +
    scopeEyeDrift * 0.10 +
    storyAimBrace * 0.05 -
    targetTransferAssist * 0.075 -
    storyAimSettle * 0.060 -
    storyRecoveryBreather * 0.035
  );
  const postureBoost = (crouching ? 0.12 : 0) + (breathHeld ? 0.18 : 0) + targetTransferAssist * 0.055 + storyAimSettle * 0.045 + traversalRecenter * 0.040 + damageWeaponCatch * 0.052 + damageStepSave * 0.034 + storyRecoveryBreather * 0.032 - storyAimBrace * 0.020 - damageBreathKnock * 0.034;
  const readyTarget = adsTarget > 0.5 && !blocked ? clamp01(adsEase * (1 - motion * 0.72) + postureBoost * adsEase) : 0;
  const stableTarget = adsTarget > 0.5 && !blocked ? clamp01(adsEase * (1 - motion) + postureBoost) : 0;
  const eyeBoxTarget = clamp01((scoped + (pistolOptic ? ads * 0.28 : 0)) * (
    motion * 0.42 +
    Math.abs(scopeEyeDrift) * 0.36 +
    shot * 0.18 -
    postureBoost * 0.18 -
    targetTransferAssist * 0.075 -
    storyAimSettle * 0.050 +
    damageVision * 0.080 +
    damagePain * 0.055 +
    damageBreathKnock * 0.060 +
    traversalJostle * 0.070 -
    traversalRecenter * 0.060 -
    damageWeaponCatch * 0.045
  ));
  const holdBreathTarget = clamp01((scoped > 0.55 || pistolOptic) && adsTarget > 0.5 && !running && !sliding && !blocked
    ? (breathHeld ? 1 : Math.max(0, stableTarget - 0.48) * 1.35)
    : 0);
  return { profile, ads, adsTarget, scoped, pistolOptic, motion, damage, damageTunnel, damageWeaponDrop, damageMovementStagger, damageVision, damagePain, damageBreathKnock, damageWeaponCatch, damageStepSave, traversalRecenter, traversalJostle, storyTargetSwap, storyThreatRead, storyRecoveryBreather, targetTransferAssist, storyAimSettle, storyAimBrace, readyTarget, stableTarget, postureBoost, eyeBoxTarget, holdBreathTarget, scopeEyeDrift };
}

export function tickAimFeel(player, dt, opts = {}, dampFn = expDamp) {
  if (!player) return null;
  const raw = buildRawAimState(player, opts);
  const prevAds = Number.isFinite(player._aimPrevAds) ? player._aimPrevAds : raw.ads;
  const prevTarget = Number.isFinite(player._aimPrevAdsTarget) ? player._aimPrevAdsTarget : raw.adsTarget;
  const dts = Math.max(0.001, dt || 0.001);
  player._aimAdsVelocity = clamp((raw.ads - prevAds) / dts, -8, 8);
  player._aimPrevAds = raw.ads;
  player._aimPrevAdsTarget = raw.adsTarget;
  if (raw.adsTarget > 0.5 && prevTarget <= 0.5) player._adsEntryPulse = Math.max(player._adsEntryPulse || 0, 1.0);
  if (raw.adsTarget <= 0.5 && prevTarget > 0.5) player._adsExitPulse = Math.max(player._adsExitPulse || 0, 0.78);

  player._aimReadiness = dampFn(
    Number.isFinite(player._aimReadiness) ? player._aimReadiness : raw.readyTarget,
    raw.readyTarget,
    raw.readyTarget > (player._aimReadiness || 0) ? raw.profile.readyIn : raw.profile.readyOut,
    dt
  );
  player._aimStability = dampFn(
    Number.isFinite(player._aimStability) ? player._aimStability : raw.stableTarget,
    raw.stableTarget,
    raw.stableTarget > (player._aimStability || 0) ? raw.profile.stableIn : raw.profile.stableOut,
    dt
  );
  player._aimMotionPenalty = dampFn(Number.isFinite(player._aimMotionPenalty) ? player._aimMotionPenalty : 0, raw.motion, 12, dt);
  player._aimPreFireBloom = dampFn(Number.isFinite(player._aimPreFireBloom) ? player._aimPreFireBloom : 0, 0, 9, dt);
  player._adsFireSettlePulse = dampFn(Number.isFinite(player._adsFireSettlePulse) ? player._adsFireSettlePulse : 0, 0, 10, dt);
  player._adsSettlePulse = dampFn(Number.isFinite(player._adsSettlePulse) ? player._adsSettlePulse : 0, 0, 7.5, dt);
  player._adsEntryPulse = dampFn(Number.isFinite(player._adsEntryPulse) ? player._adsEntryPulse : 0, 0, 9.5, dt);
  player._adsExitPulse = dampFn(Number.isFinite(player._adsExitPulse) ? player._adsExitPulse : 0, 0, 11.0, dt);
  player._scopeEyeBoxPressure = dampFn(Number.isFinite(player._scopeEyeBoxPressure) ? player._scopeEyeBoxPressure : raw.eyeBoxTarget, raw.eyeBoxTarget, raw.eyeBoxTarget > (player._scopeEyeBoxPressure || 0) ? 12.5 : 6.2, dt);
  player._scopeEyeBoxPulse = dampFn(Number.isFinite(player._scopeEyeBoxPulse) ? player._scopeEyeBoxPulse : 0, 0, 7.6, dt);
  player._aimHoldBreathBlend = dampFn(Number.isFinite(player._aimHoldBreathBlend) ? player._aimHoldBreathBlend : raw.holdBreathTarget, raw.holdBreathTarget, raw.holdBreathTarget > (player._aimHoldBreathBlend || 0) ? 5.8 : 8.5, dt);
  player._reticleFocusPulse = dampFn(Number.isFinite(player._reticleFocusPulse) ? player._reticleFocusPulse : 0, 0, 6.8, dt);
  if (raw.targetTransferAssist > 0.08 || raw.storyAimSettle > 0.08 || raw.traversalRecenter > 0.08 || raw.damageWeaponCatch > 0.08) {
    player._reticleFocusPulse = Math.max(player._reticleFocusPulse || 0, clamp(raw.targetTransferAssist * 0.22 + raw.storyAimSettle * 0.18 + raw.traversalRecenter * 0.14 + raw.damageWeaponCatch * 0.12, 0, 0.62));
    player._adsSettlePulse = Math.max(player._adsSettlePulse || 0, clamp(raw.targetTransferAssist * 0.18 + raw.storyAimSettle * 0.12 + raw.traversalRecenter * 0.10 + raw.damageWeaponCatch * 0.08, 0, 0.50));
  }

  const wasReady = Number.isFinite(player._aimWasReady) ? player._aimWasReady : 0;
  const ready = clamp01(player._aimReadiness || 0);
  if (ready > 0.82 && wasReady <= 0.82) {
    player._adsSettlePulse = Math.max(player._adsSettlePulse || 0, 0.72);
    player._reticleFocusPulse = Math.max(player._reticleFocusPulse || 0, 0.46);
  }
  player._aimWasReady = ready;

  player._aimFeelSnapshot = buildAimFeelSnapshot(player, opts);
  return player._aimFeelSnapshot;
}

export function recordAimShotFeedback(player, opts = {}) {
  if (!player) return null;
  const raw = buildRawAimState(player, opts);
  const snap = buildAimFeelSnapshot(player, opts);
  if (raw.ads > 0.35) {
    const quick = clamp01(1 - snap.readiness);
    const snapRisk = clamp01(snap.snapShotRisk || 0);
    player._aimPreFireBloom = Math.max(player._aimPreFireBloom || 0, quick * raw.profile.quickBloom + snapRisk * 0.10);
    player._adsFireSettlePulse = Math.max(player._adsFireSettlePulse || 0, clamp(0.20 + snap.readiness * 0.42, 0.16, 0.72));
    if (raw.scoped > 0.35 || raw.pistolOptic) {
      player._scopeEyeBoxPulse = Math.max(player._scopeEyeBoxPulse || 0, clamp(quick * 0.34 + raw.motion * 0.24 + raw.scopeEyeDrift * 0.26 + snapRisk * 0.16, 0.06, 0.72));
    }
    if (snap.readiness > 0.84) {
      player._recoilSettleBoostUntil = Math.max(player._recoilSettleBoostUntil || 0, nowMs() + 170 + snap.stability * 120);
      player._reticleFocusPulse = Math.max(player._reticleFocusPulse || 0, 0.34 + snap.stability * 0.18);
    }
  }
  player._aimFeelSnapshot = buildAimFeelSnapshot(player, opts);
  return player._aimFeelSnapshot;
}

export function buildAimFeelSnapshot(player, opts = {}) {
  if (!player) return {
    version: AIM_FEEL_VERSION,
    readiness: 0,
    stability: 0,
    sensitivityMul: 1,
    spreadMul: 1,
    recoilReturnBoost: 0,
    breathMul: 1,
    hudAlpha: 0,
    dotAlpha: 0.48,
    finite: true
  };
  const raw = buildRawAimState(player, opts);
  const readiness = clamp01(Number.isFinite(player._aimReadiness) ? player._aimReadiness : raw.readyTarget);
  const stability = clamp01(Number.isFinite(player._aimStability) ? player._aimStability : raw.stableTarget);
  const preFireBloom = clamp01(player._aimPreFireBloom || 0);
  const fireSettlePulse = clamp01(player._adsFireSettlePulse || 0);
  const settlePulse = clamp01(player._adsSettlePulse || 0);
  const entryPulse = clamp01(player._adsEntryPulse || 0);
  const exitPulse = clamp01(player._adsExitPulse || 0);
  const holdBreathBlend = clamp01(player._aimHoldBreathBlend || 0);
  const reticleFocusPulse = clamp01(player._reticleFocusPulse || 0);
  const adsVelocity = clamp(player._aimAdsVelocity || 0, -8, 8);
  const scopedWeight = Math.max(raw.scoped, raw.pistolOptic ? raw.ads : 0);
  const eyeBoxPressure = clamp01(Math.max(
    player._scopeEyeBoxPressure || 0,
    (player._scopeEyeBoxPulse || 0) * 0.76,
    preFireBloom * 0.34
  ) * (0.24 + scopedWeight * 0.76));
  const scopeShadow = clamp01(scopedWeight * (
    eyeBoxPressure * 0.74 +
    Math.abs(adsVelocity) * 0.035 +
    raw.motion * 0.18 +
    raw.damageTunnel * 0.16 +
    raw.damageWeaponDrop * 0.07 +
    raw.damageVision * 0.12 +
    raw.damageBreathKnock * 0.08 +
    raw.damagePain * 0.045 +
    raw.traversalJostle * 0.095 +
    entryPulse * 0.10 +
    exitPulse * 0.16 -
    stability * 0.18 -
    holdBreathBlend * 0.14 -
    raw.damageWeaponCatch * 0.060 -
    raw.traversalRecenter * 0.070 -
    raw.targetTransferAssist * 0.075 -
    raw.storyAimSettle * 0.060 -
    raw.storyRecoveryBreather * 0.050
  ));
  const reticleConfidence = clamp01(
    readiness * 0.52 +
    stability * 0.34 +
    holdBreathBlend * 0.16 +
    reticleFocusPulse * 0.12 -
    preFireBloom * 0.25 -
    eyeBoxPressure * 0.16 -
    raw.motion * 0.10 -
    raw.damage * 0.08 +
    raw.damageWeaponCatch * 0.080 +
    raw.damageStepSave * 0.050 +
    raw.traversalRecenter * 0.062 +
    raw.targetTransferAssist * 0.080 +
    raw.storyAimSettle * 0.060 -
    raw.damagePain * 0.048 -
    raw.damageBreathKnock * 0.060 -
    raw.traversalJostle * 0.050 -
    raw.storyAimBrace * 0.035
  );
  const lensFocus = clamp01(readiness * 0.50 + stability * 0.42 + settlePulse * 0.18 + reticleFocusPulse * 0.12 + raw.targetTransferAssist * 0.055 + raw.storyAimSettle * 0.050 + raw.damageWeaponCatch * 0.060 + raw.traversalRecenter * 0.052 + raw.storyRecoveryBreather * 0.042 - raw.damageVision * 0.054 - raw.damageBreathKnock * 0.046 - scopeShadow * 0.28);
  const transitionInstability = clamp01(entryPulse * 0.42 + exitPulse * 0.22 + Math.abs(adsVelocity) * 0.065 + preFireBloom * 0.18);
  const sightAcquisition = clamp01(
    readiness * 0.38 +
    stability * 0.28 +
    reticleConfidence * 0.22 +
    lensFocus * 0.18 +
    holdBreathBlend * 0.08 +
    raw.targetTransferAssist * 0.060 +
    raw.storyAimSettle * 0.050 +
    raw.damageWeaponCatch * 0.052 +
    raw.traversalRecenter * 0.048 -
    transitionInstability * 0.30 -
    eyeBoxPressure * 0.14 -
    raw.motion * 0.10 -
    raw.damageTunnel * 0.10 -
    raw.damageWeaponDrop * 0.06 -
    raw.damagePain * 0.045 -
    raw.damageBreathKnock * 0.045 -
    raw.traversalJostle * 0.044
  );
  const snapShotRisk = clamp01(
    (1 - readiness) * 0.28 +
    entryPulse * 0.34 +
    Math.abs(adsVelocity) * 0.055 +
    preFireBloom * 0.28 +
    scopeShadow * 0.22 +
    raw.motion * 0.14 +
    raw.damageTunnel * 0.16 +
    raw.damageWeaponDrop * 0.12 +
    raw.damageVision * 0.090 +
    raw.damagePain * 0.080 +
    raw.damageBreathKnock * 0.085 +
    raw.traversalJostle * 0.075 +
    stability * 0.10 -
    holdBreathBlend * 0.10 -
    raw.damageWeaponCatch * 0.060 -
    raw.traversalRecenter * 0.060 -
    raw.targetTransferAssist * 0.045 -
    raw.storyAimSettle * 0.035 +
    raw.storyAimBrace * 0.035
  );
  const eyeWobbleScale = clamp(
    raw.profile.eyeWobble * (1 - readiness * 0.52) + preFireBloom * 0.70 + raw.motion * 0.34 + eyeBoxPressure * 0.22 + snapShotRisk * 0.12 + raw.damageMovementStagger * 0.12 + raw.damageWeaponDrop * 0.08 + raw.damagePain * 0.09 + raw.damageBreathKnock * 0.10 + raw.traversalJostle * 0.11 + raw.storyAimBrace * 0.06 - holdBreathBlend * 0.18 - raw.damageWeaponCatch * 0.09 - raw.traversalRecenter * 0.08 - raw.targetTransferAssist * 0.08 - raw.storyAimSettle * 0.06,
    0.10,
    1.35
  );
  const settleTighten = readiness * stability * raw.profile.settleTighten;
  const reactiveSettle = clamp(raw.targetTransferAssist * 0.045 + raw.storyAimSettle * 0.035 + raw.damageWeaponCatch * 0.040 + raw.traversalRecenter * 0.035 - raw.storyAimBrace * 0.015, 0, 0.12);
  const spreadMul = clamp(1 + preFireBloom + raw.motion * raw.profile.motionBloom + eyeBoxPressure * 0.10 + raw.damageWeaponDrop * 0.10 + raw.damageTunnel * 0.08 + raw.damageVision * 0.075 + raw.damageBreathKnock * 0.070 + raw.traversalJostle * 0.065 - settleTighten - holdBreathBlend * 0.06 - reactiveSettle, 0.68, 1.72);
  const recoilReturnBoost = clamp(readiness * raw.profile.recoilReturn + stability * 0.08, 0, 0.38);
  const lookTarget = raw.scoped > 0.5
    ? raw.profile.scopeLook
    : (raw.pistolOptic ? raw.profile.opticLook : raw.profile.adsLook);
  const sensitivityMul = clamp(1 + (lookTarget - 1) * smoothstep(raw.ads, 0.18, 0.88) * (0.75 + scopedWeight * 0.25) - scopeShadow * 0.06, 0.24, 1.08);
  const breathMul = clamp(raw.profile.breath * (1 - stability * 0.36) * (1 - holdBreathBlend * 0.36) + raw.motion * 0.24 + eyeBoxPressure * 0.08 + raw.damageBreathKnock * 0.20 + raw.damagePain * 0.10 + raw.traversalJostle * 0.08 + raw.storyAimBrace * 0.05 - raw.damageWeaponCatch * 0.06 - raw.traversalRecenter * 0.055 - raw.targetTransferAssist * 0.05 - raw.storyAimSettle * 0.04 - raw.storyRecoveryBreather * 0.045, 0.12, 1.05);
  return {
    version: AIM_FEEL_VERSION,
    profileWeaponIdx: player.weaponIdx | 0,
    ads: raw.ads,
    adsTarget: raw.adsTarget,
    scoped: raw.scoped,
    pistolOptic: raw.pistolOptic,
    readiness,
    stability,
    shouldered: readiness > 0.78,
    settled: readiness > 0.86 && stability > 0.62,
    motionPenalty: clamp01(raw.motion),
    damageInterference: clamp01(raw.damage),
    damageTunnel: clamp01(raw.damageTunnel),
    damageWeaponDrop: clamp01(raw.damageWeaponDrop),
    damageMovementStagger: clamp01(raw.damageMovementStagger),
    damageVision: clamp01(raw.damageVision),
    damagePain: clamp01(raw.damagePain),
    damageBreathKnock: clamp01(raw.damageBreathKnock),
    damageWeaponCatch: clamp01(raw.damageWeaponCatch),
    damageStepSave: clamp01(raw.damageStepSave),
    traversalRecenter: clamp01(raw.traversalRecenter),
    traversalJostle: clamp01(raw.traversalJostle),
    storyTargetSwap: clamp01(raw.storyTargetSwap),
    storyThreatRead: clamp01(raw.storyThreatRead),
    storyRecoveryBreather: clamp01(raw.storyRecoveryBreather),
    targetTransferAssist: clamp01(raw.targetTransferAssist),
    storyAimSettle: clamp01(raw.storyAimSettle),
    storyAimBrace: clamp01(raw.storyAimBrace),
    preFireBloom,
    fireSettlePulse,
    settlePulse,
    entryPulse,
    exitPulse,
    holdBreathBlend,
    reticleFocusPulse,
    adsVelocity,
    scopeEyeBoxPressure: eyeBoxPressure,
    scopeShadow,
    reticleConfidence,
    lensFocus,
    sightAcquisition,
    snapShotRisk,
    transitionInstability,
    eyeWobbleScale,
    spreadMul,
    recoilReturnBoost,
    sensitivityMul,
    breathMul,
    hudAlpha: clamp(readiness * 0.44 + settlePulse * 0.20 + fireSettlePulse * 0.14 + reticleConfidence * 0.18 + lensFocus * 0.08, 0, 0.90),
    dotAlpha: clamp(0.48 + reticleConfidence * 0.42 + settlePulse * 0.14 + reticleFocusPulse * 0.08 - preFireBloom * 0.20 - scopeShadow * 0.18, 0.22, 1.0)
  };
}

export function getAimLookSensitivityMultiplier(player, settingsAdsSensitivity = 1, opts = {}) {
  const snap = buildAimFeelSnapshot(player, opts);
  const feelMul = Number.isFinite(snap.sensitivityMul) ? snap.sensitivityMul : 1;
  return clamp((Number.isFinite(settingsAdsSensitivity) ? settingsAdsSensitivity : 1) * feelMul, 0.20, 1.25);
}
