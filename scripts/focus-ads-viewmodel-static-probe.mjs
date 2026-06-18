import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const playerAnimation = readFileSync(join(root, 'src/playerAnimation.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
    main.includes("FOCUS_ADS_VIEWMODEL_STABILITY_VERSION='focus-viewmodel-stability.v2'") &&
    main.includes('function _focusAdsViewmodelMotionFilter(pl=P,rawDx=0,rawDy=0)') &&
    main.includes('const focusIntent=pl&&pl.focusActive?1:0') &&
    main.includes('const focus=THREE.MathUtils.clamp(Math.max(focusVisual,focusIntent),0,1)') &&
    main.includes('const strength=THREE.MathUtils.clamp(focusW*(.72+adsW*.28),0,1)') &&
    main.includes('const cap=THREE.MathUtils.lerp(110,THREE.MathUtils.lerp(54,36,adsW),strength)') &&
    main.includes('const yCap=THREE.MathUtils.lerp(92,THREE.MathUtils.lerp(46,30,adsW),strength)') &&
    main.includes('const scale=THREE.MathUtils.lerp(1,THREE.MathUtils.lerp(.62,.48,adsW),strength)'),
  'focus-only viewmodel mouse filter missing'
);

assert(
  main.includes('const _rawAnimMouseDx=M.dx+(P._animPadLookDx||0)') &&
    main.includes('const _focusAdsMotion=_focusAdsViewmodelMotionFilter(P,_rawAnimMouseDx,_rawAnimMouseDy)') &&
    main.includes('P._animMouseDx=_focusAdsMotion.dx') &&
    main.includes('P.yaw-=M.dx*_ms*adsMs'),
  'camera look must stay raw while animation mouse input is filtered'
);

assert(
  main.includes("_stabilizeFocusAdsViewmodelState('focus-enter')") &&
    !main.includes("if((P.adsVis||P.ads||0)>.35)_stabilizeFocusAdsViewmodelState('focus-enter')") &&
    main.includes("_stabilizeFocusAdsViewmodelState(`focus-exit:${reason}`)") &&
    main.includes('const focusIntent=P.focusActive?1:0') &&
    main.includes('if(focus<.05&&ads<.28&&!recent)return false') &&
    main.includes('P._focusAdsViewmodelRecoveryUntil=nowMs+300') &&
    main.includes('st.turnInertia=(Number.isFinite(st.turnInertia)?st.turnInertia:0)*.18'),
  'focus-only enter/exit viewmodel stabilization missing'
);

assert(
  main.includes('updatePlayerAnimInputs(playerAnimState0,{P,dt:dtFocusLocomotion,inputDt:dt') &&
    playerAnimation.includes('inputDt = dt') &&
    playerAnimation.includes('const inputDtCl = Math.max(0.001, Number.isFinite(inputDt) ? inputDt : dtCl)') &&
    playerAnimation.includes('/ inputDtCl : 0') &&
    playerAnimation.includes('const yawDelta = Math.max(-120, Math.min(120, mouseDx || 0))') &&
    playerAnimation.includes('state.smoothed.turnPlantPulse = dampFn(state.smoothed.turnPlantPulse || 0, 0, 10.5, inputDtCl)') &&
    playerAnimation.includes('state.smoothed.pivotSide = dampFn(state.smoothed.pivotSide || 0, 0, 7.5, inputDtCl)') &&
    playerAnimation.includes('state.smoothed.gaitLean = dampL(') &&
    playerAnimation.includes('state.smoothed.turnInertia = dampL(state.smoothed.turnInertia, yawDelta * 0.0041, 11.5, inputDtCl)'),
  'player animation input sampling is not protected from focus-scaled dt/mouse spikes'
);

assert(
  main.includes('const _focusAdsHandStability=THREE.MathUtils.clamp(Math.max(') &&
    main.includes('const ls=22+_pistolHandSettleFast*16+_focusAdsHandStability*18,lm=14+_pistolHandSettleFast*18+_focusAdsHandStability*20') &&
    main.includes('focusAdsViewmodel:P._focusAdsViewmodelStability') &&
    main.includes('focusAdsRecovery:P._focusAdsViewmodelRecovery'),
  'focus ADS hand stabilization/debug state missing'
);

console.log(JSON.stringify({
  ok: true,
  probe: 'focus-ads-viewmodel-static',
  version: 'focus-viewmodel-stability.v2'
}, null, 2));
