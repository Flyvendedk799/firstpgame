import { DEPLOY_STORY_LEVELS } from './levels.js';
import { DEPLOY_ONLY_LEVEL_MANIFEST, filterDeployLevels } from './deployManifest.js';

const BASE_PHASES = ['read', 'engage', 'spike', 'breath', 'choice'];

const ENCOUNTER_ARCHETYPES = {
  pinch: { pressure: 'front-lock and rear-flank', enemies: ['bruiser', 'flanker'] },
  crossfire: { pressure: 'intersecting ranged lanes', enemies: ['marksman', 'shield'] },
  wave: { pressure: 'timed aggression pulses', enemies: ['rusher', 'grappler'] },
  duel: { pressure: 'single elite tempo test', enemies: ['elite'] },
  collapse: { pressure: 'mixed roles with state hazards', enemies: ['elite', 'rusher', 'marksman'] }
};

const LEVEL_SIGNATURES = {
  L01_BROKEN_ENTRY: ['pinch', 'wave', 'duel'],
  L02_VELVET_CORRIDOR: ['crossfire', 'pinch', 'duel'],
  L03_HOLLOW_STACK: ['crossfire', 'wave', 'duel'],
  L04_IRON_REFINERY: ['pinch', 'collapse', 'duel'],
  L05_GLASS_SPINE: ['crossfire', 'pinch', 'collapse'],
  L06_DEEP_SWITCH: ['wave', 'collapse', 'duel'],
  L07_CROWN_MERCY: ['pinch', 'crossfire', 'duel'],
  L08_RAIN_TEMPLE: ['duel', 'wave', 'collapse'],
  L09_BLACK_DOCKET: ['crossfire', 'collapse', 'duel'],
  L10_SUNDERED_LAB: ['pinch', 'collapse', 'wave'],
  L11_SKYCOURT: ['crossfire', 'duel', 'collapse'],
  L12_ASHEN_HEART: ['collapse', 'wave', 'duel']
};

const BEAT_TYPES = ['read', 'brawl', 'hold', 'snipe', 'stealth_or_loud', 'boss'];

function makeRoomCards(level) {
  return level.criticalPath.map((roomName, idx) => {
    const role = idx === 0 ? 'entry' : idx === level.criticalPath.length - 1 ? 'boss_threshold' : 'midflow';
    return {
      roomName,
      role,
      narrativeRole: [
        'operational node for faction logistics',
        'social boundary revealing hierarchy',
        'control zone tied to mission objective'
      ][idx % 3],
      tacticalIdentity: [
        'tight angles with staggered cover',
        'mixed-range lane trading',
        'vertical pressure and flank denial'
      ][idx % 3],
      interactionSet: ['breakable cover', 'lockable door', 'alert console', 'environmental stun'][idx % 4],
      encounterBeatType: role === 'boss_threshold' ? 'boss' : BEAT_TYPES[idx % (BEAT_TYPES.length - 1)]
    };
  });
}

function makeRouteLayers(level) {
  const [first, second, third, fourth] = level.criticalPath;
  return {
    publicLayer: [first],
    operationalLayer: [second],
    controlLayer: [third],
    sanctumLayer: [fourth],
    loopbacks: [
      { from: second, to: first, unlock: 'service_key' },
      { from: fourth, to: second, unlock: 'master_badge' }
    ]
  };
}

function makeEncounterScript(level) {
  const signature = LEVEL_SIGNATURES[level.id];
  return signature.map((arch, idx) => {
    const data = ENCOUNTER_ARCHETYPES[arch];
    return {
      encounterId: `${level.id}_E${idx + 1}`,
      room: level.criticalPath[Math.min(idx + 1, level.criticalPath.length - 1)],
      archetype: arch,
      pressureModel: data.pressure,
      enemyRoles: data.enemies,
      reinforcementTelegraph: { preDoorLights: true, audibleRumble: true, breachDelaySec: 1.5 + idx * 0.5 },
      adaptivePressure: { holdLaneFlankTrigger: true, speedRunEliteInjection: true, respiteBeforeBoss: idx === signature.length - 1 },
      phaseTimeline: BASE_PHASES.map((phase, phaseIdx) => ({
        phase,
        seconds: 8 + phaseIdx * 6 + idx * 2,
        intent: {
          read: 'threat scan and spacing check',
          engage: 'commit to first exchange',
          spike: 'reinforcement arrival or elite interruption',
          breath: 'micro-reset and reposition',
          choice: 'branch into stealth bypass or direct push'
        }[phase]
      }))
    };
  });
}

