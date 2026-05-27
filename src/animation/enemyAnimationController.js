import { getEnemyAnimationProfile, getEnemyFeelTuning } from './profiles.js';
import { ANIMATION_MANIFEST } from '../assetManifest.js';
import { resolveImportedClipPlan, importedClipPlanDebug } from './importedClipController.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function enemyIntentCue(intent, profile, enemy, tuning = getEnemyFeelTuning(profile?.label || 'soldier')) {
  const peek = clamp01(enemy?.peekAmt || 0);
  const aim = clamp01(enemy?.aimReady || 0);
  const hit = clamp01(enemy?._hitImpactStrength || enemy?.staggerTimer || 0);
  const fire = intent === 'fire' ? 1 : 0;
  const reload = intent === 'reload' ? 1 : 0;
  const suppress = intent === 'suppress' ? 1 : 0;
  const vault = intent === 'vault' ? 1 : 0;
  const death = intent === 'death' ? 1 : 0;
  const flank = intent === 'flank' ? 1 : 0;
  const cover = intent === 'cover' ? 1 : 0;
  const move = intent === 'move' ? 1 : 0;
  const weight = Number(profile.weight || 1);
  const lead = Number(profile.intentLead || 1);
  const stepEnergy = Number(profile.stepEnergy || 1);
  const recoilAbsorb = Number(profile.recoilAbsorb || 1);
  return {
    headLead: Number(clamp01(((peek * 0.55 + aim * 0.18 + flank * 0.18) * lead * (tuning.intentLead || 1) * (tuning.peekLead || 1))).toFixed(4)),
    weaponRaise: Number(clamp01((aim * 0.72 + peek * 0.35 + suppress * 0.42 + fire * 0.28 - reload * 0.28 - death * 0.7) * (tuning.weaponRaise || 1)).toFixed(4)),
    torsoCompression: Number(clamp01((cover * 0.45 + reload * 0.32 + hit * 0.55 + suppress * 0.34 + vault * 0.42 + death * 0.85 + Math.max(0, weight - 1) * 0.16) * (tuning.compression || 1)).toFixed(4)),
    shoulderCommit: Number(clamp01((suppress * 0.66 + aim * 0.34 + peek * 0.22 + fire * 0.48) * (tuning.shoulderCommit || 1)).toFixed(4)),
    stepEnergy: Number(clamp01((move * stepEnergy * 0.72 + flank * stepEnergy + vault * 0.42) * (tuning.stepEnergy || 1)).toFixed(4)),
    recoilAbsorb: Number(clamp01(recoilAbsorb * (enemy?.shootRecoilTimer ? 0.85 : 0.35)).toFixed(4)),
    reloadReach: Number(clamp01(reload * (0.65 + Math.max(0, weight - 1) * 0.12) * (tuning.reloadReach || 1)).toFixed(4)),
    hitReact: Number(clamp01(hit * (1.1 / Math.max(0.65, recoilAbsorb)) * (tuning.hitReact || 1)).toFixed(4)),
    vaultReach: Number(clamp01(vault * (0.72 + stepEnergy * 0.12)).toFixed(4)),
    deathCollapse: Number(clamp01(death * (tuning.deathCollapse || 1)).toFixed(4)),
    aimTension: Number(clamp01((aim * 0.45 + suppress * 0.4 + peek * 0.2 + fire * 0.32) * (tuning.aimTension || 1)).toFixed(4)),
    peekSide: Number((Math.sign(enemy?._peekSideSign || enemy?.strafeDir || 1) || 1).toFixed(0)),
    fallbackSafe: true
  };
}

function hitZoneFromEnemy(enemy) {
  const limb = String(enemy?._lastHitLimbId || enemy?.group?.userData?.lastHitLimb || '').toLowerCase();
  if (enemy?._lastHitWasHead || limb.includes('head') || limb.includes('neck')) return 'head';
  if (limb.includes('thigh') || limb.includes('shin') || limb.includes('leg')) return 'leg';
  if (limb.includes('arm')) return 'arm';
  return 'body';
}

function deathVariantFromEnemy(enemy) {
  if (!enemy?.dead) return null;
  if (enemy?._deathByDropkick) return 'deathBack';
  const side = Math.abs(enemy?.staggerDir?.x || enemy?.lastPlayerDir?.x || 0);
  if (side > 0.45) return 'deathSide';
  return 'deathForward';
}

