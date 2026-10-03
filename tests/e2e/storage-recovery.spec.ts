import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";

const ID = "lex:A1:about";
type ControlledWindow = Window & { denyProgressWrites: boolean };

async function seed(page: Page) {
  await page.addInitScript(({ key, id }) => {
    if (localStorage.getItem(key)) return;
    const now = Date.now();
    const day = 86_400_000;
    localStorage.setItem(key, JSON.stringify({ version: 4, state: {
      cards: { [id]: {
        ease: 2.5, interval: 15, due: now + 10 * day, reps: 5, lapses: 4,
        state: "review", step: 0, last: now - 5 * day,
        fsrs: { model: "fsrs6", stability: 15, difficulty: 7, scheduledDays: 15,
          learningSteps: 0, state: "review", lastReview: now - 5 * day },
      } },
      logs: [], lifetime: { reviews: 4, correct: 3, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 40, lang: "en", focus: "A1",
      sessionSize: 20, newPerDay: 10, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
    } }));
  }, { key: LEGACY_KEY, id: ID });
}

/** Make every write to the progress database fail as if storage were full. */
async function controlWrites(page: Page) {
  await page.addInitScript(() => {
    (window as ControlledWindow).denyProgressWrites = false;
    for (const method of ["put", "add", "delete", "clear"] as const) {
      const original = IDBObjectStore.prototype[method] as (...args: unknown[]) => IDBRequest;
      Object.defineProperty(IDBObjectStore.prototype, method, {
        configurable: true,
        value(this: IDBObjectStore, ...args: unknown[]) {
          if ((window as ControlledWindow).denyProgressWrites && this.transaction.db.name === "vajefy") {
            throw new DOMException("Simulated browser quota", "QuotaExceededError");
          }
          return original.apply(this, args);
        },
      });
    }
  });
}

function journal(page: Page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("vajefy-op:")).length);
}

async function backup(page: Page, button: Locator) {
  const pending = page.waitForEvent("download");
  await button.click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

async function accessible(page: Page) {
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

function goal(page: Page, value: string) {
  return page.getByText("Reviews a day", { exact: true }).locator("..").getByRole("button", { name: value, exact: true });
}

test("failed database writes keep answers in the session, export them, and retry saves them once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await controlWrites(page);
  await page.goto("/drill?play=smart");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const before = await readProgress(page);
  await page.evaluate(() => {
    (window as ControlledWindow).denyProgressWrites = true;
  });
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("about");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const notice = page.getByRole("alert");
  await expect(notice).toContainText("Progress could not be saved");
  await expect(notice).toContainText("before closing or reloading");
  expect((await readProgress(page)).state).toEqual(before.state);
  expect(await journal(page)).toBe(1);
  const exported = await backup(page, notice.getByRole("button", { name: "Export progress", exact: true }));
  expect(exported.version).toBe(5);
  expect(exported.progress.lifetime).toEqual({ reviews: 4, correct: 3, practice: 1, practiceCorrect: 1 });
  expect(exported.progress.practiceSkills[ID].spelling.attempts).toBe(1);
  expect(exported.progress.cards).toEqual(before.state.cards);
  await accessible(page);

  await notice.getByRole("button", { name: "Retry saving", exact: true }).click();
  // The retry has finished, and failed, before writes are allowed again.
  await expect(notice.getByRole("status")).toHaveText("Still not saved. Free some browser storage, then try again.");
  await expect(notice.getByRole("button", { name: "Retry saving", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    (window as ControlledWindow).denyProgressWrites = false;
  });
  await notice.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await expect.poll(async () => (await readProgress(page)).state.lifetime.practice).toBe(1);
  expect(await journal(page)).toBe(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Practice", exact: true })).toBeVisible();
  const after = await readProgress(page);
  expect(after.state.lifetime).toEqual({ reviews: 4, correct: 3, practice: 1, practiceCorrect: 1 });
  expect(after.events.filter((event) => event.type === "practice")).toHaveLength(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a browser without its database warns in Persian, keeps answers across reloads, and exports them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toBeVisible();
  const notice = page.getByRole("alert");
  await expect(notice).toContainText("این مرورگر پیشرفت را ذخیره نمی‌کند");
  await expect(notice.getByRole("button", { name: "تلاش دوباره برای ذخیره", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  const exported = await backup(page, notice.getByRole("button", { name: "دریافت فایل پشتیبان", exact: true }));
  expect(exported.progress.onboarded).toBe(true);
  expect(exported.progress.lang).toBe("fa");
  await accessible(page);
  // The journal still carries the choice across a reload.
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("این مرورگر پیشرفت را ذخیره نمی‌کند");
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toHaveCount(0);
});

test("blocked localStorage does not stop the database from saving", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(async () => (await readProgress(page)).state?.onboarded).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toHaveCount(0);
});

test("two tabs changing progress at once both keep every change", async ({ page, context }) => {
  await seed(page);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/progress");
  await expect(other.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  await goal(page, "40").click();
  await other.getByRole("button", { name: "American", exact: true }).click();
  // Each tab shows the other's change without reloading.
  await expect(goal(other, "40")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "American", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => {
    const { state } = await readProgress(page);
    return [state.dailyGoal, state.accent];
  }).toEqual([40, "en-US"]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(other.getByRole("alert")).toHaveCount(0);
});
