/**
 * Operational error reports (docs/OPERATIONS.md), sent only when the build has
 * VITE_TELEMETRY=on. A report says what failed (a kind and a short code) and on
 * which screen, never what the learner did or wrote. Each kind and code is
 * sent at most once per page load, and at most twenty reports in all.
 */

export type TelemetryKind = "save-failed" | "storage-unavailable" | "import-failed" | "audio-failed" | "exercise-broken" | "crash";

type Report = { kind: TelemetryKind; code?: string; route?: string; app?: string };

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const ENABLED = env?.VITE_TELEMETRY === "on";
const APP = env?.VITE_APP_VERSION;
const LIMIT = 20;

const seen = new Set<string>();
let queue: Report[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ reports: queue });
  queue = [];
  try {
    if (!navigator.sendBeacon?.("/api/telemetry", body)) void fetch("/api/telemetry", { method: "POST", body, keepalive: true }).catch(() => undefined);
  } catch {
    // Reporting must never break the app.
  }
}

export function report(kind: TelemetryKind, code?: string) {
  if (!ENABLED || typeof window === "undefined") return;
  const clean = code?.replace(/[^\w:#./-]/g, "").slice(0, 80);
  const key = `${kind}|${clean ?? ""}`;
  if (seen.has(key) || seen.size >= LIMIT) return;
  seen.add(key);
  // Only the screen, never ids or query strings.
  const route = `/${window.location.pathname.split("/")[1] ?? ""}`;
  queue.push({ kind, ...(clean ? { code: clean } : {}), route, ...(APP ? { app: APP } : {}) });
  timer ??= setTimeout(flush, 2000);
}

/** Report uncaught errors by their type only. */
export function reportCrashes(): () => void {
  if (!ENABLED) return () => undefined;
  const onError = (event: ErrorEvent) => report("crash", event.error instanceof Error ? event.error.name : "Error");
  const onRejection = (event: PromiseRejectionEvent) => report("crash", event.reason instanceof Error ? event.reason.name : "rejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
