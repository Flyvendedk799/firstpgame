import {
  BUILTIN_CUSTOM_MAP_INDEX_URL,
  CUSTOM_MAP_PACK_STORE,
  DEV_CUSTOM_MAP_INDEX_URL,
  cloneJson,
  normalizeCustomMapPack,
  slugify,
} from './schema.js';

const DB_NAME = 'clearance_custom_maps';
const DB_VERSION = 1;
const STORE_NAME = 'packs';

function localStorageFallback() {
  try {
    const raw = localStorage.getItem(CUSTOM_MAP_PACK_STORE);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function writeLocalStorageFallback(data) {
  try { localStorage.setItem(CUSTOM_MAP_PACK_STORE, JSON.stringify(data || {})); } catch (_) {}
}

export function createCustomMapStore(options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  let dbPromise = null;
  let useFallback = false;
  let builtInCache = null;
  let devCache = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === 'undefined') {
      useFallback = true;
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[custom-maps] IndexedDB unavailable, using localStorage fallback', req.error);
        useFallback = true;
        resolve(null);
      };
    });
    return dbPromise;
  }

  async function txStore(mode = 'readonly') {
    const db = await openDb();
    if (!db || useFallback) return null;
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  async function allLocalPacks() {
    const store = await txStore('readonly');
    if (!store) return Object.values(localStorageFallback()).map(normalizeCustomMapPack);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map(normalizeCustomMapPack));
      req.onerror = () => reject(req.error);
    });
  }

  async function getLocalPack(id) {
    const store = await txStore('readonly');
    if (!store) {
      const pack = localStorageFallback()[id];
      return pack ? normalizeCustomMapPack(pack) : null;
    }
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? normalizeCustomMapPack(req.result) : null);
      req.onerror = () => reject(req.error);
    });
  }

  async function savePack(pack) {
    const normalized = normalizeCustomMapPack(Object.assign({}, pack, { source: pack.source === 'builtin' ? 'local' : (pack.source || 'local'), updatedAt: new Date().toISOString() }));
    const store = await txStore('readwrite');
    if (!store) {
      const data = localStorageFallback();
      data[normalized.id] = normalized;
      writeLocalStorageFallback(data);
      return normalized;
    }
    return new Promise((resolve, reject) => {
      const req = store.put(normalized);
      req.onsuccess = () => resolve(normalized);
      req.onerror = () => reject(req.error);
    });
  }

  async function deletePack(id) {
    const store = await txStore('readwrite');
    if (!store) {
      const data = localStorageFallback();
      delete data[id];
      writeLocalStorageFallback(data);
      return true;
    }
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadBuiltIns(force = false) {
    if (builtInCache && !force) return builtInCache;
    if (!fetchImpl) return [];
    try {
      const indexRes = await fetchImpl(BUILTIN_CUSTOM_MAP_INDEX_URL, { cache: force ? 'reload' : 'default' });
      if (!indexRes.ok) return [];
      const index = await indexRes.json();
      const items = Array.isArray(index.packs) ? index.packs : [];
      const packs = [];
      for (const item of items) {
        if (!item || !item.url) continue;
        const res = await fetchImpl(item.url, { cache: force ? 'reload' : 'default' });
        if (!res.ok) continue;
        const pack = normalizeCustomMapPack(await res.json());
        pack.source = 'builtin';
        pack.locked = true;
        packs.push(pack);
      }
      builtInCache = packs;
      return packs;
    } catch (err) {
      console.warn('[custom-maps] failed to load built-ins', err);
      builtInCache = [];
      return [];
    }
  }

  async function loadDevPacks(force = false) {
    if (devCache && !force) return devCache;
    if (!fetchImpl) return [];
    try {
      const indexRes = await fetchImpl(DEV_CUSTOM_MAP_INDEX_URL, { cache: force ? 'reload' : 'default' });
      if (!indexRes.ok) {
        devCache = [];
        return [];
      }
      const contentType = typeof indexRes.headers?.get === 'function' ? (indexRes.headers.get('content-type') || '') : '';
      if (contentType && !contentType.includes('application/json')) {
        devCache = [];
        return [];
      }
      const index = await indexRes.json();
      const items = Array.isArray(index.packs) ? index.packs : [];
      const packs = [];
      for (const item of items) {
        if (!item || !item.url) continue;
        const res = await fetchImpl(item.url, { cache: force ? 'reload' : 'default' });
        if (!res.ok) continue;
        const pack = normalizeCustomMapPack(await res.json());
        pack.source = 'dev';
        pack.locked = false;
        packs.push(pack);
      }
      devCache = packs;
      return packs;
    } catch (err) {
      console.warn('[custom-maps] failed to load dev project maps', err);
      devCache = [];
      return [];
    }
  }

  async function listAllPacks(options = {}) {
    const force = !!options.force;
    const [builtins, dev, local] = await Promise.all([loadBuiltIns(force), loadDevPacks(force), allLocalPacks()]);
    return [...builtins, ...dev, ...local].sort((a, b) => {
      if (a.source === 'builtin' && b.source !== 'builtin') return -1;
      if (b.source === 'builtin' && a.source !== 'builtin') return 1;
      if (a.source === 'dev' && b.source === 'local') return -1;
      if (b.source === 'dev' && a.source === 'local') return 1;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }

  async function getPack(id) {
    const local = await getLocalPack(id);
    if (local) return local;
    const [builtins, dev] = await Promise.all([loadBuiltIns(), loadDevPacks()]);
    return builtins.find((p) => p.id === id) || dev.find((p) => p.id === id) || null;
  }

  async function importPackJson(json, options = {}) {
    const pack = normalizeCustomMapPack(typeof json === 'string' ? JSON.parse(json) : json);
    if (options.copyId || pack.source === 'builtin') {
      pack.id = options.id || `${pack.id}_copy_${Date.now().toString(36)}`;
      pack.source = 'local';
      pack.title = options.title || `${pack.title} Copy`;
      pack.createdAt = new Date().toISOString();
    }
    return savePack(pack);
  }

  function exportPackJson(pack) {
    return JSON.stringify(normalizeCustomMapPack(pack), null, 2);
  }

  async function savePackToProject(pack) {
    if (!fetchImpl) throw new Error('No fetch implementation available for project save');
    const normalized = normalizeCustomMapPack(pack);
    const slug = slugify(normalized.title || normalized.id);
    const res = await fetchImpl('/__custom-maps/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, pack: normalized }),
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try { msg = (await res.json()).error || msg; } catch (_) {}
      throw new Error(`Project save failed: ${msg}`);
    }
    return res.json();
  }

  async function copyPack(pack, title = null) {
    const copy = normalizeCustomMapPack(cloneJson(pack));
    copy.id = `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    copy.title = title || `${copy.title} Copy`;
    copy.source = 'local';
    copy.locked = false;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    copy.maps = copy.maps.map((map, i) => Object.assign({}, map, { id: `${map.id}_copy_${i}_${Date.now().toString(36)}`, updatedAt: copy.updatedAt }));
    return savePack(copy);
  }

  return {
    init: openDb,
    listLocalPacks: allLocalPacks,
    listBuiltInPacks: loadBuiltIns,
    listDevPacks: loadDevPacks,
    listAllPacks,
    getPack,
    savePack,
    deletePack,
    importPackJson,
    exportPackJson,
    savePackToProject,
    copyPack,
  };
}
