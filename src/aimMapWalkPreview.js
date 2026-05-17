import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.querySelector('#walk-preview');
const overlay = document.querySelector('#overlay');
const enterButton = document.querySelector('#enter');
const loadingEl = document.querySelector('#loading');
const statusEl = document.querySelector('#preview-status');

const GROUND_Y = 0.32;
const EYE_HEIGHT = 1.62;
const PLAYER_HEIGHT = GROUND_Y + EYE_HEIGHT;
const PLAYER_RADIUS = 0.38;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.3;
const MOUSE_SENSITIVITY = 0.0021;
const RESET_POSITION = new THREE.Vector3(-3.2, PLAYER_HEIGHT, -17.6);
const MAP_LIMITS = {
  minX: -16.35,
  maxX: 16.35,
  minZ: -22.35,
  maxZ: 22.35,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090b);
scene.fog = new THREE.FogExp2(0x07090b, 0.014);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.04, 240);
camera.position.copy(RESET_POSITION);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0x88ddff, 0x15120d, 1.1));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
keyLight.position.set(8, 18, -12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -28;
keyLight.shadow.camera.right = 28;
keyLight.shadow.camera.top = 32;
keyLight.shadow.camera.bottom = -32;
scene.add(keyLight);

const fill = new THREE.DirectionalLight(0x76efff, 0.8);
fill.position.set(-14, 10, 16);
scene.add(fill);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const mixers = [];
const colliders = [];
const keys = new Set();
const velocity = new THREE.Vector3();
const desired = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const moveEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const boxScratch = new THREE.Box3();

let yaw = Math.PI;
let pitch = 0;
let isLocked = false;
let loaded = false;
let loadedStatus = 'Loading arena';

function isCollisionMesh(object) {
  const collision = object.userData?.collision;
  if (collision === 'wall_aabb' || collision === 'cover_aabb') return true;
  if (collision === 'floor_aabb' || collision === 'decorative_only' || collision === 'nonblocking_visual') return false;

  const name = object.name.toLowerCase();
  return (
    name.includes('boundary') ||
    name.includes('wall') ||
    name.includes('headglitch') ||
    name.includes('lowbox') ||
    name.includes('slab') ||
    name.includes('backstop') ||
    name.includes('shoulder_peek') ||
    name.includes('outer_long_rail') ||
    name.includes('corner_block')
  );
}

function collectColliders(root) {
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;

    if (!isCollisionMesh(object)) return;

    boxScratch.setFromObject(object);
    const box = boxScratch.clone();
    const height = box.max.y - box.min.y;
    const width = box.max.x - box.min.x;
    const depth = box.max.z - box.min.z;

    if (height < 0.35 || box.max.y < GROUND_Y + 0.2 || width < 0.18 || depth < 0.18) return;
    colliders.push(box);
  });
}

function decorateRuntime(root) {
  root.traverse(object => {
    if (!object.isMesh) return;

    const material = object.material;
    if (material) {
      material.envMapIntensity = 0.55;
      material.needsUpdate = true;
    }
  });
}

function loadMap() {
  loader.load(
    '/assets/levels/aim_1v1_duel_box.glb',
    gltf => {
      const map = gltf.scene;
      map.name = 'Aim Duel Box Runtime Preview';
      // The map was authored in Blender as an FPS plan on the X/Z plane with
      // Y as playable height. Blender exports GLB data through a Z-up to Y-up
      // conversion, so rotate the loaded root back into the walkable X/Z floor.
      map.rotation.x = Math.PI / 2;
      scene.add(map);
      map.updateMatrixWorld(true);
      decorateRuntime(map);
      collectColliders(map);

      if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(map);
        for (const clip of gltf.animations) {
          const action = mixer.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.play();
        }
        mixers.push(mixer);
      }

      loaded = true;
      loadingEl.hidden = true;
      loadedStatus = `${colliders.length} collision volumes · ${gltf.animations.length} animation tracks`;
      statusEl.textContent = loadedStatus;
    },
    event => {
      if (!event.total) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      loadingEl.textContent = `Loading ${pct}%`;
    },
    error => {
      loadingEl.textContent = 'Load failed';
      statusEl.textContent = error?.message || 'Could not load GLB';
      console.error(error);
    },
  );
}

function lockPointer() {
  if (!loaded) return;
  canvas.requestPointerLock();
}

function updatePointerState() {
  isLocked = document.pointerLockElement === canvas;
  overlay.classList.toggle('is-hidden', isLocked);
  statusEl.textContent = isLocked ? 'Live walk preview' : loadedStatus;
}

function wouldCollide(x, z) {
  if (x < MAP_LIMITS.minX + PLAYER_RADIUS || x > MAP_LIMITS.maxX - PLAYER_RADIUS) return true;
  if (z < MAP_LIMITS.minZ + PLAYER_RADIUS || z > MAP_LIMITS.maxZ - PLAYER_RADIUS) return true;

  for (const box of colliders) {
    if (box.max.y < GROUND_Y + 0.18 || box.min.y > PLAYER_HEIGHT) continue;

    if (
      x > box.min.x - PLAYER_RADIUS &&
      x < box.max.x + PLAYER_RADIUS &&
      z > box.min.z - PLAYER_RADIUS &&
      z < box.max.z + PLAYER_RADIUS
    ) {
      return true;
    }
  }

  return false;
}

function applyMovement(delta) {
  desired.set(0, 0, 0);
  if (keys.has('KeyW')) desired.z -= 1;
  if (keys.has('KeyS')) desired.z += 1;
  if (keys.has('KeyA')) desired.x -= 1;
  if (keys.has('KeyD')) desired.x += 1;

  if (desired.lengthSq() === 0) return;
  desired.normalize();

  moveEuler.set(0, yaw, 0);
  forward.set(0, 0, -1).applyEuler(moveEuler);
  right.set(1, 0, 0).applyEuler(moveEuler);

  velocity.copy(forward).multiplyScalar(-desired.z).addScaledVector(right, desired.x);
  velocity.normalize().multiplyScalar((keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED) * delta);

  const nextX = camera.position.x + velocity.x;
  const nextZ = camera.position.z + velocity.z;

  if (!wouldCollide(nextX, camera.position.z)) camera.position.x = nextX;
  if (!wouldCollide(camera.position.x, nextZ)) camera.position.z = nextZ;
  camera.position.y = PLAYER_HEIGHT;
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  for (const mixer of mixers) mixer.update(delta);
  if (isLocked) applyMovement(delta);

  camera.rotation.x = pitch;
  camera.rotation.y = yaw;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', event => {
  keys.add(event.code);
  if (event.code === 'KeyR') {
    camera.position.copy(RESET_POSITION);
    yaw = Math.PI;
    pitch = 0;
  }
});

window.addEventListener('keyup', event => {
  keys.delete(event.code);
});

window.addEventListener('mousemove', event => {
  if (!isLocked) return;
  yaw -= event.movementX * MOUSE_SENSITIVITY;
  pitch -= event.movementY * MOUSE_SENSITIVITY;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});

document.addEventListener('pointerlockchange', updatePointerState);
enterButton.addEventListener('click', lockPointer);
canvas.addEventListener('click', lockPointer);

loadMap();
animate();
