import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const controller = readFileSync(join(root, 'src/animation/enemyAnimationController.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(main.includes("version:'enemy-locomotion-realistic-v3'"), 'enemy locomotion v3 version missing');
assert(main.includes('plantAnchorMax:.82'), 'enemy plant anchor tuning missing');
assert(main.includes('swingClearanceMax:.54'), 'enemy swing clearance tuning missing');
assert(main.includes('lateralBraceMax:.34'), 'enemy lateral brace tuning missing');
assert(main.includes('_enemyFootAnchorVis'), 'enemy foot anchor runtime state missing');
assert(main.includes('_enemyStanceCompressionVis'), 'enemy stance compression runtime state missing');
assert(main.includes('_enemySwingClearanceVis'), 'enemy swing clearance runtime state missing');
assert(main.includes('_enemyToeRollVis'), 'enemy toe roll runtime state missing');
assert(main.includes('_enemyLateralBraceVis'), 'enemy lateral brace runtime state missing');
assert(main.includes('plantWindow=THREE.MathUtils.clamp(.52+runBlend*.10'), 'enemy plant window solve missing');
assert(main.includes('footAnchor:_footAnchor'), 'enemy locomotion foot anchor debug missing');
assert(main.includes('stanceCompression:_stanceCompression'), 'enemy locomotion stance compression debug missing');
assert(main.includes('swingClearance:_swingClearance'), 'enemy locomotion swing clearance debug missing');
assert(main.includes('toeRoll:_toeRoll'), 'enemy locomotion toe roll debug missing');
assert(main.includes('lateralBrace:_lateralBrace'), 'enemy locomotion lateral brace debug missing');
assert(main.includes('plantWindow'), 'enemy locomotion plant window debug missing');
assert(main.includes('B.Hips.rotateZ(Math.sin(t)*(.012+runBlend*.010)*(pace.hipSway||1)+plantSide*anchor*.018-lateralBrace*.018)'), 'imported rig hip plant/brace overlay missing');
assert(main.includes('lLRX=-sw*legAmt-leftSwing*.045+rightStance*.025-leftStance*_footAnchor*.070+leftSwing*_swingClearance*.085'), 'procedural left leg plant/swing solve missing');
assert(main.includes('rLRX=sw*legAmt-rightSwing*.045+leftStance*.025-rightStance*_footAnchor*.070+rightSwing*_swingClearance*.085'), 'procedural right leg plant/swing solve missing');
assert(main.includes('lBootRX=-leftSwing*THREE.MathUtils.lerp(.16,.24,runBlend)+leftStance*(.075+_toeRoll*.040)'), 'left boot toe roll solve missing');
assert(main.includes('rBootRX=-rightSwing*THREE.MathUtils.lerp(.16,.24,runBlend)+rightStance*(.075+_toeRoll*.040)'), 'right boot toe roll solve missing');
assert(main.includes('footAnchor:row.locomotion&&row.locomotion.footAnchor'), 'animation feel debug foot anchor missing');
assert(main.includes('swingClearance:row.locomotion&&row.locomotion.swingClearance'), 'animation feel debug swing clearance missing');
assert(controller.includes('footAnchor: clamp01(raw?.footAnchor ?? 0)'), 'enemy animation status foot anchor missing');
assert(controller.includes('stanceCompression: clamp01(raw?.stanceCompression ?? 0)'), 'enemy animation status stance compression missing');
assert(controller.includes('swingClearance: clamp01(raw?.swingClearance ?? 0)'), 'enemy animation status swing clearance missing');
assert(controller.includes('toeRoll: clamp01(raw?.toeRoll ?? 0)'), 'enemy animation status toe roll missing');
assert(controller.includes('lateralBrace: clamp01(raw?.lateralBrace ?? 0)'), 'enemy animation status lateral brace missing');

console.log(JSON.stringify({
  ok: true,
  version: 'enemy-locomotion-realistic-v3',
  fields: ['footAnchor', 'stanceCompression', 'swingClearance', 'toeRoll', 'lateralBrace', 'plantWindow']
}, null, 2));
