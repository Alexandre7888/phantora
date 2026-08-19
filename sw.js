const CACHE_NAME = 'codehub-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './studio.html',
  './studio-app.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          urlsToCache.map(url => 
            fetch(url)
              .then(response => {
                if(response.ok) return cache.put(url, response);
              })
              .catch(err => console.warn('Falha ao armazenar no cache:', url, err))
          )
        );
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Stale-while-revalidate strategy for faster loading but keeping content fresh
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.warn('Network request failed:', event.request.url, err);
        // Fallback para evitar travamento da página
        if (cachedResponse) return cachedResponse;
        return new Response('', { status: 404, statusText: 'Not Found' });
      });
      
      return cachedResponse || fetchPromise;
    })
  );
});
