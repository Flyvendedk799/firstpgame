/**
 * Static checks: every campaign building has an encounter def; zone doors resolve;
 * floorplan graph (bounds, exits, primaryRoutes) is consistent.
 */
import { CAMPAIGN_ENCOUNTERS, transitionDoorToZoneId, MANDATORY_FLOORPLAN_SPACE_IDS_BY_BN } from '../src/campaignEncounters.js';
import { validateCampaignFloorplanGraph } from '../src/campaignFloorplanAuthoring.js';
import { NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE } from '../src/campaign/nativeEncounterNarrative.js';
import { CAMPAIGN_LAYOUT_BY_BN } from '../src/levelSequences.js';

const errors = [];
const warnings = [];

/**
 * Meso clearance: zoneDoorRequires, authored spawn ids, room_clear sanity, alertLink graph.
 * @param {string} label e.g. B01
 * @param {object} def CAMPAIGN_ENCOUNTERS[bn]
 */
function validateEncounterDoorGraph(label, def) {
  const encounters = Array.isArray(def.encounters) ? def.encounters : [];
  const encIds = new Set();
  const enemyIdToEncounter = new Map();
  for (const enc of encounters) {
    if (!enc || !enc.id) continue;
    if (encIds.has(enc.id)) errors.push(`${label}: duplicate encounter id ${enc.id}`);
    encIds.add(enc.id);
    if (!Array.isArray(enc.enemies)) continue;
    for (const u of enc.enemies) {
      if (!u || !u.id) {
        errors.push(`${label}: encounter ${enc.id} has enemy row without id`);
        continue;
      }
      if (enemyIdToEncounter.has(u.id)) {
        errors.push(
          `${label}: duplicate enemy id ${u.id} (was ${enemyIdToEncounter.get(u.id)}, also ${enc.id})`,
        );
      } else {
        enemyIdToEncounter.set(u.id, enc.id);
      }
    }
  }
  for (const enc of encounters) {
    if (!enc) continue;
    const ct = enc.completion && enc.completion.type;
    if (ct === 'room_clear') {
      const n = Array.isArray(enc.enemies) ? enc.enemies.length : 0;
      if (n === 0 && !enc.completion.allowZeroHostiles) {
        errors.push(
          `${label}: room_clear encounter ${enc.id} has no enemies (add enemies or completion.allowZeroHostiles)`,
        );
      }
    }
    if (Array.isArray(enc.enemies)) {
      for (const u of enc.enemies) {
        if (!u || !Array.isArray(u.alertLink)) continue;
        for (const lid of u.alertLink) {
          if (lid && !enemyIdToEncounter.has(lid)) {
            errors.push(`${label}: encounter ${enc.id} alertLink unknown enemy id ${lid}`);
          }
        }
      }
    }
  }
  const sp = def.authoredSpawns;
  if (sp && typeof sp === 'object') {
    for (const key of ['frontZone', 'middleZone', 'backZone']) {
      const arr = sp[key];
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || !row.id) continue;
        if (!enemyIdToEncounter.has(row.id)) {
          errors.push(`${label}: authoredSpawns.${key} id ${row.id} not in any encounter.enemies`);
        }
      }
    }
  }
  const dir = def.director;
  if (dir && dir.zoneDoorRequires && typeof dir.zoneDoorRequires === 'object') {
    for (const [zk, req] of Object.entries(dir.zoneDoorRequires)) {
      const zi = Number(zk);
      if (zk !== String(zi) || (zi !== 0 && zi !== 1)) {
        errors.push(`${label}: zoneDoorRequires key must be 0 or 1, got ${JSON.stringify(zk)}`);
        continue;
      }
      if (!req || !Array.isArray(req.encounterIds)) {
        errors.push(`${label}: zoneDoorRequires[${zk}] missing encounterIds array`);
        continue;
      }
      for (const eid of req.encounterIds) {
        if (!eid || !encIds.has(eid)) {
          errors.push(`${label}: zoneDoorRequires[${zk}] unknown encounter id ${JSON.stringify(eid)}`);
        }
      }
    }
  }
  if (dir && Array.isArray(dir.objectives)) {
    for (const ob of dir.objectives) {
      if (!ob || !ob.completeEncounterId) continue;
      if (!encIds.has(ob.completeEncounterId)) {
        errors.push(
          `${label}: director.objectives completeEncounterId ${ob.completeEncounterId} not in encounters`,
        );
      }
    }
  }
}

