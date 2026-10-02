import { z } from "zod";
import { migrateProgress, PROGRESS_VERSION, savedProgress, type SavedProgress } from "./store";
import { MAX_PRACTICE_WORDS } from "./practice";

export const BACKUP_KIND = "roshana-progress";

const count = z.number().int().min(0);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const practiceObservation = z.object({
  attempts: count,
  correct: count,
  lastAt: z.number().int().min(0),
  lastGrade: z.enum(["again", "hard", "good", "easy"]),
}).refine((value) => value.attempts > 0 && value.correct <= value.attempts);

const practiceSkills = z.record(z.string().min(1).max(200), z.object({
  meaning: practiceObservation.optional(),
  spelling: practiceObservation.optional(),
  listening: practiceObservation.optional(),
  context: practiceObservation.optional(),
})).refine((value) => Object.keys(value).length <= MAX_PRACTICE_WORDS);

const fsrsCard = z.object({
  model: z.literal("fsrs6"),
  stability: z.number().positive().max(36500).or(z.literal(0)),
  difficulty: z.number().min(0).max(10),
  scheduledDays: z.number().min(0).max(36500),
  learningSteps: count,
  state: z.enum(["new", "learning", "review", "relearning"]),
  lastReview: z.number().optional(),
});

const card = z.object({
  ease: z.number().min(1).max(10),
  interval: z.number().min(0).max(36500),
  due: z.number(),
  reps: count,
  lapses: count,
  state: z.enum(["learning", "review"]),
  step: count,
  last: z.number().optional(),
  fsrs: fsrsCard.optional(),
});

const reviewEvent = z.object({
  id: z.string().min(1).max(200),
  at: z.number(),
  grade: z.enum(["again", "hard", "good", "easy"]),
  algorithm: z.enum(["legacy", "fsrs6"]),
  targetRetention: z.number().min(0.8).max(0.97).optional(),
  bridged: z.boolean().optional(),
  elapsedDays: z.number().min(0).max(36500),
  scheduledDays: z.number().min(0).max(36500),
  stability: z.number().min(0).max(36500).optional(),
  difficulty: z.number().min(0).max(10).optional(),
});

// Only the fields present in every saved version are required; migrateProgress
// fills the rest, exactly as it does for the browser's own storage.
const progress = z.object({
  cards: z.record(z.string().max(200), card),
  logs: z
    .array(
      z.object({
        date,
        reviews: count,
        correct: count,
        practice: count.optional(),
        practiceCorrect: count.optional(),
        introduced: count,
      }),
    )
    .max(400),
  lifetime: z
    .object({
      reviews: count,
      correct: count,
      practice: count.optional(),
      practiceCorrect: count.optional(),
    })
    .optional(),
  streak: count,
  lastStudyDate: date.nullable(),
  xp: count,
  lang: z.enum(["fa", "en"]),
  focus: z.enum(["A1", "A2", "B1", "B2", "B2x", "C1"]),
  sessionSize: z.number().int().min(1).max(200),
  newPerDay: z.number().int().min(0).max(200),
  voice: z.boolean(),
  accent: z.enum(["en-GB", "en-US"]).optional(),
  bookmarks: z.array(z.string().max(200)).max(2000),
  dailyGoal: z.number().int().min(0).max(1000),
  requestRetention: z.number().min(0.8).max(0.97).optional(),
  reviewHistory: z.array(reviewEvent).max(12000).optional(),
  practiceSkills: practiceSkills.optional(),
  onboarded: z.boolean(),
});

const backupFile = z.object({
  kind: z.literal(BACKUP_KIND),
  version: z.number().int().min(0),
  exportedAt: z.string(),
  progress,
});

// The browser's own `roshana-v1` entry, so a raw localStorage copy also imports.
const storageDump = z.object({ state: progress, version: z.number().int().min(0) });

export function makeBackup(state: SavedProgress, now = new Date()): string {
  return JSON.stringify({
    kind: BACKUP_KIND,
    version: PROGRESS_VERSION,
    exportedAt: now.toISOString(),
    progress: savedProgress(state),
  });
}

export function backupFileName(now = new Date()): string {
  return `roshana-progress-${now.toISOString().slice(0, 10)}.json`;
}

export function parseBackup(text: string): SavedProgress | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const file = backupFile.safeParse(raw);
  if (file.success) {
    if (file.data.version > PROGRESS_VERSION) return null;
    return migrateProgress(file.data.progress, file.data.version);
  }
  const dump = storageDump.safeParse(raw);
  if (dump.success && dump.data.version <= PROGRESS_VERSION) {
    return migrateProgress(dump.data.state, dump.data.version);
  }
  return null;
}
