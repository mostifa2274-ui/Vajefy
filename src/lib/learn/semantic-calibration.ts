import type {
  SemanticEvidenceBundle,
  SemanticJudgeRole,
} from "./assurance";
import {
  validateSemanticEvidenceBundles,
  type SemanticPacketReference,
} from "./semantic-evidence";

export type CalibrationCategory = "clean" | "defect" | "abstain";
export type CalibrationResult = "PASS" | "FAIL" | "UNCERTAIN";

export type SemanticCalibrationCase = {
  id: string;
  role: SemanticJudgeRole;
  category: CalibrationCategory;
  expectedCriterion: string | null;
  expectedResult: CalibrationResult;
};

export type SemanticCalibrationManifest = {
  requiredRunsPerRole: number;
  thresholds: {
    schemaComplianceRate: number;
    defectRecall: number;
    cleanFalsePositiveRateMax: number;
    cleanUncertainRateMax: number;
    abstainAccuracy: number;
    expectedLabelStability: number;
  };
};

export type SemanticCalibrationRoleSpec = {
  role: SemanticJudgeRole;
  promptVersion: string;
  rubricVersion: string;
  criteria: string[];
};

export type SemanticCalibrationPacket = SemanticPacketReference & {
  roles: SemanticCalibrationRoleSpec[];
};

export type CalibrationRunInput = {
  file: string;
  bundle?: SemanticEvidenceBundle;
  parseProblems?: string[];
};

export type SemanticCalibrationReport = {
  role: SemanticJudgeRole;
  candidate: {
    provider: string;
    modelId: string;
    modelVersion: string;
    promptVersion: string;
    rubricVersion: string;
  } | null;
  cases: number;
  metrics: {
    requestedRuns: number;
    validRuns: number;
    requiredRuns: number;
    schemaComplianceRate: number;
    defectRecall: number;
    cleanFalsePositiveRate: number;
    cleanUncertainRate: number;
    abstainAccuracy: number;
    expectedLabelStability: number;
  };
  thresholds: SemanticCalibrationManifest["thresholds"];
  checks: {
    enoughRuns: boolean;
    schemaCompliance: boolean;
    sameCandidate: boolean;
    independentRepeats: boolean;
    defectRecall: boolean;
    cleanFalsePositive: boolean;
    cleanUncertain: boolean;
    abstainAccuracy: boolean;
    stability: boolean;
  };
  promoted: boolean;
  invalidRuns: { file: string; problems: string[] }[];
};

function ratio(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 1;
}

function sameSet(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((item) => actual.includes(item))
  );
}

