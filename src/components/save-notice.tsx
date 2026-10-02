import { useState, useSyncExternalStore } from "react";
import { downloadProgressBackup } from "@/lib/learn/download-backup";
import type { Copy } from "@/lib/learn/i18n";
import { progressStorage, type SaveStatus } from "@/lib/learn/storage";

const serverStatus = (): SaveStatus => "checking";

export function SaveNotice({ copy }: { copy: Copy }) {
  const status = useSyncExternalStore(progressStorage.subscribe, progressStorage.getStatus, serverStatus);
  const [confirmLoad, setConfirmLoad] = useState(false);
  // Held saves have their own recovery screen.
  if (status !== "session" && status !== "conflict") return null;
  const conflict = status === "conflict";
  const buttonClass = "min-h-11 rounded-md bg-paper px-3 text-sm shadow-[var(--shadow-border)]";

  return (
    <section role="alert" aria-labelledby="save-notice-title" className="mb-5 rounded-lg border border-line bg-paper-2 p-4">
      <h2 id="save-notice-title" className="text-base font-medium">{conflict ? copy.saveConflictTitle : copy.saveFailedTitle}</h2>
      <p className="mt-1 text-sm text-pretty">{conflict ? copy.saveConflictHint : copy.saveFailedHint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={downloadProgressBackup} className={buttonClass}>{copy.exportProgress}</button>
        {conflict ? (
          <button type="button" onClick={() => setConfirmLoad(true)} className={buttonClass}>{copy.loadSavedProgress}</button>
        ) : (
          <button type="button" onClick={() => progressStorage.retry()} className={buttonClass}>{copy.retrySave}</button>
        )}
      </div>
      {conflict && confirmLoad ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-sm text-pretty">{copy.loadSavedWarning}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => window.location.reload()} className={buttonClass}>{copy.confirmLoadSaved}</button>
            <button type="button" onClick={() => setConfirmLoad(false)} className={buttonClass}>{copy.resetNo}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
