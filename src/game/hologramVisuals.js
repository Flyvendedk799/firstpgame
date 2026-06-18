export const HOLOGRAM_POLISH_VERSION = 'hologram-polish.v1';
export const HOLOGRAM_VISUAL_EXPERIENCE_VERSION = 'hologram-visual-experience.v1';
export const HOLOGRAM_DEPTH_FX_VERSION = 'hologram-depth-fx.v1';
export const HOLOGRAM_ATMOSPHERE_VERSION = 'hologram-atmosphere.v1';
export const HOLOGRAM_PARALLAX_GHOST_VERSION = 'hologram-parallax-ghost.v1';

export function hologramVisualVersionBundle() {
  return {
    polish: HOLOGRAM_POLISH_VERSION,
    visualExperience: HOLOGRAM_VISUAL_EXPERIENCE_VERSION,
    depthFx: HOLOGRAM_DEPTH_FX_VERSION,
    atmosphere: HOLOGRAM_ATMOSPHERE_VERSION,
    parallaxGhost: HOLOGRAM_PARALLAX_GHOST_VERSION
  };
}

export function configureHologramTexture(THREE, tex) {
  if (!tex) return tex;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = Math.max(tex.anisotropy || 1, 4);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function holoCanvasPhase(offset = 0) {
  const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return (t * .001 + offset) % 1;
}

export function holoText(g, text, x, y, font, color, shadowColor = 'rgba(64,200,255,.48)', align = 'left') {
  g.save();
  g.font = font;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.shadowColor = shadowColor;
  g.shadowBlur = 7;
  g.fillStyle = color;
  g.fillText(String(text), x, y);
  g.restore();
}

export function drawHoloBackplate(g, c, opt = {}) {
  const phase = holoCanvasPhase(opt.phaseOffset || 0);
  const accent = opt.accent || 'rgba(64,200,255,.92)';
  const accentSoft = opt.accentSoft || 'rgba(64,200,255,.13)';
  const accentDim = opt.accentDim || 'rgba(64,200,255,.075)';
  const accent2 = opt.accent2 || 'rgba(255,208,96,.92)';
  const bg0 = opt.bg0 || 'rgba(7,18,32,.94)';
  const bg1 = opt.bg1 || 'rgba(4,10,22,.94)';
  g.save();
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, c.width, c.height);
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, bg0);
  grad.addColorStop(.58, bg1);
  grad.addColorStop(1, 'rgba(3,8,16,.96)');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const radial = g.createRadialGradient(c.width * .18, c.height * .12, 8, c.width * .18, c.height * .12, Math.max(c.width, c.height) * .78);
  radial.addColorStop(0, accentSoft);
  radial.addColorStop(.42, 'rgba(255,255,255,.02)');
  radial.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = radial;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = accentDim;
  g.lineWidth = 1;
  const grid = 24;
  const xo = -(phase * grid) % grid;
  const yo = -((phase * .65) * grid) % grid;
  for (let x = xo; x < c.width; x += grid) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = yo; y < c.height; y += grid) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.045)';
  for (let y = 0; y < c.height; y += 7) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(c.width, y + .5); g.stroke(); }
  const sweep = (phase * c.height * 1.35) - c.height * .18;
  const sweepGrad = g.createLinearGradient(0, sweep - 34, 0, sweep + 34);
  sweepGrad.addColorStop(0, 'rgba(64,200,255,0)');
  sweepGrad.addColorStop(.5, opt.scanColor || 'rgba(128,232,255,.18)');
  sweepGrad.addColorStop(1, 'rgba(64,200,255,0)');
  g.fillStyle = sweepGrad;
  g.fillRect(0, sweep - 34, c.width, 68);
  g.strokeStyle = accent;
  g.lineWidth = 2;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.strokeStyle = accent2;
  g.lineWidth = 2;
  const l = 18;
  [[3, 3, 1, 1], [c.width - 3, 3, -1, 1], [3, c.height - 3, 1, -1], [c.width - 3, c.height - 3, -1, -1]].forEach(([x, y, sx, sy]) => {
    g.beginPath();
    g.moveTo(x + sx * l, y);
    g.lineTo(x, y);
    g.lineTo(x, y + sy * l);
    g.stroke();
  });
  g.strokeStyle = accentSoft;
  g.lineWidth = 3;
  for (let x = -c.width; x < c.width * 1.4; x += 92) {
    g.beginPath();
    g.moveTo(x + phase * 46, c.height + 6);
    g.lineTo(x + phase * 46 + 56, c.height - 50);
    g.stroke();
  }
  if (opt.titleBar !== false) {
    g.fillStyle = accentSoft;
    g.fillRect(8, 8, c.width - 16, 30);
    g.strokeStyle = accentDim;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(14, 42);
    g.lineTo(c.width - 14, 42);
    g.stroke();
  }
  if (opt.signal) drawHoloGlitchBands(g, c, opt.signal, opt.glitchAccent || accent);
  g.restore();
}

