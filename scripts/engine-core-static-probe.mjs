#!/usr/bin/env node
/**
 * Engine core probe — pure node, no browser, no renderer.
 *
 * Exercises src/engine/frameClock.js and src/engine/systemScheduler.js against
 * the behaviours an engine depends on: spike clamping, pause, time scale,
 * fixed-step accumulation, spiral-of-death protection, interpolation alpha,
 * system ordering, per-system timing, and fault quarantine.
 */
import { createFrameClock, FRAME_CLOCK_VERSION } from '../src/engine/frameClock.js';
import { createSystemScheduler, SYSTEM_SCHEDULER_VERSION } from '../src/engine/systemScheduler.js';

let failures = 0;
const results = [];
function check(name, cond, detail) {
  if (cond) { results.push({ name, ok: true }); return; }
  failures++;
  results.push({ name, ok: false, detail: detail ?? null });
  console.error(`FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ── frame clock ──────────────────────────────────────────────────────────────
{
  const c = createFrameClock({ maxFrameSeconds: 0.05, fixedStepSeconds: 1 / 60, maxCatchUpSteps: 5 });
  const first = c.tick(1000);
  check('clock/first tick has zero delta', first.delta === 0, first);

  const f2 = c.tick(1016);
  check('clock/normal frame delta', near(f2.delta, 0.016, 1e-9), f2.delta);
  check('clock/frame counter advances', f2.frame === 2, f2.frame);

  // 2s hitch must clamp to maxFrameSeconds, not teleport the sim.
  const spike = c.tick(1016 + 2000);
  check('clock/spike clamped', near(spike.delta, 0.05, 1e-9), spike.delta);
  check('clock/rawDelta preserved for telemetry', near(spike.rawDelta, 2.0, 1e-9), spike.rawDelta);
  check('clock/spiral protection drops steps', spike.steps <= 5, spike);

  // Pause freezes sim time but still advances the frame counter.
  c.setPaused(true);
  const paused = c.tick(1016 + 2000 + 16);
  check('clock/paused delta is zero', paused.delta === 0, paused.delta);
  check('clock/paused still counts frames', paused.frame === 4, paused.frame);
  const elapsedWhilePaused = c.snapshot().elapsed;
  c.tick(1016 + 2000 + 32);
  check('clock/paused does not advance elapsed', near(c.snapshot().elapsed, elapsedWhilePaused, 1e-9));
  c.setPaused(false);

  // Time scale (slow-mo / hit-stop).
  c.setTimeScale(0.5);
  const slow = c.tick(1016 + 2000 + 32 + 20);
  check('clock/time scale halves delta', near(slow.delta, 0.01, 1e-9), slow.delta);
  c.setTimeScale(1);

  // Negative / bogus timestamps must not produce negative deltas.
  const back = c.tick(0);
  check('clock/never negative delta', back.delta >= 0 && back.rawDelta >= 0, back);

  // Fixed-step accumulation: 105ms at 1/60 = 6.3 steps -> 6 whole steps, .3 alpha.
  // (100ms would be 5.9999.. in floating point, i.e. 5 steps - a real gotcha.)
  const c2 = createFrameClock({ fixedStepSeconds: 1 / 60, maxFrameSeconds: 1, maxCatchUpSteps: 8 });
  c2.tick(0);
  const acc = c2.tick(105);
  check('clock/fixed steps counted', acc.steps === 6, acc.steps);
  check('clock/alpha in range', acc.alpha >= 0 && acc.alpha < 1, acc.alpha);
  let ran = 0;
  const stepped = c2.forEachFixedStep((step) => { ran++; check('clock/step size', near(step, 1 / 60, 1e-9)); });
  check('clock/forEachFixedStep runs each step', ran === 6 && stepped === 6, { ran, stepped });

  // Catch-up clamp: a huge unpaused delta must not queue unbounded steps.
  const c3 = createFrameClock({ fixedStepSeconds: 1 / 60, maxFrameSeconds: 10, maxCatchUpSteps: 3 });
  c3.tick(0);
  const flood = c3.tick(5000);
  check('clock/catch-up clamped', flood.steps === 3, flood.steps);
  check('clock/dropped steps reported', flood.droppedSteps > 0, flood.droppedSteps);
  check('clock/accumulator cleared after drop', near(c3.snapshot().alpha, 0, 1e-9), c3.snapshot().alpha);

  const snap = c.snapshot();
  check('clock/snapshot version', snap.version === FRAME_CLOCK_VERSION, snap.version);
  check('clock/snapshot is finite', Object.values(snap).every((v) => typeof v !== 'number' || Number.isFinite(v)), snap);
}

// ── system scheduler ─────────────────────────────────────────────────────────
{
  const order = [];
  let t = 0;
  const s = createSystemScheduler({ now: () => (t += 1), faultLimit: 2 });

  s.add({ name: 'late', phase: 'simulate', order: 50, fn: () => order.push('late') });
  s.add({ name: 'early', phase: 'simulate', order: 10, fn: () => order.push('early') });
  s.add({ name: 'mid', phase: 'simulate', order: 20, fn: (ctx) => order.push(`mid:${ctx.tag}`) });

  const res = s.run('simulate', { tag: 'x' });
  check('scheduler/runs in order', order.join(',') === 'early,mid:x,late', order);
  check('scheduler/reports ran count', res.ran === 3, res);
  check('scheduler/passes context', order[1] === 'mid:x', order[1]);

  check('scheduler/unknown phase is inert', s.run('nope', {}).ran === 0);
  check('scheduler/duplicate name rejected', (() => { try { s.add({ name: 'early', phase: 'simulate', fn() {} }); return false; } catch { return true; } })());
  check('scheduler/unknown phase rejected', (() => { try { s.add({ name: 'z', phase: 'bogus', fn() {} }); return false; } catch { return true; } })());
  check('scheduler/missing fn rejected', (() => { try { s.add({ name: 'y', phase: 'simulate' }); return false; } catch { return true; } })());

  // disable / enable
  s.setEnabled('mid', false);
  order.length = 0;
  s.run('simulate', { tag: 'y' });
  check('scheduler/disabled system skipped', order.join(',') === 'early,late', order);
  s.setEnabled('mid', true);

  // fault isolation + quarantine
  const seen = [];
  const s2 = createSystemScheduler({ now: () => (t += 1), faultLimit: 2 });
  s2.add({ name: 'boom', phase: 'simulate', order: 1, fn: () => { throw new Error('kaboom'); } });
  s2.add({ name: 'after', phase: 'simulate', order: 2, fn: () => seen.push('after') });
  const r1 = s2.run('simulate', {});
  check('scheduler/fault does not stop the phase', seen.length === 1, seen);
  check('scheduler/fault counted', r1.faults === 1, r1);
  s2.run('simulate', {});
  const snap2 = s2.snapshot();
  const boom = snap2.systems.find((x) => x.name === 'boom');
  check('scheduler/quarantines repeat offender', boom.quarantined === true, boom);
  check('scheduler/records last error', /kaboom/.test(boom.lastError || ''), boom.lastError);
  const before = seen.length;
  s2.run('simulate', {});
  check('scheduler/healthy systems keep running after quarantine', seen.length === before + 1, seen.length);

  const snap = s.snapshot();
  check('scheduler/snapshot version', snap.version === SYSTEM_SCHEDULER_VERSION, snap.version);
  check('scheduler/snapshot lists systems', snap.count === 3, snap.count);
  check('scheduler/timings recorded', snap.systems.every((x) => Number.isFinite(x.emaMs) && Number.isFinite(x.lastMs)), snap.systems);
}

const summary = { ok: failures === 0, checks: results.length, failures, versions: { frameClock: FRAME_CLOCK_VERSION, systemScheduler: SYSTEM_SCHEDULER_VERSION } };
console.log(JSON.stringify(summary, null, 2));
process.exit(failures === 0 ? 0 : 1);
