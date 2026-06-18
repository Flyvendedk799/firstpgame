import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  KNIFE_FEEL_VERSION,
  resolveKnifePickupAffordance,
  resolveKnifeReturnFrame,
  resolveKnifeStuckPoseSnapshot
} from '../src/game/knifeFeel.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(main.includes('function _sweepKnifeWorldCollision'), 'knife swept world collision missing');
assert(main.includes('containmentFallback:true'), 'knife wall containment fallback missing');
assert(main.includes('function _ensureKnifeStuckSilhouette'), 'stuck knife readable silhouette missing');
assert(main.includes('knife_stuck_readable_blade'), 'stuck knife blade silhouette missing');
assert(main.includes('knife_stuck_readable_cutting_edge'), 'stuck knife cutting edge silhouette missing');
assert(main.includes("readableProfile:'knife-stuck-readable-v6'"), 'stuck knife readable profile debug missing');
assert(main.includes('resolveKnifeStuckPoseSnapshot'), 'knife stuck pose resolver missing');
assert(main.includes('knifeStuckPoseFeel'), 'knife stuck pose feel debug missing');
assert(main.includes("version:'knife-recall-runtime.v4'"), 'knife recall runtime debug missing');
assert(main.includes('_ensureKnifeStuckSilhouette(k);'), 'stuck knife silhouette is not applied when sticking');
assert(main.includes("kind:'knife-return'"), 'knife return trail missing');
assert(main.includes("kind:'knife-return-magnetic'"), 'knife return magnetic trail missing');
assert(main.includes('magneticSnap'), 'knife magnetic return snap missing');
assert(main.includes('spinBrake') && main.includes('returnLead') && main.includes('catchTwist'), 'knife v4 return catch fields missing');
assert(main.includes('returnAnticipation') && main.includes('curveTighten') && main.includes('catchAlignment') && main.includes('catchSnap'), 'knife v6 return choreography fields missing');
assert(main.includes("kind:'knife-return-catch-snap'"), 'knife return catch-snap trail missing');
assert(main.includes('knifeStickGrip') && main.includes('source:\'knife-stuck\'') && main.includes('stuckSurfaceFeel'), 'knife v5 material-aware stuck feel missing');
assert(main.includes('resolveKnifeReturnFrame'), 'knife return feel resolver missing');
assert(main.includes('resolveKnifePickupAffordance'), 'knife pickup affordance resolver missing');
assert(main.includes('KNIFE_FEEL_VERSION'), 'knife feel debug version missing');
assert(main.includes('returnProfile=KNIFE_FEEL_VERSION'), 'knife return profile marker missing');
assert(main.includes("P.weaponIdx===2){tryThrowKnife();return;}"), 'equipped knife throw bind missing');
assert(main.includes("doMelee('light_slice')"), 'equipped knife light slice missing');
assert(main.includes("doMelee('heavy_stab')"), 'equipped knife heavy stab missing');

const collisionIndex = main.indexOf('function _sweepKnifeWorldCollision');
const stickIndex = main.indexOf('function _stickKnifeAtSurface');
const updateIndex = main.indexOf('function updateKnives');
assert(collisionIndex > 0 && stickIndex > collisionIndex && updateIndex > stickIndex, 'knife collision/stick/update ordering invalid');

const stuckBlock = main.slice(main.indexOf('if(k.stuck){'), main.indexOf('if(!k.alive){'));
assert(stuckBlock.includes('_ensureKnifeStuckSilhouette(k)'), 'stuck update does not refresh silhouette');
assert(stuckBlock.includes('sil.scale.setScalar'), 'stuck silhouette does not pulse');
assert(stuckBlock.includes('silhouetteOpacity') && stuckBlock.includes('bladeGlow'), 'stuck silhouette affordance opacity missing');
assert(stuckBlock.includes('poseFeel.silhouetteScale') && stuckBlock.includes('poseFeel.beaconBoost'), 'stuck pose feel does not affect silhouette/beacon');
assert(stuckBlock.includes('poseFeel.bladeReadScale') && stuckBlock.includes('poseFeel.edgeGlowBoost') && stuckBlock.includes('poseFeel.handleLift'), 'stuck pose v4 silhouette shaping missing');
assert(stuckBlock.includes('afford.guideLineOpacity') && stuckBlock.includes('afford.promptUrgency') && stuckBlock.includes('afford.magnetStrength'), 'knife pickup v4 affordance shaping missing');
assert(stuckBlock.includes('_collectStuckKnife(k)'), 'stuck knife collect path missing');
assert(stuckBlock.includes('knifePickupAffordance'), 'stuck knife affordance debug missing');

