import assert from "node:assert/strict";
import test from "node:test";
import { ActiveTimeCounter, IDLE_TIMEOUT_MS } from "./active-time";

test("active time stops after the 60-second idle window", () => {
  const clock = new ActiveTimeCounter(0);
  assert.equal(clock.value(30_000), 30_000);
  assert.equal(clock.value(IDLE_TIMEOUT_MS), IDLE_TIMEOUT_MS);
  assert.equal(clock.value(180_000), IDLE_TIMEOUT_MS);
});

test("learner activity extends the active window instead of applying a wall-time cap", () => {
  const clock = new ActiveTimeCounter(0);
  clock.activity(30_000);
  assert.equal(clock.value(75_000), 75_000);
  assert.equal(clock.value(100_000), 90_000);
});

test("hidden-tab time never counts and returning starts a fresh reading window", () => {
  const clock = new ActiveTimeCounter(0);
  clock.hide(20_000);
  assert.equal(clock.value(120_000), 20_000);
  clock.show(120_000);
  assert.equal(clock.value(135_000), 35_000);
});

test("a clock regression cannot subtract already measured study time", () => {
  const clock = new ActiveTimeCounter(100);
  assert.equal(clock.value(1_000), 900);
  assert.equal(clock.value(500), 900);
});
