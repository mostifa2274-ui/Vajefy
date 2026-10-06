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

test("v2 saved progress migrates to the default FSRS target in the browser", async ({ page }) => {
  await seed(page);
  await page.goto("/progress");
  await expect(page.getByText("Memory scheduler: Adaptive FSRS-6", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "90%" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Review evidence", { exact: true })).toBeVisible();
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

test("an A1 learner's first load installs only A1 data", async ({ page }) => {
  await seed(page);
  const requested: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/data/")) requested.push(path);
  });
  await page.goto("/");
  await page.waitForFunction(
    () => document.documentElement.dataset.offlineReady === "true" && navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  );
  await expect(page.getByText("Today's entry", { exact: true })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith("vajefy-offline-"));
    const keys = name ? await (await caches.open(name)).keys() : [];
    return keys.map((request) => new URL(request.url).pathname).filter((path) => path.startsWith("/data/"));
  });
  expect(cached).toContain("/data/lex-a1.json");
  // Higher levels and the reference decks wait until they are opened (plan §16 P1).
  const beyondA1 = /\/data\/(lex-(a2|b1|b2|b2x|c1)|occupations|phrasal|collocations|prepositions|antonyms|confusing|verb-patterns|irregular|formation|synonyms|families|reference-reviewed)\.json$/;
  expect(cached.filter((path) => beyondA1.test(path))).toEqual([]);
  expect(requested.filter((path) => beyondA1.test(path))).toEqual([]);
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
  expect(headers["content-security-policy"]).toContain("style-src-elem 'self'");
  expect(headers["content-security-policy"]).toContain("style-src-attr 'unsafe-inline'");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
});

test("the Worker's own endpoints validate input and report optional services as off until configured", async ({ request }) => {
  const valid = await request.post("/api/telemetry", { data: { reports: [{ kind: "audio-failed", code: "clip", route: "/learn" }] } });
  expect(valid.status()).toBe(204);
  const invalid = await request.post("/api/telemetry", { data: { reports: [{ kind: "anything", code: "<script>" }] } });
  expect(invalid.status()).toBe(400);
  expect((await request.get("/api/telemetry")).status()).toBe(405);
  for (const service of ["coach", "sync"]) {
    const status = await request.get(`/api/${service}/status`);
    expect(status.status()).toBe(200);
    expect(await status.json()).toEqual({ enabled: false });
  }
  expect((await request.get("/api/unknown")).status()).toBe(404);
});

test("the deployment reports its revision and content channel for release checks", async ({ request }) => {
  const response = await request.get("/api/version");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toBe("no-store");
  // A local build has no Cloudflare commit and the default draft channel.
  expect(await response.json()).toEqual({ revision: "local", channel: "draft" });
});
