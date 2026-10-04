const CACHE = "math-lesson-pwa-v14";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./db.js",
  "./draw.js",
  "./cloud.js",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./data/questions.json",
  "./404.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch("precache.json", { cache: "no-store" });
        const files = await res.json();
        await cache.addAll(files);
      } catch {
        await cache.addAll(SHELL);
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isShell(url) {
  const path = url.pathname;
  return (
    path.endsWith("/") ||
    path.endsWith("/index.html") ||
    path.endsWith("/app.js") ||
    path.endsWith("/db.js") ||
    path.endsWith("/draw.js") ||
    path.endsWith("/cloud.js") ||
    path.endsWith("/firebase-config.js") ||
    path.endsWith("/styles.css") ||
    path.endsWith("/sw.js") ||
    path.endsWith("/manifest.webmanifest") ||
    path.endsWith("/precache.json")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell: network-first so phones pick up button/layout fixes.
  if (isShell(url) || req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          return (
            (await caches.match(req, { ignoreSearch: true })) ||
            (await caches.match("./index.html"))
          );
        }
      })()
    );
    return;
  }

  // Images / data: cache-first for offline.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        throw err;
      }
    })()
  );
});
