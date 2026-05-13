/**
 * Prints per-building / per-cell SEQUENCE_DEFS density plus campaign route
 * completion metrics for the map-design pass.
 *
 * Run: node scripts/sequence-def-density-audit.mjs
 */
import {
  ROUTE_COMPLETION_ELEMENTS_BY_BN,
  ROUTE_INTENT_BY_BN,
  SEQUENCE_DEFS,
} from '../src/levelSequences.js';
import { CAMPAIGN_ENCOUNTERS } from '../src/campaignEncounters.js';
import { COVER_HINT_ANCHOR_PATCH_BY_BN } from '../src/campaign/nativeEncounterTactics.js';
import { ENCOUNTER_PATROL_ROUTES } from '../src/encounterPatrolRoutes.js';

const CELLS = ['FW', 'FC', 'FE', 'MW', 'ME', 'BW', 'BE', 'BC'];
const TAG = {
  cover: (t) => t === 'cov' || t === 'bar' || t === 'bench' || t === 'stack' || t === 'crate2' || t === 'cart',
  vertical: (t) => t === 'tall' || t === 'container' || t === 'pipes' || t === 'pil' || t === 'rack' || t === 'ac' || t === 'shelf',
  interact: (t) => t === 'console' || t === 'desk' || t === 'forklift',
  hazard: (t) => t === 'haz',
  light: (t) => t === 'pend' || t === 'lamp' || t === 'speaker',
};

const COVER_TIER = {
  knee: new Set(['rail', 'rope', 'haz', 'lamp', 'plinth', 'plinthrow', 'turnstiles']),
  chest: new Set(['cov', 'bar', 'bench', 'benchrow', 'desk', 'console', 'crate2', 'cart', 'drum', 'bed', 'booth', 'helm', 'optable', 'vend']),
  full: new Set(['tall', 'container', 'pipes', 'pil', 'rack', 'rackaisle', 'shelf', 'shelfrow', 'stack', 'ac', 'curtain', 'curtainrow', 'battery', 'glass', 'mirrorwall', 'arch']),
};

