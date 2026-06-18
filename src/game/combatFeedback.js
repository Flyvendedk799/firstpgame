export const COMBAT_FEEDBACK_VERSION = 'combat-feedback.v2';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * Math.max(0, dt || 0));
}

const DECAY = Object.freeze({
  _gunplaySpreadVisual: 9.0,
  _gunplayConfidence: 4.6,
  _gunplayMissBloom: 3.8,
  _gunplayRhythm: 5.2,
  _enemyShotPressure: 8.5,
  _triggerBufferPulse: 13.0,
  _triggerReadyPulse: 15.0,
  _emptyClickPulse: 16.0,
  _dryFirePulse: 18.0,
  _lastRoundPulse: 8.8,
  _lowAmmoPulse: 5.2,
  _reloadReadyPulse: 8.5,
  _reloadBlockedPulse: 12.0,
  _reloadFlowPulse: 7.2,
  _reloadMagPulse: 10.5,
  _surfaceImpactReadPulse: 8.4,
  _surfaceImpactHardnessPulse: 9.0,
  _objectivePromptPulse: 7.4,
  _objectiveStabilizePulse: 6.2,
  _objectivePayoffAnticipationPulse: 5.8,
  _objectiveFailPressurePulse: 6.8,
  _weaponSwitchPulse: 8.8,
  _weaponDrawPulse: 7.4,
  _vaultCuePulse: 10.5,
  _pickupPromptPulse: 8.0,
  _pickupCollectPulse: 7.6,
  _criticalHitPulse: 4.8,
  _shotFiredPulse: 18.0,
  _hitConfirmPulse: 9.5,
  _killConfirmPulse: 5.8,
  _precisionFlowPulse: 4.4,
  _ammoBeatPulse: 7.5,
  _combatStreakPulse: 4.2,
  _suppressionEdgePulse: 7.2
});

function pulseMax(player, key, value) {
  player[key] = Math.max(Number.isFinite(player[key]) ? player[key] : 0, value);
}

export function tickPlayerCombatFeedback(player, dt, dampFn = expDamp) {
  if (!player) return null;
  for (const [key, lambda] of Object.entries(DECAY)) {
    player[key] = dampFn(Number.isFinite(player[key]) ? player[key] : 0, 0, lambda, dt);
  }
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (player._combatStreak && now > (player._combatStreakUntil || 0)) player._combatStreak = 0;
  return buildCombatFeedbackSnapshot(player);
}

export function recordShotFiredFeedback(player, opts = {}) {
  if (!player) return null;
  const now = Number.isFinite(opts.nowMs)
    ? opts.nowMs
    : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  const shotFeel = clamp(opts.shotFeel, 0, 2.5);
  const shotIndex = Math.max(0, Number.isFinite(opts.shotIndex) ? opts.shotIndex : 0);
  const ads = clamp01(opts.ads);
  const mag = Math.max(1, Number.isFinite(opts.mag) ? opts.mag : 1);
  const ammo = Math.max(0, Number.isFinite(opts.ammo) ? opts.ammo : mag);
  const ammoLow = ammo <= Math.max(2, Math.ceil(mag * 0.22));

  pulseMax(player, '_shotFiredPulse', clamp(.42 + shotFeel * .16 + Math.min(shotIndex, 4) * .035, .35, .96));
  pulseMax(player, '_ammoBeatPulse', ammoLow ? clamp(.36 + (1 - ammo / mag) * .50, .24, .96) : .08);
  if (ammoLow) pulseMax(player, '_lowAmmoPulse', clamp(.30 + (1 - ammo / mag) * .45, .22, .92));

  const last = Number.isFinite(player._lastFeedbackShotAt) ? player._lastFeedbackShotAt : 0;
  const cadenceMs = now - last;
  const idealMs = Math.max(100, (Number.isFinite(opts.fireRate) ? opts.fireRate : .25) * 1000 * 1.55);
  const cadenceScore = cadenceMs > 45
    ? clamp01(1 - Math.abs(cadenceMs - idealMs) / Math.max(idealMs * 1.35, 1))
    : 0;
  player._shotCadenceScore = Math.max(player._shotCadenceScore || 0, cadenceScore * (.45 + ads * .35));
  player._lastFeedbackShotAt = now;
  return buildCombatFeedbackSnapshot(player);
}

export function recordShotOutcomeFeedback(player, opts = {}) {
  if (!player) return null;
  const hit = !!opts.hit;
  const killed = !!opts.killed;
  const headshot = !!opts.headshot;
  const damage = clamp(opts.damage, 0, 400);
  const quality = clamp(damage / 120, .12, 1.75);
  const now = Number.isFinite(opts.nowMs)
    ? opts.nowMs
    : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());

  if (hit) {
    pulseMax(player, '_hitConfirmPulse', clamp(.42 + quality * .20 + (headshot ? .18 : 0), .38, 1.05));
    pulseMax(player, '_precisionFlowPulse', clamp((headshot ? .56 : .24) + quality * .12 + (killed ? .16 : 0), .18, 1.0));
    if (killed) pulseMax(player, '_killConfirmPulse', clamp(.58 + quality * .18 + (headshot ? .15 : 0), .48, 1.15));
    const chainAlive = now < (player._combatStreakUntil || 0);
    player._combatStreak = chainAlive ? Math.min(9, (player._combatStreak || 0) + (killed ? 2 : 1)) : (killed ? 2 : 1);
    player._combatStreakUntil = now + (killed ? 1800 : 1150);
    pulseMax(player, '_combatStreakPulse', clamp(.18 + (player._combatStreak || 0) * .075 + (killed ? .22 : 0), .16, 1.0));
  } else {
    player._shotCadenceScore = (player._shotCadenceScore || 0) * .45;
  }
  return buildCombatFeedbackSnapshot(player);
}