export function drawHoloMetricBar(g, x, y, w, h, ratio, color, label, value) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  g.save();
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 7;
  g.fillRect(x, y, w * r, h);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,.16)';
  g.lineWidth = 1;
  g.strokeRect(x + .5, y + .5, w - 1, h - 1);
  g.fillStyle = 'rgba(255,255,255,.50)';
  g.font = '700 10px Rajdhani, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(label, x, y - 7);
  g.fillStyle = 'rgba(255,255,255,.82)';
  g.textAlign = 'right';
  g.fillText(value, x + w, y - 7);
  for (let i = 1; i < 6; i++) {
    const tx = x + w * (i / 6);
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.moveTo(tx, y + 2);
    g.lineTo(tx, y + h - 2);
    g.stroke();
  }
  g.restore();
}

export function drawHoloSparkline(g, x, y, w, h, color, phase, seed = 0) {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,.10)';
  g.strokeRect(x + .5, y + .5, w - 1, h - 1);
  g.beginPath();
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const yy = y + h * .5 + Math.sin((t + phase + seed) * Math.PI * 4.0) * h * .20 + Math.sin((t * .7 + phase * 1.7 + seed) * Math.PI * 6.0) * h * .11;
    const xx = x + t * w;
    if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
  }
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.shadowColor = color;
  g.shadowBlur = 6;
  g.stroke();
  g.restore();
}

export function drawHoloGlitchBands(g, c, signal = {}, accent = 'rgba(64,200,255,.55)') {
  const noise = Math.max(0, Math.min(1, signal.signalNoise || 0));
  const pulse = Math.max(noise, signal.damagePulse || 0, signal.warningPulse || 0, signal.weaponSwapPulse || 0);
  if (pulse <= .015) return;
  const phase = holoCanvasPhase(.82);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const bands = 2 + Math.floor(pulse * 5);
  for (let i = 0; i < bands; i++) {
    const y = (phase * c.height * (1.7 + i * .23) + i * 47) % c.height;
    const h = 2 + Math.floor(pulse * 7) + (i % 2);
    const x = (Math.sin(phase * 9 + i * 1.7) * 10 - 8) * pulse;
    g.fillStyle = i % 2 === 0 ? accent : 'rgba(255,208,96,.34)';
    g.globalAlpha = .10 + pulse * .18;
    g.fillRect(x, y, c.width * (.35 + .55 * ((i % 3) + 1) / 3), h);
  }
  g.globalAlpha = .08 + pulse * .10;
  for (let i = 0; i < 3; i++) {
    const x = (phase * c.width * 1.3 + i * 83) % c.width;
    g.fillStyle = 'rgba(255,255,255,.65)';
    g.fillRect(x, 0, 1 + Math.floor(pulse * 2), c.height);
  }
  g.restore();
}

export function drawHoloStatusPill(g, x, y, w, signal = {}, accent = '#40c8ff', warn = '#ffd060') {
  const integrity = Math.max(0, Math.min(1, signal.signalIntegrity ?? 1));
  const noise = Math.max(0, Math.min(1, signal.signalNoise || 0));
  const warning = Math.max(signal.warningPulse || 0, signal.criticalAmmoPulse || 0, signal.damagePulse || 0);
  const label = (signal.statusLabel || 'READY').toUpperCase();
  g.save();
  g.fillStyle = warning > .35 ? 'rgba(96,24,18,.38)' : 'rgba(255,255,255,.07)';
  g.fillRect(x, y, w, 20);
  g.strokeStyle = warning > .35 ? 'rgba(255,96,72,.58)' : 'rgba(255,255,255,.14)';
  g.lineWidth = 1;
  g.strokeRect(x + .5, y + .5, w - 1, 19);
  holoText(g, label, x + 8, y + 10, '800 10px Rajdhani, sans-serif', warning > .35 ? '#ff6048' : 'rgba(230,248,255,.78)', warning > .35 ? 'rgba(255,96,72,.52)' : 'rgba(64,200,255,.32)');
  const bx = x + w - 64, by = y + 8, bw = 48, bh = 4;
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = integrity > .70 ? accent : warn;
  g.shadowColor = g.fillStyle;
  g.shadowBlur = 5;
  g.fillRect(bx, by, bw * integrity, bh);
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,.22)';
  for (let i = 0; i < 4; i++) g.fillRect(x + w - 86 + i * 4, y + 7, 2, 6 + Math.round(noise * 5 * ((i % 2) + 1) / 2));
  g.restore();
}

