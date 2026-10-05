import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSESSMENT_MIN_DELAY_DAYS,
  ASSESSMENT_PROTOCOL_ID,
  STUDY_VERSION,
} from "./study";
import {
  validateAssessmentEvidence,
  validateStudyProtocols,
  type StudyProtocolRecord,
} from "./study-protocol";

function record(
  participant: string,
  channel: "draft" | "released" | "none",
  overrides: Partial<StudyProtocolRecord> = {},
): StudyProtocolRecord {
  return {
    source: `${participant}.json`,
    participant,
    version: STUDY_VERSION,
    contentVersion: "content-v1",
    channel,
    build: "abcdef123456",
    assessmentProtocol: ASSESSMENT_PROTOCOL_ID,
    assessmentMinimumDelayDays: ASSESSMENT_MIN_DELAY_DAYS,
    assessmentBankContentVersion: "content-v1",
    ...overrides,
  };
}

test("the intended enhanced and comparison arms share one compatible protocol", () => {
  const result = validateStudyProtocols([
    record("E-001", "draft"),
    record("C-001", "none", { build: "fedcba654321" }),
  ]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.mixedProtocols, false);
  assert.deepEqual(result.summary.channels, ["draft", "none"]);
  assert.deepEqual(result.summary.builds, [
    "abcdef123456",
    "fedcba654321",
  ]);
});

test("mixed content banks fail closed unless explicitly allowed", () => {
  const records = [
    record("E-001", "draft"),
    record("C-001", "none", {
      contentVersion: "content-v2",
      assessmentBankContentVersion: "content-v2",
    }),
  ];
  const strict = validateStudyProtocols(records);
  assert.match(strict.errors.join("\n"), /multiple export\/content\/assessment protocols/);

  const exploratory = validateStudyProtocols(records, true);
  assert.deepEqual(exploratory.errors, []);
  assert.match(
    exploratory.warnings.join("\n"),
    /pooled outcomes are not directly comparable/,
  );
});

test("draft and released enhanced variants are not silently pooled", () => {
  const strict = validateStudyProtocols([
    record("E-001", "draft"),
    record("E-002", "released"),
  ]);
  assert.match(
    strict.errors.join("\n"),
    /mix draft and released enhanced-content channels/,
  );
});

test("duplicate participant codes and malformed v2 metadata fail", () => {
  const result = validateStudyProtocols([
    record("P-001", "draft"),
    record("P-001", "none", {
      build: null,
      assessmentProtocol: "other",
      assessmentMinimumDelayDays: 12,
      assessmentBankContentVersion: "wrong",
    }),
  ]);
  const errors = result.errors.join("\n");
  assert.match(errors, /duplicate participant P-001/);
  assert.match(errors, /missing app\.build/);
  assert.match(errors, new RegExp(ASSESSMENT_PROTOCOL_ID));
  assert.match(errors, /minimum delay must be 30 days/);
  assert.match(errors, /assessment-bank version must match/);
});

test("future export versions are rejected rather than guessed", () => {
  const result = validateStudyProtocols([
    record("P-001", "draft", { version: STUDY_VERSION + 1 }),
  ]);
  assert.match(result.errors.join("\n"), /newer than supported/);
});

test("held-out use evidence names its exact prompt and entry version", () => {
  const errors = validateAssessmentEvidence("P-001.json", [
    {
      id: "a1",
      type: "assessment",
      item: "lex:A1:close#near",
      context: {
        session: "s1",
        contentVersion: "entry-v7",
        promptId: "lex:A1:close#near/close-near-held-out",
      },
      assessment: {
        part: "use",
        correct: true,
        delayDays: ASSESSMENT_MIN_DELAY_DAYS,
      },
    },
    {
      id: "a2",
      type: "assessment",
      item: "lex:A1:close#near",
      context: {
        session: "s1",
        contentVersion: "entry-v7",
        promptId: "generated:meaning",
      },
      assessment: {
        part: "meaning",
        correct: true,
        delayDays: ASSESSMENT_MIN_DELAY_DAYS,
      },
    },
  ]);
  assert.deepEqual(errors, []);
});

test("malformed or too-early assessment provenance is rejected", () => {
  const errors = validateAssessmentEvidence("bad.json", [
    {
      id: "use",
      type: "assessment",
      item: "lex:A1:word",
      context: {
        session: "s1",
        contentVersion: "entry-v1",
        promptId: "generated:form",
      },
      assessment: { part: "use", correct: true, delayDays: 12 },
    },
    {
      id: "meaning",
      type: "assessment",
      item: "lex:A1:word",
      context: { session: "s1", contentVersion: "entry-v1" },
      assessment: { part: "meaning", correct: true, delayDays: 30 },
    },
    {
      id: "missing",
      type: "assessment",
      item: "lex:A1:word",
      context: {
        session: "s1",
        contentVersion: "entry-v1",
        promptId: "lex:A1:word/should-not-exist",
      },
      assessment: { part: "use", missing: true, delayDays: 30 },
    },
  ]);
  const joined = errors.join("\n");
  assert.match(joined, /exact held-out/);
  assert.match(joined, /requires at least/);
  assert.match(joined, /generated:meaning/);
  assert.match(joined, /missing evidence but still names a prompt id/);
});
