/** Editor UX workflows, tool hints, and enemy behavior sequence presets. */

export const EDITOR_WORKFLOW_STEPS = [
  {
    id: 'layout',
    title: '1 · Layout',
    short: 'Place floors, walls, and cover from the palette.',
    tools: ['place', 'pan', 'select'],
    done: (map) => (map?.objects?.length || 0) > 0,
  },
  {
    id: 'flow',
    title: '2 · Flow',
    short: 'Set spawn, exit, and zone doors so the route reads clearly.',
    tools: ['spawn', 'exit', 'door'],
    done: (map) => !!(map?.markers?.playerSpawn && (map?.markers?.exits?.length || 0) > 0),
  },
  {
    id: 'enemies',
    title: '3 · Enemies',
    short: 'Place enemies and pick a behavior sequence preset.',
    tools: ['enemy', 'peek', 'hold', 'cover', 'patrol', 'flank'],
    done: (map) => (map?.markers?.enemySpawns?.length || 0) > 0,
  },
  {
    id: 'validate',
    title: '4 · Validate',
    short: 'Run VALIDATE, tune in the inspector, then PLAYTEST.',
    tools: ['select'],
    done: (_map, ctx) => !!(ctx?.validationOk),
  },
];

export const EDITOR_TOOL_HINTS = {
  select: 'Click to select · drag to move · Del to delete · F to frame',
  pan: 'Drag to pan the camera · arrow keys also move the view',
  place: 'Pick a prefab, then click or drag on the canvas to paint',
  spawn: 'Click to move the player spawn — start of the run',
  exit: 'Click to place the extraction zone at the far end',
  door: 'Place zone gates that unlock as you clear each third',
  enemy: 'Click to place · use behavior sequences on the right · tune in inspector',
  peek: 'Marks where an enemy should lean out and shoot',
  hold: 'Anchor point — enemy stays near this spot under pressure',
  cover: 'Biases AI toward this cover volume at runtime',
  patrol: 'Click points, Enter to finish — assign route in enemy links',
  flank: 'Draw a path enemies take to wrap the player',
  zone: 'Drag a rectangle for combat pacing in that area',
  trigger: 'Volume that can wake linked enemies or routes',
  breach: 'Marks a breach / push entry for breacher roles',
  sniper: 'Long-range perch with arc and range in inspector',
  pickup: 'Ammo or med pickup for the player',
};

export const ENEMY_BEHAVIOR_META = {
  hold_angle: {
    label: 'Hold angle',
    summary: 'Stays on cover and fires from a fixed lane.',
    role: 'anchor',
    tuning: { holdBias: 0.82, peekBias: 0.42, aggressiveness: 0.38, reactDelay: 0 },
  },
  peek_from_cover: {
    label: 'Peek from cover',
    summary: 'Frequent lean-and-shoot from linked peek or cover.',
    role: 'lookout',
    tuning: { holdBias: 0.55, peekBias: 0.88, aggressiveness: 0.45, reactDelay: 0 },
  },
  ambush_on_crossing: {
    label: 'Ambush on crossing',
    summary: 'Holds fire until the player crosses their lane, then spikes aggression.',
    role: 'flanker',
    tuning: { holdBias: 0.35, peekBias: 0.28, aggressiveness: 0.72, reactDelay: 0.35 },
  },
  push_after_contact: {
    label: 'Push after contact',
    summary: 'Holds until spotted, then advances to pressure the player.',
    role: 'breacher',
    tuning: { holdBias: 0.48, peekBias: 0.5, aggressiveness: 0.78, reactDelay: 0.15 },
  },
  patrol_route: {
    label: 'Patrol route',
    summary: 'Follows a linked patrol path before engaging.',
    role: 'patrol',
    tuning: { holdBias: 0.4, peekBias: 0.55, aggressiveness: 0.5, reactDelay: 0 },
  },
  patrol_then_alarm: {
    label: 'Patrol then alarm',
    summary: 'Patrols until contact, then alerts like a lookout.',
    role: 'patrol',
    tuning: { holdBias: 0.42, peekBias: 0.72, aggressiveness: 0.55, reactDelay: 0.2 },
  },
  flank_after_contact: {
    label: 'Flank after contact',
    summary: 'Uses linked flank waypoints once the player is spotted.',
    role: 'flanker',
    tuning: { holdBias: 0.38, peekBias: 0.58, aggressiveness: 0.68, reactDelay: 0.1 },
  },
  suppress_lane: {
    label: 'Suppress lane',
    summary: 'Pins the player with sustained fire at range.',
    role: 'marksman',
    tuning: { holdBias: 0.7, peekBias: 0.35, aggressiveness: 0.52, reactDelay: 0 },
  },
  guard_objective: {
    label: 'Guard objective',
    summary: 'Rarely leaves a hold point near exit or objective.',
    role: 'anchor',
    tuning: { holdBias: 0.92, peekBias: 0.3, aggressiveness: 0.32, reactDelay: 0 },
  },
  reposition: {
    label: 'Reposition',
    summary: 'Re-seeks cover more often — good for reinforcements.',
    role: 'reinforcement',
    tuning: { holdBias: 0.45, peekBias: 0.48, aggressiveness: 0.58, reactDelay: 0.25 },
  },
  rush_when_player_reloads: {
    label: 'Rush on reload',
    summary: 'Surges when the player reloads in range.',
    role: 'breacher',
    tuning: { holdBias: 0.3, peekBias: 0.4, aggressiveness: 0.85, reactDelay: 0 },
  },
};

