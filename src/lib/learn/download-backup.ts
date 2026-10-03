import { backupFileName, makeBackup } from "./backup";
import { useProgress } from "./store";

export function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the live state, including answers whose browser save failed. */
export function downloadProgressBackup() {
  downloadText(makeBackup(useProgress.getState()), backupFileName());
}
