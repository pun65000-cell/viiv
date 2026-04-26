const CACHE = 'viiv-pwa-v5';
const STATIC = [
  '/pwa/css/app.css',
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  if (e.request.headers.get('accept')?.includes('text/html')) return;

  // JS ทุกไฟล์ → network-first เสมอ ไม่ต้อง bump version อีก
  if (e.request.url.match(/\.js(\?|$)/)) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // CSS → network-first + update cache
  if (e.request.url.match(/\.css(\?|$)/)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // รูปภาพ/font → cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
