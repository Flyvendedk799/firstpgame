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
    lastEmitMs: Object.create(null)
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
  if (ring.frameSeen.has(name)) return false;
  const minGap = RATE_MS[name];
  if (minGap != null) {
    const t0 = ring.lastEmitMs[name] || 0;
    if (nowMs - t0 < minGap) return false;
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
