import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

const KEY = "roshana-v1";
const ID = "lex:A1:about";
type ControlledWindow = Window & { denyProgressWrites: boolean; denyStorageAccess: boolean };

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
  }, { key: KEY, id: ID });
}

async function controlWrites(page: Page) {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    (window as ControlledWindow).denyProgressWrites = false;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && (window as ControlledWindow).denyProgressWrites) {
        throw new DOMException("Simulated browser quota", "QuotaExceededError");
      }
      original.call(this, name, value);
    };
  }, KEY);
}

async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}

async function backup(page: Page, button: Locator) {
  const pending = page.waitForEvent("download");
  await button.click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

function goal(page: Page, value: string) {
  return page.getByText("Reviews a day", { exact: true }).locator("..").getByRole("button", { name: value, exact: true });
}

test("quota failures expose unsaved answers in backup and retry durably saves the latest state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await controlWrites(page);
  await page.goto("/drill?play=smart");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const before = await saved(page);
  await page.evaluate(() => { (window as ControlledWindow).denyProgressWrites = true; });
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("about");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const notice = page.getByRole("alert");
  await expect(notice).toContainText("Progress could not be saved");
  await expect(notice).toContainText("before closing or reloading");
  expect(await saved(page)).toEqual(before);
  const exported = await backup(page, notice.getByRole("button", { name: "Export progress", exact: true }));
  expect(exported.version).toBe(4);
  expect(exported.progress.lifetime).toEqual({ reviews: 4, correct: 3, practice: 1, practiceCorrect: 1 });
  expect(exported.progress.practiceSkills[ID].spelling.attempts).toBe(1);
  expect(exported.progress.cards).toEqual(before.state.cards);
  expect(exported.progress.reviewHistory).toEqual(before.state.reviewHistory);
  expect(exported.progress).not.toHaveProperty("saveStatus");
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await notice.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(notice).toBeVisible();
  await page.evaluate(() => { (window as ControlledWindow).denyProgressWrites = false; });
  await notice.getByRole("button", { name: "Retry saving", exact: true }).click();
  await expect(notice).toHaveCount(0);
  expect((await saved(page)).state).toEqual(exported.progress);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Quiz", exact: true })).toBeVisible();
  expect((await saved(page)).state.practiceSkills[ID].spelling.attempts).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("blocked storage access keeps onboarding usable with a Persian warning and recoverable backup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = window.localStorage;
    (window as ControlledWindow).denyStorageAccess = true;
    Object.defineProperty(window, "localStorage", { configurable: true, get() {
      if ((window as ControlledWindow).denyStorageAccess) throw new DOMException("Storage blocked", "SecurityError");
      return original;
    } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toBeVisible();
  const notice = page.getByRole("alert");
  await expect(notice).toContainText("پیشرفت در مرورگر ذخیره نشد");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  const exported = await backup(page, notice.getByRole("button", { name: "دریافت فایل پشتیبان", exact: true }));
  expect(exported.progress.onboarded).toBe(true);
  expect(exported.progress.lang).toBe("fa");
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.evaluate(() => { (window as ControlledWindow).denyStorageAccess = false; });
  await notice.getByRole("button", { name: "تلاش دوباره برای ذخیره", exact: true }).click();
  await expect(notice).toHaveCount(0);
  expect((await saved(page)).state.onboarded).toBe(true);
});

test("another tab cannot replace or be replaced by an unsaved session", async ({ page, context }) => {
  await seed(page);
  await controlWrites(page);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/progress");
  await expect(other.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  await page.evaluate(() => { (window as ControlledWindow).denyProgressWrites = true; });
  await goal(page, "40").click();
  await expect(page.getByRole("alert")).toContainText("Progress could not be saved");
  await goal(other, "10").click();
  const notice = page.getByRole("alert");
  await expect(notice).toContainText("A different saved copy was found");
  await expect(goal(page, "40")).toHaveAttribute("aria-pressed", "true");
  await expect(goal(other, "10")).toHaveAttribute("aria-pressed", "true");
  expect((await saved(other)).state.dailyGoal).toBe(10);
  const exported = await backup(page, notice.getByRole("button", { name: "Export progress", exact: true }));
  expect(exported.progress.dailyGoal).toBe(40);
  await page.evaluate(() => { (window as ControlledWindow).denyProgressWrites = false; });
  await page.getByRole("button", { name: "American", exact: true }).click();
  expect((await saved(other)).state.accent).toBe("en-GB");
  await notice.getByRole("button", { name: "Load saved copy", exact: true }).click();
  await expect(notice).toContainText("Your unsaved session will be discarded");
  await notice.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(goal(page, "40")).toHaveAttribute("aria-pressed", "true");
  await notice.getByRole("button", { name: "Load saved copy", exact: true }).click();
  await notice.getByRole("button", { name: "Load saved copy and reload", exact: true }).click();
  await expect(goal(page, "10")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await saved(page)).state.accent).toBe("en-GB");
});
