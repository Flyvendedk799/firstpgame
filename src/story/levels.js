export const STORY_LEVELS = [
  {
    id: 'L01_BROKEN_ENTRY',
    order: 1,
    title: 'Broken Entry',
    district: 'Outer Perimeter',
    buildingType: 'Abandoned Logistics Depot',
    tone: 'Cold tutorial with escalating pressure',
    objective: 'Infiltrate the depot and recover the first blackbox shard.',
    combatStyle: 'Low enemy density, readable melee funnels, short sightlines',
    traversalFeatures: ['Service hall loopback', 'Vent shortcut unlock', 'One-way catwalk drop'],
    criticalPath: ['Gate Court', 'Shipping Bay', 'Manifest Office', 'Relay Cage'],
    optionalSpaces: ['Forklift Garage', 'Damaged Locker Annex'],
    bossArena: 'Relay Cage Platform',
    productionNotes: [
      'First encounter must teach spacing and directional threat checks.',
      'Alarm state should introduce first reinforcement flank through side corridor.',
      'Completion unlocks permanent side vent on replays.'
    ]
  },
  {
    id: 'L02_VELVET_CORRIDOR',
    order: 2,
    title: 'Velvet Corridor',
    district: 'Entertainment Mile',
    buildingType: 'Nightclub + Backhouse',
    tone: 'Stylized social space with sudden violence',
    objective: 'Locate the broker and extract route credentials.',
    combatStyle: 'Crowd control in narrow dance-floor boundaries and stair pressure',
    traversalFeatures: ['VIP stair split', 'Bar wraparound flank', 'Booth crawl bypass'],
    criticalPath: ['Front Queue', 'Main Floor', 'VIP Spine', 'Manager Suite'],
    optionalSpaces: ['DJ Control Booth', 'Cold Storage'],
    bossArena: 'Mirrored Lounge',
    productionNotes: [
      'Lighting profile transitions from neon warmth to sterile back-office white.',
      'Security panic closes main floor shutters if stealth fails.',
      'Replay mastery route should skip entire dance-floor fight via service pass.'
    ]
  },
  {
    id: 'L03_HOLLOW_STACK',
    order: 3,
    title: 'Hollow Stack',
    district: 'Archive Quarter',
    buildingType: 'Municipal Records Tower',
    tone: 'Dense interior vertical maze',
    objective: 'Secure historical access keys from sealed stacks.',
    combatStyle: 'Vertical pressure and line-of-sight denial around shelves',
    traversalFeatures: ['Inter-floor lift core', 'Stack ladder chains', 'Archive chute shortcut'],
    criticalPath: ['Lobby Rotunda', 'Reading Floor', 'Records Spine', 'Sealed Vault'],
    optionalSpaces: ['Microfilm Lab', 'Server Nook'],
    bossArena: 'Circular Catalog Hall',
    productionNotes: [
      'Book stacks create soft cover islands and blind corners for choreography.',
      'Power reroute should darken two sectors and spawn flashlight patrol variant.',
      'Mastery unlock enables direct chute entry to third sector.'
    ]
  },
  {
    id: 'L04_IRON_REFINERY',
    order: 4,
    title: 'Iron Refinery',
    district: 'Industrial Basin',
    buildingType: 'Smelter and Assembly Works',
    tone: 'Heat, sparks, machinery, high hazard readability',
    objective: 'Sabotage production and eliminate the foreman.',
    combatStyle: 'Lane-based engagements around moving machinery',
    traversalFeatures: ['Crane bridge crossover', 'Slag trench risk route', 'Maintenance tunnel'],
    criticalPath: ['Ore Intake', 'Furnace Walk', 'Assembly Grid', 'Control Foundry'],
    optionalSpaces: ['Safety Cage', 'Parts Inventory Dock'],
    bossArena: 'Overhead Crane Deck',
    productionNotes: [
      'Environmental hazard timing should reward patient spacing over rushdown.',
      'Emergency shutdown changes enemy approach vectors in second half.',
      'Replay route unlocks insulated maintenance tunnel with fewer elites.'
    ]
  },
  {
    id: 'L05_GLASS_SPINE',
    order: 5,
    title: 'Glass Spine',
    district: 'Civic Heights',
    buildingType: 'Corporate Atrium Tower',
    tone: 'Clean architecture, exposed traversal, high visibility',
    objective: 'Retrieve executive clearance and breach secure core.',
    combatStyle: 'Mixed-range engagements with vertical overlook threats',
    traversalFeatures: ['Atrium skybridge', 'Facade maintenance rail', 'Escalator choke'],
    criticalPath: ['Plaza Entry', 'Reception Atrium', 'Boarding Gallery', 'Executive Ring'],
    optionalSpaces: ['Pantry Row', 'Investor Theater'],
    bossArena: 'Helipad Access Hall',
    productionNotes: [
      'Glass acoustics motif should telegraph nearby combat and patrol movement.',
      'Alarm state should lock elevators and force stairwell gauntlet.',
      'Mastery unlock grants badge reader bypass to executive ring.'
    ]
  },
  {
    id: 'L06_DEEP_SWITCH',
    order: 6,
    title: 'Deep Switch',
    district: 'Transit Underline',
    buildingType: 'Substation + Metro Service Network',
    tone: 'Claustrophobic infrastructure with tactical darkness',
    objective: 'Restore grid segment and intercept courier convoy.',
    combatStyle: 'Ambush-prone tunnels, tight corners, burst encounters',
    traversalFeatures: ['Trackside bypass', 'Breaker room reroute', 'Conduit crawl'],
    criticalPath: ['Maintenance Gate', 'Signal Tunnels', 'Power Hall', 'Dispatch Dock'],
    optionalSpaces: ['Flooded Pump Cell', 'Retired Platform'],
    bossArena: 'High-Voltage Switch Chamber',
    productionNotes: [
      'Dynamic power states must alter both lighting and door accessibility.',
      'Player-controlled blackout enables stealth segment or chaos brawl variant.',
      'Replay route unlocks dormant commuter tunnel shortcut.'
    ]
  },
  {
    id: 'L07_CROWN_MERCY',
    order: 7,
    title: 'Crown of Mercy',
    district: 'Med District',
    buildingType: 'Private Hospital Complex',
    tone: 'Clinical calm masking covert militarization',
    objective: 'Extract captive ally from secure surgical ward.',
    combatStyle: 'Mixed civilian-space navigation with controlled heavy encounters',
    traversalFeatures: ['ICU corridor fork', 'Service elevator drop', 'Roof med-bridge'],
    criticalPath: ['Emergency Intake', 'Ward Spine', 'Surgical Core', 'Recovery Wing'],
    optionalSpaces: ['Pharmacy Archive', 'Laundry Processing'],
    bossArena: 'Observation Theater',
    productionNotes: [
      'Non-combat patient areas should create moral pacing and tension contrast.',
      'Security tiers escalate by wing; failed stealth hardens routes with barricades.',
      'Replay unlock keeps one ICU gate permanently open for low-damage runs.'
    ]
  },
  {
    id: 'L08_RAIN_TEMPLE',
    order: 8,
    title: 'Rain Temple',
    district: 'Old Hill',
    buildingType: 'Mountain Monastery Compound',
    tone: 'Ritual architecture, meditative but hostile',
    objective: 'Confront the abbot-custodian and seize cipher relic.',
    combatStyle: 'Measured duels interrupted by disciplined group formations',
    traversalFeatures: ['Courtyard loop', 'Bell tower climb', 'Hidden cloister passage'],
    criticalPath: ['Stone Gate', 'Prayer Court', 'Inner Cloister', 'Sanctum Hall'],
    optionalSpaces: ['Scriptorium', 'Kitchen Yard'],
    bossArena: 'Rainfall Dojo',
    productionNotes: [
      'Weather layer (rain/wind) should subtly affect sound masking and mood.',
      'Patrol choreography must feel trained, not chaotic.',
      'Replay mastery unlock grants silent cloister route to sanctum threshold.'
    ]
  },
  {
    id: 'L09_BLACK_DOCKET',
    order: 9,
    title: 'Black Docket',
    district: 'Port Authority Fringe',
    buildingType: 'Customs Tribunal + Contraband Vault',
    tone: 'Bureaucratic maze over criminal infrastructure',
    objective: 'Expose ledger network and secure evidence package.',
    combatStyle: 'Room-clearing through document halls and fortified vault lines',
    traversalFeatures: ['File archive crawlspace', 'Evidence lift bypass', 'Detention loop'],
    criticalPath: ['Security Vestibule', 'Docket Floor', 'Evidence Chain', 'Vault Ring'],
    optionalSpaces: ['Holding Cells', 'Clerk Records Annex'],
    bossArena: 'Seized Goods Repository',
    productionNotes: [
      'Paper and signage should aid orientation in intentionally confusing geometry.',
      'Branching legal-office paths support stealth, social bluff, or forced combat.',
      'Replay unlock adds confiscation tunnel to vault perimeter.'
    ]
  },
  {
    id: 'L10_SUNDERED_LAB',
    order: 10,
    title: 'Sundered Lab',
    district: 'Research Coast',
    buildingType: 'Applied Biotech Campus',
    tone: 'Sterile precision collapsing into contamination panic',
    objective: 'Destroy synthesis run and capture lead scientist.',
    combatStyle: 'Hybrid close-quarters and long corridor denial',
    traversalFeatures: ['Airlock sequencing', 'Specimen corridor venting', 'Observation catwalk'],
    criticalPath: ['Campus Gate', 'Biosecure Hall', 'Test Wing', 'Synthesis Core'],
    optionalSpaces: ['Cryo Store', 'Data Clean Room'],
    bossArena: 'Containment Nexus',
    productionNotes: [
      'Containment states should reconfigure enemy composition and hazard placement.',
      'Visual storytelling via failed experiments and evacuation traces.',
      'Replay route unlock grants bypass through decon service spine.'
    ]
  },
  {
    id: 'L11_SKYCOURT',
    order: 11,
    title: 'Skycourt',
    district: 'Summit Ward',
    buildingType: 'Judicial Palace Above the City',
    tone: 'Grand monumental ascent toward elite confrontation',
    objective: 'Expose council conspiracy and survive tribunal guard.',
    combatStyle: 'Mixed ceremonial hall brawls and precision elite duels',
    traversalFeatures: ['Grand stair split', 'Chamber gallery arc', 'Roofline buttress path'],
    criticalPath: ['Pillared Plaza', 'Hall of Petitions', 'Tribunal Circuit', 'High Bench'],
    optionalSpaces: ['Clerk Archives', 'Herald Balcony'],
    bossArena: 'Judgment Chamber',
    productionNotes: [
      'Architecture must communicate power distance and final-act stakes.',
      'Encounter pacing should alternate between spectacle and intimate pressure.',
      'Replay unlock opens discreet advocate corridor to bypass first elite cluster.'
    ]
  },
  {
    id: 'L12_ASHEN_HEART',
    order: 12,
    title: 'Ashen Heart',
    district: 'Core Exclusion Zone',
    buildingType: 'Underground Command Citadel',
    tone: 'Final convergence: oppressive, tactical, relentless',
    objective: 'Break command chain and end the citywide operation.',
    combatStyle: 'Layered multi-phase gauntlet with deliberate respite windows',
    traversalFeatures: ['Blast-door sector loops', 'Command mezzanine descent', 'Emergency shaft skip'],
    criticalPath: ['Outer Bunker', 'Command Transit', 'War Room Ring', 'Heart Reactor'],
    optionalSpaces: ['Armory Lockup', 'Signal Crypt'],
    bossArena: 'Heart Reactor Amphitheater',
    productionNotes: [
      'Final level should pay off mechanics from all prior routes and states.',
      'Mid-level checkpoint must preserve narrative momentum without deflating tension.',
      'Mastery run unlock provides direct emergency shaft to final confrontation.'
    ]
  }
];

