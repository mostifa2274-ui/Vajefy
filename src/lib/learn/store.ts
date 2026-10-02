import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { freshCard, knownCard, schedule } from "./srs";
import { todayKey, yesterdayKey } from "./text";
import type { CardProg, Grade, Lang, LevelId } from "./types";

export type DayLog = {
  date: string;
  reviews: number;
  correct: number;
  introduced: number;
};

type ProgressState = {
  cards: Record<string, CardProg>;
  logs: DayLog[];
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
  addToReview: (id: string) => void;
  markKnown: (id: string) => void;
  reset: () => void;
};

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

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      cards: {},
      logs: [],
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
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: state.xp + XP[grade],
        });
        return next;
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
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: state.xp + 10,
        });
      },
      reset: () =>
        set({
          cards: {},
          logs: [],
          streak: 0,
          lastStudyDate: null,
          xp: 0,
        }),
    }),
    {
      name: "roshana-v1",
      skipHydration: true,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        cards: state.cards,
        logs: state.logs,
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
      }),
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
    if (card.state === "review" && card.interval >= 21) mastered += 1;
  }
  return { seen, mastered };
}

export function totals(cards: Record<string, CardProg>) {
  let seen = 0;
  let mastered = 0;
  for (const card of Object.values(cards)) {
    seen += 1;
    if (card.state === "review" && card.interval >= 21) mastered += 1;
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
