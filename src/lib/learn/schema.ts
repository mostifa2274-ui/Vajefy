import { z } from "zod";
import { MAX_PRACTICE_WORDS } from "./practice";
import { MAX_REVIEW_HISTORY } from "./progress";

/**
 * The saved-progress format, shared by browser saves and backup files. A save
 * must pass these checks before the app reads it or writes over it.
 */

const count = z.number().int().min(0);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const progressId = z.string().min(1).max(200);

const practiceObservation = z
  .object({
    attempts: count,
    correct: count,
    lastAt: z.number().int().min(0),
    lastGrade: z.enum(["again", "hard", "good", "easy"]),
  })
  .refine((value) => value.attempts > 0 && value.correct <= value.attempts);

export const practiceWord = z.object({
  meaning: practiceObservation.optional(),
  spelling: practiceObservation.optional(),
  listening: practiceObservation.optional(),
  context: practiceObservation.optional(),
});

const practiceSkills = z
  .record(progressId, practiceWord)
  .refine((value) => Object.keys(value).length <= MAX_PRACTICE_WORDS);

const fsrsCard = z.object({
  model: z.literal("fsrs6"),
  stability: z.number().positive().max(36500).or(z.literal(0)),
  difficulty: z.number().min(0).max(10),
  scheduledDays: z.number().min(0).max(36500),
  learningSteps: count,
  state: z.enum(["new", "learning", "review", "relearning"]),
  lastReview: z.number().optional(),
});

export const card = z.object({
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

export const reviewEvent = z.object({
  id: progressId,
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

export const dayLog = z.object({
  date,
  reviews: count,
  correct: count,
  practice: count.optional(),
  practiceCorrect: count.optional(),
  introduced: count,
});

const lifetime = z.object({
  reviews: count,
  correct: count,
  practice: count.optional(),
  practiceCorrect: count.optional(),
});

export const MAX_LOGS = 400;
export const MAX_BOOKMARKS = 2000;

// Only the fields present in every saved version are required; migrateProgress
// fills the rest, for backups and for the browser's own storage alike.
export const progress = z.object({
  cards: z.record(z.string().max(200), card),
  logs: z.array(dayLog).max(MAX_LOGS),
  lifetime: lifetime.optional(),
  streak: count,
  lastStudyDate: date.nullable(),
  xp: count,
  lang: z.enum(["fa", "en"]),
  focus: z.enum(["A1", "A2", "B1", "B2", "B2x", "C1"]),
  sessionSize: z.number().int().min(1).max(200),
  newPerDay: z.number().int().min(0).max(200),
  voice: z.boolean(),
  accent: z.enum(["en-GB", "en-US"]).optional(),
  bookmarks: z.array(z.string().max(200)).max(MAX_BOOKMARKS),
  dailyGoal: z.number().int().min(0).max(1000),
  requestRetention: z.number().min(0.8).max(0.97).optional(),
  reviewHistory: z.array(reviewEvent).max(MAX_REVIEW_HISTORY).optional(),
  practiceSkills: practiceSkills.optional(),
  onboarded: z.boolean(),
  goal: z.enum(["everyday", "work", "study", "general"]).optional(),
  minutes: z.number().int().min(1).max(240).optional(),
});

/** A migrated save: every field of the current version must be present. */
export const currentProgress = progress.required().extend({
  logs: z.array(dayLog.required()).max(MAX_LOGS),
  lifetime: lifetime.required(),
});

/** The envelope earlier releases wrote to the `roshana-v1` localStorage entry. */
export const storedEnvelope = z.object({ state: z.unknown(), version: z.number().int().min(0) });
