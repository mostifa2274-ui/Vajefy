import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";
import { releaseServer } from "./support/release-server";

/**
 * Dependability under adverse conditions (plan §15, D2–D4): a learner action
 * that appears saved must never silently disappear.
 */

// Day logs and streaks use the browser's calendar day; the seeded dates are UTC.
test.use({ timezoneId: "UTC" });

const DAY = 86_400_000;
const HISTORY = 10_000;
const CARDS = 2_000;
const DUE_NOW = 120;

async function words(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (const level of ["a1", "a2", "b1"]) {
    const entries = JSON.parse(await readFile(`public/data/lex-${level}.json`, "utf8")) as { id: string }[];
    ids.push(...entries.map((entry) => entry.id));
  }
  return ids.slice(0, count);
}

/**
 * Two years of study: 2,000 scheduled cards, 10,000 reviews and 400 days of
 * logs with a 400-day streak, saved by an older release in localStorage.
 */
async function longHistory(now: number): Promise<string> {
  const ids = await words(CARDS);
  expect(ids).toHaveLength(CARDS);
  const card = (index: number) => {
    const due = index < DUE_NOW ? now - (index + 1) * 60_000 : now + (1 + (index % 90)) * DAY;
    const last = now - (5 + (index % 60)) * DAY;
    const stability = 5 + (index % 120);
    return {
      ease: 2.5, interval: Math.round(stability), due, reps: 5, lapses: index % 4, state: "review", step: 0, last,
      fsrs: { model: "fsrs6", stability, difficulty: 3 + (index % 6), scheduledDays: Math.round(stability), learningSteps: 0, state: "review", lastReview: last },
    };
  };
  const grades = ["good", "good", "good", "hard", "again", "easy"] as const;
  const start = now - 730 * DAY;
  const reviewHistory = Array.from({ length: HISTORY }, (_, index) => ({
    id: ids[index % CARDS]!,
    at: start + Math.floor((index * 725 * DAY) / HISTORY),
    grade: grades[index % grades.length]!,
    algorithm: "fsrs6",
    elapsedDays: index % 30,
    scheduledDays: 1 + (index % 40),
    stability: 1 + (index % 50),
    difficulty: 3 + (index % 6),
  }));
  const date = (offset: number) => new Date(now - offset * DAY).toISOString().slice(0, 10);
  const logs = Array.from({ length: 400 }, (_, index) => ({
    date: date(400 - index), reviews: 25, correct: 21, practice: 0, practiceCorrect: 0, introduced: 0,
  }));
  return JSON.stringify({ version: 5, state: {
    cards: Object.fromEntries(ids.map((id, index) => [id, card(index)])),
    logs, lifetime: { reviews: HISTORY, correct: 8_400, practice: 0, practiceCorrect: 0 },
    streak: 400, lastStudyDate: date(1), xp: 0, lang: "en", focus: "A1",
    sessionSize: 20, newPerDay: 0, voice: false, accent: "en-GB", bookmarks: [],
    dailyGoal: 20, requestRetention: 0.9, reviewHistory, practiceSkills: {}, onboarded: true,
    goal: "general", minutes: 10,
  } });
}

