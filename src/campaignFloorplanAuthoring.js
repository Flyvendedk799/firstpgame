/**
 * Static validation for campaign floorplan graph authoring (no WebGL).
 * Used by scripts/validate-campaign.mjs.
 */

const CONNECTOR_KINDS = new Set(['doorway', 'connector', 'zone_door', 'line_of_sight', 'drop_read']);

/**
 * @param {string} label e.g. "B01"
 * @param {object|null|undefined} def CAMPAIGN_ENCOUNTERS[n]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateCampaignFloorplanGraph(label, def) {
  const errors = [];
  const warnings = [];
  if (!def) {
    errors.push(`${label}: missing encounter def`);
    return { errors, warnings };
  }
  const fp = def.floorplan;
  if (!fp || typeof fp.spaces !== 'object' || !fp.spaces) {
    errors.push(`${label}: floorplan.spaces missing`);
    return { errors, warnings };
  }
  const spaceIds = new Set(Object.keys(fp.spaces));
  for (const [id, s] of Object.entries(fp.spaces)) {
    if (!s || typeof s !== 'object') {
      errors.push(`${label} space ${id}: invalid entry`);
      continue;
    }
    const b = s.bounds;
    if (!b || ![b.x0, b.x1, b.z0, b.z1].every((n) => Number.isFinite(n))) {
      errors.push(`${label} space ${id}: bounds must have finite x0,x1,z0,z1`);
    } else if (b.x1 <= b.x0 || b.z1 <= b.z0) {
      errors.push(`${label} space ${id}: bounds must have x0<x1 and z0<z1`);
    }
    if (!Array.isArray(s.exits)) {
      errors.push(`${label} space ${id}: exits must be an array`);
    } else {
      for (const ex of s.exits) {
        if (typeof ex !== 'string' || !spaceIds.has(ex)) {
          errors.push(`${label} space ${id}: exit "${ex}" is not a known space id`);
        }
      }
    }
    if (s.primaryRoutes != null) {
      if (!Array.isArray(s.primaryRoutes)) {
        errors.push(`${label} space ${id}: primaryRoutes must be an array of space ids`);
      } else {
        for (const rid of s.primaryRoutes) {
          if (typeof rid !== 'string' || !spaceIds.has(rid)) {
            errors.push(`${label} space ${id}: primaryRoutes contains unknown "${rid}"`);
          }
        }
      }
    }
    if (s.connectorWidth != null && (!Number.isFinite(s.connectorWidth) || s.connectorWidth <= 0)) {
      warnings.push(`${label} space ${id}: connectorWidth should be a positive number (meters)`);
    }
  }

  const tr = fp.transitions;
  if (tr && typeof tr === 'object') {
    for (const [tid, row] of Object.entries(tr)) {
      if (!row || typeof row !== 'object') continue;
      if (row.from != null && typeof row.from === 'string' && !spaceIds.has(row.from)) {
        errors.push(`${label} transition ${tid}: unknown from space "${row.from}"`);
      }
      if (row.to != null && typeof row.to === 'string' && !spaceIds.has(row.to)) {
        errors.push(`${label} transition ${tid}: unknown to space "${row.to}"`);
      }
      if (row.kind && !CONNECTOR_KINDS.has(row.kind)) {
        warnings.push(`${label} transition ${tid}: unknown kind "${row.kind}" (allowed: ${[...CONNECTOR_KINDS].join(', ')})`);
      }
    }
  }

  return { errors, warnings };
}
