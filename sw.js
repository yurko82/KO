// Service Worker для PWA та офлайн-кешування Журналу КО
const CACHE_NAME = 'ko-journal-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/catalog.js',
  './js/storage.js',
  './js/dashboard.js',
  './js/controller_view.js',
  './js/admin_view.js',
  './js/export_archive.js',
  './js/app.js',
  './data/catalog.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
