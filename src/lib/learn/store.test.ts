import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { liveStreak, migrateProgress, todayLog, useProgress } from "./store";
import type { CardProg } from "./types";

const DAY = 86400000;
const NOW = new Date(2026, 9, 2, 12).getTime();

const mature: CardProg = {
  ease: 2.5,
  interval: 30,
  due: NOW + 20 * DAY,
  reps: 4,
  lapses: 0,
  state: "review",
  step: 0,
  last: NOW - 10 * DAY,
};

beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ["Date"], now: NOW });
  useProgress.setState({
    cards: {},
    logs: [],
    lifetime: { reviews: 0, correct: 0 },
    streak: 0,
    lastStudyDate: null,
    xp: 0,
  });
});

test("practice never adds a word to the schedule", () => {
  const { practice } = useProgress.getState();
  practice("lex:A1:about", "good");
  practice("lex:A1:above", "again");
  const state = useProgress.getState();
  assert.deepEqual(state.cards, {});
  assert.deepEqual(todayLog(state.logs), { date: todayLog([]).date, reviews: 2, correct: 1, introduced: 0 });
  assert.deepEqual(state.lifetime, { reviews: 2, correct: 1 });
  assert.equal(state.streak, 1);
});

test("a correct practice answer leaves a scheduled card untouched", () => {
  useProgress.setState({ cards: { "lex:A1:about": mature } });
  useProgress.getState().practice("lex:A1:about", "good");
  assert.deepEqual(useProgress.getState().cards["lex:A1:about"], mature);
});

test("a practice miss makes a scheduled card due now without resetting it", () => {
  useProgress.setState({ cards: { "lex:A1:about": mature } });
  useProgress.getState().practice("lex:A1:about", "again");
  const card = useProgress.getState().cards["lex:A1:about"]!;
  assert.equal(card.due, NOW);
  assert.equal(card.interval, 30);
  assert.equal(card.lapses, 0);
});

test("review enrols a new word and counts it as introduced", () => {
  useProgress.getState().review("lex:A1:about", "good");
  const state = useProgress.getState();
  assert.equal(state.cards["lex:A1:about"]?.state, "learning");
  assert.equal(todayLog(state.logs).introduced, 1);
});

test("forget drops the given cards only", () => {
  useProgress.setState({ cards: { a: mature, b: mature } });
  useProgress.getState().forget(["a"]);
  assert.deepEqual(Object.keys(useProgress.getState().cards), ["b"]);
});

test("a streak is broken once a whole day passes without study", () => {
  const now = new Date(2026, 9, 10, 9);
  assert.equal(liveStreak(12, "2026-10-10", now), 12);
  assert.equal(liveStreak(12, "2026-10-09", now), 12);
  assert.equal(liveStreak(12, "2026-10-04", now), 0);
  assert.equal(liveStreak(12, null, now), 0);
});

test("v0 saves gain lifetime totals from their logs", () => {
  const v0 = {
    cards: { a: mature },
    logs: [
      { date: "2026-09-30", reviews: 20, correct: 18, introduced: 5 },
      { date: "2026-10-01", reviews: 10, correct: 7, introduced: 2 },
    ],
    streak: 3,
    lastStudyDate: "2026-10-01",
    xp: 300,
    lang: "en",
    focus: "B1",
  };
  const migrated = migrateProgress(v0, 0);
  assert.deepEqual(migrated.lifetime, { reviews: 30, correct: 25 });
  assert.equal(migrated.focus, "B1");
  assert.deepEqual(migrated.cards, { a: mature });
  assert.equal(migrated.dailyGoal, 20);
});
