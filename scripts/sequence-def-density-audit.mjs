/**
 * Prints per-building / per-cell SEQUENCE_DEFS element counts and variety tags.
 * Run: node scripts/sequence-def-density-audit.mjs
 */
import { SEQUENCE_DEFS } from '../src/levelSequences.js';

const CELLS = ['FW', 'FC', 'FE', 'MW', 'ME', 'BW', 'BE', 'BC'];
const TAG = {
  cover: (t) => t === 'cov' || t === 'bar' || t === 'bench' || t === 'stack' || t === 'crate2' || t === 'cart',
  vertical: (t) => t === 'tall' || t === 'container' || t === 'pipes' || t === 'pil' || t === 'rack' || t === 'ac' || t === 'shelf',
  interact: (t) => t === 'console' || t === 'desk' || t === 'forklift',
  hazard: (t) => t === 'haz',
  light: (t) => t === 'pend' || t === 'lamp' || t === 'speaker',
};

function classify(types) {
  const keys = Object.keys(TAG);
  const hit = {};
  for (const k of keys) hit[k] = 0;
  for (const t of types) {
    for (const k of keys) {
      if (TAG[k](t)) hit[k]++;
    }
  }
  return hit;
}

function row(bn, ck) {
  const def = SEQUENCE_DEFS[bn];
  if (!def || !def.cells || !def.cells[ck]) return null;
  const els = def.cells[ck].elements || [];
  const types = els.map((e) => e.t).filter(Boolean);
  const c = classify(types);
  return { n: els.length, ...c };
}

console.log('# SEQUENCE_DEFS density (element count + variety)\n');
console.log('| bn | cell | n | cov+bar | vert | interact | haz | light |');
console.log('|----|------|---|---------|------|----------|-----|-------|');

for (let bn = 1; bn <= 12; bn++) {
  const def = SEQUENCE_DEFS[bn];
  if (!def) continue;
  for (const ck of CELLS) {
    const r = row(bn, ck);
    if (!r) continue;
    const cov = r.cover;
    const v = `${r.n}|${cov}|${r.vertical}|${r.interact}|${r.hazard}|${r.light}`;
    console.log(`| ${bn} | ${ck} | ${v} |`);
  }
}
