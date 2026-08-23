/**
 * System scheduler — turns an inline "call 40 update functions in a row" loop
 * into a declarative, ordered, measurable system list.
 *
 * What it buys over raw calls (i.e. why an engine wants this):
 *  - explicit phases and ordering instead of implicit source-line order
 *  - per-system timing, so "which system costs the frame" is data, not a guess
 *  - fault isolation: a system that throws cannot kill the frame, and a system
 *    that keeps throwing is quarantined instead of spamming errors forever
 *  - runtime enable/disable, for A/B and profiling
 *
 * Pure and dependency-free (no THREE, no DOM) so it unit tests in plain node and
 * can be lifted into a standalone engine.
 */

export const SYSTEM_SCHEDULER_VERSION = 'system-scheduler.v1';

const DEFAULT_PHASES = ['input', 'simulate', 'animate', 'viewmodel', 'render'];
/** Consecutive throws before a system is quarantined (disabled). */
const DEFAULT_FAULT_LIMIT = 3;

export function createSystemScheduler(options = {}) {
  const phases = Array.isArray(options.phases) && options.phases.length ? options.phases.slice() : DEFAULT_PHASES.slice();
  const faultLimit = Number.isFinite(options.faultLimit) ? Math.max(1, options.faultLimit | 0) : DEFAULT_FAULT_LIMIT;
  const now = typeof options.now === 'function'
    ? options.now
    : (typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now());

  /** phase -> system[] (kept sorted by `order`) */
  const byPhase = new Map(phases.map((p) => [p, []]));
  const byName = new Map();

  function add(spec) {
    const { name, phase, fn } = spec || {};
    if (typeof fn !== 'function') throw new Error(`system "${name}" needs a fn`);
    if (!name) throw new Error('system needs a name');
    if (!byPhase.has(phase)) throw new Error(`unknown phase "${phase}" (have: ${phases.join(', ')})`);
    if (byName.has(name)) throw new Error(`duplicate system "${name}"`);
    const system = {
      name,
      phase,
      fn,
      order: Number.isFinite(spec.order) ? spec.order : 0,
      enabled: spec.enabled !== false,
      lastMs: 0,
      emaMs: 0,
      calls: 0,
      faults: 0,
      consecutiveFaults: 0,
      quarantined: false,
      lastError: null,
    };
    byName.set(name, system);
    const list = byPhase.get(phase);
    list.push(system);
    list.sort((a, b) => a.order - b.order);
    return system;
  }

  /**
   * Run every enabled system in `phase`.
   * @param {string} phase
   * @param {*} ctx passed to each system fn
   * @returns {{phase:string, ran:number, ms:number, faults:number}}
   */
  function run(phase, ctx) {
    const list = byPhase.get(phase);
    if (!list) return { phase, ran: 0, ms: 0, faults: 0 };
    const phaseStart = now();
    let ran = 0, faults = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s.enabled || s.quarantined) continue;
      const t0 = now();
      try {
        s.fn(ctx);
        s.consecutiveFaults = 0;
      } catch (err) {
        faults++;
        s.faults++;
        s.consecutiveFaults++;
        s.lastError = String((err && err.message) || err);
        if (s.consecutiveFaults >= faultLimit) {
          s.quarantined = true;
          // Surfaced once, not every frame.
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[scheduler] quarantined system "${s.name}" after ${s.consecutiveFaults} consecutive faults: ${s.lastError}`);
          }
        }
      }
      const ms = now() - t0;
      s.lastMs = ms;
      s.emaMs = s.emaMs * 0.9 + ms * 0.1;
      s.calls++;
      ran++;
    }
    return { phase, ran, ms: now() - phaseStart, faults };
  }

  function setEnabled(name, enabled) {
    const s = byName.get(name);
    if (!s) return false;
    s.enabled = !!enabled;
    if (enabled) { s.quarantined = false; s.consecutiveFaults = 0; }
    return true;
  }

  function has(name) { return byName.has(name); }

  function snapshot() {
    const systems = [...byName.values()]
      .map((s) => ({
        name: s.name, phase: s.phase, order: s.order,
        enabled: s.enabled, quarantined: s.quarantined,
        lastMs: Number(s.lastMs.toFixed(3)), emaMs: Number(s.emaMs.toFixed(3)),
        calls: s.calls, faults: s.faults, lastError: s.lastError,
      }))
      .sort((a, b) => b.emaMs - a.emaMs);
    return { version: SYSTEM_SCHEDULER_VERSION, phases: phases.slice(), count: systems.length, systems };
  }

  return { add, run, setEnabled, has, snapshot, phases };
}