const hitReturn = resolveKnifeReturnFrame({ p: 0.82, dist: 10, arc: 1.1, side: 1, hitReturn: true });
const missReturn = resolveKnifeReturnFrame({ p: 0.82, dist: 10, arc: 1.1, side: 1, hitReturn: false });
assert(KNIFE_FEEL_VERSION === 'knife-feel.v6', 'unexpected knife feel version');
assert(hitReturn.spinMul > missReturn.spinMul && hitReturn.haloRadius >= missReturn.haloRadius, 'hit knife return should feel stronger');
assert(hitReturn.trailCadenceMs <= missReturn.trailCadenceMs, 'hit knife return should trail faster');
assert(hitReturn.magneticSnap > 0 && hitReturn.ribbonRadius > 0 && hitReturn.catchScale >= 1, 'hit knife return v2 fields missing');
assert(hitReturn.cameraCatchKick > 0 && hitReturn.handLead > 0 && hitReturn.catchBrake > 0, 'knife return v3 catch fields missing');
assert(hitReturn.spinBrake > 0 && hitReturn.returnLead > 0 && hitReturn.catchTwist > 0 && hitReturn.returnLineOpacity > 0, 'knife return v4 catch fields missing');
assert(hitReturn.returnAnticipation >= 0 && hitReturn.curveTighten > 0 && hitReturn.catchAlignment > 0 && hitReturn.catchSnap > 0, 'knife return v6 catch choreography fields missing');
assert(hitReturn.returnAudioPitch > missReturn.returnAudioPitch, 'knife hit return should raise v6 return audio pitch');

const farPickup = resolveKnifePickupAffordance({ distance: 5, heightDelta: 0.2, age: 1, equipped: false });
const nearPickup = resolveKnifePickupAffordance({ distance: 0.8, heightDelta: 0.2, age: 1, equipped: true });
assert(nearPickup.collectRadius > farPickup.collectRadius && nearPickup.ringOpacity > farPickup.ringOpacity, 'knife pickup affordance does not scale with proximity');
assert(nearPickup.silhouetteOpacity > farPickup.silhouetteOpacity && nearPickup.bladeGlow > farPickup.bladeGlow, 'knife pickup readability does not scale with proximity');
assert(nearPickup.magnetStrength > farPickup.magnetStrength && nearPickup.promptUrgency > farPickup.promptUrgency && nearPickup.guideLineOpacity > farPickup.guideLineOpacity, 'knife pickup v4 guide does not scale with proximity');
const wallPose = resolveKnifeStuckPoseSnapshot({ kind: 'wall', normalY: 0, speed: 50, age: 0.5 });
const floorPose = resolveKnifeStuckPoseSnapshot({ kind: 'floor', normalY: 1, speed: 32, age: 0.5 });
const woodPose = resolveKnifeStuckPoseSnapshot({ kind: 'wall', normalY: 0, speed: 50, age: 0.5, materialKey: 'wood', knifeStickGrip: 0.82, playerReadPulse: 0.55 });
const metalPose = resolveKnifeStuckPoseSnapshot({ kind: 'wall', normalY: 0, speed: 50, age: 0.5, materialKey: 'metal', knifeStickGrip: 0.16, hardSnap: 0.72, materialKick: 0.58 });
assert(wallPose.surfaceOffset > 0.08 && floorPose.floor && floorPose.surfaceOffset > wallPose.surfaceOffset * 0.9, 'knife stuck pose offsets invalid');
assert(wallPose.silhouetteScale > 1 && wallPose.beaconBoost > 0.1, 'knife stuck pose readability invalid');
assert(wallPose.bladeReadScale > 1 && wallPose.edgeGlowBoost > 0.1 && wallPose.handleLift > 0 && wallPose.shadowPin > 0, 'knife stuck v4 pose readability invalid');
assert(woodPose.materialGrip > metalPose.materialGrip && woodPose.embedDepth > metalPose.embedDepth, 'knife v5 material grip should affect embed depth');
assert(metalPose.edgeGlowBoost > wallPose.edgeGlowBoost && metalPose.materialKick > 0.5, 'knife v5 hard material kick should affect edge readability');

console.log(JSON.stringify({
  ok: true,
  checks: {
    containmentFallback: true,
    stuckSilhouette: true,
    recallTrail: true,
    returnFeel: KNIFE_FEEL_VERSION,
    equippedKnifeInputs: true
  }
}, null, 2));
