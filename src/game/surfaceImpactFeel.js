export const SURFACE_IMPACT_FEEL_VERSION = 'surface-impact-feel.v2';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

const BUILDING_SURFACE = Object.freeze({
  1: 'concrete',
  2: 'marble',
  3: 'metal',
  4: 'marble',
  5: 'tile',
  6: 'concrete',
  7: 'wood',
  8: 'metal',
  9: 'concrete',
  10: 'marble',
  11: 'grate',
  12: 'glass'
});

const PROFILE = Object.freeze({
  concrete: Object.freeze({ hardness: 0.72, dust: 1.18, sparks: 0.72, ricochet: 0.10, decal: 1.02, sound: 'thud' }),
  metal: Object.freeze({ hardness: 0.94, dust: 0.45, sparks: 1.52, ricochet: 0.34, decal: 0.82, sound: 'ping' }),
  wood: Object.freeze({ hardness: 0.42, dust: 1.26, sparks: 0.34, ricochet: 0.03, decal: 1.16, sound: 'thud' }),
  glass: Object.freeze({ hardness: 0.55, dust: 0.90, sparks: 1.16, ricochet: 0.05, decal: 0.72, sound: 'shatter' }),
  marble: Object.freeze({ hardness: 0.82, dust: 1.06, sparks: 0.94, ricochet: 0.18, decal: 0.94, sound: 'chip' }),
  tile: Object.freeze({ hardness: 0.76, dust: 1.00, sparks: 1.02, ricochet: 0.14, decal: 0.90, sound: 'chip' }),
  grate: Object.freeze({ hardness: 0.88, dust: 0.54, sparks: 1.36, ricochet: 0.28, decal: 0.78, sound: 'ping' })
});

function textOf(value) {
  return String(value || '').toLowerCase();
}

export function resolveSurfaceImpactKey(opts = {}) {
  const explicit = textOf(opts.surface || opts.materialKey || opts.profileKey);
  for (const key of Object.keys(PROFILE)) {
    if (explicit.includes(key)) return key;
  }
  const object = opts.object || null;
  const ud = object && object.userData || {};
  const meta = [
    ud.surface,
    ud.material,
    ud.aaMaterial,
    ud.coreVisualEnvironmentRole,
    object && object.name,
    object && object.material && object.material.name,
    object && object.material && object.material.userData && object.material.userData.surface
  ].map(textOf).join(' ');
  if (/(^|[^a-z])(glass|window|pane)([^a-z]|$)/.test(meta)) return 'glass';
  if (/metal|steel|grate|rail|server|rack|barrel|pipe/.test(meta)) return meta.includes('grate') ? 'grate' : 'metal';
  if (/wood|teak|crate|desk|door|panel/.test(meta)) return 'wood';
  if (/tile|medical|ceramic/.test(meta)) return 'tile';
  if (/marble|stone|polish|counter/.test(meta)) return 'marble';
  if (/grate|mesh|catwalk/.test(meta)) return 'grate';
  const building = Math.max(1, Number.isFinite(opts.building) ? opts.building | 0 : 1);
  return BUILDING_SURFACE[building] || 'concrete';
}

function weaponMul(weaponIdx) {
  const idx = Number.isFinite(weaponIdx) ? weaponIdx | 0 : 0;
  if (idx === 3) return { impact: 1.38, dust: 1.46, sparks: 0.86, decal: 1.28, ricochet: 0.60 };
  if (idx === 7) return { impact: 1.34, dust: 1.08, sparks: 1.24, decal: 1.18, ricochet: 1.18 };
  if (idx === 5) return { impact: 1.18, dust: 1.02, sparks: 1.12, decal: 1.08, ricochet: 1.10 };
  if (idx === 4) return { impact: 0.82, dust: 0.82, sparks: 0.88, decal: 0.84, ricochet: 0.88 };
  if (idx === 1 || idx === 6) return { impact: 1.02, dust: 0.92, sparks: 1.00, decal: 0.96, ricochet: 1.00 };
  return { impact: 1.0, dust: 1.0, sparks: 1.0, decal: 1.0, ricochet: 1.0 };
}

