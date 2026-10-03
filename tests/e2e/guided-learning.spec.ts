import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";

async function accessible(page: Page) {
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

/** A new English-speaking learner at A1 with no reviews due. */
async function seedNewLearner(page: Page, minutes = 5) {
  await page.addInitScript(({ key, minutes }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus: "A1",
      sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 10, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes,
    } }));
  }, { key: LEGACY_KEY, minutes });
}

/** Answer whatever the current lesson step asks, without knowing the answers. */
async function step(page: Page): Promise<boolean> {
  const main = page.locator("main");
  if (await page.getByRole("heading", { name: "Lesson complete", exact: true }).isVisible()) return false;
  const recall = main.getByRole("button", { name: "Now recall it", exact: true });
  if (await recall.isVisible()) {
    await recall.click();
    return true;
  }
  const next = main.getByRole("button", { name: "Next", exact: true });
  if (await next.isVisible()) {
    await next.click();
    return true;
  }
  const choices = main.getByRole("group").getByRole("button");
  if ((await choices.count()) && (await choices.first().isEnabled())) {
    await choices.first().click();
    return true;
  }
  const typed = main.getByRole("textbox", { name: "Your answer", exact: true });
  if (await typed.isVisible()) {
    await typed.fill("x");
    await main.getByRole("button", { name: "Check", exact: true }).click();
    return true;
  }
  const write = main.getByRole("textbox", { name: "Write", exact: true });
  if (await write.isVisible()) {
    await write.fill("I'd like some tea. Could you bring it, please?");
    await main.getByRole("button", { name: "Compare with a model", exact: true }).click();
    await main.getByRole("button", { name: "My answer works", exact: true }).click();
    return true;
  }
  const proceed = main.getByRole("button", { name: "Continue", exact: true });
  if (await proceed.isVisible()) {
    await proceed.click();
    return true;
  }
  throw new Error(`Unknown lesson step: ${(await main.innerText()).slice(0, 200)}`);
}

test("onboarding records the goal, a placement-suggested level and daily time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "سطح شروع", exact: true })).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: "کار", exact: true }).click();
  await page.getByRole("button", { name: "مطمئن نیستی؟ سنجش دودقیقه‌ای", exact: true }).click();
  const dontKnow = page.getByRole("button", { name: "نمی‌دانم", exact: true });
  for (let i = 0; i < 15; i++) await dontKnow.click();
  await expect(page.getByRole("status")).toContainText("A1");
  await page.getByRole("button", { name: "همین سطح را انتخاب کن", exact: true }).click();
  await page.getByRole("button", { name: /^۵/ }).click();
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect.poll(async () => (await readProgress(page)).state?.goal).toBe("work");
  const { state } = await readProgress(page);
  expect([state.focus, state.minutes, state.newPerDay, state.onboarded]).toEqual(["A1", 5, 3, true]);
  // With nothing due, the first step is a guided lesson.
  await expect(page.getByRole("link", { name: /شروع درس/ })).toBeVisible();
});

test("a guided lesson teaches, checks, applies and schedules its words", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedNewLearner(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Start lesson · 2 new words/ }).click();
  await expect(page.getByRole("heading", { name: "Learn new words", exact: true })).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: /Start lesson/ }).click();
  await expect(page.getByRole("button", { name: "Now recall it", exact: true })).toBeVisible();
  await expect(page.getByText("Common mistake", { exact: true })).toBeVisible();
  await expect(page.getByText("Draft: awaiting bilingual review", { exact: true })).toBeVisible();
  await accessible(page);
  for (let i = 0; i < 60 && (await step(page)); i++);
  await expect(page.getByRole("heading", { name: "Lesson complete", exact: true })).toBeVisible();

  const { state, events, sessions } = await readProgress(page);
  const targets = Object.keys(state.cards);
  expect(targets).toHaveLength(2);
  // The delayed retrieval of each word is its first scheduled review.
  const reviews = events.filter((event) => event.type === "review");
  expect(reviews.map((event) => event.item).sort()).toEqual([...targets].sort());
  expect(reviews.every((event) => event.context?.prompt?.startsWith("lesson:delayed"))).toBe(true);
  expect(events.filter((event) => event.type === "practice").length).toBeGreaterThanOrEqual(4);
  expect(sessions.find((session) => session.kind === "lesson")?.status).toBe("done");
});

test("a lesson left midway resumes at the same step", async ({ page }) => {
  await seedNewLearner(page, 10);
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();
  await page.getByRole("button", { name: "Now recall it", exact: true }).click();
  await page.locator("main").getByRole("group").getByRole("button").first().click();
  const counter = await page.locator("main").getByText(/^\d+ \/ \d+$/).first().innerText();
  await page.reload();
  await page.getByRole("button", { name: /Continue lesson/ }).click();
  await expect(page.locator("main").getByText(counter, { exact: true })).toBeVisible();
  // The answered question shows its result instead of asking again.
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  expect((await readProgress(page)).events.filter((event) => event.type === "practice")).toHaveLength(1);
});

test("the Words page shows every sense of a pilot entry with its teaching notes", async ({ page }) => {
  await seedNewLearner(page);
  await page.goto("/lexicon?q=close");
  await page.getByRole("button", { name: /^close/ }).first().click();
  const detail = page.locator("article");
  await expect(detail.getByText("بستن", { exact: true })).toBeVisible();
  await expect(detail.getByText("نزدیک", { exact: true })).toBeVisible();
  await expect(detail.getByText("/kləʊz/", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("/kləʊs/", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("Common mistake", { exact: true }).first()).toBeVisible();
});

test("recorded pronunciation downloads for offline use and plays from the cache", async ({ page, context }) => {
  test.setTimeout(90_000);
  await seedNewLearner(page);
  await page.goto("/progress");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const download = page.getByRole("button", { name: /^Download · / });
  await expect(download).toBeVisible();
  await download.click();
  await expect(page.getByText(/✓ Downloaded/)).toBeVisible({ timeout: 60_000 });
  const cached = await page.evaluate(async () => (await (await caches.open("vajefy-audio-v1")).keys()).length);
  expect(cached).toBeGreaterThan(500);

  await context.setOffline(true);
  const offline = await page.evaluate(async () => {
    const pilot = await (await fetch("/data/pilot-a1.json")).json();
    const file = pilot.audioPack.gb.files[0];
    const response = await fetch(`/audio/${file}`);
    return { ok: response.ok, type: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength };
  });
  expect(offline.ok).toBe(true);
  expect(offline.bytes).toBeGreaterThan(1000);
  await context.setOffline(false);
});