function makeWorldStateRules(level) {
  return [
    {
      key: 'alarm',
      trigger: 'player_noise_budget_exceeded',
      effects: ['spawn_plus_2', 'lock_primary_doors', 'activate_flank_route']
    },
    {
      key: 'power_shift',
      trigger: 'breaker_interaction',
      effects: ['lights_dimmed', 'alternate_route_open', 'camera_grid_disabled']
    },
    {
      key: 'intel_control',
      trigger: 'terminal_hacked',
      effects: ['minimap_room_reveal', 'elite_patrol_repath', 'shortcut_persist_unlock']
    }
  ].map((rule, idx) => ({ ...rule, priority: idx + 1, levelId: level.id }));
}

function makeReplayMastery(level) {
  return {
    masteryGoals: [
      'clear_with_no_alarm',
      'complete_under_target_time',
      'minimize_damage_taken',
      'optional_space_discovery_full'
    ],
    unlocks: [
      { id: `${level.id}_UNLOCK_SERVICE`, reward: 'service_shortcut', appliesToNextRuns: true },
      { id: `${level.id}_UNLOCK_INTEL`, reward: 'early_enemy_layout_preview', appliesToNextRuns: true }
    ],
    scoreWeights: {
      routeDiscipline: 0.3,
      tacticalVariety: 0.25,
      defenseEfficiency: 0.2,
      executionSpeed: 0.25
    }
  };
}

export const STORY_DEPTH_PACK = filterDeployLevels(DEPLOY_STORY_LEVELS).map((level) => ({
  levelId: level.id,
  title: level.title,
  fantasy: `${level.buildingType} in ${level.district}`,
  designPillars: [
    'place-first storytelling',
    'choreographed encounter pacing',
    'route mastery and replay compression',
    'state-reactive world behavior'
  ],
  routeLayers: makeRouteLayers(level),
  roomCards: makeRoomCards(level),
  encounterScript: makeEncounterScript(level),
  worldStateRules: makeWorldStateRules(level),
  replayMastery: makeReplayMastery(level),
  environmentalStoryBeats: [
    `Entry beat introduces ${level.district} social texture`,
    `Mid-level beat escalates around ${level.objective.toLowerCase()}`,
    `Final beat resolves control conflict in ${level.bossArena}`
  ],
  cinematicMoments: [
    { cue: 'arrival', cameraHint: 'wide establish then shoulder tighten', durationSec: 5 },
    { cue: 'encounter_spike', cameraHint: 'locked combat readability framing', durationSec: 7 },
    { cue: 'boss_threshold', cameraHint: 'slow push into arena axis', durationSec: 6 }
  ]
}));

export function getStoryDepthLevel(levelId) {
  return STORY_DEPTH_PACK.find((item) => item.levelId === levelId) ?? null;
}

export function validateStoryDepthPack() {
  const manifestSet = new Set(DEPLOY_ONLY_LEVEL_MANIFEST);
  const errors = [];
  for (const level of STORY_DEPTH_PACK) {
    if (!manifestSet.has(level.levelId)) errors.push(`${level.levelId}: not in deploy manifest`);
    if (level.roomCards.length < 4) errors.push(`${level.levelId}: needs >=4 room cards`);
    if (level.encounterScript.length < 3) errors.push(`${level.levelId}: needs >=3 encounter scripts`);
    for (const enc of level.encounterScript) {
      if (enc.phaseTimeline.length !== 5) errors.push(`${enc.encounterId}: requires 5 pacing phases`);
    }
  }
  return { ok: errors.length === 0, errors };
}
