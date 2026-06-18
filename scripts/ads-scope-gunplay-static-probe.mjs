import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AIM_FEEL_VERSION,
  buildAimFeelSnapshot,
  getAimLookSensitivityMultiplier,
  recordAimShotFeedback,
  tickAimFeel
} from '../src/game/aimFeel.js';
import {
  buildGunplayPolishSnapshot,
  buildShotQualitySnapshot,
  recordGunplayShot
} from '../src/game/gunplayPolish.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const css = readFileSync(join(root, 'src/styles/game.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(AIM_FEEL_VERSION === 'aim-feel.v4', 'unexpected aim feel version');
assert(main.includes('scopeEyeX:pl?THREE.MathUtils.clamp(pl.scopeEyeX'), 'aim options do not pass scope eye x');
assert(main.includes('--ads-reticle-confidence'), 'aim reticle confidence css var missing');
assert(main.includes('--scope-eye-x'), 'scope eye css hook missing');
assert(main.includes('_scopeAimSnap=buildAimFeelSnapshot'), 'scope overlay aim snapshot missing');
assert(main.includes('_scopeShadowUi'), 'scope shadow overlay hook missing');
assert(main.includes('scopeShadow||0)*(_opticForFov?.72'), 'scope shadow FOV hook missing');
assert(main.includes('scopeEyeBoxPressure'), 'scope eye-box status missing');
assert(main.includes('reticleConfidence'), 'reticle confidence status missing');
assert(main.includes('targetTransferAssist') && main.includes('storyAimSettle'), 'aim reactive settle fields missing');
assert(main.includes('damageWeaponCatch') && main.includes('traversalRecenter') && main.includes('storyTargetSwap'), 'aim v4 recovery inputs missing');
assert(main.includes('_aimRecoveryAssist') && main.includes('_aimTraversalJostle'), 'aim v4 camera recovery hooks missing');
assert(main.includes("version:'first-person-arm-clearance.v1'"), 'first-person ADS arm clearance debug contract missing');
assert(main.includes("version:'first-person-hand-dedupe.v1'") && main.includes('legacyViewmodelBlockoutSuppressed'), 'first-person hand blockout dedupe missing');
assert(main.includes("version:'first-person-arm-base-posture.v1'") && main.includes('_normalArmPosture'), 'non-ADS first-person arm base posture correction missing');
assert(main.includes("FIRST_PERSON_ARM_POSE_GUARD_VERSION='first-person-arm-pose-guard.v1'") && main.includes('_applyFirstPersonArmPoseGuard'), 'first-person arm pose guard missing');
assert(main.includes('P._firstPersonArmPoseGuard') && main.includes('armPoseGuard:P._firstPersonArmPoseGuard'), 'first-person arm pose guard debug status missing');
assert(main.includes('_cropLongGunAdsForearm') && main.includes('_cropPistolSupportSightline=(_wi===1||_wi===6)&&!P.reloading&&_adsVisForSight>.70'), 'ADS forearm/support sightline crop missing');
assert(main.includes("version:'ads-sightline-hand-clearance.v1'") && main.includes('_adsSightlineClear=!P.reloading&&_wi!==2'), 'ADS hand sightline target clearance missing');
assert(!main.includes('const _cropPistolSupportSightline=false'), 'pistol support sightline crop is still disabled');
assert(css.includes('--scope-shadow-alpha'), 'scope shadow css var missing');
assert(css.includes('calc(-50% + var(--scope-eye-x))'), 'scope ring eye offset css missing');
assert(css.includes('calc(-50% + var(--scope-reticle-x))'), 'scope reticle eye offset css missing');

const player = {
  weaponIdx: 7,
  ads: 1,
  adsVis: 1,
  adsTarget: 1,
  scopeSettle: 0.9,
  scopeEyeX: 0.003,
  scopeEyeY: -0.002,
  _shotImpulse: 0.22,
  _suppressionLevel: 0.25
};

