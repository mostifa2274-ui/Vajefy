import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceQuiz,
  answerQuiz,
  answerReview,
  lastUndoable,
  nextReview,
  quizStats,
  resumable,
  RESUME_WINDOW_MS,
  reviewStats,
  startQuiz,
  startReview,
  undoReview,
} from "./session";
import { freshCard, schedule } from "./srs";
import type { CardProg, Question } from "./types";

const T0 = new Date(2026, 9, 2, 9).getTime();
const MINUTE = 60_000;
const DAY = 86_400_000;

const mature: CardProg = {
  ease: 2.5, interval: 20, due: T0 - MINUTE, reps: 6, lapses: 0, state: "review", step: 0, last: T0 - 20 * DAY,
  fsrs: { model: "fsrs6", stability: 20, difficulty: 5, scheduledDays: 20, learningSteps: 0, state: "review", lastReview: T0 - 20 * DAY },
};

test("a missed card returns at its real relearning time, a passed one leaves", () => {
  const session = startReview([{ id: "a", isNew: false }, { id: "b", isNew: false }], "A1", T0);
  const missed = schedule(mature, "again", T0, 0.9);
  const afterMiss = answerReview(session, "a", "again", missed, "op1", T0);
  assert.deepEqual(afterMiss.queue.map((item) => item.id), ["b", "a"]);
  assert.equal(afterMiss.queue[1]!.dueAt, missed.due);
  assert.ok(missed.due - T0 <= 10 * MINUTE);
  const passed = schedule(mature, "good", T0, 0.9);
  const afterPass = answerReview(afterMiss, "b", "good", passed, "op2", T0);
  assert.deepEqual(afterPass.queue.map((item) => item.id), ["a"]);
  // Only the missed card remains and it is not due yet: wait for it.
  assert.deepEqual(nextReview(afterPass, T0), { waitUntil: missed.due });
  const ready = nextReview(afterPass, missed.due);
  assert.ok("item" in ready && ready.item.id === "a");
});

test("a new card graded good returns once after its ten-minute step", () => {
  const session = startReview([{ id: "n", isNew: true }], "A1", T0);
  const card = schedule(freshCard(T0), "good", T0, 0.9);
  const after = answerReview(session, "n", "good", card, "op", T0);
  assert.equal(after.queue.length, 1);
  assert.equal(after.queue[0]!.dueAt, card.due);
  const later = answerReview(after, "n", "good", schedule(card, "good", card.due, 0.9), "op2", card.due);
  assert.equal(later.status, "done");
});

test("undo puts the card back, revealed, and removes the answer from the score", () => {
  let session = startReview([{ id: "a", isNew: false }, { id: "b", isNew: false }], "A1", T0);
  session = answerReview(session, "a", "again", schedule(mature, "again", T0, 0.9), "op1", T0);
  assert.equal(lastUndoable(session)?.op, "op1");
  session = undoReview(session, "op1", T0 + 1000);
  assert.equal(session.queue[0]!.id, "a");
  assert.equal(session.queue[0]!.dueAt, 0);
  assert.equal(session.revealed, true);
  assert.deepEqual(reviewStats(session), { reviews: 0, correct: 0, misses: [] });
  assert.equal(lastUndoable(session), undefined);
});

test("quiz answers are kept per question and skips are not scored", () => {
  const questions = [{ id: "q1" }, { id: "q2" }, { id: "q3" }] as unknown as Question[];
  let session = startQuiz(questions, "to-fa", false, T0);
  session = answerQuiz(session, { op: "o1", grade: "good", at: T0, picked: "x" });
  // A second answer to the same question is ignored.
  session = answerQuiz(session, { op: "o2", grade: "again", at: T0 });
  session = advanceQuiz(session, T0);
  session = advanceQuiz(answerQuiz(session, { op: "o3", grade: "skipped", at: T0 }), T0);
  assert.equal(session.index, 2);
  assert.deepEqual(quizStats(session), { correct: 1, answered: 1, skipped: 1 });
  session = advanceQuiz(answerQuiz(session, { op: "o4", grade: "again", at: T0 }), T0);
  assert.equal(session.status, "done");
});

test("only recent, unfinished sessions with something left are resumable", () => {
  const review = { ...startReview([{ id: "a", isNew: false }], "A1", T0), id: "r" };
  const old = { ...review, id: "old", updatedAt: T0 - RESUME_WINDOW_MS - 1 };
  const questions = [{ id: "q1" }] as unknown as Question[];
  const answered = { ...answerQuiz(startQuiz(questions, "smart", true, T0), { op: "o", grade: "good", at: T0 }), id: "q" };
  const sessions = { r: review, old, q: answered };
  assert.equal(resumable(sessions, "review", T0)?.id, "r");
  assert.equal(resumable(sessions, "quiz", T0), undefined);
  assert.equal(resumable({ old }, "review", T0), undefined);
});
