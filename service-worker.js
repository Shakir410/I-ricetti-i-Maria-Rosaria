const CACHE_PREFIX = "il-mio-quaderno";
const CACHE_NAME = `${CACHE_PREFIX}-v2`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./service-worker.js",
  "./manifest.webmanifest",
  "./assets/icons/app-icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/fonts/GFS_Galatea.ttf",
  "./assets/fonts/GFS_Galatea_Bold.ttf",
  "./assets/fonts/Butchery.ttf"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          return caches.open(CACHE_NAME)
            .then(cache => cache.put(request, response.clone()))
            .then(() => response);
        }
        return response;
      })
      .catch(() => caches.match(request)
        .then(cached => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match(new URL("./index.html", self.registration.scope).href);
          }
          return Response.error();
        }))
  );
});