async function ready(page: Page): Promise<number> {
  const started = Date.now();
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached", timeout: 30_000 });
  return Date.now() - started;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("D2: long-history stress", () => {
  test("two years of history migrates once, loads, reviews, reloads and exports without losing anything", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    const saved = await longHistory(Date.now());
    await page.addInitScript(({ key, saved }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, saved);
    }, { key: LEGACY_KEY, saved });

    // The first visit copies the older save into the database and proves the copy.
    await page.goto("/");
    const migration = await ready(page);
    const migrated = await readProgress(page);
    expect(Object.keys(migrated.state.cards)).toHaveLength(CARDS);
    expect(migrated.state.reviewHistory).toHaveLength(HISTORY);
    expect(migrated.state.logs).toHaveLength(400);
    expect(migrated.state.streak).toBe(400);
    // A loaded database never becomes the "session only" or "unavailable" state.
    await expect(page.getByRole("alert")).toHaveCount(0);

    // A later visit loads from the database alone.
    await page.reload();
    const load = await ready(page);
    await expect(page.getByRole("link", { name: /review/i }).first()).toBeVisible();
    test.info().annotations.push({ type: "timing", description: `migration ${migration} ms, load ${load} ms` });
    expect(load, "a long history must not make the app slow to open").toBeLessThan(5_000);

    // A review still saves, once, on top of the history.
    await page.goto("/study");
    const word = (await page.locator("main h2[lang=en]").first().innerText()).trim();
    await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
    const answered = Date.now();
    await page.getByRole("button", { name: /^Good/ }).click();
    await expect
      .poll(async () => (await readProgress(page)).events.filter((event) => event.type === "review" && event.at >= answered - 1_000).length)
      .toBe(1);
    const answerSaved = Date.now() - answered;
    expect(answerSaved, "an answer must save promptly however long the history").toBeLessThan(5_000);

    await page.reload();
    await ready(page);
    const after = await readProgress(page);
    expect(after.state.reviewHistory).toHaveLength(HISTORY + 1);
    expect(after.state.reviewHistory.at(-1).grade).toBe("good");
    expect(after.state.lifetime.reviews).toBe(HISTORY + 1);
    const id = Object.entries(after.state.cards).find(([, card]) => (card as { last?: number }).last! >= answered - 1_000)?.[0];
    expect(id, `the answered card (${word}) has a new schedule`).toBeTruthy();
    expect((after.state.cards[id!] as { due: number }).due).toBeGreaterThan(Date.now());

    // Progress renders the whole history, and a backup holds all of it.
    await page.goto("/progress");
    await expect(page.getByRole("button", { name: "Export progress", exact: true })).toBeVisible({ timeout: 10_000 });
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export progress", exact: true }).click();
    const backup = JSON.parse(await readFile((await (await pending).path())!, "utf8"));
    expect(Object.keys(backup.progress.cards)).toHaveLength(CARDS);
    expect(backup.progress.reviewHistory).toHaveLength(HISTORY + 1);
    // Day logs are a rolling window; the reviews above are the permanent record.
    const today = new Date().toISOString().slice(0, 10);
    expect(backup.progress.logs.length).toBeGreaterThanOrEqual(60);
    expect(backup.progress.logs.find((log: { date: string }) => log.date === today)?.reviews).toBe(1);
    expect(backup.progress.streak).toBe(401);

    expect(errors).toEqual([]);
  });
});

/** An English learner with three review cards due now. */
async function seedDue(page: Page) {
  await page.addInitScript(({ key, day }) => {
    if (localStorage.getItem(key)) return;
    const now = Date.now();
    const card = {
      ease: 2.5, interval: 15, due: now - 60_000, reps: 5, lapses: 0, state: "review", step: 0, last: now - 15 * day,
      fsrs: { model: "fsrs6", stability: 15, difficulty: 5, scheduledDays: 15, learningSteps: 0, state: "review", lastReview: now - 15 * day },
    };
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: Object.fromEntries(["lex:A1:about", "lex:A1:above", "lex:A1:across"].map((id) => [id, card])),
      logs: [], lifetime: { reviews: 20, correct: 18, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus: "A1",
      sessionSize: 20, newPerDay: 0, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes: 5,
    } }));
  }, { key: LEGACY_KEY, day: DAY });
}

