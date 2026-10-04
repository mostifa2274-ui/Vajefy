import { recordPracticeSkill } from "./practice";
import { DEFAULT_PROGRESS, MAX_REVIEW_HISTORY, type DayLog, type Lifetime, type SavedProgress } from "./progress";
import type { SessionRecord } from "./session";
import { freshCard, normalizeRetention, scheduleWithMeta } from "./srs";
import { todayKey, yesterdayKey } from "./text";
import type { CardProg, Grade, PracticeEvidence, PracticeSkill, ReviewEvent } from "./types";

/**
 * Every change to progress is an operation with a unique id. The same pure
 * reducer applies it to the in-memory state and, inside one IndexedDB
 * transaction, to the stored records. The id is stored with the result, so a
 * retried, replayed or duplicated operation is applied exactly once.
 */

export type Profile = Omit<SavedProgress, "cards" | "practiceSkills" | "reviewHistory">;
export type SkillRecord = PracticeEvidence[string];

export type SettingsPatch = Partial<
  Pick<
    Profile,
    | "lang"
    | "focus"
    | "sessionSize"
    | "newPerDay"
    | "voice"
    | "accent"
    | "dailyGoal"
    | "requestRetention"
    | "onboarded"
    | "goal"
    | "minutes"
  >
>;

/** Evidence recorded with an answer. A missing field means "unknown", never "no". */
export type AnswerContext = {
  /** The session the answer belongs to. */
  session?: string;
  /** The prompt format, e.g. "recall", "spell", "listen", "cloze", "to-en". */
  prompt?: string;
  /** The content version of the item when it was shown. */
  contentVersion?: string;
  /** A hint or the answer was shown before the learner answered. */
  hint?: boolean;
  /** Which prompt was shown, e.g. "lex:A1:close/c1", so later assessments can use unseen ones. */
  promptId?: string;
  /** Active response time in milliseconds. */
  responseMs?: number;
};

type OpBase = {
  id: string;
  at: number;
  /** The session as it stands after this operation, saved in the same transaction. */
  sessionState?: SessionRecord;
  /** Received from another device through sync, so it is not uploaded again. */
  origin?: "sync";
};

export type ReplaceReason = "import" | "restore" | "start-over" | "migrate" | "sync";

/**
 * Meeting a word outside an answer: hearing it, seeing its examples or reading
 * its detail or reference note. Recorded so evaluations can account for
 * exposure between reviews; it changes no progress.
 */
export type ExposureKind = "listen" | "example" | "detail" | "reference";

/** What a check-up question asks: recognising the meaning, or using the word. */
export type AssessmentPart = "meaning" | "use";

export type Op = OpBase &
  (
    | ({ type: "review"; item: string; grade: Grade } & AnswerContext)
    | ({ type: "practice"; item: string; grade: Grade; skill?: PracticeSkill } & AnswerContext)
    /** A question the learner could not answer (for example unheard audio): evidence only. */
    | ({ type: "skip"; item: string; skill?: PracticeSkill } & AnswerContext)
    /** Evidence only: the learner met the item outside an answer. */
    | { type: "exposure"; item: string; kind: ExposureKind }
    /**
     * Evidence only: a delayed check-up answer, measuring what was retained.
     * It never changes the schedule, practice skills, counts or XP.
     */
    | ({ type: "assessment"; item: string; part: AssessmentPart; correct: boolean; delayDays: number } & AnswerContext)
    | { type: "introduce"; item: string }
    | { type: "settings"; patch: SettingsPatch }
    | { type: "bookmark"; item: string; on: boolean }
    | { type: "forget"; items: string[] }
    | { type: "undo"; target: string }
    /** Clear learning history, keeping settings. */
    | { type: "reset" }
    | { type: "replace"; reason: ReplaceReason; progress: SavedProgress; meta?: Record<string, unknown> }
    /** Session-only change (reveal, advance, finish): not learning evidence. */
    | { type: "session" }
  );

export type OpType = Op["type"];

/** What an undone review restores. */
export type UndoRecord = {
  card: CardProg | null;
  after: CardProg;
  streak: number;
  lastStudyDate: string | null;
  afterStreak: number;
  afterLastStudyDate: string | null;
};

