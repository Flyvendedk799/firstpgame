export const KNIFE_FEEL_VERSION = 'knife-feel.v6';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);
const smoothstep = (x, e0, e1) => {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
};

export function resolveKnifeReturnFrame(opts = {}) {
  const p = clamp01(opts.p);
  const dist = clamp(opts.dist, 0, 80);
  const hitReturn = !!opts.hitReturn;
  const close = smoothstep(p, 0.64, 1);
  const catchPrep = smoothstep(p, 0.72, 0.96);
  const charge = smoothstep(p, 0.18, 0.56);
  const magnetic = smoothstep(p, 0.54, 0.98);
  const handBrake = smoothstep(p, 0.86, 1);
  const catchWindow = smoothstep(p, 0.78, 1);
  const nearHandEase = smoothstep(p, 0.62, 0.92);
  const wristCatch = smoothstep(p, 0.74, 0.99);
  const returnAnticipation = smoothstep(p, 0.08, 0.32) * (1 - smoothstep(p, 0.46, 0.72));
  const curveTighten = clamp(smoothstep(p, 0.50, 0.90) * (hitReturn ? 1.08 : 0.88), 0, 1.16);
  const catchAlignment = clamp(smoothstep(p, 0.70, 0.98) * (hitReturn ? 1.10 : 0.86), 0, 1.18);
  const palmLead = clamp(catchAlignment * (hitReturn ? 0.12 : 0.08) + returnAnticipation * 0.030, 0, 0.16);
  const catchSnap = clamp(catchWindow * (hitReturn ? 0.72 : 0.52) + catchAlignment * 0.22, 0, 1.06);
  const returnAudioPitch = clamp(0.86 + charge * 0.18 + curveTighten * 0.20 + catchSnap * 0.16 + (hitReturn ? 0.12 : 0), 0.82, 1.46);
  const spinBrake = clamp(handBrake * 0.72 + wristCatch * 0.36, 0, 1.12);
  const returnLead = clamp((hitReturn ? 0.115 : 0.078) * nearHandEase + magnetic * 0.030, 0, 0.16);
  const bladeTipLead = clamp((hitReturn ? 0.075 : 0.048) * (1 - handBrake * 0.45) + charge * 0.025, 0.025, 0.105);
  const tetherTwist = clamp((1 - p) * 0.42 + magnetic * 0.36 + catchPrep * 0.22, 0, 0.92);
  const arcLift = clamp((opts.arc || 0.8) * (1 - close * 0.46) + (hitReturn ? 0.24 : 0.04) + charge * 0.08, 0.32, 1.95);
  const sidePull = clamp((opts.side || 1) * (0.22 + dist * 0.040) * (1 - close * 0.66) + Math.sin(p * Math.PI * 2) * 0.035 * (1 - handBrake), -1.08, 1.08);
  const snap = clamp(close * (hitReturn ? 0.52 : 0.38) + catchPrep * 0.18 + magnetic * 0.08, 0, 0.82);
  return {
    version: KNIFE_FEEL_VERSION,
    p,
    close,
    catchPrep,
    arcLift,
    sidePull,
    snap,
    magneticSnap: clamp(magnetic * (hitReturn ? 1.08 : 0.82), 0, 1.2),
    handBrake,
    nearHandEase,
    wristCatch,
    spinBrake,
    returnLead,
    bladeTipLead,
    tetherTwist,
    spinMul: clamp(1.05 + (1 - p) * 0.34 + catchPrep * 0.62 + (hitReturn ? 0.24 : 0), 0.8, 2.05),
    trailCadenceMs: Math.round(clamp(hitReturn ? 18 : 30 - catchPrep * 14, 14, 36)),
    haloRadius: clamp((hitReturn ? 0.046 : 0.036) + catchPrep * 0.014 + magnetic * 0.008, 0.026, 0.070),
    ribbonRadius: clamp((hitReturn ? 0.064 : 0.052) + (1 - p) * 0.020 + catchPrep * 0.018, 0.034, 0.092),
    trailFan: clamp(1 + hitReturn * 0.4 + magnetic * 0.8 + catchPrep * 0.4, 1, 2.6),
    catchScale: clamp(1 + catchPrep * 0.32 + magnetic * 0.10, 1, 1.45),
    catchPulse: p >= 0.84 ? clamp01((p - 0.84) / 0.16) : 0,
    catchWindow,
    returnAnticipation,
    curveTighten,
    catchAlignment,
    palmLead,
    catchSnap,
    handLead: clamp(catchPrep * (hitReturn ? 0.11 : 0.075) + magnetic * 0.035 + returnLead * 0.28, 0, 0.18),
    cameraCatchKick: clamp(catchWindow * (hitReturn ? 0.36 : 0.24) + magnetic * 0.08 + wristCatch * 0.045, 0, 0.52),
    catchTwist: clamp((hitReturn ? 0.26 : 0.18) * wristCatch + tetherTwist * 0.10, 0, 0.34),
    returnLineOpacity: clamp(0.34 + magnetic * 0.22 + catchPrep * 0.16 + (hitReturn ? 0.12 : 0), 0.26, 0.84),
    catchBrake: clamp(handBrake * (hitReturn ? 1.05 : 0.88) + catchWindow * 0.22, 0, 1.15),
    returnAudioPitch,
    finite: true
  };
}

