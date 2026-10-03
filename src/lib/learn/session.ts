import type { LessonSession } from "./lesson";
import type { CardProg, Grade, LevelId, Question } from "./types";

/**
 * A session is saved with every answer, in the same transaction, so a learner
 * who leaves midway resumes at the same question with the same remaining queue
 * and score, and an answered question is never asked again by the resume.
 */

const MINUTE = 60_000;
/** A card that will be due again within this time comes back in the same session. */
export const REQUEUE_WINDOW_MS = 10 * MINUTE + 5_000;
/** An unfinished session older than this is not offered for resuming. */
export const RESUME_WINDOW_MS = 24 * 60 * MINUTE;

export type ReviewAnswer = { op: string; item: string; grade: Grade; at: number; undone?: boolean };

export type ReviewQueueItem = {
  id: string;
  isNew: boolean;
  /** Earliest time to show it again: missed and learning cards wait for their real relearning step. */
  dueAt: number;
};

export type ReviewSession = {
  id: string;
  kind: "review";
  status: "active" | "done";
  createdAt: number;
  updatedAt: number;
  focus: LevelId;
  queue: ReviewQueueItem[];
  /** New items whose teaching card has been seen. */
  taught: string[];
  /** The current card's answer is visible. */
  revealed: boolean;
  answers: ReviewAnswer[];
  /** Distinct items at the start, for progress display. */
  total: number;
};

export type QuizAnswer = {
  op: string;
  question: number;
  grade: Grade | "skipped";
  at: number;
  picked?: string;
  typed?: string;
  past?: string;
  pp?: string;
};

export type QuizSession = {
  id: string;
  kind: "quiz";
  status: "active" | "done";
  createdAt: number;
  updatedAt: number;
  mode: string;
  smart: boolean;
  questions: Question[];
  /** The question on screen. It may already be answered and waiting for "Next". */
  index: number;
  answers: QuizAnswer[];
};

export type SessionRecord = ReviewSession | QuizSession | LessonSession;

export function newId(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function startReview(items: { id: string; isNew: boolean }[], focus: LevelId, now: number): ReviewSession {
  return {
    id: newId(),
    kind: "review",
    status: items.length ? "active" : "done",
    createdAt: now,
    updatedAt: now,
    focus,
    queue: items.map((item) => ({ ...item, dueAt: 0 })),
    taught: [],
    revealed: false,
    answers: [],
    total: items.length,
  };
}

export type NextReview = { item: ReviewQueueItem } | { waitUntil: number } | { done: true };

/** The first card that may be shown now; otherwise when the next one becomes due. */
export function nextReview(session: ReviewSession, now: number): NextReview {
  if (!session.queue.length || session.status === "done") return { done: true };
  const ready = session.queue.find((item) => item.dueAt <= now);
  if (ready) return { item: ready };
  return { waitUntil: Math.min(...session.queue.map((item) => item.dueAt)) };
}

function stillLearning(card: CardProg): boolean {
  if (card.fsrs) return card.fsrs.state === "learning" || card.fsrs.state === "relearning";
  return card.state === "learning";
}

/**
 * Record an answer. A card whose next real step falls within the requeue
 * window returns at that time; anything later belongs to a future session.
 */
export function answerReview(
  session: ReviewSession,
  item: string,
  grade: Grade,
  card: CardProg,
  op: string,
  now: number,
): ReviewSession {
  const current = session.queue.find((entry) => entry.id === item);
  const rest = session.queue.filter((entry) => entry.id !== item);
  const comesBack = stillLearning(card) && card.due - now <= REQUEUE_WINDOW_MS;
  const queue = comesBack && current ? [...rest, { ...current, dueAt: card.due }] : rest;
  return {
    ...session,
    queue,
    revealed: false,
    answers: [...session.answers, { op, item, grade, at: now }],
    status: queue.length ? "active" : "done",
    updatedAt: now,
  };
}

/** Put the undone answer's card back at the front, as it was before the grade. */
export function undoReview(session: ReviewSession, op: string, now: number): ReviewSession {
  const answer = session.answers.find((entry) => entry.op === op && !entry.undone);
  if (!answer) return session;
  // Only new items are ever taught, so that list says how to label it again.
  const original = session.queue.find((entry) => entry.id === answer.item) ?? {
    id: answer.item,
    isNew: session.taught.includes(answer.item),
    dueAt: 0,
  };
  return {
    ...session,
    queue: [{ ...original, dueAt: 0 }, ...session.queue.filter((entry) => entry.id !== answer.item)],
    answers: session.answers.map((entry) => (entry.op === op ? { ...entry, undone: true } : entry)),
    revealed: true,
    status: "active",
    updatedAt: now,
  };
}

export function lastUndoable(session: ReviewSession): ReviewAnswer | undefined {
  const live = session.answers.filter((entry) => !entry.undone);
  return live[live.length - 1];
}

export function reviewStats(session: ReviewSession) {
  const live = session.answers.filter((entry) => !entry.undone);
  const correct = live.filter((entry) => entry.grade !== "again").length;
  const misses = [...new Set(live.filter((entry) => entry.grade === "again").map((entry) => entry.item))];
  return { reviews: live.length, correct, misses };
}

export function startQuiz(questions: Question[], mode: string, smart: boolean, now: number): QuizSession {
  return {
    id: newId(),
    kind: "quiz",
    status: questions.length ? "active" : "done",
    createdAt: now,
    updatedAt: now,
    mode,
    smart,
    questions,
    index: 0,
    answers: [],
  };
}

export function quizAnswerFor(session: QuizSession, index = session.index): QuizAnswer | undefined {
  return session.answers.find((entry) => entry.question === index);
}

export function answerQuiz(session: QuizSession, answer: Omit<QuizAnswer, "question">): QuizSession {
  if (quizAnswerFor(session)) return session;
  return {
    ...session,
    answers: [...session.answers, { ...answer, question: session.index }],
    updatedAt: answer.at,
  };
}

/** Move past the current question; a skipped one is already recorded as such. */
export function advanceQuiz(session: QuizSession, now: number): QuizSession {
  const index = Math.min(session.questions.length, session.index + 1);
  return { ...session, index, status: index >= session.questions.length ? "done" : "active", updatedAt: now };
}

export function quizStats(session: QuizSession) {
  const graded = session.answers.filter((entry) => entry.grade !== "skipped");
  return {
    correct: graded.filter((entry) => entry.grade !== "again").length,
    answered: graded.length,
    skipped: session.answers.length - graded.length,
  };
}

/** The most recent unfinished session of a kind that is still worth resuming. */
export function resumable<K extends SessionRecord["kind"]>(
  sessions: Record<string, SessionRecord>,
  kind: K,
  now: number,
): Extract<SessionRecord, { kind: K }> | undefined {
  return Object.values(sessions)
    .filter((session): session is Extract<SessionRecord, { kind: K }> => session.kind === kind)
    .filter((session) => session.status === "active" && now - session.updatedAt <= RESUME_WINDOW_MS)
    // A round whose every question is answered has nothing left to resume.
    .filter((session: SessionRecord) => session.kind !== "quiz" || session.answers.length < session.questions.length)
    .filter((session: SessionRecord) => session.kind !== "lesson" || session.index < session.steps.length)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
