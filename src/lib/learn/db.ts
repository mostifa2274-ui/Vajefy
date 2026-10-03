import { defaultProfile, needs, profileOf, reduce, type Op, type Profile, type SkillRecord, type StoredEvent, type Writes } from "./ops";
import { MAX_REVIEW_HISTORY, type SavedProgress } from "./progress";
import type { SessionRecord } from "./session";
import type { CardProg, ReviewEvent } from "./types";

/**
 * The authoritative progress store. Every operation runs in one readwrite
 * transaction that checks the operation id, reads the records it needs,
 * applies the shared reducer and writes the result: all of it or nothing.
 */

export const DB_NAME = "vajefy";
export const DB_VERSION = 1;
const STORES = ["profile", "cards", "skills", "events", "sessions", "meta"] as const;
const PROFILE_KEY = "profile";

export type CommitResult = { duplicate: true } | { duplicate: false; writes: Writes };

export type Loaded = {
  /** False for a database that has never stored a profile. */
  exists: boolean;
  progress: SavedProgress;
  /** Operation ids of `progress.reviewHistory`, in the same order. */
  historyIds: string[];
  sessions: SessionRecord[];
  meta: Record<string, unknown>;
};

/** Test-only hooks for simulating interrupted transactions. */
export type CommitHooks = { afterWrites?: (tx: IDBTransaction) => void };

export class FutureDatabaseError extends Error {
  readonly version: number;
  constructor(version: number) {
    super(`Progress database version ${version} is newer than this release supports.`);
    this.version = version;
  }
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

export function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let open: IDBOpenDBRequest;
    try {
      open = factory.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        if (name === "events") {
          const events = db.createObjectStore("events", { keyPath: "id" });
          events.createIndex("type-at", ["type", "at"]);
          events.createIndex("item", "item");
        } else if (name === "sessions") {
          db.createObjectStore("sessions", { keyPath: "id" });
        } else {
          db.createObjectStore(name);
        }
      }
    };
    open.onsuccess = () => {
      const db = open.result;
      // Let a newer release in another tab upgrade the database.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    open.onerror = () => {
      const error = open.error;
      if (error?.name === "VersionError") {
        void readVersion(factory).then((version) => reject(new FutureDatabaseError(version)), () => reject(error));
      } else {
        reject(error ?? new Error("IndexedDB could not be opened"));
      }
    };
    open.onblocked = () => undefined;
  });
}

function readVersion(factory: IDBFactory): Promise<number> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME);
    open.onsuccess = () => {
      const version = open.result.version;
      open.result.close();
      resolve(version);
    };
    open.onerror = () => reject(open.error);
  });
}

/** Read everything a newer database holds, for a byte-faithful download. */
export async function dumpNewer(factory: IDBFactory): Promise<string> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(DB_NAME);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    const out: Record<string, unknown> = { version: db.version };
    const names = [...db.objectStoreNames];
    const tx = db.transaction(names, "readonly");
    for (const name of names) {
      const store = tx.objectStore(name);
      const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
      out[name] = keys.map((key, index) => [key, values[index]]);
    }
    return JSON.stringify(out);
  } finally {
    db.close();
  }
}

function reviewEvents(progress: SavedProgress, opId: string): StoredEvent[] {
  return progress.reviewHistory.map((review, index) => ({
    id: `${opId}:${String(index).padStart(6, "0")}`,
    type: "review",
    at: review.at,
    item: review.id,
    grade: review.grade,
    review,
  }));
}