export type StoredEvent = {
  id: string;
  type: OpType;
  at: number;
  item?: string;
  grade?: Grade;
  skill?: PracticeSkill;
  context?: AnswerContext;
  exposure?: ExposureKind;
  assessment?: { part: AssessmentPart; correct: boolean; delayDays: number };
  /** Scheduler outcome of a review answer; these form the review history. */
  review?: ReviewEvent;
  undo?: UndoRecord;
  undone?: boolean;
  /** For undo operations: the review they reverted, or why they could not. */
  target?: string;
  rejected?: "missing" | "stale";
  reason?: ReplaceReason;
};

export type Snapshot = {
  profile: Profile;
  cards: Record<string, CardProg | undefined>;
  skills: Record<string, SkillRecord | undefined>;
  /** The review an undo operation refers to. */
  target?: StoredEvent;
};

export type Writes = {
  /** Absent only for session-only operations, which need no deduplication. */
  event?: StoredEvent;
  profile?: Profile;
  /** `null` deletes the record. */
  cards?: Record<string, CardProg | null>;
  skills?: Record<string, SkillRecord | null>;
  /** An existing event rewritten by this operation (an undone review). */
  targetEvent?: StoredEvent;
  /** Items whose events are removed together with their progress. */
  forgetItems?: string[];
  replace?: SavedProgress;
  /** Clear cards, skills, events and sessions; the new profile is in `profile`. */
  reset?: true;
  meta?: Record<string, unknown>;
  session?: SessionRecord;
};

export const XP: Record<Grade, number> = { again: 2, hard: 6, good: 10, easy: 14 };
export const PRACTICE_XP: Record<Grade, number> = { again: 0, hard: 1, good: 2, easy: 3 };
const MAX_BOOKMARKS = 400;
const LOG_DAYS = 60;

export function profileOf(state: SavedProgress): Profile {
  const { cards: _cards, practiceSkills: _skills, reviewHistory: _history, ...profile } = state;
  return profile;
}

export function defaultProfile(): Profile {
  return profileOf(structuredClone(DEFAULT_PROGRESS));
}

const EMPTY_LIFETIME: Lifetime = { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 };

/** Which records an operation reads. Undo reads its target first, then the card. */
export function needs(op: Op): { cards: string[]; skills: string[] } {
  switch (op.type) {
    case "review":
    case "introduce":
      return { cards: [op.item], skills: [] };
    case "practice":
      return { cards: [op.item], skills: [op.item] };
    case "forget":
      return { cards: op.items, skills: op.items };
    default:
      return { cards: [], skills: [] };
  }
}

function touchStreak(streak: number, last: string | null, at: number) {
  const day = new Date(at);
  const today = todayKey(day);
  if (last === today) return { streak, lastStudyDate: last };
  if (last === yesterdayKey(day)) return { streak: streak + 1, lastStudyDate: today };
  return { streak: 1, lastStudyDate: today };
}

type LogDelta = Partial<Omit<DayLog, "date">>;

