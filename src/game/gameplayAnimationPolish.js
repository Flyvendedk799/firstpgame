export const GAMEPLAY_ANIMATION_POLISH_VERSION = 'gameplay-animation-polish.v6';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function expDamp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-Math.max(0.001, lambda) * Math.max(0, dt || 0));
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function enemyAnimState(enemy) {
  if (!enemy) return null;
  if (!enemy._gameplayAnimationPolish) {
    enemy._gameplayAnimationPolish = {
      version: GAMEPLAY_ANIMATION_POLISH_VERSION,
      hitPulse: 0,
      heavyStumble: 0,
      duckPulse: 0,
      bracePulse: 0,
      limpPulse: 0,
      armPulse: 0,
      headSnapPulse: 0,
      torsoFoldPulse: 0,
      impactFocusPulse: 0,
      guardClutchPulse: 0,
      balanceCatchPulse: 0,
      painLookPulse: 0,
      weaponSlipPulse: 0,
      footShufflePulse: 0,
      rootDragPulse: 0,
      recoveryStepPulse: 0,
      turnLockPulse: 0,
      shotInterruptPulse: 0,
      coverBreakPulse: 0,
      weaponRecoverPulse: 0,
      painTellPulse: 0,
      suppressionFlinch: 0,
      moralePulse: 0,
      panicPulse: 0,
      combatStressPulse: 0,
      combatStressPeak: 0,
      squadCommandPulse: 0,
      squadAdvancePulse: 0,
      squadFlankPulse: 0,
      squadSuppressPulse: 0,
      squadAnchorPulse: 0,
      squadRegroupPulse: 0,
      signalPulse: 0,
      scanPulse: 0,
      resolvePulse: 0,
      hitSide: 1,
      recoverySide: 1,
      limpSide: 0,
      armSide: 0,
      moraleSide: 1,
      stressSide: 1,
      squadSide: 1,
      aimPenalty: 0,
      aimPenaltyUntil: 0,
      limpUntil: 0,
      armUntil: 0,
      moraleUntil: 0,
      combatStressUntil: 0,
      squadCommandUntil: 0,
      lastHitKind: '',
      lastLimbId: '',
      lastMoraleEvent: '',
      lastStressEvent: '',
      lastSquadRole: '',
      lastSquadState: ''
    };
  }
  return enemy._gameplayAnimationPolish;
}

function classifyLimb(limbId, isHead = false) {
  const id = String(limbId || (isHead ? 'head' : 'torso'));
  if (isHead || id === 'head') return 'head';
  if (id === 'neck') return 'neck';
  if (/Arm|Forearm/i.test(id)) return 'arm';
  if (/Thigh|Shin/i.test(id)) return 'leg';
  return 'torso';
}

function limbSide(limbId, fallback = 1) {
  const id = String(limbId || '');
  if (/left/i.test(id)) return -1;
  if (/right/i.test(id)) return 1;
  return fallback || 1;
}

export function recordEnemyHitAnimationPolish(enemy, opts = {}) {
  const st = enemyAnimState(enemy);
  if (!st) return null;
  const t = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  const limbId = opts.limbId || (opts.isHead ? 'head' : 'torso');
  const kind = classifyLimb(limbId, !!opts.isHead);
  const flags = opts.flags || enemy._lastHitFlags || {};
  const damage = clamp(opts.damage, 0, 1000);
  const weight = clamp(
    (Number.isFinite(opts.impactWeight) ? opts.impactWeight : flags.impactWeight) || (damage / 75),
    0.35,
    2.4
  );
  const side = Number.isFinite(opts.side)
    ? opts.side
    : (enemy.staggerDir && Number.isFinite(enemy.staggerDir.x) && Math.abs(enemy.staggerDir.x) > 0.05 ? Math.sign(enemy.staggerDir.x) : 1);
  const heavy = !!(opts.isHead || flags.shotgun || flags.sniper || flags.dmr || damage >= 70 || weight > 1.26 || opts.isMelee);

  st.hitPulse = Math.max(st.hitPulse || 0, clamp(0.34 + weight * 0.24, 0.26, 1.18));
  st.hitSide = side || 1;
  st.recoverySide = side || st.recoverySide || 1;
  st.lastHitKind = kind;
  st.lastLimbId = limbId;
  st.bracePulse = Math.max(st.bracePulse || 0, clamp(0.16 + weight * 0.18, 0.16, 0.86));
  st.impactFocusPulse = Math.max(st.impactFocusPulse || 0, clamp(0.28 + weight * 0.26, 0.22, 1.08));
  st.rootDragPulse = Math.max(st.rootDragPulse || 0, clamp(0.12 + weight * 0.13, 0.10, 0.70));
  st.recoveryStepPulse = Math.max(st.recoveryStepPulse || 0, clamp(0.08 + weight * 0.10, 0.06, 0.52));
  const kindInterrupt = kind === 'head' || kind === 'neck'
    ? 0.34
    : (kind === 'arm' ? 0.30 : (kind === 'torso' ? 0.20 : (kind === 'leg' ? 0.14 : 0.10)));
  st.shotInterruptPulse = Math.max(st.shotInterruptPulse || 0, clamp(kindInterrupt + weight * 0.18 + (heavy ? 0.12 : 0), 0.10, 1.15));
  st.coverBreakPulse = Math.max(st.coverBreakPulse || 0, clamp((kind === 'torso' ? 0.22 : 0.08) + (kind === 'leg' ? 0.14 : 0) + weight * 0.12 + (heavy ? 0.12 : 0), 0.08, 0.92));
  st.weaponRecoverPulse = Math.max(st.weaponRecoverPulse || 0, clamp((kind === 'arm' ? 0.42 : 0.10) + (kind === 'head' || kind === 'neck' ? 0.20 : 0) + weight * 0.13, 0.08, 1.04));
  st.painTellPulse = Math.max(st.painTellPulse || 0, clamp((kind === 'head' || kind === 'neck' ? 0.30 : 0.16) + weight * 0.17 + (heavy ? 0.08 : 0), 0.12, 1.08));

  if (kind === 'head' || kind === 'neck') {
    st.headSnapPulse = Math.max(st.headSnapPulse || 0, clamp(0.58 + weight * 0.30, 0.45, 1.45));
    st.duckPulse = Math.max(st.duckPulse || 0, clamp(0.20 + weight * 0.12, 0.16, 0.78));
    st.painLookPulse = Math.max(st.painLookPulse || 0, clamp(0.42 + weight * 0.24, 0.30, 1.18));
    st.weaponSlipPulse = Math.max(st.weaponSlipPulse || 0, clamp(0.18 + weight * 0.12, 0.12, 0.72));
    st.turnLockPulse = Math.max(st.turnLockPulse || 0, clamp(0.36 + weight * 0.22, 0.24, 1.10));
    st.aimPenalty = Math.max(st.aimPenalty || 0, clamp(0.28 + weight * 0.16, 0.20, 0.72));
    st.aimPenaltyUntil = Math.max(st.aimPenaltyUntil || 0, t + 780 + weight * 260);
  } else if (kind === 'torso') {
    st.torsoFoldPulse = Math.max(st.torsoFoldPulse || 0, clamp(0.30 + weight * 0.24, 0.24, 1.05));
    st.guardClutchPulse = Math.max(st.guardClutchPulse || 0, clamp(0.36 + weight * 0.22, 0.24, 1.08));
    st.balanceCatchPulse = Math.max(st.balanceCatchPulse || 0, clamp(0.16 + weight * 0.12, 0.12, 0.64));
    st.rootDragPulse = Math.max(st.rootDragPulse || 0, clamp(0.22 + weight * 0.16, 0.16, 0.90));
    st.recoveryStepPulse = Math.max(st.recoveryStepPulse || 0, clamp(0.18 + weight * 0.12, 0.12, 0.70));
    st.aimPenalty = Math.max(st.aimPenalty || 0, clamp(0.18 + weight * 0.10, 0.14, 0.54));
    st.aimPenaltyUntil = Math.max(st.aimPenaltyUntil || 0, t + 520 + weight * 220);
  } else if (kind === 'leg') {
    const s = limbSide(limbId, side);
    st.limpSide = s;
    st.limpPulse = Math.max(st.limpPulse || 0, clamp(0.46 + weight * 0.25, 0.34, 1.15));
    st.balanceCatchPulse = Math.max(st.balanceCatchPulse || 0, clamp(0.42 + weight * 0.30, 0.32, 1.28));
    st.footShufflePulse = Math.max(st.footShufflePulse || 0, clamp(0.40 + weight * 0.28, 0.30, 1.20));
    st.rootDragPulse = Math.max(st.rootDragPulse || 0, clamp(0.40 + weight * 0.28, 0.30, 1.28));
    st.recoveryStepPulse = Math.max(st.recoveryStepPulse || 0, clamp(0.48 + weight * 0.32, 0.36, 1.34));
    st.turnLockPulse = Math.max(st.turnLockPulse || 0, clamp(0.24 + weight * 0.16, 0.18, 0.82));
    st.guardClutchPulse = Math.max(st.guardClutchPulse || 0, clamp(0.12 + weight * 0.08, 0.10, 0.46));
    st.limpUntil = Math.max(st.limpUntil || 0, t + 2350 + weight * 1150 + (opts.isMelee ? 650 : 0));
    st.torsoFoldPulse = Math.max(st.torsoFoldPulse || 0, clamp(0.18 + weight * 0.12, 0.16, 0.62));
  } else if (kind === 'arm') {
    const s = limbSide(limbId, side);
    st.armSide = s;
    st.armPulse = Math.max(st.armPulse || 0, clamp(0.48 + weight * 0.24, 0.34, 1.20));
    st.weaponSlipPulse = Math.max(st.weaponSlipPulse || 0, clamp(0.46 + weight * 0.25, 0.34, 1.22));
    st.guardClutchPulse = Math.max(st.guardClutchPulse || 0, clamp(0.20 + weight * 0.15, 0.16, 0.78));
    st.painLookPulse = Math.max(st.painLookPulse || 0, clamp(0.16 + weight * 0.08, 0.10, 0.54));
    st.turnLockPulse = Math.max(st.turnLockPulse || 0, clamp(0.22 + weight * 0.14, 0.16, 0.76));
    st.armUntil = Math.max(st.armUntil || 0, t + 2600 + weight * 1200 + (opts.isMelee ? 600 : 0));
    st.aimPenalty = Math.max(st.aimPenalty || 0, clamp(0.34 + weight * 0.18, 0.24, 0.82));
    st.aimPenaltyUntil = Math.max(st.aimPenaltyUntil || 0, t + 1550 + weight * 700);
  }

  if (heavy) {
    st.heavyStumble = Math.max(st.heavyStumble || 0, clamp(0.32 + weight * 0.30, 0.28, 1.22));
    st.duckPulse = Math.max(st.duckPulse || 0, clamp(0.20 + weight * 0.14, 0.16, 0.88));
    st.balanceCatchPulse = Math.max(st.balanceCatchPulse || 0, clamp(0.22 + weight * 0.16, 0.18, 0.82));
    st.footShufflePulse = Math.max(st.footShufflePulse || 0, clamp(0.16 + weight * 0.12, 0.12, 0.68));
    st.rootDragPulse = Math.max(st.rootDragPulse || 0, clamp(0.28 + weight * 0.22, 0.22, 1.08));
    st.recoveryStepPulse = Math.max(st.recoveryStepPulse || 0, clamp(0.24 + weight * 0.20, 0.18, 1.0));
  }

  enemy.group && (enemy.group.userData.gameplayAnimationPolish = buildEnemyAnimationPolishSnapshot(enemy));
  return st;
}

