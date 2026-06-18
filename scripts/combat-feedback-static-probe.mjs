import {
  COMBAT_FEEDBACK_VERSION,
  buildCombatFeedbackSnapshot,
  tickPlayerCombatFeedback
} from '../src/game/combatFeedback.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(COMBAT_FEEDBACK_VERSION === 'combat-feedback.v2', 'unexpected combat feedback version');

const pressured = {
  _gunplaySpreadVisual: 1.0,
  _surfaceImpactReadPulse: 0.74,
  _surfaceImpactHardnessPulse: 0.68,
  _objectivePressurePulse: 0.62,
  _objectiveFailPressurePulse: 0.44,
  _reloadFumblePulse: 0.52,
  _reloadFeelSnapshot: { surfaceInterference: 0.60 }
};
const stabilized = {
  _gunplaySpreadVisual: 1.0,
  _objectiveStabilizePulse: 0.72,
  _objectivePayoffAnticipationPulse: 0.64,
  _reloadHandLockPulse: 0.58,
  _reloadEmergencyShieldPulse: 0.46,
  _reloadFeelSnapshot: { insertConfidence: 0.70, chamberSettle: 0.62 }
};

const pressureSnap = buildCombatFeedbackSnapshot(pressured);
const stableSnap = buildCombatFeedbackSnapshot(stabilized);

assert(pressureSnap.surfaceReadPulse > 0.7 && pressureSnap.surfaceHardnessPulse > 0.6, 'surface pulses missing');
assert(pressureSnap.objectivePressure > 0.6 && pressureSnap.reloadStartle > 0.5, 'objective/reload pressure missing');
assert(stableSnap.objectiveStabilize > 0.7 && stableSnap.reloadConfidence > 0.6, 'stabilizing pulses missing');
assert(pressureSnap.xhairScale > stableSnap.xhairScale, 'pressure should widen crosshair more than stabilized reload');
assert(stableSnap.ringOpacity > 0.1, 'stabilized objective/reload should still surface readable HUD feedback');

tickPlayerCombatFeedback(pressured, 1 / 60);
assert(pressured._surfaceImpactReadPulse < 0.74 && pressured._objectiveFailPressurePulse < 0.44, 'v2 pulses should decay');

console.log(JSON.stringify({
  ok: true,
  version: COMBAT_FEEDBACK_VERSION,
  pressure: {
    xhair: Number(pressureSnap.xhairScale.toFixed(3)),
    ring: Number(pressureSnap.ringOpacity.toFixed(3))
  },
  stabilized: {
    xhair: Number(stableSnap.xhairScale.toFixed(3)),
    ring: Number(stableSnap.ringOpacity.toFixed(3))
  }
}, null, 2));
