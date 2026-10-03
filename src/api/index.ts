import { env } from "cloudflare:workers";
import { handleAudio } from "./audio";
import { handleCoach } from "./coach";
import { handleTelemetry } from "./telemetry";

export const coachEnabled = () => env.COACH === "on" && Boolean(env.ANTHROPIC_API_KEY) && Boolean(env.COACH_LIMITER);
export const syncEnabled = () => env.SYNC === "on" && Boolean(env.SYNC_DB);

/** Requests the Worker answers itself; everything else is a page. */
export async function handleApi(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/telemetry") return handleTelemetry(request, env.TELEMETRY === "on");
  // Optional services report whether they are configured, so the app can offer them.
  if (pathname === "/api/coach") return coachEnabled() ? handleCoach(request) : Response.json({ error: "unavailable" }, { status: 503 });
  if (pathname === "/api/coach/status") return Response.json({ enabled: coachEnabled() }, { headers: { "Cache-Control": "no-store" } });
  if (pathname === "/api/sync/status") return Response.json({ enabled: syncEnabled() }, { headers: { "Cache-Control": "no-store" } });
  if (pathname.startsWith("/audio/") && env.AUDIO) return handleAudio(request, env.AUDIO);
  if (pathname.startsWith("/api/")) return Response.json({ error: "not found" }, { status: 404 });
  return null;
}
