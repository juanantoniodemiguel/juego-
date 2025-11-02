const CACHE_NAME = 'scoreboard-pwa-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=4',
  './app.js?v=4',
  './manifest.json'
];
self.addEventListener('install', (event)=>{
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (event)=>{
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event)=>{
  event.respondWith(
    caches.match(event.request).then(resp=> resp || fetch(event.request))
  );
});
