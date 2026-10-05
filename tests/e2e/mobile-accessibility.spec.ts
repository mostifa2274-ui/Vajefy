import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY } from "./progress-db";

/** WCAG 2.2 AA checks for the four destinations, focus, reflow and layouts. */

// The reflow checks inject user style sheets, as text-resizing tools do.
test.use({ bypassCSP: true });

const ROUTES = ["/", "/learn", "/study", "/drill", "/lexicon", "/library", "/progress"];

async function seed(page: Page, lang: "fa" | "en", extra: Record<string, unknown> = {}) {
  await page.addInitScript(({ key, lang, extra }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang, focus: "A1",
      sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 10, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes: 5, ...extra,
    } }));
  }, { key: LEGACY_KEY, lang, extra });
}

/** Two A1 cards that are due, so Review has something to show. */
function dueCards() {
  const day = 86_400_000;
  const card = (now: number) => ({
    ease: 2.5, interval: 3, due: now - day, reps: 2, lapses: 0, state: "review", step: 0, last: now - 4 * day,
    fsrs: { model: "fsrs6", stability: 3, difficulty: 5, scheduledDays: 3, learningSteps: 0, state: "review", lastReview: now - 4 * day },
  });
  const now = Date.now();
  return { "lex:A1:about": card(now), "lex:A1:above": card(now) };
}

async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector("html[data-progress-ready]");
  await expect(page.locator("main")).toBeVisible();
}

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const violations = results.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) }));
  expect(violations, `${label}: ${JSON.stringify(violations)}`).toEqual([]);
}

function overflows(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test("every screen passes automated WCAG 2.2 AA checks in Persian and English", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, "fa");
  for (const path of ROUTES) {
    await ready(page, path);
    await axe(page, `fa ${path}`);
  }
  await page.evaluate(() => localStorage.setItem("vajefy-lang", "en"));
  await ready(page, "/progress");
  await page.getByRole("button", { name: "English", exact: true }).click();
  for (const path of ROUTES) {
    await ready(page, path);
    await axe(page, `en ${path}`);
  }
});

test("the app has four destinations, and Learn and Words have section tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, "en");
  await ready(page, "/study");
  const dock = page.getByRole("navigation", { name: "Main sections" });
  await expect(dock.getByRole("link")).toHaveText(["Today", "Learn", "Words", "Progress"]);
  await expect(dock.getByRole("link", { name: "Learn" })).toHaveAttribute("aria-current", "page");
  const tabs = page.getByRole("navigation", { name: "Learn sections" });
  await expect(tabs.getByRole("link")).toHaveText(["Lessons", "Review", "Practice"]);
  await expect(tabs.getByRole("link", { name: "Review" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/drill$/);
  await expect(page.getByRole("heading", { name: "Practice", exact: true })).toBeVisible();

  await dock.getByRole("link", { name: "Words" }).click();
  await expect(page.getByRole("navigation", { name: "Words sections" }).getByRole("link")).toHaveText(["Lexicon", "Reference"]);
  await expect(dock.getByRole("link", { name: "Words" })).toHaveAttribute("aria-current", "page");
});

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  await seed(page, "en");
  await ready(page, "/progress");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("keyboard focus is always visible and never hidden behind the dock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, "fa");
  await ready(page, "/progress");
  let visited = 0;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const problem = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      // Past the last control, focus leaves the page for the browser itself.
      if (!active || active === document.body) return "end";
      const style = getComputedStyle(active);
      const name = `${active.tagName} ${(active.textContent ?? "").trim().slice(0, 30)}`;
      if (style.outlineStyle === "none" || parseFloat(style.outlineWidth) < 2) return `no visible focus on ${name}`;
      const dock = document.querySelector(".dock");
      if (dock && !dock.contains(active)) {
        const a = active.getBoundingClientRect();
        const d = dock.getBoundingClientRect();
        if (a.bottom > d.top && a.top < d.bottom) return `${name} is under the dock`;
      }
      return null;
    });
    if (problem === "end") break;
    expect(problem).toBeNull();
    visited++;
  }
  expect(visited).toBeGreaterThan(20);
});

test("a lesson can be done with the keyboard, and focus follows each step", async ({ page }) => {
  await seed(page, "en");
  await ready(page, "/learn");
  await page.getByRole("button", { name: /Start lesson/ }).focus();
  await page.keyboard.press("Enter");
  const recall = page.getByRole("button", { name: "Now recall it", exact: true });
  await recall.focus();
  await page.keyboard.press("Enter");
  // Written retrieval: type the word and submit with Enter. The answer field is
  // locked after answering, so focus moves on.
  const answer = page.getByRole("textbox", { name: "Your answer", exact: true });
  await answer.focus();
  await page.keyboard.type("I");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: /Correct|Incorrect/ })).toBeVisible();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test("Review keeps focus on the card after revealing and grading", async ({ page }) => {
  await seed(page, "en", { cards: dueCards() });
  await ready(page, "/study");
  await page.getByRole("button", { name: "Show the meaning", exact: true }).focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  await page.keyboard.press("3");
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("H2");
});

test("the dock steps aside while typing so the answer and its button stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await seed(page, "en");
  await ready(page, "/lexicon");
  const dock = page.getByRole("navigation", { name: "Main sections" });
  await expect(dock).toBeVisible();
  await page.getByRole("textbox", { name: "Search" }).first().focus();
  await expect(dock).toBeHidden();
  await page.locator("main h1").click();
  await expect(dock).toBeVisible();
});

test("content reflows at 320 px, with 200% text and with WCAG text spacing", async ({ page }) => {
  test.setTimeout(120_000);
  for (const lang of ["fa", "en"] as const) {
    const context = await page.context().browser()!.newContext({ viewport: { width: 320, height: 640 }, bypassCSP: true });
    const view = await context.newPage();
    await seed(view, lang);
    for (const path of ROUTES) {
      await ready(view, path);
      expect(await overflows(view), `${lang} ${path} at 320 px`).toBe(false);
    }
    await view.setViewportSize({ width: 390, height: 844 });
    await view.addStyleTag({ content: "html { font-size: 200% !important; }" });
    for (const path of ROUTES) {
      await ready(view, path);
      await view.addStyleTag({ content: "html { font-size: 200% !important; }" });
      expect(await overflows(view), `${lang} ${path} with 200% text`).toBe(false);
      const clipped = await view.evaluate(() =>
        [...document.querySelectorAll(".dock a, main button, main a")]
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => (element.textContent ?? "").trim().slice(0, 30)),
      );
      expect(clipped, `${lang} ${path} clipped controls with 200% text`).toEqual([]);
    }
    for (const path of ROUTES) {
      await ready(view, path);
      await view.addStyleTag({
        content: "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
      });
      expect(await overflows(view), `${lang} ${path} with text spacing`).toBe(false);
    }
    await context.close();
  }
});

test("landscape phones and tablets keep navigation and content usable", async ({ page }) => {
  await seed(page, "fa");
  for (const [width, height] of [[844, 390], [768, 1024], [1024, 768], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    for (const path of ["/", "/learn", "/lexicon", "/progress"]) {
      await ready(page, path);
      expect(await overflows(page), `${path} at ${width}×${height}`).toBe(false);
      await expect(page.getByRole("navigation", { name: "بخش‌های اصلی" }).locator("visible=true")).toHaveCount(1);
      await expect(page.locator("main h1").first()).toBeInViewport();
    }
  }
});
