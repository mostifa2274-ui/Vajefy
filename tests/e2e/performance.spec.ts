import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { LEGACY_KEY } from "./progress-db";
import { startCompressingProxy } from "./support/compressing-proxy";

/**
 * Lab budgets for the Core Web Vitals thresholds (LCP ≤ 2.5 s, CLS ≤ 0.1,
 * INP ≤ 200 ms) on a throttled mid-range phone: Slow 4G (1.6 Mbit/s, 150 ms)
 * and a 4× slower CPU. Responses are compressed as Cloudflare does in
 * production. Field data at the 75th percentile remains the real measure
 * (docs/PERFORMANCE.md).
 */

const BUDGET = { lcp: 2500, cls: 0.1, inp: 200 };

type Vitals = { lcp: number; cls: number; inp: number };
type VitalsWindow = Window & { __vitals: Vitals };

let base = "";
let close: () => Promise<void> = async () => undefined;

test.beforeAll(async () => {
  const proxy = await startCompressingProxy("http://127.0.0.1:8081");
  base = proxy.url;
  close = proxy.close;
});

test.afterAll(async () => {
  await close();
});

async function phone(browser: Browser, seeded: boolean): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "allow",
  });
  if (seeded) {
    await context.addInitScript((key) => {
      if (localStorage.getItem(key) || sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(key, JSON.stringify({ version: 5, state: {
        cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
        streak: 0, lastStudyDate: null, xp: 0, lang: "fa", focus: "A1",
        sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
        dailyGoal: 10, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
        goal: "general", minutes: 10,
      } }));
    }, LEGACY_KEY);
  }
  await context.addInitScript(() => {
    const vitals: Vitals = { lcp: 0, cls: 0, inp: 0 };
    (window as unknown as VitalsWindow).__vitals = vitals;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) vitals.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    // Every shift is summed, which can only overstate CLS's worst window.
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[] & { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) vitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
        if (entry.interactionId) vitals.inp = Math.max(vitals.inp, entry.duration);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
  return context;
}

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

async function visit(page: Page, path: string): Promise<Vitals> {
  await page.goto(base + path);
  await page.waitForSelector("html[data-progress-ready]");
  // Let late content (daily cards, lesson data) arrive before reading.
  await page.waitForTimeout(1500);
  return page.evaluate(() => (window as unknown as VitalsWindow).__vitals);
}

function withinBudget(vitals: Vitals, label: string) {
  expect(vitals.lcp, `${label} LCP`).toBeGreaterThan(0);
  expect(vitals.lcp, `${label} LCP`).toBeLessThanOrEqual(BUDGET.lcp);
  expect(vitals.cls, `${label} CLS`).toBeLessThanOrEqual(BUDGET.cls);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

test("a new learner's first visit loads within budget", async ({ browser }) => {
  const context = await phone(browser, false);
  const page = await context.newPage();
  await throttle(page);
  withinBudget(await visit(page, "/"), "first visit");
  await context.close();
});

test("a returning learner's Today and Review load within budget", async ({ browser }) => {
  const context = await phone(browser, true);
  // A first, unthrottled visit installs the app and fills its caches.
  const first = await context.newPage();
  await first.goto(base + "/");
  await first.waitForSelector("html[data-offline-ready]", { timeout: 30_000 });
  const page = await context.newPage();
  await throttle(page);
  withinBudget(await visit(page, "/"), "Today");
  withinBudget(await visit(page, "/study"), "Review");
  await context.close();
});

test("Learn and Words load within budget on a first visit", async ({ browser }) => {
  for (const path of ["/learn", "/lexicon"]) {
    const context = await phone(browser, true);
    const page = await context.newPage();
    await throttle(page);
    withinBudget(await visit(page, path), path);
    await context.close();
  }
});

test("answering in a lesson and searching Words respond within budget", async ({ browser }) => {
  const context = await phone(browser, true);
  const page = await context.newPage();
  await throttle(page);
  await visit(page, "/learn");
  await page.getByRole("button", { name: /شروع درس/ }).click();
  await page.getByRole("button", { name: "حالا از حفظ بگو", exact: true }).click();
  // The first question is written retrieval: type the word and check it.
  await page.getByRole("textbox", { name: "پاسخ تو", exact: true }).pressSequentially("I", { delay: 120 });
  await page.getByRole("button", { name: "بررسی", exact: true }).click();
  await page.getByRole("button", { name: "بعدی", exact: true }).click();
  await page.waitForTimeout(500);
  const lesson = await page.evaluate(() => (window as unknown as VitalsWindow).__vitals);
  expect(lesson.inp, "lesson INP").toBeLessThanOrEqual(BUDGET.inp);

  await visit(page, "/lexicon");
  await page.getByRole("textbox", { name: "جست‌وجو" }).first().pressSequentially("tion", { delay: 120 });
  await page.waitForTimeout(500);
  const search = await page.evaluate(() => (window as unknown as VitalsWindow).__vitals);
  expect(search.inp, "search INP").toBeLessThanOrEqual(BUDGET.inp);
  expect(search.cls, "search CLS").toBeLessThanOrEqual(BUDGET.cls);
  await context.close();
});
