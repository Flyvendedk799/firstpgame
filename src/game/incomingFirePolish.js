export const INCOMING_FIRE_POLISH_VERSION = 'incoming-fire-polish.v3';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-Math.max(0.001, lambda) * Math.max(0, dt || 0));
}

const SOURCE_PROFILES = Object.freeze({
  default: Object.freeze({ threat: 0.72, crack: 0.72, lane: 0.66, scope: 0.55, mercy: 0.10 }),
  soldier: Object.freeze({ threat: 0.72, crack: 0.70, lane: 0.66, scope: 0.50, mercy: 0.10 }),
  heavy: Object.freeze({ threat: 0.90, crack: 0.82, lane: 0.74, scope: 0.62, mercy: 0.13 }),
  sniper: Object.freeze({ threat: 1.18, crack: 1.05, lane: 0.96, scope: 1.10, mercy: 0.18 }),
  marksman: Object.freeze({ threat: 1.05, crack: 0.96, lane: 0.88, scope: 0.92, mercy: 0.16 }),
  scout: Object.freeze({ threat: 0.58, crack: 0.82, lane: 0.70, scope: 0.46, mercy: 0.09 }),
  pistolero: Object.freeze({ threat: 0.62, crack: 0.74, lane: 0.64, scope: 0.44, mercy: 0.10 }),
  shielded: Object.freeze({ threat: 0.76, crack: 0.74, lane: 0.68, scope: 0.50, mercy: 0.12 }),
  riot: Object.freeze({ threat: 0.82, crack: 0.78, lane: 0.70, scope: 0.54, mercy: 0.12 }),
  demolitions: Object.freeze({ threat: 0.92, crack: 0.86, lane: 0.76, scope: 0.66, mercy: 0.14 }),
  drone: Object.freeze({ threat: 0.54, crack: 0.90, lane: 0.76, scope: 0.42, mercy: 0.08 }),
  lieutenant: Object.freeze({ threat: 0.98, crack: 0.86, lane: 0.80, scope: 0.74, mercy: 0.15 }),
  boss: Object.freeze({ threat: 1.10, crack: 0.92, lane: 0.86, scope: 0.84, mercy: 0.16 })
});

function profileFor(sourceType) {
  return SOURCE_PROFILES[sourceType] || SOURCE_PROFILES.default;
}

function pulseMax(target, key, value) {
  target[key] = Math.max(Number.isFinite(target[key]) ? target[key] : 0, value);
}

export function buildIncomingFireThreatResponse(opts = {}) {
  const hit = !!opts.hit;
  const closeMiss = !!opts.closeMiss;
  const pressure = clamp01(opts.pressure);
  const crack = clamp01(opts.crack);
  const lane = clamp01(opts.lane);
  const scope = clamp01(opts.scope);
  const impact = clamp01(opts.impact);
  const hitChance = clamp01(opts.hitChance);
  const missSeverity = clamp01(opts.missSeverity);
  const sourceThreat = clamp(opts.sourceThreat == null ? 0.72 : opts.sourceThreat, 0.35, 1.35);
  const distance = clamp(opts.distance, 0, 120);
  const proximity = clamp01(1 - distance / 34);
  const nearMissSeverity = hit ? 0 : clamp01((closeMiss ? 0.52 : 0.18) + (1 - missSeverity) * (closeMiss ? 0.34 : 0.12) + crack * 0.16 + proximity * 0.10);
  const threat = clamp01(pressure * 0.52 + lane * 0.28 + crack * 0.24 + impact * 0.34 + hitChance * 0.08);
  const routeThreat = clamp01(lane * 0.58 + pressure * 0.26 + hitChance * 0.14 + (closeMiss ? 0.14 : 0));
  const suppressionAdd = clamp01((hit ? 0.19 : closeMiss ? 0.145 : 0.060) * sourceThreat + threat * 0.085 + proximity * (closeMiss ? 0.050 : 0.020));
  const nearMissPulse = clamp01(hit ? impact * 0.55 : nearMissSeverity * 0.82 + crack * 0.22 + lane * 0.10);
  const tunnelVision = clamp01(threat * 0.46 + nearMissSeverity * 0.30 + impact * 0.30);
  const recenterNeed = clamp01(scope * 0.42 + crack * 0.26 + nearMissSeverity * 0.30 + impact * 0.38);
  const weaponFlinch = clamp01(pressure * 0.22 + nearMissSeverity * 0.34 + impact * 0.44 + scope * 0.12);
  const laneRead = clamp01(lane * 0.58 + crack * 0.18 + hitChance * 0.16 + (closeMiss ? 0.12 : 0));
  const adsBrace = clamp01(scope * 0.34 + laneRead * 0.22 + threat * 0.18 + impact * 0.22);
  const breathCatch = clamp01(nearMissSeverity * 0.42 + crack * 0.22 + tunnelVision * 0.18 + impact * 0.18);
  const threatClock = clamp01(hitChance * 0.38 + lane * 0.22 + pressure * 0.18 + (closeMiss ? 0.18 : 0) + impact * 0.20);
  const audioDuck = clamp01(crack * 0.48 + impact * 0.36 + pressure * 0.18);
  const cameraLean = clamp(hit ? 0.022 + impact * 0.030 : nearMissSeverity * 0.035 + lane * 0.014, 0, 0.075);
  const enemyShotPressure = clamp01(hit ? Math.max(0.54, threat * 0.78) : closeMiss ? Math.max(0.66, threat * 0.86) : Math.max(0.20, threat * 0.52));
  const edgePulse = clamp01((hit ? 0.54 : closeMiss ? 0.82 : 0.34) + threat * 0.16);
  const suppressedMs = Math.round((hit ? 1400 : closeMiss ? 1750 : 950) + threat * 680 + sourceThreat * 160);
  const label = hit ? 'hit' : closeMiss ? (nearMissSeverity > 0.72 ? 'threaded-near-miss' : 'near-miss') : threat > 0.34 ? 'wide-pressure' : 'wide-miss';
  return {
    version: INCOMING_FIRE_POLISH_VERSION,
    threat,
    routeThreat,
    nearMissSeverity,
    suppressionAdd,
    nearMissPulse,
    tunnelVision,
    recenterNeed,
    weaponFlinch,
    laneRead,
    adsBrace,
    breathCatch,
    threatClock,
    audioDuck,
    cameraLean,
    enemyShotPressure,
    edgePulse,
    suppressedMs,
    label,
    finite: true
  };
}

