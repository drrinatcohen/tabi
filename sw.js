// Service worker: app shell cached per build; encrypted data files are cached by the page (tabi-data).
const VERSION = "6d4df7d61de4672b";
const SHELL = ["./", "fonts/assistant-hebrew.woff2", "fonts/assistant-latin.woff2", "fonts/fonts.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "js/components.js", "js/crypto.js", "js/icons.js", "js/main.js", "js/offline.js", "js/store.js", "js/ui.js", "js/views/guides.js", "js/views/help.js", "js/views/today.js", "js/views/trip.js", "js/views/wallet.js", "manifest.webmanifest", "robots.txt", "styles.css"];
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
    e.respondWith(fetch(req).catch(() => caches.open('tabi-data').then(c => c.match('version.json'))));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(caches.match(new URL('index.html', self.registration.scope).href).then(r => r || fetch(req)));
    return;
  }
  e.respondWith((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const hit = await shell.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const data = await caches.open('tabi-data');
    const d = await data.match(req, { ignoreSearch: true }) || await data.match(url.pathname.split('/').slice(-2).join('/'));
    if (d) return d;
    return fetch(req);
  })());
});
