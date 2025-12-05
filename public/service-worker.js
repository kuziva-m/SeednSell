// public/service-worker.js

// ★★★ BUMP THIS VERSION EVERY TIME YOU DEPLOY (e.g. v11, v12...) ★★★
const CACHE_NAME = "seed-sell-live-v11";

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

// 1. INSTALL: Cache assets
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Force this worker to become active immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Clean up old caches & take control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim(); // ★★★ CRITICAL: Take control of all open pages immediately
      })
  );
});

// 3. FETCH: Network-First Strategy for HTML (Ensures updates are seen)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // A. Supabase API: Always Network
  if (url.hostname.includes("supabase.co")) {
    return event.respondWith(fetch(event.request));
  }

  // B. Images: Cache-First (Performance)
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

  // C. HTML/JS/CSS: Network First, Fallback to Cache (Robustness)
  // This ensures the user gets the LATEST version if they have internet.
  // If offline, they get the cached version.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Update cache with new version
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