export function scoreSemanticCalibration(
  role: SemanticJudgeRole,
  allCases: SemanticCalibrationCase[],
  manifest: SemanticCalibrationManifest,
  packet: SemanticCalibrationPacket,
  runInputs: CalibrationRunInput[],
): SemanticCalibrationReport {
  const roleCases = allCases.filter((item) => item.role === role);
  const caseById = new Map(roleCases.map((item) => [item.id, item] as const));
  const roleSpec = packet.roles.find((item) => item.role === role);
  if (!roleSpec) {
    throw new Error(`Calibration packet missing role spec for ${role}`);
  }

  type ValidRun = {
    file: string;
    bundle: SemanticEvidenceBundle;
    labels: Map<string, CalibrationResult>;
    statuses: Map<string, CalibrationResult>;
    candidateKey: string;
    candidate: NonNullable<SemanticCalibrationReport["candidate"]>;
    contextKey: string;
    runId: string;
  };

  const validRuns: ValidRun[] = [];
  const invalidRuns: { file: string; problems: string[] }[] = [];

  for (const input of runInputs) {
    if (!input.bundle) {
      invalidRuns.push({
        file: input.file,
        problems: input.parseProblems?.length
          ? input.parseProblems
          : ["bundle-missing"],
      });
      continue;
    }

    const validation = validateSemanticEvidenceBundles(
      packet,
      [input.bundle],
      true,
    );
    const problems = [...validation.problems];
    const judgments = input.bundle.judgments;

    const identities = new Set(
      judgments.map((judgment) =>
        [
          judgment.evaluator.provider,
          judgment.evaluator.modelId,
          judgment.evaluator.modelVersion,
          judgment.evaluator.promptVersion,
          judgment.evaluator.rubricVersion,
        ].join("|"),
      ),
    );
    const contextKeys = new Set(
      judgments.map((judgment) => judgment.evaluator.contextIsolationKey),
    );
    const runIds = new Set(
      judgments.map((judgment) => judgment.evaluator.runId),
    );

    if (identities.size !== 1) problems.push("mixed-candidate-identity");
    if (contextKeys.size !== 1) problems.push("mixed-context-within-run");
    if (runIds.size !== 1) problems.push("mixed-run-id-within-run");

    for (const judgment of judgments) {
      if (judgment.evaluator.promptVersion !== roleSpec.promptVersion) {
        problems.push(`stale-prompt:${judgment.targetId}`);
      }
      if (judgment.evaluator.rubricVersion !== roleSpec.rubricVersion) {
        problems.push(`stale-rubric:${judgment.targetId}`);
      }
      if (
        !sameSet(
          judgment.criteria.map((criterion) => criterion.criterion),
          roleSpec.criteria,
        )
      ) {
        problems.push(`criteria-mismatch:${judgment.targetId}`);
      }
    }

    if (problems.length || !judgments.length) {
      invalidRuns.push({
        file: input.file,
        problems: problems.length ? [...new Set(problems)] : ["empty-run"],
      });
      continue;
    }

    const evaluator = judgments[0]!.evaluator;
    const candidate = {
      provider: evaluator.provider,
      modelId: evaluator.modelId,
      modelVersion: evaluator.modelVersion,
      promptVersion: evaluator.promptVersion,
      rubricVersion: evaluator.rubricVersion,
    };
    const candidateKey = Object.values(candidate).join("|");
    const labels = new Map<string, CalibrationResult>();
    const statuses = new Map<string, CalibrationResult>();

    for (const judgment of judgments) {
      const calibrationCase = caseById.get(judgment.targetId);
      if (!calibrationCase) continue;
      statuses.set(calibrationCase.id, judgment.status);
      if (calibrationCase.expectedCriterion) {
        const criterion = judgment.criteria.find(
          (item) => item.criterion === calibrationCase.expectedCriterion,
        );
        if (criterion) labels.set(calibrationCase.id, criterion.result);
      } else {
        labels.set(calibrationCase.id, judgment.status);
      }
    }

    validRuns.push({
      file: input.file,
      bundle: input.bundle,
      labels,
      statuses,
      candidateKey,
      candidate,
      contextKey: [...contextKeys][0]!,
      runId: [...runIds][0]!,
    });
  }

  let defectTotal = 0;
  let defectDetected = 0;
  let cleanTotal = 0;
  let cleanFalsePositive = 0;
  let cleanUncertain = 0;
  let abstainTotal = 0;
  let abstainCorrect = 0;

  for (const run of validRuns) {
    for (const calibrationCase of roleCases) {
      const label = run.labels.get(calibrationCase.id);
      const status = run.statuses.get(calibrationCase.id);
      if (!label || !status) continue;

      if (calibrationCase.category === "defect") {
        defectTotal += 1;
        if (label === "FAIL") defectDetected += 1;
      } else if (calibrationCase.category === "clean") {
        cleanTotal += 1;
        if (status === "FAIL") cleanFalsePositive += 1;
        if (status === "UNCERTAIN") cleanUncertain += 1;
      } else {
        abstainTotal += 1;
        if (label === "UNCERTAIN") abstainCorrect += 1;
      }
    }
  }

  let stableCases = 0;
  for (const calibrationCase of roleCases) {
    const labels = validRuns
      .map((run) => run.labels.get(calibrationCase.id))
      .filter((value): value is CalibrationResult => Boolean(value));
    if (
      labels.length === validRuns.length &&
      labels.length > 0 &&
      new Set(labels).size === 1
    ) {
      stableCases += 1;
    }
  }

  const candidateKeys = new Set(validRuns.map((run) => run.candidateKey));
  const contextKeys = validRuns.map((run) => run.contextKey);
  const runIds = validRuns.map((run) => run.runId);
  const sameCandidate = candidateKeys.size <= 1;
  const independentRepeats =
    new Set(contextKeys).size === contextKeys.length &&
    new Set(runIds).size === runIds.length;

  const metrics = {
    requestedRuns: runInputs.length,
    validRuns: validRuns.length,
    requiredRuns: manifest.requiredRunsPerRole,
    schemaComplianceRate: ratio(validRuns.length, runInputs.length),
    defectRecall: ratio(defectDetected, defectTotal),
    cleanFalsePositiveRate: ratio(cleanFalsePositive, cleanTotal),
    cleanUncertainRate: ratio(cleanUncertain, cleanTotal),
    abstainAccuracy: ratio(abstainCorrect, abstainTotal),
    expectedLabelStability: ratio(stableCases, roleCases.length),
  };

  const thresholds = manifest.thresholds;
  const checks = {
    enoughRuns: validRuns.length >= manifest.requiredRunsPerRole,
    schemaCompliance:
      metrics.schemaComplianceRate >= thresholds.schemaComplianceRate,
    sameCandidate,
    independentRepeats,
    defectRecall: metrics.defectRecall >= thresholds.defectRecall,
    cleanFalsePositive:
      metrics.cleanFalsePositiveRate <= thresholds.cleanFalsePositiveRateMax,
    cleanUncertain:
      metrics.cleanUncertainRate <= thresholds.cleanUncertainRateMax,
    abstainAccuracy: metrics.abstainAccuracy >= thresholds.abstainAccuracy,
    stability:
      metrics.expectedLabelStability >= thresholds.expectedLabelStability,
  };

  return {
    role,
    candidate: validRuns[0]?.candidate ?? null,
    cases: roleCases.length,
    metrics,
    thresholds,
    checks,
    promoted: Object.values(checks).every(Boolean),
    invalidRuns,
  };
}
