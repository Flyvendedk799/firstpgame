// Per-building visual targets and shared character/viewmodel art rules.
//
// VISUAL_TARGETS holds grade + atmosphere data the renderer applies as the
// player traverses the campaign. LIGHTING_PROFILES expand each target with
// authored light rig + reflection + atmosphere parameters consumed by the
// procedural level dressing today and by authored asset loaders later.
// ENVIRONMENT_KITS describe the modular kit per building, prop density tier,
// and collision policy. CHARACTER_ART_BIBLE / PLAYER_VIEWMODEL_PROFILE are
// the shared rules every authored character/viewmodel must follow so the
// authored work stays compatible with gameplay hitboxes and weapon poses.

export const VISUAL_TARGETS = {
  1: {
    id: 'dock',
    label: 'Loading Dock',
    grade: { exposure: 1.08, contrast: 1.12, saturation: 0.96, warm: 0.14, cool: 0.08, vignette: 0.46, grain: 0.045 },
    atmosphere: { haze: 0.18, dust: 0.10, wetness: 0.70, accent: 0xff8040 },
    materials: ['wet concrete', 'painted steel', 'container enamel', 'oil grime', 'sodium work lights'],
    readability: 'Warm floor pools and orange edge lights preserve silhouettes through wet fog.'
  },
  2: {
    id: 'continental',
    label: 'Continental Lobby',
    grade: { exposure: 1.12, contrast: 1.04, saturation: 0.94, warm: 0.24, cool: 0.02, vignette: 0.36, grain: 0.028 },
    atmosphere: { haze: 0.10, dust: 0.04, wetness: 0.04, accent: 0xd4b06a },
    materials: ['polished stone', 'brass', 'dark walnut', 'carpet', 'warm glass'],
    readability: 'Gold trim stays low intensity so enemies read against the lobby warmth.'
  },
  3: {
    id: 'nightclub',
    label: 'Nightclub',
    grade: { exposure: 1.00, contrast: 1.22, saturation: 1.22, warm: 0.02, cool: 0.30, vignette: 0.52, grain: 0.055 },
    atmosphere: { haze: 0.36, dust: 0.16, wetness: 0.12, accent: 0xff40c8 },
    materials: ['black acrylic', 'mirror glass', 'emissive tile', 'rubber floor', 'smoke haze'],
    readability: 'Magenta/cyan accents frame lanes while enemy visors remain hotter than scenery.'
  },
  4: {
    id: 'penthouse',
    label: 'Penthouse',
    grade: { exposure: 1.18, contrast: 1.10, saturation: 0.98, warm: 0.10, cool: 0.16, vignette: 0.34, grain: 0.025 },
    atmosphere: { haze: 0.12, dust: 0.03, wetness: 0.02, accent: 0xffd060 },
    materials: ['reinforced glass', 'brushed steel', 'black marble', 'leather', 'skyline reflections'],
    readability: 'Cool skyline backlight separates heads and weapons from luxury materials.'
  },
  5: {
    id: 'medical',
    label: 'Sterling Medical',
    grade: { exposure: 1.06, contrast: 1.18, saturation: 0.86, warm: 0.00, cool: 0.24, vignette: 0.48, grain: 0.04 },
    atmosphere: { haze: 0.20, dust: 0.06, wetness: 0.16, accent: 0x40ff80 },
    materials: ['ceramic tile', 'surgical steel', 'frosted glass', 'plastic curtain', 'emergency LEDs'],
    readability: 'Green medical accents are reserved for navigation; enemies use red/orange/cyan class marks.'
  },
  6: {
    id: 'subway',
    label: 'Subway Line 7',
    grade: { exposure: 0.98, contrast: 1.24, saturation: 0.84, warm: 0.04, cool: 0.18, vignette: 0.58, grain: 0.06 },
    atmosphere: { haze: 0.30, dust: 0.28, wetness: 0.24, accent: 0xff5040 },
    materials: ['dirty concrete', 'rail steel', 'rubber cable', 'warning paint', 'red emergency haze'],
    readability: 'Red emergency bands stay peripheral; center-lane targets keep bright visor contrast.'
  },
  7: {
    id: 'yacht',
    label: 'Azure Yacht',
    grade: { exposure: 1.15, contrast: 1.06, saturation: 0.98, warm: 0.10, cool: 0.26, vignette: 0.38, grain: 0.03 },
    atmosphere: { haze: 0.24, dust: 0.02, wetness: 0.38, accent: 0xa0c8ff },
    materials: ['teak', 'chrome', 'marine glass', 'white leather', 'ocean mist'],
    readability: 'Moon-blue rim light gives clear shoulders and weapon outlines on the narrow deck.'
  },
  8: {
    id: 'server',
    label: 'Server Farm Delta',
    grade: { exposure: 1.02, contrast: 1.20, saturation: 0.92, warm: 0.00, cool: 0.34, vignette: 0.50, grain: 0.038 },
    atmosphere: { haze: 0.28, dust: 0.05, wetness: 0.00, accent: 0x40e0ff },
    materials: ['black rack metal', 'fiber glass', 'rubber cable', 'raised floor', 'cold vapor'],
    readability: 'Cyan environment glow is broad and soft; enemy weak points stay small and saturated.'
  },
  9: {
    id: 'border',
    label: 'Border Crossing',
    grade: { exposure: 1.10, contrast: 1.16, saturation: 0.90, warm: 0.30, cool: 0.02, vignette: 0.50, grain: 0.052 },
    atmosphere: { haze: 0.34, dust: 0.32, wetness: 0.00, accent: 0xffb060 },
    materials: ['sun-baked concrete', 'sandstone', 'corrugated customs steel', 'dust film', 'amber sodium lamps'],
    readability: 'Warm dust stays low and broad; cool visor and scope accents stay readable along the long axis.'
  },
  10: {
    id: 'cathedral',
    label: 'Cathedral of San Marco',
    grade: { exposure: 1.04, contrast: 1.22, saturation: 0.88, warm: 0.28, cool: 0.08, vignette: 0.62, grain: 0.045 },
    atmosphere: { haze: 0.24, dust: 0.12, wetness: 0.02, accent: 0xffe8b0 },
    materials: ['black marble', 'carved stone', 'stained glass', 'votive brass', 'wax smoke'],
    readability: 'Candle pools sit near cover edges while stained-glass color stays above the fight line.'
  },
  11: {
    id: 'freighter',
    label: 'Karelia Freighter',
    grade: { exposure: 1.02, contrast: 1.18, saturation: 0.82, warm: 0.04, cool: 0.28, vignette: 0.54, grain: 0.058 },
    atmosphere: { haze: 0.26, dust: 0.06, wetness: 0.48, accent: 0x6890b8 },
    materials: ['salted deck steel', 'container enamel', 'wet railings', 'engine grease', 'storm glass'],
    readability: 'Blue-gray mist frames bodies; warning stripes and muzzle flashes remain the highest warm notes.'
  },
  12: {
    id: 'spire',
    label: 'The Spire',
    grade: { exposure: 1.16, contrast: 1.16, saturation: 0.96, warm: 0.04, cool: 0.28, vignette: 0.42, grain: 0.030 },
    atmosphere: { haze: 0.18, dust: 0.03, wetness: 0.10, accent: 0xc8e0ff },
    materials: ['midnight glass', 'black marble', 'brushed chrome', 'helipad paint', 'executive carbon panels'],
    readability: 'Chrome and glass are kept broad and low contrast so heads, visors, and weak points remain clean.'
  }
};

