export function installPerfDebug({ snapshot } = {}) {
  if (typeof snapshot !== 'function') {
    throw new Error('installPerfDebug requires a snapshot function');
  }
  window.__PERF = { snapshot };
  return window.__PERF;
}

export function installDebugApi({ debug } = {}) {
  if (!debug || typeof debug !== 'object') {
    throw new Error('installDebugApi requires a debug object');
  }
  window.__game = { debug };
  return window.__game;
}
