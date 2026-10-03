import type { Op } from "./ops";

/**
 * A write-ahead journal in localStorage. An operation is written here before
 * its IndexedDB transaction and removed after the transaction commits. If the
 * page closes or the transaction fails in between, the next start replays it;
 * the operation id makes a replay of an already committed operation a no-op.
 * Each operation has its own key, so tabs never overwrite each other's entries.
 */

export const JOURNAL_PREFIX = "vajefy-op:";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Large replacements (imports) are atomic in IndexedDB and not journaled. */
export function journaled(op: Op): boolean {
  return op.type !== "replace" && op.type !== "session";
}

export function journalAppend(op: Op): boolean {
  if (!journaled(op)) return true;
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(JOURNAL_PREFIX + op.id, JSON.stringify(op));
    return true;
  } catch {
    return false;
  }
}

export function journalRemove(id: string) {
  try {
    storage()?.removeItem(JOURNAL_PREFIX + id);
  } catch {
    // A blocked journal only weakens crash recovery; the commit itself stands.
  }
}

function isOp(value: unknown): value is Op {
  if (!value || typeof value !== "object") return false;
  const op = value as Record<string, unknown>;
  return typeof op.id === "string" && typeof op.type === "string" && typeof op.at === "number";
}

/** Every journaled operation, oldest first. Unreadable entries are left in place. */
export function journalPending(): Op[] {
  const target = storage();
  if (!target) return [];
  const ops: Op[] = [];
  try {
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (!key?.startsWith(JOURNAL_PREFIX)) continue;
      try {
        const op: unknown = JSON.parse(target.getItem(key) ?? "null");
        if (isOp(op) && JOURNAL_PREFIX + op.id === key) ops.push(op);
      } catch {
        // Keep it for inspection; it cannot be replayed safely.
      }
    }
  } catch {
    return ops;
  }
  return ops.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
