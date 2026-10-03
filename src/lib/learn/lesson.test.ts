import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Pilot } from "./content";
import { advanceLesson, answerLesson, buildApplication, buildLesson, gradeTyped, lessonSize, nextTargets, resolveItem } from "./lesson";
import { indexPilot, introductionOrder } from "./pilot";

const index = indexPilot(JSON.parse(readFileSync("public/data/pilot-a1.json", "utf8")) as Pilot);
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const T0 = 1_800_000_000_000;

test("a lesson teaches, retrieves, uses in context and retrieves again after a delay", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 3);
  const lesson = buildLesson(index, targets, new Set(), T0, random);
  for (const target of targets) {
    const id = target.sense.id;
    const position = (kind: string, role?: string) =>
      lesson.steps.findIndex((step) => (step.kind === "teach" && kind === "teach" && step.target === id) || (step.kind === "check" && step.role === role && step.ref.target === id));
    const teach = position("teach");
    const retrieve = position("check", "retrieve");
    const context = position("check", "context");
    const delayed = position("check", "delayed");
    assert.ok(teach >= 0 && teach < retrieve && retrieve < context && context < delayed, id);
  }
  // Every item resolves to something the learner can answer.
  for (const step of lesson.steps) if (step.kind === "check") assert.ok(resolveItem(index, step.ref), JSON.stringify(step.ref));
  // The retrieval choice always contains the right meaning exactly once.
  const first = lesson.steps.find((step) => step.kind === "check" && step.role === "retrieve");
  assert.ok(first && first.kind === "check");
  const item = resolveItem(index, first.ref);
  assert.equal(item?.type === "choice" && item.options.filter((option) => option.ok).length, 1);
});

test("a wrong retrieval earns one more, different opportunity, but only once", () => {
  const targets = introductionOrder(index.targets, "general").slice(0, 2);
  let lesson = buildLesson(index, targets, new Set(), T0, random);
  lesson = advanceLesson(lesson, T0);
  assert.equal(lesson.steps[lesson.index]?.kind, "check");
  const before = lesson.steps.length;
  lesson = answerLesson(lesson, { op: "a", result: "wrong", at: T0 }, index, random);
  assert.equal(lesson.steps.length, before + 1);
  const retries = lesson.steps.filter((step) => step.kind === "check" && step.role === "retry");
  assert.equal(retries.length, 1);
  // The same step cannot be answered twice.
  assert.equal(answerLesson(lesson, { op: "b", result: "wrong", at: T0 }, index, random), lesson);
});

test("typed answers accept listed alternatives and small slips", () => {
  assert.equal(gradeTyped("  bring ", "bring", []), "correct");
  assert.equal(gradeTyped("brinng", "bring", []), "close");
  assert.equal(gradeTyped("can not", "can't", ["cannot", "can not"]), "correct");
  assert.equal(gradeTyped("take", "bring", []), "wrong");
});

test("lesson size follows the learner's time and backs off when reviews pile up", () => {
  assert.equal(lessonSize(5, 0, 20), 2);
  assert.equal(lessonSize(10, 0, 20), 3);
  assert.equal(lessonSize(15, 0, 20), 5);
  assert.equal(lessonSize(15, 25, 20), 1);
  assert.equal(lessonSize(15, 45, 20), 0);
});

test("introduction order serves the goal and keeps further senses after first meetings", () => {
  const work = introductionOrder(index.targets, "work");
  const firstSecondSense = work.findIndex((target) => target.index > 0);
  assert.ok(work.slice(0, firstSecondSense).every((target) => target.index === 0));
  const known = Object.fromEntries(work.slice(0, 4).map((target) => [target.sense.id, {}]));
  assert.deepEqual(nextTargets(work, known, 2).map((target) => target.sense.id), work.slice(4, 6).map((target) => target.sense.id));
});

test("contrasts and scenes can be practised on their own", () => {
  const contrast = buildApplication(index, "contrast", "contrast:bring-take", T0);
  assert.equal(contrast?.steps[0]?.kind, "contrast");
  const scene = buildApplication(index, "scene", "scene:cafe-order", T0);
  assert.equal(scene?.steps.at(-1)?.kind, "write");
  for (const step of [...(contrast?.steps ?? []), ...(scene?.steps ?? [])]) {
    if (step.kind === "check") assert.ok(resolveItem(index, step.ref));
  }
});