function animationManifestForEnemy(enemy, options = {}) {
  if (options.manifestEntry) return options.manifestEntry;
  const id = enemy?.animationProfileId || (enemy?.meshyRig || enemy?.actions ? 'animation.mixamo.humanoid' : 'animation.enemy');
  return ANIMATION_MANIFEST[id] || ANIMATION_MANIFEST['animation.enemy'];
}

function availableClipSource(enemy, manifestEntry) {
  if (enemy?.actions && typeof enemy.actions === 'object') return { id: manifestEntry?.id || 'enemy.actions', actions: enemy.actions, fallback: manifestEntry?.fallback };
  return manifestEntry || [];
}

export function resolveEnemyAnimationStatus(enemy, options = {}) {
  const profile = getEnemyAnimationProfile(enemy && enemy.type);
  const tuning = getEnemyFeelTuning(enemy && enemy.type);
  const state = enemy?.dead ? 'death' : (enemy?.animationState || enemy?.group?.userData?.animationState || 'idle');
  const movementMode = enemy?._movementMode || 'idle';
  const speed = Math.hypot(enemy?._moveVelX || 0, enemy?._moveVelZ || 0);
  const aimReady = Number(enemy?.aimReady || 0);
  const peek = Number(enemy?.peekAmt || 0);
  const cover = !!enemy?.atCover;
  const intent = state === 'death' ? 'death'
    : state === 'reload' ? 'reload'
      : state === 'fire' ? 'fire'
        : state === 'vault' ? 'vault'
          : state.startsWith('hit') ? 'hit'
            : state === 'peek' || peek > 0.08 ? 'peek'
              : state === 'suppress' || state === 'suppressed' ? 'suppress'
                : state === 'flank' || movementMode === 'flank' || movementMode === 'juke' ? 'flank'
                  : cover ? 'cover'
                    : aimReady > 0.5 ? 'aim'
                      : speed > 0.1 ? 'move'
                        : 'idle';
  const animationProfileId = enemy?.animationProfileId || (enemy?.meshyRig || enemy?.actions ? 'animation.mixamo.humanoid' : 'animation.enemy');
  const manifestEntry = animationManifestForEnemy(enemy, options);
  const status = {
    type: enemy?.type || 'soldier',
    profile: profile.label,
    state,
    movementMode,
    intent,
    speed: Number(speed.toFixed(3)),
    readability: {
      weight: profile.weight,
      turnSharpness: profile.turnSharpness,
      stepEnergy: profile.stepEnergy,
      recoilAbsorb: profile.recoilAbsorb,
      intentLead: profile.intentLead,
      tuningId: tuning.id
    },
    channels: {
      locomotion: speed > 0.1 ? movementMode : 'idle',
      upperBody: intent === 'reload' ? 'reload' : intent === 'fire' || aimReady > 0.4 ? 'aim' : 'relaxed',
      additive: intent === 'hit' ? `hitReact:${hitZoneFromEnemy(enemy)}` : intent === 'death' ? deathVariantFromEnemy(enemy) : 'none'
    },
    assetProfiles: {
      enemy: enemy?.enemyAnimationProfileId || enemy?.profileId || null,
      model: enemy?.enemyModelProfileId || enemy?.modelProfileId || null,
      animation: animationProfileId,
      weapon: enemy?.weaponProfileId || null,
      importedAsset: enemy?.importedAssetId || null
    },
    hitZone: intent === 'hit' ? hitZoneFromEnemy(enemy) : null,
    deathVariant: intent === 'death' ? deathVariantFromEnemy(enemy) : null,
    intentCue: enemyIntentCue(intent, profile, enemy, tuning),
    fallback: 'procedural-enemy-pose'
  };
  if (enemy?.animationStatus?.intentCueVisual) {
    status.intentCueVisual = { ...enemy.animationStatus.intentCueVisual };
  }
  const clipPlan = resolveImportedClipPlan({
    status,
    enemy,
    manifestEntry: availableClipSource(enemy, manifestEntry),
    importedAnimationEnabled: options.importedAnimationEnabled === true,
    sourceId: manifestEntry?.id || animationProfileId
  });
  status.clipPlan = importedClipPlanDebug(clipPlan);
  return status;
}

export function enemyAnimationDebugList(enemies = [], options = {}) {
  return enemies.filter(Boolean).map((enemy) => resolveEnemyAnimationStatus(enemy, options));
}
