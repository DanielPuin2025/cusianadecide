// Guarda en caché los archivos de la app para que funcione sin conexión a internet
const CACHE_NOMBRE = "votaciones-cache-v23";
const ARCHIVOS_A_GUARDAR = [
  "index.html",
  "votar.html",
  "resultados.html",
  "css/estilos.css",
  "js/db.js",
  "js/estado-conexion.js",
  "js/auth.js",
  "js/votar.js",
  "js/resultados.js",
  "js/registrar-sw.js",
  "manifest.json",
  "icons/logo.ico",
  "icons/logo institucional.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOMBRE)
      .then((cache) => cache.addAll(ARCHIVOS_A_GUARDAR))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(
        claves
          .filter((clave) => clave !== CACHE_NOMBRE)
          .map((clave) => caches.delete(clave))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const esApi = evento.request.url.includes("/api/");
  if (esApi) return;

  evento.respondWith(
    fetch(evento.request)
      .then((respuestaRed) => {
        const respuestaClon = respuestaRed.clone();
        caches.open(CACHE_NOMBRE).then((cache) => cache.put(evento.request, respuestaClon));
        return respuestaRed;
      })
      .catch(() => caches.match(evento.request))
  );
});
