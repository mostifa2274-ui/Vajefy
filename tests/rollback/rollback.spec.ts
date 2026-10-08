import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "../e2e/progress-db";
import { switchingProxy } from "./switching-proxy";

/**
 * Rollback is tested, not merely documented (plan §22). Two real builds run
 * side by side, and one origin is switched from the current release to the
 * previous one and back, as Cloudflare's rollback switches production. A
 * learner keeps studying through both switches.
 */

const CURRENT = "http://127.0.0.1:8091";
const PREVIOUS = "http://127.0.0.1:8092";
const DAY = 86_400_000;
const DUE = ["lex:A1:about", "lex:A1:above", "lex:A1:across"];

const revisions = {
  current: process.env.ROLLBACK_CURRENT_REVISION ?? "",
  previous: process.env.ROLLBACK_PREVIOUS_REVISION ?? "",
};

/** The release a document belongs to: its hashed entry module. */
const ENTRY = /\/assets\/index-[\w-]+\.js/;

async function entryOf(base: string): Promise<string> {
  const html = await (await fetch(`${base}/study`)).text();
  const entry = ENTRY.exec(html)?.[0];
  if (!entry) throw new Error(`No entry module in ${base}/study`);
  return entry;
}

async function versionOf(base: string): Promise<{ revision: string; channel: string }> {
  return (await fetch(`${base}/api/version`)).json() as Promise<{ revision: string; channel: string }>;
}

async function servedEntry(page: Page): Promise<string | undefined> {
  return page.evaluate((pattern) => {
    for (const link of document.querySelectorAll<HTMLLinkElement>("link[href], script[src]")) {
      const url = link instanceof HTMLScriptElement ? link.src : link.href;
      const match = new RegExp(pattern).exec(new URL(url).pathname);
      if (match) return match[0];
    }
    return undefined;
  }, ENTRY.source);
}

async function ready(page: Page) {
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached", timeout: 30_000 });
}

async function revision(page: Page): Promise<{ revision: string; channel: string }> {
  return page.evaluate(() => fetch("/api/version", { cache: "no-store" }).then((response) => response.json()));
}

async function reviews(page: Page) {
  return (await readProgress(page)).events.filter((event) => event.type === "review" && !event.undone);
}

async function answer(page: Page) {
  await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
}

/** Every answer once, each answered card carrying its schedule, the counters in step, nothing left in the journal. */
async function expectCoherent(page: Page, count: number) {
  const progress = await readProgress(page);
  const answered = progress.events.filter((event) => event.type === "review" && !event.undone);
  expect(answered).toHaveLength(count);
  expect(new Set(answered.map((event) => event.item)).size).toBe(count);
  expect(progress.state.lifetime.reviews).toBe(20 + count);
  for (const event of answered) expect((progress.state.cards[event.item] as { last: number }).last).toBe(event.at);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("vajefy-op:")).length)).toBe(0);
}

/**
 * Close every tab, as a learner eventually does, and open the app again. The
 * release waiting in the background then takes over.
 */
async function reopen(context: BrowserContext, origin: string): Promise<Page> {
  for (const open of context.pages()) await open.close();
  const page = await context.newPage();
  await page.goto(`${origin}/study`);
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active && !registration.waiting && !registration.installing && navigator.serviceWorker.controller);
      }),
    )
    .toBe(true);
  return page;
}

/** Wait until the deployed release has fully installed in the background. */
async function installed(page: Page) {
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)), { timeout: 60_000 })
    .toBe(true);
}

/** Reload with the network off: the page must come from the complete offline release. */
async function offlineEntry(context: BrowserContext, page: Page): Promise<string | undefined> {
  await context.setOffline(true);
  try {
    await page.reload();
    await ready(page);
    return await servedEntry(page);
  } finally {
    await context.setOffline(false);
  }
}

test("a rollback and a roll forward keep the learner's progress and a working offline release", async ({ browser }) => {
  expect(revisions.current, "the rehearsal script sets both revisions").not.toBe("");
  expect(revisions.previous).not.toBe(revisions.current);
  const entries = { current: await entryOf(CURRENT), previous: await entryOf(PREVIOUS) };
  const versions = { current: await versionOf(CURRENT), previous: await versionOf(PREVIOUS) };
  expect(versions.current.revision).toBe(revisions.current);
  expect(versions.previous.revision).toBe(revisions.previous);
  expect(entries.previous, "the two builds are different releases").not.toBe(entries.current);

  const proxy = await switchingProxy(CURRENT);
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const errors: string[] = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  await context.addInitScript(({ key, due, day }) => {
    // New tabs start blank, where the page has no storage of its own.
    if (!location.protocol.startsWith("http") || localStorage.getItem(key)) return;
    const now = Date.now();
    const card = {
      ease: 2.5, interval: 15, due: now - 60_000, reps: 5, lapses: 0, state: "review", step: 0, last: now - 15 * day,
      fsrs: { model: "fsrs6", stability: 15, difficulty: 5, scheduledDays: 15, learningSteps: 0, state: "review", lastReview: now - 15 * day },
    };
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: Object.fromEntries(due.map((id: string) => [id, card])),
      logs: [], lifetime: { reviews: 20, correct: 18, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus: "A1",
      sessionSize: 20, newPerDay: 0, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes: 5,
    } }));
  }, { key: LEGACY_KEY, due: DUE, day: DAY });

  try {
    // The current release is installed for offline use, and the learner answers.
    let page = await context.newPage();
    await page.goto(`${proxy.origin}/study`);
    await ready(page);
    await page.locator("html[data-offline-ready]").waitFor({ state: "attached", timeout: 60_000 });
    expect(await revision(page)).toEqual(versions.current);
    await answer(page);
    await expect.poll(async () => (await reviews(page)).length).toBe(1);

    // Roll back. /api/version reports the previous release and its content channel at once.
    proxy.deploy(PREVIOUS);
    expect(await revision(page)).toEqual(versions.previous);

    // The open tab keeps its complete release while the previous one installs.
    await installed(page);
    expect(await offlineEntry(context, page)).toBe(entries.current);
    await expectCoherent(page, 1);

    // Once the tabs close, the previous release serves the app, offline too.
    page = await reopen(context, proxy.origin);
    expect(await offlineEntry(context, page)).toBe(entries.previous);
    const held = page.getByRole("heading", { name: "Progress was saved by a newer version", exact: true });
    let count = 1;
    if (await held.isVisible()) {
      // A newer save is held unchanged, can be downloaded, and is never overwritten.
      await expect(page.getByRole("button", { name: "Download the saved copy", exact: true })).toBeVisible();
      test.info().annotations.push({ type: "rollback", description: "the previous release held the newer save" });
    } else {
      await expectCoherent(page, 1);
      // The learner keeps studying on the previous release.
      await answer(page);
      count = 2;
      test.info().annotations.push({ type: "rollback", description: "the learner studied on the previous release" });
      await expect.poll(async () => (await reviews(page)).length).toBe(count);
      await expectCoherent(page, count);
    }

    // Roll forward again.
    proxy.deploy(CURRENT);
    expect(await revision(page)).toEqual(versions.current);
    await installed(page);
    page = await reopen(context, proxy.origin);
    expect(await offlineEntry(context, page)).toBe(entries.current);
    await expectCoherent(page, count);
    await answer(page);
    await expect.poll(async () => (await reviews(page)).length).toBe(count + 1);
    await expectCoherent(page, count + 1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await proxy.close();
  }
});
