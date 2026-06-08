// ISSD Monitoring Tools — Service Worker
// Handles install prompt eligibility. The app is online-only (Oracle backend),
// so no offline caching is applied — this worker simply satisfies the PWA
// installability requirement.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass all fetch requests straight through to the network.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
