import { SEMANTIC_MIXAMO_CLIPS } from './profiles.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function round(v, digits = 4) {
  return Number((Number(v) || 0).toFixed(digits));
}

function norm(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^mixamorig:?/, '')
    .replace(/[^a-z0-9]/g, '');
}

function clipListFromSource(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source.filter(Boolean).map(String);
  if (Array.isArray(source.clips)) return source.clips.filter(Boolean).map(String);
  if (source.actions && typeof source.actions === 'object') return Object.keys(source.actions);
  if (typeof source === 'object') return Object.keys(source);
  return [];
}

const SEMANTIC_ALIASES = Object.freeze({
  idle: ['idle', 'idleloo', 'standingidle', 'breathingidle'],
  walk: ['walk', 'walking', 'casualwalk', 'walkforward', 'patrol'],
  run: ['run', 'running', 'sprint', 'chase'],
  strafeLeft: ['strafeleft', 'leftstrafe', 'walkleft'],
  strafeRight: ['straferight', 'rightstrafe', 'walkright'],
  crouchIdle: ['crouchidle', 'crouchedidle', 'coveridle'],
  crouchWalk: ['crouchwalk', 'crouchedwalk', 'coverwalk'],
  jumpStart: ['jumpstart', 'jump'],
  fallLoop: ['fallloop', 'falling', 'fall'],
  landLight: ['landlight', 'land'],
  landHeavy: ['landheavy', 'heavyland'],
  vault: ['vault', 'climb', 'mantle'],
  reload: ['reload', 'riflereload', 'pistolreload', 'magreload'],
  fireAdditive: ['fireadditive', 'fire', 'shoot', 'shooting'],
  hitHead: ['hithead', 'flinchhead', 'headhit', 'headshot'],
  hitBody: ['hitbody', 'flinchbody', 'flinchtorso', 'bodyhit', 'stagger'],
  hitLeg: ['hitleg', 'flinchleg', 'leghit'],
  deathForward: ['deathforward', 'deathtorso', 'deathslump', 'dead', 'death'],
  deathBack: ['deathback', 'fallback', 'knockback', 'dead', 'death'],
  deathSide: ['deathside', 'deathleft', 'deathright', 'dead', 'death']
});

const LOOPING_SEMANTICS = new Set([
  'idle',
  'walk',
  'run',
  'strafeLeft',
  'strafeRight',
  'crouchIdle',
  'crouchWalk',
  'fallLoop'
]);

function semanticAliases(semantic) {
  return [semantic].concat(SEMANTIC_ALIASES[semantic] || []);
}

export function buildSemanticClipBinding(source, options = {}) {
  const clips = clipListFromSource(source);
  const normalized = new Map();
  for (const clip of clips) normalized.set(norm(clip), clip);
  const semantics = options.semanticClips || SEMANTIC_MIXAMO_CLIPS;
  const map = {};
  const missing = [];
  for (const semantic of semantics) {
    let found = null;
    for (const alias of semanticAliases(semantic)) {
      const key = norm(alias);
      if (normalized.has(key)) {
        found = normalized.get(key);
        break;
      }
    }
    if (found) map[semantic] = found;
    else missing.push(semantic);
  }
  return {
    ok: missing.length === 0,
    sourceId: options.sourceId || source?.id || null,
    clips,
    map,
    availableSemantics: Object.keys(map),
    missingSemantics: missing,
    fallback: options.fallback || source?.fallback || 'procedural-animation'
  };
}

export function semanticClipForEnemyStatus(status = {}, enemy = {}) {
  const state = String(status.state || enemy.animationState || '').toLowerCase();
  const intent = String(status.intent || '').toLowerCase();
  const limb = String(enemy._lastHitLimbId || enemy.group?.userData?.lastHitLimb || '').toLowerCase();
  if (enemy.dead || state === 'death' || intent === 'death') {
    const side = Math.abs(enemy.staggerDir?.x || enemy.lastPlayerDir?.x || 0);
    if (enemy._deathByDropkick || state.includes('back')) return 'deathBack';
    if (side > 0.45) return 'deathSide';
    return 'deathForward';
  }
  if (state.includes('hit') || intent === 'hit') {
    if (state.includes('head') || limb.includes('head') || limb.includes('neck')) return 'hitHead';
    if (limb.includes('thigh') || limb.includes('shin') || limb.includes('leg')) return 'hitLeg';
    return 'hitBody';
  }
  if (state.includes('vault') || intent === 'vault') return 'vault';
  if (state.includes('reload') || intent === 'reload') return 'reload';
  if (state.includes('strafeleft')) return 'strafeLeft';
  if (state.includes('straferight')) return 'strafeRight';
  if (state.includes('crouch') || intent === 'cover') return enemy._moveSpeedVis > 0.12 ? 'crouchWalk' : 'crouchIdle';
  if (state.includes('sprint') || intent === 'flank' || intent === 'move' && (status.speed || 0) > 2.9) return 'run';
  if (state.includes('walk') || state.includes('patrol') || (status.speed || 0) > 0.1) return 'walk';
  return 'idle';
}