// ── Per-building lighting / reflection / atmosphere authored data ──────────
// Each profile lists the lights, reflection sources, and atmospheric emitters
// the level should compose at high quality. The procedural dressing reads
// these as targets; authored content can swap the same fields in.
export const LIGHTING_PROFILES = {
  dock: {
    ambient: { color: 0x223040, intensity: 0.35 },
    hemisphere: { sky: 0xff8040, ground: 0x142028, intensity: 0.36 },
    key: { color: 0xff8040, intensity: 0.95, position: [6, 7.5, 4], castShadow: true },
    fill: { color: 0x335060, intensity: 0.45, position: [-6, 6, -4] },
    rim: { color: 0xff5020, intensity: 0.55, position: [0, 4, -10] },
    locals: [
      { kind: 'point', color: 0xff7030, intensity: 1.6, distance: 14, decay: 1.4 },
      { kind: 'spot', color: 0xfff0c0, intensity: 1.2, angle: 0.6, penumbra: 0.3, distance: 16 }
    ],
    emissiveIntensity: 1.4,
    fog: { color: 0x101820, density: 0.025 },
    shadowBudget: 6,
    reflection: { type: 'wet-floor', strength: 0.7, decayMs: 600 },
    atmosphere: { rain: 0.6, mist: 0.4, dust: 0.10 }
  },
  continental: {
    ambient: { color: 0x402c1a, intensity: 0.36 },
    hemisphere: { sky: 0xf2c98a, ground: 0x2a1810, intensity: 0.42 },
    key: { color: 0xfff0c0, intensity: 0.95, position: [4, 6, 6], castShadow: true },
    fill: { color: 0xc89060, intensity: 0.50, position: [-5, 5, -2] },
    rim: { color: 0xffe080, intensity: 0.35, position: [0, 4, -8] },
    locals: [
      { kind: 'point', color: 0xffd070, intensity: 1.4, distance: 12, decay: 1.6 },
      { kind: 'spot', color: 0xffe8a0, intensity: 1.1, angle: 0.55, penumbra: 0.35, distance: 18 }
    ],
    emissiveIntensity: 1.0,
    fog: { color: 0x261a10, density: 0.014 },
    shadowBudget: 8,
    reflection: { type: 'marble-floor', strength: 0.45, decayMs: 900 },
    atmosphere: { warmHaze: 0.10, dust: 0.05 }
  },
  nightclub: {
    ambient: { color: 0x110820, intensity: 0.30 },
    hemisphere: { sky: 0x6020ff, ground: 0x080414, intensity: 0.30 },
    key: { color: 0xff40c8, intensity: 1.10, position: [3, 6, 5], castShadow: true },
    fill: { color: 0x4080ff, intensity: 0.55, position: [-4, 5, -3] },
    rim: { color: 0x00f0ff, intensity: 0.70, position: [0, 5, -10] },
    locals: [
      { kind: 'point', color: 0xff40c8, intensity: 1.8, distance: 10, decay: 1.8 },
      { kind: 'point', color: 0x40c8ff, intensity: 1.6, distance: 10, decay: 1.8 },
      { kind: 'spot', color: 0xffffff, intensity: 1.5, angle: 0.4, penumbra: 0.6, distance: 14 }
    ],
    emissiveIntensity: 1.6,
    fog: { color: 0x110820, density: 0.035 },
    shadowBudget: 4,
    reflection: { type: 'mirror-panel', strength: 0.85, decayMs: 400 },
    atmosphere: { smoke: 0.45, strobe: 0.6, dust: 0.18 }
  },
  penthouse: {
    ambient: { color: 0x2030d0, intensity: 0.30 },
    hemisphere: { sky: 0x6090e0, ground: 0x1a1a26, intensity: 0.34 },
    key: { color: 0xffe0a0, intensity: 0.90, position: [6, 8, 6], castShadow: true },
    fill: { color: 0x80a0d0, intensity: 0.55, position: [-6, 6, -4] },
    rim: { color: 0xc8e0ff, intensity: 0.55, position: [0, 5, -10] },
    locals: [
      { kind: 'spot', color: 0xfff0a0, intensity: 1.2, angle: 0.5, penumbra: 0.35, distance: 14 },
      { kind: 'point', color: 0x80a0ff, intensity: 1.1, distance: 12, decay: 1.4 }
    ],
    emissiveIntensity: 1.0,
    fog: { color: 0x1a1a26, density: 0.012 },
    shadowBudget: 10,
    reflection: { type: 'skyline', strength: 1.0, decayMs: 1200 },
    atmosphere: { highWindow: 0.4, dust: 0.04 }
  },
  medical: {
    ambient: { color: 0x305060, intensity: 0.36 },
    hemisphere: { sky: 0xc8f0ff, ground: 0x10202c, intensity: 0.38 },
    key: { color: 0xffffff, intensity: 1.0, position: [4, 7, 4], castShadow: true },
    fill: { color: 0x40ff80, intensity: 0.45, position: [-4, 5, -3] },
    rim: { color: 0xa0c8ff, intensity: 0.40, position: [0, 4, -8] },
    locals: [
      { kind: 'point', color: 0xa0ffc0, intensity: 1.4, distance: 12, decay: 1.6 },
      { kind: 'spot', color: 0xffffff, intensity: 1.2, angle: 0.6, penumbra: 0.5, distance: 15 }
    ],
    emissiveIntensity: 1.2,
    fog: { color: 0x101820, density: 0.022 },
    shadowBudget: 6,
    reflection: { type: 'ceramic', strength: 0.55, decayMs: 700 },
    atmosphere: { blackoutHaze: 0.25, antiseptic: 0.30, dust: 0.06 }
  },
  subway: {
    ambient: { color: 0x301010, intensity: 0.32 },
    hemisphere: { sky: 0xff5040, ground: 0x100808, intensity: 0.32 },
    key: { color: 0xffe080, intensity: 0.85, position: [5, 6, 4], castShadow: true },
    fill: { color: 0xff8040, intensity: 0.50, position: [-5, 5, -3] },
    rim: { color: 0xff3030, intensity: 0.70, position: [0, 4, -9] },
    locals: [
      { kind: 'point', color: 0xff5040, intensity: 1.4, distance: 12, decay: 1.6 },
      { kind: 'spot', color: 0xffffff, intensity: 1.2, angle: 0.55, penumbra: 0.4, distance: 14 }
    ],
    emissiveIntensity: 1.2,
    fog: { color: 0x180808, density: 0.030 },
    shadowBudget: 5,
    reflection: { type: 'wet-tile', strength: 0.6, decayMs: 700 },
    atmosphere: { redHaze: 0.5, dust: 0.30 }
  },
  yacht: {
    ambient: { color: 0x102038, intensity: 0.36 },
    hemisphere: { sky: 0x80a0e0, ground: 0x081018, intensity: 0.40 },
    key: { color: 0xa0c8ff, intensity: 0.95, position: [4, 7, 4], castShadow: true },
    fill: { color: 0xfff0c0, intensity: 0.45, position: [-3, 5, -2] },
    rim: { color: 0xc0d8ff, intensity: 0.55, position: [0, 5, -10] },
    locals: [
      { kind: 'spot', color: 0xfff0c0, intensity: 1.2, angle: 0.55, penumbra: 0.4, distance: 14 },
      { kind: 'point', color: 0x80a0ff, intensity: 1.0, distance: 10, decay: 1.4 }
    ],
    emissiveIntensity: 1.0,
    fog: { color: 0x10202c, density: 0.018 },
    shadowBudget: 8,
    reflection: { type: 'water', strength: 0.85, decayMs: 900 },
    atmosphere: { oceanMist: 0.55, moonlight: 0.7 }
  },
  server: {
    ambient: { color: 0x102030, intensity: 0.32 },
    hemisphere: { sky: 0x40c0ff, ground: 0x040810, intensity: 0.34 },
    key: { color: 0xc0e0ff, intensity: 0.85, position: [4, 6, 4], castShadow: true },
    fill: { color: 0x40c0ff, intensity: 0.50, position: [-4, 5, -3] },
    rim: { color: 0x80f0ff, intensity: 0.55, position: [0, 5, -10] },
    locals: [
      { kind: 'point', color: 0x40e0ff, intensity: 1.5, distance: 12, decay: 1.4 },
      { kind: 'spot', color: 0xc0f0ff, intensity: 1.0, angle: 0.6, penumbra: 0.5, distance: 14 }
    ],
    emissiveIntensity: 1.3,
    fog: { color: 0x081018, density: 0.028 },
    shadowBudget: 5,
    reflection: { type: 'rack-glass', strength: 0.55, decayMs: 700 },
    atmosphere: { coldVapor: 0.4, dust: 0.05 }
  },
  border: {
    ambient: { color: 0x402008, intensity: 0.34 },
    hemisphere: { sky: 0xffb060, ground: 0x281408, intensity: 0.42 },
    key: { color: 0xffe080, intensity: 1.0, position: [6, 7.5, 5], castShadow: true },
    fill: { color: 0xc06030, intensity: 0.45, position: [-5, 5, -3] },
    rim: { color: 0xff8040, intensity: 0.55, position: [0, 4, -10] },
    locals: [
      { kind: 'point', color: 0xff9040, intensity: 1.4, distance: 14, decay: 1.6 },
      { kind: 'spot', color: 0xfff0a0, intensity: 1.1, angle: 0.5, penumbra: 0.4, distance: 16 }
    ],
    emissiveIntensity: 1.1,
    fog: { color: 0x301810, density: 0.034 },
    shadowBudget: 5,
    reflection: { type: 'dust', strength: 0.30, decayMs: 600 },
    atmosphere: { sandstorm: 0.45, dust: 0.6 }
  },
  cathedral: {
    ambient: { color: 0x301810, intensity: 0.32 },
    hemisphere: { sky: 0xffe8a0, ground: 0x100808, intensity: 0.40 },
    key: { color: 0xfff0b0, intensity: 0.90, position: [4, 8, 5], castShadow: true },
    fill: { color: 0xc8a070, intensity: 0.45, position: [-5, 6, -2] },
    rim: { color: 0xffe080, intensity: 0.40, position: [0, 6, -10] },
    locals: [
      { kind: 'point', color: 0xffe080, intensity: 1.5, distance: 12, decay: 1.4 },
      { kind: 'spot', color: 0xc8e0ff, intensity: 0.9, angle: 0.7, penumbra: 0.4, distance: 16 }
    ],
    emissiveIntensity: 1.0,
    fog: { color: 0x180808, density: 0.020 },
    shadowBudget: 7,
    reflection: { type: 'marble-floor', strength: 0.50, decayMs: 1100 },
    atmosphere: { incense: 0.40, dust: 0.20 }
  },
  freighter: {
    ambient: { color: 0x102028, intensity: 0.34 },
    hemisphere: { sky: 0x80a0c0, ground: 0x081018, intensity: 0.36 },
    key: { color: 0xffe080, intensity: 0.85, position: [4, 7, 5], castShadow: true },
    fill: { color: 0x6080a0, intensity: 0.50, position: [-5, 5, -3] },
    rim: { color: 0xa0c0e0, intensity: 0.55, position: [0, 5, -10] },
    locals: [
      { kind: 'point', color: 0xc0d8ff, intensity: 1.1, distance: 12, decay: 1.4 },
      { kind: 'spot', color: 0xffe080, intensity: 1.1, angle: 0.55, penumbra: 0.45, distance: 14 }
    ],
    emissiveIntensity: 1.0,
    fog: { color: 0x101820, density: 0.028 },
    shadowBudget: 6,
    reflection: { type: 'wet-deck', strength: 0.7, decayMs: 800 },
    atmosphere: { stormMist: 0.55, dust: 0.10 }
  },
  spire: {
    ambient: { color: 0x101830, intensity: 0.30 },
    hemisphere: { sky: 0x6090e0, ground: 0x080814, intensity: 0.32 },
    key: { color: 0xffe080, intensity: 0.90, position: [6, 9, 5], castShadow: true },
    fill: { color: 0x80a0d0, intensity: 0.55, position: [-6, 7, -4] },
    rim: { color: 0xc0e0ff, intensity: 0.65, position: [0, 6, -10] },
    locals: [
      { kind: 'spot', color: 0xfff0a0, intensity: 1.4, angle: 0.45, penumbra: 0.35, distance: 14 },
      { kind: 'point', color: 0x80c0ff, intensity: 1.0, distance: 12, decay: 1.3 }
    ],
    emissiveIntensity: 0.9,
    fog: { color: 0x101830, density: 0.012 },
    shadowBudget: 12,
    reflection: { type: 'skyline', strength: 1.0, decayMs: 1300 },
    atmosphere: { rooftopWind: 0.35, dust: 0.05 }
  }
};

