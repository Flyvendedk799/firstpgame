export const STORY_EXPERIENCE_VERSION = 'story-experience.v1';

const DEFAULT_CUE_MS = 3300;

const cue = (kind, tag, title, body, tone = 'story', durationMs = DEFAULT_CUE_MS) =>
  Object.freeze({ kind, tag, title, body, tone, durationMs });

function campaignCuePack(bn, code, label, opts = {}) {
  const p = `b${String(bn).padStart(2, '0')}`;
  const tag = code.toUpperCase();
  return Object.freeze({
    deploy: cue('deploy', tag, opts.deployTitle || `Enter ${label}`, opts.deployBody || 'Read the entry lane, control the middle room, then break the final guard line.'),
    rooms: Object.freeze({
      [`${p}_entry_vestibule`]: cue('room', 'SAFE ORIENTATION', `${label} Entry`, opts.entry || 'The first room gives one safe read before contact. Choose the opening angle.'),
      [`${p}_intake_peek`]: cue('room', 'FIRST CONTACT', `${label} Peek`, opts.peek || 'First contact is staged past the threshold. Win the first shot before crossing.'),
      [`${p}_relay_approach`]: cue('room', 'MID ROUTE', `${label} Approach`, opts.approach || 'The middle lane can fold in from either side. Clear before interacting.'),
      [`${p}_alarm_relay`]: cue('objective', 'OBJECTIVE', opts.objectiveTitle || 'Break The Control Point', opts.objective || 'Hold the relay after the guard line is down.'),
      [`${p}_drum_flank`]: cue('room', 'FLANK PRESSURE', `${label} Side Route`, opts.flank || 'The side route reconnects behind the objective. Watch the lateral push.'),
      [`${p}_cage_vestibule`]: cue('room', 'PRE-READ', `${label} Final Threshold`, opts.threshold || 'The final room opens wide. Reload before committing.'),
      [`${p}_relay_cage`]: cue('signature', 'SIGNATURE ROOM', opts.signatureTitle || `${label} Finale`, opts.signature || 'Multiple angles activate together. Move between cover rather than holding center.'),
      [`${p}_exit_door`]: cue('exit', 'EXIT ROUTE', `${label} Exit`, opts.exit || 'Leave once the final guard line is safe.'),
    }),
    objectives: Object.freeze({
      reach_mid_spine: cue('objective', 'ROUTE CONFIRMED', `${label} Spine Reached`, opts.mid || 'The middle route is open. Side lanes can now collapse inward.'),
      disable_alarm_panel: {
        hold: cue('objective', 'HOLD INTERACT', opts.holdTitle || 'Hold The Relay', opts.hold || 'Stay on the control point until the route unlocks.', 'objective', 2600),
        complete: cue('objective_complete', 'OBJECTIVE COMPLETE', opts.completeTitle || 'Control Point Broken', opts.complete || 'The final route is exposed. Push before the guards reset.', 'success', 3600),
      },
    }),
    setpieces: Object.freeze({
      pressure: {
        start: cue('setpiece', 'SETPIECE LIVE', opts.setpieceTitle || `${label} Pressure`, opts.setpiece || 'The room state is changing. Break one side before it surrounds you.', 'danger', 3600),
        trigger: cue('setpiece_trigger', 'REINFORCEMENTS', opts.triggerTitle || 'Side Route Active', opts.trigger || 'A response group is entering through a secondary lane.', 'danger', 3600),
        silenced: cue('setpiece_complete', 'PRESSURE BROKEN', opts.silencedTitle || `${label} Controlled`, opts.silenced || 'The setpiece pressure is down. Finish the route cleanly.', 'success', 3200),
      },
    }),
    reinforcements: Object.freeze({
      [`${p}_alarm_pair`]: cue('reinforcement', 'REINFORCEMENT WARNING', opts.reinforcementTitle || `${label} Response`, opts.reinforcement || 'Two hostiles are entering from the flank.', 'danger', 3200),
    }),
    boss: cue('boss', 'TARGET LINE', opts.bossTitle || `${label} Target Exposed`, opts.boss || 'The final target line is open. Clear the guard detail.', 'boss', 3800),
    clear: cue('clear', 'BUILDING CLEAR', opts.clearTitle || `${label} Secured`, opts.clear || 'Exit unlocked. The route is complete.', 'success', 3600),
  });
}

