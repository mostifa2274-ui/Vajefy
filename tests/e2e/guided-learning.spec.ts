import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";

async function accessible(page: Page) {
  const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
}

/** A new English-speaking learner at A1 with no reviews due. */
async function seedNewLearner(page: Page, minutes = 5) {
  await page.addInitScript(({ key, minutes }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus: "A1",
      sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 10, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
      goal: "general", minutes,
    } }));
  }, { key: LEGACY_KEY, minutes });
}

/** Answer whatever the current lesson step asks, without knowing the answers. */
async function step(page: Page): Promise<boolean> {
  const main = page.locator("main");
  // A Teach card draws the word at once and the rest, with its button, in a
  // deferred render (aria-busy meanwhile). Wait for the step to settle, or the
  // instant checks below can all run in that gap and find nothing.
  await expect(main.locator('[aria-busy="true"]')).toHaveCount(0);
  if (await page.getByRole("heading", { name: /^(Lesson|Check-up) complete$/ }).isVisible()) return false;
  const recall = main.getByRole("button", { name: "Now recall it", exact: true });
  if (await recall.isVisible()) {
    await recall.click();
    return true;
  }
  const next = main.getByRole("button", { name: "Next", exact: true });
  if (await next.isVisible()) {
    await next.click();
    return true;
  }
  const choices = main.getByRole("group").getByRole("button");
  if ((await choices.count()) && (await choices.first().isEnabled())) {
    await choices.first().click();
    return true;
  }
  const typed = main.getByRole("textbox", { name: "Your answer", exact: true });
  if (await typed.isVisible()) {
    await typed.fill("x");
    await main.getByRole("button", { name: "Check", exact: true }).click();
    return true;
  }
  const write = main.getByRole("textbox", { name: "Write", exact: true });
  if (await write.isVisible()) {
    await write.fill("I'd like some tea. Could you bring it, please?");
    await main.getByRole("button", { name: "Compare with a model", exact: true }).click();
    await main.getByRole("button", { name: "My answer works", exact: true }).click();
    return true;
  }
  const proceed = main.getByRole("button", { name: "Continue", exact: true });
  if (await proceed.isVisible()) {
    await proceed.click();
    return true;
  }
  throw new Error(`Unknown lesson step: ${(await main.innerText()).slice(0, 200)}`);
}

test("onboarding starts every new learner at A1 and records the goal and daily time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const level = page.getByRole("region", { name: "سطح شروع", exact: true });
  await expect(level).toBeVisible();
  await expect(level).toContainText("A1");
  // The A1 course is the only starting point: no level grid, no placement check.
  for (const other of ["A2", "B1", "B2", "C1"]) await expect(page.getByRole("button", { name: other })).toHaveCount(0);
  await accessible(page);
  await page.getByRole("button", { name: "کار", exact: true }).click();
  await page.getByRole("button", { name: /^۵/ }).click();
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect.poll(async () => (await readProgress(page)).state?.goal).toBe("work");
  const { state } = await readProgress(page);
  expect([state.focus, state.minutes, state.newPerDay, state.onboarded]).toEqual(["A1", 5, 3, true]);
  // With nothing due, the first step is a guided lesson.
  await expect(page.getByRole("link", { name: /شروع درس/ })).toBeVisible();
});

test("a guided lesson teaches, checks, applies and schedules its words", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedNewLearner(page);
  await page.goto("/");
  await page.getByRole("link", { name: /Start lesson · 2 new words/ }).click();
  await expect(page.getByRole("heading", { name: "Learn new words", exact: true })).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: /Start lesson/ }).click();
  await expect(page.getByRole("button", { name: "Now recall it", exact: true })).toBeVisible();
  await expect(page.getByText("Common mistake", { exact: true })).toBeVisible();
  await expect(page.getByText("Draft: awaiting bilingual review", { exact: true })).toBeVisible();
  await accessible(page);
  for (let i = 0; i < 60 && (await step(page)); i++);
  await expect(page.getByRole("heading", { name: "Lesson complete", exact: true })).toBeVisible();

  const { state, events, sessions } = await readProgress(page);
  const targets = Object.keys(state.cards);
  expect(targets).toHaveLength(2);
  // The delayed retrieval of each word is its first scheduled review.
  const reviews = events.filter((event) => event.type === "review");
  expect(reviews.map((event) => event.item).sort()).toEqual([...targets].sort());
  expect(reviews.every((event) => event.context?.prompt?.startsWith("lesson:delayed"))).toBe(true);
  expect(events.filter((event) => event.type === "practice").length).toBeGreaterThanOrEqual(4);
  expect(sessions.find((session) => session.kind === "lesson")?.status).toBe("done");
});

