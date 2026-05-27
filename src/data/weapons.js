// ── WEAPONS ───────────────────────────────────────────────────────────────────
export const WEAPONS=[
  {name:'M4A1',slot:'',playable:false,removed:true,mag:30,res:90, fireRate:.10,dmg:35,hsDmg:200,reloadTime:2.2,spread:.025,adsSpread:.008,shX:.30,shY:.16,recoilX:.055,recoilZ:.022,muzzleZ:-.49,ejectX:.038,ejectY:.032,ejectZ:-.04,auto:true},
  {name:'USP-T',slot:'[1/6]',mag:12,res:36,fireRate:.30,dmg:55,hsDmg:80,reloadTime:1.5,spread:.012,adsSpread:.003,shX:.30,shY:.16,recoilX:.060,recoilZ:.022,muzzleZ:-.15,ejectX:.028,ejectY:.042,ejectZ:.00,auto:false,suppressed:true},
  {name:'THROWING KNIFE',slot:'',playable:false,removed:true,mag:1,res:0,fireRate:.55,dmg:200,hsDmg:999,reloadTime:0,spread:0,adsSpread:0,shX:.10,shY:.05,recoilX:.020,recoilZ:.005,auto:false,recoverChance:1},
  {name:'TAC-12 SHOTGUN',slot:'[2/6]',mag:6,res:18,fireRate:.85,dmg:30,hsDmg:120,reloadTime:2.6,spread:.105,adsSpread:.060,shX:.55,shY:.28,recoilX:.140,recoilZ:.050,muzzleZ:-.52,ejectX:.030,ejectY:.040,ejectZ:.04,auto:false,pellets:7,falloffNear:6,falloffFar:12,falloffMul:.25},
  {name:'MP9 SUPPRESSED',slot:'[3/6]',mag:32,res:64,fireRate:.075,dmg:22,hsDmg:140,reloadTime:1.8,spread:.038,adsSpread:.014,shX:.18,shY:.10,recoilX:.030,recoilZ:.012,muzzleZ:-.40,ejectX:.030,ejectY:.030,ejectZ:-.04,auto:true,suppressed:true,falloffNear:15,falloffFar:25,falloffMul:.5},
  {name:'MK14 DMR',  slot:'[4/6]',mag:10,res:40, fireRate:.32,dmg:75,hsDmg:300,reloadTime:2.4,spread:.012,adsSpread:.002,shX:.45,shY:.24,recoilX:.090,recoilZ:.030,muzzleZ:-.55,ejectX:.038,ejectY:.034,ejectZ:-.04,auto:false,wallbang:true},
  {name:'P226 SUPP', slot:'[5/6]',mag:12,res:36, fireRate:.22,dmg:55,hsDmg:75,reloadTime:1.4,adsTimeMul:.85,spread:.011,adsSpread:.003,shX:.18,shY:.08,recoilX:.045,recoilZ:.018,muzzleZ:-.30,ejectX:.030,ejectY:.040,ejectZ:.00,auto:false,suppressed:true},
  {name:'AWM SNIPER',slot:'[6/6]',mag:5, res:15, fireRate:1.10,dmg:185,hsDmg:999,reloadTime:3.0,spread:.005,adsSpread:.0008,shX:.85,shY:.45,recoilX:.180,recoilZ:.060,muzzleZ:-.62,ejectX:.038,ejectY:.034,ejectZ:-.04,auto:false,wallbang:true,bigZoom:true,breathHold:.4}
];
export const PLAYABLE_WEAPON_INDICES=WEAPONS.map((w,i)=>w&&w.playable!==false&&!w.removed?i:-1).filter(i=>i>=0);
export const START_WEAPON_IDX=PLAYABLE_WEAPON_INDICES[0]??0;
export const START_WEAPON=WEAPONS[START_WEAPON_IDX]||WEAPONS[0];
export function isPlayableWeaponIdx(idx){return PLAYABLE_WEAPON_INDICES.includes(idx|0);}
export function normalizeWeaponIdx(idx,fallback=START_WEAPON_IDX){
  const n=Number.isFinite(Number(idx))?(Number(idx)|0):fallback;
  const fb=Number.isFinite(Number(fallback))?(Number(fallback)|0):START_WEAPON_IDX;
  if(isPlayableWeaponIdx(n))return n;
  if(isPlayableWeaponIdx(fb))return fb;
  return START_WEAPON_IDX;
}
export function weaponIdxForDisplaySlot(slotNumber){
  const s=(Number(slotNumber)|0)-1;
  return s>=0&&s<PLAYABLE_WEAPON_INDICES.length?PLAYABLE_WEAPON_INDICES[s]:null;
}
export function nextPlayableWeaponIdx(current,dir=1){
  const list=PLAYABLE_WEAPON_INDICES;
  if(!list.length)return current|0;
  const step=dir>=0?1:-1;
  let at=list.indexOf(current|0);
  if(at<0)at=step>0?-1:0;
  return list[(at+step+list.length)%list.length];
}

