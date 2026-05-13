/**
 * Phase 2 adaptive perf ladder — constants + percentile bands paired with
 * `_tickPerfAdaptive` / `_extrasForRenderStack` in main.js + configure() in rendering.js.
 */
export const PERF_GOVERNOR_PIXEL_FLOOR = 0.75;
/** Ultra tier permits a slightly lower render-scale floor before adaptive downscales further. */
export const PERF_GOVERNOR_PIXEL_ULTRA_FLOOR = 0.78;
export const PERF_GOVERNOR_VERSION = 2;

/** Ordered Phase-2 post holds applied under sustained GPU stress (first → last). Mirrors main ordering. */
export const PERF_GOVERNOR_PHASE2_HOLD_ORDER = ['dof', 'ssr', 'lut', 'sharpen', 'taa'];

export function perfGovernorThresholds(quality) {
  if (quality === 'ultra')
    return { p95Ms: 34, p99Ms: 44, emaMs: 32 };
  return { p95Ms: 26, p99Ms: 34, emaMs: 25 };
}

export function perfGovernorChillThresholds(quality) {
  if (quality === 'low')
    return { p95Ms: 24, p99Ms: 30, emaMs: 24 };
  return { p95Ms: 21, p99Ms: 26, emaMs: 20 };
}
