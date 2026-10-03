import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { readProgress } from "./progress-db";

const ID = "lex:A1:about";
const DAY = 86_400_000;

async function seedSmart(
  page: Page,
  options: { dueSoon?: boolean; lang?: "en" | "fa"; skills?: Record<string, unknown> } = {},
) {
  await page.addInitScript(({ day, id, options }) => {
    if (localStorage.getItem("roshana-v1")) return;
    const now = Date.now();
    const card = {
      ease: 2.5, interval: 15, due: now + 10 * day, reps: 5, lapses: 4,
      state: "review", step: 0, last: now - 5 * day,
      fsrs: {
        model: "fsrs6", stability: 15, difficulty: 7, scheduledDays: 15,
        learningSteps: 0, state: "review", lastReview: now - 5 * day,
      },
    };
    localStorage.setItem("roshana-v1", JSON.stringify({ version: 3, state: {
      cards: { [id]: { ...card, due: options.dueSoon ? now + 60_000 : card.due } },
      logs: [], lifetime: { reviews: 4, correct: 3, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 40, lang: options.lang ?? "en", focus: "A1",
      sessionSize: 20, newPerDay: 10, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], onboarded: true,
      ...(options.skills ? { practiceSkills: options.skills } : {}),
    } }));
  }, { day: DAY, id: ID, options });
}

async function saved(page: Page) {
  return readProgress(page);
}

test("Smart Practice preserves FSRS, daily-review evidence and v4 backup through reload/restore", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSmart(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Smart Practice", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Smart Practice/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toBeInViewport();
  const before = await saved(page);
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Smart Practice", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("about");
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect.poll(async () => (await saved(page)).state.practiceSkills[ID]?.spelling?.attempts).toBe(1);
  const after = await saved(page);
  expect(after.version).toBe(4);
  expect(after.state.cards).toEqual(before.state.cards);
  expect(after.state.reviewHistory).toEqual(before.state.reviewHistory);
  expect(after.state.lifetime).toEqual({ reviews: 4, correct: 3, practice: 1, practiceCorrect: 1 });
  expect(after.state.logs[0]).toMatchObject({ reviews: 0, correct: 0, practice: 1 });

  await page.reload();
  expect((await saved(page)).state.practiceSkills).toEqual(after.state.practiceSkills);
  // The finished round is not offered for resuming.
  await expect(page.getByRole("button", { name: "Continue your practice", exact: true })).toHaveCount(0);
  // A completed word gets a short break instead of being farmed repeatedly.
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("recently practised words get a short break");

  await page.goto("/progress");
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export progress", exact: true }).click();
  const download = await pendingDownload;
  const text = await readFile((await download.path())!, "utf8");
  const backup = JSON.parse(text);
  expect(backup.version).toBe(4);
  expect(backup.progress.practiceSkills).toEqual(after.state.practiceSkills);
  await page.getByRole("button", { name: "Clear progress", exact: true }).click();
  await page.getByRole("button", { name: "Yes, clear it", exact: true }).click();
  await expect.poll(async () => (await saved(page)).state.practiceSkills).toEqual({});
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await page.getByRole("button", { name: "Yes, replace it", exact: true }).click();
  await expect(page.getByText("Progress restored from the file.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await saved(page)).state.practiceSkills).toEqual(after.state.practiceSkills);
  expect((await saved(page)).state.cards).toEqual(before.state.cards);
});

test("a Smart Practice miss returns a word to Review without rewriting FSRS memory", async ({ page }) => {
  await seedSmart(page);
  await page.goto("/drill?play=smart");
  const before = await saved(page);
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("zzzzzzzzz");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect.poll(async () => (await saved(page)).state.practiceSkills[ID]?.spelling?.lastGrade).toBe("again");
  const after = await saved(page);
  expect(after.state.cards[ID].due).toBeLessThanOrEqual(Date.now());
  expect(after.state.cards[ID].fsrs).toEqual(before.state.cards[ID].fsrs);
  expect(after.state.cards[ID].lapses).toBe(before.state.cards[ID].lapses);
  expect(after.state.reviewHistory).toEqual([]);
  expect(after.state.lifetime.reviews).toBe(4);
});

test("Persian Smart Practice keeps soon-due words in Review with a useful empty state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSmart(page, { dueSoon: true, lang: "fa" });
  await page.goto("/drill?play=smart");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "شروع", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("فعلاً واژه‌ای برای تمرین بیشتر ندارید");
  await expect(page.getByRole("status").getByRole("link", { name: "مرور", exact: true })).toBeVisible();
  expect((await saved(page)).state.practiceSkills).toEqual({});
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
});

test.describe("Smart Practice network recovery", () => {
  test.use({ serviceWorkers: "block" });
test("Smart Practice distinguishes a failed load from an empty pool and supports retry", async ({ page }) => {
  await seedSmart(page);
  await page.route("**/data/lex-a1.json", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/drill?play=smart");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("The data could not be loaded.");
  await page.unroute("**/data/lex-a1.json");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toBeVisible();
});
});

test("unheard listening can be skipped without fabricating a mistake or awarding practice credit", async ({ page }) => {
  await seedSmart(page, {
    skills: { [ID]: { listening: { attempts: 2, correct: 1, lastAt: Date.now() - 3_600_000, lastGrade: "hard" } } },
  });
  await page.goto("/drill?play=smart");
  const before = await saved(page);
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.getByText("What did you hear?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip listening", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No answers recorded", exact: true })).toBeVisible();
  const after = await saved(page);
  expect(after.state.practiceSkills).toEqual(before.state.practiceSkills);
  expect(after.state.cards).toEqual(before.state.cards);
  expect(after.state.lifetime).toEqual(before.state.lifetime);
  expect(after.state.reviewHistory).toEqual([]);
});

test("manual formats remain keyboard-accessible beside the focused Smart Practice entry", async ({ page }) => {
  await seedSmart(page);
  await page.goto("/drill?play=smart");
  const chooser = page.locator("summary").filter({ hasText: "Choose another format" });
  await chooser.focus();
  await chooser.press("Enter");
  await page.getByRole("button", { name: /^Spelling Type / }).click();
  await expect(page.getByRole("button", { name: /^Spelling Type / })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Smart Practice/ }).click();
  await expect(page.locator("details")).not.toHaveAttribute("open");
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toBeInViewport();
});
