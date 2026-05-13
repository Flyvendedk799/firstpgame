/**
 * Named patrol polylines for encounter-authored enemies (`patrol` field on specs).
 * Coordinates are world x,z in the standard campaign floor layout.
 */
export const ENCOUNTER_PATROL_ROUTES = Object.freeze({
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
});