export function recordIncomingEnemyShot(player, opts = {}) {
  if (!player) return null;
  const profile = profileFor(opts.sourceType);
  const hit = !!opts.hit;
  const closeMiss = !!opts.closeMiss;
  const missSeverity = clamp01(opts.missSeverity);
  const hitChance = clamp01(opts.hitChance);
  const distance = clamp(opts.distance, 0, 80);
  const side = Number.isFinite(opts.side) ? (opts.side >= 0 ? 1 : -1) : 1;
  const distThreat = clamp01(1 - distance / 36);
  const pressure = clamp01((hit ? 0.82 : closeMiss ? 0.62 : 0.26) + hitChance * 0.22 + distThreat * 0.18);
  const crack = clamp01((hit ? 0.38 : closeMiss ? 0.96 : 0.42) * profile.crack * (1 - missSeverity * 0.34));
  const lane = clamp01((closeMiss ? 0.84 : hit ? 0.36 : 0.30) * profile.lane + hitChance * 0.10);
  const scope = clamp01((closeMiss ? 0.70 : hit ? 0.42 : 0.20) * profile.scope + distThreat * 0.16);
  const impact = clamp01(hit ? 0.72 + profile.threat * 0.18 : 0);
  const mercy = clamp01((hit ? 0.18 : closeMiss ? 0.10 : 0.04) + profile.mercy + Math.max(0, hitChance - 0.70) * 0.18);
  const response = buildIncomingFireThreatResponse({
    hit,
    closeMiss,
    missSeverity,
    hitChance,
    distance,
    pressure: pressure * profile.threat,
    crack,
    lane,
    scope,
    impact,
    sourceThreat: profile.threat
  });
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());

  pulseMax(player, '_incomingFirePressure', pressure * profile.threat);
  pulseMax(player, '_incomingFireCrackPulse', crack);
  pulseMax(player, '_incomingFireLanePulse', lane);
  pulseMax(player, '_incomingFireScopeKick', scope);
  pulseMax(player, '_incomingFireImpactPulse', impact);
  pulseMax(player, '_incomingMercyPulse', mercy);
  pulseMax(player, '_incomingFireThreatPulse', response.threat);
  pulseMax(player, '_incomingFireRouteThreat', response.routeThreat);
  pulseMax(player, '_incomingFireTunnelPulse', response.tunnelVision);
  pulseMax(player, '_incomingFireRecenterNeed', response.recenterNeed);
  pulseMax(player, '_incomingFireWeaponFlinch', response.weaponFlinch);
  pulseMax(player, '_incomingFireLaneRead', response.laneRead);
  pulseMax(player, '_incomingFireAdsBrace', response.adsBrace);
  pulseMax(player, '_incomingFireBreathCatch', response.breathCatch);
  pulseMax(player, '_incomingFireThreatClock', response.threatClock);
  pulseMax(player, '_incomingFireAudioDuck', response.audioDuck);
  pulseMax(player, '_incomingFireNearMissSeverity', response.nearMissSeverity);
  pulseMax(player, '_enemyShotPressure', response.enemyShotPressure);
  pulseMax(player, '_suppressionEdgePulse', response.edgePulse);
  pulseMax(player, '_weaponHandlingUrgency', clamp01(response.weaponFlinch * 0.74 + response.threat * 0.24));
  player._weaponHandlingReady = Math.max(0, (Number.isFinite(player._weaponHandlingReady) ? player._weaponHandlingReady : 1) - clamp(response.weaponFlinch * 0.12 + response.threat * 0.035, 0.025, 0.14));
  player._suppressionLevel = clamp01((Number.isFinite(player._suppressionLevel) ? player._suppressionLevel : 0) + response.suppressionAdd);
  player._suppressedUntil = Math.max(Number.isFinite(player._suppressedUntil) ? player._suppressedUntil : 0, nowMs + response.suppressedMs);
  if (!hit || response.nearMissPulse > 0.36) {
    pulseMax(player, '_nearMissPulse', response.nearMissPulse);
    player._nearMissSide = side;
  }
  player._incomingFireSide = side;
  player._incomingFireLastKind = hit ? 'hit' : closeMiss ? 'closeMiss' : 'wideMiss';
  player._incomingFireLastSource = opts.sourceType || 'unknown';
  player._incomingFireLastChance = hitChance;
  player._incomingFireLastDistance = distance;
  player._incomingFireLastSuppressionAdd = response.suppressionAdd;
  player._incomingFireLastSuppressedMs = response.suppressedMs;
  player._incomingFireLastThreatLabel = response.label;
  player._incomingFireLastAt = nowMs;
  player._enemyShotSide = side;

  return buildIncomingFirePolishSnapshot(player);
}

