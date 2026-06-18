import {
  COMPANION_MESSAGES,
  COMPANION_PROTOCOL_VERSION,
  clamp,
  makeSessionId,
  sanitizeText,
} from './protocol.js';

const root = document.getElementById('companion-root');
const qs = new URLSearchParams(location.search);

const state = {
  ws: null,
  status: 'waiting',
  roomCode: sanitizeText(qs.get('code') || '', '', 12).toUpperCase(),
  clientId: localStorage.getItem('clearance.companion.clientId') || makeSessionId('phone'),
  identity: {
    name: localStorage.getItem('clearance.companion.name') || `Companion ${Math.floor(Math.random() * 90 + 10)}`,
    role: 'Companion Operator',
    accent: localStorage.getItem('clearance.companion.accent') || '#38f5d0',
  },
  ready: false,
  haptics: localStorage.getItem('clearance.companion.haptics') !== '0',
  audio: localStorage.getItem('clearance.companion.audio') !== '0',
  reducedMotion: localStorage.getItem('clearance.companion.reducedMotion') === '1',
  sensitivity: Number(localStorage.getItem('clearance.companion.sensitivity') || 1),
  signal: 0.62,
  snapshot: null,
  pingMs: 0,
  lastObjectUrl: '',
  reconnectTimer: null,
  wakeLock: null,
  sticks: {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    ascend: 0,
    fireHeld: false,
  },
  map: {
    dragging: false,
    route: [],
    panX: 0,
    panY: 0,
    zoom: 1,
    lastPoint: { nx: 0.5, nz: 0.5 },
  },
};
localStorage.setItem('clearance.companion.clientId', state.clientId);

