// All PBR presets reference their authored map slots by name (e.g. 'concreteAlbedo').
// When a key is present in the `textures` dict passed to createPbrMaterialLibrary,
// the authored map is used; when it is absent, the get() function falls back to
// the procedural generator. This lets us drop a new texture set into
// public/assets/materials/<name>/ and wire it via a single line in main.js
// without touching the renderer.
// Public helper: consistent filtering for all PBR maps (authored PNG, procedural canvas,
// or runtime clones). Prevents grazing-angle / motion “shimmer” from nearest-level mip
// hopping and undersampled anisotropy.
function _textureHasRenderableImage(tex) {
  if (!tex || !tex.image) return false;
  const im = tex.image;
  if (tex.isDataTexture || tex.isCompressedTexture) return true;
  if (typeof HTMLCanvasElement !== 'undefined' && im instanceof HTMLCanvasElement) {
    return (im.width || 0) > 0 && (im.height || 0) > 0;
  }
  if (typeof OffscreenCanvas !== 'undefined' && im instanceof OffscreenCanvas) {
    return (im.width || 0) > 0 && (im.height || 0) > 0;
  }
  if (typeof HTMLImageElement !== 'undefined' && im instanceof HTMLImageElement) {
    return !!(im.complete && im.naturalWidth > 0);
  }
  if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) {
    return (im.width || 0) > 0;
  }
  return !!(im.width && im.height);
}

export function finalizePbrSurfaceTexture(THREE, tex, isColor = false) {
  if (!tex || !tex.isTexture) return tex;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.max(tex.anisotropy || 0, 12);
  if ('colorSpace' in tex) tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (_textureHasRenderableImage(tex)) {
    tex.needsUpdate = true;
  } else if (tex.image && typeof tex.image.addEventListener === 'function') {
    const bump = () => {
      tex.needsUpdate = true;
    };
    tex.image.addEventListener('load', bump, { once: true });
    tex.image.addEventListener('error', () => {}, { once: true });
  }
  return tex;
}

function authoredMaps(name, extras = {}) {
  return {
    map: `${name}Albedo`,
    normalMap: `${name}Normal`,
    roughnessMap: `${name}Roughness`,
    metalnessMap: `${name}Metalness`,
    aoMap: `${name}Ao`,
    ...extras
  };
}

export const CORE_VISUAL_MATERIAL_POLISH_VERSION = 'core-visual-material-polish-v1';