test.describe("D3: low storage", () => {
  test("when the browser refuses persistent storage, answers still save and nothing claims they are protected", async ({ page }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      const calls = { persist: 0 };
      (window as Window & { persistCalls?: typeof calls }).persistCalls = calls;
      Object.defineProperty(navigator.storage, "persist", {
        configurable: true,
        value: async () => {
          calls.persist += 1;
          return false;
        },
      });
      Object.defineProperty(navigator.storage, "persisted", { configurable: true, value: async () => false });
    });
    await seedDue(page);
    await page.goto("/study");
    await ready(page);
    await expect.poll(() => page.evaluate(() => (window as Window & { persistCalls?: { persist: number } }).persistCalls?.persist ?? 0)).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
    await page.getByRole("button", { name: /^Good/ }).click();
    await expect.poll(async () => (await readProgress(page)).events.filter((event) => event.type === "review").length).toBe(1);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Progress says plainly where the answers live and how to keep them.
    await page.goto("/progress");
    await expect(page.getByText("Progress is saved only in this browser. Export a backup to keep it or move it to another device.", { exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/protected|permanent|never be (lost|deleted)|backed up automatically/i);
    await page.reload();
    expect((await readProgress(page)).state.lifetime.reviews).toBe(21);
    expect(errors).toEqual([]);
  });

  test("an interrupted pronunciation download never counts as installed, and a retry fetches only what is missing", async ({ page, context }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await seedDue(page);
    const manifest = JSON.parse(await readFile("public/data/enhanced/audio-pack.json", "utf8")) as {
      units: { id: string; gb: { version: string; files: { file: string }[] } }[];
    };
    const unit = manifest.units[0]!;
    const files = unit.gb.files.map((file) => file.file);
    // Every fifth clip fails, as if the connection dropped or storage ran out.
    const lost = new Set(files.filter((_, index) => index % 5 === 2));
    const requested: string[] = [];
    let interrupted = true;
    await context.route("**/audio/**", async (route) => {
      const file = new URL(route.request().url()).pathname.replace(/^\/audio\//, "");
      requested.push(file);
      if (interrupted && lost.has(file)) await route.abort("connectionreset");
      else await route.continue();
    });

    await page.goto("/progress");
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Unit 1 is the first row.
    const row = page.locator("div.py-3").first();
    await row.getByRole("button", { name: /^Download · / }).click();
    await expect(row.getByRole("alert")).toHaveText("Some files could not be downloaded. Try again.", { timeout: 60_000 });
    await expect(row.getByText(/✓ Downloaded/)).toHaveCount(0);
    await expect(row.getByRole("status")).toHaveText(`${files.length - lost.size} / ${files.length}`);

    const cacheName = `vajefy-audio-unit-v2:${unit.id}:gb:${unit.gb.version}`;
    const partial = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      return { marker: Boolean(await cache.match("/__vajefy_audio_pack_complete__")), entries: (await cache.keys()).length };
    }, cacheName);
    expect(partial).toEqual({ marker: false, entries: files.length - lost.size });

    // A reload keeps the partial download resumable and still incomplete.
    await page.reload();
    await ready(page);
    await expect(row.getByText(/✓ Downloaded/)).toHaveCount(0);
    await expect(row.getByRole("status")).toHaveText(`${files.length - lost.size} / ${files.length}`);

    interrupted = false;
    requested.length = 0;
    await row.getByRole("button", { name: /^Download · / }).click();
    await expect(row.getByText(/✓ Downloaded/)).toBeVisible({ timeout: 60_000 });
    expect(new Set(requested)).toEqual(lost);
    const complete = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      return { marker: Boolean(await cache.match("/__vajefy_audio_pack_complete__")), entries: (await cache.keys()).length };
    }, cacheName);
    expect(complete).toEqual({ marker: true, entries: files.length + 1 });
    expect(errors).toEqual([]);
  });

  test("a failed update download leaves the installed release complete and working offline", async ({ browser }) => {
    const server = await releaseServer();
    const context = await browser.newContext({ serviceWorkers: "allow" });
    const page = await context.newPage();
    const releases = () => page.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith("vajefy-offline-")).sort());
    try {
      await page.goto(server.origin);
      await page.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await expect.poll(releases).toEqual(["vajefy-offline-a"]);

      // Release b cannot deliver one of its files: its worker must fail to
      // install and leave nothing half-written behind.
      server.serve("b", { broken: true });
      const outcome = await page.evaluate(async () => {
        const registration = (await navigator.serviceWorker.getRegistration())!;
        await registration.update();
        const worker = registration.installing ?? registration.waiting;
        if (!worker) return "no update";
        if (worker.state === "redundant" || worker.state === "installed") return worker.state;
        return new Promise<string>((resolve) => {
          worker.addEventListener("statechange", () => {
            if (worker.state === "redundant" || worker.state === "installed") resolve(worker.state);
          });
        });
      });
      expect(outcome).toBe("redundant");
      expect(await releases()).toEqual(["vajefy-offline-a"]);
      expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);

      // The installed release still opens offline, complete.
      await context.setOffline(true);
      await page.reload();
      await expect(page.locator("body")).toHaveText("a");
      expect(await page.evaluate(() => fetch("/assets/a.js").then((response) => response.text()))).toBe("asset-a");
      await context.setOffline(false);

      // Once the release can be delivered, the update installs and waits as usual.
      server.serve("b");
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
      await expect.poll(releases).toEqual(["vajefy-offline-a", "vajefy-offline-b"]);
      await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
    } finally {
      await context.close();
      await server.close();
    }
  });
});

const DUE = ["lex:A1:about", "lex:A1:above", "lex:A1:across"];
type CrashWindow = Window & { crashInCards?: boolean; crashed?: boolean };

/** Make the next card write abort its whole transaction, as a crash mid-commit would. */
async function crashableCardWrites(page: Page) {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      const target = window as CrashWindow;
      if (target.crashInCards && this.name === "cards" && this.transaction.db.name === "vajefy") {
        target.crashInCards = false;
        target.crashed = true;
        throw new DOMException("Simulated crash during the schedule update", "AbortError");
      }
      return original.apply(this, args);
    };
  });
}

async function currentWord(page: Page) {
  return (await page.locator("main h2[lang=en]").first().innerText()).trim();
}

