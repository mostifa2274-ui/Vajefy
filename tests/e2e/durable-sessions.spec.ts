import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";

const DAY = 86_400_000;
const DUE = ["lex:A1:about", "lex:A1:above", "lex:A1:across"];
type ControlledWindow = Window & { denyProgressWrites: boolean };

/** Three review cards due now, no new words, and three resting cards for practice. */
async function seed(page: Page) {
  await page.addInitScript(({ key, due, day }) => {
    if (localStorage.getItem(key)) return;
    const now = Date.now();
    const card = (dueAt: number) => ({
      ease: 2.5, interval: 15, due: dueAt, reps: 5, lapses: 0, state: "review", step: 0, last: now - 15 * day,
      fsrs: { model: "fsrs6", stability: 15, difficulty: 5, scheduledDays: 15, learningSteps: 0, state: "review", lastReview: now - 15 * day },
    });
    const cards: Record<string, unknown> = Object.fromEntries(due.map((id: string) => [id, card(now - 60_000)]));
    for (const id of ["lex:A1:add", "lex:A1:address", "lex:A1:adult"]) cards[id] = card(now + 10 * day);
    localStorage.setItem(key, JSON.stringify({ version: 4, state: {
      cards, logs: [], lifetime: { reviews: 20, correct: 18, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 100, lang: "en", focus: "A1",
      sessionSize: 20, newPerDay: 0, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
    } }));
  }, { key: LEGACY_KEY, due: DUE, day: DAY });
}

async function denyWrites(page: Page) {
  await page.addInitScript(() => {
    (window as ControlledWindow).denyProgressWrites = sessionStorage.getItem("deny") === "1";
    for (const method of ["put", "add", "delete", "clear"] as const) {
      const original = IDBObjectStore.prototype[method] as (...args: unknown[]) => IDBRequest;
      Object.defineProperty(IDBObjectStore.prototype, method, {
        configurable: true,
        value(this: IDBObjectStore, ...args: unknown[]) {
          if ((window as ControlledWindow).denyProgressWrites && this.transaction.db.name === "vajefy") {
            throw new DOMException("Simulated browser quota", "QuotaExceededError");
          }
          return original.apply(this, args);
        },
      });
    }
  });
}

async function currentWord(page: Page) {
  return (await page.locator("main h2[lang=en]").first().innerText()).trim();
}

async function grade(page: Page, label: "Again" | "Good") {
  await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
}

async function reviews(page: Page) {
  return (await readProgress(page)).events.filter((event) => event.type === "review" && !event.undone);
}

test("a review left midway resumes at the next card and counts every answer once", async ({ page }) => {
  await seed(page);
  await page.goto("/study");
  const first = await currentWord(page);
  await grade(page, "Good");
  await expect.poll(async () => (await reviews(page)).length).toBe(1);
  const second = await currentWord(page);
  expect(second).not.toBe(first);

  await page.reload();
  await expect(page.getByText("Picking up where you left off.", { exact: true })).toBeVisible();
  expect(await currentWord(page)).toBe(second);
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Continue your review · 2 left/ })).toBeVisible();
  await page.getByRole("link", { name: /Continue your review/ }).click();
  expect(await currentWord(page)).toBe(second);
  await grade(page, "Good");
  await grade(page, "Good");
  await expect(page.getByRole("heading", { name: "This sitting is finished", exact: true })).toBeVisible();
  const done = await reviews(page);
  expect(done.map((event) => event.item).sort()).toEqual([...DUE].sort());
  expect((await readProgress(page)).state.lifetime.reviews).toBe(23);
  expect((await readProgress(page)).sessions.every((session) => session.status === "done")).toBe(true);
  await page.reload();
  await expect(page.getByText("Picking up where you left off.", { exact: true })).toHaveCount(0);
});

test("closing the tab right after answering loses and duplicates nothing", async ({ context }) => {
  const page = await context.newPage();
  await seed(page);
  await page.goto("/study");
  const first = await currentWord(page);
  await page.getByRole("button", { name: "Show the meaning", exact: true }).click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await page.close();

  const reopened = await context.newPage();
  await reopened.goto("/study");
  await expect(reopened.getByText("Picking up where you left off.", { exact: true })).toBeVisible();
  expect(await currentWord(reopened)).not.toBe(first);
  const answered = await reviews(reopened);
  expect(answered).toHaveLength(1);
  expect(answered[0].item).toBe(`lex:A1:${first}`);
});

test("an answer whose write failed is replayed exactly once after a reload", async ({ page }) => {
  await seed(page);
  await denyWrites(page);
  await page.goto("/study");
  await readProgress(page);
  await page.evaluate(() => {
    sessionStorage.setItem("deny", "1");
    (window as ControlledWindow).denyProgressWrites = true;
  });
  const first = await currentWord(page);
  await grade(page, "Good");
  await expect(page.getByRole("alert")).toContainText("Progress could not be saved");
  expect(await reviews(page)).toHaveLength(0);

  await page.evaluate(() => sessionStorage.removeItem("deny"));
  await page.reload();
  await expect.poll(async () => (await reviews(page)).length).toBe(1);
  expect((await reviews(page))[0].item).toBe(`lex:A1:${first}`);
  await expect(page.getByRole("alert")).toHaveCount(0);
  // The session saved with that answer resumes after it.
  expect(await currentWord(page)).not.toBe(first);
  await page.reload();
  expect(await reviews(page)).toHaveLength(1);
});

test("an accidental grade can be undone and graded again", async ({ page }) => {
  await seed(page);
  await page.goto("/study");
  const first = await currentWord(page);
  await grade(page, "Again");
  await expect.poll(async () => (await reviews(page)).length).toBe(1);
  await page.getByRole("button", { name: "Undo last grade", exact: true }).click();
  expect(await currentWord(page)).toBe(first);
  await expect(page.getByRole("button", { name: /^Good/ })).toBeVisible();
  await expect.poll(async () => (await reviews(page)).length).toBe(0);
  expect((await readProgress(page)).state.lifetime.reviews).toBe(20);
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect.poll(async () => (await reviews(page)).map((event) => event.grade)).toEqual(["good"]);
});

test("a practice round resumes at the question where it was left", async ({ page }) => {
  await seed(page);
  await page.goto("/drill?play=studied");
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
  const total = Number((await page.getByText(/^1 \/ \d+$/).innerText()).split("/")[1]);
  await page.getByRole("group").getByRole("button").first().click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(`2 / ${total}`, { exact: true })).toBeVisible();

  await page.reload();
  const resume = page.getByRole("button", { name: "Continue your practice", exact: true });
  await expect(resume).toBeVisible();
  await expect(page.getByText(`${total - 1} left`)).toBeVisible();
  await resume.click();
  await expect(page.getByText(`2 / ${total}`, { exact: true })).toBeVisible();
  expect((await readProgress(page)).events.filter((event) => event.type === "practice")).toHaveLength(1);
});
