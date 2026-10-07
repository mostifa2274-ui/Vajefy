import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY } from "./progress-db";
import { bidiLint, type BidiFinding } from "./support/bidi-lint";
import { learnerStep } from "./support/learner";

/**
 * Bidi lint (plan §14, U3) over every screen, a word's detail, a whole
 * lesson, a Review session and Smart Practice, in both interface languages.
 */

const ROUTES = ["/", "/learn", "/study", "/drill", "/lexicon", "/library", "/progress"];
const DAY = 86_400_000;

function card(due: number, now: number) {
  return {
    ease: 2.5, interval: 3, due, reps: 2, lapses: 0, state: "review", step: 0, last: now - 4 * DAY,
    fsrs: { model: "fsrs6", stability: 3, difficulty: 5, scheduledDays: 3, learningSteps: 0, state: "review", lastReview: now - 4 * DAY },
  };
}

async function seed(page: Page, lang: "fa" | "en") {
  const now = Date.now();
  // Two words due for Review, and studied words that Smart Practice may use.
  const cards = {
    "lex:A1:i": card(now - DAY, now),
    "lex:A1:you": card(now - DAY, now),
    ...Object.fromEntries(["lex:A1:be", "lex:A1:my", "lex:A1:your", "lex:A1:name", "lex:A1:what", "lex:A1:this"].map((id) => [id, card(now + 10 * DAY, now)])),
  };
  await page.addInitScript(({ key, lang, cards }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang, focus: "A1",
      sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 10, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes: 5,
    } }));
  }, { key: LEGACY_KEY, lang, cards });
}

type Located = BidiFinding & { at: string };

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector("html[data-progress-ready]");
}

/** Lints each screen of a session until it ends or nothing is left to do. */
async function walk(page: Page, label: string, end: RegExp, limit: number, out: Located[]) {
  for (let step = 0; step < limit; step += 1) {
    await page.waitForTimeout(100);
    out.push(...(await bidiLint(page)).map((item) => ({ ...item, at: `${label} step ${step}` })));
    if (await page.locator("main").getByText(end).first().isVisible().catch(() => false)) return step;
    if (!(await learnerStep(page))) return step;
  }
  return limit;
}

for (const lang of ["fa", "en"] as const) {
  test(`${lang} interface: mixed Persian and English keeps its direction and language`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, lang);
    const found: Located[] = [];
    for (const path of ROUTES) {
      await open(page, path);
      found.push(...(await bidiLint(page)).map((item) => ({ ...item, at: path })));
    }

    await open(page, "/lexicon?q=you");
    await page.locator("main ul button").first().click();
    found.push(...(await bidiLint(page)).map((item) => ({ ...item, at: "word detail" })));

    await open(page, "/learn");
    await page.getByRole("button", { name: lang === "en" ? /Start lesson/ : /شروع درس/ }).click();
    const lessonSteps = await walk(page, "lesson", lang === "en" ? /^Lesson complete$/ : /^درس تمام شد$/, 120, found);
    expect(lessonSteps, "the lesson reaches its end").toBeLessThan(120);

    await open(page, "/study");
    await walk(page, "review", lang === "en" ? /^This sitting is finished$/ : /^این نوبت تمام شد$/, 12, found);

    await open(page, "/drill");
    await page.getByRole("button", { name: lang === "en" ? "Begin" : "شروع", exact: true }).first().click();
    await walk(page, "practice", lang === "en" ? /^This sitting is finished$/ : /^این نوبت تمام شد$/, 40, found);

    const unique = [...new Map(found.map((item) => [`${item.rule}|${item.text}|${item.where}`, item])).values()];
    expect(unique, unique.map((item) => `${item.rule} at ${item.at} (${item.direction}/${item.lang}) ${item.where}: ${item.text}\n  ${item.html}`).join("\n")).toEqual([]);
  });
}