export function buildSurfaceImpactFeelSnapshot(opts = {}) {
  const key = resolveSurfaceImpactKey(opts);
  const base = PROFILE[key] || PROFILE.concrete;
  const weapon = weaponMul(opts.weaponIdx);
  const incidence = clamp01(Math.abs(Number.isFinite(opts.incidence) ? opts.incidence : 0.55));
  const glancing = clamp01((0.42 - incidence) / 0.42);
  const squareHit = clamp01((incidence - 0.32) / 0.68);
  const distance = Math.max(0, Number.isFinite(opts.distance) ? opts.distance : 10);
  const distDamp = clamp(1 - distance / 95, 0.54, 1);
  const shotQuality = clamp01(opts.shotQuality);
  const suppressed = !!opts.suppressed;
  const hardness = clamp01(base.hardness);
  const impact = clamp((0.76 + squareHit * 0.30 + glancing * 0.12 + shotQuality * 0.08) * weapon.impact * distDamp, 0.42, 1.85);
  const sparkMul = clamp((base.sparks * weapon.sparks) * (0.60 + hardness * 0.42 + glancing * 0.42) * (suppressed ? 0.82 : 1), 0.15, 2.4);
  const dustMul = clamp((base.dust * weapon.dust) * (0.62 + squareHit * 0.48 + (1 - hardness) * 0.24) * (suppressed ? 0.92 : 1), 0.18, 2.3);
  const decalScale = clamp(base.decal * weapon.decal * (0.86 + impact * 0.18 + squareHit * 0.16), 0.48, 1.85);
  const scorchMul = clamp((0.80 + hardness * 0.16 + impact * 0.18) * (suppressed ? 0.72 : 1), 0.36, 1.36);
  const flashMul = clamp((0.72 + sparkMul * 0.22 + impact * 0.16) * (suppressed ? 0.68 : 1), 0.30, 1.58);
  const ricochetChance = clamp(base.ricochet * weapon.ricochet * glancing * (0.72 + hardness * 0.42), 0, 0.62);
  const missBloom = clamp((0.10 + glancing * 0.12 + (1 - shotQuality) * 0.08) * impact, 0.04, 0.36);
  const confidenceLoss = clamp(0.12 + glancing * 0.12 + (key === 'metal' || key === 'grate' ? 0.04 : 0), 0.06, 0.34);
  const materialKick = clamp(impact * (0.22 + hardness * 0.30 + glancing * 0.16), 0.08, 0.82);
  const playerReadPulse = clamp((missBloom * 1.25 + materialKick * 0.45 + ricochetChance * 0.30) * (opts.fromPlayer ? 1 : 0.72), 0.04, 0.72);
  const hardSnap = clamp(hardness * impact * (0.44 + glancing * 0.38), 0.04, 0.86);
  const dustLift = clamp(0.18 + dustMul * 0.26 + squareHit * 0.24 - hardness * 0.08, 0.10, 0.76);
  const sparkStretchMul = clamp(0.82 + sparkMul * 0.14 + glancing * 0.34 + hardness * 0.08, 0.72, 1.72);
  const microShardCount = Math.round(clamp((sparkMul * 1.6 + dustMul * 0.9 + impact * 1.2) * (key === 'glass' ? 1.8 : key === 'wood' ? 1.15 : 1), 1, 12));
  const audioPitch = clamp((base.sound === 'ping' ? 1.18 : base.sound === 'shatter' ? 1.26 : 0.92) + hardness * 0.16 + glancing * 0.12 - squareHit * 0.05, 0.72, 1.62);
  const audioGain = clamp(0.58 + impact * 0.30 + hardSnap * 0.18 - (suppressed ? 0.16 : 0), 0.28, 1.32);
  const decalJitter = clamp(0.35 + impact * 0.20 + glancing * 0.22, 0.22, 0.86);
  const coverDamageMul = clamp(0.70 + impact * 0.22 + hardness * 0.16 + squareHit * 0.18, 0.58, 1.34);
  const ricochetTraceLife = clamp(0.10 + ricochetChance * 0.34 + glancing * 0.08, 0.08, 0.38);
  const knifeStickGrip = clamp((1 - hardness) * 0.42 + squareHit * 0.36 + (key === 'wood' ? 0.34 : 0) + (key === 'metal' || key === 'grate' ? -0.18 : 0), 0.10, 0.94);
  const out = {
    version: SURFACE_IMPACT_FEEL_VERSION,
    key,
    sound: base.sound,
    incidence,
    glancing,
    squareHit,
    hardness,
    impact,
    sparkMul,
    dustMul,
    decalScale,
    scorchMul,
    flashMul,
    ricochetChance,
    missBloom,
    confidenceLoss,
    materialKick,
    playerReadPulse,
    hardSnap,
    dustLift,
    sparkStretchMul,
    microShardCount,
    audioPitch,
    audioGain,
    decalJitter,
    coverDamageMul,
    ricochetTraceLife,
    knifeStickGrip,
    dustLifeMul: clamp(0.84 + dustMul * 0.16 + (key === 'wood' ? 0.12 : 0), 0.62, 1.38),
    sparkLifeMul: clamp(0.84 + sparkMul * 0.12 + glancing * 0.12, 0.60, 1.34),
    label: `${key}${glancing > 0.45 ? '-glance' : '-impact'}`,
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}
