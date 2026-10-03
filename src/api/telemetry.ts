import { z } from "zod";

/**
 * Operational error reports from learners' devices (docs/OPERATIONS.md): what
 * failed and where, never what the learner did or wrote. Logged to Workers Logs
 * only when TELEMETRY is "on"; no address or identifier is recorded.
 */

export const TELEMETRY_KINDS = ["save-failed", "storage-unavailable", "import-failed", "audio-failed", "exercise-broken", "sync-failed", "crash"] as const;

const report = z.object({
  kind: z.enum(TELEMETRY_KINDS),
  /** A short machine-readable reason, e.g. "QuotaExceededError" or a content item id. */
  code: z.string().max(80).regex(/^[\w:#./-]*$/).optional(),
  route: z.string().max(40).regex(/^\/[\w/-]*$/).optional(),
  app: z.string().max(40).regex(/^[\w.-]*$/).optional(),
});
const batch = z.object({ reports: z.array(report).min(1).max(20) });

export async function handleTelemetry(request: Request, enabled: boolean): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const text = await request.text();
  if (text.length > 4096) return new Response(null, { status: 413 });
  let parsed: z.infer<typeof batch>;
  try {
    parsed = batch.parse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (enabled) {
    for (const item of parsed.reports) console.log(JSON.stringify({ telemetry: item }));
  }
  return new Response(null, { status: 204 });
}
