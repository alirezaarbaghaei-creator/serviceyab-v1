const CACHE_VERSION = '__KATEB_SW_VERSION__';
const CACHE_NAME = `kateb-${CACHE_VERSION}`;
const PRECACHE = ['./manifest.json'];

// Navigation (HTML) requests: network-first so a new deploy is visible
// immediately without the user clearing cache. Falls back to cache offline.
async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    throw err;
  }
}

// Hashed build assets (immutable): cache-first is safe and fast.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Refresh in background so the cache never goes stale.
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
      }
    }).catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response && response.status === 200) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests; let API/CDN/fonts pass through.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Never cache API calls or payment callbacks.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/payment/')) {
    return;
  }

  // Navigation + HTML: network-first (fixes "must clear cache to see update").
  const isNavigation = event.request.mode === 'navigate'
    || (event.request.headers.get('accept') || '').includes('text/html')
    || url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (isNavigation) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Never cache the service worker itself or the manifest.
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/manifest.json')) {
    return;
  }

  // Vite hashed assets under /assets/: cache-first (filename changes per build).
  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else (icons, fonts): stale-while-revalidate via cacheFirst.
  event.respondWith(cacheFirst(event.request));
});
