import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  main.includes("FIRST_PERSON_WEAPON_EQUIP_SANITY_VERSION='first-person-weapon-equip-sanity.v1'"),
  'weapon equip sanity version missing'
);
assert(
  main.includes('function _sanitizeFirstPersonWeaponEquipState') &&
    main.includes('_resetWeaponAnimationControllerForEquip') &&
    main.includes('_resetHandGripStateForEquip'),
  'weapon equip sanitation helpers missing'
);
assert(
  main.includes('const nextIsPistol=(idx===1||idx===6)') &&
    main.includes('H.swapDur=nextIsPistol?.20:.42') &&
    main.includes('_sanitizeFirstPersonWeaponEquipState(idx,prevIdx,handFit,knifeEquipped)') &&
    main.includes("if(nextIsPistol)_resetPistolReequipViewmodelState(prevIdx,idx,'switch')"),
  'pistol switch path does not use compact equip sanitation'
);
assert(
  main.includes('const pistolSwap=(_wi===1||_wi===6)') &&
    main.includes('const swapMul=pistolSwap?.16:1') &&
    main.includes('rTRX+=drop*(pistolSwap?.070:.65)') &&
    main.includes('const _pistolSwitchPoseGuard=(_wi===1||_wi===6)&&(H.swapT>0.001)'),
  'pistol hand switch pose is not guarded/scaled'
);
assert(
  main.includes("FIRST_PERSON_WEAPON_SWITCH_PULSE_DECAY_VERSION='first-person-weapon-switch-pulse-decay.v1'") &&
    main.includes("FIRST_PERSON_PISTOL_REEQUIP_CLEANUP_VERSION='first-person-pistol-reequip-cleanup.v1'") &&
    main.includes('_decayFirstPersonWeaponSwitchPulses(P,dt)') &&
    main.includes('P._weaponSwitchPulse=.30;') &&
    main.includes('P._weaponDrawPulse=.36;'),
  'pistol switch cleanup pulse decay is missing'
);
assert(
  main.includes('const _pistolSwitchPose=(P.weaponIdx===1||P.weaponIdx===6)') &&
    main.includes('const _switchRootMul=_pistolSwitchPose?.38:1') &&
    main.includes('const _switchPitchMul=_pistolSwitchPose?.30:1'),
  'pistol weapon-root switch pose is not scaled'
);
assert(
  main.includes('equipSanity:P._firstPersonWeaponEquipSanity') &&
    main.includes('pistolReequip:P._firstPersonPistolReequipCleanup') &&
    main.includes('switchPulseDecay:P._firstPersonWeaponSwitchPulseDecay'),
  'weapon visual status does not expose equip sanity'
);
assert(
  main.includes("FIRST_PERSON_IDLE_ARM_UPRIGHT_VERSION='first-person-idle-arm-upright.v1'") &&
    main.includes("FIRST_PERSON_PISTOL_POSE_STABILITY_VERSION='first-person-pistol-pose-stability.v1'") &&
    main.includes('idleArmUpright:P._firstPersonIdleArmUpright') &&
    main.includes('pistolPoseStability:P._firstPersonPistolPoseStability'),
  'pistol idle arm upright state is not exposed for switch regression debugging'
);

console.log(JSON.stringify({ ok: true, probe: 'pistol-switch-viewmodel-static' }, null, 2));
