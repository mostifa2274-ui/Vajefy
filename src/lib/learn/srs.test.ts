import assert from "node:assert/strict";
import test from "node:test";
import { freshCard, isMastered, knownCard, schedule } from "./srs";
import type { CardProg } from "./types";

const DAY = 86400000;
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 2, 9);

test("answering again and again within minutes cannot reach mastered", () => {
  let card = freshCard(T0);
  for (let i = 1; i <= 12; i++) card = schedule(card, "good", T0 + i * MIN);
  assert.equal(card.state, "review");
  assert.equal(card.interval, 1);
  assert.equal(isMastered(card), false);
});

test("on-time reviews still grow by ease", () => {
  let card = freshCard(T0);
  card = schedule(card, "good", T0);
  card = schedule(card, "good", T0 + 10 * MIN);
  const seen: number[] = [card.interval];
  for (let i = 0; i < 4; i++) {
    card = schedule(card, "good", card.due);
    seen.push(card.interval);
  }
  assert.deepEqual(seen, [1, 3, 8, 20, 50]);
  assert.equal(isMastered(card), true);
});

test("an early pass on a mature card keeps its interval", () => {
  const mature: CardProg = {
    ease: 2.5,
    interval: 30,
    due: T0 + 30 * DAY,
    reps: 4,
    lapses: 0,
    state: "review",
    step: 0,
    last: T0,
  };
  const next = schedule(mature, "good", T0 + DAY);
  assert.equal(next.interval, 30);
  assert.equal(next.due, T0 + DAY + 30 * DAY);
  assert.equal(next.last, T0 + DAY);
});

test("a late review grows from the scheduled interval, not the delay", () => {
  const card: CardProg = { ease: 2.5, interval: 10, due: T0 + 10 * DAY, reps: 2, lapses: 0, state: "review", step: 0, last: T0 };
  assert.equal(schedule(card, "good", T0 + 40 * DAY).interval, 25);
});

test("cards saved before `last` existed infer it from due and interval", () => {
  const legacy: CardProg = { ease: 2.5, interval: 8, due: T0 + 8 * DAY, reps: 3, lapses: 0, state: "review", step: 0 };
  assert.equal(schedule(legacy, "good", T0 + 8 * DAY).interval, 20);
  assert.equal(schedule(legacy, "good", T0 + MIN).interval, 8);
});

test("hard on time grows by 1.2 and lowers ease", () => {
  const card: CardProg = { ease: 2.5, interval: 10, due: T0 + 10 * DAY, reps: 2, lapses: 0, state: "review", step: 0, last: T0 };
  const next = schedule(card, "hard", T0 + 10 * DAY);
  assert.equal(next.interval, 12);
  assert.equal(next.ease, 2.45);
});

test("again sends a review card back to learning", () => {
  const next = schedule(knownCard(T0), "again", T0 + 21 * DAY);
  assert.equal(next.state, "learning");
  assert.equal(next.interval, 0);
  assert.equal(next.lapses, 1);
  assert.equal(next.due, T0 + 21 * DAY + MIN);
});
