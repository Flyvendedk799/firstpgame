import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  main.includes("FIRST_PERSON_PISTOL_ADS_RELEASE_VERSION='first-person-pistol-ads-release-cleanup.v1'") &&
    main.includes('function _firstPersonAdsPoseWeight(rawAds,weaponIdx,adsTarget=0)'),
  'pistol ADS release cleanup helper missing'
);
assert(
  main.includes('if(target>.5)return a<.006?0:a') &&
    main.includes('if(a<.10)return 0') &&
    main.includes('return a*THREE.MathUtils.smoothstep(a,.10,.78)'),
  'pistol ADS release weight must dead-zone the release tail'
);
assert(
  main.includes('const _adsRawForHands=THREE.MathUtils.clamp(Number.isFinite(P.adsVis)?P.adsVis:(P.ads||0),0,1)') &&
    main.includes('const _adsPoseForHands=_firstPersonAdsPoseWeight(_adsRawForHands,_wi,P.adsTarget)') &&
    main.includes('const a=_adsPoseForHands') &&
    main.includes('const _handSteady=1-THREE.MathUtils.smoothstep(_adsPoseForHands,.12,.90)*.78'),
  'hands still use raw ADS instead of cleaned ADS pose'
);
assert(
  main.includes('P._firstPersonPistolAdsReleaseUntil=_adsReleaseNow+420') &&
    main.includes('P._firstPersonPistolAdsReleasePulse=Math.max(P._firstPersonPistolAdsReleasePulse||0,1)') &&
    main.includes('if(_pistolAdsReleased&&P.ads<.028&&P.adsVis<.085)') &&
    main.includes('P._adsRaisePulse=0') &&
    main.includes('P._adsShoulderPulse=0'),
  'ADS release state cleanup missing'
);
assert(
  main.includes('const _adsPoseRaw=THREE.MathUtils.clamp(P.adsVis||P.ads||0,0,1)') &&
    main.includes('const _adsPose=_firstPersonAdsPoseWeight(_adsPoseRaw,P.weaponIdx,P.adsTarget)') &&
    main.includes('const _pistolIronAds=(!_opticPose&&(P.weaponIdx===1||P.weaponIdx===6))?_adsPose:0') &&
    main.includes('applyWeaponPoseToObject(gunGrp,_WEAPON_ANIM_CONTROLLER.pose,{ads:_adsPose,scale:1})'),
  'gun root/controller still uses raw ADS pose'
);
assert(
  main.includes('const ads=_firstPersonAdsPoseWeight(rawAds,P.weaponIdx,P.adsTarget)') &&
    main.includes('const ads=_firstPersonAdsPoseWeight(rawAds,idx,P.adsTarget)'),
  'iron/RDS alignment still uses raw ADS pose'
);
assert(
  main.includes("version:FIRST_PERSON_PISTOL_ADS_RELEASE_VERSION") &&
    main.includes('pistolAdsRelease:P._firstPersonPistolAdsRelease'),
  'pistol ADS release debug state missing'
);

console.log(JSON.stringify({
  ok: true,
  probe: 'pistol-ads-release-static',
  version: 'first-person-pistol-ads-release-cleanup.v1'
}, null, 2));
