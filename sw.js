/* Service Worker — Equipos y Seguridad CETEMIN (PWA offline) */
const CACHE = "cetemin-v1";
const CORE = [
  "./",
  "./index.html",
  "./assets/manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Nunca interceptar Firestore/Auth: sus datos los maneja el SDK con su propia persistencia offline.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseio.com")) return;

  // SDK de Firebase y fuentes (CDN): cache-first con refresco en segundo plano.
  if (url.hostname === "www.gstatic.com" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req).then((res) => { if (res && (res.status === 200 || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // La app (mismo origen): red primero para ver cambios al instante; sin red, la copia guardada.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html")))
    );
  }
});
