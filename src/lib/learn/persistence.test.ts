import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { makeBackup } from "./backup";
import { commit, getEvent, load, openDb } from "./db";
import { JOURNAL_PREFIX } from "./journal";
import type { Op } from "./ops";
import { createPersistence, emptyMemory, LEGACY_KEY, type Environment, type Memory } from "./persistence";
import { PROGRESS_VERSION, type SavedProgress } from "./progress";
import { startReview } from "./session";

const DAY = 86_400_000;
const T0 = new Date(2026, 9, 2, 9).getTime();

/** A Storage stand-in shared by "tabs" of the same browser. */
class MemoryStorage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

/** BroadcastChannel stand-in delivering to every other tab of the same browser. */
class Hub {
  tabs: ((data: unknown) => void)[] = [];
  channel() {
    let self: ((data: unknown) => void) | null = null;
    return {
      postMessage: (data: unknown) => {
        for (const deliver of this.tabs) if (deliver !== self) queueMicrotask(() => deliver(data));
      },
      addEventListener: (_type: "message", listener: (event: { data: never }) => void) => {
        self = (data) => listener({ data: data as never });
        this.tabs.push(self);
      },
    };
  }
}

type Browser = { idb: IDBFactory; storage: MemoryStorage; hub: Hub };
let browser: Browser;

beforeEach(() => {
  browser = { idb: new IDBFactory(), storage: new MemoryStorage(), hub: new Hub() };
  Object.assign(globalThis, { window: { localStorage: browser.storage } });
});

function tab(options: Partial<Environment> & { factory?: IDBFactory | null } = {}) {
  let memory: Memory = emptyMemory();
  let hydrated = false;
  const persistence = createPersistence({
    read: () => memory,
    write: (patch) => {
      memory = { ...memory, ...patch };
    },
    hydrated: () => {
      hydrated = true;
    },
    idb: () => (options.factory === null ? undefined : (options.factory ?? browser.idb)),
    localStorage: () => browser.storage,
    channel: () => browser.hub.channel(),
    now: () => T0,
    ...options,
  });
  return {
    persistence,
    memory: () => memory,
    hydrated: () => hydrated,
  };
}

let seq = 0;
function review(item: string, grade: "again" | "hard" | "good" | "easy" = "good", at = T0 + seq * 1000): Op {
  seq += 1;
  return { id: `op-${seq}-${item}`, type: "review", at, item, grade };
}

function legacy(progress: Partial<SavedProgress> = {}) {
  const base = JSON.parse(makeBackup({ ...emptyMemory(), onboarded: true, xp: 30, ...progress })).progress;
  return JSON.stringify({ state: base, version: PROGRESS_VERSION });
}

async function stored() {
  const db = await openDb(browser.idb);
  try {
    return await load(db);
  } finally {
    db.close();
  }
}

