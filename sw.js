// Service worker: app shell cached per build; encrypted data files are cached by the page (tabi-data).
const VERSION = "375e81d15e293e90";
const SHELL = ["./", "fonts/fonts.css", "fonts/noto-sans-hebrew-hebrew.woff2", "fonts/noto-sans-hebrew-latin-ext.woff2", "fonts/noto-sans-hebrew-latin.woff2", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "js/components.js", "js/crypto.js", "js/icons.js", "js/main.js", "js/offline.js", "js/store.js", "js/ui.js", "js/views/guides.js", "js/views/help.js", "js/views/search.js", "js/views/today.js", "js/views/trip.js", "js/views/wallet.js", "js/weather.js", "js/yen.js", "manifest.webmanifest", "robots.txt", "styles.css"];
const SHELL_CACHE = 'tabi-shell-' + VERSION;

self.addEventListener('install', (e) => {
  // 'reload' skips the browser's HTTP cache, so a new build never stores an old copy of a file.
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('tabi-shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req).catch(() => caches.match('version.json', { cacheName: 'tabi-data' })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(caches.match(new URL('index.html', self.registration.scope).href).then(r => r || fetch(req)));
    return;
  }
  e.respondWith((async () => {
    // lookups only (caches.match with cacheName never creates a cache): after "delete everything" nothing reappears (20.10)
    const hit = await caches.match(req, { ignoreSearch: true, cacheName: SHELL_CACHE });
    if (hit) return hit;
    const d = await caches.match(req, { ignoreSearch: true, cacheName: 'tabi-data' })
      || await caches.match(url.pathname.split('/').slice(-2).join('/'), { cacheName: 'tabi-data' });
    if (d) return d;
    return fetch(req);
  })());
});