function applyWrites(tx: IDBTransaction, writes: Writes) {
  const profile = tx.objectStore("profile");
  const cards = tx.objectStore("cards");
  const skills = tx.objectStore("skills");
  const events = tx.objectStore("events");
  const sessions = tx.objectStore("sessions");
  const meta = tx.objectStore("meta");

  if (writes.replace || writes.reset) {
    cards.clear();
    skills.clear();
    events.clear();
    sessions.clear();
  }
  if (writes.replace) {
    const progress = writes.replace;
    profile.put(profileOf(progress), PROFILE_KEY);
    for (const [id, card] of Object.entries(progress.cards)) cards.put(card, id);
    for (const [id, record] of Object.entries(progress.practiceSkills)) skills.put(record, id);
    for (const event of reviewEvents(progress, writes.event?.id ?? "import")) events.put(event);
  }
  if (writes.profile) profile.put(writes.profile, PROFILE_KEY);
  for (const [id, card] of Object.entries(writes.cards ?? {})) {
    if (card) cards.put(card, id);
    else cards.delete(id);
  }
  for (const [id, record] of Object.entries(writes.skills ?? {})) {
    if (record) skills.put(record, id);
    else skills.delete(id);
  }
  if (writes.targetEvent) events.put(writes.targetEvent);
  if (writes.event) events.put(writes.event);
  for (const [key, value] of Object.entries(writes.meta ?? {})) meta.put(value, key);
  if (writes.session) sessions.put(writes.session);
}

async function deleteEventsFor(tx: IDBTransaction, items: string[], keep: string | undefined) {
  const index = tx.objectStore("events").index("item");
  for (const item of items) {
    const keys = await request(index.getAllKeys(IDBKeyRange.only(item)));
    for (const key of keys) if (key !== keep) tx.objectStore("events").delete(key);
  }
}

/** Apply one operation atomically. A repeated id is reported, not applied again. */
export async function commit(db: IDBDatabase, op: Op, hooks: CommitHooks = {}): Promise<CommitResult> {
  const tx = db.transaction([...STORES], "readwrite");
  const done = finished(tx);
  try {
    const events = tx.objectStore("events");
    if (op.type !== "session" && (await request(events.get(op.id)))) {
      await done;
      return { duplicate: true };
    }
    if (op.type === "session") {
      // Never let a replayed or late snapshot move a session backwards.
      const stored = op.sessionState
        ? ((await request(tx.objectStore("sessions").get(op.sessionState.id))) as SessionRecord | undefined)
        : undefined;
      if (op.sessionState && stored && stored.updatedAt > op.sessionState.updatedAt) {
        await done;
        return { duplicate: false, writes: {} };
      }
    }
    const target = op.type === "undo" ? ((await request(events.get(op.target))) as StoredEvent | undefined) : undefined;
    const wanted = needs(op);
    const cardIds = target?.item ? [target.item] : wanted.cards;
    const profile = ((await request(tx.objectStore("profile").get(PROFILE_KEY))) as Profile | undefined) ?? defaultProfile();
    const cards: Record<string, CardProg | undefined> = {};
    for (const id of cardIds) cards[id] = (await request(tx.objectStore("cards").get(id))) as CardProg | undefined;
    const skills: Record<string, SkillRecord | undefined> = {};
    for (const id of wanted.skills) skills[id] = (await request(tx.objectStore("skills").get(id))) as SkillRecord | undefined;

    const writes = reduce(op, { profile, cards, skills, target });
    if (writes.forgetItems?.length) await deleteEventsFor(tx, writes.forgetItems, writes.event?.id);
    applyWrites(tx, writes);
    hooks.afterWrites?.(tx);
    await done;
    return { duplicate: false, writes };
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Already finished or aborted.
    }
    await done.catch(() => undefined);
    throw error;
  }
}

