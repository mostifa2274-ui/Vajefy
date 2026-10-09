import assert from "node:assert/strict";
import test from "node:test";
import { coachCaseContentVersion, type CoachEvaluationCase } from "./coach-case-version";

const sample: CoachEvaluationCase[] = [
  {
    id: "abc123", split: "test", source: "mistake-right",
    senses: ["lex:A1:test"], text: "She reads every day.", expect: ["natural"],
  },
];

test("coach text version is deterministic for identical evaluation items", () => {
  const a = coachCaseContentVersion(sample);
  assert.match(a, /^coach-text-v1-[a-f0-9]{16}$/);
  assert.equal(a, coachCaseContentVersion(structuredClone(sample)));
});

test("coach text version changes when text, source or expected verdict changes", () => {
  const base = coachCaseContentVersion(sample);
  assert.notEqual(base, coachCaseContentVersion([{ ...sample[0]!, text: "She sings today." }]));
  assert.notEqual(base, coachCaseContentVersion([{ ...sample[0]!, source: "mistake-wrong" }]));
  assert.notEqual(base, coachCaseContentVersion([{ ...sample[0]!, expect: ["needs-change"] }]));
});

test("coach text version is independent of unrelated audio metadata", () => {
  const lessonA = { audioVersion: "before", examples: sample };
  const lessonB = { ...lessonA, audioVersion: "newly-certified-sha" };
  assert.equal(coachCaseContentVersion(lessonA.examples), coachCaseContentVersion(lessonB.examples));
});