export function recordEnemyShotReadabilityPolish(enemy, opts = {}) {
  if (!enemy) return null;
  const hit = !!opts.hit;
  const closeMiss = !!opts.closeMiss;
  const hitChance = clamp01(opts.hitChance);
  const aimReady = clamp01(opts.aimReady == null ? hitChance : opts.aimReady);
  const distance = clamp(opts.distance, 0, 80);
  const confidence = clamp01((hit ? 0.76 : closeMiss ? 0.48 : 0.30) + aimReady * 0.24 + hitChance * 0.20);
  const discipline = clamp01(aimReady * 0.52 + hitChance * 0.34 - (closeMiss ? 0.08 : 0) - (distance > 24 ? 0.08 : 0));
  const preFireTell = clamp01((hit ? 0.34 : 0.18) + aimReady * 0.30 + hitChance * 0.26 - (distance > 26 ? 0.06 : 0));
  const muzzleIntent = clamp01(confidence * 0.36 + discipline * 0.26 + preFireTell * 0.22 + (hit ? 0.12 : 0));
  const triggerCommit = clamp01(aimReady * 0.44 + hitChance * 0.36 + (hit ? 0.16 : 0) - (closeMiss ? 0.06 : 0));
  enemy._shotReadabilityConfidence = Math.max(enemy._shotReadabilityConfidence || 0, confidence);
  enemy._shotReadabilityDiscipline = Math.max(enemy._shotReadabilityDiscipline || 0, discipline);
  enemy._shotReadabilityPulse = Math.max(enemy._shotReadabilityPulse || 0, hit ? 0.78 : closeMiss ? 0.64 : 0.38);
  enemy._shotReadabilityPreFireTell = Math.max(enemy._shotReadabilityPreFireTell || 0, preFireTell);
  enemy._shotReadabilityMuzzleIntent = Math.max(enemy._shotReadabilityMuzzleIntent || 0, muzzleIntent);
  enemy._shotReadabilityTriggerCommit = Math.max(enemy._shotReadabilityTriggerCommit || 0, triggerCommit);
  enemy._shotReadabilityKind = hit ? 'hit' : closeMiss ? 'closeMiss' : 'miss';
  enemy._shotReadabilityAt = Number.isFinite(opts.nowMs) ? opts.nowMs : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  if (enemy.group) enemy.group.userData.shotReadability = buildEnemyShotReadabilitySnapshot(enemy);
  return enemy.group ? enemy.group.userData.shotReadability : buildEnemyShotReadabilitySnapshot(enemy);
}