export const STORY_EXPERIENCE_BUILDING_CUES = Object.freeze({
  1: Object.freeze({
    deploy: cue('deploy', 'DOCK 7', 'Breach The Intake', 'Three lanes. Read the first silhouette, then cut the alarm relay.'),
    rooms: Object.freeze({
      b01_entry_vestibule: cue('room', 'SAFE ORIENTATION', 'Dock Threshold', 'Hazard paint points forward. First contact waits past the intake.'),
      b01_intake_peek: cue('room', 'FIRST CONTACT', 'Intake Peek', 'One held angle. Use the apron cover before crossing center.'),
      b01_relay_approach: cue('room', 'RELAY APPROACH', 'Amber Door Ahead', 'The alarm room is offset left. Clear the desk before touching the panel.'),
      b01_alarm_relay: cue('objective', 'OBJECTIVE', 'Cut The Alarm Chain', 'Hold the relay panel after the guard line breaks. Reinforcements are timed.'),
      b01_drum_flank: cue('room', 'FLANK PRESSURE', 'Drum Lane', 'This side loop reconnects behind the relay. Expect a lateral push.'),
      b01_cage_vestibule: cue('room', 'PRE-READ', 'Cage Vestibule', 'Rails show the final room in fragments. Reload before the commitment.'),
      b01_relay_cage: cue('signature', 'SIGNATURE ROOM', 'Relay Cage', 'Wide fight. Catwalk pressure joins once the cage wakes.'),
      b01_exit_door: cue('exit', 'EXIT ROUTE', 'Cage Door', 'Move through when the room is safe.'),
    }),
    objectives: Object.freeze({
      reach_mid_spine: cue('objective', 'ROUTE CONFIRMED', 'Mid Spine Reached', 'The relay approach is open. Side lanes can now fold back in.'),
      disable_alarm_panel: {
        hold: cue('objective', 'HOLD INTERACT', 'Cut Alarm', 'Stay on the relay panel until the chain drops.', 'objective', 2600),
        complete: cue('objective_complete', 'ALARM CHAIN CUT', 'Reinforcements Aborted', 'The relay is quiet. Push the cage before they recover.', 'success', 3600),
      },
    }),
    setpieces: Object.freeze({
      alarm: {
        start: cue('setpiece', 'CONTAINMENT ALARM', 'Relay Timer Live', 'Clear the middle zone or cut the panel before backup arrives.', 'danger', 3600),
        trigger: cue('setpiece_trigger', 'REINFORCEMENTS', 'Alarm Pair Deployed', 'A side door opened. Break contact or punish the entry.', 'danger', 3600),
        silenced: cue('setpiece_complete', 'RELAY SAFE', 'Alarm Silenced', 'Timer pressure is gone. Finish the route clean.', 'success', 3200),
      },
    }),
    reinforcements: Object.freeze({
      b01_alarm_pair: cue('reinforcement', 'REINFORCEMENT WARNING', 'Side Door Breach', 'Two hostiles are entering from the flank.', 'danger', 3200),
    }),
    boss: cue('boss', 'TARGET LINE', 'Foreman Guard Exposed', 'Clear the cage guard line and finish the dock target.', 'boss', 3800),
    clear: cue('clear', 'BUILDING CLEAR', 'Dock Route Open', 'Exit unlocked. The harbor ledger is yours.', 'success', 3600),
  }),
  2: Object.freeze({
    deploy: cue('deploy', 'CONTINENTAL', 'Protect The Lobby', 'Formal columns hide short pushes. Keep civilians out of the line.'),
    rooms: Object.freeze({
      b02_entry_vestibule: cue('room', 'SAFE ORIENTATION', 'Lobby Vestibule', 'The marble lane is readable. First pressure sits beyond coat check.'),
      b02_intake_peek: cue('room', 'FIRST CONTACT', 'Coat-Check Peek', 'Pistol pressure first. Do not over-swing the concierge line.'),
      b02_relay_approach: cue('room', 'SECURITY THRESHOLD', 'Concierge Approach', 'The relay room is watched from a formal angle. Slow your entry.'),
      b02_alarm_relay: cue('objective', 'HOSTAGE PROTOCOL', 'Secure The Relay Desk', 'Clear targets around civilians before forcing the objective.'),
      b02_drum_flank: cue('room', 'SIDE GALLERY', 'Salon Flank', 'Planters break sightlines. The flank route reconnects fast.'),
      b02_cage_vestibule: cue('room', 'PRE-READ', 'Manager Suite Threshold', 'Glass and mezzanine rails reveal the last angle early.'),
      b02_relay_cage: cue('signature', 'SIGNATURE ROOM', 'Salon Cage', 'Hold fire discipline. The final room punishes panic shots.'),
      b02_exit_door: cue('exit', 'SERVICE ELEVATOR', 'Extraction Door', 'Leave once the manager suite is secure.'),
    }),
    objectives: Object.freeze({
      reach_mid_spine: cue('objective', 'LOBBY SPINE', 'Concierge Route Open', 'Security can now move from both sides.'),
      disable_alarm_panel: {
        hold: cue('objective', 'HOLD INTERACT', 'Extract Route Key', 'Stay close to the relay desk while the system unlocks.', 'objective', 2600),
        complete: cue('objective_complete', 'RELAY COMPLETE', 'Route Key Extracted', 'Civilians are safer. Push to the manager suite.', 'success', 3600),
      },
    }),
    setpieces: Object.freeze({
      hostage: {
        start: cue('setpiece', 'HOSTAGE PROTOCOL', 'Civilians On The Floor', 'No friendly fire. Let targets separate before committing.', 'objective', 3800),
        trigger: cue('setpiece_trigger', 'HOSTAGE HIT', 'Discipline Broken', 'Mastery is compromised. Finish the room safely.', 'danger', 3600),
        silenced: cue('setpiece_complete', 'CIVILIANS SAFE', 'Protocol Held', 'Clean clear confirmed. Continue to the suite.', 'success', 3200),
      },
    }),
    reinforcements: Object.freeze({
      b02_alarm_pair: cue('reinforcement', 'SECURITY RESPONSE', 'Service Door Breach', 'Lobby security is entering from the side route.', 'danger', 3200),
    }),
    boss: cue('boss', 'TARGET LINE', 'Manager Suite Exposed', 'The bagman is behind the guard line. Clear the suite.', 'boss', 3800),
    clear: cue('clear', 'BUILDING CLEAR', 'Lobby Secured', 'Exit unlocked. The route key is recovered.', 'success', 3600),
  }),
  3: Object.freeze({
    deploy: cue('deploy', 'CLUB OBSIDIAN', 'Wake The Floor', 'Neon hides movement. Keep momentum when the VIP rooms open.'),
    rooms: Object.freeze({
      b03_entry_vestibule: cue('room', 'SAFE ORIENTATION', 'Coat Room Entry', 'The pit is quiet for one breath. Pick the first angle.'),
      b03_intake_peek: cue('room', 'FIRST CONTACT', 'Club Peek', 'A silhouette owns the coat-check lane. Win the first shot.'),
      b03_relay_approach: cue('room', 'DANCE FLOOR', 'Booth Approach', 'Open center plate. Cross only after suppressing the booth angle.'),
      b03_alarm_relay: cue('objective', 'DJ RELAY', 'Break The Booth', 'The booth controls the ambush timing. Clear it fast.'),
      b03_drum_flank: cue('room', 'VIP FLANK', 'Amp Corridor', 'Expect pressure from the side rooms when the floor wakes.'),
      b03_cage_vestibule: cue('room', 'PRE-READ', 'Mirror-Lounge Threshold', 'Reflections multiply silhouettes. Trust the waypoint, not the noise.'),
      b03_relay_cage: cue('signature', 'SIGNATURE ROOM', 'VIP Pit', 'Multi-angle finale. Keep moving between rail and glass cover.'),
      b03_exit_door: cue('exit', 'BACKSTAGE EXIT', 'Exit Lane', 'Leave before the floor resets around you.'),
    }),
    objectives: Object.freeze({
      reach_mid_spine: cue('objective', 'FLOOR OPEN', 'Dance Pit Reached', 'VIP pressure can now collapse into the booth route.'),
      disable_alarm_panel: {
        hold: cue('objective', 'HOLD INTERACT', 'Crash The Booth', 'Hold the console and watch the side glass.', 'objective', 2600),
        complete: cue('objective_complete', 'BOOTH DOWN', 'Ambush Timing Broken', 'The VIP route is exposed. Push hard.', 'success', 3600),
      },
    }),
    setpieces: Object.freeze({
      ambush: {
        start: cue('setpiece', 'CLUB AMBUSH', 'Back Rooms Armed', 'The ambush triggers once the middle room collapses.', 'danger', 3600),
        trigger: cue('setpiece_trigger', 'AMBUSH', 'VIP Doors Open', 'Flank wave entering. Cut one side before it surrounds you.', 'danger', 3800),
        silenced: cue('setpiece_complete', 'FLOOR CONTROL', 'Ambush Broken', 'The pit is yours. Finish the target route.', 'success', 3200),
      },
    }),
    reinforcements: Object.freeze({
      b03_alarm_pair: cue('reinforcement', 'VIP RESPONSE', 'Glass Route Breach', 'Side pressure is entering through VIP access.', 'danger', 3200),
    }),
    boss: cue('boss', 'TARGET LINE', 'VIP Guard Exposed', 'The broker route is open. Clear the lounge.', 'boss', 3800),
    clear: cue('clear', 'BUILDING CLEAR', 'Club Route Open', 'Exit unlocked. The broker drive is secured.', 'success', 3600),
  }),
  4: campaignCuePack(4, 'penthouse', 'Penthouse', {
    deployTitle: 'Cross The Suite',
    deployBody: 'Glass lines preview the route. Control the balcony angles before the suite opens.',
    signatureTitle: 'Executive Suite',
    bossTitle: 'Underboss Exposed',
    clearTitle: 'Penthouse Secured',
  }),
  5: campaignCuePack(5, 'medical', 'Sterling Medical', {
    deployTitle: 'Triage The Wing',
    deployBody: 'White rooms hide silhouettes. Slow the first read, then break the surgical pit.',
    objectiveTitle: 'Crash The Security Desk',
    signatureTitle: 'Surgical Pit',
    bossTitle: 'Clinic Target Exposed',
    clearTitle: 'Medical Wing Secured',
  }),
  6: campaignCuePack(6, 'subway', 'Subway Line 7', {
    deployTitle: 'Take The Platform',
    deployBody: 'Long lanes punish late peeks. Use columns to cut the platform in pieces.',
    signatureTitle: 'Switch Chamber',
    bossTitle: 'Transit Boss Exposed',
    clearTitle: 'Platform Secured',
  }),
  7: campaignCuePack(7, 'yacht', 'Azure Yacht', {
    deployTitle: 'Board The Deck',
    deployBody: 'Narrow luxury corridors feed into a wide bridge suite. Keep the flank sealed.',
    signatureTitle: 'Bridge Suite',
    bossTitle: 'Bridge Guard Exposed',
    clearTitle: 'Yacht Secured',
  }),
  8: campaignCuePack(8, 'server', 'Server Farm Delta', {
    deployTitle: 'Breach The Core',
    deployBody: 'Racks break vision into slices. Control the battery bay before the core protocol wakes.',
    objectiveTitle: 'Break The Core Relay',
    signatureTitle: 'Core Protocol',
    bossTitle: 'Server Chief Exposed',
    clearTitle: 'Server Farm Secured',
  }),
  9: campaignCuePack(9, 'border', 'Border Crossing', {
    deployTitle: 'Clear The Checkpoint',
    deployBody: 'Sand lanes are long and exposed. Cross only after the shutter angles are quiet.',
    signatureTitle: 'Border Office',
    bossTitle: 'Checkpoint Target Exposed',
    clearTitle: 'Border Route Secured',
  }),
  10: campaignCuePack(10, 'cathedral', 'Cathedral of San Marco', {
    deployTitle: 'Unseal The Nave',
    deployBody: 'The central aisle is a trap if held too long. Work column to column.',
    signatureTitle: 'Bell-Tower Route',
    bossTitle: 'Cathedral Guard Exposed',
    clearTitle: 'Cathedral Secured',
  }),
  11: campaignCuePack(11, 'freighter', 'Karelia Freighter', {
    deployTitle: 'Cross The Deck Spine',
    deployBody: 'Container lanes stack vertically. Watch the bridge spotlight and engine-side push.',
    signatureTitle: 'Bridge Spotlight',
    bossTitle: 'Captain Guard Exposed',
    clearTitle: 'Freighter Secured',
  }),
  12: campaignCuePack(12, 'spire', 'The Spire', {
    deployTitle: 'Ascend The Spire',
    deployBody: 'The route tightens toward the helipad. Preserve ammo for the final crown.',
    signatureTitle: 'Helipad Apex',
    bossTitle: 'Spire Target Exposed',
    clearTitle: 'Spire Secured',
  }),
});

