/* Bible Study — Service Worker
 * Caches the app for guaranteed offline. Cache-first with background revalidation.
 * Bump CACHE_VERSION each time index.html or sw.js changes meaningfully.
 */

const CACHE_VERSION = 'v6-2026-05-06-sync-reliability';
const CACHE_NAME = `bible-study-${CACHE_VERSION}`;
const PRECACHE_URLS = ['./', './index.html', './sw.js'];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: take control + clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Listen for skipWaiting message from page (when user taps "Refresh")
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Fetch: cache-first, with background revalidation
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin requests within our scope
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        // Kick off a background fetch to keep cache fresh
        const networkFetch = fetch(req)
          .then((fresh) => {
            if (fresh && fresh.ok && fresh.type !== 'opaque') {
              cache.put(req, fresh.clone()).catch(() => {});
            }
            return fresh;
          })
          .catch(() => null);

        // Return cached immediately if we have it
        if (cached) return cached;

        // Otherwise wait for network; fall back to '/' if offline and missing
        return networkFetch.then((fresh) => fresh || cache.match('./'));
      })
    )
  );
});
