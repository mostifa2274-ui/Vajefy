import { expect, test } from "@playwright/test";
import { releaseServer } from "./support/release-server";

const completeMarker = "/__vajefy_release_complete__";

test("an open tab keeps its complete release while two newer workers wait", async ({ browser }) => {
  const server = await releaseServer();
  const origin = server.origin;
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();

  async function marker(version: string) {
    return page.evaluate(
      async ({ cacheName, markerPath }) => {
        if (!(await caches.keys()).includes(cacheName)) return null;
        return (await (await caches.open(cacheName)).match(markerPath))?.text() ?? null;
      },
      { cacheName: `vajefy-offline-${version}`, markerPath: completeMarker },
    );
  }

  async function update(version: string) {
    server.serve(version);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect.poll(() => marker(version)).toBe(version);
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
  }

  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect.poll(() => marker("a")).toBe("a");

    await update("b");
    await update("c");

    expect(await page.evaluate(() => caches.keys())).toContain("vajefy-offline-a");
    expect(await page.evaluate(() => fetch("/assets/a.js").then((response) => response.text()))).toBe("asset-a");
  } finally {
    await context.close();
    await server.close();
  }
});
