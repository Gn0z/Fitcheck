const CACHE_NAME = "fitcheck-shell-v28";
const APP_SHELL = [
  "./fitcheck-hifi-prototype.html",
  "./css/styles.css?v=28",
  "./js/app.js?v=28",
  "./js/badges.js?v=28",
  "./js/data-validation.js?v=28",
  "./js/records.js?v=28",
  "./js/store.js?v=28",
  "./js/training.js?v=28",
  "./js/utils.js?v=28",
  "./manifest.webmanifest",
  "./app-icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map(async (path) => {
        const response = await fetch(path, { cache: "reload" });
        if (!response.ok) throw new Error(`Unable to cache ${path}: ${response.status}`);
        await cache.put(path, response);
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./fitcheck-hifi-prototype.html", copy));
          return response;
        })
        .catch(() => caches.match("./fitcheck-hifi-prototype.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
