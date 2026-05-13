/**
 * Named patrol polylines for encounter-authored enemies (`patrol` field on specs).
 * Coordinates are world x,z in the standard campaign floor layout.
 */
const BASE_PATROL_ROUTES = {
  fe_compression_loop: [
    [14, 19],
    [12, 14],
    [15, 12],
    [16, 17],
  ],
  intake_center_beat: [
    [0, 15],
    [-4, 12],
    [4, 12],
    [0, 10],
  ],
  spine_doorline: [
    [0, 4],
    [-3, 0],
    [3, 0],
    [0, -3],
  ],
  drum_lateral: [
    [14, 3],
    [16, -2],
    [13, -4],
    [15, 0],
  ],
  cage_left_arc: [
    [-12, -14],
    [-8, -18],
    [-14, -19],
  ],
  cage_right_shuffle: [
    [4, -14],
    [2, -18],
    [6, -16],
  ],
  catwalk_window_beat: [
    [14, -18],
    [16, -14],
    [13, -20],
  ],
};

const CAMPAIGN_ROUTE_CENTERS_BY_BN = {
  2: { arrival: [0, 17], side: [-14, 17], flank: [13, 13], mid: [0, 2], objective: [-7, -1], signature: [0, -13], overwatch: [14, -16] },
  3: { arrival: [0, 18], side: [12, 14], flank: [-14, -1], mid: [0, 1], objective: [-13, -1], signature: [0, -13], overwatch: [14, -16] },
  4: { arrival: [0, 17], side: [-13, 14], flank: [13, 2], mid: [0, 1], objective: [-14, 2], signature: [0, -14], overwatch: [13, -16] },
  5: { arrival: [0, 15], side: [-14, -1], flank: [13, -1], mid: [0, 1], objective: [-14, -1], signature: [0, -14], overwatch: [13, -16] },
  6: { arrival: [0, 17], side: [14, 3], flank: [-14, -14], mid: [0, 1], objective: [-13, -13], signature: [0, -16], overwatch: [13, -14] },
  7: { arrival: [0, 17], side: [-13, 14], flank: [13, 2], mid: [0, 1], objective: [-13, 0], signature: [0, -14], overwatch: [13, -16] },
  8: { arrival: [-6, 16], side: [-14, -2], flank: [6, 13], mid: [0, 1], objective: [-14, -2], signature: [0, -15], overwatch: [13, -15] },
  9: { arrival: [0, 17], side: [14, 5], flank: [-14, -17], mid: [0, 1], objective: [-14, 2], signature: [0, -14], overwatch: [-13, -18] },
  10: { arrival: [0, 16], side: [-14, -1], flank: [13, -8], mid: [0, 1], objective: [-14, -1], signature: [0, -13], overwatch: [13, -14] },
  11: { arrival: [0, 17], side: [-14, -1], flank: [13, -7], mid: [0, 1], objective: [-14, -1], signature: [0, -15], overwatch: [13, -16] },
  12: { arrival: [0, 17], side: [-14, 0], flank: [14, -6], mid: [0, 1], objective: [-14, 0], signature: [0, -16], overwatch: [13, -17] },
};

function _makeCampaignRoutes() {
  const out = {};
  for (const [bnRaw, centers] of Object.entries(CAMPAIGN_ROUTE_CENTERS_BY_BN)) {
    const bn = String(bnRaw).padStart(2, '0');
    for (const [kind, c] of Object.entries(centers)) {
      const [x, z] = c;
      const xWide = kind === 'arrival' || kind === 'signature' ? 3.2 : 1.8;
      const zWide = kind === 'flank' || kind === 'side' ? 2.6 : 1.8;
      out[`b${bn}_${kind}_route`] = [
        [x, z],
        [x - xWide, z - zWide * 0.5],
        [x + xWide, z + zWide * 0.5],
        [x, z + (kind === 'signature' ? -2.2 : 1.6)],
      ];
    }
  }
  return out;
}

export const ENCOUNTER_PATROL_ROUTES = Object.freeze({
  ...BASE_PATROL_ROUTES,
  ..._makeCampaignRoutes(),
});
