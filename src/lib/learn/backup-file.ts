import { PROGRESS_VERSION, savedProgress, type SavedProgress } from "./progress";

/**
 * Writing a backup file. Reading one validates it with the progress schema
 * (backup.ts); writing needs no schema, so saving a copy from the app's
 * first screen does not load it.
 */

/** The format id from the first release, kept so every backup stays importable. */
export const BACKUP_KIND = "roshana-progress";

export function makeBackup(state: SavedProgress, now = new Date()): string {
  return JSON.stringify({
    kind: BACKUP_KIND,
    version: PROGRESS_VERSION,
    exportedAt: now.toISOString(),
    progress: savedProgress(state),
  });
}

export function backupFileName(now = new Date()): string {
  return `vajefy-progress-${now.toISOString().slice(0, 10)}.json`;
}
