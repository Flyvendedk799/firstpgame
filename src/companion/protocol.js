export const COMPANION_PROTOCOL_VERSION = 1;

export const COMPANION_MESSAGES = Object.freeze({
  HOST_CREATE_ROOM: 'host:createRoom',
  HOST_SNAPSHOT: 'host:snapshot',
  HOST_EVENT: 'host:event',
  HOST_DRONE_FRAME: 'host:droneFrame',
  HOST_REJECT: 'host:reject',
  HOST_CLOSE_ROOM: 'host:closeRoom',

  COMPANION_JOIN: 'companion:join',
  COMPANION_READY: 'companion:ready',
  COMPANION_IDENTITY: 'companion:identity',
  COMPANION_PONG: 'companion:pong',

  SIGNAL_TUNE: 'signal:tune',
  ROUTE_DRAW: 'route:draw',
  PING_ADD: 'ping:add',
  QUICK_COMMS_SEND: 'quickComms:send',
  DOOR_ACTION: 'door:action',
  LIGHT_ACTION: 'light:action',
  COMMS_FAKE_ORDER: 'comms:fakeOrder',
  PANIC_TRIGGER: 'panic:trigger',

  DRONE_LAUNCH: 'drone:launch',
  DRONE_INPUT: 'drone:input',
  DRONE_FIRE: 'drone:fire',
  DRONE_RECALL: 'drone:recall',

  RELAY_ROOM_CREATED: 'relay:roomCreated',
  RELAY_COMPANION_ACCEPTED: 'relay:companionAccepted',
  RELAY_COMPANION_JOINED: 'relay:companionJoined',
  RELAY_COMPANION_LEFT: 'relay:companionLeft',
  RELAY_ERROR: 'relay:error',
  RELAY_PING: 'relay:ping',
  RELAY_PONG: 'relay:pong',
});

export function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeText(value, fallback = '', max = 32) {
  return String(value == null ? fallback : value)
    .replace(/[^\w .#:-]/g, '')
    .trim()
    .slice(0, max);
}

export function makeSessionId(prefix = 'cmp') {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}