export function tickIncomingFirePolish(player, dt, dampFn = expDamp) {
  if (!player) return null;
  const decay = {
    _incomingFirePressure: 5.4,
    _incomingFireCrackPulse: 10.5,
    _incomingFireLanePulse: 7.2,
    _incomingFireScopeKick: 8.8,
    _incomingFireImpactPulse: 9.4,
    _incomingMercyPulse: 3.6,
    _incomingFireThreatPulse: 5.8,
    _incomingFireRouteThreat: 6.0,
    _incomingFireTunnelPulse: 4.9,
    _incomingFireRecenterNeed: 6.4,
    _incomingFireWeaponFlinch: 7.4,
    _incomingFireLaneRead: 6.6,
    _incomingFireAdsBrace: 7.0,
    _incomingFireBreathCatch: 6.2,
    _incomingFireThreatClock: 5.8,
    _incomingFireAudioDuck: 8.2,
    _incomingFireNearMissSeverity: 7.8
  };
  for (const [key, lambda] of Object.entries(decay)) {
    player[key] = dampFn(Number.isFinite(player[key]) ? player[key] : 0, 0, lambda, dt);
  }
  return buildIncomingFirePolishSnapshot(player);
}

export function tickEnemyShotReadabilityPolish(enemy, dt, dampFn = expDamp) {
  if (!enemy) return null;
  enemy._shotReadabilityConfidence = dampFn(Number.isFinite(enemy._shotReadabilityConfidence) ? enemy._shotReadabilityConfidence : 0, 0, 4.8, dt);
  enemy._shotReadabilityDiscipline = dampFn(Number.isFinite(enemy._shotReadabilityDiscipline) ? enemy._shotReadabilityDiscipline : 0, 0, 5.6, dt);
  enemy._shotReadabilityPulse = dampFn(Number.isFinite(enemy._shotReadabilityPulse) ? enemy._shotReadabilityPulse : 0, 0, 8.0, dt);
  enemy._shotReadabilityPreFireTell = dampFn(Number.isFinite(enemy._shotReadabilityPreFireTell) ? enemy._shotReadabilityPreFireTell : 0, 0, 6.4, dt);
  enemy._shotReadabilityMuzzleIntent = dampFn(Number.isFinite(enemy._shotReadabilityMuzzleIntent) ? enemy._shotReadabilityMuzzleIntent : 0, 0, 5.8, dt);
  enemy._shotReadabilityTriggerCommit = dampFn(Number.isFinite(enemy._shotReadabilityTriggerCommit) ? enemy._shotReadabilityTriggerCommit : 0, 0, 7.2, dt);
  const snap = buildEnemyShotReadabilitySnapshot(enemy);
  if (enemy.group) enemy.group.userData.shotReadability = snap;
  return snap;
}

export function applyIncomingFireHitChance(baseChance = 0, player = null, opts = {}) {
  const base = clamp01(baseChance);
  const mercy = player ? clamp01(player._incomingMercyPulse || 0) : 0;
  const pressure = player ? clamp01(player._incomingFirePressure || 0) : 0;
  const closeRange = clamp01(1 - clamp(opts.distance, 0, 40) / 40);
  const shaped = base * (1 - mercy * (0.10 + closeRange * 0.08)) + pressure * 0.012;
  return clamp(shaped, 0.025, 0.94);
}