export function drawHoloProjectionLayer(canvas, tex, opt = {}) {
  const c = canvas, g = c.getContext('2d');
  const signal = opt.signal || {};
  const phase = holoCanvasPhase(opt.phaseOffset || 0);
  const accent = opt.accent || 'rgba(64,200,255,.85)';
  const accentSoft = opt.accentSoft || 'rgba(64,200,255,.18)';
  const warm = opt.warm || 'rgba(255,208,96,.60)';
  const noise = Math.max(0, Math.min(1, signal.signalNoise || 0));
  const warn = Math.max(signal.warningPulse || 0, signal.criticalAmmoPulse || 0, signal.damagePulse || 0);
  g.clearRect(0, 0, c.width, c.height);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const cx = c.width * .5, cy = c.height * .5;
  const ringR = Math.min(c.width, c.height) * (.18 + .025 * Math.sin(phase * Math.PI * 2));
  g.strokeStyle = accentSoft;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(cx, cy, ringR * 1.72, ringR * .62, Math.sin(phase * Math.PI * 2) * .08, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = (phase * c.height * (1.2 + i * .18) + i * c.height * .22) % c.height;
    const grad = g.createLinearGradient(0, y - 12, 0, y + 12);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(.5, i % 2 ? accentSoft : warm);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.globalAlpha = .18 + noise * .10;
    g.fillRect(0, y - 12, c.width, 24);
  }
  g.globalAlpha = .42 + warn * .18;
  g.strokeStyle = warn > .35 ? 'rgba(255,96,72,.62)' : accent;
  const inset = 8 + Math.sin(phase * Math.PI * 2) * 2;
  g.beginPath();
  g.moveTo(inset, 18); g.lineTo(c.width * .24, 18);
  g.moveTo(c.width - inset, 18); g.lineTo(c.width * .76, 18);
  g.moveTo(inset, c.height - 18); g.lineTo(c.width * .24, c.height - 18);
  g.moveTo(c.width - inset, c.height - 18); g.lineTo(c.width * .76, c.height - 18);
  g.stroke();
  g.globalAlpha = .24 + noise * .20;
  for (let i = 0; i < 28; i++) {
    const x = (i * 37 + phase * c.width * 1.1) % c.width;
    const h = 4 + ((i * 7) % 19);
    const y = (i * 29 + phase * c.height * .85) % c.height;
    g.fillStyle = i % 5 === 0 ? warm : accent;
    g.fillRect(x, y, 1, h);
    if (i % 4 === 0) g.fillRect(x + 4, y + h * .45, 8, 1);
  }
  g.globalAlpha = .10 + noise * .18;
  g.strokeStyle = accent;
  for (let y = -c.height; y < c.height * 2; y += 34) {
    g.beginPath();
    g.moveTo(-20, y + phase * 40);
    g.lineTo(c.width + 20, y + phase * 40 - c.height * .22);
    g.stroke();
  }
  g.restore();
  if (tex) tex.needsUpdate = true;
}

