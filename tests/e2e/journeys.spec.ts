import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";
import { runJourney, watchErrors, type JourneyResult } from "./support/journey";

/**
 * Synthetic learner journeys (plan §14, U5–U7). A goal-driven learner works
 * through real journeys on a matrix of devices (U6), and each step is checked
 * for dead ends, loops, the interaction budget, sideways scrolling, covered
 * or unreachable actions, runtime errors and lost progress (U7).
 */

const LESSON_DONE = /^(Lesson complete|درس تمام شد)$/;
const SITTING_DONE = /^(This sitting is finished|این نوبت تمام شد)$/;
const DAY = 86_400_000;

type Profile = {
  name: string;
  context: BrowserContextOptions;
  cpu?: number;
  network?: { latency: number; download: number; upload: number };
  css?: string;
  keyboard?: boolean;
};

const PROFILES: Profile[] = [
  { name: "narrow Android phone", context: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  { name: "mid-size Android phone", context: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true } },
  { name: "Android tablet", context: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  {
    name: "iPhone Safari visible area",
    context: {
      viewport: { width: 390, height: 664 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  },
  { name: "desktop", context: { viewport: { width: 1280, height: 800 } } },
  {
    name: "slow phone on a slow connection",
    context: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true },
    cpu: 4,
    // Roughly "fast 3G": 150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up.
    network: { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
  },
  {
    name: "200% text with reduced motion",
    context: { viewport: { width: 390, height: 844 }, reducedMotion: "reduce", bypassCSP: true },
    css: "html { font-size: 200% !important; }",
  },
  { name: "keyboard only", context: { viewport: { width: 1280, height: 800 } }, keyboard: true },
];

async function open(browser: Browser, profile: Profile): Promise<Page> {
  const context = await browser.newContext({ ...profile.context, serviceWorkers: "allow" });
  const page = await context.newPage();
  if (profile.cpu || profile.network) {
    const cdp = await context.newCDPSession(page);
    if (profile.cpu) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    if (profile.network) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: profile.network.latency,
        downloadThroughput: profile.network.download,
        uploadThroughput: profile.network.upload,
      });
    }
  }
  if (profile.css) {
    await page.addInitScript((css) => {
      const apply = () => {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
      };
      if (document.head) apply();
      else document.addEventListener("DOMContentLoaded", apply);
    }, profile.css);
  }
  return page;
}

/** A learner who has finished onboarding, optionally with studied cards. */
async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(({ key, extra }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang: "fa", focus: "A1",
      sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 10, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes: 5, ...extra,
    } }));
  }, { key: LEGACY_KEY, extra });
}

function visible(page: Page, text: RegExp) {
  return () => page.getByText(text).first().isVisible().catch(() => false);
}

function report(result: JourneyResult): string {
  return [
    ...result.findings.map((finding) => `${finding.kind} at step ${finding.step}: ${finding.detail}`),
    `actions: ${result.actions.join(" | ")}`,
  ].join("\n");
}

async function savedCards(page: Page): Promise<string[]> {
  return Object.keys((await readProgress(page)).state?.cards ?? {});
}

for (const profile of PROFILES) {
  test(`a new learner reaches the end of a first lesson: ${profile.name}`, async ({ browser }) => {
    test.setTimeout(profile.cpu ? 240_000 : 150_000);
    const page = await open(browser, profile);
    const errors = watchErrors(page);
    try {
      await page.goto("/");
      const result = await runJourney(page, { budget: 40, keyboard: profile.keyboard, errors, reached: visible(page, LESSON_DONE) });
      expect(result.findings, report(result)).toEqual([]);

      // Lost progress: the lesson's words survive a reload, and Today
      // offers the next step rather than onboarding again.
      await page.reload();
      expect((await savedCards(page)).length).toBeGreaterThanOrEqual(1);
      await page.goto("/");
      await expect(page.locator("main")).toBeVisible();
      expect(await page.locator("main").getByRole("button", { name: /^(Start|شروع)$/ }).count()).toBe(0);
    } finally {
      await page.context().close();
    }
  });
}

