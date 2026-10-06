import assert from "node:assert/strict";
import test from "node:test";
import {
  semanticEvidenceBundle,
  semanticJudgeRecord,
  type SemanticEvidenceBundle,
} from "./assurance";
import {
  scoreSemanticCalibration,
  type CalibrationRunInput,
  type SemanticCalibrationCase,
  type SemanticCalibrationManifest,
  type SemanticCalibrationPacket,
} from "./semantic-calibration";

const role = "english" as const;
const hash = "a".repeat(64);

const cases: SemanticCalibrationCase[] = [
  {
    id: "cal-clean",
    role,
    category: "clean",
    expectedCriterion: null,
    expectedResult: "PASS",
  },
  {
    id: "cal-defect",
    role,
    category: "defect",
    expectedCriterion: "grammar",
    expectedResult: "FAIL",
  },
  {
    id: "cal-abstain",
    role,
    category: "abstain",
    expectedCriterion: "grammar",
    expectedResult: "UNCERTAIN",
  },
];

const manifest: SemanticCalibrationManifest = {
  requiredRunsPerRole: 3,
  thresholds: {
    schemaComplianceRate: 1,
    defectRecall: 1,
    cleanFalsePositiveRateMax: 0,
    cleanUncertainRateMax: 0,
    abstainAccuracy: 1,
    expectedLabelStability: 1,
  },
};

const packet: SemanticCalibrationPacket = {
  schemaVersion: 1,
  unitId: "calibration:v1:english",
  generationContextKey: "calibration-source",
  roles: [
    {
      role,
      promptVersion: "english-p1",
      rubricVersion: "english-v1",
      criteria: ["grammar", "naturalness"],
    },
  ],
  targets: cases.map((item) => ({
    targetId: item.id,
    contentVersion: "v1",
    inputHash: hash,
  })),
};

function bundle(
  runId: string,
  options: {
    clean?: "PASS" | "FAIL" | "UNCERTAIN";
    defect?: "PASS" | "FAIL" | "UNCERTAIN";
    abstain?: "PASS" | "FAIL" | "UNCERTAIN";
    modelVersion?: string;
    contextKey?: string;
  } = {},
): SemanticEvidenceBundle {
  const labels = {
    "cal-clean": options.clean ?? "PASS",
    "cal-defect": options.defect ?? "FAIL",
    "cal-abstain": options.abstain ?? "UNCERTAIN",
  } as const;

  const judgments = Object.entries(labels).map(([targetId, grammarResult]) => {
    const criteria = [
      {
        criterion: "grammar",
        result: grammarResult,
        confidence: 0.99,
        evidence: ["sense"],
        reasonCode: grammarResult === "PASS" ? null : "fixture",
      },
      {
        criterion: "naturalness",
        result: "PASS" as const,
        confidence: 0.99,
        evidence: ["sense"],
        reasonCode: null,
      },
    ];

    const status = criteria.some((item) => item.result === "FAIL")
      ? "FAIL"
      : criteria.some((item) => item.result === "UNCERTAIN")
        ? "UNCERTAIN"
        : "PASS";

    return semanticJudgeRecord.parse({
      schemaVersion: 1,
      role,
      targetId,
      contentVersion: "v1",
      inputHash: hash,
      generatedAt: "2026-10-06T00:00:00Z",
      evaluator: {
        kind: "model",
        provider: "fixture",
        modelId: "judge",
        modelVersion: options.modelVersion ?? "1",
        promptVersion: "english-p1",
        rubricVersion: "english-v1",
        contextIsolationKey: options.contextKey ?? `context-${runId}`,
        runId,
      },
      criteria,
      status,
    });
  });

  return semanticEvidenceBundle.parse({
    schemaVersion: 1,
    unitId: packet.unitId,
    generationContextKey: packet.generationContextKey,
    judgments,
  });
}

function runs(...bundles: SemanticEvidenceBundle[]): CalibrationRunInput[] {
  return bundles.map((item, index) => ({
    file: `run-${index + 1}.json`,
    bundle: item,
  }));
}

test("perfect repeated calibration promotes a candidate", () => {
  const report = scoreSemanticCalibration(
    role,
    cases,
    manifest,
    packet,
    runs(bundle("r1"), bundle("r2"), bundle("r3")),
  );
  assert.equal(report.promoted, true);
  assert.equal(report.metrics.defectRecall, 1);
  assert.equal(report.metrics.cleanFalsePositiveRate, 0);
  assert.equal(report.metrics.abstainAccuracy, 1);
  assert.equal(report.metrics.expectedLabelStability, 1);
});

test("missing a seeded defect blocks promotion", () => {
  const report = scoreSemanticCalibration(
    role,
    cases,
    manifest,
    packet,
    runs(
      bundle("r1"),
      bundle("r2", { defect: "PASS" }),
      bundle("r3"),
    ),
  );
  assert.equal(report.promoted, false);
  assert.ok(report.metrics.defectRecall < 1);
  assert.ok(report.metrics.expectedLabelStability < 1);
});

test("false positive on a clean control blocks promotion", () => {
  const report = scoreSemanticCalibration(
    role,
    cases,
    manifest,
    packet,
    runs(
      bundle("r1"),
      bundle("r2", { clean: "FAIL" }),
      bundle("r3"),
    ),
  );
  assert.equal(report.promoted, false);
  assert.ok(report.metrics.cleanFalsePositiveRate > 0);
});

test("replaying the same run id/context does not count as independent stability", () => {
  const report = scoreSemanticCalibration(
    role,
    cases,
    manifest,
    packet,
    runs(
      bundle("same", { contextKey: "same-context" }),
      bundle("same", { contextKey: "same-context" }),
      bundle("same", { contextKey: "same-context" }),
    ),
  );
  assert.equal(report.promoted, false);
  assert.equal(report.checks.independentRepeats, false);
});

test("mixing model versions blocks promotion", () => {
  const report = scoreSemanticCalibration(
    role,
    cases,
    manifest,
    packet,
    runs(
      bundle("r1", { modelVersion: "1" }),
      bundle("r2", { modelVersion: "2" }),
      bundle("r3", { modelVersion: "1" }),
    ),
  );
  assert.equal(report.promoted, false);
  assert.equal(report.checks.sameCandidate, false);
});

test("invalid or missing bundles reduce schema compliance", () => {
  const report = scoreSemanticCalibration(
    role,
    cases,
    manifest,
    packet,
    [
      ...runs(bundle("r1"), bundle("r2")),
      { file: "bad.json", parseProblems: ["schema-error"] },
    ],
  );
  assert.equal(report.promoted, false);
  assert.ok(report.metrics.schemaComplianceRate < 1);
  assert.equal(report.invalidRuns.length, 1);
});
