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
    reviewHistory: [],
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

test("scheduled review records prospective evidence but practice does not", () => {
  const state = useProgress.getState();
  state.practice("lex:A1:about", "good");
  assert.deepEqual(useProgress.getState().reviewHistory, []);

  state.review("lex:A1:about", "good");
  const first = useProgress.getState().reviewHistory[0]!;
  assert.deepEqual(first, {
    t: NOW,
    id: "lex:A1:about",
    grade: "good",
    state: "learning",
    step: 0,
    scheduledDays: 0,
    elapsedDays: 0,
    nextState: "learning",
    nextStep: 1,
    nextDays: 0,
    complete: true,
  });
});

test("a pre-existing reviewed card starts an explicitly partial history", () => {
  useProgress.setState({ cards: { "lex:A1:about": mature }, reviewHistory: [] });
  useProgress.getState().review("lex:A1:about", "good");
  const event = useProgress.getState().reviewHistory[0]!;
  assert.equal(event.complete, false);
  assert.equal(event.state, "review");
  assert.equal(event.scheduledDays, 30);
  assert.equal(event.elapsedDays, 10);
  assert.equal(event.nextState, "review");
  assert.equal(event.nextDays, 30);
});

test("review-history completeness persists for subsequent logged reviews", () => {
  useProgress.setState({ cards: { "lex:A1:about": mature }, reviewHistory: [] });
  useProgress.getState().review("lex:A1:about", "good");
  mock.timers.tick(30 * DAY);
  useProgress.getState().review("lex:A1:about", "easy");
  const events = useProgress.getState().reviewHistory;
  assert.equal(events.length, 2);
  assert.equal(events[0]?.complete, false);
  assert.equal(events[1]?.complete, false);
});

test("rolling history marks a card partial once its earliest evidence is dropped", () => {
  const template = {
    t: NOW,
    grade: "good" as const,
    state: "review" as const,
    step: 0,
    scheduledDays: 1,
    elapsedDays: 1,
    nextState: "review" as const,
    nextStep: 0,
    nextDays: 2,
    complete: true,
  };
  const reviewHistory = Array.from({ length: 8000 }, (_, index) => ({
    ...template,
    t: NOW - (8000 - index) * 1000,
    id: index === 0 ? "lex:A1:about" : `other:${index}`,
  }));
  useProgress.setState({
    cards: { "lex:A1:about": mature },
    reviewHistory,
  });

  useProgress.getState().review("lex:A1:about", "good");
  const history = useProgress.getState().reviewHistory;
  assert.equal(history.length, 8000);
  const kept = history.filter((event) => event.id === "lex:A1:about");
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.complete, false);
});

test("forget removes review evidence for removed cards only", () => {
  useProgress.setState({
    cards: { a: mature, b: mature },
    reviewHistory: [
      { t: NOW, id: "a", grade: "good", state: "review", step: 0, scheduledDays: 30, elapsedDays: 10, nextState: "review", nextStep: 0, nextDays: 30, complete: false },
      { t: NOW, id: "b", grade: "good", state: "review", step: 0, scheduledDays: 30, elapsedDays: 10, nextState: "review", nextStep: 0, nextDays: 30, complete: false },
    ],
  });
  useProgress.getState().forget(["a"]);
  assert.deepEqual(useProgress.getState().reviewHistory.map((event) => event.id), ["b"]);
});

test("there is no self-declared mastery path in progress state", () => {
  assert.equal("markKnown" in useProgress.getState(), false);
});
