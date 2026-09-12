// Service worker — Gestion des Absences (PWA)
// Stratégies :
//   - Navigations (pages) : réseau d'abord, repli cache puis /offline.html
//   - Fichiers statiques (/_next/static, /icons, images) : cache d'abord + mise à jour en arrière-plan
//   - API (/api/) : toujours le réseau (jamais de cache — données sensibles et cookies)

const VERSION = "v1";
const SHELL_CACHE = `abs-shell-${VERSION}`;
const ASSET_CACHE = `abs-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort : on n'échoue pas l'installation si une ressource manque
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API : réseau uniquement, jamais de cache
  if (url.pathname.startsWith("/api/")) return;

  // Navigations (documents) : réseau d'abord, repli cache puis page hors ligne
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // Fichiers statiques : cache d'abord + rafraîchissement en arrière-plan
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/templates/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        if (cached) {
          network.catch(() => undefined);
          return cached;
        }
        const fresh = await network;
        return fresh || Response.error();
      })()
    );
  }
});
