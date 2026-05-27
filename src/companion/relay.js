import os from 'node:os';
import { WebSocket, WebSocketServer } from 'ws';
import {
  COMPANION_MESSAGES,
  COMPANION_PROTOCOL_VERSION,
  safeJsonParse,
  sanitizeText,
} from './protocol.js';

const RELAY_PATH = '/__companion/ws';
const INFO_PATH = '/__companion/info';
const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function json(type, payload = {}) {
  return JSON.stringify({
    v: COMPANION_PROTOCOL_VERSION,
    type,
    t: Date.now(),
    ...payload,
  });
}

function sendJson(ws, type, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(json(type, payload));
  return true;
}

function makeRoomCode(existing) {
  for (let attempt = 0; attempt < 64; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!existing.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

function lanAddresses(port) {
  const out = [];
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (!net || net.internal || net.family !== 'IPv4') continue;
      out.push({ label: net.address, urlBase: `http://${net.address}:${port}` });
    }
  }
  return out;
}

function requestPort(req, fallbackPort) {
  const host = String(req.headers.host || '');
  const m = host.match(/:(\d+)$/);
  return m ? Number(m[1]) : fallbackPort;
}

function sameOriginBase(req, fallbackPort) {
  const host = req.headers.host || `localhost:${fallbackPort}`;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

function safeSendBinary(ws, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(data, { binary: true });
  return true;
}

function createRelayState() {
  const rooms = new Map();
  const sockets = new WeakMap();

  function cleanupRooms() {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (!room.host || room.host.readyState !== WebSocket.OPEN || now - room.createdAt > ROOM_TTL_MS) {
        closeRoom(code, 'expired');
      }
    }
  }

  function closeRoom(code, reason = 'closed') {
    const room = rooms.get(code);
    if (!room) return;
    rooms.delete(code);
    sendJson(room.host, COMPANION_MESSAGES.HOST_CLOSE_ROOM, { roomCode: code, reason });
    sendJson(room.companion, COMPANION_MESSAGES.HOST_CLOSE_ROOM, { roomCode: code, reason });
    sockets.delete(room.host);
    if (room.companion) sockets.delete(room.companion);
  }

  function createRoom(ws, msg, req, port) {
    cleanupRooms();
    const prior = sockets.get(ws);
    if (prior && prior.role === 'host' && prior.roomCode) closeRoom(prior.roomCode, 'replaced');

    const code = makeRoomCode(rooms);
    const publicPort = requestPort(req, port);
    const base = sameOriginBase(req, publicPort);
    const companionPath = `/companion.html?code=${encodeURIComponent(code)}`;
    const urls = [
      `${base}${companionPath}`,
      ...lanAddresses(publicPort).map((entry) => `${entry.urlBase}${companionPath}`),
    ];
    const room = {
      code,
      host: ws,
      companion: null,
      createdAt: Date.now(),
      sessionId: sanitizeText(msg.sessionId, `session-${Date.now()}`, 64),
      title: sanitizeText(msg.title, 'Campaign Lobby', 48),
    };
    rooms.set(code, room);
    sockets.set(ws, { role: 'host', roomCode: code });
    sendJson(ws, COMPANION_MESSAGES.RELAY_ROOM_CREATED, {
      roomCode: code,
      sessionId: room.sessionId,
      url: urls[0],
      urls,
      lan: lanAddresses(publicPort),
    });
  }

  function joinRoom(ws, msg) {
    cleanupRooms();
    const code = sanitizeText(msg.roomCode || msg.code, '', 12).toUpperCase().replace(/\s+/g, '');
    const room = rooms.get(code);
    if (!room) {
      sendJson(ws, COMPANION_MESSAGES.HOST_REJECT, { reason: 'room-not-found', roomCode: code });
      return;
    }
    if (room.companion && room.companion.readyState === WebSocket.OPEN && room.companion !== ws) {
      sendJson(ws, COMPANION_MESSAGES.HOST_REJECT, { reason: 'room-full', roomCode: code });
      return;
    }
    const prior = sockets.get(ws);
    if (prior && prior.roomCode && prior.roomCode !== code) closeRoom(prior.roomCode, 'rejoin');
    room.companion = ws;
    sockets.set(ws, { role: 'companion', roomCode: code });
    sendJson(ws, COMPANION_MESSAGES.RELAY_COMPANION_ACCEPTED, {
      roomCode: code,
      sessionId: room.sessionId,
      title: room.title,
    });
    sendJson(room.host, COMPANION_MESSAGES.RELAY_COMPANION_JOINED, {
      roomCode: code,
      sessionId: room.sessionId,
      identity: msg.identity || null,
    });
    sendJson(room.host, COMPANION_MESSAGES.COMPANION_JOIN, msg);
  }

  function forward(ws, msg, raw) {
    const meta = sockets.get(ws);
    if (!meta) {
      sendJson(ws, COMPANION_MESSAGES.RELAY_ERROR, { reason: 'not-in-room' });
      return;
    }
    const room = rooms.get(meta.roomCode);
    if (!room) {
      sendJson(ws, COMPANION_MESSAGES.HOST_REJECT, { reason: 'room-closed' });
      sockets.delete(ws);
      return;
    }
    if (msg.type === COMPANION_MESSAGES.HOST_CLOSE_ROOM && meta.role === 'host') {
      closeRoom(meta.roomCode, msg.reason || 'host-closed');
      return;
    }
    const peer = meta.role === 'host' ? room.companion : room.host;
    if (peer && peer.readyState === WebSocket.OPEN) peer.send(raw);
  }

  function handleMessage(ws, data, req, port, isBinary) {
    if (isBinary) {
      const meta = sockets.get(ws);
      const room = meta && rooms.get(meta.roomCode);
      if (meta && meta.role === 'host' && room && room.companion) safeSendBinary(room.companion, data);
      return;
    }
    const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    const msg = safeJsonParse(raw);
    if (!msg || typeof msg.type !== 'string') {
      sendJson(ws, COMPANION_MESSAGES.RELAY_ERROR, { reason: 'bad-json' });
      return;
    }
    if (msg.type === COMPANION_MESSAGES.HOST_CREATE_ROOM) createRoom(ws, msg, req, port);
    else if (msg.type === COMPANION_MESSAGES.COMPANION_JOIN) joinRoom(ws, msg);
    else if (msg.type === COMPANION_MESSAGES.RELAY_PING) sendJson(ws, COMPANION_MESSAGES.RELAY_PONG, { sentAt: msg.sentAt || 0 });
    else forward(ws, msg, raw);
  }

  function handleClose(ws) {
    const meta = sockets.get(ws);
    if (!meta) return;
    const room = rooms.get(meta.roomCode);
    if (!room) return sockets.delete(ws);
    if (meta.role === 'host') {
      closeRoom(meta.roomCode, 'host-disconnected');
      return;
    }
    if (room.companion === ws) {
      room.companion = null;
      sendJson(room.host, COMPANION_MESSAGES.RELAY_COMPANION_LEFT, { roomCode: room.code, reason: 'companion-disconnected' });
    }
    sockets.delete(ws);
  }

  return { rooms, handleMessage, handleClose };
}

function installCompanionRelay(server, kind) {
  const httpServer = server.httpServer;
  if (!httpServer || httpServer.__clearanceCompanionRelay) return;
  httpServer.__clearanceCompanionRelay = true;

  const port = Number(server.config?.server?.port || server.config?.preview?.port || process.env.PORT || 5173);
  const relay = createRelayState();
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== RELAY_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on('message', (data, isBinary) => relay.handleMessage(ws, data, req, port, isBinary));
      ws.on('close', () => relay.handleClose(ws));
      ws.on('error', () => relay.handleClose(ws));
      sendJson(ws, COMPANION_MESSAGES.HOST_EVENT, { event: 'relay:connected', kind });
    });
  });

  server.middlewares.use(INFO_PATH, (req, res) => {
    const publicPort = requestPort(req, port);
    const base = sameOriginBase(req, publicPort);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      relayPath: RELAY_PATH,
      base,
      lan: lanAddresses(publicPort),
    }));
  });
}

export function companionRelayPlugin() {
  return {
    name: 'clearance-companion-relay',
    configureServer(server) {
      installCompanionRelay(server, 'dev');
    },
    configurePreviewServer(server) {
      installCompanionRelay(server, 'preview');
    },
  };
}
