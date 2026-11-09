const CACHE_NAME = 'senon-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css',
  '/img/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