const CORE_VISUAL_MATERIAL_POLISH_PROFILES = {
  concrete: { scale: 0.38, colorBreakup: 0.050, roughnessNoise: 0.075, grime: 0.080, rimStrength: 0.014, rimPower: 2.7, rimColor: 0x7f94a8 },
  tile: { scale: 0.46, colorBreakup: 0.030, roughnessNoise: 0.045, grime: 0.045, rimStrength: 0.012, rimPower: 2.9, rimColor: 0xd7f2ec },
  metal: { scale: 0.58, colorBreakup: 0.020, roughnessNoise: 0.050, grime: 0.030, rimStrength: 0.040, rimPower: 2.35, rimColor: 0xc8d6e6 },
  paintedMetal: { scale: 0.52, colorBreakup: 0.026, roughnessNoise: 0.052, grime: 0.050, rimStrength: 0.026, rimPower: 2.55, rimColor: 0x9ab5cf },
  glass: { scale: 0.42, colorBreakup: 0.010, roughnessNoise: 0.020, grime: 0.012, rimStrength: 0.060, rimPower: 2.15, rimColor: 0xd8f2ff },
  wood: { scale: 0.34, colorBreakup: 0.045, roughnessNoise: 0.050, grime: 0.050, rimStrength: 0.016, rimPower: 2.8, rimColor: 0xffd6a0 },
  rubber: { scale: 0.64, colorBreakup: 0.022, roughnessNoise: 0.035, grime: 0.060, rimStrength: 0.008, rimPower: 3.0, rimColor: 0x6e7a84 },
  fabric: { scale: 0.40, colorBreakup: 0.040, roughnessNoise: 0.045, grime: 0.055, rimStrength: 0.012, rimPower: 3.1, rimColor: 0x8fa0b2 },
  plastic: { scale: 0.55, colorBreakup: 0.030, roughnessNoise: 0.046, grime: 0.040, rimStrength: 0.026, rimPower: 2.45, rimColor: 0x9be7ff },
  skin: { scale: 0.26, colorBreakup: 0.018, roughnessNoise: 0.020, grime: 0.012, rimStrength: 0.010, rimPower: 3.1, rimColor: 0xffd0b0 },
  hair: { scale: 0.30, colorBreakup: 0.030, roughnessNoise: 0.035, grime: 0.030, rimStrength: 0.012, rimPower: 2.8, rimColor: 0x806040 },
  armor: { scale: 0.62, colorBreakup: 0.024, roughnessNoise: 0.052, grime: 0.038, rimStrength: 0.032, rimPower: 2.45, rimColor: 0xb6cadc },
  marble: { scale: 0.30, colorBreakup: 0.020, roughnessNoise: 0.034, grime: 0.024, rimStrength: 0.024, rimPower: 2.6, rimColor: 0xf1efe2 },
  brass: { scale: 0.44, colorBreakup: 0.018, roughnessNoise: 0.040, grime: 0.028, rimStrength: 0.046, rimPower: 2.35, rimColor: 0xffd684 },
  chrome: { scale: 0.50, colorBreakup: 0.012, roughnessNoise: 0.030, grime: 0.018, rimStrength: 0.065, rimPower: 2.1, rimColor: 0xe5f4ff },
  leather: { scale: 0.36, colorBreakup: 0.046, roughnessNoise: 0.056, grime: 0.052, rimStrength: 0.018, rimPower: 2.75, rimColor: 0xb88a62 },
  wetSurface: { scale: 0.48, colorBreakup: 0.018, roughnessNoise: 0.028, grime: 0.018, rimStrength: 0.050, rimPower: 2.1, rimColor: 0xc8e8ff },
  emissivePanel: { scale: 0.54, colorBreakup: 0.012, roughnessNoise: 0.018, grime: 0.010, rimStrength: 0.024, rimPower: 2.4, rimColor: 0xffffff },
  warningPaint: { scale: 0.56, colorBreakup: 0.036, roughnessNoise: 0.052, grime: 0.055, rimStrength: 0.020, rimPower: 2.65, rimColor: 0xffd080 },
  signage: { scale: 0.45, colorBreakup: 0.025, roughnessNoise: 0.036, grime: 0.032, rimStrength: 0.016, rimPower: 2.8, rimColor: 0xe8f0ff }
};

function _qualityPolishScale(qualityName) {
  if (qualityName === 'ultra') return 1.14;
  if (qualityName === 'high') return 1.0;
  return 0;
}

function _coreVisualPolishParams(name, material, qualityName) {
  const qScale = _qualityPolishScale(qualityName);
  if (!qScale || !material || !CORE_VISUAL_MATERIAL_POLISH_PROFILES[name]) return null;
  if (material.transparent || material.depthWrite === false || material.opacity < 0.999) return null;
  if (!(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)) return null;
  const p = CORE_VISUAL_MATERIAL_POLISH_PROFILES[name];
  const reflectiveBoost = Math.max(0, Math.min(1, ((material.envMapIntensity || 0) - 0.65) * 0.9 + (material.metalness || 0) * 0.35));
  return {
    version: CORE_VISUAL_MATERIAL_POLISH_VERSION,
    family: name,
    quality: qualityName,
    variant: CORE_VISUAL_MATERIAL_POLISH_VERSION,
    scale: p.scale,
    colorBreakup: p.colorBreakup * qScale,
    roughnessNoise: p.roughnessNoise * qScale,
    grime: p.grime * qScale,
    rimStrength: p.rimStrength * (0.75 + reflectiveBoost) * qScale,
    rimPower: p.rimPower,
    rimColor: p.rimColor
  };
}

