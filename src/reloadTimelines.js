/**
 * Procedural reload timelines: normalized progress 0..1 vs P.reloadTimer / P.RELOAD_TIME.
 * Mag visibility + drop notify windows are expressed as [t0, t1) in normalized time.
 */

export const RELOAD_WEAPON_CLASS = {
  0: 'rifle',
  1: 'pistol',
  2: 'knife',
  3: 'shotgun',
  4: 'smg',
  5: 'marksman',
  6: 'pistolCompact',
  7: 'sniper'
};

function T(magHide0, magHide1, magDrop, chamber0, chamber1) {
  return {
    magHidden: [magHide0, magHide1],
    magDropAt: magDrop,
    chamber: [chamber0, chamber1],
    holoEase: 'smooth'
  };
}

const DEFAULTS = {
  rifle: T(0, 0.78, 0.2, 0.8, 1),
  pistol: T(0, 0.78, 0.22, 0.78, 1),
  pistolCompact: T(0, 0.76, 0.2, 0.76, 1),
  smg: T(0, 0.75, 0.18, 0.74, 1),
  shotgun: T(0, 0.72, 0.25, 0.7, 1),
  marksman: T(0, 0.8, 0.24, 0.82, 1),
  sniper: T(0, 0.82, 0.28, 0.84, 1),
  knife: null
};

export function getReloadWeaponClass(weaponIdx) {
  return RELOAD_WEAPON_CLASS[weaponIdx] || 'rifle';
}

export function getReloadTimelineSpec(weaponIdx) {
  const c = getReloadWeaponClass(weaponIdx);
  if (c === 'knife') return null;
  return DEFAULTS[c] || DEFAULTS.rifle;
}

export function reloadMagHidden(rt, weaponIdx) {
  const s = getReloadTimelineSpec(weaponIdx);
  if (!s) return false;
  return rt >= s.magHidden[0] && rt < s.magHidden[1];
}

export function reloadShouldDropMag(rt, weaponIdx, wasBelow) {
  const s = getReloadTimelineSpec(weaponIdx);
  if (!s) return false;
  const thr = s.magDropAt;
  return !wasBelow && rt >= thr;
}

export function reloadHoloVisualProgress(rt, weaponIdx) {
  const s = getReloadTimelineSpec(weaponIdx);
  if (!s) return rt;
  const [c0, c1] = s.chamber;
  if (rt < c0) return rt / Math.max(0.001, c0) * 0.65;
  if (rt < c1) return 0.65 + ((rt - c0) / Math.max(0.001, c1 - c0)) * 0.35;
  return 1;
}

export function reloadPhaseLabel(rt, weaponIdx) {
  const s = getReloadTimelineSpec(weaponIdx);
  if (!s) return 'n/a';
  if (rt < 0.12) return 'release';
  if (reloadMagHidden(rt, weaponIdx)) return rt < s.magDropAt ? 'remove' : 'retrieve';
  if (rt < s.chamber[0]) return 'insert';
  if (rt < s.chamber[1]) return 'chamber';
  return 'settle';
}