test("a listening question can be skipped without an answer, and readiness is shown apart from mastery", async ({ page }) => {
  test.setTimeout(90_000);
  await seedNewLearner(page);
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();
  const skip = page.getByRole("button", { name: "Skip listening", exact: true });
  let skipped = 0;
  for (let i = 0; i < 60; i++) {
    await expect(page.locator("main").locator('[aria-busy="true"]')).toHaveCount(0);
    if (!skipped && (await skip.isVisible())) {
      // The word is heard, never shown, until the question is answered.
      await expect(page.getByText("What did you hear?", { exact: true })).toBeVisible();
      await skip.click();
      skipped += 1;
      continue;
    }
    if (!(await step(page))) break;
  }
  expect(skipped).toBe(1);
  await expect(page.getByRole("heading", { name: "Lesson complete", exact: true })).toBeVisible();
  // Readiness for now, from unaided answers, is labelled apart from long-term mastery.
  await expect(page.getByRole("heading", { name: "Ready for now", exact: true })).toBeVisible();
  await expect(page.getByText(/Long-term mastery comes only from reviews/)).toBeVisible();
  await accessible(page);

  const { events } = await readProgress(page);
  const skips = events.filter((event) => event.type === "skip");
  expect(skips).toHaveLength(1);
  expect(skips[0].skill).toBe("listening");
  expect(skips[0].context?.prompt).toBe("lesson:listen:listen");
  // Typed written retrieval is recorded as its own skill, apart from context.
  expect(events.some((event) => event.type === "practice" && event.skill === "spelling" && event.context?.prompt === "lesson:retrieve:recall")).toBe(true);
});

test("the teaching card plays its model on arrival unless the learner turns autoplay off", async ({ page }) => {
  await seedNewLearner(page);
  // Count clip playback attempts without real audio.
  await page.addInitScript(() => {
    (window as unknown as { plays: string[] }).plays = [];
    HTMLMediaElement.prototype.play = function () {
      (window as unknown as { plays: string[] }).plays.push(this.src);
      return Promise.resolve();
    };
  });
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();
  const autoplay = page.getByRole("button", { name: "Autoplay", exact: true });
  await expect(autoplay).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => (window as unknown as { plays: string[] }).plays.length)).toBe(1);
  await autoplay.click();
  await expect(autoplay).toHaveAttribute("aria-pressed", "false");
  await expect(autoplay).toContainText("off");
  // The choice is kept on this device: the next card stays silent.
  await page.reload();
  await page.getByRole("button", { name: /Continue lesson/ }).click();
  await expect(page.getByRole("button", { name: "Autoplay", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { plays: string[] }).plays.length)).toBe(0);
});

test("an authored A1 task shows Persian support before the learner answers", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedNewLearner(page);
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();

  const support = page.getByRole("note", { name: "Support words" });
  for (let i = 0; i < 20 && !(await support.isVisible()); i++) {
    if (!(await step(page))) break;
  }

  await expect(support).toBeVisible();
  // The first curriculum lesson teaches "I" and "you"; its tasks gloss "am".
  await expect(support.getByText("am", { exact: true })).toBeVisible();
  await expect(support.getByText("هستم", { exact: true })).toBeVisible();
  await accessible(page);
});

test("a lesson left midway resumes at the same step", async ({ page }) => {
  await seedNewLearner(page, 10);
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();
  await page.getByRole("button", { name: "Now recall it", exact: true }).click();
  // Written retrieval: the first curriculum word, "I", typed from its Persian meaning.
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("I");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const counter = await page.locator("main").getByText(/^\d+ \/ \d+$/).first().innerText();
  await page.reload();
  await page.getByRole("button", { name: /Continue lesson/ }).click();
  await expect(page.locator("main").getByText(counter, { exact: true })).toBeVisible();
  // The answered question shows its result instead of asking again.
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  expect((await readProgress(page)).events.filter((event) => event.type === "practice")).toHaveLength(1);
});

