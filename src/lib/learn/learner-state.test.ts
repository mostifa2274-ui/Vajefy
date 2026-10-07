import assert from "node:assert/strict";
import test from "node:test";
import { learnerState, learnerStateCounts, retainedEvidence } from "./learner-state";
import type { CardProg, ReviewEvent } from "./types";

const NOW = 1_800_000_000_000;

function card(due: number): CardProg {
  return {
    ease: 2.5,
    interval: 1,
    due,
    reps: 1,
    lapses: 0,
    state: "review",
    step: 0,
  };
}

function review(id: string, at: number, grade: ReviewEvent["grade"], elapsedDays: number): ReviewEvent {
  return {
    id,
    at,
    grade,
    algorithm: "fsrs6",
    elapsedDays,
    scheduledDays: 1,
  };
}

test("formal state precedence keeps due work visible and ready session-local", () => {
  assert.equal(learnerState(undefined, { now: NOW }), "new");
  assert.equal(learnerState(card(NOW), { now: NOW, ready: true, retained: true }), "due");
  assert.equal(learnerState(card(NOW + 1_000), { now: NOW, ready: true, retained: true }), "ready");
  assert.equal(learnerState(card(NOW + 1_000), { now: NOW, retained: true }), "retained");
  assert.equal(learnerState(card(NOW + 1_000), { now: NOW }), "learning");
});

test("retained evidence requires the latest scheduled review to succeed after at least a day", () => {
  const history = [
    review("a", NOW - 3_000, "good", 2),
    review("a", NOW - 2_000, "again", 3),
    review("b", NOW - 3_000, "good", 0),
    review("c", NOW - 3_000, "hard", 1),
  ];
  const retained = retainedEvidence(history);
  assert.equal(retained.get("a"), false, "a later miss clears an older retained result");
  assert.equal(retained.get("b"), false, "same-day success is not delayed retention");
  assert.equal(retained.get("c"), true);
});

test("introduced-state counts separate due, learning and retained targets", () => {
  const cards = {
    due: card(NOW),
    learning: card(NOW + 10_000),
    retained: card(NOW + 20_000),
  };
  const history = [review("retained", NOW - 1_000, "good", 2)];
  assert.deepEqual(learnerStateCounts(cards, history, NOW), {
    learning: 1,
    due: 1,
    retained: 1,
  });
});
