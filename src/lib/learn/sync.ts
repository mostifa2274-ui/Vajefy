import type { Op } from "./ops";
import type { Memory } from "./persistence";
import { PROGRESS_VERSION, savedProgress } from "./progress";
import { currentProgress } from "./schema";
import { newId } from "./session";
import { deriveKeys, newSyncCode, opaqueId, readSyncCode, seal, unseal, type SyncKeys } from "./sync-crypto";

/**
 * Optional sync between a learner's devices (docs/SYNC.md).
 *
 * Every operation committed on this device is put in an outbox, encrypted and
 * uploaded; operations from other devices are downloaded, decrypted and
 * dispatched like local ones. Because operations carry unique ids and the
 * database applies each id once, an answer uploaded twice counts once. A
 * reset or replacement starts a new epoch: operations made on a device
 * before it learned of a reset elsewhere are dropped, so they cannot undo it.
 */

export type SyncState = "off" | "idle" | "syncing" | "offline" | "error" | "update";
/** `ended`: the synced copy was deleted from another device, so syncing stopped here. */
export type SyncStatus = { state: SyncState; pending: number; lastSync: number | null; dropped: number; code: string | null; ended: boolean };
export type JoinResult = "joined" | "invalid" | "needs-choice" | "offline" | "deleted";

/** The synced copy was deleted. */
class Gone extends Error {}

type Saved = { code: string; cursor: number; epoch: number; lastSync: number | null; dropped: number };
/** `id` is the operation's own id; `wire` the opaque id it is stored under on the server. */
type Outgoing = { id: string; wire: string; epoch: number; reset: boolean; at: number; op: Op };
type Remote = { seq: number; id: string; epoch: number; reset: boolean; iv: string; data: string };
/** What is encrypted: the operation and the progress version that wrote it. */
type Payload = { v: number; op: Op };

export const SYNC_KEY = "vajefy-sync";
const DB_NAME = "vajefy-sync";
const PUSH_BATCH = 50;
const PUSH_BYTES = 2_500_000;

export type SyncDeps = {
  persistence: { dispatch(op: Op): void; setAfterCommit(hook: ((op: Op) => Promise<void>) | null): void; isHeld(): boolean };
  memory: () => Memory;
  storage: () => Storage | undefined;
  idb: () => IDBFactory | undefined;
  fetch: typeof fetch;
  now: () => number;
};