root.innerHTML = `
  <style>
    :root {
      color-scheme: dark;
      --accent: ${state.identity.accent};
      --bg: #05080a;
      --panel: rgba(12, 18, 22, .92);
      --panel2: rgba(18, 26, 30, .86);
      --line: rgba(120, 255, 225, .20);
      --text: rgba(238, 255, 252, .94);
      --muted: rgba(190, 220, 215, .58);
      --danger: #ff675c;
      --warn: #ffd36a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); overscroll-behavior: none; touch-action: manipulation; }
    body {
      min-height: 100svh;
      background:
        linear-gradient(180deg, rgba(30, 60, 58, .18), rgba(5, 8, 10, 0) 42%),
        radial-gradient(circle at 80% 8%, rgba(56, 245, 208, .15), transparent 30%),
        #05080a;
    }
    button, input, select { font: inherit; color: inherit; }
    button {
      border: 1px solid rgba(120, 255, 225, .22);
      background: rgba(18, 28, 32, .92);
      min-height: 44px;
      border-radius: 8px;
      padding: 10px 12px;
      text-transform: uppercase;
      letter-spacing: .11em;
      font-weight: 800;
    }
    button:active { transform: translateY(1px); border-color: var(--accent); }
    .app {
      min-height: 100svh;
      padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
      display: grid;
      gap: 10px;
      grid-template-rows: auto auto minmax(230px, 1fr) auto;
    }
    .topbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
    .brand { min-width: 0; }
    .eyebrow { color: var(--accent); font-size: 10px; letter-spacing: .28em; font-weight: 900; text-transform: uppercase; }
    .title { margin-top: 3px; font-size: 22px; font-weight: 950; letter-spacing: .05em; text-transform: uppercase; line-height: 1.0; }
    .status-pill {
      min-width: 106px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      background: rgba(0, 0, 0, .22);
      text-align: right;
    }
    .status-pill strong { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .14em; color: var(--accent); }
    .status-pill span { display: block; margin-top: 3px; font-size: 10px; color: var(--muted); }
    .join {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    .join input {
      width: 100%;
      height: 46px;
      border-radius: 8px;
      border: 1px solid rgba(120, 255, 225, .20);
      background: rgba(3, 6, 8, .72);
      padding: 0 12px;
      outline: none;
    }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    .dash {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .tile {
      min-height: 64px;
      padding: 9px;
      border: 1px solid rgba(120, 255, 225, .13);
      border-radius: 8px;
      background: var(--panel2);
      overflow: hidden;
    }
    .tile label { display: block; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tile strong { display: block; margin-top: 5px; font-size: 17px; letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tile.wide { grid-column: span 2; }
    .tile.full { grid-column: 1 / -1; }
    .main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      min-height: 0;
    }
    .panel {
      min-height: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 13, 16, .82);
      overflow: hidden;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 10px;
      border-bottom: 1px solid rgba(120, 255, 225, .12);
      color: var(--accent);
      font-size: 10px;
      letter-spacing: .20em;
      text-transform: uppercase;
      font-weight: 900;
    }
    .panel-body { min-height: 0; padding: 8px; }
    #map {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 210px;
      border-radius: 6px;
      background: rgba(0, 0, 0, .35);
      touch-action: none;
    }
    .actions {
      display: grid;
      gap: 7px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .actions button { min-height: 42px; padding: 8px 6px; font-size: 10px; letter-spacing: .08em; }
    .signal {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      margin: 8px 0;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .12em;
    }
    input[type="range"] { width: 100%; accent-color: var(--accent); }
    .drone {
      display: grid;
      gap: 8px;
      grid-template-rows: auto auto minmax(84px, 1fr) auto;
    }
    .feed {
      position: relative;
      min-height: 96px;
      aspect-ratio: 16 / 9;
      border: 1px solid rgba(120, 255, 225, .18);
      border-radius: 8px;
      background: #020405;
      overflow: hidden;
    }
    .feed img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .feed-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(238, 255, 252, .45);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .18em;
    }
    .sticks {
      display: grid;
      grid-template-columns: 1fr 1fr 52px;
      gap: 8px;
      align-items: stretch;
    }
    .stick {
      position: relative;
      aspect-ratio: 1;
      border: 1px solid rgba(120, 255, 225, .18);
      border-radius: 8px;
      background: radial-gradient(circle at 50% 50%, rgba(56, 245, 208, .10), rgba(0, 0, 0, .28));
      touch-action: none;
    }
    .nub {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      left: calc(50% - 18px);
      top: calc(50% - 18px);
      background: var(--accent);
      box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent);
      pointer-events: none;
    }
    .vertical {
      display: grid;
      grid-template-rows: 1fr auto 1fr;
      border: 1px solid rgba(120, 255, 225, .18);
      border-radius: 8px;
      overflow: hidden;
    }
    .vertical button { border: 0; border-radius: 0; min-height: 44px; padding: 0; }
    .settings {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .settings button { min-height: 38px; padding: 7px 4px; font-size: 9px; }
    .disabled { opacity: .45; pointer-events: none; }
    .warn {
      display: none;
      border: 1px solid rgba(255, 211, 106, .36);
      border-radius: 8px;
      padding: 8px 10px;
      color: var(--warn);
      background: rgba(80, 56, 12, .28);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    @media (max-width: 760px) {
      .app { grid-template-rows: auto auto auto auto; }
      .dash { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .main { grid-template-columns: 1fr; }
      #map { min-height: 240px; }
    }
    @media (max-width: 360px), (max-height: 520px) {
      .warn { display: block; }
      .title { font-size: 18px; }
      .actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
  <main class="app">
    <section class="topbar">
      <div class="brand">
        <div class="eyebrow">Clearance</div>
        <div class="title">Companion Operator</div>
      </div>
      <div class="status-pill">
        <strong id="status-label">Waiting</strong>
        <span id="status-sub">No room</span>
      </div>
    </section>

    <section class="warn">Rotate or use fullscreen for safer flight controls.</section>

    <section class="join" id="join-card">
      <div class="row">
        <input id="room-code" maxlength="12" inputmode="text" autocomplete="off" placeholder="Invite code" value="${state.roomCode}" />
        <input id="display-name" maxlength="24" autocomplete="nickname" placeholder="Display name" value="${state.identity.name}" />
      </div>
      <div class="row">
        <button id="join-btn">Join Lobby</button>
        <button id="ready-btn">Ready</button>
      </div>
    </section>

    <section class="dash">
      <div class="tile"><label>HP</label><strong id="hp">--</strong></div>
      <div class="tile"><label>Ammo</label><strong id="ammo">--</strong></div>
      <div class="tile"><label>Focus</label><strong id="focus">--</strong></div>
      <div class="tile"><label>Money</label><strong id="money">--</strong></div>
      <div class="tile wide"><label>Zone</label><strong id="zone">Offline</strong></div>
      <div class="tile wide"><label>Objective</label><strong id="objective">Awaiting host</strong></div>
      <div class="tile"><label>Enemies</label><strong id="enemies">--</strong></div>
      <div class="tile"><label>Alarm</label><strong id="alarm">--</strong></div>
      <div class="tile"><label>Trace</label><strong id="trace">--</strong></div>
      <div class="tile"><label>Drone</label><strong id="drone">--</strong></div>
    </section>

    <section class="main">
      <div class="panel">
        <div class="panel-head"><span>Tactical Map</span><span id="ping-readout">-- ms</span></div>
        <div class="panel-body">
          <canvas id="map"></canvas>
          <div class="signal"><span>Clean</span><input id="signal" type="range" min="0" max="100" value="62" /><span>Deep</span></div>
          <div class="actions" id="ping-actions">
            <button data-ping="danger">Danger</button>
            <button data-ping="move">Move</button>
            <button data-ping="hold">Hold</button>
            <button data-ping="breach">Breach</button>
            <button data-ping="objective">Objective</button>
            <button data-ping="loot">Loot</button>
            <button data-ping="help">Help</button>
            <button data-action="door">Door Pulse</button>
            <button data-action="light">Lights</button>
            <button data-action="fake">Fake Order</button>
            <button data-action="panic">Panic Board</button>
            <button data-action="clear-route">Clear Route</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><span>FPV Drone</span><span id="drone-readout">Standby</span></div>
        <div class="panel-body drone">
          <div class="row">
            <button id="launch-drone">Launch</button>
            <button id="recall-drone">Recall</button>
          </div>
          <div class="feed">
            <img id="drone-feed" alt="" />
            <div class="feed-empty" id="feed-empty">No video feed</div>
          </div>
          <div class="sticks">
            <div class="stick" id="move-stick"><div class="nub" id="move-nub"></div></div>
            <div class="stick" id="look-stick"><div class="nub" id="look-nub"></div></div>
            <div class="vertical">
              <button id="up-btn">Up</button>
              <button id="fire-btn">Fire</button>
              <button id="down-btn">Dn</button>
            </div>
          </div>
          <div class="actions" id="quick-comms">
            <button data-comm="wait">Wait</button>
            <button data-comm="push">Push</button>
            <button data-comm="reload">Reload</button>
            <button data-comm="flank">Flank</button>
            <button data-comm="heal">Heal</button>
            <button data-comm="behind you">Behind</button>
          </div>
        </div>
      </div>
    </section>

    <section class="settings">
      <button id="wake-btn">Wake</button>
      <button id="full-btn">Full</button>
      <button id="haptic-btn">Haptics</button>
      <button id="audio-btn">Audio</button>
    </section>
  </main>
`;