// Modular environment kits — list every authored module slot per building
// and the prop density policy the level designer should hit. The current
// procedural dressing already populates near/mid/far prop layers; authored
// kits drop in by category here.
export const ENVIRONMENT_KITS = {
  dock: {
    building: 1,
    label: 'Loading Dock',
    modules: {
      wallPanel: ['rusted-steel', 'painted-corrugated', 'shipping-crate'],
      floorPanel: ['wet-concrete', 'steel-grate', 'painted-line'],
      ceilingPanel: ['truss', 'pipe-run', 'sodium-fixture'],
      door: ['rollup', 'pedestrian-steel'],
      window: ['safety-glass-square'],
      vent: ['ventGrate'],
      pipe: ['heat-pipe', 'cold-pipe', 'cable-tray'],
      prop: ['shipping-container', 'forklift', 'crate-stack', 'pallet', 'barrel'],
      signage: ['warning', 'cargo-id'],
      lightCard: ['sodium-pool'],
      emissiveFixture: ['shop-lamp', 'mounted-spot']
    },
    density: { near: 14, mid: 22, far: 36 },
    collisionPolicy: 'decorative-only',
    propBudget: 240,
    decalBudget: 96,
    notes: 'Sodium pools every ~6m. Crates fill cover lines. Wet floor pools propagate reflection.'
  },
  continental: {
    building: 2,
    label: 'Continental Lobby',
    modules: {
      wallPanel: ['walnut-panel', 'brass-trim', 'silk-wallpaper'],
      floorPanel: ['marble-tile', 'inlay-brass', 'lobby-rug'],
      ceilingPanel: ['coffered', 'crystal-chandelier-base', 'recessed-warm'],
      door: ['concierge-double', 'service-single'],
      window: ['velvet-curtain-window'],
      pipe: [],
      prop: ['concierge-desk', 'lounge-chair', 'baggage-cart', 'side-table', 'art-piece'],
      signage: ['concierge-plaque'],
      lightCard: ['warm-pool'],
      emissiveFixture: ['chandelier', 'wall-sconce']
    },
    density: { near: 12, mid: 18, far: 26 },
    collisionPolicy: 'decorative-only',
    propBudget: 220,
    decalBudget: 64
  },
  nightclub: {
    building: 3,
    label: 'Nightclub',
    modules: {
      wallPanel: ['acrylic-black', 'mirror-panel', 'emissive-tile'],
      floorPanel: ['emissive-tile', 'rubber-mat', 'spill-streak'],
      ceilingPanel: ['drop-tile', 'truss-grid', 'rig-lighting'],
      door: ['vip-rope', 'service-hatch'],
      vent: ['ducting'],
      prop: ['booth', 'dj-cabinet', 'bar-stack', 'amplifier-rack', 'plinth'],
      signage: ['vip-light-box', 'exit-arrow'],
      lightCard: ['magenta-strip', 'cyan-strip'],
      emissiveFixture: ['strobe-bar', 'led-rig', 'underlit-floor']
    },
    density: { near: 18, mid: 26, far: 42 },
    collisionPolicy: 'decorative-only',
    propBudget: 280,
    decalBudget: 132,
    notes: 'Strobes and emissive floor define the lane. Smoke layer thickens at midfield.'
  },
  penthouse: {
    building: 4,
    label: 'Penthouse',
    modules: {
      wallPanel: ['glass-rail', 'walnut-veneer', 'matte-stone'],
      floorPanel: ['black-marble', 'walnut-plank', 'rug-luxury'],
      ceilingPanel: ['recessed-cove', 'beam-warm', 'skylight'],
      door: ['glass-pivot', 'concealed-panel'],
      window: ['floor-to-ceiling-skyline'],
      prop: ['suite-sofa', 'cocktail-trolley', 'art-sculpture', 'glass-shelving', 'plant'],
      signage: ['service-strip'],
      lightCard: ['city-bounce', 'warm-cove'],
      emissiveFixture: ['cove-warm', 'pendant-amber']
    },
    density: { near: 10, mid: 16, far: 22 },
    collisionPolicy: 'decorative-only',
    propBudget: 200,
    decalBudget: 60
  },
  medical: {
    building: 5,
    label: 'Sterling Medical',
    modules: {
      wallPanel: ['ceramic-tile', 'sterile-paint', 'glass-curtain'],
      floorPanel: ['polished-tile', 'rubber-strip', 'biohazard-stripe'],
      ceilingPanel: ['ceiling-cassette', 'recessed-cool'],
      door: ['surgical-slider', 'pedestrian-emergency'],
      window: ['observation-glass', 'frosted-strip'],
      prop: ['gurney', 'crash-cart', 'iv-stand', 'monitor-station', 'cabinet-glass'],
      signage: ['ward-id', 'biohazard'],
      lightCard: ['surgical-pool'],
      emissiveFixture: ['surgical-light', 'emergency-strobe']
    },
    density: { near: 14, mid: 20, far: 30 },
    collisionPolicy: 'decorative-only',
    propBudget: 240,
    decalBudget: 88
  },
  subway: {
    building: 6,
    label: 'Subway Line 7',
    modules: {
      wallPanel: ['dirty-tile', 'concrete-warning', 'mesh-cage'],
      floorPanel: ['platform-stripe', 'wet-tile', 'rail-bed'],
      ceilingPanel: ['concrete-girder', 'cable-tray', 'fluorescent-strip'],
      door: ['transit-slider', 'service-locker'],
      window: ['shutter-panel'],
      pipe: ['cable-bundle', 'water-main'],
      prop: ['turnstile', 'station-bench', 'kiosk', 'rail-car', 'fire-cabinet'],
      signage: ['station-marker', 'warning-stripe'],
      lightCard: ['red-haze', 'platform-pool'],
      emissiveFixture: ['emergency-red', 'fluorescent-tube']
    },
    density: { near: 16, mid: 24, far: 32 },
    collisionPolicy: 'decorative-only',
    propBudget: 260,
    decalBudget: 96,
    notes: 'Red emergency band stays peripheral; warning stripes hug platforms.'
  },
  yacht: {
    building: 7,
    label: 'Azure Yacht',
    modules: {
      wallPanel: ['teak-board', 'chrome-trim', 'marine-glass'],
      floorPanel: ['teak-deck', 'rubber-strip'],
      ceilingPanel: ['cabin-cove', 'spar-light'],
      door: ['marine-hatch', 'glass-slider'],
      window: ['sea-view-glass'],
      prop: ['captain-chair', 'lounge-couch', 'rail', 'davit', 'tender'],
      signage: ['marine-id'],
      lightCard: ['moon-pool'],
      emissiveFixture: ['mast-light', 'cabin-amber']
    },
    density: { near: 10, mid: 16, far: 22 },
    collisionPolicy: 'decorative-only',
    propBudget: 200,
    decalBudget: 56
  },
  server: {
    building: 8,
    label: 'Server Farm Delta',
    modules: {
      wallPanel: ['rack-cage', 'cable-channel', 'fiber-bundle'],
      floorPanel: ['raised-tile', 'ground-grate'],
      ceilingPanel: ['cable-mesh', 'cold-aisle-vent'],
      door: ['secure-slider', 'service-hatch'],
      window: ['observation-panel'],
      pipe: ['coolant-pipe', 'fiber-trunk'],
      prop: ['server-rack', 'PDU', 'battery-bank', 'console-podium', 'cable-loom'],
      signage: ['rack-id', 'biohazard-coolant'],
      lightCard: ['cyan-rack-glow'],
      emissiveFixture: ['rack-led', 'cold-aisle-strip']
    },
    density: { near: 18, mid: 24, far: 36 },
    collisionPolicy: 'decorative-only',
    propBudget: 280,
    decalBudget: 80
  },
  border: {
    building: 9,
    label: 'Border Crossing',
    modules: {
      wallPanel: ['sun-bleached-concrete', 'corrugated-sand', 'sandstone'],
      floorPanel: ['cracked-asphalt', 'sand-drift'],
      ceilingPanel: ['steel-canopy', 'cable-tray-rust'],
      door: ['customs-roll', 'pedestrian-checkpoint'],
      window: ['barred-glass', 'security-panel'],
      prop: ['barrier', 'sandbag', 'transport-truck', 'customs-cart', 'flag'],
      signage: ['customs-warning', 'lane-id'],
      lightCard: ['sodium-pool', 'dust-shaft'],
      emissiveFixture: ['floodlight', 'beacon']
    },
    density: { near: 14, mid: 20, far: 30 },
    collisionPolicy: 'decorative-only',
    propBudget: 240,
    decalBudget: 88
  },
  cathedral: {
    building: 10,
    label: 'Cathedral of San Marco',
    modules: {
      wallPanel: ['carved-stone', 'marble-block', 'fresco-panel'],
      floorPanel: ['stone-mosaic', 'marble-runner'],
      ceilingPanel: ['vaulted-arch', 'beam-aged'],
      door: ['cathedral-double', 'crypt-iron'],
      window: ['stained-glass'],
      prop: ['altar', 'pew', 'votive-stand', 'sculpture', 'tomb'],
      signage: ['plaque'],
      lightCard: ['candle-pool'],
      emissiveFixture: ['stained-glass-window', 'candle-rack']
    },
    density: { near: 12, mid: 18, far: 28 },
    collisionPolicy: 'decorative-only',
    propBudget: 220,
    decalBudget: 64
  },
  freighter: {
    building: 11,
    label: 'Karelia Freighter',
    modules: {
      wallPanel: ['salt-deck-steel', 'container-enamel', 'mesh-walk'],
      floorPanel: ['painted-deck', 'rubber-strip'],
      ceilingPanel: ['steel-girder', 'cable-run'],
      door: ['watertight', 'hatchway'],
      window: ['storm-glass', 'porthole'],
      pipe: ['fuel-pipe', 'steam-pipe'],
      prop: ['cargo-crate', 'lifeboat', 'winch', 'forecastle', 'engine-room'],
      signage: ['hatch-id', 'warning-stripe'],
      lightCard: ['mast-pool', 'wet-deck-shine'],
      emissiveFixture: ['floodlight', 'mast-amber']
    },
    density: { near: 12, mid: 20, far: 30 },
    collisionPolicy: 'decorative-only',
    propBudget: 240,
    decalBudget: 80
  },
  spire: {
    building: 12,
    label: 'The Spire',
    modules: {
      wallPanel: ['midnight-glass', 'brushed-chrome', 'black-marble'],
      floorPanel: ['polished-marble', 'helipad-stripe'],
      ceilingPanel: ['recessed-cove', 'beam-cool', 'skylight'],
      door: ['executive-slider', 'helipad-rollup'],
      window: ['floor-to-ceiling-sky', 'sky-port'],
      prop: ['executive-desk', 'lounge', 'sculpture', 'helipad-marker', 'console'],
      signage: ['floor-id', 'rooftop-marker'],
      lightCard: ['city-bounce', 'rooftop-cool'],
      emissiveFixture: ['cove-cool', 'helipad-strip']
    },
    density: { near: 10, mid: 18, far: 24 },
    collisionPolicy: 'decorative-only',
    propBudget: 220,
    decalBudget: 60
  }
};