test("a lesson interrupted by a reload resumes and finishes without losing or repeating work", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await open(browser, PROFILES[0]!);
  const errors = watchErrors(page);
  try {
    await seed(page);
    await page.goto("/learn");
    await page.waitForSelector("html[data-progress-ready]");
    const first = await runJourney(page, { budget: 40, limit: 9, errors, reached: visible(page, LESSON_DONE) });
    expect(first.reached).toBe(false);
    await page.reload();
    await page.waitForSelector("html[data-progress-ready]");
    const rest = await runJourney(page, { budget: 40, errors, reached: visible(page, LESSON_DONE) });
    expect(rest.findings, report(rest)).toEqual([]);
    // Resuming continues where the learner left off instead of restarting.
    expect(first.steps + rest.steps).toBeLessThanOrEqual(45);
    const cards = await savedCards(page);
    expect(new Set(cards).size).toBe(cards.length);
    expect(cards.length).toBeGreaterThanOrEqual(1);
  } finally {
    await page.context().close();
  }
});

test("a learner who goes offline mid-lesson finishes it, and the progress survives an offline reload", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await open(browser, PROFILES[1]!);
  const errors = watchErrors(page);
  const context = page.context();
  try {
    await seed(page);
    await page.goto("/learn");
    await page.waitForFunction(
      () => document.documentElement.dataset.offlineReady === "true" && navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 30_000 },
    );
    await page.reload();
    await page.waitForSelector("html[data-progress-ready]");
    const online = await runJourney(page, { budget: 40, limit: 6, errors, reached: visible(page, LESSON_DONE) });
    expect(online.reached).toBe(false);

    await context.setOffline(true);
    const offline = await runJourney(page, { budget: 40, reached: visible(page, LESSON_DONE) });
    expect(offline.findings.filter((finding) => finding.kind !== "runtime-error"), report(offline)).toEqual([]);
    await page.reload();
    expect((await savedCards(page)).length).toBeGreaterThanOrEqual(1);
  } finally {
    await context.setOffline(false);
    await context.close();
  }
  // Network failures while offline are expected; nothing else may fail.
  expect(errors.filter((error) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/.test(error))).toEqual([]);
});

test("a learner back after a month of absence finishes one review sitting within budget", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await open(browser, PROFILES[0]!);
  const errors = watchErrors(page);
  try {
    const now = Date.now();
    const ids = ["i", "you", "a-an", "be", "my", "your", "name", "what", "this", "he", "who", "where", "she", "it", "we", "they"];
    const card = {
      ease: 2.5, interval: 7, due: now - 30 * DAY, reps: 3, lapses: 0, state: "review", step: 0, last: now - 37 * DAY,
      fsrs: { model: "fsrs6", stability: 7, difficulty: 5, scheduledDays: 7, learningSteps: 0, state: "review", lastReview: now - 37 * DAY },
    };
    await seed(page, {
      cards: Object.fromEntries(ids.map((id) => [`lex:A1:${id}`, card])),
      lastStudyDate: new Date(now - 37 * DAY).toISOString().slice(0, 10),
      streak: 4,
    });
    await page.goto("/");
    // A sitting is capped at the session size, however large the backlog.
    const result = await runJourney(page, { budget: 2 * 10 + 6, errors, reached: visible(page, SITTING_DONE) });
    expect(result.findings, report(result)).toEqual([]);
  } finally {
    await page.context().close();
  }
});

test("a learner who keeps answering wrongly still finishes, and every word is still scheduled", async ({ browser }) => {
  test.setTimeout(150_000);
  const page = await open(browser, PROFILES[0]!);
  const errors = watchErrors(page);
  try {
    await seed(page);
    await page.goto("/learn");
    await page.waitForSelector("html[data-progress-ready]");
    const result = await runJourney(page, { budget: 40, errors, text: "zzzz", reached: visible(page, LESSON_DONE) });
    expect(result.findings, report(result)).toEqual([]);
    // The summary counts the misses, and every word is still scheduled.
    const summary = await page.locator("main p").filter({ hasText: /\// }).first().innerText();
    const [correct, answered] = (summary.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).match(/\d+/g) ?? []).map(Number);
    expect(correct).toBeLessThan(answered!);
    const words = await page.locator("main li:has(.lex-word)").count();
    expect(words).toBeGreaterThanOrEqual(1);
    await page.reload();
    expect((await savedCards(page)).length).toBeGreaterThanOrEqual(words);
  } finally {
    await page.context().close();
  }
});
