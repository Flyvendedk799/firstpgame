/**
 * Small symmetric PvP arena: floor, perimeter walls, scattered cover blocks.
 * Returns a minimal levelData-compatible object (walls, floorRegions, cleanup).
 */
export function buildDuelArena(THREE, scene, WT) {
  const ob = [];
  const wl = [];
  const floorRegions = [{ x0: -40, x1: 40, z0: -40, z1: 40, floorY: 0 }];

  function addWallAabb(x0, x1, z0, z1) {
    wl.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  }

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a3238, roughness: 0.88, metalness: 0.06 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x353d45, roughness: 0.82, metalness: 0.1 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 0.78, metalness: 0.12 });

  const arena = 26;
  const h = 0.35;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(arena * 2, h, arena * 2), floorMat);
  floor.position.set(0, -h / 2 - 0.02, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  ob.push(floor);

  const wallH = 3.2;
  const t = 0.55;
  const y = WT + wallH / 2;
  const W = arena + t;
  const boxes = [
    { x: 0, z: -arena - t / 2, w: W * 2, d: t },
    { x: 0, z: arena + t / 2, w: W * 2, d: t },
    { x: -arena - t / 2, z: 0, w: t, d: W * 2 },
    { x: arena + t / 2, z: 0, w: t, d: W * 2 },
  ];
  for (const b of boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, wallH, b.d), wallMat);
    m.position.set(b.x, y, b.z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    ob.push(m);
    addWallAabb(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2);
  }

  const covers = [
    { x: -6, z: -4, w: 2.2, d: 1.1, h: 1.35 },
    { x: 6, z: 4, w: 2.2, d: 1.1, h: 1.35 },
    { x: -3, z: 7, w: 3.0, d: 0.9, h: 1.2 },
    { x: 3, z: -7, w: 3.0, d: 0.9, h: 1.2 },
    { x: -9, z: 2, w: 1.0, d: 2.8, h: 1.4 },
    { x: 9, z: -2, w: 1.0, d: 2.8, h: 1.4 },
    { x: 0, z: -10, w: 4.5, d: 1.0, h: 1.25 },
    { x: 0, z: 10, w: 4.5, d: 1.0, h: 1.25 },
    { x: -12, z: -10, w: 1.2, d: 1.2, h: 1.5 },
    { x: 12, z: 10, w: 1.2, d: 1.2, h: 1.5 },
    { x: -14, z: 8, w: 2.0, d: 0.85, h: 1.1 },
    { x: 14, z: -8, w: 2.0, d: 0.85, h: 1.1 },
  ];
  for (const c of covers) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), crateMat);
    m.position.set(c.x, WT + c.h / 2, c.z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    ob.push(m);
    addWallAabb(c.x - c.w / 2, c.x + c.w / 2, c.z - c.d / 2, c.z + c.d / 2);
  }

  const spawns = [
    { x: -10, z: 0, yaw: 0 },
    { x: 10, z: 0, yaw: Math.PI },
  ];

  function cleanup() {
    for (const m of ob) {
      scene.remove(m);
      m.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((mm) => mm.dispose && mm.dispose());
          else o.material.dispose && o.material.dispose();
        }
      });
    }
    ob.length = 0;
  }

  return {
    walls: wl,
    vaultables: [],
    floorRegions,
    exitZone: null,
    spawns,
    zoneSpawns: [[], [], []],
    zoneBounds: { halfWidth: arena, halfDepth: arena, zSplit: 0 },
    unlockExit: () => {},
    cleanup,
    solids: ob,
    ceilingLights: [],
    fakeCeilingLamps: [],
    shadowCasters: ob,
    dustList: [],
    reflectionProfile: null,
    lightingController: null,
    tickLighting: () => {},
    visualStats: { dressingObjects: 0 },
    zoneDoors: [],
    openZoneDoor: () => {},
    tickZoneDoors: () => {},
    alertDoorways: [],
    spawnDoors: [],
    tickSpawnDoors: () => {},
    navGrid: null,
    wallIndex: null,
    cornerEdges: [],
    coverSlots: [],
    tickDynProps: () => {},
    dims: { RW: arena * 2, RD: arena * 2, RH: 4.25 },
    sequenceCells: null,
    encounterDef: null,
  };
}
