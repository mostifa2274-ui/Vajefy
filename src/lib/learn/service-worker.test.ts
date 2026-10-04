import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ORIGIN = "https://vajefy.test";
const CURRENT = "vajefy-offline-dev";
const COMPLETE = "/__vajefy_release_complete__";

function completeRelease(version: string, entries: Record<string, string> = {}) {
  return { ...entries, [COMPLETE]: version };
}

function keyOf(request: Request | string) {
  return new URL(typeof request === "string" ? request : request.url, ORIGIN).pathname;
}

class MemoryCache {
  entries = new Map<string, Response>();
  failAdd: string | null = null;
  failPut = false;

  constructor(entries: Record<string, string> = {}) {
    for (const [path, body] of Object.entries(entries)) this.entries.set(path, new Response(body));
  }

  async add(request: Request | string) {
    const key = keyOf(request);
    if (key === this.failAdd) throw new Error(`unavailable: ${key}`);
    this.entries.set(key, new Response(key));
  }

  async put(request: Request | string, response: Response) {
    if (this.failPut) throw new Error("quota exceeded");
    this.entries.set(keyOf(request), response);
  }

  async match(request: Request | string) {
    return this.entries.get(keyOf(request))?.clone();
  }
}

class MemoryCacheStorage {
  stores = new Map<string, MemoryCache>();

  constructor(entries: Record<string, Record<string, string>> = {}) {
    for (const [name, contents] of Object.entries(entries)) this.stores.set(name, new MemoryCache(contents));
  }

