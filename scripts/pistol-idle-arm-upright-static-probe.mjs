import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  main.includes("FIRST_PERSON_IDLE_ARM_UPRIGHT_VERSION='first-person-idle-arm-upright.v1'"),
  'idle arm upright version missing'
);
assert(
  main.includes("FIRST_PERSON_PISTOL_POSE_STABILITY_VERSION='first-person-pistol-pose-stability.v1'"),
  'pistol pose stability version missing'
);
assert(
  main.includes('const pistolIdlePitchMul=(_wi===1||_wi===6)?.34:1.0') &&
    main.includes('rTRX-=_normalArmPosture*.058*pistolGrip*pistolIdlePitchMul') &&
    main.includes('lTRX-=_normalArmPosture*.084*pistolGrip*pistolIdlePitchMul'),
  'pistol idle base-posture pitch is not reduced'
);
assert(
  main.includes('const hipPitchMul=(_wi===1||_wi===6)?.38:1') &&
    main.includes('lTRX+=hipUsp*((-.036*hipPitchMul)+a*.28)'),
  'pistol off-hand hip pitch is not softened'
);
assert(
  main.includes('const _walkStableUpright=THREE.MathUtils.clamp(1-THREE.MathUtils.smoothstep(_idleSpeed,.65,4.8),0,1)*.44') &&
    main.includes('Math.max(_idleStableUpright,_walkStableUpright)') &&
    main.includes('const _pistolIdleUpright=(_wi===1||_wi===6)&&!P.reloading&&!P.vaulting') &&
    main.includes('rTRX+=_pistolIdleUpright*.035') &&
    main.includes('lTRX+=_pistolIdleUpright*.070'),
  'walk-safe pistol idle upright compensation missing'
);
assert(
  main.includes('1-THREE.MathUtils.smoothstep(sprAmt,.035,.32)') &&
    main.includes('1-THREE.MathUtils.smoothstep(a,.12,.58)'),
  'idle upright compensation must fade under sprint and ADS'
);
assert(
  main.includes('P._firstPersonPistolSettleUntil=performance.now()+520') &&
    main.includes('const _pistolPostSprintSettle=(_wi===1||_wi===6)?') &&
    main.includes('const ls=22+_pistolHandSettleFast*16+_focusAdsHandStability*18,lm=14+_pistolHandSettleFast*18+_focusAdsHandStability*20'),
  'post-sprint pistol hand settle missing'
);
assert(
  main.includes('const _pistolHipStable=(P.weaponIdx===1||P.weaponIdx===6)&&!P.reloading') &&
    main.includes('const _stableYCeil=_baseGunY+_adsFitY+_upperBob+_walkJitter+.012') &&
    main.includes('gunGrp.position.y=THREE.MathUtils.lerp(gunGrp.position.y,_stableYCeil,.62*_pistolStableStrength)') &&
    main.includes('P._firstPersonPistolPoseStability={'),
  'pistol hip/walk root stability cap missing'
);
assert(
  main.includes('P._firstPersonIdleArmUpright={') &&
    main.includes('idleArmUpright:P._firstPersonIdleArmUpright') &&
    main.includes('pistolPoseStability:P._firstPersonPistolPoseStability') &&
    main.includes('pistolMobilitySettle:P._firstPersonPistolMobilitySettle'),
  'pistol pose stability debug state missing'
);

console.log(JSON.stringify({
  ok: true,
  probe: 'pistol-idle-arm-upright-static',
  version: 'first-person-pistol-pose-stability.v1'
}, null, 2));