test("the Words page shows every sense of a pilot entry with its teaching notes", async ({ page }) => {
  await seedNewLearner(page);
  await page.goto("/lexicon?q=close");
  // Saved progress switches the page to English, which rebuilds it; open the
  // word after that, or the rebuild closes it again.
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached" });
  await page.getByRole("button", { name: /^close/ }).first().click();
  const detail = page.locator("article");
  await expect(detail.getByText("بستن", { exact: true })).toBeVisible();
  await expect(detail.getByText("نزدیک", { exact: true })).toBeVisible();
  await expect(detail.getByText("/kləʊz/", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("/kləʊs/", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("Common mistake", { exact: true }).first()).toBeVisible();
});

test("recorded pronunciation downloads for offline use and plays from the cache", async ({ page, context }) => {
  test.setTimeout(90_000);
  await seedNewLearner(page);
  await page.goto("/progress");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const download = page.getByRole("button", { name: /^Download · / });
  await expect(download).toBeVisible();
  await download.click();
  await expect(page.getByText(/✓ Downloaded/)).toBeVisible({ timeout: 60_000 });
  const cached = await page.evaluate(async () => (await (await caches.open("vajefy-audio-v1")).keys()).length);
  expect(cached).toBeGreaterThan(500);

  await context.setOffline(true);
  const offline = await page.evaluate(async () => {
    const pack = await (await fetch("/data/enhanced/audio-pack.json")).json();
    const file = pack.gb.files[0];
    const response = await fetch(`/audio/${file}`);
    return { ok: response.ok, type: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength };
  });
  expect(offline.ok).toBe(true);
  expect(offline.bytes).toBeGreaterThan(1000);
  await context.setOffline(false);
});

/** An English learner who met four pilot words 35 days ago and is not due to review them yet. */
async function seedMonthOld(page: Page) {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key)) return;
    const day = 86_400_000;
    const now = Date.now();
    const ids = ["lex:A1:a-an", "lex:A1:the", "lex:A1:and", "lex:A1:but"];
    const card = {
      ease: 2.5, interval: 20, due: now + 10 * day, reps: 3, lapses: 0, state: "review", step: 0, last: now - 10 * day,
      fsrs: { model: "fsrs6", stability: 20, difficulty: 5, scheduledDays: 20, learningSteps: 0, state: "review", lastReview: now - 10 * day },
    };
    localStorage.setItem(key, JSON.stringify({ version: 5, state: {
      cards: Object.fromEntries(ids.map((id) => [id, card])),
      logs: [], lifetime: { reviews: 4, correct: 4, practice: 0, practiceCorrect: 0 },
      streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus: "A1",
      sessionSize: 10, newPerDay: 3, voice: false, accent: "en-GB", bookmarks: [],
      dailyGoal: 10, requestRetention: 0.9, practiceSkills: {}, onboarded: true, goal: "general", minutes: 5,
      reviewHistory: ids.map((id) => ({ id, at: now - 35 * day, grade: "good", algorithm: "fsrs6", targetRetention: 0.9, elapsedDays: 0, scheduledDays: 3, stability: 3, difficulty: 5 })),
    } }));
  }, LEGACY_KEY);
}

