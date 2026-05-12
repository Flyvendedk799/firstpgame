// AA visual rendering subsystem.
//
// Responsibilities:
//   - createBaseRenderer: select WebGPU or WebGL based on requested mode,
//     health record, and session fallback flag.
//   - createRenderSubsystem: build a backend-neutral pipeline with a WebGL
//     composer (RenderPass, GTAO, UnrealBloom, color grade, SMAA, OutputPass)
//     or a WebGPU node-post chain (highlight bloom + film + FXAA).
//   - blackFrameSelfTest: render a calibration scene and read pixels back,
//     detecting renderers that initialise but never produce visible output.
//   - Renderer health helpers (localStorage) and session fallback (sessionStorage)
//     so a black-screen failure on one load steers the next load to WebGL
//     until the issue is resolved.
//
// All work here is backend-neutral. Scope PIP rendering, level draw,
// and screenshots all route through this subsystem so WebGL/WebGPU/fallback
// produce comparable output.

const RENDERER_HEALTH_KEY = 'aa_renderer_health';
const SESSION_FALLBACK_KEY = 'aa_force_webgl_fallback';

function makeColorGradeShader(THREE) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      exposure: { value: 1.0 },
      contrast: { value: 1.0 },
      saturation: { value: 1.0 },
      warm: { value: 0.06 },
      cool: { value: 0.08 },
      vignette: { value: 0.22 },
      grain: { value: 0.0 },
      aberration: { value: 0.00035 },
      sharpen: { value: 0.055 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float time;
      uniform float exposure;
      uniform float contrast;
      uniform float saturation;
      uniform float warm;
      uniform float cool;
      uniform float vignette;
      uniform float grain;
      uniform float aberration;
      uniform float sharpen;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 px = 1.0 / max(resolution, vec2(1.0));
        vec2 dir = vUv - 0.5;
        vec2 ca = dir * aberration;

        vec3 col;
        col.r = texture2D(tDiffuse, vUv + ca).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - ca).b;

        vec3 blur = (
          texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb +
          texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb +
          texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb +
          texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb
        ) * 0.25;
        col = mix(col, col + (col - blur), sharpen);

        col *= exposure;
        col = (col - 0.5) * contrast + 0.5;
        col = col / (col + vec3(0.72));

        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(luma), col, saturation);
        col += vec3(warm * 0.055, warm * 0.028, -warm * 0.014);
        col += vec3(-cool * 0.012, cool * 0.020, cool * 0.060);

        float d = distance(vUv, vec2(0.5));
        col *= 1.0 - smoothstep(0.30, 0.82, d) * vignette;

        float n = hash(floor(vUv * resolution) + vec2(17.0, 91.0)) - 0.5;
        col += n * grain;

        gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.0)), 1.0);
      }
    `
  };
}

// ── Renderer health & session fallback storage ──────────────────────────────

export function readRendererHealth() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(RENDERER_HEALTH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export function writeRendererHealth(patch = {}) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const current = readRendererHealth();
    const next = Object.assign({}, current, patch, { updatedAt: new Date().toISOString() });
    localStorage.setItem(RENDERER_HEALTH_KEY, JSON.stringify(next));
    return next;
  } catch (_) {
    return null;
  }
}

export function resetRendererHealth() {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(RENDERER_HEALTH_KEY); } catch (_) {}
  }
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.removeItem(SESSION_FALLBACK_KEY); } catch (_) {}
  }
  return readRendererHealth();
}

export function readSessionFallback() {
  if (typeof sessionStorage === 'undefined') return '';
  try { return sessionStorage.getItem(SESSION_FALLBACK_KEY) || ''; } catch (_) { return ''; }
}

export function setSessionFallback(reason) {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(SESSION_FALLBACK_KEY, String(reason || 'webgpu-black-frame')); } catch (_) {}
}

export function clearSessionFallback() {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(SESSION_FALLBACK_KEY); } catch (_) {}
}

// ── Requested-mode resolution ───────────────────────────────────────────────

export function getRequestedRendererMode(settings) {
  if (typeof location === 'undefined') return settings?.rendererMode || 'auto';
  const qp = new URLSearchParams(location.search);
  const fromUrl = qp.get('renderer');
  if (fromUrl === 'webgpu' || fromUrl === 'webgl') return fromUrl;
  return settings?.rendererMode || 'auto';
}

// Resolve the requested mode into a concrete backend attempt plan.
// URL overrides everything (explicit testing path). Session fallback flags
// (from a previous load that black-screened) and stored health steer the
// auto path away from WebGPU until the user (or a manual reset) clears it.
//
// `auto` is conservative: it only prefers WebGPU after the renderer health
// record proves WebGPU previously rendered non-black frames. First-ever
// loads use WebGL so the user never sees an empty viewport on a browser
// where WebGPU initialises but cannot produce visible output.
export function resolveRendererPlan(settings) {
  const requested = getRequestedRendererMode(settings);
  const health = readRendererHealth();
  const sessionFallback = readSessionFallback();
  const plan = {
    requested,
    source: 'auto-default',
    resolved: 'webgl',
    reason: '',
    allowWebGPU: false,
    health,
    sessionFallback
  };
  if (requested === 'webgl') {
    plan.resolved = 'webgl';
    plan.source = 'explicit-webgl';
    plan.reason = 'explicit-webgl';
    return plan;
  }
  if (requested === 'webgpu') {
    plan.resolved = 'webgpu';
    plan.source = 'explicit-webgpu';
    plan.reason = 'explicit-webgpu';
    plan.allowWebGPU = true;
    return plan;
  }
  // auto
  if (sessionFallback) {
    plan.resolved = 'webgl';
    plan.source = 'session-fallback';
    plan.reason = `session-fallback:${sessionFallback}`;
    return plan;
  }
  if (health && health.failedBackend === 'webgpu' && health.fallbackReason) {
    plan.resolved = 'webgl';
    plan.source = 'health-record';
    plan.reason = `auto-prior-webgpu-failure:${health.fallbackReason}`;
    return plan;
  }
  if (health && health.lastSuccessfulBackend === 'webgpu' && !health.fallbackReason) {
    plan.resolved = 'webgpu';
    plan.source = 'auto-health-prior-webgpu-success';
    plan.reason = 'auto-health-prior-webgpu-success';
    plan.allowWebGPU = true;
    return plan;
  }
  // First-ever auto load (or auto load with no successful WebGPU run yet):
  // start on WebGL and probe WebGPU off-canvas. The probe records health
  // so the next load can prefer WebGPU when it actually works.
  plan.resolved = 'webgl';
  plan.source = 'auto-conservative-first-load';
  plan.reason = 'auto-conservative-first-load';
  plan.allowWebGPU = false;
  return plan;
}

// ── Black-frame self-test ───────────────────────────────────────────────────
// Renders a deterministic calibration scene to an off-screen render target
// and reads the pixels back. If the renderer initialises but produces a
// near-zero-luma frame, the result.ok flag is false. This is the primary
// guard against silent black-screen failures on real browsers.
export async function blackFrameSelfTest(THREE, renderer, options = {}) {
  const w = options.width || 96;
  const h = options.height || 64;
  const sampleLumaThreshold = options.lumaThreshold ?? 12;
  const lumaRangeThreshold = options.lumaRangeThreshold ?? 12;
  const nonBlackRatioThreshold = options.nonBlackRatioThreshold ?? 0.10;
  const bucketThreshold = options.bucketThreshold ?? 3;

  if (!renderer || typeof renderer.render !== 'function') {
    return { ok: false, reason: 'renderer-missing', avgLuma: 0, lumaRange: 0, nonBlackRatio: 0, colorBuckets: 0 };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff8844);
  const cam = new THREE.PerspectiveCamera(60, w / h, 0.1, 10);
  cam.position.set(0, 0.4, 2.4);
  cam.lookAt(0, 0, 0);
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(2, 3, 2);
  scene.add(key);

  const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
  const cubeMat = new THREE.MeshBasicMaterial({ color: 0x44ddff });
  const cube = new THREE.Mesh(cubeGeom, cubeMat);
  cube.rotation.set(0.4, 0.6, 0.0);
  scene.add(cube);
  const accentGeom = new THREE.SphereGeometry(0.42, 16, 12);
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x40ff80, roughness: 0.35, metalness: 0.05 });
  const accent = new THREE.Mesh(accentGeom, accentMat);
  accent.position.set(0.85, -0.2, 0.4);
  scene.add(accent);

  const target = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat
  });
  target.texture.colorSpace = THREE.SRGBColorSpace || THREE.LinearSRGBColorSpace || 'srgb';

  const result = { ok: false, avgLuma: 0, lumaRange: 0, nonBlackRatio: 0, colorBuckets: 0, sampleWidth: w, sampleHeight: h };
  const prevTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;

  try {
    if (typeof renderer.setRenderTarget === 'function') renderer.setRenderTarget(target);
    if (typeof renderer.clear === 'function') renderer.clear(true, true, true);
    renderer.render(scene, cam);
    if (typeof renderer.setRenderTarget === 'function') renderer.setRenderTarget(prevTarget || null);

    const buf = new Uint8Array(w * h * 4);
    let readOk = false;
    if (typeof renderer.readRenderTargetPixelsAsync === 'function') {
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, w, h, buf);
      readOk = true;
    } else if (typeof renderer.readRenderTargetPixels === 'function') {
      renderer.readRenderTargetPixels(target, 0, 0, w, h, buf);
      readOk = true;
    } else {
      result.reason = 'readback-unavailable';
    }
    if (readOk) {
      let sum = 0, min = 255, max = 0, nonBlack = 0;
      const buckets = new Set();
      for (let i = 0; i < buf.length; i += 4) {
        const r = buf[i] | 0, g = buf[i + 1] | 0, b = buf[i + 2] | 0;
        const l = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
        sum += l;
        if (l < min) min = l;
        if (l > max) max = l;
        if (l > 6) nonBlack++;
        buckets.add(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5));
      }
      const total = w * h;
      const avg = sum / total;
      const lumaRange = max - min;
      const ratio = nonBlack / total;
      result.avgLuma = Number(avg.toFixed(2));
      result.lumaRange = lumaRange;
      result.nonBlackRatio = Number(ratio.toFixed(3));
      result.colorBuckets = buckets.size;
      result.ok = avg > sampleLumaThreshold && lumaRange > lumaRangeThreshold && ratio > nonBlackRatioThreshold && buckets.size >= bucketThreshold;
      if (!result.ok) {
        result.reason = `low-luma:${avg.toFixed(1)} range:${lumaRange} buckets:${buckets.size}`;
      }
    }
  } catch (err) {
    result.ok = false;
    result.error = String(err && err.message || err);
    result.reason = result.reason || `selftest-error:${result.error}`;
  } finally {
    try { target.dispose(); } catch (_) {}
    try { cubeGeom.dispose(); } catch (_) {}
    try { cubeMat.dispose(); } catch (_) {}
    try { accentGeom.dispose(); } catch (_) {}
    try { accentMat.dispose(); } catch (_) {}
    scene.traverse((o) => {
      if (o.isLight && typeof o.dispose === 'function') o.dispose();
    });
  }
  return result;
}

// ── Base renderer ───────────────────────────────────────────────────────────

export async function createBaseRenderer({ THREE, canvas, settings }) {
  const requestedMode = getRequestedRendererMode(settings);
  const plan = resolveRendererPlan(settings);
  const webgpuSupported = typeof navigator !== 'undefined' && !!navigator.gpu;
  const info = {
    requestedMode,
    plan,
    backend: 'webgl',
    webgpuSupported,
    webgpuActive: false,
    fallbackReason: plan.reason && plan.resolved === 'webgl' && plan.source !== 'explicit-webgl' ? plan.reason : '',
    fallbackPhase: '',
    health: plan.health,
    sessionFallback: plan.sessionFallback
  };

  if (plan.allowWebGPU) {
    if (!webgpuSupported) {
      info.fallbackReason = 'navigator.gpu unavailable';
      info.fallbackPhase = 'webgpu-init';
    } else {
      try {
        const webgpu = await import('three/webgpu');
        const renderer = new webgpu.WebGPURenderer({
          canvas,
          antialias: true,
          powerPreference: 'high-performance'
        });
        if (typeof renderer.init === 'function') {
          // Defensive timeout — three.js' WebGPURenderer.init() may stall
          // on a missing GPU adapter in some headless environments.
          await Promise.race([
            renderer.init(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('webgpu-init-timeout-8s')), 8000))
          ]);
        }
        // Detect the silent WebGL2 fallback inside WebGPURenderer (it sets
        // `backend.isWebGLBackend = true`). We treat that as a WebGPU failure
        // and let the WebGL renderer take over — otherwise our render pipeline
        // would assert WebGPU code paths (TSL nodes etc.) on a WebGL backend.
        if (renderer.backend && renderer.backend.isWebGLBackend) {
          info.fallbackReason = 'webgpu-silent-webgl-fallback';
          info.fallbackPhase = 'webgpu-init';
          try { renderer.dispose && renderer.dispose(); } catch (_) {}
          try { writeRendererHealth({ failedBackend: 'webgpu', fallbackReason: info.fallbackReason, lastSuccessfulBackend: 'webgl' }); } catch (_) {}
          throw new Error(info.fallbackReason);
        }
        try {
          const [tsl, filmMod, fxaaMod] = await Promise.all([
            import('three/tsl'),
            import('three/examples/jsm/tsl/display/FilmNode.js'),
            import('three/examples/jsm/tsl/display/FXAANode.js')
          ]);
          info.webgpuPostModules = {
            PostProcessing: webgpu.PostProcessing,
            tsl,
            film: filmMod.film,
            fxaa: fxaaMod.fxaa
          };
        } catch (postErr) {
          info.webgpuPostError = String(postErr && postErr.message || postErr);
        }
        THREE.WebGPURenderer = webgpu.WebGPURenderer;
        info.backend = 'webgpu';
        info.webgpuActive = true;
        return { renderer, info };
      } catch (err) {
        info.fallbackReason = String(err && err.message || err);
        info.fallbackPhase = 'webgpu-init';
        try { writeRendererHealth({ failedBackend: 'webgpu', fallbackReason: info.fallbackReason, lastSuccessfulBackend: 'webgl' }); } catch (_) {}
        console.warn('[render] WebGPU startup failed; falling back to WebGL:', err);
      }
    }
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!plan.allowWebGPU && plan.resolved === 'webgl' && plan.source === 'auto-default') {
    // No prior history; mark provisional health to seed normal behaviour.
  }
  return { renderer, info };
}

// ── Render subsystem (composer / node post / direct) ────────────────────────

export function createRenderSubsystem({
  THREE,
  renderer,
  scene,
  camera,
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
  ShaderPass,
  GTAOPass,
  SMAAPass,
  OutputPass,
  settings,
  visualProfile,
  baseRendererInfo
}) {
  const requestedMode = getRequestedRendererMode(settings);
  const metadata = {
    requestedMode,
    backend: baseRendererInfo?.backend || 'webgl',
    webgpuSupported: baseRendererInfo?.webgpuSupported ?? (typeof navigator !== 'undefined' && !!navigator.gpu),
    webgpuActive: !!baseRendererInfo?.webgpuActive,
    fallbackReason: baseRendererInfo?.fallbackReason || '',
    fallbackPhase: baseRendererInfo?.fallbackPhase || '',
    postPath: baseRendererInfo?.backend === 'webgpu' ? 'webgpu-direct' : 'webgl-composer',
    health: baseRendererInfo?.health || {},
    sessionFallback: baseRendererInfo?.sessionFallback || '',
    plan: baseRendererInfo?.plan || null,
    blackFrame: { boot: null, postDisabled: null, runtime: [], lastCheckedAt: 0 },
    runtimeBlackFrameCount: 0,
    runtimeFramesObserved: 0,
    webgpuPostDisabled: false
  };

  let composer = null;
  const passes = { render: null, gtao: null, bloom: null, grade: null, smaa: null, output: null };
  let webgpuPost = null;
  let webgpuPostKillSwitch = false;
  const baseToneMappingExposure = Number.isFinite(renderer.toneMappingExposure) ? renderer.toneMappingExposure : 1;

  if (metadata.backend !== 'webgpu' && typeof EffectComposer === 'function' && typeof RenderPass === 'function') {
    composer = new EffectComposer(renderer);
    passes.render = new RenderPass(scene, camera);
    composer.addPass(passes.render);

    if (typeof GTAOPass === 'function') {
      try {
        passes.gtao = new GTAOPass(scene, camera, innerWidth, innerHeight, null, {
          radius: 0.22,
          distanceExponent: 1.35,
          thickness: 0.72,
          scale: 0.78,
          samples: 8
        }, {
          radius: 5,
          lumaPhi: 9,
          depthPhi: 2,
          normalPhi: 3
        });
        passes.gtao.blendIntensity = 0.42;
        composer.addPass(passes.gtao);
      } catch (err) {
        console.warn('[render] GTAO disabled:', err);
        metadata.gtaoError = String(err && err.message || err);
      }
    }

    if (typeof UnrealBloomPass === 'function') {
      passes.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.30, 0.95);
      composer.addPass(passes.bloom);
    }

    if (typeof ShaderPass === 'function') {
      passes.grade = new ShaderPass(makeColorGradeShader(THREE));
      composer.addPass(passes.grade);
    }

    if (typeof SMAAPass === 'function') {
      passes.smaa = new SMAAPass(innerWidth, innerHeight);
      composer.addPass(passes.smaa);
    }

    if (typeof OutputPass === 'function') {
      passes.output = new OutputPass();
      composer.addPass(passes.output);
    }
  } else if (metadata.backend !== 'webgpu') {
    metadata.postPath = 'direct-webgl';
  }
  if (metadata.backend === 'webgpu') {
    buildWebGpuPost();
  }

  function buildWebGpuPost() {
    if (webgpuPostKillSwitch) {
      webgpuPost = null;
      metadata.postPath = 'webgpu-direct';
      metadata.webgpuNodePost = { active: false, error: metadata.webgpuNodePost?.error || 'killSwitch' };
      return;
    }
    const mods = baseRendererInfo?.webgpuPostModules;
    if (!mods?.PostProcessing || !mods?.tsl?.viewportTexture || !mods?.tsl?.uniform) {
      metadata.webgpuNodePost = { active: false, error: baseRendererInfo?.webgpuPostError || 'node post modules unavailable' };
      return;
    }
    try {
      const source = mods.tsl.viewportTexture();
      const bloomStrength = mods.tsl.uniform(0.28);
      const bloomSoftness = mods.tsl.uniform(0.08);
      const bloomThreshold = mods.tsl.uniform(0.90);
      const grain = mods.tsl.uniform(0.0);
      let outputNode = source;
      if (mods.tsl.luminance && mods.tsl.smoothstep && mods.tsl.float) {
        const bloomMask = mods.tsl.smoothstep(
          bloomThreshold,
          bloomThreshold.add(bloomSoftness),
          mods.tsl.luminance(source.rgb)
        );
        outputNode = outputNode.add(source.mul(bloomMask).mul(bloomStrength));
      }
      if (typeof mods.film === 'function') outputNode = mods.film(outputNode, grain);
      if (typeof mods.fxaa === 'function') outputNode = mods.fxaa(outputNode);
      webgpuPost = {
        processing: new mods.PostProcessing(renderer, outputNode),
        bloomStrength,
        bloomSoftness,
        bloomThreshold,
        grain,
        nodeChain: [
          'viewportTexture',
          mods.tsl.luminance && mods.tsl.smoothstep ? 'highlight-bloom' : null,
          typeof mods.film === 'function' ? 'film' : null,
          typeof mods.fxaa === 'function' ? 'fxaa' : null,
          'renderOutput'
        ].filter(Boolean)
      };
      metadata.postPath = 'webgpu-node-post';
      metadata.webgpuNodePost = { active: true, chain: webgpuPost.nodeChain };
    } catch (err) {
      webgpuPost = null;
      metadata.postPath = 'webgpu-direct';
      metadata.webgpuNodePost = { active: false, error: String(err && err.message || err) };
    }
  }

  function disableWebgpuPost(reason = 'manual') {
    if (metadata.backend !== 'webgpu') return false;
    webgpuPostKillSwitch = true;
    if (webgpuPost && webgpuPost.processing && typeof webgpuPost.processing.dispose === 'function') {
      try { webgpuPost.processing.dispose(); } catch (_) {}
    }
    webgpuPost = null;
    metadata.webgpuPostDisabled = true;
    metadata.webgpuPostDisabledReason = String(reason || 'manual');
    metadata.postPath = 'webgpu-direct';
    metadata.webgpuNodePost = { active: false, error: `disabled:${reason}` };
    return true;
  }

  function enableWebgpuPost() {
    if (metadata.backend !== 'webgpu') return false;
    webgpuPostKillSwitch = false;
    metadata.webgpuPostDisabled = false;
    delete metadata.webgpuPostDisabledReason;
    buildWebGpuPost();
    return !!webgpuPost;
  }

  function resize(width, height) {
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(width, height);
    if (passes.grade) passes.grade.uniforms.resolution.value.set(width, height);
    if (passes.smaa && typeof passes.smaa.setSize === 'function') passes.smaa.setSize(width, height);
  }

  function setPixelRatio(px) {
    renderer.setPixelRatio(px);
    if (composer && typeof composer.setPixelRatio === 'function') composer.setPixelRatio(px);
  }

  function configure(nextSettings = settings, context = {}) {
    const q = nextSettings.quality || 'high';
    const profile = context.visualProfile || visualProfile || {};
    const grade = context.grade || profile.grade || {};
    const postProfile = context.postProfile || 'normal';
    const postEnabled = nextSettings.postEnabled !== false && q !== 'low';
    const aoQuality = nextSettings.aoQuality || 'high';
    const bloomQuality = nextSettings.bloomQuality || 'high';
    const bloomMul = context.bloomMultiplier ?? grade.bloomMultiplier ?? 1;
    const aoMul = context.aoMultiplier ?? grade.aoMultiplier ?? 1;

    if (passes.gtao) {
      passes.gtao.enabled = postEnabled && aoQuality !== 'off' && q !== 'medium-low';
      // High quality uses a tighter blend — closer to "medium‑high" than ultra-ish.
      passes.gtao.blendIntensity = ({ low: 0, medium: 0.24, high: 0.30, ultra: 0.56 }[aoQuality] ?? 0.30) * aoMul;
      // Full GTAO sample cost is meant for ultra; otherwise cap internal quality.
      let effAo = aoQuality;
      if (effAo === 'ultra' && q !== 'ultra') effAo = 'high';
      if (typeof passes.gtao.updateGtaoMaterial === 'function' && typeof passes.gtao.updatePdMaterial === 'function') {
        const tune = ({
          ultra: {
            radius: 0.24,
            distanceExponent: 1.42,
            thickness: 0.74,
            scale: 0.82,
            samples: 16,
            lumaPhi: 9,
            depthPhi: 2,
            normalPhi: 3,
            pdRadius: 8,
            pdSamples: 16
          },
          high: {
            radius: 0.195,
            distanceExponent: 1.305,
            thickness: 0.685,
            scale: 0.735,
            samples: 6,
            lumaPhi: 7.4,
            depthPhi: 1.94,
            normalPhi: 2.85,
            pdRadius: 7,
            pdSamples: 8
          },
          medium: {
            radius: 0.175,
            distanceExponent: 1.26,
            thickness: 0.64,
            scale: 0.70,
            samples: 5,
            lumaPhi: 7,
            depthPhi: 1.85,
            normalPhi: 2.75,
            pdRadius: 6,
            pdSamples: 7
          },
          low: {
            radius: 0.15,
            distanceExponent: 1.18,
            thickness: 0.58,
            scale: 0.66,
            samples: 4,
            lumaPhi: 6,
            depthPhi: 1.65,
            normalPhi: 2.55,
            pdRadius: 5,
            pdSamples: 6
          }
        })[effAo] || ({
          radius: 0.195,
          distanceExponent: 1.305,
          thickness: 0.685,
          scale: 0.735,
          samples: 6,
          lumaPhi: 7.4,
          depthPhi: 1.94,
          normalPhi: 2.85,
          pdRadius: 7,
          pdSamples: 8
        });
        passes.gtao.updateGtaoMaterial({
          radius: tune.radius,
          distanceExponent: tune.distanceExponent,
          thickness: tune.thickness,
          scale: tune.scale,
          samples: tune.samples
        });
        passes.gtao.updatePdMaterial({
          lumaPhi: tune.lumaPhi,
          depthPhi: tune.depthPhi,
          normalPhi: tune.normalPhi,
          radius: tune.pdRadius,
          samples: tune.pdSamples
        });
      }
    }
    if (passes.bloom) {
      const reduced = nextSettings.reducedBloomish;
      const strengthByQ = reduced
        ? { low: 0, medium: 0.10, high: 0.16, ultra: 0.30 }
        : { low: 0, medium: 0.15, high: 0.19, ultra: 0.45 };
      const bloomScale = ({ low: 0.55, medium: 0.78, high: 0.88, ultra: 1.22 }[bloomQuality] ?? 0.88);
      passes.bloom.enabled = postEnabled && bloomQuality !== 'off';
      passes.bloom.strength = (strengthByQ[q] ?? 0.28) * bloomMul * bloomScale;
      passes.bloom.radius = (({ low: 0.10, medium: 0.22, high: 0.265, ultra: 0.38 }[q] ?? 0.265) *
        ({ low: 0.78, medium: 0.90, high: 0.92, ultra: 1.12 }[bloomQuality] ?? 0.92));
      passes.bloom.threshold = grade.bloomThreshold ?? 0.92;
    }
    if (passes.grade) {
      passes.grade.enabled = nextSettings.colorGrade !== false && postEnabled;
      passes.grade.uniforms.exposure.value = THREE.MathUtils.clamp(grade.exposure ?? 1.04, 0.78, 1.24);
      passes.grade.uniforms.contrast.value = THREE.MathUtils.clamp(grade.contrast ?? 1.06, 0.88, 1.22);
      passes.grade.uniforms.saturation.value = THREE.MathUtils.clamp(grade.saturation ?? 0.98, 0.78, 1.12);
      passes.grade.uniforms.warm.value = THREE.MathUtils.clamp(grade.warm ?? 0.06, -0.06, 0.28);
      passes.grade.uniforms.cool.value = THREE.MathUtils.clamp(grade.cool ?? 0.08, -0.04, 0.28);
      passes.grade.uniforms.vignette.value = nextSettings.vignette === false ? 0 : THREE.MathUtils.clamp(grade.vignette ?? 0.22, 0, 0.36);
      passes.grade.uniforms.grain.value = nextSettings.filmGrain === false ? 0 : THREE.MathUtils.clamp(grade.grain ?? 0.0, 0, 0.012);
      passes.grade.uniforms.aberration.value = nextSettings.chromaticAberration === false ? 0 : THREE.MathUtils.clamp(grade.aberration ?? ({ medium: 0.00018, high: 0.00030, ultra: 0.00042 }[q] ?? 0.00024), 0, 0.0007);
      passes.grade.uniforms.sharpen.value = nextSettings.sharpen === false ? 0 : THREE.MathUtils.clamp(grade.sharpen ?? ({ medium: 0.035, high: 0.055, ultra: 0.075 }[q] ?? 0.05), 0, 0.10);
    }
    if (passes.smaa) passes.smaa.enabled = postEnabled && nextSettings.smaa !== false;
    if (passes.output) passes.output.enabled = true;
    if (metadata.backend === 'webgpu') {
      const exposure = nextSettings.colorGrade === false || !postEnabled ? 1 : (grade.exposure ?? 1.08);
      if ('toneMappingExposure' in renderer) {
        renderer.toneMappingExposure = baseToneMappingExposure * THREE.MathUtils.clamp(exposure, 0.62, 1.52);
      }
      if (webgpuPost) {
        webgpuPost.bloomStrength.value = bloomQuality !== 'off' && postEnabled
          ? (({ low: 0.08, medium: 0.16, high: 0.28, ultra: 0.42 }[bloomQuality] ?? 0.28) * bloomMul)
          : 0;
        webgpuPost.bloomSoftness.value = ({ low: 0.04, medium: 0.06, high: 0.08, ultra: 0.12 }[bloomQuality] ?? 0.08);
        webgpuPost.bloomThreshold.value = grade.bloomThreshold ?? 0.92;
        webgpuPost.grain.value = nextSettings.filmGrain === false || !postEnabled ? 0 : THREE.MathUtils.clamp(grade.grain ?? 0, 0, 0.012);
        metadata.postPath = postEnabled ? 'webgpu-node-post' : 'webgpu-direct';
        metadata.webgpuNodePost = { active: !!postEnabled, chain: webgpuPost.nodeChain };
      } else {
        metadata.postPath = postEnabled ? 'webgpu-direct-grade' : 'webgpu-direct';
      }
      metadata.directPost = {
        toneMappingExposure: renderer.toneMappingExposure ?? baseToneMappingExposure,
        colorGrade: nextSettings.colorGrade !== false && postEnabled,
        screenOverlay: nextSettings.colorGrade !== false && postEnabled,
        ambientOcclusion: aoQuality !== 'off' && postEnabled ? 'profile-grounding' : 'off',
        bloom: bloomQuality !== 'off' && postEnabled ? (webgpuPost ? 'node-bloom' : 'emissive-authored') : 'off',
        antialias: webgpuPost && postEnabled ? 'node-fxaa' : 'native',
        film: webgpuPost && postEnabled && nextSettings.filmGrain !== false ? 'node-film' : 'off'
      };
    }

    const activePasses = [];
    if (composer && passes.render && postEnabled !== false && q !== 'low') activePasses.push('render');
    if (passes.gtao && passes.gtao.enabled) activePasses.push('gtao');
    if (passes.bloom && passes.bloom.enabled) activePasses.push('bloom');
    if (passes.grade && passes.grade.enabled) activePasses.push('grade');
    if (passes.smaa && passes.smaa.enabled) activePasses.push('smaa');
    if (passes.output && passes.output.enabled) activePasses.push('output');
    metadata.activePostPasses = activePasses;

    metadata.postEnabled = !!postEnabled;
    metadata.aoQuality = aoQuality;
    metadata.bloomQuality = bloomQuality;
    metadata.profile = profile.id || 'default';
    metadata.postProfile = postProfile;
    metadata.grade = {
      exposure: grade.exposure ?? 1.04,
      contrast: grade.contrast ?? 1.06,
      saturation: grade.saturation ?? 0.98,
      vignette: grade.vignette ?? 0.22,
      grain: grade.grain ?? 0,
      gradeIntensity: grade.gradeIntensity ?? nextSettings.gradeIntensity ?? 1
    };
  }

  function render(timeSeconds = 0) {
    if (passes.grade) passes.grade.uniforms.time.value = timeSeconds;
    if (composer) composer.render();
    else {
      renderer.render(scene, camera);
      if (webgpuPost && metadata.postEnabled) webgpuPost.processing.render();
    }
  }

  function renderDirect(renderCamera = camera) {
    renderer.render(scene, renderCamera);
  }

  function renderToTarget(target, renderCamera) {
    try {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, renderCamera);
      metadata.lastRenderTarget = {
        ok: true,
        backend: metadata.backend,
        width: target?.width || target?.texture?.image?.width || 0,
        height: target?.height || target?.texture?.image?.height || 0,
        at: performance.now()
      };
    } catch (err) {
      metadata.lastRenderTarget = {
        ok: false,
        backend: metadata.backend,
        error: String(err && err.message || err),
        at: performance.now()
      };
      throw err;
    } finally {
      try { renderer.setRenderTarget(null); } catch (_) {}
    }
  }

  // Runtime canvas-luma observer: each tick increments the counter so the
  // health monitor in main.js can sample after N frames and decide whether
  // the active backend is actually painting anything visible.
  function recordRuntimeFrame(stats) {
    metadata.runtimeFramesObserved++;
    if (stats && stats.observedAt) metadata.blackFrame.lastCheckedAt = stats.observedAt;
    if (stats && stats.isBlack) {
      metadata.runtimeBlackFrameCount++;
      metadata.blackFrame.runtime.push(Object.assign({}, stats, { frame: metadata.runtimeFramesObserved }));
      if (metadata.blackFrame.runtime.length > 6) metadata.blackFrame.runtime.shift();
    } else if (stats) {
      metadata.runtimeBlackFrameCount = 0;
    }
    return metadata.runtimeBlackFrameCount;
  }

  function setBlackFrameReport(slot, report) {
    if (!metadata.blackFrame) metadata.blackFrame = { boot: null, postDisabled: null, runtime: [], lastCheckedAt: 0 };
    metadata.blackFrame[slot] = report;
    return report;
  }

  configure(settings, { visualProfile });

  return {
    renderer,
    composer,
    passes,
    webgpuPost,
    metadata,
    resize,
    setPixelRatio,
    configure,
    render,
    renderDirect,
    renderToTarget,
    disableWebgpuPost,
    enableWebgpuPost,
    recordRuntimeFrame,
    setBlackFrameReport,
    get webgpuPostActive() { return !!webgpuPost; }
  };
}

// ── Runtime canvas sampler ──────────────────────────────────────────────────
// Used by the boot self-test and the runtime monitor to sample the visible
// canvas (not just an off-screen RT) so we catch presentation/composition
// failures where the rendered RT contents never make it to screen.
export function sampleCanvasLuma(canvas, options = {}) {
  if (!canvas) return null;
  const w = options.sampleWidth || 64;
  const h = options.sampleHeight || 36;
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return null;
  let tmp;
  try {
    tmp = doc.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, min = 255, max = 0, nonBlack = 0;
    const buckets = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
      sum += l;
      if (l < min) min = l;
      if (l > max) max = l;
      if (l > 6) nonBlack++;
      buckets.add(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5));
    }
    const total = w * h;
    return {
      avgLuma: Number((sum / total).toFixed(2)),
      lumaMin: min,
      lumaMax: max,
      lumaRange: max - min,
      nonBlackRatio: Number((nonBlack / total).toFixed(3)),
      colorBuckets: buckets.size,
      sampleWidth: w,
      sampleHeight: h,
      observedAt: typeof performance !== 'undefined' ? performance.now() : 0
    };
  } catch (err) {
    return { error: String(err && err.message || err), observedAt: typeof performance !== 'undefined' ? performance.now() : 0 };
  } finally {
    if (tmp) {
      tmp.width = 1;
      tmp.height = 1;
    }
  }
}
