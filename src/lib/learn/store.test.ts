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
    lifetime: { reviews: 0, correct: 0, practice: 0, practiceCorrect: 0 },
    streak: 0,
    lastStudyDate: null,
    xp: 0,
    requestRetention: 0.9,
    reviewHistory: [],
  });
});

test("practice never adds a word to the schedule", () => {
  const { practice } = useProgress.getState();
  practice("lex:A1:about", "good");
  practice("lex:A1:above", "again");
  const state = useProgress.getState();
  assert.deepEqual(state.cards, {});
  assert.deepEqual(todayLog(state.logs), {
    date: todayLog([]).date,
    reviews: 0,
    correct: 0,
    practice: 2,
    practiceCorrect: 1,
    introduced: 0,
  });
  assert.deepEqual(state.lifetime, { reviews: 0, correct: 0, practice: 2, practiceCorrect: 1 });
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
  assert.deepEqual(migrated.lifetime, { reviews: 30, correct: 25, practice: 0, practiceCorrect: 0 });
  assert.equal(migrated.focus, "B1");
  assert.deepEqual(migrated.cards, { a: mature });
  assert.equal(migrated.dailyGoal, 20);
  assert.equal(migrated.accent, "en-GB");
  assert.equal(migrated.requestRetention, 0.9);
  assert.deepEqual(migrated.reviewHistory, []);
});

test("practice cannot satisfy the daily review goal or retention accuracy", () => {
  const state = useProgress.getState();
  state.practice("lex:A1:about", "good");
  state.practice("lex:A1:above", "good");
  const afterPractice = useProgress.getState();
  assert.equal(todayLog(afterPractice.logs).reviews, 0);
  assert.equal(afterPractice.lifetime.reviews, 0);
  assert.equal(afterPractice.lifetime.practice, 2);

  afterPractice.review("lex:A1:about", "good");
  const afterReview = useProgress.getState();
  assert.equal(todayLog(afterReview.logs).reviews, 1);
  assert.equal(afterReview.lifetime.reviews, 1);
  assert.equal(afterReview.lifetime.correct, 1);
  assert.equal(afterReview.lifetime.practice, 2);
});

test("scheduled reviews append real FSRS evidence while practice does not", () => {
  const state = useProgress.getState();
  state.practice("lex:A1:about", "good");
  assert.equal(useProgress.getState().reviewHistory.length, 0);

  useProgress.getState().review("lex:A1:about", "good");
  const event = useProgress.getState().reviewHistory.at(-1);
  assert.equal(event?.id, "lex:A1:about");
  assert.equal(event?.grade, "good");
  assert.equal(event?.algorithm, "fsrs6");
  assert.equal(event?.targetRetention, 0.9);
  assert.equal(event?.at, NOW);
  assert.ok((event?.stability ?? 0) > 0);
});

test("an older SM-2 review card records a one-time FSRS bridge", () => {
  useProgress.setState({ cards: { "lex:A1:about": mature } });
  useProgress.getState().review("lex:A1:about", "good");
  const state = useProgress.getState();
  const event = state.reviewHistory.at(-1);
  assert.equal(event?.algorithm, "fsrs6");
  assert.equal(event?.bridged, true);
  assert.equal(state.cards["lex:A1:about"]?.fsrs?.model, "fsrs6");
});

test("retention target is bounded to the supported FSRS range", () => {
  useProgress.getState().setRequestRetention(0.99);
  assert.equal(useProgress.getState().requestRetention, 0.97);
  useProgress.getState().setRequestRetention(0.5);
  assert.equal(useProgress.getState().requestRetention, 0.8);
  useProgress.getState().setRequestRetention(0.95);
  assert.equal(useProgress.getState().requestRetention, 0.95);
});

test("there is no self-declared mastery path in progress state", () => {
  assert.equal("markKnown" in useProgress.getState(), false);
});