export function createHoloDepthFrame(THREE, w, h, color = 0x40c8ff, order = 1001) {
  const group = new THREE.Group();
  group.userData.hologramDepthFxVersion = HOLOGRAM_DEPTH_FX_VERSION;
  const mainMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const hotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const parts = [];
  const add = (name, gw, gh, x, y, z, rz = 0, mat = mainMat) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    mesh.renderOrder = order;
    mesh.userData.base = { x, y, z, rz, gw, gh };
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  add('holoDepthFrame_top', w * .92, .004, 0, h * .5 + .006, .004, 0, mainMat);
  add('holoDepthFrame_bottom', w * .92, .004, 0, -h * .5 - .006, .004, 0, mainMat);
  add('holoDepthFrame_left', .004, h * .86, -w * .5 - .006, 0, .004, 0, mainMat);
  add('holoDepthFrame_right', .004, h * .86, w * .5 + .006, 0, .004, 0, mainMat);
  const cw = Math.min(w, h) * .16;
  add('holoDepthFrame_cornerTL', cw, .004, -w * .5 + cw * .42, h * .5 - cw * .15, .006, -Math.PI * .18, hotMat);
  add('holoDepthFrame_cornerTR', cw, .004, w * .5 - cw * .42, h * .5 - cw * .15, .006, Math.PI * .18, hotMat);
  add('holoDepthFrame_cornerBL', cw, .004, -w * .5 + cw * .42, -h * .5 + cw * .15, .006, Math.PI * .18, hotMat);
  add('holoDepthFrame_cornerBR', cw, .004, w * .5 - cw * .42, -h * .5 + cw * .15, .006, -Math.PI * .18, hotMat);
  group.userData.hologramDepthMats = { main: mainMat, hot: hotMat };
  group.userData.hologramDepthParts = parts;
  return group;
}

export function syncHoloDepthFrame(THREE, frame, vis, now, signal = {}, tone = 1) {
  if (!frame || !frame.userData) return;
  const v = THREE.MathUtils.clamp(vis || 0, 0, 1);
  frame.visible = v > .012;
  const mats = frame.userData.hologramDepthMats || {};
  const noise = THREE.MathUtils.clamp(signal.signalNoise || 0, 0, 1);
  const warn = THREE.MathUtils.clamp(Math.max(signal.warningPulse || 0, signal.criticalAmmoPulse || 0, signal.damagePulse || 0), 0, 1);
  const phase = now * 5.7 + (frame.id || 0) * .17;
  if (mats.main) mats.main.opacity = THREE.MathUtils.clamp((.16 + .08 * Math.sin(phase) + noise * .10) * v * tone, 0, .46);
  if (mats.hot) mats.hot.opacity = THREE.MathUtils.clamp((.10 + .16 * Math.sin(phase * 1.43 + 1.1) + warn * .18) * v * tone, 0, .58);
  const parts = frame.userData.hologramDepthParts || [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], b = p.userData && p.userData.base;
    if (!b) continue;
    const wave = Math.sin(now * (3.2 + i * .27) + i * .71);
    p.position.z = b.z + wave * .0012 * v;
    p.rotation.z = b.rz + wave * .018 * v;
    if (i < 4) {
      const s = 1 + (.025 + .035 * noise) * Math.sin(now * 4.4 + i * 1.6) * v;
      if (b.gw > b.gh) p.scale.set(s, 1, 1);
      else p.scale.set(1, s, 1);
    } else {
      const s = 1 + (.08 + .07 * warn) * Math.sin(now * 7.1 + i) * v;
      p.scale.set(s, 1, 1);
    }
  }
}

export function createHoloMoteField(THREE, softRadialTex, w, h, count = 32, color = 0x80e0ff, order = 1002) {
  const n = Math.max(4, count | 0);
  const pos = new Float32Array(n * 3);
  const base = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = (i * 12.9898 + 78.233) % 97.331;
    const rx = ((Math.sin(s) * 43758.5453) % 1 + 1) % 1;
    const ry = ((Math.sin(s * 1.73 + 3.1) * 24634.6345) % 1 + 1) % 1;
    const rz = ((Math.sin(s * 2.17 + 7.7) * 13217.219) % 1 + 1) % 1;
    base[i * 3 + 0] = (rx - .5) * w * 1.08;
    base[i * 3 + 1] = (ry - .5) * h * 1.08;
    base[i * 3 + 2] = .006 + rz * .012;
    pos[i * 3 + 0] = base[i * 3 + 0];
    pos[i * 3 + 1] = base[i * 3 + 1];
    pos[i * 3 + 2] = base[i * 3 + 2];
    seed[i] = s;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: softRadialTex,
    color,
    transparent: true,
    opacity: 0,
    size: .006,
    sizeAttenuation: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = order;
  pts.frustumCulled = false;
  pts.userData.hologramAtmosphereVersion = HOLOGRAM_ATMOSPHERE_VERSION;
  pts.userData.holoMoteBase = base;
  pts.userData.holoMoteSeed = seed;
  pts.userData.holoMoteSize = { w, h, count: n };
  return pts;
}

