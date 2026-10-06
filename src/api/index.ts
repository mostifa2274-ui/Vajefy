import { env } from "cloudflare:workers";
import { CONTENT_CHANNEL } from "@/lib/learn/channel";
import { handleAudio } from "./audio";
import { handleCoach } from "./coach";
import { handleSync } from "./sync";
import { handleSemanticGateway } from "./semantic-gateway";
import { handleTelemetry } from "./telemetry";

export const coachEnabled = () => env.COACH === "on" && Boolean(env.ANTHROPIC_API_KEY) && Boolean(env.COACH_LIMITER);
export const syncEnabled = () => env.SYNC === "on" && Boolean(env.SYNC_DB);

/** The deployed commit (Cloudflare Workers Builds sets it; "local" otherwise). */
const REVISION = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_APP_VERSION ?? "local";

/** Requests the Worker answers itself; everything else is a page. */
export async function handleApi(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/telemetry") return handleTelemetry(request, env.TELEMETRY === "on");
  // Which build is live and which content it may introduce, so a release can
  // be verified against the commit and channel it was meant to have.
  if (pathname === "/api/version") return Response.json({ revision: REVISION, channel: CONTENT_CHANNEL }, { headers: { "Cache-Control": "no-store" } });
  // Optional services report whether they are configured, so the app can offer them.
  if (pathname === "/api/coach") return coachEnabled() ? handleCoach(request) : Response.json({ error: "unavailable" }, { status: 503 });
  if (pathname === "/api/coach/status") return Response.json({ enabled: coachEnabled() }, { headers: { "Cache-Control": "no-store" } });
  if (pathname === "/api/internal/semantic-judge") {
    return handleSemanticGateway(request, env.AI);
  }
  if (pathname.startsWith("/api/sync/") && pathname !== "/api/sync/status") {
    if (!syncEnabled()) return Response.json({ error: "unavailable" }, { status: 503 });
    if (env.SYNC_LIMITER) {
      const { success } = await env.SYNC_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" });
      if (!success) return Response.json({ error: "rate limited" }, { status: 429, headers: { "Retry-After": "60" } });
    }
    return handleSync(request, env.SYNC_DB!);
  }
  if (pathname === "/api/sync/status") return Response.json({ enabled: syncEnabled() }, { headers: { "Cache-Control": "no-store" } });
  if (pathname.startsWith("/audio/") && env.AUDIO) return handleAudio(request, env.AUDIO);
  if (pathname.startsWith("/api/")) return Response.json({ error: "not found" }, { status: 404 });
  return null;
}