const KIT_COVER_TIER = {
  guidedTunnel: ['chest', 'full'],
  serviceHall: ['knee', 'chest', 'full'],
  sidePocket: ['chest'],
  offsetRoom: ['chest'],
  glassPreview: ['knee'],
  vestibuleThreshold: ['knee'],
  returnLoop: ['chest', 'full'],
  signatureGate: ['full'],
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

function tierHits(elements) {
  const out = { knee: 0, chest: 0, full: 0 };
  for (const e of elements || []) {
    if (!e) continue;
    if (e.cover && out[e.cover] != null) {
      out[e.cover]++;
      continue;
    }
    for (const [tier, set] of Object.entries(COVER_TIER)) {
      if (set.has(e.t)) out[tier]++;
    }
    for (const tier of KIT_COVER_TIER[e.t] || []) out[tier]++;
  }
  return out;
}

function row(bn, ck) {
  const def = SEQUENCE_DEFS[bn];
  if (!def || !def.cells || !def.cells[ck]) return null;
  const els = def.cells[ck].elements || [];
  const types = els.map((e) => e.t).filter(Boolean);
  const c = classify(types);
  return { n: els.length, ...c, ...tierHits(els) };
}

function routeMetrics(bn) {
  const route = ROUTE_COMPLETION_ELEMENTS_BY_BN[bn] || [];
  const fp = CAMPAIGN_ENCOUNTERS[bn] && CAMPAIGN_ENCOUNTERS[bn].floorplan;
  const spaces = fp && fp.spaces ? Object.entries(fp.spaces) : [];
  const routeSpaces = spaces.filter(([, s]) => s && s.parentRoom);
  const routeTypes = route.map((e) => e.t);
  const patrolTags = new Set();
  const coverTags = new Set();
  for (const enc of CAMPAIGN_ENCOUNTERS[bn]?.encounters || []) {
    for (const u of enc.enemies || []) {
      if (u.patrol) patrolTags.add(u.patrol);
      if (u.cover || u.coverHint) coverTags.add(u.coverHint || u.cover);
    }
  }
  const missingPatrol = [...patrolTags].filter((tag) => !ENCOUNTER_PATROL_ROUTES[tag]);
  const anchorPatch = COVER_HINT_ANCHOR_PATCH_BY_BN[bn] || {};
  const missingAnchors = [...coverTags].filter((tag) => tag && !anchorPatch[tag]);
  const tiers = tierHits(route);
  return {
    kits: route.length,
    nonWave: routeSpaces.length,
    tunnels: routeTypes.filter((t) => t === 'guidedTunnel' || t === 'serviceHall' || t === 'vestibuleThreshold').length,
    loops: routeTypes.filter((t) => t === 'returnLoop').length,
    previews: routeTypes.filter((t) => t === 'glassPreview' || t === 'vestibuleThreshold' || t === 'serviceHall').length,
    signature: routeTypes.filter((t) => t === 'signatureGate').length,
    floorplanParents: routeSpaces.filter(([, s]) => !!s.parentRoom).length,
    routeTierKnee: tiers.knee,
    routeTierChest: tiers.chest,
    routeTierFull: tiers.full,
    patrolTags: patrolTags.size,
    missingPatrol,
    missingAnchors,
    hasIntent: !!ROUTE_INTENT_BY_BN[bn],
  };
}

const errors = [];

console.log('# SEQUENCE_DEFS density (element count + variety + cover tiers)\n');
console.log('| bn | cell | n | cov+bar | vert | interact | haz | light | knee | chest | full |');
console.log('|----|------|---|---------|------|----------|-----|-------|------|-------|------|');

for (let bn = 1; bn <= 12; bn++) {
  const def = SEQUENCE_DEFS[bn];
  if (!def) continue;
  for (const ck of CELLS) {
    const r = row(bn, ck);
    if (!r) continue;
    const cov = r.cover;
    const v = `${r.n}|${cov}|${r.vertical}|${r.interact}|${r.hazard}|${r.light}|${r.knee}|${r.chest}|${r.full}`;
    console.log(`| ${bn} | ${ck} | ${v} |`);
  }
}

console.log('\n# Campaign route-completion audit\n');
console.log('| bn | kits | non-wave spaces | tunnels | loops | previews | signature | route cover k/c/f | patrol tags | status |');
console.log('|----|------|-----------------|---------|-------|----------|-----------|-------------------|-------------|--------|');

for (let bn = 1; bn <= 12; bn++) {
  const m = routeMetrics(bn);
  const status = [];
  if (!m.hasIntent) status.push('missing-intent');
  if (m.kits < 4) status.push('few-kits');
  if (m.nonWave < 4) status.push('few-subspaces');
  if (m.tunnels < 1) status.push('no-tunnel');
  if (m.previews < 1) status.push('no-preview');
  if (m.signature < 1) status.push('no-signature');
  if (m.routeTierChest < 1 || m.routeTierFull < 1) status.push('weak-route-cover');
  if (m.missingPatrol.length) status.push(`missing-patrol:${m.missingPatrol.join(',')}`);
  if (m.missingAnchors.length) status.push(`missing-anchor:${m.missingAnchors.join(',')}`);
  const label = status.length ? status.join('; ') : 'OK';
  if (status.length) errors.push(`B${String(bn).padStart(2, '0')}: ${label}`);
  console.log(
    `| ${bn} | ${m.kits} | ${m.nonWave} | ${m.tunnels} | ${m.loops} | ${m.previews} | ${m.signature} | ${m.routeTierKnee}/${m.routeTierChest}/${m.routeTierFull} | ${m.patrolTags} | ${label} |`,
  );
}

if (errors.length) {
  console.error(`\nsequence-def-density-audit: FAIL\n${errors.join('\n')}`);
  process.exit(1);
}

console.log('\nsequence-def-density-audit: OK (density, route kits, subspaces, previews, signatures, AI anchors/patrols)');