export function createStoryExperienceState() {
  return {
    version: STORY_EXPERIENCE_VERSION,
    enabled: false,
    building: null,
    levelId: null,
    queue: [],
    activeCue: null,
    lastCue: null,
    seen: Object.create(null),
    lastFlowRoomId: null,
    lastDirectorTriggerKey: null,
    lastSetpieceKind: null,
    lastSetpieceTriggered: false,
    lastSetpieceProgress: 0,
    lastSetpieceRewardGiven: false,
    lastSetpieceSilenced: false,
    lastBossVisible: false,
    lastExitUnlocked: false,
    hud: {
      roomLabel: '',
      taskLabel: '',
      tone: 'story',
    },
  };
}

export function shouldRunStoryExperience(ctx = {}) {
  const building = Number(ctx.building) | 0;
  return !!(
    ctx.started &&
    ctx.playMode === 'solo' &&
    !ctx.splitScreenActive &&
    !ctx.endlessMode &&
    !ctx.rangeActive &&
    ctx.campaignLevel &&
    STORY_EXPERIENCE_BUILDING_CUES[building]
  );
}

function cloneCue(src, extra = {}) {
  if (!src) return null;
  return Object.assign({}, src, extra);
}

function cueKey(cueObj, fallback) {
  if (!cueObj) return fallback || 'cue';
  return [
    cueObj.kind || 'cue',
    cueObj.building || '',
    cueObj.roomId || '',
    cueObj.objectiveId || '',
    cueObj.squad || '',
    cueObj.title || '',
  ].join(':');
}

