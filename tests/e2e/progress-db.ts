import type { Page } from "@playwright/test";

/** The legacy localStorage entry that older releases wrote and tests seed. */
export const LEGACY_KEY = "roshana-v1";

/**
 * Read saved progress from IndexedDB, assembled exactly as the app loads it:
 * the profile, cards and skills, and the review history from non-undone
 * review events in time order. Waits until the app has finished loading.
 */
export async function readProgress(page: Page): Promise<{ version: number; state: any; events: any[]; sessions: any[] }> {
  await page.locator("html[data-progress-ready]").waitFor({ state: "attached" });
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("vajefy");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction(["profile", "cards", "skills", "events", "sessions", "meta"], "readonly");
    const read = <T,>(request: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const profile = await read(tx.objectStore("profile").get("profile"));
    const cardKeys = await read(tx.objectStore("cards").getAllKeys());
    const cardValues = await read(tx.objectStore("cards").getAll());
    const skillKeys = await read(tx.objectStore("skills").getAllKeys());
    const skillValues = await read(tx.objectStore("skills").getAll());
    const events = await read(tx.objectStore("events").getAll());
    const sessions = await read(tx.objectStore("sessions").getAll());
    const version = await read(tx.objectStore("meta").get("progressVersion"));
    db.close();
    const history = events
      .filter((event) => event.type === "review" && event.review && !event.undone)
      .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
      .map((event) => event.review);
    return {
      version: typeof version === "number" ? version : 4,
      state: profile
        ? {
            ...profile,
            cards: Object.fromEntries(cardKeys.map((key, index) => [String(key), cardValues[index]])),
            practiceSkills: Object.fromEntries(skillKeys.map((key, index) => [String(key), skillValues[index]])),
            reviewHistory: history,
          }
        : null,
      events,
      sessions,
    };
  });
}
