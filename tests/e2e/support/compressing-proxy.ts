import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|manifest\+json)|image\/svg)/;

/**
 * The local Worker preview serves files uncompressed, while Cloudflare
 * compresses them in production. Performance budgets are measured through this
 * proxy, which gzips text responses, so throttled transfer times are realistic.
 */
export async function startCompressingProxy(target: string): Promise<{ url: string; close: () => Promise<void> }> {
  const upstream = new URL(target);
  const server: Server = createServer((incoming, outgoing) => {
    const forward = request(
      { host: upstream.hostname, port: upstream.port, path: incoming.url, method: incoming.method, headers: { ...incoming.headers, host: upstream.host, "accept-encoding": "identity" } },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          let body = Buffer.concat(chunks);
          const headers = { ...response.headers };
          const type = String(headers["content-type"] ?? "");
          if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(String(incoming.headers["accept-encoding"] ?? "")) && body.length > 1024) {
            body = gzipSync(body);
            headers["content-encoding"] = "gzip";
            headers.vary = "accept-encoding";
          }
          delete headers["transfer-encoding"];
          headers["content-length"] = String(body.length);
          outgoing.writeHead(response.statusCode ?? 502, headers);
          outgoing.end(body);
        });
      },
    );
    forward.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(forward);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
