import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  main.includes("FIRST_PERSON_VIEWMODEL_ROOT_GUARD_VERSION='first-person-viewmodel-root-guard.v1'") &&
    main.includes("function _stabilizeFirstPersonViewmodelRoot(dt,reason='frame')") &&
    main.includes('const normalPistol=pistol&&!special') &&
    main.includes("P._firstPersonViewmodelRootGuard={") &&
    main.includes("reason:String(reason||'frame')"),
  'first-person viewmodel root guard is missing'
);

assert(
  main.includes('if(!H.handFit||H.handFit.id!==expectedHandFit.id)') &&
    main.includes('handFit=_applyWeaponHandFit(_wi,true)') &&
    main.includes('_handHealth.fitCorrections=(_handHealth.fitCorrections||0)+1') &&
    main.includes('P._viewmodelPoseSnapUntil=Math.max(P._viewmodelPoseSnapUntil||0,performance.now()+180)'),
  'first-person hand fit mismatch correction is missing'
);

assert(
  main.includes("FIRST_PERSON_WEAPON_SWITCH_PULSE_DECAY_VERSION='first-person-weapon-switch-pulse-decay.v1'") &&
    main.includes("FIRST_PERSON_PISTOL_REEQUIP_CLEANUP_VERSION='first-person-pistol-reequip-cleanup.v1'") &&
    main.includes("FIRST_PERSON_WEAPON_EQUIP_CLEANUP_VERSION='first-person-weapon-equip-cleanup.v1'") &&
    main.includes('function _decayFirstPersonWeaponSwitchPulses(pl=P,dt=0)') &&
    main.includes("function _resetFirstPersonWeaponEquipCarryover(idx,prevIdx,reason='switch')") &&
    main.includes("function _resetPistolReequipViewmodelState(prevIdx,idx,reason='switch')") &&
    main.includes("_decayFirstPersonWeaponSwitchPulses(P,dt)") &&
    main.includes("_decayFirstPersonWeaponSwitchPulses(pl,dt)") &&
    main.includes("if(nextIsPistol)_resetPistolReequipViewmodelState(prevIdx,idx,'switch')"),
  'weapon switch pulse decay / pistol re-equip cleanup is missing'
);

assert(
  main.includes('const pistolReequipClean=pistol&&nowMs<(P._firstPersonPistolReequipCleanUntil||0)') &&
    main.includes('const equipClean=nowMs<(P._firstPersonWeaponEquipCleanUntil||0)') &&
    main.includes('const guardActionFade=(pistolReequipClean||equipClean)?Math.max(actionFade,.82):actionFade') &&
    main.includes('H.swapDur=nextIsPistol?.20:.42;H.swapT=H.swapDur;') &&
    main.includes('P._weaponSwitchPulse=.30;') &&
    main.includes('P._weaponDrawPulse=.36;') &&
    main.includes('const swapMul=pistolSwap?.16:1;') &&
    main.includes('rTRX+=drop*(pistolSwap?.070:.65);'),
  'pistol re-equip must use compact draw/drop pose clamps'
);

assert(
  main.includes("_stabilizeFirstPersonViewmodelRoot(dt,'post-frame')") &&
    main.includes('P.scopeEyeX=Number.isFinite(P.scopeEyeX)?P.scopeEyeX*.25:0') &&
    main.includes('P._weaponEquipAdsSuppressUntil=Math.max(P._weaponEquipAdsSuppressUntil||0,nowMs+suppressMs)') &&
    main.includes('st.turnInertia=(Number.isFinite(st.turnInertia)?st.turnInertia:0)*.40') &&
    main.includes('st.pivotSide=(Number.isFinite(st.pivotSide)?st.pivotSide:0)*.35'),
  'post-frame root stabilization must clear stale aim/turn state and scoped ADS carryover'
);

assert(
  main.includes('rootGuard:P._firstPersonViewmodelRootGuard') &&
    main.includes('viewmodelRootGuard:P._firstPersonViewmodelRootGuard') &&
    main.includes('weaponEquipCleanup:P._firstPersonWeaponEquipCleanup') &&
    main.includes('setViewmodelRootFaultProbe:') &&
    main.includes("_stabilizeFirstPersonViewmodelRoot(1/30,'fault-probe')"),
  'viewmodel root guard debug/fault probe is missing'
);

console.log(JSON.stringify({
  ok: true,
  probe: 'viewmodel-root-guard-static',
  versions: [
    'first-person-viewmodel-root-guard.v1',
    'first-person-weapon-switch-pulse-decay.v1',
    'first-person-pistol-reequip-cleanup.v1',
    'first-person-weapon-equip-cleanup.v1'
  ]
}, null, 2));
