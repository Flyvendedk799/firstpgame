export const STORY_GAMEPLAY_PACING_VERSION = 'story-gameplay-pacing.v6';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const clamp01 = (v) => clamp(v, 0, 1);

function finite(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function roomProgressFromDirector(director) {
  if (director && typeof director.getRoomProgress === 'function') {
    try {
      const p = director.getRoomProgress();
      if (p && Number.isFinite(p.current) && Number.isFinite(p.total)) return p;
    } catch (_) {}
  }
  return null;
}

export function buildStoryGameplayPacingSnapshot(ctx = {}) {
  const started = !!ctx.started;
  const story = ctx.story || null;
  const director = ctx.director || null;
  const setpiece = ctx.setpiece || null;
  const player = ctx.player || {};
  const objective = ctx.objective || null;
  const building = finite(ctx.building, story && story.building || 0) | 0;
  const enemyCount = Math.max(0, finite(ctx.enemyCount, 0));
  const hp = clamp(finite(player.hp, 100) / Math.max(1, finite(player.maxHp, 100)), 0, 1);
  const ammo = Math.max(0, finite(player.ammo, 0));
  const mag = Math.max(1, finite(ctx.mag, player.mag || 1));
  const ammoPressure = player.weaponIdx === 2 ? 0 : clamp01(1 - ammo / mag);
  const healthPressure = clamp01(1 - hp);
  const suppression = clamp01(Math.max(finite(player._suppressionLevel), finite(player._enemyShotPressure), finite(player._damageShock)));
  const comboCount = Math.max(0, finite(ctx.comboCount, player.combo && player.combo.count || 0));
  const combatFlow = clamp01(Math.max(finite(player._combatFlow), finite(player._killFlowPulse) * 0.78, finite(player._hitFlowPulse) * 0.42));
  const roomProgress = roomProgressFromDirector(director);
  const roomRatio = roomProgress ? clamp01(roomProgress.current / Math.max(1, roomProgress.total)) : 0;
  const enemyPressure = clamp01(enemyCount / Math.max(3, 3 + building * 0.45 + roomRatio * 2.2));
  const setpiecePressure = setpiece && setpiece.active
    ? clamp01(0.26 + (setpiece.triggered ? 0.36 : 0) + finite(setpiece.progress) * 0.28 + (setpiece._relaySilenced || setpiece.rewardGiven ? -0.30 : 0))
    : 0;
  const objectivePressure = objective && !objective.completed && !objective.failed
    ? clamp01(
      (objective.remainingS != null ? clamp01(1 - finite(objective.remainingS) / Math.max(1, finite(objective.def && objective.def.timerS, 90))) * 0.62 : 0.18) +
      (objective.alarmed ? 0.42 : 0) +
      (objective.dwellStart != null ? 0.24 : 0)
    )
    : 0;
  const exitUnlocked = !!ctx.exitUnlocked;
  const survivalPressure = clamp01(healthPressure * 0.62 + suppression * 0.30 + ammoPressure * 0.18);
  const pressure = clamp01(enemyPressure * 0.42 + setpiecePressure * 0.25 + objectivePressure * 0.22 + survivalPressure * 0.35);
  const momentum = clamp01(
    combatFlow * 0.44 +
    clamp01(comboCount / 6) * 0.30 +
    (enemyCount > 0 && ammoPressure < 0.48 ? 0.10 : 0) +
    (hp > 0.72 ? 0.08 : 0) -
    survivalPressure * 0.34 -
    objectivePressure * 0.08
  );
  const recoveryNeed = clamp01(survivalPressure * 0.62 + ammoPressure * 0.28 + healthPressure * 0.20 - momentum * 0.24);
  const tempo = clamp01(momentum * 0.48 + pressure * 0.28 + objectivePressure * 0.22 + setpiecePressure * 0.16 - recoveryNeed * 0.24);
  const chainWindow = enemyCount > 0 ? clamp01(momentum * 0.72 + combatFlow * 0.18 - survivalPressure * 0.22) : 0;
  const resourceMercy = clamp01(recoveryNeed * 0.64 + ammoPressure * 0.24 - enemyPressure * 0.10);
  const combatReadability = clamp01(
    0.18 +
    pressure * 0.26 +
    objectivePressure * 0.16 +
    setpiecePressure * 0.12 +
    chainWindow * 0.18 +
    resourceMercy * 0.22 +
    (exitUnlocked ? 0.16 : 0)
  );
  const flankPreview = clamp01(
    enemyPressure * 0.28 +
    setpiecePressure * 0.26 +
    tempo * 0.24 +
    combatFlow * 0.10 -
    recoveryNeed * 0.20
  );
  const recoveryBreather = clamp01(
    recoveryNeed * 0.54 +
    resourceMercy * 0.32 +
    healthPressure * 0.18 +
    ammoPressure * 0.10 -
    objectivePressure * 0.08 -
    enemyPressure * 0.08
  );
  const objectiveStandoff = objective && !objective.completed && !objective.failed
    ? clamp01(objectivePressure * 0.62 + (objective.dwellStart != null ? 0.20 : 0) + (objective.alarmed ? 0.12 : 0) - survivalPressure * 0.08)
    : 0;
  const threatBudget = clamp01(pressure * 0.64 + tempo * 0.24 + objectiveStandoff * 0.18 - recoveryBreather * 0.22);

  let intent = 'clear';
  let taskLabel = 'CLEAR ROOM';
  let tone = pressure > 0.64 ? 'danger' : 'story';
  if (!started) {
    intent = 'standby';
    taskLabel = 'STANDBY';
    tone = 'story';
  } else if (exitUnlocked) {
    intent = 'extract';
    taskLabel = 'EXTRACT';
    tone = 'success';
  } else if (healthPressure > 0.58 || (ammoPressure > 0.72 && enemyCount > 0)) {
    intent = 'recover';
    taskLabel = ammoPressure > healthPressure ? 'RELOAD / RECOVER' : 'RECOVER';
    tone = 'danger';
  } else if (objectivePressure > 0.42) {
    intent = 'objective';
    taskLabel = objective && objective.dwellStart != null ? 'HOLD OBJECTIVE' : 'PUSH OBJECTIVE';
    tone = objective && objective.alarmed ? 'danger' : 'objective';
  } else if (chainWindow > 0.48 && healthPressure < 0.42 && ammoPressure < 0.70) {
    intent = 'exploit';
    taskLabel = 'CHAIN PRESSURE';
    tone = 'success';
  } else if (setpiecePressure > 0.46) {
    intent = setpiece && setpiece.triggered ? 'break-flank' : 'hold';
    taskLabel = setpiece && setpiece.triggered ? 'BREAK FLANK' : 'HOLD ANGLE';
    tone = 'danger';
  } else if (enemyCount <= 0) {
    intent = 'advance';
    taskLabel = 'ADVANCE';
    tone = 'success';
  } else if (enemyPressure > 0.52) {
    intent = 'thin-room';
    taskLabel = 'THIN CONTACTS';
    tone = 'danger';
  }

  const activeCue = story && story.activeCue || null;
  const roomLabel = story && story.hud && story.hud.roomLabel || (director && director.currentFlowRoomId) || '';
  const out = {
    version: STORY_GAMEPLAY_PACING_VERSION,
    started,
    building,
    currentRoom: story && story.currentRoom || director && director.currentFlowRoomId || null,
    roomLabel,
    roomProgress,
    enemyCount,
    enemyPressure,
    objectivePressure,
    setpiecePressure,
    survivalPressure,
    momentum,
    combatFlow,
    comboCount,
    recoveryNeed,
    tempo,
    chainWindow,
    resourceMercy,
    combatReadability,
    flankPreview,
    recoveryBreather,
    objectiveStandoff,
    threatBudget,
    ammoPressure,
    healthPressure,
    pressure,
    intent,
    taskLabel,
    tone,
    cueKind: activeCue && activeCue.kind || '',
    cueTone: activeCue && activeCue.tone || '',
    exitUnlocked
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function buildStoryGameplayDirectorSnapshot(pacing = {}, ctx = {}) {
  const started = !!pacing.started && ctx.playMode !== 'duel';
  const pressure = clamp01(finite(pacing.pressure));
  const enemyPressure = clamp01(finite(pacing.enemyPressure));
  const survival = clamp01(finite(pacing.survivalPressure));
  const objective = clamp01(finite(pacing.objectivePressure));
  const setpiece = clamp01(finite(pacing.setpiecePressure));
  const momentum = clamp01(finite(pacing.momentum));
  const tempo = clamp01(finite(pacing.tempo));
  const chainWindow = clamp01(finite(pacing.chainWindow));
  const recoveryNeed = clamp01(finite(pacing.recoveryNeed));
  const resourceMercy = clamp01(finite(pacing.resourceMercy));
  const combatReadability = clamp01(finite(pacing.combatReadability));
  const flankPreview = clamp01(finite(pacing.flankPreview));
  const recoveryBreather = clamp01(finite(pacing.recoveryBreather));
  const objectiveStandoff = clamp01(finite(pacing.objectiveStandoff));
  const threatBudget = clamp01(finite(pacing.threatBudget, pressure));
  const intent = String(pacing.intent || 'standby');
  const enemyCount = Math.max(0, finite(pacing.enemyCount, ctx.enemyCount || 0));
  const roomRatio = pacing.roomProgress
    ? clamp01(finite(pacing.roomProgress.current) / Math.max(1, finite(pacing.roomProgress.total, 1)))
    : 0;
  const danger = clamp01(pressure * 0.72 + enemyPressure * 0.34 + setpiece * 0.28 + objective * 0.20 - chainWindow * 0.10);
  const recovery = intent === 'recover' ? clamp01(0.42 + survival * 0.58 + pressure * 0.16 + recoveryNeed * 0.24) : clamp01(resourceMercy * 0.18);
  const objectiveHold = intent === 'objective' ? clamp01(0.34 + objective * 0.66) : 0;
  const exploit = intent === 'exploit' ? clamp01(0.34 + chainWindow * 0.54 + tempo * 0.20) : 0;
  const push = intent === 'thin-room' || intent === 'break-flank'
    ? clamp01(0.36 + pressure * 0.56 + enemyPressure * 0.20)
    : (intent === 'clear' ? clamp01(enemyPressure * 0.40 + pressure * 0.20 + momentum * 0.12) : exploit);
  const advance = intent === 'advance' || intent === 'extract'
    ? clamp01(0.50 + roomRatio * 0.22 + (intent === 'extract' ? 0.20 : 0))
    : 0;
  const respite = clamp01(recovery * 0.76 + advance * 0.30 + resourceMercy * 0.20 - danger * 0.18 - exploit * 0.10);
  const flankPressure = clamp01(push * 0.70 + setpiece * 0.45 + objectiveHold * 0.18 + exploit * 0.16 + flankPreview * 0.18);
  const threatCadence = clamp01(threatBudget * 0.46 + danger * 0.28 + push * 0.18 + objectiveHold * 0.12 - recovery * 0.30 - recoveryBreather * 0.12);
  const flankTelegraph = clamp01(flankPreview * 0.54 + flankPressure * 0.26 + setpiece * 0.12 + objectiveStandoff * 0.08 - recovery * 0.16);
  const objectiveStage = clamp01(objectiveHold * 0.50 + objectiveStandoff * 0.38 + combatReadability * 0.10);
  const targetSwapWindow = clamp01(chainWindow * 0.54 + exploit * 0.20 + combatReadability * 0.14 + respite * 0.08 - danger * 0.08);
  const telegraphLead = clamp01(combatReadability * 0.40 + flankTelegraph * 0.30 + objectiveStage * 0.18 + recoveryBreather * 0.12 + targetSwapWindow * 0.10);
  const stagedThreat = clamp01(threatCadence * 0.46 + push * 0.24 + objectiveStage * 0.18 + flankTelegraph * 0.14 - recoveryBreather * 0.22);
  const accuracyPressure = clamp01(danger * 0.46 + objectiveStage * 0.24 + threatCadence * 0.12 - recovery * 0.32 - advance * 0.16 - chainWindow * 0.16 - telegraphLead * 0.06);
  const aggressionPressure = clamp01(push * 0.56 + objectiveStage * 0.30 + setpiece * 0.26 + threatCadence * 0.18 + tempo * 0.08 - recovery * 0.40 - advance * 0.20);
  const shotDelayAdd = clamp(recovery * 0.22 + recoveryBreather * 0.10 + advance * 0.10 + telegraphLead * 0.060 + chainWindow * 0.035 - push * 0.070 - objectiveStage * 0.030 - exploit * 0.035 - threatCadence * 0.040, -0.12, 0.38);
  const burstDelayAdd = clamp(recovery * 0.28 + recoveryBreather * 0.10 + advance * 0.08 + telegraphLead * 0.050 + chainWindow * 0.045 - push * 0.095 - setpiece * 0.040 - exploit * 0.025 - threatCadence * 0.035, -0.13, 0.42);
  const aimFloor = intent === 'recover' ? 0.70 : (intent === 'extract' ? 0.78 : 0.58);
  const aiAccuracyMul = clamp(1 + accuracyPressure * 0.11 + threatCadence * 0.035 - recovery * 0.18 - advance * 0.10 - chainWindow * 0.075 - telegraphLead * 0.030, aimFloor, 1.18);
  const aiAggressionMul = clamp(1 + aggressionPressure * 0.20 + stagedThreat * 0.10 + exploit * 0.06 - recovery * 0.28 - advance * 0.12, 0.62, 1.36);
  const aiFlankMul = clamp(1 + flankPressure * 0.28 + flankTelegraph * 0.16 - recovery * 0.18, 0.65, 1.52);
  const aiCoverMul = clamp(1 + recovery * 0.20 + recoveryBreather * 0.10 + objectiveStage * 0.12 - push * 0.12, 0.78, 1.34);
  const playerRecoveryMul = clamp(1 + recovery * 0.48 + recoveryBreather * 0.28 + advance * 0.12 + resourceMercy * 0.12 - danger * 0.08, 0.86, 1.68);
  const weaponFocusMul = clamp(1 + objectiveStage * 0.14 + push * 0.07 + chainWindow * 0.10 + targetSwapWindow * 0.10 - recovery * 0.08, 0.86, 1.34);
  const musicIntensity = clamp01(pressure * 0.68 + setpiece * 0.26 + objectiveStage * 0.20 + tempo * 0.18 + threatCadence * 0.10 - advance * 0.10);

  let directorLabel = 'room-clear';
  if (!started) directorLabel = 'inactive';
  else if (recovery > 0.20) directorLabel = 'recovery-beat';
  else if (objectiveHold > 0.20) directorLabel = 'objective-hold';
  else if (exploit > 0.20) directorLabel = 'chain-window';
  else if (push > 0.20) directorLabel = 'pressure-push';
  else if (advance > 0.20) directorLabel = intent === 'extract' ? 'extract' : 'advance';

  const out = {
    version: STORY_GAMEPLAY_PACING_VERSION,
    active: started,
    intent,
    label: directorLabel,
    pressure,
    danger,
    recovery,
    objectiveHold,
    exploit,
    push,
    advance,
    respite,
    momentum,
    tempo,
    chainWindow,
    resourceMercy,
    recoveryNeed,
    combatReadability,
    readability: combatReadability,
    flankPreview,
    recoveryBreather,
    objectiveStandoff,
    objectiveStage,
    threatBudget,
    threatCadence,
    flankTelegraph,
    telegraphLead,
    stagedThreat,
    targetSwapWindow,
    flankPressure,
    accuracyPressure,
    aggressionPressure,
    enemyCount,
    aiAccuracyMul,
    aiAggressionMul,
    aiFlankMul,
    aiCoverMul,
    shotDelayAdd,
    burstDelayAdd,
    playerRecoveryMul,
    weaponFocusMul,
    musicIntensity,
    roomAdvancePulse: advance,
    objectiveTensionPulse: objectiveHold,
    pressurePulse: push,
    bark: recovery > 0.35 ? 'recover' : objectiveStage > 0.35 ? 'hold' : targetSwapWindow > 0.38 ? 'push' : flankTelegraph > 0.36 || push > 0.40 ? 'flank' : advance > 0.40 ? 'move' : 'clear',
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function buildStorySquadPressureSnapshot(ctx = {}) {
  const director = ctx.director || {};
  const squad = ctx.squad || {};
  const player = ctx.player || {};
  const members = Array.isArray(ctx.members)
    ? ctx.members
    : (Array.isArray(squad.members) ? squad.members : []);
  const aliveMembers = members.filter((m) => m && !m.dead && !m._roomFlowDormant);
  const memberCount = Math.max(0, finite(ctx.memberCount, members.length));
  const aliveCount = Math.max(0, finite(ctx.aliveCount, aliveMembers.length));
  const enemyCount = Math.max(aliveCount, finite(ctx.enemyCount, aliveCount));
  const leader = ctx.leader || squad.leader || null;
  const leaderAlive = leader ? !leader.dead : aliveCount > 0;
  const state = String(ctx.state || squad.state || 'advance');
  const hp = clamp(finite(player.hp, 100) / Math.max(1, finite(player.maxHp, 100)), 0, 1);
  const playerSuppression = clamp01(Math.max(finite(player._suppressionLevel), finite(player._enemyShotPressure), finite(player._damageShock)));
  const playerPinned = clamp01(playerSuppression * 0.78 + (1 - hp) * 0.24);
  const danger = clamp01(finite(director.danger, director.pressure || 0));
  const pressure = clamp01(finite(director.pressure) * 0.70 + danger * 0.24 + clamp01(enemyCount / 7) * 0.18);
  const recovery = clamp01(finite(director.recovery));
  const objectiveHold = clamp01(finite(director.objectiveHold));
  const push = clamp01(finite(director.push));
  const tempo = clamp01(finite(director.tempo));
  const chainWindow = clamp01(finite(director.chainWindow));
  const targetSwapWindow = clamp01(finite(director.targetSwapWindow));
  const flankTelegraph = clamp01(finite(director.flankTelegraph));
  const telegraphLead = clamp01(finite(director.telegraphLead));
  const recoveryBreather = clamp01(finite(director.recoveryBreather));
  const objectiveStage = clamp01(finite(director.objectiveStage, director.objectiveHold || 0));
  const flankPressure = clamp01(finite(director.flankPressure));
  const cohesion = clamp01(
    (memberCount > 0 ? aliveCount / Math.max(1, memberCount) : 0) * 0.70 +
    (leaderAlive ? 0.20 : -0.18) +
    Math.min(0.10, aliveCount * 0.025) +
    clamp01(finite(director.readability)) * 0.05
  );
  const lossShock = clamp01((leaderAlive ? 0 : 0.54) + Math.max(0, memberCount - aliveCount) / Math.max(1, memberCount) * 0.44);
  const regroupNeed = clamp01((1 - cohesion) * 0.72 + lossShock * 0.42 + recovery * 0.18 - push * 0.10);
  const suppressNeed = clamp01(
    danger * 0.34 +
    objectiveHold * 0.30 +
    telegraphLead * 0.12 +
    playerPinned * 0.18 +
    (aliveCount >= 2 ? 0.12 : -0.18) +
    pressure * 0.14 -
    recovery * 0.18 -
    chainWindow * 0.08
  );
  const flankNeed = clamp01(
    flankPressure * 0.38 +
    flankTelegraph * 0.26 +
    push * 0.28 +
    tempo * 0.22 +
    chainWindow * 0.08 +
    targetSwapWindow * 0.08 +
    (aliveCount >= 3 ? 0.10 : -0.16) -
    recovery * 0.26 -
    regroupNeed * 0.16
  );
  const advanceNeed = clamp01(
    push * 0.34 +
    tempo * 0.24 +
    objectiveHold * 0.18 +
    pressure * 0.14 +
    (state === 'advance' ? 0.06 : 0) -
    recovery * 0.16 -
    regroupNeed * 0.12
  );
  const anchorNeed = clamp01(
    danger * 0.30 +
    objectiveHold * 0.34 +
    objectiveStage * 0.18 +
    suppressNeed * 0.16 +
    (aliveCount >= 2 ? 0.08 : 0) +
    recovery * 0.10 +
    recoveryBreather * 0.08 -
    flankNeed * 0.08
  );
  const readability = clamp01(
    finite(director.readability) * 0.40 +
    pressure * 0.22 +
    Math.max(suppressNeed, flankNeed, advanceNeed, anchorNeed) * 0.30 +
    regroupNeed * 0.20 +
    telegraphLead * 0.18 +
    targetSwapWindow * 0.10
  );

  let recommendedState = 'advance';
  if (regroupNeed > 0.52) recommendedState = 'regroup';
  else if (suppressNeed > 0.48 && suppressNeed >= flankNeed) recommendedState = 'suppress';
  else if (flankNeed > 0.44) recommendedState = 'flank';
  else if (anchorNeed > 0.56 && advanceNeed < 0.50) recommendedState = 'hold';

  const out = {
    version: STORY_GAMEPLAY_PACING_VERSION,
    active: !!director.active && aliveCount > 0,
    squadId: squad.id != null ? squad.id : ctx.squadId,
    zoneId: Number.isFinite(ctx.zoneId) ? ctx.zoneId : (Number.isFinite(squad.zoneId) ? squad.zoneId : null),
    state,
    recommendedState,
    memberCount,
    aliveCount,
    enemyCount,
    leaderAlive,
    cohesion,
    pressure,
    danger,
    recovery,
    objectiveHold,
    push,
    tempo,
    chainWindow,
    playerPinned,
    regroupNeed,
    suppressNeed,
    flankNeed,
    advanceNeed,
    anchorNeed,
    readability,
    roleWeights: {
      anchor: anchorNeed,
      suppressor: suppressNeed,
      flanker: flankNeed,
      breacher: advanceNeed,
      support: clamp01(0.24 + regroupNeed * 0.28 + pressure * 0.12)
    },
    label: recommendedState === 'regroup' ? 'squad-regroup' :
      recommendedState === 'suppress' ? 'squad-suppress' :
      recommendedState === 'flank' ? 'squad-flank' :
      recommendedState === 'hold' ? 'squad-anchor' :
      'squad-advance',
    finite: true
  };
  out.finite = Object.values(out)
    .concat(Object.values(out.roleWeights))
    .every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function resolveStorySquadMemberDirective(enemy = {}, squadPressure = {}, opts = {}) {
  if (!squadPressure || !squadPressure.active) {
    return {
      version: STORY_GAMEPLAY_PACING_VERSION,
      active: false,
      role: opts.role || 'none',
      state: squadPressure && squadPressure.state || 'inactive',
      accuracyMul: 1,
      aggressionMul: 1,
      speedMul: 1,
      flankBias: 0,
      suppressBias: 0,
      coverBias: 0,
      advanceBias: 0,
      shootDelayAdd: 0,
      burstDelayAdd: 0,
      readability: 0,
      finite: true
    };
  }
  const type = String(opts.type || enemy.type || 'soldier');
  const role = String(opts.role || enemy._squadRole || (opts.isLeader ? 'leader' : 'support'));
  const state = String(opts.state || squadPressure.recommendedState || squadPressure.state || 'advance');
  const hpRatio = enemy && Number.isFinite(enemy.hp) && Number.isFinite(enemy.maxHp)
    ? clamp01(enemy.hp / Math.max(1, enemy.maxHp))
    : 1;
  const wounded = clamp01(1 - hpRatio);
  const leader = role === 'leader';
  const anchorRole = leader || role === 'anchor';
  const suppressRole = role === 'suppressor';
  const flankRole = role === 'flanker';
  const breacherRole = role === 'breacher';
  const supportRole = role === 'support';
  const fastType = type === 'scout' || type === 'pistolero' || type === 'drone';
  const heavyType = type === 'heavy' || type === 'riot' || type === 'shielded';
  const flankBias = clamp01(
    squadPressure.flankNeed * (flankRole ? 1.08 : fastType ? 0.66 : 0.38) +
    (state === 'flank' ? 0.22 : 0) -
    wounded * 0.22
  );
  const suppressBias = clamp01(
    squadPressure.suppressNeed * (suppressRole ? 1.10 : anchorRole ? 0.72 : supportRole ? 0.46 : 0.26) +
    (state === 'suppress' ? 0.22 : 0) -
    wounded * 0.16
  );
  const coverBias = clamp01(
    squadPressure.anchorNeed * (anchorRole ? 1.04 : suppressRole ? 0.76 : 0.36) +
    squadPressure.regroupNeed * 0.42 +
    wounded * 0.22 -
    flankBias * 0.10
  );
  const advanceBias = clamp01(
    squadPressure.advanceNeed * (breacherRole ? 1.08 : flankRole ? 0.72 : anchorRole ? 0.46 : 0.58) +
    (state === 'advance' ? 0.20 : 0) -
    squadPressure.regroupNeed * 0.22 -
    wounded * 0.16
  );
  const discipline = clamp01(anchorRole ? 0.32 : suppressRole ? 0.24 : supportRole ? 0.16 : 0.08);
  const speedMul = clamp(
    1 +
    flankBias * 0.26 +
    advanceBias * 0.16 -
    coverBias * (anchorRole ? 0.08 : 0.04) -
    squadPressure.regroupNeed * 0.16 -
    wounded * 0.10 +
    (fastType ? flankBias * 0.06 : 0) -
    (heavyType ? flankBias * 0.04 : 0),
    0.68,
    1.28
  );
  const accuracyMul = clamp(
    1 +
    discipline * 0.11 +
    suppressBias * 0.04 +
    coverBias * 0.05 -
    flankBias * 0.06 -
    squadPressure.regroupNeed * 0.13 -
    wounded * 0.08,
    0.64,
    1.14
  );
  const aggressionMul = clamp(
    1 +
    advanceBias * 0.17 +
    flankBias * 0.16 +
    suppressBias * 0.06 -
    coverBias * 0.05 -
    squadPressure.regroupNeed * 0.18 -
    wounded * 0.06,
    0.58,
    1.24
  );
  const shootDelayAdd = clamp(
    squadPressure.regroupNeed * 0.18 +
    coverBias * 0.04 -
    suppressBias * 0.075 -
    advanceBias * 0.035 +
    wounded * 0.055,
    -0.10,
    0.30
  );
  const burstDelayAdd = clamp(
    squadPressure.regroupNeed * 0.16 +
    coverBias * 0.04 -
    suppressBias * 0.095 -
    flankBias * 0.025 +
    wounded * 0.06,
    -0.12,
    0.34
  );
  const readability = clamp01(
    squadPressure.readability * 0.66 +
    Math.max(flankBias, suppressBias, coverBias, advanceBias) * 0.28 +
    (leader ? 0.10 : 0) +
    (opts.orderChanged ? 0.14 : 0)
  );
  const out = {
    version: STORY_GAMEPLAY_PACING_VERSION,
    active: true,
    role,
    state,
    type,
    squadId: squadPressure.squadId,
    label: `${squadPressure.label || 'squad'}:${role}`,
    accuracyMul,
    aggressionMul,
    speedMul,
    flankBias,
    suppressBias,
    coverBias,
    advanceBias,
    discipline,
    shootDelayAdd,
    burstDelayAdd,
    readability,
    regroupNeed: clamp01(squadPressure.regroupNeed),
    side: Number.isFinite(opts.side) ? opts.side : 1,
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function buildStoryCombatBeatSnapshot(pacing = {}, director = {}, ctx = {}) {
  const active = !!director.active && ctx.playMode !== 'duel';
  const player = ctx.player || {};
  const objective = ctx.objective || null;
  const roomAgeS = Math.max(0, finite(ctx.roomAgeS, 0));
  const hp = clamp(finite(player.hp, 100) / Math.max(1, finite(player.maxHp, 100)), 0, 1);
  const ammo = Math.max(0, finite(player.ammo, 0));
  const mag = Math.max(1, finite(ctx.mag, player.mag || 1));
  const ammoPressure = player.weaponIdx === 2 ? 0 : clamp01(1 - ammo / mag);
  const enemyCount = Math.max(0, finite(pacing.enemyCount, director.enemyCount || ctx.enemyCount || 0));
  const pressure = clamp01(finite(director.pressure, pacing.pressure || 0));
  const danger = clamp01(finite(director.danger, pressure));
  const recovery = clamp01(finite(director.recovery));
  const objectiveHold = clamp01(finite(director.objectiveHold));
  const push = clamp01(finite(director.push));
  const advance = clamp01(finite(director.advance));
  const chainWindow = clamp01(finite(director.chainWindow, pacing.chainWindow || 0));
  const targetSwapWindow = clamp01(finite(director.targetSwapWindow));
  const flankTelegraph = clamp01(finite(director.flankTelegraph));
  const telegraphLead = clamp01(finite(director.telegraphLead));
  const recoveryBreather = clamp01(finite(director.recoveryBreather));
  const objectiveStage = clamp01(finite(director.objectiveStage, director.objectiveHold || 0));
  const tempo = clamp01(finite(director.tempo, pacing.tempo || 0));
  const suppression = clamp01(Math.max(finite(player._suppressionLevel), finite(player._enemyShotPressure), finite(player._damageShock)));
  const lowHealth = clamp01(1 - hp);
  const objectiveUrgency = objective && !objective.completed && !objective.failed
    ? clamp01(finite(pacing.objectivePressure) + (objective.alarmed ? 0.18 : 0) + (objective.remainingS != null ? 0.12 : 0))
    : clamp01(finite(pacing.objectivePressure));
  const entry = clamp01((roomAgeS > 0 && roomAgeS < 7.5 ? 1 - roomAgeS / 7.5 : 0) * (0.24 + pressure * 0.42 + (enemyCount > 0 ? 0.18 : 0)));
  const clutch = clamp01(lowHealth * 0.56 + ammoPressure * 0.30 + suppression * 0.42 + recovery * 0.30 - chainWindow * 0.16);
  const chain = clamp01(chainWindow * 0.72 + targetSwapWindow * 0.22 + finite(player._combatFlow) * 0.20 + finite(player._killFlowPulse) * 0.18 - clutch * 0.14);
  const cleanup = clamp01((enemyCount <= 1 ? 0.34 : 0) + advance * 0.40 + (pacing.intent === 'advance' ? 0.26 : 0) - pressure * 0.12);
  const objectiveBeat = clamp01(objectiveHold * 0.62 + objectiveStage * 0.22 + objectiveUrgency * 0.34 - clutch * 0.08);
  const sustain = clamp01(pressure * 0.44 + push * 0.32 + danger * 0.22 + tempo * 0.16 - Math.max(entry, clutch, chain, cleanup, objectiveBeat) * 0.18);

  let phase = 'sustain';
  let strongest = sustain;
  const candidates = [
    ['entry', entry],
    ['clutch', clutch],
    ['chain', chain],
    ['objective', objectiveBeat],
    ['cleanup', cleanup],
    ['sustain', sustain]
  ];
  for (const [name, value] of candidates) {
    if (value > strongest) {
      phase = name;
      strongest = value;
    }
  }
  if (!active) phase = 'inactive';
  if (pacing.intent === 'extract') phase = 'extract';
  if (pacing.intent === 'recover' && clutch > 0.25) phase = 'clutch';

  const intensity = clamp01(strongest * 0.68 + pressure * 0.22 + danger * 0.18 + objectiveUrgency * 0.10);
  const relief = clamp01(cleanup * 0.42 + recovery * 0.46 + advance * 0.18 - danger * 0.12);
  const enemyTelegraph = clamp01(telegraphLead * 0.42 + flankTelegraph * 0.30 + entry * 0.18 + objectiveBeat * 0.18 + clutch * 0.12);
  const reloadCover = clamp(clutch * 0.34 + recovery * 0.28 + recoveryBreather * 0.24 + ammoPressure * 0.16 - pressure * 0.05, 0, 0.84);
  const targetSwap = clamp01(targetSwapWindow * 0.56 + chain * 0.32 + cleanup * 0.10 - clutch * 0.12);
  const focusDrip = clamp(clutch * 0.020 + relief * 0.014 + chain * 0.006 + targetSwap * 0.004, 0, 0.044);
  const combatFlowBoost = clamp(chain * 0.36 + targetSwap * 0.18 + objectiveBeat * 0.18 + entry * 0.14 + cleanup * 0.10 - clutch * 0.10, 0, 0.68);
  const weaponReadyBoost = clamp(chain * 0.28 + targetSwap * 0.20 + objectiveBeat * 0.24 + entry * 0.18 + cleanup * 0.10, 0, 0.78);
  const reloadGrace = clamp(clutch * 0.38 + recovery * 0.30 + reloadCover * 0.30 + ammoPressure * 0.16 - pressure * 0.06, 0, 0.82);
  const breathSettle = clamp(chain * 0.18 + targetSwap * 0.16 + objectiveBeat * 0.18 + relief * 0.12 - suppression * 0.08, 0, 0.48);
  const enemyAccuracyMul = clamp(1 - clutch * 0.12 - cleanup * 0.06 + objectiveBeat * 0.04 + sustain * 0.035, 0.78, 1.10);
  const enemyAggressionMul = clamp(1 + entry * 0.12 + sustain * 0.10 + objectiveBeat * 0.08 - clutch * 0.16 - cleanup * 0.08, 0.72, 1.16);
  const enemyFlankMul = clamp(1 + sustain * 0.12 + entry * 0.08 + chain * 0.05 - clutch * 0.12 - cleanup * 0.06, 0.74, 1.18);
  const enemySpeedMul = clamp(1 + push * 0.05 + entry * 0.04 - clutch * 0.08 + cleanup * 0.03, 0.84, 1.12);
  const enemyShotDelayAdd = clamp(clutch * 0.11 + cleanup * 0.05 + enemyTelegraph * 0.040 + reloadCover * 0.030 - sustain * 0.04 - objectiveBeat * 0.025, -0.055, 0.22);
  const enemyBurstDelayAdd = clamp(clutch * 0.13 + cleanup * 0.05 + enemyTelegraph * 0.035 + reloadCover * 0.035 - sustain * 0.05, -0.065, 0.24);
  const readability = clamp01(intensity * 0.30 + clutch * 0.24 + entry * 0.22 + objectiveBeat * 0.20 + chain * 0.16 + cleanup * 0.14 + enemyTelegraph * 0.28 + targetSwap * 0.14);
  const label = phase === 'inactive' ? 'inactive' :
    phase === 'entry' ? 'room-entry' :
    phase === 'clutch' ? 'clutch-recovery' :
    phase === 'chain' ? 'chain-transfer' :
    phase === 'objective' ? 'objective-pressure' :
    phase === 'cleanup' ? 'cleanup-release' :
    phase === 'extract' ? 'extract-run' :
    'sustained-contact';
  const out = {
    version: STORY_GAMEPLAY_PACING_VERSION,
    active,
    phase,
    label,
    roomAgeS,
    enemyCount,
    entry,
    sustain,
    clutch,
    chain,
    targetSwapWindow: targetSwap,
    objective: objectiveBeat,
    cleanup,
    intensity,
    relief,
    enemyTelegraph,
    reloadCover,
    focusDrip,
    combatFlowBoost,
    weaponReadyBoost,
    reloadGrace,
    breathSettle,
    enemyAccuracyMul,
    enemyAggressionMul,
    enemyFlankMul,
    enemySpeedMul,
    enemyShotDelayAdd,
    enemyBurstDelayAdd,
    readability,
    bark: phase === 'clutch' ? 'recover' : phase === 'objective' ? 'hold' : phase === 'chain' ? 'push' : phase === 'entry' ? 'contact' : phase === 'cleanup' ? 'clear' : 'move',
    finite: true
  };
  out.finite = Object.values(out).every((v) => typeof v !== 'number' || Number.isFinite(v));
  return out;
}

export function resolveStoryEnemyDirective(enemy = {}, director = {}, opts = {}) {
  if (!director || !director.active) {
    return {
      version: STORY_GAMEPLAY_PACING_VERSION,
      active: false,
      accuracyMul: 1,
      aggressionMul: 1,
      speedMul: 1,
      flankMul: 1,
      coverMul: 1,
      shootDelayAdd: 0,
      burstDelayAdd: 0,
      readability: 0,
      label: 'inactive',
      finite: true
    };
  }
  const type = String(opts.type || enemy.type || 'soldier');
  const elite = type === 'sniper' || type === 'marksman' || type === 'lieutenant' || type === 'boss';
  const heavy = type === 'heavy' || type === 'riot' || type === 'shielded';
  const wounded = enemy.hp != null && enemy.maxHp ? clamp01(1 - finite(enemy.hp) / Math.max(1, finite(enemy.maxHp, 1))) : 0;
  const reload = finite(enemy.enemyReloadTimer) > 0 ? 1 : 0;
  const suppressed = opts.suppressed != null ? !!opts.suppressed : !!enemy._suppressedUntil;
  const typeAccuracy = elite ? 1.05 : heavy ? 0.96 : 1;
  const typeAggression = heavy ? 1.08 : elite ? 0.98 : 1;
  const recoveryDrag = director.recovery * (suppressed ? 0.18 : 0.08);
  const chain = clamp01(director.chainWindow || 0);
  const telegraphLead = clamp01(director.telegraphLead || 0);
  const flankTelegraph = clamp01(director.flankTelegraph || 0);
  const targetSwapWindow = clamp01(director.targetSwapWindow || 0);
  const recoveryBreather = clamp01(director.recoveryBreather || 0);
  const threatCadence = clamp01(director.threatCadence || 0);
  const objectiveStandoff = clamp01(director.objectiveStandoff || director.objectiveStage || 0);
  const stagedThreat = clamp01(director.stagedThreat || 0);
  const accuracyMul = clamp(director.aiAccuracyMul * typeAccuracy - wounded * 0.10 - reload * 0.18 - recoveryDrag - recoveryBreather * 0.05 - chain * (elite ? 0.045 : 0.075) - telegraphLead * 0.025, 0.46, 1.22);
  const aggressionMul = clamp(director.aiAggressionMul * typeAggression + chain * 0.030 + stagedThreat * 0.035 + threatCadence * 0.025 - wounded * 0.08 - reload * 0.16 - recoveryBreather * 0.045, 0.48, 1.42);
  const flankMul = clamp(director.aiFlankMul * (elite ? 0.88 : 1) + chain * 0.045 + flankTelegraph * 0.10 - wounded * 0.08, 0.52, 1.58);
  const coverMul = clamp(director.aiCoverMul + wounded * 0.16 + (suppressed ? 0.12 : 0) + recoveryBreather * 0.08 + objectiveStandoff * 0.06, 0.62, 1.48);
  const speedMul = clamp(1 + (aggressionMul - 1) * 0.18 + (flankMul - 1) * 0.14 - wounded * 0.10, 0.74, 1.22);
  const shootDelayAdd = clamp(director.shotDelayAdd + telegraphLead * 0.060 + recoveryBreather * 0.070 + wounded * 0.05 + reload * 0.10 + (suppressed ? 0.06 : 0) - threatCadence * 0.025, -0.13, 0.48);
  const burstDelayAdd = clamp(director.burstDelayAdd + telegraphLead * 0.050 + recoveryBreather * 0.060 + wounded * 0.05 + reload * 0.10 + (suppressed ? 0.08 : 0) - threatCadence * 0.020, -0.14, 0.52);
  const readability = clamp01(director.pressure * 0.20 + (director.readability || 0) * 0.26 + director.recovery * 0.24 + director.objectiveHold * 0.18 + director.push * 0.20 + chain * 0.18 + telegraphLead * 0.30 + flankTelegraph * 0.18 + targetSwapWindow * 0.14);
  return {
    version: STORY_GAMEPLAY_PACING_VERSION,
    active: true,
    type,
    accuracyMul,
    aggressionMul,
    speedMul,
    flankMul,
    coverMul,
    shootDelayAdd,
    burstDelayAdd,
    readability,
    chainWindow: chain,
    telegraphLead,
    flankTelegraph,
    targetSwapWindow,
    recoveryBreather,
    threatCadence,
    objectiveStandoff,
    stagedThreat,
    tempo: clamp01(director.tempo || 0),
    label: director.label || 'story-director',
    bark: director.bark || 'clear',
    finite: true
  };
}