if (!Array.isArray(CAMPAIGN_LAYOUT_BY_BN) || CAMPAIGN_LAYOUT_BY_BN.length !== 12) {
  errors.push('CAMPAIGN_LAYOUT_BY_BN must be a length-12 array (sync with buildLevel / levelSequences)');
}

for (let bn = 1; bn <= 12; bn++) {
  const label = `B${String(bn).padStart(2, '0')}`;
  const def = CAMPAIGN_ENCOUNTERS[bn];
  if (!def) {
    errors.push(`Missing CAMPAIGN_ENCOUNTERS[${bn}]`);
    continue;
  }
  const fp = def.floorplan;
  if (!fp || !fp.spaces || typeof fp.spaces !== 'object') {
    errors.push(`${label}: floorplan.spaces missing`);
  }
  const graph = validateCampaignFloorplanGraph(label, def);
  errors.push(...graph.errors);
  warnings.push(...graph.warnings);
  validateEncounterDoorGraph(label, def);
  const mandatory = MANDATORY_FLOORPLAN_SPACE_IDS_BY_BN[bn];
  if (mandatory && fp && fp.spaces) {
    for (const sid of mandatory) {
      if (!fp.spaces[sid]) {
        errors.push(`${label}: mandatory floorplan space missing: ${sid}`);
      }
    }
  }
  const tr = fp && fp.transitions;
  if (tr && typeof tr === 'object') {
    for (const [tid, row] of Object.entries(tr)) {
      if (!row || row.kind !== 'zone_door' || row.door == null) continue;
      const z = transitionDoorToZoneId(row.door);
      if (z == null) {
        errors.push(`${label} transition ${tid}: unknown zone door ${JSON.stringify(row.door)}`);
      }
    }
  }

  const shell = typeof def.shellTieIn === 'string' ? def.shellTieIn.trim() : '';
  if (shell.length < 48) {
    errors.push(`${label}: encounter def missing shellTieIn (tie macro shell + authored kits; min ~48 chars)`);
  }
  if (bn >= 2) {
    const narr = NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[bn];
    const narrShell = narr && typeof narr.shellTieIn === 'string' ? narr.shellTieIn.trim() : '';
    if (narrShell.length < 48) {
      errors.push(`${label}: NATIVE_CAMPAIGN_ENCOUNTER_NARRATIVE[${bn}].shellTieIn missing or too short`);
    }
    const expected = CAMPAIGN_LAYOUT_BY_BN[bn - 1];
    const wantsLobby = expected === 1;
    if (wantsLobby && !/\b[Ll]obby\b|\b[Ll]obby shell\b|\bmirrored\b/i.test(narrShell)) {
      errors.push(`${label}: shellTieIn should mention lobby/mirrored shell (layout 1 for this building)`);
    }
    if (!wantsLobby && !/\b[Dd]ock\b|\b[Bb]01\b|\bunmirrored\b|\bclassic\b/i.test(narrShell)) {
      errors.push(`${label}: shellTieIn should mention dock / classic / unmirrored shell (layout 0 for this building)`);
    }
  } else if (bn === 1) {
    if (!/\b[Dd]ock\b/i.test(shell)) {
      errors.push(`${label}: B01 shellTieIn should state dock shell / layout 0`);
    }
  }
}

for (const w of warnings) console.warn(w);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  'validate-campaign: OK (buildings 1–12, floorplan graph, transition doors, shellTieIn ↔ layout, encounter/door graph)',
);