export function syncHoloMoteField(THREE, field, vis, now, signal = {}, tone = 1) {
  if (!field || !field.geometry || !field.material) return;
  const v = THREE.MathUtils.clamp(vis || 0, 0, 1);
  field.visible = v > .012;
  const noise = THREE.MathUtils.clamp(signal.signalNoise || 0, 0, 1);
  const warn = THREE.MathUtils.clamp(Math.max(signal.warningPulse || 0, signal.criticalAmmoPulse || 0, signal.damagePulse || 0), 0, 1);
  field.material.opacity = THREE.MathUtils.clamp((.18 + .14 * noise + .12 * warn) * v * tone, 0, .48);
  field.material.size = .0048 + noise * .0026 + warn * .0018;
  const attr = field.geometry.getAttribute('position');
  const base = field.userData.holoMoteBase, seed = field.userData.holoMoteSeed;
  if (!attr || !base || !seed) return;
  for (let i = 0; i < seed.length; i++) {
    const s = seed[i];
    const ix = i * 3;
    attr.array[ix + 0] = base[ix + 0] + Math.sin(now * (1.7 + s * .015) + s) * .006 * v;
    attr.array[ix + 1] = base[ix + 1] + Math.cos(now * (1.3 + s * .011) + s * .7) * .0045 * v;
    attr.array[ix + 2] = base[ix + 2] + Math.sin(now * (2.4 + s * .017) + s * .3) * .004 * v + noise * .004;
  }
  attr.needsUpdate = true;
}

export function createHoloRippleRing(THREE, w, h, color = 0x80e0ff, order = 1003) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.47, .50, 56), mat);
  ring.scale.set(w, h, 1);
  ring.position.z = .008;
  ring.renderOrder = order;
  ring.frustumCulled = false;
  ring.userData.hologramAtmosphereVersion = HOLOGRAM_ATMOSPHERE_VERSION;
  ring.userData.baseScale = { x: w, y: h, z: 1 };
  return ring;
}

export function syncHoloRippleRing(THREE, ring, vis, now, signal = {}, boost = 0, tone = 1) {
  if (!ring || !ring.material) return;
  const v = THREE.MathUtils.clamp(vis || 0, 0, 1);
  const b = THREE.MathUtils.clamp(boost || 0, 0, 1);
  const noise = THREE.MathUtils.clamp(signal.signalNoise || 0, 0, 1);
  const warn = THREE.MathUtils.clamp(Math.max(signal.warningPulse || 0, signal.criticalAmmoPulse || 0, signal.damagePulse || 0), 0, 1);
  ring.visible = v > .012;
  const phase = (now * 1.45 + (ring.id || 0) * .071) % 1;
  const swell = .92 + phase * .52 + b * .28 + noise * .08;
  const base = ring.userData.baseScale || { x: 1, y: 1, z: 1 };
  ring.scale.set(base.x * swell, base.y * swell, 1);
  ring.rotation.z = Math.sin(now * 2.2 + (ring.id || 0)) * 0.035 * v;
  ring.material.opacity = THREE.MathUtils.clamp((.05 + .18 * (1 - phase) + b * .22 + warn * .10 + noise * .08) * v * tone, 0, .44);
}

export function syncHoloGhostPlane(THREE, mesh, mat, vis, now, signal = {}, tone = 1) {
  if (!mesh || !mat) return;
  const v = THREE.MathUtils.clamp(vis || 0, 0, 1);
  const noise = THREE.MathUtils.clamp(signal.signalNoise || 0, 0, 1);
  const warn = THREE.MathUtils.clamp(Math.max(signal.warningPulse || 0, signal.criticalAmmoPulse || 0, signal.damagePulse || 0), 0, 1);
  mesh.visible = v > .012;
  mesh.position.x = Math.sin(now * 2.6 + (mesh.id || 0) * .13) * .0022 * v * (1 + noise * .8);
  mesh.position.y = Math.cos(now * 2.1 + (mesh.id || 0) * .17) * .0016 * v * (1 + warn * .7);
  mesh.position.z = -.0035 + Math.sin(now * 4.1 + (mesh.id || 0) * .11) * .0008 * v;
  mesh.rotation.z = Math.sin(now * 1.9 + (mesh.id || 0) * .21) * .012 * v;
  mat.opacity = THREE.MathUtils.clamp((.07 + .055 * Math.sin(now * 8.3) + noise * .09 + warn * .05) * v * tone, 0, .28);
}