let aim = tickAimFeel(player, 1 / 60, {
  weaponIdx: 7,
  ads: 1,
  adsTarget: 1,
  scoped: 1,
  moving: false,
  running: false,
  sliding: false,
  scopeEyeX: player.scopeEyeX,
  scopeEyeY: player.scopeEyeY,
  breathHeld: true
});
assert(aim.scopeEyeBoxPressure >= 0 && aim.scopeShadow >= 0, 'aim scope metrics missing');
assert(aim.reticleConfidence >= 0 && aim.lensFocus >= 0, 'aim reticle metrics missing');
assert(aim.sightAcquisition >= 0 && aim.snapShotRisk >= 0, 'aim acquisition metrics missing');
assert(aim.damageInterference >= 0, 'aim damage interference missing');
assert(aim.holdBreathBlend >= 0, 'hold breath blend missing');
assert(aim.damageVision >= 0 && aim.traversalRecenter >= 0 && aim.storyTargetSwap >= 0, 'aim v4 fields missing');

const neutralAimPlayer = {
  weaponIdx: 7,
  ads: 1,
  adsVis: 1,
  adsTarget: 1,
  _aimReadiness: 0.72,
  _aimStability: 0.54,
  scopeEyeX: 0.004,
  scopeEyeY: 0.003
};
const reactiveAimPlayer = {
  ...neutralAimPlayer,
  _targetTransitionPulse: 0.84,
  _hitConfirmSettlePulse: 0.66,
  _storyBeatChainPulse: 0.72
};
const neutralAim = buildAimFeelSnapshot(neutralAimPlayer, { weaponIdx: 7, ads: 1, adsTarget: 1, scoped: 1 });
const reactiveAim = buildAimFeelSnapshot(reactiveAimPlayer, { weaponIdx: 7, ads: 1, adsTarget: 1, scoped: 1 });
assert(reactiveAim.targetTransferAssist > 0.7 && reactiveAim.storyAimSettle > 0.6, 'reactive aim settle fields did not resolve');
assert(reactiveAim.reticleConfidence > neutralAim.reticleConfidence, 'reactive target transfer should improve reticle confidence');
assert(reactiveAim.spreadMul <= neutralAim.spreadMul, 'reactive target transfer should not loosen spread');

const unstableAimPlayer = {
  ...neutralAimPlayer,
  _damagePainPulse: 0.84,
  _damageBreathKnockPulse: 0.72,
  _damageVisionPulse: 0.58,
  _slideScrapePulse: 0.70
};
const recoveredAimPlayer = {
  ...neutralAimPlayer,
  _damageWeaponCatchPulse: 0.74,
  _damageStepSavePulse: 0.62,
  _traversalRecenterPulse: 0.78,
  _storyTargetSwapPulse: 0.68,
  _storyRecoveryBreatherPulse: 0.60
};
const unstableAim = buildAimFeelSnapshot(unstableAimPlayer, { weaponIdx: 7, ads: 1, adsTarget: 1, scoped: 1 });
const recoveredAim = buildAimFeelSnapshot(recoveredAimPlayer, { weaponIdx: 7, ads: 1, adsTarget: 1, scoped: 1 });
assert(unstableAim.damagePain > 0.8 && unstableAim.traversalJostle > 0.5, 'aim v4 unstable inputs did not resolve');
assert(recoveredAim.damageWeaponCatch > 0.7 && recoveredAim.traversalRecenter > 0.7 && recoveredAim.storyTargetSwap > 0.6, 'aim v4 recovery inputs did not resolve');
assert(recoveredAim.reticleConfidence > unstableAim.reticleConfidence, 'aim v4 recovery should beat pain/jostle reticle confidence');
assert(recoveredAim.scopeShadow < unstableAim.scopeShadow, 'aim v4 recovery should reduce scope shadow');
assert(recoveredAim.spreadMul < unstableAim.spreadMul, 'aim v4 recovery should tighten spread');