function bumpLog(logs: DayLog[], at: number, delta: LogDelta, sign = 1): DayLog[] {
  const now = new Date(at);
  const cutoff = new Date(at);
  cutoff.setDate(cutoff.getDate() - LOG_DAYS);
  const min = todayKey(cutoff);
  const today = todayKey(now);
  const kept = logs.filter((row) => row.date >= min || row.date === today);
  const row = kept.find((item) => item.date === today) ?? {
    date: today,
    reviews: 0,
    correct: 0,
    practice: 0,
    practiceCorrect: 0,
    introduced: 0,
  };
  const add = (value: number, change = 0) => Math.max(0, value + sign * change);
  const updated: DayLog = {
    date: today,
    reviews: add(row.reviews, delta.reviews),
    correct: add(row.correct, delta.correct),
    practice: add(row.practice, delta.practice),
    practiceCorrect: add(row.practiceCorrect, delta.practiceCorrect),
    introduced: add(row.introduced, delta.introduced),
  };
  return [...kept.filter((item) => item.date !== today), updated].sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove a delta from the log of the day it was recorded, if that day is still kept. */
function unbumpLog(logs: DayLog[], at: number, delta: LogDelta): DayLog[] {
  const day = todayKey(new Date(at));
  if (!logs.some((row) => row.date === day)) return logs;
  return logs.map((row) =>
    row.date === day
      ? {
          ...row,
          reviews: Math.max(0, row.reviews - (delta.reviews ?? 0)),
          correct: Math.max(0, row.correct - (delta.correct ?? 0)),
          introduced: Math.max(0, row.introduced - (delta.introduced ?? 0)),
        }
      : row,
  );
}

function sameCard(a: CardProg | undefined, b: CardProg): boolean {
  return Boolean(a) && JSON.stringify(a) === JSON.stringify(b);
}

function context(op: AnswerContext): AnswerContext | undefined {
  const value: AnswerContext = {};
  if (op.session !== undefined) value.session = op.session;
  if (op.prompt !== undefined) value.prompt = op.prompt;
  if (op.contentVersion !== undefined) value.contentVersion = op.contentVersion;
  if (op.hint !== undefined) value.hint = op.hint;
  if (op.promptId !== undefined) value.promptId = op.promptId;
  if (op.responseMs !== undefined) value.responseMs = Math.max(0, Math.round(op.responseMs));
  return Object.keys(value).length ? value : undefined;
}

function withSession(op: Op, writes: Writes): Writes {
  return op.sessionState ? { ...writes, session: op.sessionState } : writes;
}

export function reduce(op: Op, snap: Snapshot): Writes {
  const profile = snap.profile;
  const base: StoredEvent = { id: op.id, type: op.type, at: op.at };

  switch (op.type) {
    case "review": {
      const previous = snap.cards[op.item];
      const result = scheduleWithMeta(previous ?? freshCard(op.at), op.grade, op.at, profile.requestRetention);
      const correct = op.grade !== "again";
      const streak = touchStreak(profile.streak, profile.lastStudyDate, op.at);
      const review: ReviewEvent = {
        id: op.item,
        at: op.at,
        grade: op.grade,
        algorithm: result.meta.algorithm,
        ...(result.meta.algorithm === "fsrs6" ? { targetRetention: profile.requestRetention } : {}),
        ...(result.meta.bridged ? { bridged: true } : {}),
        elapsedDays: result.meta.elapsedDays,
        scheduledDays: result.meta.scheduledDays,
        ...(result.meta.stability == null ? {} : { stability: result.meta.stability }),
        ...(result.meta.difficulty == null ? {} : { difficulty: result.meta.difficulty }),
      };
      return withSession(op, {
        event: {
          ...base,
          item: op.item,
          grade: op.grade,
          ...(context(op) ? { context: context(op) } : {}),
          review,
          undo: {
            card: previous ?? null,
            after: result.card,
            streak: profile.streak,
            lastStudyDate: profile.lastStudyDate,
            afterStreak: streak.streak,
            afterLastStudyDate: streak.lastStudyDate,
          },
        },
        cards: { [op.item]: result.card },
        profile: {
          ...profile,
          logs: bumpLog(profile.logs, op.at, { reviews: 1, correct: correct ? 1 : 0, introduced: previous ? 0 : 1 }),
          lifetime: {
            ...profile.lifetime,
            reviews: profile.lifetime.reviews + 1,
            correct: profile.lifetime.correct + (correct ? 1 : 0),
          },
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: profile.xp + XP[op.grade],
        },
      });
    }

    // Quiz and timed practice. Recognition under a timer is weaker evidence
    // than recall in Review, so practice never schedules a card later and never
    // adds a word to the schedule. A miss on a scheduled card makes it due now,
    // so the next Review asks it properly.
    case "practice": {
      const card = snap.cards[op.item];
      const missed = op.grade === "again";
      const streak = touchStreak(profile.streak, profile.lastStudyDate, op.at);
      const skills = recordPracticeSkill(
        snap.skills[op.item] ? { [op.item]: snap.skills[op.item]! } : {},
        op.item,
        op.skill,
        op.grade,
        op.at,
      )[op.item];
      return withSession(op, {
        event: {
          ...base,
          item: op.item,
          grade: op.grade,
          ...(op.skill ? { skill: op.skill } : {}),
          ...(context(op) ? { context: context(op) } : {}),
        },
        ...(card && missed && card.due > op.at ? { cards: { [op.item]: { ...card, due: op.at } } } : {}),
        ...(skills ? { skills: { [op.item]: skills } } : {}),
        profile: {
          ...profile,
          logs: bumpLog(profile.logs, op.at, { practice: 1, practiceCorrect: missed ? 0 : 1 }),
          lifetime: {
            ...profile.lifetime,
            practice: profile.lifetime.practice + 1,
            practiceCorrect: profile.lifetime.practiceCorrect + (missed ? 0 : 1),
          },
          streak: streak.streak,
          lastStudyDate: streak.lastStudyDate,
          xp: profile.xp + PRACTICE_XP[op.grade],
        },
      });
    }

    case "skip":
      return withSession(op, {
        event: {
          ...base,
          item: op.item,
          ...(op.skill ? { skill: op.skill } : {}),
          ...(context(op) ? { context: context(op) } : {}),
        },
      });

    case "exposure":
      return withSession(op, { event: { ...base, item: op.item, exposure: op.kind } });

    case "assessment":
      return withSession(op, {
        event: {
          ...base,
          item: op.item,
          assessment: { part: op.part, correct: op.correct, delayDays: op.delayDays },
          ...(context(op) ? { context: context(op) } : {}),
        },
      });

    case "introduce": {
      if (snap.cards[op.item]) return withSession(op, { event: { ...base, item: op.item } });
      return withSession(op, {
        event: { ...base, item: op.item },
        cards: { [op.item]: freshCard(op.at) },
        profile: { ...profile, logs: bumpLog(profile.logs, op.at, { introduced: 1 }) },
      });
    }

    case "settings": {
      const patch: SettingsPatch = { ...op.patch };
      if (patch.requestRetention !== undefined) patch.requestRetention = normalizeRetention(patch.requestRetention);
      return withSession(op, { event: base, profile: { ...profile, ...patch } });
    }

    case "bookmark": {
      const without = profile.bookmarks.filter((id) => id !== op.item);
      const bookmarks = op.on ? [...without, op.item].slice(-MAX_BOOKMARKS) : without;
      return withSession(op, { event: { ...base, item: op.item }, profile: { ...profile, bookmarks } });
    }

    // Drops progress whose entry no longer exists in the data (for example a
    // renamed headword); it could never be shown, yet would stay due forever.
    case "forget":
      return withSession(op, {
        event: base,
        cards: Object.fromEntries(op.items.map((id) => [id, null])),
        skills: Object.fromEntries(op.items.map((id) => [id, null])),
        forgetItems: op.items,
      });

    // Correct an accidental grade. Only the most recent change to a card can be
    // undone, so a later answer from this or another tab is never overwritten.
    case "undo": {
      const target = snap.target;
      const event: StoredEvent = { ...base, target: op.target };
      if (!target || target.type !== "review" || !target.undo || target.undone || !target.item || !target.grade) {
        return withSession(op, { event: { ...event, rejected: "missing" } });
      }
      const undo = target.undo;
      if (!sameCard(snap.cards[target.item], undo.after)) {
        return withSession(op, { event: { ...event, rejected: "stale" } });
      }
      const correct = target.grade !== "again";
      const logs = unbumpLog(profile.logs, target.at, {
        reviews: 1,
        correct: correct ? 1 : 0,
        introduced: undo.card ? 0 : 1,
      });
      const targetDay = todayKey(new Date(target.at));
      // Review and practice are the only operations that advance the streak.
      // Restoring the snapshot is safe only if the undone review was still the
      // day's sole streak-bearing activity. Another answer on the same day can
      // leave the aggregate streak unchanged, so comparing aggregates alone is
      // insufficient (the F8 cross-tab case).
      const dayStillActive = logs.some(
        (row) => row.date === targetDay && (row.reviews > 0 || row.practice > 0),
      );
      const restoreStreak =
        !dayStillActive &&
        profile.streak === undo.afterStreak &&
        profile.lastStudyDate === undo.afterLastStudyDate;
      return withSession(op, {
        event: { ...event, item: target.item },
        cards: { [target.item]: undo.card },
        targetEvent: { ...target, undone: true },
        profile: {
          ...profile,
          logs,
          lifetime: {
            ...profile.lifetime,
            reviews: Math.max(0, profile.lifetime.reviews - 1),
            correct: Math.max(0, profile.lifetime.correct - (correct ? 1 : 0)),
          },
          xp: Math.max(0, profile.xp - XP[target.grade]),
          ...(restoreStreak ? { streak: undo.streak, lastStudyDate: undo.lastStudyDate } : {}),
        },
      });
    }

    case "reset":
      return withSession(op, {
        event: base,
        reset: true,
        profile: { ...profile, logs: [], lifetime: { ...EMPTY_LIFETIME }, streak: 0, lastStudyDate: null, xp: 0 },
      });

    case "replace":
      return {
        event: { ...base, reason: op.reason },
        replace: op.progress,
        ...(op.meta ? { meta: op.meta } : {}),
        ...(op.sessionState ? { session: op.sessionState } : {}),
      };

    case "session":
      return withSession(op, {});
  }
}

/** The review events an operation adds to the in-memory review history. */
export function historyLimit(history: ReviewEvent[]): ReviewEvent[] {
  return history.length > MAX_REVIEW_HISTORY ? history.slice(-MAX_REVIEW_HISTORY) : history;
}
