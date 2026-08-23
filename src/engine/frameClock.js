/**
 * Frame clock — the engine's single source of time.
 *
 * Replaces the ad-hoc `Math.min(clock.getDelta(), .05)` + `freezeTime` pattern
 * with an explicit, testable time source that a real engine needs:
 *
 *  - spike clamping     a hitch (GC, alt-tab, breakpoint) must not teleport the
 *                       simulation; the frame delta is clamped to `maxFrameSeconds`
 *  - pause / time scale  slow-mo, hit-stop and debug freeze are the same knob
 *  - fixed timestep      deterministic simulation steps decoupled from render rate
 *  - catch-up clamp      after a long stall, run at most `maxCatchUpSteps` fixed
 *                        steps and drop the rest, so a slow frame cannot cause the
 *                        "spiral of death" where each frame owes more steps than the
 *                        last
 *  - interpolation alpha the 0..1 remainder used to blend render state between the
 *                        last two simulation steps
 *
 * Pure and dependency-free: no THREE, no DOM, no globals — so it can be unit
 * tested in plain node (see scripts/engine-core-static-probe.mjs) and lifted into
 * a standalone engine as-is.
 */

export const FRAME_CLOCK_VERSION = 'frame-clock.v1';

const DEFAULTS = {
  /** Longest delta a single frame may advance the sim (spike clamp), seconds. */
  maxFrameSeconds: 0.05,
  /** Fixed simulation step, seconds. 1/60 by default. */
  fixedStepSeconds: 1 / 60,
  /** Max fixed steps per frame before the remainder is dropped. */
  maxCatchUpSteps: 5,
  /** Global multiplier: 0 = frozen, 0.3 = slow-mo, 1 = realtime. */
  timeScale: 1,
};

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createFrameClock(options = {}) {
  const cfg = {
    maxFrameSeconds: Math.max(1e-4, finite(options.maxFrameSeconds, DEFAULTS.maxFrameSeconds)),
    fixedStepSeconds: Math.max(1e-4, finite(options.fixedStepSeconds, DEFAULTS.fixedStepSeconds)),
    maxCatchUpSteps: Math.max(1, Math.floor(finite(options.maxCatchUpSteps, DEFAULTS.maxCatchUpSteps))),
    timeScale: Math.max(0, finite(options.timeScale, DEFAULTS.timeScale)),
  };

  const state = {
    frame: 0,
    /** Wall-clock seconds since the first tick (unscaled, unclamped). */
    wallElapsed: 0,
    /** Simulated seconds elapsed (scaled + clamped) — what gameplay should use. */
    elapsed: 0,
    rawDelta: 0,
    delta: 0,
    accumulator: 0,
    alpha: 0,
    steps: 0,
    droppedSteps: 0,
    paused: false,
    lastNowMs: null,
  };

  /**
   * Advance the clock. Call once per rendered frame.
   * @param {number} nowMs monotonic timestamp in milliseconds (performance.now()).
   * @returns {{frame:number,delta:number,rawDelta:number,elapsed:number,steps:number,alpha:number,droppedSteps:number}}
   */
  function tick(nowMs) {
    const now = finite(nowMs, state.lastNowMs ?? 0);
    if (state.lastNowMs === null) state.lastNowMs = now;

    // Never allow a negative delta (clock adjustments / bad input).
    const rawDelta = Math.max(0, (now - state.lastNowMs) / 1000);
    state.lastNowMs = now;
    state.rawDelta = rawDelta;
    state.wallElapsed += rawDelta;

    const clamped = Math.min(rawDelta, cfg.maxFrameSeconds);
    const delta = state.paused ? 0 : clamped * cfg.timeScale;
    state.delta = delta;
    state.elapsed += delta;
    state.frame += 1;

    // Fixed-step accumulation with spiral-of-death protection.
    state.accumulator += delta;
    let steps = Math.floor(state.accumulator / cfg.fixedStepSeconds);
    let dropped = 0;
    if (steps > cfg.maxCatchUpSteps) {
      dropped = steps - cfg.maxCatchUpSteps;
      steps = cfg.maxCatchUpSteps;
      // Discard the unpayable debt rather than trying (and failing) to catch up.
      state.accumulator = 0;
    } else if (steps > 0) {
      state.accumulator -= steps * cfg.fixedStepSeconds;
    }
    state.steps = steps;
    state.droppedSteps = dropped;
    state.alpha = cfg.fixedStepSeconds > 0
      ? Math.min(1, Math.max(0, state.accumulator / cfg.fixedStepSeconds))
      : 0;

    return {
      frame: state.frame,
      delta: state.delta,
      rawDelta: state.rawDelta,
      elapsed: state.elapsed,
      steps: state.steps,
      alpha: state.alpha,
      droppedSteps: state.droppedSteps,
    };
  }

  /** Run `fn(fixedStepSeconds, i)` once per pending fixed step. */
  function forEachFixedStep(fn) {
    if (typeof fn !== 'function') return 0;
    for (let i = 0; i < state.steps; i++) fn(cfg.fixedStepSeconds, i);
    return state.steps;
  }

  function setPaused(paused) { state.paused = !!paused; return state.paused; }
  function isPaused() { return state.paused; }

  function setTimeScale(scale) {
    cfg.timeScale = Math.max(0, finite(scale, cfg.timeScale));
    return cfg.timeScale;
  }
  function getTimeScale() { return cfg.timeScale; }

  /** Forget the previous timestamp so the next tick reports a ~0 delta. */
  function resetDelta() { state.lastNowMs = null; state.accumulator = 0; state.alpha = 0; state.steps = 0; }

  function reset() {
    state.frame = 0; state.wallElapsed = 0; state.elapsed = 0;
    state.rawDelta = 0; state.delta = 0; state.accumulator = 0;
    state.alpha = 0; state.steps = 0; state.droppedSteps = 0;
    state.lastNowMs = null;
  }

  function snapshot() {
    return {
      version: FRAME_CLOCK_VERSION,
      frame: state.frame,
      delta: Number(state.delta.toFixed(5)),
      rawDelta: Number(state.rawDelta.toFixed(5)),
      elapsed: Number(state.elapsed.toFixed(3)),
      wallElapsed: Number(state.wallElapsed.toFixed(3)),
      alpha: Number(state.alpha.toFixed(3)),
      steps: state.steps,
      droppedSteps: state.droppedSteps,
      paused: state.paused,
      timeScale: cfg.timeScale,
      fixedStepSeconds: cfg.fixedStepSeconds,
      maxFrameSeconds: cfg.maxFrameSeconds,
      maxCatchUpSteps: cfg.maxCatchUpSteps,
    };
  }

  return { tick, forEachFixedStep, setPaused, isPaused, setTimeScale, getTimeScale, resetDelta, reset, snapshot, config: cfg, state };
}
