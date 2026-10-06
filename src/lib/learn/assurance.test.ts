import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateAssurance,
  machineAssuranceRecord,
  provenanceBlockers,
  provenanceManifest,
  arbitrateSemanticJudgments,
  semanticJudgeRecord,
  semanticRubricManifest,
  type SemanticJudgeRecord,
  type SemanticJudgeRole,
} from "./assurance";

test("cleared provenance requires explicit redistribution and derivative rights", () => {
  const parsed = provenanceManifest.safeParse({
    schemaVersion: 1,
    sources: [
      {
        id: "source:test",
        name: "Test",
        version: "1",
        source: "fixture",
        license: "MIT",
        redistribution: "unverified",
        derivatives: "allowed",
        attribution: "required",
        status: "cleared",
        evidence: [],
      },
    ],
  });
  assert.equal(parsed.success, false);
});

test("unverified provenance is structurally valid but blocks release", () => {
  const manifest = provenanceManifest.parse({
    schemaVersion: 1,
    sources: [
      {
        id: "source:test",
        name: "Test",
        version: "1",
        source: "fixture",
        license: "UNVERIFIED",
        redistribution: "unverified",
        derivatives: "unverified",
        attribution: "unknown",
        status: "unverified",
        evidence: [],
      },
    ],
  });
  assert.ok(provenanceBlockers(manifest).length >= 3);
});

test("assurance aggregation fails closed", () => {
  assert.equal(
    aggregateAssurance([
      {
        criterion: "schema",
        result: "PASS",
        evidence: [],
        reasonCode: null,
      },
      {
        criterion: "translation",
        result: "UNCERTAIN",
        evidence: [],
        reasonCode: "low-confidence",
      },
    ]),
    "UNCERTAIN",
  );
});

test("machine assurance records reject empty evidence sets", () => {
  const parsed = machineAssuranceRecord.safeParse({
    schemaVersion: 1,
    targetId: "lex:A1:test",
    contentVersion: "abc123",
    sourceHash: "hash",
    generatedAt: "2026-10-06T00:00:00Z",
    criteria: [],
    status: "PASS",
  });
  assert.equal(parsed.success, false);
});


const semanticTestManifest = semanticRubricManifest.parse({
  schemaVersion: 1,
  requiredRoles: ["english", "persian", "pedagogical", "adversarial"],
  vetoConfidence: 0.9,
  roles: [
    {
      role: "english",
      rubricVersion: "english-v1",
      promptVersion: "english-p1",
      criteria: ["sense_fidelity"],
    },
    {
      role: "persian",
      rubricVersion: "persian-v1",
      promptVersion: "persian-p1",
      criteria: ["translation_correctness"],
    },
    {
      role: "pedagogical",
      rubricVersion: "pedagogy-v1",
      promptVersion: "pedagogy-p1",
      criteria: ["a1_suitability"],
    },
    {
      role: "adversarial",
      rubricVersion: "adversarial-v1",
      promptVersion: "adversarial-p1",
      criteria: ["no_mistranslation"],
    },
  ],
});

const criterionForRole: Record<SemanticJudgeRole, string> = {
  english: "sense_fidelity",
  persian: "translation_correctness",
  pedagogical: "a1_suitability",
  adversarial: "no_mistranslation",
};

function semanticFixture(
  role: SemanticJudgeRole,
  result: "PASS" | "FAIL" | "UNCERTAIN" = "PASS",
  confidence = 0.99,
  contextIsolationKey = `context-${role}`,
): SemanticJudgeRecord {
  const rubric = semanticTestManifest.roles.find((item) => item.role === role)!;
  return semanticJudgeRecord.parse({
    schemaVersion: 1,
    role,
    targetId: "lex:A1:test",
    contentVersion: "entry-v1",
    inputHash: "a".repeat(64),
    generatedAt: "2026-10-06T00:00:00Z",
    evaluator: {
      kind: "model",
      provider: "fixture",
      modelId: `judge-${role}`,
      modelVersion: "1",
      promptVersion: rubric.promptVersion,
      rubricVersion: rubric.rubricVersion,
      contextIsolationKey,
      runId: `run-${role}`,
    },
    criteria: [
      {
        criterion: criterionForRole[role],
        result,
        confidence,
        evidence: ["sense.meaning"],
        reasonCode: result === "PASS" ? null : "fixture",
      },
    ],
    status: result,
  });
}

test("semantic judge record status must be derived from its criteria", () => {
  const parsed = semanticJudgeRecord.safeParse({
    ...semanticFixture("english"),
    criteria: [
      {
        criterion: "sense_fidelity",
        result: "FAIL",
        confidence: 0.95,
        evidence: ["sense.meaning"],
        reasonCode: "mismatch",
      },
    ],
    status: "PASS",
  });
  assert.equal(parsed.success, false);
});

test("semantic arbitration requires every independent judge role", () => {
  const result = arbitrateSemanticJudgments(
    [
      semanticFixture("english"),
      semanticFixture("persian"),
      semanticFixture("pedagogical"),
    ],
    semanticTestManifest,
  );
  assert.equal(result.status, "QUARANTINED");
  assert.ok(result.blockers.includes("missing-role:adversarial"));
});

test("semantic arbitration rejects shared judge contexts", () => {
  const result = arbitrateSemanticJudgments(
    [
      semanticFixture("english", "PASS", 0.99, "shared"),
      semanticFixture("persian", "PASS", 0.99, "shared"),
      semanticFixture("pedagogical"),
      semanticFixture("adversarial"),
    ],
    semanticTestManifest,
  );
  assert.equal(result.status, "QUARANTINED");
  assert.ok(result.blockers.includes("judge-context-not-independent"));
});

test("high-confidence semantic failure has veto power", () => {
  const result = arbitrateSemanticJudgments(
    [
      semanticFixture("english"),
      semanticFixture("persian", "FAIL", 0.95),
      semanticFixture("pedagogical"),
      semanticFixture("adversarial"),
    ],
    semanticTestManifest,
  );
  assert.equal(result.status, "FAIL");
  assert.deepEqual(result.vetoes, ["persian:translation_correctness"]);
});

test("material low-confidence semantic disagreement is quarantined as disagreement", () => {
  const result = arbitrateSemanticJudgments(
    [
      semanticFixture("english"),
      semanticFixture("persian", "FAIL", 0.75),
      semanticFixture("pedagogical"),
      semanticFixture("adversarial"),
    ],
    semanticTestManifest,
  );
  assert.equal(result.status, "DISAGREEMENT");
});

test("semantic uncertainty never becomes pass", () => {
  const result = arbitrateSemanticJudgments(
    [
      semanticFixture("english"),
      semanticFixture("persian", "UNCERTAIN", 0.6),
      semanticFixture("pedagogical"),
      semanticFixture("adversarial"),
    ],
    semanticTestManifest,
  );
  assert.equal(result.status, "UNCERTAIN");
});

test("complete independent semantic evidence can pass", () => {
  const result = arbitrateSemanticJudgments(
    [
      semanticFixture("english"),
      semanticFixture("persian"),
      semanticFixture("pedagogical"),
      semanticFixture("adversarial"),
    ],
    semanticTestManifest,
    "generator-context",
  );
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.vetoes, []);
});
