/**
 * Campaign objective + reinforcement authoring helpers (data → director runtime).
 */

/**
 * @param {object[]|null|undefined} encountersCatalog
 * @returns {{ roomId: string, squad: string, afterSec: number, fireKey: string, requireAlarm: boolean }[]}
 */
export function collectAlarmReinforcementSpecs(encountersCatalog) {
  const out = [];
  if (!Array.isArray(encountersCatalog)) return out;
  for (const enc of encountersCatalog) {
    if (!enc || !Array.isArray(enc.reinforcements)) continue;
    const roomId = enc.room;
    for (const r of enc.reinforcements) {
      const tr = r && r.trigger;
      if (!tr || tr.type !== 'alarm_active_for') continue;
      const squad = r.squad;
      if (!squad || !roomId) continue;
      out.push({
        roomId,
        squad,
        afterSec: Number.isFinite(tr.seconds) ? tr.seconds : 8,
        fireKey: squad,
        requireAlarm: true,
        entry: r.entry || null,
      });
    }
  }
  return out;
}

/**
 * Hold-interact objectives from `encounterDef.director.objectives`.
 * @param {object|null|undefined} director
 * @returns {object[]}
 */
export function getHoldInteractObjectives(director) {
  const list = director && Array.isArray(director.objectives) ? director.objectives : [];
  return list.filter((o) => o && o.type === 'hold_interact');
}

/**
 * @param {object|null|undefined} director
 * @returns {object[]}
 */
export function getTraverseRoomObjectives(director) {
  const list = director && Array.isArray(director.objectives) ? director.objectives : [];
  return list.filter((o) => o && o.type === 'traverse_room' && o.roomId);
}
