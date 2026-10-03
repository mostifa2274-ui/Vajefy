import { commit, dumpNewer, FutureDatabaseError, load, openDb, readChanged, type CommitHooks, type Loaded } from "./db";
import { journalAppend, journalPending, journalRemove } from "./journal";
import { defaultProfile, needs, profileOf, reduce, type Op, type Profile, type SkillRecord, type StoredEvent, type Writes } from "./ops";
import { MAX_REVIEW_HISTORY, PROGRESS_VERSION, savedProgress, type SavedProgress } from "./progress";
import { inspectStoredProgress, type HeldSave } from "./recovery";
import { currentProgress } from "./schema";
import { newId, type SessionRecord } from "./session";
import type { CardProg, ReviewEvent } from "./types";

/**
 * Connects the in-memory progress store with IndexedDB.
 *
 * Operations apply to memory at once, so the screen never waits. They are
 * also written to the journal and committed to IndexedDB in order. The
 * committed result is authoritative. When it differs, because another tab
 * changed the same records, memory is corrected and the operations still
 * waiting are applied again on top.
 */

export const LEGACY_KEY = "roshana-v1";
export const LANG_KEY = "vajefy-lang";
export const CHANNEL = "vajefy-progress";

/**
 * - `saved`: everything this tab did is committed.
 * - `session`: a commit failed and the work exists only in this tab until a retry succeeds.
 * - `unavailable`: this browser offers no database, so export is the only safeguard.
 */
export type SaveStatus = "checking" | "saved" | "session" | "unavailable";

export type Memory = SavedProgress & { sessions: Record<string, SessionRecord> };

type Message = {
  tab: string;
  op: string;
  reload?: boolean;
  profile?: boolean;
  cards?: string[];
  skills?: string[];
  sessions?: string[];
  event?: StoredEvent;
  targetEvent?: StoredEvent;
  forgetItems?: string[];
};

type Channel = { postMessage(message: Message): void; addEventListener(type: "message", listener: (event: { data: Message }) => void): void };