async function answer(page: Page) {
  await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
}

async function answered(page: Page) {
  return (await readProgress(page)).events.filter((event) => event.type === "review" && !event.undone);
}

/**
 * Reloaded state is coherent: every answer is recorded exactly once, each
 * answered card carries that answer's schedule, unanswered cards are as they
 * were, the counters agree and no operation is left waiting in the journal.
 */
async function expectCoherent(page: Page, count: number) {
  const progress = await readProgress(page);
  const reviews = progress.events.filter((event) => event.type === "review" && !event.undone);
  expect(reviews, "each answer is recorded once").toHaveLength(count);
  expect(new Set(reviews.map((event) => event.id)).size).toBe(count);
  expect(new Set(reviews.map((event) => event.item)).size, "no answer is duplicated").toBe(count);
  expect(progress.state.reviewHistory).toHaveLength(count);
  expect(progress.state.lifetime.reviews).toBe(20 + count);
  for (const id of DUE) {
    const card = progress.state.cards[id] as { last: number; due: number };
    const review = reviews.find((event) => event.item === id);
    if (review) {
      expect(card.last, `${id} carries its answer's schedule`).toBe(review.at);
      expect(card.due).toBeGreaterThan(review.at);
    } else {
      expect(card.due, `${id} is still due`).toBeLessThan(Date.now());
    }
  }
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("vajefy-op:")).length)).toBe(0);
}

type Interruption = {
  at: string;
  /** Act in the tab, then return the number of answers that must survive. */
  act: (page: Page) => Promise<number>;
  /** After reopening, the review resumes at the word after this many answers. */
  resumesAfter: number | "finished";
};

const MATRIX: Interruption[] = [
  {
    at: "before answer",
    act: async (page) => {
      await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
      return 0;
    },
    resumesAfter: 0,
  },
  {
    at: "during answer",
    act: async (page) => {
      await answer(page);
      return 1;
    },
    resumesAfter: 1,
  },
  {
    at: "after answer, before the next item",
    act: async (page) => {
      await answer(page);
      await expect.poll(async () => (await answered(page)).length).toBe(1);
      return 1;
    },
    resumesAfter: 1,
  },
  {
    at: "during schedule update",
    act: async (page) => {
      await page.evaluate(() => {
        (window as CrashWindow).crashInCards = true;
      });
      await answer(page);
      await expect.poll(() => page.evaluate(() => (window as CrashWindow).crashed === true)).toBe(true);
      // The aborted transaction wrote nothing: no event without its card.
      expect(await answered(page)).toHaveLength(0);
      return 1;
    },
    resumesAfter: 1,
  },
  {
    at: "during lesson completion",
    act: async (page) => {
      for (let index = 1; index <= 2; index++) {
        await answer(page);
        await expect.poll(async () => (await answered(page)).length).toBe(index);
      }
      await answer(page);
      return 3;
    },
    resumesAfter: "finished",
  },
];

test.describe("D4: crash and reload matrix", () => {
  for (const interruption of MATRIX) {
    test(`a tab killed ${interruption.at} reopens coherent`, async ({ context }) => {
      const page = await context.newPage();
      const errors = watchErrors(page);
      await seedDue(page);
      await crashableCardWrites(page);
      await page.goto("/study");
      await ready(page);
      const order = [await currentWord(page)];
      const survive = await interruption.act(page);
      await page.close({ runBeforeUnload: false });

      const reopened = await context.newPage();
      const reopenedErrors = watchErrors(reopened);
      await reopened.goto("/study");
      await ready(reopened);
      await expect.poll(async () => (await answered(reopened)).length).toBe(survive);
      await expectCoherent(reopened, survive);

      if (interruption.resumesAfter === "finished") {
        await expect(reopened.getByText("Picking up where you left off.", { exact: true })).toHaveCount(0);
        await expect(reopened.locator("main h2[lang=en]")).toHaveCount(0);
        await reopened.goto("/");
        await ready(reopened);
        await expect(reopened.getByRole("link", { name: /Continue your review/ })).toHaveCount(0);
      } else {
        const word = await currentWord(reopened);
        if (interruption.resumesAfter === 0) expect(word).toBe(order[0]);
        else expect(word).not.toBe(order[0]);
        const answeredItems = (await answered(reopened)).map((event) => event.item);
        expect(answeredItems).not.toContain(`lex:A1:${word}`);
      }

      // A second reload changes nothing.
      await reopened.reload();
      await ready(reopened);
      await expectCoherent(reopened, survive);
      expect([...errors, ...reopenedErrors]).toEqual([]);
    });
  }
});