// ── Character art bible ─────────────────────────────────────────────────────
// Production rules every authored enemy must honour. Hitboxes remain the
// gameplay authority — visual shells overlay them.
export const CHARACTER_ART_BIBLE = {
  sharedSkeleton: ['root', 'spine', 'neck', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'weapon'],
  proportions: {
    heightMeters: 1.78,
    headToBodyRatio: 0.135,
    shoulderWidthMeters: 0.62,
    competitiveRule: 'hitbox meshes stay authoritative; rounded shells are visual overlays only.'
  },
  archetypes: {
    soldier: { label: 'Soldier', silhouette: 'medium rifle profile', accent: 0xff3030, weapon: 'rifle', armorZones: ['chestPlate', 'shoulderPlate', 'helmet'], weakPoints: ['head', 'leftKnee'], damageOverlays: ['blood', 'grime'] },
    scout: { label: 'Scout', silhouette: 'slim hooded sprinter', accent: 0x40ff80, weapon: 'smg', armorZones: ['chestLight'], weakPoints: ['head', 'backpack'], damageOverlays: ['blood', 'dust'] },
    sniper: { label: 'Sniper', silhouette: 'ghillie veil and long suppressed rifle', accent: 0x40a0ff, weapon: 'marksman', armorZones: ['ghillie'], weakPoints: ['head', 'optic'], damageOverlays: ['blood', 'grime'] },
    marksman: { label: 'Marksman', silhouette: 'long weapon and head optic', accent: 0xa0c8ff, weapon: 'marksman', armorZones: ['chestPlate', 'helmet'], weakPoints: ['head', 'optic'], damageOverlays: ['blood', 'grime'] },
    riot: { label: 'Riot', silhouette: 'wide armor and face shield', accent: 0xff5040, weapon: 'shotgun', armorZones: ['shield', 'chestHeavy', 'visor'], weakPoints: ['legs', 'visorRim'], damageOverlays: ['blood', 'scorch'] },
    heavy: { label: 'Heavy', silhouette: 'broad armored torso and LMG', accent: 0xff7020, weapon: 'heavy', armorZones: ['chestHeavy', 'shoulderPlate', 'helmet'], weakPoints: ['ammoBox', 'visor'], damageOverlays: ['blood', 'scorch'] },
    demolitions: { label: 'Demolitions', silhouette: 'bandolier and backpack charges', accent: 0xff8040, weapon: 'shotgun', armorZones: ['bandolier', 'backpack'], weakPoints: ['head', 'backpack'], damageOverlays: ['blood', 'scorch'] },
    pistolero: { label: 'Pistolero', silhouette: 'coat and dual compact pistols', accent: 0xa040ff, weapon: 'pistol', armorZones: ['coatLining'], weakPoints: ['head', 'coatGap'], damageOverlays: ['blood'] },
    drone: { label: 'Drone Operator', silhouette: 'small airborne tech threat', accent: 0x40c8ff, weapon: 'drone-projectile', armorZones: ['shell'], weakPoints: ['eye', 'rotor'], damageOverlays: ['scorch', 'sparks'] },
    lieutenant: { label: 'Lieutenant', silhouette: 'ranked suit and armband', accent: 0xffd060, weapon: 'rifle', armorZones: ['suitInsignia', 'helmet'], weakPoints: ['head', 'armband'], damageOverlays: ['blood', 'grime'] },
    boss: { label: 'Boss', silhouette: 'tailored coat, gold trim, phase gear', accent: 0xffd040, weapon: 'pistol', armorZones: ['coat', 'goldTrim', 'phaseGear'], weakPoints: ['head', 'phaseGap'], damageOverlays: ['blood', 'phaseFracture'] }
  },
  readabilityRules: [
    'class accent must be visible at combat distance',
    'head orientation must remain readable in fog and bloom',
    'visual shells must never move away from hitboxes',
    'weapon pose must communicate attack intent before firing',
    'every authored animation must keep the head hitbox aligned to the visible head'
  ],
  damageOverlayPolicy: {
    blood: 'paints to visible body zone; never crosses to armor plate; persists through death.',
    grime: 'accumulates during combat; cleared on respawn; visible in scope PIP.',
    scorch: 'reserved for explosion / fire damage; flashes orange at impact.',
    sparks: 'short-lived; only on droid/armor hits.',
    phaseFracture: 'boss only; pulses with phase tell timing.'
  }
};