test("the 30-day check-up measures retention without touching the schedule, and the study file carries it", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMonthOld(page);
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "30-day check-up", exact: true })).toBeVisible();
  await accessible(page);
  const before = (await readProgress(page)).state.cards;
  const started = await page.evaluate(() => Date.now());
  await page.getByRole("button", { name: /Start check-up · 4 words/ }).click();
  for (let i = 0; i < 30 && (await step(page)); i++);
  await expect(page.getByRole("heading", { name: "Check-up complete", exact: true })).toBeVisible();
  await expect(page.getByText(/Recalled and used correctly: \d \/ 4/)).toBeVisible();

  const { state, events } = await readProgress(page);
  const assessments = events.filter((event) => event.type === "assessment");
  expect(assessments).toHaveLength(8);
  expect(assessments.every((event) => event.assessment.delayDays === 35)).toBe(true);
  const useAssessments = assessments.filter(
    (event) => event.assessment.part === "use" && !event.assessment.missing,
  );
  expect(useAssessments).toHaveLength(4);
  expect(
    useAssessments.every(
      (event) =>
        typeof event.context?.contentVersion === "string" &&
        event.context.contentVersion.length > 0 &&
        typeof event.context?.promptId === "string" &&
        event.context.promptId.startsWith(`${event.item}/`),
    ),
  ).toBe(true);
  // The seeded history was copied in as review events; the check-up adds none.
  expect(events.filter((event) => (event.type === "review" || event.type === "practice") && event.at >= started)).toHaveLength(0);
  expect(state.cards).toEqual(before);
  expect(state.lifetime).toEqual({ reviews: 4, correct: 4, practice: 0, practiceCorrect: 0 });

  await page.goto("/progress");
  await expect(page.getByText(/Latest 30-day check-up: Recalled and used correctly \d \/ 4/)).toBeVisible();
  const download = page.getByRole("button", { name: "Download study data", exact: true });
  await expect(download).toBeDisabled();
  await page.getByRole("textbox", { name: "Participant code", exact: true }).fill("P-017");
  const pending = page.waitForEvent("download");
  await download.click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/^vajefy-study-P-017-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(data.kind).toBe("vajefy-study");
  expect(data.version).toBe(2);
  expect(data.participant).toBe("P-017");
  expect(data.app.contentVersion).toEqual(expect.any(String));
  expect(data.app.contentVersion.length).toBeGreaterThan(0);
  expect(data.app.channel).toBe("draft");
  expect(data.app.build).toEqual(expect.any(String));
  expect(data.protocol.assessment).toEqual({
    id: "held-out-last-authored-v1",
    minimumDelayDays: 30,
    bankContentVersion: data.app.contentVersion,
  });
  expect(data.events.filter((event: { type: string }) => event.type === "assessment")).toHaveLength(8);
  expect(data.sessions.find((session: { mode?: string }) => session.mode === "checkup").answers.every((answer: object) => !("given" in answer))).toBe(true);
});

test("a learner can record themselves and compare with the model, and nothing is saved", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await seedNewLearner(page);
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();
  const before = await readProgress(page);
  await page.getByRole("button", { name: "Record myself", exact: true }).click();
  await expect(page.getByText("Recording…", { exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play mine", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play the model", exact: true })).toBeVisible();
  await expect(page.getByText("Your recording stays on this device and is gone when you leave this page.")).toBeVisible();
  await page.getByRole("button", { name: "Play mine", exact: true }).click();
  await accessible(page);
  expect((await readProgress(page)).events.length).toBe(before.events.length);
});

test("the coach appears only when its service is on, explains, and changes no progress", async ({ page }) => {
  test.setTimeout(90_000);
  await seedNewLearner(page);
  await page.goto("/learn");
  await page.getByRole("button", { name: /Start lesson/ }).click();
  // Off by default: no coach anywhere.
  for (let i = 0; i < 8 && (await step(page)); i++);
  await expect(page.getByRole("button", { name: /Ask the coach/ })).toHaveCount(0);

  const asked: unknown[] = [];
  await page.route("**/api/coach/status", (route) => route.fulfill({ json: { enabled: true } }));
  await page.route("**/api/coach", async (route) => {
    asked.push(route.request().postDataJSON());
    await route.fulfill({
      json: { reply: { verdict: "unsure", issue: "", explanation: "It depends on the situation.", corrected: "She brought the book.", next: "Try another sentence.", confidence: "low" } },
    });
  });
  await page.reload();
  await page.getByRole("button", { name: /Continue lesson/ }).click();
  const coach = page.getByRole("button", { name: "Ask the coach: why does this word fit here?", exact: true });
  for (let i = 0; i < 30 && !(await coach.isVisible()) && (await step(page)); i++);
  await expect(coach).toBeVisible();
  const before = (await readProgress(page)).events.length;
  await coach.click();
  await expect(page.getByText(/The coach is not sure/)).toBeVisible();
  await expect(page.getByText("An AI answer, which can be wrong. It does not count towards your progress.")).toBeVisible();
  expect(asked).toHaveLength(1);
  expect(asked[0]).toMatchObject({ task: "fit", lang: "en" });
  expect((await readProgress(page)).events.length).toBe(before);
  await accessible(page);
});
