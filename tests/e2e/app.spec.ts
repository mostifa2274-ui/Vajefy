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
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.waitForFunction(
    () => document.documentElement.dataset.offlineReady === "true" && navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  );

  const cachedBeforeOffline = await page.evaluate(async () => {
    const response = await caches.match("/lexicon", { ignoreSearch: true });
    if (!response) return { exists: false };
    const html = await response.clone().text();
    return {
      exists: true,
      status: response.status,
      contentType: response.headers.get("content-type"),
      csp: response.headers.get("content-security-policy"),
      hasDocument: html.includes("<html"),
      hasNonce: /nonce=["'][^"']+["']/.test(html),
      bytes: html.length,
    };
  });
  expect(cachedBeforeOffline).toMatchObject({
    exists: true,
    status: 200,
    hasDocument: true,
    hasNonce: true,
  });

  await context.setOffline(true);
  try {
    await page.goto("/lexicon");
    try {
      await expect(page.getByRole("heading", { name: "Lexicon" })).toBeVisible();
      await expect(page.getByText("about", { exact: true }).first()).toBeVisible();
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        offlineReady: document.documentElement.dataset.offlineReady ?? null,
        controller: Boolean(navigator.serviceWorker?.controller),
        body: document.body?.innerText.slice(0, 2500) ?? "",
      }));
      console.log("OFFLINE_CACHE_BEFORE", JSON.stringify(cachedBeforeOffline));
      console.log("OFFLINE_PAGE_AFTER", JSON.stringify(snapshot));
      console.log("OFFLINE_CONSOLE_ERRORS", JSON.stringify(consoleErrors));
      throw error;
    }
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


test("progress changes propagate across open tabs", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await seed(first);
  await first.goto("/progress");
  await second.goto("/progress");
  await expect(first.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(second.getByRole("heading", { name: "Progress" })).toBeVisible();

  await first.getByRole("button", { name: "فارسی" }).click();
  await expect(first.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(second.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(second.getByRole("heading", { name: "پیشرفت" })).toBeVisible();
  await context.close();
});

test("production responses carry the security policy", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  expect(headers["content-security-policy"]).not.toContain("script-src 'self' 'unsafe-inline'");
});
