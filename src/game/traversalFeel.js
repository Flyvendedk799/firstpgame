export const TRAVERSAL_FEEL_VERSION = 'traversal-feel.v2';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

export function resolveLandingTraversalResponse(opts = {}) {
  const impact = Math.max(0, Number(opts.impact) || 0);
  const sprintBlend = clamp01(opts.sprintBlend);
  const slideIntent = !!opts.slideIntent;
  const slideReady = !!opts.slideReady;
  const ads = clamp01(opts.ads);
  const dropkick = !!opts.dropkick;
  const hard = clamp01((impact - 3.25) / 8.0);
  const flow = clamp01(sprintBlend * 0.70 + hard * 0.32 + (slideIntent || slideReady ? 0.22 : 0) - ads * 0.18);
  const kneeAbsorb = clamp(hard * 0.48 + flow * 0.24 + (slideReady ? 0.10 : 0) - ads * 0.06, 0, 0.82);
  const footPlantShock = clamp(hard * 0.62 + sprintBlend * 0.16 + (slideIntent ? 0.10 : 0), 0, 0.92);
  const recenterAssist = clamp(flow * 0.28 + kneeAbsorb * 0.14 - ads * 0.08, 0, 0.42);
  const slideWindowMs = Math.round(clamp(190 + hard * 260 + sprintBlend * 150 + (slideIntent ? 120 : 0), 120, dropkick ? 260 : 720));
  const slidePower = clamp(1 + hard * 0.20 + sprintBlend * 0.10 + (slideIntent ? 0.08 : 0), 1, 1.34);
  return {
    version: TRAVERSAL_FEEL_VERSION,
    kind: 'landing',
    hard,
    flow,
    kneeAbsorb,
    footPlantShock,
    recenterAssist,
    slideIntentGrace: clamp((slideIntent ? 0.46 : 0) + (slideReady ? 0.30 : 0) + sprintBlend * 0.12, 0, 0.86),
    slideWindowMs,
    slidePower,
    cameraKick: clamp(hard * 0.72 + flow * 0.18, 0, 0.88),
    weaponDip: clamp(hard * 0.09 + flow * 0.025, 0, 0.12),
    locomotionSurge: clamp(flow * 0.82 + hard * 0.20, 0, 1.15),
    bodyJolt: clamp(hard * 0.85 + (dropkick ? 0.22 : 0), 0, 1.2),
    finite: true
  };
}

export function resolveVaultExitTraversalResponse(opts = {}) {
  const height = clamp(opts.height, 0.25, 1.65);
  const sprintBlend = clamp01(opts.sprintBlend);
  const dir = String(opts.dir || 'forward');
  const side = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const back = dir === 'backward' ? 1 : 0;
  const power = clamp(0.38 + height * 0.22 + sprintBlend * 0.38 - back * 0.10, 0.32, 1.08);
  const legClearance = clamp(height * 0.42 + sprintBlend * 0.28 + (side ? 0.12 : 0.05) - back * 0.08, 0.18, 0.92);
  const handPlant = clamp(power * 0.40 + height * 0.16 + sprintBlend * 0.08, 0.18, 0.72);
  const exitRecenter = clamp(power * 0.28 + sprintBlend * 0.18 - back * 0.06, 0.10, 0.58);
  return {
    version: TRAVERSAL_FEEL_VERSION,
    kind: 'vaultExit',
    power,
    side,
    legClearance,
    handPlant,
    exitRecenter,
    exitLean: clamp(side * (0.16 + power * 0.22), -0.42, 0.42),
    carryTimer: clamp(0.16 + sprintBlend * 0.18 + height * 0.035, 0.12, 0.42),
    slideWindowMs: Math.round(clamp(150 + sprintBlend * 170 + height * 45, 110, 420)),
    vaultPulse: clamp(power * 0.92, 0, 1),
    locomotionSurge: clamp(power * (side ? 0.72 : 0.84), 0, 1),
    bodyJolt: clamp(power * 0.30, 0, 0.44),
    finite: true
  };
}

export function resolveSlideContactTraversalResponse(opts = {}) {
  const moveRatio = clamp(opts.moveRatio, 0, 1);
  const intentSpeed = Math.max(0, Number(opts.intentSpeed) || 0);
  const slideAmt = clamp01(opts.slideAmt);
  const side = clamp(opts.side, -1, 1);
  const back = Math.max(0, -clamp(opts.forward, -1, 1));
  const blocked = clamp01(1 - moveRatio);
  const severity = clamp01(blocked * (0.52 + slideAmt * 0.42 + Math.min(1, intentSpeed / 9) * 0.30));
  const scrapePitch = clamp(severity * (0.34 + slideAmt * 0.22) + back * 0.08, 0, 0.62);
  const legTuck = clamp(slideAmt * 0.38 + severity * 0.30 + back * 0.12, 0, 0.84);
  const recoverStep = clamp(severity * 0.24 + Math.max(0, 1 - blocked) * 0.18, 0, 0.46);
  return {
    version: TRAVERSAL_FEEL_VERSION,
    kind: 'slideContact',
    blocked,
    severity,
    side,
    scrapePitch,
    legTuck,
    recoverStep,
    wallSkim: clamp((1 - blocked) * slideAmt * 0.42 + Math.abs(side) * 0.10, 0, 0.52),
    timerCap: clamp(0.10 + (1 - severity) * 0.22 - back * 0.035, 0.06, 0.34),
    carryCancel: severity > 0.34,
    skidPulse: clamp(severity * 1.12, 0, 1.2),
    cameraShake: clamp(severity * 0.035, 0, 0.05),
    bodyJolt: clamp(severity * 0.42, 0, 0.58),
    finite: true
  };
}