// ── Player viewmodel + full-body proxy ──────────────────────────────────────
export const PLAYER_VIEWMODEL_PROFILE = {
  id: 'operative-viewmodel',
  label: 'Operative First Person Body',
  skeleton: ['cameraRoot', 'rightClavicle', 'rightForearm', 'rightWrist', 'rightHand', 'leftForearm', 'leftWrist', 'leftHand', 'weaponSocket'],
  materials: {
    skin: 'warm bare hands and forearms with subtle roughness',
    glove: 'minimal palm/finger contact shading, not full tactical gloves',
    sleeve: 'bare forearm geometry; black wrist computer stays as the main accessory',
    armor: 'low-profile dark wrist hardware and tiny contact accents only'
  },
  rules: [
    'hands must support every weapon without blocking the aim point',
    'right index animation stays independent for trigger readability',
    'support hand must remain visible on two-handed weapons and the wrist UI',
    'viewmodel shells are visual-only children of existing animated controls'
  ],
  weaponGripOffsets: {
    pistol: { left: [-0.06, -0.02, -0.10], right: [0.02, -0.02, -0.04] },
    rifle: { left: [-0.10, -0.04, -0.22], right: [0.02, -0.02, -0.04] },
    shotgun: { left: [-0.12, -0.04, -0.22], right: [0.02, -0.02, -0.04] },
    smg: { left: [-0.08, -0.04, -0.18], right: [0.02, -0.02, -0.04] },
    marksman: { left: [-0.14, -0.04, -0.28], right: [0.02, -0.02, -0.04] },
    heavy: { left: [-0.16, -0.06, -0.26], right: [0.04, -0.02, -0.04] },
    knife: { left: null, right: [0.02, -0.02, -0.04] }
  }
};