async function settle(app: ReturnType<typeof tab>) {
  await app.persistence.retry();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("a valid older save is copied, verified, and the original left untouched", async () => {
  const raw = legacy({
    cards: { "lex:A1:about": { ease: 2.5, interval: 3, due: T0 + 3 * DAY, reps: 2, lapses: 0, state: "review", step: 0, last: T0 } },
    reviewHistory: [
      { id: "lex:A1:about", at: T0 - DAY, grade: "good", algorithm: "legacy", elapsedDays: 1, scheduledDays: 3 },
      { id: "lex:A1:about", at: T0 - DAY, grade: "hard", algorithm: "legacy", elapsedDays: 0, scheduledDays: 1 },
    ],
  });
  browser.storage.setItem(LEGACY_KEY, raw);
  const app = tab();
  await app.persistence.start();
  assert.equal(app.persistence.getStatus(), "saved");
  assert.equal(browser.storage.getItem(LEGACY_KEY), raw);
  const db = await stored();
  assert.equal(db.exists, true);
  assert.deepEqual(db.progress.cards, JSON.parse(raw).state.cards);
  assert.deepEqual(db.progress.reviewHistory, JSON.parse(raw).state.reviewHistory);
  assert.equal(app.memory().xp, 30);
  assert.equal(app.hydrated(), true);
});

test("a migration that does not verify is discarded and the original stays in use", async () => {
  const raw = legacy({ xp: 55 });
  browser.storage.setItem(LEGACY_KEY, raw);
  const app = tab({
    hooks: {
      afterWrites: (tx) => {
        // Simulate a storage engine that silently changes data.
        tx.objectStore("profile").put({ ...JSON.parse(raw).state, xp: 1 }, "profile");
      },
    },
  });
  await app.persistence.start();
  assert.equal(app.persistence.getStatus(), "unavailable");
  assert.equal(app.memory().xp, 55);
  assert.equal((await stored()).exists, false);
  assert.equal(browser.storage.getItem(LEGACY_KEY), raw);
});

test("damaged and newer saves are held without writing anything", async () => {
  for (const raw of ['{"state":{"cards":', JSON.stringify({ state: {}, version: PROGRESS_VERSION + 1 })]) {
    browser = { idb: new IDBFactory(), storage: new MemoryStorage(), hub: new Hub() };
    Object.assign(globalThis, { window: { localStorage: browser.storage } });
    browser.storage.setItem(LEGACY_KEY, raw);
    const app = tab();
    await app.persistence.start();
    assert.equal(app.persistence.getHeld()?.raw, raw);
    app.persistence.dispatch(review("lex:A1:about"));
    assert.equal((await stored()).exists, false);
    assert.equal(browser.storage.getItem(LEGACY_KEY), raw);
    assert.equal(browser.storage.length, 1, "nothing is journaled while a save is held");
  }
});

test("starting over from a held save writes a fresh profile once chosen", async () => {
  browser.storage.setItem(LEGACY_KEY, "{not json");
  const app = tab();
  await app.persistence.start();
  await app.persistence.resolve({ ...emptyMemory(), lang: "en" }, "start-over");
  assert.equal(app.persistence.getHeld(), null);
  assert.equal(app.persistence.getStatus(), "saved");
  const db = await stored();
  assert.equal(db.exists, true);
  assert.equal(db.progress.lang, "en");
  assert.equal(browser.storage.getItem(LEGACY_KEY), "{not json");
  // The next start does not ask again.
  const again = tab();
  await again.persistence.start();
  assert.equal(again.persistence.getHeld(), null);
});

test("a failed journal replay after restore stays visible and retryable", async () => {
  const recovered = JSON.parse(legacy({ xp: 40 })).state as SavedProgress;
  const op = review("lex:A1:about");
  browser.storage.setItem(LEGACY_KEY, "{not json");
  browser.storage.setItem(JOURNAL_PREFIX + op.id, JSON.stringify(op));
  let writes = 0;
  let failJournal = true;
  const app = tab({
    hooks: {
      afterWrites: (tx) => {
        writes += 1;
        if (failJournal && writes > 1) tx.abort();
      },
    },
  });
  await app.persistence.start();
  assert.equal(app.persistence.getHeld()?.kind, "damaged");

  await app.persistence.resolve(recovered, "restore");

  assert.equal(app.persistence.getStatus(), "session");
  assert.equal(app.persistence.pendingCount(), 1);
  assert.equal(app.memory().lifetime.reviews, 1, "the recovered export includes the unsaved answer");
  assert.ok(browser.storage.getItem(JOURNAL_PREFIX + op.id));

  failJournal = false;
  assert.equal(await app.persistence.retry(), true);
  assert.equal(app.persistence.getStatus(), "saved");
  assert.equal((await stored()).progress.lifetime.reviews, 1);
  assert.equal(browser.storage.getItem(JOURNAL_PREFIX + op.id), null);
});

test("an answer and its progress are committed together and counted once", async () => {
  const app = tab();
  await app.persistence.start();
  const op = review("lex:A1:about");
  app.persistence.dispatch(op);
  app.persistence.dispatch(op);
  await settle(app);
  const db = await stored();
  assert.equal(db.progress.lifetime.reviews, 1);
  assert.equal(db.progress.reviewHistory.length, 1);
  assert.ok(db.progress.cards["lex:A1:about"]);
  assert.equal(app.memory().lifetime.reviews, 1, "the duplicate is not counted in memory either");
  assert.deepEqual(app.persistence.historyIds(), [op.id]);
  assert.equal(browser.storage.getItem(JOURNAL_PREFIX + op.id), null);
});

test("a retry with nothing waiting does not stop later answers being saved", async () => {
  const app = tab();
  await app.persistence.start();
  await app.persistence.retry();
  app.persistence.dispatch(review("lex:A1:about"));
  await settle(app);
  assert.equal(app.persistence.pendingCount(), 0);
  assert.equal((await stored()).progress.lifetime.reviews, 1);
});

test("an answer leaves the journal only once the sync hook has it", async () => {
  const app = tab();
  await app.persistence.start();
  const handed: string[] = [];
  let fail = true;
  app.persistence.setAfterCommit(async (op) => {
    if (fail) throw new Error("outbox unavailable");
    handed.push(op.id);
  });
  const first = review("lex:A1:about");
  app.persistence.dispatch(first);
  await settle(app);
  assert.equal((await stored()).progress.lifetime.reviews, 1, "the answer is saved either way");
  assert.ok(browser.storage.getItem(JOURNAL_PREFIX + first.id), "and stays journaled for sync to pick up on the next start");
  fail = false;
  const second = review("lex:A1:above");
  app.persistence.dispatch(second);
  await settle(app);
  assert.deepEqual(handed, [second.id]);
  assert.equal(browser.storage.getItem(JOURNAL_PREFIX + second.id), null);
});

test("an interrupted write keeps the answer in the session and replays it exactly once", async () => {
  let fail = true;
  const app = tab({
    hooks: {
      afterWrites: (tx) => {
        if (fail) tx.abort();
      },
    },
  });
  await app.persistence.start();
  const op = review("lex:A1:about");
  app.persistence.dispatch(op);
  await settle(app);
  assert.equal(app.persistence.getStatus(), "session");
  assert.equal(app.memory().lifetime.reviews, 1);
  assert.equal((await stored()).progress.lifetime.reviews, 0, "an aborted transaction leaves nothing behind");
  assert.ok(browser.storage.getItem(JOURNAL_PREFIX + op.id), "the answer is journaled");

  // The page closes here. A new page replays the journal.
  fail = false;
  const reopened = tab();
  await reopened.persistence.start();
  assert.equal(reopened.memory().lifetime.reviews, 1);
  assert.equal((await stored()).progress.reviewHistory.length, 1);
  assert.equal(browser.storage.getItem(JOURNAL_PREFIX + op.id), null);

  // The original tab retries later: the id makes it a no-op.
  await app.persistence.retry();
  assert.equal(app.persistence.getStatus(), "saved");
  assert.equal((await stored()).progress.lifetime.reviews, 1);
});

test("a failed startup replay stays visible and retryable until it is committed", async () => {
  const op = review("lex:A1:about");
  browser.storage.setItem(JOURNAL_PREFIX + op.id, JSON.stringify(op));
  let fail = true;
  const reopened = tab({
    hooks: {
      afterWrites: (tx) => {
        if (fail) tx.abort();
      },
    },
  });

  await reopened.persistence.start();

  assert.equal(reopened.persistence.getStatus(), "session");
  assert.equal(reopened.persistence.pendingCount(), 1);
  assert.equal(reopened.memory().lifetime.reviews, 1, "the unsaved answer remains visible and exportable");
  assert.ok(browser.storage.getItem(JOURNAL_PREFIX + op.id), "the failed answer remains in the crash journal");
  assert.equal((await stored()).progress.lifetime.reviews, 0);

  fail = false;
  assert.equal(await reopened.persistence.retry(), true);
  assert.equal(reopened.persistence.getStatus(), "saved");
  assert.equal(reopened.persistence.pendingCount(), 0);
  assert.equal((await stored()).progress.lifetime.reviews, 1);
  assert.equal(browser.storage.getItem(JOURNAL_PREFIX + op.id), null);
});

test("a journal entry left behind after a successful commit is not counted again", async () => {
  const app = tab();
  await app.persistence.start();
  const op = review("lex:A1:about");
  app.persistence.dispatch(op);
  await settle(app);
  // A crash between commit and journal removal leaves the entry in place.
  browser.storage.setItem(JOURNAL_PREFIX + op.id, JSON.stringify(op));
  const reopened = tab();
  await reopened.persistence.start();
  assert.equal(reopened.memory().lifetime.reviews, 1);
  assert.equal(browser.storage.getItem(JOURNAL_PREFIX + op.id), null);
});

test("two tabs answering at the same time lose and duplicate nothing", async () => {
  const one = tab();
  const two = tab();
  await one.persistence.start();
  await two.persistence.start();
  const a = review("lex:A1:about");
  const b = review("lex:A1:above");
  const c = review("lex:A1:about", "again");
  one.persistence.dispatch(a);
  two.persistence.dispatch(b);
  one.persistence.dispatch(c);
  two.persistence.dispatch({ id: "goal", type: "settings", at: T0, patch: { dailyGoal: 40 } });
  await Promise.all([settle(one), settle(two)]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const db = await stored();
  assert.equal(db.progress.lifetime.reviews, 3);
  assert.equal(db.progress.reviewHistory.length, 3);
  for (const app of [one, two]) {
    assert.equal(app.memory().lifetime.reviews, 3);
    assert.equal(app.memory().dailyGoal, 40);
    assert.deepEqual(Object.keys(app.memory().cards).sort(), ["lex:A1:about", "lex:A1:above"]);
    assert.equal(app.memory().reviewHistory.length, 3);
  }
});

test("an interrupted import changes nothing; a completed one replaces everything", async () => {
  let fail = true;
  const app = tab({
    hooks: {
      afterWrites: (tx) => {
        if (fail) tx.abort();
      },
    },
  });
  fail = false;
  await app.persistence.start();
  app.persistence.dispatch(review("lex:A1:about"));
  await settle(app);
  const before = await stored();
  fail = true;
  const imported = JSON.parse(legacy({ xp: 999 })).state as SavedProgress;
  app.persistence.dispatch({ id: "import-1", type: "replace", at: T0, reason: "import", progress: imported });
  await settle(app);
  assert.deepEqual((await stored()).progress, before.progress);
  fail = false;
  await app.persistence.retry();
  const after = await stored();
  assert.equal(after.progress.xp, 999);
  assert.deepEqual(after.progress.cards, {});
});

test("an accidental grade can be undone, but not over a later answer", async () => {
  const app = tab();
  await app.persistence.start();
  const first = review("lex:A1:about", "easy");
  app.persistence.dispatch(first);
  await settle(app);
  app.persistence.dispatch({ id: "undo-1", type: "undo", at: T0 + 5000, target: first.id });
  await settle(app);
  let db = await stored();
  assert.equal(db.progress.cards["lex:A1:about"], undefined);
  assert.equal(db.progress.lifetime.reviews, 0);
  assert.equal(db.progress.xp, 0);
  assert.deepEqual(db.progress.reviewHistory, []);
  assert.deepEqual(app.memory().reviewHistory, []);

  const second = review("lex:A1:about", "good");
  const third = review("lex:A1:about", "again");
  app.persistence.dispatch(second);
  app.persistence.dispatch(third);
  app.persistence.dispatch({ id: "undo-2", type: "undo", at: T0 + 9000, target: second.id });
  await settle(app);
  db = await stored();
  assert.equal(db.progress.lifetime.reviews, 2, "the stale undo was refused");
});

test("answers saved by an older release after the migration are brought across once", async () => {
  browser.storage.setItem(LEGACY_KEY, legacy());
  const app = tab();
  await app.persistence.start();
  // An older tab keeps writing its own copy.
  const later = legacy({
    reviewHistory: [{ id: "lex:A1:about", at: T0 + DAY, grade: "good", algorithm: "legacy", elapsedDays: 0, scheduledDays: 1 }],
  });
  browser.storage.setItem(LEGACY_KEY, later);
  const reopened = tab();
  await reopened.persistence.start();
  assert.equal(reopened.memory().lifetime.reviews, 1);
  assert.ok(reopened.memory().cards["lex:A1:about"]);
  const third = tab();
  await third.persistence.start();
  assert.equal(third.memory().lifetime.reviews, 1);
});

test("invalid stored records are held for recovery instead of loaded", async () => {
  const db = await openDb(browser.idb);
  await commit(db, review("lex:A1:about"));
  const tx = db.transaction(["cards"], "readwrite");
  tx.objectStore("cards").put({ ease: "broken" }, "lex:A1:about");
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
  const app = tab();
  await app.persistence.start();
  assert.equal(app.persistence.getHeld()?.kind, "damaged");
});

test("a database written by a newer release is held as future", async () => {
  const db = await openDb(browser.idb);
  const tx = db.transaction(["meta", "profile"], "readwrite");
  tx.objectStore("meta").put(PROGRESS_VERSION + 1, "progressVersion");
  tx.objectStore("profile").put({ ...emptyMemory() }, "profile");
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
  const app = tab();
  await app.persistence.start();
  assert.equal(app.persistence.getHeld()?.kind, "future");
});

test("the session is saved with the answer and survives reopening", async () => {
  const app = tab();
  await app.persistence.start();
  const session = startReview([{ id: "lex:A1:about", isNew: false }, { id: "lex:A1:above", isNew: false }], "A1", T0);
  const op = review("lex:A1:about");
  app.persistence.dispatch({ ...op, sessionState: { ...session, queue: session.queue.slice(1), updatedAt: T0 + 1 } });
  await settle(app);
  const reopened = tab();
  await reopened.persistence.start();
  const saved = reopened.memory().sessions[session.id];
  assert.ok(saved && saved.kind === "review");
  assert.deepEqual(saved.queue.map((item) => item.id), ["lex:A1:above"]);
});

test("without a browser database, journaled answers still survive a reload", async () => {
  const app = tab({ factory: null });
  await app.persistence.start();
  assert.equal(app.persistence.getStatus(), "unavailable");
  app.persistence.dispatch(review("lex:A1:about"));
  const reopened = tab({ factory: null });
  await reopened.persistence.start();
  assert.equal(reopened.memory().lifetime.reviews, 1);
  // Once a database is available, the journal is committed exactly once.
  const later = tab();
  await later.persistence.start();
  assert.equal(later.memory().lifetime.reviews, 1);
  assert.equal((await stored()).progress.lifetime.reviews, 1);
});

test("a start that fails while writing keeps working and Retry starts again", async () => {
  browser.storage.setItem(LEGACY_KEY, legacy({ xp: 70 }));
  let fail = true;
  const app = tab({
    hooks: {
      afterWrites: (tx) => {
        if (fail) tx.abort();
      },
    },
  });
  await app.persistence.start();
  assert.equal(app.persistence.getStatus(), "session");
  assert.equal(app.memory().xp, 70);
  app.persistence.dispatch(review("lex:A1:about"));
  assert.equal(app.memory().lifetime.reviews, 1);
  fail = false;
  assert.equal(await app.persistence.retry(), true);
  assert.equal(app.persistence.getStatus(), "saved");
  const db = await stored();
  assert.equal(db.progress.xp, 70 + 10);
  assert.equal(db.progress.lifetime.reviews, 1);
});

test("progress stored by an earlier version is migrated in place and verified", async () => {
  const db = await openDb(browser.idb);
  const { goal: _goal, minutes: _minutes, ...v4 } = JSON.parse(legacy({ xp: 12 })).state;
  const tx = db.transaction(["profile", "meta", "cards"], "readwrite");
  const { cards, practiceSkills: _skills, reviewHistory: _history, ...profile } = v4;
  tx.objectStore("profile").put(profile, "profile");
  tx.objectStore("meta").put(4, "progressVersion");
  for (const [id, card] of Object.entries(cards)) tx.objectStore("cards").put(card, id);
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
  const app = tab();
  await app.persistence.start();
  assert.equal(app.persistence.getHeld(), null);
  assert.equal(app.memory().xp, 12);
  assert.equal(app.memory().goal, "general");
  assert.equal(app.memory().minutes, 10);
  const after = await openDb(browser.idb);
  const version = await new Promise((resolve) => {
    const request = after.transaction("meta").objectStore("meta").get("progressVersion");
    request.onsuccess = () => resolve(request.result);
  });
  after.close();
  assert.equal(version, PROGRESS_VERSION);
});

test("an exposure is kept as evidence and changes no progress", async () => {
  const app = tab();
  await app.persistence.start();
  const before = app.memory();
  app.persistence.dispatch({ id: "exposure-1", type: "exposure", at: T0, item: "lex:A1:about", kind: "example" });
  await settle(app);
  const db = await openDb(browser.idb);
  try {
    const event = await getEvent(db, "exposure-1");
    assert.equal(event?.exposure, "example");
    assert.equal(event?.item, "lex:A1:about");
    const after = await load(db);
    assert.deepEqual(after.progress.cards, {});
    assert.deepEqual(after.progress.lifetime, before.lifetime);
  } finally {
    db.close();
  }
});
