const CACHE_NAME = 'gracewave-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/ministers.html',
  '/minister.html',
  '/contact.html',
  '/privacy.html',
  '/terms.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// These domains must NEVER be cached — always fetch live
const NEVER_CACHE_DOMAINS = [
  'supabase.co',
  'formspree.io',
  'googletagmanager.com',
  'googleapis.com',
  'fonts.gstatic.com',
  'jsdelivr.net'
];

// Install: cache static pages
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: smart strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Never cache API/CDN calls — always go to network
  const isExternal = NEVER_CACHE_DOMAINS.some(domain => url.includes(domain));
  if (isExternal) {
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML pages — network first so content is always fresh
  if (event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Icons and static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});