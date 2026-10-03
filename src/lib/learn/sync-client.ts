import { report } from "@/lib/telemetry";
import { persistence, useProgress } from "./store";
import { createSync, SYNC_KEY } from "./sync";

/** The page's sync engine (docs/SYNC.md); it does nothing until the learner pairs a device. */

const browser = typeof window !== "undefined";

export const sync = createSync({
  persistence,
  memory: () => useProgress.getState(),
  storage: () => {
    try {
      return browser ? window.localStorage : undefined;
    } catch {
      return undefined;
    }
  },
  idb: () => (browser && "indexedDB" in window ? window.indexedDB : undefined),
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
});

let available: Promise<boolean> | null = null;

/** Whether this deployment offers sync. */
export function syncAvailable(): Promise<boolean> {
  available ??= fetch("/api/sync/status")
    .then((response) => (response.ok ? (response.json() as Promise<{ enabled?: boolean }>) : { enabled: false }))
    .then((body) => body.enabled === true)
    .catch(() => {
      available = null;
      return false;
    });
  return available;
}

/**
 * Start progress, taking up a stored pairing first so answers replayed from
 * the crash journal are queued for upload. Then sync whenever the device
 * comes back online or to the page, and follow other tabs.
 */
export function startWithSync(): () => void {
  void sync
    .prepare()
    .catch(() => false)
    .then(() => persistence.start())
    .then(() => sync.start())
    .catch(() => undefined);
  const again = () => {
    if (document.visibilityState === "visible") void sync.sync();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === SYNC_KEY) void sync.storageChanged();
  };
  // Failures are reported by kind only, when the build enables reporting.
  const unsubscribe = sync.subscribe(() => {
    const { state } = sync.status();
    if (state === "error" || state === "update") report("sync-failed", state);
  });
  window.addEventListener("online", again);
  document.addEventListener("visibilitychange", again);
  window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener("online", again);
    document.removeEventListener("visibilitychange", again);
    window.removeEventListener("storage", onStorage);
  };
}
