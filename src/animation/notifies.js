export const ANIMATION_NOTIFY_NAMES = Object.freeze([
  'footstepLeft',
  'footstepRight',
  'slideScrape',
  'landLight',
  'landHeavy',
  'vaultStart',
  'vaultLand',
  'magOut',
  'magDrop',
  'magIn',
  'reloadMagDrop',
  'boltBack',
  'boltForward',
  'slideRelease',
  'chamber',
  'shellEject',
  'muzzleFlash',
  'triggerPull',
  'meleeSwing',
  'meleeImpact',
  'meleeImpactFrame',
  'grenadePin',
  'throwRelease',
  'enemyArmorHit',
  'enemyDeathImpact',
  'inspectFocusPoint',
  'breathPeak',
  'sprintStart',
  'sprintStop',
  'wallJump',
  'dropkickStart',
  'dropkickImpact',
  'dropkickLand'
]);

const NOTIFY_SET = new Set(ANIMATION_NOTIFY_NAMES);

export function normalizeAnimationNotify(input, defaults = {}) {
  const raw = input && typeof input === 'object' ? input : { name: input };
  const name = String(raw.name || defaults.name || 'event');
  return {
    name,
    known: NOTIFY_SET.has(name),
    channel: raw.channel || defaults.channel || channelForNotify(name),
    frame: Number.isFinite(Number(raw.frame)) ? Number(raw.frame) : Number(defaults.frame) || 0,
    at: Number.isFinite(Number(raw.at)) ? Number(raw.at) : Number(defaults.at) || 0,
    weight: Number.isFinite(Number(raw.weight)) ? Number(raw.weight) : 1,
    payload: raw.payload || raw.data || {}
  };
}

export function normalizeNotifyList(list, defaults = {}) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizeAnimationNotify(row, defaults));
}

export function channelForNotify(name) {
  const n = String(name || '');
  if (n.startsWith('footstep') || n.startsWith('land') || n === 'slideScrape') return 'audio';
  if (n.includes('mag') || n.includes('bolt') || n.includes('shell') || n === 'triggerPull') return 'weapon';
  if (n.includes('muzzle') || n.includes('Armor') || n.includes('Death')) return 'vfx';
  if (n.includes('melee') || n.includes('throw') || n.includes('grenade')) return 'hands';
  return 'additive';
}

export function notifySummary(list) {
  const rows = normalizeNotifyList(list);
  const counts = {};
  const unknown = [];
  for (const n of rows) {
    counts[n.name] = (counts[n.name] || 0) + 1;
    if (!n.known) unknown.push(n.name);
  }
  return { count: rows.length, counts, unknown };
}
