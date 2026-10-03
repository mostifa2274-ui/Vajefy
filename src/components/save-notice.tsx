import { useState, useSyncExternalStore } from "react";
import { downloadProgressBackup } from "@/lib/learn/download-backup";
import type { Copy } from "@/lib/learn/i18n";
import type { SaveStatus } from "@/lib/learn/persistence";
import { persistence } from "@/lib/learn/store";

const serverStatus = (): SaveStatus => "checking";

export function SaveNotice({ copy }: { copy: Copy }) {
  const status = useSyncExternalStore(persistence.subscribe, persistence.getStatus, serverStatus);
  // A retry takes a moment; until it ends the button waits, and a failed one says so.
  const [attempt, setAttempt] = useState<"idle" | "trying" | "failed">("idle");
  // Once saving works again, a later failure starts afresh.
  if (status !== "session" && attempt === "failed") setAttempt("idle");
  if (status !== "session" && status !== "unavailable") return null;

  async function retry() {
    setAttempt("trying");
    setAttempt((await persistence.retry()) ? "idle" : "failed");
  }
  const unavailable = status === "unavailable";
  const buttonClass = "min-h-11 rounded-md bg-paper px-3 text-sm shadow-[var(--shadow-border)]";

  return (
    <section role="alert" aria-labelledby="save-notice-title" className="mb-5 rounded-lg border border-line bg-paper-2 p-4">
      <h2 id="save-notice-title" className="text-base font-medium">
        {unavailable ? copy.saveUnavailableTitle : copy.saveFailedTitle}
      </h2>
      <p className="mt-1 text-sm text-pretty">{unavailable ? copy.saveUnavailableHint : copy.saveFailedHint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={downloadProgressBackup} className={buttonClass}>
          {copy.exportProgress}
        </button>
        {unavailable ? null : (
          <button type="button" onClick={() => void retry()} disabled={attempt === "trying"} aria-busy={attempt === "trying"} className={`${buttonClass} disabled:opacity-60`}>
            {copy.retrySave}
          </button>
        )}
      </div>
      {attempt === "failed" ? (
        <p role="status" className="mt-2 text-sm text-pretty">
          {copy.retryFailed}
        </p>
      ) : null}
    </section>
  );
}
