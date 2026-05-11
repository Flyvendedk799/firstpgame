function makeColorGradeShader(THREE) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      exposure: { value: 1.0 },
      contrast: { value: 1.0 },
      saturation: { value: 1.0 },
      warm: { value: 0.08 },
      cool: { value: 0.12 },
      vignette: { value: 0.42 },
      grain: { value: 0.035 },
      aberration: { value: 0.0012 },
      sharpen: { value: 0.10 }
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

        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(luma), col, saturation);
        col += vec3(warm * 0.055, warm * 0.028, -warm * 0.014);
        col += vec3(-cool * 0.012, cool * 0.020, cool * 0.060);

        float d = distance(vUv, vec2(0.5));
        col *= 1.0 - smoothstep(0.30, 0.82, d) * vignette;

        float n = hash(vUv * resolution + time * 37.0) - 0.5;
        col += n * grain;

        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }
    `
  };
}

export function getRequestedRendererMode(settings) {
  const qp = new URLSearchParams(location.search);
  const fromUrl = qp.get('renderer');
  if (fromUrl === 'webgpu' || fromUrl === 'webgl') return fromUrl;
  return settings?.rendererMode || 'auto';
}

export async function createBaseRenderer({ THREE, canvas, settings }) {
  const requestedMode = getRequestedRendererMode(settings);
  const webgpuSupported = typeof navigator !== 'undefined' && !!navigator.gpu;
  const preferWebGPU = requestedMode === 'webgpu' || requestedMode === 'auto';
  const info = {
    requestedMode,
    backend: 'webgl',
    webgpuSupported,
    webgpuActive: false,
    fallbackReason: ''
  };

  if (preferWebGPU) {
    if (!webgpuSupported) {
      info.fallbackReason = 'navigator.gpu unavailable';
    } else {
      try {
        const webgpu = await import('three/webgpu');
        const renderer = new webgpu.WebGPURenderer({
          canvas,
          antialias: true,
          powerPreference: 'high-performance'
        });
        if (typeof renderer.init === 'function') await renderer.init();
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
        console.warn('[render] WebGPU startup failed; falling back to WebGL:', err);
      }
    }
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  return { renderer, info };
}

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
    postPath: baseRendererInfo?.backend === 'webgpu' ? 'webgpu-direct' : 'webgl-composer'
  };

  let composer = null;
  const passes = { render: null, gtao: null, bloom: null, grade: null, smaa: null, output: null };
  let webgpuPost = null;
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
    const mods = baseRendererInfo?.webgpuPostModules;
    if (mods?.PostProcessing && mods?.tsl?.viewportTexture && mods?.tsl?.uniform) {
      try {
        const source = mods.tsl.viewportTexture();
        const bloomStrength = mods.tsl.uniform(0.28);
        const bloomSoftness = mods.tsl.uniform(0.08);
        const bloomThreshold = mods.tsl.uniform(0.90);
        const grain = mods.tsl.uniform(0.035);
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
        metadata.webgpuNodePost = { active: false, error: String(err && err.message || err) };
      }
    } else {
      metadata.webgpuNodePost = { active: false, error: baseRendererInfo?.webgpuPostError || 'node post modules unavailable' };
    }
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
      passes.gtao.blendIntensity = ({ low: 0, medium: 0.24, high: 0.42, ultra: 0.56 }[aoQuality] ?? 0.42) * aoMul;
    }
    if (passes.bloom) {
      const reduced = nextSettings.reducedBloomish;
      const strengthByQ = reduced
        ? { low: 0, medium: 0.12, high: 0.20, ultra: 0.30 }
        : { low: 0, medium: 0.18, high: 0.28, ultra: 0.45 };
      const bloomScale = ({ low: 0.55, medium: 0.78, high: 1.0, ultra: 1.22 }[bloomQuality] ?? 1.0);
      passes.bloom.enabled = postEnabled && bloomQuality !== 'off';
      passes.bloom.strength = (strengthByQ[q] ?? 0.28) * bloomMul * bloomScale;
      passes.bloom.radius = (({ low: 0.10, medium: 0.22, high: 0.30, ultra: 0.38 }[q] ?? 0.30) *
        ({ low: 0.78, medium: 0.90, high: 1.0, ultra: 1.12 }[bloomQuality] ?? 1.0));
      passes.bloom.threshold = grade.bloomThreshold ?? 0.90;
    }
    if (passes.grade) {
      passes.grade.enabled = nextSettings.colorGrade !== false && postEnabled;
      passes.grade.uniforms.exposure.value = grade.exposure ?? 1.08;
      passes.grade.uniforms.contrast.value = grade.contrast ?? 1.10;
      passes.grade.uniforms.saturation.value = grade.saturation ?? 0.98;
      passes.grade.uniforms.warm.value = grade.warm ?? 0.08;
      passes.grade.uniforms.cool.value = grade.cool ?? 0.12;
      passes.grade.uniforms.vignette.value = nextSettings.vignette === false ? 0 : (grade.vignette ?? 0.42);
      passes.grade.uniforms.grain.value = nextSettings.filmGrain === false ? 0 : (grade.grain ?? 0.035);
      passes.grade.uniforms.aberration.value = nextSettings.chromaticAberration === false ? 0 : (grade.aberration ?? ({ medium: 0.0007, high: 0.0012, ultra: 0.0016 }[q] ?? 0.0010));
      passes.grade.uniforms.sharpen.value = nextSettings.sharpen === false ? 0 : (grade.sharpen ?? ({ medium: 0.06, high: 0.10, ultra: 0.14 }[q] ?? 0.08));
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
        webgpuPost.bloomThreshold.value = grade.bloomThreshold ?? 0.90;
        webgpuPost.grain.value = nextSettings.filmGrain === false || !postEnabled ? 0 : (grade.grain ?? 0.035);
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

    metadata.postEnabled = !!postEnabled;
    metadata.aoQuality = aoQuality;
    metadata.bloomQuality = bloomQuality;
    metadata.profile = profile.id || 'default';
    metadata.postProfile = postProfile;
    metadata.grade = {
      exposure: grade.exposure ?? 1.08,
      contrast: grade.contrast ?? 1.10,
      saturation: grade.saturation ?? 0.98,
      vignette: grade.vignette ?? 0.42,
      grain: grade.grain ?? 0.035,
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
    renderToTarget
  };
}