export const ENEMY_BEHAVIOR_SEQUENCES = [
  {
    id: 'hold_defend',
    label: 'Hold & defend',
    summary: 'Anchors on cover — link COVER and optional HOLD markers.',
    behavior: 'hold_angle',
    role: 'anchor',
    spawnWave: 'initial',
    activation: 'zone_start',
    linkCover: true,
    linkHold: true,
    linkPeek: false,
    suggestedTools: ['cover', 'hold', 'enemy'],
  },
  {
    id: 'patrol_escalate',
    label: 'Patrol & escalate',
    summary: 'Draw a PATROL route first, then place enemies on the path.',
    behavior: 'patrol_then_alarm',
    role: 'patrol',
    spawnWave: 'initial',
    activation: 'zone_start',
    linkPatrol: true,
    linkPeek: false,
    suggestedTools: ['patrol', 'enemy'],
  },
  {
    id: 'flank_ambush',
    label: 'Flank & ambush',
    summary: 'Ambush until the player crosses, optional FLANK path after contact.',
    behavior: 'ambush_on_crossing',
    role: 'flanker',
    spawnWave: 'initial',
    activation: 'on_trigger',
    linkPeek: true,
    linkFlank: true,
    suggestedTools: ['peek', 'flank', 'enemy'],
  },
  {
    id: 'push_reinforce',
    label: 'Push & reinforce',
    summary: 'Breacher pushes after contact; use reinforcement wave for backups.',
    behavior: 'push_after_contact',
    role: 'breacher',
    spawnWave: 'reinforcement',
    activation: 'reinforcement',
    linkCover: true,
    suggestedTools: ['cover', 'enemy', 'trigger'],
  },
];

export function behaviorMeta(behaviorId) {
  return ENEMY_BEHAVIOR_META[behaviorId] || {
    label: behaviorId || 'Unknown',
    summary: 'Custom behavior — tune sliders below.',
    role: 'anchor',
    tuning: { holdBias: 0.5, peekBias: 0.5, aggressiveness: 0.5, reactDelay: 0 },
  };
}

export function workflowProgress(map, ctx = {}) {
  return EDITOR_WORKFLOW_STEPS.map((step) => ({
    ...step,
    complete: !!step.done(map, ctx),
  }));
}

export function nearestMarkerId(markers, x, z, maxDist = 14) {
  let best = null;
  let bestD = maxDist;
  for (const m of markers || []) {
    if (!m || m.id == null) continue;
    const mx = Number(m.x);
    const mz = Number(m.z);
    if (!Number.isFinite(mx) || !Number.isFinite(mz)) continue;
    const d = Math.hypot(mx - x, mz - z);
    if (d < bestD) {
      bestD = d;
      best = m.id;
    }
  }
  return best;
}

export function applyBehaviorSequenceToSpawn(spawn, map, sequenceId) {
  const seq = ENEMY_BEHAVIOR_SEQUENCES.find((s) => s.id === sequenceId);
  if (!seq || !spawn || !map) return null;
  const meta = behaviorMeta(seq.behavior);
  spawn.behavior = seq.behavior;
  spawn.role = seq.role;
  spawn.spawnWave = seq.spawnWave;
  spawn.activation = seq.activation;
  spawn.behaviorTuning = Object.assign({}, meta.tuning, spawn.behaviorTuning || {});
  spawn.links = spawn.links || {};
  const x = Number(spawn.x) || 0;
  const z = Number(spawn.z) || 0;
  if (seq.linkCover) {
    const id = nearestMarkerId(map.markers?.coverHints, x, z);
    if (id) spawn.links.coverHintId = id;
  }
  if (seq.linkHold) {
    const id = nearestMarkerId(map.markers?.holdPositions, x, z);
    if (id) spawn.links.holdPositionId = id;
  }
  if (seq.linkPeek) {
    const id = nearestMarkerId(map.markers?.peekAngles, x, z);
    if (id) spawn.links.peekAngleId = id;
  }
  if (seq.linkPatrol) {
    const id = nearestMarkerId(
      (map.markers?.patrolRoutes || []).map((r) => ({
        id: r.id,
        x: (r.points?.[0]?.x) ?? 0,
        z: (r.points?.[0]?.z) ?? 0,
      })),
      x,
      z,
      22,
    );
    if (id) spawn.links.patrolRouteId = id;
  }
  if (seq.linkFlank) {
    const id = nearestMarkerId(
      (map.markers?.flankRoutes || []).map((r) => ({
        id: r.id,
        x: (r.points?.[0]?.x) ?? 0,
        z: (r.points?.[0]?.z) ?? 0,
      })),
      x,
      z,
      22,
    );
    if (id) spawn.links.flankRouteId = id;
  }
  return seq;
}
