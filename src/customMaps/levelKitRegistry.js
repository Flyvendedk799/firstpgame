import { DEFAULT_LEVEL_KIT_URL } from './schema.js';

export function createLevelKitRegistry(options = {}) {
  const url = options.url || DEFAULT_LEVEL_KIT_URL;
  const fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  let manifest = null;
  let byId = new Map();
  let loadPromise = null;

  function index(next) {
    manifest = next || null;
    byId = new Map();
    for (const prefab of manifest && Array.isArray(manifest.prefabs) ? manifest.prefabs : []) {
      if (prefab && prefab.id) byId.set(prefab.id, prefab);
    }
    return manifest;
  }

  async function load(force = false) {
    if (manifest && !force) return manifest;
    if (loadPromise && !force) return loadPromise;
    if (!fetchImpl) throw new Error('No fetch implementation available for level kit registry');
    loadPromise = (async () => {
      const res = await fetchImpl(url, { cache: force ? 'reload' : 'default' });
      if (!res.ok) throw new Error(`Failed to load level kit manifest (${res.status})`);
      const data = await res.json();
      return index(data);
    })();
    try {
      return await loadPromise;
    } finally {
      loadPromise = null;
    }
  }

  function setManifest(next) {
    return index(next);
  }

  function getPrefab(id) {
    return byId.get(id) || null;
  }

  function listPrefabs(category = null) {
    const list = Array.from(byId.values());
    return category ? list.filter((p) => p.category === category) : list;
  }

  function listCategories() {
    const configured = manifest && manifest.editor && Array.isArray(manifest.editor.categories) ? manifest.editor.categories : null;
    if (configured) return configured.slice();
    return Array.from(new Set(listPrefabs().map((p) => p.category).filter(Boolean)));
  }

  function resolveAssetUrl(rel) {
    if (!rel) return null;
    if (/^(https?:)?\/\//.test(rel) || rel.startsWith('data:') || rel.startsWith('blob:')) return rel;
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    return `${base}${String(rel).replace(/^\/+/, '')}`;
  }

  return {
    url,
    load,
    setManifest,
    get manifest() { return manifest; },
    getPrefab,
    listPrefabs,
    listCategories,
    resolveAssetUrl,
    status: () => ({ loaded: !!manifest, prefabCount: byId.size, url }),
  };
}

export const DEFAULT_LEVEL_KIT_REGISTRY = createLevelKitRegistry();

