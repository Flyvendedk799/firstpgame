/**
 * Per-building machine patches for native campaign encounters (cloned from B01).
 * Merged after narrative overlay in `campaignEncounters.js` — spawns, director keys, cover anchors.
 */

/** Optional extra cover-hint world anchors keyed by encounter `cover` / `coverHint` string. */
export const COVER_HINT_ANCHOR_PATCH_BY_BN = {
  2: {
    spine_pinch: [0.35, 2.25],
    relay_desk: [-13.9, 2.45],
    drum_spool: [14.35, 0.12],
  },
  3: {
    spine_pinch: [-0.2, 2.1],
    intake_apron: [0.15, 12.9],
    cage_pillar_west: [-12.7, -15.8],
  },
  4: {
    relay_desk: [-14.1, 2.35],
    vestibule_face: [3.1, -13.85],
  },
  5: {
    drum_spool: [14.55, -0.08],
    desk_rail: [13.45, -16.9],
  },
  6: {
    spine_pinch: [0.5, 1.95],
    fe_stack: [12.85, 12.1],
  },
  7: {
    west_lane_fork: [-11.85, 15.2],
    east_stack: [14.05, 15.1],
  },
  8: {
    rack_face: [14, 0],
    cold_row: [0, 18],
  },
  9: {
    customs_lane: [0, 17],
    sand_berm: [-14, -18],
  },
  10: {
    spine_pinch: [-0.25, 2.05],
    relay_desk: [-14.05, 2.42],
    drum_spool: [14.4, -0.05],
  },
  11: {
    deck_lane: [0, 19],
    port_row: [-12, 20],
  },
  12: {
    atrium_glass: [-13, 19],
    helipad_rail: [14, -18],
  },
};

function _nudgeCoord(v, delta, maxAbs) {
  const x = Number(v);
  if (!Number.isFinite(x)) return v;
  const d = Number(delta) || 0;
  const nx = x + d;
  if (Number.isFinite(maxAbs) && Math.abs(nx) > maxAbs) return x;
  return nx;
}

/**
 * Deterministic micro-shifts so B02–B12 authored coordinates are not bitwise-identical to B01.
 * @param {object} raw encounter def (mutated)
 * @param {number} bn
 */
export function mergeNativeEncounterTactics(raw, bn) {
  if (!raw || bn < 2 || bn > 12) return;
  const seed = bn * 17;
  const dx = (((seed * 3) % 11) - 5) * 0.22;
  const dz = (((seed * 5) % 13) - 6) * 0.2;
  const zones = raw.authoredSpawns;
  if (zones && typeof zones === 'object') {
    for (const key of ['frontZone', 'middleZone', 'backZone']) {
      const arr = zones[key];
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        if (Number.isFinite(row.x)) row.x = _nudgeCoord(row.x, dx, 18);
        if (Number.isFinite(row.z)) row.z = _nudgeCoord(row.z, dz, 24);
      }
    }
  }
  const enc = raw.encounters;
  if (Array.isArray(enc)) {
    for (const e of enc) {
      if (!e || !Array.isArray(e.enemies)) continue;
      for (const u of e.enemies) {
        if (!u || !u.spawn || typeof u.spawn !== 'object') continue;
        const sp = u.spawn;
        if (Number.isFinite(sp.x)) sp.x = _nudgeCoord(sp.x, dx * 0.85, 18);
        if (Number.isFinite(sp.z)) sp.z = _nudgeCoord(sp.z, dz * 0.85, 24);
      }
    }
  }
  /** Alternate FE / FW ingress so alarm pairs do not always stack the same door per building. */
  const entryAlt = bn % 2 === 0 ? 'spawnDoor_FE' : 'spawnDoor_FW';
  for (const e of enc || []) {
    if (!e || !e.id || !/_alarm_relay$/.test(e.id)) continue;
    if (!Array.isArray(e.reinforcements)) continue;
    for (const r of e.reinforcements) {
      const tr = r && r.trigger;
      if (!tr || tr.type !== 'alarm_active_for' || !r.squad) continue;
      r.entry = entryAlt;
    }
  }
}
