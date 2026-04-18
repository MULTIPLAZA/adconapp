const CACHE = 'adconapp-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (E) => {
  // Eliminar caches viejos al activar nueva version
  E.waitUntil(
    caches.keys().then(Keys =>
      Promise.all(Keys.filter(K => K !== CACHE).map(K => caches.delete(K)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (E) => {
  if (E.request.method !== 'GET') return;
  const Url = new URL(E.request.url);
  if (Url.origin !== location.origin) return;

  // Network-first: siempre busca version nueva en el servidor.
  // Solo usa cache si no hay conexion (modo offline).
  E.respondWith(
    fetch(E.request)
      .then(Resp => {
        const Clone = Resp.clone();
        caches.open(CACHE).then(C => C.put(E.request, Clone));
        return Resp;
      })
      .catch(() => caches.match(E.request))
  );
});
