const CACHE_NAME = "kern-desktop-v7";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./assets/kern-icon.svg",
  "./assets/kern-hd.png",
  "./assets/reef-habitat.png",
  "./assets/reef-fish.png",
  "./assets/sea-turtle.png",
  "./assets/kern-spritesheet.png",
  "./src/app.js",
  "./src/pet-state.js",
  "./src/sprite-player.js",
  "./src/storage.js",
  "./src/sync-client.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const freshAsset =
    event.request.mode === "navigate" ||
    ["document", "script", "style", "manifest"].includes(event.request.destination);

  if (freshAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data?.json() || {};
  } catch {
    message = {};
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Kern is checking in", {
      body: message.body || "Your reef companion would love a visit.",
      icon: "./assets/kern-icon.svg",
      badge: "./assets/kern-icon.svg",
      tag: message.tag || "kern-care-reminder",
      renotify: false,
      data: { url: message.url || "./" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const matchingClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (matchingClient) {
        await matchingClient.navigate(destination);
        return matchingClient.focus();
      }
      return self.clients.openWindow(destination);
    }),
  );
});
