/*
 * Chromium test harness shim for the WebExtension APIs the content script uses.
 *  - browser.storage.local: persisted in page localStorage ("__kex_shim_storage__") so reloads and second tabs behave like
 *    a real profile; seedable once via window.__KEX_SEED__ (applied only while nothing has been persisted yet).
 *  - browser.runtime.getURL -> https://kex.ext/...  (served by page.route in the fixtures)
 *  - browser.runtime.sendMessage: no-op.
 */
(() => {
  if (window.top !== window) return;
  const KEY = '__kex_shim_storage__';
  let store = {};
  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  };
  const existing = read();
  if (existing) store = existing;
  else if (window.__KEX_SEED__) {
    store = JSON.parse(JSON.stringify(window.__KEX_SEED__));
    persist();
  }

  const listeners = new Set();
  const emit = (changes) => {
    if (!Object.keys(changes).length) return;
    for (const l of Array.from(listeners)) {
      try {
        l(changes, 'local');
      } catch (e) {
        console.error(e);
      }
    }
  };
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const local = {
    async get(keys) {
      if (keys === null || keys === undefined) return clone(store);
      const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in store) out[k] = clone(store[k]);
      if (keys && typeof keys === 'object' && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) if (!(k in out)) out[k] = d;
      return out;
    },
    async set(items) {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: clone(store[k]), newValue: clone(v) };
        store[k] = clone(v);
      }
      persist();
      emit(changes);
    },
    async remove(keys) {
      const changes = {};
      for (const k of typeof keys === 'string' ? [keys] : keys) {
        if (k in store) {
          changes[k] = { oldValue: clone(store[k]) };
          delete store[k];
        }
      }
      persist();
      emit(changes);
    },
    async clear() {
      await local.remove(Object.keys(store));
    },
  };
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const before = store;
    store = read() || {};
    const changes = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(store)])) {
      if (JSON.stringify(before[k]) !== JSON.stringify(store[k])) changes[k] = { oldValue: clone(before[k]), newValue: clone(store[k]) };
    }
    emit(changes);
  });

  window.browser = {
    storage: {
      local,
      onChanged: { addListener: (l) => listeners.add(l), removeListener: (l) => listeners.delete(l), hasListener: (l) => listeners.has(l) },
    },
    runtime: {
      getURL: (p) => 'https://kex.ext/' + String(p).replace(/^\//, ''),
      sendMessage: async () => undefined,
      openOptionsPage: async () => undefined,
      onMessage: { addListener() {}, removeListener() {} },
    },
  };
})();
