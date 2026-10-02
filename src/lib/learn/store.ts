import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { freshCard, isMastered, schedule } from "./srs";
import { todayKey, yesterdayKey } from "./text";
import type { CardProg, Grade, Lang, LevelId } from "./types";

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

/**
 * Prospective scheduled-recall evidence. We intentionally do not invent rows
 * for reviews that happened before this log existed.
 */
export type ReviewEvent = {
  /** Epoch milliseconds of the grade. */
  t: number;
  id: string;
  grade: Grade;
  state: CardProg["state"];
  step: number;
  scheduledDays: number;
  elapsedDays: number;
  nextState: CardProg["state"];
  nextStep: number;
  nextDays: number;
  /**
   * True only when Vajefy has observed this card from its first scheduled
   * recall. Existing pre-v3 cards remain explicitly partial.
   */
  complete: boolean;
};

/** Everything saved to the browser and carried by an export file. */
export type SavedProgress = {
  cards: Record<string, CardProg>;
  logs: DayLog[];
  lifetime: Lifetime;
  reviewHistory: ReviewEvent[];
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
  onboarded: boolean;
};

type ProgressState = SavedProgress & {
  hydrated: boolean;
  setHydrated: () => void;
  setLang: (lang: Lang) => void;
  setFocus: (focus: LevelId) => void;
  setSessionSize: (sessionSize: number) => void;
  setNewPerDay: (newPerDay: number) => void;
  setVoice: (voice: boolean) => void;
  setAccent: (accent: "en-GB" | "en-US") => void;
  setDailyGoal: (dailyGoal: number) => void;
  setOnboarded: () => void;
  toggleBookmark: (id: string) => void;
  completeOnboarding: (focus: LevelId, dailyGoal: number) => void;
  review: (id: string, grade: Grade) => CardProg;
  practice: (id: string, grade: Grade) => void;
  addToReview: (id: string) => void;
  forget: (ids: string[]) => void;
  importProgress: (saved: SavedProgress) => void;
  reset: () => void;
};

/** Bump when the saved shape changes, and teach `migrate` the old shape. */
export const PROGRESS_VERSION = 3;

const XP: Record<Grade, number> = { again: 2, hard: 6, good: 10, easy: 14 };
const PRACTICE_XP: Record<Grade, number> = { again: 0, hard: 1, good: 2, easy: 3 };
const MAX_REVIEW_HISTORY = 8000;
const DAY = 86_400_000;

const memory = new Map<string, string>();

const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return memory.get(key) ?? null;
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string) => {
    // Keep a same-session fallback even when browser persistence is denied or
    // quota-limited. The UI remains usable and Backup can still export state.
    memory.set(key, value);
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {
      /* in-memory fallback already holds the latest state */
    }
  },
  removeItem: (key: string) => {
    memory.delete(key);
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing else to remove */
    }
  },
};

function touchStreak(streak: number, last: string | null, today: string) {
  if (last === today) return { streak, lastStudyDate: last };
  if (last === yesterdayKey()) return { streak: streak + 1, lastStudyDate: today };
  return { streak: 1, lastStudyDate: today };
}

/** The streak as of today: it is broken once a whole day passes without study. */
export function liveStreak(streak: number, lastStudyDate: string | null, now = new Date()): number {
  if (lastStudyDate === todayKey(now) || lastStudyDate === yesterdayKey(now)) return streak;
  return 0;
}

function bumpLog(
  logs: DayLog[],
  today: string,
  delta: {
    reviews?: number;
    correct?: number;
    practice?: number;
    practiceCorrect?: number;
    introduced?: number;
  },
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const min = todayKey(cutoff);
  const next = logs.filter((row) => row.date >= min);
  const row = next.find((item) => item.date === today) ?? {
    date: today,
    reviews: 0,
    correct: 0,
    practice: 0,
    practiceCorrect: 0,
    introduced: 0,
  };
  const updated: DayLog = {
    date: today,
    reviews: row.reviews + (delta.reviews ?? 0),
    correct: row.correct + (delta.correct ?? 0),
    practice: row.practice + (delta.practice ?? 0),
    practiceCorrect: row.practiceCorrect + (delta.practiceCorrect ?? 0),
    introduced: row.introduced + (delta.introduced ?? 0),
  };
  return [...next.filter((item) => item.date !== today), updated];
}

