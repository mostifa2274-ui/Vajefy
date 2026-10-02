import assert from "node:assert/strict";
import test from "node:test";
import { makeBackup } from "./backup";
import { PROGRESS_VERSION } from "./progress";
import { progressStorage } from "./storage";
import { useProgress } from "./store";

// A browser stand-in for the real store and its real persistence path. Each
// test file runs in its own process, so this global is not shared.
const browser = { value: null as string | null, writes: 0 };
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: () => browser.value,
      setItem: (_key: string, value: string) => {
        browser.writes += 1;
        browser.value = value;
      },
      removeItem: () => {
        browser.value = null;
      },
    },
  },
});

async function startApp(raw: string | null) {
  browser.value = raw;
  browser.writes = 0;
  await useProgress.persist.rehydrate();
  // The shell marks hydration, which is itself a store write.
  useProgress.getState().setHydrated();
}

function study() {
  const state = useProgress.getState();
  state.setLang("en");
  state.completeOnboarding("B1", 40);
  state.review("lex:A1:about", "good");
  state.practice("lex:A1:above", "again", "spelling");
  state.toggleBookmark("lex:A1:act");
}

const healthy = JSON.stringify({
  state: JSON.parse(makeBackup({ ...useProgress.getState(), xp: 77, onboarded: true })).progress,
  version: PROGRESS_VERSION,
});

test("an unreadable save survives startup and every later write untouched", async () => {
  const raw = '{"state":{"cards":{"lex:A1:about":';
  await startApp(raw);
  study();
  assert.equal(browser.value, raw);
  assert.equal(browser.writes, 0);
  assert.equal(progressStorage.getStatus(), "damaged");
  assert.deepEqual(progressStorage.getHeld(), { kind: "damaged", raw });
  assert.equal(progressStorage.retry(), false);
});

test("an explicit start over replaces the held save once released", async () => {
  progressStorage.release();
  useProgress.getState().startOver();
  assert.equal(progressStorage.getStatus(), "saved");
  const written = JSON.parse(browser.value!);
  assert.equal(written.version, PROGRESS_VERSION);
  assert.deepEqual(written.state.cards, {});
  assert.equal(written.state.onboarded, false);
  assert.equal(written.state.lang, "en");
});

test("a save from a newer version is neither downgraded nor replaced", async () => {
  const raw = JSON.stringify({ state: { cards: {}, futureField: 1 }, version: PROGRESS_VERSION + 1 });
  await startApp(raw);
  study();
  assert.equal(browser.value, raw);
  assert.equal(progressStorage.getStatus(), "future");
});

test("an invalid field holds the save instead of writing it back", async () => {
  const raw = healthy.replace('"logs":[]', '"logs":"oops"');
  assert.notEqual(raw, healthy);
  await startApp(raw);
  assert.notEqual(useProgress.getState().xp, 77);
  study();
  assert.equal(browser.value, raw);
  assert.equal(progressStorage.getStatus(), "damaged");
});

test("a valid save loads, clears an earlier hold and keeps saving answers", async () => {
  await startApp(healthy);
  assert.equal(progressStorage.getStatus(), "saved");
  assert.equal(progressStorage.getHeld(), null);
  assert.equal(useProgress.getState().xp, 77);
  useProgress.getState().review("lex:A1:about", "good");
  const written = JSON.parse(browser.value!);
  assert.equal(written.state.lifetime.reviews, 1);
  assert.ok(written.state.cards["lex:A1:about"]);
});
