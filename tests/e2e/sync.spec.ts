import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { sqliteD1 } from "../../src/api/d1-sqlite";
import { handleSync } from "../../src/api/sync";
import { LEGACY_KEY, readProgress } from "./progress-db";

// Requests are answered by the real sync handler over an in-memory database,
// as the Worker would with sync turned on. Service workers are blocked so
// every request reaches the route.
test.use({ serviceWorkers: "block" });

const DAY = 86_400_000;

function progress(now: number, cards: Record<string, unknown>, reviews: number) {
  return {
    cards,
    logs: [], lifetime: { reviews, correct: reviews, practice: 0, practiceCorrect: 0 },
    streak: 0, lastStudyDate: null, xp: reviews * 10, lang: "en", focus: "A1",
    sessionSize: 20, newPerDay: 10, voice: false, accent: "en-GB", bookmarks: [],
    dailyGoal: 20, requestRetention: 0.9, reviewHistory: [], practiceSkills: {}, onboarded: true,
  };
}

const card = (now: number) => ({ ease: 2.5, interval: 3, due: now + 3 * DAY, reps: 2, lapses: 0, state: "review", step: 0, last: now });

/** A device with its own browser storage, talking to the shared sync server. */
async function device(browser: Browser, server: D1DatabaseLike, saved: ReturnType<typeof progress>): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/api/sync/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/sync/status") return route.fulfill({ json: { enabled: true } });
    const response = await handleSync(new Request(url, { method: request.method(), headers: await request.allHeaders(), body: request.postData() ?? undefined }), server);
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  const page = await context.newPage();
  await page.addInitScript(({ key, raw }) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem(key, raw);
    sessionStorage.setItem("seeded", "1");
  }, { key: LEGACY_KEY, raw: JSON.stringify({ state: saved, version: 5 }) });
  await page.goto("/progress");
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached" });
  return page;
}

test("two devices pair with a code and share progress, which the server cannot read", async ({ browser }) => {
  const server = sqliteD1();
  const now = Date.now();
  const phone = await device(browser, server, progress(now, { "lex:A1:about": card(now) }, 6));
  const panel = phone.getByTestId("sync-panel");
  await expect(panel.getByRole("heading", { name: "Sync between devices" })).toBeVisible();
  await panel.getByRole("button", { name: "Turn on sync", exact: true }).click();
  const code = (await panel.getByTestId("sync-code").textContent())!.trim();
  expect(code).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){4}-[0-9A-Z]$/);
  await expect(panel.getByRole("status")).toContainText("Last synced");
  const a11y = await new AxeBuilder({ page: phone }).include("[data-testid=sync-panel]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a11y.violations).toEqual([]);

  // Only encrypted data reached the server.
  const { results } = await server.prepare("SELECT op_id, data FROM sync_ops").all<{ op_id: string; data: string }>();
  expect(results.length).toBe(1);
  expect(Buffer.from(results[0]!.data, "base64").toString("latin1")).not.toContain("lex:A1");

  // A new device adopts the synced progress; the code is forgiving to type.
  const laptop = await device(browser, server, progress(now, {}, 0));
  const joining = laptop.getByTestId("sync-panel");
  await joining.getByRole("button", { name: "I have a code", exact: true }).click();
  await joining.getByLabel("Sync code").fill(code.toLowerCase().replace(/-/g, " "));
  await joining.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(joining.getByRole("status")).toContainText("Last synced");
  await expect.poll(async () => (await readProgress(laptop)).state.lifetime.reviews).toBe(6);
  expect(Object.keys((await readProgress(laptop)).state.cards)).toEqual(["lex:A1:about"]);

  // A device with progress of its own asks which to keep.
  const tablet = await device(browser, server, progress(now, { "lex:A1:above": card(now) }, 2));
  const choosing = tablet.getByTestId("sync-panel");
  await choosing.getByRole("button", { name: "I have a code", exact: true }).click();
  await choosing.getByLabel("Sync code").fill(code);
  await choosing.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(choosing.getByText("This device and the synced copy both have progress.", { exact: false })).toBeVisible();
  await choosing.getByRole("button", { name: "Use the synced progress", exact: true }).click();
  await expect.poll(async () => Object.keys((await readProgress(tablet)).state.cards)).toEqual(["lex:A1:about"]);

  // Stopping on one device keeps its progress and leaves the others syncing.
  await choosing.getByRole("button", { name: "Stop syncing on this device", exact: true }).click();
  await choosing.getByRole("button", { name: "Yes, stop syncing", exact: true }).click();
  await expect(choosing.getByRole("button", { name: "Turn on sync", exact: true })).toBeVisible();
  expect((await readProgress(tablet)).state.lifetime.reviews).toBe(6);

  // Deleting the synced copy stops the remaining devices, which say why.
  await panel.getByRole("button", { name: "Delete the synced copy", exact: true }).click();
  await panel.getByRole("button", { name: "Yes, delete it", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Turn on sync", exact: true })).toBeVisible();
  await joining.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(joining.getByText("The synced copy was deleted on another device", { exact: false })).toBeVisible();
  expect((await readProgress(laptop)).state.lifetime.reviews).toBe(6);
});

test("sync is not offered when the deployment has not turned it on", async ({ page }) => {
  await page.goto("/progress");
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached" });
  await expect(page.getByRole("heading", { name: "نسخهٔ پشتیبان" })).toBeVisible();
  await expect(page.getByTestId("sync-panel")).toHaveCount(0);
});
