/**
 * Animation notify ring buffer with per-frame dedupe and optional rate limits.
 * Pure JS — no Three.js dependency.
 */

const RING_CAP = 48;
const RATE_MS = { footstepLeft: 140, footstepRight: 140, breathPeak: 220, slideScrape: 90 };

export function createNotifyRing() {
  return {
    ring: [],
    head: 0,
    size: 0,
    frameId: -1,
    frameSeen: new Set(),
    lastEmitMs: Object.create(null),
    stats: {
      emitted: 0,
      deduped: 0,
      rateLimited: 0,
      byName: Object.create(null)
    }
  };
}

export function resetFrameNotifies(ring, frameId) {
  if (ring.frameId !== frameId) {
    ring.frameId = frameId;
    ring.frameSeen.clear();
  }
}

export function emitPlayerAnimNotify(ring, frameId, nowMs, name, payload) {
  resetFrameNotifies(ring, frameId);
  if (ring.frameSeen.has(name)) {
    if (ring.stats) ring.stats.deduped++;
    return false;
  }
  const minGap = RATE_MS[name];
  if (minGap != null) {
    const hasPrevious = ring.lastEmitMs[name] != null;
    const t0 = hasPrevious ? ring.lastEmitMs[name] : -Infinity;
    if (hasPrevious && nowMs - t0 < minGap) {
      if (ring.stats) ring.stats.rateLimited++;
      return false;
    }
    ring.lastEmitMs[name] = nowMs;
  }
  ring.frameSeen.add(name);
  const e = { t: nowMs * 0.001, frameId, name, payload: payload || null };
  const i = (ring.head + ring.size) % RING_CAP;
  if (ring.size < RING_CAP) {
    ring.ring[i] = e;
    ring.size++;
  } else {
    ring.ring[ring.head] = e;
    ring.head = (ring.head + 1) % RING_CAP;
  }
  if (ring.stats) {
    ring.stats.emitted++;
    ring.stats.byName[name] = (ring.stats.byName[name] || 0) + 1;
  }
  return true;
}

export function getRecentNotifies(ring, max = 24) {
  const out = [];
  for (let k = 0; k < Math.min(max, ring.size); k++) {
    const idx = (ring.head + ring.size - 1 - k + RING_CAP) % RING_CAP;
    if (ring.ring[idx]) out.push(ring.ring[idx]);
  }
  return out;
}

export function getNotifyStats(ring) {
  const stats = ring?.stats || {};
  return {
    emitted: stats.emitted | 0,
    deduped: stats.deduped | 0,
    rateLimited: stats.rateLimited | 0,
    byName: { ...(stats.byName || {}) }
  };
}
