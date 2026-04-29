// SW v7 — network-first for all assets, no caching (prevents stale JS)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  // delete ALL old caches on activate
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});
// No fetch handler — let everything go to network directly
