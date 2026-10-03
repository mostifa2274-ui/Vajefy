import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { handleApi } from "./api";

type RequestContext = { nonce: string };

declare module "@tanstack/react-router" {
  interface Register {
    server: {
      requestContext: RequestContext;
    };
  }
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function csp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data:",
    "upgrade-insecure-requests",
  ].join("; ");
}

function harden(response: Response, nonce: string): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", csp(nonce));
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  // The microphone is for speaking practice on this site only; recordings never leave the device.
  headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=(), usb=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default createServerEntry({
  async fetch(request) {
    const nonce = createNonce();
    const api = await handleApi(request);
    if (api) return harden(api, nonce);
    const response = await handler.fetch(request, { context: { nonce } });
    return harden(response, nonce);
  },
});