/** Read the current progress. Review history is the latest non-undone reviews. */
export async function load(db: IDBDatabase): Promise<Loaded> {
  const tx = db.transaction([...STORES], "readonly");
  const done = finished(tx);
  const profile = (await request(tx.objectStore("profile").get(PROFILE_KEY))) as Profile | undefined;
  const cardStore = tx.objectStore("cards");
  const [cardKeys, cardValues] = await Promise.all([request(cardStore.getAllKeys()), request(cardStore.getAll())]);
  const skillStore = tx.objectStore("skills");
  const [skillKeys, skillValues] = await Promise.all([request(skillStore.getAllKeys()), request(skillStore.getAll())]);
  const sessions = (await request(tx.objectStore("sessions").getAll())) as SessionRecord[];
  const metaStore = tx.objectStore("meta");
  const [metaKeys, metaValues] = await Promise.all([request(metaStore.getAllKeys()), request(metaStore.getAll())]);

  const history: StoredEvent[] = [];
  await new Promise<void>((resolve, reject) => {
    const range = IDBKeyRange.bound(["review", -Infinity], ["review", Infinity]);
    const cursor = tx.objectStore("events").index("type-at").openCursor(range, "prev");
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current || history.length >= MAX_REVIEW_HISTORY) {
        resolve();
        return;
      }
      const event = current.value as StoredEvent;
      if (!event.undone && event.review) history.push(event);
      current.continue();
    };
  });
  await done;
  history.reverse();

  const base = profile ?? defaultProfile();
  return {
    exists: Boolean(profile),
    progress: {
      ...base,
      cards: Object.fromEntries(cardKeys.map((key, index) => [String(key), cardValues[index] as CardProg])),
      practiceSkills: Object.fromEntries(skillKeys.map((key, index) => [String(key), skillValues[index] as SkillRecord])),
      reviewHistory: history.map((event) => event.review as ReviewEvent),
    },
    historyIds: history.map((event) => event.id),
    sessions,
    meta: Object.fromEntries(metaKeys.map((key, index) => [String(key), metaValues[index]])),
  };
}

/**
 * Bring stored progress to the current version in one transaction: the
 * migrated profile, cards and skills replace the old ones together with the
 * new version number. Events and sessions are left as they are.
 */
export async function upgrade(db: IDBDatabase, progress: SavedProgress, version: number): Promise<void> {
  const tx = db.transaction(["profile", "cards", "skills", "meta"], "readwrite");
  const done = finished(tx);
  try {
    tx.objectStore("profile").put(profileOf(progress), PROFILE_KEY);
    const cards = tx.objectStore("cards");
    cards.clear();
    for (const [id, card] of Object.entries(progress.cards)) cards.put(card, id);
    const skills = tx.objectStore("skills");
    skills.clear();
    for (const [id, record] of Object.entries(progress.practiceSkills)) skills.put(record, id);
    tx.objectStore("meta").put(version, "progressVersion");
    await done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Already finished.
    }
    await done.catch(() => undefined);
    throw error;
  }
}

/** Read the records another tab reported changing. */
export async function readChanged(
  db: IDBDatabase,
  changed: { cards: string[]; skills: string[]; sessions: string[] },
): Promise<{
  profile: Profile | undefined;
  cards: Record<string, CardProg | null>;
  skills: Record<string, SkillRecord | null>;
  sessions: Record<string, SessionRecord | null>;
}> {
  const tx = db.transaction([...STORES], "readonly");
  const done = finished(tx);
  const profile = (await request(tx.objectStore("profile").get(PROFILE_KEY))) as Profile | undefined;
  const cards: Record<string, CardProg | null> = {};
  for (const id of changed.cards) cards[id] = ((await request(tx.objectStore("cards").get(id))) as CardProg | undefined) ?? null;
  const skills: Record<string, SkillRecord | null> = {};
  for (const id of changed.skills) skills[id] = ((await request(tx.objectStore("skills").get(id))) as SkillRecord | undefined) ?? null;
  const sessions: Record<string, SessionRecord | null> = {};
  for (const id of changed.sessions) {
    sessions[id] = ((await request(tx.objectStore("sessions").get(id))) as SessionRecord | undefined) ?? null;
  }
  await done;
  return { profile, cards, skills, sessions };
}

export async function getEvent(db: IDBDatabase, id: string): Promise<StoredEvent | undefined> {
  const tx = db.transaction(["events"], "readonly");
  const done = finished(tx);
  const event = (await request(tx.objectStore("events").get(id))) as StoredEvent | undefined;
  await done;
  return event;
}

/** Every stored event and session, for the study export. */
export async function readEvidence(db: IDBDatabase): Promise<{ events: StoredEvent[]; sessions: SessionRecord[] }> {
  const tx = db.transaction(["events", "sessions"], "readonly");
  const [events, sessions] = await Promise.all([
    request(tx.objectStore("events").getAll()) as Promise<StoredEvent[]>,
    request(tx.objectStore("sessions").getAll()) as Promise<SessionRecord[]>,
  ]);
  return { events, sessions };
}
