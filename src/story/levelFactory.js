import { STORY_LEVELS, getStoryLevelByOrder } from './levels.js';

const STORY_ROOM_BLUEPRINTS = {
  L01_BROKEN_ENTRY: ['Gate Court', 'Shipping Bay', 'Manifest Office', 'Relay Cage'],
  L02_VELVET_CORRIDOR: ['Front Queue', 'Main Floor', 'VIP Spine', 'Manager Suite'],
  L03_HOLLOW_STACK: ['Lobby Rotunda', 'Reading Floor', 'Records Spine', 'Sealed Vault'],
  L04_IRON_REFINERY: ['Ore Intake', 'Furnace Walk', 'Assembly Grid', 'Control Foundry'],
  L05_GLASS_SPINE: ['Plaza Entry', 'Reception Atrium', 'Boarding Gallery', 'Executive Ring'],
  L06_DEEP_SWITCH: ['Maintenance Gate', 'Signal Tunnels', 'Power Hall', 'Dispatch Dock'],
  L07_CROWN_MERCY: ['Emergency Intake', 'Ward Spine', 'Surgical Core', 'Recovery Wing'],
  L08_RAIN_TEMPLE: ['Stone Gate', 'Prayer Court', 'Inner Cloister', 'Sanctum Hall'],
  L09_BLACK_DOCKET: ['Security Vestibule', 'Docket Floor', 'Evidence Chain', 'Vault Ring'],
  L10_SUNDERED_LAB: ['Campus Gate', 'Biosecure Hall', 'Test Wing', 'Synthesis Core'],
  L11_SKYCOURT: ['Pillared Plaza', 'Hall of Petitions', 'Tribunal Circuit', 'High Bench'],
  L12_ASHEN_HEART: ['Outer Bunker', 'Command Transit', 'War Room Ring', 'Heart Reactor']
};

function paletteForLevel(level) {
  const palettes = [
    { floor: 0x40444c, wall: 0x79808c, trim: 0x9cb0c5, emissive: 0x44a8ff },
    { floor: 0x2d1f29, wall: 0x5c2f4a, trim: 0x9f6fb0, emissive: 0xff66bb },
    { floor: 0x32383c, wall: 0x5f676f, trim: 0x93a6b2, emissive: 0x8ec6ff },
    { floor: 0x3e342d, wall: 0x6a5648, trim: 0xbe9064, emissive: 0xff9f50 },
    { floor: 0x24303c, wall: 0x506c86, trim: 0x9ec6e8, emissive: 0x5ec5ff },
    { floor: 0x1e232c, wall: 0x37495f, trim: 0x6e93b7, emissive: 0x6ec4ff }
  ];
  return palettes[(level.order - 1) % palettes.length];
}

function buildRoom(THREE, name, palette, index) {
  const group = new THREE.Group();
  group.name = name;

  const width = 20 + (index % 3) * 6;
  const depth = 24 + (index % 2) * 8;
  const height = 7 + (index % 2) * 2;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.6, depth),
    new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.85, metalness: 0.05 })
  );
  floor.position.y = -0.3;
  floor.receiveShadow = true;

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.75, metalness: 0.08 });
  const wallGeomX = new THREE.BoxGeometry(width, height, 0.6);
  const wallGeomZ = new THREE.BoxGeometry(0.6, height, depth);

  const north = new THREE.Mesh(wallGeomX, wallMat);
  north.position.set(0, height * 0.5, -depth * 0.5);
  const south = north.clone();
  south.position.z = depth * 0.5;
  const west = new THREE.Mesh(wallGeomZ, wallMat);
  west.position.set(-width * 0.5, height * 0.5, 0);
  const east = west.clone();
  east.position.x = width * 0.5;

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.85, 0.35, 0.35),
    new THREE.MeshStandardMaterial({ color: palette.trim, emissive: palette.emissive, emissiveIntensity: 0.15 })
  );
  trim.position.set(0, height - 0.7, -depth * 0.45);

  const props = [];
  for (let i = 0; i < 6; i++) {
    const prop = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1 + (i % 3), 1.1),
      new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.6, metalness: 0.2 })
    );
    prop.position.set(-width * 0.35 + i * 2.8, 0.55 + (i % 3) * 0.5, depth * 0.2 - (i % 2) * 4);
    props.push(prop);
  }

  group.add(floor, north, south, west, east, trim, ...props);

  const roomLight = new THREE.PointLight(palette.emissive, 3.2, 35, 2);
  roomLight.position.set(0, height - 1, 0);
  roomLight.userData.storyAnim = { type: 'pulse', base: 2.4, amp: 1.1, speed: 1.2 + index * 0.08 };
  group.add(roomLight);

  group.userData.bounds = { width, depth, height };
  group.userData.roomName = name;

  return group;
}

function connectRooms(THREE, fromRoom, toRoom) {
  const a = fromRoom.position;
  const b = toRoom.position;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);

  const hall = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 3.2, Math.max(6, length - 16)),
    new THREE.MeshStandardMaterial({ color: 0x3d434c, roughness: 0.8, metalness: 0.05 })
  );
  hall.position.set((a.x + b.x) * 0.5, 1.6, (a.z + b.z) * 0.5);
  hall.rotation.y = Math.atan2(dx, dz);
  hall.name = `${fromRoom.name}_to_${toRoom.name}`;
  return hall;
}

export function createStoryLevelRuntime(THREE, levelOrder = 1) {
  const level = getStoryLevelByOrder(levelOrder);
  if (!level) return null;

  const root = new THREE.Group();
  root.name = `StoryLevel_${level.id}`;
  root.userData.levelMeta = level;

  const palette = paletteForLevel(level);
  const roomNames = STORY_ROOM_BLUEPRINTS[level.id] || level.criticalPath;
  const rooms = [];

  roomNames.forEach((name, i) => {
    const room = buildRoom(THREE, name, palette, i);
    room.position.set(i * 30, 0, ((i % 2) * 2 - 1) * 10);
    rooms.push(room);
    root.add(room);
  });

  for (let i = 0; i < rooms.length - 1; i++) {
    root.add(connectRooms(THREE, rooms[i], rooms[i + 1]));
  }

  const spawnPoints = rooms.map((room, i) => ({
    room: room.userData.roomName,
    position: { x: room.position.x, y: 1.1, z: room.position.z + (i % 2 ? -3 : 3) },
    role: i === rooms.length - 1 ? 'boss_guard' : i === 0 ? 'entry_guard' : 'patrol'
  }));

  root.userData.storyRuntime = {
    levelId: level.id,
    levelOrder: level.order,
    rooms: rooms.map((r) => r.userData.roomName),
    objectives: [level.objective],
    spawnPoints,
    traversalFeatures: level.traversalFeatures,
    optionalSpaces: level.optionalSpaces,
    bossArena: level.bossArena
  };

  return root;
}

export function tickStoryLevelAnimations(levelGroup, elapsedSeconds) {
  if (!levelGroup) return;
  levelGroup.traverse((obj) => {
    const anim = obj.userData?.storyAnim;
    if (!anim) return;
    if (anim.type === 'pulse' && obj.isLight) {
      obj.intensity = anim.base + Math.sin(elapsedSeconds * anim.speed) * anim.amp;
    }
  });
}

export function getStoryLevelCatalog() {
  return STORY_LEVELS.map((level) => ({
    id: level.id,
    order: level.order,
    title: level.title,
    buildingType: level.buildingType,
    district: level.district,
    criticalPathRooms: level.criticalPath.length,
    optionalRooms: level.optionalSpaces.length
  }));
}
