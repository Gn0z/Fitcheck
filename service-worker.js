const CACHE_NAME = "fitcheck-shell-v31";
const APP_SHELL = [
  "./fitcheck-hifi-prototype.html",
  "./css/styles.css?v=31",
  "./js/app.js?v=31",
  "./js/badges.js?v=31",
  "./js/data-validation.js?v=31",
  "./js/records.js?v=31",
  "./js/scheduling.js?v=31",
  "./js/store.js?v=31",
  "./js/training.js?v=31",
  "./js/utils.js?v=31",
  "./manifest.webmanifest",
  "./app-icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/startup/fitcheck-640x1136.png",
  "./assets/startup/fitcheck-750x1334.png",
  "./assets/startup/fitcheck-828x1792.png",
  "./assets/startup/fitcheck-1125x2436.png",
  "./assets/startup/fitcheck-1170x2532.png",
  "./assets/startup/fitcheck-1179x2556.png",
  "./assets/startup/fitcheck-1206x2622.png",
  "./assets/startup/fitcheck-1242x2208.png",
  "./assets/startup/fitcheck-1242x2688.png",
  "./assets/startup/fitcheck-1260x2736.png",
  "./assets/startup/fitcheck-1284x2778.png",
  "./assets/startup/fitcheck-1290x2796.png",
  "./assets/startup/fitcheck-1320x2868.png"
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