// ── ATTACHMENTS ───────────────────────────────────────────────────────────────
// 4 tiers per type. Multipliers applied at fire/ADS time.
//   spreadMul/adsSpreadMul < 1 = tighter; adsSpeedMul > 1 = faster ADS lerp
export const ATTACHMENT_DEFS={
  scope:[
    {tier:1,type:'scope',name:'IRON RDS', desc:'Open-top red dot',  spreadMul:.92,adsSpreadMul:.85,adsSpeedMul:1.05,pipFov:14,adsScaleMul:.70,dotRadiusMul:1.00,haloRadiusMul:1.00,pipOpacityMax:.90,reticleShape:'dot',dotColor:0xff2820,haloColor:0xff5050,bodyColor:0x252530,lensColor:0x102020,glowEm:0x081208,vignetteColor:'rgba(255,64,64,.08)'},
    {tier:2,type:'scope',name:'COMP RDS', desc:'Compact red dot',   spreadMul:.85,adsSpreadMul:.74,adsSpeedMul:1.18,pipFov:12,adsScaleMul:.80,dotRadiusMul:1.08,haloRadiusMul:1.10,pipOpacityMax:.93,reticleShape:'ring',dotColor:0xff3838,haloColor:0xff6868,bodyColor:0x1a1a1f,lensColor:0x142020,glowEm:0x0a1410,vignetteColor:'rgba(255,82,82,.09)'},
    {tier:3,type:'scope',name:'HOLO RDS', desc:'Wide holographic',  spreadMul:.78,adsSpreadMul:.62,adsSpeedMul:1.28,pipFov:10,adsScaleMul:.90,dotRadiusMul:1.20,haloRadiusMul:1.22,pipOpacityMax:.95,reticleShape:'dotRing',dotColor:0x40ff80,haloColor:0x80ffa0,bodyColor:0x12141a,lensColor:0x103020,glowEm:0x10381c,vignetteColor:'rgba(80,255,160,.10)'},
    {tier:4,type:'scope',name:'PRISM RDS',desc:'Prism reticle',     spreadMul:.65,adsSpreadMul:.48,adsSpeedMul:1.42,pipFov:8,adsScaleMul:1.00,dotRadiusMul:1.35,haloRadiusMul:1.30,pipOpacityMax:.97,reticleShape:'chevron',dotColor:0x40c8ff,haloColor:0x80e0ff,bodyColor:0x0e0e16,lensColor:0x102030,glowEm:0x183848,vignetteColor:'rgba(96,200,255,.14)'}
  ],
  mag:[
    {tier:1,type:'mag',name:'STD MAG',     desc:'Standard capacity',           magMul:1.00,reloadMul:1.00,dmgMul:1.00},
    {tier:2,type:'mag',name:'EXTENDED',    desc:'+30% mag capacity',           magMul:1.30,reloadMul:1.05,dmgMul:1.00},
    {tier:3,type:'mag',name:'FAST EJECT',  desc:'-25% reload time',            magMul:1.00,reloadMul:0.75,dmgMul:1.00},
    {tier:4,type:'mag',name:'AP ROUND',    desc:'+18% damage · armor pierce',  magMul:0.85,reloadMul:1.00,dmgMul:1.18}
  ],
  muzzle:[
    {tier:1,type:'muzzle',name:'A2 BRAKE',  desc:'Reduces vertical recoil',    recoilMul:.90,spreadMul:1.00,suppressed:false},
    {tier:2,type:'muzzle',name:'COMPENSATOR',desc:'Tighter horizontal',        recoilMul:.85,spreadMul:.92, suppressed:false},
    {tier:3,type:'muzzle',name:'SUPPRESSOR',desc:'Silenced — no LOS alert',     recoilMul:1.00,spreadMul:1.05,suppressed:true},
    {tier:4,type:'muzzle',name:'HEAVY BARREL',desc:'Tightest spread, more recoil',recoilMul:1.10,spreadMul:.78,suppressed:false}
  ],
  foregrip:[
    {tier:1,type:'foregrip',name:'POLY GRIP',     desc:'Standard control grip',     recoilMul:.95,adsSpeedMul:1.05,spreadMul:1.00},
    {tier:2,type:'foregrip',name:'ANGLED',         desc:'Faster ADS transition',     recoilMul:.95,adsSpeedMul:1.20,spreadMul:.95},
    {tier:3,type:'foregrip',name:'VERTICAL',       desc:'Reduced visual recoil',     recoilMul:.80,adsSpeedMul:1.00,spreadMul:.92},
    {tier:4,type:'foregrip',name:'BIPOD GRIP',     desc:'Tightest spread + recoil',  recoilMul:.75,adsSpeedMul:1.00,spreadMul:.85}
  ]
};
export const ATTACH_TIER_COL=['#9aa0aa','#5fcb52','#3aa6ff','#c46bff']; // tier 1..4 swatches
export const GAMEPLAY_QOL_FEEL={
  jumpCoyoteMs:145,
  jumpBufferMs:190,
  slideBufferMs:250,
  landingSlideWindowMs:220,
  vaultBufferMs:185,
  vaultPromptGraceMs:155,
  pickupStickyMs:340,
  pickupStickyRange:2.55,
  reloadDeniedToastMs:720,
  triggerReadyPulse:.46,
  criticalHpRatio:.34
};
export function attachmentScore(a){
  if(!a)return 0;
  const m=(k,d=1)=>Number.isFinite(a[k])?a[k]:d;
  if(a.type==='scope')return Math.round(((1-m('spreadMul'))+(1-m('adsSpreadMul'))+(m('adsSpeedMul')-1))*100);
  if(a.type==='mag')return Math.round(((m('magMul')-1)*55)+((1-m('reloadMul'))*65)+((m('dmgMul')-1)*95));
  if(a.type==='muzzle')return Math.round(((1-m('recoilMul'))*80)+((1-m('spreadMul'))*70)+(a.suppressed?12:0));
  if(a.type==='foregrip')return Math.round(((1-m('recoilMul'))*85)+((1-m('spreadMul'))*70)+((m('adsSpeedMul')-1)*55));
  return Math.round(((1-m('spreadMul'))+(1-m('adsSpreadMul'))+(m('adsSpeedMul')-1))*100);
}
export function randomAttachment(type,minTier,maxTier){
  const list=ATTACHMENT_DEFS[type];if(!list||!list.length)return null;
  const lo=Math.max(0,((minTier|0)||1)-1),hi=Math.min(list.length-1,((maxTier|0)||list.length)-1);
  const idx=lo+Math.floor(Math.random()*(hi-lo+1));
  return Object.assign({},list[idx]);
}
