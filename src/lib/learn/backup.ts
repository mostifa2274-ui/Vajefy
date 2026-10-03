import { z } from "zod";
import { migrateProgress, PROGRESS_VERSION, savedProgress, type SavedProgress } from "./progress";
import { currentProgress, progress, storedEnvelope } from "./schema";

/** The format id from the first release, kept so every backup stays importable. */
export const BACKUP_KIND = "roshana-progress";

const backupFile = z.object({
  kind: z.literal(BACKUP_KIND),
  version: z.number().int().min(0),
  exportedAt: z.string(),
  progress: z.unknown(),
});

export type ParsedBackup =
  | { ok: true; progress: SavedProgress }
  /** `future`: written by a newer release, which this one cannot read safely. */
  | { ok: false; reason: "invalid" | "future"; version?: number };

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

/**
 * Validate saved progress of a known version, migrate it, and verify the
 * result. A save that fails any step is never partly accepted.
 */
export function readProgress(state: unknown, version: number): ParsedBackup {
  if (version > PROGRESS_VERSION) return { ok: false, reason: "future", version };
  const input = progress.safeParse(state);
  if (!input.success) return { ok: false, reason: "invalid" };
  let migrated: SavedProgress;
  try {
    migrated = migrateProgress(input.data, version);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const verified = currentProgress.safeParse(migrated);
  return verified.success ? { ok: true, progress: verified.data } : { ok: false, reason: "invalid" };
}

/** Read an export file, or a raw copy of the browser's `roshana-v1` entry. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const file = backupFile.safeParse(raw);
  if (file.success) return readProgress(file.data.progress, file.data.version);
  const dump = storedEnvelope.safeParse(raw);
  if (dump.success) return readProgress(dump.data.state, dump.data.version);
  return { ok: false, reason: "invalid" };
}
