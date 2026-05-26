export function createPrimaryPlayerState({ THREE, startWeapon, startWeaponIdx } = {}) {
  const START_WEAPON = startWeapon;
  const START_WEAPON_IDX = startWeaponIdx;
  return {pos:new THREE.Vector3(0,.2,18),yaw:Math.PI,pitch:0,lean:0,leanTarget:0,ads:0,adsTarget:0,adsVis:0,adsSettle:0,adsKick:0,scopeSettle:0,scopeEyeX:0,scopeEyeY:0,scopeViewFov:0,scopeVignetteOpacity:0,hp:100,ammo:START_WEAPON.mag,ammoRes:START_WEAPON.res,reloading:false,reloadTimer:0,RELOAD_TIME:START_WEAPON.reloadTime,bobPhase:0,bobAmt:0,dead:false,lastShot:0,FIRE_RATE:START_WEAPON.fireRate,dmgFlash:0,weaponIdx:START_WEAPON_IDX,running:false,
  vy:0,jumpH:0,grounded:true,
  wallJumpTimer:0,wallJumpDur:.42,wallJumpHardenTimer:0,wallJumpVx:0,wallJumpVz:0,wallJumpSide:0,wallJumpImpact:0,wallJumpNx:0,wallJumpNz:0,wallContact:null,
  dropkickActive:false,dropkickT:0,dropkickTimer:0,dropkickDur:.58,dropkickCooldown:0,dropkickDirX:0,dropkickDirZ:-1,dropkickImpact:0,dropkickLandTimer:0,dropkickLandDur:.46,dropkickHitEnemies:null,
  vaulting:false,vaultT:0,vaultDur:0.58,vaultFrom:null,vaultTo:null,vaultObH:0,
  nearVault:null,vaultGunRot:0,vaultGunX:0,vaultGunY:0,vaultDir:'forward',
  // Camera dynamics: landing dip, damage roll, breathing/idle sway
  landKick:0,dmgRoll:0,dmgPitch:0,
  // Smoothed sprint amount (0..1) for gun-down pose
  sprintAmt:0,
  // Slide state — duration-gated, momentum-carrying low-stance dash
  sliding:false,slideAmt:0,slideTarget:0,slideTimer:0,slideDirX:0,slideDirZ:0,slideLocalR:0,slideLocalF:1,
  slideCarryTimer:0,slideExitGrace:0,
  guardBehindHeld:false,guardBehindActive:false,guardBehindAmt:0,guardPeekUp:0,guardPeekSide:0,guardPeekForward:0,guardNormalX:0,guardNormalZ:1,guardTangentX:1,guardTangentZ:0,guardCover:null,guardCoverReady:0,guardCoverDist:0,guardMode:'none',
  // Attachment slots (one per type). null = empty.
  attachments:{scope:null,mag:null,muzzle:null,foregrip:null},
  // Pickup interaction state
  nearPickup:null,
  // Economy
  money:0,healPacks:0,grenades:0,
  // Per-weapon ammo state — preserved across swaps so swapping isn't a free reload.
  weaponAmmo:[30,12,999,6,32,10,12,5],
  weaponRes:[90,36,99,18,64,40,36,15],focus:1.0,focusActive:false,timeScale:1.0,score:0,kills:0,headshots:0,shotsFired:0,shotsHit:0,execs:0,combo:null,maxHp:100,smokes:1,flashes:1};
}

