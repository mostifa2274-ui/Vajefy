import assert from "node:assert/strict";
import test from "node:test";
import type { StoredEvent } from "./ops";
import type { SessionRecord } from "./session";
import {
  ASSESSMENT_MIN_DELAY_DAYS,
  ASSESSMENT_PROTOCOL_ID,
  STUDY_VERSION,
  buildStudyExport,
  studyFileName,
  validParticipant,
} from "./study";

const T0 = Date.UTC(2026, 9, 3, 9);
const profile = { lang: "fa", focus: "A1", goal: "work", minutes: 10, requestRetention: 0.9, accent: "en-GB", sessionSize: 20, newPerDay: 5 };

const events: StoredEvent[] = [
  { id: "b", type: "practice", at: T0 + 2, item: "lex:A1:about", grade: "good", skill: "context", context: { prompt: "lesson:context:cloze", responseMs: 4000 } },
  { id: "a", type: "review", at: T0 + 1, item: "lex:A1:about", grade: "good" },
  { id: "c", type: "settings", at: T0 + 3 },
  { id: "d", type: "exposure", at: T0 + 4, item: "lex:A1:about", exposure: "listen" },
  { id: "e", type: "undo", at: T0 + 5, target: "a" },
];

const lesson = {
  id: "s1", kind: "lesson", status: "done", createdAt: T0, updatedAt: T0, mode: "lesson", targets: [], steps: [], index: 0,
  answers: [{ op: "o1", step: 0, result: "wrong", given: "my own sentence", at: T0 }],
} as unknown as SessionRecord;

function build(includeWriting: boolean) {
  return buildStudyExport({
    participant: " P-017 ",
    includeWriting,
    events,
    sessions: [lesson],
    profile,
    contentVersion: "abc",
    channel: "draft",
    build: "deadbeef1234",
    now: new Date(T0),
  });
}

test("a study export holds evidence only, in time order, under the participant code", () => {
  const data = build(false);
  assert.equal(data.participant, "P-017");
  assert.equal(data.version, STUDY_VERSION);
  assert.deepEqual(data.app, {
    contentVersion: "abc",
    channel: "draft",
    build: "deadbeef1234",
  });
  assert.deepEqual(data.protocol.assessment, {
    id: ASSESSMENT_PROTOCOL_ID,
    minimumDelayDays: ASSESSMENT_MIN_DELAY_DAYS,
    bankContentVersion: "abc",
  });
  assert.deepEqual(data.events.map((event) => event.id), ["a", "b", "d", "e"], "settings changes are left out");
  assert.equal(data.events.at(-1)!.target, "a", "an undo names the answer it reverted");
  assert.deepEqual(data.profile, profile);
});

test("what the learner wrote is left out unless they include it", () => {
  const without = build(false).sessions[0] as unknown as { answers: Record<string, unknown>[] };
  assert.equal(without.answers[0]!.given, undefined);
  assert.equal(without.answers[0]!.result, "wrong", "whether it was right is kept");
  const withWriting = build(true).sessions[0] as unknown as { answers: Record<string, unknown>[] };
  assert.equal(withWriting.answers[0]!.given, "my own sentence");
});

test("participant codes are short and plain", () => {
  assert.equal(validParticipant("P-017"), true);
  assert.equal(validParticipant("ab"), false);
  assert.equal(validParticipant("name@example.com"), false);
  assert.equal(studyFileName("P-017", new Date(T0)), "vajefy-study-P-017-2026-10-03.json");
});
