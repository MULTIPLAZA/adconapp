const CACHE = 'adconapp-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', (Evento) => {
  // Solo cachear recursos estáticos propios
  const Url = new URL(Evento.request.url);
  if (Evento.request.method !== 'GET') return;
  if (Url.origin !== location.origin) return;

  Evento.respondWith(
    caches.open(CACHE).then(async (Cache) => {
      const Guardado = await Cache.match(Evento.request);
      if (Guardado) return Guardado;
      const Respuesta = await fetch(Evento.request);
      Cache.put(Evento.request, Respuesta.clone());
      return Respuesta;
    })
  );
});
