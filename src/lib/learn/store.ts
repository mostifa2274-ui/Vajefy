import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { freshCard, isMastered, normalizeRetention, scheduleWithMeta } from "./srs";
import { todayKey, yesterdayKey } from "./text";
import { recordPracticeSkill } from "./practice";
import {
  DEFAULT_PROGRESS,
  MAX_REVIEW_HISTORY,
  PROGRESS_VERSION,
  savedProgress,
  type DayLog,
  type Lifetime,
  type SavedProgress,
} from "./progress";
import { inspectStoredProgress } from "./recovery";
import { progressStorage, PROGRESS_STORAGE_KEY } from "./storage";
import type { CardProg, Grade, Lang, LevelId, PracticeSkill, ReviewEvent } from "./types";

export {
  migrateProgress,
  PROGRESS_VERSION,
  savedProgress,
  type DayLog,
  type Lifetime,
  type SavedProgress,
} from "./progress";

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
  setRequestRetention: (requestRetention: number) => void;
  setOnboarded: () => void;
  toggleBookmark: (id: string) => void;
  completeOnboarding: (focus: LevelId, dailyGoal: number) => void;
  review: (id: string, grade: Grade) => CardProg;
  practice: (id: string, grade: Grade, skill?: PracticeSkill) => void;
  addToReview: (id: string) => void;
  forget: (ids: string[]) => void;
  importProgress: (saved: SavedProgress) => void;
  /** Replace progress with a recovered save, keeping it exactly as recovered. */
  restoreProgress: (saved: SavedProgress) => void;
  /** Begin again as a new learner, keeping only the interface language. */
  startOver: () => void;
  reset: () => void;
};

const XP: Record<Grade, number> = { again: 2, hard: 6, good: 10, easy: 14 };
const PRACTICE_XP: Record<Grade, number> = { again: 0, hard: 1, good: 2, easy: 3 };

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

/**
 * Saves are validated, migrated and verified before they reach the store. An
 * unusable save is held by progressStorage, which then refuses every write, so
 * hydration and automatic saves can never replace it with an empty state.
 */
const persistStorage: PersistStorage<SavedProgress> = {
  getItem(name) {
    const stored = inspectStoredProgress(progressStorage.getItem(name));
    if (stored.kind === "empty") return null;
    if (stored.kind === "ok") return { state: stored.progress, version: PROGRESS_VERSION };
    progressStorage.hold(stored);
    return null;
  },
  setItem: (name, value) => progressStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => progressStorage.removeItem(name),
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PROGRESS,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setLang: (lang) => set({ lang }),
      setFocus: (focus) => set({ focus }),
      setSessionSize: (sessionSize) => set({ sessionSize }),
      setNewPerDay: (newPerDay) => set({ newPerDay }),
      setVoice: (voice) => set({ voice }),
      setAccent: (accent) => set({ accent }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setRequestRetention: (requestRetention) =>
        set({ requestRetention: normalizeRetention(requestRetention) }),
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
        const existed = Boolean(state.cards[id]);
        const result = scheduleWithMeta(
          state.cards[id] ?? freshCard(now),
          grade,
          now,
          state.requestRetention,
        );
        const next = result.card;
        const streak = touchStreak(state.streak, state.lastStudyDate, today);
        const event: ReviewEvent = {
          id,
          at: now,
          grade,
          algorithm: result.meta.algorithm,
          ...(result.meta.algorithm === "fsrs6" ? { targetRetention: state.requestRetention } : {}),
          ...(result.meta.bridged ? { bridged: true } : {}),
          elapsedDays: result.meta.elapsedDays,
          scheduledDays: result.meta.scheduledDays,
          ...(result.meta.stability == null ? {} : { stability: result.meta.stability }),
          ...(result.meta.difficulty == null ? {} : { difficulty: result.meta.difficulty }),
        };
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
      practice: (id, grade, skill) => {
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
          practiceSkills: recordPracticeSkill(state.practiceSkills, id, skill, grade, now),
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
        const cards = { ...get().cards };
        const practiceSkills = { ...get().practiceSkills };
        for (const id of ids) {
          delete cards[id];
          delete practiceSkills[id];
        }
        const forgotten = new Set(ids);
        set({ cards, practiceSkills, reviewHistory: get().reviewHistory.filter((event) => !forgotten.has(event.id)) });
      },
      importProgress: (saved) => set({ ...savedProgress(saved), onboarded: true }),
      restoreProgress: (saved) => set(savedProgress(saved)),
      startOver: () => set({ ...DEFAULT_PROGRESS, lang: get().lang }),
      reset: () =>
        set({
          cards: {},
          logs: [],
          lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
          reviewHistory: [],
          practiceSkills: {},
          streak: 0,
          lastStudyDate: null,
          xp: 0,
        }),
    }),
    {
      name: PROGRESS_STORAGE_KEY,
      version: PROGRESS_VERSION,
      skipHydration: true,
      storage: persistStorage,
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

function difficultyRank(card: CardProg): number {
  return card.fsrs?.difficulty ?? 10 - card.ease;
}

export function weakIds(cards: Record<string, CardProg>, limit = 6) {
  return Object.entries(cards)
    .filter(([, card]) => card.lapses >= 2)
    .sort(
      (a, b) =>
        b[1].lapses - a[1].lapses ||
        difficultyRank(b[1]) - difficultyRank(a[1]),
    )
    .slice(0, limit)
    .map(([id, card]) => ({ id, lapses: card.lapses }));
}
