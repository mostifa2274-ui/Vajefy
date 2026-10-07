import assert from "node:assert/strict";
import test from "node:test";
import type { LessonSession } from "./lesson";
import { lessonTimeProfile, measuredSecondsPerNew } from "./lesson-time";
import type { SessionRecord } from "./session";

function lesson(id: string, activeMs: number, targets = 2): LessonSession {
  return {
    id,
    kind: "lesson",
    status: "done",
    createdAt: 1,
    updatedAt: 2,
    mode: "lesson",
    targets: Array.from({ length: targets }, (_, index) => `lex:A1:${id}-${index}`),
    steps: [{ kind: "teach", target: `lex:A1:${id}-0` }],
    index: 1,
    answers: [],
    timing: [
      {
        step: 0,
        at: 2,
        kind: "teach",
        target: `lex:A1:${id}-0`,
        activeMs,
      },
    ],
  };
}

test("fewer than three timed lessons never calibrate the planner", () => {
  const sessions: SessionRecord[] = [lesson("a", 120_000), lesson("b", 180_000)];
  assert.equal(measuredSecondsPerNew(sessions), null);
  assert.equal(lessonTimeProfile(sessions).sessions, 2);
});

test("planner timing uses a robust median per new target", () => {
  const sessions: SessionRecord[] = [
    lesson("a", 120_000), // 60 sec/target
    lesson("b", 180_000), // 90 sec/target
    lesson("c", 240_000), // 120 sec/target
    lesson("outlier", 2_000_000), // 1000 sec/target
  ];
  assert.equal(measuredSecondsPerNew(sessions), 105);
});

test("timing profile separates teaching, response, feedback and context reading", () => {
  const base = lesson("a", 30_000, 1);
  base.timing = [
    { step: 0, at: 1, kind: "teach", target: "x", activeMs: 30_000 },
    { step: 1, at: 2, kind: "check", role: "retrieve", target: "x", activeMs: 20_000, responseMs: 12_000, feedbackMs: 8_000 },
    { step: 2, at: 3, kind: "scene", activeMs: 15_000 },
  ];
  const other = lesson("b", 30_000, 1);
  const third = lesson("c", 30_000, 1);
  const profile = lessonTimeProfile([base, other, third]);
  assert.equal(profile.teachMs, 90_000);
  assert.equal(profile.responseMs, 12_000);
  assert.equal(profile.feedbackMs, 8_000);
  assert.equal(profile.contextReadMs, 15_000);
  assert.equal(profile.totalActiveMs, 125_000);
});

test("non-guided or unfinished sessions are excluded", () => {
  const guided = lesson("a", 90_000, 1);
  const checkup = { ...lesson("b", 90_000, 1), mode: "checkup" as const };
  const active = { ...lesson("c", 90_000, 1), status: "active" as const };
  assert.equal(lessonTimeProfile([guided, checkup, active]).sessions, 1);
});
