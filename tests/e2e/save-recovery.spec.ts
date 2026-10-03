import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readProgress } from "./progress-db";

const KEY = "roshana-v1";
const DAY = 86_400_000;

/** Seed the save once, so reloads see whatever the app left behind. */
async function seedRaw(page: Page, raw: string) {
  await page.addInitScript(({ key, raw }) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem(key, raw);
    sessionStorage.setItem("seeded", "1");
  }, { key: KEY, raw });
}

async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), KEY);
}

async function download(page: Page, button: Locator) {
  const pending = page.waitForEvent("download");
  await button.click();
  const file = await pending;
  return { name: file.suggestedFilename(), text: await readFile((await file.path())!, "utf8") };
}

async function expectAccessible(page: Page) {
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

function card(now: number) {
  return { ease: 2.5, interval: 3, due: now + 3 * DAY, reps: 2, lapses: 0, state: "review", step: 0, last: now };
}

function progress(now: number) {
  return {
    cards: { "lex:A1:about": card(now) },
    logs: [], lifetime: { reviews: 6, correct: 5, practice: 0, practiceCorrect: 0 },
    streak: 0, lastStudyDate: null, xp: 60, lang: "en", focus: "A1",
    sessionSize: 20, newPerDay: 10, voice: false, accent: "en-GB", bookmarks: [],
    dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
  };
}

test("an unreadable save is never replaced at startup and can be downloaded exactly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const raw = '{"state":{"cards":{"lex:A1:about":{"ease":2.5,"interval":3';
  await seedRaw(page, raw);
  await page.goto("/study");
  const title = page.getByRole("heading", { name: "پیشرفت ذخیره‌شده خوانده نشد", exact: true });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await expect(page.getByText("هیچ بخشی از این نسخه خوانا نیست.")).toBeVisible();
  await expectAccessible(page);
  // Navigation and reloads keep the save and the recovery screen.
  await page.getByRole("link", { name: "واژه‌ها" }).click();
  await expect(title).toBeVisible();
  await page.reload();
  await expect(title).toBeVisible();
  expect(await stored(page)).toBe(raw);
  const copy = await download(page, page.getByRole("button", { name: "دریافت نسخهٔ ذخیره‌شده", exact: true }));
  expect(copy.text).toBe(raw);
  expect(copy.name).toMatch(/^vajefy-saved-copy-\d{4}-\d{2}-\d{2}\.json$/);
  await page.getByRole("button", { name: "شروع از نو", exact: true }).click();
  await page.getByRole("button", { name: "انصراف", exact: true }).click();
  expect(await stored(page)).toBe(raw);
  await page.getByRole("button", { name: "شروع از نو", exact: true }).click();
  await page.getByRole("button", { name: "بله، از نو شروع شود", exact: true }).click();
  await expect(title).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toBeVisible();
  const fresh = await readProgress(page);
  expect(fresh.version).toBe(5);
  expect(fresh.state.cards).toEqual({});
  expect(fresh.state.onboarded).toBe(false);
  // The unreadable original is still there, untouched, but no longer in use.
  expect(await stored(page)).toBe(raw);
  await page.reload();
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toBeVisible();
});

test("readable parts of a damaged save are recovered only after confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const now = Date.now();
  const state = {
    ...progress(now),
    cards: { "lex:A1:about": card(now), "lex:A1:above": { ...card(now), state: "mastered" } },
    logs: "not a list",
  };
  const raw = JSON.stringify({ state, version: 4 });
  await seedRaw(page, raw);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Saved progress could not be read", exact: true })).toBeVisible();
  const readable = page.getByRole("region", { name: "Readable progress" });
  await expect(readable.getByRole("definition").first()).toHaveText("1 / 2");
  await expect(readable).toContainText("Other details returning to defaults");
  await expectAccessible(page);
  await readable.getByRole("button", { name: "Continue with readable progress", exact: true }).click();
  await expect(readable).toContainText("Unreadable parts will be lost");
  expect(await stored(page)).toBe(raw);
  await readable.getByRole("button", { name: "Yes, replace it", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved progress could not be read" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(async () => (await readProgress(page)).state?.xp).toBe(60);
  const saved = await readProgress(page);
  expect(saved.version).toBe(5);
  expect(Object.keys(saved.state.cards)).toEqual(["lex:A1:about"]);
  expect(saved.state.logs).toEqual([]);
  expect(await stored(page)).toBe(raw);
  await page.reload();
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
});

test("a save from a newer version is kept until the app updates", async ({ page }) => {
  const raw = JSON.stringify({ state: { ...progress(Date.now()), cards: "a newer card format", newerField: 1 }, version: 99 });
  await seedRaw(page, raw);
  await page.goto("/drill");
  const title = page.getByRole("heading", { name: "Progress was saved by a newer version", exact: true });
  await expect(title).toBeVisible();
  await expectAccessible(page);
  const copy = await download(page, page.getByRole("button", { name: "Download the saved copy", exact: true }));
  expect(copy.text).toBe(raw);
  // Wait for the reload itself: the old page still shows the same title.
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Reload to update", exact: true }).click();
  await reloaded;
  await expect(title).toBeVisible();
  expect(await stored(page)).toBe(raw);
  await page.getByRole("button", { name: "Continue with readable progress", exact: true }).click();
  await expect(page.getByText("Details only the newer version understands will be lost")).toBeVisible();
  expect(await stored(page)).toBe(raw);
});

test("importing a backup from a newer version explains why it was refused", async ({ page }) => {
  const now = Date.now();
  await seedRaw(page, JSON.stringify({ state: progress(now), version: 4 }));
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
  const before = await readProgress(page);
  const backup = { kind: "roshana-progress", version: 99, exportedAt: new Date(now).toISOString(), progress: progress(now) };
  await page.locator('input[type="file"]').setInputFiles({
    name: "newer.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByText("This backup comes from a newer version of Vajefy. Reload the page to update the app, then import it again.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, replace it", exact: true })).toHaveCount(0);
  expect((await readProgress(page)).state).toEqual(before.state);
});
