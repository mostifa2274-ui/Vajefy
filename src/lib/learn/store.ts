import { create } from "zustand";
import { entryIdOf } from "./targets";
import type { AnswerContext, AssessmentPart, ExposureKind, Op, SettingsPatch } from "./ops";
import { CHANNEL, createPersistence, emptyMemory, type Memory } from "./persistence";
import { DEFAULT_PROGRESS, savedProgress, type DayLog, type LearningGoal, type SavedProgress } from "./progress";
import { newId, type SessionRecord } from "./session";
import { isMastered } from "./srs";
import { todayKey } from "./text";
import type { CardProg, Grade, Lang, LevelId, PracticeSkill } from "./types";

export {
  migrateProgress,
  PROGRESS_VERSION,
  savedProgress,
  type DayLog,
  type Lifetime,
  type SavedProgress,
} from "./progress";

/**
 * Extra evidence and the session state to save with an answer. A caller that
 * records the answer in its session first passes the operation id and time.
 */
export type AnswerExtras = AnswerContext & { sessionState?: SessionRecord; id?: string; at?: number };

type ProgressState = Memory & {
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
  completeOnboarding: (focus: LevelId, goal: LearningGoal, minutes: number) => void;
  /** Grade a scheduled recall. Returns the operation id, which undo uses. */
  review: (id: string, grade: Grade, extras?: AnswerExtras) => string;
  practice: (id: string, grade: Grade, skill?: PracticeSkill, extras?: AnswerExtras) => string;
  /** Record a delayed check-up answer: evidence only, nothing else changes. */
  assess: (id: string, part: AssessmentPart, correct: boolean, delayDays: number, extras?: AnswerExtras) => string;
  /** Record that required delayed evidence was unavailable; never score it as wrong. */
  assessMissing: (id: string, part: AssessmentPart, delayDays: number, extras?: AnswerExtras) => string;
  /** Record meeting an item outside an answer (evidence only; repeated meetings within ten minutes count once). */
  expose: (id: string, kind: ExposureKind) => void;
  /** Record a question that could not be answered, without credit or penalty. */
  skip: (id: string, skill?: PracticeSkill, extras?: AnswerExtras) => string;
  /** Revert a review answer, if nothing has changed that card since. */
  undo: (opId: string, sessionState?: SessionRecord) => void;
  addToReview: (id: string) => void;
  forget: (ids: string[]) => void;
  saveSession: (session: SessionRecord) => void;
  importProgress: (saved: SavedProgress) => void;
  /** Replace progress with a recovered save, keeping it exactly as recovered. */
  restoreProgress: (saved: SavedProgress) => void;
  /** Begin again as a new learner, keeping only the interface language. */
  startOver: () => void;
  reset: () => void;
};

const browser = typeof window !== "undefined";

const EXPOSURE_WINDOW_MS = 10 * 60_000;
const lastExposure = new Map<string, number>();

