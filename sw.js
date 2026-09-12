```javascript
const CACHE_NAME = 'phantora-offline-v1';

// Nunca colocar no cache
const EXCLUDED_FILES = [
  'manifest.json'
];

// Arquivos que podem ser armazenados
const CACHEABLE_EXTENSIONS = [
  '.html',
  '.htm',
  '.js',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.json',
  '.mp3',
  '.wav',
  '.mp4',
  '.webm'
];


// ======================================================
// VERIFICA SE PODE SER CACHEADO
// ======================================================

function shouldCache(url) {

  const parsed = new URL(url);

  // Somente arquivos do próprio Phantora
  if (parsed.origin !== self.location.origin) {
    return false;
  }

  const pathname = parsed.pathname.toLowerCase();

  // Nunca guardar manifest
  if (pathname.endsWith('/manifest.json')) {
    return false;
  }

  // Extensões permitidas
  if (
    CACHEABLE_EXTENSIONS.some(ext =>
      pathname.endsWith(ext)
    )
  ) {
    return true;
  }

  // Páginas sem extensão
  if (
    pathname.endsWith('/') ||
    !pathname.split('/').pop().includes('.')
  ) {
    return true;
  }

  return false;
}


// ======================================================
// INSTALAÇÃO
// ======================================================

self.addEventListener('install', event => {

  console.log('[Phantora] Instalando versão:', CACHE_NAME);

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
  );
});


// ======================================================
// ATIVAÇÃO
// ======================================================

self.addEventListener('activate', event => {

  event.waitUntil(

    caches.keys()
      .then(cacheNames => {

        return Promise.all(

          cacheNames.map(cacheName => {

            if (
              cacheName.startsWith('phantora-') &&
              cacheName !== CACHE_NAME
            ) {

              console.log(
                '[Phantora] Removendo cache antigo:',
                cacheName
              );

              return caches.delete(cacheName);
            }

            return null;
          })

        );

      })

      .then(() => self.clients.claim())

  );

});


// ======================================================
// FETCH
// ======================================================

self.addEventListener('fetch', event => {

  const request = event.request;

  // Somente GET
  if (request.method !== 'GET') {
    return;
  }

  const url = request.url;

  // Não mexer no manifest
  if (
    new URL(url).pathname
      .toLowerCase()
      .endsWith('/manifest.json')
  ) {
    return;
  }

  if (!shouldCache(url)) {
    return;
  }


  event.respondWith(

    caches.open(CACHE_NAME)
      .then(async cache => {

        const cachedResponse =
          await cache.match(request);


        // ==================================================
        // TENTA ATUALIZAR EM SEGUNDO PLANO
        // ==================================================

        const updatePromise = fetch(
          new Request(request, {
            cache: 'no-store'
          })
        )
        .then(async response => {

          if (
            response &&
            response.ok &&
            response.status === 200
          ) {

            await cache.put(
              request,
              response.clone()
            );

            console.log(
              '[Phantora] Atualizado:',
              url
            );
          }

          return response;

        })
        .catch(() => null);


        // ==================================================
        // SE JÁ TEM CACHE
        // ==================================================

        if (cachedResponse) {

          // Atualiza em segundo plano
          event.waitUntil(updatePromise);

          // Responde IMEDIATAMENTE com o cache
          return cachedResponse;
        }


        // ==================================================
        // PRIMEIRO ACESSO
        // ==================================================

        const networkResponse =
          await updatePromise;

        if (networkResponse) {
          return networkResponse;
        }


        // ==================================================
        // COMPLETAMENTE OFFLINE
        // ==================================================

        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width,initial-scale=1">
            <title>Phantora offline</title>
          </head>

          <body>
            <h2>Phantora</h2>
            <p>Você está offline.</p>
            <p>Esta página ainda não foi armazenada no dispositivo.</p>
          </body>
          </html>
          `,
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=UTF-8'
            }
          }
        );

      })

  );

});


// ======================================================
// MENSAGENS
// ======================================================

self.addEventListener('message', event => {

  if (!event.data) return;


  // Forçar atualização
  if (event.data.type === 'CHECK_UPDATE') {

    event.waitUntil(

      caches.open(CACHE_NAME)
        .then(async cache => {

          const requests =
            await cache.keys();

          await Promise.all(

            requests.map(async request => {

              try {

                const response =
                  await fetch(
                    new Request(request, {
                      cache: 'no-store'
                    })
                  );

                if (
                  response.ok &&
                  response.status === 200
                ) {

                  await cache.put(
                    request,
                    response.clone()
                  );

                }

              } catch (error) {

                // Continua offline normalmente

              }

            })

          );

        })

    );
  }


  // Ativar nova versão imediatamente
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});


// ======================================================
// PERIODICAMENTE VERIFICA ATUALIZAÇÕES
// ======================================================

setInterval(async () => {

  try {

    const cache =
      await caches.open(CACHE_NAME);

    const requests =
      await cache.keys();

    for (const request of requests) {

      try {

        const response =
          await fetch(
            new Request(request, {
              cache: 'no-store'
            })
          );

        if (
          response.ok &&
          response.status === 200
        ) {

          await cache.put(
            request,
            response.clone()
          );

        }

      } catch {

        // Sem internet: não faz nada
      }
    }

  } catch {

    // Continua funcionando offline
  }

}, 60 * 1000);
```
