import assert from "node:assert/strict";
import { test } from "node:test";
import { createProgressStorage, PROGRESS_STORAGE_KEY as KEY } from "./storage";

function fixture(initial: string | null = "older save") {
  const control = { value: initial, denyRead: false, denyWrite: false, denyAccess: false };
  const browser = {
    getItem: () => {
      if (control.denyRead) throw new Error("Storage is blocked");
      return control.value;
    },
    setItem: (_key: string, value: string) => {
      if (control.denyWrite) throw new Error("Quota exceeded");
      control.value = value;
    },
    removeItem: () => {
      if (control.denyWrite) throw new Error("Quota exceeded");
      control.value = null;
    },
  };
  const storage = createProgressStorage(() => {
    if (control.denyAccess) throw new Error("Storage access denied");
    return browser;
  });
  return { control, storage };
}

test("failed writes stay newer than the durable copy and retry saves the latest session", () => {
  const { control, storage } = fixture();
  assert.equal(storage.getItem(KEY), "older save");
  const notices: string[] = [];
  const unsubscribe = storage.subscribe(() => notices.push(storage.getStatus()));
  control.denyWrite = true;
  storage.setItem(KEY, "first unsaved answer");
  storage.setItem(KEY, "latest unsaved answer");
  assert.equal(storage.getItem(KEY), "latest unsaved answer");
  assert.equal(control.value, "older save");
  assert.equal(storage.getStatus(), "session");
  assert.equal(storage.retry(), false);
  control.denyWrite = false;
  assert.equal(storage.retry(), true);
  assert.equal(control.value, "latest unsaved answer");
  assert.equal(storage.getStatus(), "saved");
  assert.deepEqual(notices, ["session", "saved"]);
  unsubscribe();
  control.denyWrite = true;
  storage.setItem(KEY, "next answer");
  assert.deepEqual(notices, ["session", "saved"]);
});

test("a failed delete does not resurrect the old save during session hydration", () => {
  const { control, storage } = fixture();
  storage.getItem(KEY);
  control.denyWrite = true;
  storage.removeItem(KEY);
  assert.equal(storage.getItem(KEY), null);
  assert.equal(control.value, "older save");
  control.denyWrite = false;
  assert.equal(storage.retry(), true);
  assert.equal(control.value, null);
});

test("blocked storage access keeps session changes and can recover on an empty browser", () => {
  const { control, storage } = fixture(null);
  control.denyAccess = true;
  assert.equal(storage.getItem(KEY), null);
  assert.equal(storage.getStatus(), "session");
  storage.setItem(KEY, "new learner's session");
  assert.equal(storage.getItem(KEY), "new learner's session");
  control.denyAccess = false;
  assert.equal(storage.retry(), true);
  assert.equal(control.value, "new learner's session");
});

test("a save that could not be read is never blindly replaced when access returns", () => {
  const { control, storage } = fixture();
  control.denyRead = true;
  storage.getItem(KEY);
  storage.setItem(KEY, "session started while reading was blocked");
  control.denyRead = false;
  assert.equal(storage.retry(), false);
  assert.equal(storage.getStatus(), "conflict");
  assert.equal(control.value, "older save");
  assert.equal(storage.getItem(KEY), "session started while reading was blocked");
});

test("cross-tab updates cannot discard or overwrite a failed local save", () => {
  const { control, storage } = fixture();
  storage.getItem(KEY);
  control.denyWrite = true;
  storage.setItem(KEY, "my unsaved answer");
  control.value = "other tab's answer";
  assert.equal(storage.shouldRehydrate(), false);
  assert.equal(storage.getStatus(), "conflict");
  assert.equal(storage.getItem(KEY), "my unsaved answer");
  control.denyWrite = false;
  storage.setItem(KEY, "my next unsaved answer");
  assert.equal(storage.retry(), false);
  assert.equal(control.value, "other tab's answer");
  assert.equal(storage.getItem(KEY), "my next unsaved answer");
});

test("a stale write detects another tab even before its storage event is delivered", () => {
  const { control, storage } = fixture();
  storage.getItem(KEY);
  control.value = "other tab's newer answer";
  storage.setItem(KEY, "answer based on old state");
  assert.equal(storage.getStatus(), "conflict");
  assert.equal(control.value, "other tab's newer answer");
  assert.equal(storage.getItem(KEY), "answer based on old state");
});

test("healthy cross-tab changes continue to load normally", () => {
  const { control, storage } = fixture();
  storage.getItem(KEY);
  storage.setItem(KEY, "saved answer");
  control.value = "other tab's saved answer";
  assert.equal(storage.shouldRehydrate(), true);
  assert.equal(storage.getItem(KEY), "other tab's saved answer");
  assert.equal(storage.getStatus(), "saved");
});

test("server rendering has no durable-save claim or storage side effect", () => {
  const storage = createProgressStorage(() => undefined);
  assert.equal(storage.getItem(KEY), null);
  storage.setItem(KEY, "server memory");
  assert.equal(storage.getItem(KEY), "server memory");
  assert.equal(storage.retry(), false);
  assert.equal(storage.getStatus(), "checking");
});

test("a held save refuses every write, retry and delete until released", () => {
  const { control, storage } = fixture("unreadable save");
  assert.equal(storage.getItem(KEY), "unreadable save");
  storage.hold({ kind: "damaged", raw: "unreadable save" });
  assert.equal(storage.getStatus(), "damaged");
  storage.setItem(KEY, "empty progress");
  storage.removeItem(KEY);
  assert.equal(storage.retry(), false);
  assert.equal(control.value, "unreadable save");
  assert.equal(storage.getStatus(), "damaged");
  // A placeholder write must not later surface as unsaved session work.
  assert.equal(storage.shouldRehydrate(), true);
  storage.release();
  storage.setItem(KEY, "chosen replacement");
  assert.equal(control.value, "chosen replacement");
  assert.equal(storage.getStatus(), "saved");
});

test("a released hold still cannot replace a copy another tab changed", () => {
  const { control, storage } = fixture("newer save");
  storage.getItem(KEY);
  storage.hold({ kind: "future", raw: "newer save", version: 9 });
  control.value = "another tab's save";
  storage.release();
  storage.setItem(KEY, "chosen replacement");
  assert.equal(control.value, "another tab's save");
  assert.equal(storage.getStatus(), "conflict");
});

test("reading a fresh copy clears an earlier hold", () => {
  const { control, storage } = fixture("unreadable save");
  storage.getItem(KEY);
  storage.hold({ kind: "damaged", raw: "unreadable save" });
  control.value = "repaired in another tab";
  assert.equal(storage.getItem(KEY), "repaired in another tab");
  assert.equal(storage.getHeld(), null);
  assert.equal(storage.getStatus(), "saved");
});

test("a different held copy notifies even when the status is unchanged", () => {
  const { storage } = fixture("first damaged copy");
  storage.getItem(KEY);
  storage.hold({ kind: "damaged", raw: "first damaged copy" });
  let notices = 0;
  storage.subscribe(() => (notices += 1));
  const second = { kind: "damaged" as const, raw: "second damaged copy" };
  storage.hold(second);
  assert.equal(notices, 1);
  assert.equal(storage.getHeld(), second);
});
