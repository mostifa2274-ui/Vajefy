import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { sqliteD1 } from "../../api/d1-sqlite";
import { handleSync } from "../../api/sync";
import type { Op } from "./ops";
import { createPersistence, emptyMemory, type Memory } from "./persistence";
import { createSync, type Sync } from "./sync";

/** A Storage stand-in. */
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
  clear() {
    this.map.clear();
  }
}

const T0 = new Date(2026, 9, 2, 9).getTime();
let clock = T0;
let online = true;
let server: D1DatabaseLike;

beforeEach(() => {
  clock = T0;
  online = true;
  server = sqliteD1();
  // The journal reads the page's localStorage; devices settle before another acts.
  Object.assign(globalThis, { window: { localStorage: new MemoryStorage() } });
});

const serverFetch: typeof fetch = async (input, init) => {
  if (!online) throw new TypeError("Failed to fetch");
  return handleSync(new Request(new URL(String(input), "https://vajefy.test"), init as RequestInit), server, clock);
};

type Device = { memory: () => Memory; persistence: ReturnType<typeof createPersistence>; sync: Sync; settle: () => Promise<void>; idb: IDBFactory; storage: MemoryStorage };

/** A device, or the same device reopened when given its browser storage. */
async function device(browser: { idb?: IDBFactory; storage?: MemoryStorage } = {}): Promise<Device> {
  let memory: Memory = emptyMemory();
  const idb = browser.idb ?? new IDBFactory();
  const storage = browser.storage ?? new MemoryStorage();
  const persistence = createPersistence({
    read: () => memory,
    write: (patch) => {
      memory = { ...memory, ...patch };
    },
    hydrated: () => undefined,
    idb: () => idb,
    localStorage: () => storage,
    now: () => clock,
  });
  const sync = createSync({ persistence, memory: () => memory, storage: () => storage as unknown as Storage, idb: () => idb, fetch: serverFetch, now: () => clock });
  // As the app does: a stored pairing is taken up before progress loads.
  await sync.prepare();
  await persistence.start();
  // Done when every write is committed and handed to sync, so nothing of this
  // device is left in the journal the next device would read.
  const journal = () => [...(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.map.keys()].filter((key) => key.startsWith("vajefy-op:"));
  const settle = async () => {
    for (let i = 0; i < 200 && (i < 3 || persistence.pendingCount() > 0 || journal().length > 0); i++) {
      await persistence.retry();
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  };
  return { memory: () => memory, persistence, sync, settle, idb, storage };
}

const journal = () => (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage;

let seq = 0;
function review(item: string, grade: "again" | "good" = "good"): Op {
  seq += 1;
  clock += 60_000;
  return { id: `op-${seq}-${item.replace(/\W/g, "")}`, type: "review", at: clock, item, grade };
}

async function answer(on: Device, op: Op) {
  on.persistence.dispatch(op);
  await on.settle();
}

async function syncBoth(...devices: Device[]) {
  for (const each of devices) {
    await each.sync.sync();
    await each.settle();
  }
}

test("a second device adopts the first device's progress and both keep every answer, counted once", async () => {
  const phone = await device();
  await answer(phone, review("lex:A1:about"));
  const code = await phone.sync.create();
  await phone.settle();
  await answer(phone, review("lex:A1:above"));
  await syncBoth(phone);

  const tablet = await device();
  assert.equal(await tablet.sync.join(code.toLowerCase().replace(/-/g, " ")), "joined", "the code is forgiving to type");
  await tablet.settle();
  assert.equal(tablet.memory().lifetime.reviews, 2);
  assert.deepEqual(Object.keys(tablet.memory().cards).sort(), ["lex:A1:about", "lex:A1:above"]);

  await answer(tablet, review("lex:A1:across"));
  await syncBoth(tablet, phone);
  assert.equal(phone.memory().lifetime.reviews, 3, "the phone gets the tablet's answer");
  assert.equal(phone.memory().reviewHistory.length, 3);
  // The phone's own snapshot came back down and was not re-applied over later answers.
  assert.ok(phone.memory().cards["lex:A1:above"]);

  // Uploading the same answer again changes nothing anywhere.
  const repeat = phone.memory().reviewHistory.length;
  await syncBoth(phone, tablet, phone);
  assert.equal(phone.memory().reviewHistory.length, repeat);
  assert.equal(tablet.memory().lifetime.reviews, 3);
  assert.equal(phone.sync.status().pending, 0);
  assert.equal(phone.sync.status().state, "idle");
});

test("the server stores only opaque ids and encrypted data", async () => {
  const phone = await device();
  await answer(phone, review("lex:A1:about"));
  await phone.sync.create();
  await phone.settle();
  await answer(phone, review("lex:A1:above"));
  await syncBoth(phone);
  const { results } = await server.prepare("SELECT op_id, iv, data FROM sync_ops").all<{ op_id: string; iv: string; data: string }>();
  assert.equal(results.length, 2);
  for (const row of results) {
    assert.match(row.op_id, /^[0-9a-f]{32}$/);
    assert.doesNotMatch(Buffer.from(row.data, "base64").toString("latin1"), /lex:A1|review|above/);
  }
});

test("answers made offline are uploaded later", async () => {
  const phone = await device();
  const code = await phone.sync.create();
  const tablet = await device();
  await tablet.sync.join(code);
  await tablet.settle();

  online = false;
  await answer(phone, review("lex:A1:about"));
  await phone.sync.sync();
  assert.equal(phone.sync.status().state, "offline");
  assert.equal(phone.sync.status().pending, 1);
  online = true;
  await syncBoth(phone, tablet);
  assert.equal(phone.sync.status().pending, 0);
  assert.equal(tablet.memory().lifetime.reviews, 1);
});

test("clearing progress on one device cannot be undone by an older device", async () => {
  const phone = await device();
  await answer(phone, review("lex:A1:about"));
  const code = await phone.sync.create();
  await phone.settle();
  const tablet = await device();
  await tablet.sync.join(code);
  await tablet.settle();
  assert.equal(tablet.memory().lifetime.reviews, 1);

  // The tablet answers while offline, before it hears of the reset.
  online = false;
  await answer(tablet, review("lex:A1:above"));
  online = true;
  clock += 60_000;
  await answer(phone, { id: "reset-1", type: "reset", at: clock });
  await syncBoth(phone, tablet);

  assert.equal(phone.memory().lifetime.reviews, 0, "the reset stands on the phone");
  assert.equal(tablet.memory().lifetime.reviews, 0, "and reaches the tablet");
  assert.deepEqual(tablet.memory().cards, {});
  assert.equal(tablet.sync.status().dropped, 1, "the tablet's earlier answer was not synced, and it says so");
  // New answers after the reset sync normally.
  await answer(tablet, review("lex:A1:across"));
  await syncBoth(tablet, phone);
  assert.equal(phone.memory().lifetime.reviews, 1);
});

test("an answer saved just before the page closed, but not yet queued, is uploaded after reopening", async () => {
  const phone = await device();
  const code = await phone.sync.create();
  await phone.settle();
  // Committed, and still in the crash journal because the page closed before
  // sync took it.
  const late = review("lex:A1:about");
  phone.persistence.setAfterCommit(null);
  await answer(phone, late);
  journal().setItem(`vajefy-op:${late.id}`, JSON.stringify(late));
  const reopened = await device({ idb: phone.idb, storage: phone.storage });
  await reopened.settle();
  await reopened.sync.sync();
  const tablet = await device();
  await tablet.sync.join(code);
  await tablet.settle();
  assert.equal(tablet.memory().lifetime.reviews, 1);
  assert.equal(reopened.memory().lifetime.reviews, 1, "and it still counts once where it was made");
});

test("an answer the server will never accept, after a reset elsewhere, is dropped instead of blocking sync", async () => {
  const phone = await device();
  const code = await phone.sync.create();
  await phone.settle();
  const tablet = await device();
  await tablet.sync.join(code);
  await tablet.settle();
  online = false;
  await answer(tablet, review("lex:A1:about"));
  online = true;
  clock += 60_000;
  await answer(phone, { id: "reset-2", type: "reset", at: clock });
  await syncBoth(phone);
  // Another tab on the tablet already took the reset down.
  const stored = JSON.parse(tablet.storage.getItem("vajefy-sync")!);
  tablet.storage.setItem("vajefy-sync", JSON.stringify({ ...stored, cursor: 1_000 }));
  await tablet.sync.storageChanged();
  await tablet.sync.sync();
  assert.equal(tablet.sync.status().state, "idle");
  assert.equal(tablet.sync.status().pending, 0);
  assert.equal(tablet.sync.status().dropped, 1);
  await answer(tablet, review("lex:A1:above"));
  await syncBoth(tablet, phone);
  assert.equal(phone.memory().lifetime.reviews, 1, "answers after the reset sync normally");
});

test("joining with progress on both sides asks which to keep", async () => {
  const phone = await device();
  await answer(phone, review("lex:A1:about"));
  const code = await phone.sync.create();
  await phone.settle();
  const tablet = await device();
  await answer(tablet, review("lex:A1:above"));
  await answer(tablet, review("lex:A1:across"));
  assert.equal(await tablet.sync.join(code), "needs-choice");
  assert.equal(tablet.sync.status().state, "off", "nothing is synced until the learner chooses");
  await tablet.sync.choose("this-device");
  await tablet.settle();
  await syncBoth(phone);
  assert.equal(phone.memory().lifetime.reviews, 2, "the tablet's progress replaced the synced copy");
  assert.equal(await tablet.sync.join("not a code"), "invalid");
});

test("deleting the synced copy leaves each device's own progress and stops sync everywhere", async () => {
  const phone = await device();
  await answer(phone, review("lex:A1:about"));
  const code = await phone.sync.create();
  await phone.settle();
  const tablet = await device();
  await tablet.sync.join(code);
  await tablet.settle();
  assert.equal(await phone.sync.deleteSynced(), true);
  assert.equal(phone.sync.status().state, "off");
  assert.equal(phone.memory().lifetime.reviews, 1);

  await answer(tablet, review("lex:A1:above"));
  await tablet.sync.sync();
  assert.equal(tablet.sync.status().state, "off");
  assert.equal(tablet.sync.status().ended, true, "the tablet says why it stopped");
  assert.equal(tablet.memory().lifetime.reviews, 2);
  const { results } = await server.prepare("SELECT COUNT(*) AS n FROM sync_ops").all<{ n: number }>();
  assert.equal(results[0]!.n, 0, "and does not start the deleted copy again");
  assert.equal(await device().then((laptop) => laptop.sync.join(code)), "deleted");
});
