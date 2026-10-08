import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type SwitchingProxy = {
  origin: string;
  /** Serve every later request from this deployment, as a Cloudflare rollback does. */
  deploy(target: string): void;
  close(): Promise<void>;
};

/** One origin in front of two deployments, so the browser keeps its storage across a rollback. */
export async function switchingProxy(initial: string): Promise<SwitchingProxy> {
  let upstream = new URL(initial);
  const server: Server = createServer((incoming, outgoing) => {
    const forward = request(
      {
        host: upstream.hostname,
        port: upstream.port,
        path: incoming.url,
        method: incoming.method,
        headers: { ...incoming.headers, host: upstream.host },
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
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
    origin: `http://127.0.0.1:${port}`,
    deploy(target) {
      upstream = new URL(target);
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