export const useProgress = create<ProgressState>()((set, get) => {
  function dispatch(op: Op) {
    persistence.dispatch(op);
    return op.id;
  }
  const settings = (patch: SettingsPatch) => dispatch({ id: newId(), type: "settings", at: Date.now(), patch });
  const answer = (extras: AnswerExtras = {}) => {
    const { sessionState, id = newId(), at = Date.now(), ...context } = extras;
    return { id, at, context, sessionState };
  };

  return {
    ...emptyMemory(),
    hydrated: false,
    setHydrated: () => set({ hydrated: true }),
    setLang: (lang) => void settings({ lang }),
    setFocus: (focus) => void settings({ focus }),
    setSessionSize: (sessionSize) => void settings({ sessionSize }),
    setNewPerDay: (newPerDay) => void settings({ newPerDay }),
    setVoice: (voice) => void settings({ voice }),
    setAccent: (accent) => void settings({ accent }),
    setDailyGoal: (dailyGoal) => void settings({ dailyGoal }),
    setRequestRetention: (requestRetention) => void settings({ requestRetention }),
    setOnboarded: () => void settings({ onboarded: true }),
    toggleBookmark: (id) =>
      void dispatch({ id: newId(), type: "bookmark", at: Date.now(), item: id, on: !get().bookmarks.includes(id) }),
    completeOnboarding: (focus, goal, minutes) => settings({ focus, goal, minutes, onboarded: true, ...planFor(minutes) }),
    review: (item, grade, extras) => {
      const { id, at, context, sessionState } = answer(extras);
      return dispatch({ id, type: "review", at, item, grade, ...context, sessionState });
    },
    practice: (item, grade, skill, extras) => {
      const { id, at, context, sessionState } = answer(extras);
      return dispatch({
        id,
        type: "practice",
        at,
        item,
        grade,
        ...(skill ? { skill } : {}),
        ...context,
        sessionState,
      });
    },
    skip: (item, skill, extras) => {
      const { id, at, context, sessionState } = answer(extras);
      return dispatch({ id, type: "skip", at, item, ...(skill ? { skill } : {}), ...context, sessionState });
    },
    assess: (item, part, correct, delayDays, extras) => {
      const { id, at, context, sessionState } = answer(extras);
      return dispatch({ id, type: "assessment", at, item, part, correct, delayDays, ...context, sessionState });
    },
    assessMissing: (item, part, delayDays, extras) => {
      const { id, at, context, sessionState } = answer(extras);
      return dispatch({ id, type: "assessment", at, item, part, missing: true, delayDays, ...context, sessionState });
    },
    expose: (item, kind) => {
      const at = Date.now();
      const key = `${kind}\u0000${item}`;
      if (!get().hydrated || at - (lastExposure.get(key) ?? 0) < EXPOSURE_WINDOW_MS) return;
      lastExposure.set(key, at);
      dispatch({ id: newId(), type: "exposure", at, item, kind });
    },
    undo: (target, sessionState) => void dispatch({ id: newId(), type: "undo", at: Date.now(), target, sessionState }),
    addToReview: (id) => {
      if (get().cards[id]) return;
      dispatch({ id: newId(), type: "introduce", at: Date.now(), item: id });
    },
    forget: (ids) => {
      if (!ids.length) return;
      dispatch({ id: newId(), type: "forget", at: Date.now(), items: ids });
    },
    saveSession: (session) => void dispatch({ id: newId(), type: "session", at: Date.now(), sessionState: session }),
    importProgress: (saved) =>
      void dispatch({
        id: newId(),
        type: "replace",
        at: Date.now(),
        reason: "import",
        progress: { ...savedProgress(saved), onboarded: true },
      }),
    restoreProgress: (saved) => void persistence.resolve(savedProgress(saved), "restore"),
    startOver: () =>
      void persistence.resolve({ ...structuredClone(DEFAULT_PROGRESS), lang: get().lang }, "start-over"),
    reset: () => void dispatch({ id: newId(), type: "reset", at: Date.now() }),
  };
});

export const persistence = createPersistence({
  read: () => useProgress.getState(),
  write: (patch) => useProgress.setState(patch),
  hydrated: () => useProgress.getState().setHydrated(),
  idb: () => (browser && "indexedDB" in window ? window.indexedDB : undefined),
  localStorage: () => {
    try {
      return browser ? window.localStorage : undefined;
    } catch {
      return undefined;
    }
  },
  channel: () => (browser && "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : undefined),
});

/**
 * A daily plan that fits the learner's time: new words and session length grow
 * with the minutes available, and Review still comes first each day.
 */
export function planFor(minutes: number) {
  if (minutes <= 5) return { newPerDay: 3, sessionSize: 10, dailyGoal: 10 };
  if (minutes >= 15) return { newPerDay: 8, sessionSize: 30, dailyGoal: 30 };
  return { newPerDay: 5, sessionSize: 20, dailyGoal: 20 };
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

/** The streak as of today: it is broken once a whole day passes without study. */
export function liveStreak(streak: number, lastStudyDate: string | null, now = new Date()): number {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastStudyDate === todayKey(now) || lastStudyDate === todayKey(yesterday)) return streak;
  return 0;
}

export function dueIds(cards: Record<string, CardProg>, now = Date.now()): string[] {
  return Object.entries(cards)
    .filter(([, card]) => card.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

/**
 * Entries of a level the learner has met and mastered. Further senses of an
 * entry (`id#sense`) are separate learning targets, but the level's word count
 * is per entry, so an entry counts once and is mastered by its main sense.
 */
export function countLevel(cards: Record<string, CardProg>, level: LevelId) {
  const prefix = `lex:${level}:`;
  const seen = new Set<string>();
  let mastered = 0;
  for (const [id, card] of Object.entries(cards)) {
    if (!id.startsWith(prefix)) continue;
    seen.add(entryIdOf(id));
    if (!id.includes("#") && isMastered(card)) mastered += 1;
  }
  return { seen: seen.size, mastered };
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
    .sort((a, b) => b[1].lapses - a[1].lapses || difficultyRank(b[1]) - difficultyRank(a[1]))
    .slice(0, limit)
    .map(([id, card]) => ({ id, lapses: card.lapses }));
}
