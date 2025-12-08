// public/service-worker.js

// ★★★ BUMP THIS VERSION EVERY TIME YOU DEPLOY (e.g. v12...) ★★★
const CACHE_NAME = "seed-sell-live-v12";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/auth.html",
  "/contact.html",
  "/dashboard.html",
  "/listing.html",
  "/messages.html",
  "/program.html",
  "/404.html",
  "/css/styles.css",
  "/js/app.js",
  "/js/supabase.js",
  "/js/config.js",
  "/images/logo.webp",
  "/images/field.webp",
  "/manifest.json",
];

// 1. INSTALL
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. FETCH
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // A. Supabase API: Stale-While-Revalidate (OFFLINE FIRST)
  // Serve from cache immediately, then update cache from network
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            })
            .catch(() => {
              // Network failed, just stick with what we have
              return cachedResponse;
            });

          // Return cached response right away if we have it, else wait for network
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // B. Images: Cache-First
  if (
    url.pathname.includes("/product_images/") ||
    url.pathname.match(/\.(webp|png|jpg|jpeg|svg)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(event.request).then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
        );
      })
    );
    return;
  }

  // C. Core Assets: Network First, Fallback to Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const clone = networkResponse.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