function _injectCoreVisualMaterialPolish(shader) {
  if (!shader || !shader.vertexShader || !shader.fragmentShader) return false;
  if (shader.fragmentShader.includes('AA_CORE_VISUAL_MATERIAL_POLISH')) return true;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', [
      '#include <common>',
      'varying vec3 vAaPolishWorldPos;'
    ].join('\n'))
    .replace('#include <worldpos_vertex>', [
      '#include <worldpos_vertex>',
      'vAaPolishWorldPos = worldPosition.xyz;'
    ].join('\n'));
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', [
      '#include <common>',
      '#define AA_CORE_VISUAL_MATERIAL_POLISH 1',
      'uniform float aaPolishScale;',
      'uniform float aaPolishColorBreakup;',
      'uniform float aaPolishRoughnessNoise;',
      'uniform float aaPolishGrime;',
      'uniform float aaPolishRimStrength;',
      'uniform float aaPolishRimPower;',
      'uniform vec3 aaPolishRimColor;',
      'varying vec3 vAaPolishWorldPos;',
      'float aaPolishHash(vec2 p) {',
      '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
      '  p3 += dot(p3, p3.yzx + 33.33);',
      '  return fract((p3.x + p3.y) * p3.z);',
      '}'
    ].join('\n'))
    .replace('#include <map_fragment>', [
      '#include <map_fragment>',
      'vec2 aaPolishUv = vAaPolishWorldPos.xz * max(aaPolishScale, 0.001);',
      'float aaPolishFine = aaPolishHash(floor(aaPolishUv * 5.0));',
      'float aaPolishLarge = aaPolishHash(floor(aaPolishUv * 1.45 + vec2(19.0, 7.0)));',
      'float aaPolishLow = smoothstep(0.92, 0.18, vAaPolishWorldPos.y);',
      'float aaPolishDirt = smoothstep(0.70, 1.0, aaPolishLarge) * (0.45 + aaPolishLow * 0.55);'
    ].join('\n'))
    .replace('#include <color_fragment>', [
      '#include <color_fragment>',
      'float aaPolishTone = (aaPolishFine - 0.5) * aaPolishColorBreakup - aaPolishDirt * aaPolishGrime;',
      'diffuseColor.rgb *= clamp(1.0 + aaPolishTone, 0.72, 1.18);'
    ].join('\n'))
    .replace('#include <roughnessmap_fragment>', [
      '#include <roughnessmap_fragment>',
      'roughnessFactor = clamp(roughnessFactor + (aaPolishFine - 0.5) * aaPolishRoughnessNoise + aaPolishDirt * aaPolishGrime * 0.16, 0.035, 1.0);'
    ].join('\n'))
    .replace('#include <normal_fragment_begin>', [
      '#include <normal_fragment_begin>',
      'float aaPolishNdotV = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);',
      'float aaPolishRim = pow(1.0 - aaPolishNdotV, aaPolishRimPower) * aaPolishRimStrength;'
    ].join('\n'))
    .replace('#include <emissivemap_fragment>', [
      '#include <emissivemap_fragment>',
      'totalEmissiveRadiance += aaPolishRimColor * aaPolishRim * (0.28 + (1.0 - roughnessFactor) * 0.85);'
    ].join('\n'));
  return true;
}

export function ensureCoreVisualMaterialPolish(THREE, material) {
  const params = material && material.userData && material.userData.aaCoreVisualPolishParams;
  if (!THREE || !material || !params) return material;
  const previousCompile = material.onBeforeCompile;
  const baseCompile = previousCompile && previousCompile._aaCoreVisualWrapper
    ? previousCompile._aaCoreVisualBase
    : previousCompile;
  const previousKey = material.customProgramCacheKey;
  const baseKey = previousKey && previousKey._aaCoreVisualWrapper
    ? previousKey._aaCoreVisualBase
    : previousKey;
  const rimColor = new THREE.Color(params.rimColor);
  const wrapper = function coreVisualMaterialPolish(shader, renderer) {
    if (typeof baseCompile === 'function') baseCompile.call(this, shader, renderer);
    shader.uniforms.aaPolishScale = { value: params.scale };
    shader.uniforms.aaPolishColorBreakup = { value: params.colorBreakup };
    shader.uniforms.aaPolishRoughnessNoise = { value: params.roughnessNoise };
    shader.uniforms.aaPolishGrime = { value: params.grime };
    shader.uniforms.aaPolishRimStrength = { value: params.rimStrength };
    shader.uniforms.aaPolishRimPower = { value: params.rimPower };
    shader.uniforms.aaPolishRimColor = { value: rimColor };
    _injectCoreVisualMaterialPolish(shader);
  };
  wrapper._aaCoreVisualWrapper = true;
  wrapper._aaCoreVisualBase = baseCompile;
  material.onBeforeCompile = wrapper;
  const keyWrapper = function coreVisualMaterialPolishKey() {
    const prior = typeof baseKey === 'function' ? baseKey.call(this) : '';
    return `${prior}|${params.variant}`;
  };
  keyWrapper._aaCoreVisualWrapper = true;
  keyWrapper._aaCoreVisualBase = baseKey;
  material.customProgramCacheKey = keyWrapper;
  material.userData.aaCoreVisualShader = true;
  material.userData.aaCoreVisualShaderProfile = params.family;
  material.userData.aaCoreVisualShaderTier = params.quality;
  material.userData.aaCoreVisualShaderVersion = params.version;
  material.needsUpdate = true;
  return material;
}