export function buildIncomingFirePolishSnapshot(player) {
  if (!player) return { version: INCOMING_FIRE_POLISH_VERSION };
  const pressure = clamp01(player._incomingFirePressure || 0);
  const crack = clamp01(player._incomingFireCrackPulse || 0);
  const lane = clamp01(player._incomingFireLanePulse || 0);
  const scope = clamp01(player._incomingFireScopeKick || 0);
  const impact = clamp01(player._incomingFireImpactPulse || 0);
  const mercy = clamp01(player._incomingMercyPulse || 0);
  const threat = clamp01(Math.max(player._incomingFireThreatPulse || 0, pressure * 0.52 + lane * 0.28 + crack * 0.24 + impact * 0.34));
  const routeThreat = clamp01(Math.max(player._incomingFireRouteThreat || 0, lane * 0.58 + pressure * 0.26));
  const nearMissSeverity = clamp01(Math.max(player._incomingFireNearMissSeverity || 0, (player._incomingFireLastKind === 'closeMiss' ? crack * 0.62 + lane * 0.20 : 0)));
  const tunnelVision = clamp01(Math.max(player._incomingFireTunnelPulse || 0, threat * 0.42 + impact * 0.22));
  const recenterNeed = clamp01(Math.max(player._incomingFireRecenterNeed || 0, scope * 0.42 + crack * 0.18 + impact * 0.22));
  const weaponFlinch = clamp01(Math.max(player._incomingFireWeaponFlinch || 0, pressure * 0.20 + nearMissSeverity * 0.30 + impact * 0.38));
  const laneRead = clamp01(Math.max(player._incomingFireLaneRead || 0, lane * 0.58 + crack * 0.16));
  const adsBrace = clamp01(Math.max(player._incomingFireAdsBrace || 0, scope * 0.32 + laneRead * 0.20 + threat * 0.16));
  const breathCatch = clamp01(Math.max(player._incomingFireBreathCatch || 0, nearMissSeverity * 0.38 + crack * 0.18 + tunnelVision * 0.16));
  const threatClock = clamp01(Math.max(player._incomingFireThreatClock || 0, (player._incomingFireLastChance || 0) * 0.38 + routeThreat * 0.24 + threat * 0.14));
  const audioDuck = clamp01(Math.max(player._incomingFireAudioDuck || 0, crack * 0.48 + impact * 0.30 + pressure * 0.14));
  const label = player._incomingFireLastThreatLabel || (impact > 0.16 ? 'hit' : nearMissSeverity > 0.40 ? 'near-miss' : threat > 0.30 ? 'under-fire' : 'clear');
  return {
    version: INCOMING_FIRE_POLISH_VERSION,
    pressure,
    crack,
    lane,
    scope,
    impact,
    mercy,
    side: Number.isFinite(player._incomingFireSide) ? player._incomingFireSide : 1,
    kind: player._incomingFireLastKind || '',
    source: player._incomingFireLastSource || '',
    hitChance: clamp01(player._incomingFireLastChance || 0),
    distance: clamp(player._incomingFireLastDistance || 0, 0, 120),
    threat,
    routeThreat,
    nearMissSeverity,
    suppressionAdd: clamp01(player._incomingFireLastSuppressionAdd || 0),
    suppressedMs: Math.max(0, Math.round(Number.isFinite(player._incomingFireLastSuppressedMs) ? player._incomingFireLastSuppressedMs : 0)),
    nearMissPulse: clamp01(player._nearMissPulse || 0),
    enemyShotPressure: clamp01(player._enemyShotPressure || 0),
    edgePulse: clamp01(player._suppressionEdgePulse || 0),
    tunnelVision,
    recenterNeed,
    weaponFlinch,
    laneRead,
    adsBrace,
    breathCatch,
    threatClock,
    audioDuck,
    label,
    cameraKick: clamp(impact * 0.035 + crack * 0.018 + pressure * 0.012 + tunnelVision * 0.010, 0, 0.09),
    weaponBrace: clamp(pressure * 0.030 + lane * 0.020 + scope * 0.018 + weaponFlinch * 0.016 + adsBrace * 0.014, 0, 0.100),
    scopeKick: clamp(scope * 0.010 + crack * 0.004 + recenterNeed * 0.004 - adsBrace * 0.002, 0, 0.024),
    hudEdge: clamp(lane * 0.46 + crack * 0.18 + impact * 0.22 + tunnelVision * 0.20, 0, 0.95),
    recenterDelay: clamp(recenterNeed * 0.050 + tunnelVision * 0.028 - adsBrace * 0.012, 0, 0.090),
    focusNarrow: clamp(tunnelVision * 0.72 + routeThreat * 0.16, 0, 0.90),
    finite: true
  };
}

export function buildEnemyShotReadabilitySnapshot(enemy) {
  if (!enemy) return { version: INCOMING_FIRE_POLISH_VERSION };
  const confidence = clamp01(enemy._shotReadabilityConfidence || 0);
  const discipline = clamp01(enemy._shotReadabilityDiscipline || 0);
  const pulse = clamp01(enemy._shotReadabilityPulse || 0);
  const preFireTell = clamp01(enemy._shotReadabilityPreFireTell || 0);
  const muzzleIntent = clamp01(enemy._shotReadabilityMuzzleIntent || 0);
  const triggerCommit = clamp01(enemy._shotReadabilityTriggerCommit || 0);
  return {
    version: INCOMING_FIRE_POLISH_VERSION,
    confidence,
    discipline,
    pulse,
    preFireTell,
    muzzleIntent,
    triggerCommit,
    kind: enemy._shotReadabilityKind || '',
    muzzleScale: clamp(0.85 + confidence * 0.28 + pulse * 0.18 + muzzleIntent * 0.12, 0.75, 1.62),
    recoilPose: clamp(pulse * 0.24 + confidence * 0.10 + triggerCommit * 0.08, 0, 0.48),
    readableWindowMs: Math.round(clamp(180 + preFireTell * 320 + muzzleIntent * 220, 160, 760)),
    finite: true
  };
}
