const CACHE_VERSION = /* __VAJEFY_BUILD_VERSION__ */ "dev";
const CACHE_PREFIX = "vajefy-offline-";
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const COMPLETE_MARKER = "/__vajefy_release_complete__";
const BUILD_ASSETS = /* __VAJEFY_BUILD_ASSETS__ */ [];
const ROUTES = ["/", "/learn", "/lexicon", "/study", "/drill", "/library", "/progress"];
const SHELL = ["/manifest.json", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/icon-512-maskable.png"];
// Only what the A1 course needs is installed up front (plan §16 P1). Higher
// levels and the reference decks are cached the first time they are opened.
const DATA = [
  "/data/meta.json",
  "/data/lex-a1.json",
  "/data/enhanced/index.json",
  "/data/enhanced/audio-pack.json",
  "/data/enhanced-order.json",
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
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) throw new Error(`Required offline route failed: ${path} (${response.status})`);
  await cache.put(path, response.clone());
  const html = await response.text();
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
    const asset = sameOriginAsset(match[1]);
    if (asset) urls.add(asset);
  }
  await Promise.all(
    [...urls].map(async (url) => {
      const asset = await fetch(url, { cache: "reload" });
      if (!asset.ok) throw new Error(`Required route asset failed: ${url} (${asset.status})`);
      await cache.put(url, asset);
    }),
  );
}

async function isCompleteRelease(cacheName) {
  const marker = await (await caches.open(cacheName)).match(COMPLETE_MARKER, { ignoreSearch: true, ignoreVary: true });
  return Boolean(marker && (await marker.text()) === cacheName.slice(CACHE_PREFIX.length));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      if (keys.includes(CACHE) && (await isCompleteRelease(CACHE))) return;
      try {
        const cache = await caches.open(CACHE);
        await Promise.all(SHELL.map((url) => cache.add(url)));
        await Promise.all(DATA.map((url) => cache.add(url)));
        // Generated after Vite builds, so every hashed lazy route/runtime chunk
        // and enhanced-content part is required before this release activates.
        await Promise.all(BUILD_ASSETS.map((url) => cache.add(url)));
        await Promise.all(ROUTES.map((route) => warmRoute(cache, route)));
        await cache.put(COMPLETE_MARKER, new Response(CACHE_VERSION));
        // Keep the worker waiting until every client controlled by the old
        // release has closed or navigated away. Activation is then safe.
      } catch (error) {
        // A partial release must never replace the last complete offline one.
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const earlier = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
      let previous;
      for (const key of earlier) if (await isCompleteRelease(key)) previous = key;
      await Promise.all(earlier.filter((key) => key !== previous).map((key) => caches.delete(key)));
      // Claim pages only on the first installation. An update with a previous
      // complete release uses the normal lifecycle, which drains its clients
      // before this cleanup can run and never swaps their controller in place.
      if (!previous) await self.clients.claim();
    })(),
  );
});

async function previousReleaseMatch(request, options) {
  const keys = await caches.keys();
  for (const key of keys.reverse()) {
    if (key === CACHE || !key.startsWith(CACHE_PREFIX)) continue;
    if (!(await isCompleteRelease(key))) continue;
    const cached = await (await caches.open(key)).match(request, options);
    if (cached) return cached;
  }
  return undefined;
}

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
    if (response.ok) return response;
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
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const previous = await previousReleaseMatch(request, { ignoreSearch: false, ignoreVary: true });
    if (previous) return previous;
    throw error;
  }
  if (response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // Storage pressure must not replace a fresh network response with stale
      // content or turn a successful request into an application failure.
    }
    return response;
  }
  // An old tab may request a hashed chunk the deployment no longer serves.
  return (await previousReleaseMatch(request, { ignoreSearch: false, ignoreVary: true })) ?? response;
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