const MATERIAL_PRESETS = {
  concrete: {
    color: 0xffffff, roughness: 0.895, metalness: 0.02, normalScale: 0.42,
    ...authoredMaps('concrete')
  },
  tile: { color: 0xd8ddd8, roughness: 0.46, metalness: 0.00, normalScale: 0.38, ...authoredMaps('tile') },
  metal: { color: 0x70757c, roughness: 0.36, metalness: 0.78, normalScale: 0.32, ...authoredMaps('metal') },
  paintedMetal: { color: 0x30343a, roughness: 0.62, metalness: 0.42, normalScale: 0.40, ...authoredMaps('paintedMetal') },
  glass: { color: 0xaec8d8, roughness: 0.08, metalness: 0.02, transparent: true, opacity: 0.38, envMapIntensity: 1.45 },
  wood: { color: 0x62401e, roughness: 0.58, metalness: 0.03, normalScale: 0.45, ...authoredMaps('wood') },
  rubber: { color: 0x08090b, roughness: 0.92, metalness: 0.00, normalScale: 0.30, ...authoredMaps('rubber') },
  fabric: { color: 0x24272c, roughness: 0.94, metalness: 0.00, normalScale: 0.65, ...authoredMaps('fabric') },
  plastic: { color: 0x1a1d22, roughness: 0.74, metalness: 0.02, normalScale: 0.28, ...authoredMaps('plastic') },
  skin: { color: 0xc8926b, roughness: 0.68, metalness: 0.00, normalScale: 0.22 },
  hair: { color: 0x18120a, roughness: 0.50, metalness: 0.00, normalScale: 0.20 },
  armor: { color: 0x1c2028, roughness: 0.56, metalness: 0.36, normalScale: 0.45, ...authoredMaps('armor') },
  marble: { color: 0xd8d0bd, roughness: 0.30, metalness: 0.00, envMapIntensity: 0.95, normalScale: 0.22, ...authoredMaps('marble') },
  brass: { color: 0xc49a46, roughness: 0.28, metalness: 0.74, envMapIntensity: 1.20, normalScale: 0.18, ...authoredMaps('brass') },
  chrome: { color: 0xa8b0b8, roughness: 0.18, metalness: 0.88, envMapIntensity: 1.30, normalScale: 0.16, ...authoredMaps('chrome') },
  leather: { color: 0x3a2216, roughness: 0.70, metalness: 0.02, normalScale: 0.42, ...authoredMaps('leather') },
  wetSurface: { color: 0x101820, roughness: 0.18, metalness: 0.01, transparent: true, opacity: 0.34, envMapIntensity: 1.10 },
  grime: { color: 0x080808, roughness: 0.96, metalness: 0.00, transparent: true, opacity: 0.40 },
  decal: { color: 0x080608, roughness: 0.90, metalness: 0.00, transparent: true, opacity: 0.72 },
  emissivePanel: { color: 0xffffff, roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.55 },
  // Damage / decal categories (Section 8 expansion). They are flagged as
  // decals so depthWrite stays off and they don't fight z with the surface
  // they paint onto.
  blood: { color: 0x6c0a08, roughness: 0.62, metalness: 0.00, transparent: true, opacity: 0.86, depthWrite: false, alphaTest: 0.06 },
  bulletHole: { color: 0x0a0a0a, roughness: 0.85, metalness: 0.10, transparent: true, opacity: 0.95, depthWrite: false, alphaTest: 0.06 },
  scorchMark: { color: 0x141008, roughness: 0.95, metalness: 0.00, transparent: true, opacity: 0.78, depthWrite: false, alphaTest: 0.04 },
  glassCrack: { color: 0xe0e8f0, roughness: 0.15, metalness: 0.02, transparent: true, opacity: 0.65, depthWrite: false, alphaTest: 0.03 },
  warningPaint: { color: 0xffb020, roughness: 0.68, metalness: 0.02, emissive: 0x442800, emissiveIntensity: 0.18, normalScale: 0.30 },
  signage: { color: 0xf4f0e8, roughness: 0.52, metalness: 0.02, emissive: 0x100c08, emissiveIntensity: 0.05, normalScale: 0.20 }
};

