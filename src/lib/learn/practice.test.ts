import assert from "node:assert/strict";
import test from "node:test";
import { boundPracticeEvidence, MAX_PRACTICE_WORDS, recordPracticeSkill } from "./practice";
import type { PracticeEvidence } from "./types";

test("unattributed attempts and reference questions cannot fabricate vocabulary skills", () => {
  assert.deepEqual(recordPracticeSkill({}, "lex:A1:word", undefined, "good", 123), {});
  assert.deepEqual(recordPracticeSkill({}, "irr:be", "spelling", "again", 123), {});
});

test("bounded skill evidence retains the newest observations rather than insertion order", () => {
  const evidence: PracticeEvidence = {};
  for (let i = MAX_PRACTICE_WORDS; i >= 0; i--) {
    evidence[`lex:A1:${i}`] = { spelling: { attempts: 1, correct: 1, lastAt: i + 1, lastGrade: "good" } };
  }
  const kept = boundPracticeEvidence(evidence);
  assert.equal(Object.keys(kept).length, MAX_PRACTICE_WORDS);
  assert.equal(kept["lex:A1:0"], undefined);
  assert.ok(kept[`lex:A1:${MAX_PRACTICE_WORDS}`]);
});
