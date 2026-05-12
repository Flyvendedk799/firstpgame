/**
 * Sens matching via cm/360 (same idea as GamingSmart / Kovaak's calculators).
 * Cross-check: https://gamingsmart.com/mouse-sensitivity-converter/
 * and game-specific pages (e.g. /marvel-rivals/).
 *
 * CLEARANCE yaw: radians per pixel = LOOK_RAD_PER_PIXEL_PER_SENS_UNIT * SETTINGS.sens
 * Other games reduce to equivalent Source (m_yaw 0.022°) sensitivities where documented.
 *
 * Accuracy notes:
 * - CS2, Valorant, Marvel Rivals: fixed ratios vs Source m_yaw 0.022. MR÷~1.2571 matches a live
 *   GamingSmart scrape (npm run test:sens:crosscheck), not every article’s rounded “MR = CS×1.25”.
 *   “Valorant × 4 → Marvel” similarly rounds vs our Val chain. Browser pointer steps vs in-engine
 *   counts can still diverge slightly.
 * - COD Warzone / recent MW (this preset): Live GamingSmart Warzone ↔ CS2 uses ÷ (10⁄₃) (~3.333);
 *   previously ×0.03 was a typo (10× weak, always hit CLEARANCE sens floor 0.2).
 * - Overwatch 2: ÷3.333 vs CS equiv — common approximation; Blizzard scaling can drift.
 * - Apex / THE FINALS: treated as Source-style yaw in many public tables (~approx.).
 *
 * DPI is the mouse hardware DPI assumed for counts — use the same DPI you plug into external tools.
 */

export const LOOK_RAD_PER_PIXEL_PER_SENS_UNIT = 0.0018;

export const DEFAULT_MOUSE_DPI = 800;

/** Valorant sensitivity → equivalent CS yaw scale (widely cited ≈ π/√2 / 140 style). */
const VAL_TO_CS_RATIO = 3.181818181818181;

/** OW2 horizontal sens ≈ CS * 10/3 (community match to Source feel). */
const OW2_TO_CS_RATIO = 1 / 3.3333333333333335;

/** Marvel Rivals horizontal → CS2 (m_yaw 0.022) equiv: GamingSmart ≈ 1.25713× (scripts/sens-gamingsmart-crosscheck.mjs). */
const MR_SENS_TO_CS_EQUIV_RATIO = 1 / 1.257133;

/** Warzone / recent COD horizontal (GamingSmart `call-of-duty-warzone`): CS2-equiv ≈ WZ ÷ (10/3) — wrong to use ×0.03 (that clamps CLEARANCE sens to minimum). */
const COD_WZ_GAMINGSMART_TO_CS_RATIO = 1 / 3.3333333333333335;

/** Source-engine family: yaw 0.022° per “count” × sens → cm/360. */
export function sourceCm360(sens, dpi = DEFAULT_MOUSE_DPI) {
  const d = dpi > 50 ? dpi : DEFAULT_MOUSE_DPI;
  const s = sens > 1e-8 ? sens : 1e-8;
  const M_YAW_DEG = 0.022;
  return (360 * 2.54) / (M_YAW_DEG * s * d);
}

/** This game — must stay in sync with main loop mouse look (see LOOK_RAD…). */
export function clearanceCm360(sens, dpi = DEFAULT_MOUSE_DPI) {
  const d = dpi > 50 ? dpi : DEFAULT_MOUSE_DPI;
  const s = sens > 1e-8 ? sens : 1e-8;
  return (2 * Math.PI * 2.54) / (LOOK_RAD_PER_PIXEL_PER_SENS_UNIT * s * d);
}

export function clearanceSensFromCm360(cm360, dpi = DEFAULT_MOUSE_DPI) {
  const dpiAdj = dpi > 50 ? dpi : DEFAULT_MOUSE_DPI;
  const cm = Math.max(cm360, 1e-4);
  return (2 * Math.PI * 2.54) / (LOOK_RAD_PER_PIXEL_PER_SENS_UNIT * dpiAdj * cm);
}

function valCm360(sens, dpi) {
  return sourceCm360(sens * VAL_TO_CS_RATIO, dpi);
}

function overwatch2Cm360(sens, dpi) {
  return sourceCm360(sens * OW2_TO_CS_RATIO, dpi);
}

function marvelRivalsCm360(sens, dpi) {
  return sourceCm360(sens * MR_SENS_TO_CS_EQUIV_RATIO, dpi);
}

function codMwApproxCm360(sens, dpi) {
  return sourceCm360(sens * COD_WZ_GAMINGSMART_TO_CS_RATIO, dpi);
}


/** @typedef {{ id: string, label: string, approximate?: boolean, toCm360: (s:number, dpi:number)=>number }} SensGameRef */

/** @type {SensGameRef[]} */
export const GAME_SENS_PRESETS = [
  { id: 'cs2', label: 'CS2 / CS:GO', toCm360: sourceCm360 },
  { id: 'valorant', label: 'Valorant', toCm360: valCm360 },
  {
    id: 'marvel_rivals',
    label: 'Marvel Rivals',
    toCm360: marvelRivalsCm360
  },
  { id: 'overwatch2', label: 'Overwatch 2', approximate: true, toCm360: overwatch2Cm360 },
  { id: 'apex', label: 'Apex Legends', approximate: true, toCm360: sourceCm360 },
  { id: 'cod_mw_wz', label: 'COD · Warzone / MW horiz.', approximate: true, toCm360: codMwApproxCm360 },
  // Same underlying Source-style yaw assumption as Apex in most public tables.
  { id: 'the_finals', label: 'THE FINALS', approximate: true, toCm360: sourceCm360 }
];

const BY_ID = new Map(GAME_SENS_PRESETS.map((g) => [g.id, g]));

/**
 * CLEARANCE SETTINGS.sens that matches ref game sens at given DPI (cm/360 pipeline).
 */
export function matchingClearanceSens(gameId, refSens, dpi = DEFAULT_MOUSE_DPI) {
  const g = BY_ID.get(gameId);
  if (!g || !Number.isFinite(refSens) || refSens <= 0) return null;
  const dpiAdj = dpi > 50 ? dpi : DEFAULT_MOUSE_DPI;
  const cm360 = g.toCm360(refSens, dpiAdj);
  if (!Number.isFinite(cm360) || cm360 <= 0) return null;
  return clearanceSensFromCm360(cm360, dpiAdj);
}
