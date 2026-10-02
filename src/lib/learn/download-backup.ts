import { backupFileName, makeBackup } from "./backup";
import { useProgress } from "./store";

/** Export the live state, including answers whose browser save failed. */
export function downloadProgressBackup() {
  const blob = new Blob([makeBackup(useProgress.getState())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName();
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
