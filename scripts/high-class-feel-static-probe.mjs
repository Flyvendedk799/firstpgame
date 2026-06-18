import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HIGH_CLASS_FEEL_VERSION,
  buildHighClassFeelSnapshot,
  tickHighClassFeel
} from '../src/game/highClassFeel.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const css = readFileSync(join(root, 'src/styles/game.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(HIGH_CLASS_FEEL_VERSION === 'high-class-feel.v1', 'unexpected high-class feel version');
assert(main.includes('tickHighClassFeel(P,dt'), 'main loop does not tick high-class feel');
assert(main.includes('preHighClassFeel'), 'shot path does not use high-class pre-shot feel');
assert(main.includes('highClassCameraNoiseMul'), 'shot camera noise does not use high-class feel');
assert(main.includes('highClassReturn.recoilReturnMul'), 'recoil return does not use high-class feel');
assert(main.includes('_syncHighClassFeelHud'), 'HUD bridge for high-class feel missing');
assert(main.includes('highClassFeel:P._highClassFeelSnapshot'), 'debug payload does not expose high-class feel');
assert(css.includes('high-class-composed') && css.includes('--high-class-dot-alpha'), 'CSS high-class feel states missing');

const composedPlayer = {
  weaponIdx: 0,
  ads: 0.88,
  adsVis: 0.88,
  _gunplayRhythm: 0.58,
  _combatFlow: 0.42,
  _counterStrafePulse: 0.32,
  _shotImpulse: 0.18,
  _shotHeatPressure: 0.08,
  _aimFeelSnapshot: {
    readiness: 0.91,
    stability: 0.84,
    reticleConfidence: 0.88,
    lensFocus: 0.82
  },
  _gunplayPolishSnapshot: {
    followThroughHold: 0.72,
    sightReturnBoost: 0.68,
    triggerCommit: 0.70,
    impactConfirmPulse: 0.20,
    hitConfirmSettlePulse: 0.22,
    targetTransition: { settle: 0.24, recenter: 0.18 },
    cleanFeel: {
      flow: 0.62,
      settle: 0.66,
      noise: 0.08,
      targetFlow: 0.32,
      inputSettle: 0.52
    }
  },
  _combatFeedbackSnapshot: {
    confidence: 0.54,
    hitConfirmPulse: 0.20,
    killConfirmPulse: 0,
    pressurePulse: 0.03,
    ringOpacity: 0.22
  },
  _incomingFirePolishSnapshot: {
    threat: 0.02,
    tunnelVision: 0.01,
    nearMissSeverity: 0
  }
};

const pressuredPlayer = {
  weaponIdx: 0,
  ads: 0.56,
  adsVis: 0.56,
  running: true,
  _suppressionLevel: 0.54,
  _damageShock: 0.42,
  _moveContactStall: 0.40,
  _shotImpulse: 0.82,
  _shotHeatPressure: 0.62,
  _gunplayRhythm: 0.05,
  _aimFeelSnapshot: {
    readiness: 0.42,
    stability: 0.28,
    reticleConfidence: 0.36,
    lensFocus: 0.34
  },
  _gunplayPolishSnapshot: {
    cadenceMistimePulse: 0.62,
    badShotPulse: 0.44,
    sustainedFirePulse: 0.58,
    followThroughHold: 0.18,
    sightReturnBoost: 0.16,
    cleanFeel: {
      flow: 0.08,
      settle: 0.06,
      noise: 0.70,
      targetFlow: 0.02,
      inputSettle: 0.04
    }
  },
  _combatFeedbackSnapshot: {
    confidence: 0.08,
    pressurePulse: 0.62,
    ringOpacity: 0.12
  },
  _incomingFirePolishSnapshot: {
    threat: 0.68,
    tunnelVision: 0.56,
    nearMissSeverity: 0.46
  }
};

const composed = buildHighClassFeelSnapshot(composedPlayer);
const pressured = buildHighClassFeelSnapshot(pressuredPlayer);

assert(composed.active && pressured.active, 'high-class feel should be active for both examples');
assert(composed.composure > pressured.composure, 'composed example should have higher composure');
assert(composed.settle > pressured.settle, 'composed example should have higher settle');
assert(pressured.pressure > composed.pressure, 'pressured example should have higher pressure');
assert(pressured.noise > composed.noise, 'pressured example should have higher noise');
assert(composed.cameraKickMul < pressured.cameraKickMul, 'composed example should reduce camera kick more');
assert(composed.cameraNoiseMul < pressured.cameraNoiseMul, 'composed example should reduce camera noise more');
assert(composed.crosshairScaleMul < pressured.crosshairScaleMul, 'composed example should tighten crosshair scale');
assert(composed.crosshairTighten > pressured.crosshairTighten, 'composed example should add crosshair tighten');
assert(composed.recoilReturnMul > pressured.recoilReturnMul, 'composed example should improve recoil return');
assert(pressured.fovOffset > composed.fovOffset, 'pressured example should widen FOV relative to composed state');

const tickPlayer = { ...pressuredPlayer };
const first = tickHighClassFeel(tickPlayer, 1 / 60);
pressuredPlayer._incomingFirePolishSnapshot.threat = 0.04;
pressuredPlayer._gunplayPolishSnapshot.cleanFeel = composedPlayer._gunplayPolishSnapshot.cleanFeel;
Object.assign(tickPlayer, pressuredPlayer, {
  running: false,
  _suppressionLevel: 0.02,
  _damageShock: 0.01,
  _aimFeelSnapshot: composedPlayer._aimFeelSnapshot,
  _combatFeedbackSnapshot: composedPlayer._combatFeedbackSnapshot
});
const second = tickHighClassFeel(tickPlayer, 1 / 60);
assert(first.finite && second.finite, 'tick snapshots should be finite');
assert(second.composure >= first.composure, 'tick should move toward improved composure');

console.log(JSON.stringify({
  ok: true,
  version: HIGH_CLASS_FEEL_VERSION,
  composed: { label: composed.label, composure: composed.composure, cameraKickMul: composed.cameraKickMul },
  pressured: { label: pressured.label, pressure: pressured.pressure, cameraKickMul: pressured.cameraKickMul }
}, null, 2));
