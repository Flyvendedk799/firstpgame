// All PBR presets reference their authored map slots by name (e.g. 'concreteAlbedo').
// When a key is present in the `textures` dict passed to createPbrMaterialLibrary,
// the authored map is used; when it is absent, the get() function falls back to
// the procedural generator. This lets us drop a new texture set into
// public/assets/materials/<name>/ and wire it via a single line in main.js
// without touching the renderer.
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
const MATERIAL_PRESETS = {
  concrete: {
    color: 0xffffff, roughness: 0.88, metalness: 0.02, normalScale: 0.46,
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
    tex.anisotropy = Math.max(tex.anisotropy || 0, 8);
    if ('colorSpace' in tex) tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if ('minFilter' in tex) tex.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
    if ('magFilter' in tex) tex.magFilter = THREE.LinearFilter;
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
    profile: (name) => profiles[name] || profiles.concrete,
    names: () => Object.keys(profiles),
    generatedMapCount: () => generatedMaps.size,
    disposeGeneratedMaps,
    categories: () => Object.keys(profiles).slice()
  };
}
