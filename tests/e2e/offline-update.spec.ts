import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const template = readFileSync("public/sw.js", "utf8");
const completeMarker = "/__vajefy_release_complete__";

test("an open tab keeps its complete release while two newer workers wait", async ({ browser }) => {
  let release = "a";
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (pathname === "/sw.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.setHeader("Service-Worker-Allowed", "/");
      response.setHeader("ETag", `"${release}"`);
      response.end(
        template
          .replace('/* __VAJEFY_BUILD_VERSION__ */ "dev"', `/* __VAJEFY_BUILD_VERSION__ */ "${release}"`)
          .replace(
            "/* __VAJEFY_BUILD_ASSETS__ */ []",
            `/* __VAJEFY_BUILD_ASSETS__ */ ["/assets/${release}.js"]`,
          ),
      );
      return;
    }
    if (pathname.startsWith("/assets/")) {
      const wanted = `/assets/${release}.js`;
      response.statusCode = pathname === wanted ? 200 : 404;
      response.setHeader("Content-Type", "text/javascript");
      response.end(pathname === wanted ? `asset-${release}` : `missing-${pathname}`);
      return;
    }
    if (pathname.startsWith("/data/")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ release }));
      return;
    }
    if (pathname === "/manifest.json") {
      response.setHeader("Content-Type", "application/json");
      response.end("{}");
      return;
    }
    if (pathname.endsWith(".png") || pathname.endsWith(".svg")) {
      response.setHeader("Content-Type", "image/svg+xml");
      response.end("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end(`<html><head><script src="/assets/${release}.js"></script></head><body>${release}</body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
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
    release = version;
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
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