// Full-body proxy for shadows, reflections, and death cam.
export const PLAYER_PROXY_PROFILE = {
  id: 'operative-proxy',
  label: 'Operative Full-Body Proxy',
  skeleton: ['root', 'pelvis', 'spine', 'chest', 'neck', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'],
  shadowPolicy: 'always cast on key, fill, and rim lights; never visible in first-person camera unless deathCam',
  reflectionPolicy: 'visible in mirror panels, glass facades, marble floors',
  collisionPolicy: 'no collision; the player capsule handles all movement collision'
};

// ── Animation state machines ────────────────────────────────────────────────
// Each authored animation set must implement these transitions. The
// procedural rig already follows the same names so authored content swaps in
// without changing main.js call-sites.
export const ENEMY_STATE_MACHINE = {
  layers: ['locomotion', 'upperBodyAim', 'hitReactionAdditive', 'deathOverride', 'bossPhase'],
  locomotion: {
    states: ['idle', 'patrol', 'alert', 'sprint', 'strafeLeft', 'strafeRight', 'crouch'],
    transitions: {
      'idle->patrol': { trigger: 'alertLevel<0.3 && hasPath' },
      'idle->alert': { trigger: 'alertLevel>=0.3' },
      'alert->sprint': { trigger: 'desiredSpeed>5 && hasPath' },
      'sprint->alert': { trigger: 'desiredSpeed<3' },
      '*->crouch': { trigger: 'coverSlot && coverHeight<1' }
    }
  },
  upperBodyAim: {
    states: ['idle', 'peek', 'aim', 'fire', 'reload', 'grenade', 'melee'],
    transitions: {
      'idle->aim': { trigger: 'hasTarget && losClear' },
      'aim->fire': { trigger: 'firePulse' },
      'aim->reload': { trigger: 'ammo==0' },
      '*->grenade': { trigger: 'grenadeCommit' },
      '*->melee': { trigger: 'meleeRange' }
    }
  },
  hitReactionAdditive: {
    states: ['none', 'flinchHead', 'flinchTorso', 'flinchLeftArm', 'flinchRightArm', 'flinchLeg', 'stagger'],
    transitions: { '*->none': { trigger: 'reactionMs>180' } }
  },
  deathOverride: {
    states: ['none', 'deathHead', 'deathTorso', 'deathSlump', 'deathBack', 'takedownVictim'],
    transitions: { '*->none': { trigger: 'never; respawn only' } }
  },
  bossPhase: {
    states: ['idle', 'tell-charge', 'tell-burst', 'tell-summon', 'tell-melee', 'transition'],
    transitions: { '*->idle': { trigger: 'phaseCompletePulse' } }
  }
};

export const VIEWMODEL_STATE_MACHINE = {
  layers: ['locomotion', 'weaponPose', 'damageFlinch', 'tacticalLean'],
  locomotion: {
    states: ['idle', 'walkSway', 'sprint'],
    transitions: {
      'idle->walkSway': { trigger: 'speed>0.5' },
      'walkSway->sprint': { trigger: 'sprintLatched' },
      'sprint->idle': { trigger: 'speed<0.3' }
    }
  },
  weaponPose: {
    states: ['hip', 'ads', 'reload', 'inspect', 'melee', 'grenadeThrow', 'weaponSwap'],
    transitions: {
      'hip->ads': { trigger: 'P.ads>0.5' },
      'ads->hip': { trigger: 'P.ads<0.5' },
      '*->reload': { trigger: 'reloadStart' },
      '*->weaponSwap': { trigger: 'switchWeapon' }
    }
  },
  damageFlinch: {
    states: ['none', 'flinchLight', 'flinchHeavy'],
    transitions: { '*->none': { trigger: 'flinchMs>150' } }
  },
  tacticalLean: {
    states: ['center', 'leanLeft', 'leanRight'],
    transitions: {
      'center->leanLeft': { trigger: 'lean<-0.3' },
      'center->leanRight': { trigger: 'lean>0.3' }
    }
  }
};

// ── Weapon socket spec ──────────────────────────────────────────────────────
export const WEAPON_SOCKETS_SPEC = {
  pistol: { sockets: ['muzzle', 'magazine', 'ejectionPort', 'gripRight'], hands: ['right'], adsBlocksCenterScreen: false },
  rifle: { sockets: ['muzzle', 'optic', 'magazine', 'ejectionPort', 'gripLeft', 'gripRight', 'muzzleFlash', 'scopeCamera'], hands: ['left', 'right'], adsBlocksCenterScreen: false },
  shotgun: { sockets: ['muzzle', 'magazine', 'ejectionPort', 'gripLeft', 'gripRight', 'pump'], hands: ['left', 'right'], adsBlocksCenterScreen: false },
  smg: { sockets: ['muzzle', 'optic', 'magazine', 'ejectionPort', 'gripLeft', 'gripRight'], hands: ['left', 'right'], adsBlocksCenterScreen: false },
  marksman: { sockets: ['muzzle', 'optic', 'magazine', 'ejectionPort', 'gripLeft', 'gripRight', 'scopeCamera', 'bipod'], hands: ['left', 'right'], adsBlocksCenterScreen: false },
  heavy: { sockets: ['muzzle', 'belt', 'feedTray', 'gripLeft', 'gripRight', 'muzzleFlash'], hands: ['left', 'right'], adsBlocksCenterScreen: false },
  knife: { sockets: ['blade', 'gripRight'], hands: ['right'], adsBlocksCenterScreen: false },
  grenade: { sockets: ['pin', 'gripRight'], hands: ['right'], adsBlocksCenterScreen: false }
};

// ── VFX profiles per weapon / surface / enemy / building ────────────────────
export const VFX_PROFILES = {
  weapon: {
    pistol: { muzzleFlash: 'small-spark', suppressedMuzzleFlash: 'breath', smoke: 'wisp', shellEjection: 'small', recoilDuration: 0.06 },
    rifle: { muzzleFlash: 'medium-cross', suppressedMuzzleFlash: 'breath', smoke: 'puff', shellEjection: 'medium', recoilDuration: 0.08 },
    shotgun: { muzzleFlash: 'wide-orange', suppressedMuzzleFlash: 'reducedOrange', smoke: 'wide', shellEjection: 'shotshell', recoilDuration: 0.16 },
    smg: { muzzleFlash: 'rapid-small', suppressedMuzzleFlash: 'breath', smoke: 'wisp', shellEjection: 'pistolCase', recoilDuration: 0.05 },
    marksman: { muzzleFlash: 'narrow-long', suppressedMuzzleFlash: 'narrow-breath', smoke: 'puff', shellEjection: 'rifleCase', recoilDuration: 0.14 },
    heavy: { muzzleFlash: 'big-cross', suppressedMuzzleFlash: null, smoke: 'thick-trail', shellEjection: 'belted', recoilDuration: 0.18 },
    knife: { muzzleFlash: null, smoke: null, shellEjection: null, recoilDuration: 0 },
    grenade: { muzzleFlash: null, smoke: 'cooked-wisp', shellEjection: null, recoilDuration: 0 }
  },
  surface: {
    concrete: { impact: 'concreteChip', decal: 'bulletHole.concrete' },
    metal: { impact: 'metalSpark', decal: 'bulletHole.metal' },
    glass: { impact: 'glassShard', decal: 'glassCrack' },
    wood: { impact: 'woodSplinter', decal: 'bulletHole.wood' },
    flesh: { impact: 'bloodImpact', decal: 'bloodSpray' },
    fabric: { impact: 'fabricPuff', decal: 'bulletHole.fabric' },
    armor: { impact: 'armorSpark', decal: 'scuff' },
    water: { impact: 'waterSplash', decal: null }
  },
  enemy: {
    soldier: { blood: 'standard', armor: 'standardSpark', death: 'slump' },
    heavy: { blood: 'standard', armor: 'heavySpark', death: 'topple' },
    scout: { blood: 'fast', armor: 'minimal', death: 'sprintTumble' },
    sniper: { blood: 'standard', armor: 'minimal', death: 'slump' },
    marksman: { blood: 'standard', armor: 'standardSpark', death: 'slump' },
    riot: { blood: 'minimal', armor: 'shieldSpark', death: 'shieldDrop' },
    demolitions: { blood: 'standard', armor: 'standardSpark', death: 'cookOff' },
    pistolero: { blood: 'standard', armor: 'minimal', death: 'coatTumble' },
    drone: { blood: 'sparkOnly', armor: 'rotorChunks', death: 'explode' },
    lieutenant: { blood: 'standard', armor: 'goldSpark', death: 'kneel' },
    boss: { blood: 'minimal', armor: 'phaseFracture', death: 'phaseCollapse' }
  },
  building: {
    dock: { atmosphere: ['rainHaze', 'wetReflection', 'sodiumDust'], setpiece: ['craneShudder', 'cargoFall'] },
    continental: { atmosphere: ['warmDust'], setpiece: ['chandelierSway'] },
    nightclub: { atmosphere: ['smokeMachine', 'strobePulse'], setpiece: ['speakerPulse'] },
    penthouse: { atmosphere: ['skylineHaze'], setpiece: ['glassShatter'] },
    medical: { atmosphere: ['blackoutHaze', 'antisepticMist'], setpiece: ['emergencyStrobe'] },
    subway: { atmosphere: ['redHaze', 'tunnelDust'], setpiece: ['trainPass', 'sparkBurst'] },
    yacht: { atmosphere: ['oceanMist', 'moonlight'], setpiece: ['waveSlap'] },
    server: { atmosphere: ['coldVapor', 'cyanGlow'], setpiece: ['rackSpark', 'coolantHiss'] },
    border: { atmosphere: ['sandstorm', 'dustShaft'], setpiece: ['beaconFlash'] },
    cathedral: { atmosphere: ['incenseDrift', 'candleHaze'], setpiece: ['bellTremor'] },
    freighter: { atmosphere: ['stormMist', 'waveSpray'], setpiece: ['hullGroan'] },
    spire: { atmosphere: ['rooftopWind', 'cityBounce'], setpiece: ['helipadStrobe'] }
  },
  hud: {
    focusOverlay: { color: 0xc8e0ff, intensity: 0.45 },
    lowHpOverlay: { color: 0xff3030, intensity: 0.85 },
    killBeatOverlay: { color: 0xfff080, intensity: 0.35, durationMs: 220 },
    bossWarning: { color: 0xff5040, intensity: 0.55, pulseHz: 1.8 }
  }
};

// ── Decal / texture / material category lists (Section 8) ───────────────────
// These match the asset manifest categories and are exposed here for the
// procedural material library and the debug API consumers that need to draw
// "what's authored vs procedural" UIs.
export const TEXTURE_CATEGORIES = [
  'concrete', 'tile', 'metal', 'paintedMetal', 'glass', 'wood', 'rubber', 'fabric',
  'plastic', 'skin', 'hair', 'armor', 'emissivePanel', 'wetSurface', 'grime',
  'blood', 'bulletHole', 'scorchMark', 'glassCrack', 'warningPaint', 'signage',
  'marble', 'brass', 'chrome', 'leather'
];

export const DECAL_LAYERS = [
  { id: 'bulletHole', maxActive: 64, persistenceMs: 60_000 },
  { id: 'bloodSpray', maxActive: 48, persistenceMs: 45_000 },
  { id: 'bloodPool', maxActive: 24, persistenceMs: 90_000 },
  { id: 'grime', maxActive: 32, persistenceMs: Infinity },
  { id: 'scuff', maxActive: 32, persistenceMs: Infinity },
  { id: 'crack', maxActive: 24, persistenceMs: Infinity },
  { id: 'sparkStain', maxActive: 16, persistenceMs: 30_000 },
  { id: 'scorch', maxActive: 16, persistenceMs: Infinity }
];

const VISUAL_GRADE_LIMITS = {
  exposure: [0.96, 1.14],
  contrast: [0.96, 1.16],
  saturation: [0.84, 1.08],
  warm: [-0.04, 0.26],
  cool: [-0.04, 0.26],
  vignette: [0, 0.32],
  grain: [0, 0.008],
  aberration: [0, 0.00045],
  sharpen: [0, 0.075]
};

function clampGradeValue(key, value) {
  const limits = VISUAL_GRADE_LIMITS[key];
  if (!limits || !Number.isFinite(value)) return value;
  return Math.min(limits[1], Math.max(limits[0], value));
}

function polishVisualProfile(profile) {
  if (!profile) return profile;
  const grade = { ...(profile.grade || {}) };
  for (const key of Object.keys(VISUAL_GRADE_LIMITS)) {
    if (grade[key] != null) grade[key] = clampGradeValue(key, grade[key]);
  }
  grade.grain = Math.min(grade.grain ?? 0, VISUAL_GRADE_LIMITS.grain[1]);
  grade.aberration = Math.min(grade.aberration ?? 0.00025, VISUAL_GRADE_LIMITS.aberration[1]);
  grade.sharpen = Math.min(grade.sharpen ?? 0.05, VISUAL_GRADE_LIMITS.sharpen[1]);
  grade.bloomThreshold = Math.max(grade.bloomThreshold ?? 0.92, 0.90);
  return {
    ...profile,
    grade,
    atmosphere: profile.atmosphere ? { ...profile.atmosphere } : profile.atmosphere
  };
}

export function getVisualProfile(building, opts) {
  const profile = VISUAL_TARGETS[building] || VISUAL_TARGETS[(((building - 1) % 12) + 12) % 12 + 1] || VISUAL_TARGETS[1];
  const polished = polishVisualProfile(profile);
  const sk = opts && opts.spaceKind;
  if (polished && polished.atmosphere && (sk === 'connector' || sk === 'service_hall' || sk === 'transit_wedge')) {
    const h = polished.atmosphere.haze != null ? polished.atmosphere.haze : 0.2;
    return polishVisualProfile({
      ...polished,
      atmosphere: { ...polished.atmosphere, haze: Math.min(0.55, h + 0.04) },
    });
  }
  return polished;
}

export function getLightingProfile(building) {
  const profile = getVisualProfile(building);
  return LIGHTING_PROFILES[profile.id] || LIGHTING_PROFILES.dock;
}

export function getEnvironmentKit(building) {
  const profile = getVisualProfile(building);
  return ENVIRONMENT_KITS[profile.id] || ENVIRONMENT_KITS.dock;
}

export function getCharacterProfile(type) {
  return CHARACTER_ART_BIBLE.archetypes[type] || CHARACTER_ART_BIBLE.archetypes.soldier;
}

export function getViewmodelProfile() {
  return PLAYER_VIEWMODEL_PROFILE;
}

export function getPlayerProxyProfile() {
  return PLAYER_PROXY_PROFILE;
}

export function getVfxProfile(category, key) {
  if (!category) return VFX_PROFILES;
  if (!key) return VFX_PROFILES[category] || null;
  return (VFX_PROFILES[category] && VFX_PROFILES[category][key]) || null;
}

export function getEnemyStateMachine() { return ENEMY_STATE_MACHINE; }
export function getViewmodelStateMachine() { return VIEWMODEL_STATE_MACHINE; }
export function getWeaponSocketSpec(type) { return WEAPON_SOCKETS_SPEC[type] || null; }
