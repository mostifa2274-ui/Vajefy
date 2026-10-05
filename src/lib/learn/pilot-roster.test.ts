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

/** A study word set of the given size, with every entry released or none. */
function study(count = 240, released = false) {
  return {
    units: ["01-introductions", "02-family-home", "03-daily-routine", "04-food-drink"],
    entries: Array.from({ length: count }, (_, index) => ({ id: `lex:A1:w${index}`, released })),
  };
}

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
    study: study(),
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
        study: study(),
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
        study: study(),
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
    study: study(240, true),
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
    study: study(),
  });
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
    study: study(),
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

test("the study's word set must last the learning period at the daily allowance", () => {
  const input = {
    participants: ["P-001", "P-002"],
    seed: "capacity-seed",
    contentVersion: "content-v1",
    enhancedChannel: "draft" as const,
  };
  // Units 1–3 hold 180 words: enough for 30 days at 10 minutes (5 a day), not at 15 (8 a day).
  const roster = createPilotRoster({ ...input, dailyMinutes: 10, study: study(180) });
  assert.deepEqual(roster.protocol.study, {
    units: ["01-introductions", "02-family-home", "03-daily-routine", "04-food-drink"],
    entries: 180,
    newWordsPerDay: 5,
  });
  assert.deepEqual(validatePilotRoster(roster), []);
  assert.throws(
    () => createPilotRoster({ ...input, dailyMinutes: 15, study: study(180) }),
    /180 words would run out before 30 days at 8 new words a day \(240 needed\)/,
  );
});

test("a released enhanced arm needs every study word released", () => {
  const input = {
    participants: ["P-001", "P-002"],
    seed: "release-seed",
    contentVersion: "content-v1",
    dailyMinutes: 10,
  };
  const partly = study(180, true);
  partly.entries[7]!.released = false;
  assert.throws(
    () => createPilotRoster({ ...input, enhancedChannel: "released", study: partly }),
    /released channel needs every study word released; 1 are not \(first: lex:A1:w7\)/,
  );
  // A draft build shows every word, released or not.
  assert.doesNotThrow(() => createPilotRoster({ ...input, enhancedChannel: "draft", study: partly }));
});

test("roster validation rejects a missing or altered study word set", () => {
  const roster = createPilotRoster({
    participants: ["P-001", "P-002"],
    seed: "tamper-seed",
    contentVersion: "content-v1",
    enhancedChannel: "draft",
    dailyMinutes: 10,
    study: study(180),
  });
  const { study: _study, ...withoutStudy } = roster.protocol;
  assert.match(
    validatePilotRoster({ ...roster, protocol: withoutStudy } as unknown as typeof roster).join("\n"),
    /study word set is missing/,
  );
  assert.match(
    validatePilotRoster({ ...roster, protocol: { ...roster.protocol, study: { ...roster.protocol.study, newWordsPerDay: 3 } } }).join("\n"),
    /new words per day must be 5/,
  );
  assert.match(
    validatePilotRoster({ ...roster, version: 1 as never }).join("\n"),
    /roster version must be 2/,
  );
});
