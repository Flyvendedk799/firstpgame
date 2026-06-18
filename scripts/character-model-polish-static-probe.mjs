import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const requiredSnippets = [
  "const CHARACTER_MODEL_POLISH_VERSION='character-model-polish.v2'",
  "const PLAYER_MODEL_POLISH_VERSION='player-model-polish.v1'",
  "const CHARACTER_MODEL_SHARED_GEO_VERSION='character-model-shared-geo.v1'",
  'function _characterModelBoxGeo',
  'function _characterModelPlaneGeo',
  'function _characterModelCapsuleGeo',
  'this.group.userData.characterModelVersion=CHARACTER_MODEL_POLISH_VERSION',
  'enemy-visual-dedupe.v1',
  'legacyDuplicateSuppressed',
  'characterHitProxy',
  'if(o.userData&&o.userData.legacyDuplicateSuppressed)return',
  'this.modelPolishRig={torso:[],head:[],neck:[],leftUpperArm:[],leftForearm:[],rightUpperArm:[],rightForearm:[],leftThigh:[],leftShin:[],rightThigh:[],rightShin:[]}',
  'core:[this.torsoShell,this.headShell,this.leftUpperArmShell,this.rightUpperArmShell,this.leftThighShell,this.rightThighShell,this.classBeacon,...polishCore]',
  'medium:[this.pelvisShell,this.neckColumn,this.leftForearmShell,this.rightForearmShell,this.leftShinShell,this.rightShinShell,this.leftBootShell,this.rightBootShell,...polishMedium]',
  'high:[this.chestPlane,this.jawShell,...polishHigh]',
  '...(polish.torso||[])',
  '...(polish.leftShin||[])',
  '...(polish.rightShin||[])',
  'modelVersion:PLAYER_MODEL_POLISH_VERSION',
  'baseProxyPose',
  'function _posePlayerProxyRoot(proxy,pl,animState,visible)',
  'PLAYER_PROXY2.group.userData.modelVersion=PLAYER_MODEL_POLISH_VERSION'
];
for (const snippet of requiredSnippets) {
  assert(main.includes(snippet), `missing model polish contract: ${snippet}`);
}

const enemyParts = [
  'modelPolish_collarPlate',
  'modelPolish_chestStrapL',
  'modelPolish_backPack',
  'modelPolish_browArmor',
  'modelPolish_leftShoulderCap',
  'modelPolish_leftWristWrap',
  'modelPolish_leftThighStrap',
  'modelPolish_leftKneePlate',
  'modelPolish_leftBootToe',
  'modelPolish_heavyRibL',
  'modelPolish_agileCableL',
  'modelPolish_rangefinder',
  'modelPolish_sideHolster',
  'modelPolish_leftElbowPlate',
  'modelPolish_heavySpinePlate',
  'modelPolish_agileHipPouch',
  'modelPolish_precisionLensGlow'
];
for (const part of enemyParts) {
  assert(main.includes(part), `missing enemy model part: ${part}`);
}

const bodyPresenceParts = [
  'belt_buckle',
  'abdomen_plate',
  'thigh_strap',
  'knee_rim',
  'shin_stripe',
  'boot_side',
  'boot_cap',
  'boot_lace'
];
for (const part of bodyPresenceParts) {
  assert(main.includes(part), `missing first-person body model part: ${part}`);
}

const proxyParts = [
  "'chest'",
  "'pelvis'",
  "'belt'",
  "'neck'",
  "'visor'",
  "'pack'",
  "'shoulderL'",
  "'forearmL'",
  "'handL'",
  "'kneeL'",
  "'bootL'",
  "'toeL'"
];
for (const part of proxyParts) {
  assert(main.includes(part), `missing player proxy part: ${part}`);
}

assert(!/camera\.add\(bodyPresenceGrp\)/.test(main), 'body presence model should remain yaw-anchored in scene space');
assert(main.includes('this.modelPolishDamageMarkers={}'), 'enemy model damage marker registry missing');
assert(main.includes('boxGeo(.310,.056,.038)') && main.includes('planeGeo(.052,.026)') && main.includes('capGeo(.235,.58)'), 'enemy model polish should use shared geometry helpers');
assert(main.includes('_pulseModelDamageMarker'), 'enemy model damage pulse method missing');
assert(main.includes('_updateCharacterDamageMarkers(dt)'), 'enemy model damage update not wired to animation tick');
assert(main.includes('group.userData.modelDamageState'), 'enemy model damage debug state missing');
for (const marker of [
  'modelPolish_damageMarkerTorso',
  'modelPolish_damageMarkerHead',
  'modelPolish_damageMarkerLeftForearm',
  'modelPolish_damageMarkerRightShin'
]) {
  assert(main.includes(marker), `missing enemy model damage marker: ${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  enemyParts: enemyParts.length,
  bodyPresenceParts: bodyPresenceParts.length,
  proxyParts: proxyParts.length,
  versions: {
    character: 'character-model-polish.v2',
    player: 'player-model-polish.v1'
  }
}, null, 2));