function enqueueCue(state, cueObj, key) {
  if (!state || !cueObj) return false;
  const k = key || cueKey(cueObj);
  if (state.seen[k]) return false;
  state.seen[k] = true;
  const out = Object.assign({ id: k, durationMs: DEFAULT_CUE_MS }, cueObj);
  state.queue.push(out);
  return true;
}

function resetTransient(state) {
  state.queue = [];
  state.activeCue = null;
  state.lastCue = null;
  state.seen = Object.create(null);
  state.lastFlowRoomId = null;
  state.lastDirectorTriggerKey = null;
  state.lastSetpieceKind = null;
  state.lastSetpieceTriggered = false;
  state.lastSetpieceProgress = 0;
  state.lastSetpieceRewardGiven = false;
  state.lastSetpieceSilenced = false;
  state.lastBossVisible = false;
  state.lastExitUnlocked = false;
  state.hud = { roomLabel: '', taskLabel: '', tone: 'story' };
}

export function resetStoryExperience(state, ctx = {}) {
  const s = state || createStoryExperienceState();
  resetTransient(s);
  s.version = STORY_EXPERIENCE_VERSION;
  s.enabled = shouldRunStoryExperience(ctx);
  s.building = Number(ctx.building) | 0 || null;
  s.levelId = ctx.campaignLevel && ctx.campaignLevel.id || null;
  const cues = STORY_EXPERIENCE_BUILDING_CUES[s.building];
  if (s.enabled && cues && cues.deploy) {
    enqueueCue(s, cloneCue(cues.deploy, { building: s.building }), `deploy:${s.building}`);
    s.hud.taskLabel = cues.deploy.title;
    s.hud.tone = cues.deploy.tone || 'story';
  }
  return s;
}

