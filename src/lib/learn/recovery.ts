import { readProgress } from "./backup";
import { boundPracticeEvidence } from "./practice";
import { MAX_REVIEW_HISTORY, migrateProgress, PROGRESS_VERSION, type SavedProgress } from "./progress";
import {
  card,
  currentProgress,
  dayLog,
  MAX_BOOKMARKS,
  MAX_LOGS,
  practiceWord,
  progress,
  progressId,
  reviewEvent,
  storedEnvelope,
} from "./schema";
import type { CardProg, PracticeEvidence, ReviewEvent } from "./types";

/** Why a browser save cannot be used as it is. */
export type HeldSave =
  | { kind: "damaged"; raw: string }
  | { kind: "future"; raw: string; version: number };

export type StoredProgress =
  | { kind: "empty" }
  | { kind: "ok"; progress: SavedProgress }
  | HeldSave;

/**
 * Decide, before hydration, whether the browser's saved progress can be used.
 * Anything that is not a valid save of this or an earlier version is held
 * untouched, so startup can never replace it with empty or downgraded progress.
 */
export function inspectStoredProgress(raw: string | null): StoredProgress {
  if (raw === null) return { kind: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "damaged", raw };
  }
  const envelope = storedEnvelope.safeParse(parsed);
  if (!envelope.success) return { kind: "damaged", raw };
  const result = readProgress(envelope.data.state, envelope.data.version);
  if (result.ok) return { kind: "ok", progress: result.progress };
  if (result.reason === "future") return { kind: "future", raw, version: envelope.data.version };
  return { kind: "damaged", raw };
}

export type RecoveryReport = {
  words: { kept: number; total: number };
  reviews: { kept: number; total: number };
  /** Other saved details that were missing or unreadable and fall back to defaults. */
  reset: string[];
};

export type Recovery = { progress: SavedProgress; report: RecoveryReport };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OPTIONAL = new Set(["lifetime", "accent", "requestRetention", "reviewHistory", "practiceSkills", "goal", "minutes"]);

/**
 * Keep every part of a held save that is individually valid. Learning records
 * are checked one by one, so a single broken card or answer costs only itself.
 * Nothing is invented: unreadable details fall back to the defaults of a new
 * learner, and the report says how much was kept. Returns null when not even
 * the save's structure can be read.
 */
export function recoverProgress(raw: string): Recovery | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.state)) return null;
  const input = parsed.state;
  const reset: string[] = [];
  const kept: Record<string, unknown> = {};

  const cards: Record<string, CardProg> = {};
  let totalWords = 0;
  if (isRecord(input.cards)) {
    for (const [id, value] of Object.entries(input.cards)) {
      totalWords += 1;
      const parsedCard = card.safeParse(value);
      if (progressId.safeParse(id).success && parsedCard.success) cards[id] = parsedCard.data;
    }
  } else if (input.cards !== undefined) {
    reset.push("cards");
  }
  kept.cards = cards;

  const events: ReviewEvent[] = [];
  let totalReviews = 0;
  if (Array.isArray(input.reviewHistory)) {
    for (const value of input.reviewHistory) {
      totalReviews += 1;
      const event = reviewEvent.safeParse(value);
      if (event.success) events.push(event.data);
    }
  } else if (input.reviewHistory !== undefined) {
    reset.push("reviewHistory");
  }
  kept.reviewHistory = events.slice(-MAX_REVIEW_HISTORY);

  if (Array.isArray(input.logs)) {
    const rows = input.logs.flatMap((value) => {
      const row = dayLog.safeParse(value);
      return row.success ? [row.data] : [];
    });
    const byDate = new Map(rows.map((row) => [row.date, row]));
    kept.logs = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_LOGS);
    if (byDate.size !== input.logs.length) reset.push("logs");
  } else {
    kept.logs = [];
    if (input.logs !== undefined) reset.push("logs");
  }

  if (Array.isArray(input.bookmarks)) {
    const ids = input.bookmarks.filter((value): value is string => progressId.safeParse(value).success);
    kept.bookmarks = [...new Set(ids)].slice(-MAX_BOOKMARKS);
    if (ids.length !== input.bookmarks.length) reset.push("bookmarks");
  } else {
    kept.bookmarks = [];
    if (input.bookmarks !== undefined) reset.push("bookmarks");
  }

  if (isRecord(input.practiceSkills)) {
    const evidence: PracticeEvidence = {};
    let lost = false;
    for (const [id, value] of Object.entries(input.practiceSkills)) {
      if (!progressId.safeParse(id).success || !isRecord(value)) {
        lost = true;
        continue;
      }
      const skills: PracticeEvidence[string] = {};
      for (const [skill, observation] of Object.entries(value)) {
        const one = practiceWord.safeParse({ [skill]: observation });
        if (one.success && Object.keys(one.data).length) Object.assign(skills, one.data);
        else lost = true;
      }
      if (Object.keys(skills).length) evidence[id] = skills;
    }
    kept.practiceSkills = boundPracticeEvidence(evidence);
    if (lost) reset.push("practiceSkills");
  } else if (input.practiceSkills !== undefined) {
    reset.push("practiceSkills");
  }

  const shape = progress.shape;
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    if (key in kept) continue;
    const value = input[key];
    if (value === undefined && OPTIONAL.has(key)) continue;
    const field = shape[key].safeParse(value);
    if (field.success && value !== undefined) kept[key] = field.data;
    else reset.push(key);
  }

  // A save whose details were damaged but whose learning survived belongs to
  // someone who has already chosen a level and a goal.
  if (kept.onboarded === undefined && Object.keys(cards).length) kept.onboarded = true;

  const stored = storedEnvelope.shape.version.safeParse(parsed.version);
  // Older saves need their migration; a newer or unknown version is read as
  // the current shape, since only the fields this release knows were kept.
  const version = stored.success ? Math.min(stored.data, PROGRESS_VERSION) : kept.lifetime ? PROGRESS_VERSION : 0;
  let migrated: SavedProgress;
  try {
    migrated = migrateProgress(kept, version);
  } catch {
    return null;
  }
  const verified = currentProgress.safeParse(migrated);
  if (!verified.success) return null;
  return {
    progress: verified.data,
    report: {
      words: { kept: Object.keys(cards).length, total: totalWords },
      reviews: { kept: events.length, total: totalReviews },
      reset: [...new Set(reset)],
    },
  };
}

/** The untouched saved copy is offered under its own name, never as a backup. */
export function savedCopyFileName(now = new Date()): string {
  return `roshana-saved-copy-${now.toISOString().slice(0, 10)}.json`;
}