function bumpReviewLifetime(lifetime: Lifetime, correct: boolean): Lifetime {
  return {
    ...lifetime,
    reviews: lifetime.reviews + 1,
    correct: lifetime.correct + (correct ? 1 : 0),
  };
}

function bumpPracticeLifetime(lifetime: Lifetime, correct: boolean): Lifetime {
  return {
    ...lifetime,
    practice: lifetime.practice + 1,
    practiceCorrect: lifetime.practiceCorrect + (correct ? 1 : 0),
  };
}

function lastReviewEvent(history: ReviewEvent[], id: string): ReviewEvent | undefined {
  for (let index = history.length - 1; index >= 0; index--) {
    const event = history[index];
    if (event?.id === id) return event;
  }
  return undefined;
}

export function todayLog(logs: DayLog[], today = todayKey()): DayLog {
  return (
    logs.find((row) => row.date === today) ?? {
      date: today,
      reviews: 0,
      correct: 0,
      practice: 0,
      practiceCorrect: 0,
      introduced: 0,
    }
  );
}

export function dueIds(cards: Record<string, CardProg>, now = Date.now()): string[] {
  return Object.entries(cards)
    .filter(([, card]) => card.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

const DEFAULTS: SavedProgress = {
  cards: {},
  logs: [],
  lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
  reviewHistory: [],
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
  onboarded: false,
};

export function savedProgress(state: SavedProgress): SavedProgress {
  return {
    cards: state.cards,
    logs: state.logs,
    lifetime: state.lifetime,
    reviewHistory: state.reviewHistory,
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
    ...DEFAULTS.lifetime,
    ...(input.lifetime ?? {}),
  };
  const state: SavedProgress = {
    ...DEFAULTS,
    ...input,
    logs,
    lifetime,
    reviewHistory: Array.isArray(input.reviewHistory) ? input.reviewHistory.slice(-MAX_REVIEW_HISTORY) : [],
    accent: input.accent === "en-US" ? "en-US" : "en-GB",
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

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setLang: (lang) => set({ lang }),
      setFocus: (focus) => set({ focus }),
      setSessionSize: (sessionSize) => set({ sessionSize }),
      setNewPerDay: (newPerDay) => set({ newPerDay }),
      setVoice: (voice) => set({ voice }),
      setAccent: (accent) => set({ accent }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setOnboarded: () => set({ onboarded: true }),
      toggleBookmark: (id) => {
        const bookmarks = get().bookmarks;
        set({
          bookmarks: bookmarks.includes(id)
            ? bookmarks.filter((item) => item !== id)
            : [...bookmarks, id].slice(-400),
        });
      },
      completeOnboarding: (focus, dailyGoal) => {
        const plan =
          dailyGoal >= 40
            ? { newPerDay: 15, sessionSize: 30 }
            : dailyGoal <= 10
              ? { newPerDay: 5, sessionSize: 10 }
              : { newPerDay: 10, sessionSize: 20 };
        set({ focus, dailyGoal, onboarded: true, ...plan });
      },
      review: (id, grade) => {
        const now = Date.now();
        const today = todayKey();
        const state = get();
        const card = state.cards[id];
        const existed = Boolean(card);
        const before = card ?? freshCard(now);
        const next = schedule(before, grade, now);
        const priorLogged = lastReviewEvent(state.reviewHistory, id);
        const complete =
          priorLogged?.complete ??
          (!card || (card.last == null && card.reps === 0 && card.lapses === 0 && card.interval === 0));
        const event: ReviewEvent = {
          t: now,
          id,
          grade,
          state: before.state,
          step: before.step,
          scheduledDays: before.interval,
          elapsedDays: before.last == null ? 0 : Math.max(0, (now - before.last) / DAY),
          nextState: next.state,
          nextStep: next.step,
          nextDays: next.interval,
          complete,
        };
        const streak = touchStreak(state.streak, state.lastStudyDate, today);
        set({
          cards: { ...state.cards, [id]: next },
          logs: bumpLog(state.logs, today, {
            reviews: 1,
            correct: grade === "again" ? 0 : 1,
            introduced: existed ? 0 : 1,
          }),
          lifetime: bumpReviewLifetime(state.lifetime, grade !== "again"),
          reviewHistory: [...state.reviewHistory, event].slice(-MAX_REVIEW_HISTORY),
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: state.xp + XP[grade],
        });
        return next;
      },
      // Quiz and timed practice. Recognition under a timer is weaker evidence
      // than recall in Review, so practice never schedules a card later and
      // never adds a word to the schedule. A miss on a scheduled card makes it
      // due now, so the next Review asks it properly.
      practice: (id, grade) => {
        const now = Date.now();
        const today = todayKey();
        const state = get();
        const card = state.cards[id];
        const missed = grade === "again";
        const streak = touchStreak(state.streak, state.lastStudyDate, today);
        set({
          cards: card && missed && card.due > now ? { ...state.cards, [id]: { ...card, due: now } } : state.cards,
          logs: bumpLog(state.logs, today, {
            practice: 1,
            practiceCorrect: missed ? 0 : 1,
          }),
          lifetime: bumpPracticeLifetime(state.lifetime, !missed),
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: state.xp + PRACTICE_XP[grade],
        });
      },
      addToReview: (id) => {
        const state = get();
        if (state.cards[id]) return;
        const today = todayKey();
        set({
          cards: { ...state.cards, [id]: freshCard(Date.now()) },
          logs: bumpLog(state.logs, today, { introduced: 1 }),
        });
      },
      // Drops cards whose entry no longer exists in the data (e.g. a headword
      // was renamed); they could never be shown, yet would stay "due" forever.
      forget: (ids) => {
        if (!ids.length) return;
        const state = get();
        const cards = { ...state.cards };
        const removed = new Set(ids);
        for (const id of ids) delete cards[id];
        set({
          cards,
          reviewHistory: state.reviewHistory.filter((event) => !removed.has(event.id)),
        });
      },
      importProgress: (saved) => set({ ...savedProgress(saved), onboarded: true }),
      reset: () =>
        set({
          cards: {},
          logs: [],
          lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
          reviewHistory: [],
          streak: 0,
          lastStudyDate: null,
          xp: 0,
        }),
    }),
    {
      name: "roshana-v1",
      version: PROGRESS_VERSION,
      migrate: migrateProgress,
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => savedProgress(state),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export function countLevel(cards: Record<string, CardProg>, level: LevelId) {
  const prefix = `lex:${level}:`;
  let seen = 0;
  let mastered = 0;
  for (const [id, card] of Object.entries(cards)) {
    if (!id.startsWith(prefix)) continue;
    seen += 1;
    if (isMastered(card)) mastered += 1;
  }
  return { seen, mastered };
}

export function totals(cards: Record<string, CardProg>) {
  let seen = 0;
  let mastered = 0;
  for (const card of Object.values(cards)) {
    seen += 1;
    if (isMastered(card)) mastered += 1;
  }
  return { seen, mastered };
}

export function weakIds(cards: Record<string, CardProg>, limit = 6) {
  return Object.entries(cards)
    .filter(([, card]) => card.lapses >= 2)
    .sort((a, b) => b[1].lapses - a[1].lapses || a[1].ease - b[1].ease)
    .slice(0, limit)
    .map(([id, card]) => ({ id, lapses: card.lapses }));
}