  async open(name: string) {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.stores.set(name, cache);
    }
    return cache;
  }

  async keys() {
    return [...this.stores.keys()];
  }

  async delete(name: string) {
    return this.stores.delete(name);
  }

  async match(request: Request | string) {
    for (const cache of this.stores.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(options: {
  caches?: MemoryCacheStorage;
  fetch?: (request: Request | string) => Promise<Response>;
  claim?: () => Promise<void>;
} = {}) {
  const listeners = new Map<string, Listener>();
  let skipped = false;
  const caches = options.caches ?? new MemoryCacheStorage();
  const self = {
    location: { origin: ORIGIN },
    clients: { claim: options.claim ?? (async () => undefined) },
    skipWaiting: async () => {
      skipped = true;
    },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    Request,
    Response,
    Set,
    Promise,
    caches,
    fetch:
      options.fetch ??
      (async () => new Response("<html><head></head><body></body></html>", { status: 200 })),
    self,
  });
  return { caches, listeners, skipped: () => skipped };
}

function lifetime(listener: Listener) {
  let promise: Promise<unknown> | undefined;
  listener({ waitUntil: (work: Promise<unknown>) => (promise = work) });
  assert.ok(promise, "the worker must extend the event lifetime");
  return promise;
}

test("a missing required offline file prevents the new worker from activating", async () => {
  const app = loadWorker();
  const cache = await app.caches.open(CURRENT);
  cache.failAdd = "/data/lex-a1.json";

  await assert.rejects(lifetime(app.listeners.get("install")!));
  assert.equal(app.skipped(), false, "an incomplete worker never bypasses the waiting lifecycle");
  assert.equal(app.caches.stores.has(CURRENT), false, "the incomplete cache is discarded");
});

test("an unavailable unvisited route prevents an incomplete offline release", async () => {
  const app = loadWorker({
    fetch: async (request) =>
      keyOf(request) === "/learn"
        ? new Response("unavailable", { status: 503 })
        : new Response("<html><head></head><body></body></html>", { status: 200 }),
  });

  await assert.rejects(lifetime(app.listeners.get("install")!));
  assert.equal(app.skipped(), false);
  assert.equal(app.caches.stores.has(CURRENT), false);
});

test("a missing route bundle prevents an incomplete offline release", async () => {
  const app = loadWorker({
    fetch: async (request) =>
      keyOf(request) === "/assets/route.js"
        ? new Response("unavailable", { status: 503 })
        : new Response('<html><head><script src="/assets/route.js"></script></head></html>', { status: 200 }),
  });

  await assert.rejects(lifetime(app.listeners.get("install")!));
  assert.equal(app.skipped(), false);
  assert.equal(app.caches.stores.has(CURRENT), false);
});

test("a complete install is marked without forcing activation over open tabs", async () => {
  const app = loadWorker();

  await lifetime(app.listeners.get("install")!);

  assert.equal(app.skipped(), false, "the browser activates only after old controlled tabs have gone");
  const marker = await (await app.caches.open(CURRENT)).match(COMPLETE);
  assert.equal(await marker?.text(), "dev");
});

test("an install reusing a pre-existing complete release is a safe no-op", async () => {
  const caches = new MemoryCacheStorage({ [CURRENT]: completeRelease("dev", { "/learn": "working release" }) });
  const app = loadWorker({ caches });
  (await caches.open(CURRENT)).failAdd = "/data/lex-a1.json";

  await lifetime(app.listeners.get("install")!);

  assert.equal(caches.stores.has(CURRENT), true);
  assert.equal(await (await (await caches.open(CURRENT)).match("/learn"))?.text(), "working release");
});

test("activation keeps the last usable release and does not take over open tabs", async () => {
  const caches = new MemoryCacheStorage({
    "vajefy-offline-oldest": completeRelease("oldest", { "/assets/oldest.js": "oldest" }),
    "unrelated-cache": { "/unrelated": "keep" },
    "vajefy-offline-previous": completeRelease("previous", { "/assets/previous.js": "previous" }),
    [CURRENT]: completeRelease("dev", { "/assets/current.js": "current" }),
    "vajefy-audio-v1": { "/audio/pilot/clip.mp3": "audio" },
  });
  const app = loadWorker({
    caches,
    claim: async () => {
      throw new Error("claim would replace the controller of an open tab");
    },
  });

  await lifetime(app.listeners.get("activate")!);

  assert.equal(caches.stores.has("vajefy-offline-oldest"), false);
  assert.equal(caches.stores.has("vajefy-offline-previous"), true);
  assert.equal(caches.stores.has("unrelated-cache"), true);
  assert.equal(caches.stores.has("vajefy-audio-v1"), true);
});

test("activation retains the previous complete release instead of a newer interrupted cache", async () => {
  const caches = new MemoryCacheStorage({
    "vajefy-offline-working": completeRelease("working", { "/learn": "working" }),
    "vajefy-offline-interrupted": { "/learn": "partial" },
    [CURRENT]: completeRelease("dev", { "/learn": "current" }),
  });
  const app = loadWorker({ caches });

  await lifetime(app.listeners.get("activate")!);

  assert.equal(caches.stores.has("vajefy-offline-working"), true);
  assert.equal(caches.stores.has("vajefy-offline-interrupted"), false);
});

test("an open tab can load its previous hashed asset while the network is offline", async () => {
  const caches = new MemoryCacheStorage({
    "vajefy-offline-previous": completeRelease("previous", { "/assets/previous.js": "previous release" }),
    [CURRENT]: completeRelease("dev", { "/assets/current.js": "current release" }),
  });
  const app = loadWorker({
    caches,
    fetch: async () => {
      throw new Error("offline");
    },
  });
  let response: Promise<Response> | undefined;
  app.listeners.get("fetch")!({
    request: new Request(`${ORIGIN}/assets/previous.js`),
    respondWith: (work: Promise<Response>) => (response = work),
  });

  assert.ok(response);
  assert.equal(await (await response).text(), "previous release");
});

test("asset fallback ignores a newer interrupted release cache", async () => {
  const caches = new MemoryCacheStorage({
    "vajefy-offline-working": completeRelease("working", { "/assets/previous.js": "working release" }),
    "vajefy-offline-interrupted": { "/assets/previous.js": "partial release" },
    [CURRENT]: completeRelease("dev"),
  });
  const app = loadWorker({
    caches,
    fetch: async () => {
      throw new Error("offline");
    },
  });
  let response: Promise<Response> | undefined;
  app.listeners.get("fetch")!({
    request: new Request(`${ORIGIN}/assets/previous.js`),
    respondWith: (work: Promise<Response>) => (response = work),
  });

  assert.ok(response);
  assert.equal(await (await response).text(), "working release");
});

test("a network response wins over a previous cache for an uncached current asset", async () => {
  const caches = new MemoryCacheStorage({
    "vajefy-offline-previous": { "/assets/optional.js": "previous release" },
    [CURRENT]: {},
  });
  const app = loadWorker({ caches, fetch: async () => new Response("network release", { status: 200 }) });
  let response: Promise<Response> | undefined;
  app.listeners.get("fetch")!({
    request: new Request(`${ORIGIN}/assets/optional.js`),
    respondWith: (work: Promise<Response>) => (response = work),
  });

  assert.ok(response);
  assert.equal(await (await response).text(), "network release");
});

test("a successful network asset is returned even when the current cache is full", async () => {
  const caches = new MemoryCacheStorage({
    "vajefy-offline-previous": completeRelease("previous", { "/assets/optional.js": "previous release" }),
    [CURRENT]: completeRelease("dev"),
  });
  (await caches.open(CURRENT)).failPut = true;
  const app = loadWorker({ caches, fetch: async () => new Response("fresh response", { status: 200 }) });
  let response: Promise<Response> | undefined;
  app.listeners.get("fetch")!({
    request: new Request(`${ORIGIN}/assets/optional.js`),
    respondWith: (work: Promise<Response>) => (response = work),
  });

  assert.ok(response);
  assert.equal(await (await response).text(), "fresh response");
});

test("a successful network asset is returned after a cache failure without a previous release", async () => {
  const caches = new MemoryCacheStorage({ [CURRENT]: completeRelease("dev") });
  (await caches.open(CURRENT)).failPut = true;
  const app = loadWorker({ caches, fetch: async () => new Response("fresh response", { status: 200 }) });
  let response: Promise<Response> | undefined;
  app.listeners.get("fetch")!({
    request: new Request(`${ORIGIN}/assets/optional.js`),
    respondWith: (work: Promise<Response>) => (response = work),
  });

  assert.ok(response);
  assert.equal(await (await response).text(), "fresh response");
});

test("online navigation never mutates the validated offline document", async () => {
  const caches = new MemoryCacheStorage({ [CURRENT]: completeRelease("dev", { "/learn": "validated release" }) });
  let online = true;
  const app = loadWorker({
    caches,
    fetch: async () => {
      if (!online) throw new Error("offline");
      return new Response("new deployment", { status: 200 });
    },
  });
  const request = { method: "GET", mode: "navigate", url: `${ORIGIN}/learn` } as Request;
  let response: Promise<Response> | undefined;
  app.listeners.get("fetch")!({ request, respondWith: (work: Promise<Response>) => (response = work) });
  assert.equal(await (await response!).text(), "new deployment");

  online = false;
  app.listeners.get("fetch")!({ request, respondWith: (work: Promise<Response>) => (response = work) });
  assert.equal(await (await response!).text(), "validated release");
});
