/** The existing key is retained so every released progress version still loads. */
export const PROGRESS_STORAGE_KEY = "roshana-v1";

export type SaveStatus = "checking" | "saved" | "session" | "conflict";
type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Keep failed writes available for this session without confusing them with a
 * durable save. A changed durable copy must never be overwritten by a retry.
 * Status lives outside the progress document, so it cannot trigger save loops.
 */
export function createProgressStorage(getStorage: () => BrowserStorage | undefined) {
  let current: string | null = null;
  let hasCurrent = false;
  let dirty = false;
  let durable: string | null | undefined;
  let status: SaveStatus = "checking";
  const listeners = new Set<() => void>();

  function report(next: SaveStatus) {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener();
  }

  function save(key: string): boolean {
    if (status === "conflict") return false;
    try {
      const storage = getStorage();
      // SSR has no durable storage and must not affect browser save status.
      if (!storage) return false;
      const found = storage.getItem(key);
      if ((durable === undefined && found !== null) || (durable !== undefined && found !== durable)) {
        report("conflict");
        return false;
      }
      durable = found;
      if (current === null) storage.removeItem(key);
      else storage.setItem(key, current);
      durable = current;
      dirty = false;
      report("saved");
      return true;
    } catch {
      report("session");
      return false;
    }
  }

  return {
    getItem(key: string): string | null {
      // Reading an older localStorage copy after a failed write would erase
      // newer answers during rehydration, including cross-tab notifications.
      if (dirty) return current;
      try {
        const storage = getStorage();
        if (!storage) return current;
        current = storage.getItem(key);
        hasCurrent = true;
        durable = current;
        report("saved");
        return current;
      } catch {
        report("session");
        return current;
      }
    },
    setItem(key: string, value: string) {
      current = value;
      hasCurrent = true;
      dirty = true;
      save(key);
    },
    removeItem(key: string) {
      current = null;
      hasCurrent = true;
      dirty = true;
      save(key);
    },
    retry(): boolean {
      return hasCurrent && save(PROGRESS_STORAGE_KEY);
    },
    shouldRehydrate(): boolean {
      if (!dirty) return true;
      // Keep unsaved session work, but flag a different durable copy so even
      // later successful writes cannot silently replace the other tab's work.
      try {
        const storage = getStorage();
        if (storage && storage.getItem(PROGRESS_STORAGE_KEY) !== durable) report("conflict");
      } catch {
        if (status !== "conflict") report("session");
      }
      return false;
    },
    getStatus: (): SaveStatus => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const progressStorage = createProgressStorage(() =>
  typeof window === "undefined" ? undefined : window.localStorage,
);