export type Environment = {
  read: () => Memory;
  write: (patch: Partial<Memory>) => void;
  hydrated: () => void;
  idb?: () => IDBFactory | undefined;
  localStorage?: () => Pick<Storage, "getItem" | "setItem"> | undefined;
  channel?: () => Channel | undefined;
  now?: () => number;
  hooks?: CommitHooks;
};

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}:${hash.toString(16)}`;
}

/** Compare progress by content, ignoring key order and the order of equal-time reviews. */
export function canonical(progress: SavedProgress): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
      );
    }
    return value;
  };
  const history = progress.reviewHistory
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.at - b.event.at || a.index - b.index)
    .map((entry) => entry.event);
  return JSON.stringify(sortKeys({ ...savedProgress(progress), reviewHistory: history }));
}

export function createPersistence(env: Environment) {
  // Created on first use: the Workers runtime forbids random values at load.
  let tabId = "";
  const tab = () => (tabId ||= newId());
  const now = env.now ?? (() => Date.now());
  const listeners = new Set<() => void>();
  let status: SaveStatus = "checking";
  let held: HeldSave | null = null;
  let mode: "starting" | "idb" | "memory" | "held" = "starting";
  let db: IDBDatabase | null = null;
  let started: Promise<void> | null = null;
  /** Loading failed after the database opened, so a retry may succeed. */
  let restartable = false;
  let pumping: Promise<void> | null = null;
  const pending: Op[] = [];
  /** Operation ids of memory's review history, in the same order. */
  let historyIds: string[] = [];
  /** Review events this tab knows, so an undo can apply at once. */
  const recent = new Map<string, StoredEvent>();
  /** Operations this tab has dispatched, so a repeated submission is ignored at once. */
  const dispatched = new Set<string>();
  let channel: Channel | undefined;

  function notify() {
    for (const listener of listeners) listener();
  }

  function report(next: SaveStatus) {
    if (next === status) return;
    status = next;
    notify();
  }

  function remember(event: StoredEvent | undefined) {
    if (!event?.review) return;
    recent.set(event.id, event);
    if (recent.size > 500) recent.delete(recent.keys().next().value as string);
  }

  function snapshotFor(op: Op, memory: Memory) {
    const profile = profileOf(savedProgress(memory));
    const target = op.type === "undo" ? recent.get(op.target) : undefined;
    const items =
      op.type === "review" || op.type === "practice" || op.type === "introduce"
        ? [op.item]
        : op.type === "forget"
          ? op.items
          : target?.item
            ? [target.item]
            : [];
    return {
      profile,
      cards: Object.fromEntries(items.map((id) => [id, memory.cards[id]])),
      skills: Object.fromEntries(items.map((id) => [id, memory.practiceSkills[id]])),
      target,
    };
  }

  /** Apply writes to memory. Safe to repeat: history is keyed by operation id. */
  function applyToMemory(writes: Writes, opId: string) {
    const memory = env.read();
    const patch: Partial<Memory> = {};
    let cards = memory.cards;
    let skills = memory.practiceSkills;
    let history = memory.reviewHistory;
    let ids = historyIds;
    let sessions = memory.sessions;

    if (writes.replace) {
      const progress = writes.replace;
      Object.assign(patch, profileOf(progress));
      cards = { ...progress.cards };
      skills = { ...progress.practiceSkills };
      history = [...progress.reviewHistory];
      ids = history.map((_, index) => `${opId}:${String(index).padStart(6, "0")}`);
      sessions = {};
    } else if (writes.reset) {
      cards = {};
      skills = {};
      history = [];
      ids = [];
      sessions = {};
    }
    if (writes.profile) Object.assign(patch, writes.profile);
    if (writes.cards) {
      cards = { ...cards };
      for (const [id, card] of Object.entries(writes.cards)) {
        if (card) cards[id] = card;
        else delete cards[id];
      }
    }
    if (writes.skills) {
      skills = { ...skills };
      for (const [id, record] of Object.entries(writes.skills)) {
        if (record) skills[id] = record;
        else delete skills[id];
      }
    }
    if (writes.targetEvent?.undone) {
      const index = ids.indexOf(writes.targetEvent.id);
      if (index >= 0) {
        history = history.filter((_, position) => position !== index);
        ids = ids.filter((_, position) => position !== index);
      }
      recent.set(writes.targetEvent.id, writes.targetEvent);
    }
    if (writes.forgetItems?.length) {
      const gone = new Set(writes.forgetItems);
      const keep = history.map((event) => !gone.has(event.id));
      history = history.filter((_, index) => keep[index]);
      ids = ids.filter((_, index) => keep[index]);
    }
    if (writes.event?.review && !ids.includes(writes.event.id)) {
      history = [...history, writes.event.review];
      ids = [...ids, writes.event.id];
      if (history.length > MAX_REVIEW_HISTORY) {
        history = history.slice(-MAX_REVIEW_HISTORY);
        ids = ids.slice(-MAX_REVIEW_HISTORY);
      }
    }
    remember(writes.event);
    if (writes.session) {
      const stored = sessions[writes.session.id];
      if (!stored || stored.updatedAt <= writes.session.updatedAt) {
        sessions = { ...sessions, [writes.session.id]: writes.session };
      }
    }
    historyIds = ids;
    env.write({ ...patch, cards, practiceSkills: skills, reviewHistory: history, sessions });
  }

  function applyPending() {
    for (const op of pending) applyToMemory(reduce(op, snapshotFor(op, env.read())), op.id);
  }

  function setLoaded(loaded: Loaded) {
    historyIds = loaded.historyIds;
    env.write({
      ...loaded.progress,
      sessions: Object.fromEntries(loaded.sessions.map((session) => [session.id, session])),
    });
  }

  function mirrorLanguage(lang: string) {
    try {
      env.localStorage?.()?.setItem(LANG_KEY, lang);
    } catch {
      // Only the first paint's direction depends on it.
    }
  }

  function broadcast(op: Op, writes: Writes) {
    if (!channel) return;
    const message: Message = { tab: tab(), op: op.id };
    if (writes.replace || writes.reset) message.reload = true;
    else {
      message.profile = Boolean(writes.profile);
      message.cards = Object.keys(writes.cards ?? {});
      message.skills = Object.keys(writes.skills ?? {});
      message.sessions = writes.session ? [writes.session.id] : [];
      if (writes.event) message.event = writes.event;
      if (writes.targetEvent) message.targetEvent = writes.targetEvent;
      if (writes.forgetItems) message.forgetItems = writes.forgetItems;
    }
    try {
      channel.postMessage(message);
    } catch {
      // Other tabs will catch up on their next reload.
    }
  }

  async function pump(): Promise<void> {
    if (pumping) return pumping;
    pumping = (async () => {
      try {
        while (pending.length && db) {
          const op = pending[0]!;
          let result;
          try {
            result = await commit(db, op, env.hooks);
          } catch {
            report("session");
            return;
          }
          pending.shift();
          journalRemove(op.id);
          if (!result.duplicate) {
            applyToMemory(result.writes, op.id);
            applyPending();
            broadcast(op, result.writes);
          } else {
            // Applied already, for example replayed from the journal by another
            // tab: drop the optimistic copy by reading the stored records.
            await refresh(op);
          }
          if (op.type === "settings" && op.patch.lang) mirrorLanguage(op.patch.lang);
        }
        if (!pending.length && mode === "idb") report("saved");
      } finally {
        pumping = null;
      }
    })();
    return pumping;
  }

  async function refresh(op: Op) {
    if (!db) return;
    const wanted = needs(op);
    const changed = await readChanged(db, { cards: wanted.cards, skills: wanted.skills, sessions: [] });
    applyToMemory(
      { ...(changed.profile ? { profile: changed.profile } : {}), cards: changed.cards, skills: changed.skills },
      op.id,
    );
    applyPending();
  }

  async function onMessage(message: Message) {
    if (message.tab === tab() || mode !== "idb" || !db) return;
    if (message.reload) {
      setLoaded(await load(db));
      applyPending();
      return;
    }
    const changed = await readChanged(db, {
      cards: message.cards ?? [],
      skills: message.skills ?? [],
      sessions: message.sessions ?? [],
    });
    const writes: Writes = {
      ...(message.profile && changed.profile ? { profile: changed.profile } : {}),
      cards: changed.cards,
      skills: changed.skills,
      ...(message.event ? { event: message.event } : {}),
      ...(message.targetEvent ? { targetEvent: message.targetEvent } : {}),
      ...(message.forgetItems ? { forgetItems: message.forgetItems } : {}),
    };
    applyToMemory(writes, message.op);
    const memory = env.read();
    let sessions = memory.sessions;
    for (const [id, session] of Object.entries(changed.sessions)) {
      if (session) sessions = { ...sessions, [id]: session };
    }
    env.write({ sessions });
    applyPending();
  }

  function hold(save: HeldSave) {
    held = save;
    mode = "held";
    notify();
  }

  function legacyRaw(): string | null {
    try {
      return env.localStorage?.()?.getItem(LEGACY_KEY) ?? null;
    } catch {
      return null;
    }
  }

  async function putMeta(key: string, value: unknown) {
    if (!db) return;
    const tx = db.transaction(["meta"], "readwrite");
    tx.objectStore("meta").put(value, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function wipe() {
    if (!db) return;
    const names = [...db.objectStoreNames];
    const tx = db.transaction(names, "readwrite");
    for (const name of names) tx.objectStore(name).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  /** Bring answers made by an older release in this browser after the migration. */
  async function catchUpLegacy(meta: Record<string, unknown>) {
    const migration = meta.migration as { at?: number; legacyHash?: string } | undefined;
    const raw = legacyRaw();
    if (!db || !migration || !raw || fnv1a(raw) === migration.legacyHash) return 0;
    const inspected = inspectStoredProgress(raw);
    let replayed = 0;
    if (inspected.kind === "ok") {
      for (const event of inspected.progress.reviewHistory) {
        if (event.at <= (migration.at ?? 0)) continue;
        const op: Op = { id: `legacy:${event.id}:${event.at}`, type: "review", at: event.at, item: event.id, grade: event.grade };
        const result = await commit(db, op, env.hooks);
        if (!result.duplicate) replayed += 1;
      }
    }
    await putMeta("migration", { ...migration, legacyHash: fnv1a(raw) });
    return replayed;
  }

  /** Copy a valid older save into IndexedDB and prove the copy is identical. */
  async function migrate(progress: SavedProgress, raw: string): Promise<boolean> {
    if (!db) return false;
    const at = now();
    const op: Op = {
      id: newId(),
      type: "replace",
      at,
      reason: "migrate",
      progress,
      meta: { migration: { from: "localStorage", at, legacyHash: fnv1a(raw), outcome: "copied" }, progressVersion: PROGRESS_VERSION },
    };
    await commit(db, op, env.hooks);
    const copied = await load(db);
    if (canonical(copied.progress) === canonical(progress)) return true;
    // Never switch to a copy that differs: remove it and keep using the original.
    await wipe();
    return false;
  }

  async function replayJournal(): Promise<number> {
    let replayed = 0;
    for (const op of journalPending()) {
      if (!db) break;
      try {
        const result = await commit(db, op, env.hooks);
        if (!result.duplicate) replayed += 1;
        journalRemove(op.id);
      } catch {
        // Leave it journaled; a later start retries.
      }
    }
    return replayed;
  }

  function runInMemory(progress: SavedProgress | null, reason: SaveStatus = "unavailable") {
    mode = "memory";
    if (progress) {
      historyIds = progress.reviewHistory.map((_, index) => `legacy:${index}`);
      env.write({ ...progress, sessions: {} });
    }
    // Answers journaled while no database was available still count.
    for (const op of journalPending()) {
      if (op.type === "replace" || op.type === "session") continue;
      applyToMemory(reduce(op, snapshotFor(op, env.read())), op.id);
    }
    report(reason);
  }

  async function run() {
    const factory = env.idb?.();
    if (!factory) {
      fallBack();
      return;
    }
    try {
      db = await openDb(factory);
    } catch (error) {
      if (error instanceof FutureDatabaseError) {
        const raw = await dumpNewer(factory).catch(() => "");
        hold({ kind: "future", raw, version: error.version });
        return;
      }
      fallBack();
      return;
    }

    let loaded = await load(db);
    if (!loaded.exists) {
      const raw = legacyRaw();
      const inspected = inspectStoredProgress(raw);
      if (inspected.kind === "damaged" || inspected.kind === "future") {
        hold(inspected);
        return;
      }
      if (inspected.kind === "ok" && raw) {
        if (!(await migrate(inspected.progress, raw))) {
          runInMemory(inspected.progress);
          return;
        }
      } else {
        await putMeta("progressVersion", PROGRESS_VERSION);
      }
      loaded = await load(db);
    } else {
      const version = loaded.meta.progressVersion;
      if (typeof version === "number" && version > PROGRESS_VERSION) {
        hold({ kind: "future", raw: JSON.stringify({ state: loaded.progress, version }), version });
        return;
      }
      if (!currentProgress.safeParse(loaded.progress).success) {
        hold({ kind: "damaged", raw: JSON.stringify({ state: loaded.progress, version: PROGRESS_VERSION }) });
        return;
      }
      if ((await catchUpLegacy(loaded.meta)) > 0) loaded = await load(db);
    }
    if ((await replayJournal()) > 0) loaded = await load(db);
    setLoaded(loaded);
    // Operations dispatched while loading are not in the stored state yet.
    applyPending();
    mirrorLanguage(loaded.progress.lang);
    mode = "idb";
    listen();
    report("saved");
    if (pending.length) await pump();
  }

  function listen() {
    if (channel) return;
    channel = env.channel?.();
    channel?.addEventListener("message", (event) => void onMessage(event.data).catch(() => undefined));
  }

  function fallBack(reason: SaveStatus = "unavailable") {
    const inspected = inspectStoredProgress(legacyRaw());
    if (inspected.kind === "damaged" || inspected.kind === "future") hold(inspected);
    else runInMemory(inspected.kind === "ok" ? inspected.progress : null, reason);
  }

  return {
    start(): Promise<void> {
      if (!started) {
        started = run()
          .catch(() => {
            // The database exists but a write failed while loading, for
            // example when storage is full: keep working from the journal
            // and let Retry start again.
            const opened = db !== null;
            db?.close();
            db = null;
            restartable = opened;
            if (mode === "starting") fallBack(opened ? "session" : "unavailable");
          })
          .finally(() => env.hydrated());
      }
      return started;
    },
    /** Apply an operation now and save it durably in order. */
    dispatch(op: Op) {
      if (dispatched.has(op.id)) return;
      dispatched.add(op.id);
      applyToMemory(reduce(op, snapshotFor(op, env.read())), op.id);
      if (mode === "held") return;
      journalAppend(op);
      if (mode === "memory") return;
      pending.push(op);
      if (mode === "idb") void pump();
    },
    async retry(): Promise<boolean> {
      if (mode === "memory" && restartable) {
        restartable = false;
        mode = "starting";
        started = null;
        await this.start();
        return status === "saved";
      }
      if (mode !== "idb") return false;
      await pump();
      return status === "saved";
    },
    /** Settle a held save with the learner's choice; nothing else replaces it. */
    async resolve(progress: SavedProgress, reason: "restore" | "start-over"): Promise<void> {
      if (!held) return;
      const original = held;
      held = null;
      if (!db) {
        runInMemory(progress);
        notify();
        return;
      }
      mode = "idb";
      notify();
      if (reason === "start-over") for (const op of journalPending()) journalRemove(op.id);
      const at = now();
      this.dispatch({
        id: newId(),
        type: "replace",
        at,
        reason,
        progress,
        meta: {
          migration: { from: original.kind, at, legacyHash: fnv1a(legacyRaw() ?? ""), outcome: reason },
          progressVersion: PROGRESS_VERSION,
        },
      });
      await pump();
      if (reason === "restore" && (await replayJournal()) > 0) {
        setLoaded(await load(db));
        applyPending();
      }
      listen();
    },
    getStatus: (): SaveStatus => status,
    getHeld: (): HeldSave | null => held,
    pendingCount: () => pending.length,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** For tests: the operation ids behind memory's review history. */
    historyIds: () => historyIds,
  };
}

export type Persistence = ReturnType<typeof createPersistence>;

/** Default profile values, exported for the store's initial state. */
export function emptyMemory(): Memory {
  const profile: Profile = defaultProfile();
  return {
    ...profile,
    cards: {} as Record<string, CardProg>,
    practiceSkills: {} as Record<string, SkillRecord>,
    reviewHistory: [] as ReviewEvent[],
    sessions: {},
  };
}
