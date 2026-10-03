import type { CoachReply, CoachRequest } from "@/api/coach-core";

/** The AI coach from the browser: whether it is offered, and asking it. */

let status: Promise<boolean> | null = null;

export function coachAvailable(): Promise<boolean> {
  status ??= fetch("/api/coach/status")
    .then((response) => (response.ok ? (response.json() as Promise<{ enabled?: boolean }>) : { enabled: false }))
    .then((body) => body.enabled === true)
    .catch(() => {
      status = null;
      return false;
    });
  return status;
}

export type CoachResult = { ok: true; reply: CoachReply } | { ok: false; reason: "offline" | "limit" | "failed" };

export async function askCoach(request: CoachRequest): Promise<CoachResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  try {
    const response = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
    if (response.status === 429) return { ok: false, reason: "limit" };
    if (!response.ok) return { ok: false, reason: "failed" };
    const body = (await response.json()) as { reply?: CoachReply };
    return body.reply ? { ok: true, reply: body.reply } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "offline" };
  }
}