const isReset = (op: Op) => op.type === "reset" || op.type === "replace";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createSync(deps: SyncDeps) {
  let saved: Saved | null = null;
  let keys: SyncKeys | null = null;
  let outbox: IDBDatabase | null = null;
  let state: SyncState = "off";
  let pending = 0;
  let running: Promise<void> | null = null;
  let again = false;
  let ended = false;
  let last: SyncStatus | null = null;
  /** A join waiting for the learner to choose which progress to keep. */
  let choice: { code: string; keys: SyncKeys; epoch: number } | null = null;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());
  const set = (next: SyncState) => {
    state = next;
    notify();
  };

  function read(): Saved | null {
    try {
      const raw = deps.storage()?.getItem(SYNC_KEY);
      return raw ? (JSON.parse(raw) as Saved) : null;
    } catch {
      return null;
    }
  }

  function write() {
    try {
      if (saved) deps.storage()?.setItem(SYNC_KEY, JSON.stringify(saved));
      else deps.storage()?.removeItem(SYNC_KEY);
    } catch {
      // Without storage, sync lasts for this page only.
    }
  }

  async function openOutbox(): Promise<IDBDatabase> {
    if (outbox) return outbox;
    const factory = deps.idb();
    if (!factory) throw new Error("no database");
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("outbox", { keyPath: "id" });
      // Server ids this device uploaded: when they come back down they are not
      // applied again (a snapshot re-applied would roll back later progress).
      open.result.createObjectStore("sent", { keyPath: "id" });
    };
    outbox = await request(open);
    return outbox;
  }

  async function queued(): Promise<Outgoing[]> {
    const db = await openOutbox();
    const all = (await request(db.transaction("outbox").objectStore("outbox").getAll())) as Outgoing[];
    pending = all.length;
    return all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  }

  /** Take entries out of the outbox; `sent` when the server has them. */
  async function remove(entries: Outgoing[], sent = false) {
    if (!entries.length) return;
    const db = await openOutbox();
    const tx = db.transaction(["outbox", "sent"], "readwrite");
    for (const entry of entries) {
      tx.objectStore("outbox").delete(entry.id);
      if (sent) tx.objectStore("sent").put({ id: entry.wire });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function enqueue(entry: Outgoing) {
    const db = await openOutbox();
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    pending++;
    notify();
  }

  /** Every committed operation is queued for upload, except those that came from elsewhere. */
  async function afterCommit(op: Op) {
    if (!saved || !keys || op.origin === "sync" || op.type === "session") return;
    // Another tab may have started a new epoch moments ago.
    const stored = read();
    if (stored?.code === saved.code) saved.epoch = Math.max(saved.epoch, stored.epoch);
    const reset = isReset(op);
    await enqueue({ id: op.id, wire: await opaqueId(keys!, op.id), epoch: saved.epoch, reset, at: deps.now(), op: { ...op } });
    // Operations after a local reset belong to the new epoch.
    if (reset) {
      saved.epoch += 1;
      write();
    }
    schedule();
  }

  /** The device's whole progress, as the starting point other devices adopt. */
  function snapshot(): Op {
    return { id: newId(), type: "replace", at: deps.now(), reason: "sync", progress: savedProgress(deps.memory()) };
  }

  async function call(method: string, body?: unknown, after?: number): Promise<Response> {
    const url = `/api/sync/${keys!.space}${after !== undefined ? `?after=${after}` : ""}`;
    return deps.fetch(url, {
      method,
      headers: { authorization: `Bearer ${keys!.token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Operations queued here before a reset elsewhere were made against older
   * progress, and the server refuses them: drop them, and count the answers.
   */
  async function dropBefore(epoch: number, except?: string) {
    const stale = (await queued()).filter((entry) => entry.epoch < epoch && entry.wire !== except);
    await remove(stale);
    saved!.dropped += stale.filter((entry) => !isReset(entry.op)).length;
    saved!.epoch = Math.max(saved!.epoch, epoch);
    write();
  }

  /** Download and apply what other devices uploaded. */
  async function pull() {
    for (;;) {
      const response = await call("GET", undefined, saved!.cursor);
      if (response.status === 410) throw new Gone();
      if (!response.ok) throw new Error(`pull ${response.status}`);
      const page = (await response.json()) as { epoch: number; ops: Remote[]; more: boolean };
      for (const item of page.ops) {
        const db = await openOutbox();
        if (await request(db.transaction("sent").objectStore("sent").get(item.id))) {
          // This device's own operation, already applied here.
          if (item.reset) await dropBefore(item.epoch + 1, item.id);
          await request(db.transaction("sent", "readwrite").objectStore("sent").delete(item.id));
          saved!.cursor = item.seq;
          write();
          continue;
        }
        const payload = await unseal<Payload>(keys!.key, item);
        if (payload.v > PROGRESS_VERSION) {
          set("update");
          throw new Error("newer version");
        }
        if (item.reset) await dropBefore(item.epoch + 1, item.id);
        const op: Op = { ...payload.op, origin: "sync" };
        if (op.type === "replace" && !currentProgress.safeParse(op.progress).success) throw new Error("invalid progress");
        deps.persistence.dispatch(op);
        // Saved after each operation: a crash cannot apply one twice.
        saved!.cursor = item.seq;
        write();
      }
      saved!.epoch = Math.max(saved!.epoch, page.epoch);
      write();
      if (!page.more) return;
    }
  }

  /** Upload what this device has queued. */
  async function push(): Promise<void> {
    let retried = false;
    for (;;) {
      const waiting = (await queued()).slice(0, PUSH_BATCH);
      if (!waiting.length) return;
      // Within the server's request limit: a large snapshot may go alone.
      const batch: Outgoing[] = [];
      const ops = [];
      let size = 0;
      for (const entry of waiting) {
        const sealed = { id: entry.wire, epoch: entry.epoch, reset: entry.reset, ...(await seal(keys!.key, { v: PROGRESS_VERSION, op: entry.op } satisfies Payload)) };
        if (batch.length && size + sealed.data.length > PUSH_BYTES) break;
        batch.push(entry);
        ops.push(sealed);
        size += sealed.data.length;
      }
      const response = await call("POST", { ops });
      if (response.status === 409 && !retried) {
        // A reset happened elsewhere: take it first, then drop whatever the
        // server will never accept.
        retried = true;
        const { epoch } = (await response.json()) as { epoch: number };
        await pull();
        await dropBefore(epoch);
        continue;
      }
      if (response.status === 410) throw new Gone();
      if (!response.ok) throw new Error(`push ${response.status}`);
      const result = (await response.json()) as { epoch: number };
      await remove(batch, true);
      saved!.epoch = Math.max(saved!.epoch, result.epoch);
      write();
    }
  }

  async function run() {
    if (!saved || !keys || deps.persistence.isHeld() || state === "update") return;
    set("syncing");
    try {
      await pull();
      await push();
      await queued();
      saved.lastSync = deps.now();
      write();
      set("idle");
    } catch (error) {
      if (error instanceof Gone) {
        await endHere();
        ended = true;
        notify();
        return;
      }
      await queued().catch(() => undefined);
      if ((state as SyncState) === "update") return;
      const offline = error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
      set(offline ? "offline" : "error");
      // Coming back online syncs at once; otherwise try again in a while.
      schedule(offline ? 5 * 60_000 : 60_000);
    }
  }

  /** Stop syncing on this device: its progress stays, its unsent queue goes. */
  async function endHere() {
    if (timer) clearTimeout(timer);
    timer = null;
    deps.persistence.setAfterCommit(null);
    await remove(await queued().catch(() => [] as Outgoing[])).catch(() => undefined);
    saved = null;
    keys = null;
    pending = 0;
    write();
    set("off");
  }

  /** Sync now, or once more after the current run if one is in progress. */
  function sync(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = run().finally(() => {
      running = null;
      if (again) {
        again = false;
        void sync();
      }
    });
    return running;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Sync shortly after a change, so a burst of answers goes up together. */
  function schedule(delay = 3000) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void sync();
    }, delay);
    // Outside a browser, a waiting sync does not keep the process alive.
    (timer as { unref?: () => void }).unref?.();
  }

  async function activate(next: Saved, derived: SyncKeys) {
    ended = false;
    saved = next;
    keys = derived;
    write();
    deps.persistence.setAfterCommit(afterCommit);
    if (state === "off") state = "idle";
    await queued().catch(() => undefined);
  }

  function hasProgress(memory: Memory) {
    return Object.keys(memory.cards).length > 0 || memory.reviewHistory.length > 0;
  }

  /** Take up the pairing stored on this device, if any, without contacting the server. */
  async function prepare(): Promise<boolean> {
    const stored = read();
    const secret = stored ? readSyncCode(stored.code) : null;
    if (!stored || !secret) return false;
    if (saved?.code === stored.code && keys) {
      // Another tab moved the cursor or epoch on: keep the later values.
      saved.cursor = Math.max(saved.cursor, stored.cursor);
      saved.epoch = Math.max(saved.epoch, stored.epoch);
      saved.lastSync = Math.max(saved.lastSync ?? 0, stored.lastSync ?? 0) || null;
      saved.dropped = Math.max(saved.dropped, stored.dropped);
      return true;
    }
    saved = stored;
    keys = await deriveKeys(secret);
    deps.persistence.setAfterCommit(afterCommit);
    set(state === "off" ? "idle" : state);
    return true;
  }

  return {
    /**
     * Before progress loads: take up a stored pairing, so answers replayed from
     * the journal at start are queued for upload too.
     */
    prepare,
    /** Resume syncing if this device was paired before. */
    async start() {
      if (await prepare()) {
        await queued().catch(() => undefined);
        await sync();
      }
    },
    /** Another tab turned sync on or off, or moved it on. */
    async storageChanged() {
      const stored = read();
      if (stored) {
        const paired = saved?.code !== stored.code;
        await prepare();
        if (paired) await this.start();
      } else if (saved) {
        deps.persistence.setAfterCommit(null);
        saved = null;
        keys = null;
        pending = 0;
        set("off");
      }
    },
    /** Turn sync on with a new code; this device's progress becomes the synced copy. */
    async create(): Promise<string> {
      const code = newSyncCode();
      await activate({ code, cursor: 0, epoch: 0, lastSync: null, dropped: 0 }, await deriveKeys(readSyncCode(code)!));
      await afterCommit(snapshot());
      await sync();
      return code;
    },
    /** Pair with an existing code. If both sides have progress, the learner must choose. */
    async join(text: string): Promise<JoinResult> {
      const secret = readSyncCode(text);
      if (!secret) return "invalid";
      const derived = await deriveKeys(secret);
      let epoch: number;
      let remoteHasData: boolean;
      try {
        const probe = await deps.fetch(`/api/sync/${derived.space}?after=0`, { headers: { authorization: `Bearer ${derived.token}` } });
        if (probe.status === 410) return "deleted";
        if (!probe.ok) return probe.status === 401 ? "invalid" : "offline";
        const page = (await probe.json()) as { epoch: number; ops: Remote[] };
        epoch = page.epoch;
        remoteHasData = page.ops.length > 0;
      } catch {
        return "offline";
      }
      const code = text.trim().toUpperCase();
      if (remoteHasData && hasProgress(deps.memory())) {
        choice = { code, keys: derived, epoch };
        return "needs-choice";
      }
      await activate({ code, cursor: 0, epoch, lastSync: null, dropped: 0 }, derived);
      if (!remoteHasData) await afterCommit(snapshot());
      await sync();
      return "joined";
    },
    /** Finish a join: adopt the synced progress, or replace it with this device's. */
    async choose(keep: "synced" | "this-device") {
      if (!choice) return;
      const { code, keys: derived, epoch } = choice;
      choice = null;
      await activate({ code, cursor: 0, epoch, lastSync: null, dropped: 0 }, derived);
      if (keep === "this-device") {
        // Skip the synced history: this device's progress replaces it.
        await afterCommit(snapshot());
        const latest = await deps.fetch(`/api/sync/${derived.space}?after=0`, { headers: { authorization: `Bearer ${derived.token}` } }).catch(() => null);
        if (latest?.ok) {
          const page = (await latest.json()) as { ops: Remote[] };
          saved!.cursor = page.ops.at(-1)?.seq ?? 0;
          write();
        }
      }
      await sync();
    },
    cancelChoice() {
      choice = null;
    },
    sync,
    /** Stop syncing on this device; its progress and the synced copy stay. */
    async stop() {
      ended = false;
      await endHere();
    },
    /** Delete the synced copy from the server, then stop syncing here. */
    async deleteSynced(): Promise<boolean> {
      if (!keys) return false;
      try {
        const response = await call("DELETE");
        if (!response.ok) return false;
      } catch {
        return false;
      }
      await this.stop();
      return true;
    },
    /** The same object until something in it changes, as React's external stores need. */
    status(): SyncStatus {
      const next: SyncStatus = { state: saved ? state : "off", pending, lastSync: saved?.lastSync ?? null, dropped: saved?.dropped ?? 0, code: saved?.code ?? null, ended };
      if (last && (Object.keys(next) as (keyof SyncStatus)[]).every((key) => last![key] === next[key])) return last;
      return (last = next);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Sync = ReturnType<typeof createSync>;
