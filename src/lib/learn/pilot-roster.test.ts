import assert from "node:assert/strict";
import test from "node:test";
import {
  createPilotRoster,
  pilotRosterSeedFingerprint,
  validatePilotRoster,
  validatePilotRosterEvidence,
  type PilotRosterObservedExport,
} from "./pilot-roster";
import {
  ASSESSMENT_MIN_DELAY_DAYS,
  ASSESSMENT_PROTOCOL_ID,
  STUDY_VERSION,
} from "./study";

function observed(
  participant: string,
  channel: "draft" | "released" | "none",
  overrides: Partial<PilotRosterObservedExport> = {},
): PilotRosterObservedExport {
  return {
    source: `${participant}.json`,
    participant,
    version: STUDY_VERSION,
    contentVersion: "content-v1",
    channel,
    assessmentProtocol: ASSESSMENT_PROTOCOL_ID,
    assessmentMinimumDelayDays: ASSESSMENT_MIN_DELAY_DAYS,
    assessmentBankContentVersion: "content-v1",
    dailyMinutes: 15,
    ...overrides,
  };
}

test("pilot roster assignment is deterministic, balanced and does not store the raw seed", () => {
  const input = {
    participants: ["P-001", "P-002", "P-003", "P-004", "P-005"],
    seed: "private-study-seed-2026",
    contentVersion: "content-v1",
    enhancedChannel: "draft" as const,
    dailyMinutes: 15,
  };
  const first = createPilotRoster(input);
  const second = createPilotRoster({
    ...input,
    participants: [...input.participants].reverse(),
  });

  assert.deepEqual(first, second);
  const enhanced = first.assignments.filter((row) => row.arm === "enhanced");
  const comparison = first.assignments.filter((row) => row.arm === "comparison");
  assert.ok(Math.abs(enhanced.length - comparison.length) <= 1);
  assert.equal(
    first.seedFingerprint,
    pilotRosterSeedFingerprint(input.seed),
  );
  assert.doesNotMatch(JSON.stringify(first), /private-study-seed-2026/);
  assert.deepEqual(validatePilotRoster(first, input.seed), []);
});

test("pilot roster creation rejects invalid or duplicate participant codes", () => {
  assert.throws(
    () =>
      createPilotRoster({
        participants: ["P-001", "P-001", "bad code"],
        seed: "seed",
        contentVersion: "content-v1",
        enhancedChannel: "draft",
        dailyMinutes: 15,
      }),
    /duplicate participant code P-001/,
  );
  assert.throws(
    () =>
      createPilotRoster({
        participants: ["P-001", "bad code"],
        seed: "seed",
        contentVersion: "content-v1",
        enhancedChannel: "draft",
        dailyMinutes: 15,
      }),
    /invalid participant code bad code/,
  );
});

test("roster validation detects the wrong archived seed without exposing it", () => {
  const roster = createPilotRoster({
    participants: ["P-001", "P-002"],
    seed: "correct-seed",
    contentVersion: "content-v1",
    enhancedChannel: "released",
    dailyMinutes: 20,
  });
  assert.deepEqual(validatePilotRoster(roster, "correct-seed"), []);
  assert.match(
    validatePilotRoster(roster, "wrong-seed").join("\n"),
    /does not match the roster fingerprint/,
  );
});

test("export evidence must follow the assigned arm and frozen pilot protocol", () => {
  const roster = createPilotRoster({
    participants: ["P-001", "P-002", "P-003", "P-004"],
    seed: "seed-for-evidence",
    contentVersion: "content-v1",
    enhancedChannel: "draft",
    dailyMinutes: 15,
  });
  const assigned = new Map(
    roster.assignments.map((row) => [row.participant, row]),
  );
  const good = roster.assignments.slice(0, 2).map((row) =>
    observed(row.participant, row.channel),
  );
  assert.deepEqual(validatePilotRosterEvidence(roster, good).errors, []);

  const target = roster.assignments[0]!;
  const wrongChannel = target.channel === "none" ? "draft" : "none";
  const bad = validatePilotRosterEvidence(roster, [
    observed(target.participant, wrongChannel, {
      contentVersion: "other-content",
      assessmentBankContentVersion: "other-content",
      dailyMinutes: 30,
    }),
    observed("P-999", "none"),
  ]);
  const joined = bad.errors.join("\n");
  assert.match(joined, /was assigned to/);
  assert.match(joined, /content version/);
  assert.match(joined, /assessment-bank version/);
  assert.match(joined, /daily minutes/);
  assert.match(joined, /not present in the pilot roster/);
});

test("missing participant exports are reported as attrition rather than protocol errors", () => {
  const roster = createPilotRoster({
    participants: ["P-001", "P-002", "P-003", "P-004"],
    seed: "attrition-seed",
    contentVersion: "content-v1",
    enhancedChannel: "draft",
    dailyMinutes: 15,
  });
  const first = roster.assignments[0]!;
  const result = validatePilotRosterEvidence(roster, [
    observed(first.participant, first.channel),
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.assigned, 4);
  assert.equal(result.summary.observed, 1);
  assert.equal(result.summary.missing, 3);
  assert.equal(
    result.summary.missingEnhanced + result.summary.missingComparison,
    3,
  );
});
