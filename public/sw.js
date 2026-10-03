const CACHE_VERSION = /* __VAJEFY_BUILD_VERSION__ */ "dev";
const CACHE = `vajefy-offline-${CACHE_VERSION}`;
const BUILD_ASSETS = /* __VAJEFY_BUILD_ASSETS__ */ [];
const ROUTES = ["/", "/learn", "/lexicon", "/study", "/drill", "/library", "/progress"];
const SHELL = ["/manifest.json", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/icon-512-maskable.png"];
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
  "/data/enhanced.json",
  "/data/enhanced-order.json",
  "/data/reference-reviewed.json",
  "/data/usefulness.json",
];
// Pronunciation clips are named by their content hash, so they never change
// once published. They live in their own cache, which survives app updates.
const AUDIO_CACHE = "vajefy-audio-v1";

function sameOriginAsset(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Cache each primary SSR document and the CSS/JS/images it references.
 * This closes the common PWA gap where "/" is cached but a route-specific
 * bundle is unavailable on the first offline navigation.
 */
async function warmRoute(cache, path) {
  try {
    const response = await fetch(path, { cache: "reload" });
    if (!response.ok) return;
    await cache.put(path, response.clone());
    const html = await response.text();
    const urls = new Set();
    for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
      const asset = sameOriginAsset(match[1]);
      if (asset) urls.add(asset);
    }
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          const asset = await fetch(url, { cache: "reload" });
          if (asset.ok) await cache.put(url, asset);
        } catch {
          // One optional asset must not make the entire PWA uninstallable.
        }
      }),
    );
  } catch {
    // The online app still works; a later service-worker update can retry.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined)));
      await Promise.all(DATA.map((url) => cache.add(url).catch(() => undefined)));
      // Generated after Vite builds, so every hashed lazy route/runtime chunk is
      // guaranteed to exist offline even if the learner never visited it online.
      await Promise.all(BUILD_ASSETS.map((url) => cache.add(url).catch(() => undefined)));
      await Promise.all(ROUTES.map((route) => warmRoute(cache, route)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE && key !== AUDIO_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

async function cachedNavigation(cache, request) {
  return (
    (await cache.match(request, { ignoreSearch: true })) ??
    (await cache.match(new URL(request.url).pathname, { ignoreSearch: true })) ??
    (await cache.match("/"))
  );
}

async function navigationFallback(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    // Chromium and some embedded browsers may resolve an offline navigation
    // with a synthetic non-OK response rather than rejecting fetch().
    return (await cachedNavigation(cache, request)) ?? response;
  } catch {
    return cachedNavigation(cache, request);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  // Cloudflare preview/static assets include `Vary: Origin`. The install-time
  // precache request has no Origin header, while browser module requests do,
  // so strict Vary matching would miss a byte-identical same-origin asset.
  const cached = await cache.match(request, { ignoreSearch: false, ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function cachedAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(cachedAudio(request));
    return;
  }

  if (
    url.pathname.startsWith("/data/") ||
    url.pathname.startsWith("/assets/") ||
    ["script", "style", "font", "image"].includes(request.destination)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
