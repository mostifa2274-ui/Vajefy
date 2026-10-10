import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { LEGACY_KEY, readProgress } from "./progress-db";

// Fixtures are served in place of the real data files, so service workers are
// blocked to let every request reach the route.
test.use({ serviceWorkers: "block" });

function seed(page: Page, focus: string, patch: Record<string, unknown> = {}) {
  const progress = {
    cards: {}, logs: [], lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
    streak: 0, lastStudyDate: null, xp: 0, lang: "en", focus, sessionSize: 20, newPerDay: 10,
    voice: false, accent: "en-GB", bookmarks: [], dailyGoal: 20, requestRetention: 0.9,
    reviewHistory: [], practiceSkills: {}, onboarded: true,
    ...patch,
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
  await page.getByRole("button", { name: /bring \/ take \/ fetch/ }).first().click();
  await expect(page.locator("article").getByText("Reviewed", { exact: true })).toHaveCount(0);
});

test("A1 reference links open the exact course-linked note without enrolling it", async ({ page }) => {
  await seed(page, "A1");
  await page.goto("/lexicon?q=make");
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached" });
  await page.getByRole("button", { name: /^make\s/ }).first().click();
  await page.getByText("Related reference notes", { exact: true }).click();
  await page.getByRole("link", { name: "do / make", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("n")).toBe("conf:do-make");
  await expect(page.locator("article h2")).toHaveText("do / make");
  await expect(page.getByRole("button", { name: "Add to review", exact: true })).toHaveCount(0);
  const saved = await readProgress(page);
  expect(saved.state.cards).toEqual({});
  expect(saved.state.logs.reduce((sum: number, log: { introduced: number }) => sum + log.introduced, 0)).toBe(0);
  await expect.poll(async () => (await readProgress(page)).events.some(event => event.type === "exposure" && event.item === "conf:do-make")).toBe(true);
});

test("an A1 direct link cannot display an unlinked reference note", async ({ page }) => {
  await seed(page, "A1");
  await page.goto("/library?d=conf&n=conf:raise-rise");
  await expect(page.getByRole("button", { name: /do \/ make/ }).first()).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await page.locator("main").getByRole("textbox", { name: "Search", exact: true }).fill("raise");
  await expect(page.getByText("Nothing matches that search.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /raise \/ rise/ })).toHaveCount(0);
});

test("A1 reference loading fails closed when its course links are unavailable", async ({ page }) => {
  const deckRequests: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/data/confusing.json")) deckRequests.push(request.url());
  });
  await page.route("**/data/a1-reference-links.json", route => route.fulfill({ status: 503, body: "unavailable" }));
  await seed(page, "A1");
  await page.goto("/library?d=conf&n=conf:do-make");
  await expect(page.getByRole("status")).toHaveText("The data could not be loaded.");
  await expect(page.locator("article")).toHaveCount(0);
  expect(deckRequests).toEqual([]);
});

test("a saved higher-level learner can still read and enrol an unlinked reference note", async ({ page }) => {
  await seed(page, "A2");
  await page.goto("/library?d=conf&n=conf:raise-rise");
  await expect(page.locator("article h2")).toHaveText("raise / rise");
  await page.getByRole("button", { name: "Add to review", exact: true }).click();
  await expect.poll(async () => Boolean((await readProgress(page)).state.cards["conf:raise-rise"])).toBe(true);
});

test("A1 replaces a mixed interrupted review without deleting its saved cards or history", async ({ page }) => {
  const now = Date.now();
  const last = now - 15 * 86_400_000;
  const card = {
    ease: 2.5, interval: 15, due: now - 60_000, reps: 5, lapses: 0, state: "review", step: 0, last,
    fsrs: { model: "fsrs6", stability: 15, difficulty: 5, scheduledDays: 15, learningSteps: 0, state: "review", lastReview: last },
  };
  await seed(page, "A1", {
    newPerDay: 0,
    cards: Object.fromEntries(["lex:A1:about", "lex:A2:ability", "conf:do-make"].map(id => [id, card])),
  });
  await page.goto("/");
  const before = await readProgress(page);
  const mixed = {
    id: "legacy-mixed-review", kind: "review", status: "active", createdAt: now, updatedAt: now, focus: "A1",
    queue: [{ id: "conf:do-make", isNew: false, dueAt: 0 }, { id: "lex:A1:about", isNew: false, dueAt: 0 }],
    taught: [], revealed: false, answers: [{ op: "past-answer", item: "lex:A2:ability", grade: "good", at: now - 100 }], total: 3,
  };
  await page.evaluate(async session => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("vajefy");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }, mixed);
  await page.reload();
  await expect(page.getByRole("link", { name: /Continue your review/ })).toHaveCount(0);
  const requests: string[] = [];
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  await page.goto("/study");
  await expect(page.locator("main h2[lang=en]").first()).toHaveText("about");
  await expect.poll(async () => (await readProgress(page)).sessions.find(session => session.id === mixed.id)?.status).toBe("done");
  await expect.poll(async () => (await readProgress(page)).sessions.filter(session => session.status === "active").length).toBe(1);
  const after = await readProgress(page);
  expect(after.state.cards).toEqual(before.state.cards);
  expect(after.events.filter(event => event.type === "review")).toEqual(before.events.filter(event => event.type === "review"));
  const archived = after.sessions.find(session => session.id === mixed.id);
  expect(archived.queue).toEqual(mixed.queue);
  expect(archived.answers).toEqual(mixed.answers);
  expect(after.sessions.find(session => session.status === "active").queue.map((item: { id: string }) => item.id)).toEqual(["lex:A1:about"]);
  expect(requests.filter(path => path === "/data/lex-a2.json" || path === "/data/confusing.json")).toEqual([]);
});