const el = (id) => document.getElementById(id);
const mapCanvas = el('map');
const mapCtx = mapCanvas.getContext('2d');

function vibrate(ms = 18) {
  if (!state.haptics || !navigator.vibrate) return;
  navigator.vibrate(ms);
}

function send(type, payload = {}) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
  state.ws.send(JSON.stringify({ v: COMPANION_PROTOCOL_VERSION, type, t: Date.now(), clientId: state.clientId, ...payload }));
  return true;
}

function setStatus(status, sub = '') {
  state.status = status;
  el('status-label').textContent = status;
  el('status-sub').textContent = sub || state.roomCode || 'No room';
}

function wsUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/__companion/ws`;
}

function joinRoom() {
  state.roomCode = sanitizeText(el('room-code').value, '', 12).toUpperCase().replace(/\s+/g, '');
  state.identity.name = sanitizeText(el('display-name').value, state.identity.name, 24) || 'Companion';
  localStorage.setItem('clearance.companion.name', state.identity.name);
  if (!state.roomCode) {
    setStatus('waiting', 'Enter code');
    return;
  }
  if (state.ws) {
    try { state.ws.close(); } catch (_) {}
  }
  setStatus('connecting', state.roomCode);
  const ws = new WebSocket(wsUrl());
  ws.binaryType = 'arraybuffer';
  state.ws = ws;
  ws.addEventListener('open', () => {
    send(COMPANION_MESSAGES.COMPANION_JOIN, {
      roomCode: state.roomCode,
      reconnect: true,
      identity: state.identity,
    });
    send(COMPANION_MESSAGES.COMPANION_IDENTITY, { identity: state.identity });
  });
  ws.addEventListener('message', onMessage);
  ws.addEventListener('close', () => {
    setStatus('reconnecting', 'Host link lost');
    scheduleReconnect();
  });
  ws.addEventListener('error', () => {
    setStatus('disconnected', 'Relay error');
  });
}

function scheduleReconnect() {
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  state.reconnectTimer = setTimeout(() => {
    if (state.roomCode && (!state.ws || state.ws.readyState === WebSocket.CLOSED)) joinRoom();
  }, 1400);
}

function onMessage(event) {
  if (event.data instanceof ArrayBuffer) {
    updateFeed(new Blob([event.data], { type: 'image/webp' }));
    return;
  }
  if (event.data instanceof Blob) {
    updateFeed(event.data);
    return;
  }
  let msg = null;
  try { msg = JSON.parse(event.data); } catch (_) { return; }
  if (!msg || !msg.type) return;
  if (msg.type === COMPANION_MESSAGES.RELAY_COMPANION_ACCEPTED) {
    setStatus('connected', msg.roomCode || state.roomCode);
    vibrate(22);
    return;
  }
  if (msg.type === COMPANION_MESSAGES.HOST_REJECT) {
    setStatus('rejected', msg.reason || 'Rejected');
    return;
  }
  if (msg.type === COMPANION_MESSAGES.HOST_CLOSE_ROOM) {
    setStatus('disconnected', msg.reason || 'Closed');
    return;
  }
  if (msg.type === COMPANION_MESSAGES.RELAY_PONG) {
    state.pingMs = msg.sentAt ? Date.now() - msg.sentAt : state.pingMs;
    el('ping-readout').textContent = `${Math.round(state.pingMs)} ms`;
    return;
  }
  if (msg.type === COMPANION_MESSAGES.HOST_SNAPSHOT) {
    state.snapshot = msg.snapshot || msg;
    updateDashboard();
    drawMap();
    return;
  }
  if (msg.type === COMPANION_MESSAGES.HOST_EVENT) {
    if (msg.event === 'haptic') vibrate(msg.ms || 25);
  }
}

function updateFeed(blob) {
  const img = el('drone-feed');
  if (state.lastObjectUrl) URL.revokeObjectURL(state.lastObjectUrl);
  state.lastObjectUrl = URL.createObjectURL(blob);
  img.src = state.lastObjectUrl;
  el('feed-empty').style.display = 'none';
}

function pct(n) {
  return `${Math.round(clamp(n, 0, 1) * 100)}%`;
}

function updateDashboard() {
  const s = state.snapshot || {};
  const p = s.player || {};
  const c = s.campaign || {};
  const d = s.drone || {};
  const t = s.trace || {};
  el('hp').textContent = `${Math.round(p.hp ?? 0)}/${Math.round(p.maxHp ?? 100)}`;
  el('ammo').textContent = p.reloading ? 'Reload' : `${p.ammo ?? '--'}/${p.reserve ?? '--'}`;
  el('focus').textContent = pct(p.focus ?? 0);
  el('money').textContent = `$${Math.round(p.money ?? 0)}`;
  el('zone').textContent = c.zone || c.room || `B${c.building || '--'}`;
  el('objective').textContent = c.objective || 'Clear and advance';
  el('enemies').textContent = String(c.enemiesAlive ?? '--');
  el('alarm').textContent = c.alarm ? 'Live' : c.timer ? `${Math.ceil(c.timer)}s` : 'Quiet';
  el('trace').textContent = `${Math.round((t.heat || 0) * 100)}%`;
  el('drone').textContent = d.active ? `${Math.ceil(d.activeMs / 1000)}s` : d.cooldownMs > 0 ? `${Math.ceil(d.cooldownMs / 1000)}s` : 'Ready';
  el('drone-readout').textContent = d.active ? `HP ${Math.round(d.hp || 0)} | ${Math.ceil(d.activeMs / 1000)}s` : d.cooldownMs > 0 ? `Cooldown ${Math.ceil(d.cooldownMs / 1000)}s` : 'Ready';
  el('ping-readout').textContent = `${Math.round(s.session?.pingMs || state.pingMs || 0)} ms`;
}

function mapToWorldNorm(clientX, clientY) {
  const rect = mapCanvas.getBoundingClientRect();
  const x = (clientX - rect.left) / Math.max(1, rect.width);
  const y = (clientY - rect.top) / Math.max(1, rect.height);
  const nx = clamp((x - 0.5 - state.map.panX) / state.map.zoom + 0.5, 0, 1);
  const nz = clamp((y - 0.5 - state.map.panY) / state.map.zoom + 0.5, 0, 1);
  return { nx, nz };
}

function drawMap() {
  const rect = mapCanvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(240, Math.floor(rect.width * ratio));
  const h = Math.max(200, Math.floor(rect.height * ratio));
  if (mapCanvas.width !== w || mapCanvas.height !== h) {
    mapCanvas.width = w;
    mapCanvas.height = h;
  }
  const ctx = mapCtx;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#030709';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.scale(state.map.zoom, state.map.zoom);
  ctx.translate(-w / 2 + state.map.panX * w, -h / 2 + state.map.panY * h);

  ctx.strokeStyle = 'rgba(90, 255, 222, .10)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 8) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += h / 8) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const s = state.snapshot || {};
  const map = s.map || {};
  const toPx = (pt) => ({ x: (pt.nx ?? 0.5) * w, y: (pt.nz ?? 0.5) * h });
  for (const wall of map.walls || []) {
    const x = wall.nx0 * w;
    const y = wall.nz0 * h;
    ctx.fillStyle = 'rgba(110, 255, 226, .16)';
    ctx.fillRect(x, y, Math.max(2, (wall.nx1 - wall.nx0) * w), Math.max(2, (wall.nz1 - wall.nz0) * h));
  }
  for (const blob of map.enemies || []) {
    const p = toPx(blob);
    const r = Math.max(8, (blob.r || 0.035) * Math.min(w, h));
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 88, 74, .28)';
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const route of map.routes || []) {
    if (!route.points || route.points.length < 2) continue;
    ctx.beginPath();
    route.points.forEach((pt, i) => {
      const p = toPx(pt);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.strokeStyle = route.color || state.identity.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (state.map.route.length > 1) {
    ctx.beginPath();
    state.map.route.forEach((pt, i) => {
      const p = toPx(pt);
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.strokeStyle = state.identity.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const ping of map.pings || []) {
    const p = toPx(ping);
    ctx.beginPath();
    ctx.strokeStyle = ping.color || state.identity.accent;
    ctx.lineWidth = 2;
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(238,255,252,.80)';
    ctx.font = `${11 * ratio}px ui-sans-serif`;
    ctx.fillText(String(ping.type || '').slice(0, 4).toUpperCase(), p.x + 14, p.y + 4);
  }
  const player = map.player || { nx: 0.5, nz: 0.5, yaw: 0 };
  const pp = toPx(player);
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate(player.yaw || 0);
  ctx.fillStyle = state.identity.accent;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(10, 11);
  ctx.lineTo(0, 6);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function installMapInput() {
  mapCanvas.addEventListener('pointerdown', (event) => {
    state.map.dragging = true;
    state.map.route = [mapToWorldNorm(event.clientX, event.clientY)];
    state.map.lastPoint = state.map.route[0];
    mapCanvas.setPointerCapture(event.pointerId);
    drawMap();
  });
  mapCanvas.addEventListener('pointermove', (event) => {
    if (!state.map.dragging) return;
    const pt = mapToWorldNorm(event.clientX, event.clientY);
    state.map.lastPoint = pt;
    const prev = state.map.route[state.map.route.length - 1];
    if (!prev || Math.hypot(prev.nx - pt.nx, prev.nz - pt.nz) > 0.012) {
      state.map.route.push(pt);
      if (state.map.route.length > 48) state.map.route.shift();
      drawMap();
    }
  });
  mapCanvas.addEventListener('pointerup', (event) => {
    state.map.dragging = false;
    try { mapCanvas.releasePointerCapture(event.pointerId); } catch (_) {}
    if (state.map.route.length > 1) {
      send(COMPANION_MESSAGES.ROUTE_DRAW, { points: state.map.route, ttlMs: 9000, color: state.identity.accent });
      vibrate(12);
    }
  });
  mapCanvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.map.zoom = clamp(state.map.zoom + (event.deltaY < 0 ? 0.12 : -0.12), 0.7, 2.4);
    drawMap();
  }, { passive: false });
}

function installStick(id, nubId, key) {
  const pad = el(id);
  const nub = el(nubId);
  const reset = () => {
    state.sticks[key].x = 0;
    state.sticks[key].y = 0;
    nub.style.left = 'calc(50% - 18px)';
    nub.style.top = 'calc(50% - 18px)';
  };
  pad.addEventListener('pointerdown', (event) => {
    pad.setPointerCapture(event.pointerId);
    update(event);
  });
  pad.addEventListener('pointermove', update);
  pad.addEventListener('pointerup', reset);
  pad.addEventListener('pointercancel', reset);
  function update(event) {
    if (!pad.hasPointerCapture(event.pointerId)) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = Math.max(10, rect.width * 0.38);
    const dx = clamp(event.clientX - cx, -max, max);
    const dy = clamp(event.clientY - cy, -max, max);
    state.sticks[key].x = clamp(dx / max, -1, 1);
    state.sticks[key].y = clamp(dy / max, -1, 1);
    nub.style.left = `calc(50% - 18px + ${dx}px)`;
    nub.style.top = `calc(50% - 18px + ${dy}px)`;
  }
}

function updateSettingsButtons() {
  el('haptic-btn').textContent = state.haptics ? 'Haptics On' : 'Haptics Off';
  el('audio-btn').textContent = state.audio ? 'Audio On' : 'Audio Off';
}

function bindUi() {
  el('join-btn').addEventListener('click', joinRoom);
  el('ready-btn').addEventListener('click', () => {
    state.ready = !state.ready;
    el('ready-btn').textContent = state.ready ? 'Ready' : 'Unready';
    send(COMPANION_MESSAGES.COMPANION_READY, { ready: state.ready });
    vibrate(16);
  });
  el('display-name').addEventListener('change', () => {
    state.identity.name = sanitizeText(el('display-name').value, state.identity.name, 24);
    localStorage.setItem('clearance.companion.name', state.identity.name);
    send(COMPANION_MESSAGES.COMPANION_IDENTITY, { identity: state.identity });
  });
  el('signal').addEventListener('input', (event) => {
    state.signal = clamp(Number(event.target.value) / 100, 0, 1);
    send(COMPANION_MESSAGES.SIGNAL_TUNE, { value: state.signal });
  });
  el('ping-actions').addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const pt = state.map.lastPoint || { nx: 0.5, nz: 0.5 };
    if (btn.dataset.ping) {
      send(COMPANION_MESSAGES.PING_ADD, { type: btn.dataset.ping, ...pt });
      vibrate(16);
    } else if (btn.dataset.action === 'door') send(COMPANION_MESSAGES.DOOR_ACTION, { action: 'pulse' });
    else if (btn.dataset.action === 'light') send(COMPANION_MESSAGES.LIGHT_ACTION, { action: 'flicker' });
    else if (btn.dataset.action === 'fake') send(COMPANION_MESSAGES.COMMS_FAKE_ORDER, { order: 'hold' });
    else if (btn.dataset.action === 'panic') send(COMPANION_MESSAGES.PANIC_TRIGGER, { trigger: 'emergency' });
    else if (btn.dataset.action === 'clear-route') {
      state.map.route = [];
      send(COMPANION_MESSAGES.ROUTE_DRAW, { points: [], ttlMs: 0, clear: true });
      drawMap();
    }
  });
  el('quick-comms').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-comm]');
    if (!btn) return;
    send(COMPANION_MESSAGES.QUICK_COMMS_SEND, { text: btn.dataset.comm });
    vibrate(10);
  });
  el('launch-drone').addEventListener('click', () => send(COMPANION_MESSAGES.DRONE_LAUNCH, {}));
  el('recall-drone').addEventListener('click', () => send(COMPANION_MESSAGES.DRONE_RECALL, {}));
  el('fire-btn').addEventListener('pointerdown', () => {
    state.sticks.fireHeld = true;
    send(COMPANION_MESSAGES.DRONE_FIRE, { held: true });
  });
  el('fire-btn').addEventListener('pointerup', () => { state.sticks.fireHeld = false; });
  el('fire-btn').addEventListener('pointercancel', () => { state.sticks.fireHeld = false; });
  el('up-btn').addEventListener('pointerdown', () => { state.sticks.ascend = 1; });
  el('up-btn').addEventListener('pointerup', () => { state.sticks.ascend = 0; });
  el('up-btn').addEventListener('pointercancel', () => { state.sticks.ascend = 0; });
  el('down-btn').addEventListener('pointerdown', () => { state.sticks.ascend = -1; });
  el('down-btn').addEventListener('pointerup', () => { state.sticks.ascend = 0; });
  el('down-btn').addEventListener('pointercancel', () => { state.sticks.ascend = 0; });
  el('wake-btn').addEventListener('click', requestWakeLock);
  el('full-btn').addEventListener('click', () => document.documentElement.requestFullscreen?.());
  el('haptic-btn').addEventListener('click', () => {
    state.haptics = !state.haptics;
    localStorage.setItem('clearance.companion.haptics', state.haptics ? '1' : '0');
    updateSettingsButtons();
    vibrate(18);
  });
  el('audio-btn').addEventListener('click', () => {
    state.audio = !state.audio;
    localStorage.setItem('clearance.companion.audio', state.audio ? '1' : '0');
    updateSettingsButtons();
  });
  installMapInput();
  installStick('move-stick', 'move-nub', 'move');
  installStick('look-stick', 'look-nub', 'look');
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
      el('wake-btn').textContent = 'Wake On';
      vibrate(18);
    }
  } catch (_) {
    el('wake-btn').textContent = 'Wake Blocked';
  }
}

setInterval(() => {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  send(COMPANION_MESSAGES.RELAY_PING, { sentAt: now });
  send(COMPANION_MESSAGES.DRONE_INPUT, {
    moveX: state.sticks.move.x,
    moveY: -state.sticks.move.y,
    lookX: state.sticks.look.x * state.sensitivity,
    lookY: state.sticks.look.y * state.sensitivity,
    ascend: state.sticks.ascend,
    fireHeld: state.sticks.fireHeld,
  });
}, 34);

setInterval(drawMap, 500);

bindUi();
updateSettingsButtons();
updateDashboard();
drawMap();
setStatus(state.roomCode ? 'waiting' : 'waiting', state.roomCode || 'Enter code');
if (state.roomCode) setTimeout(joinRoom, 250);
