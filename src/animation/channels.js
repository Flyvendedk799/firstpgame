import { ANIMATION_CHANNELS } from './profiles.js';

function finiteNumber(v) {
  return Number.isFinite(Number(v));
}

export function createAnimationChannelState() {
  return {
    frame: 0,
    owners: Object.fromEntries(ANIMATION_CHANNELS.map((id) => [id, null])),
    conflicts: [],
    samples: []
  };
}

export function beginAnimationFrame(state, frame = 0) {
  const s = state || createAnimationChannelState();
  s.frame = Number(frame) || 0;
  for (const id of ANIMATION_CHANNELS) s.owners[id] = null;
  s.conflicts.length = 0;
  s.samples.length = 0;
  return s;
}

export function claimAnimationChannel(state, channel, owner, detail = {}) {
  const s = state || createAnimationChannelState();
  const id = ANIMATION_CHANNELS.includes(channel) ? channel : 'additive';
  const next = String(owner || 'unknown');
  const prev = s.owners[id];
  if (prev && prev !== next) {
    s.conflicts.push({ channel: id, previousOwner: prev, nextOwner: next, detail });
  }
  s.owners[id] = next;
  return { channel: id, owner: next, conflict: prev && prev !== next };
}

export function recordTransformSample(state, label, transform = {}) {
  const s = state || createAnimationChannelState();
  const values = [];
  if (transform.position) values.push(transform.position.x, transform.position.y, transform.position.z);
  if (transform.rotation) values.push(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  if (transform.scale) values.push(transform.scale.x, transform.scale.y, transform.scale.z);
  for (const key of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz']) {
    if (transform[key] != null) values.push(transform[key]);
  }
  const ok = values.every(finiteNumber);
  const row = { label: String(label || 'sample'), ok, checked: values.length };
  if (!ok) row.values = values.map((v) => (finiteNumber(v) ? Number(v) : String(v)));
  s.samples.push(row);
  return row;
}

export function animationChannelReport(state) {
  const s = state || createAnimationChannelState();
  return {
    frame: s.frame || 0,
    owners: { ...s.owners },
    conflicts: s.conflicts.slice(-16),
    samples: s.samples.slice(-32),
    ok: s.conflicts.length === 0 && s.samples.every((row) => row.ok)
  };
}