export function buildEnemyHitReactionProfile(enemy, opts = {}) {
  const limbId = opts.limbId || (opts.isHead ? 'head' : 'torso');
  const kind = classifyLimb(limbId, !!opts.isHead);
  const flags = opts.flags || (enemy && enemy._lastHitFlags) || {};
  const damage = clamp(opts.damage, 0, 1000);
  const weight = clamp(
    (Number.isFinite(opts.impactWeight) ? opts.impactWeight : flags.impactWeight) || (damage / 75),
    0.35,
    2.4
  );
  const type = String(opts.type || (enemy && enemy.type) || 'soldier');
  const side = Number.isFinite(opts.side)
    ? opts.side
    : (enemy && enemy.staggerDir && Number.isFinite(enemy.staggerDir.x) && Math.abs(enemy.staggerDir.x) > 0.05 ? Math.sign(enemy.staggerDir.x) : limbSide(limbId, 1));
  const armored = type === 'heavy' || type === 'riot' || type === 'shielded' || type === 'boss';
  const melee = !!opts.isMelee;
  const heavyWeapon = !!(flags.shotgun || flags.sniper || flags.dmr || flags.pistolHeavy || flags.takedown || flags.closeCombat === 'knife_heavy_stab');
  const heavy = !!(opts.isHead || melee || heavyWeapon || damage >= 64 || weight > 1.24);
  const severe = !!(opts.isHead || flags.shotgun || flags.sniper || damage >= 92 || weight > 1.52 || flags.closeCombat === 'knife_heavy_stab');
  const armorAbsorb = armored ? (type === 'boss' ? 0.74 : 0.82) : 1;
  const limbBreak = kind === 'leg' || kind === 'arm';
  const impactClass = severe ? 'break' : (heavy ? 'heavy' : (damage > 26 || limbBreak ? 'clean' : 'graze'));
  const classPower = impactClass === 'break' ? 1 : (impactClass === 'heavy' ? 0.76 : (impactClass === 'clean' ? 0.48 : 0.24));
  const directional = clamp01(Math.abs(side || 0));
  const weaponDrop = clamp01((kind === 'arm' ? 0.58 : 0.18) + classPower * 0.34 + (melee ? 0.18 : 0) + (armored ? -0.12 : 0));
  const kneeBuckle = clamp01((kind === 'leg' ? 0.68 : 0.12) + classPower * 0.30 + (flags.shotgun ? 0.20 : 0) + (armored ? -0.10 : 0));
  const headWhip = clamp01((kind === 'head' || kind === 'neck' ? 0.76 : 0.10) + classPower * 0.24 + (flags.sniper ? 0.16 : 0));
  const torsoFold = clamp01((kind === 'torso' ? 0.46 : 0.16) + classPower * 0.32 + (melee ? 0.18 : 0));
  const shoulderWhip = clamp01((kind === 'arm' ? 0.52 : 0.24) + classPower * 0.30 + directional * 0.10);
  const coverBreak = clamp01(classPower * 0.42 + weaponDrop * 0.22 + headWhip * 0.18 + (flags.shotgun ? 0.18 : 0) + (armored ? -0.08 : 0));
  const aimBreak = clamp01(weaponDrop * 0.42 + headWhip * 0.34 + torsoFold * 0.18 + kneeBuckle * 0.14 + classPower * 0.18);
  const guardClutch = clamp01((kind === 'torso' ? 0.48 : 0.12) + torsoFold * 0.38 + classPower * 0.18 + (melee ? 0.16 : 0));
  const balanceLoss = clamp01((kind === 'leg' ? 0.58 : 0.12) + kneeBuckle * 0.42 + classPower * 0.20 + (flags.shotgun ? 0.16 : 0) + (armored ? -0.10 : 0));
  const weaponSlip = clamp01((kind === 'arm' ? 0.60 : 0.12) + weaponDrop * 0.44 + headWhip * 0.12 + classPower * 0.12);
  const painLook = clamp01((kind === 'head' || kind === 'neck' ? 0.54 : 0.12) + headWhip * 0.38 + shoulderWhip * 0.10 + classPower * 0.12);
  const footShuffle = clamp01(balanceLoss * 0.58 + kneeBuckle * 0.30 + (severe ? 0.10 : 0));
  const attackInterrupt = clamp01(aimBreak * 0.38 + weaponSlip * 0.28 + headWhip * 0.26 + torsoFold * 0.12 + kneeBuckle * 0.10 + classPower * 0.18);
  const weaponRecovery = clamp01(weaponSlip * 0.48 + weaponDrop * 0.34 + shoulderWhip * 0.18 + (kind === 'arm' ? 0.20 : 0));
  const painTell = clamp01(painLook * 0.34 + guardClutch * 0.24 + torsoFold * 0.22 + kneeBuckle * 0.16 + headWhip * 0.18);
  const reactionLockMs = Math.round(clamp(90 + attackInterrupt * 260 + weaponRecovery * 210 + painTell * 120 + (severe ? 80 : 0), 80, 640));
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    kind,
    limbId,
    impactClass,
    damage,
    weight,
    side: side || 1,
    armored,
    melee,
    heavy,
    severe,
    armorAbsorb,
    staggerMul: clamp((0.86 + classPower * 0.42 + (limbBreak ? 0.08 : 0)) * armorAbsorb, 0.62, 1.44),
    impactStrengthMul: clamp((0.94 + classPower * 0.24 + (severe ? 0.12 : 0)) * armorAbsorb, 0.74, 1.42),
    snapDur: clamp(0.045 + classPower * 0.055 + (opts.isHead ? 0.028 : 0), 0.040, 0.155),
    snapStrength: clamp(0.44 + classPower * 0.92 + weight * 0.18 + (opts.isHead ? 0.30 : 0), 0.36, 2.35),
    hitStopMs: Math.round(clamp(12 + classPower * 28 + (opts.isHead ? 12 : 0) + (melee ? 6 : 0), 10, 72)),
    flinchDur: clamp(0.13 + classPower * 0.10 + (limbBreak ? 0.04 : 0), 0.12, 0.34),
    pushMul: clamp((0.82 + classPower * 0.44 + (flags.shotgun ? 0.26 : 0)) * armorAbsorb, 0.54, 1.62),
    weaponDrop,
    kneeBuckle,
    headWhip,
    torsoFold,
    shoulderWhip,
    guardClutch,
    balanceLoss,
    weaponSlip,
    painLook,
    footShuffle,
    attackInterrupt,
    weaponRecovery,
    painTell,
    reactionLockMs,
    impactFocus: clamp01(0.30 + classPower * 0.46 + weight * 0.08),
    aimBreak,
    coverBreak
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function recordEnemySuppressionAnimationPolish(enemy, opts = {}) {
  const st = enemyAnimState(enemy);
  if (!st) return null;
  const t = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  const strength = clamp(opts.strength, 0.05, 1.35);
  const side = Number.isFinite(opts.side) ? opts.side : (Math.random() < 0.5 ? -1 : 1);
  st.suppressionFlinch = Math.max(st.suppressionFlinch || 0, clamp(0.22 + strength * 0.35, 0.18, 1.0));
  st.duckPulse = Math.max(st.duckPulse || 0, clamp(0.18 + strength * 0.20, 0.14, 0.86));
  st.bracePulse = Math.max(st.bracePulse || 0, clamp(0.18 + strength * 0.16, 0.12, 0.72));
  st.hitSide = side || st.hitSide || 1;
  st.aimPenalty = Math.max(st.aimPenalty || 0, clamp(0.16 + strength * 0.16, 0.12, 0.52));
  st.aimPenaltyUntil = Math.max(st.aimPenaltyUntil || 0, t + 620 + strength * 380);
  enemy.group && (enemy.group.userData.gameplayAnimationPolish = buildEnemyAnimationPolishSnapshot(enemy));
  return st;
}

export function buildEnemySuppressionNearMissSnapshot(opts = {}) {
  const prox = clamp01(opts.prox);
  const pressure = clamp(opts.pressure, 0.1, 2.4);
  const quality = clamp01(opts.quality);
  const rough = !!opts.rough;
  const type = String(opts.type || 'soldier');
  const armored = type === 'heavy' || type === 'riot' || type === 'shielded' || type === 'boss';
  const marksman = type === 'sniper' || type === 'marksman';
  const severity = clamp01(prox * 0.72 + pressure * 0.18 + quality * 0.08 + (rough ? 0.06 : 0));
  const nerveMul = armored ? 0.82 : (marksman ? 1.12 : 1.0);
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    prox,
    pressure,
    quality,
    rough,
    type,
    severity,
    durationMs: Math.round(clamp(420 + severity * 1040 * nerveMul + prox * pressure * 240, 360, 2100)),
    aimDrop: clamp((0.055 + prox * 0.18 + severity * 0.075) * nerveMul, 0.04, 0.42),
    shootDelay: clamp(0.08 + prox * 0.34 + severity * 0.10, 0.06, 0.62),
    burstDelay: clamp(0.045 + prox * 0.18 + severity * 0.06, 0.03, 0.38),
    flinch: clamp01(0.20 + prox * 0.60 + quality * 0.10 + (rough ? 0.06 : 0)),
    readability: clamp01(0.12 + prox * 0.48 + quality * 0.24 + severity * 0.08),
    peekBreak: prox > (armored ? 0.52 : 0.38),
    coverBias: clamp01(severity * 0.70 + (marksman ? 0.16 : 0) - (armored ? 0.08 : 0)),
    label: severity > 0.78 ? 'pinned' : (prox > 0.42 ? 'near-miss' : 'suppressed'),
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function recordEnemyMoraleAnimationPolish(enemy, opts = {}) {
  const st = enemyAnimState(enemy);
  if (!st) return null;
  const t = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  const kind = String(opts.kind || 'ally_down');
  const strength = clamp(opts.strength, 0.05, 1.75);
  const side = Number.isFinite(opts.side) ? opts.side : (Math.random() < 0.5 ? -1 : 1);

  st.moralePulse = Math.max(st.moralePulse || 0, clamp(0.18 + strength * 0.24, 0.16, 0.92));
  st.moraleSide = side || st.moraleSide || 1;
  st.moraleUntil = Math.max(st.moraleUntil || 0, t + 620 + strength * 520);
  st.lastMoraleEvent = kind;

  if (kind === 'ally_down' || kind === 'corpse_seen') {
    st.panicPulse = Math.max(st.panicPulse || 0, clamp(0.26 + strength * 0.42, 0.22, 1.15));
    st.scanPulse = Math.max(st.scanPulse || 0, clamp(0.28 + strength * 0.22, 0.18, 0.92));
    st.duckPulse = Math.max(st.duckPulse || 0, clamp(0.10 + strength * 0.12, 0.08, 0.46));
    st.bracePulse = Math.max(st.bracePulse || 0, clamp(0.12 + strength * 0.10, 0.08, 0.50));
    st.aimPenalty = Math.max(st.aimPenalty || 0, clamp(0.12 + strength * 0.13, 0.10, 0.46));
    st.aimPenaltyUntil = Math.max(st.aimPenaltyUntil || 0, t + 560 + strength * 470);
  } else if (kind === 'signal' || kind === 'leader_call') {
    st.signalPulse = Math.max(st.signalPulse || 0, clamp(0.38 + strength * 0.30, 0.28, 1.0));
    st.scanPulse = Math.max(st.scanPulse || 0, clamp(0.22 + strength * 0.24, 0.18, 0.85));
    st.resolvePulse = Math.max(st.resolvePulse || 0, clamp(0.14 + strength * 0.12, 0.10, 0.52));
  } else if (kind === 'resolve' || kind === 'push') {
    st.resolvePulse = Math.max(st.resolvePulse || 0, clamp(0.30 + strength * 0.32, 0.24, 1.0));
    st.signalPulse = Math.max(st.signalPulse || 0, clamp(0.10 + strength * 0.16, 0.08, 0.52));
  }

  enemy.group && (enemy.group.userData.gameplayAnimationPolish = buildEnemyAnimationPolishSnapshot(enemy));
  return st;
}

export function recordEnemyCombatStressAnimationPolish(enemy, opts = {}) {
  const st = enemyAnimState(enemy);
  if (!st) return null;
  const t = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  const kind = String(opts.kind || opts.reason || 'pressure');
  const strength = clamp(opts.strength, 0.04, 1.85);
  const side = Number.isFinite(opts.side) ? opts.side : (enemy && Number.isFinite(enemy.strafeDir) ? Math.sign(enemy.strafeDir) || 1 : 1);
  const hpRatio = enemy && Number.isFinite(enemy.hp) && Number.isFinite(enemy.maxHp) ? clamp01(enemy.hp / Math.max(1, enemy.maxHp)) : 1;
  const wounded = kind === 'wounded' || kind === 'finishable' || hpRatio < 0.45;
  const pinned = kind === 'pinned' || kind === 'near-miss' || kind === 'suppressed' || kind === 'story-suppression';
  const closeCombat = /knife|takedown|melee|bash/i.test(kind);
  const stress = clamp(0.12 + strength * (pinned ? 0.44 : 0.34) + (wounded ? 0.18 : 0) + (closeCombat ? 0.14 : 0), 0.10, 1.12);
  st.combatStressPulse = Math.max(st.combatStressPulse || 0, stress);
  st.combatStressPeak = Math.max(st.combatStressPeak || 0, stress);
  st.combatStressUntil = Math.max(st.combatStressUntil || 0, t + 520 + strength * (pinned ? 980 : 720) + (wounded ? 560 : 0));
  st.stressSide = side || st.stressSide || 1;
  st.lastStressEvent = kind;
  st.bracePulse = Math.max(st.bracePulse || 0, clamp(0.10 + strength * 0.12, 0.08, 0.58));
  st.scanPulse = Math.max(st.scanPulse || 0, clamp(0.10 + strength * (pinned ? 0.24 : 0.14), 0.08, 0.72));
  if (pinned) {
    st.duckPulse = Math.max(st.duckPulse || 0, clamp(0.12 + strength * 0.24, 0.10, 0.78));
    st.suppressionFlinch = Math.max(st.suppressionFlinch || 0, clamp(0.16 + strength * 0.30, 0.12, 0.92));
  }
  if (wounded) {
    st.guardClutchPulse = Math.max(st.guardClutchPulse || 0, clamp(0.16 + strength * 0.18, 0.12, 0.78));
    st.recoveryStepPulse = Math.max(st.recoveryStepPulse || 0, clamp(0.12 + strength * 0.14, 0.08, 0.72));
    st.rootDragPulse = Math.max(st.rootDragPulse || 0, clamp(0.12 + strength * 0.16, 0.08, 0.84));
  }
  if (closeCombat) {
    st.turnLockPulse = Math.max(st.turnLockPulse || 0, clamp(0.18 + strength * 0.18, 0.12, 0.82));
    st.painLookPulse = Math.max(st.painLookPulse || 0, clamp(0.14 + strength * 0.14, 0.10, 0.70));
  }
  st.aimPenalty = Math.max(st.aimPenalty || 0, clamp(0.08 + strength * 0.16 + (pinned ? 0.05 : 0) + (wounded ? 0.06 : 0), 0.08, 0.58));
  st.aimPenaltyUntil = Math.max(st.aimPenaltyUntil || 0, t + 380 + strength * 560);
  enemy.group && (enemy.group.userData.gameplayAnimationPolish = buildEnemyAnimationPolishSnapshot(enemy));
  return st;
}

export function recordEnemySquadCommandAnimationPolish(enemy, opts = {}) {
  const st = enemyAnimState(enemy);
  if (!st) return null;
  const t = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  const role = String(opts.role || opts.directive && opts.directive.role || enemy._squadRole || 'support');
  const state = String(opts.state || opts.directive && opts.directive.state || enemy._squadDirective && enemy._squadDirective.state || 'advance');
  const directive = opts.directive || enemy._squadDirective || {};
  const strength = clamp(
    Number.isFinite(opts.strength)
      ? opts.strength
      : (0.24 + clamp01(directive.readability || 0) * 0.62 + (opts.orderChanged ? 0.20 : 0)),
    0.05,
    1.65
  );
  const side = Number.isFinite(opts.side)
    ? opts.side
    : (Number.isFinite(directive.side) ? directive.side : (enemy && Number.isFinite(enemy.strafeDir) ? Math.sign(enemy.strafeDir) || 1 : 1));
  const flank = role === 'flanker' || state === 'flank' || clamp01(directive.flankBias || 0) > 0.44;
  const suppress = role === 'suppressor' || state === 'suppress' || clamp01(directive.suppressBias || 0) > 0.44;
  const anchor = role === 'leader' || role === 'anchor' || state === 'hold' || clamp01(directive.coverBias || 0) > 0.50;
  const regroup = state === 'regroup' || clamp01(directive.regroupNeed || 0) > 0.46;
  const advance = role === 'breacher' || state === 'advance' || clamp01(directive.advanceBias || 0) > 0.42;

  st.squadCommandPulse = Math.max(st.squadCommandPulse || 0, clamp(0.18 + strength * 0.42, 0.14, 1.08));
  st.squadSide = side || st.squadSide || 1;
  st.squadCommandUntil = Math.max(st.squadCommandUntil || 0, t + 560 + strength * 620);
  st.lastSquadRole = role;
  st.lastSquadState = state;
  if (flank) {
    st.squadFlankPulse = Math.max(st.squadFlankPulse || 0, clamp(0.20 + strength * 0.42, 0.16, 1.12));
    st.signalPulse = Math.max(st.signalPulse || 0, clamp(0.18 + strength * 0.26, 0.14, 0.86));
  }
  if (suppress) {
    st.squadSuppressPulse = Math.max(st.squadSuppressPulse || 0, clamp(0.22 + strength * 0.38, 0.18, 1.08));
    st.resolvePulse = Math.max(st.resolvePulse || 0, clamp(0.14 + strength * 0.20, 0.10, 0.66));
    st.bracePulse = Math.max(st.bracePulse || 0, clamp(0.10 + strength * 0.12, 0.08, 0.54));
  }
  if (anchor) {
    st.squadAnchorPulse = Math.max(st.squadAnchorPulse || 0, clamp(0.20 + strength * 0.34, 0.16, 1.02));
    st.scanPulse = Math.max(st.scanPulse || 0, clamp(0.16 + strength * 0.22, 0.12, 0.74));
  }
  if (advance) {
    st.squadAdvancePulse = Math.max(st.squadAdvancePulse || 0, clamp(0.18 + strength * 0.36, 0.14, 1.02));
    st.resolvePulse = Math.max(st.resolvePulse || 0, clamp(0.12 + strength * 0.18, 0.08, 0.58));
  }
  if (regroup) {
    st.squadRegroupPulse = Math.max(st.squadRegroupPulse || 0, clamp(0.20 + strength * 0.42, 0.16, 1.08));
    st.scanPulse = Math.max(st.scanPulse || 0, clamp(0.20 + strength * 0.24, 0.14, 0.82));
    st.duckPulse = Math.max(st.duckPulse || 0, clamp(0.08 + strength * 0.12, 0.06, 0.48));
  }
  enemy.group && (enemy.group.userData.gameplayAnimationPolish = buildEnemyAnimationPolishSnapshot(enemy));
  return st;
}

export function tickEnemyAnimationPolish(enemy, dt, opts = {}, dampFn = expDamp) {
  const st = enemyAnimState(enemy);
  if (!st) return null;
  const t = Number.isFinite(opts.nowMs) ? opts.nowMs : nowMs();
  for (const key of ['hitPulse', 'heavyStumble', 'duckPulse', 'bracePulse', 'limpPulse', 'armPulse', 'headSnapPulse', 'torsoFoldPulse', 'impactFocusPulse', 'guardClutchPulse', 'balanceCatchPulse', 'painLookPulse', 'weaponSlipPulse', 'footShufflePulse', 'rootDragPulse', 'recoveryStepPulse', 'turnLockPulse', 'shotInterruptPulse', 'coverBreakPulse', 'weaponRecoverPulse', 'painTellPulse', 'suppressionFlinch', 'moralePulse', 'panicPulse', 'combatStressPulse', 'combatStressPeak', 'squadCommandPulse', 'squadAdvancePulse', 'squadFlankPulse', 'squadSuppressPulse', 'squadAnchorPulse', 'squadRegroupPulse', 'signalPulse', 'scanPulse', 'resolvePulse']) {
    const lambda = key === 'heavyStumble' || key === 'balanceCatchPulse' || key === 'rootDragPulse' ? 3.4 : (key === 'combatStressPulse' || key === 'combatStressPeak' ? 2.9 : (/^squad/.test(key) ? 3.8 : (key === 'recoveryStepPulse' || key === 'footShufflePulse' || key === 'weaponRecoverPulse' ? 4.0 : (key === 'turnLockPulse' || key === 'shotInterruptPulse' || key === 'coverBreakPulse' ? 4.6 : (key === 'panicPulse' ? 3.2 : (key === 'scanPulse' || key === 'signalPulse' ? 4.2 : 5.8))))));
    st[key] = dampFn(Number.isFinite(st[key]) ? st[key] : 0, 0, lambda, dt);
  }
  if (t > (st.aimPenaltyUntil || 0)) st.aimPenalty = dampFn(st.aimPenalty || 0, 0, 3.8, dt);
  const snap = buildEnemyAnimationPolishSnapshot(enemy, t);
  enemy._gameplayAnimationPolishSnapshot = snap;
  if (enemy.group) enemy.group.userData.gameplayAnimationPolish = snap;
  return snap;
}

export function buildEnemyAnimationPolishSnapshot(enemy, t = nowMs()) {
  const st = enemy && enemy._gameplayAnimationPolish;
  if (!st) {
    return {
      version: GAMEPLAY_ANIMATION_POLISH_VERSION,
      active: false,
      finite: true
    };
  }
  const limpWindow = Math.max(0, (st.limpUntil || 0) - t);
  const armWindow = Math.max(0, (st.armUntil || 0) - t);
  const aimWindow = Math.max(0, (st.aimPenaltyUntil || 0) - t);
  const moraleWindow = Math.max(0, (st.moraleUntil || 0) - t);
  const stressWindow = Math.max(0, (st.combatStressUntil || 0) - t);
  const squadWindow = Math.max(0, (st.squadCommandUntil || 0) - t);
  const disabledLimbIds = enemy && enemy.limbRig
    ? Object.keys(enemy.limbRig).filter((id) => enemy.limbRig[id] && enemy.limbRig[id].disabled)
    : [];
  const disabledLeg = disabledLimbIds.find((id) => /Thigh|Shin/i.test(id));
  const disabledArm = disabledLimbIds.find((id) => /Arm|Forearm/i.test(id));
  const limp = clamp01(Math.max(
    st.limpPulse || 0,
    limpWindow > 0 ? 0.34 + Math.min(0.46, limpWindow / 5400) : 0,
    disabledLeg ? 0.44 : 0
  ));
  const arm = clamp01(Math.max(
    st.armPulse || 0,
    armWindow > 0 ? 0.34 + Math.min(0.42, armWindow / 5600) : 0,
    disabledArm ? 0.48 : 0
  ));
  const aimPenalty = clamp01(Math.max(
    st.aimPenalty || 0,
    aimWindow > 0 ? Math.min(0.70, aimWindow / 3600) : 0,
    arm * 0.48,
    (st.suppressionFlinch || 0) * 0.30,
    (st.panicPulse || 0) * 0.22,
    (st.combatStressPulse || 0) * 0.28
  ));
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    active: true,
    hitPulse: clamp01(st.hitPulse || 0),
    heavyStumble: clamp01(st.heavyStumble || 0),
    duckPulse: clamp01(st.duckPulse || 0),
    bracePulse: clamp01(st.bracePulse || 0),
    limp,
    limpSide: st.limpSide || limbSide(disabledLeg, 0),
    arm,
    armSide: st.armSide || limbSide(disabledArm, 0),
    headSnapPulse: clamp01(st.headSnapPulse || 0),
    torsoFoldPulse: clamp01(st.torsoFoldPulse || 0),
    impactFocusPulse: clamp01(st.impactFocusPulse || 0),
    guardClutchPulse: clamp01(st.guardClutchPulse || 0),
    balanceCatchPulse: clamp01(st.balanceCatchPulse || 0),
    painLookPulse: clamp01(st.painLookPulse || 0),
    weaponSlipPulse: clamp01(st.weaponSlipPulse || 0),
    footShufflePulse: clamp01(st.footShufflePulse || 0),
    rootDragPulse: clamp01(st.rootDragPulse || 0),
    recoveryStepPulse: clamp01(st.recoveryStepPulse || 0),
    turnLockPulse: clamp01(st.turnLockPulse || 0),
    shotInterruptPulse: clamp01(st.shotInterruptPulse || 0),
    coverBreakPulse: clamp01(st.coverBreakPulse || 0),
    weaponRecoverPulse: clamp01(st.weaponRecoverPulse || 0),
    painTellPulse: clamp01(st.painTellPulse || 0),
    suppressionFlinch: clamp01(st.suppressionFlinch || 0),
    combatStress: clamp01(Math.max(st.combatStressPulse || 0, stressWindow > 0 ? Math.min(0.58, stressWindow / 3600) : 0)),
    combatStressPeak: clamp01(st.combatStressPeak || 0),
    stressSide: st.stressSide || 1,
    squadCommandPulse: clamp01(Math.max(st.squadCommandPulse || 0, squadWindow > 0 ? Math.min(0.46, squadWindow / 2800) : 0)),
    squadAdvancePulse: clamp01(st.squadAdvancePulse || 0),
    squadFlankPulse: clamp01(st.squadFlankPulse || 0),
    squadSuppressPulse: clamp01(st.squadSuppressPulse || 0),
    squadAnchorPulse: clamp01(st.squadAnchorPulse || 0),
    squadRegroupPulse: clamp01(st.squadRegroupPulse || 0),
    squadSide: st.squadSide || 1,
    moralePulse: clamp01(Math.max(st.moralePulse || 0, moraleWindow > 0 ? Math.min(0.42, moraleWindow / 3000) : 0)),
    panicPulse: clamp01(st.panicPulse || 0),
    signalPulse: clamp01(st.signalPulse || 0),
    scanPulse: clamp01(st.scanPulse || 0),
    resolvePulse: clamp01(st.resolvePulse || 0),
    hitSide: st.hitSide || 1,
    recoverySide: st.recoverySide || st.hitSide || 1,
    moraleSide: st.moraleSide || 1,
    aimPenalty,
    lastHitKind: st.lastHitKind || '',
    lastLimbId: st.lastLimbId || '',
    lastMoraleEvent: st.lastMoraleEvent || '',
    lastStressEvent: st.lastStressEvent || '',
    lastSquadRole: st.lastSquadRole || '',
    lastSquadState: st.lastSquadState || '',
    limpMsLeft: Math.round(limpWindow),
    armMsLeft: Math.round(armWindow),
    aimPenaltyMsLeft: Math.round(aimWindow),
    moraleMsLeft: Math.round(moraleWindow),
    combatStressMsLeft: Math.round(stressWindow),
    squadCommandMsLeft: Math.round(squadWindow)
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function buildEnemyCombatResponseSnapshot(enemy, t = nowMs()) {
  const snap = buildEnemyAnimationPolishSnapshot(enemy, t);
  if (!snap || !snap.active) {
    return {
      version: GAMEPLAY_ANIMATION_POLISH_VERSION,
      active: false,
      movementMul: 1,
      aimMul: 1,
      fireDelayMul: 1,
      coverBias: 0,
      finite: true
    };
  }
  const hit = clamp01(snap.hitPulse || 0);
  const stumble = clamp01(snap.heavyStumble || 0);
  const limp = clamp01(snap.limp || 0);
  const arm = clamp01(snap.arm || 0);
  const duck = clamp01(snap.duckPulse || 0);
  const suppression = clamp01(snap.suppressionFlinch || 0);
  const combatStress = clamp01(snap.combatStress || 0);
  const combatStressPeak = clamp01(snap.combatStressPeak || 0);
  const squadCommand = clamp01(snap.squadCommandPulse || 0);
  const squadAdvance = clamp01(snap.squadAdvancePulse || 0);
  const squadFlank = clamp01(snap.squadFlankPulse || 0);
  const squadSuppress = clamp01(snap.squadSuppressPulse || 0);
  const squadAnchor = clamp01(snap.squadAnchorPulse || 0);
  const squadRegroup = clamp01(snap.squadRegroupPulse || 0);
  const panic = clamp01(snap.panicPulse || 0);
  const brace = clamp01(snap.bracePulse || 0);
  const impactFocus = clamp01(snap.impactFocusPulse || 0);
  const guardClutch = clamp01(snap.guardClutchPulse || 0);
  const balanceCatch = clamp01(snap.balanceCatchPulse || 0);
  const weaponSlip = clamp01(snap.weaponSlipPulse || 0);
  const footShuffle = clamp01(snap.footShufflePulse || 0);
  const rootDrag = clamp01(snap.rootDragPulse || 0);
  const recoveryStep = clamp01(snap.recoveryStepPulse || 0);
  const turnLock = clamp01(snap.turnLockPulse || 0);
  const headSnap = clamp01(snap.headSnapPulse || 0);
  const torsoFold = clamp01(snap.torsoFoldPulse || 0);
  const painLook = clamp01(snap.painLookPulse || 0);
  const shotInterruptPulse = clamp01(snap.shotInterruptPulse || 0);
  const coverBreakPulse = clamp01(snap.coverBreakPulse || 0);
  const weaponRecoverPulse = clamp01(snap.weaponRecoverPulse || 0);
  const painTellPulse = clamp01(snap.painTellPulse || 0);
  const aimPenalty = clamp01(snap.aimPenalty || 0);
  const resolve = clamp01(snap.resolvePulse || 0);
  const shotInterrupt = clamp01(shotInterruptPulse * 0.52 + weaponSlip * 0.24 + arm * 0.18 + headSnap * 0.16 + stumble * 0.18 + impactFocus * 0.12 + turnLock * 0.10 - squadAdvance * 0.08 - resolve * 0.06);
  const weaponRecovery = clamp01(weaponRecoverPulse * 0.58 + weaponSlip * 0.30 + arm * 0.28 + brace * 0.08 - squadSuppress * 0.07 - resolve * 0.05);
  const painTell = clamp01(painTellPulse * 0.58 + painLook * 0.30 + guardClutch * 0.22 + torsoFold * 0.18 + recoveryStep * 0.10 + combatStress * 0.08);
  const coverBreak = clamp01(coverBreakPulse * 0.52 + suppression * 0.22 + guardClutch * 0.18 + balanceCatch * 0.16 + rootDrag * 0.12 + combatStress * 0.16 + squadAnchor * 0.10 - squadFlank * 0.06 - resolve * 0.08);

  const movementPenalty = clamp01(
    limp * 0.42 +
    stumble * 0.26 +
    rootDrag * 0.28 +
    recoveryStep * 0.24 +
    painTell * 0.08 +
    balanceCatch * 0.18 +
    footShuffle * 0.16 +
    turnLock * 0.10 +
    duck * 0.12 +
    hit * 0.10 +
    suppression * 0.16 -
    combatStress * 0.13 -
    resolve * 0.10 -
    squadAdvance * 0.10 -
    squadFlank * 0.08 +
    squadAnchor * 0.04 +
    squadRegroup * 0.12
  );
  const aimPenaltyTotal = clamp01(
    aimPenalty * 0.60 +
    arm * 0.28 +
    weaponSlip * 0.26 +
    weaponRecovery * 0.20 +
    shotInterrupt * 0.16 +
    turnLock * 0.20 +
    impactFocus * 0.10 +
    stumble * 0.20 +
    suppression * 0.20 +
    combatStress * 0.24 +
    combatStressPeak * 0.08 +
    panic * 0.16 -
    brace * 0.08 -
    resolve * 0.10 -
    squadSuppress * 0.10 -
    squadAnchor * 0.08 -
    squadCommand * 0.04 +
    squadRegroup * 0.10
  );
  const fireDelay = clamp01(
    arm * 0.34 +
    weaponSlip * 0.32 +
    shotInterrupt * 0.30 +
    weaponRecovery * 0.22 +
    turnLock * 0.18 +
    recoveryStep * 0.10 +
    stumble * 0.30 +
    suppression * 0.30 +
    combatStress * 0.34 +
    panic * 0.16 +
    duck * 0.12 -
    squadSuppress * 0.16 -
    squadAdvance * 0.08 +
    squadRegroup * 0.18
  );
  const coverBias = clamp01(
    suppression * 0.58 +
    panic * 0.42 +
    guardClutch * 0.24 +
    coverBreak * 0.32 +
    balanceCatch * 0.18 +
    recoveryStep * 0.16 +
    rootDrag * 0.14 +
    stumble * 0.32 +
    limp * 0.20 -
    resolve * 0.20 +
    combatStress * 0.38 +
    squadAnchor * 0.34 +
    squadSuppress * 0.18 +
    squadRegroup * 0.30 -
    squadFlank * 0.12 -
    squadAdvance * 0.06
  );
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    active: true,
    movementMul: clamp(1 - movementPenalty, 0.38, 1.08),
    aimMul: clamp(1 - aimPenaltyTotal, 0.22, 1.08),
    fireDelayMul: clamp(1 + fireDelay * 1.65, 1, 2.65),
    coverBias,
    shotInterrupt,
    weaponRecovery,
    painTell,
    coverBreak,
    reactionLockMs: Math.round(clamp(80 + shotInterrupt * 260 + weaponRecovery * 220 + painTell * 110 + coverBreak * 120, 0, 680)),
    movementPenalty,
    aimPenalty: aimPenaltyTotal,
    source: {
      hit,
      stumble,
      limp,
      arm,
      impactFocus,
      guardClutch,
      balanceCatch,
      weaponSlip,
      footShuffle,
      rootDrag,
      recoveryStep,
      turnLock,
      headSnap,
      torsoFold,
      painLook,
      shotInterrupt: shotInterruptPulse,
      coverBreak: coverBreakPulse,
      weaponRecover: weaponRecoverPulse,
      painTell: painTellPulse,
      suppression,
      combatStress,
      combatStressPeak,
      stressSide: snap.stressSide || 1,
      squadCommand,
      squadAdvance,
      squadFlank,
      squadSuppress,
      squadAnchor,
      squadRegroup,
      squadSide: snap.squadSide || 1,
      panic,
      resolve
    }
  };
  out.finite = Object.values(out)
    .concat(Object.values(out.source))
    .every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function buildEnemyIntentAnimationSnapshot(enemy, opts = {}) {
  const type = String(opts.type || (enemy && enemy.type) || 'soldier');
  const poseState = String(opts.poseState || (enemy && enemy.animationState) || 'idle');
  const movementMode = String(opts.movementMode || (enemy && enemy._movementMode) || '');
  const aimReady = clamp01(opts.aimReady != null ? opts.aimReady : (enemy && enemy.aimReady));
  const peekAmt = clamp01(opts.peekAmt != null ? opts.peekAmt : (enemy && enemy.peekAmt));
  const reloadTimer = clamp(opts.reloadTimer != null ? opts.reloadTimer : (enemy && enemy.enemyReloadTimer), 0, 8);
  const shootRecoilTimer = clamp(opts.shootRecoilTimer != null ? opts.shootRecoilTimer : (enemy && enemy.shootRecoilTimer), 0, 2);
  const speed = clamp(opts.speed != null ? opts.speed : (enemy && (enemy._moveSpeedVis || enemy.speed)), 0, 12);
  const hpRatio = clamp01(opts.hpRatio != null ? opts.hpRatio : (enemy && enemy.maxHp ? enemy.hp / Math.max(1, enemy.maxHp) : 1));
  const atCover = !!(opts.atCover != null ? opts.atCover : (enemy && enemy.atCover));
  const suppressed = !!opts.suppressed || /suppressed|suppress/i.test(poseState) || !!(enemy && enemy._suppressedUntil && nowMs() < enemy._suppressedUntil);
  const storyDirector = opts.storyDirector || (enemy && enemy._storyDirectorModifier) || {};
  const storyBeat = opts.storyBeat || (enemy && enemy._storyBeatModifier) || (enemy && enemy.group && enemy.group.userData && enemy.group.userData.storyCombatBeat) || {};
  const squadDirective = opts.squadDirective || (enemy && enemy._squadDirective) || {};
  const storyReadability = clamp01(Math.max(storyDirector.readability || 0, enemy && enemy._storyReadabilityPulse || 0));
  const storyTelegraph = clamp01(Math.max(
    storyDirector.telegraphLead || 0,
    storyDirector.flankTelegraph || 0,
    storyDirector.threatCadence || 0,
    storyDirector.stagedThreat || 0,
    enemy && enemy._storyThreatReadPulse || 0
  ));
  const storyStagedFlank = clamp01((storyDirector.flankTelegraph || 0) * 0.68 + Math.max(0, (storyDirector.flankMul || 1) - 1) * 0.92 + (storyDirector.stagedThreat || 0) * 0.18);
  const storyBreather = clamp01((storyDirector.recoveryBreather || 0) * 0.78 + (storyDirector.recovery || 0) * 0.16 + (storyDirector.telegraphLead || 0) * 0.06);
  const storyTargetSwap = clamp01((storyDirector.targetSwapWindow || 0) * 0.76 + (storyBeat.targetSwapWindow || 0) * 0.42 + (storyDirector.chainWindow || 0) * 0.10);
  const beatReadability = clamp01(storyBeat.readability || 0);
  const beatEntry = clamp01(storyBeat.entry || (/entry/i.test(String(storyBeat.phase || storyBeat.label || '')) ? storyBeat.intensity || 0.5 : 0));
  const beatSustain = clamp01(storyBeat.sustain || (/sustain/i.test(String(storyBeat.phase || storyBeat.label || '')) ? storyBeat.intensity || 0.4 : 0));
  const beatClutch = clamp01(storyBeat.clutch || (/clutch|recover/i.test(String(storyBeat.phase || storyBeat.label || '')) ? storyBeat.intensity || 0.5 : 0));
  const beatChain = clamp01(storyBeat.chain || (/chain/i.test(String(storyBeat.phase || storyBeat.label || '')) ? storyBeat.intensity || 0.5 : 0));
  const beatObjective = clamp01(storyBeat.objective || (/objective/i.test(String(storyBeat.phase || storyBeat.label || '')) ? storyBeat.intensity || 0.5 : 0));
  const beatCleanup = clamp01(storyBeat.cleanup || (/cleanup|extract/i.test(String(storyBeat.phase || storyBeat.label || '')) ? storyBeat.relief || storyBeat.intensity || 0.4 : 0));
  const storyPush = clamp01(Math.max(0, (storyDirector.aggressionMul || 1) - 1) * 1.75 + Math.max(0, (storyDirector.flankMul || 1) - 1) * 1.08 + storyStagedFlank * 0.24 + storyTargetSwap * 0.12 + beatEntry * 0.20 + beatSustain * 0.12 + beatChain * 0.10);
  const storyRecovery = clamp01((/recovery/i.test(String(storyDirector.label || '')) ? 0.30 + storyReadability * 0.58 : 0) + storyBreather * 0.42 + beatClutch * 0.38 + beatCleanup * 0.12);
  const storyHold = clamp01((/objective/i.test(String(storyDirector.label || '')) ? 0.30 + storyReadability * 0.56 : 0) + (storyDirector.objectiveStandoff || storyDirector.objectiveStage || 0) * 0.34 + beatObjective * 0.42);
  const reloading = reloadTimer > 0 || poseState === 'reload';
  const firing = shootRecoilTimer > 0 || poseState === 'fire';
  const flanking = /flank|juke/i.test(poseState) || /flank|juke/i.test(movementMode);
  const reposition = /reposition/i.test(poseState) || /reposition/i.test(movementMode);
  const sprinting = poseState === 'sprint' || flanking || reposition;
  const peeking = peekAmt > 0.05 || poseState === 'peek';
  const hurt = /hit|injured|stunned/i.test(poseState) || hpRatio < 0.55;
  const classWeight =
    type === 'heavy' || type === 'riot' || type === 'shielded' ? 1.16 :
    type === 'sniper' || type === 'marksman' ? 0.86 :
    type === 'scout' || type === 'pistolero' || type === 'drone' ? 0.78 :
    type === 'boss' || type === 'lieutenant' ? 1.06 : 1.0;
  const speed01 = clamp01(speed / (sprinting ? 5.6 : 3.8));
  const cover = clamp01((atCover ? 0.42 : 0) + peekAmt * 0.50);
  const reload = clamp01(reloading ? 0.72 + Math.min(0.26, reloadTimer * 0.18) : 0);
  const shot = clamp01(firing ? 0.58 + shootRecoilTimer * 1.2 : 0);
  const combatResponse = buildEnemyCombatResponseSnapshot(enemy);
  const pressure = combatResponse.coverBias || 0;
  const recoveryStep = clamp01(combatResponse.source && combatResponse.source.recoveryStep);
  const rootDrag = clamp01(combatResponse.source && combatResponse.source.rootDrag);
  const turnLock = clamp01(combatResponse.source && combatResponse.source.turnLock);
  const combatStress = clamp01(combatResponse.source && combatResponse.source.combatStress);
  const stressSide = Number.isFinite(combatResponse.source && combatResponse.source.stressSide) ? combatResponse.source.stressSide : 1;
  const squadReadability = clamp01(Math.max(
    squadDirective.readability || 0,
    combatResponse.source && combatResponse.source.squadCommand || 0
  ));
  const squadAdvance = clamp01(Math.max(squadDirective.advanceBias || 0, combatResponse.source && combatResponse.source.squadAdvance || 0));
  const squadFlank = clamp01(Math.max(squadDirective.flankBias || 0, combatResponse.source && combatResponse.source.squadFlank || 0));
  const squadSuppress = clamp01(Math.max(squadDirective.suppressBias || 0, combatResponse.source && combatResponse.source.squadSuppress || 0));
  const squadAnchor = clamp01(Math.max(squadDirective.coverBias || 0, combatResponse.source && combatResponse.source.squadAnchor || 0));
  const squadRegroup = clamp01(Math.max(squadDirective.regroupNeed || 0, combatResponse.source && combatResponse.source.squadRegroup || 0));
  const squadSide = Number.isFinite(squadDirective.side)
    ? squadDirective.side
    : (Number.isFinite(combatResponse.source && combatResponse.source.squadSide) ? combatResponse.source.squadSide : 1);
  const suppression = clamp01((suppressed ? 0.62 : 0) + pressure * 0.38);
  const advance = clamp01((/walk|sprint|flank|reposition/i.test(poseState) ? 0.30 : 0) + speed01 * 0.54 + aimReady * 0.12 + squadAdvance * 0.10 + squadFlank * 0.07);
  const intent = reloading ? 'reload' :
    firing ? 'fire' :
    suppressed ? 'suppressed' :
    flanking ? 'flank' :
    reposition ? 'reposition' :
    peeking ? 'peek' :
    sprinting ? 'advance' :
    atCover ? 'cover' :
    aimReady > 0.45 ? 'aim' :
    speed01 > 0.18 ? 'patrol' :
    hurt ? 'hurt' :
    'idle';
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    type,
    poseState,
    movementMode,
    intent,
    aimReady,
    speed01,
    cover,
    reload,
    shot,
    suppression,
    advance,
    storyReadability,
    storyTelegraph,
    storyStagedFlank,
    storyBreather,
    storyTargetSwap,
    storyPush,
    storyRecovery,
    storyHold,
    storyBeatPhase: String(storyBeat.phase || ''),
    storyBeatReadability: beatReadability,
    beatEntry,
    beatSustain,
    beatClutch,
    beatChain,
    beatObjective,
    beatCleanup,
    squadRole: String(squadDirective.role || ''),
    squadState: String(squadDirective.state || ''),
    squadReadability,
    squadAdvance,
    squadFlank,
    squadSuppress,
    squadAnchor,
    squadRegroup,
    squadSide,
    flankLean: clamp((flanking ? 0.38 : 0) + speed01 * (flanking ? 0.32 : 0.10) + squadFlank * 0.20 + storyStagedFlank * 0.18, 0, 1),
    combatStress,
    stressSide,
    coverTuck: clamp01(cover * 0.72 + suppression * 0.36 + combatStress * 0.24 + storyRecovery * 0.18 + storyBreather * 0.12 + storyHold * 0.08 + squadAnchor * 0.18 + squadSuppress * 0.10 + squadRegroup * 0.16),
    weaponRaise: clamp01(aimReady * 0.58 + shot * 0.28 + cover * 0.18 + storyPush * 0.12 + storyTelegraph * 0.08 + storyTargetSwap * 0.07 + storyHold * 0.08 + beatEntry * 0.08 + beatChain * 0.10 + beatObjective * 0.08 + squadSuppress * 0.12 + squadAdvance * 0.07 - reload * 0.42 - suppression * 0.18 - combatStress * 0.14 - storyRecovery * 0.14 - storyBreather * 0.05 - beatClutch * 0.10 - squadRegroup * 0.10),
    weaponLower: clamp01(reload * 0.52 + suppression * 0.32 + combatStress * 0.24 + (hurt ? 0.22 : 0) + storyRecovery * 0.20 + storyBreather * 0.16 + beatClutch * 0.18 + beatCleanup * 0.10 + squadRegroup * 0.18 + squadAnchor * 0.06 + rootDrag * 0.18 + turnLock * 0.12),
    reloadReach: reload,
    torsoCommit: clamp01(advance * 0.42 + shot * 0.28 + aimReady * 0.16 + storyPush * 0.16 + storyTelegraph * 0.08 + storyTargetSwap * 0.06 + storyHold * 0.10 + beatEntry * 0.12 + beatChain * 0.10 + beatObjective * 0.06 + squadAdvance * 0.14 + squadFlank * 0.12 - suppression * 0.22 - combatStress * 0.16 - storyRecovery * 0.12 - storyBreather * 0.07 - beatClutch * 0.12 - squadRegroup * 0.10 - rootDrag * 0.18),
    shoulderTension: clamp01(aimReady * 0.34 + shot * 0.34 + suppression * 0.24 + combatStress * 0.18 + cover * 0.18 + storyReadability * 0.12 + storyTelegraph * 0.10 + beatReadability * 0.10 + storyHold * 0.08 + beatObjective * 0.12 + beatSustain * 0.06 + squadSuppress * 0.14 + squadAnchor * 0.10),
    headLead: clamp01(aimReady * 0.42 + peekAmt * 0.34 + advance * 0.16 + storyPush * 0.10 + storyTelegraph * 0.12 + storyStagedFlank * 0.08 + storyHold * 0.08 + beatEntry * 0.10 + beatChain * 0.10 + beatObjective * 0.05 + squadFlank * 0.12 + squadAdvance * 0.06 - reload * 0.20 - combatStress * 0.10 - storyRecovery * 0.10 - storyBreather * 0.06 - beatClutch * 0.08),
    stepDrive: clamp01(speed01 * (sprinting ? 1.05 : 0.72) + advance * 0.18 + storyPush * 0.12 + storyStagedFlank * 0.14 + storyTargetSwap * 0.08 + beatEntry * 0.12 + beatChain * 0.10 + beatCleanup * 0.06 + squadFlank * 0.24 + squadAdvance * 0.12 + recoveryStep * 0.20 - rootDrag * 0.18 - storyBreather * 0.06),
    recoveryHunch: clamp01((1 - hpRatio) * 0.42 + suppression * 0.18 + combatStress * 0.24 + reload * 0.08 + storyRecovery * 0.22 + storyBreather * 0.22 + beatClutch * 0.22 + beatCleanup * 0.06 + squadRegroup * 0.18 + rootDrag * 0.34 + recoveryStep * 0.20 + turnLock * 0.12),
    recoveryStep,
    rootDrag,
    turnLock,
    classWeight,
    readable: clamp01(0.30 + aimReady * 0.26 + shot * 0.20 + reload * 0.12 + suppression * 0.10 + combatStress * 0.16 + cover * 0.10 + storyReadability * 0.18 + storyTelegraph * 0.20 + storyTargetSwap * 0.10 + beatReadability * 0.16 + squadReadability * 0.18)
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function applyEnemyAnimationPolishAccuracy(enemy, base = 1, t = nowMs()) {
  const response = buildEnemyCombatResponseSnapshot(enemy, t);
  return clamp((Number.isFinite(base) ? base : 1) * (response.aimMul || 1), 0.18, 1.2);
}

export function buildPlayerCombatStanceSnapshot(player = null, opts = {}) {
  if (!player) return { version: GAMEPLAY_ANIMATION_POLISH_VERSION, active: false, finite: true };
  const ads = clamp01(opts.ads != null ? opts.ads : (player.adsVis || player.ads || 0));
  const speed = clamp(opts.speed != null ? opts.speed : player._moveSpeedSmooth || 0, 0, 14);
  const sprint = clamp01(opts.sprint != null ? opts.sprint : (player.sprintBlend || player.sprintAmt || (player.running ? 1 : 0)));
  const slide = clamp01(opts.slide != null ? opts.slide : (player.slideAmt || (player.sliding ? 1 : 0)));
  const crouch = clamp01(opts.crouch != null ? opts.crouch : player.crouchAmt || 0);
  const reload = opts.reload || player._reloadFeelSnapshot || {};
  const gunplay = opts.gunplay || player._gunplayPolishSnapshot || {};
  const incoming = opts.incoming || {};
  const damage = opts.damage || {};
  const storyDirector = opts.storyDirector || player._storyGameplayDirector || {};
  const weapon = opts.weapon || buildPlayerWeaponAnimationPolishSnapshot(player);
  const lowAmmo = clamp01(opts.lowAmmo != null ? opts.lowAmmo : 0);
  const pressure = clamp01(Math.max(
    player._suppressionLevel || 0,
    player._enemyShotPressure || 0,
    player._damageShock || 0,
    incoming.threat || 0,
    incoming.pressure || 0,
    gunplay.handlingPressure || 0
  ));
  const damageShock = clamp01(Math.max(
    player._damageShock || 0,
    player._damageWeaponDropPulse || 0,
    damage.weaponDrop || 0,
    damage.movementStagger || 0
  ));
  const reloadActive = !!(reload.active || player.reloading);
  const reloadPressure = clamp01((reloadActive ? 0.28 : 0) + (reload.pressure || 0) * 0.64 + (reload.fumble || 0) * 0.40);
  const reloadShield = clamp01(reloadPressure * 0.64 + (storyDirector.recovery || 0) * 0.18 - (storyDirector.push || 0) * 0.08);
  const flow = clamp01(Math.max(player._combatFlow || 0, player._killFlowPulse || 0, storyDirector.chainWindow || 0));
  const gunDiscipline = clamp01((gunplay.followThroughHold || 0) * 0.32 + (gunplay.sightReturnBoost || 0) * 0.26 + (gunplay.burstDisciplinePulse || 0) * 0.20 + (gunplay.storyAssist && gunplay.storyAssist.assist || 0) * 0.16);
  const mobility = clamp01(speed / 8.2 + sprint * 0.36 + slide * 0.44);
  const lowReady = clamp01(sprint * 0.58 + slide * 0.48 + reloadPressure * 0.28 + damageShock * 0.14 - ads * 0.52 - gunDiscipline * 0.18);
  const brace = clamp01(pressure * 0.42 + damageShock * 0.24 + reloadShield * 0.22 + ads * 0.16 + gunDiscipline * 0.12);
  const shoulder = clamp01(ads * 0.48 + (weapon.ready || 0) * 0.30 + gunDiscipline * 0.18 + flow * 0.08 - lowReady * 0.32 - damageShock * 0.18);
  const compression = clamp01(pressure * 0.26 + crouch * 0.24 + reloadShield * 0.18 + damageShock * 0.22 + slide * 0.18);
  const breathHold = clamp01(ads * 0.34 + gunDiscipline * 0.28 + (storyDirector.objectiveHold || 0) * 0.18 - pressure * 0.12);
  const side = Number.isFinite(player._enemyShotSide) ? player._enemyShotSide : (Number.isFinite(player._damageShockSide) ? player._damageShockSide : 1);
  const stanceX = clamp(side * (pressure * 0.012 + damageShock * 0.014 - shoulder * 0.004) - (player._moveAccel || 0) / 80 * 0.006, -0.035, 0.035);
  const stanceY = clamp(-compression * 0.026 - lowReady * 0.020 + shoulder * 0.012 + reloadShield * 0.010, -0.050, 0.030);
  const stanceZ = clamp(lowReady * 0.040 + pressure * 0.020 + reloadShield * 0.026 - shoulder * 0.030 - flow * 0.012, -0.045, 0.065);
  const pitch = clamp(lowReady * 0.090 + pressure * 0.040 + reloadShield * 0.070 - shoulder * 0.055 - gunDiscipline * 0.040, -0.075, 0.150);
  const yaw = clamp(side * (pressure * 0.028 + damageShock * 0.034 + lowReady * 0.012), -0.070, 0.070);
  const roll = clamp(side * (pressure * 0.090 + damageShock * 0.110 + reloadShield * 0.046 - shoulder * 0.022), -0.160, 0.160);
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    active: true,
    pressure,
    damageShock,
    reloadPressure,
    reloadShield,
    flow,
    gunDiscipline,
    mobility,
    lowReady,
    brace,
    shoulder,
    compression,
    breathHold,
    side,
    cameraX: stanceX * 0.18,
    cameraY: stanceY * 0.20,
    cameraZ: -stanceZ * 0.10,
    cameraPitch: pitch * 0.16,
    cameraYaw: yaw * 0.10,
    cameraRoll: roll * 0.18,
    viewmodelX: stanceX,
    viewmodelY: stanceY,
    viewmodelZ: stanceZ,
    viewmodelPitch: pitch,
    viewmodelYaw: yaw,
    viewmodelRoll: roll,
    adsShoulderLock: clamp01(shoulder * 0.68 + breathHold * 0.22 - mobility * 0.18),
    movementPenalty: clamp01(lowReady * 0.34 + damageShock * 0.18 + reloadPressure * 0.14 - flow * 0.10),
    lowAmmo,
    label: reloadActive ? 'reload-stance' : (pressure > 0.56 ? 'pressure-stance' : (lowReady > 0.48 ? 'low-ready' : (shoulder > 0.55 ? 'shouldered' : 'neutral'))),
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function tickPlayerCombatStancePolish(player, dt, opts = {}, dampFn = expDamp) {
  if (!player) return null;
  const raw = buildPlayerCombatStanceSnapshot(player, opts);
  for (const [key, target, lambda] of [
    ['_combatStancePressure', raw.pressure, raw.pressure > (player._combatStancePressure || 0) ? 10.5 : 5.2],
    ['_combatStanceBrace', raw.brace, raw.brace > (player._combatStanceBrace || 0) ? 9.5 : 5.8],
    ['_combatStanceShoulder', raw.shoulder, raw.shoulder > (player._combatStanceShoulder || 0) ? 8.4 : 5.0],
    ['_combatStanceLowReady', raw.lowReady, raw.lowReady > (player._combatStanceLowReady || 0) ? 10.0 : 6.4],
    ['_combatStanceReloadShield', raw.reloadShield, raw.reloadShield > (player._combatStanceReloadShield || 0) ? 8.8 : 6.0],
    ['_combatStanceCompression', raw.compression, raw.compression > (player._combatStanceCompression || 0) ? 9.0 : 5.5],
    ['_combatStanceGunDiscipline', raw.gunDiscipline, raw.gunDiscipline > (player._combatStanceGunDiscipline || 0) ? 8.2 : 5.6]
  ]) {
    player[key] = dampFn(Number.isFinite(player[key]) ? player[key] : 0, target, lambda, dt);
  }
  const smoothed = {
    ...raw,
    pressure: clamp01(player._combatStancePressure || 0),
    brace: clamp01(player._combatStanceBrace || 0),
    shoulder: clamp01(player._combatStanceShoulder || 0),
    lowReady: clamp01(player._combatStanceLowReady || 0),
    reloadShield: clamp01(player._combatStanceReloadShield || 0),
    compression: clamp01(player._combatStanceCompression || 0),
    gunDiscipline: clamp01(player._combatStanceGunDiscipline || 0)
  };
  smoothed.cameraX = raw.cameraX * (0.42 + smoothed.brace * 0.58);
  smoothed.cameraY = raw.cameraY * (0.44 + smoothed.compression * 0.56);
  smoothed.cameraZ = raw.cameraZ * (0.42 + smoothed.lowReady * 0.58);
  smoothed.cameraPitch = raw.cameraPitch * (0.46 + Math.max(smoothed.lowReady, smoothed.shoulder) * 0.54);
  smoothed.cameraYaw = raw.cameraYaw * (0.44 + smoothed.pressure * 0.56);
  smoothed.cameraRoll = raw.cameraRoll * (0.44 + Math.max(smoothed.pressure, smoothed.reloadShield) * 0.56);
  smoothed.viewmodelX = raw.viewmodelX * (0.48 + smoothed.pressure * 0.30 + smoothed.shoulder * 0.22);
  smoothed.viewmodelY = raw.viewmodelY * (0.48 + smoothed.compression * 0.34 + smoothed.reloadShield * 0.18);
  smoothed.viewmodelZ = raw.viewmodelZ * (0.50 + smoothed.lowReady * 0.32 + smoothed.shoulder * 0.18);
  smoothed.viewmodelPitch = raw.viewmodelPitch * (0.48 + Math.max(smoothed.lowReady, smoothed.shoulder) * 0.52);
  smoothed.viewmodelYaw = raw.viewmodelYaw * (0.48 + smoothed.pressure * 0.52);
  smoothed.viewmodelRoll = raw.viewmodelRoll * (0.48 + Math.max(smoothed.pressure, smoothed.reloadShield) * 0.52);
  smoothed.finite = Object.values(smoothed).every((v) => typeof v !== 'number' || Number.isFinite(v));
  player._combatStanceSnapshot = smoothed;
  return smoothed;
}

export function tickPlayerWeaponAnimationPolish(player, dt, opts = {}, dampFn = expDamp) {
  if (!player) return null;
  const ads = clamp01(opts.ads != null ? opts.ads : (player.adsVis || player.ads || 0));
  const speed = clamp(opts.speed != null ? opts.speed : player._moveSpeedSmooth || 0, 0, 12);
  const lowAmmo = clamp01(opts.lowAmmo != null ? opts.lowAmmo : 0);
  const flow = clamp01(player._combatFlow || 0);
  const miss = clamp01(player._gunplayMissBloom || 0);
  const pressure = clamp01(Math.max(player._suppressionLevel || 0, player._enemyShotPressure || 0, player._damageShock || 0));
  const weaponWeight = clamp((opts.weaponWeight || 1), 0.5, 1.8);
  const targetReady = clamp01((ads * 0.54 + flow * 0.24 + (1 - Math.min(1, speed / 8)) * 0.14) - pressure * 0.24 - miss * 0.18);
  const targetUrgency = clamp01(lowAmmo * 0.36 + pressure * 0.34 + miss * 0.22 + Math.max(0, speed - 6) * 0.035);

  player._weaponHandlingReady = dampFn(Number.isFinite(player._weaponHandlingReady) ? player._weaponHandlingReady : targetReady, targetReady, targetReady > (player._weaponHandlingReady || 0) ? 7.5 : 5.0, dt);
  player._weaponHandlingUrgency = dampFn(Number.isFinite(player._weaponHandlingUrgency) ? player._weaponHandlingUrgency : targetUrgency, targetUrgency, targetUrgency > (player._weaponHandlingUrgency || 0) ? 10.5 : 5.5, dt);
  player._weaponHandlingMass = dampFn(Number.isFinite(player._weaponHandlingMass) ? player._weaponHandlingMass : weaponWeight, weaponWeight, 6.0, dt);
  const snap = buildPlayerWeaponAnimationPolishSnapshot(player);
  player._weaponAnimationPolishSnapshot = snap;
  return snap;
}

export function buildPlayerWeaponAnimationPolishSnapshot(player) {
  if (!player) return { version: GAMEPLAY_ANIMATION_POLISH_VERSION, finite: true };
  const ready = clamp01(player._weaponHandlingReady || 0);
  const urgency = clamp01(player._weaponHandlingUrgency || 0);
  const mass = clamp(player._weaponHandlingMass || 1, 0.5, 1.8);
  const flow = clamp01(player._combatFlow || 0);
  const kill = clamp01(player._killFlowPulse || 0);
  const pressure = clamp01(Math.max(player._suppressionLevel || 0, player._enemyShotPressure || 0, player._damageShock || 0));
  const switchPulse = clamp01(Math.max(player._weaponSwitchPulse || 0, player._weaponDrawPulse || 0));
  const pickupCollectPulse = clamp01(player._pickupCollectPulse || 0);
  const out = {
    version: GAMEPLAY_ANIMATION_POLISH_VERSION,
    ready,
    urgency,
    mass,
    flow,
    kill,
    pressure,
    shoulderTuck: clamp(ready * 0.030 - urgency * 0.018 + flow * 0.014, -0.03, 0.06),
    recoilDiscipline: clamp(ready * 0.20 + flow * 0.09 - pressure * 0.10, -0.10, 0.34),
    lowAmmoFidget: clamp01(urgency * 0.62 + (player._lowAmmoPulse || 0) * 0.42),
    pressureGrip: clamp01(pressure * 0.72 + urgency * 0.22),
    killSettle: clamp01(kill * 0.70 + flow * 0.24),
    switchPulse,
    switchSide: Number.isFinite(player._weaponSwitchSide) ? player._weaponSwitchSide : 1,
    switchTuck: clamp(switchPulse * 0.18, 0, 0.24),
    switchRoll: clamp((Number.isFinite(player._weaponSwitchSide) ? player._weaponSwitchSide : 1) * switchPulse * 0.16, -0.22, 0.22),
    pickupCollectPulse
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}
