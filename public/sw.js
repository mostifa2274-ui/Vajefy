const CACHE = "vajefy-offline-v1";
const SHELL = ["/", "/manifest.json", "/favicon.svg", "/icon-192.png", "/icon-512.png"];
const DATA = [
  "/data/meta.json",
  "/data/lex-a1.json",
  "/data/lex-a2.json",
  "/data/lex-b1.json",
  "/data/lex-b2.json",
  "/data/lex-b2x.json",
  "/data/lex-c1.json",
  "/data/occupations.json",
  "/data/phrasal.json",
  "/data/collocations.json",
  "/data/prepositions.json",
  "/data/antonyms.json",
  "/data/confusing.json",
  "/data/verb-patterns.json",
  "/data/irregular.json",
  "/data/formation.json",
  "/data/synonyms.json",
  "/data/families.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // A single optional dataset failure must not prevent the service worker
      // from installing; successful datasets still become available offline.
      await Promise.all(DATA.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (request.mode === "navigate" ? cache.match("/") : undefined);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