export function resolveKnifeStuckPoseSnapshot(opts = {}) {
  const kind = String(opts.kind || 'wall');
  const normalY = clamp(opts.normalY, -1, 1);
  const speed = clamp(opts.speed, 0, 80);
  const age = clamp(opts.age, 0, 60);
  const floor = kind === 'floor' || normalY > 0.62;
  const impact = clamp01(speed / 54);
  const materialGrip = clamp01(opts.knifeStickGrip || opts.materialGrip || 0);
  const materialKick = clamp01(opts.materialKick || opts.hardSnap || 0);
  const materialRead = clamp01(opts.playerReadPulse || opts.materialRead || 0);
  const materialLabel = String(opts.materialKey || opts.surfaceKey || '');
  const agePulse = 0.5 + 0.5 * Math.sin(age * 5.7);
  const surfaceOffset = clamp((floor ? 0.118 : 0.092) + impact * (floor ? 0.020 : 0.016) - materialGrip * 0.010 + materialKick * 0.006, floor ? 0.102 : 0.078, floor ? 0.154 : 0.130);
  const embedDepth = clamp((floor ? 0.040 : 0.052) + impact * 0.030 + materialGrip * 0.018 - materialKick * 0.006, 0.026, 0.096);
  const silhouetteScale = clamp(1.04 + impact * 0.12 + agePulse * 0.035 + materialRead * 0.040 + materialKick * 0.020, 0.98, 1.30);
  const beaconBoost = clamp((floor ? 0.10 : 0.16) + impact * 0.20 + agePulse * 0.05 + materialRead * 0.08 + materialGrip * 0.04, 0.08, 0.50);
  const handleLift = clamp((floor ? 0.040 : 0.026) + impact * 0.022 + agePulse * 0.006 + materialKick * 0.010 - materialGrip * 0.006, 0.020, 0.082);
  const bladeReadScale = clamp(1.06 + impact * 0.16 + (floor ? 0.04 : 0.02) + materialRead * 0.06, 1.0, 1.36);
  const edgeGlowBoost = clamp(0.10 + impact * 0.22 + agePulse * 0.06 + materialKick * 0.10 + materialRead * 0.04, 0.08, 0.52);
  const tipNormalOffset = clamp(embedDepth * 0.46 + impact * 0.012 + materialKick * 0.006, 0.016, 0.064);
  const shadowPin = clamp(0.20 + impact * 0.34 + (floor ? 0.10 : 0) + materialGrip * 0.08 + materialKick * 0.04, 0.16, 0.70);
  return {
    version: KNIFE_FEEL_VERSION,
    kind,
    floor,
    normalY,
    impact,
    materialGrip,
    materialKick,
    materialRead,
    materialLabel,
    surfaceOffset,
    embedDepth,
    silhouetteScale,
    beaconBoost,
    handleLift,
    bladeReadScale,
    edgeGlowBoost,
    tipNormalOffset,
    shadowPin,
    bladeAngleHint: floor ? -0.42 : 0.18,
    label: `${floor ? 'floor' : 'wall'}-stuck${materialLabel ? '-' + materialLabel : ''}`,
    finite: true
  };
}

export function resolveKnifePickupAffordance(opts = {}) {
  const distance = clamp(opts.distance, 0, 20);
  const heightDelta = Math.abs(clamp(opts.heightDelta, -10, 10));
  const age = clamp(opts.age, 0, 60);
  const equipped = !!opts.equipped;
  const visible = clamp01(1 - distance / 8.5);
  const close = clamp01(1 - distance / (equipped ? 1.45 : 1.24));
  const heightOk = clamp01(1 - heightDelta / 1.85);
  const collectRadius = clamp((equipped ? 1.28 : 1.15) + visible * 0.18 + close * 0.05, 1.06, 1.52);
  const beaconScale = clamp(1 + visible * 0.20 + close * 0.06 + Math.sin(age * 5.2) * 0.035, 0.92, 1.42);
  const readability = clamp01(0.22 + visible * 0.54 + close * 0.24);
  const magnetStrength = clamp(close * 0.46 + visible * 0.18 + heightOk * 0.10, 0, 0.74);
  return {
    version: KNIFE_FEEL_VERSION,
    distance,
    heightDelta,
    visible,
    close,
    heightOk,
    collectRadius,
    beaconScale,
    readability,
    magnetStrength,
    silhouetteOpacity: clamp(0.42 + readability * 0.50, 0.32, 0.96),
    bladeGlow: clamp(0.28 + visible * 0.34 + close * 0.24, 0.20, 0.92),
    guideLineOpacity: clamp(0.10 + visible * 0.18 + close * 0.22 + magnetStrength * 0.12, 0.08, 0.64),
    promptUrgency: clamp(close * heightOk * 0.62 + magnetStrength * 0.18, 0, 0.92),
    beaconHeight: clamp(0.34 + visible * 0.30 + close * 0.18, 0.28, 0.82),
    collectPulse: clamp(close * heightOk, 0, 1),
    ringOpacity: clamp(0.18 + visible * 0.24 + close * 0.26, 0.12, 0.72),
    pulseOpacity: clamp(0.16 + visible * 0.22 + close * 0.34, 0.10, 0.74),
    stemOpacity: clamp(0.12 + visible * 0.18, 0.08, 0.46),
    prompt: close > 0.28 && heightOk > 0.28,
    finite: true
  };
}
