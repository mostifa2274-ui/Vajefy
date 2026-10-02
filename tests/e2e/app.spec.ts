import { expect, test, type Page } from "@playwright/test";

const state = {
  cards: {},
  logs: [],
  lifetime: { reviews: 4, correct: 3, practice: 7, practiceCorrect: 5 },
  streak: 0,
  lastStudyDate: null,
  xp: 54,
  lang: "en",
  focus: "A1",
  sessionSize: 20,
  newPerDay: 10,
  voice: false,
  accent: "en-GB",
  bookmarks: [],
  dailyGoal: 20,
  onboarded: true,
};

async function seed(page: Page, patch: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ base, changes }) => {
      localStorage.setItem("roshana-v1", JSON.stringify({ state: { ...base, ...changes }, version: 2 }));
    },
    { base: state, changes: patch },
  );
}

test("fresh learner sees onboarding without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "سطح شروع" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("saved English locale applies before the app becomes interactive", async ({ page }) => {
  await seed(page);
  await page.goto("/progress");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.getByText("Practice", { exact: true })).toBeVisible();
  await expect(page.getByText("British", { exact: true })).toBeVisible();
});

test("Arabic-keyboard Persian search still finds normalized vocabulary", async ({ page }) => {
  await seed(page);
  await page.goto("/lexicon?q=كتاب");
  await expect(page.getByText("book", { exact: true }).first()).toBeVisible();
});

test("installed app can reopen the lexicon while offline", async ({ page, context }) => {
  await seed(page);
  await page.goto("/");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("service worker unavailable");
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  try {
    await page.goto("/lexicon");
    await expect(page.getByRole("heading", { name: "Lexicon" })).toBeVisible();
    await expect(page.getByText("about", { exact: true }).first()).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("critical pages stay free of runtime console errors", async ({ page }) => {
  await seed(page);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const path of ["/", "/lexicon", "/study", "/drill", "/library", "/progress"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
