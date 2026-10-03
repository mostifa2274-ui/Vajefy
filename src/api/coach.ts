import { env } from "cloudflare:workers";
import type { Pilot } from "../lib/learn/content";
import pilotJson from "../../public/data/enhanced.json?raw";
import { anthropicBody, coachPrompt, coachRequest, indexContent, readReply } from "./coach-core";

/**
 * POST /api/coach (docs/COACH.md). Off unless COACH is "on", an
 * ANTHROPIC_API_KEY secret exists and the COACH_LIMITER rate limit is bound.
 *
 * - Every answer is grounded in the app's own content for the words asked about.
 * - A learner's own sentence is sent to the model and nowhere else: it is never
 *   logged or cached. Questions about the content alone are cached at the edge.
 * - The coach changes nothing in the learner's progress; the client only shows it.
 */

export const DEFAULT_COACH_MODEL = "claude-sonnet-5-5";
let content: ReturnType<typeof indexContent> | null = null;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const json = (body: unknown, status = 200, cache = "no-store") => Response.json(body, { status, headers: { "Cache-Control": cache } });

export async function handleCoach(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!env.ANTHROPIC_API_KEY || !env.COACH_LIMITER) return json({ error: "unavailable" }, 503);
  // A per-address rate limit bounds cost; the address itself is not stored.
  const { success } = await env.COACH_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" });
  if (!success) return json({ error: "limit" }, 429);

  const text = await request.text();
  if (text.length > 2048) return json({ error: "too large" }, 413);
  let parsed;
  try {
    parsed = coachRequest.parse(JSON.parse(text));
  } catch {
    return json({ error: "invalid" }, 400);
  }
  content ??= indexContent(JSON.parse(pilotJson) as Pilot);
  const prompt = coachPrompt(parsed, content);
  if (!prompt) return json({ error: "unknown content" }, 400);

  const model = env.COACH_MODEL || DEFAULT_COACH_MODEL;
  const store = (caches as unknown as { default: Cache }).default;
  const cacheKey = parsed.task === "sentence" ? null : new Request(`https://coach.cache/${await sha256(`${model}\n${prompt}`)}`);
  if (cacheKey) {
    const hit = await store.match(cacheKey);
    if (hit) return json(await hit.json());
  }

  let reply = null;
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(anthropicBody(model, prompt)),
    });
    if (upstream.ok) reply = readReply(await upstream.json());
  } catch {
    reply = null;
  }
  if (!reply) return json({ error: "failed" }, 502);
  if (cacheKey) await store.put(cacheKey, json({ reply }, 200, "public, max-age=2592000"));
  return json({ reply });
}