export function buildCombatFeedbackSnapshot(player) {
  if (!player) return { version: COMBAT_FEEDBACK_VERSION };
  const shot = clamp01(player._shotFiredPulse || 0);
  const hit = clamp01(player._hitConfirmPulse || 0);
  const kill = clamp01(player._killConfirmPulse || 0);
  const precision = clamp01(player._precisionFlowPulse || 0);
  const streakPulse = clamp01(player._combatStreakPulse || 0);
  const attackBreak = clamp01(player._attackBreakPulse || 0);
  const weaponBreak = clamp01(player._weaponBreakPulse || 0);
  const coverBreak = clamp01(player._coverBreakPulse || 0);
  const ammo = clamp01(Math.max(player._ammoBeatPulse || 0, player._lowAmmoPulse || 0));
  const weaponSwitch = clamp01(Math.max(player._weaponSwitchPulse || 0, player._weaponDrawPulse || 0));
  const pickupCollect = clamp01(player._pickupCollectPulse || 0);
  const surfaceRead = clamp01(player._surfaceImpactReadPulse || 0);
  const surfaceHardness = clamp01(player._surfaceImpactHardnessPulse || 0);
  const objectivePrompt = clamp01(player._objectivePromptPulse || 0);
  const objectiveStabilize = clamp01(player._objectiveStabilizePulse || 0);
  const objectiveAnticipation = clamp01(player._objectivePayoffAnticipationPulse || 0);
  const objectiveFail = clamp01(player._objectiveFailPressurePulse || 0);
  const objectivePulse = clamp01(Math.max(objectivePrompt * 0.70, objectiveStabilize, objectiveAnticipation));
  const objectivePressure = clamp01(Math.max(player._objectivePressurePulse || 0, objectiveFail, player._objectiveBracePulse || 0));
  const reload = player._reloadFeelSnapshot || {};
  const reloadStartle = clamp01(Math.max(player._reloadFumblePulse || 0, reload.surfaceInterference || 0));
  const reloadConfidence = clamp01(Math.max(player._reloadHandLockPulse || 0, player._reloadEmergencyShieldPulse || 0, reload.insertConfidence || 0, reload.chamberSettle || 0));
  const pressure = clamp01(Math.max(player._enemyShotPressure || 0, player._suppressionLevel || 0, player._suppressionEdgePulse || 0, player._damageShock || 0, objectivePressure * 0.82, surfaceHardness * 0.58, reloadStartle * 0.48));
  const confidence = clamp01((player._gunplayConfidence || 0) + objectiveStabilize * 0.06 + reloadConfidence * 0.045 - surfaceHardness * 0.035 - objectiveFail * 0.055);
  const spread = clamp(player._gunplaySpreadVisual || 0, 0, 4.2);
  const xhairScale = clamp(1 + spread * .045 + pressure * .055 + shot * .040 + surfaceRead * .035 + reloadStartle * .026 - hit * .035 - kill * .055 - precision * .018 - attackBreak * .026 - weaponBreak * .018 - objectiveStabilize * .024 - reloadConfidence * .018, .58, 2.9);
  const ringOpacity = clamp(hit * .42 + kill * .62 + streakPulse * .22 + ammo * .18 + attackBreak * .30 + weaponBreak * .18 + coverBreak * .12 + surfaceRead * .14 + objectivePulse * .12 + reloadConfidence * .08, 0, .98);
  const ringScale = clamp(1.08 + hit * .20 + kill * .36 + streakPulse * .18 + attackBreak * .12 + weaponBreak * .08 + surfaceHardness * .06 + objectiveAnticipation * .05 - reloadConfidence * .04, 1, 1.92);
  return {
    version: COMBAT_FEEDBACK_VERSION,
    shotPulse: shot,
    hitConfirmPulse: hit,
    killConfirmPulse: kill,
    precisionFlowPulse: precision,
    combatStreakPulse: streakPulse,
    attackBreakPulse: attackBreak,
    weaponBreakPulse: weaponBreak,
    coverBreakPulse: coverBreak,
    combatStreak: player._combatStreak || 0,
    ammoBeatPulse: ammo,
    weaponSwitchPulse: weaponSwitch,
    pickupCollectPulse: pickupCollect,
    surfaceReadPulse: surfaceRead,
    surfaceHardnessPulse: surfaceHardness,
    objectivePulse,
    objectivePressure,
    objectiveStabilize,
    objectiveAnticipation,
    objectiveFail,
    reloadStartle,
    reloadConfidence,
    pressurePulse: pressure,
    cadenceScore: clamp01(player._shotCadenceScore || 0),
    confidence,
    spread,
    xhairScale,
    ringOpacity,
    ringScale,
    lowAmmo: ammo > .16
  };
}
