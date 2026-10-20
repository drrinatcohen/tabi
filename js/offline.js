// Keeps every encrypted file of the current version on the phone (Cache Storage), with progress.
import { isWiped } from './store.js';

const DATA_CACHE = 'tabi-data';

export async function loadVersion() {
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    const v = await r.json();
    try { const c = await caches.open(DATA_CACHE); await c.put('version.json', new Response(JSON.stringify(v))); } catch { /* ignore */ }
    return { v, online: true };
  } catch {
    const c = await caches.open(DATA_CACHE);
    const hit = await c.match('version.json');
    if (!hit) throw new Error('offline-first-run');
    return { v: await hit.json(), online: false };
  }
}

export async function getFile(path) {
  const c = await caches.open(DATA_CACHE);
  const hit = await c.match(path);
  if (hit) return hit.arrayBuffer();
  const r = await fetch(path);
  if (!r.ok) throw new Error('missing ' + path);
  const copy = r.clone();
  c.put(path, copy).catch(() => {});
  return r.arrayBuffer();
}

export async function offlineStatus(files) {
  const c = await caches.open(DATA_CACHE);
  let have = 0;
  for (const f of files) if (await c.match(f)) have++;
  return { have, total: files.length };
}

export async function syncOffline(files, onProgress) {
  const c = await caches.open(DATA_CACHE);
  const missing = [];
  for (const f of files) if (!(await c.match(f))) missing.push(f);
  let done = files.length - missing.length;
  onProgress?.(done, files.length);
  let failed = 0;
  const queue = missing.slice();
  async function worker() {
    // "delete everything" (Help → settings) stops the download, so nothing is saved again after it (20.10)
    while (queue.length && !isWiped()) {
      const f = queue.shift();
      try {
        const r = await fetch(f, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        await c.put(f, r);
      } catch { failed++; }
      done++;
      onProgress?.(done, files.length);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (!failed) {
    const keep = new Set(files.concat(['version.json']));
    for (const req of await c.keys()) {
      const p = new URL(req.url).pathname.split('/').slice(-2).join('/');
      const name = keep.has(p) || keep.has(p.split('/').pop()) || [...keep].some(k => req.url.endsWith('/' + k));
      if (!name) await c.delete(req);
    }
  }
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
  return { failed };
}
