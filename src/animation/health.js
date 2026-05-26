import {
  ANIMATION_PIPELINE_VERSION,
  PLAYER_LOCOMOTION_STATES,
  SEMANTIC_MIXAMO_CLIPS,
  TOOLING_CAPABILITIES,
  animationTuningDebug,
  animationFeatureFlags
} from './profiles.js';
import { buildAssetPipelineReport } from './assetPipeline.js';
import { animationChannelReport } from './channels.js';

function finitePose(row) {
  if (!row || typeof row !== 'object') return true;
  return Object.values(row).every((v) => typeof v !== 'number' || Number.isFinite(v));
}

function warningDisposition(row) {
  return {
    code: row?.code || 'unknown',
    level: row?.level || 'warning',
    authoringOnly: row?.authoringOnly !== false,
    blocksRuntime: !!row?.blocksRuntime
  };
}

export function buildAnimationHealthReport(options = {}) {
  const flags = animationFeatureFlags(options.settings || {});
  const issues = [];
  const warnings = [];

  const player = options.playerAnimation || null;
  if (player && player.resolved) {
    if (!finitePose(player.resolved.camera)) issues.push({ code: 'player-camera-non-finite', level: 'error' });
    if (!finitePose(player.resolved.viewmodel)) issues.push({ code: 'player-viewmodel-non-finite', level: 'error' });
    if (!finitePose(player.resolved.proxy)) issues.push({ code: 'player-proxy-non-finite', level: 'error' });
  }

  const weapon = options.weaponAnimation || null;
  if (weapon && !finitePose(weapon.pose)) issues.push({ code: 'weapon-pose-non-finite', level: 'error' });
  if (weapon && Array.isArray(weapon.fallbackReasons) && weapon.fallbackReasons.length) {
    warnings.push({ code: 'weapon-procedural-fallback', level: 'warning', reasons: weapon.fallbackReasons.slice() });
  }

  const handGrip = options.handGrip || null;
  if (handGrip) {
    if (!finitePose(handGrip.offsets?.right) || !finitePose(handGrip.offsets?.left)) {
      issues.push({ code: 'hand-grip-non-finite', level: 'error' });
    }
    if (Array.isArray(handGrip.fallbackReasons) && handGrip.fallbackReasons.length) {
      warnings.push({ code: 'hand-grip-fallback', level: 'warning', reasons: handGrip.fallbackReasons.slice() });
    }
  }

  const locomotionFeel = options.locomotionFeel || null;
  if (locomotionFeel) {
    if (!finitePose(locomotionFeel.additive?.camera) || !finitePose(locomotionFeel.additive?.viewmodel) || !finitePose(locomotionFeel.additive?.proxy)) {
      issues.push({ code: 'locomotion-feel-non-finite', level: 'error' });
    }
    if (Array.isArray(locomotionFeel.fallbackReasons) && locomotionFeel.fallbackReasons.length) {
      warnings.push({ code: 'locomotion-feel-fallback', level: 'warning', reasons: locomotionFeel.fallbackReasons.slice() });
    }
  }

  const enemyAnimation = Array.isArray(options.enemyAnimation) ? options.enemyAnimation : null;
  if (enemyAnimation) {
    for (const row of enemyAnimation) {
      if (row?.intentCue && !finitePose(row.intentCue)) {
        issues.push({ code: 'enemy-intent-cue-non-finite', level: 'error', type: row.type || 'unknown' });
      }
      const clipFallbacks = row?.clipPlan?.fallbackReasons || [];
      if (clipFallbacks.length) {
        warnings.push({
          code: 'enemy-imported-clip-fallback',
          level: 'warning',
          type: row.type || 'unknown',
          reasons: clipFallbacks.slice()
        });
      }
    }
  }

  const registryPreflight = options.registryPreflight || null;
  if (registryPreflight?.validation && registryPreflight.validation.ok === false) {
    issues.push({ code: 'manifest-validation-failed', level: 'error', errors: registryPreflight.validation.errors || 0 });
  }

  const pipeline = options.manifests ? buildAssetPipelineReport(options.manifests) : null;
  if (pipeline && !pipeline.ok) {
    issues.push({ code: 'asset-pipeline-errors', level: 'error', errors: pipeline.errors });
  }

  const channelReport = animationChannelReport(options.channels);
  if (!channelReport.ok) {
    warnings.push({ code: 'animation-channel-conflicts', level: 'warning', conflicts: channelReport.conflicts.length });
  }

  const editor = options.levelEditorHealth || null;
  if (editor && editor.ok === false) {
    issues.push({ code: 'level-editor-animation-health-failed', level: 'error' });
  }

  return {
    version: ANIMATION_PIPELINE_VERSION,
    ok: issues.length === 0,
    flags,
    issues,
    warnings,
    warningDisposition: warnings.map(warningDisposition),
    issueDisposition: issues.map((row) => ({
      code: row?.code || 'unknown',
      level: row?.level || 'error',
      authoringOnly: false,
      blocksRuntime: true
    })),
    tooling: TOOLING_CAPABILITIES,
    tuning: animationTuningDebug(),
    playerStates: PLAYER_LOCOMOTION_STATES,
    semanticClips: SEMANTIC_MIXAMO_CLIPS,
    channels: channelReport,
    weapon,
    handGrip,
    locomotionFeel,
    enemyAnimation,
    registryPreflight,
    assetPipeline: pipeline ? {
      ok: pipeline.ok,
      errors: pipeline.errors,
      warnings: pipeline.warnings,
      contract: pipeline.contract
    } : null,
    levelEditor: editor
  };
}