export function createSecondaryPlayerState({ THREE, startWeapon, startWeaponIdx } = {}) {
  const START_WEAPON = startWeapon;
  const START_WEAPON_IDX = startWeaponIdx;
  return {pos:new THREE.Vector3(1.5,.2,18),yaw:0,pitch:0,lean:0,leanTarget:0,ads:0,adsTarget:0,adsVis:0,adsSettle:0,adsKick:0,scopeSettle:0,scopeEyeX:0,scopeEyeY:0,scopeViewFov:0,scopeVignetteOpacity:0,hp:100,ammo:START_WEAPON.mag,ammoRes:START_WEAPON.res,reloading:false,reloadTimer:0,RELOAD_TIME:START_WEAPON.reloadTime,bobPhase:0,bobAmt:0,dead:false,lastShot:0,FIRE_RATE:START_WEAPON.fireRate,dmgFlash:0,weaponIdx:START_WEAPON_IDX,running:false,
  vy:0,jumpH:0,grounded:true,
  wallJumpTimer:0,wallJumpDur:.42,wallJumpHardenTimer:0,wallJumpVx:0,wallJumpVz:0,wallJumpSide:0,wallJumpImpact:0,wallJumpNx:0,wallJumpNz:0,wallContact:null,
  dropkickActive:false,dropkickT:0,dropkickTimer:0,dropkickDur:.58,dropkickCooldown:0,dropkickDirX:0,dropkickDirZ:-1,dropkickImpact:0,dropkickLandTimer:0,dropkickLandDur:.46,dropkickHitEnemies:null,
  vaulting:false,vaultT:0,vaultDur:0.58,vaultFrom:null,vaultTo:null,vaultObH:0,
  nearVault:null,vaultGunRot:0,vaultGunX:0,vaultGunY:0,vaultDir:'forward',
  landKick:0,dmgRoll:0,dmgPitch:0,
  sprintAmt:0,
  sliding:false,slideAmt:0,slideTarget:0,slideTimer:0,slideDirX:0,slideDirZ:0,slideLocalR:0,slideLocalF:1,
  slideCarryTimer:0,slideExitGrace:0,
  guardBehindHeld:false,guardBehindActive:false,guardBehindAmt:0,guardPeekUp:0,guardPeekSide:0,guardPeekForward:0,guardNormalX:0,guardNormalZ:1,guardTangentX:1,guardTangentZ:0,guardCover:null,guardCoverReady:0,guardCoverDist:0,guardMode:'none',
  crouching:false,crouchAmt:0,
  attachments:{scope:null,mag:null,muzzle:null,foregrip:null},
  nearPickup:null,
  money:0,healPacks:0,grenades:0,
  weaponAmmo:[30,12,999,6,32,10,12,5],
  weaponRes:[90,36,99,18,64,40,36,15],focus:1.0,focusActive:false,timeScale:1.0,score:0,kills:0,headshots:0,shotsFired:0,shotsHit:0,execs:0,combo:null,maxHp:100,smokes:1,flashes:1};
}

export function createHandAnimationState() {
  return {
  idlePhase:0,
  // Fire
  fireT:0,firePlaying:false,
  // Stored base positions for lerp targets (in gunGrp local space)
  rBase:{x:.003,y:-.052,z:.042,rx:0,ry:0,rz:0},
  lBase:{x:-.004,y:-.052,z:-.070,rx:.11,ry:0,rz:0},
  // Smoothed working values (lerp toward targets each frame)
  rRX:0,rRY:0,rRZ:0, lRX:.11,lRY:0,lRZ:0,
  idxRX:0,
  // Barrel heat (0..1, accumulates on shot, decays each frame)
  heat:0,
  // Short additive kick when a bullet connects with an enemy.
  hitKickT:0,hitKickDur:.18,hitKickStrength:0,hitKickSide:1,hitKickHead:false,hitKickKill:false,
  // Reticle pulse phase
  reticlePhase:0
};
}

export function createGameState() {
  return {building:1,wave:1,wavesTotal:2,started:false,levelData:null,enemyMgr:null,encounterDirector:null,currentRoomId:null,waveActive:false,exitUnlocked:false,trails:[],hitMarkTimer:0,advancePending:false,vaultables:[],pickups:[],invOpen:false,shopOpen:false,menuOpen:false,knives:[],campaignLevel:null,currentBeat:null,mastery:null,runModifiers:null,
  playMode:'solo',splitScreenActive:false,_ssrSolidsDirty:false,
  // Phase 6 — AI/lean telemetry counters (read by __game.debug.snapshot)
  _aiPeekCount:0,_aiPeekShotsFired:0,_aiAllShotsFired:0,_aiPairsActive:0,_aiRepositions:0,_aiVaults:0,_aiReloads:0,
  _playerLeanShots:0,_playerTotalShots:0,  _floorplanDebugHud:false,_floorplanMapLabels:false};
}