const QUALITY = {
  low: { maps: false, normalScale: 0.35, envMapIntensity: 0.35, emissiveIntensity: 0.70 },
  medium: { maps: true, normalScale: 0.65, envMapIntensity: 0.65, emissiveIntensity: 0.85 },
  high: { maps: true, normalScale: 1.0, envMapIntensity: 1.0, emissiveIntensity: 1.0 },
  ultra: { maps: true, normalScale: 1.08, envMapIntensity: 1.10, emissiveIntensity: 1.04 }
};

export function createPbrMaterialLibrary(THREE, textures = {}, getSettings = () => ({})) {
  const profiles = MATERIAL_PRESETS;
  const generatedMaps = new Map();
  const noProceduralMaps = new Set(['glass', 'grime', 'decal', 'wetSurface', 'emissivePanel', 'blood', 'bulletHole', 'scorchMark', 'glassCrack']);
  function hash(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function generatedMap(name, type) {
    if (typeof document === 'undefined' || noProceduralMaps.has(name)) return null;
    const key = `${name}:${type}`;
    if (generatedMaps.has(key)) return generatedMaps.get(key);
    const base = profiles[name] || profiles.concrete;
    if (type === 'metalness' && (base.metalness || 0) < 0.10) {
      generatedMaps.set(key, null);
      return null;
    }
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    const rough = Math.round((base.roughness ?? 0.7) * 255);
    const metal = Math.round((base.metalness ?? 0) * 255);
    const seed = Object.keys(profiles).indexOf(name) + 1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const n0 = hash(x, y, seed);
        const n1 = hash(x + 11, y - 7, seed + 9);
        const grain = (n0 - 0.5) * 42 + (n1 - 0.5) * 18;
        if (type === 'normal') {
          img.data[i + 0] = Math.max(96, Math.min(160, 128 + grain));
          img.data[i + 1] = Math.max(96, Math.min(160, 128 + (n1 - 0.5) * 44));
          img.data[i + 2] = 242;
        } else if (type === 'metalness') {
          const v = Math.max(0, Math.min(255, metal + grain * 0.32));
          img.data[i + 0] = v; img.data[i + 1] = v; img.data[i + 2] = v;
        } else {
          const v = Math.max(16, Math.min(245, rough + grain * 0.55));
          img.data[i + 0] = v; img.data[i + 1] = v; img.data[i + 2] = v;
        }
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(type === 'normal' ? 3 : 2, type === 'normal' ? 3 : 2);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.userData = { aaGeneratedMap: type, aaMaterial: name };
    generatedMaps.set(key, tex);
    return tex;
  }
  function quality() {
    const settings = getSettings() || {};
    return QUALITY[settings.textureQuality || settings.quality || 'high'] || QUALITY.high;
  }
  function pickMap(map, q) {
    if (!q.maps) return null;
    if (typeof map === 'string') return textures[map] || null;
    return map || null;
  }
  function prepareMap(tex, isColor = false) {
    if (!tex || !tex.isTexture) return tex || null;
    tex.wrapS = tex.wrapS || THREE.RepeatWrapping;
    tex.wrapT = tex.wrapT || THREE.RepeatWrapping;
    finalizePbrSurfaceTexture(THREE, tex, isColor);
    return tex;
  }
  function get(name, overrides = {}) {
    const base = profiles[name] || profiles.concrete;
    const settings = getSettings() || {};
    const requestedQuality = settings.textureQuality || settings.quality || 'high';
    const qualityName = QUALITY[requestedQuality] ? requestedQuality : 'high';
    const q = QUALITY[qualityName] || QUALITY.high;
    const map = prepareMap(pickMap(overrides.map ?? base.map, q), true);
    const normalMap = prepareMap(pickMap(overrides.normalMap ?? base.normalMap ?? (q.maps ? generatedMap(name, 'normal') : null), q));
    const roughnessMap = prepareMap(pickMap(overrides.roughnessMap ?? base.roughnessMap ?? (q.maps ? generatedMap(name, 'roughness') : null), q));
    const metalnessMap = prepareMap(pickMap(overrides.metalnessMap ?? base.metalnessMap ?? (q.maps ? generatedMap(name, 'metalness') : null), q));
    const aoMap = prepareMap(pickMap(overrides.aoMap ?? base.aoMap, q));
    const emissive = overrides.emissive ?? base.emissive ?? 0x000000;
    const emissiveIntensity = (overrides.emissiveIntensity ?? base.emissiveIntensity ?? 1) * q.emissiveIntensity;
    const mat = new THREE.MeshStandardMaterial({
      color: overrides.color ?? base.color,
      map,
      normalMap,
      roughnessMap,
      metalnessMap,
      aoMap,
      aoMapIntensity: overrides.aoMapIntensity ?? base.aoMapIntensity ?? 1.0,
      roughness: overrides.roughness ?? base.roughness ?? 0.72,
      metalness: overrides.metalness ?? base.metalness ?? 0,
      emissive,
      emissiveIntensity,
      transparent: overrides.transparent ?? base.transparent ?? false,
      opacity: overrides.opacity ?? base.opacity ?? 1,
      side: overrides.side ?? base.side ?? THREE.FrontSide,
      depthWrite: overrides.depthWrite ?? base.depthWrite ?? true,
      depthTest: overrides.depthTest ?? base.depthTest ?? true,
      alphaTest: overrides.alphaTest ?? base.alphaTest ?? 0,
      blending: overrides.blending ?? base.blending ?? THREE.NormalBlending,
      envMapIntensity: (overrides.envMapIntensity ?? base.envMapIntensity ?? 0.7) * q.envMapIntensity
    });
    if (mat.normalScale) {
      const s = (overrides.normalScale ?? base.normalScale ?? 0.5) * q.normalScale;
      mat.normalScale.set(s, s);
    }
    mat.userData.aaMaterial = name;
    mat.userData.aaMaterialQuality = q;
    mat.userData.aaMaterialQualityName = qualityName;
    mat.userData.aaAuthoredMaps = !!(map && typeof (base.map) === 'string') ||
                                  !!(normalMap && typeof (base.normalMap) === 'string') ||
                                  !!(roughnessMap && typeof (base.roughnessMap) === 'string') ||
                                  !!(metalnessMap && typeof (base.metalnessMap) === 'string') ||
                                  !!(aoMap && typeof (base.aoMap) === 'string');
    const polishParams = _coreVisualPolishParams(name, mat, qualityName);
    if (polishParams) {
      mat.userData.aaCoreVisualPolishParams = polishParams;
      ensureCoreVisualMaterialPolish(THREE, mat);
    }
    return mat;
  }
  function disposeGeneratedMaps() {
    let count = 0;
    for (const tex of generatedMaps.values()) {
      try { if (tex && typeof tex.dispose === 'function') tex.dispose(); count++; } catch (_) {}
    }
    generatedMaps.clear();
    return count;
  }
  return {
    get,
    shaderPolishVersion: () => CORE_VISUAL_MATERIAL_POLISH_VERSION,
    shaderPolishProfiles: () => Object.keys(CORE_VISUAL_MATERIAL_POLISH_PROFILES),
    profile: (name) => profiles[name] || profiles.concrete,
    names: () => Object.keys(profiles),
    generatedMapCount: () => generatedMaps.size,
    disposeGeneratedMaps,
    categories: () => Object.keys(profiles).slice()
  };
}
