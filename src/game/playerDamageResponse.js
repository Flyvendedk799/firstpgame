export const PLAYER_DAMAGE_RESPONSE_VERSION = 'player-damage-response.v2';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-Math.max(0.001, lambda) * Math.max(0, dt || 0));
}

function pulseMax(target, key, value) {
  target[key] = Math.max(Number.isFinite(target[key]) ? target[key] : 0, value);
}

export function buildPlayerDamageResponseSnapshot(player = null, opts = {}) {
  const maxHp = Math.max(1, Number.isFinite(opts.maxHp) ? opts.maxHp : (player && player.maxHp) || 100);
  const hpBefore = clamp(opts.hpBefore != null ? opts.hpBefore : (player && player.hp) || maxHp, 0, maxHp * 2);
  const hpAfter = clamp(opts.hpAfter != null ? opts.hpAfter : (player && player.hp) || hpBefore, -maxHp, maxHp * 2);
  const amount = clamp(opts.amount != null ? opts.amount : Math.max(0, hpBefore - hpAfter), 0, 400);
  const side = Number.isFinite(opts.side) ? (opts.side >= 0 ? 1 : -1) : (player && Number.isFinite(player._damageShockSide) ? player._damageShockSide : 1);
  const hpRatioBefore = clamp01(hpBefore / maxHp);
  const hpRatioAfter = clamp01(Math.max(0, hpAfter) / maxHp);
  const severity = clamp01(amount / Math.max(24, maxHp * 0.42));
  const criticalRatio = clamp01(opts.criticalRatio == null ? 0.28 : opts.criticalRatio);
  const crossedCritical = hpRatioBefore > criticalRatio && hpRatioAfter <= criticalRatio && hpAfter > 0;
  const lethal = hpAfter <= 0;
  const lowHp = hpRatioAfter <= Math.max(criticalRatio, 0.30);
  const shock = clamp(0.18 + severity * 0.82 + (crossedCritical ? 0.28 : 0) + (lethal ? 0.36 : 0), 0.18, 1.45);
  const weaponDrop = clamp01(severity * 0.68 + (crossedCritical ? 0.32 : 0) + (lethal ? 0.22 : 0));
  const tunnel = clamp01(severity * 0.44 + (1 - hpRatioAfter) * 0.38 + (crossedCritical ? 0.28 : 0));
  const movementStagger = clamp01(severity * 0.52 + (lowHp ? 0.16 : 0) + (lethal ? 0.20 : 0));
  const recovery = clamp01((1 - severity) * 0.24 + (lowHp ? 0.34 : 0) + (crossedCritical ? 0.40 : 0));
  const lastStandRisk = clamp01((lethal ? 0.78 : 0) + (hpRatioAfter < 0.18 ? 0.36 : 0) + severity * 0.20);
  const adrenaline = clamp01((lowHp ? 0.34 : 0) + severity * 0.16 + recovery * 0.22);
  const painSpike = clamp01(shock * 0.44 + severity * 0.38 + (crossedCritical ? 0.22 : 0));
  const breathKnock = clamp01(severity * 0.46 + tunnel * 0.28 + (lowHp ? 0.14 : 0));
  const weaponCatch = clamp01(weaponDrop * 0.52 + recovery * 0.20 + adrenaline * 0.12);
  const stepSave = clamp01(movementStagger * 0.46 + recovery * 0.18 + (lethal ? 0 : lowHp ? 0.12 : 0));
  const visionPulse = clamp01(tunnel * 0.58 + painSpike * 0.18 + (crossedCritical ? 0.12 : 0));
  const out = {
    version: PLAYER_DAMAGE_RESPONSE_VERSION,
    amount,
    hpBefore,
    hpAfter,
    hpRatioBefore,
    hpRatioAfter,
    severity,
    side,
    crossedCritical,
    lethal,
    lowHp,
    shock,
    weaponDrop,
    tunnel,
    movementStagger,
    recovery,
    lastStandRisk,
    adrenaline,
    painSpike,
    breathKnock,
    weaponCatch,
    stepSave,
    visionPulse,
    cameraPitch: clamp(0.018 + severity * 0.052 + (crossedCritical ? 0.026 : 0), 0.012, 0.110),
    cameraRoll: clamp(side * (0.045 + severity * 0.105 + (crossedCritical ? 0.030 : 0)), -0.18, 0.18),
    bodyImpulse: clamp(0.12 + severity * 0.58, 0.10, 0.82),
    forwardImpulse: clamp(0.06 + severity * 0.30, 0.04, 0.42),
    rightImpulse: clamp(side * (0.035 + severity * 0.20), -0.26, 0.26),
    breathHoldMs: Math.round(clamp(120 + breathKnock * 520 + (lowHp ? 160 : 0), 90, 820)),
    weaponCatchMs: Math.round(clamp(160 + weaponCatch * 420 + severity * 120, 120, 760)),
    recoveryWindowMs: Math.round(clamp(520 + severity * 540 + (lowHp ? 380 : 0), 420, 1700)),
    label: lethal ? 'lethal' : crossedCritical ? 'critical-break' : lowHp ? 'wounded' : severity > 0.58 ? 'heavy-hit' : 'hit'
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function recordPlayerDamageResponse(player, opts = {}) {
  if (!player) return null;
  const snap = buildPlayerDamageResponseSnapshot(player, opts);
  pulseMax(player, '_damageShock', snap.shock);
  pulseMax(player, '_damageWeaponDropPulse', snap.weaponDrop);
  pulseMax(player, '_damageTunnelPulse', snap.tunnel);
  pulseMax(player, '_damageMovementStagger', snap.movementStagger);
  pulseMax(player, '_damageRecoveryPulse', snap.recovery);
  pulseMax(player, '_damageAdrenalinePulse', snap.adrenaline);
  pulseMax(player, '_damagePainPulse', snap.painSpike);
  pulseMax(player, '_damageBreathKnockPulse', snap.breathKnock);
  pulseMax(player, '_damageWeaponCatchPulse', snap.weaponCatch);
  pulseMax(player, '_damageStepSavePulse', snap.stepSave);
  pulseMax(player, '_damageVisionPulse', snap.visionPulse);
  if (snap.crossedCritical) pulseMax(player, '_criticalHitPulse', 1.0);
  player._damageShockSide = snap.side;
  player._lastDamageResponse = snap;
  return snap;
}

export function tickPlayerDamageResponse(player, dt, dampFn = expDamp) {
  if (!player) return null;
  player._damageWeaponDropPulse = dampFn(Number.isFinite(player._damageWeaponDropPulse) ? player._damageWeaponDropPulse : 0, 0, 6.8, dt);
  player._damageTunnelPulse = dampFn(Number.isFinite(player._damageTunnelPulse) ? player._damageTunnelPulse : 0, 0, 4.2, dt);
  player._damageMovementStagger = dampFn(Number.isFinite(player._damageMovementStagger) ? player._damageMovementStagger : 0, 0, 5.6, dt);
  player._damageRecoveryPulse = dampFn(Number.isFinite(player._damageRecoveryPulse) ? player._damageRecoveryPulse : 0, 0, 3.8, dt);
  player._damageAdrenalinePulse = dampFn(Number.isFinite(player._damageAdrenalinePulse) ? player._damageAdrenalinePulse : 0, 0, 4.6, dt);
  player._damagePainPulse = dampFn(Number.isFinite(player._damagePainPulse) ? player._damagePainPulse : 0, 0, 7.4, dt);
  player._damageBreathKnockPulse = dampFn(Number.isFinite(player._damageBreathKnockPulse) ? player._damageBreathKnockPulse : 0, 0, 4.8, dt);
  player._damageWeaponCatchPulse = dampFn(Number.isFinite(player._damageWeaponCatchPulse) ? player._damageWeaponCatchPulse : 0, 0, 5.8, dt);
  player._damageStepSavePulse = dampFn(Number.isFinite(player._damageStepSavePulse) ? player._damageStepSavePulse : 0, 0, 6.2, dt);
  player._damageVisionPulse = dampFn(Number.isFinite(player._damageVisionPulse) ? player._damageVisionPulse : 0, 0, 4.4, dt);
  return {
    version: PLAYER_DAMAGE_RESPONSE_VERSION,
    weaponDrop: clamp01(player._damageWeaponDropPulse || 0),
    tunnel: clamp01(player._damageTunnelPulse || 0),
    movementStagger: clamp01(player._damageMovementStagger || 0),
    recovery: clamp01(player._damageRecoveryPulse || 0),
    adrenaline: clamp01(player._damageAdrenalinePulse || 0),
    painSpike: clamp01(player._damagePainPulse || 0),
    breathKnock: clamp01(player._damageBreathKnockPulse || 0),
    weaponCatch: clamp01(player._damageWeaponCatchPulse || 0),
    stepSave: clamp01(player._damageStepSavePulse || 0),
    visionPulse: clamp01(player._damageVisionPulse || 0),
    last: player._lastDamageResponse || null,
    finite: true
  };
}