aim = recordAimShotFeedback(player, {
  weaponIdx: 7,
  ads: 1,
  adsTarget: 1,
  scoped: 1,
  moving: true,
  running: false,
  sliding: false,
  scopeEyeX: 0.004,
  scopeEyeY: 0.003
});
assert(buildAimFeelSnapshot(player, { weaponIdx: 7, ads: 1, adsTarget: 1, scoped: 1 }).scopeShadow >= 0, 'shot aim shadow invalid');
assert(getAimLookSensitivityMultiplier(player, 1, { weaponIdx: 7, ads: 1, adsTarget: 1, scoped: 1 }) < 1, 'ADS sensitivity did not reduce');

const goodShot = buildShotQualitySnapshot(player, {
  weaponIdx: 7,
  ads: 1,
  aim: Object.assign({}, aim, { readiness: 0.95, stability: 0.92, reticleConfidence: 0.92, lensFocus: 0.90, scopeShadow: 0.08, scopeEyeBoxPressure: 0.06 }),
  spread: 0.001,
  baseSpread: 0.002,
  firstShot: true,
  settled: true
});
const badShot = buildShotQualitySnapshot(player, {
  weaponIdx: 7,
  ads: 1,
  aim: Object.assign({}, aim, { readiness: 0.80, stability: 0.42, reticleConfidence: 0.34, lensFocus: 0.30, scopeShadow: 0.82, scopeEyeBoxPressure: 0.74 }),
  spread: 0.007,
  baseSpread: 0.002,
  firstShot: true
});
const snapShot = buildShotQualitySnapshot(player, {
  weaponIdx: 7,
  ads: 1,
  aim: Object.assign({}, aim, { readiness: 0.62, stability: 0.38, reticleConfidence: 0.42, lensFocus: 0.36, scopeShadow: 0.42, scopeEyeBoxPressure: 0.36, sightAcquisition: 0.32, snapShotRisk: 0.86 }),
  spread: 0.002,
  baseSpread: 0.002,
  firstShot: true
});
player._damageWeaponDropPulse = 0.92;
player._damageTunnelPulse = 0.78;
player._damageMovementStagger = 0.66;
const woundedShot = buildShotQualitySnapshot(player, {
  weaponIdx: 7,
  ads: 1,
  aim: Object.assign({}, aim, { readiness: 0.95, stability: 0.92, reticleConfidence: 0.92, lensFocus: 0.90, scopeShadow: 0.08, scopeEyeBoxPressure: 0.06, damageInterference: 0.86 }),
  spread: 0.001,
  baseSpread: 0.002,
  firstShot: true,
  settled: true
});
player._damageWeaponDropPulse = 0;
player._damageTunnelPulse = 0;
player._damageMovementStagger = 0;
assert(goodShot.quality > badShot.quality, 'sight picture did not affect shot quality');
assert(goodShot.quality > snapShot.quality, 'settled shot should beat risky ADS snap shot');
assert(goodShot.quality > woundedShot.quality && woundedShot.damageInterference > 0.7, 'damage response should disrupt shot quality');
assert(snapShot.snapShotRisk > 0.7 && snapShot.poor, 'risky ADS snap shot should be labeled poor');
assert(goodShot.perfect, 'good scoped sight picture should score perfect');
assert(badShot.poor, 'bad eye-box pressure should score poor');

recordGunplayShot(player, badShot);
const gunplay = buildGunplayPolishSnapshot(player);
assert(gunplay.scopeShadow >= 0 && gunplay.sightPicture >= 0, 'gunplay sight metrics missing');
assert(gunplay.sightAcquisition >= 0 && gunplay.snapShotRisk >= 0, 'gunplay acquisition metrics missing');

console.log(JSON.stringify({
  ok: true,
  version: AIM_FEEL_VERSION,
  aim: {
    shadow: Number((aim.scopeShadow || 0).toFixed(3)),
    confidence: Number((aim.reticleConfidence || 0).toFixed(3)),
    lensFocus: Number((aim.lensFocus || 0).toFixed(3))
  },
  shots: {
    good: Number(goodShot.quality.toFixed(3)),
    bad: Number(badShot.quality.toFixed(3)),
    snap: Number(snapShot.quality.toFixed(3)),
    wounded: Number(woundedShot.quality.toFixed(3))
  }
}, null, 2));