function completeTextForObjective(cues, id) {
  const obj = cues && cues.objectives && cues.objectives[id];
  if (!obj) return null;
  return obj.complete || obj;
}

function holdTextForObjective(cues, id) {
  const obj = cues && cues.objectives && cues.objectives[id];
  if (!obj) return null;
  return obj.hold || obj;
}

function promoteNextCue(state, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (state.activeCue && now < state.activeCue.expiresAtMs) return state.activeCue;
  if (state.activeCue && now >= state.activeCue.expiresAtMs) state.activeCue = null;
  if (!state.queue.length) return null;
  const next = state.queue.shift();
  const duration = Math.max(900, Number(next.durationMs) || DEFAULT_CUE_MS);
  state.activeCue = Object.assign({}, next, {
    startedAtMs: now,
    expiresAtMs: now + duration,
  });
  state.lastCue = state.activeCue;
  state.hud.taskLabel = state.activeCue.title || state.hud.taskLabel || '';
  state.hud.tone = state.activeCue.tone || 'story';
  return state.activeCue;
}

function roomLabelFromDirector(director, roomId) {
  const room = director && director.roomFlow && director.roomFlow.rooms && director.roomFlow.rooms[roomId];
  return room && (room.name || room.label || room.kind) || roomId || '';
}

export function updateStoryExperience(state, ctx = {}) {
  const s = state || createStoryExperienceState();
  const active = shouldRunStoryExperience(ctx);
  const building = Number(ctx.building) | 0;
  if (!active) {
    s.enabled = false;
    s.activeCue = null;
    s.queue = [];
    return s;
  }
  if (!s.enabled || s.building !== building || s.levelId !== (ctx.campaignLevel && ctx.campaignLevel.id || null)) {
    resetStoryExperience(s, ctx);
  }
  s.enabled = true;
  const cues = STORY_EXPERIENCE_BUILDING_CUES[building];
  const director = ctx.director || null;
  const setpiece = ctx.setpiece || null;
  const nowMs = Number.isFinite(ctx.nowMs) ? ctx.nowMs : Date.now();

  const flowRoom = director && director.currentFlowRoomId;
  if (flowRoom) {
    const roomLabel = roomLabelFromDirector(director, flowRoom);
    s.hud.roomLabel = roomLabel ? String(roomLabel).replace(/_/g, ' ').toUpperCase() : '';
    if (flowRoom !== s.lastFlowRoomId) {
      s.lastFlowRoomId = flowRoom;
      const roomCue = cues.rooms && cues.rooms[flowRoom];
      enqueueCue(s, cloneCue(roomCue, { building, roomId: flowRoom }), `room:${building}:${flowRoom}`);
    }
  }

  const trigger = director && director.lastTrigger;
  if (trigger && Number.isFinite(trigger.t)) {
    const tk = `${trigger.type || 'trigger'}:${trigger.id || trigger.encounterId || trigger.room || ''}:${trigger.t}`;
    if (tk !== s.lastDirectorTriggerKey) {
      s.lastDirectorTriggerKey = tk;
      if (trigger.type === 'traverse_objective') {
        const c = completeTextForObjective(cues, trigger.id);
        enqueueCue(s, cloneCue(c, { building, objectiveId: trigger.id }), `objective:${building}:${trigger.id}:complete`);
      } else if (trigger.type === 'objective') {
        const c = completeTextForObjective(cues, trigger.id);
        enqueueCue(s, cloneCue(c, { building, objectiveId: trigger.id }), `objective:${building}:${trigger.id}:complete`);
      } else if (trigger.type === 'reinforcement_queued') {
        const c = (cues.reinforcements && cues.reinforcements[trigger.id]) ||
          cue('reinforcement', 'REINFORCEMENT WARNING', 'Backup Entering', 'A side entry has opened. Reposition before the flank lands.', 'danger', 3200);
        enqueueCue(s, cloneCue(c, { building, squad: trigger.id }), `reinforcement:${building}:${trigger.id}`);
      }
    }
  }

  const objectiveState = director && director.objectiveState;
  if (objectiveState && (objectiveState.alarmPanelHold || 0) > 0.18 && !objectiveState.completedObjectiveIds?.disable_alarm_panel) {
    const c = holdTextForObjective(cues, 'disable_alarm_panel');
    enqueueCue(s, cloneCue(c, { building, objectiveId: 'disable_alarm_panel' }), `objective:${building}:disable_alarm_panel:hold`);
  }
  if (objectiveState && objectiveState.completedObjectiveIds?.disable_alarm_panel) {
    const c = completeTextForObjective(cues, 'disable_alarm_panel');
    enqueueCue(s, cloneCue(c, { building, objectiveId: 'disable_alarm_panel' }), `objective:${building}:disable_alarm_panel:complete`);
  }

  if (setpiece && setpiece.active && setpiece.kind) {
    const kind = setpiece.kind;
    const cset = (cues.setpieces && (cues.setpieces[kind] || cues.setpieces.pressure)) || null;
    if (kind !== s.lastSetpieceKind) {
      s.lastSetpieceKind = kind;
      s.lastSetpieceTriggered = !!setpiece.triggered;
      s.lastSetpieceRewardGiven = !!setpiece.rewardGiven;
      s.lastSetpieceProgress = Number(setpiece.progress) || 0;
      s.lastSetpieceSilenced = !!setpiece._relaySilenced;
      enqueueCue(s, cloneCue(cset && cset.start, { building, setpiece: kind }), `setpiece:${building}:${kind}:start`);
    }
    if (!!setpiece.triggered && !s.lastSetpieceTriggered) {
      s.lastSetpieceTriggered = true;
      enqueueCue(s, cloneCue(cset && cset.trigger, { building, setpiece: kind }), `setpiece:${building}:${kind}:trigger`);
    }
    const progress = Number(setpiece.progress) || 0;
    if (kind === 'hostage' && progress > s.lastSetpieceProgress) {
      enqueueCue(s, cloneCue(cset && cset.trigger, { building, setpiece: kind }), `setpiece:${building}:${kind}:hostage-hit:${progress}`);
    }
    s.lastSetpieceProgress = progress;
    const silenced = !!(setpiece._relaySilenced || (kind === 'alarm' && setpiece.rewardGiven && !setpiece.triggered));
    if (silenced && !s.lastSetpieceSilenced) {
      s.lastSetpieceSilenced = true;
      enqueueCue(s, cloneCue(cset && cset.silenced, { building, setpiece: kind }), `setpiece:${building}:${kind}:silenced`);
    }
    if (!!setpiece.rewardGiven && !s.lastSetpieceRewardGiven) {
      s.lastSetpieceRewardGiven = true;
      if (!s.lastSetpieceSilenced) {
        enqueueCue(s, cloneCue(cset && cset.silenced, { building, setpiece: kind }), `setpiece:${building}:${kind}:reward`);
      }
    }
  } else {
    s.lastSetpieceKind = null;
    s.lastSetpieceTriggered = false;
    s.lastSetpieceRewardGiven = false;
    s.lastSetpieceProgress = 0;
    s.lastSetpieceSilenced = false;
  }

  const bossVisible = !!(ctx.boss && !ctx.boss.dead);
  if (bossVisible && !s.lastBossVisible) {
    enqueueCue(s, cloneCue(cues.boss, { building }), `boss:${building}:reveal`);
  }
  s.lastBossVisible = bossVisible;

  if (!!ctx.exitUnlocked && !s.lastExitUnlocked) {
    enqueueCue(s, cloneCue(cues.clear, { building }), `clear:${building}`);
  }
  s.lastExitUnlocked = !!ctx.exitUnlocked;

  promoteNextCue(s, nowMs);
  return s;
}

export function consumeStoryExperienceCue(state, nowMs = Date.now()) {
  if (!state || !state.enabled) return null;
  return promoteNextCue(state, nowMs);
}

export function storyExperienceSnapshot(state) {
  if (!state) {
    return {
      version: STORY_EXPERIENCE_VERSION,
      enabled: false,
      building: null,
      levelId: null,
      activeCue: null,
      queued: 0,
      lastCue: null,
      hud: null,
    };
  }
  const cueSlim = (c) => c ? {
    id: c.id || null,
    kind: c.kind || null,
    tag: c.tag || null,
    title: c.title || null,
    tone: c.tone || null,
    roomId: c.roomId || null,
    objectiveId: c.objectiveId || null,
    squad: c.squad || null,
  } : null;
  return {
    version: STORY_EXPERIENCE_VERSION,
    enabled: !!state.enabled,
    building: state.building || null,
    levelId: state.levelId || null,
    currentRoom: state.lastFlowRoomId || null,
    activeCue: cueSlim(state.activeCue),
    queued: state.queue ? state.queue.length : 0,
    lastCue: cueSlim(state.lastCue),
    hud: state.hud ? { ...state.hud } : null,
  };
}
