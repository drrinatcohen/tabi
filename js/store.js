// Per-phone preferences (who is using this phone, checklist, journal). Never required for the app to work.
const NS = 'tabi:';

export const store = {
  get(k, fallback = null) {
    try {
      const v = localStorage.getItem(NS + k);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch { return false; }
  },
  del(k) {
    try { localStorage.removeItem(NS + k); } catch { /* ignore */ }
  },
};

// The content key is also mirrored to IndexedDB, which iOS keeps more reliably for home-screen apps.
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('tabi', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function idbGet(k) {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const req = db.transaction('kv').objectStore('kv').get(k);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function idbSet(k, v) {
  try {
    const db = await idb();
    await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = resolve; tx.onerror = resolve;
    });
  } catch { /* ignore */ }
}

// Third copy in Cache Storage: survives cases where iOS drops localStorage/IndexedDB of a home-screen app.
const KEEP_CACHE = 'tabi-keep';

export async function keepGet(k) {
  try {
    const hit = await (await caches.open(KEEP_CACHE)).match('keep/' + k);
    return hit ? (await hit.json()).v : null;
  } catch { return null; }
}

export async function keepSet(k, v) {
  try { await (await caches.open(KEEP_CACHE)).put('keep/' + k, new Response(JSON.stringify({ v }))); } catch { /* ignore */ }
}

// Save a value everywhere we can; read it from the first place that still has it.
export async function persist(k, v) {
  store.set(k, v);
  await Promise.race([Promise.all([idbSet(k, v), keepSet(k, v)]), new Promise(r => setTimeout(r, 1500))]);
}

export async function recall(k) {
  const v = store.get(k) ?? await keepGet(k) ?? await Promise.race([idbGet(k), new Promise(r => setTimeout(() => r(null), 1500))]);
  if (v != null && store.get(k) == null) store.set(k, v);
  return v;
}