export function getStoryLevelByOrder(order) {
  return STORY_LEVELS.find((level) => level.order === order) ?? null;
}

export function getStoryLevelById(id) {
  return STORY_LEVELS.find((level) => level.id === id) ?? null;
}


const DEPLOY_LEVEL_ENRICHMENT = {
  L01_BROKEN_ENTRY: {
    spatialSignature: 'pinch_spine_mix',
    verticalLayers: ['ground', 'catwalk'],
    landmarkSet: ['Forklift Crown', 'Broken Gate Silhouette', 'Relay Cage Beacon'],
    threatLanes: { primary: 'Shipping Bay Spine', secondary: 'Service Hall Return', offAxis: 'Vent Flank' },
    stateMachines: ['alarm', 'power_shift', 'hazard_primed'],
    replayUnlockGraph: [{ from: 'clear_no_alarm', unlock: 'service_vent', to: 'replay_route_a' }]
  },
  L02_VELVET_CORRIDOR: { spatialSignature: 'atrium_pocket_mix', verticalLayers: ['ground', 'mezzanine'], landmarkSet: ['Neon Dance Bowl', 'VIP Stair Ribbon', 'Mirror Lounge Beacon'], threatLanes: { primary: 'Dance Floor Center', secondary: 'VIP Spine Stair', offAxis: 'Bar Wraparound' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'service_pass_found', unlock: 'booth_crawl_bypass', to: 'replay_route_b' }] },
  L03_HOLLOW_STACK: { spatialSignature: 'spine_vertical_maze', verticalLayers: ['ground', 'mezzanine', 'catwalk'], landmarkSet: ['Rotunda Core', 'Shelf Canyon Marker', 'Vault Beacon'], threatLanes: { primary: 'Records Spine', secondary: 'Reading Floor Balconies', offAxis: 'Archive Chute' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'stack_keychain_complete', unlock: 'third_sector_chute', to: 'replay_route_a' }] },
  L04_IRON_REFINERY: { spatialSignature: 'spine_pinch_mix', verticalLayers: ['ground', 'catwalk', 'pit'], landmarkSet: ['Furnace Mouth', 'Crane Arm Silhouette', 'Foundry Beacon'], threatLanes: { primary: 'Assembly Grid Main', secondary: 'Crane Bridge', offAxis: 'Slag Trench' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'shutdown_without_damage', unlock: 'insulated_tunnel', to: 'replay_route_b' }] },
  L05_GLASS_SPINE: { spatialSignature: 'atrium_spine_mix', verticalLayers: ['ground', 'mezzanine', 'catwalk'], landmarkSet: ['Skybridge Atrium', 'Escalator V', 'Helipad Beacon'], threatLanes: { primary: 'Reception Atrium Axis', secondary: 'Boarding Gallery Rail', offAxis: 'Facade Maintenance Rail' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'badge_reader_hack', unlock: 'executive_bypass', to: 'replay_route_a' }] },
  L06_DEEP_SWITCH: { spatialSignature: 'pinch_pocket_mix', verticalLayers: ['ground', 'pit'], landmarkSet: ['Breaker Halo', 'Trackside Marker', 'Switch Chamber Beacon'], threatLanes: { primary: 'Signal Tunnel Run', secondary: 'Power Hall Platforms', offAxis: 'Conduit Crawl' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'blackout_controlled_clear', unlock: 'dormant_commuter_tunnel', to: 'replay_route_b' }] },
  L07_CROWN_MERCY: { spatialSignature: 'spine_pocket_mix', verticalLayers: ['ground', 'mezzanine'], landmarkSet: ['Observation Theater Oculus', 'ICU Gate Marker', 'Recovery Beacon'], threatLanes: { primary: 'Ward Spine', secondary: 'Surgical Core Lanes', offAxis: 'Service Elevator Drop' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'low_damage_run', unlock: 'persistent_icu_gate', to: 'replay_route_a' }] },
  L08_RAIN_TEMPLE: { spatialSignature: 'atrium_courtyard_mix', verticalLayers: ['ground', 'mezzanine', 'catwalk'], landmarkSet: ['Prayer Court Canopy', 'Bell Tower Needle', 'Sanctum Beacon'], threatLanes: { primary: 'Inner Cloister Axis', secondary: 'Courtyard Perimeter', offAxis: 'Hidden Passage' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'silent_route_mastery', unlock: 'cloister_fastline', to: 'replay_route_b' }] },
  L09_BLACK_DOCKET: { spatialSignature: 'pocket_spine_mix', verticalLayers: ['ground', 'mezzanine'], landmarkSet: ['Ledger Gallery Wall', 'Detention Loop Marker', 'Vault Beacon'], threatLanes: { primary: 'Docket Floor Hall', secondary: 'Evidence Chain Lift', offAxis: 'Archive Crawlspace' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'evidence_integrity_bonus', unlock: 'confiscation_tunnel', to: 'replay_route_a' }] },
  L10_SUNDERED_LAB: { spatialSignature: 'spine_pinch_mix', verticalLayers: ['ground', 'catwalk'], landmarkSet: ['Containment Glass Spine', 'Airlock Beacon', 'Nexus Core Marker'], threatLanes: { primary: 'Biosecure Hall', secondary: 'Observation Catwalk', offAxis: 'Specimen Venting Route' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'decon_chain_completed', unlock: 'decon_service_spine', to: 'replay_route_b' }] },
  L11_SKYCOURT: { spatialSignature: 'atrium_spine_mix', verticalLayers: ['ground', 'mezzanine', 'catwalk'], landmarkSet: ['Grand Stair Fan', 'Tribunal Arc Marker', 'High Bench Beacon'], threatLanes: { primary: 'Hall of Petitions', secondary: 'Gallery Arc', offAxis: 'Advocate Corridor' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'advocate_seal_collected', unlock: 'discreet_corridor', to: 'replay_route_a' }] },
  L12_ASHEN_HEART: { spatialSignature: 'pinch_atrium_mix', verticalLayers: ['ground', 'mezzanine', 'pit'], landmarkSet: ['War Room Ring', 'Blast Door Teeth', 'Heart Reactor Beacon'], threatLanes: { primary: 'Command Transit', secondary: 'Mezzanine Loop', offAxis: 'Emergency Shaft' }, stateMachines: ['alarm', 'power_shift', 'hazard_primed'], replayUnlockGraph: [{ from: 'full_mastery_chain', unlock: 'final_shaft_skip', to: 'replay_route_final' }] }
};

const REQUIRED_LEVEL_KEYS = ['spatialSignature', 'verticalLayers', 'landmarkSet', 'threatLanes', 'stateMachines', 'replayUnlockGraph'];

export const DEPLOY_STORY_LEVELS = STORY_LEVELS.map((level) => ({ ...level, ...DEPLOY_LEVEL_ENRICHMENT[level.id] }));

export function validateDeployStoryLevels(levels = DEPLOY_STORY_LEVELS) {
  const errors = [];
  for (const level of levels) {
    for (const key of REQUIRED_LEVEL_KEYS) {
      if (level[key] == null || (Array.isArray(level[key]) && level[key].length === 0)) {
        errors.push(`${level.id}: missing required key ${key}`);
      }
    }
    if (level.threatLanes) {
      for (const lane of ['primary', 'secondary', 'offAxis']) {
        if (!level.threatLanes[lane]) errors.push(`${level.id}: threatLanes.${lane} is required`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
