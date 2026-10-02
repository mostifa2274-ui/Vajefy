import assert from "node:assert/strict";
import test from "node:test";
import {
  freshCard,
  isMastered,
  retrievability,
  schedule,
  scheduleWithMeta,
} from "./srs";
import type { CardProg } from "./types";

const DAY = 86_400_000;
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 2, 9);

function nativeReviewCard(): CardProg {
  let card = freshCard(T0);
  card = schedule(card, "good", T0);
  card = schedule(card, "good", card.due);
  assert.equal(card.state, "review");
  assert.equal(card.fsrs?.state, "review");
  return card;
}

test("new cards enter FSRS-6 immediately", () => {
  const card = freshCard(T0);
  assert.equal(card.fsrs?.model, "fsrs6");
  assert.equal(card.fsrs?.state, "new");

  const first = schedule(card, "good", T0);
  assert.equal(first.state, "learning");
  assert.equal(first.fsrs?.state, "learning");
  assert.equal(first.due, T0 + 10 * MIN);

  const second = schedule(first, "good", first.due);
  assert.equal(second.state, "review");
  assert.equal(second.fsrs?.state, "review");
  assert.ok(second.interval >= 1);
});

test("rapid early answers cannot fake mastery", () => {
  let card = nativeReviewCard();
  const start = card.last ?? T0;
  for (let i = 1; i <= 12; i++) {
    card = schedule(card, "good", start + i * MIN);
  }
  assert.equal(card.state, "review");
  assert.equal(isMastered(card), false);
});

test("target retention changes future workload in the expected direction", () => {
  const card = nativeReviewCard();
  const when = card.due;
  const lower = schedule(card, "good", when, 0.85);
  const higher = schedule(card, "good", when, 0.95);
  assert.ok(higher.interval <= lower.interval);
  assert.ok(higher.due <= lower.due);
});

test("legacy review cards bridge at their next real review", () => {
  const legacy: CardProg = {
    ease: 2.5,
    interval: 30,
    due: T0 + 30 * DAY,
    reps: 4,
    lapses: 0,
    state: "review",
    step: 0,
    last: T0,
  };

  const before = retrievability(legacy, legacy.due, 0.9);
  const beforeAtHigherFutureTarget = retrievability(legacy, legacy.due, 0.95);
  assert.ok(before != null);
  assert.ok(beforeAtHigherFutureTarget != null);
  assert.ok(Math.abs(before - 0.9) < 0.000001);
  assert.ok(Math.abs(beforeAtHigherFutureTarget - 0.9) < 0.000001);

  const result = scheduleWithMeta(legacy, "good", legacy.due, 0.9);
  assert.equal(result.meta.algorithm, "fsrs6");
  assert.equal(result.meta.bridged, true);
  assert.equal(result.card.fsrs?.model, "fsrs6");
  assert.equal(result.card.last, legacy.due);
  assert.ok(result.card.due > legacy.due);
});

test("legacy cards without an explicit last review infer it from due minus interval", () => {
  const legacy: CardProg = {
    ease: 2.5,
    interval: 8,
    due: T0 + 8 * DAY,
    reps: 3,
    lapses: 0,
    state: "review",
    step: 0,
  };
  const r = retrievability(legacy, legacy.due, 0.9);
  assert.ok(r != null);
  assert.ok(Math.abs(r - 0.9) < 0.000001);
});

test("legacy cards already inside a short learning step are not reinterpreted", () => {
  const legacyLearning: CardProg = {
    ease: 2.5,
    interval: 0,
    due: T0,
    reps: 0,
    lapses: 0,
    state: "learning",
    step: 0,
  };
  const result = scheduleWithMeta(legacyLearning, "good", T0);
  assert.equal(result.meta.algorithm, "legacy");
  assert.equal(result.card.fsrs, undefined);
  assert.equal(result.card.step, 1);
  assert.equal(result.card.due, T0 + 10 * MIN);
});

test("again sends an FSRS review card through relearning and increments lapses", () => {
  const card = nativeReviewCard();
  const before = card.lapses;
  const now = card.due;
  const next = schedule(card, "again", now);
  assert.equal(next.state, "learning");
  assert.equal(next.fsrs?.state, "relearning");
  assert.equal(next.interval, 0);
  assert.equal(next.lapses, before + 1);
  assert.equal(next.due, now + 10 * MIN);
});

test("mastery uses FSRS stability rather than a legacy ease heuristic", () => {
  const card = nativeReviewCard();
  assert.equal(isMastered(card), (card.fsrs?.stability ?? 0) >= 21);
});