export function additiveSemanticsForEnemyStatus(status = {}, enemy = {}) {
  const out = [];
  const state = String(status.state || enemy.animationState || '').toLowerCase();
  if (state === 'fire' || status.intent === 'fire' || (enemy.shootRecoilTimer || 0) > 0) {
    out.push({ semantic: 'fireAdditive', weight: clamp01(0.45 + (enemy.shootRecoilTimer || 0) * 2.2) });
  }
  if (state.includes('hit') || status.intent === 'hit' || (enemy.bulletHitTimer || enemy.meleeHitTimer || enemy.staggerTimer || 0) > 0) {
    const semantic = semanticClipForEnemyStatus({ ...status, intent: 'hit' }, enemy);
    out.push({ semantic, weight: clamp01(0.55 + (enemy._hitImpactStrength || 1) * 0.24) });
  }
  return out;
}

export function resolveImportedClipPlan(options = {}) {
  const status = options.status || {};
  const enemy = options.enemy || {};
  const enabled = options.importedAnimationEnabled === true;
  const source = options.source || options.manifestEntry || options.availableClips || [];
  const binding = options.binding || buildSemanticClipBinding(source, {
    sourceId: options.sourceId || source?.id || status.assetProfiles?.animation || null,
    fallback: source?.fallback
  });
  const fallbackReasons = [];
  if (!enabled) fallbackReasons.push('imported-animation-disabled');

  const baseSemantic = semanticClipForEnemyStatus(status, enemy);
  const baseClip = binding.map[baseSemantic] || binding.map.idle || null;
  if (!baseClip) fallbackReasons.push(`missing-base-clip:${baseSemantic}`);
  else if (!binding.map[baseSemantic]) fallbackReasons.push(`semantic-fallback:${baseSemantic}->idle`);

  const upperSemantic = status.intent === 'reload' ? 'reload' : null;
  const upperClip = upperSemantic ? binding.map[upperSemantic] || null : null;
  if (upperSemantic && !upperClip) fallbackReasons.push(`missing-upper-clip:${upperSemantic}`);

  const additive = additiveSemanticsForEnemyStatus(status, enemy).map((row) => {
    const clip = binding.map[row.semantic] || null;
    if (!clip) fallbackReasons.push(`missing-additive-clip:${row.semantic}`);
    return {
      semantic: row.semantic,
      clip,
      actionName: clip,
      weight: round(row.weight),
      playback: 'oneshot',
      additive: row.semantic === 'fireAdditive' || row.semantic.startsWith('hit')
    };
  }).filter((row) => row.clip);

  return {
    enabled,
    sourceId: binding.sourceId,
    ok: enabled && !!baseClip,
    base: {
      semantic: baseSemantic,
      clip: baseClip,
      actionName: baseClip,
      weight: baseClip ? 1 : 0,
      playback: LOOPING_SEMANTICS.has(baseSemantic) ? 'loop' : 'oneshot'
    },
    upper: upperSemantic ? {
      semantic: upperSemantic,
      clip: upperClip,
      actionName: upperClip,
      weight: upperClip ? 1 : 0,
      playback: 'oneshot'
    } : null,
    additive,
    binding: {
      ok: binding.ok,
      availableSemantics: binding.availableSemantics.slice(),
      missingSemantics: binding.missingSemantics.slice()
    },
    blend: {
      baseFade: status.intent === 'hit' || status.intent === 'death' ? 0.08 : 0.18,
      upperFade: 0.10,
      additiveFade: 0.045
    },
    fallbackReasons: Array.from(new Set(fallbackReasons)),
    fallback: binding.fallback
  };
}

export function importedClipPlanDebug(plan) {
  const p = plan || resolveImportedClipPlan({ importedAnimationEnabled: false });
  return {
    enabled: p.enabled !== false,
    ok: !!p.ok,
    sourceId: p.sourceId || null,
    base: p.base ? { semantic: p.base.semantic, clip: p.base.clip, weight: round(p.base.weight), playback: p.base.playback } : null,
    upper: p.upper ? { semantic: p.upper.semantic, clip: p.upper.clip, weight: round(p.upper.weight), playback: p.upper.playback } : null,
    additive: (p.additive || []).map((a) => ({ semantic: a.semantic, clip: a.clip, weight: round(a.weight), additive: !!a.additive })),
    missingSemantics: p.binding?.missingSemantics ? p.binding.missingSemantics.slice() : [],
    fallbackReasons: Array.isArray(p.fallbackReasons) ? p.fallbackReasons.slice() : [],
    fallback: p.fallback || null
  };
}
