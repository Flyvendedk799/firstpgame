export const STORY_OBJECTIVE_FEEL_VERSION = 'story-objective-feel.v2';

const clamp = (v, lo = 0, hi = 1) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
};

const smooth01 = (v) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildStoryObjectiveFeelSnapshot(objective = null, ctx = {}) {
  const def = objective && objective.def || {};
  const kind = String(objective && (objective.kind || def.kind) || ctx.kind || 'none');
  const completed = !!(objective && objective.completed);
  const failed = !!(objective && objective.failed);
  const alarmed = !!(objective && objective.alarmed) || !!ctx.alarmed;
  const total = Math.max(1, finite(objective && (objective.total || def.total), 1));
  const visited = clamp(finite(objective && objective.visited, 0), 0, total);
  const dwellProgress = clamp(ctx.dwellProgress != null ? ctx.dwellProgress : objective && objective._stationHoldProgress, 0, 1);
  const holdProgress = clamp(ctx.holdProgress != null ? ctx.holdProgress : objective && (objective.holdProgress || objective.alarmPanelHold || objective._holdProgress), 0, 1);
  const stationProgress = kind === 'stations' ? clamp((visited + dwellProgress) / total, 0, 1) : 0;
  const timerMax = Math.max(1, finite(def.timerS || objective && objective.timerS || ctx.timerS, 90));
  const remainingS = finite(objective && objective.remainingS, timerMax);
  const timerProgress = kind === 'timer' ? clamp(1 - remainingS / timerMax, 0, 1) : 0;
  const stealthProgress = kind === 'stealth' ? clamp(ctx.roomsCleared != null ? finite(ctx.roomsCleared) / Math.max(1, finite(ctx.roomsTotal, 3)) : (ctx.exitUnlocked ? 1 : 0), 0, 1) : 0;
  const interactProgress = Math.max(stationProgress, timerProgress, stealthProgress, holdProgress);
  const progress = completed ? 1 : clamp(interactProgress, 0, 1);
  const near = !!ctx.near || finite(ctx.nearestDistance, 999) <= Math.max(0.1, finite(def.radius || ctx.radius, 1.6));
  const holding = !!ctx.holding || dwellProgress > 0.02 || holdProgress > 0.02;
  const closeEnemyCount = Math.max(0, finite(ctx.closeEnemyCount, 0));
  const enemiesAlive = Math.max(0, finite(ctx.enemiesAlive, 0));
  const contested = clamp(closeEnemyCount / 3 + (holding && enemiesAlive > 0 ? 0.12 : 0), 0, 1);
  const stationCommit = kind === 'stations' ? clamp(dwellProgress * 0.72 + stationProgress * 0.34, 0, 1) : 0;
  const timerCritical = kind === 'timer' ? clamp(1 - remainingS / Math.max(1, timerMax * 0.26), 0, 1) : 0;
  const stealthTension = kind === 'stealth'
    ? clamp((alarmed ? 0.72 : 0.18) + enemiesAlive / 10 + (1 - stealthProgress) * 0.16, 0, 1)
    : 0;
  const urgency = clamp(
    (kind === 'timer' ? smooth01(1 - remainingS / Math.max(1, timerMax * 0.42)) : 0) +
    contested * 0.32 +
    (alarmed ? 0.48 : 0) +
    (holding ? 0.16 : 0),
    0,
    1
  );
  const affordance = clamp((near ? 0.48 : 0) + (holding ? 0.34 : 0) + (1 - interactProgress) * 0.08 - failed * 0.24, 0, 1);
  const holdStrain = clamp(
    (holding ? 0.26 : 0) +
    dwellProgress * 0.28 +
    holdProgress * 0.34 +
    contested * 0.28 +
    urgency * 0.18,
    0,
    1
  );
  const interactionLead = clamp((near ? 0.34 : 0) + affordance * 0.28 + (1 - progress) * 0.08 + stationCommit * 0.22, 0, 1);
  const completionAnticipation = clamp(
    progress * progress * 0.46 +
    (holding ? 0.10 : 0) +
    (stationCommit > 0.70 ? (stationCommit - 0.70) * 1.25 : 0) +
    (holdProgress > 0.68 ? (holdProgress - 0.68) * 1.05 : 0),
    0,
    1
  );
  const failPressure = clamp((failed ? 1 : 0) + timerCritical * 0.46 + (alarmed && !completed ? 0.34 : 0) + contested * 0.18, 0, 1);
  const objectiveCadence = clamp(
    holdStrain * 0.36 +
    interactionLead * 0.24 +
    completionAnticipation * 0.30 +
    timerCritical * 0.18 +
    stealthTension * 0.16,
    0,
    1
  );
  const playerReachWeight = clamp(interactionLead * 0.46 + holding * 0.28 + completionAnticipation * 0.20, 0, 1);
  const playerBraceWeight = clamp(holdStrain * 0.54 + urgency * 0.24 + contested * 0.18 + timerCritical * 0.10, 0, 1);
  const cameraTension = clamp(urgency * 0.34 + holdStrain * 0.26 + failPressure * 0.22 - completionAnticipation * 0.10, 0, 1);
  const weaponLower = clamp(playerReachWeight * 0.22 + holding * 0.10 - urgency * 0.06, 0, 0.38);
  const enemyTelegraphMul = clamp(1 + playerBraceWeight * 0.10 + stealthTension * 0.08 + timerCritical * 0.06 - completionAnticipation * 0.08, 0.88, 1.22);
  let label = failed ? 'failed' : completed ? 'complete' : holding ? 'hold' : near ? 'interact' : kind;
  if (!failed && !completed) {
    if (timerCritical > 0.60) label = 'timer-critical';
    else if (contested > 0.42 && holding) label = 'contested-hold';
    else if (completionAnticipation > 0.62) label = 'nearly-complete';
    else if (stealthTension > 0.55) label = alarmed ? 'alarm' : 'stealth-tension';
  }
  const out = {
    version: STORY_OBJECTIVE_FEEL_VERSION,
    active: !!objective && !completed && !failed,
    kind,
    completed,
    failed,
    alarmed,
    progress,
    stationProgress,
    dwellProgress,
    holdProgress,
    timerProgress,
    stealthProgress,
    stationCommit,
    timerCritical,
    stealthTension,
    remainingS: kind === 'timer' ? remainingS : null,
    near,
    holding,
    contested,
    closeEnemyCount,
    enemiesAlive,
    urgency,
    affordance,
    holdStrain,
    interactionLead,
    completionAnticipation,
    failPressure,
    objectiveCadence,
    playerReachWeight,
    playerBraceWeight,
    cameraTension,
    weaponLower,
    enemyTelegraphMul,
    playerFocusMul: clamp(1 + holding * 0.06 + affordance * 0.04 + completionAnticipation * 0.035 - urgency * 0.03 - failPressure * 0.02, 0.90, 1.14),
    enemyPressureMul: clamp(1 + urgency * 0.18 + holding * 0.08 + holdStrain * 0.08 + stealthTension * 0.05 - completed * 0.20 - completionAnticipation * 0.06, 0.82, 1.32),
    label,
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}
