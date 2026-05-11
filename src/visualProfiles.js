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

export const CHARACTER_ART_BIBLE = {
  sharedSkeleton: ['root', 'spine', 'neck', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'weapon'],
  proportions: {
    heightMeters: 1.78,
    headToBodyRatio: 0.135,
    shoulderWidthMeters: 0.62,
    competitiveRule: 'hitbox meshes stay authoritative; rounded shells are visual overlays only.'
  },
  archetypes: {
    soldier: { label: 'Soldier', silhouette: 'medium rifle profile', accent: 0xff3030 },
    scout: { label: 'Scout', silhouette: 'slim hooded sprinter', accent: 0x40ff80 },
    sniper: { label: 'Sniper', silhouette: 'ghillie veil and long suppressed rifle', accent: 0x40a0ff },
    marksman: { label: 'Marksman', silhouette: 'long weapon and head optic', accent: 0xa0c8ff },
    riot: { label: 'Riot', silhouette: 'wide armor and face shield', accent: 0xff5040 },
    heavy: { label: 'Heavy', silhouette: 'broad armored torso and LMG', accent: 0xff7020 },
    demolitions: { label: 'Demolitions', silhouette: 'bandolier and backpack charges', accent: 0xff8040 },
    pistolero: { label: 'Pistolero', silhouette: 'coat and dual compact pistols', accent: 0xa040ff },
    drone: { label: 'Drone Operator', silhouette: 'small airborne tech threat', accent: 0x40c8ff },
    lieutenant: { label: 'Lieutenant', silhouette: 'ranked suit and armband', accent: 0xffd060 },
    boss: { label: 'Boss', silhouette: 'tailored coat, gold trim, phase gear', accent: 0xffd040 }
  },
  readabilityRules: [
    'class accent must be visible at combat distance',
    'head orientation must remain readable in fog and bloom',
    'visual shells must never move away from hitboxes',
    'weapon pose must communicate attack intent before firing'
  ]
};

export const PLAYER_VIEWMODEL_PROFILE = {
  id: 'operative-viewmodel',
  label: 'Operative First Person Body',
  skeleton: ['cameraRoot', 'rightClavicle', 'rightForearm', 'rightWrist', 'rightHand', 'leftForearm', 'leftWrist', 'leftHand', 'weaponSocket'],
  materials: {
    skin: 'warm exposed wrist skin with subtle roughness',
    glove: 'matte tactical glove with knuckle armor, stitched seams, and reinforced fingers',
    sleeve: 'dark woven combat sleeve with cuff panels and wrist-mounted electronics',
    armor: 'low-gloss polymer knuckle plates and hard seams'
  },
  rules: [
    'hands must support every weapon without blocking the aim point',
    'right index animation stays independent for trigger readability',
    'support hand must remain visible on two-handed weapons and the wrist UI',
    'viewmodel shells are visual-only children of existing animated controls'
  ]
};

export function getVisualProfile(building) {
  return VISUAL_TARGETS[building] || VISUAL_TARGETS[((building - 1) % 8) + 1] || VISUAL_TARGETS[1];
}

export function getCharacterProfile(type) {
  return CHARACTER_ART_BIBLE.archetypes[type] || CHARACTER_ART_BIBLE.archetypes.soldier;
}

export function getViewmodelProfile() {
  return PLAYER_VIEWMODEL_PROFILE;
}
