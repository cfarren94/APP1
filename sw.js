const CACHE = "scor-exam-v104";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.v3.js",
  "./manifest.webmanifest",
  "./data/security_concepts.json",
  "./data/network_security.json",
  "./data/securing_the_cloud.json",
  "./data/content_security.json",
  "./data/endpoint_protection_and_detection.json",
  "./data/secure_network_access_visibility_and_enforcement.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k.startsWith("scor-exam-") && k !== CACHE ? caches.delete(k) : null))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
