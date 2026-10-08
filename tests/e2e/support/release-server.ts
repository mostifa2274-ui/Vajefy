import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const template = readFileSync("public/sw.js", "utf8");

export type ReleaseServer = {
  origin: string;
  /** Serve this release next. A broken release cannot deliver its build asset. */
  serve(release: string, options?: { broken?: boolean }): void;
  close(): Promise<void>;
};

/**
 * A tiny origin that serves the real service worker with one build asset per
 * release, so a test can publish updates without rebuilding the app.
 */
export async function releaseServer(): Promise<ReleaseServer> {
  let release = "a";
  let broken = false;
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
      response.statusCode = pathname === wanted && !broken ? 200 : pathname === wanted ? 503 : 404;
      response.setHeader("Content-Type", "text/javascript");
      response.end(pathname === wanted && !broken ? `asset-${release}` : `missing-${pathname}`);
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
  return {
    origin: `http://127.0.0.1:${port}`,
    serve(next, options = {}) {
      release = next;
      broken = options.broken ?? false;
    },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
