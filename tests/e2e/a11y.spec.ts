import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const onboardedState = {
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

async function seed(page: Page) {
  await page.addInitScript((state) => {
    localStorage.setItem("roshana-v1", JSON.stringify({ state, version: 2 }));
  }, onboardedState);
}

async function expectWcagAa(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      failureSummary: node.failureSummary,
    })),
  }));

  expect(violations, `${label} accessibility violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

test("fresh mobile onboarding has no WCAG A/AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "سطح شروع" })).toBeVisible();
  await expectWcagAa(page, "mobile onboarding");
});

test("primary onboarded routes have no WCAG A/AA violations", async ({ page }) => {
  await seed(page);

  for (const path of ["/", "/lexicon", "/study", "/drill", "/library", "/progress"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expectWcagAa(page, path);
  }
});
