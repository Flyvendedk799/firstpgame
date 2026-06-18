import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TRAVERSAL_FEEL_VERSION,
  resolveLandingTraversalResponse,
  resolveVaultExitTraversalResponse,
  resolveSlideContactTraversalResponse,
} from '../src/game/traversalFeel.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const traversal = readFileSync(join(root, 'src/game/traversalFeel.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function requireSnippet(src, snippet, label) {
  assert(src.includes(snippet), `missing ${label}: ${snippet}`);
}

assert(TRAVERSAL_FEEL_VERSION === 'traversal-feel.v2', 'unexpected traversal feel version');

for (const snippet of [
  'export function resolveLandingTraversalResponse',
  'export function resolveVaultExitTraversalResponse',
  'export function resolveSlideContactTraversalResponse',
  'slideWindowMs',
  'slidePower',
  'footPlantShock',
  'kneeAbsorb',
  'recenterAssist',
  'carryTimer',
  'legClearance',
  'handPlant',
  'exitRecenter',
  'timerCap',
  'scrapePitch',
  'legTuck',
  'recoverStep',
]) {
  requireSnippet(traversal, snippet, 'traversal feel contract');
}

for (const snippet of [
  "from './game/traversalFeel.js'",
  'resolveVaultExitTraversalResponse',
  'resolveLandingTraversalResponse',
  'resolveSlideContactTraversalResponse',
  'P._traversalFeelSnapshot',
  'P._vaultLegClearancePulse',
  'P._landingKneeAbsorbPulse',
  'P._slideScrapePulse',
  'P._slideLegTuckPulse',
  'P._traversalRecenterPulse',
  'P._footPlantCompression=Math.max(P._footPlantCompression||0,(_landingResponse.footPlantShock||0)*.30)',
  'traversalV2:{version:TRAVERSAL_FEEL_VERSION',
  'traversalFeel:{version:TRAVERSAL_FEEL_VERSION',
]) {
  requireSnippet(main, snippet, 'main traversal wiring');
}

const landing = resolveLandingTraversalResponse({
  impact: 9.4,
  sprintBlend: 0.9,
  slideIntent: true,
  slideReady: false,
  ads: 0.1,
  dropkick: false
});
assert(landing.slideWindowMs > 500, 'hard sprint landing should extend slide window');
assert(landing.slidePower > 1.15, 'hard sprint landing should increase slide power');
assert(landing.locomotionSurge > 0.6, 'hard sprint landing should create locomotion surge');
assert(landing.footPlantShock > 0.5 && landing.kneeAbsorb > 0.45 && landing.recenterAssist > 0.15, 'hard sprint landing should expose v2 foot/knee/recenter cues');

const vault = resolveVaultExitTraversalResponse({
  height: 1.1,
  sprintBlend: 0.85,
  dir: 'right'
});
assert(vault.carryTimer > 0.26, 'sprint vault exit should carry momentum');
assert(vault.side === 1, 'right vault should retain side sign');
assert(vault.slideWindowMs > 250, 'vault exit should create slide continuation window');
assert(vault.legClearance > 0.45 && vault.handPlant > 0.35 && vault.exitRecenter > 0.25 && vault.exitLean > 0, 'vault exit should expose v2 leg/hand/recenter cues');

const blocked = resolveSlideContactTraversalResponse({
  moveRatio: 0.18,
  intentSpeed: 9.8,
  slideAmt: 0.9,
  side: -0.65,
  forward: 0.8
});
assert(blocked.severity > 0.75, 'hard slide block should be severe');
assert(blocked.timerCap < 0.18, 'hard slide block should cap remaining slide time');
assert(blocked.carryCancel, 'hard slide block should cancel carry');
assert(blocked.scrapePitch > 0.35 && blocked.legTuck > 0.5 && blocked.recoverStep > 0.15, 'slide contact should expose v2 scrape/tuck/recover cues');
assert([landing, vault, blocked].every((row) => row.finite), 'traversal responses must be finite');

console.log(JSON.stringify({
  ok: true,
  version: TRAVERSAL_FEEL_VERSION,
  landing: {
    slideWindowMs: landing.slideWindowMs,
    slidePower: Number(landing.slidePower.toFixed(3)),
    surge: Number(landing.locomotionSurge.toFixed(3)),
    footPlantShock: Number(landing.footPlantShock.toFixed(3)),
    kneeAbsorb: Number(landing.kneeAbsorb.toFixed(3))
  },
  vault: {
    carryTimer: Number(vault.carryTimer.toFixed(3)),
    slideWindowMs: vault.slideWindowMs,
    side: vault.side,
    legClearance: Number(vault.legClearance.toFixed(3))
  },
  blocked: {
    severity: Number(blocked.severity.toFixed(3)),
    timerCap: Number(blocked.timerCap.toFixed(3)),
    carryCancel: blocked.carryCancel,
    scrapePitch: Number(blocked.scrapePitch.toFixed(3)),
    legTuck: Number(blocked.legTuck.toFixed(3))
  }
}, null, 2));
