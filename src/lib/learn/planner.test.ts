import assert from "node:assert/strict";
import test from "node:test";
import { dailyPlan } from "./planner";

test("the daily plan never exceeds the remaining introduction allowance", () => {
  const plan = dailyPlan({ due: 0, introducedToday: 4, newPerDay: 5, sessionSize: 20, minutes: 10 });
  assert.equal(plan.remainingNewAllowance, 1);
  assert.equal(plan.newLimit, 1);
});

test("reviews consume the session before new material", () => {
  const full = dailyPlan({ due: 20, introducedToday: 0, newPerDay: 8, sessionSize: 20, minutes: 15 });
  assert.equal(full.reviewTake, 20);
  assert.equal(full.newLimit, 0);

  const half = dailyPlan({ due: 10, introducedToday: 0, newPerDay: 8, sessionSize: 20, minutes: 15 });
  assert.equal(half.reviewTake, 10);
  assert.equal(half.newLimit, 2);
});

test("time and session room cap introductions consistently", () => {
  assert.equal(dailyPlan({ due: 0, introducedToday: 0, newPerDay: 20, sessionSize: 20, minutes: 5 }).newLimit, 2);
  assert.equal(dailyPlan({ due: 0, introducedToday: 0, newPerDay: 20, sessionSize: 20, minutes: 10 }).newLimit, 3);
  assert.equal(dailyPlan({ due: 0, introducedToday: 0, newPerDay: 20, sessionSize: 20, minutes: 15 }).newLimit, 5);
  assert.equal(dailyPlan({ due: 18, introducedToday: 0, newPerDay: 20, sessionSize: 20, minutes: 15 }).newLimit, 0);
});

test("invalid counts degrade to a safe empty plan", () => {
  const plan = dailyPlan({ due: Number.NaN, introducedToday: -3, newPerDay: Number.NaN, sessionSize: -1, minutes: -5 });
  assert.deepEqual(plan, { due: 0, reviewTake: 0, remainingNewAllowance: 0, newLimit: 0, estimatedMinutes: 0 });
});
