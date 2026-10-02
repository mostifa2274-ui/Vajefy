import type { HeldSave } from "./recovery";

/** The existing key is retained so every released progress version still loads. */
export const PROGRESS_STORAGE_KEY = "roshana-v1";

/** `damaged` and `future`: a save the app cannot read is held, never replaced. */
export type SaveStatus = "checking" | "saved" | "session" | "conflict" | HeldSave["kind"];
type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Keep failed writes available for this session without confusing them with a
 * durable save. A changed durable copy must never be overwritten by a retry.
 * Status lives outside the progress document, so it cannot trigger save loops.
 * A held save blocks every write until the learner chooses how to resolve it.
 */
export function createProgressStorage(getStorage: () => BrowserStorage | undefined) {
  let current: string | null = null;
  let hasCurrent = false;
  let dirty = false;
  let durable: string | null | undefined;
  let status: SaveStatus = "checking";
  let held: HeldSave | null = null;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function report(next: SaveStatus) {
    if (next === status) return;
    status = next;
    notify();
  }

  function save(key: string): boolean {
    if (status === "conflict" || held) return false;
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
        held = null;
        report("saved");
        return current;
      } catch {
        report("session");
        return current;
      }
    },
    setItem(key: string, value: string) {
      // While a save is held, the in-memory state is a placeholder, not progress.
      if (held) return;
      current = value;
      hasCurrent = true;
      dirty = true;
      save(key);
    },
    removeItem(key: string) {
      if (held) return;
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
    /** Keep a save that was just read but cannot be used; writes stop until release. */
    hold(save: HeldSave) {
      held = save;
      // A different held copy may share the status, yet must still be shown.
      status = save.kind;
      notify();
    },
    getHeld: (): HeldSave | null => held,
    /**
     * Allow the learner's chosen replacement to be written. The usual check
     * still applies, so a copy changed by another tab meanwhile is not replaced.
     */
    release() {
      if (!held) return;
      held = null;
      report("checking");
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
