import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const required = [
  ["version:'enemy-locomotion-realistic-v3'", 'enemy locomotion v3 tuning missing'],
  ["const ENEMY_MOVEMENT_GOVERNOR_VERSION='enemy-movement-governor.v1';", 'movement governor version missing'],
  ["const ENEMY_HEAD_POSE_GUARD_VERSION='enemy-head-pose-guard.v1';", 'head pose guard version missing'],
  ['function _wrapAngle(v){', 'angle wrap helper missing'],
  ['function _enemyMovementSpeedLimit(enemy,mode=null,opts=null){', 'movement speed limit helper missing'],
  ["_sanitizeHeadPose(dt,reason='frame')", 'enemy head pose sanitizer missing'],
  ["this._sanitizeHeadPose(dt,'alive-frame');", 'per-frame head pose sanitizer call missing'],
  ['this.group.rotation.y=_wrapAngle(dampAngle(cur,target,rate,dt));', 'face yaw should wrap final body yaw'],
  ['const yawDelta=_wrapAngle(nowYaw-lastYaw);', 'animation yaw delta should use wrapped angular delta'],
  ['const boundedYBase=_wrapAngle(before.y);', 'head pose sanitizer should use wrapped yaw as damping base'],
  ['const snap=Math.abs(before.y)>Math.PI*1.35||Math.abs(before.x)>maxX*1.80||Math.abs(before.z)>maxZ*1.80;', 'head pose sanitizer should hard-snap oversized rotations'],
  ['this.hMesh.rotation.y=snap?targetY:_wrapAngle(dampAngle(boundedYBase,targetY,closeCombat?22:26,dt));', 'head pose sanitizer should not preserve oversized Euler yaw'],
  ['const relAng=_wrapAngle(Math.atan2(pdx,pdz)-_wrapAngle(this.group.rotation.y||0));', 'aware head tracking should use wrapped relative angle'],
  ['this.headLookY=dampAngle(this.headLookY||0,THREE.MathUtils.clamp(relAng,-.92,.92),7,dt);', 'aware head tracking should clamp/damp head yaw'],
  ['this.group.rotation.y=_wrapAngle(this.group.rotation.y+lookA*dt);', 'search scan yaw should remain wrapped'],
  ['this.hMesh.rotation.y=THREE.MathUtils.clamp(Math.sin(Date.now()*.0009)*.42,-.48,.48);', 'search scan head yaw should stay bounded'],
  ['this._enemyMovementGovernor={', 'movement governor runtime snapshot missing'],
  ['movementGovernor:e._enemyMovementGovernor||null', 'movement governor debug export missing'],
  ['headPoseGuard:e._enemyHeadPoseGuard||e.group?.userData?.enemyHeadPoseGuard||null', 'head pose guard debug export missing'],
  ['enemyHeadPoseGuard', 'head pose guard userdata marker missing'],
  ['scout:    {hp:65,  spd:3.55+diff*.55', 'scout base speed should stay toned down'],
  ['pistolero:{hp:60,  spd:3.75+diff*.55', 'pistolero base speed should stay toned down'],
  ['drone:    {hp:35,  spd:4.40+diff*.35', 'drone base speed should stay toned down'],
  ["const rawSp=this.speed*(this.type==='scout'?1.30:this.type==='pistolero'?1.24:1.12)*limbMul;", 'juke speed multiplier should stay grounded'],
  ["const sp=Math.min(rawSp,_enemyMovementSpeedLimit(this,'juke',{sharp:true}));", 'juke should use movement governor limit'],
  ["const spd=Math.min(this.speed*1.05,_enemyMovementSpeedLimit(this,'sprint',{sharp:true})*.96);", 'grenade flee should use movement governor limit'],
  ["const rush=Math.min(this.speed*1.16,_enemyMovementSpeedLimit(this,'sprint',{sharp:true})*.92);", 'riot rush should use movement governor limit'],
  ["const sp=Math.min(this.speed*.95,_enemyMovementSpeedLimit(this,'run')*.92);", 'shield body-block speed should use movement governor limit'],
  ['const _flankMul=THREE.MathUtils.clamp(_flankMulRaw,.46,.96);', 'flank time multiplier should be clamped'],
  ['const stM=this.speed*.72*this.strafeDir', 'strafe speed should stay reduced'],
  ['const rM=this.speed*.42*Math.sign(-dErr)', 'radial attack speed should stay reduced']
];

for (const [needle, message] of required) assert(main.includes(needle), message);

console.log(JSON.stringify({
  ok: true,
  version: 'enemy-movement-head-guard.v1',
  checks: required.length
}, null, 2));
