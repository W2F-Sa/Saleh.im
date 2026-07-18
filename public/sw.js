/* Vault / saleh.im — offline service worker (v4).

   Freshness-first: page navigations and dynamic assets always try the network
   first so a new deploy is picked up immediately. Only Next's content-hashed,
   immutable build chunks (/_next/static/…) are served cache-first for speed.
   The cache version is bumped on every meaningful change so old caches are
   purged on activate, and the page auto-reloads when a new worker takes over
   (see components/pwa-register). Nothing sensitive is cached — the vault
   ciphertext lives in localStorage, not here.

   v4 fixes:
   • Clone every Response *before* it is returned to the page. The old code
     cloned inside a deferred `.then()` after `return res`, which races with
     the browser consuming the body and throws "Response body is already used"
     (dropped/duplicate cache writes + console errors). Fixed everywhere.
   • Only cache final, same-origin, 200/basic, non-redirected responses so a
     cached redirect can never break a later navigation.
   • Offline navigation now falls back to "/" (the site shell) first, then
     "/vault", instead of always serving the vault. */

const CACHE = "saleh-site-v4";
const APP_SHELL = ["/", "/vault", "/manifest.webmanifest", "/icon.svg", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` bypasses the HTTP cache so the shell we precache is fresh.
      await Promise.allSettled(
        APP_SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })))
      );
      await self.skipWaiting();
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

// Allow the page to tell a waiting worker to activate immediately.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

const isImmutable = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image");

// Store a response in the cache without ever touching the body the page is
// reading — the clone is taken synchronously by the caller, before `return`.
const putInCache = (req, res) => {
  caches
    .open(CACHE)
    .then((c) => c.put(req, res))
    .catch(() => {});
};

// A response is safe to cache only if it's a final, same-origin, OK 200 that
// wasn't a redirect (replaying a cached redirect can break navigations).
const isCacheable = (res) =>
  res && res.ok && res.status === 200 && res.type === "basic" && !res.redirected;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache live endpoints

  // Immutable, content-hashed build assets → cache-first (safe + fast).
  if (isImmutable(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (isCacheable(res)) putInCache(req, res.clone()); // clone BEFORE return
          return res;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // Everything else (navigations + dynamic assets) → network-first so updates
  // always win when online, with a cache fallback for offline.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (isCacheable(fresh)) putInCache(req, fresh.clone()); // clone BEFORE return
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return (
            (await caches.match("/")) ||
            (await caches.match("/vault")) ||
            Response.error()
          );
        }
        return Response.error();
      }
    })()
  );
});
