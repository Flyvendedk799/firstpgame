import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLAYABLE_WEAPON_INDICES,
  WEAPONS,
  weaponIdxForDisplaySlot,
} from '../src/data/weapons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');

assert.equal(WEAPONS[2].name, 'COMBAT KNIFE');
assert.equal(WEAPONS[2].removed, undefined);
assert.equal(WEAPONS[2].playable, undefined);
assert.ok(PLAYABLE_WEAPON_INDICES.includes(2), 'knife index should be playable');
assert.equal(weaponIdxForDisplaySlot(2), 2, 'display slot 2 should equip knife');
assert.equal(weaponIdxForDisplaySlot(3), 3, 'display slot 3 should equip shotgun');

const requiredPatterns = [
  'const KNIFE_SLOT_REMOVED=false',
  'function _startKnifeReturn',
  'function _collectStuckKnife',
  'readable-combat-knife-v2',
  'knife-paired-combat.v6',
  'knife-close-choreography.v1',
  'function _findKnifePairTarget',
  'function _ensureKnifePairContactRig',
  'function _updateKnifePairRuntime',
  'knifePair_handle',
  'knifePair_guard',
  'knifePair_ripTrailA',
  'knifePair_bladeGhostA',
  'knifePair_pressureLineA',
  'knifePair_victimBraceA',
  'knifePair_victimFootBraceA',
  'knifePair_bladeScrapeA',
  'knifePair_entryCore',
  'function _knifePairPhaseDirector',
  'function _knifePairTensionEnvelope',
  'knife-pair-tension.v1',
  'function _knifePairWallSafeTarget',
  'cinematicStage',
  'contactPressure',
  'bladePressure',
  'anticipation',
  'shoulderYank',
  'footBrace',
  'bladeHold',
  'microFreeze',
  'bodyClamp',
  'bladeTorque',
  'victimAnchor',
  'wristLock',
  'impactDrag',
  'bladeScrape',
  'counterForce',
  'victimFootStagger',
  'pairBeatDirector',
  'pairSecondary',
  'pairChoreography',
  'enemyShotLock',
  'targetRootLock',
  'woundPressure',
  'closeCombatChoreography',
  'function _knifePairChoreographySnapshot',
  'function _applyKnifePairGameplayChoreography',
  'gun-bash-choreography.v1',
  'function _applyGunBashGameplayChoreography',
  'weaponJolt',
  '_knifePairFovKick',
  'targetOffset',
  'const cinematicDur=heavy?1.02:.82',
  'const yawTo=Math.atan2(-nx,-nz)',
  "pair.ripDone",
  'knife-pair-cinema-blood-stab',
  'pairedKnife',
  'function _sweepKnifeWorldCollision',
  'function _stickKnifeAtSurface',
  "_setKnifeUnavailable('stuck'",
  "_setKnifeUnavailable('returning'",
  "_setCloseCombatHitFlags(closeKind",
  "knife_heavy_stab",
  "knife_slice",
  "_setCloseCombatHitFlags('knife_throw'",
  "_setCloseCombatHitFlags('gun_bash'",
  "storyCloseKillSource=heavy?'knife-heavy-stab-kill':'knife-slice-kill'",
  "source:storyCloseKillSource",
  "source:'gun-bash-kill'",
  "applyStoryMomentumShock(e,hitPoint",
  "applyStoryMomentumShock(enemy,h.point,{source:'gun-bash-kill'}",
  "enemy-finishable-takedown.v1",
  "_finishableUntil",
  "_finishableTakedown",
  "_takedownPromptTarget",
  "TAKEDOWN",
  'closeCombatState:()=>',
  'knifeFeelProbe:',
  'LMB SLICE · RMB STAB · MMB THROW',
];

for (const pattern of requiredPatterns) {
  assert.ok(main.includes(pattern), `missing close-combat pattern: ${pattern}`);
}

assert.ok(/P\.weaponIdx===2&&M\.rmbDown&&!MELEE\.out/.test(main), 'RMB should trigger heavy stab when knife is equipped');
assert.ok(/doMelee\('heavy_stab'\);M\._wasKnifeHeavy=true/.test(main), 'RMB heavy stab call missing');
assert.ok(/if\(P\.weaponIdx===2\)\{\s*if\(!M\._wasFired\)\{doMelee\('light_slice'\);M\._wasFired=true;\}\s*\}/.test(main), 'LMB should light slice when knife is equipped');
assert.ok(/const _adsHeld=!!\(\(M\.rmbDown&&!_knifeRmbIntent\)\|\|P\._debugAdsHold\)/.test(main), 'knife RMB should not be consumed by ADS');
assert.ok(/if\(P\.weaponIdx===2\)\{tryThrowKnife\(\);return;\}/.test(main), 'MMB quick throw should throw equipped knife');
assert.ok(/MELEE\.pair=pair/.test(main) && /target\._knifePairVictim=/.test(main), 'knife attacks should create a paired target victim state');
assert.ok(/pair\.choreography=choreography/.test(main) && /victim\.choreography=choreography/.test(main), 'knife paired choreography should feed pair and victim state');
assert.ok(/_applyKnifePairGameplayChoreography\(target,choreography/.test(main) && /_attackDisruptedUntil/.test(main), 'knife choreography should interrupt enemy gameplay');
assert.ok(/_applyGunBashGameplayChoreography\(enemy/.test(main) && /GUN_BASH_CHOREOGRAPHY_VERSION/.test(main), 'gun bash should apply close-combat choreography');
assert.ok(/KnifePairedCombatRig/.test(main) && /knifePair_blade/.test(main), 'paired knife world contact rig missing');
assert.ok(/const finishable=!!\(e\._finishableUntil&&nowMs<e\._finishableUntil&&e\._finishableTakedown\)/.test(main), 'takedown target finder should include wounded finish windows');
assert.ok(/if\(ratio>\.35&&!finishable\)continue/.test(main), 'finishable takedown should relax low-hp gate only for finishable targets');
assert.ok(/P\._lastTakedownPromptId!==promptId/.test(main), 'finishable takedown prompt pulse missing');

console.log(JSON.stringify({
  ok: true,
  playable: PLAYABLE_WEAPON_INDICES,
  knife: {
    slot: WEAPONS[2].slot,
    name: WEAPONS[2].name,
    fireRate: WEAPONS[2].fireRate,
  },
}, null, 2));
