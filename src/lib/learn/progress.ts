import { DEFAULT_REQUEST_RETENTION, normalizeRetention } from "./srs";
import { boundPracticeEvidence } from "./practice";
import type { CardProg, Lang, LevelId, PracticeEvidence, ReviewEvent } from "./types";

export type DayLog = {
  date: string;
  /** Scheduled recall attempts only. Practice is deliberately separate. */
  reviews: number;
  correct: number;
  /** Quiz/game attempts. These never satisfy the daily review goal. */
  practice: number;
  practiceCorrect: number;
  introduced: number;
};

export type Lifetime = {
  /** Scheduled recall attempts only. */
  reviews: number;
  correct: number;
  /** Quiz/game attempts, tracked independently from retention evidence. */
  practice: number;
  practiceCorrect: number;
};

/** Everything saved to the browser and carried by an export file. */
export type SavedProgress = {
  cards: Record<string, CardProg>;
  logs: DayLog[];
  lifetime: Lifetime;
  streak: number;
  lastStudyDate: string | null;
  xp: number;
  lang: Lang;
  focus: LevelId;
  sessionSize: number;
  newPerDay: number;
  voice: boolean;
  accent: "en-GB" | "en-US";
  bookmarks: string[];
  dailyGoal: number;
  /** Desired recall probability used by FSRS-6 for future intervals. */
  requestRetention: number;
  /** Compact, real review evidence collected prospectively for future tuning. */
  reviewHistory: ReviewEvent[];
  /** Prospective vocabulary drill evidence, kept separate from retention. */
  practiceSkills: PracticeEvidence;
  onboarded: boolean;
};

/** Bump when the saved shape changes, and teach `migrate` the old shape. */
export const PROGRESS_VERSION = 4;

export const MAX_REVIEW_HISTORY = 12_000;

export const DEFAULT_PROGRESS: SavedProgress = {
  cards: {},
  logs: [],
  lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
  streak: 0,
  lastStudyDate: null,
  xp: 0,
  lang: "fa",
  focus: "A1",
  sessionSize: 20,
  newPerDay: 10,
  voice: false,
  accent: "en-GB",
  bookmarks: [],
  dailyGoal: 20,
  requestRetention: DEFAULT_REQUEST_RETENTION,
  reviewHistory: [],
  practiceSkills: {},
  onboarded: false,
};

export function savedProgress(state: SavedProgress): SavedProgress {
  return {
    cards: state.cards,
    logs: state.logs,
    lifetime: state.lifetime,
    streak: state.streak,
    lastStudyDate: state.lastStudyDate,
    xp: state.xp,
    lang: state.lang,
    focus: state.focus,
    sessionSize: state.sessionSize,
    newPerDay: state.newPerDay,
    voice: state.voice,
    accent: state.accent,
    bookmarks: state.bookmarks,
    dailyGoal: state.dailyGoal,
    requestRetention: state.requestRetention,
    reviewHistory: state.reviewHistory,
    practiceSkills: state.practiceSkills,
    onboarded: state.onboarded,
  };
}

/** Upgrade a saved state from any earlier `PROGRESS_VERSION`. */
export function migrateProgress(persisted: unknown, version: number): SavedProgress {
  const input = (persisted ?? {}) as Partial<SavedProgress>;
  const logs = (input.logs ?? []).map((row) => ({
    ...row,
    practice: row.practice ?? 0,
    practiceCorrect: row.practiceCorrect ?? 0,
  }));
  const lifetime: Lifetime = {
    ...DEFAULT_PROGRESS.lifetime,
    ...(input.lifetime ?? {}),
  };
  const state: SavedProgress = {
    ...DEFAULT_PROGRESS,
    ...input,
    logs,
    lifetime,
    accent: input.accent === "en-US" ? "en-US" : "en-GB",
    requestRetention: normalizeRetention(input.requestRetention ?? DEFAULT_REQUEST_RETENTION),
    reviewHistory: Array.isArray(input.reviewHistory) ? input.reviewHistory.slice(-MAX_REVIEW_HISTORY) : [],
    practiceSkills: boundPracticeEvidence(input.practiceSkills ?? {}),
  };
  if (version < 1) {
    // v0 kept only the last 60 days of logs; seed the legacy aggregate as
    // scheduled reviews. v2 separates practice prospectively; old mixed history
    // cannot be reconstructed without inventing evidence.
    state.lifetime = {
      ...state.lifetime,
      reviews: logs.reduce((sum, row) => sum + row.reviews, 0),
      correct: logs.reduce((sum, row) => sum + row.correct, 0),
    };
  }
  return state;
}
