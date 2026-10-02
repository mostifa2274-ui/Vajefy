import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { freshCard, isMastered, knownCard, schedule } from "./srs";
import { todayKey, yesterdayKey } from "./text";
import type { CardProg, Grade, Lang, LevelId } from "./types";

export type DayLog = {
  date: string;
  reviews: number;
  correct: number;
  introduced: number;
};

export type Lifetime = { reviews: number; correct: number };

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
  setDailyGoal: (dailyGoal: number) => void;
  setOnboarded: () => void;
  toggleBookmark: (id: string) => void;
  completeOnboarding: (focus: LevelId, dailyGoal: number) => void;
  review: (id: string, grade: Grade) => CardProg;
  practice: (id: string, grade: Grade) => void;
  addToReview: (id: string) => void;
  markKnown: (id: string) => void;
  forget: (ids: string[]) => void;
  importProgress: (saved: SavedProgress) => void;
  reset: () => void;
};

/** Bump when the saved shape changes, and teach `migrate` the old shape. */
export const PROGRESS_VERSION = 1;

const XP: Record<Grade, number> = { again: 2, hard: 6, good: 10, easy: 14 };

const memory = new Map<string, string>();

const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return memory.get(key) ?? null;
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") memory.set(key, value);
    else localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") memory.delete(key);
    else localStorage.removeItem(key);
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
  delta: { reviews?: number; correct?: number; introduced?: number },
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const min = todayKey(cutoff);
  const next = logs.filter((row) => row.date >= min);
  const row = next.find((item) => item.date === today) ?? {
    date: today,
    reviews: 0,
    correct: 0,
    introduced: 0,
  };
  const updated: DayLog = {
    date: today,
    reviews: row.reviews + (delta.reviews ?? 0),
    correct: row.correct + (delta.correct ?? 0),
    introduced: row.introduced + (delta.introduced ?? 0),
  };
  return [...next.filter((item) => item.date !== today), updated];
}

function bumpLifetime(lifetime: Lifetime, correct: boolean): Lifetime {
  return { reviews: lifetime.reviews + 1, correct: lifetime.correct + (correct ? 1 : 0) };
}

export function todayLog(logs: DayLog[], today = todayKey()): DayLog {
  return (
    logs.find((row) => row.date === today) ?? {
      date: today,
      reviews: 0,
      correct: 0,
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
  lifetime: { reviews: 0, correct: 0 },
  streak: 0,
  lastStudyDate: null,
  xp: 0,
  lang: "fa",
  focus: "A1",
  sessionSize: 20,
  newPerDay: 10,
  voice: false,
  bookmarks: [],
  dailyGoal: 20,
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
    bookmarks: state.bookmarks,
    dailyGoal: state.dailyGoal,
    onboarded: state.onboarded,
  };
}

/** Upgrade a saved state from any earlier `PROGRESS_VERSION`. */
export function migrateProgress(persisted: unknown, version: number): SavedProgress {
  const state = { ...DEFAULTS, ...(persisted as Partial<SavedProgress>) };
  if (version < 1) {
    // v0 kept only the last 60 days of logs; seed lifetime totals from them.
    state.lifetime = (state.logs ?? []).reduce(
      (sum, row) => ({ reviews: sum.reviews + row.reviews, correct: sum.correct + row.correct }),
      { reviews: 0, correct: 0 },
    );
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
        const existed = Boolean(state.cards[id]);
        const next = schedule(state.cards[id] ?? freshCard(now), grade, now);
        const streak = touchStreak(state.streak, state.lastStudyDate, today);
        set({
          cards: { ...state.cards, [id]: next },
          logs: bumpLog(state.logs, today, {
            reviews: 1,
            correct: grade === "again" ? 0 : 1,
            introduced: existed ? 0 : 1,
          }),
          lifetime: bumpLifetime(state.lifetime, grade !== "again"),
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
          logs: bumpLog(state.logs, today, { reviews: 1, correct: missed ? 0 : 1 }),
          lifetime: bumpLifetime(state.lifetime, !missed),
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: state.xp + XP[grade],
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
      markKnown: (id) => {
        const now = Date.now();
        const today = todayKey();
        const state = get();
        const existed = Boolean(state.cards[id]);
        const streak = touchStreak(state.streak, state.lastStudyDate, today);
        set({
          cards: { ...state.cards, [id]: knownCard(now) },
          logs: bumpLog(state.logs, today, {
            reviews: 1,
            correct: 1,
            introduced: existed ? 0 : 1,
          }),
          lifetime: bumpLifetime(state.lifetime, true),
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: state.xp + 10,
        });
      },
      // Drops cards whose entry no longer exists in the data (e.g. a headword
      // was renamed); they could never be shown, yet would stay "due" forever.
      forget: (ids) => {
        if (!ids.length) return;
        const cards = { ...get().cards };
        for (const id of ids) delete cards[id];
        set({ cards });
      },
      importProgress: (saved) => set({ ...savedProgress(saved), onboarded: true }),
      reset: () =>
        set({
          cards: {},
          logs: [],
          lifetime: { reviews: 0, correct: 0 },
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
