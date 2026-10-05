import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY } from "./progress-db";

// Fixtures are served in place of the real data files, so service workers are
// blocked to let every request reach the route.
test.use({ serviceWorkers: "block" });

function seed(page: Page, focus: string) {
  const progress = {
    cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
    streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus, sessionSize: 20, newPerDay: 10,
    voice: false, accent: "en-GB", bookmarks: [], dailyGoal: 20, requestRetention: 0.9,
    reviewHistory: [], practiceSkills: {}, onboarded: true,
  };
  return page.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, raw);
      sessionStorage.setItem("seeded", "1");
    }
  }, { key: LEGACY_KEY, raw: JSON.stringify({ state: progress, version: 5 }) });
}

test("an A2 learner's lessons start with the A2 entries that have enhanced content", async ({ page }) => {
  // The compiled content, plus one entry written for A2 (docs/CATALOGUE.md),
  // listed in the app's index with its own part.
  const compiled = JSON.parse(readFileSync("content/compiled/enhanced.json", "utf8"));
  const catalogue = JSON.parse(readFileSync("public/data/enhanced/index.json", "utf8"));
  const order = JSON.parse(readFileSync("public/data/enhanced-order.json", "utf8"));
  const { review: _review, ...source } = compiled.entries.find((entry: { id: string }) => entry.id === "lex:A1:time");
  const a2 = {
    ...source,
    id: "lex:A2:ability",
    headword: "ability",
    order: compiled.entries.length,
    // No A2 curriculum is mapped, so the entry has no unit or prerequisites.
    unit: null,
    prerequisites: [],
    senses: source.senses.map((sense: { id: string }, position: number) => ({
      ...sense,
      id: position === 0 ? "lex:A2:ability" : `lex:A2:ability#${sense.id.split("#")[1]}`,
      gloss: position === 0 ? "توانایی" : (sense as { gloss: string }).gloss,
    })),
  };
  const ids = a2.senses.map((sense: { id: string }) => sense.id);
  const listed = {
    id: a2.id,
    headword: a2.headword,
    goals: a2.goals,
    version: a2.version,
    released: a2.released,
    unit: null,
    part: catalogue.parts.length,
    senses: a2.senses.map(({ id, pos, gloss }: { id: string; pos: string; gloss: string }) => ({ id, pos, gloss })),
  };
  await page.route("**/data/enhanced/index.json", (route) =>
    route.fulfill({ json: { ...catalogue, parts: [...catalogue.parts, "enhanced/a2-test.json"], entries: [...catalogue.entries, listed] } }),
  );
  await page.route("**/data/enhanced/a2-test.json", (route) => route.fulfill({ json: { entries: [a2], audio: {} } }));
  await page.route("**/data/enhanced-order.json", (route) =>
    route.fulfill({ json: { ...order, order: Object.fromEntries(Object.entries(order.order).map(([goal, list]) => [goal, [...(list as string[]), ...ids]])) } }),
  );
  await seed(page, "A2");
  await page.goto("/learn");
  const upcoming = page.locator("main ul[lang=en] li");
  await expect(upcoming.first()).toContainText("ability");
  await expect(upcoming.first()).toContainText("توانایی");
  // Today offers the same lesson, for this level's words only. The word's
  // further sense waits for a later lesson, once its first has been met.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start lesson · 1 new words", exact: true })).toBeVisible();
});

test("reference notes a bilingual reviewer approved are marked as reviewed", async ({ page }) => {
  await page.route("**/data/reference-reviewed.json", (route) => route.fulfill({ json: { version: "test", reviewed: ["conf:do-make"] } }));
  await seed(page, "A1");
  await page.goto("/library?d=conf");
  // Saved progress switches the page to English, which rebuilds it; open the
  // note after that, or the rebuild closes it again.
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached" });
  await page.getByRole("button", { name: /do \/ make/ }).first().click();
  const detail = page.locator("article");
  await expect(detail.getByText("Reviewed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await page.goto("/library?d=conf");
  await page.getByRole("button", { name: /raise \/ rise/ }).first().click();
  await expect(page.locator("article").getByText("Reviewed", { exact: true })).toHaveCount(0);
});
